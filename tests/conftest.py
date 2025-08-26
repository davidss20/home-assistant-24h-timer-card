"""Common fixtures for Timer 24H tests."""
import pytest
from unittest.mock import Mock, patch
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry

from custom_components.timer24h.const import DOMAIN
from custom_components.timer24h.models import Schedule, Condition


@pytest.fixture
def mock_hass():
    """Mock Home Assistant instance."""
    hass = Mock(spec=HomeAssistant)
    hass.data = {DOMAIN: {}}
    hass.states = Mock()
    hass.services = Mock()
    hass.bus = Mock()
    hass.config_entries = Mock()
    hass.helpers = Mock()
    return hass


@pytest.fixture
def mock_config_entry():
    """Mock config entry."""
    entry = Mock(spec=ConfigEntry)
    entry.entry_id = "test_entry"
    entry.domain = DOMAIN
    entry.data = {"name": "Test Timer"}
    entry.options = {}
    return entry


@pytest.fixture
def sample_schedule():
    """Sample schedule for testing."""
    return Schedule(
        schedule_id="test_schedule",
        target_entity_id="light.test_light",
        slots=[True if i % 4 == 0 else False for i in range(48)],  # Every 2 hours
        enabled=True,
        timezone=None,
        conditions=[]
    )


@pytest.fixture
def sample_condition():
    """Sample condition for testing."""
    return Condition(
        entity_id="binary_sensor.presence",
        expected="on",
        policy="skip"
    )


@pytest.fixture
def mock_storage():
    """Mock storage with sample data."""
    with patch('custom_components.timer24h.storage.Store') as mock_store:
        mock_instance = Mock()
        mock_store.return_value = mock_instance
        mock_instance.async_load.return_value = {
            "schedules": {
                "test_schedule": {
                    "schedule_id": "test_schedule",
                    "target_entity_id": "light.test_light",
                    "slots": [False] * 48,
                    "enabled": True,
                    "timezone": None,
                    "conditions": []
                }
            }
        }
        yield mock_instance
