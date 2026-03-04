"""
camera.py — Thread-safe continuous frame grabber.

Responsibility: grab frames from an OpenCV camera source.
No YOLO, no Flask, no decision logic.
"""

import logging
import threading
import time

import cv2

from .config import settings

log = logging.getLogger(__name__)


class Camera:
    """Thread-safe continuous frame grabber with reconnection."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._frame = None
        self._timestamp: float = 0.0
        self._running: bool = False
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    # ── public API ──

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=3.0)
        with self._lock:
            self._running = False
            self._frame = None

    def get_frame(self) -> tuple:
        """Return (frame_copy, age_seconds).  (None, -1) if no frame yet."""
        with self._lock:
            if self._frame is None:
                return None, -1.0
            age = time.time() - self._timestamp
            return self._frame.copy(), age

    @property
    def is_running(self) -> bool:
        with self._lock:
            return self._running

    # ── internal loop ──

    def _capture_loop(self) -> None:
        cap = cv2.VideoCapture(settings.camera_index)
        if not cap.isOpened():
            log.error("Cannot open camera %s", settings.camera_index)
            return

        with self._lock:
            self._running = True

        log.info("Camera capture started (index=%s)", settings.camera_index)

        try:
            while not self._stop_event.is_set():
                ok, frame = cap.read()
                if not ok:
                    time.sleep(0.01)
                    continue
                with self._lock:
                    self._frame = frame
                    self._timestamp = time.time()
                # ~30 FPS cap to avoid burning CPU
                time.sleep(0.030)
        finally:
            cap.release()
            with self._lock:
                self._running = False
            log.info("Camera capture stopped")
