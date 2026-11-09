from rest_framework.decorators import action
from rest_framework import generics, status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q, Sum, F, ExpressionWrapper, fields
from django.utils import timezone
from datetime import datetime, timedelta
import uuid

from core.models import *
from core.serializers import *
from core.permissions import IsDaycareAdmin
from rest_framework import serializers


class AnnouncementListView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        announcements = Announcement.objects.filter(daycare=daycare).order_by('-published_at')
        serializer = AnnouncementSerializer(announcements, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        
        try:
            announcement = Announcement.objects.create(
                daycare=daycare,
                sender=request.user,
                title=data.get('title'),
                content=data.get('content'),
                type=data.get('type', 'General'),
                status='Published',
                published_at=timezone.now()
            )
            serializer = AnnouncementSerializer(announcement)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class DaycareSystemAnnouncementListView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response([])
            
        announcements = SystemAnnouncement.objects.filter(
            status='published',
        ).filter(
            Q(target_daycares__isnull=True) | Q(target_daycares=daycare)
        ).distinct().order_by('-created_at')
        
        serializer = SystemAnnouncementSerializer(announcements, many=True)
        return Response(serializer.data)


class CommunicationStatsView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"total_announcements": 0, "recent_7_days": 0, "breakdown": {}})
            
        announcements = Announcement.objects.filter(daycare=daycare)
        total = announcements.count()
        emergency_count = announcements.filter(type='Emergency').count()
        reminder_count = announcements.filter(type='Reminder').count()
        event_count = announcements.filter(type='Event').count()
        general_count = announcements.filter(type='General').count()
        recent_count = announcements.filter(published_at__gte=timezone.now() - timedelta(days=7)).count()

        return Response({
            "total_announcements": total,
            "recent_7_days": recent_count,
            "breakdown": {
                "emergency": emergency_count,
                "reminder": reminder_count,
                "event": event_count,
                "general": general_count
            }
        })


class CommunicationTemplatesView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        templates = [
            {
                "id": "emergency_closure",
                "title": "Weather / Emergency Closure Notice",
                "type": "Emergency",
                "content": "Please be advised that our facility will be closed today due to severe weather conditions. Normal operations are expected to resume tomorrow."
            },
            {
                "id": "holiday_reminder",
                "title": "Upcoming Holiday Center Closure",
                "type": "Reminder",
                "content": "This is a reminder that the center will be closed on the upcoming statutory holiday. Please ensure your child care plans are arranged accordingly."
            },
            {
                "id": "special_event",
                "title": "Special Center Event Announcement",
                "type": "Event",
                "content": "We are excited to invite all families to our upcoming center event! Check the schedule for activities and timing."
            },
            {
                "id": "general_update",
                "title": "General Monthly Center Update",
                "type": "General",
                "content": "Please review this month's updates, highlights, and operational reminders from the administration team."
            }
        ]
        return Response(templates)



