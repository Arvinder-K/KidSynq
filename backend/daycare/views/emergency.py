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


class DaycareEmergencyInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = DaycareEmergencyInformation
        fields = '__all__'
        read_only_fields = ['id', 'daycare', 'created_at', 'updated_at']


class DaycareEmergencyInfoView(generics.RetrieveUpdateAPIView):
    serializer_class = DaycareEmergencyInfoSerializer
    permission_classes = [IsDaycareAdmin]

    def get_object(self):
        obj, _ = DaycareEmergencyInformation.objects.get_or_create(daycare=self.request.user.daycare)
        return obj

    def perform_update(self, serializer):
        serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action="Updated Emergency Information",
            module="Emergency Info",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )


