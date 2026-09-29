"""
TrafficIQ - Multi-Camera Intersection Processing Pipeline (CAM-02 Combined Architecture)
Processes 5 physical CCTVs across 4 logical approaches:
- CAM-01: North Approach (camera_01.mp4)
- CAM-02.1: South Approach Sub-Camera 1 (camera_02.1.mp4)
- CAM-02.2: South Approach Sub-Camera 2 (camera_02.2.mp4)
- CAM-03: East Approach (camera_03.mp4)
- CAM-04: West Approach (camera_04.mp4)

Logical CAM-02 combines physical CAM-02.1 and CAM-02.2 for SIGNAL-02 control.
"""

import argparse
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import cv2
import numpy as np
import torch

PROJECT_ROOT = Path(__file__).parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from traffic.roi import ROIZone
from traffic.detection import VehicleDetector
from traffic.tracking import VehicleTracker
from traffic.counting import TrafficCounter
from traffic.analytics import TrafficAnalytics
from signal_control.normal.normal_signal import NormalSignalController


# Metadata for physical camera definitions
CAMERA_SPECS = [
    ("camera_01", "CAM-01", "North Approach", "camera_01"),
    ("camera_02.1", "CAM-02.1", "South Sub-Cam A", "camera_02"),
    ("camera_02.2", "CAM-02.2", "South Sub-Cam B", "camera_02"),
    ("camera_03", "CAM-03", "East Approach", "camera_03"),
    ("camera_04", "CAM-04", "West Approach", "camera_04"),
]


