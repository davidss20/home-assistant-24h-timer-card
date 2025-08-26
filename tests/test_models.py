"""Test Timer 24H models."""
import pytest
from custom_components.timer24h.models import Schedule, Condition, Timer24HData


class TestCondition:
    """Test Condition model."""
    
    def test_condition_creation(self):
        """Test basic condition creation."""
        condition = Condition(
            entity_id="sensor.test",
            expected="on",
            policy="skip"
        )
        
        assert condition.entity_id == "sensor.test"
        assert condition.expected == "on"
        assert condition.policy == "skip"
    
    def test_condition_validation(self):
        """Test condition validation."""
        with pytest.raises(ValueError):
            Condition(
                entity_id="sensor.test",
                expected="on",
                policy="invalid_policy"
            )
    
    def test_condition_is_met(self):
        """Test condition evaluation."""
        condition = Condition(
            entity_id="sensor.test",
            expected="on",
            policy="skip"
        )
        
        assert condition.is_met("on") is True
        assert condition.is_met("off") is False
        assert condition.is_met("true") is True
        assert condition.is_met("1") is True
        assert condition.is_met("home") is True
    
    def test_condition_boolean_states(self):
        """Test boolean-like state handling."""
        # Test 'on' expected
        condition_on = Condition(entity_id="sensor.test", expected="on", policy="skip")
        assert condition_on.is_met("on") is True
        assert condition_on.is_met("true") is True
        assert condition_on.is_met("1") is True
        assert condition_on.is_met("home") is True
        assert condition_on.is_met("off") is False
        
        # Test 'off' expected
        condition_off = Condition(entity_id="sensor.test", expected="off", policy="skip")
        assert condition_off.is_met("off") is True
        assert condition_off.is_met("false") is True
        assert condition_off.is_met("0") is True
        assert condition_off.is_met("away") is True
        assert condition_off.is_met("on") is False
    
    def test_condition_exact_match(self):
        """Test exact string matching."""
        condition = Condition(
            entity_id="sensor.test",
            expected="custom_state",
            policy="skip"
        )
        
        assert condition.is_met("custom_state") is True
        assert condition.is_met("other_state") is False
    
    def test_condition_no_expected(self):
        """Test condition with no expected value."""
        condition = Condition(
            entity_id="sensor.test",
            expected=None,
            policy="skip"
        )
        
        # Should always be met when no expected value
        assert condition.is_met("any_state") is True
        assert condition.is_met("") is True
    
    def test_condition_from_dict(self):
        """Test creating condition from dictionary."""
        data = {
            "entity_id": "sensor.test",
            "expected": "on",
            "policy": "force_off"
        }
        
        condition = Condition.from_dict(data)
        assert condition.entity_id == "sensor.test"
        assert condition.expected == "on"
        assert condition.policy == "force_off"
    
    def test_condition_to_dict(self):
        """Test converting condition to dictionary."""
        condition = Condition(
            entity_id="sensor.test",
            expected="on",
            policy="defer"
        )
        
        data = condition.to_dict()
        expected = {
            "entity_id": "sensor.test",
            "expected": "on",
            "policy": "defer"
        }
        
        assert data == expected


