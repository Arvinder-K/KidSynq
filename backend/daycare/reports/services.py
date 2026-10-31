"""
Reports and Analytics Domain Services.
Business logic for ratio monitoring, daily logs, and compliance audits.
"""
from core.models import RatioComplianceHistory, IncidentReport

class ReportsService:
    @staticmethod
    def get_daycare_incidents(daycare):
        return IncidentReport.objects.filter(daycare=daycare)

    @staticmethod
    def get_compliance_history(daycare):
        return RatioComplianceHistory.objects.filter(daycare=daycare).order_by('-timestamp')
