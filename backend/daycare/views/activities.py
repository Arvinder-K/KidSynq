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


class DailyReportView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        student_id = request.query_params.get('student_id')
        date_str = request.query_params.get('date')
        
        if not student_id:
            return Response({"detail": "student_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        if date_str:
            current_date = timezone.datetime.strptime(date_str, "%Y-%m-%d").date()
        else:
            current_date = timezone.now().date()
            
        try:
            student = Student.objects.get(pk=student_id, daycare=daycare)
            report, _ = DailyReport.objects.get_or_create(
                student=student,
                report_date=current_date,
                defaults={
                    'daycare': daycare,
                    'teacher': request.user if not hasattr(request.user, 'employee_profile') else None # Will fix teacher assignment in real app
                }
            )
            serializer = DailyReportSerializer(report)
            return Response(serializer.data)
        except Student.DoesNotExist:
            return Response({"detail": "Student not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ActivityLogView(APIView):
    permission_classes = [IsDaycareAdmin]

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        report_id = data.get('report_id')
        activity_type = data.get('type') # 'meal', 'nap', 'activity'
        
        try:
            report = DailyReport.objects.get(pk=report_id, daycare=daycare)
            
            if activity_type == 'meal':
                meal = MealRecord.objects.create(
                    daily_report=report,
                    meal_type=data.get('meal_type', ''),
                    food_provided=data.get('food_provided', ''),
                    amount_eaten=data.get('amount_eaten', '')
                )
                return Response(MealRecordSerializer(meal).data, status=status.HTTP_201_CREATED)
                
            elif activity_type == 'nap':
                nap = NapRecord.objects.create(
                    daily_report=report,
                    start_time=data.get('start_time'),
                    end_time=data.get('end_time') or None,
                    quality=data.get('quality', '')
                )
                return Response(NapRecordSerializer(nap).data, status=status.HTTP_201_CREATED)
                
            elif activity_type == 'activity':
                act = ActivityRecord.objects.create(
                    daily_report=report,
                    activity_type=data.get('activity_type', ''),
                    description=data.get('description', '')
                )
                return Response(ActivityRecordSerializer(act).data, status=status.HTTP_201_CREATED)
                
            else:
                return Response({"detail": "Invalid activity type"}, status=status.HTTP_400_BAD_REQUEST)
                
        except DailyReport.DoesNotExist:
            return Response({"detail": "Report not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

from core.models import HealthProfile, Allergy, Medication, MedicationAdministration
from core.serializers import StudentHealthDashboardSerializer, StudentHealthDetailSerializer, MedicationAdministrationSerializer


