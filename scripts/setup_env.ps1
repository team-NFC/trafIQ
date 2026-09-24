# TrafficIQ GPU Environment Setup Script (Python 3.12 + PyTorch CUDA 12.4 + Ultralytics)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $PSScriptRoot
$VenvDir = Join-Path $ProjectDir "venv"
$PythonExe = "C:\Users\sanjeevi\AppData\Local\Programs\Python\Python312\python.exe"

Write-Host "=================================================="
Write-Host "       TrafficIQ CUDA Environment Setup           "
Write-Host "=================================================="

# 1. Check Python 3.12 availability
if (-not (Test-Path $PythonExe)) {
    Write-Host "[ERROR] Python 3.12 not found at: $PythonExe" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Found Python 3.12: $PythonExe" -ForegroundColor Green

# 2. Create virtual environment if missing
if (-not (Test-Path (Join-Path $VenvDir "Scripts\python.exe"))) {
    Write-Host "[INFO] Creating virtual environment in $VenvDir..."
    & $PythonExe -m venv $VenvDir
}

$VenvPython = Join-Path $VenvDir "Scripts\python.exe"

# 3. Install PyTorch with CUDA 12.4
Write-Host "[INFO] Installing PyTorch with CUDA 12.4..."
& $VenvPython -m pip install --upgrade pip
& $VenvPython -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124

# 4. Install Ultralytics and dependencies
Write-Host "[INFO] Installing Ultralytics, OpenCV, PyYAML..."
& $VenvPython -m pip install ultralytics opencv-python pyyaml pillow

# 5. Verify CUDA GPU Activation
Write-Host "`n[DIAGNOSTIC] Testing PyTorch CUDA GPU availability..."
& $VenvPython -c @"
import torch
print('PyTorch Version :', torch.__version__)
print('CUDA Available  :', torch.cuda.is_available())
if torch.cuda.is_available():
    print('GPU Device Name :', torch.cuda.get_device_name(0))
    print('VRAM Total (GB) :', round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2))
else:
    print('WARNING: CUDA is NOT available!')
"@

Write-Host "`n=================================================="
Write-Host "Setup Complete!"
Write-Host "To activate this environment in PowerShell:"
Write-Host "  & `"$VenvDir\Scripts\Activate.ps1`""
Write-Host "=================================================="
