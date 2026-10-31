import os
from pathlib import Path

# Dynamically resolve relative to this script so it works on both hosting and local
BASE_DIR = Path(__file__).resolve().parent
directory = BASE_DIR / "src" / "components"
files = ["SystemAnnouncementTab.tsx", "AuditLogTab.tsx", "SupportTicketTab.tsx"]

for filename in files:
    filepath = directory / filename
    if not filepath.exists():
        continue
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace primary- with indigo-
    content = content.replace("primary-", "indigo-")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Updated {filename}")
