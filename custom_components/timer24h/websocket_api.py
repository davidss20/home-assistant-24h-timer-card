"""WebSocket API for Timer 24H integration."""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


@callback
def async_register_websocket_handlers(hass: HomeAssistant) -> None:
    """Register WebSocket API handlers."""
    websocket_api.async_register_command(hass, ws_get_schedule)
    websocket_api.async_register_command(hass, ws_list_schedules)
    websocket_api.async_register_command(hass, ws_preview_schedule)
    websocket_api.async_register_command(hass, ws_get_schedule_state)
    websocket_api.async_register_command(hass, ws_get_all_states)


@websocket_api.websocket_command({
    vol.Required("type"): "timer24h/get",
    vol.Required("schedule_id"): str,
})
@websocket_api.async_response
async def ws_get_schedule(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: Dict[str, Any],
) -> None:
    """Get a specific schedule."""
    schedule_id = msg["schedule_id"]
    
    # Get coordinator from first entry (assuming single instance)
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "integration_not_setup", "Timer 24H integration not set up")
        return
    
    coordinator = hass.data[DOMAIN][entries[0].entry_id]["coordinator"]
    storage = hass.data[DOMAIN][entries[0].entry_id]["storage"]
    
    schedule = await storage.async_get_schedule(schedule_id)
    
    if schedule is None:
        connection.send_result(msg["id"], None)
        return
    
    # Get additional state information
    schedule_state = coordinator.get_schedule_state(schedule_id)
    
    result = {
        "schedule": schedule.to_dict(),
        "state": {
            "desired_state": schedule_state.desired_state if schedule_state else None,
            "last_applied_state": schedule_state.last_applied_state if schedule_state else None,
            "last_condition_evaluation": schedule_state.last_condition_evaluation if schedule_state else None,
            "next_tick_time": schedule_state.next_tick_time if schedule_state else None,
        }
    }
    
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({
    vol.Required("type"): "timer24h/list",
})
@websocket_api.async_response
async def ws_list_schedules(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: Dict[str, Any],
) -> None:
    """List all schedules."""
    # Get coordinator from first entry
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "integration_not_setup", "Timer 24H integration not set up")
        return
    
    coordinator = hass.data[DOMAIN][entries[0].entry_id]["coordinator"]
    storage = hass.data[DOMAIN][entries[0].entry_id]["storage"]
    
    schedules = await storage.async_get_all_schedules()
    
    result = []
    for schedule_id, schedule in schedules.items():
        schedule_state = coordinator.get_schedule_state(schedule_id)
        
        result.append({
            "schedule_id": schedule_id,
            "target_entity_id": schedule.target_entity_id,
            "enabled": schedule.enabled,
            "timezone": schedule.timezone,
            "conditions_count": len(schedule.conditions),
            "active_slots_count": sum(schedule.slots),
            "state": {
                "desired_state": schedule_state.desired_state if schedule_state else None,
                "last_applied_state": schedule_state.last_applied_state if schedule_state else None,
                "last_condition_evaluation": schedule_state.last_condition_evaluation if schedule_state else None,
            }
        })
    
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({
    vol.Required("type"): "timer24h/preview",
    vol.Required("schedule_id"): str,
    vol.Optional("hours", default=24): vol.All(int, vol.Range(min=1, max=168)),  # 1 hour to 1 week
})
@websocket_api.async_response
async def ws_preview_schedule(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: Dict[str, Any],
) -> None:
    """Get a preview of schedule activation for the next N hours."""
    schedule_id = msg["schedule_id"]
    hours = msg.get("hours", 24)
    
    # Get coordinator from first entry
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "integration_not_setup", "Timer 24H integration not set up")
        return
    
    coordinator = hass.data[DOMAIN][entries[0].entry_id]["coordinator"]
    
    preview = coordinator.get_schedule_preview(schedule_id, hours)
    
    if preview is None:
        connection.send_error(msg["id"], "schedule_not_found", f"Schedule {schedule_id} not found")
        return
    
    # Convert to time-labeled format for easier consumption
    from datetime import timedelta
    from homeassistant.util import dt as dt_util
    
    now = dt_util.now()
    current_slot = coordinator._get_current_slot_index(now)
    
    result = {
        "schedule_id": schedule_id,
        "hours": hours,
        "slots": []
    }
    
    for i, active in enumerate(preview):
        slot_time = now + timedelta(minutes=i * 30)
        slot_index = (current_slot + i) % 48
        
        result["slots"].append({
            "slot_index": slot_index,
            "time": slot_time.isoformat(),
            "hour": slot_time.hour,
            "minute": slot_time.minute,
            "active": active,
        })
    
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({
    vol.Required("type"): "timer24h/get_state",
    vol.Required("schedule_id"): str,
})
@websocket_api.async_response
async def ws_get_schedule_state(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: Dict[str, Any],
) -> None:
    """Get the current state of a specific schedule."""
    schedule_id = msg["schedule_id"]
    
    # Get coordinator from first entry
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "integration_not_setup", "Timer 24H integration not set up")
        return
    
    coordinator = hass.data[DOMAIN][entries[0].entry_id]["coordinator"]
    
    schedule_state = coordinator.get_schedule_state(schedule_id)
    
    if schedule_state is None:
        connection.send_error(msg["id"], "schedule_not_found", f"Schedule {schedule_id} not found")
        return
    
    # Get current slot info
    from homeassistant.util import dt as dt_util
    
    now = dt_util.now()
    current_slot = coordinator._get_current_slot_index(now)
    next_slot_time = coordinator._get_next_slot_time(now)
    
    result = {
        "schedule_id": schedule_id,
        "desired_state": schedule_state.desired_state,
        "last_applied_state": schedule_state.last_applied_state,
        "last_condition_evaluation": schedule_state.last_condition_evaluation,
        "current_slot": current_slot,
        "next_slot_time": next_slot_time.isoformat(),
        "schedule": schedule_state.schedule.to_dict(),
    }
    
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({
    vol.Required("type"): "timer24h/get_all_states",
})
@websocket_api.async_response
async def ws_get_all_states(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: Dict[str, Any],
) -> None:
    """Get the current state of all schedules."""
    # Get coordinator from first entry
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "integration_not_setup", "Timer 24H integration not set up")
        return
    
    coordinator = hass.data[DOMAIN][entries[0].entry_id]["coordinator"]
    
    all_states = coordinator.get_all_schedule_states()
    
    # Get current slot info
    from homeassistant.util import dt as dt_util
    
    now = dt_util.now()
    current_slot = coordinator._get_current_slot_index(now)
    next_slot_time = coordinator._get_next_slot_time(now)
    
    result = {
        "current_slot": current_slot,
        "next_slot_time": next_slot_time.isoformat(),
        "schedules": {}
    }
    
    for schedule_id, schedule_state in all_states.items():
        result["schedules"][schedule_id] = {
            "desired_state": schedule_state.desired_state,
            "last_applied_state": schedule_state.last_applied_state,
            "last_condition_evaluation": schedule_state.last_condition_evaluation,
            "schedule": schedule_state.schedule.to_dict(),
        }
    
    connection.send_result(msg["id"], result)
