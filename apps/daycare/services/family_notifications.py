from datetime import timedelta
from typing import Optional, List
from django.utils import timezone
from django.db.models import Q
from core.models import (
    Daycare, Family, Guardian, FamilyGuardian, FamilyChild,
    Student, User, FamilyMessage, DaycareSettings, AuditLog
)


class FamilyNotificationService:
    """
    Authoritative service for dispatching notifications & security alerts to families and guardians.
    Respects DaycareSettings.allow_parent_notifications and guardian communication preferences.
    Deduplicates alerts within a 10-minute window to avoid notification spam.
    """

    NOTIFICATION_PICKUP_APPROVED = 'pickup_authorization_approved'
    NOTIFICATION_PICKUP_REJECTED = 'pickup_authorization_rejected'
    NOTIFICATION_PICKUP_EXPIRING = 'pickup_authorization_expiring'
    NOTIFICATION_CHILD_CHECKED_IN = 'child_checked_in'
    NOTIFICATION_CHILD_CHECKED_OUT = 'child_checked_out'
    NOTIFICATION_LATE_PICKUP = 'late_pickup'
    NOTIFICATION_UNAUTHORIZED_ATTEMPT = 'unauthorized_pickup_attempt'

    @staticmethod
    def send_family_notification(
        daycare: Daycare,
        family: Family,
        notification_type: str,
        title: str,
        message: str,
        student: Optional[Student] = None,
        sender: Optional[User] = None
    ) -> Optional[FamilyMessage]:
        if not daycare or not family:
            return None

        # 1. Check daycare-level parent notification permissions
        settings = getattr(daycare, 'settings', None)
        if settings and hasattr(settings, 'allow_parent_notifications') and not settings.allow_parent_notifications:
            # Check if this is an emergency alert (unauthorized pickup attempt is always dispatched)
            if notification_type != FamilyNotificationService.NOTIFICATION_UNAUTHORIZED_ATTEMPT:
                return None

        # 2. Find daycare sender (fallback to first staff or superuser if sender not provided)
        if not sender:
            sender = User.objects.filter(
                Q(daycare=daycare) | Q(is_superuser=True),
                role__in=['Owner', 'Director', 'Admin', 'Staff']
            ).first()
            if not sender:
                sender = User.objects.filter(is_superuser=True).first()

        if not sender:
            # Fallback sender from daycare user list
            sender = User.objects.filter(daycare=daycare).first()

        # 3. Deduplicate alert spam within 10 minutes
        ten_mins_ago = timezone.now() - timedelta(minutes=10)
        existing = FamilyMessage.objects.filter(
            family=family,
            daycare=daycare,
            subject=title,
            body=message,
            created_at__gte=ten_mins_ago
        ).first()

        if existing:
            return existing  # Suppress duplicate spam

        now = timezone.now()
        msg = FamilyMessage.objects.create(
            daycare=daycare,
            family=family,
            sender=sender,
            subject=title,
            body=message,
            message_type='staff_to_guardian',
            is_read=False,
            created_at=now,
            updated_at=now
        )

        return msg

    @staticmethod
    def notify_student_family(
        student: Student,
        notification_type: str,
        title: str,
        message: str,
        sender: Optional[User] = None
    ) -> List[FamilyMessage]:
        """
        Finds all families linked to the student and dispatches the notification.
        """
        if not student:
            return []

        daycare = student.daycare
        family_ids = FamilyChild.objects.filter(student=student).values_list('family_id', flat=True)
        families = Family.objects.filter(id__in=family_ids, status='Active')

        sent_messages = []
        for family in families:
            msg = FamilyNotificationService.send_family_notification(
                daycare=daycare,
                family=family,
                notification_type=notification_type,
                title=title,
                message=message,
                student=student,
                sender=sender
            )
            if msg:
                sent_messages.append(msg)

        return sent_messages
