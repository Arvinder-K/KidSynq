from django.contrib import admin
from core.models import IncidentReport, InspectionVisit, AuditLog

try:
    @admin.register(IncidentReport)
    class IncidentReportAdmin(admin.ModelAdmin):
        list_display = ('title', 'daycare', 'incident_type', 'severity', 'incident_date')
        list_filter = ('severity', 'incident_type', 'incident_date')
        search_fields = ('title', 'description')
except admin.sites.AlreadyRegistered:
    pass

try:
    @admin.register(InspectionVisit)
    class InspectionVisitAdmin(admin.ModelAdmin):
        list_display = ('inspector_name', 'daycare', 'visit_date', 'status')
        list_filter = ('status', 'visit_date')
except admin.sites.AlreadyRegistered:
    pass

try:
    @admin.register(AuditLog)
    class AuditLogAdmin(admin.ModelAdmin):
        list_display = ('action', 'daycare', 'user', 'timestamp')
        list_filter = ('action', 'timestamp')
        search_fields = ('action', 'details')
except admin.sites.AlreadyRegistered:
    pass

