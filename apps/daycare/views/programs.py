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


class ProgramListView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        programs = Program.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('sort_order', 'name')
        serializer = ProgramSerializer(programs, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        try:
            program = Program.objects.create(
                daycare=daycare,
                name=data.get('name', ''),
                description=data.get('description', ''),
                age_group=data.get('age_group', ''),
                min_age_months=data.get('min_age_months', 0),
                max_age_months=data.get('max_age_months', 0),
                program_fee=data.get('program_fee', 0.0),
                color=data.get('color', '#3B82F6'),
                status=data.get('status', 'Active')
            )
            serializer = ProgramSerializer(program)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


