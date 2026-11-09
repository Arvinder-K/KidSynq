from django.contrib import admin
from core.models import RegistrationApplication, WaitlistEntry

try:
    @admin.register(RegistrationApplication)
    class RegistrationApplicationAdmin(admin.ModelAdmin):
        list_display = ('child_first_name', 'child_last_name', 'parent_email', 'status', 'daycare', 'created_at')
        list_filter = ('status', 'created_at')
        search_fields = ('child_first_name', 'child_last_name', 'parent_email', 'parent_phone')
except admin.sites.AlreadyRegistered:
    pass

try:
    @admin.register(WaitlistEntry)
    class WaitlistEntryAdmin(admin.ModelAdmin):
        list_display = ('child_first_name', 'child_last_name', 'applicant_name', 'priority', 'status', 'daycare')
        list_filter = ('status', 'priority')
        search_fields = ('child_first_name', 'child_last_name', 'applicant_name', 'applicant_email')
except admin.sites.AlreadyRegistered:
    pass
