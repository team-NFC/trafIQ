"""
TrafficIQ - Situation 1 Simulation Runner
Simulates multi-cycle progression and validates:
1. Exact cyclic order (CAM01 -> CAM02 -> CAM03 -> CAM04 -> CAM01)
2. Safety phase transitions (GREEN -> YELLOW -> ALL_RED -> NEXT GREEN)
3. Zero simultaneous green conflicts
"""

import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from signal_control.normal.test_simulation import test_signal_invariants


if __name__ == "__main__":
    print("=" * 65)
    print("RUNNING SITUATION 1 (NORMAL FIXED CYCLE) SIMULATION")
    print("=" * 65)
    test_signal_invariants()
    print("\n[SUCCESS] Situation 1 validation passed completely.")
