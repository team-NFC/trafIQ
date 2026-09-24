"""
TrafficIQ - Ambulance Priority Signal Controller Module
Re-exports the core AmbulancePriorityController.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from situations.ambulance_situation.ambulance_priority import AmbulancePriorityController

__all__ = ["AmbulancePriorityController"]
