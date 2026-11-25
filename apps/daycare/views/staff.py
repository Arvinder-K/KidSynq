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


class StaffListView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "User is not assigned to a daycare."}, status=status.HTTP_400_BAD_REQUEST)
        
        employees = Employee.objects.filter(daycare=daycare)
        serializer = EmployeeSerializer(employees, many=True)
        return Response(serializer.data)
        
    def post(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "User is not assigned to a daycare."}, status=status.HTTP_400_BAD_REQUEST)
            
        data = request.data
        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    username=data.get('email'),
                    email=data.get('email'),
                    password='password123', # Default password
                    first_name=data.get('first_name'),
                    last_name=data.get('last_name'),
                    daycare=daycare
                )
                
                employee = Employee.objects.create(
                    user=user,
                    daycare=daycare,
                    role=data.get('role', 'Teacher'),
                    employee_number=data.get('employee_number', ''),
                    employment_type=data.get('employment_type', 'Full-time')
                )
                
            serializer = EmployeeSerializer(employee)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

from core.models import Student
from core.serializers import StudentSerializer


