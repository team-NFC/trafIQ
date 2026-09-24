"""
TrafficIQ - Situation 1: Normal CCTV Intersection Pipeline Runner
Processes 4 camera feeds with NO ambulance under standard fixed-cycle signal control.
Loads videos automatically from situations/normal_situation/videos/ or situations/normal_situation/.
"""

import sys
import argparse
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.run_multi_camera import IntersectionProcessor
from situations.utils import get_situation_camera_sources


def main():
    parser = argparse.ArgumentParser(description="TrafficIQ Situation 1 (Normal Signal) CCTV Pipeline")
    parser.add_argument("--cam01", default=None, help="Path to Camera 01 video")
    parser.add_argument("--cam02", default=None, help="Path to Camera 02 video")
    parser.add_argument("--cam03", default=None, help="Path to Camera 03 video")
    parser.add_argument("--cam04", default=None, help="Path to Camera 04 video")
    parser.add_argument("--weights", default=str(PROJECT_ROOT / "yolov8n.pt"), help="YOLOv8 weights path")
    parser.add_argument("--conf", type=float, default=0.25, help="Detection confidence threshold")
    parser.add_argument("--device", default="0", help="Inference device ('0' for GPU or 'cpu')")
    parser.add_argument("--output", default=str(PROJECT_ROOT / "runs" / "output_normal_situation.mp4"), help="Output video path")
    parser.add_argument("--signal-config", default=str(PROJECT_ROOT / "config" / "signal_config.json"), help="Signal config JSON path")
    parser.add_argument("--imgsz", type=int, default=1280, help="Inference image resolution")
    parser.add_argument("--max-frames", type=int, default=None, help="Optional max frames to process")
    parser.add_argument("--no-show", action="store_true", help="Disable live OpenCV display window")
    args = parser.parse_args()

    situation_dir = PROJECT_ROOT / "situations" / "normal_situation"
    sources = get_situation_camera_sources(situation_dir)

    # Allow explicit CLI overrides
    if args.cam01:
        sources["camera_01"] = args.cam01
    if args.cam02:
        sources["camera_02"] = args.cam02
    if args.cam03:
        sources["camera_03"] = args.cam03
    if args.cam04:
        sources["camera_04"] = args.cam04

    # Remap keys to uppercase for IntersectionProcessor
    sources_mapped = {k.upper(): v for k, v in sources.items()}

    print("=" * 68)
    print("TRAFFICIQ - SITUATION 1: NORMAL TRAFFIC SIGNAL OPERATION")
    print("Fixed Sequence: CAM01 -> CAM02 -> CAM03 -> CAM04 -> repeat")
    print(f"Output Video  : {args.output}")
    print(f"Sources       : {sources_mapped}")
    print("=" * 68)

    processor = IntersectionProcessor(
        camera_sources=sources_mapped,
        model_path=args.weights,
        conf_threshold=args.conf,
        device=args.device,
        output_path=args.output,
        signal_config_path=args.signal_config,
        imgsz=args.imgsz,
    )

    processor.run(max_frames=args.max_frames, show=not args.no_show)


if __name__ == "__main__":
    main()
