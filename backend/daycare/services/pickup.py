from datetime import date, datetime
from django.utils import timezone
from django.db.models import Q
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound

from core.models import (
    Daycare, Student, StudentPickup, ChildEnrollment, AuditLog, User
)


class PickupVerificationService:
    @staticmethod
    def _parse_date(d_val):
        if not d_val:
            return timezone.now().date()
        if isinstance(d_val, datetime):
            return d_val.date()
        if isinstance(d_val, date):
            return d_val
        if isinstance(d_val, str):
            d_val = d_val.strip()
            for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
                try:
                    return datetime.strptime(d_val, fmt).date()
                except ValueError:
                    continue
        raise ValidationError(f"Invalid date format: '{d_val}'. Expected YYYY-MM-DD.")

    @classmethod
    def verify(cls, daycare, child_id, pickup_person_id, verification_date=None, user=None, request=None, notes=None):
        """
        Authoritative verification for child pickup.
        Checks:
        1. Child belongs to logged-in daycare.
        2. Child has an active enrollment.
        3. Pickup person is authorized for that specific child.
        4. Authorization is currently active.
        5. Authorization has not expired.
        6. Authorization has not been revoked.
        
        Logs the verification attempt to AuditLog.
        """
        current_date = cls._parse_date(verification_date)

        child = None
        pickup_person = None
        is_authorized = False
        status_code = "NOT_AUTHORIZED"
        reason = ""

        # Step 1: Verify Child belongs to Daycare
        try:
            child = Student.objects.select_related('daycare').get(id=child_id)
        except (Student.DoesNotExist, ValueError, TypeError):
            child = None

        if not child:
            is_authorized = False
            status_code = "NOT_AUTHORIZED"
            reason = "Child does not exist."
        elif daycare and child.daycare_id != getattr(daycare, 'id', daycare):
            is_authorized = False
            status_code = "NOT_AUTHORIZED"
            reason = "Child does not belong to this daycare."
        elif child.status != 'Active' or child.deleted_at is not None:
            is_authorized = False
            status_code = "NOT_AUTHORIZED"
            reason = f"Child record is inactive (status: {child.status})."
        else:
            # Step 2: Verify active enrollment
            has_active_enrollment = ChildEnrollment.objects.filter(
                student=child,
                status__iexact='Active'
            ).exists()

            if not has_active_enrollment:
                is_authorized = False
                status_code = "NOT_AUTHORIZED"
                reason = "Child does not have an active enrollment."
            else:
                # Step 3: Fetch Pickup Person and check association
                try:
                    pickup_person = StudentPickup.objects.select_related('student', 'daycare').get(id=pickup_person_id)
                except (StudentPickup.DoesNotExist, ValueError, TypeError):
                    pickup_person = None

                if not pickup_person:
                    is_authorized = False
                    status_code = "NOT_AUTHORIZED"
                    reason = "Pickup person authorization not found."
                elif pickup_person.student_id != child.id:
                    is_authorized = False
                    status_code = "NOT_AUTHORIZED"
                    reason = "Pickup person is not authorized for this child."
                elif daycare and pickup_person.student.daycare_id != getattr(daycare, 'id', daycare):
                    is_authorized = False
                    status_code = "NOT_AUTHORIZED"
                    reason = "Pickup authorization does not belong to this daycare."
                else:
                    # Step 4, 5, 6: Authorization Status & Date Validity
                    auth_status = (pickup_person.authorization_status or 'ACTIVE').upper()
                    
                    if auth_status == StudentPickup.STATUS_REVOKED:
                        is_authorized = False
                        status_code = "NOT_AUTHORIZED"
                        reason = "Pickup authorization has been revoked."
                    elif auth_status == StudentPickup.STATUS_INACTIVE:
                        is_authorized = False
                        status_code = "NOT_AUTHORIZED"
                        reason = "Pickup authorization is inactive."
                    elif auth_status == StudentPickup.STATUS_PENDING:
                        is_authorized = False
                        status_code = "NOT_AUTHORIZED"
                        reason = "Pickup authorization is pending verification."
                    elif auth_status == StudentPickup.STATUS_EXPIRED:
                        is_authorized = False
                        status_code = "NOT_AUTHORIZED"
                        reason = f"Pickup authorization expired on {pickup_person.valid_until or 'previous date'}."
                    elif auth_status != StudentPickup.STATUS_ACTIVE:
                        is_authorized = False
                        status_code = "NOT_AUTHORIZED"
                        reason = f"Pickup authorization status is {auth_status}."
                    elif pickup_person.valid_from and current_date < pickup_person.valid_from:
                        is_authorized = False
                        status_code = "NOT_AUTHORIZED"
                        reason = f"Pickup authorization is not yet active (valid from {pickup_person.valid_from})."
                    elif pickup_person.valid_until and current_date > pickup_person.valid_until:
                        # Auto-update status to expired
                        pickup_person.authorization_status = StudentPickup.STATUS_EXPIRED
                        pickup_person.save(update_fields=['authorization_status', 'updated_at'])
                        is_authorized = False
                        status_code = "NOT_AUTHORIZED"
                        reason = f"Pickup authorization expired on {pickup_person.valid_until}."
                    else:
                        # All checks passed!
                        is_authorized = True
                        status_code = "AUTHORIZED"
                        reason = "Pickup person is authorized and active for this child."

        # Audit Log recording
        actor_user = user
        if not actor_user and request and hasattr(request, 'user') and request.user.is_authenticated:
            actor_user = request.user

        user_type = 'Staff'
        if actor_user:
            user_type = getattr(actor_user, 'role', 'Staff') or ('Admin' if actor_user.is_staff else 'User')

        AuditLog.objects.create(
            user=actor_user if (actor_user and actor_user.is_authenticated) else None,
            user_type=user_type,
            action="Verified Pickup Authorization",
            module="Safe Arrival Departure",
            entity_type="StudentPickup",
            entity_id=str(pickup_person.id) if pickup_person else (str(child.id) if child else str(child_id)),
            new_values={
                "is_authorized": is_authorized,
                "status": status_code,
                "reason": reason,
                "child_id": str(child.id) if child else str(child_id),
                "child_name": f"{child.first_name} {child.last_name}" if child else None,
                "pickup_person_id": str(pickup_person.id) if pickup_person else str(pickup_person_id),
                "pickup_name": pickup_person.name if pickup_person else None,
                "verification_date": str(current_date),
                "notes": notes or ""
            }
        )

        # Build response payload
        child_summary = None
        if child:
            child_summary = {
                "id": str(child.id),
                "first_name": child.first_name,
                "last_name": child.last_name,
                "preferred_name": getattr(child, 'preferred_name', ''),
                "admission_number": child.admission_number,
                "status": child.status,
                "photo": child.photo
            }

        pickup_summary = None
        if pickup_person:
            pickup_summary = {
                "id": str(pickup_person.id),
                "name": pickup_person.name,
                "relationship": pickup_person.relationship,
                "phone": pickup_person.phone,
                "email": pickup_person.email,
                "photo_url": f"/api/daycare/authorized-pickups/{pickup_person.id}/photo/" if pickup_person.photo else None,
                "authorization_status": pickup_person.authorization_status,
                "valid_from": str(pickup_person.valid_from) if pickup_person.valid_from else None,
                "valid_until": str(pickup_person.valid_until) if pickup_person.valid_until else None,
                "is_expired": pickup_person.is_expired,
                "is_effective": pickup_person.is_effective,
                "notes": pickup_person.notes
            }

        return {
            "is_authorized": is_authorized,
            "status": status_code,
            "reason": reason,
            "verification_date": str(current_date),
            "verified_at": timezone.now().isoformat(),
            "verified_by": {
                "id": str(actor_user.id) if actor_user and actor_user.is_authenticated else None,
                "name": f"{actor_user.first_name} {actor_user.last_name}".strip() or getattr(actor_user, 'username', 'System') if actor_user else 'System',
                "role": user_type
            },
            "child": child_summary,
            "pickup_person": pickup_summary
        }

    @classmethod
    def get_child_active_pickups(cls, daycare, child_id):
        """
        Returns all pickups currently authorized and effective for a child.
        """
        today = timezone.now().date()
        child = Student.objects.filter(id=child_id, daycare=daycare, status='Active').first()
        if not child:
            return []

        # Check active enrollment
        if not ChildEnrollment.objects.filter(student=child, status__iexact='Active').exists():
            return []

        pickups = StudentPickup.objects.filter(
            student=child,
            authorization_status=StudentPickup.STATUS_ACTIVE
        ).filter(
            Q(valid_from__isnull=True) | Q(valid_from__lte=today)
        ).filter(
            Q(valid_until__isnull=True) | Q(valid_until__gte=today)
        ).order_by('name')

        return pickups
