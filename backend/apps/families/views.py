from django.shortcuts import render
from django.utils import timezone
from django.views import View

from core.decorators import GuardianRequiredMixin
from core.models import Student, DailyReport, Invoice

class FamilyDashboardView(GuardianRequiredMixin, View):
    template_name = 'family/dashboard.html'

    def get(self, request):
        guardian = getattr(request.user, 'guardian_profile', None)
        today = timezone.now().date()
        children = Student.objects.filter(family_relationships__guardian__user=request.user) if not guardian else Student.objects.filter(family_relationships__guardian=guardian)

        recent_reports = DailyReport.objects.filter(student__in=children, date=today)
        unpaid_invoices = Invoice.objects.filter(student__in=children, status__in=['unpaid', 'overdue'])

        return render(request, self.template_name, {
            'children': children,
            'recent_reports': recent_reports,
            'unpaid_invoices': unpaid_invoices,
            'today': today
        })

class FamilyChildrenView(GuardianRequiredMixin, View):
    template_name = 'family/children.html'

    def get(self, request):
        children = Student.objects.filter(family_relationships__guardian__user=request.user)
        return render(request, self.template_name, {'children': children})

class FamilyDailyReportsView(GuardianRequiredMixin, View):
    template_name = 'family/daily_reports.html'

    def get(self, request):
        today = timezone.now().date()
        date_str = request.GET.get('date', today.strftime('%Y-%m-%d'))
        reports = DailyReport.objects.filter(student__family_relationships__guardian__user=request.user, date=date_str).select_related('student')
        return render(request, self.template_name, {'reports': reports, 'selected_date': date_str})

class FamilyBillingView(GuardianRequiredMixin, View):
    template_name = 'family/billing.html'

    def get(self, request):
        invoices = Invoice.objects.filter(student__family_relationships__guardian__user=request.user).order_by('-issue_date')
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
        return render(request, self.template_name, {'user': request.user})

class FamilyDocumentsView(GuardianRequiredMixin, View):
    template_name = 'family/documents.html'
    def get(self, request):
        return render(request, self.template_name, {'user': request.user})

class FamilyConsentsView(GuardianRequiredMixin, View):
    template_name = 'family/consents.html'
    def get(self, request):
        return render(request, self.template_name, {'user': request.user})

