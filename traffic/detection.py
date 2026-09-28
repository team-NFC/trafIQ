"""
TrafficIQ - Vehicle Detection Module
Wraps custom YOLO object detection for the 5 target vehicle classes.
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import torch
from ultralytics import YOLO

# Strict target vehicle classes for TrafficIQ
TARGET_CLASSES: Dict[int, str] = {
    0: "car",
    1: "motorcycle",
    2: "bus",
    3: "truck",
    4: "ambulance",
    5: "auto_rickshaw",
}

# Color palette for visual bounding boxes (BGR format)
CLASS_COLORS: Dict[int, Tuple[int, int, int]] = {
    0: (255, 144, 30),   # Car (blue/cyan)
    1: (0, 215, 255),   # Motorcycle (amber/yellow)
    2: (255, 0, 255),   # Bus (magenta)
    3: (0, 165, 255),   # Truck (orange)
    4: (0, 0, 255),     # Ambulance (bright red - emergency)
    5: (0, 255, 128),   # Auto Rickshaw (vibrant spring green)
}


class VehicleDetector:
    """
    Handles custom YOLO model loading, verification, and inference.
    """

    def __init__(
        self,
        model_path: str,
        conf_threshold: float = 0.35,
        device: Optional[str] = None,
    ):
        """
        Initialize the detector.

        :param model_path: Path to the .pt model weights
        :param conf_threshold: Detection confidence threshold (default: 0.35)
        :param device: 'cuda:0', '0', or 'cpu'. Defaults to GPU if available.
        """
        self.model_path = Path(model_path)
        self.conf_threshold = conf_threshold

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"[Detector Error] Model weights not found: {self.model_path.resolve()}\n"
                f"Please ensure the custom trained weights exist before running inference."
            )

        # Device selection: use CUDA GPU if available
        if device is None:
            self.device = "0" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        print(f"[Detector] Loading YOLO model: {self.model_path}")
        self.model = YOLO(str(self.model_path))

        # Check GPU status
        if self.device != "cpu" and torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
            print(f"[Detector] Running on GPU: {gpu_name} ({vram_gb:.2f} GB VRAM)")
        else:
            print("[Detector] Running on CPU")

        # Verify class definitions
        self.classes = self.model.names
        print(f"[Detector] Model loaded with {len(self.classes)} classes: {self.classes}")

        # Check whether this model is our custom 5-class or 6-class model
        self.is_custom_model = (
            len(self.classes) in (5, 6)
            and self.classes.get(0) == "car"
            and self.classes.get(4) == "ambulance"
        )
        self.is_custom_5_class = self.is_custom_model
        if self.is_custom_model:
            print(f"[Detector] Verified custom TrafficIQ model ({len(self.classes)} classes): {self.classes}")
            self.filter_classes = None  # All classes are valid targets
        else:
            print(f"[Detector NOTICE] Non-custom model detected with {len(self.classes)} classes.")
            print("[Detector] Filtering for traffic vehicles (car, motorcycle, bus, truck) and mapping to TrafficIQ schema.")
            # COCO mapping to TrafficIQ schema:
            # 2 (car) -> 0, 3 (motorcycle) -> 1, 5 (bus) -> 2, 7 (truck) -> 3
            self.coco_to_trafficiq = {2: 0, 3: 1, 5: 2, 7: 3}
            self.filter_classes = list(self.coco_to_trafficiq.keys())

    @torch.no_grad()
    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Run detection on a single frame.

        :param frame: BGR image as numpy array
        :return: List of detection dicts: {'box': [x1, y1, x2, y2], 'conf': float, 'class_id': int, 'class_name': str}
        """
        predict_kwargs = {
            "source": frame,
            "conf": self.conf_threshold,
            "imgsz": 640,
            "device": self.device,
            "verbose": False,
        }
        if not self.is_custom_5_class and self.filter_classes:
            predict_kwargs["classes"] = self.filter_classes

        results = self.model.predict(**predict_kwargs)

        detections = []
        if len(results) == 0:
            return detections

        r = results[0]
        boxes = r.boxes
        if boxes is None or len(boxes) == 0:
            return detections

        for box in boxes:
            raw_cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            xyxy = [float(v) for v in box.xyxy[0].tolist()]

            if self.is_custom_5_class:
                cls_id = raw_cls_id
                cls_name = TARGET_CLASSES.get(cls_id, f"class_{cls_id}")
            else:
                cls_id = self.coco_to_trafficiq.get(raw_cls_id, -1)
                if cls_id == -1:
                    continue
                cls_name = TARGET_CLASSES[cls_id]

            detections.append({
                "box": xyxy,
                "conf": conf,
                "class_id": cls_id,
                "class_name": cls_name,
            })

        return detections
