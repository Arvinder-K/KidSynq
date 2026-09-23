import os

filepath = r"c:\Arvinder\WebDevelopment\KidSynq\frontend\src\pages\SuperAdminDashboard.tsx"

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
