import os
from pathlib import Path

# Dynamically resolve relative to this script so it works on both hosting and local
BASE_DIR = Path(__file__).resolve().parent
filepath = BASE_DIR / "src" / "pages" / "SuperAdminDashboard.tsx"

if filepath.exists():
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Fix the type of activeTab
    content = content.replace(
        "const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'daycares' | 'daycare-admins' | 'users' | 'plans' | 'subscriptions' | 'logs' | 'tickets' | 'invoices' | 'payments'>('dashboard');",
        "const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'daycares' | 'daycare-admins' | 'users' | 'plans' | 'subscriptions' | 'logs' | 'tickets' | 'invoices' | 'payments' | 'announcements'>('dashboard');"
    )

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

print("Fixed activeTab type!")
