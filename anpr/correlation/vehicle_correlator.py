"""
TrafficIQ - Independent ANPR Module
Module: vehicle_correlator.py

Core engine for City-Wide Multi-Camera Vehicle Correlation:
1. Loads camera detection results from ANPR JSONs.
2. Synchronizes camera start times with video offsets to compute real-world timestamps.
3. Normalizes license plates and resolves OCR character ambiguities across camera feeds.
4. Chronologically reconstructs vehicle travel journeys across city intersections.
5. Calculates hop-by-hop travel durations, detects temporal anomalies, and exports structured JSON/CSV data.
"""

import re
import csv
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Set
from collections import defaultdict

# Reuse existing IndianPlateValidator from ANPR module
import sys
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from anpr.plate_ocr import IndianPlateValidator, DIGIT_TO_CHAR, CHAR_TO_DIGIT, INDIAN_STATE_CODES


def parse_clock_time(time_str: str) -> datetime:
    """Parses 'HH:MM:SS' or 'HH:MM:SS.mmm' into a datetime object on a reference base date."""
    clean = time_str.strip()
    try:
        if "." in clean:
            t = datetime.strptime(clean, "%H:%M:%S.%f")
        else:
            t = datetime.strptime(clean, "%H:%M:%S")
        # Standardize to 2026-01-01 base date for arithmetic
        return datetime(2026, 1, 1, t.hour, t.minute, t.second, t.microsecond)
    except ValueError:
        # Fallback to parts
        parts = [int(p) for p in clean.split(":") if p.isdigit()]
        h = parts[0] if len(parts) > 0 else 0
        m = parts[1] if len(parts) > 1 else 0
        s = parts[2] if len(parts) > 2 else 0
        return datetime(2026, 1, 1, h, m, s)


def parse_video_timestamp_seconds(timestamp_val: Any) -> float:
    """Converts timestamp string like '4.44s', '00:11', or numeric to seconds float."""
    if isinstance(timestamp_val, (int, float)):
        return float(timestamp_val)
    s = str(timestamp_val).strip().lower()
    if s.endswith("s"):
        s = s[:-1]
    if ":" in s:
        parts = s.split(":")
        if len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        elif len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    try:
        return float(s)
    except ValueError:
        return 0.0


def are_ocr_plates_equivalent(plate1: str, plate2: str) -> bool:
    """
    Checks whether two normalized plates represent the same physical vehicle
    by checking exact match or single-character known OCR confusion pair.
    e.g. TN38AB1234 vs TN38AB12B4 (8 <-> B ambiguity).
    """
    s1 = re.sub(r"[^A-Z0-9]", "", plate1.upper())
    s2 = re.sub(r"[^A-Z0-9]", "", plate2.upper())

    if s1 == s2:
        return True

    # Must be same length and reasonably long (>= 6 chars)
    if len(s1) != len(s2) or len(s1) < 6:
        return False

    # Check differences
    diff_indices = [i for i in range(len(s1)) if s1[i] != s2[i]]
    if len(diff_indices) > 2:
        return False

    # Check if differences are known confusion pairs
    EQUIV_PAIRS = {
        ('0', 'O'), ('O', '0'),
        ('0', 'D'), ('D', '0'),
        ('0', 'Q'), ('Q', '0'),
        ('1', 'I'), ('I', '1'),
        ('1', 'L'), ('L', '1'),
        ('2', 'Z'), ('Z', '2'),
        ('3', 'B'), ('B', '3'),
        ('3', '8'), ('8', '3'),
        ('4', 'A'), ('A', '4'),
        ('5', 'S'), ('S', '5'),
        ('6', 'G'), ('G', '6'),
        ('7', 'T'), ('T', '7'),
        ('8', 'B'), ('B', '8'),
    }

    for idx in diff_indices:
        c1, c2 = s1[idx], s2[idx]
        if (c1, c2) not in EQUIV_PAIRS:
            return False

    return True


