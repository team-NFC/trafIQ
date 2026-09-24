"""
TrafficIQ - Independent ANPR Module
Module: anpr_pipeline.py

Complete End-to-End Automatic Number Plate Recognition (ANPR) Pipeline:
1. Video Ingestion: Processes ANPR-specific high-resolution video streams.
2. Vehicle Detection & ByteTrack: Tracks unique vehicle IDs across frames.
3. Plate Detection: Dual-engine plate localizer (YOLO plate model + Indian HSRP fallback).
4. Plate Cropping & Quality Gate: Evaluates sharpness, contrast, and resolution.
5. Image Enhancement & OCR: Adaptive CLAHE + PaddleOCR 3.7.0.
6. Indian Plate Normalization: Formats and validates registration numbers.
7. Temporal Multi-Frame Confirmation: Enforces repeated observations across frames.
8. Spatial Association: Pins plates strictly to their parent vehicle bounding boxes.
9. Output Generation: Annotated video, structured JSON, and CSV export.
"""

import os
import sys
import time
import json
import csv
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Set
from collections import defaultdict, Counter
import cv2
import numpy as np
import torch

# Project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from traffic.detection import VehicleDetector
from traffic.tracking import VehicleTracker
from anpr.plate_detection import PlateDetector
from anpr.plate_ocr import PlateOCR, IndianPlateValidator


