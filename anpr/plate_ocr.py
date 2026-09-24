"""
TrafficIQ - Independent ANPR Module
Module: plate_ocr.py

Comprehensive OCR engine for Indian License Plates:
1. PlateQualityFilter: Rejects blurry, undersized, or washed-out crops before OCR.
2. ImagePreprocessor: Adaptive CLAHE contrast enhancement, super-resolution upscaling, bilateral filtering.
3. IndianPlateValidator: Alphanumeric sanitization, state-code validation, and contextual digit/letter disambiguation.
4. PlateOCR: Deep-learning text recognition using PaddleOCR 3.7.0.
"""

import os
import re
import warnings
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union
import numpy as np
import cv2
import logging

# Suppress verbose Paddle log spam
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"
os.environ["ORT_LOGGING_LEVEL"] = "3"
warnings.filterwarnings("ignore")

logger = logging.getLogger("TrafficIQ_ANPR_OCR")

# Indian State & Union Territory 2-letter codes
INDIAN_STATE_CODES = {
    "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN",
    "GA", "GJ", "HP", "HR", "JH", "JK", "KA", "KL", "LA", "LD",
    "MH", "ML", "MN", "MP", "MZ", "NL", "OD", "PB", "PY", "RJ",
    "SK", "TN", "TR", "TS", "UK", "UP", "WB"
}

# OCR confusion dictionaries
DIGIT_TO_CHAR = {"0": "O", "1": "I", "2": "Z", "4": "A", "5": "S", "6": "G", "8": "B"}
CHAR_TO_DIGIT = {"O": "0", "I": "1", "Z": "2", "A": "4", "S": "5", "G": "6", "B": "8", "D": "0", "Q": "0"}


class PlateQualityFilter:
    """
    Evaluates candidate license plate crops to filter out unreadable samples.
    """

    def __init__(
        self,
        min_width: int = 35,
        min_height: int = 12,
        min_sharpness: float = 20.0,
        min_contrast: float = 14.0,
        min_aspect_ratio: float = 1.4,
        max_aspect_ratio: float = 6.2,
    ):
        self.min_width = min_width
        self.min_height = min_height
        self.min_sharpness = min_sharpness
        self.min_contrast = min_contrast
        self.min_aspect_ratio = min_aspect_ratio
        self.max_aspect_ratio = max_aspect_ratio

    def evaluate_crop(self, crop: np.ndarray) -> Tuple[bool, float, str]:
        """
        Assesses crop quality. Returns (is_acceptable, quality_score, reason).
        """
        if crop is None or crop.size == 0:
            return False, 0.0, "EMPTY_CROP"

        h, w = crop.shape[:2]
        ar = w / float(h) if h > 0 else 0.0

        if w < self.min_width or h < self.min_height:
            return False, 0.1, f"TOO_SMALL ({w}x{h})"

        if ar < self.min_aspect_ratio or ar > self.max_aspect_ratio:
            return False, 0.2, f"INVALID_ASPECT_RATIO ({ar:.2f})"

        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if len(crop.shape) == 3 else crop

        # Sharpness via Laplacian variance
        lap = cv2.Laplacian(gray, cv2.CV_64F)
        sharpness = float(lap.var())
        if sharpness < self.min_sharpness:
            return False, 0.3, f"TOO_BLURRY ({sharpness:.1f})"

        # Contrast via standard deviation
        contrast = float(np.std(gray))
        if contrast < self.min_contrast:
            return False, 0.4, f"LOW_CONTRAST ({contrast:.1f})"

        # Calculate composite score
        score = min(1.0, (sharpness / 120.0) * 0.5 + (contrast / 60.0) * 0.5)
        return True, round(score, 3), "PASSED"


class ImagePreprocessor:
    """
    Applies adaptive image enhancement tailored for character recognition.
    """

    @staticmethod
    def preprocess_for_ocr(plate_crop: np.ndarray, target_width: int = 320) -> np.ndarray:
        """
        Enhances license plate crop: upscaling, bilateral smoothing, and CLAHE.
        """
        if plate_crop is None or plate_crop.size == 0:
            return plate_crop

        h, w = plate_crop.shape[:2]

        # 1. Optimal Upscaling (PaddleOCR performs best around 300px width)
        if w < target_width:
            scale = target_width / float(w)
            new_h = int(h * scale)
            plate_crop = cv2.resize(plate_crop, (target_width, new_h), interpolation=cv2.INTER_CUBIC)

        # 2. Convert to LAB color space for luminance-only CLAHE
        lab = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)

        # Apply CLAHE to L-channel
        clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
        cl = clahe.apply(l_channel)

        # Merge channels back
        limg = cv2.merge((cl, a_channel, b_channel))
        enhanced_bgr = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

        # 3. Bilateral filter to smooth noise while preserving sharp font edges
        filtered = cv2.bilateralFilter(enhanced_bgr, d=5, sigmaColor=50, sigmaSpace=50)

        return filtered


