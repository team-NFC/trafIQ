"""
TrafficIQ - Adaptive Traffic Signal Timing Analysis
Processes real CCTV videos for Normal and Ambulance situations using:
- YOLOv8 (Vehicle detection)
- ByteTrack (Multi-object tracking)
- ROIZone (Geometric road detection zone)
- TrafficCounter (Unique vehicle counting and ambulance detection)
- Adaptive Signal Timing (Proportional demand-based green time calculation & EVP)
"""

import sys
import time
from pathlib import Path
from typing import Dict, Any, List

import cv2
import torch
from ultralytics import YOLO

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from traffic.roi import ROIZone
from traffic.tracking import VehicleTracker
from traffic.counting import TrafficCounter


def calculate_adaptive_timing(
    camera_counts: Dict[str, Dict[str, Any]],
    cycle_time: float = 90.0,
    min_green: float = 10.0,
    max_green: float = 40.0,
    yellow_time: float = 3.0,
    all_red_time: float = 2.0,
) -> Dict[str, Any]:
    """
    Computes adaptive signal green time based on real traffic counts.
    Combines sub-cameras (CAM-02.1 + CAM-02.2) into logical approach CAM-02.
    """
    pcu_weights = {
        "car": 1.0,
        "motorcycle": 0.5,
        "bus": 2.5,
        "truck": 2.0,
        "ambulance": 1.0,
    }

    # Group sub-cameras into logical signal approaches (e.g. CAM-02.1 & CAM-02.2 -> CAM-02)
    approach_groups: Dict[str, List[str]] = {}
    for cam_id in camera_counts.keys():
        if cam_id.startswith("camera_02") or cam_id.startswith("CAM-02"):
            approach_groups.setdefault("CAM-02", []).append(cam_id)
        elif cam_id.startswith("camera_01") or cam_id.startswith("CAM-01"):
            approach_groups.setdefault("CAM-01", []).append(cam_id)
        elif cam_id.startswith("camera_03") or cam_id.startswith("CAM-03"):
            approach_groups.setdefault("CAM-03", []).append(cam_id)
        elif cam_id.startswith("camera_04") or cam_id.startswith("CAM-04"):
            approach_groups.setdefault("CAM-04", []).append(cam_id)
        else:
            approach_groups.setdefault(cam_id, []).append(cam_id)

    num_approaches = len(approach_groups)
    lost_time = num_approaches * (yellow_time + all_red_time)
    effective_green_pool = max(min_green * num_approaches, cycle_time - lost_time)

    # Calculate PCU demand per logical approach
    group_demands: Dict[str, float] = {}
    group_vehicles: Dict[str, int] = {}
    group_names: Dict[str, str] = {}
    ambulance_approaches: List[str] = []

    for group_id, member_ids in approach_groups.items():
        grp_pcu = 0.0
        grp_v = 0
        has_amb = False
        names = []
        for cid in member_ids:
            data = camera_counts[cid]
            counts = data["class_counts"]
            pcu = sum(counts.get(cls_name, 0) * weight for cls_name, weight in pcu_weights.items())
            grp_pcu += pcu
            grp_v += data["total_unique"]
            names.append(data["approach"])
            if counts.get("ambulance", 0) > 0 or data.get("emergency_detected", False):
                has_amb = True

        group_demands[group_id] = grp_pcu
        group_vehicles[group_id] = grp_v
        group_names[group_id] = " / ".join(set(names))
        if has_amb:
            ambulance_approaches.append(group_id)

    total_demand = sum(group_demands.values())
    timing_plan: Dict[str, Dict[str, Any]] = {}

    for group_id in approach_groups.keys():
        demand = group_demands[group_id]
        if total_demand > 0:
            raw_green = (demand / total_demand) * effective_green_pool
        else:
            raw_green = effective_green_pool / num_approaches

        allocated_green = round(max(min_green, min(max_green, raw_green)), 1)
        is_emergency = group_id in ambulance_approaches

        timing_plan[group_id] = {
            "name": group_id,
            "approach_name": group_names[group_id],
            "total_vehicles": group_vehicles[group_id],
            "demand_pcu": round(demand, 1),
            "allocated_green_seconds": allocated_green,
            "emergency_override": is_emergency,
            "signal_status": "EMERGENCY_PRIORITY_GREEN" if is_emergency else "ADAPTIVE_GREEN",
        }

    return {
        "cycle_time": cycle_time,
        "effective_green_pool": effective_green_pool,
        "total_demand_pcu": round(total_demand, 1),
        "ambulance_active": len(ambulance_approaches) > 0,
        "ambulance_approaches": ambulance_approaches,
        "approaches": timing_plan,
    }


