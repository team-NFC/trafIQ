"""
TrafficIQ - Terminal-Based Real 4-Camera Traffic Intelligence Simulation
Executes the core TrafficIQ pipeline across 4 independent CCTV camera approaches:
- Real looping video capture (CAM01 to CAM04)
- Real YOLO vehicle detection
- Real camera-local ByteTrack tracking
- Real Traffic Detection Zone (ROI) filtering
- Real vehicle counting and classification (Cars, Motorcycles, Buses, Trucks, Ambulances)
- Real signal control state machine (Normal fixed-cycle and Emergency Preemption)
- Real Emergency Vehicle Preemption (EVP) when ambulance is detected inside ROI

Run:
    python scripts/run_trafficiq_terminal.py
    python scripts/run_trafficiq_terminal.py --situation ambulance
"""

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Any

import cv2
import torch

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from traffic.roi import ROIZone
from traffic.tracking import VehicleTracker
from traffic.counting import TrafficCounter
from situations.ambulance_situation.ambulance_priority import AmbulancePriorityController

# Default camera approach metadata definitions
RAW_CAMERA_APPROACH_DEFS = [
    ("camera_01", "CAM-01", "North Approach"),
    ("camera_02.1", "CAM-02.1", "East (Near Section - 54.6m)"),
    ("camera_02.2", "CAM-02.2", "East (Far Section - 218.5m)"),
    ("camera_02", "CAM-02", "East Approach"),
    ("camera_03", "CAM-03", "South Approach"),
    ("camera_04", "CAM-04", "West Approach"),
]

CAMERA_APPROACHES = {
    fname: {"display": disp, "approach": appr}
    for fname, disp, appr in RAW_CAMERA_APPROACH_DEFS
}



