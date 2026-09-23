import os

file_path = "daycare/views.py"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# The clean content we want from line 467
clean_content = """from core.models import StudentAttendance
from core.serializers import AttendanceRosterSerializer, StaffAttendanceSerializer
from django.utils import timezone
from rest_framework import viewsets

class StaffAttendanceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = StaffAttendanceSerializer

    def get_queryset(self):
        daycare = self.request.user.daycare
        return StaffAttendance.objects.filter(employee__daycare=daycare).order_by('-date')

from core.models import SubscriptionPlan, DaycareSubscription, SubscriptionInvoice
from core.serializers import SubscriptionPlanSerializer
from decimal import Decimal
import datetime

class AttendanceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        daycare = request.user.daycare
        date_str = request.query_params.get('date')
"""

# we want to replace from index 466 (which was line 467 `from core.models import StudentAttendance`)
# down to wherever `if date_str:` is.
end_idx = -1
for i in range(466, len(lines)):
    if "if date_str:" in lines[i]:
        end_idx = i
        break

if end_idx != -1:
    new_lines = lines[:466] + [line + "\n" for line in clean_content.split('\n')[:-1]] + lines[end_idx:]
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print("Fixed!")
else:
    print("Could not find end index.")
