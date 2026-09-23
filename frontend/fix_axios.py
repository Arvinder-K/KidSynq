import os

directory = r"c:\Arvinder\WebDevelopment\KidSynq\frontend\src\components"
files = ["SystemAnnouncementTab.tsx", "AuditLogTab.tsx", "SupportTicketTab.tsx"]

for filename in files:
    filepath = os.path.join(directory, filename)
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
    # We can do this safely because they all look like:
    # { headers: { Authorization: `Bearer ${token}` } }
    # Or variations of it. 
    import re
    content = re.sub(r",\s*\{\s*headers:\s*\{\s*Authorization:\s*`Bearer \$\{token\}`\s*\}\s*\}", "", content)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Updated {filename}")
