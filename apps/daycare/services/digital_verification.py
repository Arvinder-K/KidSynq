import secrets
from datetime import date, time, datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from django.utils import timezone
from django.db.models import Q
from django.contrib.auth.hashers import make_password, check_password
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound

from core.models import (
    Daycare, Student, StudentPickup, StudentAttendance, ChildEnrollment,
    Employee, User, AuditLog, PickupQRToken, PickupSecurityPIN,
    SafeArrivalDepartureEvent, FamilyChild, FamilyGuardian, StaffNotification
)
from daycare.services.pickup import PickupVerificationService
from daycare.services.scheduling import NotificationService
from daycare.services.family_notifications import FamilyNotificationService


class DigitalVerificationService:
    """
    Module 12 Phase 2: QR, PIN & Digital Verification Service.
    Handles high-entropy token generation, PIN hashing and rate-limited lockout protection,
    digital signature recording, attendance integration, and immutable event auditing.
    """

    # --- QR Identification ---

    @classmethod
    def generate_qr_token(
        cls,
        pickup_person: StudentPickup,
        user: Optional[User] = None,
        expires_in_days: int = 30
    ) -> PickupQRToken:
        """
        Generates a secure, high-entropy random token for an authorized pickup person.
        Deactivates any previous active token for this pickup person.
        The raw token string contains NO sensitive child/person PII directly.
        """
        # Deactivate older active tokens
        PickupQRToken.objects.filter(
            pickup_person=pickup_person,
            is_active=True
        ).update(is_active=False)

        # Generate cryptographically secure random token (43+ urlsafe chars)
        token_str = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(days=expires_in_days) if expires_in_days > 0 else None

        daycare = pickup_person.daycare or (pickup_person.student.daycare if pickup_person.student else None)

        token_obj = PickupQRToken.objects.create(
            daycare=daycare,
            pickup_person=pickup_person,
            token=token_str,
            is_active=True,
            expires_at=expires_at
        )

        # AuditLog
        AuditLog.objects.create(
            user=user if user and user.is_authenticated else None,
            user_type=getattr(user, 'role', 'Staff') or 'Staff' if user else 'System',
            action="Generated Pickup QR Token",
            module="Safe Arrival Departure",
            entity_type="PickupQRToken",
            entity_id=str(token_obj.id),
            new_values={
                "pickup_person_id": str(pickup_person.id),
                "pickup_name": pickup_person.name,
                "token_id": str(token_obj.id),
                "expires_at": str(expires_at) if expires_at else "Never"
            }
        )

        return token_obj

    @classmethod
    def revoke_qr_token(
        cls,
        token_id_or_obj,
        user: Optional[User] = None,
        reason: Optional[str] = None
    ) -> PickupQRToken:
        """
        Revokes an active QR token.
        """
        if isinstance(token_id_or_obj, PickupQRToken):
            token_obj = token_id_or_obj
        else:
            token_obj = PickupQRToken.objects.get(id=token_id_or_obj)

        token_obj.is_active = False
        token_obj.revoked_at = timezone.now()
        token_obj.revoked_by = user if user and user.is_authenticated else None
        token_obj.save(update_fields=['is_active', 'revoked_at', 'revoked_by'])

        # AuditLog
        AuditLog.objects.create(
            user=user if user and user.is_authenticated else None,
            user_type=getattr(user, 'role', 'Staff') or 'Staff' if user else 'System',
            action="Revoked Pickup QR Token",
            module="Safe Arrival Departure",
            entity_type="PickupQRToken",
            entity_id=str(token_obj.id),
            new_values={
                "pickup_person_id": str(token_obj.pickup_person_id),
                "pickup_name": token_obj.pickup_person.name if token_obj.pickup_person else None,
                "revoked_at": str(token_obj.revoked_at),
                "reason": reason or "Revoked by staff"
            }
        )

        return token_obj

    @classmethod
    def scan_and_resolve_qr(
        cls,
        daycare: Daycare,
        token_str: str,
        user: Optional[User] = None
    ) -> Dict[str, Any]:
        """
        Scans a QR token and resolves the authorized pickup person and eligible children.
        Validates token validity, expiration, revocation, and daycare tenant isolation.
        """
        if not token_str:
            raise ValidationError("QR token is required.")

        try:
            token_obj = PickupQRToken.objects.select_related(
                'pickup_person', 'pickup_person__student', 'daycare'
            ).get(token=token_str)
        except PickupQRToken.DoesNotExist:
            cls._record_failed_event(
                daycare=daycare,
                method=SafeArrivalDepartureEvent.METHOD_QR,
                reason="Invalid or unrecognized QR token.",
                user=user
            )
            raise ValidationError("Invalid or unrecognized QR token.")

        # Tenant isolation
        if daycare and token_obj.daycare_id != daycare.id:
            cls._record_failed_event(
                daycare=daycare,
                method=SafeArrivalDepartureEvent.METHOD_QR,
                reason="QR token belongs to a different daycare.",
                user=user
            )
            raise PermissionDenied("QR token does not belong to this daycare.")

        # Revocation check
        if token_obj.revoked_at is not None or not token_obj.is_active:
            cls._record_failed_event(
                daycare=daycare,
                method=SafeArrivalDepartureEvent.METHOD_QR,
                pickup_person=token_obj.pickup_person,
                reason="QR token has been revoked.",
                user=user
            )
            raise ValidationError("This QR token has been revoked.")

        # Expiration check
        if token_obj.expires_at and token_obj.expires_at < timezone.now():
            cls._record_failed_event(
                daycare=daycare,
                method=SafeArrivalDepartureEvent.METHOD_QR,
                pickup_person=token_obj.pickup_person,
                reason=f"QR token expired on {token_obj.expires_at.strftime('%Y-%m-%d %H:%M')}.",
                user=user
            )
            raise ValidationError("This QR token has expired.")

        pickup_person = token_obj.pickup_person
        if not pickup_person:
            raise ValidationError("No authorized pickup person linked to this QR token.")

        # Check pickup authorization status
        today = timezone.now().date()
        auth_status = (pickup_person.authorization_status or 'ACTIVE').upper()
        if auth_status != StudentPickup.STATUS_ACTIVE:
            cls._record_failed_event(
                daycare=daycare,
                method=SafeArrivalDepartureEvent.METHOD_QR,
                pickup_person=pickup_person,
                reason=f"Pickup authorization is inactive (status: {auth_status}).",
                user=user
            )
            raise ValidationError(f"Pickup authorization is not active (status: {auth_status}).")

        if pickup_person.valid_until and pickup_person.valid_until < today:
            cls._record_failed_event(
                daycare=daycare,
                method=SafeArrivalDepartureEvent.METHOD_QR,
                pickup_person=pickup_person,
                reason=f"Pickup authorization expired on {pickup_person.valid_until}.",
                user=user
            )
            raise ValidationError(f"Pickup authorization expired on {pickup_person.valid_until}.")

        # Retrieve authorized children
        children = []
        primary_student = pickup_person.student
        if primary_student and primary_student.daycare_id == daycare.id and primary_student.status == 'Active':
            children.append(primary_student)

        # Check family associations for other children in same family
        if pickup_person.family:
            family_student_ids = FamilyChild.objects.filter(
                family=pickup_person.family
            ).values_list('student_id', flat=True)
            for s in Student.objects.filter(id__in=family_student_ids, daycare=daycare, status='Active'):
                if s.id != (primary_student.id if primary_student else None):
                    children.append(s)

        children_data = []
        for c in children:
            # Check today's attendance status
            today_att = StudentAttendance.objects.filter(
                student=c,
                attendance_date=today
            ).first()

            is_checked_in = bool(today_att and today_att.check_in_time and not today_att.check_out_time)
            is_checked_out = bool(today_att and today_att.check_out_time)

            children_data.append({
                "id": str(c.id),
                "first_name": c.first_name,
                "last_name": c.last_name,
                "admission_number": c.admission_number,
                "photo": c.photo,
                "classroom_name": c.classroom_enrollments.filter(status='Active').first().classroom.room_name if c.classroom_enrollments.filter(status='Active').exists() else None,
                "is_checked_in": is_checked_in,
                "is_checked_out": is_checked_out,
                "check_in_time": today_att.check_in_time.strftime('%H:%M:%S') if today_att and today_att.check_in_time else None,
                "check_out_time": today_att.check_out_time.strftime('%H:%M:%S') if today_att and today_att.check_out_time else None,
            })

        return {
            "token_id": str(token_obj.id),
            "is_valid": True,
            "pickup_person": {
                "id": str(pickup_person.id),
                "name": pickup_person.name,
                "relationship": pickup_person.relationship,
                "phone": pickup_person.phone,
                "email": pickup_person.email,
                "photo_url": f"/api/daycare/authorized-pickups/{pickup_person.id}/photo/" if pickup_person.photo else None,
                "authorization_status": pickup_person.authorization_status,
                "valid_until": str(pickup_person.valid_until) if pickup_person.valid_until else None,
            },
            "children": children_data
        }

    # --- PIN Verification ---

    @classmethod
    def set_pickup_pin(
        cls,
        pickup_person: StudentPickup,
        raw_pin: str,
        user: Optional[User] = None
    ) -> PickupSecurityPIN:
        """
        Securely hashes and sets a 4-6 digit numeric PIN for an authorized pickup person.
        Never stores the raw PIN. Resets any previous lockouts.
        """
        if not raw_pin or not raw_pin.isdigit() or len(raw_pin) < 4 or len(raw_pin) > 6:
            raise ValidationError("PIN must be between 4 and 6 numeric digits.")

        daycare = pickup_person.daycare or (pickup_person.student.daycare if pickup_person.student else None)
        pin_hash = make_password(raw_pin)

        pin_obj, created = PickupSecurityPIN.objects.get_or_create(
            pickup_person=pickup_person,
            defaults={
                "daycare": daycare,
                "pin_hash": pin_hash,
                "is_active": True,
                "failed_attempts_count": 0,
                "locked_until": None
            }
        )
        if not created:
            pin_obj.pin_hash = pin_hash
            pin_obj.daycare = daycare
            pin_obj.is_active = True
            pin_obj.failed_attempts_count = 0
            pin_obj.locked_until = None
            pin_obj.save()

        # AuditLog
        AuditLog.objects.create(
            user=user if user and user.is_authenticated else None,
            user_type=getattr(user, 'role', 'Staff') or 'Staff' if user else 'System',
            action="Set Pickup Security PIN",
            module="Safe Arrival Departure",
            entity_type="PickupSecurityPIN",
            entity_id=str(pin_obj.id),
            new_values={
                "pickup_person_id": str(pickup_person.id),
                "pickup_name": pickup_person.name,
                "action": "PIN Created/Reset"
            }
        )

        return pin_obj

    @classmethod
    def verify_pickup_pin(
        cls,
        pickup_person: StudentPickup,
        raw_pin: str,
        daycare: Optional[Daycare] = None,
        user: Optional[User] = None
    ) -> Tuple[bool, str]:
        """
        Verifies an entered PIN against the hashed PIN.
        Implements rate-limiting: 5 failed attempts trigger a 15-minute temporary lockout.
        """
        if not raw_pin:
            return False, "PIN is required."

        try:
            pin_obj = PickupSecurityPIN.objects.get(pickup_person=pickup_person)
        except PickupSecurityPIN.DoesNotExist:
            return False, "No PIN has been configured for this pickup person."

        if not pin_obj.is_active:
            return False, "PIN authentication is disabled for this pickup person."

        # Lockout check
        if pin_obj.is_locked:
            minutes_left = int((pin_obj.locked_until - timezone.now()).total_seconds() / 60) + 1
            return False, f"Account is locked due to too many failed attempts. Try again in {minutes_left} minute(s)."

        # Validate hash
        is_valid = check_password(raw_pin, pin_obj.pin_hash)

        if not is_valid:
            pin_obj.failed_attempts_count += 1
            if pin_obj.failed_attempts_count >= 5:
                pin_obj.locked_until = timezone.now() + timedelta(minutes=15)
                pin_obj.save(update_fields=['failed_attempts_count', 'locked_until', 'updated_at'])
                cls._record_failed_event(
                    daycare=daycare or pickup_person.daycare,
                    method=SafeArrivalDepartureEvent.METHOD_PIN,
                    pickup_person=pickup_person,
                    reason="Account locked: 5 consecutive invalid PIN attempts.",
                    user=user
                )
                return False, "Maximum PIN attempts exceeded. Account is locked for 15 minutes."
            else:
                pin_obj.save(update_fields=['failed_attempts_count', 'updated_at'])
                attempts_left = 5 - pin_obj.failed_attempts_count
                cls._record_failed_event(
                    daycare=daycare or pickup_person.daycare,
                    method=SafeArrivalDepartureEvent.METHOD_PIN,
                    pickup_person=pickup_person,
                    reason=f"Invalid PIN entered ({attempts_left} attempts remaining).",
                    user=user
                )
                return False, f"Invalid PIN. {attempts_left} attempt(s) remaining before lockout."

        # Successful verification -> Reset failed attempts
        if pin_obj.failed_attempts_count > 0 or pin_obj.locked_until is not None:
            pin_obj.failed_attempts_count = 0
            pin_obj.locked_until = None
            pin_obj.save(update_fields=['failed_attempts_count', 'locked_until', 'updated_at'])

        return True, "PIN verified successfully."

    # --- Check-In & Check-Out Workflows ---

    @classmethod
    def process_qr_checkin(
        cls,
        daycare: Daycare,
        token_str: str,
        child_id: str,
        staff_user: Optional[User] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        PART B: QR-based Child Arrival (Check-In).
        Workflow: Scan QR -> Identify authorized context -> Verify child -> Update Attendance -> Record Event.
        """
        scan_res = cls.scan_and_resolve_qr(daycare=daycare, token_str=token_str, user=staff_user)
        pickup_data = scan_res["pickup_person"]
        pickup_person = StudentPickup.objects.get(id=pickup_data["id"])

        child = Student.objects.filter(id=child_id, daycare=daycare, status='Active').first()
        if not child:
            cls._record_failed_event(
                daycare=daycare,
                method=SafeArrivalDepartureEvent.METHOD_QR,
                pickup_person=pickup_person,
                reason="Child does not exist or is inactive.",
                user=staff_user
            )
            raise ValidationError("Child does not exist or is inactive.")

        # Verify child is authorized for this pickup person
        eligible_child_ids = [c["id"] for c in scan_res["children"]]
        if str(child.id) not in eligible_child_ids:
            cls._record_failed_event(
                daycare=daycare,
                student=child,
                method=SafeArrivalDepartureEvent.METHOD_QR,
                pickup_person=pickup_person,
                reason="Pickup person is not authorized for this child.",
                user=staff_user
            )
            raise ValidationError("Pickup person is not authorized for this child.")

        # Update or create Attendance
        today = timezone.now().date()
        now_time = timezone.now().time()
        staff_emp = Employee.objects.filter(user=staff_user, daycare=daycare).first() if staff_user else None

        attendance, created = StudentAttendance.objects.get_or_create(
            student=child,
            attendance_date=today,
            defaults={
                "daycare": daycare,
                "check_in_time": now_time,
                "arrival_type": "QR",
                "attendance_status": "PRESENT",
                "received_by": staff_emp,
                "notes": notes or ""
            }
        )

        if not created and not attendance.check_in_time:
            attendance.check_in_time = now_time
            attendance.arrival_type = "QR"
            attendance.attendance_status = "PRESENT"
            if staff_emp:
                attendance.received_by = staff_emp
            if notes:
                attendance.notes = f"{attendance.notes}\n{notes}".strip()
            attendance.save()

        # Create SafeArrivalDepartureEvent
        event = SafeArrivalDepartureEvent.objects.create(
            daycare=daycare,
            student=child,
            authorized_pickup=pickup_person,
            attendance_record=attendance,
            event_type=SafeArrivalDepartureEvent.EVENT_CHECK_IN,
            verification_method=SafeArrivalDepartureEvent.METHOD_QR,
            verification_status=SafeArrivalDepartureEvent.STATUS_SUCCESS,
            processed_by=staff_user if staff_user and staff_user.is_authenticated else None,
            notes=notes or ""
        )

        # AuditLog
        AuditLog.objects.create(
            user=staff_user if staff_user and staff_user.is_authenticated else None,
            user_type=getattr(staff_user, 'role', 'Staff') or 'Staff' if staff_user else 'System',
            action="QR Child Arrival Check-In",
            module="Safe Arrival Departure",
            entity_type="SafeArrivalDepartureEvent",
            entity_id=str(event.id),
            new_values={
                "child_id": str(child.id),
                "child_name": f"{child.first_name} {child.last_name}",
                "pickup_person_id": str(pickup_person.id),
                "pickup_name": pickup_person.name,
                "check_in_time": now_time.strftime('%H:%M:%S'),
                "method": "QR"
            }
        )

        # Dispatch family notification
        try:
            FamilyNotificationService.notify_student_family(
                student=child,
                notification_type=FamilyNotificationService.NOTIFICATION_CHILD_CHECKED_IN,
                title="Child Arrival Recorded",
                message=f"{child.first_name} {child.last_name} has arrived and was checked in at {now_time.strftime('%I:%M %p')}.",
                sender=staff_user
            )
        except Exception:
            pass

        return {
            "success": True,
            "event_id": str(event.id),
            "event_type": "CHECK_IN",
            "verification_method": "QR",
            "child": {
                "id": str(child.id),
                "name": f"{child.first_name} {child.last_name}"
            },
            "pickup_person": {
                "id": str(pickup_person.id),
                "name": pickup_person.name,
                "relationship": pickup_person.relationship
            },
            "timestamp": event.timestamp.isoformat(),
            "check_in_time": now_time.strftime('%H:%M:%S')
        }

    @classmethod
    def get_expected_pickup_time(
        cls,
        daycare: Optional[Daycare],
        child: Optional[Student],
        attendance_date: Optional[date] = None
    ) -> time:
        """
        PART A - EXPECTED PICKUP TIME
        Support configurable expected pickup time with zero duplicate scheduling.
        Resolution hierarchy:
        1. Child today's attendance record expected_departure_time (if set).
        2. Child-specific configured expected pickup time (if set).
        3. Daycare closing_time.
        4. DaycareSettings default_operating_end.
        5. Default fallback: 17:30:00 (5:30 PM).
        """
        if not attendance_date:
            attendance_date = timezone.now().date()

        if child:
            # 1. Check StudentAttendance for today
            att = StudentAttendance.objects.filter(student=child, attendance_date=attendance_date).first()
            if att and att.expected_departure_time:
                return att.expected_departure_time

            # 2. Check child direct property if present
            if hasattr(child, 'expected_pickup_time') and child.expected_pickup_time:
                return child.expected_pickup_time

        if daycare:
            if hasattr(daycare, 'closing_time') and daycare.closing_time:
                return daycare.closing_time
            if hasattr(daycare, 'settings') and daycare.settings and daycare.settings.default_operating_end:
                return daycare.settings.default_operating_end

        return time(17, 30)

    @classmethod
    def calculate_late_duration(
        cls,
        expected_time: time,
        actual_time: time
    ) -> Tuple[bool, int]:
        """
        Calculates whether departure is late and returns (is_late: bool, late_duration_minutes: int).
        """
        if not expected_time or not actual_time:
            return False, 0

        exp_mins = expected_time.hour * 60 + expected_time.minute
        act_mins = actual_time.hour * 60 + actual_time.minute

        if act_mins > exp_mins:
            return True, (act_mins - exp_mins)
        return False, 0

    @classmethod
    def process_qr_checkout(
        cls,
        daycare: Daycare,
        token_str: str,
        child_id: str,
        staff_user: Optional[User] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        PART C: QR-based Child Departure (Check-Out).
        Workflow: Scan QR -> Verify authorization -> Select child -> Record checkout -> Record event.
        Calculates expected pickup time vs actual checkout time, recording late pickup metrics.
        """
        scan_res = cls.scan_and_resolve_qr(daycare=daycare, token_str=token_str, user=staff_user)
        pickup_data = scan_res["pickup_person"]
        pickup_person = StudentPickup.objects.get(id=pickup_data["id"])

        # Rigorous verification check
        verify_res = PickupVerificationService.verify(
            daycare=daycare,
            child_id=child_id,
            pickup_person_id=str(pickup_person.id),
            user=staff_user,
            notes=notes
        )

        child = Student.objects.filter(id=child_id, daycare=daycare).first()

        if not verify_res["is_authorized"]:
            cls._record_failed_event(
                daycare=daycare,
                student=child,
                method=SafeArrivalDepartureEvent.METHOD_QR,
                pickup_person=pickup_person,
                reason=verify_res["reason"],
                user=staff_user,
                is_unauthorized=True
            )
            raise ValidationError(f"Pickup unauthorized: {verify_res['reason']}")

        # Determine expected pickup time and check late pickup
        today = timezone.now().date()
        now_time = timezone.now().time()
        expected_pickup_time = cls.get_expected_pickup_time(daycare, child, attendance_date=today)
        is_late, late_duration_mins = cls.calculate_late_duration(expected_pickup_time, now_time)

        staff_emp = Employee.objects.filter(user=staff_user, daycare=daycare).first() if staff_user else None

        attendance = StudentAttendance.objects.filter(
            student=child,
            attendance_date=today
        ).first()

        if not attendance:
            # Create retroactive check-in/out record
            attendance = StudentAttendance.objects.create(
                daycare=daycare,
                student=child,
                attendance_date=today,
                check_in_time=now_time,
                check_out_time=now_time,
                expected_departure_time=expected_pickup_time,
                departure_type="QR",
                attendance_status="PRESENT",
                is_late=is_late,
                late_reason=f"Late pickup by {late_duration_mins} mins" if is_late else "",
                released_by=staff_emp,
                pickup_person=pickup_person,
                notes=notes or ""
            )
        else:
            attendance.check_out_time = now_time
            attendance.departure_type = "QR"
            attendance.pickup_person = pickup_person
            if not attendance.expected_departure_time:
                attendance.expected_departure_time = expected_pickup_time
            if is_late:
                attendance.is_late = True
                attendance.late_reason = f"Late pickup by {late_duration_mins} mins"
            if staff_emp:
                attendance.released_by = staff_emp
            if notes:
                attendance.notes = f"{attendance.notes}\n{notes}".strip()
            attendance.save()

        # Create SafeArrivalDepartureEvent with late pickup metrics & staff context
        event = SafeArrivalDepartureEvent.objects.create(
            daycare=daycare,
            student=child,
            authorized_pickup=pickup_person,
            attendance_record=attendance,
            event_type=SafeArrivalDepartureEvent.EVENT_CHECK_OUT,
            verification_method=SafeArrivalDepartureEvent.METHOD_QR,
            verification_status=SafeArrivalDepartureEvent.STATUS_SUCCESS,
            is_late_pickup=is_late,
            expected_pickup_time=expected_pickup_time,
            actual_checkout_time=now_time,
            late_duration_minutes=late_duration_mins,
            processed_by=staff_user if staff_user and staff_user.is_authenticated else None,
            notes=notes or ""
        )

        # AuditLog
        AuditLog.objects.create(
            user=staff_user if staff_user and staff_user.is_authenticated else None,
            user_type=getattr(staff_user, 'role', 'Staff') or 'Staff' if staff_user else 'System',
            action="QR Child Departure Checked Out",
            module="Safe Arrival Departure",
            entity_type="SafeArrivalDepartureEvent",
            entity_id=str(event.id),
            new_values={
                "child_id": str(child.id),
                "child_name": f"{child.first_name} {child.last_name}",
                "pickup_person_id": str(pickup_person.id),
                "pickup_name": pickup_person.name,
                "check_out_time": now_time.strftime('%H:%M:%S'),
                "is_late_pickup": is_late,
                "late_duration_minutes": late_duration_mins,
                "method": "QR"
            }
        )

        # Dispatch family notification
        try:
            checkout_msg = f"{child.first_name} {child.last_name} was checked out by {pickup_person.name} ({pickup_person.relationship}) at {now_time.strftime('%I:%M %p')}."
            if is_late:
                checkout_msg += f" (Late pickup: {late_duration_mins} minutes late)"
            FamilyNotificationService.notify_student_family(
                student=child,
                notification_type=FamilyNotificationService.NOTIFICATION_CHILD_CHECKED_OUT,
                title="Child Departure Recorded",
                message=checkout_msg,
                sender=staff_user
            )
        except Exception:
            pass

        return {
            "success": True,
            "event_id": str(event.id),
            "event_type": "CHECK_OUT",
            "verification_method": "QR",
            "child": {
                "id": str(child.id),
                "name": f"{child.first_name} {child.last_name}"
            },
            "pickup_person": {
                "id": str(pickup_person.id),
                "name": pickup_person.name,
                "relationship": pickup_person.relationship
            },
            "timestamp": event.timestamp.isoformat(),
            "check_out_time": now_time.strftime('%H:%M:%S'),
            "is_late_pickup": is_late,
            "expected_pickup_time": expected_pickup_time.strftime('%H:%M:%S'),
            "actual_checkout_time": now_time.strftime('%H:%M:%S'),
            "late_duration_minutes": late_duration_mins,
            "processed_by": {
                "id": str(staff_user.id) if staff_user and staff_user.is_authenticated else None,
                "name": f"{staff_user.first_name} {staff_user.last_name}".strip() or staff_user.username if staff_user and staff_user.is_authenticated else "System"
            }
        }

    @classmethod
    def process_pin_checkout(
        cls,
        daycare: Daycare,
        pickup_person_id: str,
        raw_pin: str,
        child_id: str,
        staff_user: Optional[User] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        PART D: PIN-based Child Departure (Check-Out).
        Calculates expected pickup time vs actual checkout time, recording late pickup metrics.
        """
        try:
            pickup_person = StudentPickup.objects.select_related('student', 'daycare').get(id=pickup_person_id)
        except (StudentPickup.DoesNotExist, ValueError):
            cls._record_failed_event(
                daycare=daycare,
                method=SafeArrivalDepartureEvent.METHOD_PIN,
                reason="Pickup person not found.",
                user=staff_user,
                is_unauthorized=True
            )
            raise NotFound("Pickup person authorization record not found.")

        # Tenant check
        if daycare and pickup_person.student.daycare_id != daycare.id:
            cls._record_failed_event(
                daycare=daycare,
                method=SafeArrivalDepartureEvent.METHOD_PIN,
                pickup_person=pickup_person,
                reason="Pickup person belongs to another daycare.",
                user=staff_user,
                is_unauthorized=True
            )
            raise PermissionDenied("Cannot access pickup authorization from another daycare.")

        # Verify PIN
        pin_valid, pin_msg = cls.verify_pickup_pin(
            pickup_person=pickup_person,
            raw_pin=raw_pin,
            daycare=daycare,
            user=staff_user
        )
        if not pin_valid:
            raise ValidationError(pin_msg)

        # Verify child authorization
        verify_res = PickupVerificationService.verify(
            daycare=daycare,
            child_id=child_id,
            pickup_person_id=str(pickup_person.id),
            user=staff_user,
            notes=notes
        )

        child = Student.objects.filter(id=child_id, daycare=daycare).first()

        if not verify_res["is_authorized"]:
            cls._record_failed_event(
                daycare=daycare,
                student=child,
                method=SafeArrivalDepartureEvent.METHOD_PIN,
                pickup_person=pickup_person,
                reason=verify_res["reason"],
                user=staff_user,
                is_unauthorized=True
            )
            raise ValidationError(f"Pickup unauthorized: {verify_res['reason']}")

        # Determine expected pickup time and check late pickup
        today = timezone.now().date()
        now_time = timezone.now().time()
        expected_pickup_time = cls.get_expected_pickup_time(daycare, child, attendance_date=today)
        is_late, late_duration_mins = cls.calculate_late_duration(expected_pickup_time, now_time)

        staff_emp = Employee.objects.filter(user=staff_user, daycare=daycare).first() if staff_user else None

        attendance = StudentAttendance.objects.filter(
            student=child,
            attendance_date=today
        ).first()

        if not attendance:
            attendance = StudentAttendance.objects.create(
                daycare=daycare,
                student=child,
                attendance_date=today,
                check_in_time=now_time,
                check_out_time=now_time,
                expected_departure_time=expected_pickup_time,
                departure_type="PIN",
                attendance_status="PRESENT",
                is_late=is_late,
                late_reason=f"Late pickup by {late_duration_mins} mins" if is_late else "",
                released_by=staff_emp,
                pickup_person=pickup_person,
                notes=notes or ""
            )
        else:
            attendance.check_out_time = now_time
            attendance.departure_type = "PIN"
            attendance.pickup_person = pickup_person
            if not attendance.expected_departure_time:
                attendance.expected_departure_time = expected_pickup_time
            if is_late:
                attendance.is_late = True
                attendance.late_reason = f"Late pickup by {late_duration_mins} mins"
            if staff_emp:
                attendance.released_by = staff_emp
            if notes:
                attendance.notes = f"{attendance.notes}\n{notes}".strip()
            attendance.save()

        # Create SafeArrivalDepartureEvent
        event = SafeArrivalDepartureEvent.objects.create(
            daycare=daycare,
            student=child,
            authorized_pickup=pickup_person,
            attendance_record=attendance,
            event_type=SafeArrivalDepartureEvent.EVENT_CHECK_OUT,
            verification_method=SafeArrivalDepartureEvent.METHOD_PIN,
            verification_status=SafeArrivalDepartureEvent.STATUS_SUCCESS,
            is_late_pickup=is_late,
            expected_pickup_time=expected_pickup_time,
            actual_checkout_time=now_time,
            late_duration_minutes=late_duration_mins,
            processed_by=staff_user if staff_user and staff_user.is_authenticated else None,
            notes=notes or ""
        )

        # AuditLog
        AuditLog.objects.create(
            user=staff_user if staff_user and staff_user.is_authenticated else None,
            user_type=getattr(staff_user, 'role', 'Staff') or 'Staff' if staff_user else 'System',
            action="PIN Child Departure Checked Out",
            module="Safe Arrival Departure",
            entity_type="SafeArrivalDepartureEvent",
            entity_id=str(event.id),
            new_values={
                "child_id": str(child.id),
                "child_name": f"{child.first_name} {child.last_name}",
                "pickup_person_id": str(pickup_person.id),
                "pickup_name": pickup_person.name,
                "check_out_time": now_time.strftime('%H:%M:%S'),
                "is_late_pickup": is_late,
                "late_duration_minutes": late_duration_mins,
                "method": "PIN"
            }
        )

        # Dispatch family notification
        try:
            checkout_msg = f"{child.first_name} {child.last_name} was checked out by {pickup_person.name} ({pickup_person.relationship}) at {now_time.strftime('%I:%M %p')}."
            if is_late:
                checkout_msg += f" (Late pickup: {late_duration_mins} minutes late)"
            FamilyNotificationService.notify_student_family(
                student=child,
                notification_type=FamilyNotificationService.NOTIFICATION_CHILD_CHECKED_OUT,
                title="Child Departure Recorded",
                message=checkout_msg,
                sender=staff_user
            )
        except Exception:
            pass

        return {
            "success": True,
            "event_id": str(event.id),
            "event_type": "CHECK_OUT",
            "verification_method": "PIN",
            "child": {
                "id": str(child.id),
                "name": f"{child.first_name} {child.last_name}"
            },
            "pickup_person": {
                "id": str(pickup_person.id),
                "name": pickup_person.name,
                "relationship": pickup_person.relationship
            },
            "timestamp": event.timestamp.isoformat(),
            "check_out_time": now_time.strftime('%H:%M:%S'),
            "is_late_pickup": is_late,
            "expected_pickup_time": expected_pickup_time.strftime('%H:%M:%S'),
            "actual_checkout_time": now_time.strftime('%H:%M:%S'),
            "late_duration_minutes": late_duration_mins,
            "processed_by": {
                "id": str(staff_user.id) if staff_user and staff_user.is_authenticated else None,
                "name": f"{staff_user.first_name} {staff_user.last_name}".strip() or staff_user.username if staff_user and staff_user.is_authenticated else "System"
            }
        }

    @classmethod
    def process_signature_checkout(
        cls,
        daycare: Daycare,
        pickup_person_id: str,
        signature_data: str,
        child_id: str,
        staff_user: Optional[User] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        PART E: Digital Signature Departure (Check-Out).
        Calculates expected pickup time vs actual checkout time, recording late pickup metrics.
        """
        if not signature_data:
            raise ValidationError("Signature data is required.")

        try:
            pickup_person = StudentPickup.objects.select_related('student', 'daycare').get(id=pickup_person_id)
        except (StudentPickup.DoesNotExist, ValueError):
            cls._record_failed_event(
                daycare=daycare,
                method=SafeArrivalDepartureEvent.METHOD_DIGITAL_SIGNATURE,
                reason="Pickup person not found.",
                user=staff_user,
                is_unauthorized=True
            )
            raise NotFound("Pickup person authorization record not found.")

        # Tenant check
        if daycare and pickup_person.student.daycare_id != daycare.id:
            cls._record_failed_event(
                daycare=daycare,
                method=SafeArrivalDepartureEvent.METHOD_DIGITAL_SIGNATURE,
                pickup_person=pickup_person,
                reason="Pickup person belongs to another daycare.",
                user=staff_user,
                is_unauthorized=True
            )
            raise PermissionDenied("Cannot access pickup authorization from another daycare.")

        # Verify child authorization
        verify_res = PickupVerificationService.verify(
            daycare=daycare,
            child_id=child_id,
            pickup_person_id=str(pickup_person.id),
            user=staff_user,
            notes=notes
        )

        child = Student.objects.filter(id=child_id, daycare=daycare).first()

        if not verify_res["is_authorized"]:
            cls._record_failed_event(
                daycare=daycare,
                student=child,
                method=SafeArrivalDepartureEvent.METHOD_DIGITAL_SIGNATURE,
                pickup_person=pickup_person,
                reason=verify_res["reason"],
                user=staff_user,
                is_unauthorized=True
            )
            raise ValidationError(f"Pickup unauthorized: {verify_res['reason']}")

        # Determine expected pickup time and check late pickup
        today = timezone.now().date()
        now_time = timezone.now().time()
        expected_pickup_time = cls.get_expected_pickup_time(daycare, child, attendance_date=today)
        is_late, late_duration_mins = cls.calculate_late_duration(expected_pickup_time, now_time)

        staff_emp = Employee.objects.filter(user=staff_user, daycare=daycare).first() if staff_user else None

        attendance = StudentAttendance.objects.filter(
            student=child,
            attendance_date=today
        ).first()

        if not attendance:
            attendance = StudentAttendance.objects.create(
                daycare=daycare,
                student=child,
                attendance_date=today,
                check_in_time=now_time,
                check_out_time=now_time,
                expected_departure_time=expected_pickup_time,
                departure_type="DIGITAL_SIGNATURE",
                attendance_status="PRESENT",
                is_late=is_late,
                late_reason=f"Late pickup by {late_duration_mins} mins" if is_late else "",
                released_by=staff_emp,
                pickup_person=pickup_person,
                notes=notes or ""
            )
        else:
            attendance.check_out_time = now_time
            attendance.departure_type = "DIGITAL_SIGNATURE"
            attendance.pickup_person = pickup_person
            if not attendance.expected_departure_time:
                attendance.expected_departure_time = expected_pickup_time
            if is_late:
                attendance.is_late = True
                attendance.late_reason = f"Late pickup by {late_duration_mins} mins"
            if staff_emp:
                attendance.released_by = staff_emp
            if notes:
                attendance.notes = f"{attendance.notes}\n{notes}".strip()
            attendance.save()

        # Create SafeArrivalDepartureEvent with signature and late metrics
        event = SafeArrivalDepartureEvent.objects.create(
            daycare=daycare,
            student=child,
            authorized_pickup=pickup_person,
            attendance_record=attendance,
            event_type=SafeArrivalDepartureEvent.EVENT_CHECK_OUT,
            verification_method=SafeArrivalDepartureEvent.METHOD_DIGITAL_SIGNATURE,
            verification_status=SafeArrivalDepartureEvent.STATUS_SUCCESS,
            signature_data=signature_data,
            is_late_pickup=is_late,
            expected_pickup_time=expected_pickup_time,
            actual_checkout_time=now_time,
            late_duration_minutes=late_duration_mins,
            processed_by=staff_user if staff_user and staff_user.is_authenticated else None,
            notes=notes or ""
        )

        # AuditLog
        AuditLog.objects.create(
            user=staff_user if staff_user and staff_user.is_authenticated else None,
            user_type=getattr(staff_user, 'role', 'Staff') or 'Staff' if staff_user else 'System',
            action="Digital Signature Departure Verified",
            module="Safe Arrival Departure",
            entity_type="SafeArrivalDepartureEvent",
            entity_id=str(event.id),
            new_values={
                "child_id": str(child.id),
                "child_name": f"{child.first_name} {child.last_name}",
                "pickup_person_id": str(pickup_person.id),
                "pickup_name": pickup_person.name,
                "check_out_time": now_time.strftime('%H:%M:%S'),
                "is_late_pickup": is_late,
                "late_duration_minutes": late_duration_mins,
                "method": "DIGITAL_SIGNATURE"
            }
        )

        # Dispatch family notification
        try:
            checkout_msg = f"{child.first_name} {child.last_name} was checked out by {pickup_person.name} ({pickup_person.relationship}) at {now_time.strftime('%I:%M %p')}."
            if is_late:
                checkout_msg += f" (Late pickup: {late_duration_mins} minutes late)"
            FamilyNotificationService.notify_student_family(
                student=child,
                notification_type=FamilyNotificationService.NOTIFICATION_CHILD_CHECKED_OUT,
                title="Child Departure Recorded",
                message=checkout_msg,
                sender=staff_user
            )
        except Exception:
            pass

        return {
            "success": True,
            "event_id": str(event.id),
            "event_type": "CHECK_OUT",
            "verification_method": "DIGITAL_SIGNATURE",
            "child": {
                "id": str(child.id),
                "name": f"{child.first_name} {child.last_name}"
            },
            "pickup_person": {
                "id": str(pickup_person.id),
                "name": pickup_person.name,
                "relationship": pickup_person.relationship
            },
            "timestamp": event.timestamp.isoformat(),
            "check_out_time": now_time.strftime('%H:%M:%S'),
            "is_late_pickup": is_late,
            "expected_pickup_time": expected_pickup_time.strftime('%H:%M:%S'),
            "actual_checkout_time": now_time.strftime('%H:%M:%S'),
            "late_duration_minutes": late_duration_mins,
            "processed_by": {
                "id": str(staff_user.id) if staff_user and staff_user.is_authenticated else None,
                "name": f"{staff_user.first_name} {staff_user.last_name}".strip() or staff_user.username if staff_user and staff_user.is_authenticated else "System"
            }
        }

    # --- Internal Failure Logging & Staff Alert Helper ---

    @classmethod
    def _record_failed_event(
        cls,
        daycare: Optional[Daycare],
        method: str,
        reason: str,
        student: Optional[Student] = None,
        pickup_person: Optional[StudentPickup] = None,
        attempted_person_name: Optional[str] = None,
        user: Optional[User] = None,
        is_unauthorized: bool = True
    ) -> Optional[SafeArrivalDepartureEvent]:
        """
        Records a failed/unauthorized pickup attempt event in SafeArrivalDepartureEvent,
        logs to AuditLog, and dispatches an authorized staff alert via StaffNotification.
        """
        if not daycare and student and student.daycare:
            daycare = student.daycare
        if not daycare and pickup_person and pickup_person.student:
            daycare = pickup_person.student.daycare

        if not daycare:
            return None

        # Fallback dummy student if not provided
        target_student = student
        if not target_student and pickup_person and pickup_person.student:
            target_student = pickup_person.student

        if not target_student:
            # If no student can be resolved, fetch first student in daycare to satisfy FK if exists
            target_student = Student.objects.filter(daycare=daycare).first()

        if not target_student:
            return None

        resolved_attempted_name = attempted_person_name
        if not resolved_attempted_name and pickup_person:
            resolved_attempted_name = pickup_person.name

        event_type = SafeArrivalDepartureEvent.EVENT_UNAUTHORIZED_ATTEMPT if is_unauthorized else SafeArrivalDepartureEvent.EVENT_VERIFICATION_FAILED

        event = SafeArrivalDepartureEvent.objects.create(
            daycare=daycare,
            student=target_student,
            authorized_pickup=pickup_person,
            event_type=event_type,
            verification_method=method,
            verification_status=SafeArrivalDepartureEvent.STATUS_FAILED,
            failure_reason=reason,
            attempted_person_name=resolved_attempted_name,
            processed_by=user if user and user.is_authenticated else None
        )

        AuditLog.objects.create(
            user=user if user and user.is_authenticated else None,
            user_type=getattr(user, 'role', 'Staff') or 'Staff' if user else 'System',
            action="Unauthorized Pickup Attempt" if is_unauthorized else "Pickup Verification Failed",
            module="Safe Arrival Departure",
            entity_type="SafeArrivalDepartureEvent",
            entity_id=str(event.id),
            new_values={
                "method": method,
                "reason": reason,
                "attempted_person_name": resolved_attempted_name,
                "pickup_person_id": str(pickup_person.id) if pickup_person else None,
                "child_id": str(target_student.id) if target_student else None,
                "child_name": f"{target_student.first_name} {target_student.last_name}" if target_student else None
            }
        )

        # PART D: ALERT Authorized Daycare Staff
        child_name = f"{target_student.first_name} {target_student.last_name}" if target_student else "Child"
        time_str = timezone.now().strftime("%I:%M %p")
        alert_title = "UNAUTHORIZED PICKUP ATTEMPT"
        alert_msg = (
            f"UNAUTHORIZED PICKUP ATTEMPT\n"
            f"Child: {child_name}\n"
            f"Time: {time_str}\n"
            f"Action Required: Verify pickup authorization."
        )

        # Dispatch notifications to daycare staff
        staff_users = User.objects.filter(daycare=daycare)
        if staff_users.exists():
            for s_user in staff_users:
                NotificationService.send_notification(
                    daycare=daycare,
                    user=s_user,
                    notification_type="unauthorized_pickup_attempt",
                    title=alert_title,
                    message=alert_msg
                )
        elif user and user.is_authenticated:
            NotificationService.send_notification(
                daycare=daycare,
                user=user,
                notification_type="unauthorized_pickup_attempt",
                title=alert_title,
                message=alert_msg
            )
        else:
            NotificationService.send_notification(
                daycare=daycare,
                notification_type="unauthorized_pickup_attempt",
                title=alert_title,
                message=alert_msg
            )

        # Dispatch family alert for unauthorized attempt on known child
        if target_student and is_unauthorized:
            try:
                FamilyNotificationService.notify_student_family(
                    student=target_student,
                    notification_type=FamilyNotificationService.NOTIFICATION_UNAUTHORIZED_ATTEMPT,
                    title="Security Alert: Unauthorized Pickup Attempt",
                    message=f"A pickup attempt for {target_student.first_name} {target_student.last_name} at {time_str} was blocked because authorization could not be verified. Please contact daycare staff if you have any questions.",
                    sender=user
                )
            except Exception:
                pass

        return event
