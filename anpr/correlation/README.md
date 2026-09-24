# TrafficIQ — City-Wide Multi-Camera Vehicle Correlation

This directory contains the independent **City-Wide Multi-Camera Vehicle Correlation** engine for TrafficIQ.

It traces vehicle journeys across multiple CCTV intersection cameras throughout a city using Indian license plates, OCR confidence scoring, real-world camera clock synchronization, and hop-by-hop travel duration analysis.

---

## 📌 Features & Architecture

- **Strict Pipeline Independence**: Does not modify or interfere with existing TrafficIQ signal control (`normal_situation`, `ambulance_situation`) or the core ANPR pipeline.
- **Camera Synchronization**: Each CCTV camera can have an independent real-world video start time configured in `camera_config.json`. The exact real-world detection time is calculated as:
  $$\text{Real Detection Time} = \text{Camera Start Time} + \text{Video Frame Timestamp}$$
- **Normalized Plate Matching**: Uses `IndianPlateValidator` from `anpr/plate_ocr.py` as the primary vehicle identifier.
- **OCR Ambiguity Resolution**: Automatically clusters known OCR confusion pairs across cameras (e.g. `8` $\leftrightarrow$ `B`, `0` $\leftrightarrow$ `O`, `1` $\leftrightarrow$ `I`, `2` $\leftrightarrow$ `Z`, `5` $\leftrightarrow$ `S`) so that minor single-frame OCR misreadings (such as `TN38AB1234` vs `TN38AB12B4`) are correctly recognized as the same vehicle.
- **Arbitrary Journey Paths**: Does not assume rigid camera orders (supports `CAM 1` $\rightarrow$ `CAM 3`, `CAM 2` $\rightarrow$ `CAM 4`, or any non-linear path).
- **Smart Result Caching**: If camera ANPR results (`camera_XX_anpr_results.json`) already exist, the pipeline loads them in milliseconds without repeating expensive YOLO + OCR inference.
- **Map Dashboard Ready**: Stores GPS coordinates `[lat, lon]` for each camera and journey hop, ready for React/Leaflet map visualization.

---

## 📁 Directory Structure

```
anpr/correlation/
├── camera_config.json        # Camera locations, real-world start times, and GPS coordinates
├── vehicle_correlator.py     # Core correlation engine and journey reconstruction
├── correlation_pipeline.py   # End-to-end CLI runner
├── test_correlation.py        # Automated test suite
└── README.md                 # This documentation
```

---

## ⚙️ Camera Configuration (`camera_config.json`)

```json
{
  "cameras": {
    "camera_01": {
      "video": "camera_01.mp4",
      "location": "Junction A",
      "start_time": "08:00:00",
      "coordinates": [13.0827, 80.2707]
    },
    "camera_02": {
      "video": "camera_02.mp4",
      "location": "Junction B",
      "start_time": "08:05:00",
      "coordinates": [13.0865, 80.2745]
    },
    "camera_03": {
      "video": "camera_03.mp4",
      "location": "Junction C",
      "start_time": "08:10:00",
      "coordinates": [13.0910, 80.2812]
    },
    "camera_04": {
      "video": "camera_04.mp4",
      "location": "Junction D",
      "start_time": "08:20:00",
      "coordinates": [13.0975, 80.2890]
    },
    "camera_05": {
      "video": "camera_05.mp4",
      "location": "Additional City Camera",
      "start_time": "08:25:00",
      "coordinates": [13.1020, 80.2950]
    }
  }
}
```

> **Dynamic Scaling**: The system supports arbitrary camera counts (`CAM01` through `CAM999`). To add a camera, simply add its entry to `camera_config.json` and place its video in `anpr/videos/`—zero code changes required.
>
> **Stale Output Protection**: If a configured video file is deleted or missing from disk, the pipeline will display `[CAM_ID] Exists: FALSE` and skip that camera. Stale or old JSON files will strictly not be loaded for missing cameras.

---

## 🚀 How to Run

### 1. Run Complete City-Wide Correlation (Auto-loads cached results)
```powershell
python anpr/correlation/correlation_pipeline.py
```

### 2. Trace a Specific Vehicle Plate
```powershell
python anpr/correlation/correlation_pipeline.py --plate TN38AB1234
```

### 3. Force Reprocessing of Videos
To run fresh YOLO vehicle tracking and PaddleOCR plate recognition on the raw videos inside `anpr/videos/`:
```powershell
python anpr/correlation/correlation_pipeline.py --reprocess --device 0
```

### 4. Run Automated Test Suite
```powershell
python anpr/correlation/test_correlation.py
```

---

## 📊 Sample Terminal Output

```text
====================================================================
        TRAFFICIQ: CITY-WIDE VEHICLE CORRELATION REPORT
====================================================================
Total Unique Vehicles Tracked : 6
Multi-Camera Correlated Trips : 3
Single-Camera Observations    : 3
--------------------------------------------------------------------
Vehicle : TN 38 AB 1234
Class   : Car | Confidence: 97.1%
RTO     : Valid Indian HSRP Registration (State: TN)

  08:11:00
  CAMERA 01 - Junction A - North Gate
        |
        v 4 min
        |
  08:15:00
  CAMERA 02 - Junction B - Ring Road
        |
        v 7 min
        |
  08:22:00
  CAMERA 03 - Junction C - Central Avenue
        |
        v 8 min
        |
  08:30:00
  CAMERA 04 - Junction D - Express Flyover

  ------------------------------------------
  Total observed journey : 19.0 minutes
  Cameras detected       : 4
  ------------------------------------------
====================================================================
```

---

## 📁 Output Deliverables

Results are saved to `anpr/output/`:
- **JSON Journey Data**: [`anpr/output/citywide_correlation.json`](file:///C:/Users/sanjeevi/.gemini/antigravity/scratch/TrafficIQ/anpr/output/citywide_correlation.json)
- **CSV Hop Data**: [`anpr/output/citywide_correlation.csv`](file:///C:/Users/sanjeevi/.gemini/antigravity/scratch/TrafficIQ/anpr/output/citywide_correlation.csv)
