import sqlite3
from pathlib import Path

db_path = Path(__file__).parent.parent / "data" / "trafficiq.db"
conn = sqlite3.connect(str(db_path))
c = conn.cursor()

# Ensure junctions columns exist
for col, ctype in [('type', 'TEXT DEFAULT "signal"'), ('location', 'TEXT'), ('signal_type', 'TEXT DEFAULT "Adaptive"')]:
    try:
        c.execute(f"ALTER TABLE junctions ADD COLUMN {col} {ctype}")
    except Exception as e:
        print(f"junctions col {col}: {e}")

# Ensure cameras columns exist
for col, ctype in [('type', 'TEXT DEFAULT "normal"'), ('location', 'TEXT'), ('description', 'TEXT')]:
    try:
        c.execute(f"ALTER TABLE cameras ADD COLUMN {col} {ctype}")
    except Exception as e:
        print(f"cameras col {col}: {e}")

# Clean out pre-seeded demo junctions
c.execute("DELETE FROM junctions")
# Clean out existing cameras
c.execute("DELETE FROM cameras")
conn.commit()

j_count = c.execute("SELECT COUNT(*) FROM junctions").fetchone()[0]
c_count = c.execute("SELECT COUNT(*) FROM cameras").fetchone()[0]
print(f"Cleaned junctions and cameras. Junctions count: {j_count}, Cameras count: {c_count}")
conn.close()