def process_scenario(
    scenario_name: str,
    video_dir: Path,
    device: str = "0",
    conf_threshold: float = 0.25,
) -> Dict[str, Dict[str, Any]]:
    """Runs YOLO + ByteTrack + TrafficCounter on all cameras (including sub-cameras CAM-02.1 & CAM-02.2)."""
    weights_path = PROJECT_ROOT / "yolov8n.pt"
    if not weights_path.is_file():
        weights_path = PROJECT_ROOT / "weights" / "best.pt"

    raw_configs = [
        ("camera_01", "CAM-01", "North Approach"),
        ("camera_02.1", "CAM-02.1", "East Approach (Near Section)"),
        ("camera_02.2", "CAM-02.2", "East Approach (Far Section)"),
        ("camera_02", "CAM-02", "East Approach"),
        ("camera_03", "CAM-03", "South Approach"),
        ("camera_04", "CAM-04", "West Approach"),
    ]

    camera_configs = []
    seen = set()
    for fname, disp, appr in raw_configs:
        vfile = video_dir / f"{fname}.mp4"
        if vfile.is_file():
            if fname == "camera_02" and ("camera_02.1" in seen or "camera_02.2" in seen):
                continue
            camera_configs.append((fname, disp, appr))
            seen.add(fname)

    scenario_results: Dict[str, Dict[str, Any]] = {}

    print(f"\n{'='*70}")
    print(f"PROCESSING SCENARIO: {scenario_name.upper()}")
    print(f"Video Source Directory: {video_dir}")
    print(f"{'='*70}")

    for cam_id, display_name, approach in camera_configs:
        video_file = video_dir / f"{cam_id}.mp4"
        if not video_file.is_file():
            print(f"[ERROR] Missing video file: {video_file}")
            continue

        cap = cv2.VideoCapture(str(video_file))
        if not cap.isOpened():
            print(f"[ERROR] Failed to open video: {video_file}")
            continue

        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 24.0

        roi = ROIZone(camera_id=cam_id, point_type="bottom_center")
        roi.update_frame_shape(h, w)

        tracker = VehicleTracker(
            model=weights_path,
            roi_zone=roi,
            conf_threshold=conf_threshold,
            device=device,
            imgsz=640,
        )
        counter = TrafficCounter(roi_zone=roi, camera_id=cam_id)

        t0 = time.time()
        frame_idx = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            timestamp = frame_idx / fps
            tracks = tracker.track(frame)
            counter.update(tracks, frame_timestamp=timestamp)
            frame_idx += 1

        cap.release()
        elapsed = time.time() - t0

        class_counts = counter.get_class_counts()
        total_unique = len(counter.counted_ids)

        scenario_results[cam_id] = {
            "display_name": display_name,
            "approach": approach,
            "total_unique": total_unique,
            "class_counts": class_counts,
            "emergency_detected": counter.emergency_vehicle_detected,
            "frames_processed": frame_idx,
            "fps_speed": round(frame_idx / max(0.001, elapsed), 1),
        }

        print(f"[{display_name}] {approach}: Processed {frame_idx}/{total_frames} frames ({scenario_results[cam_id]['fps_speed']} FPS)")

    return scenario_results


