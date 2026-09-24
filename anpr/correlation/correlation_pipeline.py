"""
TrafficIQ - Independent ANPR Module
Module: correlation_pipeline.py

End-to-End CLI Runner for City-Wide Multi-Camera Vehicle Correlation:
1. Dynamically reads any number of configured cameras (CAM01-CAM05 and beyond).
2. Performs strict video existence pre-flight checks on every camera before processing.
3. Enforces Stale Output Protection: skips missing cameras and never loads old cached data for missing videos.
4. Executes ANPR processing on active videos or consumes valid cached JSONs.
5. Ingests foreign/unrelated footage (e.g. CAM05) as single-camera observations without error.
6. Reconstructs multi-camera journeys and computes hop-by-hop travel intervals.
7. Exports city-wide journey deliverables to JSON and CSV.
8. Displays clean, formatted terminal journey diagrams.

Usage:
    python anpr/correlation/correlation_pipeline.py
    python anpr/correlation/correlation_pipeline.py --plate TN38AB1234
    python anpr/correlation/correlation_pipeline.py --reprocess --device 0
"""

import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Optional, Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from anpr.correlation.vehicle_correlator import VehicleCorrelator
from anpr.anpr_pipeline import ANPRPipeline


def find_camera_video(video_dir: Path, camera_id: str, configured_name: Optional[str] = None) -> Optional[Path]:
    """
    Resolves the video file path for a given camera.
    Prioritizes configured_name, then standard filename conventions.
    """
    cam_lower = camera_id.lower()
    cam_num = "".join([c for c in cam_lower if c.isdigit()])

    candidates = []
    if configured_name:
        candidates.append(configured_name)
    candidates.extend([
        f"{cam_lower}.mp4",
        f"camera_{int(cam_num):02d}.mp4" if cam_num else None,
        f"camera_{int(cam_num)}.mp4" if cam_num else None,
        f"cam_{int(cam_num):02d}.mp4" if cam_num else None,
        f"cam{int(cam_num):02d}.mp4" if cam_num else None,
        f"{cam_lower}.avi",
    ])
    candidates = [c for c in candidates if c]

    # Check strictly within video_dir
    for cand in candidates:
        p = video_dir / cand
        if p.exists():
            return p
        # Direct absolute path if provided
        direct = Path(cand)
        if direct.is_absolute() and direct.exists():
            return direct

    return None


