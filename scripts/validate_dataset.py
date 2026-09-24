"""
TrafficIQ Dataset Validator
Validates YOLO dataset structure, label formatting, coordinate bounds,
and class distributions for 5 target classes:
    0: car, 1: motorcycle, 2: bus, 3: truck, 4: ambulance
"""

import os
import sys
import argparse
from pathlib import Path
import yaml
from PIL import Image

EXPECTED_CLASSES = {
    0: "car",
    1: "motorcycle",
    2: "bus",
    3: "truck",
    4: "ambulance",
}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def check_split(split_name, img_dir, lbl_dir, errors, warnings):
    print(f"\n==================== Checking {split_name.upper()} split ====================")
    if not img_dir.exists():
        errors.append(f"[{split_name}] Image directory does not exist: {img_dir}")
        return {}, 0, 0

    if not lbl_dir.exists():
        errors.append(f"[{split_name}] Label directory does not exist: {lbl_dir}")
        return {}, 0, 0

    img_files = sorted([f for f in img_dir.iterdir() if f.suffix.lower() in IMAGE_EXTENSIONS])
    print(f"Found {len(img_files)} images in {img_dir}")

    if len(img_files) == 0:
        errors.append(f"[{split_name}] No images found in {img_dir}. Please place annotated images in this directory.")
        return {}, 0, 0

    class_counts = {c: 0 for c in EXPECTED_CLASSES}
    total_boxes = 0
    missing_labels = 0
    empty_labels = 0
    corrupt_images = 0

    for img_path in img_files:
        # Check image readability
        try:
            with Image.open(img_path) as img:
                img.verify()
        except Exception as e:
            errors.append(f"[{split_name}] Corrupt image: {img_path.name} ({e})")
            corrupt_images += 1
            continue

        lbl_path = lbl_dir / f"{img_path.stem}.txt"
        if not lbl_path.exists():
            errors.append(f"[{split_name}] Missing label file for image: {img_path.name} (Expected {lbl_path.name})")
            missing_labels += 1
            continue

        with open(lbl_path, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip()]

        if len(lines) == 0:
            empty_labels += 1
            continue

        for line_idx, line in enumerate(lines, 1):
            parts = line.split()
            if len(parts) != 5:
                errors.append(
                    f"[{split_name}] {lbl_path.name}:L{line_idx} - Expected 5 values (class x y w h), found {len(parts)}: '{line}'"
                )
                continue

            # Class ID check
            try:
                cls_id = int(parts[0])
            except ValueError:
                errors.append(f"[{split_name}] {lbl_path.name}:L{line_idx} - Class ID must be integer, got '{parts[0]}'")
                continue

            if cls_id not in EXPECTED_CLASSES:
                errors.append(
                    f"[{split_name}] {lbl_path.name}:L{line_idx} - Invalid class ID {cls_id}. Allowed: {list(EXPECTED_CLASSES.keys())}"
                )
                continue

            # Coordinate checks
            try:
                coords = [float(p) for p in parts[1:]]
            except ValueError:
                errors.append(f"[{split_name}] {lbl_path.name}:L{line_idx} - Coordinates must be floats: '{line}'")
                continue

            x, y, w, h = coords
            for val, name in zip(coords, ["x_center", "y_center", "width", "height"]):
                if not (0.0 <= val <= 1.0):
                    errors.append(
                        f"[{split_name}] {lbl_path.name}:L{line_idx} - {name}={val} out of normalized bounds [0.0, 1.0]"
                    )

            if w <= 0.0 or h <= 0.0:
                errors.append(f"[{split_name}] {lbl_path.name}:L{line_idx} - Non-positive dimensions (w={w}, h={h})")
                continue

            class_counts[cls_id] += 1
            total_boxes += 1

    print(f"Summary for {split_name}:")
    print(f"  - Valid images: {len(img_files) - corrupt_images}/{len(img_files)}")
    print(f"  - Empty background images: {empty_labels}")
    print(f"  - Total bounding boxes: {total_boxes}")
    print("  - Class breakdown:")
    for cid, name in EXPECTED_CLASSES.items():
        print(f"      [{cid}] {name:<12}: {class_counts[cid]:>5} boxes")

    if split_name == "train" and class_counts[4] == 0:
        warnings.append(f"[{split_name}] WARNING: 0 bounding boxes found for class 4 ('ambulance')! The model will not learn ambulance detection.")

    return class_counts, len(img_files), total_boxes