class TestSchedule:
    """Test Schedule model."""
    
    def test_schedule_creation(self):
        """Test basic schedule creation."""
        schedule = Schedule(
            schedule_id="test",
            target_entity_id="light.test",
            slots=[True] * 24 + [False] * 24,
            enabled=True
        )
        
        assert schedule.schedule_id == "test"
        assert schedule.target_entity_id == "light.test"
        assert len(schedule.slots) == 48
        assert schedule.enabled is True
    
    def test_schedule_validation(self):
        """Test schedule validation."""
        # Test invalid slots length
        with pytest.raises(ValueError):
            Schedule(
                schedule_id="test",
                target_entity_id="light.test",
                slots=[True] * 10  # Wrong length
            )
        
        # Test empty schedule ID
        with pytest.raises(ValueError):
            Schedule(
                schedule_id="",
                target_entity_id="light.test"
            )
        
        # Test empty target entity
        with pytest.raises(ValueError):
            Schedule(
                schedule_id="test",
                target_entity_id=""
            )
    
    def test_schedule_default_values(self):
        """Test schedule default values."""
        schedule = Schedule(
            schedule_id="test",
            target_entity_id="light.test"
        )
        
        assert len(schedule.slots) == 48
        assert all(slot is False for slot in schedule.slots)
        assert schedule.enabled is True
        assert schedule.timezone is None
        assert schedule.conditions == []
    
    def test_is_active_at_slot(self):
        """Test slot activity checking."""
        slots = [False] * 48
        slots[0] = True  # 00:00
        slots[23] = True  # 11:30
        slots[47] = True  # 23:30
        
        schedule = Schedule(
            schedule_id="test",
            target_entity_id="light.test",
            slots=slots
        )
        
        assert schedule.is_active_at_slot(0) is True
        assert schedule.is_active_at_slot(23) is True
        assert schedule.is_active_at_slot(47) is True
        assert schedule.is_active_at_slot(1) is False
        
        # Test out of bounds
        assert schedule.is_active_at_slot(-1) is False
        assert schedule.is_active_at_slot(48) is False
        
        # Test disabled schedule
        schedule.enabled = False
        assert schedule.is_active_at_slot(0) is False
    
    def test_evaluate_conditions_no_conditions(self):
        """Test condition evaluation with no conditions."""
        schedule = Schedule(
            schedule_id="test",
            target_entity_id="light.test"
        )
        
        should_apply, reason = schedule.evaluate_conditions({})
        assert should_apply is True
        assert reason == "No conditions"
    
    def test_evaluate_conditions_all_met(self):
        """Test condition evaluation when all conditions are met."""
        conditions = [
            Condition(entity_id="sensor.presence", expected="on", policy="skip"),
            Condition(entity_id="sensor.light", expected="off", policy="skip")
        ]
        
        schedule = Schedule(
            schedule_id="test",
            target_entity_id="light.test",
            conditions=conditions
        )
        
        states = {
            "sensor.presence": "on",
            "sensor.light": "off"
        }
        
        should_apply, reason = schedule.evaluate_conditions(states)
        assert should_apply is True
        assert reason == "All conditions met"
    
    def test_evaluate_conditions_skip_policy(self):
        """Test condition evaluation with skip policy."""
        conditions = [
            Condition(entity_id="sensor.presence", expected="on", policy="skip")
        ]
        
        schedule = Schedule(
            schedule_id="test",
            target_entity_id="light.test",
            conditions=conditions
        )
        
        states = {"sensor.presence": "off"}
        
        should_apply, reason = schedule.evaluate_conditions(states)
        assert should_apply is None
        assert "Skip" in reason
        assert "sensor.presence" in reason
    
    def test_evaluate_conditions_force_off_policy(self):
        """Test condition evaluation with force_off policy."""
        conditions = [
            Condition(entity_id="sensor.presence", expected="on", policy="force_off")
        ]
        
        schedule = Schedule(
            schedule_id="test",
            target_entity_id="light.test",
            conditions=conditions
        )
        
        states = {"sensor.presence": "off"}
        
        should_apply, reason = schedule.evaluate_conditions(states)
        assert should_apply is False
        assert "Force off" in reason
        assert "sensor.presence" in reason
    
    def test_evaluate_conditions_defer_policy(self):
        """Test condition evaluation with defer policy."""
        conditions = [
            Condition(entity_id="sensor.presence", expected="on", policy="defer")
        ]
        
        schedule = Schedule(
            schedule_id="test",
            target_entity_id="light.test",
            conditions=conditions
        )
        
        states = {"sensor.presence": "off"}
        
        should_apply, reason = schedule.evaluate_conditions(states)
        assert should_apply is None
        assert "Defer" in reason
        assert "sensor.presence" in reason
    
    def test_evaluate_conditions_priority(self):
        """Test condition evaluation priority (force_off > skip > defer)."""
        conditions = [
            Condition(entity_id="sensor.presence", expected="on", policy="skip"),
            Condition(entity_id="sensor.security", expected="off", policy="force_off"),
            Condition(entity_id="sensor.other", expected="on", policy="defer")
        ]
        
        schedule = Schedule(
            schedule_id="test",
            target_entity_id="light.test",
            conditions=conditions
        )
        
        # Force off should take priority
        states = {
            "sensor.presence": "off",  # Skip condition not met
            "sensor.security": "on",   # Force off condition not met
            "sensor.other": "off"      # Defer condition not met
        }
        
        should_apply, reason = schedule.evaluate_conditions(states)
        assert should_apply is False
        assert "Force off" in reason
    
    def test_from_dict(self):
        """Test creating schedule from dictionary."""
        data = {
            "schedule_id": "test",
            "target_entity_id": "light.test",
            "slots": [True] * 10 + [False] * 38,
            "enabled": False,
            "timezone": "UTC",
            "conditions": [
                {
                    "entity_id": "sensor.test",
                    "expected": "on",
                    "policy": "skip"
                }
            ]
        }
        
        schedule = Schedule.from_dict(data)
        assert schedule.schedule_id == "test"
        assert schedule.target_entity_id == "light.test"
        assert schedule.slots[0] is True
        assert schedule.slots[47] is False
        assert schedule.enabled is False
        assert schedule.timezone == "UTC"
        assert len(schedule.conditions) == 1
        assert schedule.conditions[0].entity_id == "sensor.test"
    
    def test_to_dict(self):
        """Test converting schedule to dictionary."""
        conditions = [
            Condition(entity_id="sensor.test", expected="on", policy="skip")
        ]
        
        schedule = Schedule(
            schedule_id="test",
            target_entity_id="light.test",
            slots=[True] * 48,
            enabled=False,
            timezone="Europe/London",
            conditions=conditions
        )
        
        data = schedule.to_dict()
        
        assert data["schedule_id"] == "test"
        assert data["target_entity_id"] == "light.test"
        assert data["slots"] == [True] * 48
        assert data["enabled"] is False
        assert data["timezone"] == "Europe/London"
        assert len(data["conditions"]) == 1
        assert data["conditions"][0]["entity_id"] == "sensor.test"


