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

    # Replace import axios from 'axios' with import api from '../api'
    content = content.replace("import axios from 'axios';", "import api from '../api';")
    
    # Replace axios.get/post/put/patch/delete with api.get/post/put/patch/delete
    content = content.replace("axios.", "api.")
    
    # Remove lines containing const token = localStorage.getItem('token');
    new_lines = []
    for line in content.split('\n'):
        if "const token = localStorage.getItem('token');" in line:
            continue
        new_lines.append(line)
    
    # Re-join
    content = '\n'.join(new_lines)
    
    # Now we need to remove the headers object from the api calls.
    import re
    content = re.sub(r",\s*\{\s*headers:\s*\{\s*Authorization:\s*`Bearer \$\{token\}`\s*\}\s*\}", "", content)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Updated {filename}")
