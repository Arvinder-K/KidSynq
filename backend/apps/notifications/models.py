"""
Notifications app models.
Re-exports communication, announcement, consent form, and notification entities from core.models.
"""
from core.models import (
    Announcement,
    AnnouncementAudience,
    AnnouncementRead,
    ConsentForm,
    ConsentFormAssignment,
    ConsentFormSignature,
    StaffNotification,
    FamilyMessage,
)

__all__ = [
    'Announcement',
    'AnnouncementAudience',
    'AnnouncementRead',
    'ConsentForm',
    'ConsentFormAssignment',
    'ConsentFormSignature',
    'StaffNotification',
    'FamilyMessage',
]

