"""
decision.py — Person-avoidance intent generation.

Takes a PerceptionResult and produces ONE intent:
  STOP         — person very close / unhealthy system
  CRUISE       — path is clear / person is far away
  PREFER_LEFT  — person on RIGHT + medium distance → steer left
  PREFER_RIGHT — person on LEFT  + medium distance → steer right
  LEFT         — person in CENTER + near → escape left  (chosen by nav)
  RIGHT        — person in CENTER + near → escape right (chosen by nav)

Distance tiers (by person_ratio = bbox area / frame area):
  FAR     ratio < 0.08  → person is far, ignore → CRUISE
  MEDIUM  0.08 ≤ ratio < 0.25 → person visible, steer away based on zone
  NEAR    ratio ≥ 0.25 → person is very close → STOP (or smart escape)

Zone-based behaviour (MEDIUM distance only):
  LEFT   → PREFER_RIGHT  (steer away)
  RIGHT  → PREFER_LEFT   (steer away)
  CENTER → STOP (override by nav escape in app.py)

NEAR behaviour:
  Any zone → STOP always (safety first)
  CENTER + NEAR → app.py uses nav data to suggest LEFT/RIGHT escape

This module has NO knowledge of motors, ultrasonic sensors, or Flask.
"""

from enum import Enum

from .config import settings


class Intent(str, Enum):
    STOP = "STOP"
    CRUISE = "CRUISE"
    PREFER_LEFT = "PREFER_LEFT"
    PREFER_RIGHT = "PREFER_RIGHT"
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    BACK = "BACK"
    SCAN = "SCAN"  # 360° spin-in-place to find clear path


class DecisionEngine:
    def __init__(self) -> None:
        self._state: Intent = Intent.STOP
        self._clear_count: int = 0

    @property
    def state(self) -> Intent:
        return self._state

    def update(
        self,
        person_detected: bool,
        person_ratio: float,
        person_zone: str,
        healthy: bool = True,
    ) -> Intent:
        """Compute the next intent from the latest perception frame."""

        # 1. Health gate
        if not healthy:
            self._state = Intent.STOP
            self._clear_count = 0
            return self._state

        # 2. No person → CRUISE (with debounce)
        if not person_detected:
            self._clear_count += 1
            if self._clear_count >= settings.debounce_cruise_frames:
                self._state = Intent.CRUISE
            return self._state

        # Person detected — reset clear-frame counter
        self._clear_count = 0

        # 3. FAR person (ratio < person_far_ratio) → ignore, keep cruising
        if person_ratio < settings.person_far_ratio:
            self._state = Intent.CRUISE
            return self._state

        # 4. NEAR person (ratio >= person_near_ratio) → STOP always
        if person_ratio >= settings.person_near_ratio:
            self._state = Intent.STOP
            return self._state

        # 5. MEDIUM distance — person visible but not dangerously close
        #    Steer away based on horizontal zone
        if person_zone == "LEFT":
            self._state = Intent.PREFER_RIGHT
        elif person_zone == "RIGHT":
            self._state = Intent.PREFER_LEFT
        elif person_zone == "CENTER":
            # Medium distance + center = needs escape direction
            # Return STOP here; app.py fusion will upgrade to LEFT/RIGHT
            # using nav obstacle data
            self._state = Intent.STOP
        else:
            self._state = Intent.CRUISE

        return self._state
