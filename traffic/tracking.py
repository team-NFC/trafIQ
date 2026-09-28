"""
TrafficIQ - ByteTrack Vehicle Tracking Module
Provides persistent multi-object tracking IDs, bottom-center road contact calculation,
emergency beacon detection, and trajectory-based direction estimation.
"""

from collections import deque
from typing import Dict, List, Optional, Tuple, Any, Set
import numpy as np
import cv2
from ultralytics import YOLO

from .roi import ROIZone

TARGET_CLASS_NAMES: Dict[int, str] = {
    0: "car",
    1: "motorcycle",
    2: "bus",
    3: "truck",
    4: "ambulance",
    5: "auto_rickshaw",
}


def check_emergency_siren_beacon(frame: np.ndarray, box: List[float], raw_cls_id: int = 2) -> bool:
    """
    Analyzes top section of vehicle bounding box for red and blue emergency lightbar beacons.
    Enables recognizing emergency ambulances in real outdoor video feeds.
    """
    # Emergency ambulances are vans, cars, or light trucks (COCO 2, 7)
    if raw_cls_id not in [2, 7]:
        return False

    x1, y1, x2, y2 = [int(v) for v in box]
    h, w = frame.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    crop = frame[y1:y2, x1:x2]
    if crop.shape[0] < 40 or crop.shape[1] < 40:
        return False

    # Check top 28% of vehicle roof for beacon bar
    top_bar = crop[0:int(0.28 * crop.shape[0]), :]
    hsv = cv2.cvtColor(top_bar, cv2.COLOR_BGR2HSV)
    red1 = cv2.inRange(hsv, np.array([0, 100, 100]), np.array([10, 255, 255]))
    red2 = cv2.inRange(hsv, np.array([170, 100, 100]), np.array([180, 255, 255]))
    red_count = np.count_nonzero(cv2.bitwise_or(red1, red2))
    blue_count = np.count_nonzero(cv2.inRange(hsv, np.array([100, 120, 100]), np.array([130, 255, 255])))
    return (red_count >= 80 and blue_count >= 75)


