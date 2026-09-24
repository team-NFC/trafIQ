"""
TrafficIQ - Vehicle Counting & Ambulance Priority Module
Limits counting, density, and emergency events to vehicles inside the Traffic Detection Zone.
Enforces camera-local ByteTrack deduplication.
"""

from typing import Dict, List, Set, Optional, Tuple, Any
from .roi import ROIZone

TARGET_CLASSES: Dict[int, str] = {
    0: "car",
    1: "motorcycle",
    2: "bus",
    3: "truck",
    4: "ambulance",
}


class TrafficCounter:
    """
    Maintains active and unique vehicle counts inside a camera's Traffic Detection Zone (ROI).
    Detects ambulance priority events strictly within the ROI.
    """

    def __init__(self, roi_zone: ROIZone, camera_id: Optional[str] = None):
        self.roi = roi_zone
        self.camera_id = camera_id or roi_zone.camera_id
        self.target_classes = TARGET_CLASSES

        # Set of track IDs that have already been counted as unique in this camera's ROI
        self.counted_ids: Set[int] = set()
        # Mapping of track_id -> class_id to handle dynamic classification upgrades (e.g. car -> ambulance)
        self.counted_tracks: Dict[int, int] = {}

        # Cumulative unique counts per class: {0: count, 1: count, ...}
        self.unique_counts_by_class: Dict[int, int] = {cid: 0 for cid in self.target_classes}

        # Active vehicles currently inside ROI in this frame
        self.active_tracks_in_roi: List[Dict[str, Any]] = []

        # Emergency vehicle alert state
        self.emergency_vehicle_detected: bool = False
        self.active_ambulance_events: List[Dict[str, Any]] = []

    def update(self, tracks: List[Dict[str, Any]], frame_timestamp: float = 0.0) -> Dict[str, Any]:
        """
        Update counts based on tracked vehicles in the current frame.
        Only vehicles inside the Traffic Detection Zone contribute to counts.
        """
        self.active_tracks_in_roi.clear()
        self.active_ambulance_events.clear()
        self.emergency_vehicle_detected = False

        for trk in tracks:
            # Check ROI membership
            in_roi = trk.get("in_roi", False)
            if not in_roi and self.roi is not None:
                test_pt = trk.get("bottom_center", trk.get("center"))
                in_roi = self.roi.contains_point(test_pt)
                trk["in_roi"] = in_roi

            if in_roi:
                self.active_tracks_in_roi.append(trk)
                track_id = trk["track_id"]
                cls_id = trk["class_id"]

                # Deduplication: count each track ID only ONCE per camera ROI
                if track_id not in self.counted_ids:
                    self.counted_ids.add(track_id)
                    self.counted_tracks[track_id] = cls_id
                    if cls_id in self.unique_counts_by_class:
                        self.unique_counts_by_class[cls_id] += 1
                    else:
                        self.unique_counts_by_class[cls_id] = 1
                elif cls_id == 4 and self.counted_tracks.get(track_id) != 4:
                    # Upgrade vehicle to Ambulance once emergency beacon/siren is confirmed
                    prev_cls = self.counted_tracks[track_id]
                    if prev_cls in self.unique_counts_by_class and self.unique_counts_by_class[prev_cls] > 0:
                        self.unique_counts_by_class[prev_cls] -= 1
                    self.unique_counts_by_class[4] = self.unique_counts_by_class.get(4, 0) + 1
                    self.counted_tracks[track_id] = 4

                # Ambulance Priority Event: ONLY triggered when ambulance is INSIDE the ROI
                if cls_id == 4:
                    self.emergency_vehicle_detected = True
                    self.active_ambulance_events.append({
                        "camera_id": self.camera_id,
                        "track_id": track_id,
                        "conf": trk["conf"],
                        "timestamp": frame_timestamp,
                        "direction": trk["direction"],
                        "box": trk["box"],
                        "vehicle_class": "ambulance",
                    })

        total_unique = len(self.counted_ids)
        active_in_roi = len(self.active_tracks_in_roi)

        return {
            "camera_id": self.camera_id,
            "active_in_roi": active_in_roi,
            "total_unique": total_unique,
            "unique_counts": self.get_class_counts(),
            "emergency_vehicle_detected": self.emergency_vehicle_detected,
            "ambulance_events": list(self.active_ambulance_events),
        }

    def get_class_counts(self) -> Dict[str, int]:
        """Return unique counts mapped to class names."""
        return {
            self.target_classes.get(cid, f"class_{cid}"): count
            for cid, count in self.unique_counts_by_class.items()
        }

    def reset(self) -> None:
        """Reset counting state for this camera."""
        self.counted_ids.clear()
        self.counted_tracks.clear()
        self.unique_counts_by_class = {cid: 0 for cid in self.target_classes}
        self.active_tracks_in_roi.clear()
        self.active_ambulance_events.clear()
        self.emergency_vehicle_detected = False
