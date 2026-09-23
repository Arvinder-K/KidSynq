from functools import wraps
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum
from core.models import DaycareSubscription

def check_subscription_limit(daycare, limit_type, increment=1, extra_size_bytes=0):
    """
    Checks if adding `increment` items of `limit_type` (or `extra_size_bytes` of storage)
    exceeds the daycare's subscription plan limits.
    limit_type: 'students', 'staff', 'classrooms', 'storage'
    Returns a tuple (bool, str, str) -> (is_allowed, error_code, error_message)
    """
    active_sub = DaycareSubscription.objects.filter(
        daycare=daycare, 
        subscription_status__in=['active', 'trial']
    ).first()

    if not active_sub:
        return False, "NO_ACTIVE_SUBSCRIPTION", "No active subscription found for this daycare."

    plan = active_sub.subscription_plan

    if limit_type == 'students':
        if plan.max_students > 0:
            from core.models import Student
            current_count = Student.objects.filter(daycare=daycare, deleted_at__isnull=True).count()
            if current_count + increment > plan.max_students:
                return False, "STUDENT_LIMIT_REACHED", f"Your current subscription plan has reached its student limit ({plan.max_students})."

    elif limit_type == 'staff':
        if plan.max_staff > 0:
            from core.models import Employee
            current_count = Employee.objects.filter(daycare=daycare, deleted_at__isnull=True).count()
            if current_count + increment > plan.max_staff:
                return False, "STAFF_LIMIT_REACHED", f"Your current subscription plan has reached its staff limit ({plan.max_staff})."

    elif limit_type == 'branches':
        if plan.max_branches == 0:
            return False, "BRANCHES_DISABLED", "Your current subscription plan does not support multiple locations."
        elif plan.max_branches > 0:
            from core.models import Branch
            current_count = Branch.objects.filter(daycare=daycare, deleted_at__isnull=True).count()
            if current_count + increment > plan.max_branches:
                return False, "BRANCH_LIMIT_REACHED", f"Your current subscription plan has reached its branch limit ({plan.max_branches})."

    elif limit_type == 'classrooms':
        if plan.max_classrooms > 0:
            from core.models import Classroom
            current_count = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).count()
            if current_count + increment > plan.max_classrooms:
                return False, "CLASSROOM_LIMIT_REACHED", f"Your current subscription plan has reached its classroom limit ({plan.max_classrooms})."

    elif limit_type == 'storage':
        if plan.max_storage_mb > 0:
            from core.models import Document
            # sum file_size in bytes, compare to max_storage_mb * 1024 * 1024
            result = Document.objects.filter(daycare=daycare).aggregate(total_size=Sum('file_size'))
            current_bytes = result['total_size'] or 0
            if current_bytes + extra_size_bytes > plan.max_storage_mb * 1024 * 1024:
                return False, "STORAGE_LIMIT_REACHED", f"Your current subscription plan has reached its storage limit ({plan.max_storage_mb} MB)."

    return True, "", ""

def require_feature(feature_code):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(self, request, *args, **kwargs):
            daycare = getattr(request.user, 'daycare', None)
            if not daycare:
                return Response({"error": "UNAUTHORIZED_FEATURE", "message": "User is not assigned to a daycare."}, status=status.HTTP_403_FORBIDDEN)
            
            active_sub = DaycareSubscription.objects.filter(
                daycare=daycare, 
                subscription_status__in=['active', 'trial']
            ).first()

            if not active_sub:
                return Response({"error": "NO_ACTIVE_SUBSCRIPTION", "message": "No active subscription found for this daycare."}, status=status.HTTP_403_FORBIDDEN)
            
            if not active_sub.subscription_plan.features.filter(code=feature_code).exists():
                return Response({"error": "UNAUTHORIZED_FEATURE", "message": f"Your current subscription plan does not include the '{feature_code}' feature."}, status=status.HTTP_403_FORBIDDEN)
                
            return view_func(self, request, *args, **kwargs)
        return _wrapped_view
    return decorator
