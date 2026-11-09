from django.shortcuts import render
from django.views import View
from django.utils import timezone
from core.decorators import StaffRequiredMixin
from core.models import (
    StudentAttendance, Invoice, Payment, StaffAttendance,
    IncidentReport, InspectionVisit, RatioComplianceHistory
)

def get_user_daycare(user):
    if hasattr(user, 'employee_profile') and user.employee_profile.daycare:
        return user.employee_profile.daycare
    from core.models import Daycare
    return Daycare.objects.first()

class ReportsHubView(StaffRequiredMixin, View):
    template_name = 'daycare/reports/hub.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.localdate()
        
        # Attendance stats
        present_count = StudentAttendance.objects.filter(
            student__daycare=daycare, date=today, status='present'
        ).count()
        absent_count = StudentAttendance.objects.filter(
            student__daycare=daycare, date=today, status='absent'
        ).count()

        # Billing stats
        unpaid_invoices_count = Invoice.objects.filter(
            daycare=daycare, status__in=['draft', 'sent', 'overdue']
        ).count()

        # Incident / Compliance stats
        recent_incidents = IncidentReport.objects.filter(daycare=daycare).order_by('-incident_date')[:5]

        return render(request, self.template_name, {
            'daycare': daycare,
            'today': today,
            'present_count': present_count,
            'absent_count': absent_count,
            'unpaid_invoices_count': unpaid_invoices_count,
            'recent_incidents': recent_incidents,
        })

class AttendanceReportView(StaffRequiredMixin, View):
    template_name = 'daycare/reports/attendance.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        records = StudentAttendance.objects.filter(
            student__daycare=daycare
        ).select_related('student', 'classroom').order_by('-date')[:100]
        return render(request, self.template_name, {'daycare': daycare, 'records': records})

class FinancialReportView(StaffRequiredMixin, View):
    template_name = 'daycare/reports/financial.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        invoices = Invoice.objects.filter(daycare=daycare).order_by('-created_at')[:50]
        payments = Payment.objects.filter(invoice__daycare=daycare).order_by('-payment_date')[:50]
        return render(request, self.template_name, {
            'daycare': daycare,
            'invoices': invoices,
            'payments': payments,
        })
