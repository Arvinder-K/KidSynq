from datetime import date, datetime, time
from typing import Dict, Any, Optional, List
from django.utils import timezone
from django.db.models import Q, Count
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound

from core.models import (
    Daycare, Student, StudentPickup, StudentAttendance, ChildEnrollment,
    Classroom, ClassroomStudent, User, Employee, SafeArrivalDepartureEvent,
    AuditLog, StaffNotification
)
from daycare.services.digital_verification import DigitalVerificationService


class SafeArrivalService:
    """
    Module 12 Phase 3: Late Pickup, Daily Safe Arrival Dashboard, and Exception Management Service.
    Provides live metrics, roster tracking, exception management, and child pickup histories.
    """

    @classmethod
    def get_daily_safe_arrival_dashboard(
        cls,
        daycare: Daycare,
        target_date: Optional[date] = None,
        classroom_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        PART G - DAILY SAFE ARRIVAL DASHBOARD
        Calculates:
        - Children expected
        - Children checked in
        - Children not arrived
        - Children currently present
        - Children checked out
        - Late pickups
        - Unauthorized attempts
        - Live roster with real-time status and time indicators
        """
        if not target_date:
            target_date = timezone.now().date()

        # Base active children queryset for daycare
        children_qs = Student.objects.filter(
            daycare=daycare,
            status='Active',
            deleted_at__isnull=True
        ).select_related('daycare').prefetch_related('classroom_enrollments__classroom')

        if classroom_id:
            children_qs = children_qs.filter(classroom_enrollments__classroom_id=classroom_id, classroom_enrollments__status='Active')

        total_expected = children_qs.count()

        # Attendances for target date
        attendances = StudentAttendance.objects.filter(
            daycare=daycare,
            attendance_date=target_date
        ).select_related('student', 'classroom', 'pickup_person', 'received_by', 'released_by')

        if classroom_id:
            attendances = attendances.filter(student__classroom_enrollments__classroom_id=classroom_id, student__classroom_enrollments__status='Active')

        attendance_by_student = {att.student_id: att for att in attendances}

        # Safe Arrival & Departure events for target date
        events_today = SafeArrivalDepartureEvent.objects.filter(
            daycare=daycare,
            timestamp__date=target_date
        ).select_related('student', 'authorized_pickup', 'processed_by', 'attendance_record')

        if classroom_id:
            events_today = events_today.filter(student__classroom_enrollments__classroom_id=classroom_id, student__classroom_enrollments__status='Active')

        events_by_student = {}
        for ev in events_today:
            if ev.student_id not in events_by_student:
                events_by_student[ev.student_id] = []
            events_by_student[ev.student_id].append(ev)

        # Count metrics
        checked_in_count = 0
        present_count = 0
        checked_out_count = 0
        late_pickups_count = 0

        roster = []

        for child in children_qs:
            att = attendance_by_student.get(child.id)
            child_events = events_by_student.get(child.id, [])

            expected_time = DigitalVerificationService.get_expected_pickup_time(daycare, child, attendance_date=target_date)

            status_str = "NOT_ARRIVED"
            check_in_t = None
            check_out_t = None
            is_late_pickup = False
            late_duration_mins = 0
            pickup_person_name = None
            verification_method = None
            staff_handler = None

            if att:
                check_in_t = att.check_in_time
                check_out_t = att.check_out_time

                if check_in_t:
                    checked_in_count += 1
                    if check_out_t:
                        status_str = "CHECKED_OUT"
                        checked_out_count += 1
                    else:
                        status_str = "PRESENT"
                        present_count += 1
                elif att.attendance_status in ['ABSENT', 'EXCUSED_ABSENCE']:
                    status_str = att.attendance_status

                if att.pickup_person:
                    pickup_person_name = att.pickup_person.name
                if att.released_by:
                    staff_handler = f"{att.released_by.first_name} {att.released_by.last_name}".strip()

                if att.is_late or (check_out_t and check_out_t > expected_time):
                    is_late_pickup = True
                    _, late_duration_mins = DigitalVerificationService.calculate_late_duration(expected_time, check_out_t or expected_time)

            # Check latest event for extra info
            checkout_event = next((e for e in child_events if e.event_type == SafeArrivalDepartureEvent.EVENT_CHECK_OUT), None)
            if checkout_event:
                if checkout_event.is_late_pickup:
                    is_late_pickup = True
                    late_duration_mins = checkout_event.late_duration_minutes
                verification_method = checkout_event.verification_method
                if checkout_event.authorized_pickup and not pickup_person_name:
                    pickup_person_name = checkout_event.authorized_pickup.name
                if checkout_event.processed_by and not staff_handler:
                    staff_handler = f"{checkout_event.processed_by.first_name} {checkout_event.processed_by.last_name}".strip() or checkout_event.processed_by.username

            if is_late_pickup:
                late_pickups_count += 1

            # Get classroom name
            cr_assignment = child.classroom_enrollments.filter(status='Active').first()
            classroom_name = cr_assignment.classroom.room_name if cr_assignment and cr_assignment.classroom else None

            roster.append({
                "child_id": str(child.id),
                "name": f"{child.first_name} {child.last_name}",
                "first_name": child.first_name,
                "last_name": child.last_name,
                "admission_number": child.admission_number,
                "photo": child.photo,
                "classroom_name": classroom_name,
                "status": status_str,
                "check_in_time": check_in_t.strftime('%H:%M:%S') if check_in_t else None,
                "check_out_time": check_out_t.strftime('%H:%M:%S') if check_out_t else None,
                "expected_pickup_time": expected_time.strftime('%H:%M:%S') if expected_time else None,
                "is_late_pickup": is_late_pickup,
                "late_duration_minutes": late_duration_mins,
                "pickup_person_name": pickup_person_name,
                "verification_method": verification_method,
                "staff_handler": staff_handler
            })

        not_arrived_count = max(0, total_expected - checked_in_count)

        # Unauthorized attempts count for daycare on target date
        unauthorized_count = SafeArrivalDepartureEvent.objects.filter(
            daycare=daycare,
            timestamp__date=target_date
        ).filter(
            Q(event_type=SafeArrivalDepartureEvent.EVENT_UNAUTHORIZED_ATTEMPT) |
            Q(verification_status=SafeArrivalDepartureEvent.STATUS_FAILED)
        ).count()

        # Failed verifications count for daycare on target date
        failed_count = SafeArrivalDepartureEvent.objects.filter(
            daycare=daycare,
            timestamp__date=target_date,
            verification_status=SafeArrivalDepartureEvent.STATUS_FAILED
        ).count()

        # Recent events for feed (latest 15)
        recent_events = events_today.order_by('-timestamp', '-created_at')[:15]
        recent_events_data = []
        for ev in recent_events:
            proc_name = None
            if ev.processed_by:
                proc_name = f"{ev.processed_by.first_name} {ev.processed_by.last_name}".strip() or ev.processed_by.username
            
            p_name = ev.authorized_pickup.name if ev.authorized_pickup else ev.attempted_person_name

            recent_events_data.append({
                "id": str(ev.id),
                "child_id": str(ev.student_id),
                "child_name": f"{ev.student.first_name} {ev.student.last_name}" if ev.student else None,
                "event_type": ev.event_type,
                "verification_method": ev.verification_method,
                "verification_status": ev.verification_status,
                "timestamp": ev.timestamp.isoformat(),
                "time": ev.timestamp.strftime('%I:%M %p'),
                "is_late_pickup": ev.is_late_pickup,
                "late_duration_minutes": ev.late_duration_minutes,
                "pickup_person_name": p_name,
                "processed_by_name": proc_name,
                "failure_reason": ev.failure_reason
            })

        return {
            "date": target_date.isoformat(),
            "summary": {
                "children_expected": total_expected,
                "children_checked_in": checked_in_count,
                "children_not_arrived": not_arrived_count,
                "children_currently_present": present_count,
                "children_checked_out": checked_out_count,
                "late_pickups": late_pickups_count,
                "unauthorized_attempts": unauthorized_count,
                "failed_verifications": failed_count
            },
            "roster": roster,
            "recent_events": recent_events_data
        }

    @classmethod
    def get_child_pickup_history(
        cls,
        daycare: Daycare,
        child_id: str,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        PART F - PICKUP HISTORY
        Retrieves complete chronological pickup & arrival events for a child.
        """
        child = Student.objects.filter(id=child_id, daycare=daycare).first()
        if not child:
            raise NotFound("Child not found in this daycare.")

        events = SafeArrivalDepartureEvent.objects.filter(
            daycare=daycare,
            student=child
        ).select_related(
            'authorized_pickup', 'processed_by', 'attendance_record'
        ).order_by('-timestamp', '-created_at')[:limit]

        history_items = []
        for ev in events:
            proc_name = None
            if ev.processed_by:
                proc_name = f"{ev.processed_by.first_name} {ev.processed_by.last_name}".strip() or ev.processed_by.username

            pickup_p = None
            if ev.authorized_pickup:
                pickup_p = {
                    "id": str(ev.authorized_pickup.id),
                    "name": ev.authorized_pickup.name,
                    "relationship": ev.authorized_pickup.relationship,
                    "phone": ev.authorized_pickup.phone
                }

            history_items.append({
                "id": str(ev.id),
                "date": ev.timestamp.date().isoformat(),
                "time": ev.timestamp.strftime('%I:%M %p'),
                "iso_timestamp": ev.timestamp.isoformat(),
                "event_type": ev.event_type,
                "verification_method": ev.verification_method,
                "verification_status": ev.verification_status,
                "is_late_pickup": ev.is_late_pickup,
                "expected_pickup_time": ev.expected_pickup_time.strftime('%H:%M:%S') if ev.expected_pickup_time else None,
                "actual_checkout_time": ev.actual_checkout_time.strftime('%H:%M:%S') if ev.actual_checkout_time else None,
                "late_duration_minutes": ev.late_duration_minutes,
                "pickup_person": pickup_p,
                "attempted_person_name": ev.attempted_person_name or (ev.authorized_pickup.name if ev.authorized_pickup else None),
                "processed_by": {
                    "id": str(ev.processed_by.id) if ev.processed_by else None,
                    "name": proc_name or "System"
                },
                "failure_reason": ev.failure_reason,
                "has_signature": bool(ev.signature_data),
                "signature_data": ev.signature_data,
                "notes": ev.notes
            })

        return {
            "child": {
                "id": str(child.id),
                "name": f"{child.first_name} {child.last_name}",
                "admission_number": child.admission_number,
                "photo": child.photo,
                "status": child.status
            },
            "history": history_items,
            "total_events": len(history_items)
        }

    @classmethod
    def get_pickup_exceptions(
        cls,
        daycare: Daycare,
        target_date: Optional[date] = None,
        exception_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        PART H - EXCEPTION MANAGEMENT
        Authorized staff review for:
        - unauthorized attempts
        - late pickups
        - failed verification
        - cancelled pickup events
        Zero delete functionality is permitted for standard staff.
        """
        qs = SafeArrivalDepartureEvent.objects.filter(daycare=daycare)

        if target_date:
            qs = qs.filter(timestamp__date=target_date)

        if exception_type == 'unauthorized':
            qs = qs.filter(
                Q(event_type=SafeArrivalDepartureEvent.EVENT_UNAUTHORIZED_ATTEMPT) |
                Q(verification_status=SafeArrivalDepartureEvent.STATUS_FAILED)
            )
        elif exception_type == 'late':
            qs = qs.filter(
                Q(is_late_pickup=True) |
                Q(event_type=SafeArrivalDepartureEvent.EVENT_LATE_PICKUP) |
                Q(late_duration_minutes__gt=0)
            )
        elif exception_type == 'failed':
            qs = qs.filter(verification_status=SafeArrivalDepartureEvent.STATUS_FAILED)
        else:
            # All exceptions
            qs = qs.filter(
                Q(is_late_pickup=True) |
                Q(verification_status=SafeArrivalDepartureEvent.STATUS_FAILED) |
                Q(event_type__in=[
                    SafeArrivalDepartureEvent.EVENT_UNAUTHORIZED_ATTEMPT,
                    SafeArrivalDepartureEvent.EVENT_VERIFICATION_FAILED,
                    SafeArrivalDepartureEvent.EVENT_LATE_PICKUP
                ])
            )

        events = qs.select_related(
            'student', 'authorized_pickup', 'processed_by', 'attendance_record'
        ).order_by('-timestamp', '-created_at')[:limit]

        exceptions = []
        for ev in events:
            proc_name = None
            if ev.processed_by:
                proc_name = f"{ev.processed_by.first_name} {ev.processed_by.last_name}".strip() or ev.processed_by.username

            collector_name = ev.authorized_pickup.name if ev.authorized_pickup else ev.attempted_person_name

            category = "FAILED_VERIFICATION"
            if ev.event_type == SafeArrivalDepartureEvent.EVENT_UNAUTHORIZED_ATTEMPT or ev.verification_status == SafeArrivalDepartureEvent.STATUS_FAILED:
                category = "UNAUTHORIZED_ATTEMPT"
            elif ev.is_late_pickup or ev.late_duration_minutes > 0:
                category = "LATE_PICKUP"

            exceptions.append({
                "id": str(ev.id),
                "date": ev.timestamp.date().isoformat(),
                "time": ev.timestamp.strftime('%I:%M %p'),
                "iso_timestamp": ev.timestamp.isoformat(),
                "category": category,
                "event_type": ev.event_type,
                "verification_method": ev.verification_method,
                "verification_status": ev.verification_status,
                "child": {
                    "id": str(ev.student.id) if ev.student else None,
                    "name": f"{ev.student.first_name} {ev.student.last_name}" if ev.student else "Unknown Child",
                    "admission_number": getattr(ev.student, 'admission_number', '') if ev.student else ''
                },
                "collector_name": collector_name,
                "is_late_pickup": ev.is_late_pickup,
                "expected_pickup_time": ev.expected_pickup_time.strftime('%H:%M:%S') if ev.expected_pickup_time else None,
                "actual_checkout_time": ev.actual_checkout_time.strftime('%H:%M:%S') if ev.actual_checkout_time else None,
                "late_duration_minutes": ev.late_duration_minutes,
                "failure_reason": ev.failure_reason,
                "processed_by_name": proc_name or "System",
                "notes": ev.notes
            })

        return exceptions

    @classmethod
    def correct_attendance_pickup_record(
        cls,
        daycare: Daycare,
        attendance_id: str,
        user: User,
        corrections: Dict[str, Any],
        reason: str
    ) -> Dict[str, Any]:
        """
        PART C & D: ATTENDANCE & PICKUP CORRECTION
        Allows authorized staff to make necessary corrections to attendance and pickup records.
        Preserves complete historical audit trail in AuditLog and updates linked SafeArrivalDepartureEvent.
        """
        if not reason:
            raise ValidationError("Reason for correction is required.")

        att = StudentAttendance.objects.filter(id=attendance_id, daycare=daycare).first()
        if not att:
            raise NotFound("Attendance record not found.")

        old_values = {
            "check_in_time": att.check_in_time.strftime('%H:%M:%S') if att.check_in_time else None,
            "check_out_time": att.check_out_time.strftime('%H:%M:%S') if att.check_out_time else None,
            "pickup_person_id": str(att.pickup_person_id) if att.pickup_person_id else None,
            "attendance_status": att.attendance_status,
            "notes": att.notes
        }

        new_values = {}

        def _parse_correction_time(val):
            if not val:
                return None
            if isinstance(val, time):
                return val
            val_s = str(val).strip()
            for fmt in ('%H:%M:%S', '%H:%M', '%I:%M %p', '%I:%M%p'):
                try:
                    return datetime.strptime(val_s, fmt).time()
                except ValueError:
                    pass
            return None

        if 'check_in_time' in corrections:
            cin_val = corrections['check_in_time']
            parsed_cin = _parse_correction_time(cin_val)
            if parsed_cin is not None:
                att.check_in_time = parsed_cin
            new_values['check_in_time'] = att.check_in_time.strftime('%H:%M:%S') if att.check_in_time else None

        if 'check_out_time' in corrections:
            cout_val = corrections['check_out_time']
            parsed_cout = _parse_correction_time(cout_val)
            if parsed_cout is not None:
                att.check_out_time = parsed_cout
            new_values['check_out_time'] = att.check_out_time.strftime('%H:%M:%S') if att.check_out_time else None

        if 'pickup_person_id' in corrections:
            p_id = corrections['pickup_person_id']
            if p_id:
                pickup_obj = StudentPickup.objects.filter(id=p_id, student=att.student).first()
                if pickup_obj:
                    att.pickup_person = pickup_obj
                    new_values['pickup_person_id'] = str(pickup_obj.id)
            else:
                att.pickup_person = None
                new_values['pickup_person_id'] = None

        if 'notes' in corrections:
            att.notes = f"{att.notes or ''}\n[CORRECTION {timezone.now().strftime('%Y-%m-%d %H:%M')} by {user.username}]: {reason}".strip()
            new_values['notes'] = att.notes

        att.save()

        # Update linked SafeArrivalDepartureEvent if exists
        linked_event = SafeArrivalDepartureEvent.objects.filter(attendance_record=att).first()
        if linked_event:
            if 'check_out_time' in corrections and att.check_out_time:
                linked_event.actual_checkout_time = att.check_out_time
                if linked_event.expected_pickup_time:
                    is_late, late_mins = DigitalVerificationService.calculate_late_duration(
                        linked_event.expected_pickup_time,
                        att.check_out_time
                    )
                    linked_event.is_late_pickup = is_late
                    linked_event.late_duration_minutes = late_mins
            if 'pickup_person_id' in corrections and att.pickup_person:
                linked_event.authorized_pickup = att.pickup_person
            linked_event.notes = f"{linked_event.notes or ''}\n[CORRECTION]: {reason}".strip()
            linked_event.save()

        # AuditLog record
        AuditLog.objects.create(
            user=user,
            user_type=getattr(user, 'role', 'Staff') or 'Staff',
            action="Corrected Attendance & Pickup Record",
            module="Safe Arrival Departure",
            entity_type="StudentAttendance",
            entity_id=str(att.id),
            old_values=old_values,
            new_values={**new_values, "reason": reason}
        )

        return {
            "success": True,
            "attendance_id": str(att.id),
            "old_values": old_values,
            "new_values": new_values,
            "reason": reason
        }