class VehicleCorrelator:
    """
    Correlates multi-camera ANPR observations to reconstruct vehicle trajectories across city intersections.
    """

    def __init__(self, camera_config: Optional[Dict[str, Any]] = None):
        """
        :param camera_config: Dict mapping camera_id -> {'location': str, 'start_time': str, 'coordinates': [lat, lon]}
        """
        self.camera_config: Dict[str, Dict[str, Any]] = {}
        if camera_config:
            self.load_camera_config(camera_config)
        self.raw_observations: List[Dict[str, Any]] = []

    def load_camera_config(self, config_dict: Dict[str, Any]):
        """Loads and normalizes camera configuration dictionary."""
        cams = config_dict.get("cameras", config_dict)
        for cam_id, details in cams.items():
            norm_id = cam_id.lower()
            self.camera_config[norm_id] = {
                "location": details.get("location", f"Location {cam_id}"),
                "start_time": details.get("start_time", "08:00:00"),
                "coordinates": details.get("coordinates", [13.0827, 80.2707]),
            }

    def load_camera_config_file(self, config_path: Path):
        """Loads camera config from a JSON file."""
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.load_camera_config(data)

    def add_camera_anpr_results(self, camera_id: str, results_payload: Dict[str, Any]):
        """
        Ingests confirmed vehicle detections from a single camera's ANPR JSON output.
        Calculates real-world timestamps for each detection.
        """
        norm_cam_id = camera_id.lower()
        cam_meta = self.camera_config.get(norm_cam_id, {
            "location": f"Camera {camera_id.upper()}",
            "start_time": "08:00:00",
            "coordinates": [13.0827, 80.2707],
        })

        cam_start_dt = parse_clock_time(cam_meta["start_time"])
        confirmed_vehicles = results_payload.get("confirmed_vehicles", [])

        for veh in confirmed_vehicles:
            plate_raw = veh.get("plate_number") or veh.get("normalized_plate") or veh.get("raw_ocr_text", "")
            if not plate_raw:
                continue

            # Run through IndianPlateValidator for standardization
            norm_res = IndianPlateValidator.normalize_and_validate(plate_raw)
            canonical_plate = norm_res["normalized"]
            formatted_plate = norm_res["formatted"]
            is_valid = norm_res["is_valid"]
            state_code = norm_res["state_code"]

            # Compute real-world detection time: camera_start_time + video_frame_timestamp
            v_secs = parse_video_timestamp_seconds(veh.get("timestamp", 0.0))
            detection_dt = cam_start_dt + timedelta(seconds=v_secs)
            detection_clock_str = detection_dt.strftime("%H:%M:%S")

            obs = {
                "camera_id": norm_cam_id,
                "camera_name": norm_cam_id.upper().replace("_", " "),
                "location": cam_meta["location"],
                "coordinates": cam_meta["coordinates"],
                "camera_start_time": cam_meta["start_time"],
                "video_timestamp_seconds": round(v_secs, 2),
                "detection_datetime": detection_dt,
                "detection_time": detection_clock_str,
                "vehicle_id": veh.get("vehicle_id"),
                "vehicle_class": veh.get("vehicle_class", "car"),
                "plate_number": formatted_plate,
                "canonical_plate": canonical_plate,
                "raw_ocr_text": veh.get("raw_ocr_text", plate_raw),
                "confidence": round(float(veh.get("confidence", 0.0)), 3),
                "is_valid_indian_format": is_valid,
                "state_code": state_code,
                "observations_count": veh.get("observations_count", 1),
                "confirmed_at_frame": veh.get("confirmed_at_frame", 0),
            }
            self.raw_observations.append(obs)

    def correlate(self) -> Dict[str, Any]:
        """
        Executes multi-camera vehicle correlation:
        1. Groups observations by normalized license plate with OCR error clustering.
        2. Sorts each vehicle's sightings chronologically.
        3. Computes hop-by-hop travel intervals and total trip durations.
        4. Identifies multi-camera vehicles vs single-camera sightings.
        """
        if not self.raw_observations:
            return {
                "total_vehicles_tracked": 0,
                "multi_camera_vehicles_count": 0,
                "correlations": [],
                "single_camera_vehicles": [],
            }

        # Step 1: Cluster plates taking into account OCR confusion pairs
        # canonical_key -> list of observations
        clusters: List[Dict[str, Any]] = []

        for obs in self.raw_observations:
            p = obs["canonical_plate"]
            matched_cluster = None

            for cluster in clusters:
                canon = cluster["canonical_plate"]
                if are_ocr_plates_equivalent(p, canon):
                    matched_cluster = cluster
                    break

            if matched_cluster is not None:
                matched_cluster["observations"].append(obs)
                # Keep the canonical plate that has valid format or higher confidence
                if obs["is_valid_indian_format"] and not matched_cluster["is_valid_indian_format"]:
                    matched_cluster["canonical_plate"] = p
                    matched_cluster["plate_display"] = obs["plate_number"]
                    matched_cluster["is_valid_indian_format"] = True
                    matched_cluster["state_code"] = obs["state_code"]
            else:
                clusters.append({
                    "canonical_plate": p,
                    "plate_display": obs["plate_number"],
                    "is_valid_indian_format": obs["is_valid_indian_format"],
                    "state_code": obs["state_code"],
                    "vehicle_class": obs["vehicle_class"],
                    "observations": [obs],
                })

        # Step 2: Build chronological journey for each vehicle cluster
        correlations = []
        single_camera = []

        for cluster in clusters:
            obs_list = cluster["observations"]
            # Sort chronologically by real-world detection datetime
            obs_list.sort(key=lambda x: x["detection_datetime"])

            # Determine dominant vehicle class and highest confidence
            classes = [o["vehicle_class"] for o in obs_list if o.get("vehicle_class")]
            dom_class = max(set(classes), key=classes.count) if classes else "car"
            max_conf = max([o["confidence"] for o in obs_list])
            avg_conf = round(float(sum([o["confidence"] for o in obs_list]) / len(obs_list)), 3)

            # Build journey steps and calculate travel times between hops
            journey_steps = []
            travel_times = []
            unique_cameras: Set[str] = set()

            for i, obs in enumerate(obs_list):
                unique_cameras.add(obs["camera_id"])
                step = {
                    "step_index": i + 1,
                    "camera": obs["camera_id"],
                    "camera_name": obs["camera_name"],
                    "location": obs["location"],
                    "time": obs["detection_time"],
                    "video_timestamp_seconds": obs["video_timestamp_seconds"],
                    "frame": obs["confirmed_at_frame"],
                    "vehicle_id": obs["vehicle_id"],
                    "confidence": obs["confidence"],
                    "vehicle_class": obs["vehicle_class"],
                    "coordinates": obs["coordinates"],
                }
                journey_steps.append(step)

                # Compute travel time to previous camera if i > 0
                if i > 0:
                    prev_obs = obs_list[i - 1]
                    delta_seconds = (obs["detection_datetime"] - prev_obs["detection_datetime"]).total_seconds()
                    delta_minutes = round(delta_seconds / 60.0, 1)

                    hop = {
                        "from_camera": prev_obs["camera_id"],
                        "from_camera_name": prev_obs["camera_name"],
                        "from_location": prev_obs["location"],
                        "to_camera": obs["camera_id"],
                        "to_camera_name": obs["camera_name"],
                        "to_location": obs["location"],
                        "departure_time": prev_obs["detection_time"],
                        "arrival_time": obs["detection_time"],
                        "travel_time_seconds": int(delta_seconds),
                        "travel_time_minutes": delta_minutes,
                        "temporal_anomaly": delta_seconds < 0,
                    }
                    travel_times.append(hop)

            # Overall journey metrics
            total_duration_secs = (obs_list[-1]["detection_datetime"] - obs_list[0]["detection_datetime"]).total_seconds()
            total_duration_mins = round(total_duration_secs / 60.0, 1)

            entry = {
                "vehicle": cluster["canonical_plate"],
                "plate_display": cluster["plate_display"],
                "canonical_plate": cluster["canonical_plate"],
                "is_valid_indian_format": cluster["is_valid_indian_format"],
                "state_code": cluster["state_code"],
                "vehicle_class": dom_class,
                "confidence": max_conf,
                "avg_confidence": avg_conf,
                "cameras_detected_count": len(unique_cameras),
                "cameras_visited": [obs["camera_id"] for obs in obs_list],
                "first_seen_time": obs_list[0]["detection_time"],
                "last_seen_time": obs_list[-1]["detection_time"],
                "total_journey_minutes": total_duration_mins,
                "total_journey_seconds": int(total_duration_secs),
                "journey": journey_steps,
                "travel_times": travel_times,
            }

            if len(unique_cameras) >= 2:
                correlations.append(entry)
            else:
                single_camera.append(entry)

        # Sort multi-camera vehicles by total sightings descending
        correlations.sort(key=lambda x: (x["cameras_detected_count"], len(x["journey"])), reverse=True)

        return {
            "total_vehicles_tracked": len(clusters),
            "multi_camera_vehicles_count": len(correlations),
            "single_camera_vehicles_count": len(single_camera),
            "correlations": correlations,
            "single_camera_vehicles": single_camera,
        }

    def format_ascii_journey(self, vehicle_plate: Optional[str] = None) -> str:
        """
        Formats correlated vehicle journeys into high-visibility ASCII timeline diagrams.
        """
        results = self.correlate()
        correlations = results["correlations"]

        if not correlations and not results["single_camera_vehicles"]:
            return "No vehicle observations loaded for correlation."

        lines = []
        lines.append("=" * 68)
        lines.append("        TRAFFICIQ: CITY-WIDE VEHICLE CORRELATION REPORT")
        lines.append("=" * 68)
        lines.append(f"Total Unique Vehicles Tracked : {results['total_vehicles_tracked']}")
        lines.append(f"Multi-Camera Correlated Trips : {results['multi_camera_vehicles_count']}")
        lines.append(f"Single-Camera Observations    : {results['single_camera_vehicles_count']}")
        lines.append("-" * 68)

        # Filter if requested
        targets = correlations
        if vehicle_plate:
            p_clean = re.sub(r"[^A-Z0-9]", "", vehicle_plate.upper())
            targets = [c for c in correlations if are_ocr_plates_equivalent(c["canonical_plate"], p_clean)]
            if not targets:
                # Check in single camera
                targets = [c for c in results["single_camera_vehicles"] if are_ocr_plates_equivalent(c["canonical_plate"], p_clean)]

        if not targets:
            if vehicle_plate:
                lines.append(f"Vehicle plate '{vehicle_plate}' was not observed.")
            else:
                lines.append("No multi-camera correlations found yet.")
                lines.append("Single-Camera Sightings:")
                for sc in results["single_camera_vehicles"][:5]:
                    lines.append(f"  * {sc['plate_display']:<14} @ {sc['first_seen_time']} in {sc['journey'][0]['location']}")
            lines.append("=" * 68)
            return "\n".join(lines)

        for item in targets:
            v_name = item["plate_display"]
            v_class = item["vehicle_class"].capitalize()
            total_mins = item["total_journey_minutes"]
            cam_count = item["cameras_detected_count"]

            lines.append(f"Vehicle : {v_name}")
            lines.append(f"Class   : {v_class} | Confidence: {item['confidence']*100:.1f}%")
            if item["is_valid_indian_format"]:
                lines.append(f"RTO     : Valid Indian HSRP Registration (State: {item['state_code']})")
            lines.append("")

            journey = item["journey"]
            travels = item["travel_times"]

            for idx, step in enumerate(journey):
                cam_label = step["camera_name"]
                loc_label = step["location"]
                det_time = step["time"]
                conf_pct = int(round(step["confidence"] * 100))

                lines.append(f"  {det_time}")
                lines.append(f"  {cam_label} - {loc_label}")

                # Draw downward connecting arrow if there's a next hop
                if idx < len(travels):
                    hop = travels[idx]
                    t_mins = hop["travel_time_minutes"]
                    # Format as clean integer if whole number
                    mins_str = f"{int(t_mins)} min" if t_mins.is_integer() else f"{t_mins} min"
                    lines.append("        |")
                    lines.append(f"        v {mins_str}")
                    lines.append("        |")

            lines.append("")
            lines.append("  " + "-" * 42)
            lines.append(f"  Total observed journey : {total_mins:.1f} minutes")
            lines.append(f"  Cameras detected       : {cam_count}")
            lines.append("  " + "-" * 42)

            # Report any configured active cameras that had no matching observation for this vehicle
            unmatched_cams = [cid for cid in self.camera_config.keys() if cid not in item["cameras_visited"]]
            if unmatched_cams:
                lines.append("")
                for u_cam in unmatched_cams:
                    u_disp = u_cam.upper().replace("_", "")
                    lines.append(f"  {u_disp}:")
                    lines.append(f"  No matching observation for {v_name}")

            lines.append("-" * 68)

        # If full report requested and there are single-camera observations, print summary
        if not vehicle_plate and results["single_camera_vehicles"]:
            lines.append("SINGLE-CAMERA OBSERVATIONS (No Cross-Camera Matches):")
            for sc in results["single_camera_vehicles"]:
                sc_plate = sc["plate_display"]
                sc_step = sc["journey"][0]
                sc_cam = sc_step["camera_name"]
                sc_loc = sc_step["location"]
                sc_time = sc_step["time"]
                sc_cls = sc_step["vehicle_class"].capitalize()
                sc_conf = int(round(sc["confidence"] * 100))
                valid_tag = "Valid HSRP" if sc["is_valid_indian_format"] else "Foreign/Unconfirmed"
                lines.append(f"  * {sc_plate:<16} ({sc_cls}, {sc_conf}%, {valid_tag}) - {sc_cam} ({sc_loc}) @ {sc_time}")
            lines.append("-" * 68)

        lines.append("=" * 68)
        return "\n".join(lines)

    def export_json(self, output_file: Path) -> Path:
        """Exports city-wide correlation report to JSON format."""
        results = self.correlate()
        output_file.parent.mkdir(parents=True, exist_ok=True)

        payload = {
            "module": "TrafficIQ City-Wide Multi-Camera Vehicle Correlation",
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "camera_configuration": self.camera_config,
            "summary": {
                "total_vehicles_tracked": results["total_vehicles_tracked"],
                "multi_camera_correlations": results["multi_camera_vehicles_count"],
                "single_camera_vehicles": results["single_camera_vehicles_count"],
            },
            "correlations": results["correlations"],
            "single_camera_vehicles": results["single_camera_vehicles"],
        }

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

        return output_file

    def export_csv(self, output_file: Path) -> Path:
        """
        Exports correlation rows to CSV format:
        plate,camera,location,detection_time,previous_camera,travel_time_minutes,vehicle_class,ocr_confidence
        """
        results = self.correlate()
        output_file.parent.mkdir(parents=True, exist_ok=True)

        fieldnames = [
            "plate",
            "camera",
            "location",
            "detection_time",
            "previous_camera",
            "travel_time_minutes",
            "vehicle_class",
            "ocr_confidence",
        ]

        rows = []
        # Multi-camera journeys
        for item in results["correlations"]:
            journey = item["journey"]
            travels = item["travel_times"]

            for i, step in enumerate(journey):
                prev_cam = travels[i - 1]["from_camera_name"] if i > 0 else ""
                t_mins = travels[i - 1]["travel_time_minutes"] if i > 0 else ""
                # Clean whole numbers
                if isinstance(t_mins, float) and t_mins.is_integer():
                    t_mins = int(t_mins)

                rows.append({
                    "plate": item["plate_display"],
                    "camera": step["camera_name"],
                    "location": step["location"],
                    "detection_time": step["time"],
                    "previous_camera": prev_cam,
                    "travel_time_minutes": t_mins,
                    "vehicle_class": step["vehicle_class"],
                    "ocr_confidence": step["confidence"],
                })

        # Single camera sightings
        for item in results["single_camera_vehicles"]:
            for step in item["journey"]:
                rows.append({
                    "plate": item["plate_display"],
                    "camera": step["camera_name"],
                    "location": step["location"],
                    "detection_time": step["time"],
                    "previous_camera": "",
                    "travel_time_minutes": "",
                    "vehicle_class": step["vehicle_class"],
                    "ocr_confidence": step["confidence"],
                })

        with open(output_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        return output_file
