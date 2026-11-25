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


class DaycareHolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = DaycareHoliday
        fields = '__all__'
        read_only_fields = ['id', 'daycare', 'created_at', 'updated_at']


class DaycareHolidayViewSet(viewsets.ModelViewSet):
    serializer_class = DaycareHolidaySerializer
    permission_classes = [IsDaycareAdmin]

    def get_queryset(self):
        qs = DaycareHoliday.objects.filter(daycare=self.request.user.daycare).order_by('holiday_date')
        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(holiday_date__year=year)
        return qs

    def perform_create(self, serializer):
        serializer.save(daycare=self.request.user.daycare)
        AuditLog.objects.create(
            user=self.request.user,
            action=f"Created Holiday: {serializer.validated_data.get('name')}",
            module="Holidays",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_update(self, serializer):
        serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action=f"Updated Holiday: {serializer.instance.name}",
            module="Holidays",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_destroy(self, instance):
        name = instance.name
        instance.delete()
        AuditLog.objects.create(
            user=self.request.user,
            action=f"Deleted Holiday: {name}",
            module="Holidays",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )


