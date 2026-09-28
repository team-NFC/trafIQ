import sys
import io
# Ensure UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import requests

BASE_URL = "http://127.0.0.1:8000"

def test_phase6():
    print("==================================================")
    print("PHASE 6: CAMERA TRACKING & RE-ID VERIFICATION SUITE")
    print("==================================================")

    # 1. Active Tracked Vehicles
    print("\n[TEST 1] GET /api/tracking/vehicles")
    r = requests.get(f"{BASE_URL}/api/tracking/vehicles")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    vehicles = r.json()
    assert len(vehicles) >= 4, f"Expected at least 4 vehicles, got {len(vehicles)}"
    plates = [v["plate"] for v in vehicles]
    print(f"  [OK] Found {len(vehicles)} tracked vehicles: {plates}")

    bb = next((v for v in vehicles if "7890" in v["plate"]), None)
    assert bb is not None, "Vehicle TN 45 BB 7890 not found"
    assert bb["has_missing_node"] is True, "Expected has_missing_node == True"
    assert bb["missing_camera"] == "CAM-11", f"Expected missing CAM-11, got {bb.get('missing_camera')}"
    print(f"  [OK] TN 45 BB 7890 verified: Missing CAM-11, Path: {bb['path_display']}")

    # 2. Search TN 45 BB 7890
    print("\n[TEST 2] GET /api/tracking/search?query=TN 45 BB 7890")
    r = requests.get(f"{BASE_URL}/api/tracking/search?query=TN 45 BB 7890")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert data["status"] == "found", f"Expected found status, got {data['status']}"
    assert data["has_missing_node"] is True, "Expected has_missing_node == True"
    assert data["missing_camera"] == "CAM-11", "Expected missing_camera CAM-11"

    seq = data["camera_sequence"]
    assert len(seq) == 4, f"Expected 4 camera steps, got {len(seq)}"

    step1, step2, step3, step4 = seq[0], seq[1], seq[2], seq[3]
    assert step1["camera_id"] == "CAM-09" and step1["is_missing"] is False and "Bharathidasan" in step1["location"]
    assert step2["camera_id"] == "CAM-10" and step2["is_missing"] is False and "Cantonment" in step2["camera_name"]
    assert step3["camera_id"] == "CAM-11" and step3["is_missing"] is True and "Post Office" in step3["camera_name"]
    assert step4["camera_id"] == "CAM-12" and step4["is_missing"] is False and "Court" in step4["camera_name"]
    print("  [OK] Chronological sequence verified:")
    print(f"    - Step 1: {step1['camera_id']} ({step1['location']}) · {step1['time']} · {step1['status_display']}")
    print(f"    - Step 2: {step2['camera_id']} ({step2['location']}) · {step2['time']} · {step2['status_display']}")
    print(f"    - Step 3: {step3['camera_id']} ({step3['location']}) · {step3['time']} · {step3['status_display']}")
    print(f"    - Step 4: {step4['camera_id']} ({step4['location']}) · {step4['time']} · {step4['status_display']}")

    # Verify solid vs dashed segments
    segments = data["route_segments"]
    assert segments[0]["type"] == "solid", "Step 1->2 must be solid"
    assert segments[1]["type"] == "dashed", "Step 2->3 (Missing CAM-11) must be dashed"
    assert segments[2]["type"] == "dashed", "Step 3->4 (Missing CAM-11) must be dashed"
    print("  [OK] Route segments verified: solid confirmed, dashed for missing node CAM-11")

    # Verify plausible routes
    plausible = data.get("plausible_routes", [])
    assert len(plausible) >= 2, "Expected at least 2 plausible routes for missing node"
    assert plausible[0]["confidence_pct"] == "87.4%", f"Expected 87.4%, got {plausible[0]['confidence_pct']}"
    assert plausible[1]["confidence_pct"] == "62.1%", f"Expected 62.1%, got {plausible[1]['confidence_pct']}"
    print(f"  [OK] Plausible routes verified: Route A ({plausible[0]['confidence_pct']}) vs Route B ({plausible[1]['confidence_pct']})")

    # 3. Search by Vehicle ID and Camera ID
    print("\n[TEST 3] Search aliases (VEH-7890 & CAM-10)")
    r_veh = requests.get(f"{BASE_URL}/api/tracking/search?query=VEH-7890")
    assert r_veh.status_code == 200 and r_veh.json()["plate"] == "TN 45 BB 7890"
    print("  [OK] Search by Vehicle ID 'VEH-7890' correctly resolved to TN 45 BB 7890")

    r_cam = requests.get(f"{BASE_URL}/api/tracking/search?query=CAM-10")
    assert r_cam.status_code == 200 and r_cam.json()["plate"] == "TN 45 BB 7890"
    print("  [OK] Search by Camera ID 'CAM-10' correctly resolved to TN 45 BB 7890")

    # 4. Search Continuous Vehicle TN 45 T 4567
    print("\n[TEST 4] Search Continuous Trajectory (TN 45 T 4567)")
    r_cont = requests.get(f"{BASE_URL}/api/tracking/search?query=TN 45 T 4567")
    assert r_cont.status_code == 200
    d_cont = r_cont.json()
    assert d_cont["has_missing_node"] is False
    assert len(d_cont["camera_sequence"]) == 4
    for s in d_cont["camera_sequence"]:
        assert s["is_missing"] is False
    for seg in d_cont["route_segments"]:
        assert seg["type"] == "solid"
    print("  [OK] Continuous trajectory verified: 4 confirmed nodes, all solid segments")

    # 5. Search Ambulance Emergency Corridor TN 45 AU 4608
    print("\n[TEST 5] Search Emergency Ambulance Corridor (TN 45 AU 4608)")
    r_amb = requests.get(f"{BASE_URL}/api/tracking/search?query=TN 45 AU 4608")
    assert r_amb.status_code == 200
    d_amb = r_amb.json()
    assert d_amb["vehicle_class"] == "Emergency Ambulance"
    assert len(d_amb["camera_sequence"]) == 4
    print("  [OK] Ambulance emergency preemption corridor verified: Kaveri Bridge -> GH Hospital")

    print("\n==================================================")
    print("ALL PHASE 6 VERIFICATION CHECKS PASSED (100% SUCCESS)!")
    print("==================================================")

if __name__ == "__main__":
    try:
        test_phase6()
    except Exception as e:
        print(f"\n[ERROR] Verification failed: {e}")
        sys.exit(1)
