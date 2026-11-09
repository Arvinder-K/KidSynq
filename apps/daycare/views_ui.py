"""
Daycare UI Views.
Centralizes daycare tenant operations and re-exports modular domain views
from children, staff, classrooms, attendance, billing, payments, subscriptions,
families, enrollment, notifications, and reports apps for MTV templates.
"""
import json
from decimal import Decimal
from datetime import timedelta
from django.contrib import messages
from django.db.models import Sum
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from django.views import View

from core.decorators import DaycareAdminRequiredMixin, StaffRequiredMixin, GuardianRequiredMixin
from core.models import (
    Daycare, Branch, DaycareSettings, DaycareHoliday, DaycareEmergencyInformation,
    Student, StudentAttendance, Employee, StaffAttendance, Classroom, Invoice, Document
)

# --- Re-export domain views from modular apps ---
from apps.children.views import (
    ChildListView, ChildCreateView, ChildDetailView, AdmissionsListView, WaitlistListView
)
from apps.staff.views import (
    EmployeeListView, EmployeeCreateView, EmployeeDetailView, StaffDashboardView,
    CredentialDashboardView, StaffSchedulingView, StaffAttendanceView, StaffTimesheetsView,
    LeaveManagementView, OvertimeManagementView, ShiftSwapCenterView, StaffShortageView
)
from apps.classrooms.views import (
    ClassroomListView, ClassroomCreateEditView, ClassroomDetailView,
    RatioMonitoringView, DaycareRatioRulesView, ProgramsDashboardView, AgeGroupManagementView
)
from apps.attendance.views import (
    DailyAttendanceRollCallView, MasterAttendanceDashboardView,
    SafeArrivalDashboardView, PickupVerificationKioskView,
    DailyReportsHubView, DailyChildReportDetailView, HealthDashboardView
)
from apps.billing.views import (
    InvoicesListView, InvoiceDetailView, FeeStructuresView,
    SubsidiesCWELCCView, TaxReceiptsStatementsView, DiscountsCreditsView
)
from apps.payments.views import (
    PaymentsReceiptsView
)
from apps.subscriptions.views import (
    DaycareSubscriptionView
)
from apps.families.views import (
    FamilyDashboardView, FamilyChildrenView, FamilyDailyReportsView, FamilyBillingView,
    FamilyProfileView, FamilyGuardiansView, FamilyAttendanceView, FamilyDocumentsView,
    FamilyConsentsView
)
from apps.enrollment.views import (
    RegistrationLandingView, RegistrationWizardView
)
from apps.notifications.views import (
    CommunicationDashboardView, ConsentFormsView
)
from apps.reports.views import (
    ReportsHubView, AttendanceReportView, FinancialReportView
)


def get_user_daycare(user):
    if hasattr(user, 'daycare') and user.daycare:
        return user.daycare
    if hasattr(user, 'employee_profile') and user.employee_profile.daycare:
        return user.employee_profile.daycare
    return Daycare.objects.first()


# =========================================================================
# DAYCARE OPERATIONS & SETTINGS VIEWS
# =========================================================================

class DaycareDashboardView(StaffRequiredMixin, View):
    template_name = 'daycare/dashboard.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.now().date()

        # Operational KPIs
        student_count = Student.objects.filter(daycare=daycare, deleted_at__isnull=True).count()
        staff_count = Employee.objects.filter(daycare=daycare).count()
        classroom_count = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).count()

        checked_in_today = StudentAttendance.objects.filter(
            daycare=daycare, attendance_date=today, attendance_status__in=['present', 'checked_in', 'PRESENT', 'CHECKED_IN']
        ).count()

        staff_on_duty = StaffAttendance.objects.filter(
            daycare=daycare, date=today, status__in=['CLOCKED_IN', 'present', 'checked_in']
        ).select_related('employee').count()

        unpaid_invoices = Invoice.objects.filter(daycare=daycare, status__in=['ISSUED', 'OVERDUE', 'DRAFT', 'unpaid', 'overdue'])
        unpaid_count = unpaid_invoices.count()
        unpaid_total = unpaid_invoices.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')[:6]

        recent_checkins = StudentAttendance.objects.filter(
            daycare=daycare, attendance_date=today
        ).select_related('student', 'classroom').order_by('-check_in_time')[:8]

        recent_invoices = Invoice.objects.filter(daycare=daycare).select_related('student').order_by('-issue_date')[:6]

        # Weekly Attendance trend
        week_days = []
        week_counts = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            cnt = StudentAttendance.objects.filter(daycare=daycare, attendance_date=d, attendance_status__in=['present', 'checked_in', 'PRESENT', 'CHECKED_IN']).count()
            week_days.append(d.strftime('%a'))
            week_counts.append(cnt)

        # Classroom Capacity distribution
        room_labels = [c.room_name for c in classrooms]
        room_capacities = [c.capacity or 15 for c in classrooms]
        if not room_labels:
            room_labels = ['Infant Room', 'Toddler Room', 'Preschool']
            room_capacities = [10, 15, 20]

        context = {
            'daycare': daycare,
            'student_count': student_count,
            'staff_count': staff_count,
            'classroom_count': classroom_count,
            'checked_in_today': checked_in_today,
            'staff_on_duty': staff_on_duty,
            'unpaid_count': unpaid_count,
            'unpaid_total': unpaid_total,
            'classrooms': classrooms,
            'recent_checkins': recent_checkins,
            'recent_invoices': recent_invoices,
            'chart_week_labels': json.dumps(week_days),
            'chart_week_data': json.dumps(week_counts),
            'chart_room_labels': json.dumps(room_labels),
            'chart_room_data': json.dumps(room_capacities),
        }
        return render(request, self.template_name, context)


