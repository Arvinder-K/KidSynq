from django.contrib import admin
from core.models import Employee, ECECredential

try:
    @admin.register(Employee)
    class StaffEmployeeAdmin(admin.ModelAdmin):
        list_display = ('first_name', 'last_name', 'daycare', 'role', 'status')
        search_fields = ('first_name', 'last_name', 'email')
        list_filter = ('status', 'daycare')
except admin.sites.AlreadyRegistered:
    pass

try:
    @admin.register(ECECredential)
    class StaffCredentialAdmin(admin.ModelAdmin):
        list_display = ('employee', 'credential_type', 'certificate_number', 'expiry_date')
except admin.sites.AlreadyRegistered:
    pass

