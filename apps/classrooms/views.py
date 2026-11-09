from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from django.views import View

from core.decorators import StaffRequiredMixin
from core.models import (
    Daycare, Classroom, ClassroomTeacherAssignment, Student,
    StudentAttendance, StaffAttendance, Program, RatioRule
)

def get_user_daycare(user):
    if hasattr(user, 'daycare') and user.daycare:
        return user.daycare
    if hasattr(user, 'employee_profile') and user.employee_profile.daycare:
        return user.employee_profile.daycare
    return Daycare.objects.first()

class ClassroomListView(StaffRequiredMixin, View):
    template_name = 'classrooms/list.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')
        return render(request, self.template_name, {'classrooms': classrooms})

class ClassroomCreateEditView(StaffRequiredMixin, View):
    template_name = 'classrooms/form.html'

    def get(self, request, pk=None):
        daycare = get_user_daycare(request.user)
        room = get_object_or_404(Classroom, pk=pk, daycare=daycare) if pk else None
        programs = Program.objects.filter(daycare=daycare)
        return render(request, self.template_name, {'classroom': room, 'programs': programs})

    def post(self, request, pk=None):
        daycare = get_user_daycare(request.user)
        name = request.POST.get('name', '').strip()
        capacity = request.POST.get('capacity', '15')
        program_id = request.POST.get('program_id')

        if not name:
            messages.error(request, "Room name is required.")
            return redirect('daycare_classroom_new')

        if pk:
            room = get_object_or_404(Classroom, pk=pk, daycare=daycare)
            room.room_name = name
            room.capacity = int(capacity) if capacity else 15
            room.program_id = program_id if program_id else None
            room.save()
            messages.success(request, f"Classroom '{name}' updated.")
        else:
            room = Classroom.objects.create(
                daycare=daycare,
                room_name=name,
                capacity=int(capacity) if capacity else 15,
                program_id=program_id if program_id else None
            )
            messages.success(request, f"Classroom '{name}' created.")

        return redirect('daycare_classrooms')

class ClassroomDetailView(StaffRequiredMixin, View):
    template_name = 'classrooms/detail.html'

    def get(self, request, pk):
        daycare = get_user_daycare(request.user)
        room = get_object_or_404(Classroom, pk=pk, daycare=daycare)
        students = Student.objects.filter(classroom=room, status='active', deleted_at__isnull=True)
        teachers = ClassroomTeacherAssignment.objects.filter(classroom=room).select_related('employee')

        return render(request, self.template_name, {
            'classroom': room,
            'students': students,
            'teachers': teachers
        })

class RatioMonitoringView(StaffRequiredMixin, View):
    template_name = 'daycare/ratio/live_monitor.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.now().date()
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True)

        room_data = []
        for room in classrooms:
            children_present = StudentAttendance.objects.filter(
                classroom=room, attendance_date=today, attendance_status__in=['present', 'checked_in', 'PRESENT', 'CHECKED_IN']
            ).count()
            educators_present = StaffAttendance.objects.filter(
                date=today, status__in=['CLOCKED_IN', 'present', 'checked_in']
            ).count() or 1
            ratio = round(children_present / educators_present, 1)

            room_data.append({
                'room': room,
                'children': children_present,
                'educators': educators_present,
                'ratio': ratio,
                'compliant': ratio <= 8
            })

        return render(request, self.template_name, {'room_data': room_data, 'today': today})

class DaycareRatioRulesView(StaffRequiredMixin, View):
    template_name = 'daycare/ratio/rules.html'
    def get(self, request):
        daycare = get_user_daycare(request.user)
        rules = RatioRule.objects.filter(daycare=daycare)
        return render(request, self.template_name, {'rules': rules})

class ProgramsDashboardView(StaffRequiredMixin, View):
    template_name = 'daycare/programs/programs.html'
    def get(self, request):
        daycare = get_user_daycare(request.user)
        programs = Program.objects.filter(daycare=daycare)
        return render(request, self.template_name, {'programs': programs})

class AgeGroupManagementView(StaffRequiredMixin, View):
    template_name = 'daycare/programs/age_groups.html'
    def get(self, request):
        daycare = get_user_daycare(request.user)
        rules = RatioRule.objects.filter(daycare=daycare)
        return render(request, self.template_name, {'rules': rules})
