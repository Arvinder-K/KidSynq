from django.utils import timezone
from ..models import ClassroomTeacherAssignment, Employee, Classroom, DaycareSubscription, AuditLog

class TeacherAssignmentService:

    @staticmethod
    def assign_teacher(classroom, employee, assignment_type, assigned_by):
        """
        Assigns an eligible employee to a classroom as Primary or Assistant Teacher.
        Strictly enforces tenant isolation, employee active status, and teaching eligibility.
        Preserves assignment history.
        """
        if not classroom or not employee:
            raise ValueError("Classroom and Employee are required.")

        # 1. Tenant Isolation
        if employee.daycare_id != classroom.daycare_id:
            raise ValueError("Teacher must belong to the same daycare as the classroom.")

        # 2. Employee Active Status
        if employee.status != 'active':
            raise ValueError(f"Cannot assign employee with status '{employee.status}'. Employee must be active.")

        if employee.user and hasattr(employee.user, 'status') and employee.user.status != 'Active':
            raise ValueError("Associated user account must be active.")

        # 3. Teaching Role Eligibility
        if not employee.is_eligible_for_classroom():
            role_names = [t.name for t in employee.types.all()]
            role_str = f"roles: {', '.join(role_names)}" if role_names else f"job title: {employee.job_title or employee.role or 'None'}"
            raise ValueError(
                f"Employee '{employee.first_name} {employee.last_name}' ({role_str}) is not eligible for classroom teaching. "
                "Only staff with eligible teaching types (e.g. Teacher, ECE, Assistant) can be assigned."
            )

        # 4. Check Subscription limit if applicable
        active_sub = DaycareSubscription.objects.filter(
            daycare=classroom.daycare,
            subscription_status='Active'
        ).select_related('subscription_plan').first()
        
        if active_sub and active_sub.subscription_plan and active_sub.subscription_plan.max_teachers > 0:
            max_teachers = active_sub.subscription_plan.max_teachers
            currently_assigned_employees = set(
                ClassroomTeacherAssignment.objects.filter(
                    daycare=classroom.daycare,
                    status='Active',
                    deleted_at__isnull=True
                ).values_list('employee_id', flat=True)
            )
            if employee.id not in currently_assigned_employees and len(currently_assigned_employees) >= max_teachers:
                raise ValueError("Teacher limit reached for your subscription plan. Please upgrade your subscription.")

        # 5. Handle Primary Teacher Replacement
        old_primary_employee = None
        if assignment_type == 'Primary':
            existing_primaries = ClassroomTeacherAssignment.objects.filter(
                classroom=classroom,
                assignment_type='Primary',
                status='Active',
                deleted_at__isnull=True
            )
            for ep in existing_primaries:
                if ep.employee_id == employee.id:
                    # Already active primary
                    return ep
                old_primary_employee = ep.employee
                ep.status = 'Inactive'
                ep.end_date = timezone.now().date()
                ep.updated_by = assigned_by
                ep.save()

            # Sync classroom primary_teacher User FK if user exists
            if employee.user:
                classroom.primary_teacher = employee.user
                classroom.save(update_fields=['primary_teacher'])

        # 6. Check existing assistant assignment
        existing = ClassroomTeacherAssignment.objects.filter(
            classroom=classroom,
            employee=employee,
            assignment_type=assignment_type,
            status='Active',
            deleted_at__isnull=True
        ).first()
        
        if existing:
            return existing

        # 7. Create new active assignment
        assignment = ClassroomTeacherAssignment.objects.create(
            daycare=classroom.daycare,
            classroom=classroom,
            employee=employee,
            assignment_type=assignment_type,
            status='Active',
            assigned_date=timezone.now().date(),
            created_by=assigned_by,
            updated_by=assigned_by
        )

        # 8. Record Audit Log
        if assignment_type == 'Primary' and old_primary_employee:
            action_name = 'CLASSROOM_TEACHER_TRANSFERRED'
            details = {
                'classroom': classroom.room_name,
                'previous_primary': f"{old_primary_employee.first_name} {old_primary_employee.last_name}",
                'new_primary': f"{employee.first_name} {employee.last_name}",
                'assignment_type': 'Primary'
            }
        else:
            action_name = 'CLASSROOM_TEACHER_ASSIGNED'
            details = {
                'classroom': classroom.room_name,
                'teacher': f"{employee.first_name} {employee.last_name}",
                'assignment_type': assignment_type
            }

        AuditLog.objects.create(
            user=assigned_by,
            user_type='DaycareAdmin' if assigned_by and getattr(assigned_by, 'is_staff', False) else 'System',
            action=action_name,
            module='classrooms',
            entity_type='classroom_teacher_assignment',
            entity_id=str(assignment.id),
            new_values=details
        )

        return assignment

    @staticmethod
    def remove_teacher(assignment_id, removed_by):
        """
        Deactivates a classroom teacher assignment, sets end_date to today, and logs audit record.
        """
        try:
            assignment = ClassroomTeacherAssignment.objects.select_related('classroom', 'employee').get(
                id=assignment_id, 
                status='Active', 
                deleted_at__isnull=True
            )
            assignment.status = 'Inactive'
            assignment.end_date = timezone.now().date()
            assignment.updated_by = removed_by
            assignment.save()

            # Clean up classroom shortcut FKs if appropriate
            classroom = assignment.classroom
            employee = assignment.employee
            if assignment.assignment_type == 'Primary' and classroom.primary_teacher and employee.user == classroom.primary_teacher:
                classroom.primary_teacher = None
                classroom.save(update_fields=['primary_teacher'])
            elif assignment.assignment_type == 'Assistant' and classroom.assistant_teacher and employee.user == classroom.assistant_teacher:
                classroom.assistant_teacher = None
                classroom.save(update_fields=['assistant_teacher'])

            AuditLog.objects.create(
                user=removed_by,
                user_type='DaycareAdmin' if removed_by and getattr(removed_by, 'is_staff', False) else 'System',
                action='CLASSROOM_TEACHER_REMOVED',
                module='classrooms',
                entity_type='classroom_teacher_assignment',
                entity_id=str(assignment.id),
                new_values={
                    'classroom': classroom.room_name,
                    'teacher': f"{employee.first_name} {employee.last_name}",
                    'assignment_type': assignment.assignment_type
                }
            )
            return True
        except ClassroomTeacherAssignment.DoesNotExist:
            return False

    @staticmethod
    def transfer_teacher(current_assignment_id, new_classroom, assignment_type, transferred_by):
        """
        Transfers a teacher from one classroom to another by ending the current assignment and creating the new one.
        """
        try:
            assignment = ClassroomTeacherAssignment.objects.select_related('classroom', 'employee').get(
                id=current_assignment_id,
                status='Active',
                deleted_at__isnull=True
            )
            employee = assignment.employee
            old_classroom = assignment.classroom

            # End current assignment
            assignment.status = 'Inactive'
            assignment.end_date = timezone.now().date()
            assignment.updated_by = transferred_by
            assignment.save()

            # Assign to new classroom
            new_assignment = TeacherAssignmentService.assign_teacher(
                classroom=new_classroom,
                employee=employee,
                assignment_type=assignment_type,
                assigned_by=transferred_by
            )

            AuditLog.objects.create(
                user=transferred_by,
                user_type='DaycareAdmin' if transferred_by and getattr(transferred_by, 'is_staff', False) else 'System',
                action='CLASSROOM_TEACHER_TRANSFERRED',
                module='classrooms',
                entity_type='classroom_teacher_assignment',
                entity_id=str(new_assignment.id),
                new_values={
                    'from_classroom': old_classroom.room_name,
                    'to_classroom': new_classroom.room_name,
                    'teacher': f"{employee.first_name} {employee.last_name}",
                    'assignment_type': assignment_type
                }
            )
            return new_assignment
        except ClassroomTeacherAssignment.DoesNotExist:
            raise ValueError("Active assignment to transfer not found.")

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
