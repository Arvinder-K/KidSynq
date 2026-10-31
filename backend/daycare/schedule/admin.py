"""
Schedule and Attendance Domain Admin Configurations.
"""
from django.contrib import admin
from .models import StaffSchedule, LeaveRequest, DaycareHoliday

for model in [StaffSchedule, LeaveRequest, DaycareHoliday]:
    try:
        admin.site.register(model)
    except admin.sites.AlreadyRegistered:
        pass
