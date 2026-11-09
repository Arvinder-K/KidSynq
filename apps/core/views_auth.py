from django.contrib import messages
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.shortcuts import render, redirect
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.views import View

from core.models import GuardianInvitation, GuardianPasswordResetToken

User = get_user_model()

class UserLoginView(View):
    template_name = 'authentication/login.html'

    def get(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('dashboard_router')
        
        login_type = request.GET.get('type', 'daycare')
        return render(request, self.template_name, {
            'login_type': login_type,
            'next': request.GET.get('next', '')
        })

    def post(self, request, *args, **kwargs):
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        login_type = request.POST.get('login_type', 'daycare')
        next_url = request.POST.get('next', '')

        if not username or not password:
            messages.error(request, "Please enter both username/email and password.")
            return render(request, self.template_name, {
                'username': username,
                'login_type': login_type,
                'next': next_url
            })

        user = authenticate(request, username=username, password=password)

        if user is not None:
            if not user.is_active:
                messages.error(request, "Your account has been deactivated. Please contact support.")
                return render(request, self.template_name, {
                    'username': username,
                    'login_type': login_type,
                    'next': next_url
                })

            # Check Daycare Tenant Status
            if user.daycare and not (user.is_superuser or user.role in ['SuperAdmin', 'Admin', 'admin']):
                if hasattr(user.daycare, 'status') and user.daycare.status == 'suspended':
                    messages.error(request, "Your daycare organization account is currently suspended. Please contact platform support.")
                    return render(request, self.template_name, {
                        'username': username,
                        'login_type': login_type,
                        'next': next_url
                    })

            # Log user in
            login(request, user)
            messages.success(request, f"Welcome back, {user.first_name or user.username}!")

            # Safe redirect
            if next_url and url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}):
                return redirect(next_url)

            return redirect('dashboard_router')
        else:
            messages.error(request, "Invalid username/email or password. Please try again.")
            return render(request, self.template_name, {
                'username': username,
                'login_type': login_type,
                'next': next_url
            })


class UserLogoutView(View):
    def post(self, request, *args, **kwargs):
        logout(request)
        messages.info(request, "You have been successfully signed out.")
        return redirect('login')

    def get(self, request, *args, **kwargs):
        logout(request)
        messages.info(request, "You have been successfully signed out.")
        return redirect('login')


class DashboardRouterView(View):
    def get(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('login')

        user = request.user
        if user.is_superuser or user.role in ['SuperAdmin', 'Admin', 'admin']:
            return redirect('superadmin_dashboard')
        elif user.role == 'Guardian':
            return redirect('family_dashboard')
        else:
            return redirect('daycare_dashboard')


class FamilyActivateView(View):
    template_name = 'authentication/family_activate.html'

    def get(self, request, token=None, *args, **kwargs):
        if not token:
            token = request.GET.get('token', '')
        return render(request, self.template_name, {'token': token})

    def post(self, request, token=None, *args, **kwargs):
        if not token:
            token = request.POST.get('token', '')
        password = request.POST.get('password', '')
        confirm_password = request.POST.get('confirm_password', '')

        if not password or len(password) < 8:
            messages.error(request, "Password must be at least 8 characters long.")
            return render(request, self.template_name, {'token': token})

        if password != confirm_password:
            messages.error(request, "Passwords do not match.")
            return render(request, self.template_name, {'token': token})

        invitation = GuardianInvitation.objects.filter(token=token, is_accepted=False).first()
        if not invitation:
            messages.error(request, "Invalid or expired invitation token.")
            return render(request, self.template_name, {'token': token})

        # Set user password and activate
        user = invitation.guardian.user
        if user:
            user.set_password(password)
            user.is_active = True
            user.save()
            invitation.is_accepted = True
            invitation.save()
            messages.success(request, "Your account has been activated! Please log in.")
            return redirect(reverse('login') + '?type=family')

        messages.error(request, "Unable to activate account. Guardian profile missing.")
        return render(request, self.template_name, {'token': token})


class FamilyForgotPasswordView(View):
    template_name = 'authentication/family_forgot_password.html'

    def get(self, request, *args, **kwargs):
        return render(request, self.template_name)

    def post(self, request, *args, **kwargs):
        email = request.POST.get('email', '').strip()
        if not email:
            messages.error(request, "Please provide your registered email address.")
            return render(request, self.template_name)

        messages.success(request, "If an active account exists for that email, password reset instructions have been sent.")
        return redirect('login')


class FamilyResetPasswordView(View):
    template_name = 'authentication/family_reset_password.html'

    def get(self, request, token=None, *args, **kwargs):
        return render(request, self.template_name, {'token': token})

    def post(self, request, token=None, *args, **kwargs):
        password = request.POST.get('password', '')
        confirm_password = request.POST.get('confirm_password', '')

        if password != confirm_password:
            messages.error(request, "Passwords do not match.")
            return render(request, self.template_name, {'token': token})

        messages.success(request, "Your password has been successfully reset. Please log in.")
        return redirect('login')

