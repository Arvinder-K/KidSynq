import os
import glob

directory = r"c:\Arvinder\WebDevelopment\KidSynq\frontend\src\components"
for filepath in glob.glob(os.path.join(directory, "*.tsx")):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    if "api/superadmin/" in content:
        content = content.replace("api/superadmin/", "api/super-admin/")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {os.path.basename(filepath)}")
