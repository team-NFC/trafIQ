"""
TrafficIQ - USB / Android Phone Camera Test & Live Object Detection Tool
-------------------------------------------------------------------------
Captures live stream from USB / Android phone webcam using OpenCV
and runs real-time YOLO detection.

Supports:
  1. Traffic Vehicles (default): car, motorcycle, bus, truck, ambulance
  2. All Objects (--all): detects any room object (person, phone, laptop, bottle, etc.)

Usage:
    python tools/test_usb_camera.py --index 1
    python tools/test_usb_camera.py --index 1 --all            (Detect everything in your room)
    python tools/test_usb_camera.py --index 1 --conf 0.20
    python tools/test_usb_camera.py --index 1 --model weights/best.pt
    python tools/test_usb_camera.py --scan                     (List available cameras)
"""

import cv2
import argparse
import sys
import time
from pathlib import Path
from ultralytics import YOLO

# TrafficIQ target vehicle classes
TRAFFIC_CLASSES = {
    0: "car",
    1: "motorcycle",
    2: "bus",
    3: "truck",
    4: "ambulance"
}

# COCO vehicle class IDs: 2=car, 3=motorcycle, 5=bus, 7=truck
COCO_VEHICLE_MAP = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck"
}

CLASS_COLORS = {
    "car": (255, 144, 30),        # Blue/Cyan
    "motorcycle": (0, 215, 255),  # Yellow
    "bus": (255, 0, 255),         # Magenta
    "truck": (0, 165, 255),       # Orange
    "ambulance": (0, 0, 255),     # Bright Red
}


def scan_available_cameras(max_indices=6):
    """Probes camera indices 0 through max_indices-1 and returns list of working indices."""
    available = []
    print("\nScanning available camera indices (0 to {})...".format(max_indices - 1))
    for idx in range(max_indices):
        cap = cv2.VideoCapture(idx)
        if not cap.isOpened():
            cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        if cap.isOpened():
            ret, _ = cap.read()
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()
            if ret:
                print(f"  [+] Camera index {idx}: AVAILABLE (Resolution: {w}x{h})")
                available.append((idx, w, h))
            else:
                print(f"  [?] Camera index {idx}: Opened but could not read frame")
        else:
            print(f"  [-] Camera index {idx}: Not available")
    return available