class TestTimer24HData:
    """Test Timer24HData container."""
    
    def test_data_creation(self):
        """Test creating empty data container."""
        data = Timer24HData()
        assert data.schedules == {}
    
    def test_add_schedule(self):
        """Test adding a schedule."""
        data = Timer24HData()
        schedule = Schedule(
            schedule_id="test",
            target_entity_id="light.test"
        )
        
        data.add_schedule(schedule)
        assert "test" in data.schedules
        assert data.schedules["test"] == schedule
    
    def test_remove_schedule(self):
        """Test removing a schedule."""
        data = Timer24HData()
        schedule = Schedule(
            schedule_id="test",
            target_entity_id="light.test"
        )
        
        data.add_schedule(schedule)
        assert data.remove_schedule("test") is True
        assert "test" not in data.schedules
        assert data.remove_schedule("nonexistent") is False
    
    def test_get_schedules_for_entity(self):
        """Test getting schedules for specific entity."""
        data = Timer24HData()
        
        schedule1 = Schedule(schedule_id="s1", target_entity_id="light.living_room")
        schedule2 = Schedule(schedule_id="s2", target_entity_id="light.kitchen")
        schedule3 = Schedule(schedule_id="s3", target_entity_id="light.living_room")
        
        data.add_schedule(schedule1)
        data.add_schedule(schedule2)
        data.add_schedule(schedule3)
        
        living_room_schedules = data.get_schedules_for_entity("light.living_room")
        assert len(living_room_schedules) == 2
        assert schedule1 in living_room_schedules
        assert schedule3 in living_room_schedules
        
        kitchen_schedules = data.get_schedules_for_entity("light.kitchen")
        assert len(kitchen_schedules) == 1
        assert schedule2 in kitchen_schedules
    
    def test_get_all_condition_entities(self):
        """Test getting all condition entities."""
        data = Timer24HData()
        
        conditions1 = [
            Condition(entity_id="sensor.presence", expected="on", policy="skip"),
            Condition(entity_id="sensor.light", expected="off", policy="skip")
        ]
        
        conditions2 = [
            Condition(entity_id="sensor.presence", expected="on", policy="skip"),
            Condition(entity_id="binary_sensor.security", expected="off", policy="force_off")
        ]
        
        schedule1 = Schedule(
            schedule_id="s1",
            target_entity_id="light.test1",
            conditions=conditions1
        )
        
        schedule2 = Schedule(
            schedule_id="s2",
            target_entity_id="light.test2",
            conditions=conditions2
        )
        
        data.add_schedule(schedule1)
        data.add_schedule(schedule2)
        
        entities = data.get_all_condition_entities()
        expected = {"sensor.presence", "sensor.light", "binary_sensor.security"}
        assert entities == expected
    
    def test_from_dict_to_dict(self):
        """Test serialization round trip."""
        # Create data with schedules
        original_data = Timer24HData()
        
        schedule = Schedule(
            schedule_id="test",
            target_entity_id="light.test",
            slots=[True] * 24 + [False] * 24,
            conditions=[
                Condition(entity_id="sensor.test", expected="on", policy="skip")
            ]
        )
        
        original_data.add_schedule(schedule)
        
        # Serialize to dict
        data_dict = original_data.to_dict()
        
        # Deserialize from dict
        restored_data = Timer24HData.from_dict(data_dict)
        
        # Verify data is preserved
        assert len(restored_data.schedules) == 1
        assert "test" in restored_data.schedules
        
        restored_schedule = restored_data.schedules["test"]
        assert restored_schedule.schedule_id == "test"
        assert restored_schedule.target_entity_id == "light.test"
        assert restored_schedule.slots == [True] * 24 + [False] * 24
        assert len(restored_schedule.conditions) == 1
        assert restored_schedule.conditions[0].entity_id == "sensor.test"
