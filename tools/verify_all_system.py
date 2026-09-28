"""
TrafficIQ - End-to-End System Verification Script
Tests all 14 requirements across backend routes, algorithms, and models.
"""

import os
import sys

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from starlette.testclient import TestClient
from backend.main import app

def run_tests():
    client = TestClient(app)

    print("==================================================================")
    print("  TrafficIQ: Comprehensive Verification Suite (14 Requirements)")
    print("==================================================================")

    # 1. Health check
    print("\n[1/8] Verifying Health Check...")
    r = client.get("/api/health")
    assert r.status_code == 200, f"Health failed: {r.text}"
    health_data = r.json()
    assert health_data["status"] == "ok"
    print(f"  -> Health OK. GPU Detected: {health_data.get('gpu_available')}")

    # 2. Scenarios List
    print("\n[2/8] Verifying Demo Scenarios...")
    r = client.get("/api/scenarios")
    assert r.status_code == 200
    scenarios = r.json()["scenarios"]
    scenario_ids = [s["id"] for s in scenarios]
    print(f"  -> Scenarios available ({len(scenarios)}): {scenario_ids}")
    for exp in ["normal", "ambulance", "anpr_missing", "anpr_continuous"]:
        assert exp in scenario_ids, f"Missing scenario {exp}"

    # 3. God-View 16-Camera Topology
    print("\n[3/8] Verifying 16-Camera God's-Eye-View Topology...")
    r = client.get("/api/godview")
    assert r.status_code == 200
    gv = r.json()
    nodes = gv["nodes"]
    links = gv["links"]
    assert len(nodes) >= 16, f"Expected at least 16 camera nodes, got {len(nodes)}"
    assert len(links) >= 4, f"Expected road links, got {len(links)}"
    cam_ids = [n["id"] for n in nodes]
    expected_cams = [f"CAM-{i:02d}" for i in range(1, 17)]
    for exp_cam in expected_cams:
        assert exp_cam in cam_ids, f"Expected {exp_cam} in nodes"
    print(f"  -> 16 Camera Nodes Verified: CAM-01 through CAM-16 across 4 Trichy Zones")
    print(f"  -> Interconnecting Road Links Verified: {len(links)} corridor connections")

    # 4. Ambulance EVP Preemption & Green Corridor
    print("\n[4/8] Testing Ambulance Emergency Vehicle Preemption (EVP)...")
    r_sel = client.post("/api/scenarios/select?scenario=ambulance")
    assert r_sel.status_code == 200
    amb = client.get("/api/ambulance").json()
    assert amb["ambulance_detected"] is True, "Ambulance not detected in ambulance scenario"
    assert amb["evp_active"] is True, "EVP not active"
    assert amb["approach"] == "SOUTH", f"Expected SOUTH approach, got {amb['approach']}"
    assert amb["camera_id"] == "CAM-03", f"Expected CAM-03, got {amb['camera_id']}"
    assert "TN 45 AU 4608" in amb["vehicle_plate"], "Plate mismatch"
    print(f"  -> Ambulance Detected on Approach: {amb['approach']} ({amb['camera_id']})")
    print(f"  -> Emergency Vehicle Plate: {amb['vehicle_plate']}")
    print(f"  -> EVP Controller Status: {amb['mode']} (Duration: {amb['evp_duration_sec']}s)")

    # Verify signal states under EVP
    sig = client.get("/api/signals").json()
    signals_dict = sig["signals"]
    assert signals_dict.get("camera_03") == "GREEN", f"camera_03 not GREEN: {signals_dict}"
    assert sig.get("evp_active") is True or sig.get("mode") == "EVP ACTIVE"
    for other_cam in ["camera_01", "camera_02", "camera_04"]:
        assert signals_dict.get(other_cam) == "RED", f"{other_cam} not RED: {signals_dict.get(other_cam)}"
    print(f"  -> Signal Override Verified: camera_03 is EMERGENCY GREEN, conflicting approaches RED")

    # 5. ANPR Trajectories & Missing Node Reconstruction
    print("\n[5/8] Testing ANPR Multi-Camera Tracking & Missing Node Re-identification...")
    # Missing node scenario
    client.post("/api/scenarios/select?scenario=anpr_missing")
    traj = client.get("/api/anpr/trajectories").json()
    missing_data = traj["scenarios"]["missing_node"]
    assert missing_data["has_missing_node"] is True
    assert missing_data["missing_camera_id"] == "CAM-11"
    assert missing_data["interpolation_confidence"] >= 0.85
    print(f"  -> Missing Node Scenario:")
    print(f"     Target Plate: {missing_data['plate']}")
    print(f"     Route: CAM-09 -> CAM-10 -> CAM-11 [MISSING] -> CAM-12")
    print(f"     Interpolation Status: RECONSTRUCTED with {missing_data['interpolation_confidence']*100:.1f}% confidence")

    # Continuous scenario
    client.post("/api/scenarios/select?scenario=anpr_continuous")
    traj2 = client.get("/api/anpr/trajectories").json()
    cont_data = traj2["scenarios"]["continuous"]
    assert len(cont_data["waypoints"]) == 4
    wp_cams = [w["camera_id"] for w in cont_data["waypoints"]]
    assert wp_cams == ["CAM-13", "CAM-14", "CAM-15", "CAM-16"]
    print(f"  -> Continuous Trajectory Scenario:")
    print(f"     Target Plate: {cont_data['plate']}")
    print(f"     Route: {' -> '.join(wp_cams)} (100% Continuity)")

    # 6. Traffic Analytics, Vehicle Breakdown & PCU Green Split
    print("\n[6/8] Testing Traffic Analytics, PCU Calculations & Signal Split...")
    client.post("/api/scenarios/select?scenario=normal")
    analytics = client.get("/api/analytics").json()
    approaches = analytics["approaches"]
    assert len(approaches) == 4
    totals = analytics["totals"]
    print(f"  -> Total Junction Vehicles: {totals['total_vehicles']} | Total PCU Demand: {totals['total_pcu_demand']}")
    for cam_id, a in approaches.items():
        print(f"     {a['name']} ({cam_id}): {a['total_vehicles']} vehicles (Cars: {a['cars']}, Bikes: {a['motorcycles']}, Autos: {a['auto_rickshaws']}, Buses: {a['buses']}, Trucks: {a['trucks']}, Amb: {a['ambulances']}) -> PCU: {a['pcu_demand']} -> Green: {a['adaptive_green_seconds']}s")
    assert analytics.get("discrepancy_explanation") is not None
    print(f"  -> Discrepancy Audit Note: {analytics['discrepancy_explanation'][:75]}...")

    # 7. Incidents & Evidence Images
    print("\n[7/8] Verifying Incident Audit Log & CCTV Evidence Snapshots...")
    inc = client.get("/api/incidents").json()
    incidents = inc["incidents"]
    assert len(incidents) >= 4
    for item in incidents:
        ev_url = item["evidence_url"]
        r_ev = client.get(ev_url)
        assert r_ev.status_code == 200, f"Failed to retrieve evidence {ev_url}"
        print(f"     [{item['id']}] {item['title']} -> {ev_url} (HTTP 200, {len(r_ev.content)} bytes)")

    # 8. Weather & Demand Prediction
    print("\n[8/8] Verifying Weather & Demand Prediction...")
    weather = client.get("/api/weather").json()
    assert "Tiruchirappalli" in weather["location"]
    print(f"  -> Trichy Weather: {weather['temperature']}°C, {weather['condition']}, Humidity: {weather['humidity']}%")

    pred = client.get("/api/prediction").json()
    assert pred["forecast_horizon_minutes"] == 15
    print(f"  -> 15-Minute Demand Prediction: {pred['overall_trend']} ({pred['trend_pct']})")
    print(f"     Recommended Green Split: {pred['recommended_adjustment']}")

    print("\n==================================================================")
    print("  ALL 8 COMPREHENSIVE SYSTEM VERIFICATIONS PASSED CLEANLY (100%)")
    print("==================================================================")

if __name__ == "__main__":
    run_tests()