class ANPRPipeline:
    """
    End-to-End Automatic Number Plate Recognition Pipeline.
    """

    def __init__(
        self,
        video_path: str,
        output_video_path: Optional[str] = None,
        model_path: str = str(PROJECT_ROOT / "yolov8n.pt"),
        plate_model_path: Optional[str] = None,
        conf_threshold: float = 0.25,
        ocr_conf_threshold: float = 0.50,
        min_confirmed_observations: int = 3,
        device: str = "0",
        imgsz: int = 1280,
        debug: bool = False,
    ):
        self.video_path = Path(video_path)
        if not self.video_path.exists():
            # Check inside anpr/videos/
            alt_path = PROJECT_ROOT / "anpr" / "videos" / self.video_path.name
            if alt_path.exists():
                self.video_path = alt_path
            else:
                # Find available videos in anpr/videos/
                videos_dir = PROJECT_ROOT / "anpr" / "videos"
                avail = [f.name for f in videos_dir.glob("*.mp4")] + [f.name for f in videos_dir.glob("*.avi")]
                if avail:
                    print(f"\n[WARNING] Video '{video_path}' was not found.")
                    print(f"[INFO] Automatically using available video: anpr/videos/{avail[0]}\n")
                    self.video_path = videos_dir / avail[0]
                else:
                    raise FileNotFoundError(
                        f"ANPR input video not found: '{video_path}'.\n"
                        f"Please place your video file into '{videos_dir}' and run again."
                    )

        # Output paths
        self.output_dir = PROJECT_ROOT / "anpr" / "output"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        video_stem = self.video_path.stem
        self.output_video_path = Path(output_video_path) if output_video_path else (self.output_dir / f"{video_stem}_anpr_result.mp4")
        self.output_json_path = self.output_dir / f"{video_stem}_anpr_results.json"
        self.output_csv_path = self.output_dir / f"{video_stem}_anpr_results.csv"

        self.conf = conf_threshold
        self.ocr_conf_threshold = ocr_conf_threshold
        self.min_confirmed_observations = min_confirmed_observations
        self.device = "0" if (device != "cpu" and torch.cuda.is_available()) else "cpu"
        self.imgsz = imgsz
        self.debug = debug

        # 1. Vehicle Detector & Tracker
        print(f"[ANPR] Initializing Vehicle Detector on {self.device} (imgsz={imgsz})")
        self.detector = VehicleDetector(model_path=model_path, conf_threshold=conf_threshold, device=self.device)
        self.tracker = VehicleTracker(model=self.detector.model, conf_threshold=conf_threshold, device=self.device, imgsz=imgsz)

        # 2. Plate Detector (Pluggable YOLO + Indian HSRP Morphological Fallback)
        print("[ANPR] Initializing Number Plate Detector")
        self.plate_detector = PlateDetector(yolo_model_path=plate_model_path, min_confidence=0.25)
        print(f"[ANPR] Plate Detector Engine: {self.plate_detector.method_name}")

        # 3. OCR Engine (PaddleOCR 3.7.0 + Indian Plate Validator)
        print("[ANPR] Initializing PaddleOCR Engine")
        self.plate_ocr = PlateOCR(use_gpu=(self.device != "cpu"))

        # Temporal Multi-Frame Confirmation Memory: track_id -> list of OCR records
        self.plate_observations: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
        # Confirmed Plates: track_id -> best confirmed plate record
        self.confirmed_plates: Dict[int, Dict[str, Any]] = {}
        # Track active plates seen in current frame
        self.current_frame_plates: Dict[int, Dict[str, Any]] = {}

    def _draw_badge(
        self,
        frame: np.ndarray,
        vehicle_box: List[int],
        track_id: int,
        vehicle_class: str,
        plate_record: Optional[Dict[str, Any]],
        is_confirmed: bool,
    ):
        """Draws a high-visibility information card above the tracked vehicle."""
        vx1, vy1, vx2, vy2 = vehicle_box

        # Card position above vehicle bounding box
        card_w = 260
        card_h = 72 if plate_record else 32
        cx = max(10, min(frame.shape[1] - card_w - 10, vx1))
        cy = max(card_h + 10, vy1 - 10)

        x1 = cx
        y1 = cy - card_h
        x2 = x1 + card_w
        y2 = cy

        # Border color based on confirmation state
        if is_confirmed:
            border_color = (0, 220, 0)       # Vibrant Green
            bg_color = (20, 40, 20)
            status_text = "CONFIRMED"
        elif plate_record:
            border_color = (0, 215, 255)     # Cyan/Yellow
            bg_color = (40, 40, 20)
            status_text = "OBSERVING..."
        else:
            border_color = (160, 160, 160)   # Neutral Gray
            bg_color = (30, 30, 30)
            status_text = "SCANNING"

        # Background card with slight transparency
        overlay = frame.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), bg_color, -1)
        cv2.rectangle(overlay, (x1, y1), (x2, y2), border_color, 2)
        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)

        # Header: Vehicle ID & Class
        head_str = f"#{track_id} {vehicle_class.upper()}"
        cv2.putText(frame, head_str, (x1 + 10, y1 + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        if plate_record:
            plate_str = plate_record.get("formatted_text") or plate_record.get("normalized_text", "UNKNOWN")
            conf = int(plate_record.get("confidence", 0.0) * 100)
            cv2.putText(frame, plate_str, (x1 + 10, y1 + 45), cv2.FONT_HERSHEY_SIMPLEX, 0.65, border_color, 2)
            sub_str = f"Plate: {conf}% [{status_text}]"
            cv2.putText(frame, sub_str, (x1 + 10, y1 + 64), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)

    def _update_temporal_confirmation(self, track_id: int, reading: Dict[str, Any], frame_idx: int, timestamp: float, vehicle_class: str = "car"):
        """
        Updates multi-frame observation history and confirms plates meeting threshold criteria.
        """
        normalized = reading["normalized_text"]
        if not normalized or len(normalized) < 6:
            return

        conf = reading["confidence"]
        is_valid = reading["is_valid_indian_plate"]

        record = {
            "track_id": track_id,
            "vehicle_class": vehicle_class,
            "raw_text": reading["raw_text"],
            "normalized_text": normalized,
            "formatted_text": reading["formatted_text"],
            "confidence": conf,
            "is_valid": is_valid,
            "state_code": reading["state_code"],
            "frame_idx": frame_idx,
            "timestamp": timestamp,
        }

        self.plate_observations[track_id].append(record)

        # Check if this vehicle already has a confirmed plate
        if track_id in self.confirmed_plates:
            # Check if new reading has higher confidence on the same plate
            if normalized == self.confirmed_plates[track_id]["normalized_text"]:
                if conf > self.confirmed_plates[track_id]["confidence"]:
                    self.confirmed_plates[track_id]["confidence"] = conf
            return

        # Multi-frame consensus evaluation
        obs_list = self.plate_observations[track_id]
        if len(obs_list) < self.min_confirmed_observations:
            return

        # Group by normalized plate text
        plate_groups = defaultdict(list)
        for obs in obs_list:
            plate_groups[obs["normalized_text"]].append(obs)

        # Find plate with most observations
        best_plate = None
        best_count = 0
        best_avg_conf = 0.0

        for p_text, group in plate_groups.items():
            count = len(group)
            avg_conf = float(np.mean([item["confidence"] for item in group]))
            has_valid_format = any([item["is_valid"] for item in group])

            # Priority given to valid Indian plate formats
            score = count * (1.5 if has_valid_format else 1.0) * avg_conf
            if count >= self.min_confirmed_observations and avg_conf >= self.ocr_conf_threshold:
                if count > best_count:
                    best_count = count
                    best_plate = group[-1]
                    best_avg_conf = avg_conf

        if best_plate:
            confirmed_entry = dict(best_plate)
            confirmed_entry["confidence"] = round(best_avg_conf, 3)
            confirmed_entry["confirmed_frame"] = frame_idx
            confirmed_entry["observations_count"] = best_count
            self.confirmed_plates[track_id] = confirmed_entry
            print(f"[CONFIRMED] Vehicle #{track_id} -> Plate: {confirmed_entry['formatted_text']} (Conf: {confirmed_entry['confidence']*100:.1f}%, Obs: {best_count})")

    def run(self, max_frames: Optional[int] = None, show: bool = False, auto_play: bool = True):
        """
        Executes end-to-end ANPR video processing.
        """
        cap = cv2.VideoCapture(str(self.video_path))
        if not cap.isOpened():
            print(f"[ERROR] Could not open video: {self.video_path}")
            return

        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
        total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(self.output_video_path), fourcc, fps, (w, h))

        window_title = "TrafficIQ - ANPR Video Pipeline"
        if show:
            try:
                cv2.namedWindow(window_title, cv2.WINDOW_NORMAL)
                cv2.resizeWindow(window_title, 1280, 720)
            except Exception as e:
                print(f"[INFO] GUI window not available: {e}. Running in headless mode.")
                show = False

        frame_idx = 0
        t_start = time.time()
        rolling_fps = 0.0
        total_plates_detected = 0

        print("=" * 68)
        print("TRAFFICIQ - STARTING ANPR VIDEO PIPELINE")
        print(f"Input Video   : {self.video_path.name} ({w}x{h} @ {fps:.1f} FPS, {total_video_frames} frames)")
        print(f"Output Video  : {self.output_video_path}")
        print(f"Plate Engine  : {self.plate_detector.method_name}")
        print(f"OCR Engine    : PaddleOCR 3.7.0")
        print(f"Device        : {self.device}")
        print("=" * 68)

        try:
            while True:
                t_frame_start = time.time()
                ret, frame = cap.read()
                if not ret:
                    break

                frame_idx += 1
                if max_frames and frame_idx > max_frames:
                    print(f"\n[INFO] Reached max frames limit: {max_frames}")
                    break

                timestamp = frame_idx / fps
                self.current_frame_plates.clear()

                # 1. Detect & Track Vehicles
                tracks = self.tracker.track(frame)

                # 2. For each tracked vehicle, localize and read license plate
                for trk in tracks:
                    track_id = trk["track_id"]
                    vbox = [int(v) for v in trk["box"]]
                    vx1, vy1, vx2, vy2 = max(0, vbox[0]), max(0, vbox[1]), min(w, vbox[2]), min(h, vbox[3])
                    vw_box, vh_box = vx2 - vx1, vy2 - vy1

                    # Skip distant vehicles where plates are physically too small to read
                    if vw_box < 80 or vh_box < 50:
                        continue

                    # OPTIMIZATION 1: If vehicle plate is already confirmed, reuse result and skip expensive OCR!
                    if track_id in self.confirmed_plates:
                        continue

                    # OPTIMIZATION 2: Run OCR every 3rd frame per vehicle for smooth real-time performance
                    if (frame_idx + track_id) % 3 != 0:
                        continue

                    v_crop = frame[vy1:vy2, vx1:vx2]
                    if v_crop.size == 0:
                        continue

                    # Plate Detection on vehicle crop
                    plate_res = self.plate_detector.detect_plate(v_crop, vehicle_bbox=[vx1, vy1, vx2, vy2])

                    if plate_res:
                        total_plates_detected += 1
                        plate_crop = plate_res["plate_crop"]
                        plate_box_frame = plate_res.get("bbox_frame")

                        # Run OCR on cropped plate
                        ocr_res = self.plate_ocr.read_plate(plate_crop)
                        if ocr_res and ocr_res.get("normalized_text"):
                            self.current_frame_plates[track_id] = {
                                "plate_box": plate_box_frame,
                                "ocr": ocr_res,
                            }
                            # Update temporal multi-frame confirmation
                            v_cls = trk.get("class_name", "car")
                            self._update_temporal_confirmation(track_id, ocr_res, frame_idx, timestamp, vehicle_class=v_cls)

                # 3. Annotate Frame
                annotated = frame.copy()

                # Draw top status banner
                banner_h = 55
                cv2.rectangle(annotated, (0, 0), (w, banner_h), (25, 25, 25), -1)
                cv2.line(annotated, (0, banner_h), (w, banner_h), (0, 200, 255), 2)
                banner_title = "TRAFFICIQ ANPR SYSTEM  |  AUTOMATIC NUMBER PLATE RECOGNITION"
                cv2.putText(annotated, banner_title, (25, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
                sub_status = f"FRAME: {frame_idx:04d}/{total_video_frames} | FPS: {rolling_fps:.1f} | VEHICLES: {len(tracks)} | CONFIRMED PLATES: {len(self.confirmed_plates)}"
                cv2.putText(annotated, sub_status, (25, 47), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 220, 0), 1)

                # Draw vehicles, plates, and badges
                for trk in tracks:
                    track_id = trk["track_id"]
                    v_cls = trk["class_name"]
                    vbox = [int(v) for v in trk["box"]]
                    vx1, vy1, vx2, vy2 = vbox

                    is_confirmed = track_id in self.confirmed_plates
                    curr_plate_info = self.current_frame_plates.get(track_id)

                    active_record = None
                    if is_confirmed:
                        active_record = self.confirmed_plates[track_id]
                        box_color = (0, 220, 0)     # Green
                    elif curr_plate_info:
                        active_record = curr_plate_info["ocr"]
                        box_color = (0, 215, 255)   # Yellow/Cyan
                    else:
                        box_color = (180, 180, 180) # Gray

                    # Draw vehicle bounding box
                    cv2.rectangle(annotated, (vx1, vy1), (vx2, vy2), box_color, 2)

                    # Draw plate bounding box if localized
                    if curr_plate_info and curr_plate_info.get("plate_box"):
                        px1, py1, px2, py2 = curr_plate_info["plate_box"]
                        cv2.rectangle(annotated, (px1, py1), (px2, py2), (0, 255, 255), 2)
                        if self.debug:
                            cv2.putText(annotated, "PLATE", (px1, py1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 255), 1)

                    # Draw floating vehicle badge
                    self._draw_badge(annotated, vbox, track_id, v_cls, active_record, is_confirmed)

                writer.write(annotated)

                # Update rolling FPS
                f_dur = time.time() - t_frame_start
                rolling_fps = 0.9 * rolling_fps + 0.1 * (1.0 / max(f_dur, 1e-4))

                if show:
                    cv2.imshow(window_title, annotated)
                    key = cv2.waitKey(1) & 0xFF
                    if key == 27 or key == ord("q"):
                        print("\n[INFO] Stopped by user keypress.")
                        break

                if frame_idx % 20 == 0 or frame_idx == total_video_frames:
                    print(f"Frame {frame_idx:04d}/{total_video_frames} | FPS: {rolling_fps:.1f} | Vehicles Tracked: {len(self.tracker.track_history)} | Confirmed Plates: {len(self.confirmed_plates)}")

        finally:
            cap.release()
            writer.release()
            if show:
                cv2.destroyAllWindows()

        t_total = time.time() - t_start

        # 4. Save Structured JSON & CSV Outputs
        self._save_structured_results(t_total, frame_idx)

        # 5. Print Final Report
        self._print_final_report(t_total, frame_idx, total_plates_detected)

        # 6. Smooth 1x Real-Time Video Playback (Default)
        if auto_play and self.output_video_path.exists():
            play_annotated_video(self.output_video_path, fps=fps)

    def _save_structured_results(self, total_time: float, total_frames: int):
        """Saves recognized plates to JSON and CSV formats."""
        records = []
        for track_id, conf_data in self.confirmed_plates.items():
            records.append({
                "vehicle_id": track_id,
                "vehicle_class": conf_data.get("vehicle_class", "car"),
                "plate_number": conf_data.get("formatted_text") or conf_data.get("normalized_text"),
                "raw_ocr_text": conf_data.get("raw_text"),
                "normalized_plate": conf_data.get("normalized_text"),
                "confidence": conf_data.get("confidence"),
                "is_valid_indian_format": conf_data.get("is_valid"),
                "state_code": conf_data.get("state_code"),
                "observations_count": conf_data.get("observations_count", 0),
                "timestamp": f"{conf_data.get('timestamp', 0.0):.2f}s",
                "confirmed_at_frame": conf_data.get("confirmed_frame"),
            })

        # Save JSON
        json_payload = {
            "module": "TrafficIQ ANPR",
            "video": self.video_path.name,
            "total_frames_processed": total_frames,
            "total_processing_time_seconds": round(total_time, 2),
            "average_fps": round(total_frames / max(total_time, 1e-4), 1),
            "plate_detector_engine": self.plate_detector.method_name,
            "ocr_engine": "PaddleOCR 3.7.0",
            "total_confirmed_plates": len(records),
            "confirmed_vehicles": records,
        }

        with open(self.output_json_path, "w", encoding="utf-8") as f:
            json.dump(json_payload, f, indent=2)
        print(f"[ANPR Output] Saved JSON results -> {self.output_json_path}")

        # Save CSV
        if records:
            keys = ["vehicle_id", "vehicle_class", "plate_number", "confidence", "is_valid_indian_format", "state_code", "observations_count", "timestamp", "confirmed_at_frame"]
            with open(self.output_csv_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
                writer.writeheader()
                writer.writerows(records)
            print(f"[ANPR Output] Saved CSV results  -> {self.output_csv_path}")

    def _print_final_report(self, total_time: float, total_frames: int, total_plates_detected: int):
        """Displays formatted final report in terminal."""
        print("\n" + "=" * 68)
        print("               TRAFFICIQ — ANPR FINAL REPORT")
        print("=" * 68)
        print(f"Input Video                  : {self.video_path.name}")
        print(f"Total Frames Processed       : {total_frames}")
        print(f"Total Processing Time        : {total_time:.2f} s")
        print(f"Average Processing FPS       : {total_frames / max(total_time, 1e-4):.1f}")
        print(f"Total Vehicles Tracked       : {len(self.tracker.track_history)}")
        print(f"Plate Crops Detected         : {total_plates_detected}")
        print(f"Confirmed License Plates     : {len(self.confirmed_plates)}")
        print(f"Plate Localizer Engine       : {self.plate_detector.method_name}")
        print(f"OCR Engine                   : PaddleOCR 3.7.0")
        print(f"Device Used                  : {self.device}")
        print("-" * 68)
        print("Recognized Vehicles & Plates:")
        if self.confirmed_plates:
            for vid, cdata in self.confirmed_plates.items():
                p_num = cdata.get("formatted_text") or cdata.get("normalized_text")
                conf_pct = cdata.get("confidence", 0.0) * 100
                obs = cdata.get("observations_count", 0)
                state = cdata.get("state_code", "N/A")
                valid_str = "VALID HSRP" if cdata.get("is_valid") else "FORMAT UNCONFIRMED"
                print(f"  • Vehicle #{vid:<3} : {p_num:<16} (Confidence: {conf_pct:.1f}%, Obs: {obs}, State: {state}, Status: {valid_str})")
        else:
            print("  (No vehicles passed the multi-frame temporal confirmation threshold in this clip)")
        print("-" * 68)
        print(f"Output Video Saved To        : {self.output_video_path}")
        print(f"Structured JSON Saved To     : {self.output_json_path}")
        print("=" * 68)


def play_annotated_video(
    video_path: Path,
    fps: float = 24.0,
    window_title: str = "TrafficIQ ANPR - Real-Time Playback (1X Speed)",
):
    """
    Plays the annotated output video at smooth, true 1x real-time speed.
    Interactive Controls:
      - [SPACE] : Pause / Resume
      - [R]     : Replay from beginning
      - [Q/ESC] : Exit viewer
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"[ERROR] Could not open video for playback: {video_path}")
        return

    vid_fps = cap.get(cv2.CAP_PROP_FPS) or fps or 24.0
    frame_interval = 1.0 / vid_fps
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    try:
        cv2.namedWindow(window_title, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(window_title, 1280, 720)
    except Exception as e:
        print(f"[INFO] GUI window not available: {e}")
        cap.release()
        return

    print("\n" + "=" * 68)
    print("🎬 PLAYING ANNOTATED ANPR VIDEO AT NORMAL 1X REAL-TIME SPEED")
    print(f"Video Speed   : {vid_fps:.1f} FPS (Smooth 1X Normal Speed, {total_frames} frames)")
    print(f"Controls      : [SPACE] Pause/Resume | [R] Replay | [Q / ESC] Close")
    print("=" * 68)

    is_paused = False
    while True:
        t_start = time.time()

        if not is_paused:
            ret, frame = cap.read()
            if not ret:
                # Reached end: allow user to replay or exit
                cv2.putText(
                    frame_last,
                    "PLAYBACK COMPLETE | PRESS [R] TO REPLAY | [Q] TO EXIT",
                    (30, 90),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8,
                    (0, 255, 255),
                    2,
                )
                cv2.imshow(window_title, frame_last)
                k = cv2.waitKey(100) & 0xFF
                if k == ord("r") or k == ord("R"):
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                elif k == 27 or k == ord("q") or k == ord("Q"):
                    break
                continue

            frame_last = frame.copy()
            h_f, w_f = frame.shape[:2]
            # Small footer guide
            cv2.putText(
                frame,
                "REAL-TIME 1X SPEED | SPACE: PAUSE | R: REPLAY | Q: EXIT",
                (25, h_f - 18),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.48,
                (0, 220, 255),
                1,
                cv2.LINE_AA,
            )
            cv2.imshow(window_title, frame)

        # Precise timing sync to enforce 1x real-time speed
        elapsed = time.time() - t_start
        wait_ms = max(1, int((frame_interval - elapsed) * 1000))
        key = cv2.waitKey(wait_ms if not is_paused else 50) & 0xFF

        if key == 27 or key == ord("q") or key == ord("Q"):
            break
        elif key == ord(" "):
            is_paused = not is_paused
        elif key == ord("r") or key == ord("R"):
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            is_paused = False

    cap.release()
    cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser(description="TrafficIQ Independent ANPR Pipeline")
    parser.add_argument("--video", default=str(PROJECT_ROOT / "anpr" / "videos" / "anpr_demo.mp4"), help="Path to input ANPR video")
    parser.add_argument("--output", default=None, help="Path to output annotated MP4 video")
    parser.add_argument("--model", default=str(PROJECT_ROOT / "yolov8n.pt"), help="YOLO vehicle model path")
    parser.add_argument("--plate-model", default=None, help="Optional dedicated YOLO plate detector weights")
    parser.add_argument("--conf", type=float, default=0.25, help="Vehicle detection confidence threshold")
    parser.add_argument("--ocr-conf", type=float, default=0.50, help="Minimum OCR confidence threshold")
    parser.add_argument("--min-obs", type=int, default=3, help="Minimum temporal confirmed observations")
    parser.add_argument("--device", default="0", help="Inference device ('0' for GPU or 'cpu')")
    parser.add_argument("--imgsz", type=int, default=1280, help="Image resolution for inference")
    parser.add_argument("--max-frames", type=int, default=None, help="Max frames to process")
    parser.add_argument("--debug", action="store_true", help="Enable verbose debug overlays")
    parser.add_argument("--live", action="store_true", help="Show frame-by-frame inference during computation")
    parser.add_argument("--no-play", action="store_true", help="Disable automatic smooth 1x playback after processing")
    args = parser.parse_args()

    pipeline = ANPRPipeline(
        video_path=args.video,
        output_video_path=args.output,
        model_path=args.model,
        plate_model_path=args.plate_model,
        conf_threshold=args.conf,
        ocr_conf_threshold=args.ocr_conf,
        min_confirmed_observations=args.min_obs,
        device=args.device,
        imgsz=args.imgsz,
        debug=args.debug,
    )

    pipeline.run(
        max_frames=args.max_frames,
        show=args.live,
        auto_play=not args.no_play,
    )


if __name__ == "__main__":
    main()
