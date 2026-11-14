from datetime import datetime, timedelta
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from django.views import View

from core.decorators import StaffRequiredMixin
from core.models import (
    Daycare, Employee, EmployeeType, ECECredential,
    StaffSchedule, StaffAttendance, LeaveRequest, Classroom
)

def get_user_daycare(user):
    if user.daycare:
        return user.daycare
    return Daycare.objects.first()

class EmployeeListView(StaffRequiredMixin, View):
    template_name = 'staff/list.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        query = request.GET.get('q', '').strip()
        staff = Employee.objects.filter(daycare=daycare).select_related('user').order_by('last_name', 'first_name')

        if query:
            staff = staff.filter(
                Q(first_name__icontains=query) | Q(last_name__icontains=query) |
                Q(email__icontains=query) | Q(phone__icontains=query)
            )

        paginator = Paginator(staff, 20)
        page_obj = paginator.get_page(request.GET.get('page'))
        return render(request, self.template_name, {'page_obj': page_obj, 'q': query})

class EmployeeCreateView(StaffRequiredMixin, View):
    template_name = 'staff/create.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        emp_types = EmployeeType.objects.all()
        return render(request, self.template_name, {'emp_types': emp_types})

    def post(self, request):
        daycare = get_user_daycare(request.user)
        first_name = request.POST.get('first_name', '').strip()
        last_name = request.POST.get('last_name', '').strip()
        email = request.POST.get('email', '').strip()
        phone = request.POST.get('phone', request.POST.get('phone_number', '')).strip()
        emp_type = request.POST.get('employee_type', 'Full-Time')
        hire_date = request.POST.get('hire_date') or timezone.now().date()

        if not first_name or not last_name:
            messages.error(request, "First and last name are required.")
            return redirect('daycare_employee_new')

        emp = Employee.objects.create(
            daycare=daycare,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            employment_type=emp_type,
            role=emp_type,
            start_date=hire_date
        )

        messages.success(request, f"Employee '{first_name} {last_name}' added successfully.")
        return redirect('daycare_employee_detail', pk=emp.id)

class EmployeeDetailView(StaffRequiredMixin, View):
    template_name = 'staff/detail.html'

    def get(self, request, pk):
        daycare = get_user_daycare(request.user)
        emp = get_object_or_404(Employee, pk=pk, daycare=daycare)
        credentials = ECECredential.objects.filter(employee=emp)
        schedules = StaffSchedule.objects.filter(employee=emp).order_by('-date')[:10]
        attendance = StaffAttendance.objects.filter(employee=emp).order_by('-date')[:10]

        return render(request, self.template_name, {
            'employee': emp,
            'credentials': credentials,
            'schedules': schedules,
            'attendance': attendance
        })

class StaffDashboardView(StaffRequiredMixin, View):
    template_name = 'staff/dashboard.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        total_staff = Employee.objects.filter(daycare=daycare, status='active').count()
        credentials_expiring = ECECredential.objects.filter(
            employee__daycare=daycare, expiry_date__lte=timezone.now().date() + timedelta(days=60)
        ).count()
        pending_leave = LeaveRequest.objects.filter(employee__daycare=daycare, status='pending').count()

        return render(request, self.template_name, {
            'total_staff': total_staff,
            'credentials_expiring': credentials_expiring,
            'pending_leave': pending_leave,
        })

class CredentialDashboardView(StaffRequiredMixin, View):
    template_name = 'staff/credentials.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.now().date()
        credentials = ECECredential.objects.filter(employee__daycare=daycare).select_related('employee').order_by('expiry_date')

        return render(request, self.template_name, {
            'credentials': credentials,
            'today': today
        })

