"""
TrafficIQ - Phase 2 Video Inference Pipeline
Executes perspective-aware Traffic Detection Zone filtering + YOLO vehicle detection + 
ByteTrack tracking + deduplicated vehicle counting + emergency ambulance priority alert + 
HUD telemetry video rendering.

Usage:
    python scripts/run_traffic_video.py --source data/videos/camera_01.mp4 --camera 1
    python scripts/run_traffic_video.py --source data/videos/camera_03.mp4 --camera 3 --output runs/output_cam3.mp4
"""

import argparse
import sys
import time
from pathlib import Path
from typing import Optional
import cv2
import torch

PROJECT_ROOT = Path(__file__).parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from traffic.roi import ROIZone, normalize_camera_id
from traffic.detection import VehicleDetector
from traffic.tracking import VehicleTracker
from traffic.counting import TrafficCounter
from traffic.analytics import TrafficAnalytics


def find_default_model() -> Path:
    """
    Finds model weights for inference.
    Defaults to yolov8n.pt (with automatic 5-class TrafficIQ mapping) for robust 
    real-world outdoor vehicle detection.
    """
    candidates = [
        PROJECT_ROOT / "yolov8n.pt",
        PROJECT_ROOT / "weights" / "best.pt",
        PROJECT_ROOT / "runs" / "traffic_custom_train" / "weights" / "best.pt",
    ]
    for p in candidates:
        if p.exists():
            return p
    return PROJECT_ROOT / "yolov8n.pt"


def resolve_video_path(source_str: str) -> Path:
    """Resolves video path from direct path or inside data/videos/."""
    src = Path(source_str)
    if src.exists():
        return src
    alt = PROJECT_ROOT / "data" / "videos" / src.name
    if alt.exists():
        return alt
    return src


