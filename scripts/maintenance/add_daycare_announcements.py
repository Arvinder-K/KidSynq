import os

filepath_views = r"c:\Arvinder\WebDevelopment\KidSynq\backend\daycare\views.py"
filepath_urls = r"c:\Arvinder\WebDevelopment\KidSynq\backend\daycare\urls.py"

with open(filepath_views, "r", encoding="utf-8") as f:
    views_content = f.read()

# Add the view to views.py
view_code = """
from core.models import SystemAnnouncement
from core.serializers import SystemAnnouncementSerializer
from django.db.models import Q

class DaycareSystemAnnouncementListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response([])
            
        announcements = SystemAnnouncement.objects.filter(
            status='published',
        ).filter(
            Q(target_daycares__isnull=True) | Q(target_daycares=daycare)
        ).distinct().order_by('-created_at')
        
        serializer = SystemAnnouncementSerializer(announcements, many=True)
        return Response(serializer.data)
"""

if "class DaycareSystemAnnouncementListView" not in views_content:
    views_content += "\n" + view_code
    with open(filepath_views, "w", encoding="utf-8") as f:
        f.write(views_content)
    print("Added DaycareSystemAnnouncementListView to views.py")

with open(filepath_urls, "r", encoding="utf-8") as f:
    urls_content = f.read()

if "system-announcements" not in urls_content:
    urls_content = urls_content.replace(
        "path('health/dashboard/', views.HealthDashboardView.as_view(), name='health_dashboard'),",
        "path('health/dashboard/', views.HealthDashboardView.as_view(), name='health_dashboard'),\n    path('system-announcements/', views.DaycareSystemAnnouncementListView.as_view(), name='daycare_system_announcements'),"
    )
    with open(filepath_urls, "w", encoding="utf-8") as f:
        f.write(urls_content)
    print("Added system-announcements route to urls.py")
