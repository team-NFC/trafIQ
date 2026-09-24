"""
TrafficIQ - Analytics & HUD Visualization Module
Renders visual overlay strictly following TrafficIQ Phase 2 requirements:
- Full camera frame with perspective Traffic Detection Zone polygon
- Active [ROI] vehicle tags and lighter secondary visualization for vehicles outside ROI
- Telemetry HUD: Active zone status, class counts, and Emergency status (NORMAL vs AMBULANCE DETECTED)
"""

from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import cv2
from .detection import CLASS_COLORS
from .roi import ROIZone


class TrafficAnalytics:
    """
    Computes traffic metrics and renders professional video HUD overlays.
    """

    def __init__(self, roi: ROIZone, camera_id: Optional[str] = None):
        self.roi = roi
        self.camera_id = camera_id or roi.camera_id

    def estimate_density(self, active_count: int) -> str:
        """Approximate traffic density based on current Traffic ROI occupancy."""
        if active_count <= 3:
            return "LOW"
        elif active_count <= 8:
            return "MODERATE"
        else:
            return "HIGH"

    def render_overlay(
        self,
        frame: np.ndarray,
        tracks: List[Dict[str, Any]],
        metrics: Dict[str, Any],
        fps: float,
    ) -> np.ndarray:
        """
        Render all visual overlays onto the frame:
        1. Full camera frame
        2. Traffic Detection Zone polygon
        3. Active [ROI] bounding boxes vs lighter outside-ROI boxes
        4. Modern telemetry HUD card
        5. Emergency vehicle status banner
        """
        h, w = frame.shape[:2]
        scale = max(1.0, w / 1280.0)

        # 1. Draw Traffic Detection Zone Polygon in RED
        self.roi.draw(frame, color=(0, 0, 255), thickness=max(2, int(2.5 * scale)))

        # 2. Draw Bounding Boxes
        for trk in tracks:
            box = trk["box"]
            cls_id = trk["class_id"]
            track_id = trk["track_id"]
            conf = trk["conf"]
            cls_name = trk["class_name"].upper()
            direction = trk.get("direction", "Unknown")
            bottom_center = trk.get("bottom_center", trk.get("center"))
            in_roi = trk.get("in_roi", False)

            x1, y1, x2, y2 = [int(v) for v in box]
            bc_x, bc_y = int(bottom_center[0]), int(bottom_center[1])

            if in_roi:
                # Active TrafficIQ Detection
                box_color = CLASS_COLORS.get(cls_id, (0, 255, 0))
                box_thick = max(2, int(2.5 * scale))
                label_text = f"[ROI] {cls_name} #{track_id} {conf:.2f}"
                if direction not in ("Unknown", "Stationary"):
                    label_text += f" [{direction}]"

                # Draw vehicle box
                cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, box_thick)
                # Draw road contact point (bottom-center)
                cv2.circle(frame, (bc_x, bc_y), max(4, int(5 * scale)), (0, 255, 255), -1)

                # Active label badge
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.48 * scale
                font_thick = max(1, int(scale))
                (tw, th), _ = cv2.getTextSize(label_text, font, font_scale, font_thick)
                lbl_y1 = max(0, y1 - th - int(8 * scale))
                lbl_y2 = y1
                cv2.rectangle(frame, (x1, lbl_y1), (x1 + tw + int(8 * scale), lbl_y2), box_color, -1)
                text_color = (255, 255, 255) if cls_id == 4 else (0, 0, 0)
                cv2.putText(
                    frame,
                    label_text,
                    (x1 + int(4 * scale), lbl_y2 - int(4 * scale)),
                    font,
                    font_scale,
                    text_color,
                    font_thick,
                    cv2.LINE_AA,
                )
            else:
                # Outside ROI: Lighter secondary visualization (gray/dimmed), not counted
                dim_color = (130, 130, 130)
                cv2.rectangle(frame, (x1, y1), (x2, y2), dim_color, 1)
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.38 * scale
                label_text = f"{cls_name} #{track_id} (Outside ROI)"
                cv2.putText(
                    frame,
                    label_text,
                    (x1 + 2, max(15, y1 - 4)),
                    font,
                    font_scale,
                    (180, 180, 180),
                    1,
                    cv2.LINE_AA,
                )

        # 3. Render Top-Left Telemetry Card
        self._render_hud_card(frame, metrics, fps, scale)

        # 4. Render Emergency Status Banner if active
        if metrics.get("emergency_vehicle_detected", False):
            self._render_emergency_alert(frame, metrics.get("ambulance_events", []), scale)

        return frame

    def _render_hud_card(self, frame: np.ndarray, metrics: Dict[str, Any], fps: float, scale: float = 1.0) -> None:
        """Renders HUD card conforming to TrafficIQ specifications."""
        h, w = frame.shape[:2]
        hud_w = int(360 * scale)
        hud_h = int(260 * scale)
        x1, y1 = int(20 * scale), int(20 * scale)
        x2, y2 = x1 + hud_w, y1 + hud_h

        # Semi-transparent dark slate backdrop
        overlay = frame.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (18, 22, 28), -1)
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 215, 255), max(1, int(1.5 * scale)))
        cv2.addWeighted(overlay, 0.82, frame, 0.18, 0, frame)

        # Fonts & dimensions
        f_title = cv2.FONT_HERSHEY_SIMPLEX
        title_scale = 0.65 * scale
        text_scale = 0.48 * scale
        thick_title = max(2, int(2 * scale))
        thick_text = max(1, int(scale))

        # Title: Camera ID
        cv2.putText(frame, f"TRAFFICIQ — {self.camera_id.upper()}", (x1 + int(15 * scale), y1 + int(28 * scale)), f_title, title_scale, (0, 215, 255), thick_title, cv2.LINE_AA)
        cv2.line(frame, (x1 + int(15 * scale), y1 + int(36 * scale)), (x2 - int(15 * scale), y1 + int(36 * scale)), (60, 75, 90), 1)

        # Zone Status line
        line_y = y1 + int(58 * scale)
        step_y = int(22 * scale)
        cv2.putText(frame, "Traffic Detection Zone: ", (x1 + int(15 * scale), line_y), f_title, text_scale, (220, 220, 220), thick_text, cv2.LINE_AA)
        cv2.putText(frame, "ACTIVE", (x1 + int(195 * scale), line_y), f_title, text_scale, (0, 255, 100), thick_title, cv2.LINE_AA)

        # Per-class counts inside ROI
        counts = metrics.get("unique_counts", {})
        c_cars = counts.get("car", 0)
        c_motos = counts.get("motorcycle", 0)
        c_buses = counts.get("bus", 0)
        c_trucks = counts.get("truck", 0)
        c_ambs = counts.get("ambulance", 0)

        cv2.putText(frame, f"Cars        : {c_cars}", (x1 + int(15 * scale), line_y + step_y), f_title, text_scale, (240, 240, 240), thick_text, cv2.LINE_AA)
        cv2.putText(frame, f"Motorcycles : {c_motos}", (x1 + int(15 * scale), line_y + 2 * step_y), f_title, text_scale, (240, 240, 240), thick_text, cv2.LINE_AA)
        cv2.putText(frame, f"Buses       : {c_buses}", (x1 + int(15 * scale), line_y + 3 * step_y), f_title, text_scale, (240, 240, 240), thick_text, cv2.LINE_AA)
        cv2.putText(frame, f"Trucks      : {c_trucks}", (x1 + int(15 * scale), line_y + 4 * step_y), f_title, text_scale, (240, 240, 240), thick_text, cv2.LINE_AA)

        amb_color = (0, 0, 255) if c_ambs > 0 else (240, 240, 240)
        cv2.putText(frame, f"Ambulances  : {c_ambs}", (x1 + int(15 * scale), line_y + 5 * step_y), f_title, text_scale, amb_color, thick_title if c_ambs > 0 else thick_text, cv2.LINE_AA)

        # Emergency status: NORMAL vs AMBULANCE DETECTED
        cv2.line(frame, (x1 + int(15 * scale), line_y + int(5.6 * step_y)), (x2 - int(15 * scale), line_y + int(5.6 * step_y)), (60, 75, 90), 1)

        is_emergency = metrics.get("emergency_vehicle_detected", False)
        status_lbl = f"AMBULANCE DETECTED – {self.camera_id.upper()}" if is_emergency else "NORMAL"
        status_col = (0, 0, 255) if is_emergency else (0, 255, 120)

        cv2.putText(frame, "Emergency status: ", (x1 + int(15 * scale), line_y + int(6.8 * step_y)), f_title, text_scale * 0.95, (200, 200, 200), thick_text, cv2.LINE_AA)
        cv2.putText(frame, status_lbl, (x1 + int(15 * scale), line_y + int(7.8 * step_y)), f_title, text_scale * 0.95, status_col, thick_title, cv2.LINE_AA)

        # FPS indicator
        cv2.putText(frame, f"FPS: {fps:.1f}", (x2 - int(85 * scale), y1 + int(28 * scale)), f_title, text_scale * 0.9, (0, 255, 200), thick_text, cv2.LINE_AA)

    def _render_emergency_alert(self, frame: np.ndarray, events: List[Dict[str, Any]], scale: float = 1.0) -> None:
        """Render high-priority flashing emergency alert banner in top-center."""
        h, w = frame.shape[:2]
        banner_w = int(580 * scale)
        banner_h = int(75 * scale)
        bx1 = (w - banner_w) // 2
        by1 = int(20 * scale)
        bx2 = bx1 + banner_w
        by2 = by1 + banner_h

        overlay = frame.copy()
        cv2.rectangle(overlay, (bx1, by1), (bx2, by2), (0, 0, 180), -1)
        cv2.rectangle(overlay, (bx1, by1), (bx2, by2), (0, 0, 255), max(2, int(2.5 * scale)))
        cv2.addWeighted(overlay, 0.88, frame, 0.12, 0, frame)

        header = f"EMERGENCY VEHICLE DETECTED – {self.camera_id.upper()}"
        cv2.putText(frame, header, (bx1 + int(20 * scale), by1 + int(32 * scale)), cv2.FONT_HERSHEY_SIMPLEX, 0.65 * scale, (255, 255, 255), max(2, int(2 * scale)), cv2.LINE_AA)

        if events:
            ev = events[0]
            track_id = ev.get("track_id", "N/A")
            conf = ev.get("conf", 0.0)
            direction = ev.get("direction", "Approaching")
            details = f"Ambulance #{track_id} | Conf: {conf:.2f} | Action: Signal Preemption Priority"
            cv2.putText(frame, details, (bx1 + int(20 * scale), by1 + int(58 * scale)), cv2.FONT_HERSHEY_SIMPLEX, 0.48 * scale, (230, 230, 255), max(1, int(scale)), cv2.LINE_AA)
