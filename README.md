# TrafficIQ - Custom YOLO Vehicle Intelligence Model

Dedicated custom YOLO object detection pipeline for **TrafficIQ**, trained to classify and distinguish between standard vehicles and emergency vehicles.

---

## 🎯 Target Classes

The model is strictly trained on **5 vehicle classes**:

```text
0 = car
1 = motorcycle
2 = bus
3 = truck
4 = ambulance
```

> **Primary Objective**: Accurately differentiate **ambulances** from normal cars, passenger vans, and light trucks across diverse angles, lighting, distance, and occlusion levels.

---

## 📁 Project Architecture

```text
TrafficIQ/
├── dataset/
│   ├── data.yaml              # YOLO dataset configuration
│   ├── images/
│   │   ├── train/             # Training images (.jpg, .png, etc.)
│   │   └── val/               # Validation images
│   └── labels/
│       ├── train/             # YOLO format .txt annotations for train
│       └── val/               # YOLO format .txt annotations for val
├── scripts/
│   ├── setup_env.ps1          # Environment bootstrap (CUDA 12.4 + PyTorch)
│   ├── validate_dataset.py    # Pre-training dataset audit tool
│   ├── train.py               # GPU training script (RTX 3050 4GB tuned)
│   └── test_inference.py      # Verification and visual testing script
├── weights/
│   └── best.pt                # Final trained weights
├── yolov8n.pt                 # Base pre-trained checkpoint
└── venv/                      # Python 3.12 + PyTorch CUDA environment
```

---

## 🏷️ YOLO Labeling Format Guidelines

Each image in `dataset/images/{train,val}/` must have a matching `.txt` file with the exact same stem name in `dataset/labels/{train,val}/`:

Example: `images/train/street_001.jpg` $\rightarrow$ `labels/train/street_001.txt`

### Format per Line
```text
class_id x_center y_center width height
```

- `class_id`: Integer from `0` to `4` (`0`=car, `1`=motorcycle, `2`=bus, `3`=truck, `4`=ambulance)
- `x_center`, `y_center`: Normalized center coordinates relative to image width and height (`0.0` to `1.0`)
- `width`, `height`: Normalized box width and height relative to image width and height (`0.0` to `1.0`)

### Example Annotation File (`street_001.txt`)
```text
0 0.4520 0.6120 0.1800 0.1250
4 0.7810 0.5230 0.2200 0.1840
1 0.2100 0.7410 0.0650 0.0920
```
*(Represents a car, an ambulance, and a motorcycle in the same frame)*

### Negative / Background Images
For images with no vehicles or empty roads, create an **empty** `.txt` file with the matching name. This trains the model to reduce false positives.

---

## ⚡ Step-by-Step Execution Workflow

### Step 1: Activate the GPU Environment
```powershell
& "C:\Users\sanjeevi\.gemini\antigravity\scratch\TrafficIQ\venv\Scripts\Activate.ps1"
```

### Step 2: Validate the Dataset
Run the automated validator to catch syntax errors, out-of-bounds coordinates, missing labels, and verify class distribution:
```powershell
python scripts/validate_dataset.py
```

### Step 3: Run the GPU Smoke Test
Verify that PyTorch, CUDA, the RTX 3050 GPU, and the dataset work flawlessly without out-of-memory errors:
```powershell
python scripts/train.py --smoke-test
```

### Step 4: Run Full Training
Train the model with settings optimized for 4 GB VRAM:
```powershell
python scripts/train.py --epochs 50 --batch 16 --imgsz 640
```
*(If VRAM is constrained due to other running GPU apps, `--batch 8` can be used)*

When training finishes, the best weights will automatically be saved to:
```text
TrafficIQ/weights/best.pt
```

### Step 5: Test & Verify Detections
Run inference on any test image, video, or folder:
```powershell
python scripts/test_inference.py --weights weights/best.pt --source dataset/images/val
```
Visual detection results with bounding boxes and confidence scores are saved to `runs/predict/`.
