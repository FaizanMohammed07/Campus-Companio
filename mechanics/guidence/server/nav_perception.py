"""
nav_perception.py — Navigation YOLO model (yolov8n.pt)
Detects: OBSTACLE, PATH, A_BLOCK, B_BLOCK, C_BLOCK
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List

import numpy as np
from ultralytics import YOLO

from .config import settings

log = logging.getLogger(__name__)

# ── dataclasses ──────────────────────────────────────────────

@dataclass(frozen=True)
class NavDetection:
    class_name: str
    x1: int
    y1: int
    x2: int
    y2: int
    cx_norm: float     # centre-x normalised 0-1
    area_ratio: float  # box area / frame area
    confidence: float


@dataclass
class NavPerceptionResult:
    obstacles: List[NavDetection] = field(default_factory=list)
    paths: List[NavDetection] = field(default_factory=list)
    a_blocks: List[NavDetection] = field(default_factory=list)
    b_blocks: List[NavDetection] = field(default_factory=list)
    c_blocks: List[NavDetection] = field(default_factory=list)
    all_detections: List[NavDetection] = field(default_factory=list)


# ── bucket mapping ───────────────────────────────────────────

_BUCKET_MAP = {
    "obstacle": "obstacles",
    "path": "paths",
    "a_block": "a_blocks",
    "b_block": "b_blocks",
    "c_block": "c_blocks",
}


# ── detector ─────────────────────────────────────────────────

class NavDetector:
    """Runs the custom-trained navigation YOLO model."""

    def __init__(self) -> None:
        log.info("Loading nav model from %s", settings.nav_model_path)
        self._model = YOLO(settings.nav_model_path)
        log.info("Nav model loaded — classes: %s", self._model.names)

    # ── public ───────────────────────────────────────────────

    def analyze(self, frame: np.ndarray) -> NavPerceptionResult:
        """Run inference on *frame* and return categorised detections."""
        h, w = frame.shape[:2]
        frame_area = float(h * w) if (h * w) > 0 else 1.0

        results = self._model(
            frame,
            conf=settings.nav_conf_threshold,
            verbose=False,
        )

        result = NavPerceptionResult()

        for r in results:
            boxes = r.boxes
            if boxes is None:
                continue
            for box in boxes:
                cls_id = int(box.cls[0])
                raw_name = self._model.names.get(cls_id, "unknown")
                norm_name = raw_name.strip().lower().replace(" ", "_")

                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                cx_norm = ((x1 + x2) / 2.0) / w if w else 0.5
                area_ratio = float((x2 - x1) * (y2 - y1)) / frame_area
                conf = float(box.conf[0])

                det = NavDetection(
                    class_name=norm_name,
                    x1=x1, y1=y1, x2=x2, y2=y2,
                    cx_norm=cx_norm,
                    area_ratio=area_ratio,
                    confidence=conf,
                )

                result.all_detections.append(det)

                bucket = _BUCKET_MAP.get(norm_name)
                if bucket:
                    getattr(result, bucket).append(det)
                else:
                    log.debug("Unknown nav class: %s", norm_name)

        return result
