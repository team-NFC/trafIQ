"""
TrafficIQ YOLO Custom Model Training Pipeline
Tuned for NVIDIA GeForce RTX 3050 (4 GB VRAM)
Recognizes 5 classes:
    0: car, 1: motorcycle, 2: bus, 3: truck, 4: ambulance
"""

import os
import sys
import shutil
import argparse
from pathlib import Path
import torch
from ultralytics import YOLO

CLASSES = {
    0: "car",
    1: "motorcycle",
    2: "bus",
    3: "truck",
    4: "ambulance"
}


def run_training():
    parser = argparse.ArgumentParser(description="TrafficIQ Custom YOLO Trainer")
    parser.add_argument(
        "--data",
        type=str,
        default=str(Path(__file__).parent.parent / "dataset" / "data.yaml"),
        help="Path to data.yaml",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=str(Path(__file__).parent.parent / "yolov8n.pt"),
        help="Initial model checkpoint (yolov8n.pt, yolo11n.pt, etc.)",
    )
    parser.add_argument("--epochs", type=int, default=50, help="Number of epochs for full training")
    parser.add_argument("--batch", type=int, default=16, help="Batch size (default 16 for 4GB VRAM)")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    parser.add_argument("--patience", type=int, default=15, help="Early stopping patience")
    parser.add_argument("--device", type=str, default="0", help="CUDA device index, or 'cpu'")
    parser.add_argument("--smoke-test", action="store_true", help="Run 2 epochs smoke test to verify GPU pipeline")

    args = parser.parse_args()

    project_root = Path(__file__).parent.parent
    weights_dir = project_root / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)

    print("==================================================")
    print("           TrafficIQ YOLO Training               ")
    print("==================================================")

    # 1. Environment & Hardware Verification
    cuda_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if cuda_available else "None (CPU)"
    vram_gb = (
        torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
        if cuda_available
        else 0.0
    )

    print(f"PyTorch Version : {torch.__version__}")
    print(f"CUDA Available  : {cuda_available}")
    print(f"GPU Detected    : {gpu_name}")
    print(f"VRAM Capacity   : {vram_gb:.2f} GB")
    print(f"Base Model      : {args.model}")
    print(f"Dataset Config  : {args.data}")
    print("==================================================")

    if args.device != "cpu" and not cuda_available:
        print("[ERROR] CUDA is not available in this Python environment, but GPU training was requested.")
        print("Please activate the Python 3.12 CUDA venv before running train.py:")
        print(r'  & "C:\Users\sanjeevi\.gemini\antigravity\scratch\TrafficIQ\venv\Scripts\Activate.ps1"')
        sys.exit(1)

    # 2. Adjust settings for smoke-test vs full-train
    if args.smoke_test:
        epochs = 2
        batch_size = min(args.batch, 8)
        run_name = "traffic_smoke_test"
        print(f"Starting SMOKE TEST (epochs={epochs}, batch={batch_size}) on GPU {gpu_name}...")
    else:
        epochs = args.epochs
        batch_size = args.batch
        run_name = "traffic_custom_train"
        print(f"Starting FULL TRAINING (epochs={epochs}, batch={batch_size}, imgsz={args.imgsz}) on GPU {gpu_name}...")

    # 3. Load YOLO model
    print(f"Loading base model: {args.model}")
    model = YOLO(args.model)

    # 4. Train with RTX 3050 4GB memory optimizations
    # amp=True enables FP16 mixed precision for Ampere Tensor Cores
    # workers=2 avoids Windows shared memory bottlenecks
    try:
        results = model.train(
            data=args.data,
            epochs=epochs,
            batch=batch_size,
            imgsz=args.imgsz,
            device=args.device if cuda_available else "cpu",
            amp=True,
            workers=2,
            patience=args.patience if not args.smoke_test else 0,
            project=str(project_root / "runs"),
            name=run_name,
            exist_ok=True,
            verbose=True,
            plots=True,
        )
    except torch.cuda.OutOfMemoryError:
        print("\n[WARNING] CUDA Out of Memory with batch size", batch_size)
        if batch_size > 4:
            new_batch = batch_size // 2
            print(f"Retrying training with reduced batch size: {new_batch}...")
            torch.cuda.empty_cache()
            results = model.train(
                data=args.data,
                epochs=epochs,
                batch=new_batch,
                imgsz=args.imgsz,
                device=args.device if cuda_available else "cpu",
                amp=True,
                workers=2,
                patience=args.patience if not args.smoke_test else 0,
                project=str(project_root / "runs"),
                name=run_name,
                exist_ok=True,
                verbose=True,
                plots=True,
            )
        else:
            raise

    # 5. Locate and preserve best.pt
    save_dir = Path(results.save_dir) if hasattr(results, "save_dir") else project_root / "runs" / run_name
    trained_best_pt = save_dir / "weights" / "best.pt"
    dest_best_pt = weights_dir / "best.pt"

    if trained_best_pt.exists():
        shutil.copy(trained_best_pt, dest_best_pt)
        print(f"\n[SUCCESS] Best weights saved to: {dest_best_pt}")
    else:
        # If best.pt isn't present (e.g. 1-2 epochs where last.pt is saved), fallback to last.pt
        last_pt = save_dir / "weights" / "last.pt"
        if last_pt.exists():
            shutil.copy(last_pt, dest_best_pt)
            print(f"\n[INFO] Saved checkpoint to: {dest_best_pt}")

    # 6. Run Validation
    print("\nRunning post-training validation...")
    val_model = YOLO(str(dest_best_pt))
    val_results = val_model.val(data=args.data, device=args.device if cuda_available else "cpu")

    # 7. Print Final Standard Summary
    print("\n" + "=" * 50)
    print("TRAFFIC-IQ TRAINING SUMMARY")
    print("=" * 50)
    print("Model trained: YES")
    print(f"Model path: {dest_best_pt.resolve()}")
    print("Classes learned: 0: car, 1: motorcycle, 2: bus, 3: truck, 4: ambulance")
    print(f"GPU used: {gpu_name}")
    print("=" * 50)


if __name__ == "__main__":
    run_training()
