"""
TrafficIQ - Region of Interest (ROI) / Traffic Detection Zone Module
Manages camera-specific polygonal detection zones and perspective-aware point-in-polygon tests.
Limits vehicle detection and tracking to the defined road-distance zone.
"""

import json
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any
import numpy as np
import cv2


def normalize_camera_id(camera_arg: str) -> str:
    """Normalize '1' -> 'camera_01', 'cam2' -> 'camera_02', 'camera_03' -> 'camera_03'."""
    cam_str = str(camera_arg).strip()
    if cam_str.isdigit():
        return f"camera_{int(cam_str):02d}"
    clean = cam_str.lower().replace("camera_", "").replace("camera", "").replace("cam", "").strip()
    if clean.isdigit():
        return f"camera_{int(clean):02d}"
    return cam_str


class ROIZone:
    """
    Represents a perspective Traffic Detection Zone (ROI polygon) for a specific camera.
    Vehicles outside this polygon are ignored during counting and tracking analytics.
    """

    def __init__(
        self,
        camera_id: str,
        config_dir: Optional[str] = None,
        frame_shape: Optional[Tuple[int, int]] = None,
        point_type: str = "bottom_center",
    ):
        """
        Initialize the ROI for a camera.

        :param camera_id: Identifier for the camera (e.g. '1', 'camera_01')
        :param config_dir: Directory containing camera ROI JSON configs (default: config/roi)
        :param frame_shape: Tuple of (height, width) to scale normalized coordinates
        :param point_type: Which vehicle point to test: 'bottom_center' (recommended for road contact) or 'center'
        """
        self.camera_id = normalize_camera_id(camera_id)
        if config_dir is None:
            config_dir = str(Path(__file__).parent.parent / "config" / "roi")
        self.config_dir = Path(config_dir)
        self.config_path = self.config_dir / f"{self.camera_id}.json"

        self.polygon_pts: Optional[np.ndarray] = None
        self.raw_coords: List[List[float]] = []
        self.is_normalized: bool = False
        self.description: str = ""
        self.frame_shape = frame_shape  # (height, width)
        self.point_type = point_type.lower()

        self._load_config()

    def _load_config(self) -> None:
        """Load polygon vertices from camera-specific JSON."""
        if not self.config_path.exists():
            error_msg = (
                f"\n[ROIZone ERROR] Camera ROI configuration not found: {self.config_path}\n"
                f"To configure an ROI for '{self.camera_id}', create a JSON file at:\n"
                f"  {self.config_path.resolve()}\n"
                f"or run: python scripts/draw_roi.py --source <video> --camera {self.camera_id}\n"
                f"Example content (normalized coordinates 0.0 to 1.0):\n"
                f"{{\n"
                f'  "camera_id": "{self.camera_id}",\n'
                f'  "roi_type": "polygon",\n'
                f'  "normalized": true,\n'
                f'  "points": [\n'
                f"    [0.20, 0.45],\n"
                f"    [0.80, 0.45],\n"
                f"    [0.95, 0.95],\n"
                f"    [0.05, 0.95]\n"
                f"  ]\n"
                f"}}\n"
            )
            raise FileNotFoundError(error_msg)

        with open(self.config_path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)

        self.description = data.get("description", f"Traffic Detection Zone for {self.camera_id}")
        self.raw_coords = data.get("points") or data.get("polygon") or data.get("polygon_normalized") or []
        coord_type = data.get("coordinate_type", "pixel").lower()
        is_norm_flag = data.get("normalized", False)

        if len(self.raw_coords) < 3:
            raise ValueError(f"ROI polygon in {self.config_path} must have at least 3 vertices, got {len(self.raw_coords)}")

        # Check if coordinates are normalized [0.0, 1.0]
        self.is_normalized = is_norm_flag or (coord_type == "normalized") or all(
            0.0 <= pt[0] <= 1.0 and 0.0 <= pt[1] <= 1.0 for pt in self.raw_coords
        )

        if not self.is_normalized and self.frame_shape is None:
            self.polygon_pts = np.array(self.raw_coords, dtype=np.int32).reshape((-1, 1, 2))

    def update_frame_shape(self, height: int, width: int) -> None:
        """Update frame resolution and recompute pixel polygon if normalized."""
        self.frame_shape = (height, width)
        if self.is_normalized:
            pixel_pts = []
            for x, y in self.raw_coords:
                px = int(round(x * width))
                py = int(round(y * height))
                pixel_pts.append([px, py])
            self.polygon_pts = np.array(pixel_pts, dtype=np.int32).reshape((-1, 1, 2))

    def get_vehicle_test_point(self, box: List[float]) -> Tuple[float, float]:
        """
        Calculate vehicle position point.
        Defaults to bottom-center (road contact) for perspective road accuracy:
            bottom_center_x = (x1 + x2) / 2
            bottom_center_y = y2
        """
        x1, y1, x2, y2 = box
        if self.point_type == "bottom_center":
            return ((x1 + x2) / 2.0, float(y2))
        return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)

    def contains_box(self, box: List[float]) -> bool:
        """Test if vehicle's bottom-center (or center) is inside the ROI."""
        pt = self.get_vehicle_test_point(box)
        return self.contains_point(pt)

    def contains_point(self, point: Tuple[float, float]) -> bool:
        """
        Check whether point (x, y) is inside the ROI polygon using cv2.pointPolygonTest.
        """
        if self.polygon_pts is None:
            return False
        result = cv2.pointPolygonTest(self.polygon_pts, (float(point[0]), float(point[1])), False)
        return result >= 0

    def draw(self, frame: np.ndarray, color: Tuple[int, int, int] = (0, 0, 255), thickness: int = 3) -> np.ndarray:
        """
        Draw the Traffic Detection Zone polygon overlay clearly in RED onto the frame.
        """
        if self.polygon_pts is None:
            if self.frame_shape is not None:
                self.update_frame_shape(self.frame_shape[0], self.frame_shape[1])
            else:
                self.update_frame_shape(frame.shape[0], frame.shape[1])

        # Polygon outline in RED
        cv2.polylines(frame, [self.polygon_pts], isClosed=True, color=color, thickness=thickness)

        # Semi-transparent fill in RED
        overlay = frame.copy()
        cv2.fillPoly(overlay, [self.polygon_pts], color=color)
        cv2.addWeighted(overlay, 0.12, frame, 0.88, 0, frame)

        # Label: TRAFFICIQ TRAFFIC DETECTION ZONE
        if len(self.polygon_pts) > 0:
            min_y_idx = np.argmin(self.polygon_pts[:, 0, 1])
            top_pt = self.polygon_pts[min_y_idx][0]
            tag_pos = (max(20, top_pt[0] - 80), max(35, top_pt[1] - 12))
            label_str = "TRAFFICIQ TRAFFIC DETECTION ZONE"
            cv2.putText(
                frame,
                label_str,
                tag_pos,
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                color,
                2,
                cv2.LINE_AA,
            )
        return frame
