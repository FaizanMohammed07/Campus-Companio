"""
app.py — Flask server + VisionPipeline orchestration.

This is the SINGLE AUTHORITY for movement commands.
Commands are sent to ESP32 over USB Serial (COM port).
ESP32 polls POST /robot-command is kept as fallback.
Backend sets destination via POST /set-destination.
Backend stops via POST /stop.

Architecture:
  camera → person YOLO → nav YOLO → fusion → command
  command → Serial USB → ESP32
  Person avoidance ALWAYS overrides navigation commands.
  If no mission is active, the pipeline returns STOP.
"""

import base64
import logging
import os
import threading
import time

import cv2
import numpy as np
from flask import Flask, jsonify, request

from .config import settings
from .camera import Camera
from .perception import PersonDetector, PerceptionResult
from .decision import DecisionEngine, Intent
from .nav_perception import NavDetector, NavPerceptionResult
from .navigator import Navigator, NavState

log = logging.getLogger(__name__)

# ── Configure logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


class VisionPipeline:
    """Background thread: camera → dual YOLO → fusion → command."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._camera = Camera()
        self._detector = PersonDetector()
        self._engine = DecisionEngine()
        self._nav_detector = NavDetector()
        self._navigator = Navigator()

        self._latest_intent: Intent = Intent.STOP
        self._latest_perception = PerceptionResult()
        self._latest_nav = NavPerceptionResult()
        self._latest_frame: np.ndarray | None = None
        self._last_update_ts: float = 0.0
        self._inference_failures: int = 0
        self._running: bool = False
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

        # ── SCAN (360° turn) state ──
        self._blocked_count: int = 0       # consecutive frames with frame_blocked
        self._last_scan_ts: float = 0.0    # timestamp of last SCAN command

        # ── Mode override (HOST mode forces STOP) ──
        self._mode: str = "IDLE"  # IDLE | NAVIGATION | FOLLOW | HOST

        # ── Serial USB sender to ESP32 ──
        self._serial_port = None
        self._serial_thread: threading.Thread | None = None
        self._last_serial_cmd: str = "STOP"

    # ── Lifecycle ──

    def start(self) -> None:
        self._camera.start()
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        # Start serial sender thread
        self._serial_thread = threading.Thread(target=self._serial_loop, daemon=True)
        self._serial_thread.start()
        log.info("VisionPipeline started")

    def shutdown(self) -> None:
        """Graceful shutdown."""
        self._stop_event.set()
        self._camera.stop()
        if self._thread:
            self._thread.join(timeout=5.0)
        if self._serial_port:
            try:
                self._serial_port.write(b"STOP\n")
                self._serial_port.close()
            except Exception:
                pass
        with self._lock:
            self._running = False
        log.info("VisionPipeline shutdown complete")

    # ── Serial USB sender loop ──

    def _serial_loop(self) -> None:
        """Background thread: push latest command to ESP32 over USB Serial."""
        import serial  # pyserial

        port = settings.serial_port
        baud = settings.serial_baud

        log.info("[SERIAL] Connecting to %s @ %d baud...", port, baud)

        while not self._stop_event.is_set():
            # Try to open / reopen the serial port
            if self._serial_port is None or not self._serial_port.is_open:
                try:
                    self._serial_port = serial.Serial(port, baud, timeout=0.1)
                    log.info("[SERIAL] Connected to %s", port)
                except Exception as e:
                    log.warning("[SERIAL] Cannot open %s: %s — retrying in 2s", port, e)
                    time.sleep(2.0)
                    continue

            # Get latest command
            cmd = self.get_command()

            # Only send if command changed (reduce serial traffic)
            # But always send periodically to keep watchdog alive
            try:
                self._serial_port.write(f"{cmd}\n".encode())
                self._serial_port.flush()
                if cmd != self._last_serial_cmd:
                    log.info("[SERIAL] Sent: %s", cmd)
                    self._last_serial_cmd = cmd
            except Exception as e:
                log.warning("[SERIAL] Write failed: %s — reconnecting", e)
                try:
                    self._serial_port.close()
                except Exception:
                    pass
                self._serial_port = None

            # ~100ms interval (≈10 Hz command rate)
            time.sleep(0.1)

    # ── Navigator delegation ──

    def set_destination(self, dest: str) -> None:
        self._navigator.set_destination(dest)
        with self._lock:
            self._mode = "NAVIGATION"

    def stop_mission(self) -> None:
        self._navigator.stop_mission()
        with self._lock:
            self._mode = "IDLE"

    def emergency_stop(self) -> None:
        self._navigator.emergency_stop()
        with self._lock:
            self._mode = "IDLE"

    def set_mode(self, mode: str) -> None:
        """Set pipeline mode: IDLE, NAVIGATION, FOLLOW, HOST."""
        valid = ("IDLE", "NAVIGATION", "FOLLOW", "HOST")
        mode = mode.upper().strip()
        if mode not in valid:
            raise ValueError(f"Invalid mode: {mode}. Must be one of {valid}")
        with self._lock:
            self._mode = mode
        log.info("[MODE] Set to %s", mode)

    # ── SCAN state helper ──

    def _update_scan_state(self, perception) -> bool:
        """Track consecutive blocked frames and decide if SCAN should fire.

        Returns True if SCAN should be issued this frame. Only call this
        when perception.frame_blocked is True AND a mission is active.
        """
        self._blocked_count += 1

        scan_on_cooldown = (
            time.time() - self._last_scan_ts < settings.scan_cooldown_s
        )

        if (
            self._blocked_count >= settings.scan_trigger_frames
            and not scan_on_cooldown
        ):
            self._blocked_count = 0
            self._last_scan_ts = time.time()
            log.info(
                "[FUSION] SCAN triggered — %d persons, coverage=%.1f%%",
                perception.person_count,
                perception.total_person_coverage * 100,
            )
            return True
        return False

    # ── Public API (called from Flask routes) ──

    def get_command(self) -> str:
        """Return movement command for ESP32."""
        with self._lock:
            if not self._running:
                return Intent.STOP.value
            if time.time() - self._last_update_ts > settings.max_frame_age_s:
                return Intent.STOP.value
            return self._latest_intent.value

    def get_status(self) -> dict:
        """Return full status for /status endpoint."""
        with self._lock:
            age = (
                round(time.time() - self._last_update_ts, 3)
                if self._last_update_ts
                else -1
            )
            nav_status = self._navigator.get_status()
            return {
                "running": self._running,
                "frame_age_s": age,
                "inference_failures": self._inference_failures,
                "mode": self._mode,
                "mission_active": nav_status["nav_state"] != "IDLE",
                "person_detected": self._latest_perception.person_detected,
                "person_ratio": round(self._latest_perception.person_ratio, 4),
                "person_zone": self._latest_perception.person_zone,
                "confidence": round(self._latest_perception.confidence, 3),
                "intent": self._latest_intent.value,
                "nav_state": nav_status["nav_state"],
                "destination": nav_status["destination"],
                "nav_obstacles": len(self._latest_nav.obstacles),
                "nav_paths": len(self._latest_nav.paths),
            }

    def get_detailed_status(self) -> dict:
        """Return rich status with full detection data + annotated frame."""
        with self._lock:
            age = (
                round(time.time() - self._last_update_ts, 3)
                if self._last_update_ts
                else -1
            )
            nav_status = self._navigator.get_status()
            perception = self._latest_perception
            nav_result = self._latest_nav
            intent = self._latest_intent
            frame = self._latest_frame

            # ── Person detections detail ──
            person_detections = []
            for x1, y1, x2, y2, conf in perception.boxes:
                person_detections.append({
                    "class": "person",
                    "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                    "confidence": round(conf, 3),
                })

            # ── Nav detections detail ──
            nav_detections = []
            for det in nav_result.all_detections:
                nav_detections.append({
                    "class": det.class_name,
                    "x1": det.x1, "y1": det.y1,
                    "x2": det.x2, "y2": det.y2,
                    "cx_norm": round(det.cx_norm, 3),
                    "area_ratio": round(det.area_ratio, 4),
                    "confidence": round(det.confidence, 3),
                })

            # ── Annotated frame as base64 JPEG ──
            annotated_frame_b64 = None
            if frame is not None:
                annotated_frame_b64 = self._render_annotated_b64(
                    frame, perception, nav_result, intent
                )

            # Determine person distance tier for dashboard display
            if not perception.person_detected:
                person_distance_tier = "NONE"
            elif perception.person_ratio < settings.person_far_ratio:
                person_distance_tier = "FAR"
            elif perception.person_ratio >= settings.person_near_ratio:
                person_distance_tier = "NEAR"
            else:
                person_distance_tier = "MEDIUM"

            return {
                "running": self._running,
                "frame_age_s": age,
                "inference_failures": self._inference_failures,
                "intent": intent.value,
                "mode": self._mode,
                "mission_active": nav_status["nav_state"] != "IDLE",
                "nav_state": nav_status["nav_state"],
                "destination": nav_status["destination"],
                # Person model
                "person_detected": perception.person_detected,
                "person_ratio": round(perception.person_ratio, 4),
                "person_zone": perception.person_zone,
                "person_distance_tier": person_distance_tier,
                "person_count": perception.person_count,
                "total_person_coverage": round(perception.total_person_coverage, 4),
                "frame_blocked": perception.frame_blocked,
                "confidence": round(perception.confidence, 3),
                "person_detections": person_detections,
                # Nav model
                "nav_obstacles_count": len(nav_result.obstacles),
                "nav_paths_count": len(nav_result.paths),
                "nav_a_blocks_count": len(nav_result.a_blocks),
                "nav_b_blocks_count": len(nav_result.b_blocks),
                "nav_c_blocks_count": len(nav_result.c_blocks),
                "nav_detections": nav_detections,
                # Annotated camera frame
                "annotated_frame": annotated_frame_b64,
            }

    def _render_annotated_b64(
        self, frame, perception, nav_result, intent
    ) -> str | None:
        """Draw YOLO boxes on frame and return as base64 JPEG."""
        try:
            display = frame.copy()

            intent_color = {
                Intent.CRUISE: (0, 255, 0),
                Intent.PREFER_RIGHT: (0, 165, 255),
                Intent.PREFER_LEFT: (0, 165, 255),
                Intent.STOP: (0, 0, 255),
                Intent.LEFT: (255, 200, 0),
                Intent.RIGHT: (255, 200, 0),
                Intent.BACK: (128, 0, 128),
                Intent.SCAN: (255, 0, 255),
            }.get(intent, (0, 0, 255))

            # Draw person boxes
            for x1, y1, x2, y2, conf in perception.boxes:
                cv2.rectangle(display, (x1, y1), (x2, y2), intent_color, 2)
                cv2.putText(
                    display, f"person {conf:.2f}",
                    (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, intent_color, 1,
                )

            # Draw nav boxes
            nav_colors = {
                "obstacle": (0, 0, 200),
                "path": (0, 200, 0),
                "a_block": (255, 100, 0),
                "b_block": (200, 200, 0),
                "c_block": (0, 100, 255),
            }
            for det in nav_result.all_detections:
                nc = nav_colors.get(det.class_name, (180, 180, 180))
                cv2.rectangle(display, (det.x1, det.y1), (det.x2, det.y2), nc, 2)
                cv2.putText(
                    display, f"{det.class_name} {det.confidence:.2f}",
                    (det.x1, det.y1 - 8), cv2.FONT_HERSHEY_SIMPLEX,
                    0.45, nc, 1,
                )

            # Status overlay
            label = (
                f"{intent.value} | zone={perception.person_zone} "
                f"| ratio={perception.person_ratio:.2f}"
            )
            cv2.putText(
                display, label, (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, intent_color, 2,
            )
            nav_label = (
                f"NAV: {self._navigator.state.value} -> "
                f"{self._navigator.destination or 'NONE'}"
            )
            cv2.putText(
                display, nav_label, (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 0), 2,
            )

            # Encode to JPEG base64
            _, buf = cv2.imencode(".jpg", display, [cv2.IMWRITE_JPEG_QUALITY, 70])
            return base64.b64encode(buf.tobytes()).decode("ascii")
        except Exception:
            log.debug("Failed to render annotated frame", exc_info=True)
            return None

    # ── Background loop ──

    def _loop(self) -> None:
        with self._lock:
            self._running = True

        consecutive_failures = 0

        while not self._stop_event.is_set():
            frame, age = self._camera.get_frame()
            if frame is None or age > settings.max_frame_age_s:
                time.sleep(0.01)
                continue

            # ── Person detection ──
            try:
                perception = self._detector.analyze(frame)
                consecutive_failures = 0
            except Exception:
                consecutive_failures += 1
                log.warning(
                    "Person YOLO failed (%d/%d)",
                    consecutive_failures,
                    settings.max_inference_failures,
                )
                healthy = consecutive_failures < settings.max_inference_failures
                intent = self._engine.update(False, 0.0, "NONE", healthy=healthy)
                with self._lock:
                    self._latest_intent = intent
                    self._latest_perception = PerceptionResult()
                    self._last_update_ts = time.time()
                    self._inference_failures = consecutive_failures
                continue

            # ── Person-avoidance decision ──
            person_intent = self._engine.update(
                perception.person_detected,
                perception.person_ratio,
                perception.person_zone,
                healthy=True,
            )

            # ── Nav model inference ──
            try:
                nav_result = self._nav_detector.analyze(frame)
            except Exception:
                log.warning("Nav model failed — using empty result")
                nav_result = NavPerceptionResult()

            # ── Reset blocked counter when frame is NOT blocked ──
            if not perception.frame_blocked:
                self._blocked_count = 0

            # ══════════════════════════════════════════════════════════
            #  GATE 0: HOST mode → robot is stationary, YOLO still
            #  runs for perception data but motor forced to STOP.
            # ══════════════════════════════════════════════════════════
            if self._mode == "HOST":
                intent = Intent.STOP

            # ══════════════════════════════════════════════════════════
            #  GATE 1: No active mission (IDLE) → STOP.
            #  SCAN and navigation commands only apply when the user
            #  has selected a destination.  Without a mission the
            #  robot stays stationary — no CRUISE, no SCAN.
            # ══════════════════════════════════════════════════════════
            elif self._navigator.state == NavState.IDLE:
                intent = Intent.STOP

            # ══════════════════════════════════════════════════════════
            #  From here on: a mission IS active.
            # ══════════════════════════════════════════════════════════

            # ── SCAN — Frame blocked by too many persons ──
            #  Only triggered when a mission is active.  If the whole
            #  frame is filled with people (>40% coverage) for several
            #  consecutive frames, spin 360° to find a clear path.
            elif perception.frame_blocked and self._update_scan_state(perception):
                intent = Intent.SCAN

            # ══════════════════════════════════════════════════════════
            #  FUSION: Distance-tiered person avoidance + navigation
            #
            #  No person / FAR person  → navigator drives (CRUISE or
            #      nav steering).  The robot should NEVER sit still
            #      when the path ahead is clear and a mission is on.
            #  MED person  (0.08 – 0.25)  → person_intent steers away
            #  NEAR person (ratio ≥ 0.25) → STOP, unless CENTER where
            #      nav obstacle data picks the best escape direction
            # ══════════════════════════════════════════════════════════

            elif not perception.person_detected:
                # No person + mission active → navigator drives (CRUISE)
                nav_cmd = self._navigator.update(nav_result)
                try:
                    intent = Intent(nav_cmd)
                except ValueError:
                    intent = Intent.CRUISE  # fallback: keep moving

            elif perception.person_ratio < settings.person_far_ratio:
                # FAR person → ignore, let navigator drive
                nav_cmd = self._navigator.update(nav_result)
                try:
                    intent = Intent(nav_cmd)
                except ValueError:
                    intent = Intent.CRUISE

            elif person_intent == Intent.STOP and perception.person_zone == "CENTER":
                # Person in CENTER at medium-to-near distance
                # Use nav obstacle data to pick the BEST escape direction
                # Count obstacle weight on each side
                left_obstacles = sum(
                    o.area_ratio for o in nav_result.obstacles if o.cx_norm < 0.5
                )
                right_obstacles = sum(
                    o.area_ratio for o in nav_result.obstacles if o.cx_norm >= 0.5
                )
                # Also factor in available path on each side
                left_paths = sum(
                    p.area_ratio for p in nav_result.paths if p.cx_norm < 0.5
                )
                right_paths = sum(
                    p.area_ratio for p in nav_result.paths if p.cx_norm >= 0.5
                )

                # Score: prefer the side with more path and fewer obstacles
                left_score = left_paths - left_obstacles
                right_score = right_paths - right_obstacles

                if perception.person_ratio >= settings.person_near_ratio:
                    # NEAR + CENTER → must escape NOW using nav data
                    if left_score > right_score:
                        intent = Intent.LEFT
                    elif right_score > left_score:
                        intent = Intent.RIGHT
                    else:
                        # Equal scores → default escape left
                        intent = Intent.LEFT
                    log.debug(
                        "[FUSION] NEAR+CENTER escape: L_score=%.3f R_score=%.3f → %s",
                        left_score, right_score, intent.value,
                    )
                else:
                    # MEDIUM + CENTER → suggest direction but gentler
                    if left_score > right_score:
                        intent = Intent.PREFER_LEFT
                    elif right_score > left_score:
                        intent = Intent.PREFER_RIGHT
                    else:
                        intent = Intent.PREFER_LEFT
                    log.debug(
                        "[FUSION] MED+CENTER steer: L_score=%.3f R_score=%.3f → %s",
                        left_score, right_score, intent.value,
                    )
            else:
                # Person detected at medium/near distance, not CENTER
                # decision.py already computed PREFER_LEFT/RIGHT or STOP
                intent = person_intent

            with self._lock:
                self._latest_intent = intent
                self._latest_perception = perception
                self._latest_nav = nav_result
                self._latest_frame = frame.copy()
                self._last_update_ts = time.time()
                self._inference_failures = consecutive_failures

            # ── Optional preview window ──
            if settings.show_preview:
                self._render_preview(frame, perception, nav_result, intent)

            time.sleep(0.03)  # ~30 Hz cap

    def _render_preview(
        self, frame, perception, nav_result, intent
    ) -> None:
        """Optional OpenCV debug window."""
        try:
            intent_color = {
                Intent.CRUISE: (0, 255, 0),
                Intent.PREFER_RIGHT: (0, 165, 255),
                Intent.PREFER_LEFT: (0, 165, 255),
                Intent.STOP: (0, 0, 255),
                Intent.LEFT: (255, 200, 0),
                Intent.RIGHT: (255, 200, 0),
                Intent.BACK: (128, 0, 128),
                Intent.SCAN: (255, 0, 255),
            }.get(intent, (0, 0, 255))

            display = frame.copy()

            for x1, y1, x2, y2, conf in perception.boxes:
                cv2.rectangle(display, (x1, y1), (x2, y2), intent_color, 2)
                cv2.putText(
                    display,
                    f"person {conf:.2f}",
                    (x1, y1 - 8),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    intent_color,
                    1,
                )

            nav_colors = {
                "obstacle": (0, 0, 200),
                "path": (0, 200, 0),
                "a_block": (255, 100, 0),
                "b_block": (200, 200, 0),
                "c_block": (0, 100, 255),
            }
            for det in nav_result.all_detections:
                nc = nav_colors.get(
                    det.class_name.replace("-", "_"), (180, 180, 180)
                )
                cv2.rectangle(display, (det.x1, det.y1), (det.x2, det.y2), nc, 2)
                cv2.putText(
                    display,
                    f"{det.class_name} {det.confidence:.2f}",
                    (det.x1, det.y1 - 8),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.45,
                    nc,
                    1,
                )

            label = (
                f"{intent.value} | zone={perception.person_zone} "
                f"| ratio={perception.person_ratio:.2f}"
            )
            cv2.putText(
                display, label, (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, intent_color, 2,
            )
            nav_label = f"NAV: {self._navigator.state.value} → {self._navigator.destination or 'NONE'}"
            cv2.putText(
                display, nav_label, (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2,
            )
            cv2.imshow("Guido Vision", display)
            cv2.waitKey(1)
        except cv2.error:
            pass  # preview unavailable (headless)


# ── Flask app factory ──

def create_app() -> Flask:
    app = Flask(__name__)
    pipeline = VisionPipeline()
    pipeline.start()

    # Store pipeline on app for graceful shutdown
    app.config["PIPELINE"] = pipeline

    @app.get("/")
    def index():
        return jsonify({"status": "running", "service": "guido-vision"})

    @app.post("/robot-command")
    def robot_command():
        """ESP32 polls this every 150ms to get movement commands.
        Response: {"command": "CRUISE"|"STOP"|"LEFT"|"RIGHT"|"BACK"|"SCAN"|...}
        Designed for <50ms response time (pre-computed by pipeline thread).
        """
        cmd = pipeline.get_command()
        log.debug("[/robot-command] → %s", cmd)
        return jsonify({"command": cmd})

    @app.post("/set-destination")
    def set_destination():
        """Backend calls this when user selects a destination."""
        data = request.get_json(silent=True) or {}
        dest = data.get("destination", "").strip().upper()

        if not dest:
            return jsonify({"ok": False, "error": "missing destination"}), 400

        if dest not in settings.valid_destinations:
            return (
                jsonify({"ok": False, "error": f"invalid destination: {dest}"}),
                400,
            )

        pipeline.set_destination(dest)
        return jsonify({
            "ok": True,
            "destination": dest,
            "nav_state": "SEARCH_PATH",
        })

    @app.post("/stop")
    def stop_robot():
        """Backend calls this for emergency stop or mission cancel."""
        pipeline.stop_mission()
        return jsonify({"ok": True, "nav_state": "IDLE"})

    @app.post("/set-mode")
    def set_mode():
        """Backend calls this to switch pipeline mode (IDLE/NAVIGATION/FOLLOW/HOST)."""
        data = request.get_json(silent=True) or {}
        mode = data.get("mode", "").strip().upper()
        if not mode:
            return jsonify({"ok": False, "error": "missing mode"}), 400
        try:
            pipeline.set_mode(mode)
            return jsonify({"ok": True, "mode": mode})
        except ValueError as e:
            return jsonify({"ok": False, "error": str(e)}), 400

    @app.get("/status")
    def status():
        """Backend proxies this to frontend for live status."""
        data = pipeline.get_status()
        pipeline_ok = data["running"] and data["frame_age_s"] < settings.max_frame_age_s
        return jsonify({
            "ok": True,
            "pipeline_healthy": pipeline_ok,
            **data,
        })

    @app.get("/detailed-status")
    def detailed_status():
        """Rich status with full detection arrays + annotated frame (base64)."""
        data = pipeline.get_detailed_status()
        pipeline_ok = data["running"] and data["frame_age_s"] < settings.max_frame_age_s
        return jsonify({
            "ok": True,
            "pipeline_healthy": pipeline_ok,
            **data,
        })

    @app.get("/health")
    def health():
        data = pipeline.get_status()
        status_str = (
            "ok"
            if data["running"] and data["frame_age_s"] < settings.max_frame_age_s
            else "degraded"
        )
        return jsonify({"status": status_str, **data})

    @app.get("/snapshot")
    def snapshot():
        """Return a raw base64 JPEG of the current camera frame (for LLM vision)."""
        frame, age = pipeline._camera.get_frame()
        if frame is None or age > settings.max_frame_age_s:
            return jsonify({"ok": False, "error": "no frame available"}), 503
        try:
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            b64 = base64.b64encode(buf.tobytes()).decode("ascii")
            return jsonify({"ok": True, "image_b64": b64})
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    return app
