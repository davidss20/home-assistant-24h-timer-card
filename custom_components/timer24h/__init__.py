"""
Timer 24H Custom Integration for Home Assistant.

This integration provides server-side timer scheduling with 24-hour (48 half-hour slots)
precision, condition-based automation, and comprehensive state management.
"""
import asyncio
import logging
from datetime import timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers import discovery
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN, PLATFORMS
from .coordinator import Timer24HCoordinator
from .storage import Timer24HStorage
from .websocket_api import async_register_websocket_handlers

_LOGGER = logging.getLogger(__name__)

SCAN_INTERVAL = timedelta(seconds=30)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Timer 24H integration via YAML (deprecated)."""
    # YAML configuration is deprecated in favor of config flow
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Timer 24H from a config entry."""
    _LOGGER.info("Setting up Timer 24H integration")
    
    # Initialize storage
    storage = Timer24HStorage(hass)
    
    # Initialize coordinator
    coordinator = Timer24HCoordinator(hass, storage)
    
    # Store in hass.data
    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = {}
    
    hass.data[DOMAIN][entry.entry_id] = {
        "coordinator": coordinator,
        "storage": storage,
    }
    
    # Load data and start coordinator
    try:
        await storage.async_load()
        await coordinator.async_setup()
    except Exception as err:
        _LOGGER.error("Failed to set up Timer 24H: %s", err)
        raise ConfigEntryNotReady from err
    
    # Register websocket API
    async_register_websocket_handlers(hass)
    
    # Set up platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    
    # Register services
    await _async_register_services(hass, coordinator)
    
    _LOGGER.info("Timer 24H integration setup complete")
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    _LOGGER.info("Unloading Timer 24H integration")
    
    # Unload platforms
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    
    if unload_ok:
        # Clean up coordinator
        data = hass.data[DOMAIN].pop(entry.entry_id)
        coordinator = data["coordinator"]
        await coordinator.async_shutdown()
    
    return unload_ok


async def _async_register_services(hass: HomeAssistant, coordinator: Timer24HCoordinator) -> None:
    """Register Timer 24H services."""
    
    async def async_set_schedule(call):
        """Service to set a schedule."""
        schedule_id = call.data.get("schedule_id")
        target_entity_id = call.data.get("target_entity_id")
        slots = call.data.get("slots", [False] * 48)
        enabled = call.data.get("enabled", True)
        timezone = call.data.get("timezone")
        
        if not schedule_id or not target_entity_id:
            _LOGGER.error("schedule_id and target_entity_id are required")
            return
        
        if len(slots) != 48:
            _LOGGER.error("slots must contain exactly 48 boolean values")
            return
        
        # Validate target entity exists
        if target_entity_id not in hass.states.async_entity_ids():
            _LOGGER.error("Target entity %s does not exist", target_entity_id)
            return
        
        await coordinator.async_set_schedule(
            schedule_id=schedule_id,
            target_entity_id=target_entity_id,
            slots=slots,
            enabled=enabled,
            timezone=timezone
        )
    
    async def async_enable_schedule(call):
        """Service to enable a schedule."""
        schedule_id = call.data.get("schedule_id")
        if not schedule_id:
            _LOGGER.error("schedule_id is required")
            return
        
        await coordinator.async_enable_schedule(schedule_id)
    
    async def async_disable_schedule(call):
        """Service to disable a schedule."""
        schedule_id = call.data.get("schedule_id")
        if not schedule_id:
            _LOGGER.error("schedule_id is required")
            return
        
        await coordinator.async_disable_schedule(schedule_id)
    
    async def async_set_conditions(call):
        """Service to set conditions for a schedule."""
        schedule_id = call.data.get("schedule_id")
        conditions = call.data.get("conditions", [])
        
        if not schedule_id:
            _LOGGER.error("schedule_id is required")
            return
        
        await coordinator.async_set_conditions(schedule_id, conditions)
    
    async def async_remove_schedule(call):
        """Service to remove a schedule."""
        schedule_id = call.data.get("schedule_id")
        if not schedule_id:
            _LOGGER.error("schedule_id is required")
            return
        
        await coordinator.async_remove_schedule(schedule_id)
    
    async def async_reconcile(call):
        """Service to manually trigger reconciliation."""
        schedule_id = call.data.get("schedule_id")
        if schedule_id:
            await coordinator.async_reconcile_schedule(schedule_id)
        else:
            await coordinator.async_reconcile_all()
    
    # Register services
    hass.services.async_register(DOMAIN, "set_schedule", async_set_schedule)
    hass.services.async_register(DOMAIN, "enable", async_enable_schedule)
    hass.services.async_register(DOMAIN, "disable", async_disable_schedule)
    hass.services.async_register(DOMAIN, "set_conditions", async_set_conditions)
    hass.services.async_register(DOMAIN, "remove", async_remove_schedule)
    hass.services.async_register(DOMAIN, "reconcile", async_reconcile)
    
    _LOGGER.info("Timer 24H services registered")