class TrafficIQTerminalRunner:
    """
    Orchestrates the multi-camera real-time traffic detection, tracking, counting,
    and signal preemption simulation with clean terminal display.
    """

    def __init__(
        self,
        situation: str = "normal",
        weights: Optional[str] = None,
        device: Optional[str] = None,
        conf_threshold: float = 0.25,
        imgsz: int = 640,
        signal_config_path: Optional[str] = None,
        display_interval: float = 0.5,
        target_fps: float = 24.0,
    ):
        self.situation = situation.lower()
        self.conf_threshold = conf_threshold
        self.imgsz = imgsz
        self.display_interval = display_interval
        self.target_fps = target_fps

        # Model weights resolution
        if weights:
            self.weights_path = Path(weights)
        else:
            default_weights = PROJECT_ROOT / "yolov8n.pt"
            if not default_weights.is_file():
                default_weights = PROJECT_ROOT / "weights" / "best.pt"
            self.weights_path = default_weights

        if not self.weights_path.is_file():
            raise FileNotFoundError(f"Model weights file not found: {self.weights_path}")

        # Compute device
        if device is None:
            self.device = "0" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        self.device_name = "CPU"
        if self.device != "cpu" and torch.cuda.is_available():
            self.device_name = torch.cuda.get_device_name(0)

        # Video sources directory
        if self.situation == "ambulance":
            self.video_dir = PROJECT_ROOT / "situations" / "ambulance_situation" / "videos"
        else:
            self.video_dir = PROJECT_ROOT / "situations" / "normal_situation" / "videos"

        # Dynamically resolve available camera video files
        self.camera_approaches: Dict[str, Dict[str, str]] = {}
        seen = set()
        for fname, disp, appr in RAW_CAMERA_APPROACH_DEFS:
            vfile = self.video_dir / f"{fname}.mp4"
            if vfile.is_file():
                if fname == "camera_02" and ("camera_02.1" in seen or "camera_02.2" in seen):
                    continue
                self.camera_approaches[fname] = {"display": disp, "approach": appr}
                seen.add(fname)

        # Signal controller configuration
        self.signal_config = signal_config_path or str(PROJECT_ROOT / "config" / "signal_config.json")
        self.signal_controller = AmbulancePriorityController(
            config_path=self.signal_config,
            green_seconds=20.0,
            yellow_seconds=3.0,
            all_red_seconds=2.0,
            emergency_yellow_seconds=2.0,
            emergency_all_red_seconds=2.0,
            emergency_min_green_seconds=5.0,
            clearance_cooldown_seconds=1.5,
        )

        # Setup independent camera pipelines
        self.cameras: Dict[str, Dict[str, Any]] = {}
        self._init_camera_pipelines()

    def _init_camera_pipelines(self):
        print(f"\n[TrafficIQ] Initializing Camera Pipelines (Situation: {self.situation.upper()})")
        print(f"[TrafficIQ] Video Source Dir : {self.video_dir}")
        print(f"[TrafficIQ] YOLO Model       : {self.weights_path.name}")
        print(f"[TrafficIQ] Inference Device : {self.device_name} ({self.device})")
        print("-" * 65)

        for cam_id, meta in self.camera_approaches.items():
            video_file = self.video_dir / f"{cam_id}.mp4"
            if not video_file.is_file():
                continue

            cap = cv2.VideoCapture(str(video_file))
            if not cap.isOpened():
                raise RuntimeError(f"OpenCV failed to open video: {video_file}")

            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 24.0

            # Initialize independent ROI polygon for this camera
            roi = ROIZone(camera_id=cam_id)
            roi.update_frame_shape(h, w)

            # Initialize independent ByteTracker for this camera
            tracker = VehicleTracker(
                model=str(self.weights_path),
                roi_zone=roi,
                conf_threshold=self.conf_threshold,
                device=self.device,
                imgsz=self.imgsz,
            )

            # Initialize independent TrafficCounter for this camera
            counter = TrafficCounter(roi_zone=roi, camera_id=cam_id)

            self.cameras[cam_id] = {
                "display": meta["display"],
                "approach": meta["approach"],
                "video_file": video_file,
                "cap": cap,
                "w": w,
                "h": h,
                "fps": fps,
                "total_frames": total_frames,
                "current_frame_idx": 0,
                "loop_count": 1,
                "roi": roi,
                "tracker": tracker,
                "counter": counter,
                "latest_counts": {
                    "active_in_roi": 0,
                    "total_unique": 0,
                    "unique_counts": {"car": 0, "motorcycle": 0, "bus": 0, "truck": 0, "ambulance": 0},
                    "emergency_vehicle_detected": False,
                },
            }
            print(f"  ✓ {meta['display']} ({meta['approach']:15s}) : {video_file.name} [{w}x{h} @ {fps:.1f} FPS, {total_frames} frames]")

        print("-" * 65)
        print("[TrafficIQ] All 4 camera pipelines initialized successfully.\n")

    def run(self, max_duration: Optional[float] = None):
        """
        Main simulation loop.
        Processes frames across all 4 cameras in parallel, updates signal control,
        detects ambulances, and prints live terminal control room status.
        """
        start_real_time = time.time()
        last_display_time = 0.0
        last_step_time = time.time()
        total_frames_processed = 0

        sim_clock = 0.0
        frame_delay = 1.0 / self.target_fps

        print("Starting TrafficIQ Live Control Room Simulation... (Press Ctrl+C to stop)\n")
        time.sleep(1.0)

        try:
            while True:
                step_start = time.time()
                dt = step_start - last_step_time
                if dt <= 0:
                    dt = frame_delay
                last_step_time = step_start
                sim_clock += dt

                active_emergency_cams = []

                # Process one frame for each of the 4 cameras
                for cam_id, cam in self.cameras.items():
                    cap = cam["cap"]
                    ret, frame = cap.read()

                    # Video Looping Mechanism
                    if not ret or frame is None:
                        cam["loop_count"] += 1
                        cam["current_frame_idx"] = 0
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        ret, frame = cap.read()
                        if not ret or frame is None:
                            continue

                    cam["current_frame_idx"] += 1
                    total_frames_processed += 1

                    # 1. ByteTrack inference on frame
                    tracks = cam["tracker"].track(frame)

                    # 2. TrafficCounter updates within ROI
                    counts_result = cam["counter"].update(tracks, frame_timestamp=sim_clock)
                    cam["latest_counts"] = counts_result

                    # 3. Check for emergency ambulance
                    if counts_result.get("emergency_vehicle_detected", False):
                        active_emergency_cams.append(cam_id)

                # 4. Advance Signal Controller with real elapsed time
                signal_status = self.signal_controller.update(dt=dt, emergency_approaches=active_emergency_cams)

                # 5. Render Terminal Control Room Dashboard
                current_time = time.time()
                if (current_time - last_display_time) >= self.display_interval:
                    elapsed_total = current_time - start_real_time
                    fps_real = total_frames_processed / max(0.1, elapsed_total)
                    self._render_dashboard(signal_status, active_emergency_cams, elapsed_total, fps_real)
                    last_display_time = current_time

                # Check max duration
                if max_duration and (time.time() - start_real_time) >= max_duration:
                    print(f"\n[TrafficIQ] Reached requested simulation duration ({max_duration}s). Exiting.")
                    break

                # Frame-rate throttling to match natural playback
                proc_time = time.time() - step_start
                sleep_needed = frame_delay - proc_time
                if sleep_needed > 0:
                    time.sleep(sleep_needed)

        except KeyboardInterrupt:
            print("\n[TrafficIQ] Simulation stopped by user (Ctrl+C).")
        finally:
            self._cleanup()

    def _render_dashboard(
        self,
        signal_status: Dict[str, Any],
        active_emergency_cams: List[str],
        elapsed_sec: float,
        fps_real: float,
    ):
        """
        Renders the terminal control room dashboard matching the exact specifications.
        """
        lines = []
        lines.append("=" * 68)
        lines.append(f"{'TRAFFICIQ CONTROL ROOM':^68}")
        lines.append("=" * 68)
        lines.append(f"Simulation Time : {elapsed_sec:5.1f}s | Real FPS: {fps_real:4.1f} | Mode: {signal_status['mode']} | Device: {self.device_name}")
        lines.append(f"Situation Video : {self.video_dir.name}/")
        lines.append("")

        lines.append("VIDEO SOURCES")
        lines.append("-" * 68)
        for cam_id, cam in self.cameras.items():
            disp = cam["display"]
            loop = cam["loop_count"]
            f_idx = cam["current_frame_idx"]
            f_tot = cam["total_frames"]
            lines.append(f"{disp} ({cam['approach']:14s}) : ONLINE | LOOPING (Loop {loop} | Frame {f_idx:3d}/{f_tot})")
        lines.append("")

        lines.append("-" * 68)
        lines.append("TRAFFIC ANALYSIS (INSIDE ROI)")
        lines.append("-" * 68)
        for cam_id, cam in self.cameras.items():
            disp = cam["display"]
            counts = cam["latest_counts"]["unique_counts"]
            active_roi = cam["latest_counts"]["active_in_roi"]
            total_uniq = cam["latest_counts"]["total_unique"]
            is_amb = cam["latest_counts"]["emergency_vehicle_detected"]
            amb_tag = " 🚑 [AMBULANCE DETECTED]" if is_amb else ""

            lines.append(f"{disp} [{cam['approach']}]{amb_tag}")
            lines.append(f"  Cars        : {counts.get('car', 0)}")
            lines.append(f"  Motorcycles : {counts.get('motorcycle', 0)}")
            lines.append(f"  Buses       : {counts.get('bus', 0)}")
            lines.append(f"  Trucks      : {counts.get('truck', 0)}")
            lines.append(f"  Ambulances  : {counts.get('ambulance', 0)}")
            lines.append(f"  Occupancy   : {active_roi} visible in ROI | {total_uniq} unique tracked")
            lines.append("")

        lines.append("=" * 68)
        lines.append("SIGNAL CONTROL")
        lines.append("=" * 68)

        mode = signal_status.get("mode", "NORMAL")
        curr_app = signal_status.get("current_approach", "camera_01")
        curr_meta = self.camera_approaches.get(curr_app, CAMERA_APPROACHES.get(curr_app, {"display": curr_app, "approach": curr_app}))
        curr_disp = curr_meta["display"]
        curr_phase = signal_status.get("current_phase", "GREEN")
        remaining = signal_status.get("time_remaining", 0.0)
        signals = signal_status.get("signals", {})
        cycles = signal_status.get("cycles_completed", 0)

        # Emergency Mode Special Display
        if mode in ["PREEMPTION_CLEARING", "EMERGENCY_HOLD", "RECOVERY"]:
            lines.append(f"{'🚨 EMERGENCY PRIORITY ACTIVE':^68}")
            lines.append("-" * 68)
            emb_app = signal_status.get("emergency_approach") or (active_emergency_cams[0] if active_emergency_cams else "UNKNOWN")
            emb_meta = self.camera_approaches.get(emb_app, CAMERA_APPROACHES.get(emb_app, {}))
            emb_disp = emb_meta.get("display", emb_app)
            emb_name = emb_meta.get("approach", emb_app)

            lines.append(f"Ambulance Detected: {emb_disp} ({emb_name})")
            if mode == "PREEMPTION_CLEARING":
                lines.append(f"Current Phase     : CLEARING CONFLICTING APPROACH")
                lines.append(f"Transition        : {curr_disp} -> {curr_phase} (Remaining: {remaining:.1f}s)")
            elif mode == "EMERGENCY_HOLD":
                lines.append(f"Current Phase     : EMERGENCY GREEN CORRIDOR ENGAGED 🚑")
                lines.append(f"Corridor Hold     : {emb_disp} (GREEN for at least {remaining:.1f}s)")
            elif mode == "RECOVERY":
                lines.append(f"Current Phase     : RECOVERY CLEARANCE (Ambulance Departed)")
                lines.append(f"Transition        : {curr_disp} -> {curr_phase} (Remaining: {remaining:.1f}s)")
            lines.append("")

        else:
            # Normal Mode Display
            lines.append("CURRENT SIGNAL:")
            lines.append(f"{curr_disp} ({curr_meta['approach']})")
            lines.append("")
            lines.append(f"{curr_phase}")
            lines.append(f"Remaining: {remaining:.1f}s")
            lines.append("")

        lines.append("Approach Status:")
        for cam_id, meta in self.camera_approaches.items():
            sig = signals.get(cam_id, "RED")
            note = ""
            if sig == "GREEN" and mode == "EMERGENCY_HOLD" and cam_id == signal_status.get("emergency_approach"):
                note = " 🚑 [EMERGENCY CORRIDOR]"
            elif sig == "YELLOW" and mode == "PREEMPTION_CLEARING":
                note = " [CLEARING CONFLICT]"
            lines.append(f"  {meta['display']} ({meta['approach']:14s}) : {sig}{note}")

        lines.append("")
        lines.append(f"Cycles Completed: {cycles} | Sequence: CAM01 -> CAM02 -> CAM03 -> CAM04 -> repeat")
        lines.append("=" * 68)

        # Print all lines
        dashboard_output = "\n".join(lines)
        # Clear screen and print cleanly
        if sys.platform == "win32":
            os.system("cls")
        else:
            sys.stdout.write("\033[H\033[J")
        print(dashboard_output)

    def _cleanup(self):
        """Release OpenCV video capture handles."""
        print("[TrafficIQ] Cleaning up video handles...")
        for cam_id, cam in self.cameras.items():
            cap = cam.get("cap")
            if cap and cap.isOpened():
                cap.release()
        print("[TrafficIQ] Done.")


