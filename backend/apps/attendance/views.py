from django.contrib import messages
from django.db.models import Q
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from django.views import View

from core.decorators import StaffRequiredMixin
from core.models import (
    Daycare, Student, Classroom, StudentAttendance, DailyReport,
    MealRecord, NapRecord, ActivityRecord
)

def get_user_daycare(user):
    if user.daycare:
        return user.daycare
    return Daycare.objects.first()

class DailyAttendanceRollCallView(StaffRequiredMixin, View):
    template_name = 'daycare/attendance/daily.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.now().date()
        date_str = request.GET.get('date', today.strftime('%Y-%m-%d'))
        room_id = request.GET.get('classroom_id')

        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')
        children = Student.objects.filter(daycare=daycare, status__iexact='Active', deleted_at__isnull=True).prefetch_related('classroom_enrollments__classroom')

        if room_id:
            children = children.filter(classroom_enrollments__classroom_id=room_id, classroom_enrollments__status='Active')

        records = {att.student_id: att for att in StudentAttendance.objects.filter(daycare=daycare, attendance_date=date_str)}
        child_list = []
        for c in children:
            child_list.append({
                'child': c,
                'attendance': records.get(c.id)
            })

        return render(request, self.template_name, {
            'child_list': child_list,
            'classrooms': classrooms,
            'selected_date': date_str,
            'selected_room': room_id,
        })

    def post(self, request):
        daycare = get_user_daycare(request.user)
        student_id = request.POST.get('student_id')
        new_status = request.POST.get('status')
        date_str = request.POST.get('date', timezone.now().date().strftime('%Y-%m-%d'))

        student = get_object_or_404(Student, pk=student_id, daycare=daycare)
        att, _ = StudentAttendance.objects.get_or_create(
            daycare=daycare,
            student=student,
            attendance_date=date_str,
            defaults={'classroom': student.classroom}
        )
        att.status = new_status
        if new_status in ['present', 'checked_in'] and not att.check_in:
            att.check_in = timezone.now().time()
        elif new_status == 'checked_out' and not att.check_out:
            att.check_out = timezone.now().time()
        att.save()

        messages.success(request, f"Updated attendance for {student.first_name} to {new_status}.")
        return redirect(f"{request.path}?date={date_str}")

class MasterAttendanceDashboardView(StaffRequiredMixin, View):
    template_name = 'daycare/attendance/master_dashboard.html'
    def get(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.now().date()
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')
        return render(request, self.template_name, {'classrooms': classrooms, 'today': today})

class SafeArrivalDashboardView(StaffRequiredMixin, View):
    template_name = 'daycare/pickups/safe_arrival.html'
    def get(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.now().date()
        unnotified_absent = Student.objects.filter(daycare=daycare, status__iexact='Active').exclude(
            attendances__attendance_date=today
        )
        return render(request, self.template_name, {'unnotified_absent': unnotified_absent, 'today': today})

class PickupVerificationKioskView(StaffRequiredMixin, View):
    template_name = 'daycare/pickups/verification_kiosk.html'
    def get(self, request):
        daycare = get_user_daycare(request.user)
        return render(request, self.template_name, {'daycare': daycare})

class DailyReportsHubView(StaffRequiredMixin, View):
    template_name = 'daycare/daily_reports/hub.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.now().date()
        date_str = request.GET.get('date', today.strftime('%Y-%m-%d'))
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')
        reports = DailyReport.objects.filter(student__daycare=daycare, report_date=date_str).select_related('student')

        return render(request, self.template_name, {
            'reports': reports,
            'classrooms': classrooms,
            'selected_date': date_str
        })

class DailyChildReportDetailView(StaffRequiredMixin, View):
    template_name = 'daycare/daily_reports/detail.html'

    def get(self, request, child_id, date):
        child = get_object_or_404(Student, pk=child_id)
        report, _ = DailyReport.objects.get_or_create(student=child, date=date)
        meals = MealRecord.objects.filter(daily_report=report)
        naps = NapRecord.objects.filter(daily_report=report)
        activities = ActivityRecord.objects.filter(daily_report=report)

        return render(request, self.template_name, {
            'child': child,
            'report': report,
            'date': date,
            'meals': meals,
            'naps': naps,
            'activities': activities
        })

class HealthDashboardView(StaffRequiredMixin, View):
    template_name = 'daycare/health/dashboard.html'
    def get(self, request):
        daycare = get_user_daycare(request.user)
        allergies = Student.objects.filter(daycare=daycare, status__iexact='Active').filter(
            Q(allergies__isnull=False, allergies__gt='') |
            Q(medical_notes__isnull=False, medical_notes__gt='') |
            Q(medical_conditions__isnull=False, medical_conditions__gt='')
        ).prefetch_related('classroom_enrollments__classroom')
        return render(request, self.template_name, {'allergies': allergies})

