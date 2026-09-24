"""
TrafficIQ - Situation 1: Normal Fixed-Cycle Traffic Signal Controller
Manages cyclic traffic light phases across 4 camera approaches:
CAM01 -> CAM02 -> CAM03 -> CAM04 -> CAM01 (repeat).

Safety Invariants:
- Exactly ONE approach is GREEN at any moment.
- Always transitions: GREEN -> YELLOW -> ALL RED -> NEXT APPROACH GREEN.
- In ALL_RED, all 4 approaches are RED.
- Architecture ready for emergency override: mode = "NORMAL".
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Any


DEFAULT_SEQUENCE = ["camera_01", "camera_02", "camera_03", "camera_04"]
DEFAULT_CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "signal_config.json"


class NormalSignalController:
    """
    Controls fixed-cycle traffic signal operations for a 4-way intersection.
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        green_seconds: Optional[float] = None,
        yellow_seconds: Optional[float] = None,
        all_red_seconds: Optional[float] = None,
        sequence: Optional[List[str]] = None,
    ):
        self.config_path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
        self.sequence = sequence or list(DEFAULT_SEQUENCE)

        # Default prototype timings
        self.green_seconds = 20.0
        self.yellow_seconds = 3.0
        self.all_red_seconds = 2.0
        self.mode = "NORMAL"

        # Load from config file if available
        self._load_config()

        # Explicit overrides if provided
        if green_seconds is not None:
            self.green_seconds = float(green_seconds)
        if yellow_seconds is not None:
            self.yellow_seconds = float(yellow_seconds)
        if all_red_seconds is not None:
            self.all_red_seconds = float(all_red_seconds)
        if sequence is not None:
            self.sequence = list(sequence)

        # State machine initialization
        self.current_approach_index = 0
        self.current_phase = "GREEN"  # "GREEN", "YELLOW", "ALL_RED"
        self.phase_time_elapsed = 0.0
        self.total_cycles_completed = 0
        self.total_elapsed_time = 0.0

    def _load_config(self) -> None:
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.green_seconds = float(data.get("green_seconds", self.green_seconds))
                self.yellow_seconds = float(data.get("yellow_seconds", self.yellow_seconds))
                self.all_red_seconds = float(data.get("all_red_seconds", self.all_red_seconds))
                if "sequence" in data:
                    self.sequence = list(data["sequence"])
                self.mode = data.get("default_mode", "NORMAL")
            except Exception as e:
                print(f"[WARNING] Could not parse signal config {self.config_path}: {e}")

    @property
    def current_approach(self) -> str:
        return self.sequence[self.current_approach_index]

    @property
    def next_approach(self) -> str:
        next_idx = (self.current_approach_index + 1) % len(self.sequence)
        return self.sequence[next_idx]

    def get_phase_duration(self) -> float:
        if self.current_phase == "GREEN":
            return self.green_seconds
        elif self.current_phase == "YELLOW":
            return self.yellow_seconds
        elif self.current_phase == "ALL_RED":
            return self.all_red_seconds
        return 0.0

    def get_time_remaining(self) -> float:
        duration = self.get_phase_duration()
        return max(0.0, duration - self.phase_time_elapsed)

    def update(self, dt: float) -> Dict[str, Any]:
        """
        Advance the simulation clock by dt seconds.
        Handles state transitions: GREEN -> YELLOW -> ALL_RED -> NEXT GREEN.
        """
        if dt <= 0:
            return self.get_status()

        self.total_elapsed_time += dt
        self.phase_time_elapsed += dt

        target_duration = self.get_phase_duration()

        while self.phase_time_elapsed >= target_duration and target_duration > 0:
            # Consume the phase duration
            self.phase_time_elapsed -= target_duration

            if self.current_phase == "GREEN":
                self.current_phase = "YELLOW"
            elif self.current_phase == "YELLOW":
                self.current_phase = "ALL_RED"
            elif self.current_phase == "ALL_RED":
                # Advance to next approach
                self.current_approach_index = (self.current_approach_index + 1) % len(self.sequence)
                if self.current_approach_index == 0:
                    self.total_cycles_completed += 1
                self.current_phase = "GREEN"

            target_duration = self.get_phase_duration()

        return self.get_status()

    def get_signals(self) -> Dict[str, str]:
        """
        Returns current signal state for all approaches:
        {"camera_01": "GREEN", "camera_02": "RED", ...}
        SAFETY INVARIANT: At most ONE approach is GREEN. In ALL_RED, all are RED.
        """
        signals = {cam: "RED" for cam in self.sequence}

        if self.current_phase == "GREEN":
            signals[self.current_approach] = "GREEN"
        elif self.current_phase == "YELLOW":
            signals[self.current_approach] = "YELLOW"
        elif self.current_phase == "ALL_RED":
            # All remain RED
            pass

        return signals

    def get_status(self, vehicle_counts: Optional[Dict[str, int]] = None) -> Dict[str, Any]:
        """
        Returns full telemetry snapshot for controllers and dashboards.
        """
        signals = self.get_signals()
        counts = vehicle_counts or {cam: 0 for cam in self.sequence}

        return {
            "mode": self.mode,
            "current_approach": self.current_approach,
            "next_approach": self.next_approach,
            "current_phase": self.current_phase,
            "time_elapsed_in_phase": round(self.phase_time_elapsed, 2),
            "time_remaining": round(self.get_time_remaining(), 2),
            "phase_duration": self.get_phase_duration(),
            "signals": signals,
            "vehicle_counts": counts,
            "cycles_completed": self.total_cycles_completed,
            "total_elapsed_time": round(self.total_elapsed_time, 2),
        }

    def format_dashboard(self, vehicle_counts: Optional[Dict[str, int]] = None) -> str:
        """
        Formats the exact text dashboard matching TrafficIQ requirements:

        TRAFFICIQ

        CAM 01
        Vehicles: 15
        Signal: GREEN
        ...
        """
        status = self.get_status(vehicle_counts)
        signals = status["signals"]
        counts = status["vehicle_counts"]

        cam_display_map = {
            "camera_01": "CAM 01",
            "camera_02": "CAM 02",
            "camera_03": "CAM 03",
            "camera_04": "CAM 04",
        }

        lines = ["TRAFFICIQ", ""]

        for cam in self.sequence:
            cam_label = cam_display_map.get(cam, cam.upper())
            veh_count = counts.get(cam, 0)
            sig = signals.get(cam, "RED")
            lines.append(cam_label)
            lines.append(f"Vehicles: {veh_count}")
            lines.append(f"Signal: {sig}")
            lines.append("")

        curr_label = cam_display_map.get(status["current_approach"], status["current_approach"].upper())
        next_label = cam_display_map.get(status["next_approach"], status["next_approach"].upper())

        # If in ALL_RED transition
        approach_desc = f"{curr_label} (TRANSITIONING)" if self.current_phase == "ALL_RED" else curr_label

        lines.append("CURRENT MODE:")
        lines.append("NORMAL TRAFFIC")
        lines.append("")
        lines.append("CURRENT APPROACH:")
        lines.append(approach_desc)
        lines.append("")
        lines.append("NEXT:")
        lines.append(next_label)

        nl = "\n"
        return nl.join(lines)
