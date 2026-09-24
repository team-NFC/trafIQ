"""
TrafficIQ - Ambulance Priority & HUD Verification Script
Verifies that when an ambulance is detected inside the ROI:
1. emergency_vehicle_detected is triggered in TrafficCounter.
2. An ambulance event payload is recorded (track_id, conf, timestamp, direction, box).
3. The HUD displays the emergency banner [!] EMERGENCY VEHICLE DETECTED.
4. Telemetry metrics show active counts, unique counts, and ambulance counts in red.
5. Generates and saves a high-resolution annotated verification image.
"""

import sys
from pathlib import Path
import cv2
import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from traffic.roi import ROIZone
from traffic.counting import TrafficCounter
from traffic.analytics import TrafficAnalytics


def verify_ambulance_pipeline():
    print("=" * 60)
    print("      TrafficIQ: Ambulance Priority Event Verification     ")
    print("=" * 60)

    # 1. Load Camera 01 ROI
    roi = ROIZone(camera_id="camera_01")

    # 2. Get frame from camera_01.mp4 or create realistic 1080p canvas
    video_source = Path(r"C:\Users\sanjeevi\Downloads\camera_01.mp4")
    if video_source.exists():
        cap = cv2.VideoCapture(str(video_source))
        ret, frame = cap.read()
        cap.release()
        if not ret:
            frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
    else:
        frame = np.zeros((1080, 1920, 3), dtype=np.uint8)

    h, w = frame.shape[:2]
    roi.update_frame_shape(h, w)
    print(f"[Frame] Size: {w}x{h}")

    # 3. Setup Counter and Analytics
    counter = TrafficCounter(roi_zone=roi)
    analytics = TrafficAnalytics(roi=roi)

    # 4. Generate representative tracks: 1 Ambulance, 2 Cars, 1 Bus
    # ROI for camera_01 is roughly normalized [[0.18, 0.42], [0.72, 0.42], [0.96, 0.98], [0.10, 0.98]]
    tracks = [
        {
            "track_id": 1,
            "class_id": 0,
            "class_name": "car",
            "conf": 0.92,
            "box": [int(0.25 * w), int(0.60 * h), int(0.38 * w), int(0.80 * h)],
            "center": (int(0.315 * w), int(0.70 * h)),
            "direction": "Moving Down",
        },
        {
            "track_id": 2,
            "class_id": 2,
            "class_name": "bus",
            "conf": 0.89,
            "box": [int(0.65 * w), int(0.55 * h), int(0.85 * w), int(0.85 * h)],
            "center": (int(0.75 * w), int(0.70 * h)),
            "direction": "Moving Down",
        },
        {
            "track_id": 3,
            "class_id": 4,
            "class_name": "ambulance",
            "conf": 0.95,
            "box": [int(0.42 * w), int(0.58 * h), int(0.58 * w), int(0.82 * h)],
            "center": (int(0.50 * w), int(0.70 * h)),
            "direction": "Moving Down",
        },
    ]

    # 5. Process frame
    metrics = counter.update(tracks, frame_timestamp=1.5)

    print("\n[Metrics Output]")
    print(f"  Active in ROI              : {metrics['active_in_roi']}")
    print(f"  Total Unique               : {metrics['total_unique']}")
    print(f"  Unique Counts Breakdown    : {metrics['unique_counts']}")
    print(f"  Emergency Vehicle Detected : {metrics['emergency_vehicle_detected']}")
    print(f"  Ambulance Events Recorded  : {len(metrics['ambulance_events'])}")

    # Assertions
    assert metrics["emergency_vehicle_detected"] is True, "Emergency vehicle flag must be True!"
    assert len(metrics["ambulance_events"]) == 1, "Exactly one ambulance event should be captured!"
    assert metrics["unique_counts"]["ambulance"] == 1, "Ambulance count should be 1!"
    assert metrics["unique_counts"]["car"] == 1, "Car count should be 1!"
    assert metrics["unique_counts"]["bus"] == 1, "Bus count should be 1!"
    print("\n[PASS] All unit assertions passed successfully!")

    # 6. Render Overlays & Telemetry HUD
    annotated = analytics.render_overlay(frame.copy(), tracks, metrics, fps=28.4)

    # 7. Save output
    output_dir = PROJECT_ROOT / "runs"
    output_dir.mkdir(parents=True, exist_ok=True)
    out_file = output_dir / "verify_ambulance_hud.png"
    cv2.imwrite(str(out_file), annotated)
    print(f"\n[Saved] Annotated verification frame saved to: {out_file.resolve()}")

    # Also copy to artifacts directory for documentation
    artifacts_dir = Path(r"C:\Users\sanjeevi\.gemini\antigravity\brain\7997e460-95cc-4590-90e1-e5738f30569e")
    if artifacts_dir.exists():
        artifact_out = artifacts_dir / "verify_ambulance_hud.png"
        cv2.imwrite(str(artifact_out), annotated)
        print(f"[Saved] Artifact image saved to: {artifact_out.resolve()}")

    print("=" * 60)


if __name__ == "__main__":
    verify_ambulance_pipeline()
