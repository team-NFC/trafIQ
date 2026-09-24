"""
TrafficIQ - Multi-Camera 4-Way Intersection Processing Pipeline
Processes up to 4 CCTV camera streams simultaneously, tracks vehicles across all 4 approaches,
computes intersection-wide traffic metrics, integrates Situation 1 Normal Traffic Signal Control,
and generates a synchronized 2x2 CCTV quad-split monitor video with live signal telemetry.
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

        # Initialize Situation 1 Normal Signal Controller
        self.signal_controller = NormalSignalController(config_path=signal_config_path)

        # Setup GPU Detector (shared across cameras to save VRAM)
        print(f"[Model] Initializing detector: {Path(model_path).name} on {self.device} (imgsz={imgsz})")
        self.detector = VehicleDetector(model_path=model_path, conf_threshold=conf_threshold, device=self.device)

        # Per-camera modules
        self.cameras = {}
        for cam_id, src_path in self.camera_sources.items():
            resolved_path = Path(src_path)
            if not resolved_path.exists():
                alt = PROJECT_ROOT / "data" / "videos" / resolved_path.name
                if alt.exists():
                    resolved_path = alt
                else:
                    print(f"[WARNING] Video for {cam_id} not found: {src_path}. Skipping.")
                    continue

            try:
                roi = ROIZone(camera_id=cam_id)
            except Exception as e:
                print(f"[WARNING] Could not load ROI for {cam_id}: {e}. Skipping.")
                continue

            cap = cv2.VideoCapture(str(resolved_path))
            if not cap.isOpened():
                print(f"[WARNING] Could not open video for {cam_id}: {resolved_path}")
                continue

            tracker = VehicleTracker(model=self.model_path, conf_threshold=conf_threshold, device=self.device, imgsz=imgsz)
            counter = TrafficCounter(roi_zone=roi, camera_id=cam_id)
            analytics = TrafficAnalytics(roi=roi, camera_id=cam_id)

            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
            roi.update_frame_shape(h, w)

            self.cameras[cam_id] = {
                "cap": cap,
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
            print(f"[Camera OK] Initialized {cam_id}: {resolved_path.name} ({w}x{h} @ {fps:.1f} FPS)")

    def _render_signal_badge(self, frame: np.ndarray, signal_state: str, time_remaining: int):
        """Draws a bright traffic light status badge on the camera view."""
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

        # Draw glowing circle light
        circle_center = (x1 + 25, y1 + 25)
        cv2.circle(frame, circle_center, 12, badge_color, -1)
        cv2.circle(frame, circle_center, 13, (255, 255, 255), 1)

        # Text: SIGNAL: GREEN (18s)
        time_str = f" ({time_remaining}s)" if time_remaining > 0 else ""
        txt = f"SIGNAL: {signal_state}{time_str}"
        cv2.putText(frame, txt, (x1 + 46, y1 + 32), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (255, 255, 255), 2, cv2.LINE_AA)

    def run(self, max_frames: Optional[int] = None, show: bool = False):
        if not self.cameras:
            print("[ERROR] No valid cameras could be loaded. Please check paths and ROI configs.")
            return

        print("-" * 60)
        print(f"Starting 4-Way Intersection Processing on {len(self.cameras)} Cameras...")
        print(f"Signal Mode: {self.signal_controller.mode} (Situation 1 Fixed Sequence)")
        print("-" * 60)

        tile_w, tile_h = 960, 540
        canvas_w, canvas_h = 1920, 1080
        out_fps = min([c["fps"] for c in self.cameras.values()])
        dt = 1.0 / max(out_fps, 1.0)

        if self.output_path is None:
            runs_dir = PROJECT_ROOT / "runs"
            runs_dir.mkdir(parents=True, exist_ok=True)
            self.output_path = str(runs_dir / "output_intersection_quad.mp4")

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(self.output_path), fourcc, out_fps, (canvas_w, canvas_h))

        quad_window_title = "TrafficIQ 4-Way Intersection Quad View"
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

                # Advance Signal Controller by frame delta-time
                sig_status = self.signal_controller.update(dt)
                signals = sig_status["signals"]
                time_rem = int(sig_status["time_remaining"])

                active_frames = {}
                all_done = True
                for cam_id, data in self.cameras.items():
                    ret, frame = data["cap"].read()
                    if ret:
                        all_done = False
                        active_frames[cam_id] = frame
                    else:
                        data["cap"].set(cv2.CAP_PROP_POS_FRAMES, 0)
                        ret, frame = data["cap"].read()
                        if ret:
                            all_done = False
                            active_frames[cam_id] = frame

                if all_done or not active_frames:
                    break

                tiles = []
                total_active = 0
                total_unique = 0
                intersection_ambulance_event = None

                for cam_id in list(self.cameras.keys()):
                    if cam_id not in active_frames:
                        blank = np.zeros((tile_h, tile_w, 3), dtype=np.uint8)
                        cv2.putText(blank, f"{cam_id}: NO SIGNAL", (30, tile_h // 2), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2)
                        tiles.append(blank)
                        continue

                    raw_frame = active_frames[cam_id]
                    cam_data = self.cameras[cam_id]

                    tracks = cam_data["tracker"].track(raw_frame)
                    metrics = cam_data["counter"].update(tracks, frame_timestamp=frame_idx / cam_data["fps"])

                    cam_data["active_count"] = metrics["active_in_roi"]
                    cam_data["emergency"] = metrics["emergency_vehicle_detected"]

                    total_active += metrics["active_in_roi"]
                    total_unique += metrics["total_unique"]

                    annotated = cam_data["analytics"].render_overlay(raw_frame, tracks, metrics, rolling_fps)

                    # Add traffic light badge on this approach
                    sig_state = signals.get(cam_id, "RED")
                    rem = time_rem if sig_state in ("GREEN", "YELLOW") else 0
                    self._render_signal_badge(annotated, sig_state, rem)

                    resized = cv2.resize(annotated, (tile_w, tile_h))
                    tiles.append(resized)

                while len(tiles) < 4:
                    blank = np.zeros((tile_h, tile_w, 3), dtype=np.uint8)
                    cv2.putText(blank, "AUX CAMERA: STANDBY", (30, tile_h // 2), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (120, 120, 120), 2)
                    tiles.append(blank)

                row1 = np.hstack([tiles[0], tiles[1]])
                row2 = np.hstack([tiles[2], tiles[3]])
                canvas = np.vstack([row1, row2])

                # Render Top Master HUD Banner with live signal telemetry
                self._render_master_hud(canvas, total_active, total_unique, rolling_fps, sig_status)

                writer.write(canvas)

                t_frame_end = time.time()
                instant_fps = 1.0 / max(t_frame_end - t_frame_start, 1e-5)
                rolling_fps = instant_fps if rolling_fps == 0.0 else (0.9 * rolling_fps + 0.1 * instant_fps)

                if show:
                    cv2.imshow(quad_window_title, canvas)
                    key = cv2.waitKey(1) & 0xFF
                    if key in (ord("q"), ord("Q"), 27):
                        print("\n[INFO] Quad view stopped by user via live window.")
                        break
                    if cv2.getWindowProperty(quad_window_title, cv2.WND_PROP_VISIBLE) < 1:
                        print("\n[INFO] Quad view window closed by user.")
                        break

                # Print Dashboard every 25 frames (~1 second)
                if frame_idx % 25 == 0 or frame_idx == 1:
                    veh_counts = {cid: cdata["active_count"] for cid, cdata in self.cameras.items()}
                    dash = self.signal_controller.format_dashboard(veh_counts)
                    print("\n" + "=" * 45)
                    print(dash)
                    print("=" * 45)

        except KeyboardInterrupt:
            print("\n[INFO] Stopped by user.")
        finally:
            for cam in self.cameras.values():
                cam["cap"].release()
            writer.release()
            if show:
                cv2.destroyAllWindows()

        t_total = time.time() - t_start
        print("\n" + "=" * 60)
        print("          TRAFFICIQ 4-WAY INTERSECTION REPORT          ")
        print("=" * 60)
        print(f"Total Frames Processed : {frame_idx}")
        print(f"Total Processing Time  : {t_total:.2f} s")
        print(f"Average Processing FPS : {frame_idx / max(t_total, 1e-5):.1f}")
        print(f"Output Video Saved To  : {self.output_path}")
        print(f"Signal Mode Completed  : {self.signal_controller.mode}")
        print(f"Signal Cycles Completed: {self.signal_controller.total_cycles_completed}")
        print("-" * 60)
        for cam_id, data in self.cameras.items():
            counts = data["counter"].get_class_counts()
            print(f"[{cam_id}] Breakdown: {counts} | Unique: {len(data['counter'].counted_ids)}")
        print("=" * 60)

    def _render_master_hud(self, canvas: np.ndarray, total_active: int, total_unique: int, fps: float, sig_status: Dict[str, Any]):
        """Renders top junction banner across the 2x2 grid with signal telemetry."""
        h, w = canvas.shape[:2]
        bw, bh = 840, 70
        bx1 = (w - bw) // 2
        by1 = 10
        bx2 = bx1 + bw
        by2 = by1 + bh

        overlay = canvas.copy()
        cv2.rectangle(overlay, (bx1, by1), (bx2, by2), (15, 20, 25), -1)
        cv2.rectangle(overlay, (bx1, by1), (bx2, by2), (0, 215, 255), 2)
        cv2.addWeighted(overlay, 0.88, canvas, 0.12, 0, canvas)

        cv2.putText(canvas, "TRAFFICIQ: 4-WAY INTERSECTION CONTROLLER", (bx1 + 20, by1 + 25), cv2.FONT_HERSHEY_SIMPLEX, 0.68, (0, 215, 255), 2, cv2.LINE_AA)

        curr_app = sig_status["current_approach"].upper()
        next_app = sig_status["next_approach"].upper()
        phase = sig_status["current_phase"]
        rem = sig_status["time_remaining"]
        mode = sig_status["mode"]

        sig_line = f"MODE: {mode} | APPROACH: {curr_app} ({phase} {rem:.0f}s) | NEXT: {next_app}"
        cv2.putText(canvas, sig_line, (bx1 + 20, by1 + 46), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (0, 255, 200), 1, cv2.LINE_AA)

        stats_line = f"Active in Junction: {total_active:2d} | Cumulative: {total_unique:2d} | System FPS: {fps:4.1f}"
        cv2.putText(canvas, stats_line, (bx1 + 20, by1 + 62), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (200, 200, 200), 1, cv2.LINE_AA)


def main():
    parser = argparse.ArgumentParser(description="TrafficIQ 4-Way Intersection Processing Pipeline with Situation 1 Signal Control")
    parser.add_argument("--cam1", type=str, default="data/videos/camera_01.mp4", help="Video path for Camera 1 (North)")
    parser.add_argument("--cam2", type=str, default="data/videos/camera_02.mp4", help="Video path for Camera 2 (South)")
    parser.add_argument("--cam3", type=str, default="data/videos/camera_03.mp4", help="Video path for Camera 3 (East)")
    parser.add_argument("--cam4", type=str, default="data/videos/camera_04.mp4", help="Video path for Camera 4 (West)")
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
        "camera_02": args.cam2,
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