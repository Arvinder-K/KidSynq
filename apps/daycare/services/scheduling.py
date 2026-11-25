import io
import csv
from datetime import date, time, datetime, timedelta
from typing import Optional, List, Dict, Any
from django.utils import timezone
from django.db import transaction
from django.db.models import Q, Sum
from rest_framework.exceptions import ValidationError, PermissionDenied
from core.models import (
    Daycare, Employee, Classroom, Branch, StaffSchedule, EmployeeAvailability, 
    AuditLog, StaffAttendance, OvertimeRecord, TimeBankRule, TimeBankTransaction, 
    ShiftSwapRequest, DaycareHoliday, LeaveType, LeaveRequest, 
    StaffShortageAlert, StaffNotification, User
)




class SchedulingService:

    @staticmethod
    def validate_shift(
        daycare: Daycare,
        employee: Employee,
        shift_date: date,
        shift_start: time,
        shift_end: time,
        classroom: Optional[Classroom] = None,
        branch: Optional[Branch] = None,
        exclude_schedule_id: Optional[str] = None
    ) -> None:
        """
        Comprehensive business validation for staff shift scheduling:
        1. Employee belongs to daycare.
        2. Employee is active.
        3. Classroom belongs to daycare (if specified).
        4. Branch belongs to daycare (if specified).
        5. Shift start time is strictly before shift end time.
        6. Shift does not conflict with employee availability.
        7. Shift does not overlap with an existing shift for the same employee.
        """
        # 1. Tenant & Employee validation
        if not employee or employee.daycare_id != daycare.id:
            raise ValidationError({"employee": "Employee does not belong to your daycare."})

        # 2. Active status check
        if employee.status != 'active':
            raise ValidationError({"employee": f"Cannot schedule inactive employee ({employee.first_name} {employee.last_name} is '{employee.status}')."})

        # 3. Classroom tenant & active check
        if classroom:
            if classroom.daycare_id != daycare.id:
                raise ValidationError({"classroom": "Selected classroom does not belong to your daycare."})
            if hasattr(classroom, 'status') and classroom.status and classroom.status.lower() != 'active':
                raise ValidationError({"classroom": f"Cannot schedule shift in inactive classroom ({classroom.room_name} is '{classroom.status}')."})

        # 4. Branch tenant check
        if branch and branch.daycare_id != daycare.id:
            raise ValidationError({"branch": "Selected branch does not belong to your daycare."})

        if classroom and classroom.branch and branch and classroom.branch_id != branch.id:
            raise ValidationError({"branch": f"Selected branch does not match classroom branch ({classroom.branch.name})."})

        # 5. Time order check
        if shift_start >= shift_end:
            raise ValidationError({"shift_end": "Shift start time must be before end time."})

        # 6. Availability validation
        day_of_week = shift_date.strftime('%A')
        avail = EmployeeAvailability.objects.filter(employee=employee, day_of_week=day_of_week).first()

        if avail:
            # Check Unavailable
            if avail.status == 'Unavailable' or not avail.is_available:
                raise ValidationError({
                    "non_field_errors": [
                        f"Availability conflict: {employee.first_name} {employee.last_name} is marked as Unavailable on {day_of_week}s."
                    ]
                })

            # Check Custom hours
            if (avail.status == 'Custom hours' or (avail.start_time and avail.end_time)) and avail.start_time and avail.end_time:
                if shift_start < avail.start_time or shift_end > avail.end_time:
                    avail_start_str = avail.start_time.strftime('%H:%M')
                    avail_end_str = avail.end_time.strftime('%H:%M')
                    shift_start_str = shift_start.strftime('%H:%M')
                    shift_end_str = shift_end.strftime('%H:%M')
                    raise ValidationError({
                        "non_field_errors": [
                            f"Availability conflict: Shift {shift_start_str}–{shift_end_str} is outside available hours ({avail_start_str}–{avail_end_str}) for {employee.first_name} on {day_of_week}s."
                        ]
                    })

        # 7. Overlapping shift prevention
        # A shift overlaps if (new_start < existing_end) AND (new_end > existing_start)
        overlap_qs = StaffSchedule.objects.filter(
            employee=employee,
            date=shift_date
        ).exclude(status='cancelled')

        if exclude_schedule_id:
            overlap_qs = overlap_qs.exclude(id=exclude_schedule_id)

        for existing in overlap_qs:
            if shift_start < existing.shift_end and shift_end > existing.shift_start:
                ex_start_str = existing.shift_start.strftime('%H:%M')
                ex_end_str = existing.shift_end.strftime('%H:%M')
                room_str = f" in {existing.classroom.room_name}" if existing.classroom else ""
                raise ValidationError({
                    "non_field_errors": [
                        f"Overlapping shift conflict: {employee.first_name} {employee.last_name} is already scheduled from {ex_start_str} to {ex_end_str}{room_str} on {shift_date}."
                    ]
                })

    @staticmethod
    def validate_break(
        schedule: StaffSchedule,
        break_start: time,
        break_end: time,
        exclude_break_id: Optional[str] = None
    ) -> None:
        """
        Validates shift break rules:
        1. Break start time is before end time.
        2. Break falls strictly within the parent shift's start and end times.
        3. Break does not overlap with another break on the same shift.
        """
        if break_start >= break_end:
            raise ValidationError({"break_end": "Break start time must be before end time."})

        # Must fall within shift
        if break_start < schedule.shift_start or break_end > schedule.shift_end:
            s_start = schedule.shift_start.strftime('%H:%M')
            s_end = schedule.shift_end.strftime('%H:%M')
            b_start = break_start.strftime('%H:%M')
            b_end = break_end.strftime('%H:%M')
            raise ValidationError({
                "non_field_errors": [
                    f"Break timing ({b_start}–{b_end}) must fall within scheduled shift hours ({s_start}–{s_end})."
                ]
            })

        # Overlapping break check
        break_qs = schedule.breaks.all()
        if exclude_break_id:
            break_qs = break_qs.exclude(id=exclude_break_id)

        for existing in break_qs:
            if break_start < existing.break_end and break_end > existing.break_start:
                ex_s = existing.break_start.strftime('%H:%M')
                ex_e = existing.break_end.strftime('%H:%M')
                raise ValidationError({
                    "non_field_errors": [
                        f"Break conflict: Break {break_start.strftime('%H:%M')}–{break_end.strftime('%H:%M')} overlaps with existing break ({ex_s}–{ex_e})."
                    ]
                })

    @staticmethod
    def calculate_classroom_coverage(
        daycare: Daycare,
        classroom: Classroom,
        target_date: Optional[date] = None,
        day_start_hour: int = 7,
        day_end_hour: int = 18
    ) -> Dict[str, Any]:
        """
        Calculates hourly educator coverage and ratio compliance for a classroom on a specific date.
        """
        if not target_date:
            target_date = timezone.now().date()
        # 1. Determine standard ratio based on age group
        # Infant: 1:3, Toddler: 1:5, Preschool: 1:8, Kindergarten: 1:10
        ratio_number = 5
        age_group_name = "General Childcare"
        if classroom.age_group:
            age_group_name = classroom.age_group.name
            max_age = classroom.age_group.max_age_months or 24
            if max_age <= 18:
                ratio_number = 3
            elif max_age <= 30:
                ratio_number = 5
            elif max_age <= 60:
                ratio_number = 8
            else:
                ratio_number = 10
        elif classroom.max_age_months:
            if classroom.max_age_months <= 18:
                ratio_number = 3
            elif classroom.max_age_months <= 30:
                ratio_number = 5
            elif classroom.max_age_months <= 60:
                ratio_number = 8
            else:
                ratio_number = 10

        # 2. Determine active enrolled children count
        enrolled_students = classroom.enrollments.filter(status='Active').count()
        capacity = classroom.capacity or 10
        effective_children = enrolled_students if enrolled_students > 0 else capacity
        required_staff = max(1, (effective_children + ratio_number - 1) // ratio_number)

        # 3. Retrieve scheduled shifts for this classroom on target_date
        shifts = StaffSchedule.objects.filter(
            daycare=daycare,
            classroom=classroom,
            date=target_date
        ).exclude(status='cancelled').select_related('employee').prefetch_related('breaks')

        # 4. Generate hourly slots (07:00 to 18:00)
        day_start_hour = daycare.opening_time.hour if daycare.opening_time else 7
        day_end_hour = daycare.closing_time.hour if daycare.closing_time else 18
        if day_end_hour <= day_start_hour:
            day_end_hour = 18

        slots = []
        ok_count = 0
        shortage_count = 0
        surplus_count = 0

        for h in range(day_start_hour, day_end_hour):
            slot_start = time(h, 0)
            slot_end = time(h + 1, 0) if h < 23 else time(23, 59)
            time_slot_label = f"{slot_start.strftime('%H:%M')} – {slot_end.strftime('%H:%M')}"

            # Check which staff are working in this classroom during this slot
            active_educators = []
            for shift in shifts:
                # Active in this slot if shift covers the slot
                if shift.shift_start < slot_end and shift.shift_end > slot_start:
                    # Check if educator is completely on break during this full hour slot
                    on_break = False
                    for b in shift.breaks.all():
                        if b.break_start <= slot_start and b.break_end >= slot_end:
                            on_break = True
                            break

                    if not on_break:
                        active_educators.append({
                            "employee_id": str(shift.employee.id),
                            "name": f"{shift.employee.first_name} {shift.employee.last_name}",
                            "role": shift.employee.job_title or shift.employee.role,
                            "shift_type": shift.shift_type,
                            "shift_timing": f"{shift.shift_start.strftime('%H:%M')}–{shift.shift_end.strftime('%H:%M')}",
                            "duties": shift.duties or ""
                        })

            sched_count = len(active_educators)
            if sched_count >= required_staff:
                if sched_count > required_staff:
                    cov_status = "SURPLUS"
                    surplus_count += 1
                else:
                    cov_status = "OK"
                    ok_count += 1
            else:
                cov_status = "SHORTAGE"
                shortage_count += 1

            slots.append({
                "time_slot": time_slot_label,
                "slot_start": slot_start.strftime('%H:%M'),
                "slot_end": slot_end.strftime('%H:%M'),
                "required_staff": required_staff,
                "scheduled_staff_count": sched_count,
                "scheduled_educators": active_educators,
                "coverage_status": cov_status,
                "shortage": max(0, required_staff - sched_count)
            })

        # Actual child attendance for this classroom on target_date
        from core.models import StudentAttendance, StaffAttendance
        c_child_att = StudentAttendance.objects.filter(daycare=daycare, classroom=classroom, attendance_date=target_date)
        present_children_count = c_child_att.filter(
            Q(attendance_status__in=['PRESENT', 'Present', 'LATE', 'Late', 'EARLY_PICKUP']) | Q(check_in_time__isnull=False)
        ).count()
        checked_in_children_count = c_child_att.filter(check_in_time__isnull=False, check_out_time__isnull=True).count()
        absent_children_count = c_child_att.filter(attendance_status__in=['ABSENT', 'Absent']).count()
        late_children_count = c_child_att.filter(Q(is_late=True) | Q(attendance_status__in=['LATE', 'Late'])).count()
        checked_out_children_count = c_child_att.filter(check_out_time__isnull=False).count()

        # Actual clocked-in staff in this classroom on target_date
        clocked_in_staff = StaffAttendance.objects.filter(
            daycare=daycare,
            classroom=classroom,
            date=target_date,
            status__in=['CLOCKED_IN', 'ON_BREAK']
        ).count()

        occupancy_pct = round((checked_in_children_count / capacity * 100), 1) if capacity > 0 else 0.0

        return {
            "classroom_id": str(classroom.id),
            "room_name": classroom.room_name,
            "age_group": age_group_name,
            "capacity": capacity,
            "enrolled_students": enrolled_students,
            "effective_children_count": effective_children,
            "present_children": present_children_count,
            "checked_in_children": checked_in_children_count,
            "absent_children": absent_children_count,
            "late_children": late_children_count,
            "checked_out_children": checked_out_children_count,
            "current_occupancy_percentage": occupancy_pct,
            "actual_staff_present": clocked_in_staff,
            "ratio_standard": f"1:{ratio_number}",
            "required_staff_per_hour": required_staff,
            "date": str(target_date),
            "overall_status": "COMPLIANT" if shortage_count == 0 else "SHORTAGE",
            "total_slots": len(slots),
            "ok_slots": ok_count,
            "shortage_slots": shortage_count,
            "surplus_slots": surplus_count,
            "hourly_coverage": slots
        }


    @staticmethod
    def copy_schedule(
        daycare: Daycare,
        user: Any,
        source_start: date,
        source_end: date,
        target_start: date,
        employee_ids: Optional[List[str]] = None,
        classroom_id: Optional[str] = None,
        overwrite_conflicts: bool = False
    ) -> Dict[str, Any]:
        """
        Copies staff schedules from a source date range (e.g. source week) to a target date range.
        Maintains day-of-week relative mapping.
        """
        day_diff = (target_start - source_start).days

        source_qs = StaffSchedule.objects.filter(
            daycare=daycare,
            date__gte=source_start,
            date__lte=source_end
        ).exclude(status='cancelled').select_related('employee', 'classroom', 'branch')

        if employee_ids:
            source_qs = source_qs.filter(employee_id__in=employee_ids)
        if classroom_id:
            source_qs = source_qs.filter(classroom_id=classroom_id)

        created_shifts = []
        skipped_conflicts = []

        for src_shift in source_qs:
            target_date = src_shift.date + timedelta(days=day_diff)

            try:
                # Check for existing on target date
                if overwrite_conflicts:
                    StaffSchedule.objects.filter(
                        daycare=daycare,
                        employee=src_shift.employee,
                        date=target_date,
                        shift_start=src_shift.shift_start,
                        shift_end=src_shift.shift_end
                    ).delete()

                # Validate
                SchedulingService.validate_shift(
                    daycare=daycare,
                    employee=src_shift.employee,
                    shift_date=target_date,
                    shift_start=src_shift.shift_start,
                    shift_end=src_shift.shift_end,
                    classroom=src_shift.classroom,
                    branch=src_shift.branch
                )

                new_shift = StaffSchedule.objects.create(
                    daycare=daycare,
                    employee=src_shift.employee,
                    date=target_date,
                    shift_start=src_shift.shift_start,
                    shift_end=src_shift.shift_end,
                    shift_type=src_shift.shift_type,
                    classroom=src_shift.classroom,
                    branch=src_shift.branch,
                    status='scheduled',
                    notes=src_shift.notes,
                    created_by=user
                )
                created_shifts.append(str(new_shift.id))

            except ValidationError as ve:
                err_msg = str(ve.detail.get('non_field_errors', [str(ve)])[0] if isinstance(ve.detail, dict) else ve)
                skipped_conflicts.append({
                    "employee": f"{src_shift.employee.first_name} {src_shift.employee.last_name}",
                    "date": str(target_date),
                    "shift": f"{src_shift.shift_start.strftime('%H:%M')}–{src_shift.shift_end.strftime('%H:%M')}",
                    "reason": err_msg
                })

        # Log audit
        AuditLog.objects.create(
            user=user,
            user_type='DaycareAdmin',
            action='STAFF_SCHEDULE_COPIED',
            module='scheduling',
            entity_type='staff_schedule',
            entity_id=str(daycare.id),
            new_values={
                'source_range': f"{source_start} to {source_end}",
                'target_start': str(target_start),
                'copied_count': len(created_shifts),
                'skipped_count': len(skipped_conflicts)
            }
        )

        return {
            "copied_count": len(created_shifts),
            "skipped_count": len(skipped_conflicts),
            "created_ids": created_shifts,
            "skipped_conflicts": skipped_conflicts
        }


class OvertimeService:
    @staticmethod
    def calculate_daily_overtime(
        daycare: Daycare,
        employee: Employee,
        target_date: date,
        regular_hours_threshold: float = 8.0
    ) -> OvertimeRecord:
        """
        Calculates daily scheduled vs actual hours and determines overtime.
        CRITICAL: Never invent actual hours from schedules. If StaffAttendance exists with
        check_in_time and check_out_time, use actual clocked hours. Otherwise, actual_hours is None.
        """
        if employee.daycare_id != daycare.id:
            raise ValidationError({"employee": "Employee does not belong to this daycare."})

        # 1. Scheduled Hours from StaffSchedule
        shifts = StaffSchedule.objects.filter(
            daycare=daycare,
            employee=employee,
            date=target_date,
            status__in=['scheduled', 'confirmed', 'completed']
        )
        scheduled_hours = sum([s.net_working_hours for s in shifts])

        # 2. Actual Clocked Hours from StaffAttendance
        attendance = StaffAttendance.objects.filter(
            employee=employee,
            date=target_date
        ).first()

        actual_hours = None
        if attendance and attendance.check_in_time and attendance.check_out_time:
            c_in = datetime.combine(target_date, attendance.check_in_time)
            c_out = datetime.combine(target_date, attendance.check_out_time)
            diff_seconds = (c_out - c_in).total_seconds()
            actual_hours = round(max(0.0, diff_seconds / 3600.0), 2)

        # 3. Overtime calculation
        overtime_hours = 0.0
        if actual_hours is not None:
            overtime_hours = round(max(0.0, float(actual_hours) - regular_hours_threshold), 2)

        record, created = OvertimeRecord.objects.get_or_create(
            daycare=daycare,
            employee=employee,
            date=target_date,
            defaults={
                'scheduled_hours': scheduled_hours,
                'actual_hours': actual_hours,
                'regular_hours': regular_hours_threshold,
                'overtime_hours': overtime_hours,
                'status': 'pending'
            }
        )

        if not created and record.status == 'pending':
            record.scheduled_hours = scheduled_hours
            record.actual_hours = actual_hours
            record.regular_hours = regular_hours_threshold
            record.overtime_hours = overtime_hours
            record.save()

        return record

    @staticmethod
    def approve_overtime(
        overtime_record: OvertimeRecord,
        user: User,
        send_to_time_bank: bool = False
    ) -> OvertimeRecord:
        """
        Approves overtime record. Optionally credits the employee's time bank.
        """
        overtime_record.status = 'approved'
        overtime_record.approved_by = user
        overtime_record.approved_at = timezone.now()
        overtime_record.save()

        if send_to_time_bank and float(overtime_record.overtime_hours) > 0:
            TimeBankService.add_transaction(
                daycare=overtime_record.daycare,
                employee=overtime_record.employee,
                transaction_type='overtime_credit',
                hours=float(overtime_record.overtime_hours),
                reason=f"Approved overtime from {overtime_record.date}",
                approved_by_user=user,
                overtime_record=overtime_record
            )

        AuditLog.objects.create(
            user=user,
            user_type='DaycareAdmin',
            action='OVERTIME_APPROVED',
            module='scheduling',
            entity_type='overtime_record',
            entity_id=str(overtime_record.id),
            new_values={
                'employee': str(overtime_record.employee.id),
                'date': str(overtime_record.date),
                'overtime_hours': float(overtime_record.overtime_hours),
                'sent_to_time_bank': send_to_time_bank
            }
        )
        return overtime_record

    @staticmethod
    def reject_overtime(
        overtime_record: OvertimeRecord,
        user: User,
        notes: Optional[str] = None
    ) -> OvertimeRecord:
        """
        Rejects an overtime record with optional reason notes.
        """
        overtime_record.status = 'rejected'
        overtime_record.approved_by = user
        overtime_record.approved_at = timezone.now()
        if notes:
            overtime_record.notes = notes
        overtime_record.save()

        AuditLog.objects.create(
            user=user,
            user_type='DaycareAdmin',
            action='OVERTIME_REJECTED',
            module='scheduling',
            entity_type='overtime_record',
            entity_id=str(overtime_record.id),
            new_values={
                'employee': str(overtime_record.employee.id),
                'date': str(overtime_record.date),
                'notes': notes
            }
        )
        return overtime_record


class TimeBankService:
    @staticmethod
    def get_or_create_rules(daycare: Daycare) -> TimeBankRule:
        rule, _ = TimeBankRule.objects.get_or_create(
            daycare=daycare,
            defaults={
                'is_enabled': True,
                'max_balance_hours': 40.0,
                'require_approval': True,
                'expiry_months': 12
            }
        )
        return rule

    @staticmethod
    def get_balance(daycare: Daycare, employee: Employee) -> float:
        """
        Calculates employee current time bank balance from transaction history.
        """
        txns = TimeBankTransaction.objects.filter(daycare=daycare, employee=employee)
        total_balance = 0.0
        for txn in txns.order_by('created_at'):
            h = float(txn.hours)
            if txn.transaction_type in ['overtime_credit', 'manual_adjustment', 'correction']:
                total_balance += h
            elif txn.transaction_type == 'time_off_debit':
                total_balance -= h
        return round(total_balance, 2)

    @staticmethod
    @transaction.atomic
    def add_transaction(
        daycare: Daycare,
        employee: Employee,
        transaction_type: str,
        hours: float,
        reason: str,
        approved_by_user: Optional[User] = None,
        overtime_record: Optional[OvertimeRecord] = None
    ) -> TimeBankTransaction:
        """
        Creates an immutable time bank transaction, validating max balance and debit limits.
        """
        if employee.daycare_id != daycare.id:
            raise ValidationError({"employee": "Employee does not belong to this daycare."})

        rules = TimeBankService.get_or_create_rules(daycare)
        if not rules.is_enabled:
            raise ValidationError({"non_field_errors": ["Time banking is not enabled for this daycare."]})

        if hours <= 0:
            raise ValidationError({"hours": "Hours must be a positive number."})

        current_balance = TimeBankService.get_balance(daycare, employee)

        if transaction_type in ['overtime_credit', 'manual_adjustment', 'correction']:
            new_balance = current_balance + hours
            if rules.max_balance_hours and new_balance > float(rules.max_balance_hours):
                raise ValidationError({
                    "hours": f"Transaction would exceed maximum allowed time bank balance of {rules.max_balance_hours} hours (Current: {current_balance}h, Attempted: +{hours}h)."
                })
        elif transaction_type == 'time_off_debit':
            new_balance = current_balance - hours
            if new_balance < 0:
                raise ValidationError({
                    "hours": f"Insufficient time bank balance. Current balance is {current_balance} hours, attempted to debit {hours} hours."
                })
        else:
            raise ValidationError({"transaction_type": f"Invalid transaction type '{transaction_type}'."})

        txn = TimeBankTransaction.objects.create(
            daycare=daycare,
            employee=employee,
            transaction_type=transaction_type,
            hours=hours,
            date=timezone.now().date(),
            reason=reason,
            balance_after=round(new_balance, 2),
            approved_by=approved_by_user,
            overtime_record=overtime_record
        )

        AuditLog.objects.create(
            user=approved_by_user,
            user_type='DaycareAdmin' if (approved_by_user and approved_by_user.is_staff) else 'Employee',
            action='TIME_BANK_TRANSACTION_CREATED',
            module='scheduling',
            entity_type='time_bank_transaction',
            entity_id=str(txn.id),
            new_values={
                'employee': str(employee.id),
                'type': transaction_type,
                'hours': hours,
                'balance_after': round(new_balance, 2),
                'reason': reason
            }
        )

        return txn


class ShiftSwapService:
    @staticmethod
    def validate_swap(
        daycare: Daycare,
        requesting_employee: Employee,
        target_employee: Employee,
        requesting_shift: StaffSchedule,
        target_shift: Optional[StaffSchedule] = None
    ) -> None:
        """
        Validates shift swap eligibility:
        1. Both employees belong to same daycare.
        2. Both employees active.
        3. Requesting shift belongs to requesting employee and daycare.
        4. Target shift (if specified) belongs to target employee and daycare.
        5. Target employee is available on requesting shift date & time.
        6. Target employee has no overlapping shift on requesting shift date.
        7. If target shift specified: requesting employee is available and has no overlapping shift on target shift date.
        """
        if requesting_employee.daycare_id != daycare.id:
            raise ValidationError({"requesting_employee": "Requesting employee does not belong to this daycare."})

        if target_employee.daycare_id != daycare.id:
            raise ValidationError({"target_employee": "Target employee does not belong to this daycare."})

        if requesting_employee.id == target_employee.id:
            raise ValidationError({"target_employee": "Cannot swap shifts with yourself."})

        if requesting_employee.status != 'active':
            raise ValidationError({"requesting_employee": f"Requesting employee is inactive ({requesting_employee.status})."})

        if target_employee.status != 'active':
            raise ValidationError({"target_employee": f"Target employee is inactive ({target_employee.status})."})

        if requesting_shift.daycare_id != daycare.id or requesting_shift.employee_id != requesting_employee.id:
            raise ValidationError({"requesting_shift": "Requesting shift does not belong to requesting employee."})

        if target_shift:
            if target_shift.daycare_id != daycare.id or target_shift.employee_id != target_employee.id:
                raise ValidationError({"target_shift": "Target shift does not belong to target employee."})

        # Check Target Employee Availability for Requesting Shift
        req_day = requesting_shift.date.strftime('%A')
        avail_target = EmployeeAvailability.objects.filter(employee=target_employee, day_of_week=req_day).first()
        if avail_target:
            if not avail_target.is_available or avail_target.status == 'Unavailable':
                raise ValidationError({
                    "target_employee": f"{target_employee.first_name} {target_employee.last_name} is marked unavailable on {req_day}s."
                })
            if avail_target.status == 'Custom hours' and avail_target.start_time and avail_target.end_time:
                if requesting_shift.shift_start < avail_target.start_time or requesting_shift.shift_end > avail_target.end_time:
                    raise ValidationError({
                        "target_employee": f"{target_employee.first_name} is only available between {avail_target.start_time} and {avail_target.end_time} on {req_day}s."
                    })

        # Check Target Employee Overlap for Requesting Shift
        target_overlaps = StaffSchedule.objects.filter(
            daycare=daycare,
            employee=target_employee,
            date=requesting_shift.date,
            status__in=['scheduled', 'confirmed']
        ).exclude(id=target_shift.id if target_shift else None)

        for s in target_overlaps:
            if max(s.shift_start, requesting_shift.shift_start) < min(s.shift_end, requesting_shift.shift_end):
                raise ValidationError({
                    "target_employee": f"{target_employee.first_name} already has an overlapping shift ({s.shift_start}-{s.shift_end}) on {requesting_shift.date}."
                })

        # If Target Shift exists, check Requesting Employee Availability & Overlap
        if target_shift:
            tgt_day = target_shift.date.strftime('%A')
            avail_req = EmployeeAvailability.objects.filter(employee=requesting_employee, day_of_week=tgt_day).first()
            if avail_req:
                if not avail_req.is_available or avail_req.status == 'Unavailable':
                    raise ValidationError({
                        "requesting_employee": f"{requesting_employee.first_name} {requesting_employee.last_name} is marked unavailable on {tgt_day}s."
                    })
                if avail_req.status == 'Custom hours' and avail_req.start_time and avail_req.end_time:
                    if target_shift.shift_start < avail_req.start_time or target_shift.shift_end > avail_req.end_time:
                        raise ValidationError({
                            "requesting_employee": f"{requesting_employee.first_name} is only available between {avail_req.start_time} and {avail_req.end_time} on {tgt_day}s."
                        })

            req_overlaps = StaffSchedule.objects.filter(
                daycare=daycare,
                employee=requesting_employee,
                date=target_shift.date,
                status__in=['scheduled', 'confirmed']
            ).exclude(id=requesting_shift.id)

            for s in req_overlaps:
                if max(s.shift_start, target_shift.shift_start) < min(s.shift_end, target_shift.shift_end):
                    raise ValidationError({
                        "requesting_employee": f"{requesting_employee.first_name} already has an overlapping shift ({s.shift_start}-{s.shift_end}) on {target_shift.date}."
                    })

    @staticmethod
    def create_swap_request(
        daycare: Daycare,
        requesting_employee: Employee,
        target_employee: Employee,
        requesting_shift: StaffSchedule,
        target_shift: Optional[StaffSchedule] = None,
        reason: Optional[str] = None
    ) -> ShiftSwapRequest:
        ShiftSwapService.validate_swap(
            daycare=daycare,
            requesting_employee=requesting_employee,
            target_employee=target_employee,
            requesting_shift=requesting_shift,
            target_shift=target_shift
        )

        swap = ShiftSwapRequest.objects.create(
            daycare=daycare,
            requesting_employee=requesting_employee,
            target_employee=target_employee,
            requesting_shift=requesting_shift,
            target_shift=target_shift,
            reason=reason,
            status='pending'
        )

        return swap

    @staticmethod
    @transaction.atomic
    def approve_swap_request(
        swap_request: ShiftSwapRequest,
        user: User,
        admin_notes: Optional[str] = None
    ) -> ShiftSwapRequest:
        """
        Approves swap request and atomically reassigns shifts.
        Security: Requesting employee or target employee cannot approve their own swap request.
        """
        if swap_request.status != 'pending':
            raise ValidationError({"status": f"Cannot approve swap request that is already '{swap_request.status}'."})

        # Self-approval guard
        if hasattr(user, 'employee') and user.employee:
            if user.employee.id in [swap_request.requesting_employee_id, swap_request.target_employee_id]:
                raise PermissionDenied("Employees cannot approve their own shift swap requests. Daycare admin approval is required.")

        # Re-validate swap feasibility
        ShiftSwapService.validate_swap(
            daycare=swap_request.daycare,
            requesting_employee=swap_request.requesting_employee,
            target_employee=swap_request.target_employee,
            requesting_shift=swap_request.requesting_shift,
            target_shift=swap_request.target_shift
        )

        shift_a = swap_request.requesting_shift
        shift_b = swap_request.target_shift

        # Atomically swap employee assignment
        shift_a.employee = swap_request.target_employee
        shift_a.save()

        if shift_b:
            shift_b.employee = swap_request.requesting_employee
            shift_b.save()

        swap_request.status = 'approved'
        swap_request.approved_by = user
        swap_request.reviewed_at = timezone.now()
        if admin_notes:
            swap_request.admin_notes = admin_notes
        swap_request.save()

        AuditLog.objects.create(
            user=user,
            user_type='DaycareAdmin',
            action='SHIFT_SWAP_APPROVED',
            module='scheduling',
            entity_type='shift_swap_request',
            entity_id=str(swap_request.id),
            new_values={
                'requesting_employee': str(swap_request.requesting_employee.id),
                'target_employee': str(swap_request.target_employee.id),
                'shift_a': str(shift_a.id),
                'shift_b': str(shift_b.id) if shift_b else None,
                'admin_notes': admin_notes
            }
        )

        return swap_request

    @staticmethod
    def reject_swap_request(
        swap_request: ShiftSwapRequest,
        user: User,
        admin_notes: Optional[str] = None
    ) -> ShiftSwapRequest:
        if swap_request.status != 'pending':
            raise ValidationError({"status": f"Cannot reject swap request that is already '{swap_request.status}'."})

        swap_request.status = 'rejected'
        swap_request.approved_by = user
        swap_request.reviewed_at = timezone.now()
        if admin_notes:
            swap_request.admin_notes = admin_notes
        swap_request.save()

        AuditLog.objects.create(
            user=user,
            user_type='DaycareAdmin',
            action='SHIFT_SWAP_REJECTED',
            module='scheduling',
            entity_type='shift_swap_request',
            entity_id=str(swap_request.id),
            new_values={'admin_notes': admin_notes}
        )

        return swap_request

    @staticmethod
    def cancel_swap_request(
        swap_request: ShiftSwapRequest,
        user: User
    ) -> ShiftSwapRequest:
        if swap_request.status != 'pending':
            raise ValidationError({"status": f"Cannot cancel swap request that is already '{swap_request.status}'."})

        swap_request.status = 'cancelled'
        swap_request.reviewed_at = timezone.now()
        swap_request.save()

        AuditLog.objects.create(
            user=user,
            user_type='DaycareAdmin' if (user.is_staff or user.is_superuser) else 'Employee',
            action='SHIFT_SWAP_CANCELLED',
            module='scheduling',
            entity_type='shift_swap_request',
            entity_id=str(swap_request.id),
            new_values={'cancelled_by': str(user.id)}
        )

        return swap_request


class NotificationService:
    @staticmethod
    def send_notification(
        daycare: Daycare,
        notification_type: str,
        title: str,
        message: str,
        user: Optional[User] = None,
        employee: Optional[Employee] = None
    ) -> Optional[StaffNotification]:
        """
        Creates a staff/admin notification with deduplication to prevent alert spam.
        """
        recent_threshold = timezone.now() - timedelta(minutes=60)
        existing = StaffNotification.objects.filter(
            daycare=daycare,
            notification_type=notification_type,
            title=title,
            created_at__gte=recent_threshold
        )
        if user:
            existing = existing.filter(user=user)
        if employee:
            existing = existing.filter(employee=employee)

        if existing.exists():
            return None  # Suppress duplicate spam within 60 minutes

        return StaffNotification.objects.create(
            daycare=daycare,
            user=user,
            employee=employee,
            notification_type=notification_type,
            title=title,
            message=message
        )


class LeaveService:
    @staticmethod
    def get_or_create_default_leave_types(daycare: Daycare) -> List[LeaveType]:
        """
        Ensures daycare has standard configurable leave types seeded.
        """
        defaults = [
            {"name": "Sick Leave", "code": "sick", "is_paid": True, "requires_approval": True, "color_code": "#EF4444"},
            {"name": "Vacation", "code": "vacation", "is_paid": True, "requires_approval": True, "color_code": "#3B82F6"},
            {"name": "Holiday", "code": "holiday", "is_paid": True, "requires_approval": False, "color_code": "#10B981"},
            {"name": "Other Leave", "code": "other", "is_paid": False, "requires_approval": True, "color_code": "#8B5CF6"},
            {"name": "Personal Day", "code": "personal", "is_paid": True, "requires_approval": True, "color_code": "#F59E0B"},
        ]
        created_types = []
        for item in defaults:
            lt, _ = LeaveType.objects.get_or_create(
                daycare=daycare,
                code=item["code"],
                defaults={
                    "name": item["name"],
                    "is_paid": item["is_paid"],
                    "requires_approval": item["requires_approval"],
                    "color_code": item["color_code"],
                    "is_active": True
                }
            )
            created_types.append(lt)
        return LeaveType.objects.filter(daycare=daycare, is_active=True)

    @staticmethod
    def detect_schedule_conflicts(
        daycare: Daycare,
        employee: Employee,
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        """
        Identifies all scheduled shifts for the employee overlapping the requested leave period.
        """
        shifts = StaffSchedule.objects.filter(
            daycare=daycare,
            employee=employee,
            date__gte=start_date,
            date__lte=end_date,
            status__in=['scheduled', 'confirmed']
        ).order_by('date', 'shift_start')

        conflicts = []
        for s in shifts:
            conflicts.append({
                "shift_id": str(s.id),
                "date": str(s.date),
                "shift_start": s.shift_start.strftime('%H:%M') if s.shift_start else "",
                "shift_end": s.shift_end.strftime('%H:%M') if s.shift_end else "",
                "shift_type": s.shift_type,
                "classroom_id": str(s.classroom.id) if s.classroom else None,
                "classroom_name": s.classroom.room_name if s.classroom else "Floating / General",
                "branch_name": s.branch.name if s.branch else None,
                "duties": s.duties or ""
            })
        return conflicts

    @staticmethod
    def create_leave_request(
        daycare: Daycare,
        employee: Employee,
        leave_type: LeaveType,
        start_date: date,
        end_date: date,
        reason: Optional[str] = None,
        notes: Optional[str] = None
    ) -> LeaveRequest:
        if employee.daycare_id != daycare.id:
            raise ValidationError({"employee": "Employee does not belong to this daycare."})

        if leave_type.daycare_id != daycare.id:
            raise ValidationError({"leave_type": "Leave type does not belong to this daycare."})

        if start_date > end_date:
            raise ValidationError({"end_date": "End date cannot be earlier than start date."})

        conflicts = LeaveService.detect_schedule_conflicts(daycare, employee, start_date, end_date)

        initial_status = 'approved' if not leave_type.requires_approval else 'pending'

        leave_req = LeaveRequest.objects.create(
            daycare=daycare,
            employee=employee,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date,
            reason=reason,
            notes=notes,
            status=initial_status,
            affected_shifts_count=len(conflicts)
        )

        AuditLog.objects.create(
            user=None,
            user_type='Employee',
            action='LEAVE_REQUESTED',
            module='scheduling',
            entity_type='leave_request',
            entity_id=str(leave_req.id),
            new_values={
                'employee': str(employee.id),
                'leave_type': leave_type.name,
                'start_date': str(start_date),
                'end_date': str(end_date),
                'affected_shifts': len(conflicts)
            }
        )

        # Notify daycare admin
        admin_users = User.objects.filter(daycare=daycare, is_staff=True)
        for adm in admin_users:
            NotificationService.send_notification(
                daycare=daycare,
                user=adm,
                notification_type='leave_requested',
                title=f"New Leave Request: {employee.first_name} {employee.last_name}",
                message=f"{employee.first_name} requested {leave_type.name} from {start_date} to {end_date} ({len(conflicts)} shifts affected)."
            )

        return leave_req

    @staticmethod
    @transaction.atomic
    def approve_leave_request(
        leave_request: LeaveRequest,
        user: User,
        review_notes: Optional[str] = None
    ) -> LeaveRequest:
        """
        Approves leave request.
        Security: Employees cannot approve their own leave request.
        """
        if leave_request.status != 'pending':
            raise ValidationError({"status": f"Cannot approve leave request that is already '{leave_request.status}'."})

        # Self-approval guard
        if not (user.is_staff or user.is_superuser):
            raise PermissionDenied("Employees cannot approve leave requests. Daycare admin approval is required.")

        emp_profile = getattr(user, 'employee_profile', None) or Employee.objects.filter(daycare=leave_request.daycare, email=user.email).first()
        if emp_profile and emp_profile.id == leave_request.employee_id:
            raise PermissionDenied("Employees cannot approve their own leave requests.")

        leave_request.status = 'approved'
        leave_request.approved_by = user
        leave_request.reviewed_at = timezone.now()
        if review_notes:
            leave_request.notes = (leave_request.notes or '') + f"\n[Supervisor Note]: {review_notes}"
        leave_request.save()

        # Recalculate Shortages for affected date range
        ShortageDetectionService.detect_shortages_range(
            daycare=leave_request.daycare,
            start_date=leave_request.start_date,
            end_date=leave_request.end_date
        )

        AuditLog.objects.create(
            user=user,
            user_type='DaycareAdmin',
            action='LEAVE_APPROVED',
            module='scheduling',
            entity_type='leave_request',
            entity_id=str(leave_request.id),
            new_values={
                'employee': str(leave_request.employee_id),
                'leave_type': leave_request.leave_type.name,
                'start_date': str(leave_request.start_date),
                'end_date': str(leave_request.end_date),
                'review_notes': review_notes
            }
        )

        # Notify employee
        NotificationService.send_notification(
            daycare=leave_request.daycare,
            employee=leave_request.employee,
            notification_type='leave_approved',
            title=f"Leave Request Approved: {leave_request.leave_type.name}",
            message=f"Your {leave_request.leave_type.name} request from {leave_request.start_date} to {leave_request.end_date} has been approved."
        )

        return leave_request

    @staticmethod
    def reject_leave_request(
        leave_request: LeaveRequest,
        user: User,
        rejection_reason: str
    ) -> LeaveRequest:
        if leave_request.status != 'pending':
            raise ValidationError({"status": f"Cannot reject leave request that is already '{leave_request.status}'."})

        if not (user.is_staff or user.is_superuser):
            raise PermissionDenied("Employees cannot reject leave requests. Daycare admin approval is required.")

        if not rejection_reason or not rejection_reason.strip():
            raise ValidationError({"rejection_reason": "Rejection reason is required."})

        leave_request.status = 'rejected'
        leave_request.approved_by = user
        leave_request.reviewed_at = timezone.now()
        leave_request.rejection_reason = rejection_reason
        leave_request.save()

        AuditLog.objects.create(
            user=user,
            user_type='DaycareAdmin',
            action='LEAVE_REJECTED',
            module='scheduling',
            entity_type='leave_request',
            entity_id=str(leave_request.id),
            new_values={
                'employee': str(leave_request.employee_id),
                'rejection_reason': rejection_reason
            }
        )

        # Notify employee
        NotificationService.send_notification(
            daycare=leave_request.daycare,
            employee=leave_request.employee,
            notification_type='leave_rejected',
            title=f"Leave Request Rejected: {leave_request.leave_type.name}",
            message=f"Your {leave_request.leave_type.name} request was rejected. Reason: {rejection_reason}"
        )

        return leave_request

    @staticmethod
    def cancel_leave_request(
        leave_request: LeaveRequest,
        user: User
    ) -> LeaveRequest:
        if leave_request.status in ['rejected', 'cancelled']:
            raise ValidationError({"status": f"Cannot cancel leave request that is already '{leave_request.status}'."})

        was_approved = leave_request.status == 'approved'
        leave_request.status = 'cancelled'
        leave_request.reviewed_at = timezone.now()
        leave_request.save()

        if was_approved:
            ShortageDetectionService.detect_shortages_range(
                daycare=leave_request.daycare,
                start_date=leave_request.start_date,
                end_date=leave_request.end_date
            )

        AuditLog.objects.create(
            user=user,
            user_type='DaycareAdmin' if (user.is_staff or user.is_superuser) else 'Employee',
            action='LEAVE_CANCELLED',
            module='scheduling',
            entity_type='leave_request',
            entity_id=str(leave_request.id),
            new_values={'cancelled_by': str(user.id)}
        )

        return leave_request


class ShortageDetectionService:
    @staticmethod
    def is_daycare_holiday(daycare: Daycare, target_date: date) -> Optional[DaycareHoliday]:
        """
        Checks if target_date is a recognized Daycare Holiday (from Daycare Administration).
        """
        holidays = DaycareHoliday.objects.filter(daycare=daycare, status__iexact='active')
        for h in holidays:
            if h.end_date:
                if h.holiday_date <= target_date <= h.end_date:
                    return h
            else:
                if h.holiday_date == target_date:
                    return h
        return None

    @staticmethod
    def detect_shortages_for_date(daycare: Daycare, target_date: date) -> Dict[str, Any]:
        """
        Detects staff shortages and ratio non-compliance for all classrooms on a specific date.
        1. Checks for Daycare Holidays -> normal staffing suppressed if closed.
        2. Evaluates active scheduled educators vs required educators.
        3. Generates Warning and Critical alert records.
        """
        holiday = ShortageDetectionService.is_daycare_holiday(daycare, target_date)
        if holiday:
            # Resolve any existing active alerts on this holiday
            StaffShortageAlert.objects.filter(
                daycare=daycare,
                date=target_date,
                status='active'
            ).update(status='resolved')

            return {
                "date": str(target_date),
                "is_holiday": True,
                "holiday_name": holiday.name,
                "shortages": []
            }

        classrooms = Classroom.objects.filter(daycare=daycare, status__iexact='Active')
        detected_alerts = []

        # Find all staff with approved leave on this date
        leaves_today = LeaveRequest.objects.filter(
            daycare=daycare,
            status='approved',
            start_date__lte=target_date,
            end_date__gte=target_date
        )
        leave_emp_ids = set(leaves_today.values_list('employee_id', flat=True))

        for room in classrooms:
            cov = SchedulingService.calculate_classroom_coverage(daycare, room, target_date)
            required_staff = cov["required_staff_per_hour"]


            # Filter out shifts where staff is on approved leave
            all_shifts = StaffSchedule.objects.filter(
                daycare=daycare,
                classroom=room,
                date=target_date,
                status__in=['scheduled', 'confirmed']
            )
            active_shifts = [s for s in all_shifts if s.employee_id not in leave_emp_ids]
            active_staff_count = len(set([s.employee_id for s in active_shifts]))

            shortage_count = max(0, required_staff - active_staff_count)

            if shortage_count > 0 and required_staff > 0:
                alert_level = 'critical'
                leave_on_room_shift = [
                    f"{l.employee.first_name} {l.employee.last_name} ({l.leave_type.name})"
                    for l in leaves_today
                    if l.employee_id in [s.employee_id for s in all_shifts]
                ]
                reason = f"Shortage of {shortage_count} educator(s) in {room.room_name} (Ratio {cov['ratio_standard']}, required: {required_staff}, active: {active_staff_count})."
                if leave_on_room_shift:
                    reason += f" Staff absent/on leave: {', '.join(leave_on_room_shift)}."

                alert, created = StaffShortageAlert.objects.update_or_create(
                    daycare=daycare,
                    date=target_date,
                    classroom=room,
                    defaults={
                        "alert_level": alert_level,
                        "required_staff": required_staff,
                        "scheduled_staff": active_staff_count,
                        "shortage_count": shortage_count,
                        "reason": reason,
                        "status": "active"
                    }
                )
                detected_alerts.append(alert)

                # Send Notification to Daycare Admins
                admin_users = User.objects.filter(daycare=daycare, is_staff=True)
                for adm in admin_users:
                    NotificationService.send_notification(
                        daycare=daycare,
                        user=adm,
                        notification_type='staff_shortage',
                        title=f"Critical Staff Shortage: {room.room_name} on {target_date}",
                        message=reason
                    )

            elif active_staff_count == required_staff and required_staff > 0:
                alert_level = 'warning'
                reason = f"Coverage in {room.room_name} meets minimum ratio ({active_staff_count}/{required_staff}) with zero buffer."
                alert, created = StaffShortageAlert.objects.update_or_create(
                    daycare=daycare,
                    date=target_date,
                    classroom=room,
                    defaults={
                        "alert_level": alert_level,
                        "required_staff": required_staff,
                        "scheduled_staff": active_staff_count,
                        "shortage_count": 0,
                        "reason": reason,
                        "status": "active"
                    }
                )
                detected_alerts.append(alert)

            else:
                # Compliant with buffer -> Resolve any existing active alerts
                StaffShortageAlert.objects.filter(
                    daycare=daycare,
                    date=target_date,
                    classroom=room,
                    status='active'
                ).update(status='resolved')

        return {
            "date": str(target_date),
            "is_holiday": False,
            "holiday_name": None,
            "shortages_count": len(detected_alerts),
            "shortages": detected_alerts
        }

    @staticmethod
    def detect_shortages_range(
        daycare: Daycare,
        start_date: date,
        end_date: date
    ) -> List[StaffShortageAlert]:
        """
        Scans a date range and updates all shortage alerts.
        """
        alerts = []
        cur_date = start_date
        while cur_date <= end_date:
            res = ShortageDetectionService.detect_shortages_for_date(daycare, cur_date)
            alerts.extend(res.get("shortages", []))
            cur_date += timedelta(days=1)
        return alerts


class SchedulingConflictService:
    """
    Unified, reusable validation engine for shift conflict prevention:
    - Employee shift overlaps
    - Employee availability
    - Approved leave conflicts
    - Classroom assignments & status
    - Branch tenant isolation
    - Classroom capacity & staff ratio
    """

    @staticmethod
    def validate_shift(
        daycare: Daycare,
        employee: Employee,
        shift_date: date,
        shift_start: time,
        shift_end: time,
        classroom: Optional[Classroom] = None,
        branch: Optional[Branch] = None,
        exclude_schedule_id: Optional[str] = None
    ) -> None:
        # Standard shift validation
        SchedulingService.validate_shift(
            daycare=daycare,
            employee=employee,
            shift_date=shift_date,
            shift_start=shift_start,
            shift_end=shift_end,
            classroom=classroom,
            branch=branch,
            exclude_schedule_id=exclude_schedule_id
        )

        # Check Approved Leave Conflict
        leave = LeaveRequest.objects.filter(
            employee=employee,
            status='approved',
            start_date__lte=shift_date,
            end_date__gte=shift_date
        ).first()

        if leave:
            leave_name = leave.leave_type.name if leave.leave_type else "Leave"
            raise ValidationError({
                "non_field_errors": [
                    f"Leave conflict: {employee.first_name} {employee.last_name} has approved {leave_name} from {leave.start_date} to {leave.end_date}."
                ]
            })

    @staticmethod
    def detect_schedule_conflicts(daycare: Daycare, employee: Employee, start_date: date, end_date: date) -> List[StaffSchedule]:
        return LeaveService.detect_schedule_conflicts(daycare, employee, start_date, end_date)


class SchedulingCoverageService:
    """
    Unified, reusable engine for calculating staff coverage, shortages, and ratio compliance.
    """

    @staticmethod
    def calculate_classroom_coverage(
        daycare: Daycare,
        classroom: Classroom,
        schedule_date: Optional[date] = None,
        target_date: Optional[date] = None,
        day_start_hour: int = 7,
        day_end_hour: int = 18
    ) -> Dict[str, Any]:
        dt = schedule_date or target_date or timezone.now().date()
        return SchedulingService.calculate_classroom_coverage(
            daycare=daycare,
            classroom=classroom,
            target_date=dt,
            day_start_hour=day_start_hour,
            day_end_hour=day_end_hour
        )

    @staticmethod
    def get_daycare_scheduling_dashboard(daycare: Daycare, target_date: Optional[date] = None) -> Dict[str, Any]:
        """
        Master KPI Dashboard and Live Classroom Coverage for Daycare Admin.
        """
        if not target_date:
            target_date = timezone.now().date()

        # Target week boundaries (Monday to Sunday)
        day_idx = target_date.weekday()
        week_start = target_date - timedelta(days=day_idx)
        week_end = week_start + timedelta(days=6)

        # 1. Weekly Scheduled Staff
        total_scheduled_staff = StaffSchedule.objects.filter(
            daycare=daycare,
            date__range=[week_start, week_end]
        ).exclude(status='cancelled').values('employee').distinct().count()

        # 2. Today's Shifts
        today_shifts = StaffSchedule.objects.filter(
            daycare=daycare,
            date=target_date
        ).exclude(status='cancelled').select_related('employee', 'classroom')

        today_emp_ids = set(s.employee_id for s in today_shifts)
        staff_working_today = len(today_emp_ids)

        # 3. Staff On Leave Today
        today_leaves = LeaveRequest.objects.filter(
            daycare=daycare,
            status='approved',
            start_date__lte=target_date,
            end_date__gte=target_date
        ).select_related('employee', 'leave_type')

        staff_on_leave_today = today_leaves.count()
        leaves_list = [
            {
                "employee_id": str(l.employee.id),
                "employee_name": f"{l.employee.first_name} {l.employee.last_name}",
                "leave_type": l.leave_type.name if l.leave_type else "Leave",
                "start_date": str(l.start_date),
                "end_date": str(l.end_date)
            }
            for l in today_leaves
        ]

        # 4. Opening & Closing Staff
        opening_shifts = [s for s in today_shifts if s.shift_type == 'opening' or s.shift_start <= time(8, 0)]
        closing_shifts = [s for s in today_shifts if s.shift_type == 'closing' or s.shift_end >= time(17, 30)]

        # 5. Open / Floating Shifts
        open_shifts = today_shifts.filter(classroom__isnull=True).count()

        # 6. Approvals & Overtime
        pending_leaves = LeaveRequest.objects.filter(daycare=daycare, status='pending').count()
        pending_swaps = ShiftSwapRequest.objects.filter(daycare=daycare, status='pending').count()

        overtime_qs = OvertimeRecord.objects.filter(
            daycare=daycare,
            date__month=target_date.month,
            date__year=target_date.year
        )
        approved_ot = float(overtime_qs.filter(status='approved').aggregate(total=Sum('overtime_hours'))['total'] or 0.0)
        pending_ot = float(overtime_qs.filter(status='pending').aggregate(total=Sum('overtime_hours'))['total'] or 0.0)


        # 7. Shortage & Warning Alerts
        ShortageDetectionService.detect_shortages_for_date(daycare, target_date)
        critical_alerts = StaffShortageAlert.objects.filter(
            daycare=daycare,
            date=target_date,
            alert_level='critical',
            status='active'
        )
        warning_alerts = StaffShortageAlert.objects.filter(
            daycare=daycare,
            date=target_date,
            alert_level='warning',
            status='active'
        )

        critical_shortages_count = critical_alerts.count()
        coverage_warnings_count = warning_alerts.count()

        # 8. Today's Live Classroom Coverage Breakdown
        rooms = Classroom.objects.filter(daycare=daycare).select_related('age_group')
        # Filter active rooms
        active_rooms = [r for r in rooms if not hasattr(r, 'status') or not r.status or r.status.lower() == 'active']

        classrooms_coverage = []
        for room in active_rooms:
            cov = SchedulingService.calculate_classroom_coverage(daycare, room, target_date)
            # Find active educators excluding those with approved leave today
            room_shifts = [s for s in today_shifts if s.classroom_id == room.id]
            room_emp_ids = set(s.employee_id for s in room_shifts)
            active_emp_ids = room_emp_ids - set(l.employee_id for l in today_leaves)

            req = cov.get("required_staff_per_hour", 1)
            sched = len(room_emp_ids)
            act = len(active_emp_ids)

            if act < req:
                status_label = "SHORTAGE"
            elif act == req and req > 0:
                status_label = "WARNING"
            elif act > req:
                status_label = "SURPLUS"
            else:
                status_label = "OK"

            classrooms_coverage.append({
                "classroom_id": str(room.id),
                "classroom_name": room.room_name,
                "age_group": room.age_group.name if room.age_group else "General",
                "ratio_rule": f"1:{room.age_group.ratio_staff_to_children}" if (room.age_group and room.age_group.ratio_staff_to_children) else "Standard",
                "capacity": room.capacity,
                "enrolled_children": cov.get("enrolled_children", 0),
                "required_staff": req,
                "scheduled_staff": sched,
                "active_staff": act,
                "shortage": max(0, req - act),
                "status": status_label,
                "slots": cov.get("slots", [])
            })

        return {
            "date": str(target_date),
            "total_scheduled_staff": total_scheduled_staff,
            "staff_working_today": staff_working_today,
            "staff_on_leave": staff_on_leave_today,
            "staff_on_leave_list": leaves_list,
            "opening_staff_count": len(opening_shifts),
            "closing_staff_count": len(closing_shifts),
            "open_shifts": open_shifts,
            "coverage_warnings": coverage_warnings_count,
            "critical_shortages": critical_shortages_count,
            "overtime_hours": approved_ot,
            "pending_overtime_hours": pending_ot,
            "pending_leave_requests": pending_leaves,
            "pending_shift_swaps": pending_swaps,
            "classrooms_coverage": classrooms_coverage
        }


class SchedulingHistoryService:
    """
    Service for immutable schedule history and audit trails.
    """

    @staticmethod
    def log_schedule_action(
        daycare: Daycare,
        user: Optional[User],
        action: str,
        entity_type: str,
        entity_id: str,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        return AuditLog.objects.create(
            user=user,
            user_type=user.role if (user and hasattr(user, 'role')) else 'Staff',
            action=action,
            module='scheduling',
            entity_type=entity_type,
            entity_id=str(entity_id),
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address
        )

    @staticmethod
    def get_history(
        daycare: Daycare,
        entity_type: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        qs = AuditLog.objects.filter(
            Q(user__daycare=daycare) | Q(module='scheduling')
        ).filter(module='scheduling')

        if entity_type:
            qs = qs.filter(entity_type__iexact=entity_type)
        if action:
            qs = qs.filter(action__iexact=action)

        logs = qs.select_related('user').order_by('-created_at')[:limit]

        return [
            {
                "id": str(log.id),
                "created_at": log.created_at.isoformat(),
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "user_name": f"{log.user.first_name} {log.user.last_name}" if log.user else "System",
                "user_role": log.user_type or "User",
                "old_values": log.old_values or {},
                "new_values": log.new_values or {},
                "ip_address": log.ip_address
            }
            for log in logs
        ]


class SchedulingReportsService:
    """
    Generator for all 16 Staff Scheduling Reports with JSON data & CSV exports.
    """

    @staticmethod
    def generate_report(daycare: Daycare, report_type: str, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        filters = filters or {}
        start_date_str = filters.get('start_date')
        end_date_str = filters.get('end_date')

        today = timezone.now().date()
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date() if start_date_str else today - timedelta(days=30)
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date() if end_date_str else today + timedelta(days=30)

        emp_filter = filters.get('employee')
        room_filter = filters.get('classroom')
        branch_filter = filters.get('branch')
        status_filter = filters.get('status')
        shift_type_filter = filters.get('shift_type')

        title = "Staff Scheduling Report"
        columns = []
        rows = []

        # 1. Weekly Staff Schedule
        if report_type == 'weekly_schedule':
            title = "Weekly Staff Schedule Report"
            columns = [
                {"key": "date", "label": "Date"},
                {"key": "employee_name", "label": "Employee"},
                {"key": "classroom_name", "label": "Classroom"},
                {"key": "shift_type", "label": "Shift Type"},
                {"key": "shift_timing", "label": "Timing"},
                {"key": "break_minutes", "label": "Break (Mins)"},
                {"key": "total_hours", "label": "Hours"},
                {"key": "status", "label": "Status"}
            ]
            qs = StaffSchedule.objects.filter(daycare=daycare, date__range=[start_date, end_date]).select_related('employee', 'classroom').order_by('date', 'shift_start')
            if emp_filter:
                qs = qs.filter(employee_id=emp_filter)
            if room_filter:
                qs = qs.filter(classroom_id=room_filter)
            if status_filter:
                qs = qs.filter(status=status_filter)
            for s in qs:
                rows.append({
                    "date": str(s.date),
                    "employee_name": f"{s.employee.first_name} {s.employee.last_name}",
                    "classroom_name": s.classroom.room_name if s.classroom else "Floater / General",
                    "shift_type": s.shift_type.capitalize(),
                    "shift_timing": f"{s.shift_start.strftime('%H:%M')} - {s.shift_end.strftime('%H:%M')}",
                    "break_minutes": s.break_duration_minutes,
                    "total_hours": float(s.total_hours),
                    "status": s.status.capitalize()
                })

        # 2. Employee Schedule
        elif report_type == 'employee_schedule':
            title = "Employee Schedule & Hours Report"
            columns = [
                {"key": "employee_name", "label": "Employee"},
                {"key": "job_title", "label": "Role/Title"},
                {"key": "date", "label": "Date"},
                {"key": "classroom_name", "label": "Classroom"},
                {"key": "shift_timing", "label": "Shift Timing"},
                {"key": "total_hours", "label": "Hours"},
                {"key": "status", "label": "Status"}
            ]
            qs = StaffSchedule.objects.filter(daycare=daycare, date__range=[start_date, end_date]).select_related('employee', 'classroom').order_by('employee__last_name', 'date')
            if emp_filter:
                qs = qs.filter(employee_id=emp_filter)
            for s in qs:
                rows.append({
                    "employee_name": f"{s.employee.first_name} {s.employee.last_name}",
                    "job_title": s.employee.job_title or s.employee.role,
                    "date": str(s.date),
                    "classroom_name": s.classroom.room_name if s.classroom else "Floater",
                    "shift_timing": f"{s.shift_start.strftime('%H:%M')} - {s.shift_end.strftime('%H:%M')}",
                    "total_hours": float(s.total_hours),
                    "status": s.status.capitalize()
                })

        # 3. Classroom Schedule
        elif report_type == 'classroom_schedule':
            title = "Classroom Schedule Report"
            columns = [
                {"key": "classroom_name", "label": "Classroom"},
                {"key": "age_group", "label": "Age Group"},
                {"key": "date", "label": "Date"},
                {"key": "staff_name", "label": "Educator"},
                {"key": "shift_type", "label": "Shift Type"},
                {"key": "shift_timing", "label": "Timing"},
                {"key": "total_hours", "label": "Hours"}
            ]
            qs = StaffSchedule.objects.filter(daycare=daycare, classroom__isnull=False, date__range=[start_date, end_date]).select_related('classroom__age_group', 'employee').order_by('classroom__room_name', 'date')
            if room_filter:
                qs = qs.filter(classroom_id=room_filter)
            for s in qs:
                rows.append({
                    "classroom_name": s.classroom.room_name,
                    "age_group": s.classroom.age_group.name if s.classroom.age_group else "General",
                    "date": str(s.date),
                    "staff_name": f"{s.employee.first_name} {s.employee.last_name}",
                    "shift_type": s.shift_type.capitalize(),
                    "shift_timing": f"{s.shift_start.strftime('%H:%M')} - {s.shift_end.strftime('%H:%M')}",
                    "total_hours": float(s.total_hours)
                })

        # 4. Opening Shift Report
        elif report_type == 'opening_shifts':
            title = "Opening Shift Report"
            columns = [
                {"key": "date", "label": "Date"},
                {"key": "staff_name", "label": "Opening Educator"},
                {"key": "classroom_name", "label": "Classroom"},
                {"key": "shift_start", "label": "Start Time"},
                {"key": "shift_end", "label": "End Time"},
                {"key": "status", "label": "Status"}
            ]
            qs = StaffSchedule.objects.filter(
                Q(daycare=daycare, date__range=[start_date, end_date]) & 
                (Q(shift_type='opening') | Q(shift_start__lte=time(8, 0)))
            ).select_related('employee', 'classroom').order_by('date')
            for s in qs:
                rows.append({
                    "date": str(s.date),
                    "staff_name": f"{s.employee.first_name} {s.employee.last_name}",
                    "classroom_name": s.classroom.room_name if s.classroom else "General",
                    "shift_start": s.shift_start.strftime('%H:%M'),
                    "shift_end": s.shift_end.strftime('%H:%M'),
                    "status": s.status.capitalize()
                })

        # 5. Closing Shift Report
        elif report_type == 'closing_shifts':
            title = "Closing Shift Report"
            columns = [
                {"key": "date", "label": "Date"},
                {"key": "staff_name", "label": "Closing Educator"},
                {"key": "classroom_name", "label": "Classroom"},
                {"key": "shift_start", "label": "Start Time"},
                {"key": "shift_end", "label": "End Time"},
                {"key": "status", "label": "Status"}
            ]
            qs = StaffSchedule.objects.filter(
                Q(daycare=daycare, date__range=[start_date, end_date]) & 
                (Q(shift_type='closing') | Q(shift_end__gte=time(17, 30)))
            ).select_related('employee', 'classroom').order_by('date')
            for s in qs:
                rows.append({
                    "date": str(s.date),
                    "staff_name": f"{s.employee.first_name} {s.employee.last_name}",
                    "classroom_name": s.classroom.room_name if s.classroom else "General",
                    "shift_start": s.shift_start.strftime('%H:%M'),
                    "shift_end": s.shift_end.strftime('%H:%M'),
                    "status": s.status.capitalize()
                })

        # 6. Staff Availability Report
        elif report_type == 'staff_availability':
            title = "Staff Availability & Rostering Preferences"
            columns = [
                {"key": "employee_name", "label": "Employee"},
                {"key": "day_of_week", "label": "Day of Week"},
                {"key": "status", "label": "Status"},
                {"key": "available_hours", "label": "Available Hours"},
                {"key": "effective_from", "label": "Effective From"}
            ]
            qs = EmployeeAvailability.objects.filter(employee__daycare=daycare).select_related('employee').order_by('employee__first_name', 'day_of_week')
            if emp_filter:
                qs = qs.filter(employee_id=emp_filter)
            for a in qs:
                hours_str = "All Day" if a.status == 'Available' else f"{a.start_time.strftime('%H:%M')} - {a.end_time.strftime('%H:%M')}" if (a.start_time and a.end_time) else "Unavailable"
                rows.append({
                    "employee_name": f"{a.employee.first_name} {a.employee.last_name}",
                    "day_of_week": a.day_of_week,
                    "status": a.status,
                    "available_hours": hours_str,
                    "effective_from": str(a.effective_start_date) if a.effective_start_date else "Immediate"
                })

        # 7. Overtime Report
        elif report_type == 'overtime':
            title = "Overtime & Extra Hours Report"
            columns = [
                {"key": "date", "label": "Date"},
                {"key": "employee_name", "label": "Employee"},
                {"key": "scheduled_hours", "label": "Scheduled (Hrs)"},
                {"key": "actual_hours", "label": "Actual (Hrs)"},
                {"key": "overtime_hours", "label": "Overtime (Hrs)"},
                {"key": "approval_status", "label": "Status"},
                {"key": "approved_by", "label": "Reviewed By"}
            ]
            qs = OvertimeRecord.objects.filter(daycare=daycare, date__range=[start_date, end_date]).select_related('employee', 'approved_by').order_by('-date')
            if emp_filter:
                qs = qs.filter(employee_id=emp_filter)
            for ot in qs:
                rows.append({
                    "date": str(ot.date),
                    "employee_name": f"{ot.employee.first_name} {ot.employee.last_name}",
                    "scheduled_hours": float(ot.scheduled_hours),
                    "actual_hours": float(ot.actual_hours),
                    "overtime_hours": float(ot.overtime_hours),
                    "approval_status": ot.approval_status.capitalize(),
                    "approved_by": f"{ot.approved_by.first_name} {ot.approved_by.last_name}" if ot.approved_by else "Pending"
                })

        # 8. Time Bank Report
        elif report_type == 'time_bank':
            title = "Time Bank & Compensatory Time Report"
            columns = [
                {"key": "date", "label": "Date"},
                {"key": "employee_name", "label": "Employee"},
                {"key": "transaction_type", "label": "Transaction Type"},
                {"key": "hours", "label": "Hours"},
                {"key": "status", "label": "Status"},
                {"key": "notes", "label": "Notes"}
            ]
            qs = TimeBankTransaction.objects.filter(daycare=daycare, transaction_date__range=[start_date, end_date]).select_related('employee').order_by('-transaction_date')
            if emp_filter:
                qs = qs.filter(employee_id=emp_filter)
            for tx in qs:
                rows.append({
                    "date": str(tx.transaction_date),
                    "employee_name": f"{tx.employee.first_name} {tx.employee.last_name}",
                    "transaction_type": tx.transaction_type.replace('_', ' ').title(),
                    "hours": float(tx.hours),
                    "status": tx.status.capitalize(),
                    "notes": tx.notes or ""
                })

        # 9. Shift Swap Report
        elif report_type == 'shift_swaps':
            title = "Shift Swap Request Report"
            columns = [
                {"key": "date", "label": "Requested Date"},
                {"key": "requesting_employee", "label": "Requesting Staff"},
                {"key": "target_employee", "label": "Target Staff"},
                {"key": "shift_date", "label": "Shift Date"},
                {"key": "status", "label": "Status"},
                {"key": "reason", "label": "Reason"}
            ]
            qs = ShiftSwapRequest.objects.filter(daycare=daycare).select_related('requesting_employee', 'target_employee', 'requesting_schedule').order_by('-requested_at')
            for sw in qs:
                rows.append({
                    "date": sw.requested_at.strftime('%Y-%m-%d'),
                    "requesting_employee": f"{sw.requesting_employee.first_name} {sw.requesting_employee.last_name}",
                    "target_employee": f"{sw.target_employee.first_name} {sw.target_employee.last_name}" if sw.target_employee else "Open Pool",
                    "shift_date": str(sw.requesting_schedule.date) if sw.requesting_schedule else "N/A",
                    "status": sw.status.capitalize(),
                    "reason": sw.reason or ""
                })

        # 10. Leave Summary Report
        elif report_type == 'leave_summary':
            title = "Leave & Time-Off Summary Report"
            columns = [
                {"key": "employee_name", "label": "Employee"},
                {"key": "leave_type", "label": "Leave Type"},
                {"key": "start_date", "label": "Start Date"},
                {"key": "end_date", "label": "End Date"},
                {"key": "affected_shifts", "label": "Affected Shifts"},
                {"key": "status", "label": "Status"},
                {"key": "reason", "label": "Reason"}
            ]
            qs = LeaveRequest.objects.filter(daycare=daycare, start_date__lte=end_date, end_date__gte=start_date).select_related('employee', 'leave_type').order_by('-requested_at')
            if emp_filter:
                qs = qs.filter(employee_id=emp_filter)
            for lr in qs:
                rows.append({
                    "employee_name": f"{lr.employee.first_name} {lr.employee.last_name}",
                    "leave_type": lr.leave_type.name if lr.leave_type else "Leave",
                    "start_date": str(lr.start_date),
                    "end_date": str(lr.end_date),
                    "affected_shifts": lr.affected_shifts_count,
                    "status": lr.status.capitalize(),
                    "reason": lr.reason or ""
                })

        # 11. Sick Leave Report
        elif report_type == 'sick_leave':
            title = "Sick Leave Utilization Report"
            columns = [
                {"key": "employee_name", "label": "Employee"},
                {"key": "start_date", "label": "Start Date"},
                {"key": "end_date", "label": "End Date"},
                {"key": "affected_shifts", "label": "Affected Shifts"},
                {"key": "status", "label": "Status"}
            ]
            qs = LeaveRequest.objects.filter(
                daycare=daycare,
                leave_type__code='sick',
                start_date__lte=end_date,
                end_date__gte=start_date
            ).select_related('employee').order_by('-start_date')
            for lr in qs:
                rows.append({
                    "employee_name": f"{lr.employee.first_name} {lr.employee.last_name}",
                    "start_date": str(lr.start_date),
                    "end_date": str(lr.end_date),
                    "affected_shifts": lr.affected_shifts_count,
                    "status": lr.status.capitalize()
                })

        # 12. Vacation Report
        elif report_type == 'vacation':
            title = "Staff Vacation & Planned Leave Report"
            columns = [
                {"key": "employee_name", "label": "Employee"},
                {"key": "start_date", "label": "Start Date"},
                {"key": "end_date", "label": "End Date"},
                {"key": "affected_shifts", "label": "Affected Shifts"},
                {"key": "status", "label": "Status"},
                {"key": "notes", "label": "Supervisor Notes"}
            ]
            qs = LeaveRequest.objects.filter(
                daycare=daycare,
                leave_type__code='vacation',
                start_date__lte=end_date,
                end_date__gte=start_date
            ).select_related('employee').order_by('-start_date')
            for lr in qs:
                rows.append({
                    "employee_name": f"{lr.employee.first_name} {lr.employee.last_name}",
                    "start_date": str(lr.start_date),
                    "end_date": str(lr.end_date),
                    "affected_shifts": lr.affected_shifts_count,
                    "status": lr.status.capitalize(),
                    "notes": lr.notes or ""
                })

        # 13. Holiday Schedule Report
        elif report_type == 'holiday_schedule':
            title = "Daycare Holidays & Operational Closures"
            columns = [
                {"key": "holiday_name", "label": "Holiday"},
                {"key": "start_date", "label": "Holiday Date"},
                {"key": "end_date", "label": "End Date"},
                {"key": "description", "label": "Details"},
                {"key": "status", "label": "Status"}
            ]
            qs = DaycareHoliday.objects.filter(daycare=daycare, holiday_date__range=[start_date, end_date]).order_by('holiday_date')
            for h in qs:
                rows.append({
                    "holiday_name": h.name,
                    "start_date": str(h.holiday_date),
                    "end_date": str(h.end_date) if h.end_date else str(h.holiday_date),
                    "description": h.description or "",
                    "status": h.status
                })

        # 14. Staff Shortages Report
        elif report_type == 'staff_shortages':
            title = "Staff Shortage & Non-Compliance Report"
            columns = [
                {"key": "date", "label": "Date"},
                {"key": "classroom_name", "label": "Classroom"},
                {"key": "alert_level", "label": "Alert Level"},
                {"key": "required_staff", "label": "Required Staff"},
                {"key": "scheduled_staff", "label": "Scheduled Staff"},
                {"key": "shortage_count", "label": "Shortage"},
                {"key": "status", "label": "Status"},
                {"key": "reason", "label": "Reason"}
            ]
            qs = StaffShortageAlert.objects.filter(daycare=daycare, date__range=[start_date, end_date]).select_related('classroom').order_by('-date')
            for sh in qs:
                rows.append({
                    "date": str(sh.date),
                    "classroom_name": sh.classroom.room_name if sh.classroom else "All Daycare",
                    "alert_level": sh.alert_level.upper(),
                    "required_staff": sh.required_staff,
                    "scheduled_staff": sh.scheduled_staff,
                    "shortage_count": sh.shortage_count,
                    "status": sh.status.capitalize(),
                    "reason": sh.reason
                })

        # 15. Classroom Coverage Hourly Report
        elif report_type == 'classroom_coverage':
            title = "Classroom Hourly Coverage Report"
            columns = [
                {"key": "date", "label": "Date"},
                {"key": "classroom_name", "label": "Classroom"},
                {"key": "time_slot", "label": "Hour Slot"},
                {"key": "required_staff", "label": "Required"},
                {"key": "scheduled_staff", "label": "Active Staff"},
                {"key": "coverage_status", "label": "Status"},
                {"key": "shortage", "label": "Shortage"}
            ]
            cur = start_date
            rooms = Classroom.objects.filter(daycare=daycare)
            if room_filter:
                rooms = rooms.filter(id=room_filter)
            while cur <= min(end_date, start_date + timedelta(days=7)): # Cap to 7 days for hourly
                for room in rooms:
                    cov = SchedulingService.calculate_classroom_coverage(daycare, room, cur)
                    for slot in cov.get("slots", []):
                        rows.append({
                            "date": str(cur),
                            "classroom_name": room.room_name,
                            "time_slot": slot.get("time_slot"),
                            "required_staff": slot.get("required_staff"),
                            "scheduled_staff": slot.get("scheduled_staff_count"),
                            "coverage_status": slot.get("coverage_status"),
                            "shortage": slot.get("shortage", 0)
                        })
                cur += timedelta(days=1)

        # 16. Ratio Compliance Report
        elif report_type == 'ratio_compliance':
            title = "Staff/Child Ratio Compliance Report"
            columns = [
                {"key": "classroom_name", "label": "Classroom"},
                {"key": "age_group", "label": "Age Group"},
                {"key": "ratio_rule", "label": "Mandated Ratio"},
                {"key": "capacity", "label": "Capacity"},
                {"key": "enrolled_children", "label": "Enrolled"},
                {"key": "required_staff", "label": "Required Staff"},
                {"key": "active_staff", "label": "Current Active Staff"},
                {"key": "compliance_status", "label": "Compliance Status"}
            ]
            dash = SchedulingCoverageService.get_daycare_scheduling_dashboard(daycare, today)
            for cr in dash.get("classrooms_coverage", []):
                rows.append({
                    "classroom_name": cr.get("classroom_name"),
                    "age_group": cr.get("age_group"),
                    "ratio_rule": cr.get("ratio_rule"),
                    "capacity": cr.get("capacity"),
                    "enrolled_children": cr.get("enrolled_children"),
                    "required_staff": cr.get("required_staff"),
                    "active_staff": cr.get("active_staff"),
                    "compliance_status": "COMPLIANT" if cr.get("status") in ["OK", "SURPLUS"] else cr.get("status")
                })

        else:
            raise ValidationError({"report_type": f"Unknown report type '{report_type}'."})

        # Generate CSV Data String
        csv_output = io.StringIO()
        if columns:
            writer = csv.DictWriter(csv_output, fieldnames=[c["key"] for c in columns])
            # Write header with labels
            header_dict = {c["key"]: c["label"] for c in columns}
            writer.writerow(header_dict)
            writer.writerows(rows)

        return {
            "report_type": report_type,
            "title": title,
            "start_date": str(start_date),
            "end_date": str(end_date),
            "columns": columns,
            "rows": rows,
            "total_rows": len(rows),
            "csv_content": csv_output.getvalue()
        }