class DaycareSettingsView(DaycareAdminRequiredMixin, View):
    template_name = 'daycare/settings/settings.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        settings_obj = DaycareSettings.objects.filter(daycare=daycare).first()
        return render(request, self.template_name, {'daycare': daycare, 'settings': settings_obj})

    def post(self, request):
        daycare = get_user_daycare(request.user)
        daycare.name = request.POST.get('name', daycare.name).strip()
        daycare.email = request.POST.get('email', daycare.email).strip()
        daycare.phone = request.POST.get('phone', daycare.phone).strip()
        daycare.address = request.POST.get('address', daycare.address).strip()
        daycare.save()

        settings_obj, _ = DaycareSettings.objects.get_or_create(daycare=daycare)
        settings_obj.operating_hours_open = request.POST.get('operating_hours_open', settings_obj.operating_hours_open)
        settings_obj.operating_hours_close = request.POST.get('operating_hours_close', settings_obj.operating_hours_close)
        settings_obj.timezone = request.POST.get('timezone', settings_obj.timezone)
        settings_obj.currency = request.POST.get('currency', settings_obj.currency)
        settings_obj.save()

        messages.success(request, "Daycare profile and operating settings updated.")
        return redirect('daycare_settings')


class UserProfileView(StaffRequiredMixin, View):
    template_name = 'daycare/profile/user_profile.html'

    def get(self, request):
        return render(request, self.template_name, {'user': request.user})

    def post(self, request):
        user = request.user
        user.first_name = request.POST.get('first_name', user.first_name).strip()
        user.last_name = request.POST.get('last_name', user.last_name).strip()
        user.email = request.POST.get('email', user.email).strip()

        new_password = request.POST.get('new_password', '').strip()
        if new_password:
            user.set_password(new_password)
            messages.success(request, "Password updated successfully.")

        user.save()
        messages.success(request, "Profile details saved.")
        return redirect('daycare_profile')


class BranchListView(StaffRequiredMixin, View):
    template_name = 'daycare/branches/list.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        branches = Branch.objects.filter(daycare=daycare, deleted_at__isnull=True)
        return render(request, self.template_name, {'branches': branches})


class DaycareHolidaysView(StaffRequiredMixin, View):
    template_name = 'daycare/holidays/list.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        holidays = DaycareHoliday.objects.filter(daycare=daycare).order_by('holiday_date')
        return render(request, self.template_name, {'holidays': holidays})


class EmergencyInfoView(StaffRequiredMixin, View):
    template_name = 'daycare/emergency/info.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        emergency_info = DaycareEmergencyInformation.objects.filter(daycare=daycare).first()
        return render(request, self.template_name, {'emergency_info': emergency_info})


class DocumentManagerView(StaffRequiredMixin, View):
    template_name = 'daycare/documents/manager.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        documents = Document.objects.filter(daycare=daycare)
        return render(request, self.template_name, {'documents': documents})


class ComplianceDashboardView(StaffRequiredMixin, View):
    template_name = 'daycare/compliance/dashboard.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        return render(request, self.template_name, {'daycare': daycare})
