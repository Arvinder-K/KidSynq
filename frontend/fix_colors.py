import os

directory = r"c:\Arvinder\WebDevelopment\KidSynq\frontend\src\components"
files = ["SystemAnnouncementTab.tsx", "AuditLogTab.tsx", "SupportTicketTab.tsx"]

for filename in files:
    filepath = os.path.join(directory, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace primary- with indigo-
    content = content.replace("primary-", "indigo-")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Updated {filename}")
