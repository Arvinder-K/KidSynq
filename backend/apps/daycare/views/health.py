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


class HealthDashboardView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        students = Student.objects.filter(daycare=daycare, status='Active', deleted_at__isnull=True).prefetch_related('allergy_records', 'medication_records')
        serializer = StudentHealthDashboardSerializer(students, many=True)
        return Response(serializer.data)


class StudentHealthDetailView(APIView):
    permission_classes = [IsDaycareAdmin]
    
    def get(self, request, pk):
        daycare = request.user.daycare
        try:
            student = Student.objects.get(pk=pk, daycare=daycare, deleted_at__isnull=True)
            # Ensure health profile exists
            HealthProfile.objects.get_or_create(
                student=student, 
                defaults={'daycare': daycare}
            )
            serializer = StudentHealthDetailSerializer(student)
            return Response(serializer.data)
        except Student.DoesNotExist:
            return Response({"detail": "Student not found"}, status=status.HTTP_404_NOT_FOUND)


class MedicationAdministrationView(APIView):
    permission_classes = [IsDaycareAdmin]
    
    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        medication_id = data.get('medication_id')
        
        try:
            medication = Medication.objects.get(pk=medication_id, student__daycare=daycare)
            
            admin = MedicationAdministration.objects.create(
                medication=medication,
                administered_by=request.user,
                date=timezone.now().date(),
                time=timezone.now().time(),
                dosage_given=data.get('dosage_given', ''),
                outcome=data.get('outcome', ''),
                teacher_notes=data.get('teacher_notes', '')
            )
            
            serializer = MedicationAdministrationSerializer(admin)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Medication.DoesNotExist:
            return Response({"detail": "Medication not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

from core.models import Invoice, InvoiceItem, Payment, SubscriptionPlan, DaycareSubscription
from core.serializers import InvoiceSerializer, SubscriptionPlanSerializer, DaycareSubscriptionSerializer
import uuid
from datetime import timedelta


