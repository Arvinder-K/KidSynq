"""
Daycare management permissions.
"""
from rest_framework.permissions import BasePermission

class IsDaycareStaff(BasePermission):
    """
    Allows access only to active daycare staff members and administrators.
    """
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser:
            return True
        return bool(user.daycare and getattr(user.daycare, 'status', 'Active') == 'Active')