class StaffSchedulingView(StaffRequiredMixin, View):
    template_name = 'staff/scheduling.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)

        # Parse anchor date or week parameter
        date_param = request.GET.get('date') or request.GET.get('week')
        if date_param:
            try:
                anchor_date = datetime.strptime(date_param, '%Y-%m-%d').date()
            except ValueError:
                anchor_date = timezone.now().date()
        else:
            anchor_date = timezone.now().date()

        start_week = anchor_date - timedelta(days=anchor_date.weekday())
        end_week = start_week + timedelta(days=6)
        prev_week = start_week - timedelta(days=7)
        next_week = start_week + timedelta(days=7)
        today = timezone.now().date()

        # Filtering parameters
        emp_filter = request.GET.get('employee_id', '').strip()
        room_filter = request.GET.get('classroom_id', '').strip()
        type_filter = request.GET.get('shift_type', '').strip()

        schedules_qs = StaffSchedule.objects.filter(
            daycare=daycare, date__range=[start_week, end_week]
        ).select_related('employee', 'classroom').order_by('date', 'shift_start')

        if emp_filter:
            schedules_qs = schedules_qs.filter(employee_id=emp_filter)
        if room_filter:
            schedules_qs = schedules_qs.filter(classroom_id=room_filter)
        if type_filter:
            schedules_qs = schedules_qs.filter(shift_type=type_filter)

        schedules = list(schedules_qs)

        # Build 7-day calendar data structure (Monday to Sunday)
        days_of_week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        week_days = []
        for i in range(7):
            current_date = start_week + timedelta(days=i)
            day_schedules = [s for s in schedules if s.date == current_date]
            week_days.append({
                'name': days_of_week[i],
                'date': current_date,
                'date_str': current_date.strftime('%Y-%m-%d'),
                'is_today': current_date == today,
                'schedules': day_schedules,
                'count': len(day_schedules),
            })

        employees = Employee.objects.filter(daycare=daycare, status__iexact='active').order_by('first_name', 'last_name')
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')

        return render(request, self.template_name, {
            'schedules': schedules,
            'week_days': week_days,
            'employees': employees,
            'classrooms': classrooms,
            'start_week': start_week,
            'end_week': end_week,
            'prev_week': prev_week,
            'next_week': next_week,
            'today': today,
            'current_date_str': anchor_date.strftime('%Y-%m-%d'),
            'selected_emp': emp_filter,
            'selected_room': room_filter,
            'selected_type': type_filter,
            'total_shifts_count': len(schedules),
        })

    def post(self, request):
        daycare = get_user_daycare(request.user)
        action = request.POST.get('action')
        week_anchor = request.POST.get('week_anchor', '').strip()

        if action == 'create_shift':
            employee_id = request.POST.get('employee_id')
            shift_date = request.POST.get('shift_date')
            shift_start = request.POST.get('shift_start', '08:30').strip()
            shift_end = request.POST.get('shift_end', '17:00').strip()
            shift_type = request.POST.get('shift_type', 'regular').strip()
            classroom_id = request.POST.get('classroom_id')
            status = request.POST.get('status', 'scheduled').strip()
            notes = request.POST.get('notes', '').strip()

            if not employee_id or not shift_date or not shift_start or not shift_end:
                messages.error(request, "Staff member, date, start time, and end time are required.")
            else:
                emp = get_object_or_404(Employee, pk=employee_id, daycare=daycare)
                classroom = Classroom.objects.filter(pk=classroom_id, daycare=daycare).first() if classroom_id else None

                # Check duplicate shift for same employee and date/start
                existing = StaffSchedule.objects.filter(
                    employee=emp, date=shift_date, shift_start=shift_start
                ).first()
                if existing:
                    messages.warning(request, f"A shift starting at {shift_start} on {shift_date} already exists for {emp.first_name} {emp.last_name}.")
                else:
                    StaffSchedule.objects.create(
                        daycare=daycare,
                        employee=emp,
                        date=shift_date,
                        shift_start=shift_start,
                        shift_end=shift_end,
                        shift_type=shift_type,
                        classroom=classroom,
                        status=status,
                        notes=notes,
                        created_by=request.user
                    )
                    messages.success(request, f"Shift scheduled for {emp.first_name} {emp.last_name} on {shift_date} ({shift_start} - {shift_end}).")
                    week_anchor = shift_date

        elif action == 'delete_shift':
            schedule_id = request.POST.get('schedule_id')
            sched = get_object_or_404(StaffSchedule, pk=schedule_id, daycare=daycare)
            emp_name = f"{sched.employee.first_name} {sched.employee.last_name}"
            sched_date = sched.date
            sched.delete()
            messages.success(request, f"Shift on {sched_date} for {emp_name} was removed.")
            week_anchor = sched_date.strftime('%Y-%m-%d')

        elif action == 'copy_week':
            target_date_str = request.POST.get('target_week_start')
            source_start_str = request.POST.get('source_week_start')
            try:
                source_start = datetime.strptime(source_start_str, '%Y-%m-%d').date()
                target_start = datetime.strptime(target_date_str, '%Y-%m-%d').date()
                source_end = source_start + timedelta(days=6)
                offset_days = (target_start - source_start).days

                source_shifts = StaffSchedule.objects.filter(daycare=daycare, date__range=[source_start, source_end])
                copied_count = 0
                for s in source_shifts:
                    new_date = s.date + timedelta(days=offset_days)
                    if not StaffSchedule.objects.filter(employee=s.employee, date=new_date, shift_start=s.shift_start).exists():
                        StaffSchedule.objects.create(
                            daycare=daycare,
                            employee=s.employee,
                            date=new_date,
                            shift_start=s.shift_start,
                            shift_end=s.shift_end,
                            shift_type=s.shift_type,
                            classroom=s.classroom,
                            status='scheduled',
                            notes=s.notes,
                            created_by=request.user
                        )
                        copied_count += 1
                messages.success(request, f"Copied {copied_count} shift(s) to week starting {target_start.strftime('%b %d, %Y')}.")
                week_anchor = target_date_str
            except Exception as e:
                messages.error(request, f"Failed to copy shifts: {str(e)}")

        redirect_url = f"{request.path}?date={week_anchor}" if week_anchor else request.path
        return redirect(redirect_url)

