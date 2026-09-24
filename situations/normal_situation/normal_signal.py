"""
TrafficIQ - Situation 1: Normal Traffic Signal Controller
Deterministic cyclic sequence: CAM01 -> CAM02 -> CAM03 -> CAM04 -> repeat
Safety state transitions: GREEN -> YELLOW -> ALL_RED -> NEXT GREEN
"""

import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from signal_control.normal.normal_signal import NormalSignalController

__all__ = ["NormalSignalController"]


def get_default_controller(config_path=None) -> NormalSignalController:
    """Convenience factory to instantiate the Situation 1 controller."""
    return NormalSignalController(config_path=config_path)


if __name__ == "__main__":
    controller = get_default_controller()
    print("=" * 65)
    print("TRAFFICIQ - SITUATION 1: NORMAL TRAFFIC SIGNAL CONTROLLER")
    print("=" * 65)
    print(f"Cycle Sequence: {' -> '.join(controller.sequence)} -> repeat")
    print(f"Timings: Green={controller.green_seconds}s, Yellow={controller.yellow_seconds}s, All-Red={controller.all_red_seconds}s")
    print("-" * 65)
    print("Initial State:")
    print(controller.format_dashboard())
    print("=" * 65)