class IndianPlateValidator:
    """
    Sanitizes, normalizes, and validates Indian vehicle registration plates.
    Standard Format: [State: 2 letters] [RTO: 1-2 digits] [Series: 0-3 letters] [Number: 4 digits]
    Examples: TN45AB1234, DL01C1234, KA05MH9999, KL07CD1234
    """

    @classmethod
    def sanitize(cls, raw_text: str) -> str:
        """Removes spaces, punctuation, special symbols, and converts to uppercase."""
        cleaned = re.sub(r"[^A-Za-z0-9]", "", raw_text).upper()
        # Strip common leading/trailing artifacts like 'IND' country identifier
        if cleaned.startswith("IND") and len(cleaned) > 7:
            cleaned = cleaned[3:]
        return cleaned

    @classmethod
    def normalize_and_validate(cls, raw_text: str) -> Dict[str, Any]:
        """
        Normalizes OCR text using Indian plate structural rules.
        Returns:
            {
                "raw_text": str,
                "normalized": str,
                "formatted": str,
                "is_valid": bool,
                "state_code": str or None,
            }
        """
        sanitized = cls.sanitize(raw_text)
        if len(sanitized) < 6:
            return {
                "raw_text": raw_text,
                "normalized": sanitized,
                "formatted": sanitized,
                "is_valid": False,
                "state_code": None,
            }

        chars = list(sanitized)

        # Rule 1: Characters 0 & 1 must be state letters (e.g. TN, DL, KA)
        if len(chars) >= 2:
            chars[0] = DIGIT_TO_CHAR.get(chars[0], chars[0])
            chars[1] = DIGIT_TO_CHAR.get(chars[1], chars[1])

        # Rule 2: Characters 2 & 3 should be RTO district digits
        if len(chars) >= 4:
            chars[2] = CHAR_TO_DIGIT.get(chars[2], chars[2])
            chars[3] = CHAR_TO_DIGIT.get(chars[3], chars[3])

        # Rule 3: Last 4 characters should be digits
        if len(chars) >= 8:
            for idx in range(len(chars) - 4, len(chars)):
                chars[idx] = CHAR_TO_DIGIT.get(chars[idx], chars[idx])

        normalized = "".join(chars)

        # Check state code
        state_code = normalized[:2]
        if state_code not in INDIAN_STATE_CODES:
            # Common OCR misreadings for state code prefix
            STATE_CORRECTIONS = {
                "1N": "TN", "7N": "TN", "IN": "TN",
                "0L": "DL", "D1": "DL", "OI": "DL",
                "K4": "KA", "K1": "KL",
                "M8": "MH", "A0": "AP",
                "T5": "TS", "R1": "RJ",
                "U0": "UP", "M0": "MP",
                "G1": "GJ", "W8": "WB",
            }
            if state_code in STATE_CORRECTIONS:
                fixed_state = STATE_CORRECTIONS[state_code]
                chars[0], chars[1] = fixed_state[0], fixed_state[1]
                normalized = "".join(chars)
                state_code = fixed_state

        is_known_state = state_code in INDIAN_STATE_CODES

        # If not a recognized Indian state code, preserve raw sanitized text without artificial conversions
        if not is_known_state:
            return {
                "raw_text": raw_text,
                "normalized": sanitized,
                "formatted": sanitized,
                "is_valid": False,
                "state_code": None,
            }

        # Regex match for standard Indian registration format
        # e.g., TN45AB1234 or DL1C1234
        pattern = r"^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$"
        is_valid_format = bool(re.match(pattern, normalized))

        # Human-readable formatted string: "TN 45 AB 1234"
        formatted = normalized
        m = re.match(r"^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{4})$", normalized)
        if m:
            parts = [p for p in m.groups() if p]
            formatted = " ".join(parts)

        return {
            "raw_text": raw_text,
            "normalized": normalized,
            "formatted": formatted,
            "is_valid": is_valid_format,
            "state_code": state_code,
        }


