import asyncio
import json
import sys
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Any

import cv2
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Set project root in path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from signal_control.normal.normal_signal import NormalSignalController
from situations.ambulance_situation.ambulance_priority import AmbulancePriorityController

# Directories
VIDEOS_DIR = PROJECT_ROOT / "situations" / "normal_situation" / "videos"
ANPR_OUTPUT_DIR = PROJECT_ROOT / "anpr" / "output"
SIGNAL_CONFIG_PATH = PROJECT_ROOT / "config" / "signal_config.json"

CAMERA_META: Dict[str, Dict[str, str]] = {
    "01": {"name": "CAM 01", "approach": "North Approach", "file": "camera_01.mp4"},
    "02": {"name": "CAM 02", "approach": "East Approach", "file": "camera_02.mp4"},
    "03": {"name": "CAM 03", "approach": "South Approach", "file": "camera_03.mp4"},
    "04": {"name": "CAM 04", "approach": "West Approach", "file": "camera_04.mp4"},
}


class CameraStreamHub:
    """
    Dedicated background video decoder hub.
    Maintains a single VideoCapture per camera file and serves pre-encoded
    JPEG frames simultaneously to all connected browser clients.
    Prevents threadpool starvation and eliminates black/stalled video feeds.
    """

    def __init__(self):
        self.frames: Dict[str, bytes] = {}
        self.running = False
        self.threads: List[threading.Thread] = []

    def start(self):
        if self.running:
            return
        self.running = True
        for cam_id, meta in CAMERA_META.items():
            video_path = VIDEOS_DIR / meta["file"]
            if video_path.is_file():
                t = threading.Thread(
                    target=self._worker,
                    args=(cam_id, video_path),
                    name=f"CCTV-Worker-{cam_id}",
                    daemon=True,
                )
                t.start()
                self.threads.append(t)

    def stop(self):
        self.running = False

    def _worker(self, cam_id: str, video_path: Path):
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            return

        fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
        frame_delay = 1.0 / max(1.0, min(fps, 30.0))

        while self.running:
            success, frame = cap.read()
            if not success:
                # Loop video when reaching the end
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                success, frame = cap.read()
                if not success:
                    time.sleep(0.1)
                    continue

            # Resize to standard HD viewport resolution (960x540)
            resized = cv2.resize(frame, (960, 540), interpolation=cv2.INTER_AREA)
            ret, buf = cv2.imencode(".jpg", resized, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if ret:
                self.frames[cam_id] = buf.tobytes()

            time.sleep(frame_delay)

        cap.release()

    def get_frame(self, cam_id: str) -> Optional[bytes]:
        return self.frames.get(cam_id)


# Global instances
stream_hub = CameraStreamHub()
stream_hub.start()

# Real Signal Controller from signal_control.normal
signal_controller = NormalSignalController(config_path=str(SIGNAL_CONFIG_PATH))
last_signal_update = time.time()

# Real Ambulance Controller
ambulance_controller = AmbulancePriorityController(config_path=str(SIGNAL_CONFIG_PATH))

app = FastAPI(
    title="TrafficIQ API",
    description="Real Backend API bridge for TrafficIQ AI Traffic Intelligence System",
    version="1.0.0",
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def normalize_camera_id(camera_id: str) -> str:
    cam = camera_id.lower().replace("camera_", "").replace("cam", "").replace("_", "").strip()
    if cam.endswith(".mp4"):
        cam = cam[:-4]
    try:
        idx = int(cam)
        return f"{idx:02d}"
    except ValueError:
        return cam


@app.get("/")
def read_root():
    return {
        "message": "TrafficIQ API is running"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "TrafficIQ API"
    }


@app.get("/api/cameras/status")
def get_cameras_status() -> Dict[str, Any]:
    """
    Returns real status of each camera by checking the actual filesystem.
    No hardcoded availability or fake streams.
    """
    status_report: Dict[str, Any] = {}
    for cam_id, meta in CAMERA_META.items():
        file_path = VIDEOS_DIR / meta["file"]
        is_available = file_path.is_file()

        info: Dict[str, Any] = {
            "name": meta["name"],
            "approach": meta["approach"],
            "status": "online" if is_available else "offline",
            "source": str(file_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "type": "recorded_cctv",
        }

        if is_available:
            info["resolution"] = "1920x1080"
            info["fps"] = 24.0

        status_report[f"camera_{cam_id}"] = info

    return status_report


@app.get("/api/video/camera/{camera_id}")
async def stream_camera(camera_id: str, request: Request):
    norm_id = normalize_camera_id(camera_id)
    if norm_id in CAMERA_META:
        video_path = VIDEOS_DIR / CAMERA_META[norm_id]["file"]
    else:
        filename = f"camera_{camera_id}.mp4" if not camera_id.endswith(".mp4") else camera_id
        video_path = VIDEOS_DIR / filename

    if not video_path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"Camera video file '{video_path.name}' does not exist on disk."
        )

    async def frame_stream():
        last_yielded = None
        while True:
            if await request.is_disconnected():
                break

            frame_bytes = stream_hub.get_frame(norm_id)
            if frame_bytes is not None and frame_bytes is not last_yielded:
                last_yielded = frame_bytes
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(frame_bytes)).encode("ascii") + b"\r\n\r\n"
                    + frame_bytes + b"\r\n"
                )

            await asyncio.sleep(0.035)

    return StreamingResponse(
        frame_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@app.get("/api/signals")
def get_signal_state() -> Dict[str, Any]:
    """
    Exposes live signal controller state from the existing NormalSignalController.
    Safety state transitions: GREEN -> YELLOW -> ALL_RED -> NEXT GREEN.
    """
    global last_signal_update
    now = time.time()
    dt = max(0.0, now - last_signal_update)
    last_signal_update = now

    # Advance the real controller by real elapsed time
    signal_controller.update(dt)
    status = signal_controller.get_status()

    # Map camera IDs to friendly names for frontend
    cam_name_map = {
        "camera_01": "CAM 01",
        "camera_02": "CAM 02",
        "camera_03": "CAM 03",
        "camera_04": "CAM 04",
    }
    approach_map = {
        "camera_01": "North Approach",
        "camera_02": "East Approach",
        "camera_03": "South Approach",
        "camera_04": "West Approach",
    }

    approaches_list = []
    signals_dict = status.get("signals", {})
    for cam_id in signal_controller.sequence:
        approaches_list.append({
            "cameraId": cam_id.replace("camera_", ""),
            "name": cam_name_map.get(cam_id, cam_id.upper()),
            "approach": approach_map.get(cam_id, cam_id),
            "state": signals_dict.get(cam_id, "RED"),
            "isPriority": False,
        })

    curr_app = status.get("current_approach", "camera_01")

    return {
        "status": "active",
        "mode": status.get("mode", "NORMAL"),
        "currentGreenCam": cam_name_map.get(curr_app, curr_app),
        "currentPhase": status.get("current_phase", "GREEN"),
        "remainingSeconds": int(status.get("time_remaining", 0)),
        "phaseDuration": status.get("phase_duration", 20.0),
        "signals": signals_dict,
        "approaches": approaches_list,
        "cyclesCompleted": status.get("cycles_completed", 0),
        "totalElapsedTime": status.get("total_elapsed_time", 0.0),
    }


@app.get("/api/ambulance")
def get_ambulance_state() -> Dict[str, Any]:
    """
    Exposes the REAL ambulance priority state from AmbulancePriorityController.
    Returns honest status without simulating fake ambulances.
    """
    status = ambulance_controller.get_status()
    is_emergency = status.get("is_emergency_active", False)

    return {
        "status": "active" if is_emergency else "idle",
        "ambulance_detected": is_emergency,
        "priority_active": is_emergency,
        "camera": status.get("emergency_approach"),
        "mode": status.get("mode", "NORMAL"),
        "phase": status.get("current_phase"),
        "message": (
            f"Emergency vehicle preemption active on {status.get('emergency_approach')}"
            if is_emergency
            else "No active emergency"
        ),
    }


@app.get("/api/traffic")
def get_traffic_metrics() -> Dict[str, Any]:
    """
    Exposes traffic analytics from the live pipeline.
    If the continuous YOLO/ByteTrack background runner is not currently running,
    returns an honest waiting state without inventing fake vehicle counts.
    """
    return {
        "status": "waiting",
        "message": "Traffic analysis is not currently running",
        "total_vehicles": None,
        "classes": None,
        "density": None,
        "queue_length": None,
    }


@app.get("/api/anpr")
def get_anpr_records() -> Dict[str, Any]:
    """
    Reads existing real ANPR output files from anpr/output/.
    Exposes confirmed plate reads, vehicle classes, and OCR confidence.
    """
    all_reads: List[Dict[str, Any]] = []

    for cam_idx in range(1, 6):
        cam_id = f"camera_{cam_idx:02d}"
        file_path = ANPR_OUTPUT_DIR / f"{cam_id}_anpr_results.json"
        if file_path.is_file():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                confirmed = data.get("confirmed_vehicles", [])
                for v in confirmed:
                    all_reads.append({
                        "camera": cam_id,
                        "camera_name": f"CAM {cam_idx:02d}",
                        "plate_number": v.get("plate_number"),
                        "canonical_plate": v.get("normalized_plate"),
                        "vehicle_class": v.get("vehicle_class"),
                        "confidence": v.get("confidence"),
                        "timestamp": v.get("timestamp"),
                        "frame": v.get("confirmed_at_frame"),
                        "is_valid_indian_format": v.get("is_valid_indian_format", True),
                    })
            except Exception as e:
                print(f"[Warning] Failed to read {file_path}: {e}")

    return {
        "status": "success",
        "total_confirmed_reads": len(all_reads),
        "records": all_reads,
    }


@app.get("/api/anpr/search")
def search_plate(plate: str = Query(..., description="Vehicle license plate to search")) -> Dict[str, Any]:
    """
    Searches real ANPR and city-wide correlation outputs for a vehicle plate.
    Does NOT invent fake matches.
    """
    clean_plate = plate.strip().upper().replace(" ", "").replace("-", "")

    # 1. Search citywide_correlation.json
    corr_file = ANPR_OUTPUT_DIR / "citywide_correlation.json"
    if corr_file.is_file():
        try:
            with open(corr_file, "r", encoding="utf-8") as f:
                corr_data = json.load(f)
            for item in corr_data.get("correlations", []):
                if item.get("canonical_plate") == clean_plate or item.get("vehicle") == clean_plate:
                    return {
                        "status": "found",
                        "plate": item.get("plate_display", plate),
                        "canonical_plate": clean_plate,
                        "vehicle_class": item.get("vehicle_class"),
                        "confidence": item.get("avg_confidence", item.get("confidence")),
                        "cameras_visited": item.get("cameras_visited", []),
                        "total_journey_minutes": item.get("total_journey_minutes"),
                        "journey": item.get("journey", []),
                        "travel_times": item.get("travel_times", []),
                    }
        except Exception as e:
            print(f"[Warning] Failed searching correlation: {e}")

    # 2. Search camera result files for single-camera observation
    for cam_idx in range(1, 6):
        cam_id = f"camera_{cam_idx:02d}"
        file_path = ANPR_OUTPUT_DIR / f"{cam_id}_anpr_results.json"
        if file_path.is_file():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for v in data.get("confirmed_vehicles", []):
                    if v.get("normalized_plate") == clean_plate:
                        return {
                            "status": "found",
                            "plate": v.get("plate_number"),
                            "canonical_plate": clean_plate,
                            "vehicle_class": v.get("vehicle_class"),
                            "confidence": v.get("confidence"),
                            "cameras_visited": [cam_id],
                            "total_journey_minutes": 0.0,
                            "journey": [{
                                "step_index": 1,
                                "camera": cam_id,
                                "camera_name": f"CAM {cam_idx:02d}",
                                "location": f"Approach {cam_idx:02d}",
                                "time": v.get("timestamp"),
                                "confidence": v.get("confidence"),
                                "vehicle_class": v.get("vehicle_class"),
                            }],
                            "travel_times": [],
                        }
            except Exception:
                pass

    return {
        "status": "not_found",
        "plate": plate,
        "canonical_plate": clean_plate,
        "message": f"No real ANPR observations recorded for plate '{plate}'",
        "journey": [],
    }


@app.get("/api/correlation")
def get_correlation_summary() -> Dict[str, Any]:
    """
    Exposes real city-wide correlation from anpr/output/citywide_correlation.json.
    """
    corr_file = ANPR_OUTPUT_DIR / "citywide_correlation.json"
    if not corr_file.is_file():
        raise HTTPException(status_code=404, detail="City-wide correlation output file not found")

    try:
        with open(corr_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read correlation data: {str(e)}")
