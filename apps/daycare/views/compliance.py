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


class IncidentListView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        incidents = IncidentReport.objects.filter(daycare=daycare).order_by('-incident_date')
        serializer = IncidentReportSerializer(incidents, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        try:
            incident = IncidentReport.objects.create(
                daycare=daycare,
                student_id=data.get('student_id'),
                reporter_id=request.user.employee.id if hasattr(request.user, 'employee') else None,
                incident_date=data.get('incident_date') or datetime.date.today(),
                incident_time=data.get('incident_time') or datetime.datetime.now().time(),
                location=data.get('location', ''),
                description=data.get('description', ''),
                action_taken=data.get('action_taken', ''),
                status='Open'
            )
            serializer = IncidentReportSerializer(incident)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class InspectionListView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        inspections = InspectionVisit.objects.filter(daycare=daycare).order_by('-visit_date')
        serializer = InspectionVisitSerializer(inspections, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        try:
            inspection = InspectionVisit.objects.create(
                daycare=daycare,
                inspector_name=data.get('inspector_name', ''),
                agency=data.get('agency', ''),
                visit_date=data.get('visit_date') or datetime.date.today(),
                visit_type=data.get('visit_type', 'Routine'),
                status='Completed',
                overall_result=data.get('overall_result', 'Compliant'),
                notes=data.get('notes', '')
            )
            serializer = InspectionVisitSerializer(inspection)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

from core.models import Program, Classroom
from core.serializers import ProgramSerializer, ClassroomSerializer


