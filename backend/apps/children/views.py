from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from django.views import View

from core.decorators import StaffRequiredMixin
from core.models import (
    Daycare, Student, StudentEmergencyContact, StudentPickup,
    StudentAttendance, Classroom, ClassroomStudent, Program, DailyReport,
    RegistrationApplication, WaitlistEntry
)

def get_user_daycare(user):
    if user.daycare:
        return user.daycare
    return Daycare.objects.first()

class ChildListView(StaffRequiredMixin, View):
    template_name = 'children/list.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        query = request.GET.get('q', '').strip()
        room_filter = request.GET.get('room', '').strip()
        status_filter = request.GET.get('status', 'active').strip()

        children = Student.objects.filter(daycare=daycare, deleted_at__isnull=True).prefetch_related('classroom_enrollments__classroom').order_by('last_name', 'first_name')

        if query:
            children = children.filter(
                Q(first_name__icontains=query) | Q(last_name__icontains=query) |
                Q(medical_notes__icontains=query) | Q(allergies__icontains=query)
            )
        if room_filter:
            children = children.filter(classroom_enrollments__classroom_id=room_filter, classroom_enrollments__status='Active')
        if status_filter and status_filter != 'all':
            children = children.filter(status__iexact=status_filter)

        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')
        paginator = Paginator(children, 20)
        page_obj = paginator.get_page(request.GET.get('page'))

        return render(request, self.template_name, {
            'page_obj': page_obj,
            'classrooms': classrooms,
            'q': query,
            'room': room_filter,
            'status': status_filter
        })

class ChildCreateView(StaffRequiredMixin, View):
    template_name = 'children/form.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')
        programs = Program.objects.filter(daycare=daycare).order_by('name')
        return render(request, self.template_name, {
            'classrooms': classrooms,
            'programs': programs
        })

    def post(self, request):
        daycare = get_user_daycare(request.user)
        first_name = request.POST.get('first_name', '').strip()
        last_name = request.POST.get('last_name', '').strip()
        dob = request.POST.get('date_of_birth')
        gender = request.POST.get('gender', 'unspecified')
        classroom_id = request.POST.get('classroom_id')
        enrollment_date = request.POST.get('enrollment_date') or timezone.now().date()
        medical_info = request.POST.get('medical_info', '').strip()
        dietary_restrictions = request.POST.get('dietary_restrictions', '').strip()

        if not first_name or not last_name:
            messages.error(request, "First name and last name are required.")
            return redirect('daycare_child_new')

        student = Student.objects.create(
            daycare=daycare,
            first_name=first_name,
            last_name=last_name,
            dob=dob if dob else None,
            gender=gender,
            joining_date=enrollment_date,
            medical_notes=medical_info,
            dietary_restrictions=dietary_restrictions,
            status='Active'
        )

        if classroom_id:
            ClassroomStudent.objects.create(
                student=student,
                classroom_id=classroom_id,
                status='Active',
                start_date=enrollment_date
            )

        messages.success(request, f"Child '{first_name} {last_name}' enrolled successfully.")
        return redirect('daycare_child_detail', pk=student.id)

class ChildDetailView(StaffRequiredMixin, View):
    template_name = 'children/detail.html'

    def get(self, request, pk):
        daycare = get_user_daycare(request.user)
        child = get_object_or_404(Student, pk=pk, daycare=daycare)
        tab = request.GET.get('tab', 'overview')

        emergency_contacts = StudentEmergencyContact.objects.filter(student=child)
        pickups = StudentPickup.objects.filter(student=child)
        recent_attendance = StudentAttendance.objects.filter(student=child).order_by('-date')[:15]
        recent_reports = DailyReport.objects.filter(student=child).order_by('-date')[:7]
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')

        return render(request, self.template_name, {
            'child': child,
            'active_tab': tab,
            'emergency_contacts': emergency_contacts,
            'pickups': pickups,
            'recent_attendance': recent_attendance,
            'recent_reports': recent_reports,
            'classrooms': classrooms,
        })

    def post(self, request, pk):
        daycare = get_user_daycare(request.user)
        child = get_object_or_404(Student, pk=pk, daycare=daycare)
        action = request.POST.get('action')

        if action == 'update_personal':
            child.first_name = request.POST.get('first_name', child.first_name).strip()
            child.last_name = request.POST.get('last_name', child.last_name).strip()
            dob = request.POST.get('date_of_birth')
            if dob:
                child.date_of_birth = dob
            child.gender = request.POST.get('gender', child.gender)
            child.medical_info = request.POST.get('medical_info', child.medical_info).strip()
            child.dietary_restrictions = request.POST.get('dietary_restrictions', child.dietary_restrictions).strip()
            child.save()
            messages.success(request, "Personal details updated.")
        elif action == 'change_classroom':
            room_id = request.POST.get('classroom_id')
            child.classroom_id = room_id if room_id else None
            child.save()
            messages.success(request, "Classroom assignment updated.")
        elif action == 'add_contact':
            name = request.POST.get('contact_name', '').strip()
            relation = request.POST.get('relation', '').strip()
            phone = request.POST.get('phone', '').strip()
            if name:
                StudentEmergencyContact.objects.create(
                    student=child,
                    name=name,
                    relationship=relation,
                    phone_number=phone
                )
                messages.success(request, f"Emergency contact '{name}' added.")
        elif action == 'add_pickup':
            name = request.POST.get('pickup_name', '').strip()
            relation = request.POST.get('relation', '').strip()
            phone = request.POST.get('phone', '').strip()
            if name:
                StudentPickup.objects.create(
                    student=child,
                    name=name,
                    relationship=relation,
                    phone=phone,
                    is_authorized=True
                )
                messages.success(request, f"Authorized pickup person '{name}' added.")

        return redirect(f"{request.path}?tab={request.POST.get('tab', 'overview')}")

class AdmissionsListView(StaffRequiredMixin, View):
    template_name = 'children/admissions.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        applications = RegistrationApplication.objects.filter(daycare=daycare).order_by('-submitted_at')
        return render(request, self.template_name, {'applications': applications})

class WaitlistListView(StaffRequiredMixin, View):
    template_name = 'children/waitlist.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        waitlist = WaitlistEntry.objects.filter(daycare=daycare).order_by('priority', '-created_at')
        return render(request, self.template_name, {'waitlist': waitlist})

