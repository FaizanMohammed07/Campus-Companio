"""
navigator.py — Dynamic navigation FSM.

Accepts a destination via set_destination() and navigates there using
YOLO nav-model detections (obstacles, paths, blocks).

States:
  IDLE            — No mission. Output: STOP.
  SEARCH_PATH     — Rotating to find a PATH or target block.
  ALIGN_PATH      — Steering to centre the best PATH detection.
  FORWARD         — Driving straight along the detected PATH.
  AVOID_OBSTACLE  — Obstacle in forward zone → steer around it.
  ARRIVED         — Target block bbox is large enough → mission done.
  EMERGENCY_STOP  — Critical failure → STOP until cleared.

Fusion rule (applied in app.py, NOT here):
  Person avoidance from DecisionEngine ALWAYS overrides navigator output.

This module has NO knowledge of motors, ultrasonic sensors, or Flask.
"""

import logging
import threading
import time
from enum import Enum

from .config import settings
from .nav_perception import NavPerceptionResult

log = logging.getLogger(__name__)


class NavState(str, Enum):
    IDLE = "IDLE"
    SEARCH_PATH = "SEARCH_PATH"
    ALIGN_PATH = "ALIGN_PATH"
    FORWARD = "FORWARD"
    AVOID_OBSTACLE = "AVOID_OBSTACLE"
    ARRIVED = "ARRIVED"
    EMERGENCY_STOP = "EMERGENCY_STOP"


# Map destination IDs to the detection bucket attribute names
_DEST_TO_BUCKET = {
    "A_BLOCK": "a_blocks",
    "B_BLOCK": "b_blocks",
    "C_BLOCK": "c_blocks",
    # Locations that share a physical block can be aliased here
    "ADMISSION": "a_blocks",
    "FEE": "a_blocks",
    "ADMIN": "a_blocks",
    "LIBRARY": "c_blocks",
    "EXAM": "a_blocks",
    "CANTEEN": "b_blocks",
}


