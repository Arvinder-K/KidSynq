import uuid
import secrets
from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from django.utils import timezone

from core.models import Daycare, Program, RegistrationApplication, FeeStructure

def resolve_daycare(slug_or_id):
    if not slug_or_id:
        return Daycare.objects.first()

    # 1. Try UUID lookup
    try:
        val = uuid.UUID(str(slug_or_id))
        dc = Daycare.objects.filter(id=val).first()
        if dc:
            return dc
    except (ValueError, TypeError, AttributeError):
        pass

    # 2. Try slug or exact name lookup
    dc = Daycare.objects.filter(slug=slug_or_id).first() or Daycare.objects.filter(name__iexact=slug_or_id).first()
    if dc:
        return dc

    # Fallback to first active daycare
    return Daycare.objects.filter(status='Active').first() or Daycare.objects.first()


class RegistrationLandingView(View):
    template_name = 'public/registration_landing.html'

    def get(self, request, daycare_slug):
        daycare = resolve_daycare(daycare_slug)
        if not daycare:
            daycare = Daycare.objects.first()

        programs = Program.objects.filter(daycare=daycare).order_by('name')
        fee_structures = FeeStructure.objects.filter(daycare=daycare, is_active=True).order_by('amount')[:4]

        return render(request, self.template_name, {
            'daycare': daycare,
            'programs': programs,
            'fee_structures': fee_structures,
        })


class RegistrationWizardView(View):
    template_name = 'public/registration_wizard.html'

    def get(self, request, daycare_slug):
        daycare = resolve_daycare(daycare_slug)
        if not daycare:
            daycare = Daycare.objects.first()

        programs = Program.objects.filter(daycare=daycare).order_by('name')
        fee_structures = FeeStructure.objects.filter(daycare=daycare, is_active=True).order_by('name')

        return render(request, self.template_name, {
            'daycare': daycare,
            'programs': programs,
            'fee_structures': fee_structures,
        })

    def post(self, request, daycare_slug):
        daycare = resolve_daycare(daycare_slug)
        if not daycare:
            daycare = Daycare.objects.first()

        # Child information
        child_fname = request.POST.get('child_first_name', '').strip()
        child_lname = request.POST.get('child_last_name', '').strip()
        dob = request.POST.get('date_of_birth')
        gender = request.POST.get('gender', 'unspecified')
        program_id = request.POST.get('program')

        # Parent / Guardian information
        guardian_fname = request.POST.get('guardian_first_name', '').strip()
        guardian_lname = request.POST.get('guardian_last_name', '').strip()
        guardian_legacy_name = request.POST.get('guardian_name', '').strip()
        if not guardian_fname and guardian_legacy_name:
            parts = guardian_legacy_name.split()
            guardian_fname = parts[0]
            guardian_lname = ' '.join(parts[1:]) if len(parts) > 1 else ''

        guardian_full_name = f"{guardian_fname} {guardian_lname}".strip() or guardian_legacy_name
        guardian_email = request.POST.get('guardian_email', '').strip()
        guardian_phone = request.POST.get('guardian_phone', '').strip()
        guardian_relation = request.POST.get('guardian_relationship', 'Parent')
        guardian_address = request.POST.get('guardian_address', '').strip()

        # Medical & Dietary
        medical_notes = request.POST.get('medical_notes', '').strip()
        dietary_restrictions = request.POST.get('dietary_restrictions', '').strip()
        emergency_contact_name = request.POST.get('emergency_contact_name', '').strip()
        emergency_contact_phone = request.POST.get('emergency_contact_phone', '').strip()

        if not child_fname or not child_lname or not guardian_email or not (guardian_fname or guardian_legacy_name):
            messages.error(request, "Please fill in all required fields (Child Name, Parent Name, Email, and Phone).")
            return redirect('registration_wizard', daycare_slug=daycare_slug)

        selected_program = Program.objects.filter(id=program_id, daycare=daycare).first() if program_id else None

        app_number = f"APP-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
        access_token = secrets.token_hex(16)
        now = timezone.now()

        app_data = {
            'child_first_name': child_fname,
            'child_last_name': child_lname,
            'date_of_birth': dob,
            'gender': gender,
            'program_id': str(selected_program.id) if selected_program else '',
            'program_name': selected_program.name if selected_program else 'General Childcare Program',
            'parent_first_name': guardian_fname,
            'parent_last_name': guardian_lname,
            'parent_email': guardian_email,
            'parent_phone': guardian_phone,
            'parent_relationship': guardian_relation,
            'parent_address': guardian_address,
            'medical_notes': medical_notes,
            'dietary_restrictions': dietary_restrictions,
            'emergency_contact_name': emergency_contact_name,
            'emergency_contact_phone': emergency_contact_phone,
            'submitted_via': 'Public Registration Portal'
        }

        application = RegistrationApplication.objects.create(
            daycare=daycare,
            application_number=app_number,
            applicant_name=guardian_full_name,
            applicant_email=guardian_email,
            applicant_phone=guardian_phone,
            status='submitted',
            submitted_at=now,
            created_at=now,
            updated_at=now,
            access_token=access_token,
            application_data=app_data
        )

        return render(request, 'public/registration_success.html', {
            'daycare': daycare,
            'application': application,
            'child_name': f"{child_fname} {child_lname}",
            'parent_name': guardian_full_name,
            'program_name': selected_program.name if selected_program else 'General Childcare Program',
        })