class VehicleTracker:
    """
    Manages ByteTrack multi-object tracking and trajectory history for vehicles.
    """

    def __init__(
        self,
        model: YOLO,
        roi_zone: Optional[ROIZone] = None,
        conf_threshold: float = 0.35,
        device: str = "0",
        history_len: int = 30,
        direction_min_disp: float = 15.0,
        imgsz: int = 1280,
    ):
        # Ensure an isolated YOLO model instance per tracker so ByteTrack Kalman state
        # is never cross-contaminated between parallel camera streams.
        from pathlib import Path
        if isinstance(model, (str, Path)):
            self.model = YOLO(str(model))
        elif isinstance(model, YOLO):
            weights = getattr(model, "ckpt_path", None) or getattr(model, "model_name", None)
            if weights:
                self.model = YOLO(str(weights))
            else:
                self.model = model
        else:
            self.model = model

        self.roi = roi_zone
        self.conf_threshold = conf_threshold
        self.device = device
        self.history_len = history_len
        self.direction_min_disp = direction_min_disp
        self.imgsz = imgsz

        # Check custom 5 or 6-class model vs standard COCO
        self.is_custom_5_class = (
            len(self.model.names) in [5, 6]
            and self.model.names.get(0) == "car"
            and self.model.names.get(4) == "ambulance"
        )
        if not self.is_custom_5_class:
            self.coco_to_trafficiq = {2: 0, 3: 1, 5: 2, 7: 3}
            self.filter_classes = list(self.coco_to_trafficiq.keys())
        else:
            self.filter_classes = None

        # Trajectory history: track_id -> deque of (cx, cy)
        self.track_history: Dict[int, deque] = {}

        # Persistent track IDs identified as ambulances
        self.ambulance_track_ids: Set[int] = set()

        # Frame hit counter for siren beacon verification: track_id -> int
        self.beacon_hit_counts: Dict[int, int] = {}
        self.beacon_confirm_threshold: int = 3

    def set_roi(self, roi_zone: ROIZone) -> None:
        self.roi = roi_zone

    def track(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Execute ByteTrack on a video frame.
        Calculates bottom-center point for road contact, tests ROI membership,
        and identifies vehicle class and emergency ambulance state.
        """
        track_kwargs = {
            "source": frame,
            "imgsz": self.imgsz,
            "conf": self.conf_threshold,
            "device": self.device,
            "tracker": "bytetrack.yaml",
            "persist": True,
            "verbose": False,
            "agnostic_nms": True,
        }
        if not self.is_custom_5_class and self.filter_classes:
            track_kwargs["classes"] = self.filter_classes

        results = self.model.track(**track_kwargs)

        tracks = []
        if len(results) == 0:
            return tracks

        r = results[0]
        boxes = r.boxes
        if boxes is None or len(boxes) == 0:
            return tracks

        for box in boxes:
            if box.id is None:
                continue

            track_id = int(box.id[0].item())
            raw_cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            xyxy = [float(v) for v in box.xyxy[0].tolist()]
            x1, y1, x2, y2 = xyxy

            # Bottom-center point represents physical road position
            bc_x = (x1 + x2) / 2.0
            bc_y = float(y2)
            bottom_center = (bc_x, bc_y)
            center = (bc_x, (y1 + y2) / 2.0)

            # Check emergency ambulance with temporal beacon confirmation (>= 3 frames)
            is_amb = False
            if self.is_custom_5_class and raw_cls_id == 4:
                is_amb = True
            elif track_id in self.ambulance_track_ids:
                is_amb = True
            else:
                if check_emergency_siren_beacon(frame, xyxy, raw_cls_id):
                    self.beacon_hit_counts[track_id] = self.beacon_hit_counts.get(track_id, 0) + 1
                    if self.beacon_hit_counts[track_id] >= self.beacon_confirm_threshold:
                        is_amb = True
                        self.ambulance_track_ids.add(track_id)

            if is_amb:
                cls_id = 4
                cls_name = "ambulance"
            elif self.is_custom_5_class:
                cls_id = raw_cls_id
                cls_name = TARGET_CLASS_NAMES.get(cls_id, f"class_{cls_id}")
            else:
                cls_id = self.coco_to_trafficiq.get(raw_cls_id, -1)
                if cls_id == -1:
                    continue
                cls_name = TARGET_CLASS_NAMES.get(cls_id, f"class_{cls_id}")

            # Update trajectory history
            if track_id not in self.track_history:
                self.track_history[track_id] = deque(maxlen=self.history_len)
            self.track_history[track_id].append(bottom_center)

            direction = self._calculate_direction(track_id)

            # Test ROI membership
            in_roi = False
            if self.roi is not None:
                in_roi = self.roi.contains_point(bottom_center)

            tracks.append({
                "track_id": track_id,
                "box": xyxy,
                "center": center,
                "bottom_center": bottom_center,
                "class_id": cls_id,
                "class_name": cls_name,
                "conf": conf,
                "direction": direction,
                "in_roi": in_roi,
            })

        return tracks

    def _calculate_direction(self, track_id: int) -> str:
        """Calculate movement direction from bottom-center trajectory displacement."""
        history = self.track_history.get(track_id)
        if not history or len(history) < 3:
            return "Unknown"

        start_pt = history[0]
        end_pt = history[-1]
        dx = end_pt[0] - start_pt[0]
        dy = end_pt[1] - start_pt[1]
        disp = np.sqrt(dx ** 2 + dy ** 2)

        if disp < self.direction_min_disp:
            return "Stationary"

        if abs(dy) >= abs(dx):
            return "Moving Down" if dy > 0 else "Moving Up"
        else:
            return "Moving Right" if dx > 0 else "Moving Left"
