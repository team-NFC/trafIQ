"""
TrafficIQ - Interactive & Automated ROI Calibration Tool
Allows drawing polygonal detection zones directly on video frames.
Saves normalized coordinates to config/roi/{camera_id}.json.
"""

import argparse
import json
import sys
from pathlib import Path
import cv2
import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class ROICalibrator:
    def __init__(self, source_path: str, camera_id: str = "camera_01"):
        self.source_path = Path(source_path)
        self.camera_id = camera_id
        self.points = []
        self.frame = None
        self.display_frame = None
        self.h = 0
        self.w = 0

    def load_frame(self) -> bool:
        if not self.source_path.exists():
            # Check in data/videos
            alt = PROJECT_ROOT / "data" / "videos" / self.source_path.name
            if alt.exists():
                self.source_path = alt
            else:
                print(f"[ERROR] Source file not found: {self.source_path}")
                return False

        if self.source_path.suffix.lower() in [".jpg", ".jpeg", ".png", ".bmp"]:
            self.frame = cv2.imread(str(self.source_path))
        else:
            cap = cv2.VideoCapture(str(self.source_path))
            ret, self.frame = cap.read()
            cap.release()

        if self.frame is None:
            print(f"[ERROR] Could not decode video frame from: {self.source_path}")
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

        # Draw connecting polygon
        if len(self.points) > 1:
            cv2.polylines(self.display_frame, [pts_arr], isClosed=(len(self.points) >= 3), color=(0, 240, 255), thickness=2)

        # Draw semi-transparent fill if >= 3 points
        if len(self.points) >= 3:
            overlay = self.display_frame.copy()
            cv2.fillPoly(overlay, [pts_arr], (0, 240, 255))
            cv2.addWeighted(overlay, 0.25, self.display_frame, 0.75, 0, self.display_frame)

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

        # Instructions text overlay
        instr = "Left-Click: Add Point | Right-Click: Undo | 's': Save | 'r': Reset | 'q': Quit"
        cv2.putText(self.display_frame, instr, (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2, cv2.LINE_AA)

        cv2.imshow(f"TrafficIQ ROI Calibrator - {self.camera_id}", self.display_frame)

    def run_interactive(self) -> bool:
        if not self.load_frame():
            return False

        win_name = f"TrafficIQ ROI Calibrator - {self.camera_id}"
        cv2.namedWindow(win_name, cv2.WINDOW_NORMAL)
        cv2.setMouseCallback(win_name, self._mouse_callback)

        print("-" * 60)
        print(f"Calibrating ROI for Camera: '{self.camera_id}' ({self.w}x{self.h})")
        print("  - Left click on the road to add polygon vertices.")
        print("  - Right click (or press 'u') to undo the last point.")
        print("  - Press 'r' to reset all points.")
        print("  - Press 's' to save the ROI configuration.")
        print("  - Press 'q' or ESC to exit.")
        print("-" * 60)

        self._redraw()

        saved = False
        while True:
            key = cv2.waitKey(20) & 0xFF
            if key in [ord("q"), 27]:  # 'q' or ESC
                print("[INFO] Exiting without saving.")
                break
            elif key == ord("r"):
                self.points.clear()
                self._redraw()
                print("[INFO] Points reset.")
            elif key == ord("u"):
                if self.points:
                    self.points.pop()
                    self._redraw()
            elif key == ord("s"):
                if len(self.points) < 3:
                    print("[WARNING] At least 3 points are required to define a polygon!")
                else:
                    self.save_config()
                    saved = True
                    break

        cv2.destroyAllWindows()
        return saved

    def save_config(self, normalized_points=None, output_path: str = None) -> Path:
        if normalized_points is None:
            # Normalize pixel points to 0.0 - 1.0
            normalized_points = [
                [round(px / self.w, 4), round(py / self.h, 4)]
                for px, py in self.points
            ]

        if output_path is None:
            out_file = PROJECT_ROOT / "config" / "roi" / f"{self.camera_id}.json"
        else:
            out_file = Path(output_path)

        out_file.parent.mkdir(parents=True, exist_ok=True)

        config_data = {
            "camera_id": self.camera_id,
            "description": f"ROI polygon for {self.camera_id}",
            "frame_width": self.w,
            "frame_height": self.h,
            "polygon_normalized": normalized_points,
        }

        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(config_data, f, indent=2)

        print(f"[SUCCESS] Saved ROI configuration ({len(normalized_points)} points) to: {out_file.resolve()}")
        return out_file


def main():
    parser = argparse.ArgumentParser(description="TrafficIQ ROI Interactive & Automated Calibrator")
    parser.add_argument("--source", type=str, required=True, help="Path to video or image")
    parser.add_argument("--camera", type=str, default="camera_01", help="Camera ID (default: camera_01)")
    parser.add_argument("--output", type=str, default=None, help="Custom output JSON path")
    parser.add_argument("--points", type=str, default=None, help="JSON string of normalized points for automated headless setup")

    args = parser.parse_args()

    calibrator = ROICalibrator(source_path=args.source, camera_id=args.camera)

    if args.points:
        # Automated headless mode
        if not calibrator.load_frame():
            sys.exit(1)
        pts = json.loads(args.points)
        calibrator.save_config(normalized_points=pts, output_path=args.output)
    else:
        # Interactive mode
        calibrator.run_interactive()


if __name__ == "__main__":
    main()
