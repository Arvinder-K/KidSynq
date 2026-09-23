from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from core.models import Student, StudentEmergencyContact, StudentPickup, HealthProfile, Document, AuditLog
from core.serializers import (
    StudentSerializer, StudentEmergencyContactSerializer, 
    StudentPickupSerializer, HealthProfileSerializer, DocumentSerializer
)
from core.permissions import IsDaycareAdmin

class StudentViewSet(viewsets.ModelViewSet):
    serializer_class = StudentSerializer
    permission_classes = [IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        return Student.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('first_name')

    def create(self, request, *args, **kwargs):
        daycare = request.user.daycare
        admission_number = request.data.get('admission_number')
        
        # Uniqueness check
        if admission_number and Student.objects.filter(daycare=daycare, admission_number=admission_number).exists():
            return Response({"detail": "Admission number must be unique within the daycare."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Create Student
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            student = serializer.save(daycare=daycare)

            # Create Emergency Contact if provided
            emergency_contact = request.data.get('emergency_contact')
            if emergency_contact and emergency_contact.get('name'):
                StudentEmergencyContact.objects.create(
                    student=student,
                    name=emergency_contact.get('name'),
                    relationship=emergency_contact.get('relationship'),
                    mobile=emergency_contact.get('mobile'),
                    email=emergency_contact.get('email', ''),
                    is_primary=True
                )

            # Create AuditLog
            AuditLog.objects.create(
                user=request.user,
                user_type=request.user.role if hasattr(request.user, 'role') else 'Daycare Admin',
                action="Student Admission",
                module="Child Management",
                entity_type="Student",
                entity_id=str(student.id),
                old_values=None
            )

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        student = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
            action="Student Profile Updated",
            module="Child Management",
            entity_type="Student",
            entity_id=str(student.id),
            old_values=None
        )

    @action(detail=True, methods=['post'])
    def photo(self, request, pk=None):
        student = self.get_object()
        photo_file = request.FILES.get('photo')
        if photo_file:
            # Simple handling for local development (ideally use proper storage backend)
            import os
            from django.conf import settings
            from django.core.files.storage import default_storage
            
            path = default_storage.save(f'students/photos/{student.id}_{photo_file.name}', photo_file)
            photo_url = default_storage.url(path)
            
            student.photo = photo_url
            student.save()
            return Response({"photo": photo_url})
        return Response({"error": "No photo provided"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get', 'put', 'patch'])
    def medical(self, request, pk=None):
        student = self.get_object()
        
        # Get or create the HealthProfile
        health_profile, created = HealthProfile.objects.get_or_create(
            daycare=request.user.daycare, 
            student=student
        )
        
        if request.method == 'GET':
            serializer = HealthProfileSerializer(health_profile)
            return Response(serializer.data)
            
        elif request.method in ['PUT', 'PATCH']:
            student_data = {
                'allergies': request.data.get('allergies', student.allergies),
                'medical_conditions': request.data.get('medical_conditions', student.medical_conditions),
                'medication': request.data.get('medication', student.medication),
                'special_needs': request.data.get('special_needs', student.special_needs),
                'dietary_restrictions': request.data.get('dietary_restrictions', student.dietary_restrictions),
                'doctor_name': request.data.get('doctor_name', student.doctor_name),
                'doctor_phone': request.data.get('doctor_phone', student.doctor_phone),
                'hospital_name': request.data.get('hospital_name', student.hospital_name),
            }
            for attr, value in student_data.items():
                setattr(student, attr, value)
            student.save()
            
            serializer = HealthProfileSerializer(health_profile, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        student = self.get_object()
        student.status = 'Withdrawn'
        student.save()
        return Response({"status": "Student withdrawn"})

    @action(detail=True, methods=['post'])
    def transfer(self, request, pk=None):
        student = self.get_object()
        student.status = 'Transferred'
        student.save()
        return Response({"status": "Student transferred"})

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        student = self.get_object()
        student.status = 'Archived'
        student.save()
        return Response({"status": "Student archived"})

class StudentEmergencyContactViewSet(viewsets.ModelViewSet):
    serializer_class = StudentEmergencyContactSerializer
    permission_classes = [IsDaycareAdmin]
    
    def get_queryset(self):
        student_id = self.kwargs.get('student_pk')
        return StudentEmergencyContact.objects.filter(
            student__id=student_id, 
            student__daycare=self.request.user.daycare
        )

    def perform_create(self, serializer):
        student = get_object_or_404(
            Student, 
            id=self.kwargs.get('student_pk'), 
            daycare=self.request.user.daycare
        )
        serializer.save(student=student, approval_status='Approved')

    @action(detail=True, methods=['post'])
    def approve(self, request, student_pk=None, pk=None):
        contact = self.get_object()
        
        if contact.approval_status == 'Pending_Removal':
            contact.delete()
            return Response({'status': 'Contact removed'})
            
        if contact.pending_changes:
            for k, v in contact.pending_changes.items():
                setattr(contact, k, v)
            contact.pending_changes = None
            
        contact.approval_status = 'Approved'
        contact.save()
        return Response({'status': 'Approved'})
        
    @action(detail=True, methods=['post'])
    def reject(self, request, student_pk=None, pk=None):
        contact = self.get_object()
        
        if contact.approval_status == 'Pending_Removal':
            contact.approval_status = 'Approved'
            contact.save()
            return Response({'status': 'Removal rejected'})
            
        if contact.approval_status == 'Pending':
            contact.approval_status = 'Rejected'
            contact.save()
            return Response({'status': 'Creation rejected'})
            
        if contact.pending_changes:
            contact.pending_changes = None
            contact.approval_status = 'Approved'
            contact.save()
            return Response({'status': 'Changes rejected'})
            
        return Response({'status': 'Nothing to reject'})

class StudentPickupViewSet(viewsets.ModelViewSet):
    serializer_class = StudentPickupSerializer
    permission_classes = [IsDaycareAdmin]
    
    def get_queryset(self):
        student_id = self.kwargs.get('student_pk')
        return StudentPickup.objects.filter(
            student__id=student_id, 
            student__daycare=self.request.user.daycare
        )

    def perform_create(self, serializer):
        student = get_object_or_404(
            Student, 
            id=self.kwargs.get('student_pk'), 
            daycare=self.request.user.daycare
        )
        serializer.save(student=student, approval_status='Approved', id_proof_status='Verified')

    @action(detail=True, methods=['post'])
    def approve(self, request, student_pk=None, pk=None):
        pickup = self.get_object()
        
        if pickup.approval_status == 'Pending_Removal':
            pickup.delete()
            return Response({'status': 'Pickup removed'})
            
        if pickup.pending_changes:
            for k, v in pickup.pending_changes.items():
                setattr(pickup, k, v)
            pickup.pending_changes = None
            
        pickup.approval_status = 'Approved'
        if pickup.id_proof_status == 'Pending':
            pickup.id_proof_status = 'Verified'
        pickup.save()
        return Response({'status': 'Approved'})
        
    @action(detail=True, methods=['post'])
    def reject(self, request, student_pk=None, pk=None):
        pickup = self.get_object()
        
        if pickup.approval_status == 'Pending_Removal':
            pickup.approval_status = 'Approved'
            pickup.save()
            return Response({'status': 'Removal rejected'})
            
        if pickup.approval_status == 'Pending':
            pickup.approval_status = 'Rejected'
            if pickup.id_proof_status == 'Pending':
                pickup.id_proof_status = 'Rejected'
            pickup.save()
            return Response({'status': 'Creation rejected'})
            
        if pickup.pending_changes:
            pickup.pending_changes = None
            pickup.approval_status = 'Approved'
            pickup.save()
            return Response({'status': 'Changes rejected'})
            
        return Response({'status': 'Nothing to reject'})

class StudentDocumentView(viewsets.ViewSet):
    permission_classes = [IsDaycareAdmin]

    def list(self, request, student_pk=None):
        student = get_object_or_404(Student, id=student_pk, daycare=request.user.daycare)
        content_type = ContentType.objects.get_for_model(Student)
        documents = Document.objects.filter(
            daycare=request.user.daycare,
            content_type=content_type,
            object_id=student.id
        )
        serializer = DocumentSerializer(documents, many=True)
        return Response(serializer.data)

    def create(self, request, student_pk=None):
        student = get_object_or_404(Student, id=student_pk, daycare=request.user.daycare)
        content_type = ContentType.objects.get_for_model(Student)
        
        serializer = DocumentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(
                daycare=request.user.daycare,
                content_type=content_type,
                object_id=student.id,
                uploaded_by=request.user
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, student_pk=None, pk=None):
        student = get_object_or_404(Student, id=student_pk, daycare=request.user.daycare)
        content_type = ContentType.objects.get_for_model(Student)
        document = get_object_or_404(
            Document, 
            id=pk, 
            daycare=request.user.daycare, 
            content_type=content_type, 
            object_id=student.id
        )
        document.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
