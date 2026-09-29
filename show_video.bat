@echo off
set CAM=%1
if "%CAM%"=="" set CAM=2.1

if "%CAM%"=="1" set VID=situations\normal_situation\videos\camera_01.mp4
if "%CAM%"=="2.1" set VID=situations\normal_situation\videos\camera_02.1.mp4
if "%CAM%"=="2.2" set VID=situations\normal_situation\videos\camera_02.2.mp4
if "%CAM%"=="3" set VID=situations\normal_situation\videos\camera_03.mp4
if "%CAM%"=="4" set VID=situations\normal_situation\videos\camera_04.mp4

if not exist "%VID%" (
    if exist "data\camera_videos\CAM-%CAM%.mp4" set VID=data\camera_videos\CAM-%CAM%.mp4
    if exist "data\camera_videos\normal\CAM-%CAM%.mp4" set VID=data\camera_videos\normal\CAM-%CAM%.mp4
)

echo =================================================================
echo Launching Live TrafficIQ Video Window for CAM-%CAM%
echo Source: %VID%
echo =================================================================
venv\Scripts\python.exe scripts\run_traffic_video.py --source "%VID%" --camera "%CAM%" --show