class Navigator:
    """Dynamic navigation FSM driven by yolov8n.pt detections."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: NavState = NavState.IDLE
        self._destination: str | None = None
        self._search_start: float = 0.0
        self._search_rotations: int = 0

    # ── Public API (thread-safe) ──

    @property
    def state(self) -> NavState:
        with self._lock:
            return self._state

    @property
    def destination(self) -> str | None:
        with self._lock:
            return self._destination

    def set_destination(self, dest: str) -> None:
        """Set a new navigation goal.  Transitions IDLE → SEARCH_PATH."""
        with self._lock:
            self._destination = dest.upper()
            self._state = NavState.SEARCH_PATH
            self._search_start = time.time()
            self._search_rotations = 0
        log.info("[NAV] Mission set → %s (state=SEARCH_PATH)", dest)

    def stop_mission(self) -> None:
        """Abort current mission.  Returns to IDLE."""
        with self._lock:
            prev = self._state
            self._state = NavState.IDLE
            self._destination = None
        log.info("[NAV] Mission stopped (was %s)", prev.value)

    def emergency_stop(self) -> None:
        """Trigger emergency stop."""
        with self._lock:
            self._state = NavState.EMERGENCY_STOP
        log.warning("[NAV] EMERGENCY STOP")

    def clear_emergency(self) -> None:
        """Clear emergency stop → IDLE."""
        with self._lock:
            if self._state == NavState.EMERGENCY_STOP:
                self._state = NavState.IDLE
                self._destination = None
        log.info("[NAV] Emergency cleared → IDLE")

    def get_status(self) -> dict:
        """Return serialisable status for /status endpoint."""
        with self._lock:
            return {
                "nav_state": self._state.value,
                "destination": self._destination,
            }

    # ── Main entry point (called from pipeline thread) ──

    def update(self, nav: NavPerceptionResult) -> str:
        """
        Compute one movement command from the current state + nav detections.
        Returns one of: STOP | CRUISE | PREFER_LEFT | PREFER_RIGHT | LEFT | RIGHT | BACK
        """
        with self._lock:
            state = self._state
            dest = self._destination

        if state == NavState.IDLE:
            return "STOP"

        if state == NavState.EMERGENCY_STOP:
            return "STOP"

        if state == NavState.ARRIVED:
            return "STOP"

        # ── Priority 1: OBSTACLE in forward/centre region → AVOID ──
        forward_obstacles = [
            o
            for o in nav.obstacles
            if settings.zone_left_max <= o.cx_norm <= settings.zone_right_min
        ]
        if forward_obstacles and state not in (NavState.IDLE, NavState.ARRIVED):
            with self._lock:
                self._state = NavState.AVOID_OBSTACLE
            return self._avoid_obstacle(nav)

        # ── Dispatch by state ──
        if state == NavState.SEARCH_PATH:
            return self._handle_search(nav, dest)
        elif state == NavState.ALIGN_PATH:
            return self._handle_align(nav, dest)
        elif state == NavState.FORWARD:
            return self._handle_forward(nav, dest)
        elif state == NavState.AVOID_OBSTACLE:
            return self._avoid_obstacle(nav)

        return "STOP"

    # ── State handlers (private) ──

    def _get_target_detections(self, nav: NavPerceptionResult, dest: str | None) -> list:
        """Return the detection list for the current destination block."""
        if not dest:
            return []
        bucket_attr = _DEST_TO_BUCKET.get(dest)
        if not bucket_attr:
            return []
        return getattr(nav, bucket_attr, [])

    def _handle_search(self, nav: NavPerceptionResult, dest: str | None) -> str:
        """Rotate to find either the target block or a PATH."""
        targets = self._get_target_detections(nav, dest)

        # If target block is visible → align to it
        if targets:
            with self._lock:
                self._state = NavState.ALIGN_PATH
            log.info("[NAV] Target block visible → ALIGN_PATH")
            return self._steer_toward(targets)

        # If a PATH is visible → follow it (it may lead to target)
        if nav.paths:
            with self._lock:
                self._state = NavState.ALIGN_PATH
            log.info("[NAV] PATH visible → ALIGN_PATH")
            return self._steer_toward_path(nav)

        # Nothing visible → keep rotating
        return "PREFER_LEFT"

    def _handle_align(self, nav: NavPerceptionResult, dest: str | None) -> str:
        """Steer to centre the target block or best PATH."""
        targets = self._get_target_detections(nav, dest)

        # Check arrival
        if targets:
            best = max(targets, key=lambda d: d.area_ratio)
            if best.area_ratio >= settings.block_reached_ratio:
                with self._lock:
                    self._state = NavState.ARRIVED
                log.info("[NAV] ARRIVED at %s!", dest)
                return "STOP"

            # Steer toward target block
            cmd = self._steer_toward(targets)
            if cmd == "CRUISE":
                with self._lock:
                    self._state = NavState.FORWARD
            return cmd

        # No target visible → follow PATH
        if nav.paths:
            cmd = self._steer_toward_path(nav)
            if cmd == "CRUISE":
                with self._lock:
                    self._state = NavState.FORWARD
            return cmd

        # Lost everything → back to search
        with self._lock:
            self._state = NavState.SEARCH_PATH
        return "PREFER_LEFT"

    def _handle_forward(self, nav: NavPerceptionResult, dest: str | None) -> str:
        """Move forward along path.  Check for arrival or drift."""
        targets = self._get_target_detections(nav, dest)

        # Check arrival
        if targets:
            best = max(targets, key=lambda d: d.area_ratio)
            if best.area_ratio >= settings.block_reached_ratio:
                with self._lock:
                    self._state = NavState.ARRIVED
                log.info("[NAV] ARRIVED at %s!", dest)
                return "STOP"

            # Target visible but not arrived — re-align
            offset = best.cx_norm - 0.5
            if abs(offset) > settings.path_center_tolerance:
                with self._lock:
                    self._state = NavState.ALIGN_PATH
                return "PREFER_LEFT" if offset < 0 else "PREFER_RIGHT"

        # No target — follow PATH
        if nav.paths:
            best_path = max(nav.paths, key=lambda p: p.area_ratio)
            offset = best_path.cx_norm - 0.5
            if abs(offset) > settings.path_center_tolerance * 1.5:
                with self._lock:
                    self._state = NavState.ALIGN_PATH
                return "PREFER_LEFT" if offset < 0 else "PREFER_RIGHT"
            return "CRUISE"

        # Nothing visible → search again
        with self._lock:
            self._state = NavState.SEARCH_PATH
        return "PREFER_LEFT"

    def _avoid_obstacle(self, nav: NavPerceptionResult) -> str:
        """Use PATH detections to choose avoidance direction."""
        if not nav.paths:
            return "STOP"

        left_strength = sum(p.area_ratio for p in nav.paths if p.cx_norm < 0.5)
        right_strength = sum(p.area_ratio for p in nav.paths if p.cx_norm >= 0.5)

        if left_strength > right_strength:
            cmd = "PREFER_LEFT"
        elif right_strength > left_strength:
            cmd = "PREFER_RIGHT"
        else:
            cmd = "STOP"

        # Check if obstacle is now cleared
        forward_obstacles = [
            o
            for o in nav.obstacles
            if settings.zone_left_max <= o.cx_norm <= settings.zone_right_min
        ]
        if not forward_obstacles:
            with self._lock:
                self._state = NavState.SEARCH_PATH
            log.info("[NAV] Obstacle cleared → SEARCH_PATH")

        return cmd

    # ── Steering helpers ──

    def _steer_toward(self, detections: list) -> str:
        """Steer toward the largest detection in the list."""
        if not detections:
            return "CRUISE"
        best = max(detections, key=lambda d: d.area_ratio)
        offset = best.cx_norm - 0.5
        if abs(offset) < settings.path_center_tolerance:
            return "CRUISE"
        return "PREFER_LEFT" if offset < 0 else "PREFER_RIGHT"

    def _steer_toward_path(self, nav: NavPerceptionResult) -> str:
        """Steer to keep the largest PATH centred."""
        if not nav.paths:
            return "CRUISE"
        best_path = max(nav.paths, key=lambda p: p.area_ratio)
        offset = best_path.cx_norm - 0.5
        if abs(offset) < settings.path_center_tolerance:
            return "CRUISE"
        return "PREFER_LEFT" if offset < 0 else "PREFER_RIGHT"
