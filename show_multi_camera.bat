@echo off
echo =================================================================
echo Launching TrafficIQ Multi-Camera Live GUI Window
echo Approaches: CAM-01 (North), CAM-02.1 (East), CAM-03 (South), CAM-04 (West)
echo =================================================================
venv\Scripts\python.exe scripts/run_multi_camera.py --cam1 situations/normal_situation/videos/camera_01.mp4 --cam2 situations/normal_situation/videos/camera_02.1.mp4 --cam3 situations/normal_situation/videos/camera_03.mp4 --cam4 situations/normal_situation/videos/camera_04.mp4 --show
