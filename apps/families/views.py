from django.contrib import messages
from django.contrib.auth import update_session_auth_hash
from django.shortcuts import render, redirect
from django.utils import timezone
from django.views import View

from core.decorators import GuardianRequiredMixin
from core.models import (
    Student, DailyReport, Invoice, StudentAttendance,
    Family, Guardian, FamilyGuardian, StudentPickup
)

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

def get_guardian_family(user):
    guardian = getattr(user, 'guardian_profile', None)
    if not guardian:
        guardian = Guardian.objects.filter(user=user).first()
    if not guardian and getattr(user, 'email', None):
        guardian = Guardian.objects.filter(email=user.email).first()

    family = None
    if guardian:
        fg = guardian.guardian_families.select_related('family').first()
        if fg and fg.family:
            family = fg.family

    if not family and getattr(user, 'email', None):
        family = Family.objects.filter(primary_email=user.email).first()

    return guardian, family

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
        reports = DailyReport.objects.filter(
            student__in=children,
            report_date=date_str
        ).select_related(
            'student', 'classroom', 'teacher', 'attendance_record', 'attendance_record__pickup_person'
        ).prefetch_related(
            'meals', 'naps', 'toileting', 'activities', 'moods', 'temperatures', 'photos'
        )
        return render(request, self.template_name, {
            'reports': reports,
            'selected_date': date_str,
            'children': children
        })

class FamilyBillingView(GuardianRequiredMixin, View):
    template_name = 'family/billing.html'

    def get(self, request):
        children = get_guardian_children(request.user)
        invoices = Invoice.objects.filter(student__in=children).order_by('-issue_date')
        return render(request, self.template_name, {'invoices': invoices})

class FamilyProfileView(GuardianRequiredMixin, View):
    template_name = 'family/profile.html'

    def get(self, request):
        guardian, family = get_guardian_family(request.user)
        children = get_guardian_children(request.user)
        
        family_guardians = []
        if family:
            family_guardians = family.family_guardians.select_related('guardian', 'guardian__user').all()
        
        pickups = StudentPickup.objects.filter(student__in=children) if children else StudentPickup.objects.none()
        if family:
            pickups = pickups | StudentPickup.objects.filter(family=family)
        pickups_count = pickups.distinct().count()

        return render(request, self.template_name, {
            'user': request.user,
            'guardian': guardian,
            'family': family,
            'children': children,
            'family_guardians': family_guardians,
            'pickups_count': pickups_count,
        })

    def post(self, request):
        action = request.POST.get('action')
        guardian, family = get_guardian_family(request.user)

        if action == 'update_profile':
            first_name = request.POST.get('first_name', '').strip()
            last_name = request.POST.get('last_name', '').strip()
            phone = request.POST.get('phone', '').strip()
            address = request.POST.get('address', '').strip()
            family_name = request.POST.get('family_name', '').strip()

            if first_name:
                request.user.first_name = first_name
            if last_name:
                request.user.last_name = last_name
            request.user.save()

            if guardian:
                if first_name:
                    guardian.first_name = first_name
                if last_name:
                    guardian.last_name = last_name
                if phone:
                    guardian.phone = phone
                guardian.save()

            if family:
                if family_name:
                    family.family_name = family_name
                if phone:
                    family.primary_phone = phone
                if address:
                    family.address = address
                family.save()

            messages.success(request, "Household and contact details updated successfully.")

        elif action == 'change_password':
            current_password = request.POST.get('current_password', '')
            new_password = request.POST.get('new_password', '')
            confirm_password = request.POST.get('confirm_password', '')

            if not request.user.check_password(current_password):
                messages.error(request, "The current password entered is incorrect.")
            elif len(new_password) < 6:
                messages.error(request, "New password must be at least 6 characters long.")
            elif new_password != confirm_password:
                messages.error(request, "New password and confirmation do not match.")
            else:
                request.user.set_password(new_password)
                request.user.save()
                update_session_auth_hash(request, request.user)
                messages.success(request, "Your password has been changed successfully.")
        
        return redirect('family_profile_page')

class FamilyGuardiansView(GuardianRequiredMixin, View):
    template_name = 'family/guardians.html'

    def get(self, request):
        guardian, family = get_guardian_family(request.user)
        children = get_guardian_children(request.user)
        
        family_guardians = []
        if family:
            family_guardians = family.family_guardians.select_related('guardian', 'guardian__user').all()
        
        pickups = StudentPickup.objects.filter(student__in=children) if children else StudentPickup.objects.none()
        if family:
            pickups = pickups | StudentPickup.objects.filter(family=family)
        pickups = pickups.select_related('student').distinct()

        return render(request, self.template_name, {
            'user': request.user,
            'guardian': guardian,
            'family': family,
            'children': children,
            'family_guardians': family_guardians,
            'pickups': pickups,
        })

    def post(self, request):
        action = request.POST.get('action')
        guardian, family = get_guardian_family(request.user)
        children = get_guardian_children(request.user)

        if action == 'add_pickup':
            name = request.POST.get('name', '').strip()
            relationship = request.POST.get('relationship', 'Authorized Pickup').strip()
            phone = request.POST.get('phone', '').strip()
            email = request.POST.get('email', '').strip()
            notes = request.POST.get('notes', '').strip()
            student_id = request.POST.get('student_id')

            if not name or not phone:
                messages.error(request, "Full name and contact phone number are required.")
            else:
                student = None
                if student_id:
                    student = children.filter(id=student_id).first()
                if not student:
                    student = children.first()
                
                if not student:
                    messages.error(request, "No enrolled child record found to link pickup authorization.")
                else:
                    StudentPickup.objects.create(
                        daycare=student.daycare,
                        student=student,
                        family=family,
                        name=name,
                        relationship=relationship,
                        phone=phone,
                        email=email if email else None,
                        notes=notes if notes else None,
                        authorization_status='ACTIVE',
                        created_by=request.user
                    )
                    messages.success(request, f"Authorized pickup '{name}' has been added successfully.")
        
        return redirect('family_guardians_page')

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