def run_pipeline():
    parser = argparse.ArgumentParser(description="TrafficIQ Phase 2 ROI-Based Traffic Inference Pipeline")
    parser.add_argument(
        "--source",
        type=str,
        required=True,
        help="Path to input video file (e.g. data/videos/camera_01.mp4 or Downloads/cam1.mp4)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Path to YOLO model weights (.pt). Defaults to weights/best.pt if found, else yolov8n.pt",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="Detection confidence threshold (default: 0.25, lower to 0.20 to catch more distant vehicles)",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=1280,
        help="Inference image resolution (default: 1280 for sharp distant vehicle coverage, or 640)",
    )
    parser.add_argument(
        "--camera",
        type=str,
        default="1",
        help="Camera ID or number: 1, 2, 3, 4 (automatically resolves to camera_01, camera_02, etc.)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Path to save annotated output video (default: runs/output_{camera}.mp4)",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="0",
        help="Device to run inference on: '0' for CUDA GPU, 'cpu' for CPU (default: 0)",
    )
    parser.add_argument(
        "--show",
        action="store_true",
        help="Display live video window during processing (requires GUI)",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=None,
        help="Process only first N frames (useful for rapid testing)",
    )
    parser.add_argument(
        "--point-type",
        type=str,
        default="bottom_center",
        choices=["bottom_center", "center"],
        help="Point used for road contact ROI test (default: bottom_center)",
    )

    args = parser.parse_args()

    # 1. Resolve Camera ID
    camera_id = normalize_camera_id(args.camera)

    print("=" * 65)
    print(f"      TrafficIQ — ROI-Based Traffic Detection Pipeline      ")
    print(f"               Camera: {camera_id.upper()}               ")
    print("=" * 65)

    # 2. Resolve Video Source
    source_path = resolve_video_path(args.source)
    if not source_path.exists():
        print(f"[ERROR] Video source not found: {source_path.resolve()}")
        print(f"Please place video in data/videos/ or specify full path.")
        sys.exit(1)
    print(f"[Video Source] : {source_path.resolve()}")

    # 3. Resolve Model Path
    if args.model:
        model_path = Path(args.model)
    else:
        model_path = find_default_model()

    if not model_path.exists():
        print(f"[ERROR] Model weights not found: {model_path}")
        sys.exit(1)
    print(f"[Model Weights]: {model_path.resolve()}")

    # 4. Device & GPU Check
    use_cuda = (args.device != "cpu") and torch.cuda.is_available()
    device = "0" if use_cuda else "cpu"
    if use_cuda:
        gpu_name = torch.cuda.get_device_name(0)
        vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
        print(f"[Compute Device]: CUDA Active — {gpu_name} ({vram_gb:.2f} GB VRAM)")
    else:
        print("[Compute Device]: CPU Mode")

    # 5. Load Camera ROI Zone
    print(f"[Traffic ROI]  : Loading configuration for '{camera_id}'...")
    try:
        roi = ROIZone(camera_id=camera_id, point_type=args.point_type)
    except FileNotFoundError as e:
        print(e)
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Failed to load ROI configuration: {e}")
        sys.exit(1)

    # 6. Initialize YOLO Detector
    try:
        detector = VehicleDetector(
            model_path=str(model_path),
            conf_threshold=args.conf,
            device=device,
        )
    except Exception as e:
        print(f"[ERROR] Failed to load YOLO detector: {e}")
        sys.exit(1)

    # 7. Initialize Tracker, Counter, and Analytics
    tracker = VehicleTracker(
        model=detector.model,
        roi_zone=roi,
        conf_threshold=args.conf,
        device=device,
        imgsz=args.imgsz,
    )
    counter = TrafficCounter(roi_zone=roi, camera_id=camera_id)
    analytics = TrafficAnalytics(roi=roi, camera_id=camera_id)

    # 8. Open Video Stream
    cap = cv2.VideoCapture(str(source_path))
    if not cap.isOpened():
        print(f"[ERROR] OpenCV could not open video: {source_path}")
        sys.exit(1)

    src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    total_src_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"[Stream Stats] : {src_w}x{src_h} @ {src_fps:.1f} FPS | Total Frames: {total_src_frames}")

    # Scale ROI coordinates to match video resolution
    roi.update_frame_shape(src_h, src_w)

    # 9. Setup Video Writer
    out_path = args.output
    if out_path is None:
        runs_dir = PROJECT_ROOT / "runs"
        runs_dir.mkdir(parents=True, exist_ok=True)
        out_path = str(runs_dir / f"output_{camera_id}.mp4")

    out_file = Path(out_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_file), fourcc, src_fps, (src_w, src_h))
    print(f"[Output Video] : {out_file.resolve()}")
    print("-" * 65)

    # 10. Main Sequential Inference Loop (Low VRAM Footprint)
    frame_idx = 0
    t_start = time.time()
    rolling_fps = 0.0
    fps_alpha = 0.9

    total_ambulance_events = 0

    window_title = f"TrafficIQ Live — {camera_id.upper()}"
    if args.show:
        cv2.namedWindow(window_title, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(window_title, 1280, 720)

    try:
        while True:
            t_frame_start = time.time()
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            if args.max_frames and frame_idx > args.max_frames:
                print(f"\n[INFO] Reached requested max frames limit: {args.max_frames}")
                break

            frame_timestamp = frame_idx / src_fps

            # A. ByteTrack Vehicle Tracking (with bottom-center road contact calculation)
            tracks = tracker.track(frame)

            # B. ROI-Based Vehicle Counting & Deduplication
            metrics = counter.update(tracks, frame_timestamp=frame_timestamp)

            if metrics.get("emergency_vehicle_detected", False):
                total_ambulance_events += len(metrics.get("ambulance_events", []))

            # C. Rolling FPS Calculation
            t_frame_end = time.time()
            instant_fps = 1.0 / max(t_frame_end - t_frame_start, 1e-5)
            rolling_fps = instant_fps if rolling_fps == 0.0 else (fps_alpha * rolling_fps + (1 - fps_alpha) * instant_fps)

            # D. Render Visual Overlays & Telemetry HUD
            annotated_frame = analytics.render_overlay(frame, tracks, metrics, rolling_fps)

            # E. Write to Output Video
            writer.write(annotated_frame)

            # GUI Display (Live video playback)
            if args.show:
                cv2.imshow(window_title, annotated_frame)
                key = cv2.waitKey(1) & 0xFF
                if key in (ord("q"), ord("Q"), 27):
                    print("\n[INFO] Inference stopped by user via live window.")
                    break
                # Handle window close button (X)
                if cv2.getWindowProperty(window_title, cv2.WND_PROP_VISIBLE) < 1:
                    print("\n[INFO] Live window closed by user.")
                    break

            # Console Progress Log
            if frame_idx % 25 == 0 or frame_idx == 1:
                active = metrics.get("active_in_roi", 0)
                unique = metrics.get("total_unique", 0)
                amb_flag = f" [!] AMBULANCE ON {camera_id.upper()}" if metrics.get("emergency_vehicle_detected") else ""
                progress_pct = (frame_idx / total_src_frames * 100) if total_src_frames > 0 else 0
                print(
                    f"Frame [{frame_idx:4d}/{total_src_frames}] ({progress_pct:4.1f}%) | "
                    f"FPS: {rolling_fps:4.1f} | Active in ROI: {active:2d} | Unique Count: {unique:2d}{amb_flag}"
                )

    except KeyboardInterrupt:
        print("\n[INFO] Inference interrupted by user.")
    finally:
        cap.release()
        writer.release()
        if args.show:
            cv2.destroyAllWindows()

    t_total = time.time() - t_start
    avg_fps = frame_idx / max(t_total, 1e-5)

    # 11. Final Summary Report
    final_counts = counter.get_class_counts()

    print("\n" + "=" * 65)
    print(f"        TRAFFICIQ REPORT — {camera_id.upper()}        ")
    print("=" * 65)
    print(f"Total Frames Processed : {frame_idx}")
    print(f"Total Processing Time  : {t_total:.2f} s")
    print(f"Average Processing FPS : {avg_fps:.1f}")
    print(f"Output Video Saved To  : {out_file.resolve()}")
    print("-" * 65)
    print(f"Traffic Detection Zone Counts ({camera_id.upper()}):")
    print(f"  Cars           : {final_counts.get('car', 0)}")
    print(f"  Motorcycles    : {final_counts.get('motorcycle', 0)}")
    print(f"  Buses          : {final_counts.get('bus', 0)}")
    print(f"  Trucks         : {final_counts.get('truck', 0)}")
    print(f"  Auto-Rickshaws : {final_counts.get('auto_rickshaw', 0)}")
    print(f"  Ambulances     : {final_counts.get('ambulance', 0)}")
    print("-" * 65)
    print(f"Total Unique Vehicles  : {len(counter.counted_ids)}")
    print(f"Ambulance Events Seen  : {total_ambulance_events}")
    print("=" * 65)
    return {
        "camera_id": camera_id,
        "frames": frame_idx,
        "avg_fps": avg_fps,
        "output_video": str(out_file.resolve()),
        "counts": final_counts,
        "total_unique": len(counter.counted_ids),
        "ambulance_events": total_ambulance_events,
    }


if __name__ == "__main__":
    run_pipeline()