def print_formatted_report(
    scenario_name: str,
    scenario_results: Dict[str, Dict[str, Any]],
    timing_plan: Dict[str, Any],
):
    """Outputs report per camera (including sub-cameras CAM-02.1 & CAM-02.2) and adaptive signal timing."""
    print(f"\n====================================================================")
    print(f"  TRAFFICIQ REPORT: {scenario_name.upper()}")
    print(f"====================================================================")

    sub_cams_02 = [cid for cid in scenario_results.keys() if "camera_02" in cid or "CAM-02" in cid]
    tot_02_v = sum(scenario_results[cid]["total_unique"] for cid in sub_cams_02) if sub_cams_02 else 0

    for cam_id, data in scenario_results.items():
        disp = data["display_name"]
        approach = data["approach"]
        counts = data["class_counts"]
        cars = counts.get("car", 0)
        motorcycles = counts.get("motorcycle", 0)
        buses = counts.get("bus", 0)
        trucks = counts.get("truck", 0)
        ambulances = counts.get("ambulance", 0)
        total = data["total_unique"]

        print(f"\n{disp} ({approach})")
        print(f"Cars: {cars}")
        print(f"Motorcycles: {motorcycles}")
        print(f"Buses: {buses}")
        print(f"Trucks: {trucks}")
        print(f"Ambulances: {ambulances}")
        print(f"Total vehicles: {total}")

    if len(sub_cams_02) > 1:
        cam02_pcu = timing_plan["approaches"].get("CAM-02", {}).get("demand_pcu", 0.0)
        print(f"\nCAM-02 COMBINED (East Approach - Total)")
        print(f"Combined Vehicles: {tot_02_v}")
        print(f"Combined PCU Demand: {cam02_pcu} PCU")

    print(f"\n--------------------------------------------------------------------")
    print(f"  ADAPTIVE SIGNAL TIMING CALCULATION ({scenario_name.upper()})")
    print(f"--------------------------------------------------------------------")
    print(f"Base Cycle Time: {timing_plan['cycle_time']}s | Total Demand: {timing_plan['total_demand_pcu']} PCU")
    if timing_plan["ambulance_active"]:
        print(f"🚨 EMERGENCY ALERT: Ambulance detected on approach(es): {', '.join(timing_plan['ambulance_approaches'])}")

    print(f"\n{'Camera':<10} {'Approach':<35} {'Vehicles':<10} {'PCU Demand':<12} {'Green Time':<12} {'Status'}")
    print(f"{'-'*90}")
    for group_id, plan in timing_plan["approaches"].items():
        status_str = "🚨 EMERGENCY OVERRIDE" if plan["emergency_override"] else "ADAPTIVE GREEN"
        app_disp = "East Approach (CAM-02.1 + CAM-02.2)" if group_id == "CAM-02" and len(sub_cams_02) > 1 else plan["approach_name"]
        print(
            f"{plan['name']:<10} {app_disp:<35} {plan['total_vehicles']:<10} "
            f"{plan['demand_pcu']:<12} {plan['allocated_green_seconds']}s{'':<7} {status_str}"
        )
    print(f"====================================================================\n")


def main():
    device = "0" if torch.cuda.is_available() else "cpu"
    print(f"[TrafficIQ] Device: {device} ({torch.cuda.get_device_name(0) if device == '0' else 'CPU'})")

    # 1. Normal Traffic Scenario
    normal_dir = PROJECT_ROOT / "situations" / "normal_situation" / "videos"
    normal_results = process_scenario("Normal Traffic Scenario", normal_dir, device=device)
    normal_timing = calculate_adaptive_timing(normal_results)
    print_formatted_report("Normal Traffic Scenario", normal_results, normal_timing)

    # 2. Ambulance Traffic Scenario
    ambulance_dir = PROJECT_ROOT / "situations" / "ambulance_situation" / "videos"
    ambulance_results = process_scenario("Ambulance Traffic Scenario", ambulance_dir, device=device)
    ambulance_timing = calculate_adaptive_timing(ambulance_results)
    print_formatted_report("Ambulance Traffic Scenario", ambulance_results, ambulance_timing)


if __name__ == "__main__":
    main()
