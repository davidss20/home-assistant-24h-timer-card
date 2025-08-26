"""Schedule entities for Timer 24H integration."""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity
from homeassistant.util import dt as dt_util

from .const import DOMAIN, EVENT_SCHEDULE_UPDATED, STATE_DISABLED, STATE_OFF, STATE_ON
from .coordinator import Timer24HCoordinator
from .models import ScheduleState

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Timer 24H schedule entities."""
    coordinator = hass.data[DOMAIN][entry.entry_id]["coordinator"]
    storage = hass.data[DOMAIN][entry.entry_id]["storage"]
    
    # Create sensor entities for existing schedules
    schedules = await storage.async_get_all_schedules()
    entities = []
    
    for schedule_id, schedule in schedules.items():
        entities.append(Timer24HScheduleEntity(coordinator, schedule_id))
    
    async_add_entities(entities)
    
    # Listen for new schedules
    @callback
    def _schedule_updated(event):
        schedule_id = event.data.get("schedule_id")
        if schedule_id:
            # Check if entity already exists
            existing_entities = [
                entity for entity in hass.data[DOMAIN].get("entities", [])
                if hasattr(entity, "schedule_id") and entity.schedule_id == schedule_id
            ]
            
            if not existing_entities:
                # Create new entity
                entity = Timer24HScheduleEntity(coordinator, schedule_id)
                async_add_entities([entity])
                
                # Store reference
                if "entities" not in hass.data[DOMAIN]:
                    hass.data[DOMAIN]["entities"] = []
                hass.data[DOMAIN]["entities"].append(entity)
    
    hass.bus.async_listen(EVENT_SCHEDULE_UPDATED, _schedule_updated)


class Timer24HScheduleEntity(SensorEntity, RestoreEntity):
    """Sensor entity representing a Timer 24H schedule state."""
    
    def __init__(self, coordinator: Timer24HCoordinator, schedule_id: str) -> None:
        """Initialize the schedule entity."""
        self._coordinator = coordinator
        self._schedule_id = schedule_id
        self._attr_entity_category = EntityCategory.DIAGNOSTIC
        
        # Generate unique ID and name
        self._attr_unique_id = f"{DOMAIN}_{schedule_id}"
        self._attr_name = f"Timer 24H {schedule_id.replace('_', ' ').title()}"
        
        # Device info
        self._attr_device_info = {
            "identifiers": {(DOMAIN, "timer24h")},
            "name": "Timer 24H",
            "manufacturer": "Timer 24H Integration",
            "model": "Schedule Controller",
            "sw_version": "1.0.0",
        }
        
        # Initialize state
        self._state = None
        self._attrs = {}
        self._available = True
    
    @property
    def schedule_id(self) -> str:
        """Return the schedule ID."""
        return self._schedule_id
    
    @property
    def native_value(self) -> Optional[str]:
        """Return the state of the schedule."""
        schedule_state = self._coordinator.get_schedule_state(self._schedule_id)
        if not schedule_state:
            return STATE_DISABLED
        
        if not schedule_state.schedule.enabled:
            return STATE_DISABLED
        
        desired = schedule_state.desired_state
        if desired is None:
            return STATE_OFF  # Conditions prevent activation
        
        return STATE_ON if desired else STATE_OFF
    
    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Return additional state attributes."""
        schedule_state = self._coordinator.get_schedule_state(self._schedule_id)
        if not schedule_state:
            return {}
        
        schedule = schedule_state.schedule
        
        # Get current slot info
        now = dt_util.now()
        current_slot = self._coordinator._get_current_slot_index(now)
        next_slot_time = self._coordinator._get_next_slot_time(now)
        
        # Calculate next state change
        next_change_slot = None
        next_change_state = None
        current_state = schedule.is_active_at_slot(current_slot)
        
        for i in range(1, 48):  # Check next 47 slots (47.5 hours)
            slot_index = (current_slot + i) % 48
            slot_state = schedule.is_active_at_slot(slot_index)
            if slot_state != current_state:
                next_change_slot = slot_index
                next_change_state = slot_state
                break
        
        next_change_time = None
        if next_change_slot is not None:
            # Calculate time for next change
            slots_ahead = next_change_slot - current_slot
            if slots_ahead <= 0:
                slots_ahead += 48  # Next day
            next_change_time = now + dt_util.dt.timedelta(minutes=slots_ahead * 30)
        
        attrs = {
            "schedule_id": self._schedule_id,
            "target_entity_id": schedule.target_entity_id,
            "enabled": schedule.enabled,
            "timezone": schedule.timezone,
            "current_slot": current_slot,
            "current_slot_active": schedule.is_active_at_slot(current_slot),
            "next_slot_time": next_slot_time.isoformat() if next_slot_time else None,
            "desired_state": schedule_state.desired_state,
            "last_applied_state": schedule_state.last_applied_state,
            "last_condition_evaluation": schedule_state.last_condition_evaluation,
            "active_slots_count": sum(schedule.slots),
            "total_slots": len(schedule.slots),
            "conditions_count": len(schedule.conditions),
            "next_change_slot": next_change_slot,
            "next_change_state": next_change_state,
            "next_change_time": next_change_time.isoformat() if next_change_time else None,
        }
        
        # Add condition details
        if schedule.conditions:
            condition_states = {}
            for condition in schedule.conditions:
                entity_state = self.hass.states.get(condition.entity_id)
                condition_states[condition.entity_id] = {
                    "expected": condition.expected,
                    "policy": condition.policy,
                    "current_state": entity_state.state if entity_state else "unknown",
                    "is_met": condition.is_met(entity_state.state if entity_state else "unknown"),
                }
            attrs["condition_states"] = condition_states
        
        # Add schedule slots for visualization
        attrs["slots"] = schedule.slots
        
        return attrs
    
    @property
    def available(self) -> bool:
        """Return if entity is available."""
        return self._available
    
    @property
    def icon(self) -> str:
        """Return the icon for the entity."""
        state = self.native_value
        if state == STATE_DISABLED:
            return "mdi:timer-off"
        elif state == STATE_ON:
            return "mdi:timer"
        else:
            return "mdi:timer-outline"
    
    async def async_added_to_hass(self) -> None:
        """When entity is added to hass."""
        await super().async_added_to_hass()
        
        # Restore state
        last_state = await self.async_get_last_state()
        if last_state:
            self._state = last_state.state
            self._attrs = dict(last_state.attributes)
        
        # Listen for schedule updates
        @callback
        def _schedule_updated(event):
            if event.data.get("schedule_id") == self._schedule_id:
                self.async_write_ha_state()
        
        self.async_on_remove(
            self.hass.bus.async_listen(EVENT_SCHEDULE_UPDATED, _schedule_updated)
        )
        
        # Schedule periodic updates
        @callback
        def _periodic_update():
            self.async_write_ha_state()
        
        # Update every minute to reflect current slot changes
        self.async_on_remove(
            self.hass.helpers.event.async_track_time_interval(
                _periodic_update,
                dt_util.dt.timedelta(minutes=1)
            )
        )
    
    async def async_will_remove_from_hass(self) -> None:
        """When entity will be removed from hass."""
        # Clean up any references
        entities = self.hass.data[DOMAIN].get("entities", [])
        if self in entities:
            entities.remove(self)
