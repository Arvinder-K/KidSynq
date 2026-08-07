from django.utils import timezone
from ..models import ClassroomTeacherAssignment, Employee, Classroom, DaycareSubscription

class TeacherAssignmentService:

    @staticmethod
    def assign_teacher(classroom, employee, assignment_type, assigned_by):
        """
        Assigns a teacher to a classroom.
        """
        if employee.role != 'Teacher':
            raise ValueError("Only employees with the 'Teacher' role can be assigned.")
            
        if employee.daycare_id != classroom.daycare_id:
            raise ValueError("Teacher must belong to the same daycare as the classroom.")
            
        if employee.user and employee.user.status != 'Active':
             raise ValueError("Teacher must be active.")

        # Check limit
        active_sub = DaycareSubscription.objects.filter(
            daycare=classroom.daycare,
            subscription_status='Active'
        ).select_related('subscription_plan').first()
        
        if active_sub and active_sub.subscription_plan.max_teachers > 0:
            max_teachers = active_sub.subscription_plan.max_teachers
            currently_assigned_employees = set(
                ClassroomTeacherAssignment.objects.filter(
                    daycare=classroom.daycare,
                    status='Active',
                    deleted_at__isnull=True
                ).values_list('employee_id', flat=True)
            )
            if employee.id not in currently_assigned_employees and len(currently_assigned_employees) >= max_teachers:
                raise ValueError("Teacher limit reached. Please upgrade your subscription.")

        # If primary, deactivate existing primary
        if assignment_type == 'Primary':
            existing_primaries = ClassroomTeacherAssignment.objects.filter(
                classroom=classroom,
                assignment_type='Primary',
                status='Active',
                deleted_at__isnull=True
            )
            for ep in existing_primaries:
                ep.status = 'Inactive'
                ep.end_date = timezone.now().date()
                ep.updated_by = assigned_by
                ep.save()
                
        # Check if this exact assignment already exists
        existing = ClassroomTeacherAssignment.objects.filter(
            classroom=classroom,
            employee=employee,
            assignment_type=assignment_type,
            status='Active',
            deleted_at__isnull=True
        ).first()
        
        if existing:
            return existing

        # Create assignment
        assignment = ClassroomTeacherAssignment.objects.create(
            daycare=classroom.daycare,
            classroom=classroom,
            employee=employee,
            assignment_type=assignment_type,
            created_by=assigned_by,
            updated_by=assigned_by
        )
        return assignment

    @staticmethod
    def remove_teacher(assignment_id, removed_by):
        try:
            assignment = ClassroomTeacherAssignment.objects.get(
                id=assignment_id, 
                status='Active', 
                deleted_at__isnull=True
            )
            assignment.status = 'Inactive'
            assignment.end_date = timezone.now().date()
            assignment.updated_by = removed_by
            assignment.save()
            return True
        except ClassroomTeacherAssignment.DoesNotExist:
            return False

    @staticmethod
    def get_teacher_workload(employee):
        assignments = ClassroomTeacherAssignment.objects.filter(
            employee=employee,
            status='Active',
            deleted_at__isnull=True
        )
        primary_count = assignments.filter(assignment_type='Primary').count()
        assistant_count = assignments.filter(assignment_type='Assistant').count()
        
        return {
            'total_classrooms': primary_count + assistant_count,
            'primary_classrooms': primary_count,
            'assistant_classrooms': assistant_count
        }
