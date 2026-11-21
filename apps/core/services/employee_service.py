from django.db import transaction
from django.contrib.auth.models import Group
from django.contrib.auth.hashers import make_password
from django.utils.crypto import get_random_string
from core.models import Employee, User, DaycareSubscription

class EmployeeService:
    @staticmethod
    def create_employee(data: dict, current_user: User) -> Employee:
        with transaction.atomic():
            EmployeeService.validate_limits(data.get('role'), current_user.daycare)

            employee = Employee.objects.create(
                daycare=current_user.daycare,
                first_name=data.get('first_name'),
                last_name=data.get('last_name'),
                email=data.get('email'),
                role=data.get('role')
            )

            if data.get('create_account') and data.get('email'):
                user = EmployeeService.create_employee_account(employee)
                employee.user = user
                employee.save()

            return employee

    @staticmethod
    def validate_limits(role: str, daycare):
        active_sub = DaycareSubscription.objects.filter(
            daycare=daycare, 
            subscription_status='Active'
        ).last()

        if not active_sub or not active_sub.subscription_plan:
            raise Exception("No active subscription found.")

        plan = active_sub.subscription_plan
        
        if role.lower() == 'teacher':
            current_count = Employee.objects.filter(role__iexact='Teacher', daycare=daycare).count()
            if plan.max_teachers > 0 and current_count >= plan.max_teachers:
                raise Exception("You have reached your Teacher limit. Please contact KidSynq Super Admin to upgrade your subscription.")
        else:
            current_count = Employee.objects.exclude(role__iexact='Teacher').filter(daycare=daycare).count()
            if plan.max_staff > 0 and current_count >= plan.max_staff:
                raise Exception("You have reached your Staff limit. Please contact KidSynq Super Admin to upgrade your subscription.")

    @staticmethod
    def create_employee_account(employee: Employee) -> User:
        temporary_password = get_random_string(10)
        
        user = User.objects.create(
            first_name=employee.first_name,
            last_name=employee.last_name,
            email=employee.email,
            username=employee.email, # Django requires username, use email
            password=make_password(temporary_password),
            daycare=employee.daycare,
            force_password_change=True
        )

        try:
            group = Group.objects.get(name__iexact=employee.role)
            user.groups.add(group)
        except Group.DoesNotExist:
            pass

        # TODO: Trigger Welcome Notification

        return user

    @staticmethod
    def update_employee(employee: Employee, data: dict) -> Employee:
        for key, value in data.items():
            setattr(employee, key, value)
        employee.save()
        return employee

    @staticmethod
    def delete_employee(employee: Employee) -> bool:
        with transaction.atomic():
            if employee.user:
                employee.user.delete()
            employee.delete()
        return True
