"""
TrafficIQ - Situation 2: Ambulance Priority Traffic Signal Controller
Manages Emergency Vehicle Preemption (EVP) for 4-way CCTV intersections.

Phases & State Transitions:
1. NORMAL: Fixed-cycle CAM01 -> CAM02 -> CAM03 -> CAM04 -> repeat.
2. PREEMPTION_CLEARING: Emergency detected on CAM X while CAM Y is GREEN.
   Safely transitions CAM Y: GREEN -> YELLOW -> ALL_RED.
3. EMERGENCY_HOLD: Grants exclusive GREEN CORRIDOR to CAM X.
   All other approaches strictly RED. Holds GREEN while ambulance is in ROI.
4. RECOVERY: Once ambulance clears ROI, transitions CAM X: YELLOW -> ALL_RED ->
   Resumes normal cyclic progression with the subsequent approach.

Safety Invariants:
- Exactly ONE approach is GREEN at any time.
- Inter-phase safety clearance (YELLOW + ALL_RED) is strictly guaranteed.
- Zero abrupt or conflicting green signals.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Any, Set

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config" / "signal_config.json"
DEFAULT_SEQUENCE = ["camera_01", "camera_02", "camera_03", "camera_04"]


class AmbulancePriorityController:
    """
    TrafficIQ Emergency Vehicle Preemption (EVP) Signal Controller.
    """

    # Operational Modes
    MODE_NORMAL = "NORMAL"
    MODE_PREEMPTION_CLEARING = "PREEMPTION_CLEARING"
    MODE_EMERGENCY_HOLD = "EMERGENCY_HOLD"
    MODE_RECOVERY = "RECOVERY"

    def __init__(
        self,
        config_path: Optional[str] = None,
        green_seconds: Optional[float] = None,
        yellow_seconds: Optional[float] = None,
        all_red_seconds: Optional[float] = None,
        emergency_yellow_seconds: float = 2.0,
        emergency_all_red_seconds: float = 2.0,
        emergency_min_green_seconds: float = 5.0,
        clearance_cooldown_seconds: float = 1.5,
        sequence: Optional[List[str]] = None,
    ):
        self.config_path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
        self.sequence = sequence or list(DEFAULT_SEQUENCE)

        # Baseline cyclic timings
        self.green_seconds = 20.0
        self.yellow_seconds = 3.0
        self.all_red_seconds = 2.0

        # Preemption timings
        self.emergency_yellow_seconds = emergency_yellow_seconds
        self.emergency_all_red_seconds = emergency_all_red_seconds
        self.emergency_min_green_seconds = emergency_min_green_seconds
        self.clearance_cooldown_seconds = clearance_cooldown_seconds

        # Load file configs if available
        self._load_config()

        if green_seconds is not None:
            self.green_seconds = float(green_seconds)
        if yellow_seconds is not None:
            self.yellow_seconds = float(yellow_seconds)
        if all_red_seconds is not None:
            self.all_red_seconds = float(all_red_seconds)
        if sequence is not None:
            self.sequence = list(sequence)

        # State Machine Variables
        self.mode = self.MODE_NORMAL
        self.current_approach_index = 0
        self.current_phase = "GREEN"  # "GREEN", "YELLOW", "ALL_RED"
        self.phase_time_elapsed = 0.0
        self.total_elapsed_time = 0.0
        self.total_cycles_completed = 0

        # Emergency Preemption State
        self.emergency_approach: Optional[str] = None
        self.emergency_hold_time: float = 0.0
        self.emergency_clear_timer: float = 0.0
        self.is_emergency_active: bool = False
        self.preempted_from_approach: Optional[str] = None
        self.total_emergency_events_handled: int = 0

    def _load_config(self) -> None:
        if self.config_path.exists():
            try:
                with open(self.config_path, "r") as f:
                    cfg = json.load(f)
                self.green_seconds = float(cfg.get("green_seconds", self.green_seconds))
                self.yellow_seconds = float(cfg.get("yellow_seconds", self.yellow_seconds))
                self.all_red_seconds = float(cfg.get("all_red_seconds", self.all_red_seconds))
                if "sequence" in cfg and isinstance(cfg["sequence"], list):
                    self.sequence = [str(s).lower() for s in cfg["sequence"]]
            except Exception as e:
                print(f"[Warning] Failed loading signal config: {e}. Using defaults.")

    @property
    def current_approach(self) -> str:
        return self.sequence[self.current_approach_index]

    @property
    def next_approach(self) -> str:
        next_idx = (self.current_approach_index + 1) % len(self.sequence)
        return self.sequence[next_idx]

    def update(
        self,
        dt: float,
        emergency_approaches: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Advances the traffic signal state machine by dt seconds.
        emergency_approaches: list of camera IDs where an ambulance is actively inside ROI.
        """
        self.phase_time_elapsed += dt
        self.total_elapsed_time += dt

        if emergency_approaches is None:
            emergency_approaches = []
        emergency_approaches = [app.lower() for app in emergency_approaches if app.lower() in self.sequence]

        # -------------------------------------------------------------
        # 1. EMERGENCY TRIGGER EVALUATION
        # -------------------------------------------------------------
        if emergency_approaches:
            target_emergency_app = emergency_approaches[0]
            self.is_emergency_active = True
            self.emergency_clear_timer = 0.0  # Reset clearance cooldown

            if self.mode == self.MODE_NORMAL:
                self.total_emergency_events_handled += 1
                self.emergency_approach = target_emergency_app
                self.preempted_from_approach = self.current_approach

                if self.current_approach == target_emergency_app and self.current_phase == "GREEN":
                    # Current approach is already the ambulance approach: hold GREEN immediately!
                    self.mode = self.MODE_EMERGENCY_HOLD
                    self.emergency_hold_time = 0.0
                else:
                    # Different approach or in transition: initiate safe clearance
                    self.mode = self.MODE_PREEMPTION_CLEARING
                    if self.current_phase == "GREEN":
                        # Begin immediate yellow clearance
                        self.current_phase = "YELLOW"
                        self.phase_time_elapsed = 0.0

            elif self.mode == self.MODE_RECOVERY:
                # Ambulance re-entered or another arrived: cancel recovery and re-hold
                self.mode = self.MODE_EMERGENCY_HOLD
                self.emergency_approach = target_emergency_app
                self.emergency_hold_time = 0.0
                self.current_phase = "GREEN"

        else:
            # No ambulance reported in this frame
            if self.mode == self.MODE_EMERGENCY_HOLD:
                self.emergency_clear_timer += dt
                # Require cooldown debounce before confirming vehicle departure
                if (
                    self.emergency_hold_time >= self.emergency_min_green_seconds
                    and self.emergency_clear_timer >= self.clearance_cooldown_seconds
                ):
                    # Transition to recovery clearance
                    self.mode = self.MODE_RECOVERY
                    self.current_phase = "YELLOW"
                    self.phase_time_elapsed = 0.0
                    self.is_emergency_active = False

        # -------------------------------------------------------------
        # 2. STATE MACHINE LOGIC PER MODE
        # -------------------------------------------------------------
        if self.mode == self.MODE_NORMAL:
            self._update_normal_mode()

        elif self.mode == self.MODE_PREEMPTION_CLEARING:
            self._update_preemption_clearing()

        elif self.mode == self.MODE_EMERGENCY_HOLD:
            self.emergency_hold_time += dt

        elif self.mode == self.MODE_RECOVERY:
            self._update_recovery_mode()

        return self.get_status()

    def _update_normal_mode(self) -> None:
        """Standard fixed-cycle transitions."""
        if self.current_phase == "GREEN":
            if self.phase_time_elapsed >= self.green_seconds:
                self.current_phase = "YELLOW"
                self.phase_time_elapsed = 0.0

        elif self.current_phase == "YELLOW":
            if self.phase_time_elapsed >= self.yellow_seconds:
                self.current_phase = "ALL_RED"
                self.phase_time_elapsed = 0.0

        elif self.current_phase == "ALL_RED":
            if self.phase_time_elapsed >= self.all_red_seconds:
                self.current_approach_index = (self.current_approach_index + 1) % len(self.sequence)
                self.current_phase = "GREEN"
                self.phase_time_elapsed = 0.0
                if self.current_approach_index == 0:
                    self.total_cycles_completed += 1

    def _update_preemption_clearing(self) -> None:
        """Safely clears active conflicting approach before granting green corridor."""
        if self.current_phase == "GREEN":
            # Swift yellow clearance
            self.current_phase = "YELLOW"
            self.phase_time_elapsed = 0.0

        elif self.current_phase == "YELLOW":
            if self.phase_time_elapsed >= self.emergency_yellow_seconds:
                self.current_phase = "ALL_RED"
                self.phase_time_elapsed = 0.0

        elif self.current_phase == "ALL_RED":
            if self.phase_time_elapsed >= self.emergency_all_red_seconds:
                # Switch to emergency approach and grant GREEN CORRIDOR!
                if self.emergency_approach in self.sequence:
                    self.current_approach_index = self.sequence.index(self.emergency_approach)
                self.current_phase = "GREEN"
                self.phase_time_elapsed = 0.0
                self.emergency_hold_time = 0.0
                self.mode = self.MODE_EMERGENCY_HOLD

    def _update_recovery_mode(self) -> None:
        """Safely transitions emergency corridor back to normal cyclic schedule."""
        if self.current_phase == "YELLOW":
            if self.phase_time_elapsed >= self.yellow_seconds:
                self.current_phase = "ALL_RED"
                self.phase_time_elapsed = 0.0

        elif self.current_phase == "ALL_RED":
            if self.phase_time_elapsed >= self.all_red_seconds:
                # Return to normal cycle starting at next approach in sequence
                self.current_approach_index = (self.current_approach_index + 1) % len(self.sequence)
                self.current_phase = "GREEN"
                self.phase_time_elapsed = 0.0
                self.mode = self.MODE_NORMAL
                self.emergency_approach = None

    def get_signals(self) -> Dict[str, str]:
        """
        Returns signal states for all 4 approaches: { "camera_01": "RED", ... }.
        Enforces single-green invariant strictly.
        """
        signals = {app: "RED" for app in self.sequence}
        active_app = self.current_approach

        if self.current_phase == "GREEN":
            signals[active_app] = "GREEN"
        elif self.current_phase == "YELLOW":
            signals[active_app] = "YELLOW"
        elif self.current_phase == "ALL_RED":
            pass  # All remain RED

        return signals

    def get_status(self) -> Dict[str, Any]:
        """Comprehensive signal telemetry."""
        signals = self.get_signals()
        
        # Calculate time remaining in current phase
        if self.mode == self.MODE_EMERGENCY_HOLD:
            time_remaining = max(0.0, self.emergency_min_green_seconds - self.emergency_hold_time)
        elif self.current_phase == "GREEN":
            time_remaining = max(0.0, self.green_seconds - self.phase_time_elapsed)
        elif self.current_phase == "YELLOW":
            dur = self.emergency_yellow_seconds if self.mode == self.MODE_PREEMPTION_CLEARING else self.yellow_seconds
            time_remaining = max(0.0, dur - self.phase_time_elapsed)
        elif self.current_phase == "ALL_RED":
            dur = self.emergency_all_red_seconds if self.mode == self.MODE_PREEMPTION_CLEARING else self.all_red_seconds
            time_remaining = max(0.0, dur - self.phase_time_elapsed)
        else:
            time_remaining = 0.0

        return {
            "mode": self.mode,
            "is_emergency_active": self.is_emergency_active,
            "emergency_approach": self.emergency_approach,
            "current_approach": self.current_approach,
            "current_phase": self.current_phase,
            "phase_time_elapsed": round(self.phase_time_elapsed, 2),
            "time_remaining": round(time_remaining, 1),
            "total_elapsed_time": round(self.total_elapsed_time, 2),
            "cycles_completed": self.total_cycles_completed,
            "signals": signals,
            "next_approach": self.next_approach,
        }

    def format_dashboard(self, vehicle_counts: Optional[Dict[str, int]] = None) -> str:
        """Formatted terminal/UI report string."""
        if vehicle_counts is None:
            vehicle_counts = {}

        status = self.get_status()
        signals = status["signals"]

        lines = ["TRAFFICIQ", ""]
        for app in self.sequence:
            cam_label = app.upper().replace("_", " ")
            count = vehicle_counts.get(app, 0)
            sig = signals.get(app, "RED")
            
            sig_str = sig
            if self.mode == self.MODE_EMERGENCY_HOLD and app == self.emergency_approach:
                sig_str += " [EMERGENCY CORRIDOR]"
            elif self.mode == self.MODE_PREEMPTION_CLEARING and sig == "YELLOW":
                sig_str += " [EMERGENCY CLEARING]"

            lines.append(f"{cam_label}")
            lines.append(f"Vehicles: {count}")
            lines.append(f"Signal: {sig_str}")
            lines.append("")

        lines.append("CURRENT MODE:")
        if self.mode == self.MODE_EMERGENCY_HOLD:
            lines.append(f"AMBULANCE PRIORITY (ACTIVE: {self.emergency_approach.upper()})")
        elif self.mode == self.MODE_PREEMPTION_CLEARING:
            lines.append(f"AMBULANCE PREEMPTION (CLEARING CONFLICTS FOR {self.emergency_approach.upper()})")
        elif self.mode == self.MODE_RECOVERY:
            lines.append("AMBULANCE RECOVERY (RESTORING NORMAL SCHEDULE)")
        else:
            lines.append("NORMAL TRAFFIC")
        lines.append("")

        lines.append("CURRENT APPROACH:")
        active_display = status["current_approach"].upper().replace("_", " ")
        if self.mode == self.MODE_EMERGENCY_HOLD:
            active_display += " [AMBULANCE PRIORITY]"
        lines.append(active_display)
        lines.append("")

        lines.append("NEXT:")
        lines.append(status["next_approach"].upper().replace("_", " "))

        return "\n".join(lines)
