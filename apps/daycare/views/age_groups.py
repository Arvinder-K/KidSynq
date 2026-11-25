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


class AgeGroupViewSet(viewsets.ModelViewSet):
    permission_classes = [IsDaycareAdmin]
    serializer_class = AgeGroupSerializer

    def get_queryset(self):
        daycare = self.request.user.daycare
        queryset = AgeGroup.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('display_order', 'min_age_months')
        
        status_filter = self.request.query_params.get('status', None)
        if status_filter and status_filter != 'All':
            queryset = queryset.filter(status=status_filter)
            
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(name__icontains=search)
            
        return queryset

    def perform_create(self, serializer):
        serializer.save(
            daycare=self.request.user.daycare,
            created_by=self.request.user,
            updated_by=self.request.user
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.status = 'Archived'
        instance.save()

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        instance = self.get_object()
        instance.status = 'Archived'
        instance.save()
        return Response({'status': 'archived'})

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        instance = self.get_object()
        instance.status = 'Active'
        instance.deleted_at = None
        instance.save()
        return Response({'status': 'restored'})

from core.services.teacher_assignment_service import TeacherAssignmentService
from core.serializers import ClassroomTeacherAssignmentSerializer, AvailableTeacherSerializer
from core.models import ClassroomTeacherAssignment, Employee


