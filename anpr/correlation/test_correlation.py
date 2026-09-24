"""
TrafficIQ - Independent ANPR Module
Module: test_correlation.py

Comprehensive test suite verifying:
- Test 1: CAM01-CAM05 dynamic handling (CAM01-CAM04 correlate, CAM05 foreign plate remains separate).
- Test 2: Missing video detection & stale-output protection (missing video skips camera and ignores old JSON).
- Test 3: Foreign plate single-camera observation classification.
- Test 4: Genuine 5-camera journey when matching plate is observed across all 5 cameras.
- Test 5: Arbitrary N-camera dynamic scaling (e.g. 8 cameras: CAM01-CAM08) without hardcoded limits.
"""

import sys
import json
import tempfile
from pathlib import Path
from datetime import datetime

# Setup project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from anpr.correlation.vehicle_correlator import (
    VehicleCorrelator,
    parse_clock_time,
    parse_video_timestamp_seconds,
    are_ocr_plates_equivalent,
)
from anpr.correlation.correlation_pipeline import find_camera_video, run_correlation_pipeline


def test_time_math():
    print("------------------------------------------------------------")
    print("Testing Real-World Clock Time Synchronization...")
    print("------------------------------------------------------------")
    t1 = parse_clock_time("08:00:00")
    assert t1.hour == 8 and t1.minute == 0 and t1.second == 0

    assert parse_video_timestamp_seconds("660.0s") == 660.0
    assert parse_video_timestamp_seconds("4.44s") == 4.44
    assert parse_video_timestamp_seconds("00:11") == 11.0
    print("[PASS] Clock time and video timestamp parsing verified.")


def test_ocr_plate_equivalence():
    print("------------------------------------------------------------")
    print("Testing OCR Character Ambiguity Equivalence...")
    print("------------------------------------------------------------")
    # Exact match
    assert are_ocr_plates_equivalent("TN38AB1234", "TN38AB1234") is True
    assert are_ocr_plates_equivalent("tn 38 ab 1234", "TN38AB1234") is True

    # 3 <-> B ambiguity
    assert are_ocr_plates_equivalent("TN38AB1234", "TN38AB12B4") is True

    # 8 <-> B ambiguity
    assert are_ocr_plates_equivalent("TNB8AB1234", "TN88AB1234") is True

    # 0 <-> O ambiguity
    assert are_ocr_plates_equivalent("TN01AB1234", "TNO1AB1234") is True

    # 5 <-> S ambiguity
    assert are_ocr_plates_equivalent("TN45AB1234", "TN4SAB1234") is True

    # Completely different plates
    assert are_ocr_plates_equivalent("TN38AB1234", "DL01CD5678") is False
    assert are_ocr_plates_equivalent("TN38AB1234", "TN38AB9999") is False

    print("[PASS] OCR ambiguity clustering verified.")


def test_case_1_cam01_to_cam05_dynamic():
    print("------------------------------------------------------------")
    print("TEST 1: CAM01-CAM05 Dynamic Handling...")
    print("------------------------------------------------------------")
    config = {
        "cameras": {
            "camera_01": {"location": "Junction A", "start_time": "08:00:00"},
            "camera_02": {"location": "Junction B", "start_time": "08:05:00"},
            "camera_03": {"location": "Junction C", "start_time": "08:10:00"},
            "camera_04": {"location": "Junction D", "start_time": "08:20:00"},
            "camera_05": {"location": "Additional City Camera", "start_time": "08:25:00"},
        }
    }

    correlator = VehicleCorrelator(camera_config=config)

    # CAM01-CAM04 have same vehicle: TN45BB7890
    correlator.add_camera_anpr_results("camera_01", {
        "confirmed_vehicles": [{"vehicle_id": 1, "plate_number": "TN 45 BB 7890", "confidence": 0.99, "timestamp": "2.0s"}]
    })
    correlator.add_camera_anpr_results("camera_02", {
        "confirmed_vehicles": [{"vehicle_id": 1, "plate_number": "TN 45 BB 7890", "confidence": 0.98, "timestamp": "2.0s"}]
    })
    correlator.add_camera_anpr_results("camera_03", {
        "confirmed_vehicles": [{"vehicle_id": 1, "plate_number": "TN 45 BB 7890", "confidence": 0.97, "timestamp": "2.0s"}]
    })
    correlator.add_camera_anpr_results("camera_04", {
        "confirmed_vehicles": [{"vehicle_id": 1, "plate_number": "TN 45 BB 7890", "confidence": 0.99, "timestamp": "2.0s"}]
    })

    # CAM05 has foreign footage (unrelated plates)
    correlator.add_camera_anpr_results("camera_05", {
        "confirmed_vehicles": [
            {"vehicle_id": 2, "plate_number": "AJ 08 HCH", "confidence": 0.89, "timestamp": "4.4s"},
            {"vehicle_id": 4, "plate_number": "OE 56 WAA", "confidence": 0.90, "timestamp": "9.2s"},
        ]
    })

    report = correlator.correlate()
    assert report["multi_camera_vehicles_count"] == 1, "Only TN 45 BB 7890 should be a multi-camera vehicle"
    assert report["single_camera_vehicles_count"] == 2, "AJ08HCH and OE56WAA should be single-camera observations"

    v = report["correlations"][0]
    assert v["canonical_plate"] == "TN45BB7890"
    assert v["cameras_detected_count"] == 4
    assert v["cameras_visited"] == ["camera_01", "camera_02", "camera_03", "camera_04"]
    assert "camera_05" not in v["cameras_visited"]

    ascii_out = correlator.format_ascii_journey()
    assert "CAMERA05:" in ascii_out
    assert "No matching observation for TN 45 BB 7890" in ascii_out
    assert "AJ08HCH" in ascii_out or "AJ 08 HCH" in ascii_out

    print("[PASS] TEST 1: CAM01-CAM04 correlated; CAM05 foreign plates remain separate.")


