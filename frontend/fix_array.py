import os
from pathlib import Path

# Dynamically resolve relative to this script so it works on both hosting and local
BASE_DIR = Path(__file__).resolve().parent
filepath = BASE_DIR / "src" / "pages" / "SuperAdminDashboard.tsx"

if filepath.exists():
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Fix the includes array
    content = content.replace(
        "{['daycares', 'daycare-admins', 'users', 'dashboard', 'logs', 'tickets'].includes(activeTab) && (",
        "{['daycares', 'daycare-admins', 'users', 'dashboard', 'logs', 'tickets', 'announcements'].includes(activeTab) && ("
    )

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

print("Fixed array include!")
