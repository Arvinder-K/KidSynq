from rest_framework.permissions import BasePermission

class IsSuperUser(BasePermission):
    """
    Allows access only to superusers.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)

class IsDaycareAdmin(BasePermission):
    """
    Allows access to Daycare Admins/Staff who belong to an active daycare, or superusers.
    """
    def has_permission(self, request, view):
        user = request.user
        if not bool(user and user.is_authenticated):
            return False
            
        if user.is_superuser:
            return True
            
        # Must have an active daycare
        if not user.daycare or user.daycare.status != 'Active':
            return False
            
        return True


class IsAuthenticatedGuardian(BasePermission):
    """
    Allows access only to authenticated Guardians.
    """
    def has_permission(self, request, view):
        user = request.user
        if not bool(user and user.is_authenticated):
            return False
            
        # Must have a guardian profile
        guardian = getattr(user, 'guardian_profile', None) or getattr(user, 'guardian', None)
        if not guardian:
            return False
            
        # Must be active
        if getattr(guardian, 'status', 'Active') != 'Active':
            return False
            
        return True
