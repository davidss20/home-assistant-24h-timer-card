"""Constants for the Timer 24H integration."""
from homeassistant.const import Platform

DOMAIN = "timer24h"

# Platforms
PLATFORMS = [Platform.SENSOR]

# Configuration
CONF_SCHEDULES = "schedules"
CONF_SCHEDULE_ID = "schedule_id"
CONF_TARGET_ENTITY_ID = "target_entity_id"
CONF_SLOTS = "slots"
CONF_ENABLED = "enabled"
CONF_TIMEZONE = "timezone"
CONF_CONDITIONS = "conditions"
CONF_ENTITY_ID = "entity_id"
CONF_EXPECTED = "expected"
CONF_POLICY = "policy"

# Condition policies
POLICY_SKIP = "skip"
POLICY_FORCE_OFF = "force_off"
POLICY_DEFER = "defer"

CONDITION_POLICIES = [POLICY_SKIP, POLICY_FORCE_OFF, POLICY_DEFER]

# Storage
STORAGE_VERSION = 1
STORAGE_KEY = "timer24h"

# Time constants
SLOTS_PER_DAY = 48
MINUTES_PER_SLOT = 30

# Default values
DEFAULT_ENABLED = True
DEFAULT_POLICY = POLICY_SKIP

# Entity states
STATE_ON = "on"
STATE_OFF = "off"
STATE_DISABLED = "disabled"

# Events
EVENT_SCHEDULE_UPDATED = f"{DOMAIN}_schedule_updated"
EVENT_CONDITION_CHANGED = f"{DOMAIN}_condition_changed"
