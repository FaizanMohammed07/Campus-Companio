"""
config.py — Immutable application settings.

All tunables in one place.  Override via environment variables.
"""
from dataclasses import dataclass
import os
import sys


@dataclass(frozen=True)
class Settings:
    # ── Camera ──
    camera_index: int = int(os.getenv("CAMERA_INDEX", "0"))

    # ── Person-detection model (yolov8n.pt) ──
    model_path: str = os.getenv("YOLO_MODEL", "yolov8n.pt")
    conf_threshold: float = float(os.getenv("CONF_THRESHOLD", "0.6"))
    person_class_id: int = 0

    # ── Network ──
    host: str = "0.0.0.0"
    port: int = int(os.getenv("VISION_PORT", "8000"))

    # ── Serial USB to ESP32 ──
    #    Set SERIAL_PORT env var to your COM port.
    #    macOS: /dev/tty.usbserial-0001  or  /dev/cu.usbserial-0001
    #    Windows: COM9
    #    Linux: /dev/ttyUSB0
    serial_port: str = os.getenv("SERIAL_PORT", "/dev/tty.usbserial-0001")
    serial_baud: int = int(os.getenv("SERIAL_BAUD", "115200"))

    # ── Pipeline health ──
    max_frame_age_s: float = 1.0
    max_inference_failures: int = 3

    # ── Person proximity thresholds (bbox area / frame area) ──
    #    FAR:    ratio < 0.08  → person far away, ignore → CRUISE
    #    MEDIUM: 0.08 ≤ ratio < 0.25 → visible, steer away based on zone
    #    NEAR:   ratio ≥ 0.25 → very close → STOP
    person_far_ratio: float = 0.08
    person_near_ratio: float = 0.25

    # ── Frame blocked threshold ──
    #    When total person coverage (sum of all person bboxes / frame area)
    #    exceeds this AND there are 2+ persons → frame is "blocked"
    #    Triggers a 360° SCAN to find a clear path
    frame_blocked_ratio: float = 0.40
    # Consecutive "blocked" frames before triggering SCAN (debounce)
    scan_trigger_frames: int = 2
    # Cooldown: min seconds between consecutive SCAN commands
    scan_cooldown_s: float = 8.0

    # ── Frame horizontal zones (normalized 0.0 – 1.0) ──
    zone_left_max: float = 0.35
    zone_right_min: float = 0.65

    # ── Debounce: consecutive clear frames before CRUISE ──
    debounce_cruise_frames: int = 5

    # ── Navigation model (yolov8n.pt — single model for everything) ──
    nav_model_path: str = os.getenv("NAV_MODEL", "yolov8n.pt")
    nav_conf_threshold: float = float(os.getenv("NAV_CONF", "0.5"))

    # ── Block "reached" threshold (bbox area / frame area) ──
    block_reached_ratio: float = 0.15

    # ── PATH centre-offset tolerance (± fraction of frame width) ──
    path_center_tolerance: float = 0.1

    # ── Preview window ──
    show_preview: bool = os.getenv(
        "SHOW_PREVIEW",
        "0" if sys.platform == "darwin" else "1",
    ) == "1"

    # ── Valid navigation destinations ──
    valid_destinations: tuple = (
        "A_BLOCK", "B_BLOCK", "C_BLOCK",
        "ADMISSION", "FEE", "ADMIN",
        "LIBRARY", "EXAM", "CANTEEN",
    )


settings = Settings()