def run_correlation_pipeline(
    config_path: Path,
    video_dir: Path,
    output_dir: Path,
    reprocess: bool = False,
    selected_plate: Optional[str] = None,
    device: str = "0",
    imgsz: int = 1280,
    max_frames_per_camera: Optional[int] = None,
):
    """Orchestrates multi-camera ANPR processing and correlation dynamically."""
    print("=" * 68)
    print("TRAFFICIQ CITY-WIDE ANPR CORRELATION")
    print("=" * 68)
    print(f"Camera Config : {config_path}")
    print(f"Video Dir     : {video_dir}")
    print(f"Output Dir    : {output_dir}")
    print(f"Cache Mode    : {'FORCE REPROCESS' if reprocess else 'USE CACHED JSON IF VIDEO EXISTS'}")
    print("=" * 68)

    if not config_path.exists():
        raise FileNotFoundError(f"Camera configuration file not found: {config_path}")

    with open(config_path, "r", encoding="utf-8") as f:
        config_data = json.load(f)

    cameras_meta = config_data.get("cameras", config_data)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Correlator instance dynamically populated only with active cameras
    correlator = VehicleCorrelator()

    # 1. Pre-flight check & process each configured camera dynamically
    for cam_id, details in cameras_meta.items():
        norm_cam = cam_id.lower()
        cam_display = cam_id.upper().replace("_", "")
        configured_video_name = details.get("video", f"{norm_cam}.mp4")
        video_path = find_camera_video(video_dir, norm_cam, configured_name=details.get("video"))

        print(f"\n{cam_display}")
        print(f"Video: {video_path if video_path else configured_video_name}")

        # Strict camera availability check
        if not video_path or not video_path.exists():
            print("Exists: FALSE")
            print(f"{cam_display} Video not found - SKIPPING")
            # STALE OUTPUT PROTECTION: Do NOT load old cached JSON for missing camera!
            continue

        print("Exists: TRUE")
        if norm_cam == "camera_05" or "foreign" in details.get("location", "").lower() or "additional" in details.get("location", "").lower():
            print("Foreign/unrelated footage accepted.")

        # Register active camera metadata in correlator
        correlator.camera_config[norm_cam] = {
            "location": details.get("location", f"Location {cam_display}"),
            "start_time": details.get("start_time", "08:00:00"),
            "coordinates": details.get("coordinates", [13.0827, 80.2707]),
        }

        json_cached = output_dir / f"{norm_cam}_anpr_results.json"
        results_payload = None

        if not reprocess and json_cached.exists():
            print(f"Using cached ANPR results: {json_cached.name}")
            with open(json_cached, "r", encoding="utf-8") as f:
                results_payload = json.load(f)
        else:
            print("Processing video with ANPR pipeline...")
            pipeline = ANPRPipeline(
                video_path=video_path,
                output_video_path=output_dir / f"{norm_cam}_anpr_result.mp4",
                device=device,
                imgsz=imgsz,
            )
            pipeline.run(max_frames=max_frames_per_camera, show=False, auto_play=False)
            if json_cached.exists():
                with open(json_cached, "r", encoding="utf-8") as f:
                    results_payload = json.load(f)

        if results_payload:
            num_conf = len(results_payload.get("confirmed_vehicles", []))
            print(f"-> Loaded {num_conf} vehicle observations for {cam_display}")
            correlator.add_camera_anpr_results(norm_cam, results_payload)

    # 2. Run correlation engine across all verified cameras
    print("\n" + "=" * 68)
    print("CORRELATION RESULT")
    print("=" * 68)
    correlator.correlate()

    # 3. Export JSON and CSV deliverables
    json_out = output_dir / "citywide_correlation.json"
    csv_out = output_dir / "citywide_correlation.csv"

    correlator.export_json(json_out)
    correlator.export_csv(csv_out)

    print(f"\n[EXPORTS COMPLETED]")
    print(f"  * JSON Journey Data : {json_out.resolve()}")
    print(f"  * CSV Hop Data      : {csv_out.resolve()}")

    # 4. Print ASCII Journey Diagrams
    report_text = correlator.format_ascii_journey(vehicle_plate=selected_plate)
    print("\n" + report_text)


def main():
    parser = argparse.ArgumentParser(description="TrafficIQ City-Wide Multi-Camera Vehicle Correlation Pipeline")
    parser.add_argument(
        "--config",
        default=str(PROJECT_ROOT / "anpr" / "correlation" / "camera_config.json"),
        help="Path to camera_config.json",
    )
    parser.add_argument(
        "--video-dir",
        default=str(PROJECT_ROOT / "anpr" / "videos"),
        help="Directory containing camera videos (camera_01.mp4, etc.)",
    )
    parser.add_argument(
        "--output-dir",
        default=str(PROJECT_ROOT / "anpr" / "output"),
        help="Directory for output correlation files",
    )
    parser.add_argument(
        "--reprocess",
        action="store_true",
        help="Force re-running ANPR on camera videos even if cached JSON exists",
    )
    parser.add_argument(
        "--plate",
        default=None,
        help="Filter and display journey for a specific vehicle license plate",
    )
    parser.add_argument(
        "--device",
        default="0",
        help="Inference compute device ('0' for CUDA GPU, 'cpu' for CPU)",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=1280,
        help="Inference image resolution",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=None,
        help="Optional frame limit per video (useful for rapid testing)",
    )
    args = parser.parse_args()

    run_correlation_pipeline(
        config_path=Path(args.config),
        video_dir=Path(args.video_dir),
        output_dir=Path(args.output_dir),
        reprocess=args.reprocess,
        selected_plate=args.plate,
        device=args.device,
        imgsz=args.imgsz,
        max_frames_per_camera=args.max_frames,
    )


if __name__ == "__main__":
    main()
