"""
TrafficIQ - Independent ANPR Module
Module: plate_detection.py

Dedicated stage for localizing and cropping license plates from vehicle images.
Features:
1. Pluggable YOLO License Plate Model support:
   Automatically searches `anpr/models/` for pre-trained weights (e.g., `license_plate_detector.pt`, `best.pt`).
2. Adaptive Indian HSRP Morphological & Gradient Localizer:
   Proven fallback optimized for Indian High-Security Registration Plates:
   - Multi-scale Black-Hat & Top-Hat morphological transforms
   - Horizontal gradient (Sobel-X) edge-density profiling for embossed characters
   - Geometric aspect-ratio, area, and bumper position scoring
3. Clean high-resolution plate cropping with configurable padding margins.
"""

from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Union
import numpy as np
import cv2
import logging

logger = logging.getLogger("TrafficIQ_ANPR_PlateDetector")

# Standard Indian HSRP Aspect Ratio Ranges
# Rectangular single-line: ~500mm x 120mm -> AR ~4.16 (Acceptable: 2.0 to 5.8)
# Square two-line: ~340mm x 200mm -> AR ~1.70 (Acceptable: 1.4 to 2.4)
MIN_ASPECT_RATIO = 1.5
MAX_ASPECT_RATIO = 6.0
OPTIMAL_ASPECT_RATIO = 4.0


