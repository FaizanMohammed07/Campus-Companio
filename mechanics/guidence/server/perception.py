"""
perception.py — YOLO person detection.

Runs yolov8n.pt on a frame and extracts person detections ONLY (class 0).
For the nearest person (largest bbox), computes:
  - proximity  (bbox area / frame area)
  - horizontal zone  (LEFT | CENTER | RIGHT)

This module has NO knowledge of motors, Flask, or navigation.
"""

import logging
from dataclasses import dataclass, field

from ultralytics import YOLO

from .config import settings

log = logging.getLogger(__name__)


@dataclass
class PerceptionResult:
    """Output of a single YOLO person-detection frame."""
    person_detected: bool = False
    person_ratio: float = 0.0
    person_zone: str = "NONE"   # LEFT | CENTER | RIGHT | NONE
    confidence: float = 0.0
    boxes: list = field(default_factory=list)  # [(x1,y1,x2,y2,conf), ...]
    person_count: int = 0               # total persons detected
    total_person_coverage: float = 0.0  # sum of all person bbox areas / frame area
    frame_blocked: bool = False         # True when persons fill most of frame


class PersonDetector:
    def __init__(self) -> None:
        self._model = YOLO(settings.model_path)
        log.info("PersonDetector loaded model: %s", settings.model_path)

    def analyze(self, frame) -> PerceptionResult:
        """Run YOLO on *frame* and return nearest-person perception."""
        h, w, _ = frame.shape
        frame_area = h * w

        results = self._model.predict(
            source=frame,
            conf=settings.conf_threshold,
            verbose=False,
        )

        best_ratio = 0.0
        best_cx_norm = 0.0
        best_conf = 0.0
        person_boxes: list = []

        for r in results:
            if r.boxes is None:
                continue
            for box_xywh, box_xyxy, cls, conf in zip(
                r.boxes.xywh.tolist(),
                r.boxes.xyxy.tolist(),
                r.boxes.cls.tolist(),
                r.boxes.conf.tolist(),
            ):
                if int(cls) != settings.person_class_id:
                    continue
                cx, _, bw, bh = box_xywh
                x1, y1, x2, y2 = box_xyxy
                ratio = (bw * bh) / frame_area
                person_boxes.append(
                    (int(x1), int(y1), int(x2), int(y2), float(conf))
                )
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_cx_norm = cx / w
                    best_conf = float(conf)

        if best_ratio <= 0.0:
            return PerceptionResult()

        if best_cx_norm < settings.zone_left_max:
            zone = "LEFT"
        elif best_cx_norm > settings.zone_right_min:
            zone = "RIGHT"
        else:
            zone = "CENTER"

        # Total coverage = sum of all person bbox areas / frame area
        total_coverage = sum(
            (b[2] - b[0]) * (b[3] - b[1]) / frame_area for b in person_boxes
        )
        n_persons = len(person_boxes)
        # Frame is "blocked" when multiple persons cover >40% of frame
        # or a single person covers >50% (basically can't go anywhere)
        blocked = (
            (n_persons >= 2 and total_coverage >= settings.frame_blocked_ratio)
            or (n_persons >= 3 and total_coverage >= 0.30)
            or total_coverage >= 0.50
        )

        return PerceptionResult(
            person_detected=True,
            person_ratio=best_ratio,
            person_zone=zone,
            confidence=best_conf,
            boxes=person_boxes,
            person_count=n_persons,
            total_person_coverage=total_coverage,
            frame_blocked=blocked,
        )
