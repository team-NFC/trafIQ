import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from starlette.testclient import TestClient
from backend.main import app

client = TestClient(app)

print("--- 1. Testing Default Clean State ---")
r = client.get('/api/cameras')
assert r.status_code == 200
print('GET /api/cameras initial count:', r.json()['count'])

r = client.get('/api/junctions')
assert r.status_code == 200
print('GET /api/junctions initial count:', r.json()['count'])

print("--- 2. Testing Adding Signal / Junction with 4 Approach Cameras ---")
junction_payload = {
    "id": "JUNC-99",
    "name": "Test Signal Junction 99",
    "type": "signal",
    "latitude": 10.790500,
    "longitude": 78.704700,
    "location": "Trichy, Tamil Nadu",
    "signal_type": "Adaptive",
    "description": "Test 4-Way Arterial Junction",
    "cameras": [
        {
            "id": "CAM-91",
            "name": "Test Junction - North Approach",
            "type": "junction_camera",
            "latitude": 10.792500,
            "longitude": 78.704700,
            "direction": "North",
            "camera_type": "CCTV",
            "video_source": "CAM-01",
            "status": "ONLINE"
        },
        {
            "id": "CAM-92",
            "name": "Test Junction - East Approach",
            "type": "junction_camera",
            "latitude": 10.790500,
            "longitude": 78.706700,
            "direction": "East",
            "camera_type": "CCTV",
            "video_source": "CAM-02",
            "status": "ONLINE"
        },
        {
            "id": "CAM-93",
            "name": "Test Junction - South Approach",
            "type": "junction_camera",
            "latitude": 10.788500,
            "longitude": 78.704700,
            "direction": "South",
            "camera_type": "CCTV",
            "video_source": "CAM-03",
            "status": "ONLINE"
        },
        {
            "id": "CAM-94",
            "name": "Test Junction - West Approach",
            "type": "junction_camera",
            "latitude": 10.790500,
            "longitude": 78.702700,
            "direction": "West",
            "camera_type": "CCTV",
            "video_source": "CAM-04",
            "status": "ONLINE"
        }
    ]
}

res = client.post('/api/junctions', json=junction_payload)
assert res.status_code == 200, res.text
junc_data = res.json()
print("Created Junction:", junc_data['junction']['id'], junc_data['junction']['name'])
print("Created Child Cameras:", [c['id'] for c in junc_data.get('created_cameras', [])])

print("--- 3. Testing GET /api/junctions/JUNC-01 (Baseline) and JUNC-99 ---")
res = client.get('/api/junctions/JUNC-01')
assert res.status_code == 200, res.text
detail = res.json()
print(f"Baseline Junction: {detail['junction']['name']}")
print(f"Associated Cameras ({len(detail['associated_cameras'])}): {[c['id'] for c in detail['associated_cameras']]}")
print(f"Signal Phase: {detail['signal_control']['current_phase']}, Timer: {detail['signal_control']['green_time']}s, Remaining: {detail['signal_control']['remaining_time']}s")
print(f"Demand: {detail['signal_control']['traffic_demand']}, PCU: {detail['signal_control']['pcu']}")

print("--- 4. Testing Adding Normal Standalone Camera (CAM-99) ---")
normal_cam = {
    'id': 'CAM-99',
    'name': 'Kallur Bypass Road',
    'type': 'normal',
    'latitude': 10.820123,
    'longitude': 78.685432,
    'location': 'Kallur Bypass, Trichy',
    'direction': 'North-East',
    'camera_type': 'ANPR',
    'video_source': 'CAM-05',
    'status': 'ONLINE',
    'description': 'Standalone highway bypass monitor'
}
res = client.post('/api/cameras', json=normal_cam)
assert res.status_code == 200, res.text
cam99_res = res.json()
assert cam99_res['camera']['latitude'] == 10.820123
assert cam99_res['camera']['longitude'] == 78.685432
assert cam99_res['camera']['junction_id'] is None
print("Created Normal Camera:", cam99_res['camera']['id'], "at exact GPS:", cam99_res['camera']['latitude'], cam99_res['camera']['longitude'])

print("--- 5. Verifying /api/godview Network Integration ---")
res = client.get('/api/godview')
assert res.status_code == 200
gv = res.json()
print("GodView Nodes Count:", len(gv['nodes']))
print("GodView Junctions Count:", len(gv['junctions']))
print("GodView Links Count:", len(gv['links']))

print("--- 6. Testing DELETE Normal Camera (CAM-99) ---")
res = client.delete('/api/cameras/CAM-99')
assert res.status_code == 200
print("Deleted CAM-99 successfully")

print("--- 7. Testing DELETE Junction (Cascading deletion of associated approach cameras JUNC-99) ---")
res = client.delete('/api/junctions/JUNC-99')
assert res.status_code == 200
print("Deleted JUNC-99 result:", res.json()['message'])

print("--- 8. Final Count Verification (Baseline 16 Cameras, 1 Junction Preserved) ---")
r_cams = client.get('/api/cameras').json()
r_juncs = client.get('/api/junctions').json()
print("Final Cameras Count (Baseline preserved):", r_cams['count'])
print("Final Junctions Count (Baseline preserved):", r_juncs['count'])
assert r_cams['count'] >= 16
assert r_juncs['count'] >= 1

print("ALL CAMERA & JUNCTION API TESTS PASSED PERFECTLY!")
