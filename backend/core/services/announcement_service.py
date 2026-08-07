from django.db import transaction
from django.utils import timezone
from core.models import Announcement, AnnouncementAudience, AnnouncementRead

class AnnouncementService:
    @staticmethod
    def create_announcement(data: dict, audiences: list):
        with transaction.atomic():
            announcement = Announcement.objects.create(
                daycare_id=data.get('daycare_id'),
                sender_id=data.get('sender_id'),
                title=data.get('title'),
                content=data.get('content'),
                type=data.get('type', 'general'),
                status=data.get('status', 'draft'),
                published_at=timezone.now() if data.get('status') == 'published' else None
            )

            for audience in audiences:
                AnnouncementAudience.objects.create(
                    announcement=announcement,
                    audience_type=audience.get('type'),
                    audience_id=audience.get('id')
                )

            return announcement

    @staticmethod
    def mark_as_read(announcement: Announcement, user):
        obj, created = AnnouncementRead.objects.get_or_create(
            announcement=announcement,
            user=user,
            defaults={'read_at': timezone.now()}
        )
        return obj