def test_case_2_missing_video_stale_protection():
    print("------------------------------------------------------------")
    print("TEST 2: Missing Video Detection & Stale-Output Protection...")
    print("------------------------------------------------------------")
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        vid_dir = tmp_path / "videos"
        out_dir = tmp_path / "output"
        vid_dir.mkdir()
        out_dir.mkdir()

        # Create videos for cam1, cam2, cam4, cam5 (NO camera_03.mp4!)
        (vid_dir / "camera_01.mp4").write_text("fake video")
        (vid_dir / "camera_02.mp4").write_text("fake video")
        (vid_dir / "camera_04.mp4").write_text("fake video")
        (vid_dir / "camera_05.mp4").write_text("fake video")

        # But create an OLD/STALE camera_03 JSON in output dir
        (out_dir / "camera_01_anpr_results.json").write_text(json.dumps({
            "confirmed_vehicles": [{"vehicle_id": 1, "plate_number": "TN 45 BB 7890", "confidence": 0.99, "timestamp": "2.0s"}]
        }))
        (out_dir / "camera_02_anpr_results.json").write_text(json.dumps({
            "confirmed_vehicles": [{"vehicle_id": 1, "plate_number": "TN 45 BB 7890", "confidence": 0.99, "timestamp": "2.0s"}]
        }))
        # Stale JSON for missing camera_03:
        (out_dir / "camera_03_anpr_results.json").write_text(json.dumps({
            "confirmed_vehicles": [{"vehicle_id": 1, "plate_number": "TN 45 BB 7890", "confidence": 0.99, "timestamp": "2.0s"}]
        }))
        (out_dir / "camera_04_anpr_results.json").write_text(json.dumps({
            "confirmed_vehicles": [{"vehicle_id": 1, "plate_number": "TN 45 BB 7890", "confidence": 0.99, "timestamp": "2.0s"}]
        }))
        (out_dir / "camera_05_anpr_results.json").write_text(json.dumps({
            "confirmed_vehicles": [{"vehicle_id": 2, "plate_number": "AJ 08 HCH", "confidence": 0.89, "timestamp": "4.4s"}]
        }))

        # Config defining all 5 cameras
        config_file = tmp_path / "camera_config.json"
        config_file.write_text(json.dumps({
            "cameras": {
                "camera_01": {"location": "Junction A", "start_time": "08:00:00"},
                "camera_02": {"location": "Junction B", "start_time": "08:05:00"},
                "camera_03": {"location": "Junction C", "start_time": "08:10:00"},
                "camera_04": {"location": "Junction D", "start_time": "08:20:00"},
                "camera_05": {"location": "Additional City Camera", "start_time": "08:25:00"},
            }
        }))

        # Run pipeline
        run_correlation_pipeline(
            config_path=config_file,
            video_dir=vid_dir,
            output_dir=out_dir,
            reprocess=False,
        )

        # Inspect resulting JSON: camera_03 MUST NOT be included!
        with open(out_dir / "citywide_correlation.json", "r") as f:
            corr_data = json.load(f)

        v = corr_data["correlations"][0]
        assert "camera_03" not in v["cameras_visited"], "Stale output protection failed: camera_03 was included despite missing video!"
        assert v["cameras_detected_count"] == 3  # only cam01, cam02, cam04

        print("[PASS] TEST 2: Missing camera_03 was successfully skipped; stale JSON ignored.")