class PlateOCR:
    """
    Deep-learning OCR Engine wrapping PaddleOCR.
    """

    def __init__(self, use_gpu: bool = True):
        self.use_gpu = use_gpu
        self.quality_filter = PlateQualityFilter()
        self.preprocessor = ImagePreprocessor()
        self.validator = IndianPlateValidator()
        self.ocr_engine = None

        self._init_paddle_ocr()

    def _init_paddle_ocr(self) -> None:
        """Initializes PaddleOCR instance with ONNX engine."""
        try:
            from paddleocr import PaddleOCR
            self.ocr_engine = PaddleOCR(lang="en", engine="onnxruntime", device="cpu")
            logger.info("PaddleOCR 3.7.0 (ONNX engine) successfully initialized.")
        except Exception as e:
            logger.warning(f"PaddleOCR onnxruntime initialization failed: {e}. Attempting fallback.")
            try:
                from paddleocr import PaddleOCR
                self.ocr_engine = PaddleOCR(lang="en")
            except Exception as e2:
                logger.error(f"Could not load PaddleOCR: {e2}")
                self.ocr_engine = None

    def read_plate(self, plate_crop: np.ndarray) -> Optional[Dict[str, Any]]:
        """
        Processes plate crop and returns structured OCR reading.
        """
        if plate_crop is None or plate_crop.size == 0 or self.ocr_engine is None:
            return None

        # 1. Quality gate
        is_ok, q_score, q_msg = self.quality_filter.evaluate_crop(plate_crop)
        if not is_ok:
            return {
                "raw_text": "",
                "normalized_text": "",
                "formatted_text": "",
                "confidence": 0.0,
                "is_valid_indian_plate": False,
                "quality_score": q_score,
                "quality_status": q_msg,
            }

        # 2. Preprocess crop
        enhanced = self.preprocessor.preprocess_for_ocr(plate_crop)

        # 3. PaddleOCR Inference (support both .predict() and .ocr() across PaddleOCR versions)
        extracted_lines = []
        confidences = []

        try:
            if hasattr(self.ocr_engine, "predict"):
                results = self.ocr_engine.predict(enhanced)
                for res in results:
                    if isinstance(res, dict):
                        t_list = res.get("rec_texts", [])
                        s_list = res.get("rec_scores", [])
                        for t, s in zip(t_list, s_list):
                            t_clean = str(t).strip()
                            if t_clean:
                                extracted_lines.append(t_clean)
                                confidences.append(float(s))
                    elif isinstance(res, list):
                        for line in res:
                            if len(line) >= 2 and isinstance(line[1], (list, tuple)):
                                extracted_lines.append(str(line[1][0]).strip())
                                confidences.append(float(line[1][1]))
            else:
                results = self.ocr_engine.ocr(enhanced)
                for page in results:
                    if not page:
                        continue
                    for line in page:
                        if len(line) >= 2 and isinstance(line[1], (list, tuple)):
                            extracted_lines.append(str(line[1][0]).strip())
                            confidences.append(float(line[1][1]))
        except Exception as e:
            logger.debug(f"OCR inference exception: {e}")
            return None

        if not extracted_lines:
            return None

        raw_text = "".join(extracted_lines)
        avg_conf = float(np.mean(confidences)) if confidences else 0.0

        # 4. Indian Plate Normalization & Validation
        val_result = self.validator.normalize_and_validate(raw_text)

        return {
            "raw_text": raw_text,
            "normalized_text": val_result["normalized"],
            "formatted_text": val_result["formatted"],
            "confidence": round(avg_conf, 3),
            "is_valid_indian_plate": val_result["is_valid"],
            "state_code": val_result["state_code"],
            "quality_score": q_score,
            "quality_status": q_msg,
            "processed_crop": enhanced,
        }


if __name__ == "__main__":
    print("=" * 60)
    print("TRAFFICIQ - ANPR PLATE OCR ENGINE TEST")
    print("=" * 60)
    validator = IndianPlateValidator()
    test_cases = ["TN 45 AB 1234", "tn45ab1284", "DL 01 C 9999", "IND KA05MH1234", "1N45AB1284"]
    for tc in test_cases:
        res = validator.normalize_and_validate(tc)
        print(f"Raw: {tc:<15} -> Normalized: {res['normalized']:<12} | Formatted: {res['formatted']:<15} | Valid: {res['is_valid']}")
    print("=" * 60)
