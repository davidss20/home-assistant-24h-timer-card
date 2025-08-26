"""Config flow for Timer 24H integration."""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_NAME
from homeassistant.core import HomeAssistant, callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers import selector

from .const import (
    CONF_SCHEDULE_ID,
    CONF_TARGET_ENTITY_ID,
    CONF_TIMEZONE,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)

STEP_USER_DATA_SCHEMA = vol.Schema({
    vol.Required(CONF_NAME, default="Timer 24H"): str,
})

STEP_SCHEDULE_DATA_SCHEMA = vol.Schema({
    vol.Required(CONF_SCHEDULE_ID, default="main"): str,
    vol.Required(CONF_TARGET_ENTITY_ID): selector.EntitySelector(
        selector.EntitySelectorConfig(
            domain=["light", "switch", "fan", "climate", "media_player", "cover", "input_boolean"]
        )
    ),
    vol.Optional(CONF_TIMEZONE): selector.SelectSelector(
        selector.SelectSelectorConfig(
            options=[
                {"value": "", "label": "Use Home Assistant timezone"},
                {"value": "UTC", "label": "UTC"},
                {"value": "America/New_York", "label": "America/New_York"},
                {"value": "America/Chicago", "label": "America/Chicago"},
                {"value": "America/Denver", "label": "America/Denver"},
                {"value": "America/Los_Angeles", "label": "America/Los_Angeles"},
                {"value": "Europe/London", "label": "Europe/London"},
                {"value": "Europe/Berlin", "label": "Europe/Berlin"},
                {"value": "Europe/Paris", "label": "Europe/Paris"},
                {"value": "Asia/Jerusalem", "label": "Asia/Jerusalem"},
                {"value": "Asia/Tokyo", "label": "Asia/Tokyo"},
                {"value": "Australia/Sydney", "label": "Australia/Sydney"},
            ]
        )
    ),
})


class Timer24HConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Timer 24H."""

    VERSION = 1

    def __init__(self) -> None:
        """Initialize config flow."""
        self._name: Optional[str] = None
        self._schedule_id: Optional[str] = None
        self._target_entity_id: Optional[str] = None
        self._timezone: Optional[str] = None

    async def async_step_user(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> FlowResult:
        """Handle the initial step."""
        errors: Dict[str, str] = {}

        if user_input is not None:
            self._name = user_input[CONF_NAME]

            # Check if already configured
            await self.async_set_unique_id(self._name.lower().replace(" ", "_"))
            self._abort_if_unique_id_configured()

            return await self.async_step_schedule()

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_DATA_SCHEMA,
            errors=errors,
        )

    async def async_step_schedule(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> FlowResult:
        """Handle the schedule setup step."""
        errors: Dict[str, str] = {}

        if user_input is not None:
            self._schedule_id = user_input[CONF_SCHEDULE_ID]
            self._target_entity_id = user_input[CONF_TARGET_ENTITY_ID]
            self._timezone = user_input.get(CONF_TIMEZONE) or None

            # Validate schedule ID
            if not self._schedule_id.strip():
                errors[CONF_SCHEDULE_ID] = "Schedule ID cannot be empty"
            elif not self._schedule_id.replace("_", "").replace("-", "").isalnum():
                errors[CONF_SCHEDULE_ID] = "Schedule ID must contain only letters, numbers, hyphens, and underscores"

            # Validate target entity exists
            if self._target_entity_id not in self.hass.states.async_entity_ids():
                errors[CONF_TARGET_ENTITY_ID] = "Selected entity does not exist"

            if not errors:
                return self.async_create_entry(
                    title=self._name,
                    data={
                        CONF_NAME: self._name,
                        "initial_schedule": {
                            CONF_SCHEDULE_ID: self._schedule_id,
                            CONF_TARGET_ENTITY_ID: self._target_entity_id,
                            CONF_TIMEZONE: self._timezone,
                        }
                    },
                )

        return self.async_show_form(
            step_id="schedule",
            data_schema=STEP_SCHEDULE_DATA_SCHEMA,
            errors=errors,
            description_placeholders={
                "name": self._name,
            }
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> Timer24HOptionsFlow:
        """Create the options flow."""
        return Timer24HOptionsFlow(config_entry)


class Timer24HOptionsFlow(config_entries.OptionsFlow):
    """Timer 24H options flow."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> FlowResult:
        """Manage the options."""
        errors: Dict[str, str] = {}

        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        # Get current options with defaults
        current_options = self.config_entry.options
        default_timezone = current_options.get("default_timezone", "")
        default_condition_policy = current_options.get("default_condition_policy", "skip")

        options_schema = vol.Schema({
            vol.Optional("default_timezone", default=default_timezone): selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=[
                        {"value": "", "label": "Use Home Assistant timezone"},
                        {"value": "UTC", "label": "UTC"},
                        {"value": "America/New_York", "label": "America/New_York"},
                        {"value": "America/Chicago", "label": "America/Chicago"},
                        {"value": "America/Denver", "label": "America/Denver"},
                        {"value": "America/Los_Angeles", "label": "America/Los_Angeles"},
                        {"value": "Europe/London", "label": "Europe/London"},
                        {"value": "Europe/Berlin", "label": "Europe/Berlin"},
                        {"value": "Europe/Paris", "label": "Europe/Paris"},
                        {"value": "Asia/Jerusalem", "label": "Asia/Jerusalem"},
                        {"value": "Asia/Tokyo", "label": "Asia/Tokyo"},
                        {"value": "Australia/Sydney", "label": "Australia/Sydney"},
                    ]
                )
            ),
            vol.Optional("default_condition_policy", default=default_condition_policy): selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=[
                        {"value": "skip", "label": "Skip - Don't change state when condition not met"},
                        {"value": "force_off", "label": "Force Off - Turn off when condition not met"},
                        {"value": "defer", "label": "Defer - Wait until condition is met"},
                    ]
                )
            ),
            vol.Optional(
                "enable_debug_logging", 
                default=current_options.get("enable_debug_logging", False)
            ): bool,
            vol.Optional(
                "reconcile_on_startup", 
                default=current_options.get("reconcile_on_startup", True)
            ): bool,
        })

        return self.async_show_form(
            step_id="init",
            data_schema=options_schema,
            errors=errors,
        )