def main():
    parser = argparse.ArgumentParser(description="TrafficIQ Terminal 4-Camera Traffic Simulation")
    parser.add_argument(
        "--situation",
        "-s",
        choices=["normal", "ambulance"],
        default="normal",
        help="Select video scenario: 'normal' (standard CCTV) or 'ambulance' (emergency vehicle on CAM03)",
    )
    parser.add_argument(
        "--weights",
        "-w",
        default=None,
        help="YOLO model weights path (default: yolov8n.pt or weights/best.pt)",
    )
    parser.add_argument(
        "--device",
        "-d",
        default=None,
        help="Inference device: '0' for GPU or 'cpu' (default: auto-detect GPU)",
    )
    parser.add_argument(
        "--conf",
        "-c",
        type=float,
        default=0.25,
        help="YOLO detection confidence threshold (default: 0.25)",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Inference image resolution (default: 640)",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=None,
        help="Max simulation duration in seconds (default: infinite until Ctrl+C)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=0.5,
        help="Terminal display refresh interval in seconds (default: 0.5s)",
    )
    args = parser.parse_args()

    runner = TrafficIQTerminalRunner(
        situation=args.situation,
        weights=args.weights,
        device=args.device,
        conf_threshold=args.conf,
        imgsz=args.imgsz,
        display_interval=args.interval,
    )
    runner.run(max_duration=args.duration)


if __name__ == "__main__":
    main()