class IntersectionProcessor:
    def __init__(
        self,
        camera_sources: Dict[str, str],
        model_path: str = str(PROJECT_ROOT / "yolov8n.pt"),
        conf_threshold: float = 0.25,
        device: str = "0",
        output_path: Optional[str] = None,
        signal_config_path: Optional[str] = None,
        imgsz: int = 1280,
    ):
        self.camera_sources = camera_sources
        self.model_path = model_path
        self.conf = conf_threshold
        self.device = "0" if (device != "cpu" and torch.cuda.is_available()) else "cpu"
        self.output_path = output_path
        self.imgsz = imgsz

        # Initialize Signal Controller
        self.signal_controller = NormalSignalController(config_path=signal_config_path)

        # Shared detector initialization
        print(f"[Model] Initializing detector: {Path(model_path).name} on {self.device} (imgsz={imgsz})")
        self.detector = VehicleDetector(model_path=model_path, conf_threshold=conf_threshold, device=self.device)

        # Per-camera modules
        self.cameras: Dict[str, Dict[str, Any]] = {}

        for cam_key, label, name, signal_app in CAMERA_SPECS:
            src_path = self.camera_sources.get(cam_key)
            if not src_path:
                print(f"[ERROR] Missing video file for {label}: Not specified")
                continue

            resolved_path = Path(src_path)
            if not resolved_path.is_absolute():
                resolved_path = PROJECT_ROOT / resolved_path

            if not resolved_path.exists():
                alt = PROJECT_ROOT / "data" / "camera_videos" / "normal" / resolved_path.name
                if alt.exists():
                    resolved_path = alt
                else:
                    print(f"[ERROR] Missing video file: {resolved_path}")
                    continue

            try:
                roi = ROIZone(camera_id=cam_key)
            except Exception as e:
                print(f"[WARNING] Could not load ROI for {cam_key}: {e}")
                roi = ROIZone(camera_id="default")

            cap = cv2.VideoCapture(str(resolved_path))
            if not cap.isOpened():
                print(f"[ERROR] Missing video file (could not open): {resolved_path}")
                continue

            tracker = VehicleTracker(model=self.model_path, conf_threshold=conf_threshold, device=self.device, imgsz=imgsz)
            counter = TrafficCounter(roi_zone=roi, camera_id=cam_key)
            analytics = TrafficAnalytics(roi=roi, camera_id=cam_key)

            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
            roi.update_frame_shape(h, w)

            self.cameras[cam_key] = {
                "label": label,
                "name": name,
                "signal_approach": signal_app,
                "cap": cap,
                "src_path": resolved_path,
                "roi": roi,
                "tracker": tracker,
                "counter": counter,
                "analytics": analytics,
                "w": w,
                "h": h,
                "fps": fps,
                "active_count": 0,
                "emergency": False,
            }
            print(f"[Camera OK] Initialized {label}: {resolved_path.name} ({w}x{h} @ {fps:.1f} FPS)")

    def _render_signal_badge(self, frame: np.ndarray, signal_state: str, time_remaining: int):
        """Draws signal badge on camera view."""
        h, w = frame.shape[:2]
        badge_w, badge_h = 240, 50
        x2 = w - 25
        x1 = x2 - badge_w
        y1 = 20
        y2 = y1 + badge_h

        colors = {
            "GREEN": (0, 200, 0),
            "YELLOW": (0, 215, 255),
            "RED": (0, 0, 230),
        }
        badge_color = colors.get(signal_state, (0, 0, 230))

        overlay = frame.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (20, 20, 25), -1)
        cv2.rectangle(overlay, (x1, y1), (x2, y2), badge_color, 2)
        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)

        circle_center = (x1 + 25, y1 + 25)
        cv2.circle(frame, circle_center, 12, badge_color, -1)
        cv2.circle(frame, circle_center, 13, (255, 255, 255), 1)

        time_str = f" ({time_remaining}s)" if time_remaining > 0 else ""
        txt = f"SIGNAL: {signal_state}{time_str}"
        cv2.putText(frame, txt, (x1 + 46, y1 + 32), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (255, 255, 255), 2, cv2.LINE_AA)

    def _render_cam2_summary_tile(self, width: int, height: int, c2a_count: int, c2b_count: int, c2_total: int, sig_state: str, time_rem: int) -> np.ndarray:
        """Renders the logical CAM-02 summary dashboard tile."""
        tile = np.zeros((height, width, 3), dtype=np.uint8)
        tile[:] = (20, 25, 30)  # Dark slate background

        # Header box
        cv2.rectangle(tile, (20, 20), (width - 20, 80), (35, 45, 55), -1)
        cv2.rectangle(tile, (20, 20), (width - 20, 80), (0, 215, 255), 2)
        cv2.putText(tile, "LOGICAL APPROACH: CAM-02", (35, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 215, 255), 2, cv2.LINE_AA)

        # Signal state box
        colors = {"GREEN": (0, 200, 0), "YELLOW": (0, 215, 255), "RED": (0, 0, 230)}
        sig_color = colors.get(sig_state, (0, 0, 230))
        cv2.rectangle(tile, (20, 100), (width - 20, 160), (25, 30, 40), -1)
        cv2.rectangle(tile, (20, 100), (width - 20, 160), sig_color, 2)
        cv2.circle(tile, (50, 130), 14, sig_color, -1)
        time_str = f" ({time_rem}s)" if time_rem > 0 else ""
        cv2.putText(tile, f"SIGNAL-02: {sig_state}{time_str}", (80, 138), cv2.FONT_HERSHEY_SIMPLEX, 0.70, (255, 255, 255), 2, cv2.LINE_AA)

        # Detailed breakdown
        y = 210
        cv2.putText(tile, f"CAM-02.1 (Sub-Cam A) : {c2a_count:2d} vehicles", (35, y), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (200, 220, 255), 2, cv2.LINE_AA)
        y += 45
        cv2.putText(tile, f"CAM-02.2 (Sub-Cam B) : {c2b_count:2d} vehicles", (35, y), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (200, 220, 255), 2, cv2.LINE_AA)
        y += 30
        cv2.line(tile, (35, y), (width - 35, y), (80, 90, 100), 2)
        y += 50

        # Big Total Count Box
        cv2.rectangle(tile, (35, y - 35), (width - 35, y + 35), (10, 60, 40) if sig_state == "GREEN" else (40, 20, 20), -1)
        cv2.rectangle(tile, (35, y - 35), (width - 35, y + 35), (0, 255, 150) if sig_state == "GREEN" else (100, 100, 255), 2)
        cv2.putText(tile, f"CAM-02 TOTAL : {c2_total:2d} VEHICLES", (50, y + 10), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2, cv2.LINE_AA)

        # Explanatory Note
        y += 75
        cv2.putText(tile, "Combined Multi-Camera South Approach", (35, y), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (140, 150, 160), 1, cv2.LINE_AA)
        cv2.putText(tile, "Demand feeds directly into SIGNAL-02", (35, y + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (140, 150, 160), 1, cv2.LINE_AA)

        return tile

    def _render_unavailable_tile(self, width: int, height: int, label: str, path_str: str) -> np.ndarray:
        tile = np.zeros((height, width, 3), dtype=np.uint8)
        tile[:] = (15, 15, 20)
        cv2.rectangle(tile, (10, 10), (width - 10, height - 10), (0, 0, 180), 2)
        cv2.putText(tile, f"[{label}] VIDEO UNAVAILABLE", (30, height // 2 - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 255), 2, cv2.LINE_AA)
        cv2.putText(tile, f"Path: {Path(path_str).name}", (30, height // 2 + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (180, 180, 180), 1, cv2.LINE_AA)
        return tile

    def run(self, max_frames: Optional[int] = None, show: bool = False):
        if not self.cameras:
            print("[ERROR] No valid cameras could be loaded. Please check video paths.")
            return

        print("-" * 65)
        print(f"Starting Multi-Camera Pipeline on {len(self.cameras)} Active Physical Cameras...")
        print(f"Architecture: CAM-02 Logical Approach = CAM-02.1 + CAM-02.2")
        print(f"Signal Mode : {self.signal_controller.mode}")
        print("-" * 65)

        tile_w, tile_h = 640, 480
        hud_h = 100
        canvas_w, canvas_h = 1920, 1060
        out_fps = min([c["fps"] for c in self.cameras.values()])
        dt = 1.0 / max(out_fps, 1.0)

        if self.output_path is None:
            runs_dir = PROJECT_ROOT / "runs"
            runs_dir.mkdir(parents=True, exist_ok=True)
            self.output_path = str(runs_dir / "output_intersection_multi_cam.mp4")

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(self.output_path), fourcc, out_fps, (canvas_w, canvas_h))

        quad_window_title = "TrafficIQ Multi-Camera Intersection View (CAM-02 Combined)"
        if show:
            cv2.namedWindow(quad_window_title, cv2.WINDOW_NORMAL)
            cv2.resizeWindow(quad_window_title, 1280, 720)

        frame_idx = 0
        t_start = time.time()
        rolling_fps = 0.0

        try:
            while True:
                t_frame_start = time.time()
                frame_idx += 1
                if max_frames and frame_idx > max_frames:
                    print(f"\n[INFO] Reached max frames limit: {max_frames}")
                    break

                # 1. Read next frame for all active physical cameras
                active_frames = {}
                all_done = True
                for cam_key, data in self.cameras.items():
                    ret, frame = data["cap"].read()
                    if ret:
                        all_done = False
                        active_frames[cam_key] = frame
                    else:
                        data["cap"].set(cv2.CAP_PROP_POS_FRAMES, 0)
                        ret, frame = data["cap"].read()
                        if ret:
                            all_done = False
                            active_frames[cam_key] = frame

                if all_done:
                    break

                # 2. Run detection, tracking & counting per camera
                for cam_key, data in self.cameras.items():
                    if cam_key in active_frames:
                        raw_frame = active_frames[cam_key]
                        tracks = data["tracker"].track(raw_frame)
                        metrics = data["counter"].update(tracks, frame_timestamp=frame_idx / data["fps"])
                        data["active_count"] = metrics["active_in_roi"]
                        data["emergency"] = metrics["emergency_vehicle_detected"]
                        data["latest_tracks"] = tracks
                        data["latest_metrics"] = metrics
                        data["latest_frame"] = raw_frame

                # 3. Calculate logical approach counts for Signal Controller
                c1_act = self.cameras.get("camera_01", {}).get("active_count", 0)
                c2a_act = self.cameras.get("camera_02.1", {}).get("active_count", 0)
                c2b_act = self.cameras.get("camera_02.2", {}).get("active_count", 0)
                c2_total_act = c2a_act + c2b_act
                c3_act = self.cameras.get("camera_03", {}).get("active_count", 0)
                c4_act = self.cameras.get("camera_04", {}).get("active_count", 0)

                approach_counts = {
                    "camera_01": c1_act,
                    "camera_02": c2_total_act,
                    "camera_03": c3_act,
                    "camera_04": c4_act,
                }

                # Advance Signal Controller
                sig_status = self.signal_controller.update(dt)
                signals = sig_status["signals"]
                time_rem = int(sig_status["time_remaining"])

                # 4. Render individual camera tiles
                rendered_tiles: Dict[str, np.ndarray] = {}
                for cam_key, label, name, sig_app in CAMERA_SPECS:
                    if cam_key in self.cameras:
                        cdata = self.cameras[cam_key]
                        raw_f = cdata["latest_frame"]
                        tracks = cdata["latest_tracks"]
                        metrics = cdata["latest_metrics"]

                        annotated = cdata["analytics"].render_overlay(raw_f, tracks, metrics, rolling_fps)

                        # Signal state badge on camera frame
                        sig_state = signals.get(sig_app, "RED")
                        rem = time_rem if sig_state in ("GREEN", "YELLOW") else 0
                        self._render_signal_badge(annotated, sig_state, rem)

                        resized = cv2.resize(annotated, (tile_w, tile_h))
                        rendered_tiles[cam_key] = resized
                    else:
                        src_str = self.camera_sources.get(cam_key, "unknown")
                        rendered_tiles[cam_key] = self._render_unavailable_tile(tile_w, tile_h, label, src_str)

                # Render CAM-02 Combined Summary Tile
                c2_sig_state = signals.get("camera_02", "RED")
                c2_rem = time_rem if c2_sig_state in ("GREEN", "YELLOW") else 0
                cam2_summary_tile = self._render_cam2_summary_tile(
                    tile_w, tile_h, c2a_act, c2b_act, c2_total_act, c2_sig_state, c2_rem
                )

                # 5. Assemble 2x3 grid canvas
                # Row 0: CAM-01 | CAM-02.1 | CAM-02.2
                row0 = np.hstack([rendered_tiles["camera_01"], rendered_tiles["camera_02.1"], rendered_tiles["camera_02.2"]])
                # Row 1: CAM-03 | CAM-04   | CAM-02 Summary Tile
                row1 = np.hstack([rendered_tiles["camera_03"], rendered_tiles["camera_04"], cam2_summary_tile])

                grid = np.vstack([row0, row1])

                # Canvas with Top Master HUD Banner
                canvas = np.zeros((canvas_h, canvas_w, 3), dtype=np.uint8)
                canvas[hud_h:, :] = grid

                total_junction_active = c1_act + c2_total_act + c3_act + c4_act
                total_junction_unique = sum([len(c["counter"].counted_ids) for c in self.cameras.values()])

                self._render_master_hud(canvas, total_junction_active, total_junction_unique, rolling_fps, sig_status)

                writer.write(canvas)

                t_frame_end = time.time()
                instant_fps = 1.0 / max(t_frame_end - t_frame_start, 1e-5)
                rolling_fps = instant_fps if rolling_fps == 0.0 else (0.9 * rolling_fps + 0.1 * instant_fps)

                if show:
                    cv2.imshow(quad_window_title, canvas)
                    key = cv2.waitKey(1) & 0xFF
                    if key in (ord("q"), ord("Q"), 27):
                        print("\n[INFO] Stopped by user via live window.")
                        break
                    if cv2.getWindowProperty(quad_window_title, cv2.WND_PROP_VISIBLE) < 1:
                        print("\n[INFO] Live window closed.")
                        break

                # Print Dashboard log every 25 frames
                if frame_idx % 25 == 0 or frame_idx == 1:
                    print("\n" + "=" * 65)
                    print(f"  TRAFFICIQ MULTI-CAMERA DASHBOARD (FRAME {frame_idx})")
                    print("=" * 65)
                    c1_sig = signals.get("camera_01", "RED")
                    c2_sig = signals.get("camera_02", "RED")
                    c3_sig = signals.get("camera_03", "RED")
                    c4_sig = signals.get("camera_04", "RED")

                    print(f"[CAM-01] North Approach    : {c1_act:2d} vehicles | SIGNAL: {c1_sig}")
                    print(f"[CAM-02.1] South Sub-Cam A  : {c2a_act:2d} vehicles")
                    print(f"[CAM-02.2] South Sub-Cam B  : {c2b_act:2d} vehicles")
                    print(f"[CAM-02 TOTAL] South Appr  : {c2_total_act:2d} vehicles | SIGNAL: {c2_sig}")
                    print(f"[CAM-03] East Approach     : {c3_act:2d} vehicles | SIGNAL: {c3_sig}")
                    print(f"[CAM-04] West Approach     : {c4_act:2d} vehicles | SIGNAL: {c4_sig}")
                    print("=" * 65)

        except KeyboardInterrupt:
            print("\n[INFO] Interrupted by user.")
        finally:
            for cam in self.cameras.values():
                cam["cap"].release()
            writer.release()
            if show:
                cv2.destroyAllWindows()

        t_total = time.time() - t_start
        print("\n" + "=" * 65)
        print("          TRAFFICIQ MULTI-CAMERA INTERSECTION REPORT          ")
        print("=" * 65)
        print(f"Total Frames Processed : {frame_idx}")
        print(f"Total Processing Time  : {t_total:.2f} s")
        print(f"Average Processing FPS : {frame_idx / max(t_total, 1e-5):.1f}")
        print(f"Output Video Saved To  : {self.output_path}")
        print(f"Signal Mode Completed  : {self.signal_controller.mode}")
        print(f"Signal Cycles Completed: {self.signal_controller.total_cycles_completed}")
        print("-" * 65)

        for cam_key, label, name, sig_app in CAMERA_SPECS:
            if cam_key in self.cameras:
                cdata = self.cameras[cam_key]
                counts = cdata["counter"].get_class_counts()
                unique_cnt = len(cdata["counter"].counted_ids)
                print(f"[{label}] {name}")
                print(f"  Breakdown: {counts} | Unique Tracked: {unique_cnt}")
            else:
                print(f"[{label}] {name}: NOT LOADED / UNAVAILABLE")

        c2a_cnt = self.cameras.get("camera_02.1", {}).get("counter")
        c2b_cnt = self.cameras.get("camera_02.2", {}).get("counter")
        if c2a_cnt and c2b_cnt:
            combined_unique = len(c2a_cnt.counted_ids) + len(c2b_cnt.counted_ids)
            print("-" * 65)
            print(f"[CAM-02 LOGICAL TOTAL] South Approach (CAM-02.1 + CAM-02.2)")
            print(f"  Combined Active ROI Demand: {c2_total_act} vehicles")
            print(f"  Combined Unique Tracked   : {combined_unique} vehicles")
        print("=" * 65)

    def _render_master_hud(self, canvas: np.ndarray, total_active: int, total_unique: int, fps: float, sig_status: Dict[str, Any]):
        """Renders top junction banner across the 1920 width."""
        w = canvas.shape[1]
        bw, bh = 1000, 80
        bx1 = (w - bw) // 2
        by1 = 10
        bx2 = bx1 + bw
        by2 = by1 + bh

        overlay = canvas.copy()
        cv2.rectangle(overlay, (bx1, by1), (bx2, by2), (15, 20, 25), -1)
        cv2.rectangle(overlay, (bx1, by1), (bx2, by2), (0, 215, 255), 2)
        cv2.addWeighted(overlay, 0.88, canvas, 0.12, 0, canvas)

        cv2.putText(canvas, "TRAFFICIQ: MULTI-CAMERA INTERSECTION CONTROLLER (CAM-02 COMBINED)", (bx1 + 20, by1 + 26), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (0, 215, 255), 2, cv2.LINE_AA)

        curr_app = sig_status["current_approach"].upper()
        next_app = sig_status["next_approach"].upper()
        phase = sig_status["current_phase"]
        rem = sig_status["time_remaining"]
        mode = sig_status["mode"]

        sig_line = f"MODE: {mode} | GREEN APPROACH: {curr_app} ({phase} {rem:.0f}s) | NEXT: {next_app}"
        cv2.putText(canvas, sig_line, (bx1 + 20, by1 + 48), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (0, 255, 200), 1, cv2.LINE_AA)

        stats_line = f"Active in Junction: {total_active:2d} | Cumulative Unique: {total_unique:2d} | System FPS: {fps:4.1f}"
        cv2.putText(canvas, stats_line, (bx1 + 20, by1 + 68), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (200, 200, 200), 1, cv2.LINE_AA)


def main():
    parser = argparse.ArgumentParser(description="TrafficIQ Multi-Camera Processing Pipeline (CAM-02 Architecture)")
    parser.add_argument("--cam1", type=str, default="situations/normal_situation/videos/camera_01.mp4", help="Video path for CAM-01 (North)")
    parser.add_argument("--cam2a", type=str, default="situations/normal_situation/videos/camera_02.1.mp4", help="Video path for CAM-02.1 (South Sub-Cam A)")
    parser.add_argument("--cam2b", type=str, default="situations/normal_situation/videos/camera_02.2.mp4", help="Video path for CAM-02.2 (South Sub-Cam B)")
    parser.add_argument("--cam3", type=str, default="situations/normal_situation/videos/camera_03.mp4", help="Video path for CAM-03 (East)")
    parser.add_argument("--cam4", type=str, default="situations/normal_situation/videos/camera_04.mp4", help="Video path for CAM-04 (West)")
    parser.add_argument("--model", type=str, default=str(PROJECT_ROOT / "yolov8n.pt"), help="YOLO model path")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold (default: 0.25)")
    parser.add_argument("--imgsz", type=int, default=1280, help="Inference resolution (default: 1280)")
    parser.add_argument("--max-frames", type=int, default=None, help="Max frames to process")
    parser.add_argument("--output", type=str, default=None, help="Output quad video path")
    parser.add_argument("--show", action="store_true", help="Display live quad window")
    parser.add_argument("--signal-config", type=str, default=None, help="Path to custom signal config JSON")

    args = parser.parse_args()

    sources = {
        "camera_01": args.cam1,
        "camera_02.1": args.cam2a,
        "camera_02.2": args.cam2b,
        "camera_03": args.cam3,
        "camera_04": args.cam4,
    }

    processor = IntersectionProcessor(
        camera_sources=sources,
        model_path=args.model,
        conf_threshold=args.conf,
        output_path=args.output,
        signal_config_path=args.signal_config,
        imgsz=args.imgsz,
    )
    processor.run(max_frames=args.max_frames, show=args.show)


if __name__ == "__main__":
    main()