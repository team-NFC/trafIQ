"""
TrafficIQ - Situations Utility Module
Resolves video paths for Normal and Ambulance situations dynamically.
"""

from pathlib import Path
from typing import Dict, Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_VIDEOS_DIR = PROJECT_ROOT / "data" / "videos"


def resolve_camera_video(
    situation_dir: Path,
    camera_id: str,
) -> Optional[Path]:
    """
    Resolves the video file path for a given camera in a situation folder.
    Checks in order:
    1. <situation_dir>/videos/<camera_id>.mp4 (e.g. videos/camera_01.mp4)
    2. <situation_dir>/<camera_id>.mp4 (e.g. camera_01.mp4)
    3. PROJECT_ROOT/data/videos/<camera_id>.mp4
    """
    cam_lower = camera_id.lower()
    cam_num = "".join([c for c in cam_lower if c.isdigit()])
    
    candidates = [
        f"{cam_lower}.mp4",
        f"camera_{int(cam_num):02d}.mp4" if cam_num else None,
        f"camera_{int(cam_num)}.mp4" if cam_num else None,
        f"cam_{int(cam_num):02d}.mp4" if cam_num else None,
        f"cam{int(cam_num):02d}.mp4" if cam_num else None,
    ]
    candidates = [c for c in candidates if c]

    # 1. Check situation_dir / videos
    sub_videos = situation_dir / "videos"
    if sub_videos.exists():
        for cand in candidates:
            p = sub_videos / cand
            if p.exists():
                return p

    # 2. Check situation_dir directly
    for cand in candidates:
        p = situation_dir / cand
        if p.exists():
            return p

    # 3. Check data / videos fallback
    if DEFAULT_VIDEOS_DIR.exists():
        for cand in candidates:
            p = DEFAULT_VIDEOS_DIR / cand
            if p.exists():
                return p

    return None


def get_situation_camera_sources(
    situation_dir: Path,
    camera_ids: Optional[list] = None,
) -> Dict[str, str]:
    """
    Returns a dictionary of { "camera_01": path_str, ... } resolved for the situation.
    """
    if camera_ids is None:
        camera_ids = ["camera_01", "camera_02", "camera_03", "camera_04"]

    sources = {}
    for cam_id in camera_ids:
        path = resolve_camera_video(situation_dir, cam_id)
        if path:
            sources[cam_id] = str(path)
        else:
            print(f"[WARNING] Could not find video source for {cam_id} in {situation_dir} or fallback.")

    return sources
