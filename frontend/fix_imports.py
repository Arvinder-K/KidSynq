import os
import re

def remove_unused(filepath, to_remove):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    lines = content.split('\n')
    new_lines = []
    for line in lines:
        if line.startswith('import'):
            for item in to_remove:
                line = re.sub(r',\s*' + item + r'\b', '', line)
                line = re.sub(r'\b' + item + r'\s*,', '', line)
                line = re.sub(r'{\s*' + item + r'\s*}', '{}', line)
            
            if "{}" in line and "lucide-react" in line:
                continue
        new_lines.append(line)
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write('\n'.join(new_lines))

remove_unused(r"c:\Arvinder\WebDevelopment\KidSynq\frontend\src\components\AuditLogTab.tsx", ['FileText'])
remove_unused(r"c:\Arvinder\WebDevelopment\KidSynq\frontend\src\components\SupportTicketTab.tsx", ['Filter', 'Clock', 'CheckCircle', 'AlertCircle', 'MoreVertical'])

# For SuperAdminDashboard.tsx remove logs, tickets, invoices state
filepath_sa = r"c:\Arvinder\WebDevelopment\KidSynq\frontend\src\pages\SuperAdminDashboard.tsx"
with open(filepath_sa, "r", encoding="utf-8") as f:
    content = f.read()

content = re.sub(r"const \[logs, setLogs\] = useState<any\[\]>\(\[\]\);\n\s*", "", content)
content = re.sub(r"const \[tickets, setTickets\] = useState<any\[\]>\(\[\]\);\n\s*", "", content)
content = re.sub(r"const \[invoices, setInvoices\] = useState<any\[\]>\(\[\]\);\n\s*", "", content)
content = re.sub(r"api.get\('/super-admin/audit-logs/'\).then\(res => setLogs\(res.data\)\).catch\(console.error\);\n\s*", "", content)
content = re.sub(r"api.get\('/super-admin/support-tickets/'\).then\(res => setTickets\(res.data\)\).catch\(console.error\);\n\s*", "", content)
content = re.sub(r"api.get\('/super-admin/invoices/'\).then\(res => setInvoices\(res.data\)\).catch\(console.error\);\n\s*", "", content)

with open(filepath_sa, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed imports and state!")
