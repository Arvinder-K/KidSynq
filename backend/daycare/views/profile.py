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


class DaycareLicenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = DaycareLicense
        fields = '__all__'
        read_only_fields = ['id', 'daycare']

class DaycareProfileSerializer(serializers.ModelSerializer):
    license = DaycareLicenseSerializer(required=False)

    class Meta:
        model = Daycare
        fields = ['id', 'name', 'logo', 'email', 'phone', 'address1', 'city', 'state', 'country', 'postal_code', 'website', 'status', 'created_at', 'opening_time', 'closing_time', 'capacity', 'license']
        read_only_fields = ['id', 'status', 'created_at']

    def update(self, instance, validated_data):
        license_data = validated_data.pop('license', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if license_data is not None:
            license_obj, _ = DaycareLicense.objects.get_or_create(daycare=instance)
            for attr, value in license_data.items():
                setattr(license_obj, attr, value)
            license_obj.save()

        return instance


class DaycareProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = DaycareProfileSerializer
    permission_classes = [IsDaycareAdmin]

    def get_object(self):
        return self.request.user.daycare

    def perform_update(self, serializer):
        super().perform_update(serializer)
        AuditLog.objects.create(
            user=self.request.user,
            action="Updated Daycare Profile",
            module="Daycare Profile",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

from core.models import Branch, AuditLog


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)
        
    def put(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserPasswordView(APIView):
    permission_classes = [IsAuthenticated]
    
    def put(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not user.check_password(old_password):
            return Response({"detail": "Incorrect old password"}, status=status.HTTP_400_BAD_REQUEST)
            
        user.set_password(new_password)
        user.save()
        # Keep user logged in after password change
        update_session_auth_hash(request, user)
        return Response({"detail": "Password updated successfully"})

from rest_framework.decorators import action
from django.utils import timezone
from core.models import AgeGroup
from core.serializers import AgeGroupSerializer
from rest_framework import viewsets


class UserDetailView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

from rest_framework.views import APIView
from rest_framework.response import Response


