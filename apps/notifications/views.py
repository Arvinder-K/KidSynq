from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from django.contrib import messages
from django.utils import timezone
from core.decorators import StaffRequiredMixin
from core.models import Announcement, ConsentForm
from .forms import AnnouncementForm, ConsentFormCreateForm

def get_user_daycare(user):
    if hasattr(user, 'daycare') and user.daycare:
        return user.daycare
    if hasattr(user, 'employee_profile') and user.employee_profile.daycare:
        return user.employee_profile.daycare
    from core.models import Daycare
    return Daycare.objects.first()

class CommunicationDashboardView(StaffRequiredMixin, View):
    template_name = 'daycare/communication/dashboard.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        announcements = Announcement.objects.filter(daycare=daycare).order_by('-created_at')
        form = AnnouncementForm()
        return render(request, self.template_name, {
            'announcements': announcements,
            'form': form,
            'daycare': daycare,
        })

    def post(self, request):
        daycare = get_user_daycare(request.user)
        form = AnnouncementForm(request.POST)
        if form.is_valid():
            announcement = form.save(commit=False)
            announcement.daycare = daycare
            announcement.sender = request.user
            announcement.published_at = timezone.now()
            announcement.save()
            messages.success(request, "Announcement published successfully.")
            return redirect('daycare_communication')
        announcements = Announcement.objects.filter(daycare=daycare).order_by('-created_at')
        return render(request, self.template_name, {
            'announcements': announcements,
            'form': form,
            'daycare': daycare,
        })

class ConsentFormsView(StaffRequiredMixin, View):
    template_name = 'daycare/consents/list.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        consents = ConsentForm.objects.filter(daycare=daycare)
        form = ConsentFormCreateForm()
        return render(request, self.template_name, {
            'consents': consents,
            'form': form,
            'daycare': daycare,
        })

    def post(self, request):
        daycare = get_user_daycare(request.user)
        form = ConsentFormCreateForm(request.POST)
        if form.is_valid():
            consent = form.save(commit=False)
            consent.daycare = daycare
            consent.created_by = request.user
            consent.version = 1
            consent.status = 'active'
            consent.created_at = timezone.now()
            consent.updated_at = timezone.now()
            consent.save()
            messages.success(request, "Consent form template created.")
            return redirect('daycare_consent_forms')
        consents = ConsentForm.objects.filter(daycare=daycare)
        return render(request, self.template_name, {
            'consents': consents,
            'form': form,
            'daycare': daycare,
        })
