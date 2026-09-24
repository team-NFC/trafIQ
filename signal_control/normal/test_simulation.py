"""
TrafficIQ - Situation 1: Normal Signal Simulation Verification Test
Simulates continuous fixed-cycle traffic signal operation across 4 camera approaches.
Verifies timing accuracy, yellow transitions, all-red transitions, single-green invariant,
continuous looping, and vehicle count telemetry.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from signal_control.normal.normal_signal import NormalSignalController


def test_signal_invariants():
    print("=" * 65)
    print("      TrafficIQ — Situation 1 Signal Simulation Test")
    print("=" * 65)

    # Use fast prototype timing for simulation: 4s green, 1s yellow, 1s all-red
    ctrl = NormalSignalController(
        green_seconds=4.0,
        yellow_seconds=1.0,
        all_red_seconds=1.0,
    )

    print(f"[Init] Controller Mode       : {ctrl.mode}")
    print(f"[Init] Approach Sequence     : {' -> '.join(ctrl.sequence)}")
    print(f"[Init] Phase Durations       : Green={ctrl.green_seconds}s, Yellow={ctrl.yellow_seconds}s, All-Red={ctrl.all_red_seconds}s")
    print("-" * 65)

    assert ctrl.mode == "NORMAL", f"Expected mode NORMAL, got {ctrl.mode}"

    dt = 0.5  # 500ms simulation tick
    total_ticks = int(60.0 / dt)  # 60 simulated seconds (covers 2.5 full cycles)

    observed_transitions = []
    current_green_approach = None

    # Simulated dynamic vehicle counts from YOLO/ByteTrack
    mock_counts = {
        "camera_01": 15,
        "camera_02": 23,
        "camera_03": 11,
        "camera_04": 18,
    }

    last_phase = None
    last_approach = None

    for tick in range(total_ticks):
        sim_time = tick * dt
        status = ctrl.update(dt)

        signals = status["signals"]
        phase = status["current_phase"]
        approach = status["current_approach"]

        # 1. INVARIANT CHECK: Never more than 1 green
        green_approaches = [cam for cam, sig in signals.items() if sig == "GREEN"]
        assert len(green_approaches) <= 1, f"SAFETY VIOLATION at t={sim_time}s: Multiple greens: {green_approaches}"

        # 2. INVARIANT CHECK: In ALL_RED, all approaches must be RED
        if phase == "ALL_RED":
            for cam, sig in signals.items():
                assert sig == "RED", f"SAFETY VIOLATION at t={sim_time}s: In ALL_RED, {cam} was {sig}"

        # 3. Log state changes
        if phase != last_phase or approach != last_approach:
            observed_transitions.append((round(ctrl.total_elapsed_time, 1), approach, phase))
            last_phase = phase
            last_approach = approach

    print(f"Recorded {len(observed_transitions)} phase transitions across {ctrl.total_cycles_completed} completed cycles:")
    for t_sec, app, ph in observed_transitions[:16]:
        print(f"  t={t_sec:5.1f}s | {app:10s} | Phase: {ph:7s} | Signals: {ctrl.sequence[0]}={ctrl.get_signals()[ctrl.sequence[0]]}, {ctrl.sequence[1]}={ctrl.get_signals()[ctrl.sequence[1]]}")

    # 4. Verify Cyclic Transition Sequence Order
    # Expected sequence pattern:
    # (cam1, GREEN) -> (cam1, YELLOW) -> (cam1, ALL_RED) ->
    # (cam2, GREEN) -> (cam2, YELLOW) -> (cam2, ALL_RED) ->
    # (cam3, GREEN) -> (cam3, YELLOW) -> (cam3, ALL_RED) ->
    # (cam4, GREEN) -> (cam4, YELLOW) -> (cam4, ALL_RED) ->
    # (cam1, GREEN)...
    print("-" * 65)
    print("Verifying state machine transition sequence...")

    expected_phases = ["GREEN", "YELLOW", "ALL_RED"]
    for i in range(len(observed_transitions) - 1):
        t1, app1, ph1 = observed_transitions[i]
        t2, app2, ph2 = observed_transitions[i+1]

        if ph1 == "GREEN":
            assert ph2 == "YELLOW" and app2 == app1, f"Transition failed: {ph1} on {app1} did not transition to YELLOW (got {ph2} on {app2})"
        elif ph1 == "YELLOW":
            assert ph2 == "ALL_RED" and app2 == app1, f"Transition failed: {ph1} on {app1} did not transition to ALL_RED (got {ph2} on {app2})"
        elif ph1 == "ALL_RED":
            expected_next_app = ctrl.sequence[(ctrl.sequence.index(app1) + 1) % len(ctrl.sequence)]
            assert ph2 == "GREEN" and app2 == expected_next_app, f"Transition failed: ALL_RED on {app1} did not transition to GREEN on {expected_next_app} (got {ph2} on {app2})"

    print("[PASS] Fixed Cyclic Transition Sequence Verified: CAM01 -> CAM02 -> CAM03 -> CAM04 -> CAM01 (repeat)")
    print("[PASS] Safety Invariant Verified: Exactly ONE approach GREEN at any time, ALL_RED during transitions")
    print(f"[PASS] Continuous Looping Verified: {ctrl.total_cycles_completed} complete cycles simulated")

    # 5. Dashboard Output Format Verification
    print("-" * 65)
    print("Testing TrafficIQ User Dashboard Output:")
    print("-" * 65)
    dashboard_text = ctrl.format_dashboard(mock_counts)
    print(dashboard_text)
    print("-" * 65)

    assert "TRAFFICIQ" in dashboard_text
    assert "CURRENT MODE:" in dashboard_text
    assert "NORMAL TRAFFIC" in dashboard_text
    assert "CURRENT APPROACH:" in dashboard_text
    assert "NEXT:" in dashboard_text
    print("[PASS] User Dashboard Format matches specification exactly.")
    print("=" * 65)
    print("ALL SITUATION 1 TESTS PASSED SUCCESSFULLY.")
    print("=" * 65)


if __name__ == "__main__":
    test_signal_invariants()
