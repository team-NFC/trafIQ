"""
TrafficIQ Inference & Evaluation Script
Tests trained YOLO weights (best.pt) on test images/videos and confirms
detection across the 5 vehicle classes (car, motorcycle, bus, truck, ambulance).
"""

import sys
import argparse
from pathlib import Path
import cv2
from ultralytics import YOLO

CLASSES = {
    0: "car",
    1: "motorcycle",
    2: "bus",
    3: "truck",
    4: "ambulance"
}


def run_inference():
    parser = argparse.ArgumentParser(description="Test TrafficIQ Custom Model")
    parser.add_argument(
        "--weights",
        type=str,
        default=str(Path(__file__).parent.parent / "weights" / "best.pt"),
        help="Path to trained weights file (best.pt)",
    )
    parser.add_argument(
        "--source",
        type=str,
        required=True,
        help="Image file, video file, or folder of images to test",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="Confidence threshold",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="0",
        help="Device to use ('0' or 'cpu')",
    )

    args = parser.parse_args()

    weights_path = Path(args.weights)
    if not weights_path.exists():
        print(f"[ERROR] Weights file does not exist: {weights_path}")
        print("Please train the model first using train.py.")
        sys.exit(1)

    print("==================================================")
    print("           TrafficIQ Inference Test               ")
    print("==================================================")
    print(f"Weights : {weights_path}")
    print(f"Source  : {args.source}")
    print(f"Conf    : {args.conf}")
    print("==================================================")

    model = YOLO(str(weights_path))

    project_root = Path(__file__).parent.parent
    save_dir = project_root / "runs" / "predict"

    results = model.predict(
        source=args.source,
        conf=args.conf,
        device=args.device,
        save=True,
        project=str(project_root / "runs"),
        name="predict",
        exist_ok=True,
    )

    # Analyze detection tallies
    detected_classes = {c: 0 for c in CLASSES}
    total_detections = 0
    ambulance_detections = []

    for idx, r in enumerate(results):
        boxes = r.boxes
        if boxes is not None and len(boxes) > 0:
            for box in boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                xyxy = [round(x, 1) for x in box.xyxy[0].tolist()]

                total_detections += 1
                if cls_id in detected_classes:
                    detected_classes[cls_id] += 1

                if cls_id == 4:  # Ambulance
                    ambulance_detections.append((Path(r.path).name, conf, xyxy))

    print("\nDetection Summary across tested items:")
    print(f"Total vehicle detections: {total_detections}")
    for cid, name in CLASSES.items():
        count = detected_classes[cid]
        status = "[DETECTED]" if count > 0 else "[NOT SEEN]"
        print(f"  {status:<12} Class {cid} ({name:<10}): {count:>4} detections")

    if detected_classes[4] > 0:
        print(f"\n[AMBULANCE CONFIRMED] Successfully detected {detected_classes[4]} ambulance instances:")
        for img_name, conf, bbox in ambulance_detections[:5]:
            print(f"  - File: {img_name} | Confidence: {conf:.2f} | BBox: {bbox}")
    else:
        print("\n[NOTE] No ambulances detected in tested source (or source had no ambulances).")

    print(f"\nAnnotated visual predictions saved to:\n  {save_dir.resolve()}")


if __name__ == "__main__":
    run_inference()