def validate(data_yaml_path):
    print(f"Loading dataset configuration: {data_yaml_path}")
    if not os.path.exists(data_yaml_path):
        print(f"Error: {data_yaml_path} does not exist.")
        return False

    with open(data_yaml_path, "r", encoding="utf-8") as f:
        data_cfg = yaml.safe_load(f)

    base_path = Path(data_cfg.get("path", Path(data_yaml_path).parent))
    train_img_rel = data_cfg.get("train", "images/train")
    val_img_rel = data_cfg.get("val", "images/val")

    train_img_dir = base_path / train_img_rel
    val_img_dir = base_path / val_img_rel

    train_lbl_dir = base_path / "labels" / "train"
    val_lbl_dir = base_path / "labels" / "val"

    errors = []
    warnings = []

    # Check classes mapping in data.yaml
    yaml_names = data_cfg.get("names", {})
    if isinstance(yaml_names, list):
        yaml_names = {i: name for i, name in enumerate(yaml_names)}
    
    print("\nVerifying class names in data.yaml:")
    for cid, name in EXPECTED_CLASSES.items():
        actual_name = yaml_names.get(cid)
        if actual_name != name:
            errors.append(f"Class mismatch at ID {cid}: expected '{name}', got '{actual_name}'")
        else:
            print(f"  Class {cid}: {name} (OK)")

    # Check splits
    train_counts, train_img_count, train_box_count = check_split("train", train_img_dir, train_lbl_dir, errors, warnings)
    val_counts, val_img_count, val_box_count = check_split("val", val_img_dir, val_lbl_dir, errors, warnings)

    # Check leakage / identical filenames
    overlap = set()
    if train_img_dir.exists() and val_img_dir.exists():
        train_names = {f.name for f in train_img_dir.iterdir() if f.suffix.lower() in IMAGE_EXTENSIONS}
        val_names = {f.name for f in val_img_dir.iterdir() if f.suffix.lower() in IMAGE_EXTENSIONS}
        overlap = train_names.intersection(val_names)
        if overlap:
            errors.append(f"Data Leakage: {len(overlap)} images have identical filenames in train and val sets ({list(overlap)})")

    total_ambulance_boxes = train_counts.get(4, 0) + val_counts.get(4, 0)
    total_car_boxes = train_counts.get(0, 0) + val_counts.get(0, 0)

    print("\n==================== DATASET INTEGRITY AUDIT ====================")
    print(f"Data Leakage        : {'FOUND (' + str(len(overlap)) + ' duplicates)' if overlap else 'NONE'}")
    print(f"Missing label files : {'FOUND' if any('Missing label file' in e for e in errors) else 'NONE'}")
    print(f"Invalid labels      : {'FOUND' if any('Expected 5 values' in e or 'Invalid class' in e or 'bounds' in e for e in errors) else 'NONE'}")
    print(f"Total images        : {train_img_count + val_img_count} (train={train_img_count}, val={val_img_count})")
    print(f"Total bounding boxes: {train_box_count + val_box_count} (ambulance={total_ambulance_boxes}, car={total_car_boxes})")

    print("\n==================== VALIDATION REPORT ====================")
    if warnings:
        print(f"\n[!] WARNINGS ({len(warnings)}):")
        for w in warnings:
            print(f"    - {w}")

    if errors:
        print(f"\n[X] ERRORS FOUND ({len(errors)}):")
        for e in errors[:25]:
            print(f"    - {e}")
        if len(errors) > 25:
            print(f"    ... and {len(errors) - 25} more errors.")
        print("\nDataset validation FAILED. Please resolve errors before starting training.")
        return False

    print("\n[OK] Dataset validation PASSED successfully! Ready for training.")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate TrafficIQ YOLO dataset")
    parser.add_argument(
        "--data",
        type=str,
        default=str(Path(__file__).parent.parent / "dataset" / "data.yaml"),
        help="Path to data.yaml",
    )
    args = parser.parse_args()
    success = validate(args.data)
    sys.exit(0 if success else 1)
