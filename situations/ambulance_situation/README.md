# Situation 2: Ambulance Priority Operation (Emergency Preemption)

This folder contains the complete implementation and execution pipeline for **Situation 2** in TrafficIQ.

---

## 🚑 Overview

**Situation 2** activates when an **ambulance** is detected and confirmed in any camera approach (such as Camera 03).

### Key Operational Rules:
1. **Emergency Preemption**:
   - Continuous vehicle tracking and beacon verification inside the Traffic Detection Zone.
   - When an ambulance is confirmed on Approach $A$:
     - If conflicting Approach $B$ is currently GREEN, it immediately clears via **YELLOW (2s) $\rightarrow$ ALL-RED (2s)**.
     - Approach $A$ is granted an exclusive **EMERGENCY GREEN CORRIDOR**.
     - All other approaches ($B, C, D$) are locked at **RED**.
2. **Dynamic Hold**:
   - The green corridor is held as long as the ambulance is traversing inside the ROI (with minimum safety hold time).
3. **Safe Cyclic Recovery**:
   - Once the ambulance clears the intersection, Approach $A$ transitions through **YELLOW $\rightarrow$ ALL-RED**.
   - Normal cyclic sequencing seamlessly resumes from the next approach.

---

## 📹 Where to Upload Your Videos

Place your 4 camera video files (where at least one contains an ambulance) into:
- **Location**: `TrafficIQ/situations/ambulance_situation/videos/`
  - `camera_01.mp4`
  - `camera_02.mp4`
  - `camera_03.mp4` *(contains ambulance)*
  - `camera_04.mp4`
*(Files placed directly inside `situations/ambulance_situation/` are also automatically detected).*

---

## 📁 Files in this Folder

| File | Purpose |
|---|---|
| `videos/` | Destination folder for your emergency situation video files |
| `ambulance_priority.py` | State machine controller for Emergency Vehicle Preemption (EVP) |
| `test_ambulance_simulation.py` | Automated test validating preemption sequence & zero green conflicts |
| `run_ambulance_cctv.py` | 4-camera CCTV detection and live emergency preemption video runner |

---

## 🚀 How to Run

### 1. Run Verification Simulation
```powershell
python situations/ambulance_situation/test_ambulance_simulation.py
```

### 2. Run Live 4-Camera CCTV Video Pipeline
```powershell
python situations/ambulance_situation/run_ambulance_cctv.py --device 0 --imgsz 1280
```
- Opens a synchronized live 4-camera video monitor window with emergency alert header and signal badges.
- Saves the annotated output video to `runs/output_ambulance_situation.mp4`.
