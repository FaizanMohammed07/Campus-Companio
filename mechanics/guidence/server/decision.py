"""
decision.py — Person-avoidance intent generation.

Takes a PerceptionResult and produces ONE intent:
  STOP         — person very close in CENTER / unhealthy system
  CRUISE       — path is clear / person is far away
  PREFER_LEFT  — person on RIGHT + medium distance → steer left gently
  PREFER_RIGHT — person on LEFT  + medium distance → steer right gently
  LEFT         — person on RIGHT + near distance → steer left hard
  RIGHT        — person on LEFT  + near distance → steer right hard

Distance tiers (by person_ratio = bbox area / frame area):
  FAR     ratio < 0.08  → person is far, ignore → CRUISE
  MEDIUM  0.08 ≤ ratio < 0.25 → person visible, steer away based on zone
  NEAR    ratio ≥ 0.25 → person is very close

Zone-based behaviour:
  MEDIUM + LEFT   → PREFER_RIGHT  (gentle steer away)
  MEDIUM + RIGHT  → PREFER_LEFT   (gentle steer away)
  MEDIUM + CENTER → STOP (fusion upgrades to PREFER_LEFT/RIGHT via nav data)
  NEAR   + LEFT   → RIGHT  (hard steer away)
  NEAR   + RIGHT  → LEFT   (hard steer away)
  NEAR   + CENTER → STOP   (fusion upgrades to SCAN — 360° spin)

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

        # 2. No person → CRUISE immediately
        if not person_detected:
            self._state = Intent.CRUISE
            return self._state

        # Person detected — reset clear-frame counter
        self._clear_count = 0

        # 3. FAR person (ratio < person_far_ratio) → ignore, keep cruising
        if person_ratio < settings.person_far_ratio:
            self._state = Intent.CRUISE
            return self._state

        # 4. NEAR person (ratio >= person_near_ratio) → hard steer or STOP
        if person_ratio >= settings.person_near_ratio:
            if person_zone == "LEFT":
                self._state = Intent.RIGHT   # person near on left → go right
            elif person_zone == "RIGHT":
                self._state = Intent.LEFT    # person near on right → go left
            else:
                self._state = Intent.STOP    # CENTER → fusion upgrades to SCAN
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
