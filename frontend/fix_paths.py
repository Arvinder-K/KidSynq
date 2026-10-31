import os
import glob
from pathlib import Path

# Dynamically resolve relative to this script so it works on both hosting and local
BASE_DIR = Path(__file__).resolve().parent
directory = BASE_DIR / "src" / "components"

for filepath in glob.glob(os.path.join(str(directory), "*.tsx")):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    if "api/superadmin/" in content:
        content = content.replace("api/superadmin/", "api/super-admin/")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {os.path.basename(filepath)}")
