from django.shortcuts import render
from django.utils import timezone
from django.views import View

from core.decorators import GuardianRequiredMixin
from core.models import Student, DailyReport, Invoice, StudentAttendance

def get_guardian_children(user):
    guardian = getattr(user, 'guardian_profile', None)
    if guardian:
        return Student.objects.filter(
            child_families__family__family_guardians__guardian=guardian,
            deleted_at__isnull=True
        ).distinct()
    return Student.objects.filter(
        child_families__family__family_guardians__guardian__user=user,
        deleted_at__isnull=True
    ).distinct()

class FamilyDashboardView(GuardianRequiredMixin, View):
    template_name = 'family/dashboard.html'

    def get(self, request):
        today = timezone.now().date()
        children = get_guardian_children(request.user)

        recent_reports = DailyReport.objects.filter(student__in=children, report_date=today)
        unpaid_invoices = Invoice.objects.filter(student__in=children, status__in=['unpaid', 'overdue', 'ISSUED', 'OVERDUE'])

        return render(request, self.template_name, {
            'children': children,
            'recent_reports': recent_reports,
            'unpaid_invoices': unpaid_invoices,
            'today': today
        })

class FamilyChildrenView(GuardianRequiredMixin, View):
    template_name = 'family/children.html'

    def get(self, request):
        children = get_guardian_children(request.user)
        return render(request, self.template_name, {'children': children})

class FamilyDailyReportsView(GuardianRequiredMixin, View):
    template_name = 'family/daily_reports.html'

    def get(self, request):
        today = timezone.now().date()
        date_str = request.GET.get('date', today.strftime('%Y-%m-%d'))
        children = get_guardian_children(request.user)
        reports = DailyReport.objects.filter(student__in=children, report_date=date_str).select_related('student')
        return render(request, self.template_name, {'reports': reports, 'selected_date': date_str})

class FamilyBillingView(GuardianRequiredMixin, View):
    template_name = 'family/billing.html'

    def get(self, request):
        children = get_guardian_children(request.user)
        invoices = Invoice.objects.filter(student__in=children).order_by('-issue_date')
        return render(request, self.template_name, {'invoices': invoices})

class FamilyProfileView(GuardianRequiredMixin, View):
    template_name = 'family/profile.html'
    def get(self, request):
        return render(request, self.template_name, {'user': request.user})

class FamilyGuardiansView(GuardianRequiredMixin, View):
    template_name = 'family/guardians.html'
    def get(self, request):
        return render(request, self.template_name, {'user': request.user})

class FamilyAttendanceView(GuardianRequiredMixin, View):
    template_name = 'family/attendance.html'
    def get(self, request):
        children = get_guardian_children(request.user)
        records = StudentAttendance.objects.filter(student__in=children).select_related('student', 'classroom').order_by('-attendance_date')[:30]
        return render(request, self.template_name, {'user': request.user, 'records': records})

class FamilyDocumentsView(GuardianRequiredMixin, View):
    template_name = 'family/documents.html'
    def get(self, request):
        return render(request, self.template_name, {'user': request.user})

class FamilyConsentsView(GuardianRequiredMixin, View):
    template_name = 'family/consents.html'
    def get(self, request):
        return render(request, self.template_name, {'user': request.user})
