"""Data models for Timer 24H integration."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .const import (
    CONF_CONDITIONS,
    CONF_ENABLED,
    CONF_ENTITY_ID,
    CONF_EXPECTED,
    CONF_POLICY,
    CONF_SCHEDULE_ID,
    CONF_SLOTS,
    CONF_TARGET_ENTITY_ID,
    CONF_TIMEZONE,
    CONDITION_POLICIES,
    DEFAULT_ENABLED,
    DEFAULT_POLICY,
    SLOTS_PER_DAY,
)

_LOGGER = logging.getLogger(__name__)


@dataclass
class Condition:
    """Represents a condition for schedule activation."""
    
    entity_id: str
    expected: Optional[str] = None
    policy: str = DEFAULT_POLICY
    
    def __post_init__(self):
        """Validate condition after initialization."""
        if self.policy not in CONDITION_POLICIES:
            raise ValueError(f"Invalid policy: {self.policy}")
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Condition:
        """Create Condition from dictionary."""
        return cls(
            entity_id=data[CONF_ENTITY_ID],
            expected=data.get(CONF_EXPECTED),
            policy=data.get(CONF_POLICY, DEFAULT_POLICY)
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert Condition to dictionary."""
        return {
            CONF_ENTITY_ID: self.entity_id,
            CONF_EXPECTED: self.expected,
            CONF_POLICY: self.policy,
        }
    
    def is_met(self, state: str) -> bool:
        """Check if condition is met given a state."""
        if self.expected is None:
            # If no expected value, condition is always met
            return True
        
        # Handle boolean-like states
        if self.expected.lower() in ("true", "on", "1", "yes"):
            return state.lower() in ("on", "true", "1", "yes", "home")
        elif self.expected.lower() in ("false", "off", "0", "no"):
            return state.lower() in ("off", "false", "0", "no", "away", "not_home")
        else:
            # Exact string match
            return state == self.expected


@dataclass
class Schedule:
    """Represents a 24-hour schedule with conditions."""
    
    schedule_id: str
    target_entity_id: str
    slots: List[bool] = field(default_factory=lambda: [False] * SLOTS_PER_DAY)
    enabled: bool = DEFAULT_ENABLED
    timezone: Optional[str] = None
    conditions: List[Condition] = field(default_factory=list)
    
    def __post_init__(self):
        """Validate schedule after initialization."""
        if len(self.slots) != SLOTS_PER_DAY:
            raise ValueError(f"Schedule must have exactly {SLOTS_PER_DAY} slots")
        
        if not self.schedule_id:
            raise ValueError("Schedule ID cannot be empty")
        
        if not self.target_entity_id:
            raise ValueError("Target entity ID cannot be empty")
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Schedule:
        """Create Schedule from dictionary."""
        conditions_data = data.get(CONF_CONDITIONS, [])
        conditions = [Condition.from_dict(c) for c in conditions_data]
        
        return cls(
            schedule_id=data[CONF_SCHEDULE_ID],
            target_entity_id=data[CONF_TARGET_ENTITY_ID],
            slots=data.get(CONF_SLOTS, [False] * SLOTS_PER_DAY),
            enabled=data.get(CONF_ENABLED, DEFAULT_ENABLED),
            timezone=data.get(CONF_TIMEZONE),
            conditions=conditions,
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert Schedule to dictionary."""
        return {
            CONF_SCHEDULE_ID: self.schedule_id,
            CONF_TARGET_ENTITY_ID: self.target_entity_id,
            CONF_SLOTS: self.slots,
            CONF_ENABLED: self.enabled,
            CONF_TIMEZONE: self.timezone,
            CONF_CONDITIONS: [c.to_dict() for c in self.conditions],
        }
    
    def is_active_at_slot(self, slot_index: int) -> bool:
        """Check if schedule is active at given slot index."""
        if not self.enabled:
            return False
        
        if slot_index < 0 or slot_index >= SLOTS_PER_DAY:
            return False
        
        return self.slots[slot_index]
    
    def evaluate_conditions(self, states: Dict[str, str]) -> tuple[bool, str]:
        """
        Evaluate all conditions and return (should_apply, reason).
        
        Returns:
            tuple: (should_apply: bool, reason: str)
                - should_apply: Whether the schedule should be applied
                - reason: Human-readable reason for the decision
        """
        if not self.conditions:
            return True, "No conditions"
        
        skip_conditions = []
        force_off_conditions = []
        defer_conditions = []
        
        for condition in self.conditions:
            entity_state = states.get(condition.entity_id, "unknown")
            is_met = condition.is_met(entity_state)
            
            if not is_met:
                if condition.policy == "skip":
                    skip_conditions.append(condition.entity_id)
                elif condition.policy == "force_off":
                    force_off_conditions.append(condition.entity_id)
                elif condition.policy == "defer":
                    defer_conditions.append(condition.entity_id)
        
        # Force off takes highest priority
        if force_off_conditions:
            return False, f"Force off: {', '.join(force_off_conditions)}"
        
        # Skip conditions prevent both on and off actions
        if skip_conditions:
            return None, f"Skip: {', '.join(skip_conditions)}"
        
        # Defer conditions prevent action but don't force off
        if defer_conditions:
            return None, f"Defer: {', '.join(defer_conditions)}"
        
        return True, "All conditions met"


@dataclass
class ScheduleState:
    """Represents the current state of a schedule."""
    
    schedule: Schedule
    desired_state: Optional[bool] = None
    last_applied_state: Optional[bool] = None
    last_condition_evaluation: Optional[str] = None
    next_tick_time: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert ScheduleState to dictionary."""
        return {
            "schedule": self.schedule.to_dict(),
            "desired_state": self.desired_state,
            "last_applied_state": self.last_applied_state,
            "last_condition_evaluation": self.last_condition_evaluation,
            "next_tick_time": self.next_tick_time,
        }


@dataclass
class Timer24HData:
    """Container for all Timer 24H data."""
    
    schedules: Dict[str, Schedule] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Timer24HData:
        """Create Timer24HData from dictionary."""
        schedules_data = data.get("schedules", {})
        schedules = {
            schedule_id: Schedule.from_dict(schedule_data)
            for schedule_id, schedule_data in schedules_data.items()
        }
        
        return cls(schedules=schedules)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert Timer24HData to dictionary."""
        return {
            "schedules": {
                schedule_id: schedule.to_dict()
                for schedule_id, schedule in self.schedules.items()
            }
        }
    
    def add_schedule(self, schedule: Schedule) -> None:
        """Add a schedule."""
        self.schedules[schedule.schedule_id] = schedule
    
    def remove_schedule(self, schedule_id: str) -> bool:
        """Remove a schedule. Returns True if schedule existed."""
        return self.schedules.pop(schedule_id, None) is not None
    
    def get_schedule(self, schedule_id: str) -> Optional[Schedule]:
        """Get a schedule by ID."""
        return self.schedules.get(schedule_id)
    
    def get_schedules_for_entity(self, entity_id: str) -> List[Schedule]:
        """Get all schedules that target a specific entity."""
        return [
            schedule for schedule in self.schedules.values()
            if schedule.target_entity_id == entity_id
        ]
    
    def get_all_condition_entities(self) -> set[str]:
        """Get all entity IDs referenced by conditions."""
        entities = set()
        for schedule in self.schedules.values():
            for condition in schedule.conditions:
                entities.add(condition.entity_id)
        return entities
