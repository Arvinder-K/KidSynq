import os

filepath = r"c:\Arvinder\WebDevelopment\KidSynq\frontend\src\pages\Dashboard.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

import_lucide = "import { Users, Activity, Utensils, AlertTriangle"
new_import_lucide = "import { Users, Activity, Utensils, AlertTriangle, Megaphone, X"
if "Megaphone" not in content:
    content = content.replace(import_lucide, new_import_lucide)

# Add state for announcements
state_code = """
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
"""
content = content.replace(
    "const [stats, setStats] = useState<DashboardStats | null>(null);\n    const [loading, setLoading] = useState(true);",
    state_code
)

# Fetch announcements in useEffect
fetch_code = """
        const fetchStats = async () => {
            try {
                const [statsResponse, annResponse] = await Promise.all([
                    api.get('/dashboard/stats/'),
                    api.get('/system-announcements/')
                ]);
                setStats(statsResponse.data);
                setAnnouncements(annResponse.data || []);
            } catch (error) {
"""
content = content.replace(
    """        const fetchStats = async () => {
            try {
                const response = await api.get('/dashboard/stats/');
                setStats(response.data);
            } catch (error) {""",
    fetch_code
)

# Add rendering of announcements right before the Overview header
announcement_ui = """
            {/* System Announcements */}
            {announcements.filter(a => !dismissedAnnouncements.includes(a.id)).map(announcement => (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={announcement.id}
                    className="mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-5 text-white flex gap-4 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Megaphone className="w-32 h-32 transform rotate-12 translate-x-8 -translate-y-8" />
                    </div>
                    <div className="bg-white/20 p-3 rounded-lg shrink-0 flex items-center justify-center backdrop-blur-sm self-start">
                        <Megaphone className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 pr-8 relative z-10">
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-lg">{announcement.title}</h3>
                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">System Update</span>
                        </div>
                        <p className="text-indigo-50 text-sm whitespace-pre-wrap">{announcement.content}</p>
                    </div>
                    <button
                        onClick={() => setDismissedAnnouncements(prev => [...prev, announcement.id])}
                        className="absolute top-4 right-4 p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </motion.div>
            ))}

            <div className="mb-8">
"""
content = content.replace(
    """            <div className="mb-8">""",
    announcement_ui
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated Dashboard.tsx")