class StaffAttendanceView(StaffRequiredMixin, View):
    template_name = 'staff/attendance.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.now().date()
        date_query = request.GET.get('date', today.strftime('%Y-%m-%d'))
        
        staff_attendance = StaffAttendance.objects.filter(
            daycare=daycare, date=date_query
        ).select_related('employee')
        employees = Employee.objects.filter(daycare=daycare, status='active')

        return render(request, self.template_name, {
            'staff_attendance': staff_attendance,
            'employees': employees,
            'selected_date': date_query,
        })

class StaffTimesheetsView(StaffRequiredMixin, View):
    template_name = 'staff/timesheets.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        records = StaffAttendance.objects.filter(daycare=daycare).select_related('employee').order_by('-date')[:30]
        return render(request, self.template_name, {'records': records})

class LeaveManagementView(StaffRequiredMixin, View):
    template_name = 'staff/leave.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        requests = LeaveRequest.objects.filter(employee__daycare=daycare).select_related('employee').order_by('-start_date')
        return render(request, self.template_name, {'requests': requests})

class OvertimeManagementView(StaffRequiredMixin, View):
    template_name = 'staff/overtime.html'
    def get(self, request):
        daycare = get_user_daycare(request.user)
        return render(request, self.template_name, {'daycare': daycare})

class ShiftSwapCenterView(StaffRequiredMixin, View):
    template_name = 'staff/shift_swaps.html'
    def get(self, request):
        daycare = get_user_daycare(request.user)
        return render(request, self.template_name, {'daycare': daycare})

class StaffShortageView(StaffRequiredMixin, View):
    template_name = 'staff/shortages.html'
    def get(self, request):
        daycare = get_user_daycare(request.user)
        return render(request, self.template_name, {'daycare': daycare})