def test_case_3_foreign_plate_single_camera():
    print("------------------------------------------------------------")
    print("TEST 3: Foreign Plate Single-Camera Observation...")
    print("------------------------------------------------------------")
    correlator = VehicleCorrelator({
        "cameras": {
            "camera_05": {"location": "Additional City Camera", "start_time": "08:25:00"}
        }
    })

    correlator.add_camera_anpr_results("camera_05", {
        "confirmed_vehicles": [
            {
                "vehicle_id": 99,
                "plate_number": "XYZ 123",
                "confidence": 0.91,
                "timestamp": "15.0s",
                "vehicle_class": "car",
            }
        ]
    })

    res = correlator.correlate()
    assert res["multi_camera_vehicles_count"] == 0
    assert res["single_camera_vehicles_count"] == 1
    sc = res["single_camera_vehicles"][0]
    assert sc["canonical_plate"] == "XYZ123"
    assert sc["cameras_detected_count"] == 1
    assert sc["journey"][0]["camera"] == "camera_05"

    print("[PASS] TEST 3: Foreign plate in CAM05 correctly recorded as Single-Camera Observation.")


def test_case_4_genuine_5_camera_journey():
    print("------------------------------------------------------------")
    print("TEST 4: Genuine 5-Camera Journey...")
    print("------------------------------------------------------------")
    config = {
        "cameras": {
            "camera_01": {"location": "Junction A", "start_time": "08:00:00"},
            "camera_02": {"location": "Junction B", "start_time": "08:05:00"},
            "camera_03": {"location": "Junction C", "start_time": "08:10:00"},
            "camera_04": {"location": "Junction D", "start_time": "08:20:00"},
            "camera_05": {"location": "Junction E", "start_time": "08:25:00"},
        }
    }

    correlator = VehicleCorrelator(camera_config=config)
    # Same plate observed across all 5 cameras!
    for i in range(1, 6):
        correlator.add_camera_anpr_results(f"camera_{i:02d}", {
            "confirmed_vehicles": [
                {"vehicle_id": i, "plate_number": "MH 12 DE 7777", "confidence": 0.95, "timestamp": "30.0s"}
            ]
        })

    res = correlator.correlate()
    assert res["multi_camera_vehicles_count"] == 1
    v = res["correlations"][0]
    assert v["cameras_detected_count"] == 5
    assert len(v["journey"]) == 5
    assert len(v["travel_times"]) == 4

    print("[PASS] TEST 4: Full 5-camera journey reconstructed when genuine plate matches all cameras.")


def test_case_5_dynamic_n_cameras():
    print("------------------------------------------------------------")
    print("TEST 5: Arbitrary N-Camera Dynamic Scaling (CAM01-CAM08)...")
    print("------------------------------------------------------------")
    # Dynamically configure 8 cameras without any hardcoded limitations
    config = {
        "cameras": {f"camera_{i:02d}": {"location": f"Junction {chr(64+i)}", "start_time": f"08:{i*5:02d}:00"} for i in range(1, 9)}
    }
    assert len(config["cameras"]) == 8

    correlator = VehicleCorrelator(camera_config=config)
    for i in range(1, 9):
        correlator.add_camera_anpr_results(f"camera_{i:02d}", {
            "confirmed_vehicles": [{"vehicle_id": 1, "plate_number": "KA 01 MG 8888", "confidence": 0.96, "timestamp": "10s"}]
        })

    res = correlator.correlate()
    v = res["correlations"][0]
    assert v["cameras_detected_count"] == 8
    assert len(v["journey"]) == 8
    assert len(v["travel_times"]) == 7

    print("[PASS] TEST 5: Scaled to 8 cameras dynamically with zero hardcoded constraints.")


def run_all_tests():
    print("=" * 65)
    print("    RUNNING COMPREHENSIVE CITY-WIDE CORRELATION TEST SUITE")
    print("=" * 65)
    test_time_math()
    test_ocr_plate_equivalence()
    test_case_1_cam01_to_cam05_dynamic()
    test_case_2_missing_video_stale_protection()
    test_case_3_foreign_plate_single_camera()
    test_case_4_genuine_5_camera_journey()
    test_case_5_dynamic_n_cameras()
    print("=" * 65)
    print("   ALL 5 CORRELATION TEST SUITES PASSED FLAWLESSLY!")
    print("=" * 65)


if __name__ == "__main__":
    run_all_tests()