def test_camera(
    camera_index=0,
    model_path="yolov8n.pt",
    conf_threshold=0.25,
    enable_detection=True,
    detect_all=False,
    device="0",
    target_width=None,
    target_height=None
):
    """
    Opens camera stream and runs live YOLO detection.
    """
    print("=" * 65)
    print(f"  TrafficIQ: Connecting to Camera Index [{camera_index}]")
    print("=" * 65)

    # Initialize OpenCV VideoCapture (try default first, fallback to DirectShow on Windows)
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)

    if target_width and target_height:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, target_width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, target_height)

    if not cap.isOpened():
        print(f"\n[ERROR] Failed to open camera at index {camera_index}!")
        print("\nTroubleshooting tips:")
        print("  1. Run: python tools/test_usb_camera.py --scan")
        print("  2. Check Windows Camera Privacy: Settings -> Privacy & Security -> Camera -> ON.")
        print("  3. Make sure Iriun Webcam is running on both phone and laptop.")
        return False

    ret, frame = cap.read()
    if not ret or frame is None:
        print(f"\n[ERROR] Camera at index {camera_index} opened, but failed to retrieve frame.")
        cap.release()
        return False

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    print("\nCamera connected successfully!")
    print(f"Resolution: {width}x{height}")

    # Load YOLO Model
    yolo_model = None
    is_custom_model = False

    if enable_detection:
        resolved_model = Path(model_path)
        if not resolved_model.exists():
            # Fallback checks
            for alt in [Path("yolov8n.pt"), Path("weights/best.pt"), Path("weights/yolo26n.pt")]:
                if alt.exists():
                    resolved_model = alt
                    break

        if resolved_model.exists():
            try:
                # Graceful device auto-detection: check if CUDA is actually available
                if device == "0":
                    try:
                        import torch
                        if not torch.cuda.is_available():
                            print("[YOLO Notice] CUDA GPU was requested/defaulted, but torch.cuda.is_available() is False.")
                            print("             (Tip: run with '.\\venv\\Scripts\\python.exe' to use your RTX 3050 GPU)")
                            print("             Falling back to CPU for inference.")
                            device = "cpu"
                    except Exception:
                        device = "cpu"

                print(f"[YOLO] Loading model: {resolved_model}")
                yolo_model = YOLO(str(resolved_model))
                model_names = yolo_model.names
                is_custom_model = (
                    len(model_names) == 5
                    and model_names.get(0) == "car"
                    and model_names.get(4) == "ambulance"
                )
                mode_str = "ALL ROOM OBJECTS" if detect_all else ("5-CLASS VEHICLES" if is_custom_model else "TRAFFIC VEHICLES")
                print(f"[YOLO] Mode: {mode_str} | Confidence Threshold: {conf_threshold}")
                print(f"[YOLO] Device: {'CUDA GPU' if device == '0' else 'CPU'}")
            except Exception as e:
                print(f"[YOLO Warning] Failed to load model: {e}. Running raw feed.")
                yolo_model = None
        else:
            print(f"[YOLO Notice] Model weights not found. Running in raw video mode.")

    print("\nStarting live view... Press 'Q' to quit.\n")

    window_name = f"TrafficIQ - Live Camera [Index {camera_index}] - Press 'Q' to Quit"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, min(1280, width), min(720, height))

    frame_count = 0
    start_time = time.time()
    fps = 0.0

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                time.sleep(0.01)
                continue

            frame_count += 1
            elapsed = time.time() - start_time
            if elapsed >= 1.0:
                fps = frame_count / elapsed
                frame_count = 0
                start_time = time.time()

            display_frame = frame.copy()
            overlay_h, overlay_w = display_frame.shape[:2]

            detections_drawn = 0
            has_ambulance = False
            detected_classes_summary = []

            # Run YOLO Detection
            if yolo_model is not None:
                # Run prediction
                results = yolo_model.predict(
                    source=frame,
                    conf=conf_threshold,
                    device=device,
                    verbose=False
                )

                if len(results) > 0 and results[0].boxes is not None:
                    boxes = results[0].boxes
                    for box in boxes:
                        raw_cls = int(box.cls[0].item())
                        conf = float(box.conf[0].item())
                        xyxy = box.xyxy[0].tolist()

                        # Determine class name
                        if is_custom_model:
                            cls_name = TRAFFIC_CLASSES.get(raw_cls, f"cls_{raw_cls}")
                            is_target = True
                        elif detect_all:
                            cls_name = yolo_model.names.get(raw_cls, f"obj_{raw_cls}")
                            is_target = True
                        else:
                            # Filter standard COCO model for traffic vehicles
                            if raw_cls in COCO_VEHICLE_MAP:
                                cls_name = COCO_VEHICLE_MAP[raw_cls]
                                is_target = True
                            else:
                                is_target = False

                        if not is_target:
                            continue

                        detections_drawn += 1
                        detected_classes_summary.append(cls_name)

                        if cls_name == "ambulance":
                            has_ambulance = True

                        x1, y1, x2, y2 = [int(v) for v in xyxy]
                        x1, y1 = max(0, x1), max(0, y1)
                        x2, y2 = min(overlay_w, x2), min(overlay_h, y2)

                        # Color selection
                        color = CLASS_COLORS.get(cls_name, (0, 255, 120))
                        thickness = 3 if cls_name == "ambulance" else 2

                        # Draw bounding box
                        cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, thickness)

                        # Draw label tag
                        label = f"{cls_name.upper()} {conf:.2f}"
                        (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
                        label_y1 = max(0, y1 - lh - 8)
                        cv2.rectangle(display_frame, (x1, label_y1), (x1 + lw + 8, label_y1 + lh + 8), color, -1)
                        cv2.putText(
                            display_frame, label, (x1 + 4, label_y1 + lh + 3),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA
                        )

            # Draw HUD Top Banner
            banner_color = (0, 0, 180) if has_ambulance else (20, 20, 20)
            cv2.rectangle(display_frame, (0, 0), (overlay_w, 45), banner_color, -1)

            if yolo_model is not None:
                if has_ambulance:
                    status_text = f"CAM [{camera_index}] | !! AMBULANCE DETECTED !! | {fps:.1f} FPS"
                elif detections_drawn > 0:
                    # Summarize counts
                    counts_str = ", ".join([f"{k}: {detected_classes_summary.count(k)}" for k in set(detected_classes_summary)])
                    status_text = f"CAM [{camera_index}] | Detected: {detections_drawn} ({counts_str}) | {fps:.1f} FPS"
                else:
                    mode_hint = "All Objects" if detect_all else "Vehicles (car/bike/bus/truck)"
                    status_text = f"CAM [{camera_index}] | Scanning: {mode_hint} | 0 Detected | {fps:.1f} FPS"
            else:
                status_text = f"CAM [{camera_index}] | RAW FEED | {width}x{height} | {fps:.1f} FPS"

            cv2.putText(
                display_frame, status_text, (15, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA
            )

            # Bottom guide banner if no detections
            if yolo_model is not None and detections_drawn == 0:
                cv2.rectangle(display_frame, (0, overlay_h - 35), (overlay_w, overlay_h), (0, 0, 0), -1)
                guide_text = "Point camera at vehicles / screen | Or restart with --all to detect room objects | Press 'Q' to Exit"
                cv2.putText(
                    display_frame, guide_text, (15, overlay_h - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (0, 220, 255), 1, cv2.LINE_AA
                )

            # Show window
            cv2.imshow(window_name, display_frame)

            # Press 'Q' or Esc to quit
            key = cv2.waitKey(1) & 0xFF
            if key in (ord('q'), ord('Q'), 27):
                print("\n[INFO] 'Q' pressed. Exiting live preview.")
                break

    except KeyboardInterrupt:
        print("\n[INFO] Keyboard interrupt detected. Exiting.")
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("[INFO] Camera released and windows closed cleanly.")

    return True


def main():
    parser = argparse.ArgumentParser(description="TrafficIQ USB / Android Camera & Live Detection Tool")
    parser.add_argument(
        "--index", "-i",
        type=int,
        default=1,
        help="Camera device index (default: 1 for Iriun/phone webcam, 0 for laptop webcam)."
    )
    parser.add_argument(
        "--scan", "-s",
        action="store_true",
        help="Scan camera indices 0-5 to find all available cameras."
    )
    parser.add_argument(
        "--model", "-m",
        type=str,
        default="yolov8n.pt",
        help="Path to YOLO model weights (default: yolov8n.pt). Use 'weights/best.pt' for custom model."
    )
    parser.add_argument(
        "--conf", "-c",
        type=float,
        default=0.25,
        help="Detection confidence threshold (default: 0.25)."
    )
    parser.add_argument(
        "--all", "-a",
        action="store_true",
        help="Detect all 80 COCO objects (person, phone, laptop, bottle, etc.) to test detection inside your room."
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Display raw camera feed without running YOLO."
    )
    parser.add_argument(
        "--device", "-d",
        type=str,
        default="0",
        help="Inference device: '0' for CUDA GPU, 'cpu' for CPU (default: '0')."
    )
    parser.add_argument(
        "--width",
        type=int,
        default=None,
        help="Optional target capture width (e.g. 1920 or 1280)"
    )
    parser.add_argument(
        "--height",
        type=int,
        default=None,
        help="Optional target capture height (e.g. 1080 or 720)"
    )

    args = parser.parse_args()

    if args.scan:
        cameras = scan_available_cameras()
        if not cameras:
            print("\n[!] No active camera found on indices 0 to 5.")
            print("    Check: 1) Windows Camera Privacy is ON.")
            print("           2) Iriun Webcam is running on both phone and PC.")
        else:
            print(f"\nFound {len(cameras)} active camera(s).")
            print(f"Run live detection using: python tools/test_usb_camera.py --index {cameras[0][0]}")
        sys.exit(0)

    success = test_camera(
        camera_index=args.index,
        model_path=args.model,
        conf_threshold=args.conf,
        enable_detection=not args.raw,
        detect_all=args.all,
        device=args.device,
        target_width=args.width,
        target_height=args.height
    )

    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
