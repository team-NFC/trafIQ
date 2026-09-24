# TrafficIQ — Independent ANPR Module

This directory contains the completed and fully independent **Automatic Number Plate Recognition (ANPR)** module for TrafficIQ.

---

## 📌 Architecture & Independence

- **Strict Isolation**: Operates completely independently from the TrafficIQ signal control pipelines (`normal_situation`, `ambulance_situation`).
- **Separate Video Inputs**: Uses separate ANPR-specific high-resolution videos stored in `anpr/videos/`.
- **Multi-Engine Plate Localizer**:
  - Automatically searches `anpr/models/` for trained YOLO plate weights (`*.pt`).
  - Uses the **Adaptive Indian HSRP Morphological & Gradient Localizer** (with Black-Hat/Top-Hat transforms, horizontal Sobel-X edge density, Otsu binarization, and geometric bumper scoring) when custom weights are not provided.
- **PaddleOCR Engine**: Powered by **PaddleOCR 3.7.0** with ONNX runtime backend, CLAHE contrast enhancement, and Indian HSRP state-code format normalization.
- **Temporal Multi-Frame Confirmation**: Rejects single-frame glitches by requiring $\ge 3$ consistent OCR observations before confirming a plate for a tracked vehicle.

---

## 📁 Directory Structure

```
anpr/
├── videos/                  # ANPR-specific high-resolution videos
│   └── anpr_demo.mp4        # Sample video with visible license plates
├── images/                  # Optional test images
├── models/                  # Optional trained YOLO plate weights (*.pt)
├── output/                  # Output annotated videos, CSV logs, and JSON reports
│   ├── anpr_demo_result.mp4
│   ├── anpr_demo_anpr_results.json
│   └── anpr_demo_anpr_results.csv
├── plate_detection.py       # Dual-engine license plate detector & cropper
├── plate_ocr.py             # PaddleOCR 3.7.0 + IndianPlateValidator + quality filters
├── anpr_pipeline.py         # End-to-end ANPR video execution pipeline
├── test_anpr_modules.py     # Automated unit test suite
└── README.md                # This documentation
```

---

## 🚀 How to Run

### 1. Run ANPR Video Pipeline
```powershell
python anpr/anpr_pipeline.py --video anpr/videos/anpr_demo.mp4 --output anpr/output/anpr_demo_result.mp4 --debug
```

### 2. Supported CLI Options
| Flag | Default | Description |
|---|---|---|
| `--video` | `anpr/videos/anpr_demo.mp4` | Path to input ANPR video file |
| `--output` | `anpr/output/<name>_result.mp4` | Path for output annotated MP4 video |
| `--model` | `yolov8n.pt` | Path to YOLO vehicle detection weights |
| `--plate-model` | `None` | Optional dedicated YOLO plate weights |
| `--conf` | `0.25` | Vehicle detection confidence threshold |
| `--ocr-conf` | `0.50` | Minimum OCR confidence threshold |
| `--min-obs` | `3` | Minimum confirmed observations for temporal consensus |
| `--device` | `0` | Device for inference (`0` for GPU, `cpu` for CPU) |
| `--imgsz` | `1280` | Image resolution for vehicle inference |
| `--max-frames` | `None` | Optional frame limit |
| `--debug` | `False` | Show plate bounding boxes and candidate text |
| `--no-show` | `False` | Disable live OpenCV display window |

### 3. Run Unit Tests
```powershell
python anpr/test_anpr_modules.py
```
