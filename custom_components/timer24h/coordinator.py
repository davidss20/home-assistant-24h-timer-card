"""Coordinator for Timer 24H integration scheduling and state management."""
from __future__ import annotations

import asyncio
import heapq
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import (
    async_track_point_in_time,
    async_track_state_change_event,
)
from homeassistant.util import dt as dt_util

from .const import (
    EVENT_CONDITION_CHANGED,
    EVENT_SCHEDULE_UPDATED,
    MINUTES_PER_SLOT,
    SLOTS_PER_DAY,
    STATE_OFF,
    STATE_ON,
)
from .models import Condition, Schedule, ScheduleState
from .storage import Timer24HStorage

_LOGGER = logging.getLogger(__name__)


class Timer24HCoordinator:
    """Coordinates all Timer 24H scheduling and state management."""
    
    def __init__(self, hass: HomeAssistant, storage: Timer24HStorage) -> None:
        """Initialize coordinator."""
        self.hass = hass
        self.storage = storage
        
        # Schedule states
        self._schedule_states: Dict[str, ScheduleState] = {}
        self._last_applied_states: Dict[str, bool] = {}
        
        # Timer queue (min-heap of (datetime, schedule_id))
        self._timer_queue: List[tuple[datetime, str]] = []
        self._next_timer_handle = None
        
        # Condition tracking
        self._condition_entities: Set[str] = set()
        self._condition_unsub = None
        
        # Setup flag
        self._setup_complete = False
    
    async def async_setup(self) -> None:
        """Set up the coordinator."""
        _LOGGER.info("Setting up Timer 24H coordinator")
        
        # Load schedules and build initial states
        schedules = await self.storage.async_get_all_schedules()
        for schedule in schedules.values():
            self._schedule_states[schedule.schedule_id] = ScheduleState(
                schedule=schedule
            )
        
        # Set up condition tracking
        await self._async_setup_condition_tracking()
        
        # Build timer queue and schedule next tick
        await self._async_rebuild_timer_queue()
        
        # Perform initial reconciliation
        await self.async_reconcile_all()
        
        self._setup_complete = True
        _LOGGER.info("Timer 24H coordinator setup complete")
    
    async def async_shutdown(self) -> None:
        """Shut down the coordinator."""
        _LOGGER.info("Shutting down Timer 24H coordinator")
        
        # Cancel timer
        if self._next_timer_handle:
            self._next_timer_handle()
            self._next_timer_handle = None
        
        # Unsubscribe from condition changes
        if self._condition_unsub:
            self._condition_unsub()
            self._condition_unsub = None
        
        # Clear state
        self._schedule_states.clear()
        self._last_applied_states.clear()
        self._timer_queue.clear()
        self._condition_entities.clear()
        
        self._setup_complete = False
        _LOGGER.info("Timer 24H coordinator shutdown complete")
    
    def _get_current_slot_index(self, now: Optional[datetime] = None) -> int:
        """Get the current slot index (0-47)."""
        if now is None:
            now = dt_util.now()
        
        # Convert to local time if needed
        if now.tzinfo is None:
            now = dt_util.as_local(now)
        
        # Calculate slot index
        total_minutes = now.hour * 60 + now.minute
        slot_index = (total_minutes // MINUTES_PER_SLOT) % SLOTS_PER_DAY
        
        return slot_index
    
    def _get_next_slot_time(self, now: Optional[datetime] = None) -> datetime:
        """Get the datetime of the next slot boundary."""
        if now is None:
            now = dt_util.now()
        
        # Convert to local time if needed
        if now.tzinfo is None:
            now = dt_util.as_local(now)
        
        # Calculate next slot time
        current_slot = self._get_current_slot_index(now)
        next_slot = (current_slot + 1) % SLOTS_PER_DAY
        
        # If next slot is 0, it's tomorrow
        if next_slot == 0:
            next_day = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            return next_day
        else:
            # Same day, calculate hour and minute
            slot_minutes = next_slot * MINUTES_PER_SLOT
            hour = slot_minutes // 60
            minute = slot_minutes % 60
            
            next_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            # If calculated time is in the past, add a day
            if next_time <= now:
                next_time += timedelta(days=1)
            
            return next_time
    
    async def _async_setup_condition_tracking(self) -> None:
        """Set up tracking for condition entities."""
        # Get all condition entities
        new_entities = self.storage.get_all_condition_entities()
        
        if new_entities == self._condition_entities:
            return  # No changes needed
        
        # Unsubscribe from old entities
        if self._condition_unsub:
            self._condition_unsub()
            self._condition_unsub = None
        
        self._condition_entities = new_entities
        
        if not self._condition_entities:
            return  # No entities to track
        
        # Subscribe to state changes
        @callback
        def _async_condition_changed(event):
            """Handle condition entity state change."""
            entity_id = event.data.get("entity_id")
            if entity_id in self._condition_entities:
                _LOGGER.debug("Condition entity %s changed, reconciling affected schedules", entity_id)
                self.hass.async_create_task(self._async_reconcile_schedules_with_condition(entity_id))
        
        self._condition_unsub = async_track_state_change_event(
            self.hass,
            list(self._condition_entities),
            _async_condition_changed
        )
        
        _LOGGER.debug("Set up condition tracking for %d entities", len(self._condition_entities))
    
    async def _async_reconcile_schedules_with_condition(self, entity_id: str) -> None:
        """Reconcile all schedules that have conditions involving the given entity."""
        for schedule_state in self._schedule_states.values():
            schedule = schedule_state.schedule
            for condition in schedule.conditions:
                if condition.entity_id == entity_id:
                    await self.async_reconcile_schedule(schedule.schedule_id)
                    break
    
    async def _async_rebuild_timer_queue(self) -> None:
        """Rebuild the timer queue with upcoming slot boundaries."""
        self._timer_queue.clear()
        
        if not self._schedule_states:
            return
        
        # Cancel existing timer
        if self._next_timer_handle:
            self._next_timer_handle()
            self._next_timer_handle = None
        
        # Schedule next slot boundary
        now = dt_util.now()
        next_time = self._get_next_slot_time(now)
        
        self._next_timer_handle = async_track_point_in_time(
            self.hass,
            self._async_timer_tick,
            next_time
        )
        
        _LOGGER.debug("Scheduled next timer tick at %s", next_time)
    
    @callback
    def _async_timer_tick(self, now: datetime) -> None:
        """Handle timer tick (slot boundary reached)."""
        _LOGGER.debug("Timer tick at %s", now)
        
        # Schedule next tick first
        self.hass.async_create_task(self._async_rebuild_timer_queue())
        
        # Process all schedules for current slot
        self.hass.async_create_task(self.async_reconcile_all())
    
    async def async_reconcile_all(self) -> None:
        """Reconcile all schedules to current state."""
        _LOGGER.debug("Reconciling all schedules")
        
        tasks = [
            self.async_reconcile_schedule(schedule_id)
            for schedule_id in self._schedule_states.keys()
        ]
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def async_reconcile_schedule(self, schedule_id: str) -> None:
        """Reconcile a specific schedule to current state."""
        schedule_state = self._schedule_states.get(schedule_id)
        if not schedule_state:
            _LOGGER.warning("Cannot reconcile unknown schedule: %s", schedule_id)
            return
        
        schedule = schedule_state.schedule
        
        if not schedule.enabled:
            schedule_state.desired_state = False
            schedule_state.last_condition_evaluation = "Schedule disabled"
        else:
            # Get current slot
            now = dt_util.now()
            current_slot = self._get_current_slot_index(now)
            
            # Check if current slot is active
            slot_active = schedule.is_active_at_slot(current_slot)
            
            if not slot_active:
                schedule_state.desired_state = False
                schedule_state.last_condition_evaluation = f"Slot {current_slot} inactive"
            else:
                # Evaluate conditions
                states = {
                    entity_id: self.hass.states.get(entity_id, default=None).state
                    if self.hass.states.get(entity_id) else "unknown"
                    for entity_id in self.storage.get_all_condition_entities()
                }
                
                condition_result, reason = schedule.evaluate_conditions(states)
                schedule_state.last_condition_evaluation = reason
                
                if condition_result is None:
                    # Skip or defer - don't change state
                    _LOGGER.debug("Schedule %s: %s", schedule_id, reason)
                    return
                elif condition_result:
                    schedule_state.desired_state = True
                else:
                    schedule_state.desired_state = False
        
        # Apply state if it differs from last applied
        await self._async_apply_schedule_state(schedule_state)
        
        # Fire event
        self.hass.bus.async_fire(EVENT_SCHEDULE_UPDATED, {
            "schedule_id": schedule_id,
            "desired_state": schedule_state.desired_state,
            "last_condition_evaluation": schedule_state.last_condition_evaluation,
        })
    
    async def _async_apply_schedule_state(self, schedule_state: ScheduleState) -> None:
        """Apply the desired state for a schedule."""
        schedule = schedule_state.schedule
        desired = schedule_state.desired_state
        last_applied = self._last_applied_states.get(schedule.target_entity_id)
        
        if desired is None or desired == last_applied:
            return  # No change needed
        
        # Get target entity
        entity = self.hass.states.get(schedule.target_entity_id)
        if not entity:
            _LOGGER.warning("Target entity %s not found", schedule.target_entity_id)
            return
        
        # Determine service domain
        domain = schedule.target_entity_id.split(".")[0]
        
        try:
            if desired:
                await self.hass.services.async_call(
                    domain if domain in ["light", "switch", "fan", "climate"] else "homeassistant",
                    "turn_on",
                    {"entity_id": schedule.target_entity_id}
                )
                _LOGGER.info("Turned on %s (schedule: %s)", schedule.target_entity_id, schedule.schedule_id)
            else:
                await self.hass.services.async_call(
                    domain if domain in ["light", "switch", "fan", "climate"] else "homeassistant",
                    "turn_off",
                    {"entity_id": schedule.target_entity_id}
                )
                _LOGGER.info("Turned off %s (schedule: %s)", schedule.target_entity_id, schedule.schedule_id)
            
            # Remember what we applied
            self._last_applied_states[schedule.target_entity_id] = desired
            schedule_state.last_applied_state = desired
            
        except Exception as err:
            _LOGGER.error(
                "Failed to control %s for schedule %s: %s",
                schedule.target_entity_id,
                schedule.schedule_id,
                err
            )
    
    # Schedule management methods
    
    async def async_set_schedule(
        self,
        schedule_id: str,
        target_entity_id: str,
        slots: List[bool],
        enabled: bool = True,
        timezone: Optional[str] = None
    ) -> None:
        """Set a schedule."""
        schedule = Schedule(
            schedule_id=schedule_id,
            target_entity_id=target_entity_id,
            slots=slots,
            enabled=enabled,
            timezone=timezone,
        )
        
        await self.storage.async_add_schedule(schedule)
        
        # Update state
        self._schedule_states[schedule_id] = ScheduleState(schedule=schedule)
        
        # Update condition tracking
        await self._async_setup_condition_tracking()
        
        # Reconcile this schedule
        await self.async_reconcile_schedule(schedule_id)
        
        _LOGGER.info("Set schedule: %s", schedule_id)
    
    async def async_enable_schedule(self, schedule_id: str) -> None:
        """Enable a schedule."""
        if await self.storage.async_enable_schedule(schedule_id):
            # Update state
            schedule = await self.storage.async_get_schedule(schedule_id)
            if schedule:
                self._schedule_states[schedule_id].schedule = schedule
                await self.async_reconcile_schedule(schedule_id)
                _LOGGER.info("Enabled schedule: %s", schedule_id)
    
    async def async_disable_schedule(self, schedule_id: str) -> None:
        """Disable a schedule."""
        if await self.storage.async_disable_schedule(schedule_id):
            # Update state
            schedule = await self.storage.async_get_schedule(schedule_id)
            if schedule:
                self._schedule_states[schedule_id].schedule = schedule
                await self.async_reconcile_schedule(schedule_id)
                _LOGGER.info("Disabled schedule: %s", schedule_id)
    
    async def async_set_conditions(self, schedule_id: str, conditions: List[Dict[str, Any]]) -> None:
        """Set conditions for a schedule."""
        if await self.storage.async_set_conditions(schedule_id, conditions):
            # Update state
            schedule = await self.storage.async_get_schedule(schedule_id)
            if schedule:
                self._schedule_states[schedule_id].schedule = schedule
                
                # Update condition tracking
                await self._async_setup_condition_tracking()
                
                # Reconcile this schedule
                await self.async_reconcile_schedule(schedule_id)
                _LOGGER.info("Set conditions for schedule: %s", schedule_id)
    
    async def async_remove_schedule(self, schedule_id: str) -> None:
        """Remove a schedule."""
        if await self.storage.async_remove_schedule(schedule_id):
            # Remove from state
            self._schedule_states.pop(schedule_id, None)
            
            # Update condition tracking
            await self._async_setup_condition_tracking()
            
            _LOGGER.info("Removed schedule: %s", schedule_id)
    
    # API methods for WebSocket and services
    
    def get_schedule_state(self, schedule_id: str) -> Optional[ScheduleState]:
        """Get the current state of a schedule."""
        return self._schedule_states.get(schedule_id)
    
    def get_all_schedule_states(self) -> Dict[str, ScheduleState]:
        """Get all schedule states."""
        return self._schedule_states.copy()
    
    def get_schedule_preview(self, schedule_id: str, hours: int = 24) -> List[bool]:
        """Get a preview of schedule activation for the next N hours."""
        schedule_state = self._schedule_states.get(schedule_id)
        if not schedule_state:
            return [False] * (hours * 2)  # 2 slots per hour
        
        schedule = schedule_state.schedule
        if not schedule.enabled:
            return [False] * (hours * 2)
        
        # Get current conditions
        states = {
            entity_id: self.hass.states.get(entity_id, default=None).state
            if self.hass.states.get(entity_id) else "unknown"
            for entity_id in self.storage.get_all_condition_entities()
        }
        
        condition_result, _ = schedule.evaluate_conditions(states)
        
        # If conditions would prevent activation, return all False
        if condition_result is False:
            return [False] * (hours * 2)
        
        # Build preview based on schedule slots
        now = dt_util.now()
        current_slot = self._get_current_slot_index(now)
        
        preview = []
        for i in range(hours * 2):
            slot_index = (current_slot + i) % SLOTS_PER_DAY
            if condition_result is None:
                # Conditions would skip/defer - show schedule but indicate it won't apply
                preview.append(schedule.is_active_at_slot(slot_index))
            else:
                preview.append(schedule.is_active_at_slot(slot_index))
        
        return preview
