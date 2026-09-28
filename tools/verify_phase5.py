"""
TrafficIQ Phase 5 Verification Script:
Validates Database Alerts, FIR Case Verification, Security, and Ambulance Intelligence.
"""
import requests
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def test_phase5():
    print("=" * 66)
    print("  TrafficIQ: Phase 5 Verification Suite (Database Alerts + Ambulance)")
    print("=" * 66)

    # 1. Verified Database Alerts
    print("\n[1/8] Verifying Database Alerts Endpoint...")
    r = requests.get(f"{BASE_URL}/api/database/alerts")
    assert r.status_code == 200, f"Failed: {r.status_code}"
    alerts = r.json()
    assert len(alerts) >= 2, f"Expected >= 2 alerts, got {len(alerts)}"
    target_alert = next((a for a in alerts if "TN 45 BB 7890" in a["plate"]), None)
    assert target_alert is not None, "Target alert TN 45 BB 7890 not found"
    assert target_alert["fir_number"] == "FIR #482/2026"
    assert target_alert["case_status"] == "ACTIVE CASE"
    assert "evidence_image" in target_alert and target_alert["evidence_image"]
    print(f"  -> Verified {len(alerts)} alerts. Stolen vehicle match: {target_alert['plate']} ({target_alert['fir_number']})")

    # 2. Matching Flow (Rule: Alert ONLY when ANPR plate == DB plate)
    print("\n[2/8] Verifying Matching Flow (Plate Match vs Non-Match)...")
    # 2a. Match
    r_match = requests.post(f"{BASE_URL}/api/database/verify", json={"plate": "TN 45 BB 7890"})
    assert r_match.status_code == 200
    res_m = r_match.json()
    assert res_m["matched"] is True
    assert res_m["case"]["fir_number"] == "FIR #482/2026"
    print(f"  -> Match Confirmed: {res_m['plate']} -> {res_m['status']}")

    # 2b. Non-Match (MUST NOT generate alert)
    r_clean = requests.post(f"{BASE_URL}/api/database/verify", json={"plate": "TN 45 T 4567"})
    assert r_clean.status_code == 200
    res_c = r_clean.json()
    assert res_c["matched"] is False
    assert res_c["alert"] is None
    print(f"  -> Clean Non-Match Confirmed: {res_c['plate']} -> {res_c['status']} (Zero Alert Generated)")

    # 3. GodView Map Alert Nodes
    print("\n[3/8] Verifying Map Alert Marker Topology...")
    r_map = requests.get(f"{BASE_URL}/api/godview")
    assert r_map.status_code == 200
    gv = r_map.json()
    db_alert_nodes = [n for n in gv["nodes"] if n.get("has_database_alert")]
    assert len(db_alert_nodes) >= 1, f"Expected at least 1 node with has_database_alert, got {len(db_alert_nodes)}"
    print(f"  -> Map Alert Nodes: {[n['id'] for n in db_alert_nodes]} marked with subtle red alert beacon")

    # 4. Chronological Audit Log (Separating Matches from Clean Reads)
    print("\n[4/8] Verifying Chronological ANPR Audit Log...")
    r_audit = requests.get(f"{BASE_URL}/api/database/audit-log")
    assert r_audit.status_code == 200
    audit_items = r_audit.json()
    matches = [i for i in audit_items if i.get("matched")]
    non_matches = [i for i in audit_items if not i.get("matched")]
    assert len(matches) >= 2, "Expected >= 2 matches in audit"
    assert len(non_matches) >= 3, "Expected >= 3 clean reads in audit"
    print(f"  -> Audit Stream Verified: {len(matches)} FIR matches, {len(non_matches)} verified clean non-matches")

    # 5. Ambulance Activity (12 Ambulances, 4 Locations, Last 1 Hour)
    print("\n[5/8] Verifying Ambulance Activity Intelligence...")
    r_act = requests.get(f"{BASE_URL}/api/ambulance/activity")
    assert r_act.status_code == 200
    act = r_act.json()
    assert act["total_ambulances_detected"] == 12, f"Expected 12 ambulances, got {act['total_ambulances_detected']}"
    assert act["locations_monitored"] == 4, f"Expected 4 locations, got {act['locations_monitored']}"
    assert act["time_window"] == "Last 1 Hour"
    print(f"  -> Activity Verified: {act['total_ambulances_detected']} Ambulances across {act['locations_monitored']} Locations ({act['time_window']})")
    for loc in act["location_summary"]:
        print(f"     * {loc['location']}: {loc['count']} crossings")

    # 6. Ambulance Journey Tracker (TN 45 AU 4608)
    print("\n[6/8] Verifying Ambulance Journey Trajectory...")
    r_jrn = requests.get(f"{BASE_URL}/api/ambulance/journey")
    assert r_jrn.status_code == 200
    jrn = r_jrn.json()
    assert jrn["plate"] == "TN 45 AU 4608"
    assert len(jrn["checkpoints"]) == 4
    assert jrn["checkpoints"][0]["camera_id"] == "CAM-01"
    assert jrn["checkpoints"][-1]["camera_id"] == "CAM-07"
    print(f"  -> Ambulance Trajectory: {jrn['plate']} across {len(jrn['checkpoints'])} cameras ({jrn['corridor']})")

    # 7. Live Emergency Preemption Status
    print("\n[7/8] Verifying Live Emergency Alert API...")
    r_live = requests.get(f"{BASE_URL}/api/ambulance/live-alert")
    assert r_live.status_code == 200
    live = r_live.json()
    assert live["camera_id"] == "CAM-03"
    assert live["approach"] == "South Approach"
    print(f"  -> Live Alert Verified: Camera {live['camera_id']} ({live['approach']}) -> {live['signal_status']}")

    # 8. Security & Officer Sign-off
    print("\n[8/8] Verifying Security Authentication & Alert Sign-off...")
    r_login = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "officer_sundaram", "password": "admin"})
    assert r_login.status_code == 200
    login_data = r_login.json()
    assert login_data["user"]["role"] == "OFFICER"
    assert login_data["user"]["badge_number"] == "TN-4521"
    print(f"  -> Auth Verified: Officer {login_data['user']['full_name']} (Badge #{login_data['user']['badge_number']})")

    # Sign off an alert
    r_review = requests.post(
        f"{BASE_URL}/api/database/alerts/ALERT-2026-001/review",
        json={"action": "REVIEWED", "notes": "Automated test sign-off verification", "officer_badge": "TN-4521"}
    )
    assert r_review.status_code == 200
    rev_data = r_review.json()
    assert rev_data["new_status"] == "REVIEWED"
    print(f"  -> Alert Sign-off Verified: {rev_data['alert_id']} updated to {rev_data['new_status']}")

    print("\n" + "=" * 66)
    print("  ALL 8 PHASE 5 VERIFICATION SUITES PASSED CLEANLY (100%)")
    print("=" * 66)

if __name__ == "__main__":
    try:
        test_phase5()
    except Exception as e:
        print(f"\nVerification Failed: {e}")
        sys.exit(1)
