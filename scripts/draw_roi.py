"""
TrafficIQ - Interactive ROI Setup Tool (draw_roi.py)
Usage:
    python scripts/draw_roi.py --source <video_path> --camera 1

Features:
1. Opens the first frame of the video.
2. Allows clicking polygon points on the road.
3. Closes/draws the polygon.
4. Displays the selected Traffic Detection Zone.
5. Saves the polygon coordinates to config/roi/camera_0X.json with schema:
   {
       "camera_id": "camera_01",
       "roi_type": "polygon",
       "normalized": true,
       "points": [[x1, y1], [x2, y2], ...]
   }
Supports: --camera 1, --camera 2, --camera 3, --camera 4 (or camera_01, etc.)
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional, List, Tuple, Dict, Any
import cv2
import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def normalize_camera_id(camera_arg: str) -> str:
    """Normalize '1' -> 'camera_01', 'cam2' -> 'camera_02', 'camera_03' -> 'camera_03'."""
    cam_str = str(camera_arg).strip()
    if cam_str.isdigit():
        return f"camera_{int(cam_str):02d}"
    clean = cam_str.lower().replace("camera_", "").replace("camera", "").replace("cam", "").strip()
    if clean.isdigit():
        return f"camera_{int(clean):02d}"
    return cam_str


class DrawROIEngine:
    def __init__(self, source: str, camera_id: str):
        self.source_path = Path(source)
        self.camera_id = normalize_camera_id(camera_id)
        self.points = []
        self.frame = None
        self.display_frame = None
        self.h = 0
        self.w = 0

    def load_frame(self) -> bool:
        if not self.source_path.exists():
            alt = PROJECT_ROOT / "data" / "videos" / self.source_path.name
            if alt.exists():
                self.source_path = alt
            else:
                print(f"[ERROR] Source video not found: {self.source_path}")
                return False

        cap = cv2.VideoCapture(str(self.source_path))
        if not cap.isOpened():
            print(f"[ERROR] OpenCV could not open video: {self.source_path}")
            return False

        ret, self.frame = cap.read()
        cap.release()

        if not ret or self.frame is None:
            print(f"[ERROR] Could not decode first frame from: {self.source_path}")
            return False

        self.h, self.w = self.frame.shape[:2]
        return True

    def _mouse_callback(self, event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            self.points.append((x, y))
            self._redraw()
        elif event == cv2.EVENT_RBUTTONDOWN:
            if self.points:
                self.points.pop()
                self._redraw()

    def _redraw(self):
        self.display_frame = self.frame.copy()
        pts_arr = np.array(self.points, dtype=np.int32)

        # Polygon outline in RED
        if len(self.points) > 1:
            cv2.polylines(self.display_frame, [pts_arr], isClosed=(len(self.points) >= 3), color=(0, 0, 255), thickness=2)

        # Fill transparent polygon in RED
        if len(self.points) >= 3:
            overlay = self.display_frame.copy()
            cv2.fillPoly(overlay, [pts_arr], (0, 0, 255))
            cv2.addWeighted(overlay, 0.20, self.display_frame, 0.80, 0, self.display_frame)

        # Draw point vertices
        for idx, (px, py) in enumerate(self.points):
            cv2.circle(self.display_frame, (px, py), 6, (0, 0, 255), -1)
            cv2.putText(
                self.display_frame,
                f"P{idx+1}",
                (px + 8, py - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (255, 255, 255),
                1,
                cv2.LINE_AA,
            )

        # Status text
        lbl = f"Traffic Detection Zone: {self.camera_id.upper()} | Points: {len(self.points)}"
        instr = "Left Click: Add Point | Right Click: Undo | 'c': Close/Save | 'r': Reset | 'q': Cancel"
        cv2.putText(self.display_frame, lbl, (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 215, 255), 2, cv2.LINE_AA)
        cv2.putText(self.display_frame, instr, (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 100), 1, cv2.LINE_AA)

        cv2.imshow(f"TrafficIQ - Draw Traffic ROI ({self.camera_id})", self.display_frame)

    def save_roi(self, normalized_points=None, output_file: Optional[str] = None) -> Path:
        if normalized_points is None:
            normalized_points = [
                [round(px / self.w, 4), round(py / self.h, 4)]
                for px, py in self.points
            ]

        if output_file is None:
            out_path = PROJECT_ROOT / "config" / "roi" / f"{self.camera_id}.json"
        else:
            out_path = Path(output_file)

        out_path.parent.mkdir(parents=True, exist_ok=True)

        config_data = {
            "camera_id": self.camera_id,
            "roi_type": "polygon",
            "normalized": True,
            "description": f"Perspective Traffic Detection Zone for {self.camera_id}",
            "points": normalized_points,
        }

        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f, indent=4)

        print(f"[SUCCESS] Saved ROI for {self.camera_id} ({len(normalized_points)} points) to:")
        print(f"  {out_path.resolve()}")
        return out_path

    def run(self) -> bool:
        if not self.load_frame():
            return False

        win_name = f"TrafficIQ - Draw Traffic ROI ({self.camera_id})"
        cv2.namedWindow(win_name, cv2.WINDOW_NORMAL)
        cv2.setMouseCallback(win_name, self._mouse_callback)

        print("=" * 60)
        print(f"   TrafficIQ ROI Setup Tool — {self.camera_id.upper()}   ")
        print("=" * 60)
        print(f"Video Source : {self.source_path.resolve()}")
        print(f"Resolution   : {self.w}x{self.h}")
        print("Controls:")
        print("  - Left click on the road to add polygon corners.")
        print("  - Right click to undo last corner.")
        print("  - Press 'c' or 's' to close/save polygon.")
        print("  - Press 'r' to reset points.")
        print("  - Press 'q' or ESC to cancel.")
        print("=" * 60)

        self._redraw()

        saved = False
        while True:
            key = cv2.waitKey(20) & 0xFF
            if key in [ord("q"), 27]:
                print("[INFO] ROI drawing cancelled without saving.")
                break
            elif key == ord("r"):
                self.points.clear()
                self._redraw()
            elif key in [ord("c"), ord("s")]:
                if len(self.points) < 3:
                    print("[WARNING] At least 3 points are required to close the polygon!")
                else:
                    self.save_roi()
                    saved = True
                    break

        cv2.destroyAllWindows()
        return saved


def main():
    parser = argparse.ArgumentParser(description="TrafficIQ Interactive ROI Setup Tool")
    parser.add_argument("--source", type=str, required=True, help="Path to video or image")
    parser.add_argument("--camera", type=str, default="1", help="Camera number (1, 2, 3, 4) or ID (camera_01)")
    parser.add_argument("--points", type=str, default=None, help="Optional JSON string of points for automated headless saving")
    parser.add_argument("--output", type=str, default=None, help="Custom output JSON path")

    args = parser.parse_args()

    engine = DrawROIEngine(source=args.source, camera_id=args.camera)
    if args.points:
        if not engine.load_frame():
            sys.exit(1)
        pts = json.loads(args.points)
        engine.save_roi(normalized_points=pts, output_file=args.output)
    else:
        engine.run()


if __name__ == "__main__":
    main()
