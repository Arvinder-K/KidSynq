import re
import os
from pathlib import Path

# Dynamically resolve relative to this script so it works on both hosting and local
BASE_DIR = Path(__file__).resolve().parent
filepath = BASE_DIR / "views.py"

if filepath.exists():
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    if "from core.permissions import IsDaycareAdmin" not in content:
        content = content.replace("from core.limits import check_subscription_limit", "from core.limits import check_subscription_limit\nfrom core.permissions import IsDaycareAdmin")

    exclude_classes = ["UserDetailView", "UserProfileView", "UserPasswordView"]

    lines = content.split("\n")
    current_class = None

    for i, line in enumerate(lines):
        match = re.match(r"^class (\w+)\(", line)
        if match:
            current_class = match.group(1)
        
        if "permission_classes = [IsAuthenticated]" in line:
            if current_class not in exclude_classes:
                lines[i] = line.replace("IsAuthenticated", "IsDaycareAdmin")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print("Permissions updated in views.py")
