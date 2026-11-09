from functools import wraps
from django.contrib import messages
from django.contrib.auth.mixins import UserPassesTestMixin
from django.shortcuts import redirect

def superadmin_required(view_func):
    """
    Decorator for views that checks that the user is logged in and is a SuperAdmin.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            messages.info(request, "Please log in to access this page.")
            return redirect('login')
        if not (request.user.is_superuser or request.user.role in ['SuperAdmin', 'Admin', 'admin']):
            messages.error(request, "Access denied. Administrator credentials required.")
            return redirect('dashboard_router')
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def daycare_admin_required(view_func):
    """
    Decorator for views that checks that the user is logged in and is a Daycare Admin or SuperAdmin.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            messages.info(request, "Please log in to access this page.")
            return redirect('login')
        if not (request.user.is_superuser or request.user.role in ['SuperAdmin', 'Admin', 'admin', 'DaycareAdmin']):
            messages.error(request, "Access denied. Daycare Administrator privileges required.")
            return redirect('dashboard_router')
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def staff_required(view_func):
    """
    Decorator for views that checks that the user is logged in and is Staff, Daycare Admin, or SuperAdmin.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            messages.info(request, "Please log in to access this page.")
            return redirect('login')
        if not (request.user.is_superuser or request.user.role in ['SuperAdmin', 'Admin', 'admin', 'DaycareAdmin', 'Staff', 'Educator']):
            messages.error(request, "Access denied. Staff privileges required.")
            return redirect('dashboard_router')
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def guardian_required(view_func):
    """
    Decorator for views that checks that the user is logged in and is a Guardian.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            messages.info(request, "Please log in to access your family portal.")
            return redirect('login')
        if request.user.role != 'Guardian' and not request.user.is_superuser:
            messages.warning(request, "This section is reserved for parents and guardians.")
            return redirect('dashboard_router')
        return view_func(request, *args, **kwargs)
    return _wrapped_view


class SuperAdminRequiredMixin(UserPassesTestMixin):
    def test_func(self):
        user = self.request.user
        return user.is_authenticated and (user.is_superuser or user.role in ['SuperAdmin', 'Admin', 'admin'])

    def handle_no_permission(self):
        if not self.request.user.is_authenticated:
            messages.info(self.request, "Super Administrator sign-in required.")
            return redirect(f"/superadmin/login/?next={self.request.path}")
        messages.error(self.request, "Access denied. Administrator credentials required.")
        return redirect('dashboard_router')


class DaycareAdminRequiredMixin(UserPassesTestMixin):
    def test_func(self):
        user = self.request.user
        return user.is_authenticated and (user.is_superuser or user.role in ['SuperAdmin', 'Admin', 'admin', 'DaycareAdmin'])

    def handle_no_permission(self):
        messages.error(self.request, "Access denied. Daycare Administrator privileges required.")
        return redirect('dashboard_router')


class StaffRequiredMixin(UserPassesTestMixin):
    def test_func(self):
        user = self.request.user
        return user.is_authenticated and (user.is_superuser or user.role in ['SuperAdmin', 'Admin', 'admin', 'DaycareAdmin', 'Staff', 'Educator'])

    def handle_no_permission(self):
        messages.error(self.request, "Access denied. Staff privileges required.")
        return redirect('dashboard_router')


class GuardianRequiredMixin(UserPassesTestMixin):
    def test_func(self):
        user = self.request.user
        return user.is_authenticated and (user.is_superuser or user.role == 'Guardian')

    def handle_no_permission(self):
        messages.warning(self.request, "This section is reserved for parents and guardians.")
        return redirect('dashboard_router')

