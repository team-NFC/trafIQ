# Situation 1: Normal Traffic Signal Operation

This folder contains the complete implementation and execution pipeline for **Situation 1** in TrafficIQ.

---

## 🚦 Overview

**Situation 1** represents standard, baseline intersection operation when **no emergency vehicles (ambulances)** are detected in any camera feed.

### Key Operational Rules:
1. **Deterministic Fixed Sequence**:
   $$\text{CAMERA 01} \longrightarrow \text{CAMERA 02} \longrightarrow \text{CAMERA 03} \longrightarrow \text{CAMERA 04} \longrightarrow \text{repeat}$$
2. **Safety Phase Transitions**:
   $$\text{GREEN (20s)} \longrightarrow \text{YELLOW (3s)} \longrightarrow \text{ALL-RED (2s)} \longrightarrow \text{NEXT GREEN}$$
3. **Safety Invariants**:
   - Strictly at most **one approach** is GREEN at any time.
   - All approaches are RED during the clearance buffer (`ALL_RED`).
   - Zero emergency preemption overrides.

---

## 📹 Where to Upload Your Videos

Place your 4 camera video files that have **NO ambulances** into:
- **Recommended**: `TrafficIQ/situations/normal_situation/videos/`
  - `camera_01.mp4`
  - `camera_02.mp4`
  - `camera_03.mp4`
  - `camera_04.mp4`
*(Files placed directly inside `situations/normal_situation/` are also automatically detected).*

---

## 📁 Files in this Folder

| File | Purpose |
|---|---|
| `videos/` | Destination folder for your 4 normal traffic video files |
| `normal_signal.py` | State machine controller for fixed-cycle signal progression |
| `run_normal_simulation.py` | Fast simulation testing fixed cyclic order and safety invariants |
| `run_normal_cctv.py` | 4-camera CCTV detection and signal telemetry video runner |

---

## 🚀 How to Run

### 1. Run Verification Simulation
```powershell
python situations/normal_situation/run_normal_simulation.py
```

### 2. Run Live 4-Camera CCTV Video Pipeline
```powershell
python situations/normal_situation/run_normal_cctv.py --device 0 --imgsz 1280
```
- Opens a synchronized live 4-camera video monitor window.
- Saves the annotated output video to `runs/output_normal_situation.mp4`.
