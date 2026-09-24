"""
TrafficIQ - Situation 2: Ambulance Priority CCTV Pipeline Runner
Processes 4 camera feeds containing an emergency vehicle (ambulance),
tracks vehicles inside the Traffic Detection Zone,
dynamically activates Emergency Vehicle Preemption (EVP) when ambulance is detected,
renders a synchronized 4-way CCTV monitor with live emergency alert telemetry,
and outputs annotated video to runs/output_ambulance_situation.mp4.
"""

import sys
import time
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import cv2
import numpy as np
import torch

# Project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from traffic.roi import ROIZone
from traffic.detection import VehicleDetector
from traffic.tracking import VehicleTracker
from traffic.counting import TrafficCounter
from traffic.analytics import TrafficAnalytics
from situations.utils import get_situation_camera_sources
from situations.ambulance_situation.ambulance_priority import AmbulancePriorityController


class AmbulanceIntersectionProcessor:
    """
    Manages 4-camera intersection inference with live Emergency Vehicle Preemption.
    """

    def __init__(
        self,
        camera_sources: Dict[str, str],
        model_path: str = str(PROJECT_ROOT / "yolov8n.pt"),
        conf_threshold: float = 0.25,
        device: str = "0",
        output_path: Optional[str] = None,
        imgsz: int = 1280,
    ):
        self.camera_sources = camera_sources
        self.model_path = model_path
        self.conf = conf_threshold
        self.device = "0" if (device != "cpu" and torch.cuda.is_available()) else "cpu"
        self.output_path = Path(output_path) if output_path else (PROJECT_ROOT / "runs" / "output_ambulance_situation.mp4")
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.imgsz = imgsz

        # Initialize Situation 2 Ambulance Priority Controller
        self.signal_controller = AmbulancePriorityController(
            green_seconds=15.0,
            yellow_seconds=3.0,
            all_red_seconds=2.0,
            emergency_yellow_seconds=2.0,
            emergency_all_red_seconds=2.0,
            emergency_min_green_seconds=6.0,
            clearance_cooldown_seconds=1.5,
        )

        print(f"[Model] Initializing detector: {Path(model_path).name} on {self.device} (imgsz={imgsz})")
        self.detector = VehicleDetector(model_path=model_path, conf_threshold=conf_threshold, device=self.device)

        # Setup per-camera modules
        self.cameras: Dict[str, Dict[str, Any]] = {}
        for cam_id, src_path in self.camera_sources.items():
            cap = cv2.VideoCapture(src_path)
            if not cap.isOpened():
                print(f"[WARNING] Could not open video for {cam_id}: {src_path}")
                continue

            try:
                roi = ROIZone(camera_id=cam_id)
            except Exception as e:
                print(f"[WARNING] Could not load ROI for {cam_id}: {e}")
                continue

            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
            roi.update_frame_shape(h, w)

            tracker = VehicleTracker(
                model=self.model_path,
                conf_threshold=conf_threshold,
                device=self.device,
                imgsz=imgsz,
            )
            counter = TrafficCounter(roi_zone=roi, camera_id=cam_id)
            analytics = TrafficAnalytics(roi=roi, camera_id=cam_id)

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
            print(f"[Camera OK] {cam_id.upper()} initialized: {Path(src_path).name} ({w}x{h} @ {fps:.1f} FPS)")

    def _render_signal_badge(self, frame: np.ndarray, signal_state: str, time_remaining: float, is_emergency: bool = False):
        """Draws a high-visibility traffic light badge on the camera tile."""
        colors = {
            "GREEN": (0, 220, 0),
            "YELLOW": (0, 215, 255),
            "RED": (0, 0, 255),
        }
        color = colors.get(signal_state, (100, 100, 100))

        # Badge pill at top-right
        x2 = frame.shape[1] - 20
        x1 = x2 - 220
        y1 = 20
        y2 = y1 + 55

        overlay = frame.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (20, 20, 20), -1)
        cv2.rectangle(overlay, (x1, y1), (x2, y2), color, 2)
        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)

        # Light circle
        cx = x1 + 25
        cy = y1 + 27
        cv2.circle(frame, (cx, cy), 15, color, -1)
        cv2.circle(frame, (cx, cy), 15, (255, 255, 255), 1)

        # Label text
        label = f"{signal_state}"
        if signal_state in ("GREEN", "YELLOW") and time_remaining > 0:
            label += f" {int(time_remaining)}s"
        if is_emergency:
            label = "EMERGENCY GREEN"

        cv2.putText(frame, label, (x1 + 48, cy + 6), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    def _render_emergency_header(self, canvas: np.ndarray, target_cam: str, frame_idx: int) -> np.ndarray:
        """Renders flashing high-priority emergency banner at the top of the monitor."""
        # Flash between deep red and royal blue every 6 frames
        flash_phase = (frame_idx // 6) % 2
        bg_color = (0, 0, 180) if flash_phase == 0 else (180, 0, 0)
        border_color = (0, 255, 255)

        banner_h = 70
        banner = np.zeros((banner_h, canvas.shape[1], 3), dtype=np.uint8)
        banner[:] = bg_color

        cv2.rectangle(banner, (0, 0), (canvas.shape[1] - 1, banner_h - 1), border_color, 3)

        title = f"EMERGENCY VEHICLE PREEMPTION ACTIVE  --  GREEN CORRIDOR GRANTED TO {target_cam.upper().replace('_', ' ')}"
        sub = "ALL CONFLICTING APPROACHES RED  |  INTERSECTION PREEMPTION ENFORCED"

        cv2.putText(banner, title, (40, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(banner, sub, (40, 58), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 255, 255), 1, cv2.LINE_AA)

        return np.vstack([banner, canvas])

    def run(self, max_frames: Optional[int] = None, show: bool = True):
        """Runs synchronized 4-camera inference loop."""
        if not self.cameras:
            print("[ERROR] No cameras available to process.")
            return

        cam_fps = max([c["fps"] for c in self.cameras.values()])
        dt = 1.0 / cam_fps

        tile_w = 960
        tile_h = 540
        canvas_w = tile_w * 2
        canvas_h = tile_h * 2

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        # Include emergency header space in final canvas (70px taller)
        final_canvas_h = canvas_h + 70
        writer = cv2.VideoWriter(str(self.output_path), fourcc, cam_fps, (canvas_w, final_canvas_h))

        window_title = "TrafficIQ - Situation 2: Ambulance Priority Live CCTV Monitor"
        if show:
            try:
                cv2.namedWindow(window_title, cv2.WINDOW_NORMAL)
                cv2.resizeWindow(window_title, 1280, 760)
            except Exception as e:
                print(f"[INFO] GUI window not available ({e}). Running in headless mode.")
                show = False

        frame_idx = 0
        t_start = time.time()
        rolling_fps = 0.0
        ambulance_frames_seen = 0

        print("=" * 68)
        print("TRAFFICIQ - STARTING SITUATION 2 CCTV VIDEO PROCESSING")
        print(f"Output Video : {self.output_path}")
        print(f"Cameras      : {list(self.cameras.keys())}")
        print("=" * 68)

        try:
            while True:
                t_frame_start = time.time()
                frame_idx += 1
                if max_frames and frame_idx > max_frames:
                    print(f"\n[INFO] Reached max frames limit: {max_frames}")
                    break

                # 1. Read frames across all cameras
                active_frames = {}
                all_done = True
                for cam_id, cam_data in self.cameras.items():
                    ret, frame = cam_data["cap"].read()
                    if ret:
                        all_done = False
                        active_frames[cam_id] = frame

                if all_done or not active_frames:
                    break

                # 2. Run detection, tracking, and count updates to detect ambulances
                camera_tiles = []
                emergency_approaches = []
                vehicle_counts = {}

                for cam_id in self.signal_controller.sequence:
                    if cam_id not in active_frames:
                        blank = np.zeros((tile_h, tile_w, 3), dtype=np.uint8)
                        cv2.putText(blank, f"{cam_id.upper()}: NO SIGNAL", (30, tile_h // 2), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2)
                        camera_tiles.append(blank)
                        continue

                    raw_frame = active_frames[cam_id]
                    cam_data = self.cameras[cam_id]

                    tracks = cam_data["tracker"].track(raw_frame)
                    metrics = cam_data["counter"].update(tracks, frame_timestamp=frame_idx / cam_data["fps"])

                    cam_data["active_count"] = metrics["active_in_roi"]
                    vehicle_counts[cam_id] = metrics["active_in_roi"]

                    if metrics["emergency_vehicle_detected"]:
                        emergency_approaches.append(cam_id)
                        ambulance_frames_seen += 1

                    annotated = cam_data["analytics"].render_overlay(raw_frame, tracks, metrics, rolling_fps)
                    camera_tiles.append((cam_id, annotated))

                # 3. Advance Ambulance Priority Signal Controller
                sig_status = self.signal_controller.update(dt=dt, emergency_approaches=emergency_approaches)
                signals = sig_status["signals"]
                time_rem = sig_status["time_remaining"]

                # 4. Render signal badges onto camera tiles
                rendered_tiles = []
                for item in camera_tiles:
                    if isinstance(item, tuple):
                        cam_id, annotated = item
                        sig_state = signals.get(cam_id, "RED")
                        is_em = (sig_status["mode"] == AmbulancePriorityController.MODE_EMERGENCY_HOLD and cam_id == sig_status["emergency_approach"])
                        self._render_signal_badge(annotated, sig_state, time_rem, is_emergency=is_em)
                        resized = cv2.resize(annotated, (tile_w, tile_h))
                        rendered_tiles.append(resized)
                    else:
                        rendered_tiles.append(item)

                # Ensure 4 tiles
                while len(rendered_tiles) < 4:
                    blank = np.zeros((tile_h, tile_w, 3), dtype=np.uint8)
                    rendered_tiles.append(blank)

                # 5. Assemble 2x2 CCTV Quad Grid
                top_row = np.hstack([rendered_tiles[0], rendered_tiles[1]])
                bot_row = np.hstack([rendered_tiles[2], rendered_tiles[3]])
                quad_canvas = np.vstack([top_row, bot_row])

                # 6. Attach Header Banner (Active emergency or Normal banner)
                if sig_status["mode"] in (AmbulancePriorityController.MODE_EMERGENCY_HOLD, AmbulancePriorityController.MODE_PREEMPTION_CLEARING):
                    final_frame = self._render_emergency_header(quad_canvas, sig_status["emergency_approach"] or "CAM 03", frame_idx)
                else:
                    # Clean standard header
                    header_h = 70
                    banner = np.zeros((header_h, canvas_w, 3), dtype=np.uint8)
                    banner[:] = (35, 35, 35)
                    cv2.rectangle(banner, (0, 0), (canvas_w - 1, header_h - 1), (80, 80, 80), 2)
                    cv2.putText(banner, "TRAFFICIQ CCTV MONITOR  |  SITUATION 2: AMBULANCE PRIORITY SYSTEM", (40, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
                    cv2.putText(banner, f"STATUS: {sig_status['mode']}  |  ACTIVE APPROACH: {sig_status['current_approach'].upper()} ({sig_status['current_phase']})  |  TIME: {sig_status['phase_time_elapsed']:.1f}s", (40, 58), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 0), 1, cv2.LINE_AA)
                    final_frame = np.vstack([banner, quad_canvas])

                writer.write(final_frame)

                # Update rolling FPS
                f_dur = time.time() - t_frame_start
                rolling_fps = 0.9 * rolling_fps + 0.1 * (1.0 / max(f_dur, 1e-4))

                # Display live window
                if show:
                    cv2.imshow(window_title, final_frame)
                    key = cv2.waitKey(1) & 0xFF
                    if key == 27 or key == ord("q"):
                        print("\n[INFO] Stopped by user keypress.")
                        break

                # Progress indicator
                if frame_idx % 20 == 0:
                    status_line = f"Frame {frame_idx:04d} | FPS: {rolling_fps:.1f} | Mode: {sig_status['mode']:<20} | Signals: " + ", ".join([f"{k}:{v}" for k, v in signals.items()])
                    print(status_line)

        finally:
            writer.release()
            for cam in self.cameras.values():
                cam["cap"].release()
            if show:
                cv2.destroyAllWindows()

        t_total = time.time() - t_start
        print("\n" + "=" * 68)
        print("        TRAFFICIQ REPORT — SITUATION 2 (AMBULANCE PRIORITY)")
        print("=" * 68)
        print(f"Total Frames Processed   : {frame_idx}")
        print(f"Total Processing Time    : {t_total:.2f} s")
        print(f"Average Processing FPS   : {frame_idx / max(t_total, 1e-4):.1f}")
        print(f"Output Video Saved To    : {self.output_path}")
        print(f"Emergency Frames Detected: {ambulance_frames_seen}")
        print(f"Emergency Events Handled : {self.signal_controller.total_emergency_events_handled}")
        print("-" * 68)
        print("Final Cumulative Camera Counts:")
        for cam_id, cam_data in self.cameras.items():
            cnt = cam_data["counter"]
            c_str = ", ".join([f"{k}: {v}" for k, v in cnt.get_class_counts().items() if v > 0])
            print(f"  {cam_id.upper():<12}: Total Unique={len(cnt.counted_ids):<3} ({c_str})")
        print("=" * 68)


def main():
    parser = argparse.ArgumentParser(description="TrafficIQ Situation 2 Ambulance Priority CCTV Pipeline")
    parser.add_argument("--weights", default=str(PROJECT_ROOT / "yolov8n.pt"), help="YOLOv8 model weights")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--device", default="0", help="Inference device ('0' for GPU or 'cpu')")
    parser.add_argument("--output", default=str(PROJECT_ROOT / "runs" / "output_ambulance_situation.mp4"), help="Output video path")
    parser.add_argument("--imgsz", type=int, default=1280, help="Inference image resolution")
    parser.add_argument("--max-frames", type=int, default=None, help="Max frames to process")
    parser.add_argument("--no-show", action="store_true", help="Disable OpenCV display window")
    args = parser.parse_args()

    situation_dir = PROJECT_ROOT / "situations" / "ambulance_situation"
    sources = get_situation_camera_sources(situation_dir)

    processor = AmbulanceIntersectionProcessor(
        camera_sources=sources,
        model_path=args.weights,
        conf_threshold=args.conf,
        device=args.device,
        output_path=args.output,
        imgsz=args.imgsz,
    )
    processor.run(max_frames=args.max_frames, show=not args.no_show)


if __name__ == "__main__":
    main()
