"""
TrafficIQ - ANPR Unit Tests
Verifies:
1. IndianPlateValidator sanitization, disambiguation, and state-code validation.
2. PlateQualityFilter aspect ratio, dimension, and sharpness thresholds.
3. PlateDetector morphological and gradient localization logic.
"""

import sys
from pathlib import Path
import numpy as np
import cv2

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from anpr.plate_detection import PlateDetector
from anpr.plate_ocr import IndianPlateValidator, PlateQualityFilter, ImagePreprocessor


def test_validator():
    print("-" * 60)
    print("Testing IndianPlateValidator...")
    print("-" * 60)

    val = IndianPlateValidator()

    # Case 1: Standard Tamil Nadu plate with spaces and lowercase
    res1 = val.normalize_and_validate("tn 45 ab 1234")
    assert res1["normalized"] == "TN45AB1234", f"Expected TN45AB1234, got {res1['normalized']}"
    assert res1["is_valid"] is True
    assert res1["state_code"] == "TN"
    assert res1["formatted"] == "TN 45 AB 1234"
    print(f"[PASS] 'tn 45 ab 1234' -> {res1['formatted']} (Valid: {res1['is_valid']})")

    # Case 2: OCR confusion digit-in-state code ("1N" -> "TN") and letter-in-number ("128A" -> "1284")
    res2 = val.normalize_and_validate("1N 45 AB 128A")
    assert res2["normalized"] == "TN45AB1284", f"Expected TN45AB1284, got {res2['normalized']}"
    assert res2["is_valid"] is True
    print(f"[PASS] '1N 45 AB 128A' -> {res2['formatted']} (Valid: {res2['is_valid']})")

    # Case 3: Leading "IND" artifact stripping
    res3 = val.normalize_and_validate("IND KA 01 CD 5678")
    assert res3["normalized"] == "KA01CD5678", f"Expected KA01CD5678, got {res3['normalized']}"
    assert res3["state_code"] == "KA"
    assert res3["is_valid"] is True
    print(f"[PASS] 'IND KA 01 CD 5678' -> {res3['formatted']} (Valid: {res3['is_valid']})")

    # Case 4: Invalid/garbage text
    res4 = val.normalize_and_validate("HELLO123")
    assert res4["is_valid"] is False
    print(f"[PASS] 'HELLO123' properly flagged as invalid (Valid: {res4['is_valid']})")


def test_quality_filter():
    print("-" * 60)
    print("Testing PlateQualityFilter...")
    print("-" * 60)

    qf = PlateQualityFilter()

    # 1. Tiny crop should fail
    tiny = np.zeros((10, 20, 3), dtype=np.uint8)
    ok1, score1, reason1 = qf.evaluate_crop(tiny)
    assert not ok1
    print(f"[PASS] Tiny crop rejected: {reason1}")

    # 2. Synthetic plate crop
    plate = np.ones((50, 200, 3), dtype=np.uint8) * 240
    # Draw dark simulated text
    cv2.putText(plate, "TN45AB1234", (10, 35), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (10, 10, 10), 2)
    ok2, score2, reason2 = qf.evaluate_crop(plate)
    assert ok2
    print(f"[PASS] Clear synthetic plate accepted: score={score2}, status={reason2}")


def test_plate_detector():
    print("-" * 60)
    print("Testing PlateDetector...")
    print("-" * 60)

    pd = PlateDetector()
    print(f"[Init] Active engine: {pd.method_name}")

    # Synthetic vehicle image with bumper and plate
    veh = np.ones((200, 300, 3), dtype=np.uint8) * 100
    # Bumper plate area in lower section
    plate_region = np.ones((25, 100, 3), dtype=np.uint8) * 250
    cv2.putText(plate_region, "TN45AB1234", (5, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)
    veh[140:165, 100:200] = plate_region

    res = pd.detect_plate(veh)
    assert res is not None, "Expected plate detector to localize plate region"
    print(f"[PASS] Plate localized at: {res['bbox_vehicle']} (Confidence: {res['confidence']})")


if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING ANPR UNIT TESTS")
    print("=" * 60)
    test_validator()
    test_quality_filter()
    test_plate_detector()
    print("=" * 60)
    print("ALL ANPR UNIT TESTS PASSED!")
    print("=" * 60)
