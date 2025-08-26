"""Storage management for Timer 24H integration."""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION
from .models import Schedule, Timer24HData

_LOGGER = logging.getLogger(__name__)


class Timer24HStorage:
    """Manages persistent storage for Timer 24H data."""
    
    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize storage."""
        self.hass = hass
        self._store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data = Timer24HData()
        self._loaded = False
    
    async def async_load(self) -> None:
        """Load data from storage."""
        if self._loaded:
            return
        
        try:
            stored_data = await self._store.async_load()
            if stored_data is not None:
                self._data = Timer24HData.from_dict(stored_data)
                _LOGGER.info("Loaded %d schedules from storage", len(self._data.schedules))
            else:
                _LOGGER.info("No existing data found, starting with empty storage")
                self._data = Timer24HData()
        except Exception as err:
            _LOGGER.error("Failed to load Timer 24H data: %s", err)
            self._data = Timer24HData()
        
        self._loaded = True
    
    async def async_save(self) -> None:
        """Save data to storage."""
        if not self._loaded:
            _LOGGER.warning("Attempting to save before loading")
            return
        
        try:
            await self._store.async_save(self._data.to_dict())
            _LOGGER.debug("Saved Timer 24H data to storage")
        except Exception as err:
            _LOGGER.error("Failed to save Timer 24H data: %s", err)
    
    @property
    def data(self) -> Timer24HData:
        """Get the data object."""
        return self._data
    
    async def async_add_schedule(self, schedule: Schedule) -> None:
        """Add or update a schedule."""
        self._data.add_schedule(schedule)
        await self.async_save()
        _LOGGER.info("Added/updated schedule: %s", schedule.schedule_id)
    
    async def async_remove_schedule(self, schedule_id: str) -> bool:
        """Remove a schedule. Returns True if schedule existed."""
        existed = self._data.remove_schedule(schedule_id)
        if existed:
            await self.async_save()
            _LOGGER.info("Removed schedule: %s", schedule_id)
        else:
            _LOGGER.warning("Attempted to remove non-existent schedule: %s", schedule_id)
        return existed
    
    async def async_get_schedule(self, schedule_id: str) -> Optional[Schedule]:
        """Get a schedule by ID."""
        return self._data.get_schedule(schedule_id)
    
    async def async_get_all_schedules(self) -> Dict[str, Schedule]:
        """Get all schedules."""
        return self._data.schedules.copy()
    
    async def async_update_schedule(
        self,
        schedule_id: str,
        target_entity_id: Optional[str] = None,
        slots: Optional[list[bool]] = None,
        enabled: Optional[bool] = None,
        timezone: Optional[str] = None,
        conditions: Optional[list] = None,
    ) -> bool:
        """
        Update specific fields of a schedule.
        Returns True if schedule was updated, False if not found.
        """
        schedule = self._data.get_schedule(schedule_id)
        if schedule is None:
            return False
        
        # Update fields if provided
        if target_entity_id is not None:
            schedule.target_entity_id = target_entity_id
        
        if slots is not None:
            if len(slots) != 48:
                raise ValueError("Slots must contain exactly 48 boolean values")
            schedule.slots = slots
        
        if enabled is not None:
            schedule.enabled = enabled
        
        if timezone is not None:
            schedule.timezone = timezone
        
        if conditions is not None:
            from .models import Condition
            schedule.conditions = [
                Condition.from_dict(c) if isinstance(c, dict) else c
                for c in conditions
            ]
        
        await self.async_save()
        _LOGGER.info("Updated schedule: %s", schedule_id)
        return True
    
    async def async_enable_schedule(self, schedule_id: str) -> bool:
        """Enable a schedule. Returns True if successful."""
        return await self.async_update_schedule(schedule_id, enabled=True)
    
    async def async_disable_schedule(self, schedule_id: str) -> bool:
        """Disable a schedule. Returns True if successful."""
        return await self.async_update_schedule(schedule_id, enabled=False)
    
    async def async_set_conditions(self, schedule_id: str, conditions: list) -> bool:
        """Set conditions for a schedule. Returns True if successful."""
        return await self.async_update_schedule(schedule_id, conditions=conditions)
    
    def get_schedules_for_entity(self, entity_id: str) -> list[Schedule]:
        """Get all schedules that target a specific entity."""
        return self._data.get_schedules_for_entity(entity_id)
    
    def get_all_condition_entities(self) -> set[str]:
        """Get all entity IDs referenced by conditions."""
        return self._data.get_all_condition_entities()
    
    async def async_clear_all(self) -> None:
        """Clear all data (for testing/reset purposes)."""
        self._data = Timer24HData()
        await self.async_save()
        _LOGGER.info("Cleared all Timer 24H data")
    
    async def async_export_data(self) -> Dict[str, Any]:
        """Export all data for backup purposes."""
        return self._data.to_dict()
    
    async def async_import_data(self, data: Dict[str, Any]) -> None:
        """Import data from backup."""
        try:
            self._data = Timer24HData.from_dict(data)
            await self.async_save()
            _LOGGER.info("Imported Timer 24H data with %d schedules", len(self._data.schedules))
        except Exception as err:
            _LOGGER.error("Failed to import Timer 24H data: %s", err)
            raise
