"""
TrafficIQ - Situation 2: Ambulance Priority Simulation Test
Simulates emergency preemption injection, safe yellow/all-red clearance,
exclusive green corridor grant, and safe cyclic recovery.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from situations.ambulance_situation.ambulance_priority import AmbulancePriorityController


def test_ambulance_preemption():
    print("=" * 68)
    print("  TrafficIQ — Situation 2 Ambulance Priority Simulation Test")
    print("=" * 68)

    ctrl = AmbulancePriorityController(
        green_seconds=10.0,
        yellow_seconds=2.0,
        all_red_seconds=2.0,
        emergency_yellow_seconds=2.0,
        emergency_all_red_seconds=2.0,
        emergency_min_green_seconds=5.0,
        clearance_cooldown_seconds=1.5,
    )

    print(f"[Config] Approaches          : {' -> '.join(ctrl.sequence)}")
    print(f"[Config] Normal Phase Timing : Green={ctrl.green_seconds}s, Yellow={ctrl.yellow_seconds}s, All-Red={ctrl.all_red_seconds}s")
    print(f"[Config] Preemption Timing   : Em-Yellow={ctrl.emergency_yellow_seconds}s, Em-AllRed={ctrl.emergency_all_red_seconds}s, Min-Green={ctrl.emergency_min_green_seconds}s")
    print("-" * 68)

    dt = 0.5
    total_time = 45.0  # 45 simulated seconds
    ticks = int(total_time / dt)

    # Injected emergency interval: t = 8.0s to t = 22.0s on camera_03
    ambulance_start = 8.0
    ambulance_end = 22.0

    history = []
    max_green_violations = 0

    for tick in range(ticks):
        sim_time = tick * dt

        # Determine active emergency inputs
        active_emergencies = []
        if ambulance_start <= sim_time <= ambulance_end:
            active_emergencies.append("camera_03")

        status = ctrl.update(dt=dt, emergency_approaches=active_emergencies)
        signals = status["signals"]

        # 1. Safety Check: Invariant of at most one GREEN
        green_count = sum(1 for sig in signals.values() if sig == "GREEN")
        if green_count > 1:
            max_green_violations += 1

        history.append((sim_time, status["mode"], status["current_approach"], status["current_phase"], dict(signals)))

    assert max_green_violations == 0, f"FAILED: Detected {max_green_violations} simultaneous green violations!"
    print("[PASS] Safety Invariant Verified: Zero simultaneous green conflicts throughout preemption.")

    # 2. Inspect key milestone timestamps
    print("-" * 68)
    print("Milestone Timeline Evaluation:")
    print("-" * 68)

    def find_state_at(t_query):
        closest = min(history, key=lambda entry: abs(entry[0] - t_query))
        return closest

    t_pre_em = find_state_at(7.5)
    print(f"t= 7.5s | Before Emergency : Approach={t_pre_em[2]} | Phase={t_pre_em[3]} | Mode={t_pre_em[1]}")
    assert t_pre_em[1] == AmbulancePriorityController.MODE_NORMAL
    assert t_pre_em[2] == "camera_01"

    t_em_trigger = find_state_at(8.5)
    print(f"t= 8.5s | Emergency Injected: Approach={t_pre_em[2]} | Phase={t_em_trigger[3]} | Mode={t_em_trigger[1]}")
    assert t_em_trigger[1] == AmbulancePriorityController.MODE_PREEMPTION_CLEARING
    assert t_em_trigger[3] == "YELLOW", "Expected immediate yellow clearance transition"

    t_em_clearing = find_state_at(10.5)
    print(f"t=10.5s | Clearance Buffer : Approach={t_em_clearing[2]} | Phase={t_em_clearing[3]} | Mode={t_em_clearing[1]}")
    assert t_em_clearing[3] == "ALL_RED", "Expected all-red intersection clearance before granting green"

    t_em_grant = find_state_at(12.5)
    print(f"t=12.5s | Corridor Granted : Approach={t_em_grant[2]} | Phase={t_em_grant[3]} | Mode={t_em_grant[1]} | Signals={t_em_grant[4]}")
    assert t_em_grant[1] == AmbulancePriorityController.MODE_EMERGENCY_HOLD
    assert t_em_grant[2] == "camera_03", "Expected Camera 03 to receive the green corridor"
    assert t_em_grant[4]["camera_03"] == "GREEN"
    assert t_em_grant[4]["camera_01"] == "RED"
    assert t_em_grant[4]["camera_02"] == "RED"
    assert t_em_grant[4]["camera_04"] == "RED"

    t_em_held = find_state_at(21.5)
    print(f"t=21.5s | Corridor Held    : Approach={t_em_held[2]} | Phase={t_em_held[3]} | Mode={t_em_held[1]}")
    assert t_em_held[1] == AmbulancePriorityController.MODE_EMERGENCY_HOLD
    assert t_em_held[4]["camera_03"] == "GREEN"

    t_rec = find_state_at(25.0)
    print(f"t=25.0s | Post-Clearance   : Approach={t_rec[2]} | Phase={t_rec[3]} | Mode={t_rec[1]}")
    assert t_rec[1] == AmbulancePriorityController.MODE_RECOVERY

    t_resumed = find_state_at(32.0)
    print(f"t=32.0s | Normal Resumed   : Approach={t_resumed[2]} | Phase={t_resumed[3]} | Mode={t_resumed[1]}")
    assert t_resumed[1] == AmbulancePriorityController.MODE_NORMAL
    assert t_resumed[2] == "camera_04", f"Expected cycle to resume at Camera 04, got {t_resumed[2]}"

    print("-" * 68)
    print("[PASS] Emergency Preemption Sequence Verified:")
    print("       CAM01 GREEN -> Emergency Trigger -> CAM01 YELLOW -> ALL-RED ->")
    print("       CAM03 EMERGENCY GREEN CORRIDOR -> Clearance Cooldown ->")
    print("       CAM03 YELLOW -> ALL-RED -> Resumed at CAM04 NORMAL GREEN.")

    # 3. Test Dashboard Format
    print("-" * 68)
    print("Testing TrafficIQ Situation 2 Emergency Dashboard Format:")
    print("-" * 68)
    mock_counts = {"camera_01": 14, "camera_02": 22, "camera_03": 8, "camera_04": 19}
    dash = ctrl.format_dashboard(mock_counts)
    print(dash)
    print("-" * 68)
    assert "TRAFFICIQ" in dash
    assert "CURRENT MODE:" in dash
    print("[PASS] Situation 2 Dashboard telemetry format verified.")
    print("=" * 68)
    print("ALL SITUATION 2 AMBULANCE SIMULATION TESTS PASSED!")
    print("=" * 68)
    return True


if __name__ == "__main__":
    test_ambulance_preemption()
