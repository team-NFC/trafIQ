"""
TrafficIQ - CCTV Video Frame Extraction Utility
Samples representative frames from uploaded CCTV footage to expand the training dataset.
"""

import argparse
import json
import sys
from pathlib import Path
import cv2

PROJECT_ROOT = Path(__file__).parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def extract_frames(source_path: str, interval_sec: float = 2.0, max_frames: int = 50, output_dir: str = None):
    src = Path(source_path)
    if not src.exists():
        alt = PROJECT_ROOT / "data" / "videos" / src.name
        if alt.exists():
            src = alt
        else:
            print(f"[ERROR] Source video not found: {src}")
            return []

    if output_dir is None:
        out_path = PROJECT_ROOT / "dataset" / "images" / "candidates"
    else:
        out_path = Path(output_dir)

    out_path.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        print(f"[ERROR] Could not open video: {src}")
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_sec = total_frames / fps

    frame_step = max(1, int(fps * interval_sec))
    print("=" * 60)
    print("       TrafficIQ: CCTV Video Frame Extraction Tool         ")
    print("=" * 60)
    print(f"Source Video   : {src.name} ({total_frames} frames, {duration_sec:.1f}s @ {fps:.1f} fps)")
    print(f"Sampling Rate  : 1 frame every {interval_sec}s (~every {frame_step} frames)")
    print(f"Max Extractions: {max_frames}")
    print(f"Destination    : {out_path.resolve()}")
    print("-" * 60)

    extracted_files = []
    frame_idx = 0
    saved_count = 0

    while saved_count < max_frames:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_step == 0:
            saved_count += 1
            timestamp = frame_idx / fps
            filename = f"{src.stem}_f{frame_idx:06d}_t{timestamp:.1f}s.jpg"
            save_file = out_path / filename
            cv2.imwrite(str(save_file), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
            extracted_files.append({
                "filename": filename,
                "frame_idx": frame_idx,
                "timestamp_sec": round(timestamp, 2),
                "path": str(save_file.resolve()),
            })
            print(f"[{saved_count:2d}/{max_frames}] Extracted: {filename} at {timestamp:.1f}s")

        frame_idx += 1

    cap.release()

    # Save index metadata
    manifest_file = out_path / "manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump({
            "source_video": str(src.name),
            "total_extracted": len(extracted_files),
            "frames": extracted_files,
        }, f, indent=2)

    print("-" * 60)
    print(f"[SUCCESS] Extracted {len(extracted_files)} candidate frames to: {out_path.resolve()}")
    print(f"Manifest written to: {manifest_file.resolve()}")
    print("=" * 60)
    return extracted_files


def main():
    parser = argparse.ArgumentParser(description="Extract candidate training frames from CCTV video")
    parser.add_argument("--source", type=str, required=True, help="Path to video file")
    parser.add_argument("--interval", type=float, default=2.0, help="Interval in seconds between frames (default: 2.0)")
    parser.add_argument("--max-frames", type=int, default=30, help="Maximum number of frames to extract (default: 30)")
    parser.add_argument("--output", type=str, default=None, help="Custom output directory")

    args = parser.parse_args()
    extract_frames(
        source_path=args.source,
        interval_sec=args.interval,
        max_frames=args.max_frames,
        output_dir=args.output,
    )


if __name__ == "__main__":
    main()
