import re

filepath = r"c:\Arvinder\WebDevelopment\KidSynq\backend\daycare\views.py"

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
