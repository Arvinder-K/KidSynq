from django.contrib import admin
from core.models import StudentAttendance, StaffAttendance

try:
    @admin.register(StudentAttendance)
    class StudentAttendanceAdmin(admin.ModelAdmin):
        list_display = ('student', 'date', 'status', 'check_in', 'check_out')
        list_filter = ('status', 'date')
except admin.sites.AlreadyRegistered:
    pass

try:
    @admin.register(StaffAttendance)
    class StaffAttendanceAdmin(admin.ModelAdmin):
        list_display = ('employee', 'date', 'status', 'check_in', 'check_out')
        list_filter = ('status', 'date')
except admin.sites.AlreadyRegistered:
    pass

