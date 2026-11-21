from django.contrib import messages
from django.shortcuts import render, redirect
from django.views import View

from core.models import Daycare, Program, RegistrationApplication

class RegistrationLandingView(View):
    template_name = 'public/registration_landing.html'
    def get(self, request, daycare_slug):
        daycare = Daycare.objects.filter(id=daycare_slug).first() or Daycare.objects.first()
        return render(request, self.template_name, {'daycare': daycare})

class RegistrationWizardView(View):
    template_name = 'public/registration_wizard.html'
    def get(self, request, daycare_slug):
        daycare = Daycare.objects.filter(id=daycare_slug).first() or Daycare.objects.first()
        programs = Program.objects.filter(daycare=daycare)
        return render(request, self.template_name, {'daycare': daycare, 'programs': programs})

    def post(self, request, daycare_slug):
        daycare = Daycare.objects.filter(id=daycare_slug).first() or Daycare.objects.first()
        child_fname = request.POST.get('child_first_name', '').strip()
        child_lname = request.POST.get('child_last_name', '').strip()
        guardian_name = request.POST.get('guardian_name', '').strip()
        guardian_email = request.POST.get('guardian_email', '').strip()
        guardian_phone = request.POST.get('guardian_phone', '').strip()

        if child_fname and child_lname and guardian_email:
            RegistrationApplication.objects.create(
                daycare=daycare,
                child_first_name=child_fname,
                child_last_name=child_lname,
                parent_first_name=guardian_name,
                parent_email=guardian_email,
                parent_phone=guardian_phone,
                status='submitted'
            )
            messages.success(request, "Your registration application has been submitted successfully! The daycare administrator will review it shortly.")
            return redirect('registration_landing', daycare_slug=daycare_slug)
        messages.error(request, "Please fill in all required application fields.")
        return redirect('registration_wizard', daycare_slug=daycare_slug)