class PlateDetector:
    """
    Dedicated License Plate Detector & Cropper for Indian traffic CCTV feeds.
    """

    def __init__(
        self,
        yolo_model_path: Optional[Union[str, Path]] = None,
        min_confidence: float = 0.25,
        enable_yolo: bool = True,
        models_dir: Optional[Union[str, Path]] = None,
    ):
        """
        Initialize the Plate Detector.
        """
        self.min_confidence = min_confidence
        self.yolo_model = None
        self.models_dir = Path(models_dir) if models_dir else (Path(__file__).resolve().parent / "models")
        self.method_name = "Adaptive Indian HSRP Morphological & Gradient Localizer"
        self.yolo_weights_file: Optional[Path] = None

        # Check for pluggable YOLO plate model
        if enable_yolo:
            candidate_paths = [
                Path(yolo_model_path) if yolo_model_path else None,
                self.models_dir / "license_plate_detector.pt",
                self.models_dir / "plate_detector.pt",
                self.models_dir / "best.pt",
                self.models_dir / "yolov8n_plate.pt",
            ]

            for cp in candidate_paths:
                if cp and cp.exists() and cp.is_file():
                    try:
                        from ultralytics import YOLO
                        self.yolo_model = YOLO(str(cp.resolve()))
                        self.yolo_weights_file = cp
                        self.method_name = f"YOLO Plate Model ({cp.name}) + HSRP Fallback"
                        logger.info(f"Loaded YOLO license plate detector from: {cp}")
                        break
                    except Exception as e:
                        logger.warning(f"Could not load YOLO plate model from {cp}: {e}")

        logger.info(f"PlateDetector active engine: {self.method_name}")

    def detect_plate(
        self,
        vehicle_img: np.ndarray,
        vehicle_bbox: Optional[List[int]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Detects the license plate inside a vehicle crop image.

        Args:
            vehicle_img: BGR image numpy array of the cropped vehicle.
            vehicle_bbox: Optional [vx1, vy1, vx2, vy2] on the full camera frame.

        Returns:
            Dictionary with plate detection results or None if no plate found:
            {
                "bbox_vehicle": [x1, y1, x2, y2],       # Coordinates relative to vehicle crop
                "bbox_frame": [fx1, fy1, fx2, fy2],     # Coordinates relative to full video frame
                "plate_crop": np.ndarray,               # Cropped license plate image
                "confidence": float,                    # Detection confidence score (0.0 to 1.0)
                "aspect_ratio": float,                  # Width / Height
                "detection_method": str,                # Engine used
            }
        """
        if vehicle_img is None or vehicle_img.size == 0:
            return None

        h, w = vehicle_img.shape[:2]
        if w < 30 or h < 20:
            return None

        # 1. Try YOLO model if weights were found
        if self.yolo_model is not None:
            try:
                res = self.yolo_model.predict(vehicle_img, conf=self.min_confidence, verbose=False)
                if res and res[0].boxes and len(res[0].boxes) > 0:
                    box = res[0].boxes[0]
                    conf = float(box.conf[0].item())
                    xyxy = [int(v) for v in box.xyxy[0].tolist()]
                    x1, y1, x2, y2 = max(0, xyxy[0]), max(0, xyxy[1]), min(w, xyxy[2]), min(h, xyxy[3])
                    pw, ph = x2 - x1, y2 - y1
                    if pw > 12 and ph > 6:
                        plate_crop = vehicle_img[y1:y2, x1:x2]
                        bbox_frame = None
                        if vehicle_bbox:
                            vx1, vy1 = vehicle_bbox[0], vehicle_bbox[1]
                            bbox_frame = [vx1 + x1, vy1 + y1, vx1 + x2, vy1 + y2]

                        return {
                            "bbox_vehicle": [x1, y1, x2, y2],
                            "bbox_frame": bbox_frame,
                            "plate_crop": plate_crop,
                            "confidence": round(conf, 3),
                            "aspect_ratio": round(pw / float(ph), 2),
                            "detection_method": "YOLO-Plate",
                        }
            except Exception as e:
                logger.debug(f"YOLO plate detection pass failed: {e}")

        # 2. Adaptive Indian HSRP Morphological & Gradient Localizer
        return self._detect_hsrp_morphological(vehicle_img, vehicle_bbox)

    def _detect_hsrp_morphological(
        self,
        vehicle_img: np.ndarray,
        vehicle_bbox: Optional[List[int]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Localizes Indian HSRP license plates using edge-density, morphological character fusion,
        and geometric/contrast scoring.
        """
        vh, vw = vehicle_img.shape[:2]
        veh_area = vw * vh

        # Region of Interest: License plates are located in the lower 70% of the vehicle body
        roi_top = int(vh * 0.25)
        roi = vehicle_img[roi_top:vh, 0:vw]
        roi_h, roi_w = roi.shape[:2]

        if roi_h < 15 or roi_w < 25:
            return None

        gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

        # Contrast enhancement & noise reduction
        blurred = cv2.GaussianBlur(gray_roi, (5, 5), 0)

        # Extract dark alphanumeric characters on light/yellow plate background
        rect_kernel_size = (max(9, int(vw * 0.06)), max(3, int(vh * 0.02)))
        rect_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, rect_kernel_size)
        blackhat = cv2.morphologyEx(gray_roi, cv2.MORPH_BLACKHAT, rect_kernel)
        tophat = cv2.morphologyEx(gray_roi, cv2.MORPH_TOPHAT, rect_kernel)
        enhanced = cv2.add(cv2.subtract(gray_roi, blackhat), tophat)

        # Horizontal gradient (Sobel-X) to highlight vertical character stroke transitions
        sobel_x = cv2.Sobel(enhanced, cv2.CV_32F, 1, 0, ksize=3)
        sobel_x = np.absolute(sobel_x)
        min_val, max_val = np.min(sobel_x), np.max(sobel_x)
        if max_val > min_val:
            sobel_x = 255 * ((sobel_x - min_val) / (max_val - min_val))
        sobel_x = sobel_x.astype("uint8")

        # Multi-threshold binarization
        _, thresh_otsu = cv2.threshold(sobel_x, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Morphological character fusion kernel (elongated horizontally to merge plate characters)
        close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(11, int(vw * 0.07)), max(3, int(vh * 0.025))))
        closed = cv2.morphologyEx(thresh_otsu, cv2.MORPH_CLOSE, close_kernel)

        # Vertical dilation to fill full plate box height
        vert_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, max(3, int(vh * 0.02))))
        dilated = cv2.dilate(closed, vert_kernel, iterations=1)

        # Find candidate contours
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        candidates = []
        for c in contours:
            x, y, bw, bh = cv2.boundingRect(c)
            if bh == 0:
                continue

            ar = bw / float(bh)
            area = bw * bh
            area_ratio = area / float(veh_area)

            # Indian HSRP geometric filters
            if MIN_ASPECT_RATIO <= ar <= MAX_ASPECT_RATIO and 0.002 <= area_ratio <= 0.22 and bw >= 18 and bh >= 6:
                abs_y = y + roi_top

                cand_crop = vehicle_img[abs_y:abs_y + bh, x:x + bw]
                if cand_crop.size == 0:
                    continue

                gray_cand = cv2.cvtColor(cand_crop, cv2.COLOR_BGR2GRAY)
                contrast_std = float(np.std(gray_cand))

                # Scoring metrics:
                # 1. Proximity to standard HSRP aspect ratio (~4.0 single line, ~2.0 double line)
                # 2. Text contrast variance inside candidate region
                # 3. Vertical position (bumper position is rewarded)
                ar_score = 1.0 - min(abs(ar - OPTIMAL_ASPECT_RATIO) / 3.5, 0.6)
                pos_score = (abs_y + bh) / float(vh)
                contrast_score = min(contrast_std / 45.0, 1.0)

                score = (ar_score * 0.45) + (contrast_score * 0.35) + (pos_score * 0.20)

                if score >= self.min_confidence:
                    candidates.append({
                        "bbox_vehicle": [x, abs_y, x + bw, abs_y + bh],
                        "confidence": score,
                        "aspect_ratio": ar,
                    })

        if not candidates:
            return None

        # Sort and take highest-scoring candidate
        candidates.sort(key=lambda c: c["confidence"], reverse=True)
        best = candidates[0]

        bx1, by1, bx2, by2 = best["bbox_vehicle"]

        # Add 3% margin around detected plate for clean OCR borders
        pad_w = max(2, int((bx2 - bx1) * 0.04))
        pad_h = max(2, int((by2 - by1) * 0.06))
        px1 = max(0, bx1 - pad_w)
        py1 = max(0, by1 - pad_h)
        px2 = min(vw, bx2 + pad_w)
        py2 = min(vh, by2 + pad_h)

        plate_crop = vehicle_img[py1:py2, px1:px2]
        pw, ph = px2 - px1, py2 - py1

        bbox_frame = None
        if vehicle_bbox:
            vx1, vy1 = vehicle_bbox[0], vehicle_bbox[1]
            bbox_frame = [vx1 + px1, vy1 + py1, vx1 + px2, vy1 + py2]

        return {
            "bbox_vehicle": [px1, py1, px2, py2],
            "bbox_frame": bbox_frame,
            "plate_crop": plate_crop,
            "confidence": round(best["confidence"], 3),
            "aspect_ratio": round(pw / float(ph), 2),
            "detection_method": "Indian-HSRP-Morphological",
        }


if __name__ == "__main__":
    detector = PlateDetector()
    print("=" * 60)
    print("TRAFFICIQ - ANPR PLATE DETECTOR")
    print("=" * 60)
    print(f"Active Engine : {detector.method_name}")
    print(f"Models Dir    : {detector.models_dir}")
    print(f"YOLO Model    : {detector.yolo_weights_file or 'None (using Indian HSRP Fallback)'}")
    print("=" * 60)
