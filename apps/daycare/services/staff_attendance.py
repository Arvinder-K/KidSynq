import logging
from datetime import datetime, date, time, timedelta
from typing import Dict, Any, Optional, List
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.shortcuts import get_object_or_404

from core.models import (
    Daycare, Branch, Classroom, Employee, User,
    StaffSchedule, LeaveRequest, StaffAttendance,
    StaffBreak, AuditLog, OvertimeRecord, TimeBankRule, TimeBankTransaction
)

logger = logging.getLogger(__name__)


class StaffAttendanceService:
    """
    Comprehensive Service Layer for Staff Attendance, Time Tracking,
    Breaks, Timesheet Approvals, and Controlled Corrections.
    """

    @classmethod
    def _parse_datetime(cls, dt_val: Any, default_date: Optional[date] = None) -> datetime:
        if isinstance(dt_val, datetime):
            return dt_val
        if isinstance(dt_val, str):
            dt_str = dt_val.strip()
            # If format is HH:MM or HH:MM:SS
            if len(dt_str) in (5, 8) and ':' in dt_str:
                d = default_date or timezone.now().date()
                parts = dt_str.split(':')
                h = int(parts[0])
                m = int(parts[1])
                s = int(parts[2]) if len(parts) > 2 else 0
                return timezone.make_aware(datetime.combine(d, time(h, m, s)))
            try:
                # ISO Format
                dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
                if timezone.is_naive(dt):
                    dt = timezone.make_aware(dt)
                return dt
            except Exception:
                pass
        raise ValidationError({"datetime": f"Invalid datetime value: {dt_val}"})

    @classmethod
    def _create_audit(
        cls,
        user: Optional[User],
        action: str,
        attendance: StaffAttendance,
        old_values: Optional[Dict] = None,
        new_values: Optional[Dict] = None,
        notes: Optional[str] = None
    ) -> AuditLog:
        return AuditLog.objects.create(
            user=user,
            user_type=user.role if hasattr(user, 'role') else ('Admin' if user and user.is_staff else 'Staff'),
            action=action,
            module="STAFF_ATTENDANCE",
            entity_type="StaffAttendance",
            entity_id=str(attendance.id),
            old_values=old_values,
            new_values=new_values
        )

    @classmethod
    @transaction.atomic
    def clock_in(
        cls,
        daycare: Daycare,
        employee_id: str,
        user: Optional[User] = None,
        branch_id: Optional[str] = None,
        classroom_id: Optional[str] = None,
        custom_datetime: Optional[Any] = None,
        notes: Optional[str] = None
    ) -> StaffAttendance:
        employee = get_object_or_404(Employee, pk=employee_id, daycare=daycare)

        if not employee.status or employee.status.lower() != 'active':
            raise ValidationError({"employee": f"Employee {employee.first_name} {employee.last_name} is inactive and cannot clock in."})

        # Clock-in timestamp
        now_dt = cls._parse_datetime(custom_datetime) if custom_datetime else timezone.now()
        work_date = now_dt.date()

        # Check approved leave on this date
        leave_exists = LeaveRequest.objects.filter(
            employee=employee,
            status='approved',
            start_date__lte=work_date,
            end_date__gte=work_date
        ).exists()
        if leave_exists:
            raise ValidationError({"leave": f"Employee is on approved leave for {work_date} and cannot clock in."})

        # Check no active/open clock-in exists
        open_att = StaffAttendance.objects.filter(
            employee=employee,
            clock_in__isnull=False,
            clock_out__isnull=True
        ).first()
        if open_att:
            raise ValidationError({
                "clock_in": f"Employee already has an active clock-in on {open_att.date} at {open_att.clock_in.strftime('%H:%M')}."
            })

        # Find matching scheduled shift if available
        sched = StaffSchedule.objects.filter(
            employee=employee,
            date=work_date,
            status__in=['scheduled', 'confirmed', 'completed']
        ).first()

        branch = None
        if branch_id:
            branch = get_object_or_404(Branch, pk=branch_id, daycare=daycare)
        elif sched and sched.branch:
            branch = sched.branch

        classroom = None
        if classroom_id:
            classroom = get_object_or_404(Classroom, pk=classroom_id, daycare=daycare)
        elif sched and sched.classroom:
            classroom = sched.classroom

        attendance = StaffAttendance.objects.create(
            daycare=daycare,
            branch=branch,
            employee=employee,
            classroom=classroom,
            scheduled_shift=sched,
            date=work_date,
            clock_in=now_dt,
            check_in_time=now_dt.time(),
            status='CLOCKED_IN',
            approval_status='PENDING',
            notes=notes,
            logged_by=user,
            created_by=user
        )

        cls._create_audit(
            user=user,
            action="STAFF_CLOCK_IN",
            attendance=attendance,
            new_values={
                "employee_id": str(employee.id),
                "employee_name": f"{employee.first_name} {employee.last_name}",
                "date": str(work_date),
                "clock_in": now_dt.isoformat(),
                "status": "CLOCKED_IN",
                "scheduled_shift_id": str(sched.id) if sched else None
            }
        )

        return attendance

    @classmethod
    @transaction.atomic
    def clock_out(
        cls,
        daycare: Daycare,
        attendance_id: str,
        user: Optional[User] = None,
        custom_datetime: Optional[Any] = None,
        notes: Optional[str] = None
    ) -> StaffAttendance:
        attendance = get_object_or_404(StaffAttendance, pk=attendance_id, daycare=daycare)

        if attendance.clock_out is not None or attendance.status == 'CLOCKED_OUT':
            raise ValidationError({"clock_out": "Attendance record is already clocked out."})

        now_dt = cls._parse_datetime(custom_datetime, default_date=attendance.date) if custom_datetime else timezone.now()

        if attendance.clock_in and now_dt < attendance.clock_in:
            raise ValidationError({"clock_out": "Clock-out timestamp cannot be earlier than clock-in timestamp."})

        # Close any active running break
        open_breaks = attendance.breaks.filter(break_end__isnull=True)
        for b in open_breaks:
            b.break_end = now_dt
            b.save()

        old_values = {
            "status": attendance.status,
            "clock_out": None,
            "notes": attendance.notes
        }

        attendance.clock_out = now_dt
        attendance.check_out_time = now_dt.time()
        attendance.status = 'CLOCKED_OUT'
        if notes:
            attendance.notes = f"{attendance.notes}\n{notes}" if attendance.notes else notes
        attendance.updated_by = user
        attendance.save()

        cls._create_audit(
            user=user,
            action="STAFF_CLOCK_OUT",
            attendance=attendance,
            old_values=old_values,
            new_values={
                "clock_out": now_dt.isoformat(),
                "status": "CLOCKED_OUT",
                "actual_working_hours": attendance.actual_working_hours,
                "total_break_minutes": attendance.total_break_minutes,
                "variance_minutes": attendance.variance_minutes
            }
        )

        return attendance

    @classmethod
    @transaction.atomic
    def start_break(
        cls,
        daycare: Daycare,
        attendance_id: str,
        break_type: str = 'MEAL',
        is_paid: bool = False,
        user: Optional[User] = None,
        custom_datetime: Optional[Any] = None,
        notes: Optional[str] = None
    ) -> StaffBreak:
        attendance = get_object_or_404(StaffAttendance, pk=attendance_id, daycare=daycare)

        if attendance.status == 'CLOCKED_OUT' or attendance.clock_out is not None:
            raise ValidationError({"break": "Cannot start break on a closed attendance record."})

        # Check for open break
        if attendance.breaks.filter(break_end__isnull=True).exists():
            raise ValidationError({"break": "A break is already in progress for this shift."})

        now_dt = cls._parse_datetime(custom_datetime, default_date=attendance.date) if custom_datetime else timezone.now()

        if attendance.clock_in and now_dt < attendance.clock_in:
            raise ValidationError({"break": "Break start cannot be earlier than shift clock-in."})

        if isinstance(is_paid, str):
            is_paid_bool = is_paid.strip().lower() in ('true', '1', 'yes')
        else:
            is_paid_bool = bool(is_paid)

        staff_break = StaffBreak.objects.create(
            attendance=attendance,
            break_start=now_dt,
            break_type=break_type,
            is_paid=is_paid_bool,
            notes=notes
        )

        attendance.status = 'ON_BREAK'
        attendance.updated_by = user
        attendance.save()

        cls._create_audit(
            user=user,
            action="STAFF_START_BREAK",
            attendance=attendance,
            new_values={
                "break_id": str(staff_break.id),
                "break_type": break_type,
                "is_paid": is_paid,
                "break_start": now_dt.isoformat()
            }
        )

        return staff_break

    @classmethod
    @transaction.atomic
    def end_break(
        cls,
        daycare: Daycare,
        attendance_id: str,
        break_id: Optional[str] = None,
        user: Optional[User] = None,
        custom_datetime: Optional[Any] = None,
        notes: Optional[str] = None
    ) -> StaffBreak:
        attendance = get_object_or_404(StaffAttendance, pk=attendance_id, daycare=daycare)

        if break_id:
            staff_break = get_object_or_404(StaffBreak, pk=break_id, attendance=attendance)
        else:
            staff_break = attendance.breaks.filter(break_end__isnull=True).order_by('-break_start').first()

        if not staff_break or staff_break.break_end is not None:
            raise ValidationError({"break": "No active open break found to end."})

        now_dt = cls._parse_datetime(custom_datetime, default_date=attendance.date) if custom_datetime else timezone.now()

        if now_dt < staff_break.break_start:
            raise ValidationError({"break_end": "Break end cannot be earlier than break start."})

        staff_break.break_end = now_dt
        if notes:
            staff_break.notes = f"{staff_break.notes}\n{notes}" if staff_break.notes else notes
        staff_break.save()

        attendance.status = 'CLOCKED_IN'
        attendance.updated_by = user
        attendance.save()

        cls._create_audit(
            user=user,
            action="STAFF_END_BREAK",
            attendance=attendance,
            new_values={
                "break_id": str(staff_break.id),
                "break_end": now_dt.isoformat(),
                "duration_minutes": staff_break.duration_minutes
            }
        )

        return staff_break

    @classmethod
    @transaction.atomic
    def submit_timesheet(
        cls,
        daycare: Daycare,
        attendance_id: str,
        user: User,
        notes: Optional[str] = None
    ) -> StaffAttendance:
        attendance = get_object_or_404(StaffAttendance, pk=attendance_id, daycare=daycare)

        # Staff can only submit their own timesheet unless manager/admin
        is_admin = user.is_staff or user.is_superuser or getattr(user, 'role', '') in ('Daycare Admin', 'Owner', 'Director', 'Manager')
        if not is_admin and attendance.employee.user_id != user.id:
            raise PermissionDenied("You can only submit timesheets for your own profile.")

        old_status = attendance.approval_status
        attendance.approval_status = 'SUBMITTED'
        attendance.submitted_at = timezone.now()
        attendance.submitted_by = user
        if notes:
            attendance.notes = f"{attendance.notes}\nSubmission Note: {notes}" if attendance.notes else notes
        attendance.save()

        cls._create_audit(
            user=user,
            action="STAFF_TIMESHEET_SUBMITTED",
            attendance=attendance,
            old_values={"approval_status": old_status},
            new_values={
                "approval_status": "SUBMITTED",
                "submitted_at": attendance.submitted_at.isoformat(),
                "submitted_by": user.username,
                "actual_working_hours": attendance.actual_working_hours
            }
        )
        return attendance

    @classmethod
    @transaction.atomic
    def submit_batch_timesheets(
        cls,
        daycare: Daycare,
        attendance_ids: List[str],
        user: User
    ) -> List[StaffAttendance]:
        results = []
        for att_id in attendance_ids:
            att = cls.submit_timesheet(daycare, att_id, user)
            results.append(att)
        return results

    @classmethod
    @transaction.atomic
    def resubmit_timesheet(
        cls,
        daycare: Daycare,
        attendance_id: str,
        user: User,
        notes: Optional[str] = None
    ) -> StaffAttendance:
        attendance = get_object_or_404(StaffAttendance, pk=attendance_id, daycare=daycare)

        is_admin = user.is_staff or user.is_superuser or getattr(user, 'role', '') in ('Daycare Admin', 'Owner', 'Director', 'Manager')
        if not is_admin and attendance.employee.user_id != user.id:
            raise PermissionDenied("You can only resubmit timesheets for your own profile.")

        old_status = attendance.approval_status
        attendance.approval_status = 'SUBMITTED'
        attendance.submitted_at = timezone.now()
        attendance.submitted_by = user
        if notes:
            attendance.notes = f"{attendance.notes}\nResubmission Note: {notes}" if attendance.notes else notes
        attendance.save()

        cls._create_audit(
            user=user,
            action="STAFF_TIMESHEET_RESUBMITTED",
            attendance=attendance,
            old_values={"approval_status": old_status},
            new_values={
                "approval_status": "SUBMITTED",
                "submitted_at": attendance.submitted_at.isoformat(),
                "submitted_by": user.username
            }
        )
        return attendance

    @classmethod
    @transaction.atomic
    def approve_timesheet(
        cls,
        daycare: Daycare,
        attendance_id: str,
        approved_by: User,
        send_to_time_bank: bool = False,
        notes: Optional[str] = None,
        regular_hours_threshold: float = 8.0
    ) -> StaffAttendance:
        attendance = get_object_or_404(StaffAttendance, pk=attendance_id, daycare=daycare)

        # Self-approval prevention
        is_superuser = approved_by.is_superuser or (approved_by.is_staff and getattr(approved_by, 'role', '') == 'Super Admin')
        if not is_superuser:
            # Check if user is linked to this employee
            emp = cls.resolve_user_employee(daycare, approved_by)
            if attendance.employee.user_id == approved_by.id or (emp and str(attendance.employee.id) == str(emp.id)):
                raise PermissionDenied("Self-approval is not permitted. Timesheets must be approved by another manager or admin.")

        old_status = attendance.approval_status
        attendance.approval_status = 'APPROVED'
        attendance.approved_by = approved_by
        attendance.approved_at = timezone.now()
        if notes:
            attendance.notes = f"{attendance.notes}\nApproved Note: {notes}" if attendance.notes else notes
        attendance.save()

        # Calculate Overtime & Create / Update OvertimeRecord
        actual_hours = float(attendance.actual_working_hours)
        threshold = float(regular_hours_threshold)
        sched_hours = float(attendance.scheduled_hours) if attendance.scheduled_shift else 0.0
        overtime_hours = round(max(0.0, actual_hours - threshold), 2)

        ot_record, _ = OvertimeRecord.objects.get_or_create(
            daycare=daycare,
            employee=attendance.employee,
            date=attendance.date,
            defaults={
                'attendance': attendance,
                'scheduled_hours': sched_hours,
                'actual_hours': actual_hours,
                'regular_hours': threshold,
                'overtime_hours': overtime_hours,
                'source': 'attendance',
                'status': 'approved' if overtime_hours > 0 else 'pending',
                'approved_by': approved_by if overtime_hours > 0 else None,
                'approved_at': timezone.now() if overtime_hours > 0 else None
            }
        )
        ot_record.attendance = attendance
        ot_record.actual_hours = actual_hours
        ot_record.scheduled_hours = sched_hours
        ot_record.regular_hours = threshold
        ot_record.overtime_hours = overtime_hours
        ot_record.status = 'approved'
        ot_record.approved_by = approved_by
        ot_record.approved_at = timezone.now()
        ot_record.save()

        # Time Bank Integration if enabled
        if overtime_hours > 0:
            from daycare.services.scheduling import TimeBankService
            rule = TimeBankService.get_or_create_rules(daycare)
            if rule.is_enabled and (send_to_time_bank or not rule.require_approval):
                TimeBankService.add_transaction(
                    daycare=daycare,
                    employee=attendance.employee,
                    transaction_type='overtime_credit',
                    hours=overtime_hours,
                    reason=f"Approved overtime ({overtime_hours}h) from timesheet on {attendance.date}",
                    approved_by_user=approved_by,
                    overtime_record=ot_record
                )
                cls._create_audit(
                    user=approved_by,
                    action="STAFF_OVERTIME_TIMEBANK_CREDITED",
                    attendance=attendance,
                    new_values={
                        "employee": str(attendance.employee.id),
                        "date": str(attendance.date),
                        "overtime_hours": overtime_hours,
                        "time_bank_rule_enabled": True
                    }
                )

        cls._create_audit(
            user=approved_by,
            action="STAFF_TIMESHEET_APPROVED",
            attendance=attendance,
            old_values={"approval_status": old_status},
            new_values={
                "approval_status": "APPROVED",
                "approved_by": approved_by.username,
                "approved_at": attendance.approved_at.isoformat(),
                "actual_working_hours": actual_hours,
                "overtime_hours": overtime_hours,
                "sent_to_time_bank": send_to_time_bank
            }
        )

        return attendance

    @classmethod
    @transaction.atomic
    def reject_timesheet(
        cls,
        daycare: Daycare,
        attendance_id: str,
        user: User,
        rejection_reason: str,
        notes: Optional[str] = None
    ) -> StaffAttendance:
        if not rejection_reason or not str(rejection_reason).strip():
            raise ValidationError({"rejection_reason": "A valid rejection reason is mandatory."})

        attendance = get_object_or_404(StaffAttendance, pk=attendance_id, daycare=daycare)

        old_status = attendance.approval_status
        attendance.approval_status = 'REJECTED'
        attendance.rejection_reason = rejection_reason.strip()
        if notes:
            attendance.notes = f"{attendance.notes}\nRejection Note: {notes}" if attendance.notes else notes
        attendance.updated_by = user
        attendance.save()

        cls._create_audit(
            user=user,
            action="STAFF_TIMESHEET_REJECTED",
            attendance=attendance,
            old_values={"approval_status": old_status},
            new_values={
                "approval_status": "REJECTED",
                "rejection_reason": attendance.rejection_reason,
                "rejected_by": user.username
            }
        )
        return attendance

    @classmethod
    @transaction.atomic
    def request_timesheet_correction(
        cls,
        daycare: Daycare,
        attendance_id: str,
        user: User,
        correction_reason: str,
        notes: Optional[str] = None
    ) -> StaffAttendance:
        if not correction_reason or not str(correction_reason).strip():
            raise ValidationError({"correction_reason": "Correction instructions/reason are required."})

        attendance = get_object_or_404(StaffAttendance, pk=attendance_id, daycare=daycare)

        old_status = attendance.approval_status
        attendance.approval_status = 'CORRECTION_REQUIRED'
        attendance.correction_reason = correction_reason.strip()
        if notes:
            attendance.notes = f"{attendance.notes}\nCorrection Request: {notes}" if attendance.notes else notes
        attendance.updated_by = user
        attendance.save()

        cls._create_audit(
            user=user,
            action="STAFF_TIMESHEET_CORRECTION_REQUESTED",
            attendance=attendance,
            old_values={"approval_status": old_status},
            new_values={
                "approval_status": "CORRECTION_REQUIRED",
                "correction_reason": attendance.correction_reason,
                "requested_by": user.username
            }
        )
        return attendance

    @classmethod
    @transaction.atomic
    def correct_staff_attendance(
        cls,
        daycare: Daycare,
        attendance_id: str,
        user: User,
        correction_reason: str,
        clock_in: Optional[Any] = None,
        clock_out: Optional[Any] = None,
        status: Optional[str] = None,
        approval_status: Optional[str] = None,
        breaks_data: Optional[List[Dict]] = None,
        notes: Optional[str] = None
    ) -> StaffAttendance:
        if not correction_reason or not str(correction_reason).strip():
            raise ValidationError({"correction_reason": "A valid correction reason is mandatory."})

        attendance = get_object_or_404(StaffAttendance, pk=attendance_id, daycare=daycare)

        # Snapshot existing breaks
        existing_breaks = list(attendance.breaks.all())
        old_breaks_snapshot = [
            {
                "id": str(b.id),
                "break_start": b.break_start.isoformat() if b.break_start else None,
                "break_end": b.break_end.isoformat() if b.break_end else None,
                "break_type": b.break_type,
                "is_paid": b.is_paid,
                "duration_minutes": b.duration_minutes
            }
            for b in existing_breaks
        ]

        old_values = {
            "clock_in": attendance.clock_in.isoformat() if attendance.clock_in else None,
            "clock_out": attendance.clock_out.isoformat() if attendance.clock_out else None,
            "status": attendance.status,
            "approval_status": attendance.approval_status,
            "notes": attendance.notes,
            "actual_working_hours": attendance.actual_working_hours,
            "breaks": old_breaks_snapshot
        }

        if clock_in is not None:
            if clock_in in ('', False, None):
                attendance.clock_in = None
                attendance.check_in_time = None
            else:
                dt_in = cls._parse_datetime(clock_in, default_date=attendance.date)
                attendance.clock_in = dt_in
                attendance.check_in_time = dt_in.time()

        if clock_out is not None:
            if clock_out in ('', False, None):
                attendance.clock_out = None
                attendance.check_out_time = None
            else:
                dt_out = cls._parse_datetime(clock_out, default_date=attendance.date)
                attendance.clock_out = dt_out
                attendance.check_out_time = dt_out.time()

        if attendance.clock_in and attendance.clock_out:
            if attendance.clock_out < attendance.clock_in:
                raise ValidationError({"clock_out": "Clock-out timestamp cannot be earlier than clock-in timestamp."})

        if status:
            attendance.status = status.strip()
        if approval_status:
            attendance.approval_status = approval_status.strip()
        if notes is not None:
            attendance.notes = notes

        # Update / manage breaks if breaks_data provided
        if breaks_data is not None:
            for b_data in breaks_data:
                b_id = b_data.get('id')
                is_delete = b_data.get('delete', False)
                if b_id:
                    staff_brk = StaffBreak.objects.filter(pk=b_id, attendance=attendance).first()
                    if staff_brk:
                        if is_delete:
                            staff_brk.delete()
                            continue
                        if 'break_start' in b_data and b_data['break_start']:
                            staff_brk.break_start = cls._parse_datetime(b_data['break_start'], default_date=attendance.date)
                        if 'break_end' in b_data:
                            staff_brk.break_end = cls._parse_datetime(b_data['break_end'], default_date=attendance.date) if b_data['break_end'] else None
                        if 'break_type' in b_data:
                            staff_brk.break_type = b_data['break_type']
                        if 'is_paid' in b_data:
                            staff_brk.is_paid = bool(b_data['is_paid'])
                        if 'notes' in b_data:
                            staff_brk.notes = b_data['notes']
                        staff_brk.save()
                else:
                    if not is_delete and b_data.get('break_start'):
                        b_start = cls._parse_datetime(b_data['break_start'], default_date=attendance.date)
                        b_end = cls._parse_datetime(b_data['break_end'], default_date=attendance.date) if b_data.get('break_end') else None
                        StaffBreak.objects.create(
                            attendance=attendance,
                            break_start=b_start,
                            break_end=b_end,
                            break_type=b_data.get('break_type', 'MEAL'),
                            is_paid=bool(b_data.get('is_paid', False)),
                            notes=b_data.get('notes')
                        )

        attendance.is_corrected = True
        attendance.correction_reason = correction_reason.strip()
        attendance.corrected_by = user
        attendance.corrected_at = timezone.now()
        attendance.updated_by = user
        attendance.save()

        # Snapshot new breaks
        new_breaks_snapshot = [
            {
                "id": str(b.id),
                "break_start": b.break_start.isoformat() if b.break_start else None,
                "break_end": b.break_end.isoformat() if b.break_end else None,
                "break_type": b.break_type,
                "is_paid": b.is_paid,
                "duration_minutes": b.duration_minutes
            }
            for b in attendance.breaks.all()
        ]

        new_values = {
            "clock_in": attendance.clock_in.isoformat() if attendance.clock_in else None,
            "clock_out": attendance.clock_out.isoformat() if attendance.clock_out else None,
            "status": attendance.status,
            "approval_status": attendance.approval_status,
            "notes": attendance.notes,
            "actual_working_hours": attendance.actual_working_hours,
            "correction_reason": attendance.correction_reason,
            "breaks": new_breaks_snapshot
        }

        cls._create_audit(
            user=user,
            action="STAFF_ATTENDANCE_CORRECTED",
            attendance=attendance,
            old_values=old_values,
            new_values=new_values
        )

        return attendance

    @classmethod
    @transaction.atomic
    def correct_staff_break(
        cls,
        daycare: Daycare,
        attendance_id: str,
        break_id: str,
        user: User,
        correction_reason: str,
        break_start: Optional[Any] = None,
        break_end: Optional[Any] = None,
        break_type: Optional[str] = None,
        is_paid: Optional[bool] = None,
        notes: Optional[str] = None
    ) -> StaffBreak:
        if not correction_reason or not str(correction_reason).strip():
            raise ValidationError({"correction_reason": "A valid correction reason is mandatory."})

        attendance = get_object_or_404(StaffAttendance, pk=attendance_id, daycare=daycare)
        staff_break = get_object_or_404(StaffBreak, pk=break_id, attendance=attendance)

        old_values = {
            "break_start": staff_break.break_start.isoformat() if staff_break.break_start else None,
            "break_end": staff_break.break_end.isoformat() if staff_break.break_end else None,
            "break_type": staff_break.break_type,
            "is_paid": staff_break.is_paid,
            "duration_minutes": staff_break.duration_minutes,
            "notes": staff_break.notes
        }

        if break_start:
            staff_break.break_start = cls._parse_datetime(break_start, default_date=attendance.date)
        if break_end is not None:
            if break_end in ('', False, None):
                staff_break.break_end = None
            else:
                staff_break.break_end = cls._parse_datetime(break_end, default_date=attendance.date)
        if break_type:
            staff_break.break_type = break_type
        if is_paid is not None:
            staff_break.is_paid = bool(is_paid)
        if notes is not None:
            staff_break.notes = notes

        staff_break.save()

        attendance.is_corrected = True
        attendance.correction_reason = f"Break corrected: {correction_reason.strip()}"
        attendance.corrected_by = user
        attendance.corrected_at = timezone.now()
        attendance.save()

        new_values = {
            "break_start": staff_break.break_start.isoformat() if staff_break.break_start else None,
            "break_end": staff_break.break_end.isoformat() if staff_break.break_end else None,
            "break_type": staff_break.break_type,
            "is_paid": staff_break.is_paid,
            "duration_minutes": staff_break.duration_minutes,
            "notes": staff_break.notes,
            "correction_reason": correction_reason.strip()
        }

        cls._create_audit(
            user=user,
            action="STAFF_BREAK_CORRECTED",
            attendance=attendance,
            old_values=old_values,
            new_values=new_values
        )

        return staff_break

    @classmethod
    def get_staff_attendance_dashboard(
        cls,
        daycare: Daycare,
        target_date: Optional[date] = None,
        classroom_id: Optional[str] = None,
        branch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        d = target_date or timezone.now().date()
        now_time = timezone.localtime().time()

        # 1. Fetch schedules for date
        sched_qs = StaffSchedule.objects.filter(
            daycare=daycare,
            date=d,
            status__in=['scheduled', 'confirmed', 'completed']
        ).select_related('employee', 'classroom', 'branch')
        if classroom_id and classroom_id != 'all':
            sched_qs = sched_qs.filter(classroom_id=classroom_id)
        if branch_id and branch_id != 'all':
            sched_qs = sched_qs.filter(branch_id=branch_id)

        schedules = list(sched_qs)

        # 2. Fetch attendances for date
        att_qs = StaffAttendance.objects.filter(
            daycare=daycare,
            date=d
        ).select_related('employee', 'classroom', 'branch', 'scheduled_shift').prefetch_related('breaks')
        if classroom_id and classroom_id != 'all':
            att_qs = att_qs.filter(classroom_id=classroom_id)
        if branch_id and branch_id != 'all':
            att_qs = att_qs.filter(branch_id=branch_id)

        attendances = list(att_qs)
        att_by_emp = {a.employee_id: a for a in attendances}
        emp_ids_in_attendance = set(att_by_emp.keys())

        # Metrics
        total_scheduled = len(schedules)
        clocked_in_count = 0
        on_break_count = 0
        clocked_out_count = 0
        not_clocked_in_count = 0
        late_count = 0
        early_departure_count = 0
        missing_clock_out_count = 0

        roster_items = []
        processed_emp_ids = set()

        for s in schedules:
            emp = s.employee
            processed_emp_ids.add(emp.id)
            att = att_by_emp.get(emp.id)

            item = {
                "employee_id": str(emp.id),
                "employee_name": f"{emp.first_name} {emp.last_name}",
                "role": emp.role,
                "photo": emp.photo.url if hasattr(emp, 'photo') and emp.photo else None,
                "classroom": {
                    "id": str(s.classroom.id),
                    "name": s.classroom.room_name
                } if s.classroom else None,
                "scheduled_shift": {
                    "id": str(s.id),
                    "shift_start": str(s.shift_start) if s.shift_start else None,
                    "shift_end": str(s.shift_end) if s.shift_end else None,
                    "shift_type": s.shift_type,
                    "net_working_hours": s.net_working_hours
                },
                "attendance": None,
                "status_badge": "NOT_CLOCKED_IN",
                "is_late": False,
                "is_early_departure": False,
                "is_missing_clock_out": False
            }

            if att:
                active_break = att.breaks.filter(break_end__isnull=True).first()
                item["attendance"] = {
                    "id": str(att.id),
                    "clock_in": att.clock_in.isoformat() if att.clock_in else None,
                    "clock_out": att.clock_out.isoformat() if att.clock_out else None,
                    "status": att.status,
                    "approval_status": att.approval_status,
                    "actual_working_hours": att.actual_working_hours,
                    "total_break_minutes": att.total_break_minutes,
                    "active_break": {
                        "id": str(active_break.id),
                        "break_start": active_break.break_start.isoformat(),
                        "break_type": active_break.break_type,
                        "is_paid": active_break.is_paid
                    } if active_break else None
                }

                if att.status == 'CLOCKED_IN':
                    clocked_in_count += 1
                    item["status_badge"] = "WORKING"
                elif att.status == 'ON_BREAK':
                    on_break_count += 1
                    item["status_badge"] = "ON_BREAK"
                elif att.status == 'CLOCKED_OUT':
                    clocked_out_count += 1
                    item["status_badge"] = "COMPLETED"

                # Check Late Arrival
                if att.check_in_time and s.shift_start and att.check_in_time > s.shift_start:
                    late_count += 1
                    item["is_late"] = True

                # Check Early Departure
                if att.check_out_time and s.shift_end and att.check_out_time < s.shift_end:
                    early_departure_count += 1
                    item["is_early_departure"] = True

                # Check Missing Clock-out (Shift end was > 30 mins ago, still open)
                if not att.clock_out and s.shift_end:
                    if d < timezone.now().date() or (d == timezone.now().date() and now_time > s.shift_end):
                        missing_clock_out_count += 1
                        item["is_missing_clock_out"] = True
            else:
                not_clocked_in_count += 1
                if d == timezone.now().date() and s.shift_start and now_time > s.shift_start:
                    item["is_late"] = True
                    late_count += 1

            roster_items.append(item)

        # 3. Add unscheduled staff who clocked in
        for att in attendances:
            if att.employee_id not in processed_emp_ids:
                emp = att.employee
                active_break = att.breaks.filter(break_end__isnull=True).first()

                if att.status == 'CLOCKED_IN':
                    clocked_in_count += 1
                elif att.status == 'ON_BREAK':
                    on_break_count += 1
                elif att.status == 'CLOCKED_OUT':
                    clocked_out_count += 1

                roster_items.append({
                    "employee_id": str(emp.id),
                    "employee_name": f"{emp.first_name} {emp.last_name}",
                    "role": emp.role,
                    "photo": emp.photo.url if hasattr(emp, 'photo') and emp.photo else None,
                    "classroom": {
                        "id": str(att.classroom.id),
                        "name": att.classroom.room_name
                    } if att.classroom else None,
                    "scheduled_shift": None,
                    "attendance": {
                        "id": str(att.id),
                        "clock_in": att.clock_in.isoformat() if att.clock_in else None,
                        "clock_out": att.clock_out.isoformat() if att.clock_out else None,
                        "status": att.status,
                        "approval_status": att.approval_status,
                        "actual_working_hours": att.actual_working_hours,
                        "total_break_minutes": att.total_break_minutes,
                        "active_break": {
                            "id": str(active_break.id),
                            "break_start": active_break.break_start.isoformat(),
                            "break_type": active_break.break_type,
                            "is_paid": active_break.is_paid
                        } if active_break else None
                    },
                    "status_badge": "WORKING" if att.status == 'CLOCKED_IN' else ("ON_BREAK" if att.status == 'ON_BREAK' else "COMPLETED"),
                    "is_late": False,
                    "is_early_departure": False,
                    "is_missing_clock_out": False
                })

        return {
            "date": str(d),
            "summary": {
                "total_scheduled": total_scheduled,
                "clocked_in": clocked_in_count,
                "on_break": on_break_count,
                "clocked_out": clocked_out_count,
                "not_clocked_in": not_clocked_in_count,
                "late_arrivals": late_count,
                "early_departures": early_departure_count,
                "missing_clock_out": missing_clock_out_count
            },
            "roster": roster_items
        }

    @classmethod
    def get_timesheets_list(
        cls,
        daycare: Daycare,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        employee_id: Optional[str] = None,
        classroom_id: Optional[str] = None,
        status: Optional[str] = None,
        approval_status: Optional[str] = None,
        user: Optional[User] = None
    ) -> List[StaffAttendance]:
        qs = StaffAttendance.objects.filter(daycare=daycare)

        # Role security: if user is not staff/admin and linked to employee, only own records
        is_admin = user and (user.is_staff or getattr(user, 'role', '') in ('Daycare Admin', 'Owner', 'Director', 'Manager'))
        if not is_admin and user:
            emp = Employee.objects.filter(user=user, daycare=daycare).first()
            if emp:
                qs = qs.filter(employee=emp)
            else:
                return []

        if start_date:
            qs = qs.filter(date__gte=start_date)
        if end_date:
            qs = qs.filter(date__lte=end_date)
        if employee_id and employee_id != 'all':
            qs = qs.filter(employee_id=employee_id)
        if classroom_id and classroom_id != 'all':
            qs = qs.filter(classroom_id=classroom_id)
        if status and status != 'all':
            qs = qs.filter(status=status)
        if approval_status and approval_status != 'all':
            qs = qs.filter(approval_status=approval_status)

        return list(qs.select_related('employee', 'classroom', 'branch', 'scheduled_shift', 'approved_by', 'corrected_by').prefetch_related('breaks').order_by('-date', '-clock_in'))

    @classmethod
    def resolve_user_employee(cls, daycare: Daycare, user: Optional[User]) -> Optional[Employee]:
        if not user or not getattr(user, 'is_authenticated', False):
            return None
        # 1. Direct link on user
        emp = Employee.objects.filter(user=user, daycare=daycare).first()
        if emp:
            return emp
        # 2. Match by email in daycare
        if getattr(user, 'email', None):
            emp = Employee.objects.filter(email=user.email, daycare=daycare).first()
            if emp:
                if not emp.user:
                    emp.user = user
                    emp.save(update_fields=['user'])
                return emp
        # 3. For Daycare Admins / Directors / Staff without an employee record, auto-link or create
        is_admin = user.is_staff or user.is_superuser or getattr(user, 'role', '') in ('Daycare Admin', 'Owner', 'Director', 'Manager', 'Staff')
        if is_admin and daycare:
            first_name = user.first_name.strip() if user.first_name else user.username
            last_name = user.last_name.strip() if user.last_name else 'Admin'
            role = user.role if hasattr(user, 'role') and user.role else 'Daycare Admin'
            emp, _ = Employee.objects.get_or_create(
                user=user,
                daycare=daycare,
                defaults={
                    'first_name': first_name,
                    'last_name': last_name,
                    'email': user.email or f"{user.username}@daycare.local",
                    'role': role,
                    'status': 'active'
                }
            )
            return emp
        return None

    @classmethod
    def get_current_staff_status(cls, daycare: Daycare, user: User) -> Dict[str, Any]:
        emp = cls.resolve_user_employee(daycare, user)
        if not emp:
            return {
                "employee": None,
                "is_clocked_in": False,
                "is_on_break": False,
                "active_attendance": None
            }

        today = timezone.now().date()
        active_att = StaffAttendance.objects.filter(
            employee=emp,
            clock_in__isnull=False,
            clock_out__isnull=True
        ).order_by('-clock_in').first()

        active_break = None
        if active_att:
            active_break = active_att.breaks.filter(break_end__isnull=True).first()

        today_sched = StaffSchedule.objects.filter(
            employee=emp,
            date=today,
            status__in=['scheduled', 'confirmed', 'completed']
        ).first()

        return {
            "employee": {
                "id": str(emp.id),
                "name": f"{emp.first_name} {emp.last_name}",
                "role": emp.role
            },
            "is_clocked_in": active_att is not None and active_att.status == 'CLOCKED_IN',
            "is_on_break": active_att is not None and active_att.status == 'ON_BREAK',
            "active_attendance": {
                "id": str(active_att.id),
                "date": str(active_att.date),
                "clock_in": active_att.clock_in.isoformat() if active_att.clock_in else None,
                "status": active_att.status,
                "actual_working_hours": active_att.actual_working_hours,
                "total_break_minutes": active_att.total_break_minutes,
                "active_break": {
                    "id": str(active_break.id),
                    "break_start": active_break.break_start.isoformat(),
                    "break_type": active_break.break_type,
                    "is_paid": active_break.is_paid
                } if active_break else None
            } if active_att else None,
            "today_schedule": {
                "id": str(today_sched.id),
                "shift_start": str(today_sched.shift_start) if today_sched.shift_start else None,
                "shift_end": str(today_sched.shift_end) if today_sched.shift_end else None,
                "net_working_hours": today_sched.net_working_hours
            } if today_sched else None
        }

    @classmethod
    def get_overtime_report_data(
        cls,
        daycare: Daycare,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        employee_id: Optional[str] = None,
        classroom_id: Optional[str] = None,
        approval_status: Optional[str] = None,
        threshold: float = 8.0,
        user: Optional[User] = None
    ) -> Dict[str, Any]:
        att_qs = StaffAttendance.objects.filter(daycare=daycare)
        if start_date:
            att_qs = att_qs.filter(date__gte=start_date)
        if end_date:
            att_qs = att_qs.filter(date__lte=end_date)
        if employee_id and employee_id != 'all':
            att_qs = att_qs.filter(employee_id=employee_id)
        if classroom_id and classroom_id != 'all':
            att_qs = att_qs.filter(classroom_id=classroom_id)
        if approval_status and approval_status != 'all':
            att_qs = att_qs.filter(approval_status=approval_status)

        # Role restrictions: regular staff only sees their own report
        is_admin = user and (user.is_staff or user.is_superuser or getattr(user, 'role', '') in ('Daycare Admin', 'Owner', 'Director', 'Manager'))
        if not is_admin and user:
            emp = cls.resolve_user_employee(daycare, user)
            if emp:
                att_qs = att_qs.filter(employee=emp)
            else:
                return {
                    "summary": {
                        "total_shifts": 0,
                        "total_regular_hours": 0.0,
                        "total_overtime_hours": 0.0,
                        "total_worked_hours": 0.0,
                        "approved_overtime_hours": 0.0,
                        "pending_overtime_hours": 0.0,
                        "shifts_with_overtime": 0,
                        "threshold_applied": threshold
                    },
                    "employees": [],
                    "daily_logs": []
                }

        attendances = list(
            att_qs.select_related('employee', 'classroom', 'branch', 'scheduled_shift', 'approved_by')
                  .prefetch_related('breaks')
                  .order_by('-date', 'employee__last_name')
        )

        total_regular_hours = 0.0
        total_overtime_hours = 0.0
        total_worked_hours = 0.0
        approved_ot_hours = 0.0
        pending_ot_hours = 0.0
        shifts_with_ot_count = 0

        by_emp = {}
        daily_logs = []

        for att in attendances:
            actual = float(att.actual_working_hours)
            sched = float(att.scheduled_hours) if att.scheduled_shift else 0.0
            regular = min(actual, float(threshold))
            ot = round(max(0.0, actual - float(threshold)), 2)

            total_regular_hours += regular
            total_overtime_hours += ot
            total_worked_hours += actual

            if ot > 0:
                shifts_with_ot_count += 1
                if att.approval_status == 'APPROVED':
                    approved_ot_hours += ot
                else:
                    pending_ot_hours += ot

            emp_key = str(att.employee_id)
            if emp_key not in by_emp:
                by_emp[emp_key] = {
                    "employee_id": emp_key,
                    "employee_name": f"{att.employee.first_name} {att.employee.last_name}",
                    "employee_role": att.employee.role,
                    "employee_photo": att.employee.photo.url if hasattr(att.employee, 'photo') and att.employee.photo else None,
                    "total_shifts": 0,
                    "regular_hours": 0.0,
                    "overtime_hours": 0.0,
                    "total_hours": 0.0,
                    "shifts_with_overtime": 0
                }
            by_emp[emp_key]["total_shifts"] += 1
            by_emp[emp_key]["regular_hours"] = round(by_emp[emp_key]["regular_hours"] + regular, 2)
            by_emp[emp_key]["overtime_hours"] = round(by_emp[emp_key]["overtime_hours"] + ot, 2)
            by_emp[emp_key]["total_hours"] = round(by_emp[emp_key]["total_hours"] + actual, 2)
            if ot > 0:
                by_emp[emp_key]["shifts_with_overtime"] += 1

            daily_logs.append({
                "id": str(att.id),
                "employee_id": str(att.employee_id),
                "employee_name": f"{att.employee.first_name} {att.employee.last_name}",
                "date": str(att.date),
                "classroom_name": att.classroom.room_name if att.classroom else None,
                "scheduled_hours": sched,
                "actual_hours": actual,
                "regular_hours": regular,
                "overtime_hours": ot,
                "total_break_minutes": att.total_break_minutes,
                "status": att.status,
                "approval_status": att.approval_status,
                "submitted_at": att.submitted_at.isoformat() if att.submitted_at else None,
                "approved_by_name": f"{att.approved_by.first_name} {att.approved_by.last_name}".strip() if att.approved_by else None
            })

        return {
            "summary": {
                "total_shifts": len(attendances),
                "total_regular_hours": round(total_regular_hours, 2),
                "total_overtime_hours": round(total_overtime_hours, 2),
                "total_worked_hours": round(total_worked_hours, 2),
                "approved_overtime_hours": round(approved_ot_hours, 2),
                "pending_overtime_hours": round(pending_ot_hours, 2),
                "shifts_with_overtime": shifts_with_ot_count,
                "threshold_applied": threshold
            },
            "employees": list(by_emp.values()),
            "daily_logs": daily_logs
        }

    @classmethod
    def get_staff_attendance_report(
        cls,
        daycare: Daycare,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        employee_id: Optional[str] = None,
        classroom_id: Optional[str] = None,
        branch_id: Optional[str] = None
    ) -> dict:
        """
        Staff Attendance Report: Scheduled vs Actual Hours, Breaks, Overtime, Late Arrivals, Early Departures, Missing Clock-outs.
        """
        if not start_date:
            start_date = timezone.now().date() - timedelta(days=30)
        if not end_date:
            end_date = timezone.now().date()

        qs = StaffAttendance.objects.filter(
            daycare=daycare,
            date__gte=start_date,
            date__lte=end_date
        ).select_related('employee', 'classroom', 'branch', 'scheduled_shift').prefetch_related('breaks').order_by('-date')

        if employee_id and employee_id != 'all':
            qs = qs.filter(employee_id=employee_id)
        if classroom_id and classroom_id != 'all':
            qs = qs.filter(classroom_id=classroom_id)
        if branch_id and branch_id != 'all':
            qs = qs.filter(branch_id=branch_id)

        attendances = list(qs)
        now_time = timezone.now().time()
        is_today = (timezone.now().date() == end_date)

        by_emp = {}
        tot_sched = 0.0
        tot_actual = 0.0
        tot_breaks = 0.0
        tot_regular = 0.0
        tot_ot = 0.0
        tot_late = 0
        tot_early = 0
        tot_missing_out = 0

        detail_logs = []

        for att in attendances:
            emp_key = str(att.employee_id)
            if emp_key not in by_emp:
                by_emp[emp_key] = {
                    "employee_id": emp_key,
                    "employee_name": f"{att.employee.first_name} {att.employee.last_name}",
                    "employee_role": att.employee.job_title or att.employee.role,
                    "employee_photo": att.employee.photo.url if hasattr(att.employee.photo, 'url') and att.employee.photo else None,
                    "total_shifts": 0,
                    "scheduled_hours": 0.0,
                    "actual_hours": 0.0,
                    "break_hours": 0.0,
                    "regular_hours": 0.0,
                    "overtime_hours": 0.0,
                    "late_arrivals": 0,
                    "early_departures": 0,
                    "missing_clock_outs": 0,
                }

            actual = float(att.actual_working_hours)
            sched = float(att.scheduled_hours) if att.scheduled_hours else 0.0
            regular = min(actual, 8.0)
            ot = max(0.0, actual - 8.0)
            break_h = float(att.total_break_hours)

            is_missing = False
            if att.clock_in and not att.clock_out:
                if att.scheduled_shift and att.scheduled_shift.shift_end:
                    if not is_today or now_time > att.scheduled_shift.shift_end:
                        is_missing = True
                elif not is_today:
                    is_missing = True

            by_emp[emp_key]["total_shifts"] += 1
            by_emp[emp_key]["scheduled_hours"] = round(by_emp[emp_key]["scheduled_hours"] + sched, 2)
            by_emp[emp_key]["actual_hours"] = round(by_emp[emp_key]["actual_hours"] + actual, 2)
            by_emp[emp_key]["break_hours"] = round(by_emp[emp_key]["break_hours"] + break_h, 2)
            by_emp[emp_key]["regular_hours"] = round(by_emp[emp_key]["regular_hours"] + regular, 2)
            by_emp[emp_key]["overtime_hours"] = round(by_emp[emp_key]["overtime_hours"] + ot, 2)

            if att.is_late:
                by_emp[emp_key]["late_arrivals"] += 1
                tot_late += 1
            if att.is_early_departure:
                by_emp[emp_key]["early_departures"] += 1
                tot_early += 1
            if is_missing:
                by_emp[emp_key]["missing_clock_outs"] += 1
                tot_missing_out += 1

            tot_sched += sched
            tot_actual += actual
            tot_breaks += break_h
            tot_regular += regular
            tot_ot += ot

            detail_logs.append({
                "id": str(att.id),
                "employee_name": f"{att.employee.first_name} {att.employee.last_name}",
                "employee_role": att.employee.job_title or att.employee.role,
                "date": str(att.date),
                "classroom_name": att.classroom.room_name if att.classroom else 'General',
                "scheduled_hours": sched,
                "actual_hours": actual,
                "break_hours": break_h,
                "regular_hours": regular,
                "overtime_hours": ot,
                "is_late": att.is_late,
                "is_early_departure": att.is_early_departure,
                "is_missing_clock_out": is_missing,
                "status": att.status,
                "approval_status": att.approval_status
            })

        return {
            "summary": {
                "start_date": str(start_date),
                "end_date": str(end_date),
                "total_shifts": len(attendances),
                "total_scheduled_hours": round(tot_sched, 2),
                "total_actual_hours": round(tot_actual, 2),
                "total_break_hours": round(tot_breaks, 2),
                "total_regular_hours": round(tot_regular, 2),
                "total_overtime_hours": round(tot_ot, 2),
                "total_late_arrivals": tot_late,
                "total_early_departures": tot_early,
                "total_missing_clock_outs": tot_missing_out
            },
            "employees": list(by_emp.values()),
            "records": detail_logs
        }

    @classmethod
    def get_timesheet_report(
        cls,
        daycare: Daycare,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        employee_id: Optional[str] = None,
        classroom_id: Optional[str] = None,
        approval_status: Optional[str] = None,
        branch_id: Optional[str] = None
    ) -> dict:
        """
        Timesheet Report: Employee, Date, Scheduled Shift, Clock In, Clock Out, Breaks, Actual Hours, Overtime, Approval Status.
        """
        if not start_date:
            start_date = timezone.now().date() - timedelta(days=30)
        if not end_date:
            end_date = timezone.now().date()

        qs = StaffAttendance.objects.filter(
            daycare=daycare,
            date__gte=start_date,
            date__lte=end_date
        ).select_related('employee', 'classroom', 'branch', 'scheduled_shift', 'submitted_by', 'approved_by').prefetch_related('breaks').order_by('-date')

        if employee_id and employee_id != 'all':
            qs = qs.filter(employee_id=employee_id)
        if classroom_id and classroom_id != 'all':
            qs = qs.filter(classroom_id=classroom_id)
        if approval_status and approval_status != 'all':
            qs = qs.filter(approval_status=approval_status)
        if branch_id and branch_id != 'all':
            qs = qs.filter(branch_id=branch_id)

        attendances = list(qs)
        logs = []

        tot_actual = 0.0
        tot_ot = 0.0
        approved_count = 0
        submitted_count = 0
        rejected_count = 0
        correction_req_count = 0

        def _get_user_display(u):
            if not u:
                return None
            if hasattr(u, 'employee_profile') and u.employee_profile:
                return f"{u.employee_profile.first_name} {u.employee_profile.last_name}".strip()
            name = f"{u.first_name} {u.last_name}".strip()
            return name if name else u.username

        for att in attendances:
            actual = float(att.actual_working_hours)
            ot = max(0.0, actual - 8.0)
            tot_actual += actual
            tot_ot += ot

            if att.approval_status == 'APPROVED':
                approved_count += 1
            elif att.approval_status in ('SUBMITTED', 'PENDING'):
                submitted_count += 1
            elif att.approval_status == 'REJECTED':
                rejected_count += 1
            elif att.approval_status == 'CORRECTION_REQUIRED':
                correction_req_count += 1

            sched_str = "Unscheduled"
            if att.scheduled_shift:
                s_start = att.scheduled_shift.shift_start.strftime('%H:%M') if att.scheduled_shift.shift_start else '--:--'
                s_end = att.scheduled_shift.shift_end.strftime('%H:%M') if att.scheduled_shift.shift_end else '--:--'
                sched_str = f"{s_start}–{s_end} ({att.scheduled_shift.net_working_hours}h)"

            clock_in_str = att.clock_in.strftime('%H:%M') if att.clock_in else '--:--'
            clock_out_str = att.clock_out.strftime('%H:%M') if att.clock_out else '--:--'

            logs.append({
                "id": str(att.id),
                "employee_id": str(att.employee_id),
                "employee_name": f"{att.employee.first_name} {att.employee.last_name}",
                "employee_role": att.employee.job_title or att.employee.role,
                "date": str(att.date),
                "classroom_name": att.classroom.room_name if att.classroom else 'General Area',
                "scheduled": sched_str,
                "clock_in": clock_in_str,
                "clock_out": clock_out_str,
                "breaks_count": att.breaks.count(),
                "total_break_minutes": att.total_break_minutes,
                "actual_hours": round(actual, 2),
                "overtime_hours": round(ot, 2),
                "approval_status": att.approval_status,
                "is_corrected": att.is_corrected,
                "correction_reason": att.correction_reason,
                "submitted_by_name": _get_user_display(att.submitted_by),
                "approved_by_name": _get_user_display(att.approved_by),
            })

        return {
            "summary": {
                "start_date": str(start_date),
                "end_date": str(end_date),
                "total_shifts": len(attendances),
                "total_actual_hours": round(tot_actual, 2),
                "total_overtime_hours": round(tot_ot, 2),
                "approved_count": approved_count,
                "submitted_count": submitted_count,
                "rejected_count": rejected_count,
                "correction_required_count": correction_req_count
            },
            "records": logs
        }

    @classmethod
    def send_attendance_notification(
        cls,
        daycare: Daycare,
        notification_type: str,
        title: str,
        message: str,
        user: Optional[User] = None,
        employee: Optional[Employee] = None
    ) -> None:
        """
        Creates a StaffNotification while preventing duplicate spam (deduplicates within same day).
        """
        from core.models import StaffNotification

        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        existing = StaffNotification.objects.filter(
            daycare=daycare,
            notification_type=notification_type,
            title=title,
            created_at__gte=today_start
        )
        if user:
            existing = existing.filter(user=user)
        if employee:
            existing = existing.filter(employee=employee)

        if not existing.exists():
            StaffNotification.objects.create(
                daycare=daycare,
                user=user,
                employee=employee,
                notification_type=notification_type,
                title=title,
                message=message
            )


