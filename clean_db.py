import sqlite3
from pathlib import Path

db_path = Path("data/trafficiq.db")
if db_path.exists():
    conn = sqlite3.connect(str(db_path))
    c = conn.cursor()
    c.execute("DELETE FROM cameras WHERE type = 'junction_camera' OR junction_id IS NOT NULL")
    c.execute("DELETE FROM junctions")
    conn.commit()
    conn.close()
    print("SUCCESS: Deleted all pre-seeded junction cameras and junctions from SQLite database!")
else:
    print("Database data/trafficiq.db not found.")
