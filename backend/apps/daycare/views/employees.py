import csv
from datetime import datetime, timedelta
from io import StringIO
import uuid

from django.db.models import Count, Q, F
from django.http import HttpResponse, FileResponse
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import (
    AuditLog, Classroom, ClassroomTeacherAssignment, Employee,
    EmployeeAvailability, EmployeeCertification, EmployeeCompensation,
    EmployeeDocument, EmployeeEmergencyContact, EmployeeQualification,
    EmployeeType, EmploymentHistory, Province, CredentialType, ECECredential
)
from core.permissions import IsDaycareAdmin
from core.serializers import (
    EmployeeAvailabilitySerializer, EmployeeCertificationSerializer,
    EmployeeCompensationSerializer, EmployeeDocumentSerializer,
    EmployeeEmergencyContactSerializer, EmployeeQualificationSerializer,
    EmployeeSerializer, EmployeeTypeSerializer, EmploymentHistorySerializer,
    ProvinceSerializer, CredentialTypeSerializer, ECECredentialSerializer,
    CredentialRejectSerializer, CredentialRenewalSerializer
)




class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, IsDaycareAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'employee_number', 'first_name', 'last_name', 'preferred_name',
        'email', 'job_title', 'role', 'types__name'
    ]
    ordering_fields = ['first_name', 'last_name', 'start_date', 'created_at', 'status']

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare:
            return Employee.objects.none()

        qs = Employee.objects.filter(daycare=daycare).select_related('user').prefetch_related('types')
        
        status_param = self.request.query_params.get('status')
        employment_type = self.request.query_params.get('employment_type')
        employee_type = self.request.query_params.get('employee_type')
        classroom_id = self.request.query_params.get('classroom')
        search = self.request.query_params.get('search')
        qualification = self.request.query_params.get('qualification')
        certification = self.request.query_params.get('certification')

        if status_param:
            qs = qs.filter(status__iexact=status_param)

        if employment_type:
            qs = qs.filter(employment_type=employment_type)
        if employee_type:
            qs = qs.filter(types__id=employee_type)
        if classroom_id:
            qs = qs.filter(classroom_assignments__classroom_id=classroom_id, classroom_assignments__status='Active')
        if qualification:
            qs = qs.filter(qualifications__qualification_name__icontains=qualification)
        if certification:
            qs = qs.filter(certifications__certification_name__icontains=certification)
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(preferred_name__icontains=search) |
                Q(employee_number__icontains=search) |
                Q(email__icontains=search) |
                Q(job_title__icontains=search) |
                Q(types__name__icontains=search) |
                Q(classroom_assignments__classroom__room_name__icontains=search)
            ).distinct()

        return qs.distinct()

    def perform_create(self, serializer):
        daycare = self.request.user.daycare
        employee = serializer.save(daycare=daycare)

        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='EMPLOYEE_CREATED',
            module='employees',
            entity_type='employee',
            entity_id=str(employee.id),
            new_values={
                'employee_number': employee.employee_number,
                'name': f"{employee.first_name} {employee.last_name}",
                'job_title': employee.job_title,
                'status': employee.status
            }
        )

    def perform_update(self, serializer):
        old_instance = self.get_object()
        new_status = serializer.validated_data.get('status', old_instance.status)

        if old_instance.status == 'terminated' and new_status == 'active':
            raise ValidationError({"status": "Cannot directly activate a terminated employee."})

        employee = serializer.save()

        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='EMPLOYEE_UPDATED',
            module='employees',
            entity_type='employee',
            entity_id=str(employee.id),
            new_values={
                'status_changed': old_instance.status != employee.status,
                'old_status': old_instance.status,
                'new_status': employee.status,
                'name': f"{employee.first_name} {employee.last_name}"
            }
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='EMPLOYEE_DELETED',
            module='employees',
            entity_type='employee',
            entity_id=str(instance.id),
            new_values={'employee_number': instance.employee_number, 'name': f"{instance.first_name} {instance.last_name}"}
        )
        instance.delete()

    @action(detail=True, methods=['get', 'post'])
    def emergency_contacts(self, request, pk=None):
        employee = self.get_object()
        if request.method == 'GET':
            contacts = employee.emergency_contacts.all().order_by('-is_primary', 'name')
            serializer = EmployeeEmergencyContactSerializer(contacts, many=True)
            return Response(serializer.data)
        elif request.method == 'POST':
            serializer = EmployeeEmergencyContactSerializer(data=request.data)
            if serializer.is_valid():
                contact = serializer.save(employee=employee)
                AuditLog.objects.create(
                    user=request.user,
                    user_type='DaycareAdmin',
                    action='EMERGENCY_CONTACT_ADDED',
                    module='employees',
                    entity_type='employee_emergency_contact',
                    entity_id=str(contact.id),
                    new_values={'employee': f"{employee.first_name} {employee.last_name}", 'contact_name': contact.name}
                )
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get', 'post', 'put'])
    def availability(self, request, pk=None):
        employee = self.get_object()
        days_order = {'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7}

        if request.method == 'GET':
            availabilities = list(employee.availabilities.all())
            availabilities.sort(key=lambda a: days_order.get(a.day_of_week, 99))
            serializer = EmployeeAvailabilitySerializer(availabilities, many=True)
            return Response(serializer.data)
        elif request.method in ['POST', 'PUT']:
            # Handle either list of day schedules or single item
            data = request.data
            if isinstance(data, list):
                saved = []
                for item in data:
                    day = item.get('day_of_week')
                    if not day:
                        continue
                    start_t = item.get('start_time') or item.get('available_from') or None
                    end_t = item.get('end_time') or item.get('available_to') or None
                    is_avail = item.get('is_available', True)
                    status_val = item.get('status')
                    if not is_avail or status_val == 'Unavailable':
                        status_val = 'Unavailable'
                        is_avail = False
                    elif status_val == 'Custom hours' or (start_t and end_t):
                        status_val = 'Custom hours'
                        is_avail = True
                    elif not status_val:
                        status_val = 'Available'
                        is_avail = True

                    obj, _ = EmployeeAvailability.objects.update_or_create(
                        employee=employee,
                        day_of_week=day,
                        defaults={
                            'start_time': start_t,
                            'end_time': end_t,
                            'is_available': is_avail,
                            'status': status_val,
                            'notes': item.get('notes', '')
                        }
                    )
                    saved.append(obj)

                AuditLog.objects.create(
                    user=request.user,
                    user_type='DaycareAdmin',
                    action='AVAILABILITY_UPDATED',
                    module='employees',
                    entity_type='employee_availability',
                    entity_id=str(employee.id),
                    new_values={'employee': f"{employee.first_name} {employee.last_name}", 'days_updated': len(saved)}
                )
                serializer = EmployeeAvailabilitySerializer(saved, many=True)
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                serializer = EmployeeAvailabilitySerializer(data=data)
                if serializer.is_valid():
                    avail = serializer.save(employee=employee)
                    AuditLog.objects.create(
                        user=request.user,
                        user_type='DaycareAdmin',
                        action='AVAILABILITY_UPDATED',
                        module='employees',
                        entity_type='employee_availability',
                        entity_id=str(avail.id),
                        new_values={'employee': f"{employee.first_name} {employee.last_name}", 'day': avail.day_of_week}
                    )
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get', 'post'], url_path='credentials')
    def credentials(self, request, pk=None):
        employee = self.get_object()
        if request.method == 'GET':
            qs = employee.ece_credentials.all().select_related('credential_type', 'province')
            category_param = request.query_params.get('category')
            if category_param:
                qs = qs.filter(credential_type__category=category_param)
            status_param = request.query_params.get('status')
            if status_param:
                qs = qs.filter(status=status_param)
            province_param = request.query_params.get('province')
            if province_param:
                qs = qs.filter(province__code=province_param)
            expiry_param = request.query_params.get('expiry_date')
            if expiry_param:
                qs = qs.filter(expiry_date__lte=expiry_param)

            serializer = ECECredentialSerializer(qs.order_by('-issue_date', '-created_at'), many=True)
            return Response(serializer.data)
        elif request.method == 'POST':
            serializer = ECECredentialSerializer(data=request.data)
            if serializer.is_valid():
                credential = serializer.save(employee=employee, daycare=request.user.daycare)
                is_ece = (credential.category == 'ece')
                AuditLog.objects.create(
                    user=request.user,
                    user_type='DaycareAdmin',
                    action='ECE_CREDENTIAL_CREATED' if is_ece else 'CREDENTIAL_CREATED',
                    module='employees',
                    entity_type='ece_credential' if is_ece else 'credential',
                    entity_id=str(credential.id),
                    new_values={
                        'employee': f"{employee.first_name} {employee.last_name}",
                        'category': credential.category,
                        'credential_type': credential.credential_type.name,
                        'issuing_organization': credential.issuing_organization,
                        'province': credential.province.name if credential.province else None,
                        'certificate_number': credential.certificate_number,
                        'issue_date': str(credential.issue_date),
                        'expiry_date': str(credential.expiry_date) if credential.expiry_date else None,
                        'status': credential.status
                    }
                )
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=True, methods=['get', 'post'], url_path='ece-credentials')
    def ece_credentials(self, request, pk=None):
        return self.credentials(request, pk)


    @action(detail=True, methods=['get'])
    def classrooms(self, request, pk=None):
        employee = self.get_object()
        assignments = ClassroomTeacherAssignment.objects.filter(
            employee=employee,
            deleted_at__isnull=True
        ).select_related('classroom', 'classroom__branch').order_by('-assigned_date', '-created_at')

        current = []
        history = []
        for a in assignments:
            item = {
                'id': str(a.id),
                'classroom_id': str(a.classroom.id),
                'classroom_name': a.classroom.room_name,
                'classroom_code': a.classroom.room_code,
                'branch_name': a.classroom.branch.name if a.classroom.branch else 'Main Branch',
                'assignment_type': a.assignment_type,
                'status': a.status,
                'assigned_date': a.assigned_date,
                'end_date': a.end_date,
                'created_at': a.created_at
            }
            if a.status == 'Active':
                current.append(item)
            else:
                history.append(item)

        return Response({
            'current_classrooms': current,
            'history': history
        })

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        employee = self.get_object()
        employment_history = EmploymentHistory.objects.filter(employee=employee).order_by('-start_date')
        history_serializer = EmploymentHistorySerializer(employment_history, many=True)

        audit_logs = AuditLog.objects.filter(
            module__in=['employees', 'classrooms'],
            entity_id=str(employee.id)
        ).order_by('-created_at')[:50]

        audit_data = [
            {
                'id': str(log.id),
                'action': log.action,
                'module': log.module,
                'user': log.user.get_full_name() if log.user else 'System',
                'created_at': log.created_at,
                'details': log.new_values or {}
            }
            for log in audit_logs
        ]

        return Response({
            'employment_history': history_serializer.data,
            'audit_logs': audit_data
        })

    @action(detail=True, methods=['get', 'post'])
    def qualifications(self, request, pk=None):
        employee = self.get_object()
        if request.method == 'GET':
            qualifications = employee.qualifications.all().order_by('-created_at')
            serializer = EmployeeQualificationSerializer(qualifications, many=True)
            return Response(serializer.data)
        elif request.method == 'POST':
            serializer = EmployeeQualificationSerializer(data=request.data)
            if serializer.is_valid():
                qual = serializer.save(employee=employee)
                AuditLog.objects.create(
                    user=request.user,
                    user_type='DaycareAdmin',
                    action='QUALIFICATION_ADDED',
                    module='employees',
                    entity_type='employee_qualification',
                    entity_id=str(qual.id),
                    new_values={'employee': f"{employee.first_name} {employee.last_name}", 'qualification': qual.qualification_name}
                )
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get', 'post'])
    def certifications(self, request, pk=None):
        employee = self.get_object()
        if request.method == 'GET':
            certifications = employee.certifications.all().order_by('-created_at')
            serializer = EmployeeCertificationSerializer(certifications, many=True)
            return Response(serializer.data)
        elif request.method == 'POST':
            serializer = EmployeeCertificationSerializer(data=request.data)
            if serializer.is_valid():
                cert = serializer.save(employee=employee)
                AuditLog.objects.create(
                    user=request.user,
                    user_type='DaycareAdmin',
                    action='CERTIFICATION_ADDED',
                    module='employees',
                    entity_type='employee_certification',
                    entity_id=str(cert.id),
                    new_values={'employee': f"{employee.first_name} {employee.last_name}", 'certification': cert.certification_name}
                )
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EmployeeEmergencyContactViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeEmergencyContactSerializer
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare:
            return EmployeeEmergencyContact.objects.none()
        return EmployeeEmergencyContact.objects.filter(employee__daycare=daycare)

    def perform_create(self, serializer):
        employee = serializer.validated_data.get('employee')
        if employee.daycare != self.request.user.daycare:
            raise PermissionDenied("Cannot add emergency contact to an employee in another daycare.")
        contact = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='EMERGENCY_CONTACT_ADDED',
            module='employees',
            entity_type='employee_emergency_contact',
            entity_id=str(contact.id),
            new_values={'employee': f"{employee.first_name} {employee.last_name}", 'name': contact.name}
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='EMERGENCY_CONTACT_DELETED',
            module='employees',
            entity_type='employee_emergency_contact',
            entity_id=str(instance.id),
            new_values={'name': instance.name}
        )
        instance.delete()


class EmployeeAvailabilityViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeAvailabilitySerializer
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare:
            return EmployeeAvailability.objects.none()
        return EmployeeAvailability.objects.filter(employee__daycare=daycare)

    def perform_create(self, serializer):
        employee = serializer.validated_data.get('employee')
        if employee.daycare != self.request.user.daycare:
            raise PermissionDenied("Cannot add availability to an employee in another daycare.")
        serializer.save()


class EmployeeQualificationViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeQualificationSerializer
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare:
            return EmployeeQualification.objects.none()
        return EmployeeQualification.objects.filter(employee__daycare=daycare)

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='QUALIFICATION_DELETED',
            module='employees',
            entity_type='employee_qualification',
            entity_id=str(instance.id),
            new_values={'qualification': instance.qualification_name}
        )
        instance.delete()


class EmployeeCertificationViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeCertificationSerializer
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare:
            return EmployeeCertification.objects.none()
        return EmployeeCertification.objects.filter(employee__daycare=daycare)

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='CERTIFICATION_DELETED',
            module='employees',
            entity_type='employee_certification',
            entity_id=str(instance.id),
            new_values={'certification': instance.certification_name}
        )
        instance.delete()


class EmployeeTypeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeTypeSerializer
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare:
            return EmployeeType.objects.none()
        return EmployeeType.objects.filter(Q(daycare=daycare) | Q(daycare__isnull=True))

    def perform_create(self, serializer):
        daycare = self.request.user.daycare
        emp_type = serializer.save(daycare=daycare)
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='EMPLOYEE_TYPE_CREATED',
            module='employees',
            entity_type='employee_type',
            entity_id=str(emp_type.id),
            new_values={'name': emp_type.name, 'is_eligible_for_classroom': emp_type.is_eligible_for_classroom}
        )


class EmploymentHistoryViewSet(viewsets.ModelViewSet):
    serializer_class = EmploymentHistorySerializer
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare:
            return EmploymentHistory.objects.none()
        return EmploymentHistory.objects.filter(employee__daycare=daycare).order_by('-start_date')

    def perform_create(self, serializer):
        employee = serializer.validated_data.get('employee')
        if employee.daycare != self.request.user.daycare:
            raise PermissionDenied("Cannot add history to an employee in another daycare.")
        history = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='EMPLOYMENT_HISTORY_ADDED',
            module='employees',
            entity_type='employment_history',
            entity_id=str(history.id),
            new_values={'employee': f"{employee.first_name} {employee.last_name}", 'job_title': history.job_title}
        )


class EmployeeCompensationViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeCompensationSerializer
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare:
            return EmployeeCompensation.objects.none()
        return EmployeeCompensation.objects.filter(employee__daycare=daycare).order_by('-created_at')

    def perform_create(self, serializer):
        employee = serializer.validated_data.get('employee')
        if employee.daycare != self.request.user.daycare:
            raise PermissionDenied("Cannot add compensation for an employee in another daycare.")
        comp = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='COMPENSATION_ADDED',
            module='employees',
            entity_type='employee_compensation',
            entity_id=str(comp.id),
            new_values={'employee': f"{employee.first_name} {employee.last_name}", 'pay_type': comp.pay_type}
        )


class EmployeeDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeDocumentSerializer
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare:
            return EmployeeDocument.objects.none()
        return EmployeeDocument.objects.filter(employee__daycare=daycare).order_by('-uploaded_date', '-created_at')

    def perform_create(self, serializer):
        employee = serializer.validated_data.get('employee')
        if employee.daycare != self.request.user.daycare:
            raise PermissionDenied("Cannot add document for an employee in another daycare.")
        doc = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='DOCUMENT_UPLOADED',
            module='employees',
            entity_type='employee_document',
            entity_id=str(doc.id),
            new_values={'employee': f"{employee.first_name} {employee.last_name}", 'document_type': doc.document_type}
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='DOCUMENT_DELETED',
            module='employees',
            entity_type='employee_document',
            entity_id=str(instance.id),
            new_values={'document_type': instance.document_type}
        )
        instance.delete()


class StaffDashboardView(APIView):
    """
    Staff Dashboard API providing aggregate statistics, distributions, alerts,
    and unassigned teaching staff metrics via Django ORM aggregation.
    """
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "Daycare not found."}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.now().date()
        in_60_days = today + timedelta(days=60)
        in_30_days = today + timedelta(days=30)

        # 1. Total and Status Counts
        all_employees = Employee.objects.filter(daycare=daycare)
        status_counts = all_employees.values('status').annotate(count=Count('id'))
        status_map = {item['status']: item['count'] for item in status_counts}

        total_employees = all_employees.count()
        active_employees = status_map.get('active', 0)
        on_leave_employees = status_map.get('on_leave', 0)
        suspended_employees = status_map.get('suspended', 0)
        terminated_employees = status_map.get('terminated', 0)

        # 2. Teaching Roles Counts
        teachers = all_employees.filter(
            Q(role__icontains='Teacher') | Q(job_title__icontains='Teacher') | Q(types__name__icontains='Teacher')
        ).distinct().count()

        eces = all_employees.filter(
            Q(role__icontains='ECE') | Q(job_title__icontains='ECE') | Q(types__name__icontains='ECE') | Q(types__name__icontains='Early Childhood')
        ).distinct().count()

        assistants = all_employees.filter(
            Q(role__icontains='Assistant') | Q(job_title__icontains='Assistant') | Q(types__name__icontains='Assistant')
        ).distinct().count()

        # 3. Expiring Certifications and Documents
        expiring_certs = EmployeeCertification.objects.filter(
            employee__daycare=daycare,
            expiry_date__isnull=False,
            expiry_date__lte=in_60_days
        ).select_related('employee').order_by('expiry_date')

        expiring_docs = EmployeeDocument.objects.filter(
            employee__daycare=daycare,
            expiry_date__isnull=False,
            expiry_date__lte=in_60_days
        ).select_related('employee').order_by('expiry_date')

        certifications_expiring_count = expiring_certs.count()
        documents_expiring_count = expiring_docs.count()

        # 4. Unassigned Teaching Staff
        active_teachers = all_employees.filter(status='active').prefetch_related('types')
        unassigned_teaching_staff = []
        for emp in active_teachers:
            if emp.is_eligible_for_classroom():
                has_assignment = ClassroomTeacherAssignment.objects.filter(
                    employee=emp,
                    status='Active',
                    deleted_at__isnull=True
                ).exists()
                if not has_assignment:
                    unassigned_teaching_staff.append({
                        'id': str(emp.id),
                        'name': f"{emp.first_name} {emp.last_name}",
                        'employee_number': emp.employee_number,
                        'role': emp.job_title or emp.role or 'Teacher',
                        'start_date': emp.start_date
                    })

        # 5. Charts Data: Staff by Type & Status
        type_distribution = []
        employee_types = EmployeeType.objects.filter(Q(daycare=daycare) | Q(daycare__isnull=True))
        for et in employee_types:
            count = all_employees.filter(types=et).count()
            if count > 0:
                type_distribution.append({'name': et.name, 'count': count})

        status_distribution = [
            {'status': 'Active', 'count': active_employees, 'color': '#10B981'},
            {'status': 'On Leave', 'count': on_leave_employees, 'color': '#F59E0B'},
            {'status': 'Suspended', 'count': suspended_employees, 'color': '#EF4444'},
            {'status': 'Terminated', 'count': terminated_employees, 'color': '#6B7280'},
        ]

        # 6. Actionable Alerts
        alerts = []
        # Cert alerts
        for cert in expiring_certs[:15]:
            days_left = (cert.expiry_date - today).days if cert.expiry_date else 0
            severity = 'danger' if days_left < 0 or days_left <= 14 else ('warning' if days_left <= 30 else 'info')
            alerts.append({
                'id': f"cert-{cert.id}",
                'type': 'certification_expiry',
                'severity': severity,
                'title': f"Certification {'Expired' if days_left < 0 else 'Expiring Soon'}: {cert.certification_name}",
                'description': f"{cert.employee.first_name} {cert.employee.last_name}'s {cert.certification_name} expires on {cert.expiry_date} ({days_left} days).",
                'employee_id': str(cert.employee.id),
                'employee_name': f"{cert.employee.first_name} {cert.employee.last_name}",
                'date': cert.expiry_date
            })

        # Doc alerts
        for doc in expiring_docs[:15]:
            days_left = (doc.expiry_date - today).days if doc.expiry_date else 0
            severity = 'danger' if days_left < 0 or days_left <= 14 else ('warning' if days_left <= 30 else 'info')
            alerts.append({
                'id': f"doc-{doc.id}",
                'type': 'document_expiry',
                'severity': severity,
                'title': f"Document {'Expired' if days_left < 0 else 'Expiring Soon'}: {doc.document_type}",
                'description': f"{doc.employee.first_name} {doc.employee.last_name}'s {doc.document_type} expires on {doc.expiry_date}.",
                'employee_id': str(doc.employee.id),
                'employee_name': f"{doc.employee.first_name} {doc.employee.last_name}",
                'date': doc.expiry_date
            })

        # Missing Qualifications for active classroom teachers
        assigned_teachers = Employee.objects.filter(
            daycare=daycare,
            status='active',
            classroom_assignments__status='Active'
        ).distinct()
        for teacher in assigned_teachers:
            if not teacher.qualifications.exists():
                alerts.append({
                    'id': f"missing-qual-{teacher.id}",
                    'type': 'missing_qualification',
                    'severity': 'warning',
                    'title': f"Missing Qualification: {teacher.first_name} {teacher.last_name}",
                    'description': f"Active classroom teacher {teacher.first_name} {teacher.last_name} has no qualifications on record.",
                    'employee_id': str(teacher.id),
                    'employee_name': f"{teacher.first_name} {teacher.last_name}",
                    'date': today
                })

        # Classroom staffing ratio risk
        active_classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True, status='Active')
        for room in active_classrooms:
            active_staff_count = ClassroomTeacherAssignment.objects.filter(
                classroom=room,
                status='Active',
                deleted_at__isnull=True
            ).count()
            if active_staff_count == 0:
                alerts.append({
                    'id': f"ratio-risk-{room.id}",
                    'type': 'classroom_ratio_risk',
                    'severity': 'danger',
                    'title': f"Staffing Risk: Classroom '{room.room_name}' has 0 assigned staff",
                    'description': f"Classroom {room.room_name} has no active primary or assistant teacher assigned.",
                    'classroom_id': str(room.id),
                    'classroom_name': room.room_name,
                    'date': today
                })

        return Response({
            'metrics': {
                'total_employees': total_employees,
                'active_employees': active_employees,
                'on_leave_employees': on_leave_employees,
                'suspended_employees': suspended_employees,
                'terminated_employees': terminated_employees,
                'teachers': teachers,
                'eces': eces,
                'assistants': assistants,
                'certifications_expiring': certifications_expiring_count,
                'documents_expiring': documents_expiring_count,
                'unassigned_teaching_staff_count': len(unassigned_teaching_staff)
            },
            'unassigned_teaching_staff': unassigned_teaching_staff,
            'staff_by_type': type_distribution,
            'staff_by_status': status_distribution,
            'alerts': alerts
        })


class StaffReportsView(APIView):
    """
    Staff Reports View supporting 10 distinct reports:
    1. Employee Directory Report
    2. Employee Status Report
    3. Employee Type Report
    4. Employment History Report
    5. Qualification Report
    6. Certification Expiry Report
    7. Document Expiry Report
    8. Classroom Staff Assignment Report
    9. Staff Availability Report
    10. Compensation Report (Protected: Daycare Admin only)

    Supports filters (type, status, branch, classroom, date_range, search) and formats (json, csv).
    """
    permission_classes = [IsAuthenticated, IsDaycareAdmin]
    format_kwarg = None

    def get(self, request, *args, **kwargs):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "Daycare not found."}, status=status.HTTP_404_NOT_FOUND)

        report_type = request.query_params.get('report_type', 'directory')
        export_format = (request.query_params.get('format') or request.query_params.get('export_format') or 'json').lower()

        status_param = request.query_params.get('status')
        type_param = request.query_params.get('employee_type')
        classroom_param = request.query_params.get('classroom')
        branch_param = request.query_params.get('branch')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        search = request.query_params.get('search')

        # Base employee queryset
        qs = Employee.objects.filter(daycare=daycare).select_related('user').prefetch_related('types')

        if status_param:
            qs = qs.filter(status=status_param)
        if type_param:
            qs = qs.filter(types__id=type_param)
        if classroom_param:
            qs = qs.filter(classroom_assignments__classroom_id=classroom_param, classroom_assignments__status='Active')
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(employee_number__icontains=search) |
                Q(email__icontains=search) |
                Q(job_title__icontains=search)
            )

        headers = []
        rows = []
        report_title = "Staff Report"

        # 1. Directory Report
        if report_type == 'directory':
            report_title = "Employee Directory"
            headers = ["Employee Number", "Name", "Job Title", "Types", "Status", "Email", "Phone", "Start Date"]
            for e in qs.order_by('first_name', 'last_name'):
                types_str = ", ".join([t.name for t in e.types.all()])
                rows.append([
                    e.employee_number,
                    f"{e.first_name} {e.last_name}",
                    e.job_title or e.role or '',
                    types_str,
                    e.status.capitalize(),
                    e.email or '',
                    e.phone or '',
                    str(e.start_date or '')
                ])

        # 2. Status Report
        elif report_type == 'status':
            report_title = "Employee Status Report"
            headers = ["Employee Number", "Name", "Current Status", "Employment Type", "Start Date", "End Date", "Created At"]
            for e in qs.order_by('status', 'first_name'):
                rows.append([
                    e.employee_number,
                    f"{e.first_name} {e.last_name}",
                    e.status.capitalize(),
                    e.employment_type or 'Full-time',
                    str(e.start_date or ''),
                    str(e.end_date or ''),
                    e.created_at.strftime('%Y-%m-%d') if e.created_at else ''
                ])

        # 3. Type Report
        elif report_type == 'type':
            report_title = "Employee Type & Roles Report"
            headers = ["Employee Number", "Name", "Assigned Types", "Classroom Eligible", "Status", "Job Title"]
            for e in qs.order_by('first_name'):
                types_list = [t.name for t in e.types.all()]
                rows.append([
                    e.employee_number,
                    f"{e.first_name} {e.last_name}",
                    ", ".join(types_list) if types_list else 'Unassigned',
                    "Yes" if e.is_eligible_for_classroom() else "No",
                    e.status.capitalize(),
                    e.job_title or ''
                ])

        # 4. Employment History Report
        elif report_type == 'employment_history':
            report_title = "Employment History Report"
            headers = ["Employee Number", "Name", "Job Title", "Employment Type", "Department", "Start Date", "End Date", "Status", "Reason for Change"]
            histories = EmploymentHistory.objects.filter(employee__in=qs).select_related('employee').order_by('-start_date')
            for h in histories:
                rows.append([
                    h.employee.employee_number,
                    f"{h.employee.first_name} {h.employee.last_name}",
                    h.job_title,
                    h.employment_type,
                    h.department or '',
                    str(h.start_date or ''),
                    str(h.end_date or 'Present'),
                    h.status,
                    h.reason_for_change or ''
                ])

        # 5. Qualification Report
        elif report_type == 'qualifications':
            report_title = "Staff Qualification Report"
            headers = ["Employee Number", "Name", "Qualification Name", "Institution", "Type", "Issue Date", "Completion Date", "Status"]
            quals = EmployeeQualification.objects.filter(employee__in=qs).select_related('employee').order_by('employee__first_name', '-completion_date')
            for q in quals:
                rows.append([
                    q.employee.employee_number,
                    f"{q.employee.first_name} {q.employee.last_name}",
                    q.qualification_name,
                    q.institution,
                    q.qualification_type,
                    str(q.issue_date or ''),
                    str(q.completion_date or ''),
                    q.status
                ])

        # 6. Certification Expiry Report
        elif report_type == 'certifications':
            report_title = "Certification Expiry Report"
            headers = ["Employee Number", "Name", "Certification Name", "Issuing Organization", "Cert Number", "Issue Date", "Expiry Date", "Days Remaining", "Status"]
            today = timezone.now().date()
            certs = EmployeeCertification.objects.filter(employee__in=qs).select_related('employee').order_by('expiry_date')
            for c in certs:
                days_remaining = (c.expiry_date - today).days if c.expiry_date else 'N/A'
                rows.append([
                    c.employee.employee_number,
                    f"{c.employee.first_name} {c.employee.last_name}",
                    c.certification_name,
                    c.issuing_organization or '',
                    c.certification_number or '',
                    str(c.issue_date or ''),
                    str(c.expiry_date or 'No Expiry'),
                    str(days_remaining),
                    "Expired" if (c.expiry_date and c.expiry_date < today) else "Valid"
                ])

        # 7. Document Expiry Report
        elif report_type == 'documents':
            report_title = "Document Expiry Report"
            headers = ["Employee Number", "Name", "Document Type", "Uploaded Date", "Expiry Date", "Days Remaining", "Status"]
            today = timezone.now().date()
            docs = EmployeeDocument.objects.filter(employee__in=qs).select_related('employee').order_by('expiry_date')
            for d in docs:
                days_remaining = (d.expiry_date - today).days if d.expiry_date else 'N/A'
                rows.append([
                    d.employee.employee_number,
                    f"{d.employee.first_name} {d.employee.last_name}",
                    d.document_type,
                    str(d.uploaded_date or d.created_at.date() if d.created_at else ''),
                    str(d.expiry_date or 'No Expiry'),
                    str(days_remaining),
                    "Expired" if (d.expiry_date and d.expiry_date < today) else (d.status or 'Active')
                ])

        # 8. Classroom Staff Assignment Report
        elif report_type == 'assignments':
            report_title = "Classroom Staff Assignment Report"
            headers = ["Classroom", "Classroom Code", "Staff Name", "Employee Number", "Role", "Assignment Type", "Assigned Date", "End Date", "Status"]
            assignments = ClassroomTeacherAssignment.objects.filter(
                classroom__daycare=daycare,
                deleted_at__isnull=True
            ).select_related('classroom', 'employee').order_by('classroom__room_name', '-assigned_date')

            if classroom_param:
                assignments = assignments.filter(classroom_id=classroom_param)

            for a in assignments:
                rows.append([
                    a.classroom.room_name,
                    a.classroom.room_code or '',
                    f"{a.employee.first_name} {a.employee.last_name}",
                    a.employee.employee_number,
                    a.employee.job_title or a.employee.role or '',
                    a.assignment_type,
                    str(a.assigned_date or ''),
                    str(a.end_date or 'Current'),
                    a.status
                ])

        # 9. Staff Availability Report
        elif report_type == 'availability':
            report_title = "Staff Availability Report"
            headers = ["Employee Number", "Name", "Day of Week", "Available", "Start Time", "End Time", "Notes"]
            avails = EmployeeAvailability.objects.filter(employee__in=qs).select_related('employee').order_by('employee__first_name', 'day_of_week')
            for a in avails:
                rows.append([
                    a.employee.employee_number,
                    f"{a.employee.first_name} {a.employee.last_name}",
                    a.day_of_week,
                    "Yes" if a.is_available else "No",
                    str(a.start_time or ''),
                    str(a.end_time or ''),
                    a.notes or ''
                ])

        # 10. Compensation Report (Protected: Daycare Admin only)
        elif report_type == 'compensation':
            report_title = "Staff Compensation Report"
            headers = ["Employee Number", "Name", "Pay Type", "Salary Amount", "Hourly Rate", "Currency", "Effective From", "Effective To", "Status"]
            comps = EmployeeCompensation.objects.filter(employee__in=qs).select_related('employee').order_by('employee__first_name', '-created_at')
            for c in comps:
                rows.append([
                    c.employee.employee_number,
                    f"{c.employee.first_name} {c.employee.last_name}",
                    c.pay_type or '',
                    str(c.salary_amount or '0.00'),
                    str(c.hourly_rate or '0.00'),
                    c.currency or 'USD',
                    str(c.effective_from or ''),
                    str(c.effective_to or 'Present'),
                    c.status or 'Active'
                ])

        else:
            return Response({"detail": f"Unknown report type: {report_type}"}, status=status.HTTP_400_BAD_REQUEST)

        # Handle CSV Export
        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            filename = f"{report_type}_report_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            writer = csv.writer(response)
            writer.writerow([f"KidSynq - {report_title}"])
            writer.writerow([f"Generated at: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}", f"Daycare: {daycare.name}"])
            writer.writerow([])
            writer.writerow(headers)
            for row in rows:
                writer.writerow(row)
            return response

        # Return JSON
        return Response({
            'report_type': report_type,
            'title': report_title,
            'total_records': len(rows),
            'headers': headers,
            'rows': rows
        })


class ProvinceListView(APIView):
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get(self, request):
        provinces = Province.objects.filter(status='Active').order_by('name')
        serializer = ProvinceSerializer(provinces, many=True)
        return Response(serializer.data)


class CredentialTypeListView(APIView):
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get(self, request):
        province_param = request.query_params.get('province')
        category_param = request.query_params.get('category')
        qs = CredentialType.objects.filter(status='Active').select_related('province').order_by('category', 'name')
        if category_param:
            qs = qs.filter(category=category_param)
        if province_param:
            qs = qs.filter(Q(province__code=province_param) | Q(province__id=province_param) | Q(province__isnull=True))
        serializer = CredentialTypeSerializer(qs, many=True)
        return Response(serializer.data)


class ECECredentialViewSet(viewsets.ModelViewSet):
    serializer_class = ECECredentialSerializer
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare:
            return ECECredential.objects.none()
        qs = ECECredential.objects.filter(daycare=daycare).select_related('employee', 'credential_type', 'province')
        
        employee_param = self.request.query_params.get('employee')
        if employee_param:
            qs = qs.filter(employee_id=employee_param)
            
        category_param = self.request.query_params.get('category')
        if category_param:
            qs = qs.filter(credential_type__category=category_param)

        province_param = self.request.query_params.get('province')
        if province_param:
            qs = qs.filter(province__code=province_param)
            
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        expiry_param = self.request.query_params.get('expiry_date')
        if expiry_param:
            qs = qs.filter(expiry_date__lte=expiry_param)

        return qs.order_by('-issue_date', '-created_at')

    def perform_create(self, serializer):
        daycare = self.request.user.daycare
        employee = serializer.validated_data.get('employee')
        if employee and employee.daycare != daycare:
            raise PermissionDenied("Cannot add credentials for an employee belonging to another daycare.")
        
        credential = serializer.save(daycare=daycare)
        is_ece = (credential.category == 'ece')
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='ECE_CREDENTIAL_CREATED' if is_ece else 'CREDENTIAL_CREATED',
            module='employees',
            entity_type='ece_credential' if is_ece else 'credential',
            entity_id=str(credential.id),
            new_values={
                'employee': f"{credential.employee.first_name} {credential.employee.last_name}",
                'category': credential.category,
                'credential_type': credential.credential_type.name,
                'issuing_organization': credential.issuing_organization,
                'province': credential.province.name if credential.province else None,
                'certificate_number': credential.certificate_number,
                'status': credential.status
            }
        )

    def perform_update(self, serializer):
        credential = serializer.save()
        is_ece = (credential.category == 'ece')
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='ECE_CREDENTIAL_UPDATED' if is_ece else 'CREDENTIAL_UPDATED',
            module='employees',
            entity_type='ece_credential' if is_ece else 'credential',
            entity_id=str(credential.id),
            new_values={
                'employee': f"{credential.employee.first_name} {credential.employee.last_name}",
                'category': credential.category,
                'credential_type': credential.credential_type.name,
                'issuing_organization': credential.issuing_organization,
                'province': credential.province.name if credential.province else None,
                'certificate_number': credential.certificate_number,
                'status': credential.status,
                'verification_status': credential.verification_status
            }
        )

    def perform_destroy(self, instance):
        is_ece = (instance.category == 'ece')
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='ECE_CREDENTIAL_DELETED' if is_ece else 'CREDENTIAL_DELETED',
            module='employees',
            entity_type='ece_credential' if is_ece else 'credential',
            entity_id=str(instance.id),
            new_values={
                'employee': f"{instance.employee.first_name} {instance.employee.last_name}",
                'category': instance.category,
                'credential_type': instance.credential_type.name,
                'certificate_number': instance.certificate_number
            }
        )
        instance.delete()

    @action(detail=True, methods=['post'], url_path='verify')
    def verify(self, request, pk=None):
        credential = self.get_object()
        credential.verification_status = 'Verified'
        credential.document_status = 'verified'
        credential.verified_by = request.user
        credential.verified_at = timezone.now()
        credential.rejection_reason = None
        if credential.status in ['Pending Review', 'Requires Review', 'Pending Verification']:
            credential.status = 'Active'
        credential.save()

        is_ece = (credential.category == 'ece')
        AuditLog.objects.create(
            user=request.user,
            user_type='DaycareAdmin',
            action='ECE_CREDENTIAL_VERIFIED' if is_ece else 'CREDENTIAL_VERIFIED',
            module='employees',
            entity_type='ece_credential' if is_ece else 'credential',
            entity_id=str(credential.id),
            new_values={
                'employee': f"{credential.employee.first_name} {credential.employee.last_name}",
                'credential_type': credential.credential_type.name,
                'verification_status': 'Verified',
                'verified_by': request.user.username
            }
        )
        return Response(self.get_serializer(credential).data)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        credential = self.get_object()
        serializer = CredentialRejectSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        rejection_reason = serializer.validated_data['rejection_reason']
        credential.verification_status = 'Rejected'
        credential.document_status = 'rejected'
        credential.rejection_reason = rejection_reason
        credential.verified_by = request.user
        credential.verified_at = timezone.now()
        credential.save()

        is_ece = (credential.category == 'ece')
        AuditLog.objects.create(
            user=request.user,
            user_type='DaycareAdmin',
            action='ECE_CREDENTIAL_REJECTED' if is_ece else 'CREDENTIAL_REJECTED',
            module='employees',
            entity_type='ece_credential' if is_ece else 'credential',
            entity_id=str(credential.id),
            new_values={
                'employee': f"{credential.employee.first_name} {credential.employee.last_name}",
                'credential_type': credential.credential_type.name,
                'verification_status': 'Rejected',
                'rejection_reason': rejection_reason,
                'verified_by': request.user.username
            }
        )
        return Response(self.get_serializer(credential).data)

    @action(detail=True, methods=['post'], url_path='renew')
    def renew(self, request, pk=None):
        old_credential = self.get_object()
        serializer = CredentialRenewalSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        val = serializer.validated_data

        # Mark old credential as Superseded
        old_credential.status = 'Superseded'
        old_credential.is_current = False
        old_credential.save()

        # Create new credential
        new_credential = ECECredential.objects.create(
            employee=old_credential.employee,
            daycare=old_credential.daycare,
            credential_type=old_credential.credential_type,
            province=old_credential.province,
            certificate_number=val.get('certificate_number') or old_credential.certificate_number,
            issuing_organization=val.get('issuing_organization') or old_credential.issuing_organization,
            issue_date=val['issue_date'],
            expiry_date=val.get('expiry_date'),
            renewal_date=val.get('renewal_date'),
            document=val.get('document'),
            document_reference=val.get('document_reference'),
            document_status='uploaded' if (val.get('document') or val.get('document_reference')) else 'uploaded',
            status='Active',
            verification_status='Pending Verification',
            previous_credential=old_credential,
            is_current=True,
            notes=val.get('notes')
        )

        is_ece = (new_credential.category == 'ece')
        AuditLog.objects.create(
            user=request.user,
            user_type='DaycareAdmin',
            action='ECE_CREDENTIAL_RENEWED' if is_ece else 'CREDENTIAL_RENEWED',
            module='employees',
            entity_type='ece_credential' if is_ece else 'credential',
            entity_id=str(new_credential.id),
            new_values={
                'employee': f"{new_credential.employee.first_name} {new_credential.employee.last_name}",
                'credential_type': new_credential.credential_type.name,
                'previous_credential_id': str(old_credential.id),
                'new_issue_date': str(new_credential.issue_date),
                'new_expiry_date': str(new_credential.expiry_date) if new_credential.expiry_date else None,
                'status': new_credential.status
            }
        )

        return Response(self.get_serializer(new_credential).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        target = self.get_object()

        # Traverse backward to find root
        root = target
        visited = set()
        while root.previous_credential and root.id not in visited:
            visited.add(root.id)
            root = root.previous_credential

        # Traverse forward from root
        lineage = []
        curr = root
        visited_forward = set()
        while curr and curr.id not in visited_forward:
            visited_forward.add(curr.id)
            lineage.append(curr)
            curr = ECECredential.objects.filter(previous_credential=curr).first()

        serializer = self.get_serializer(lineage, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='document')
    def document(self, request, pk=None):
        credential = self.get_object()
        if credential.document:
            import mimetypes
            content_type, _ = mimetypes.guess_type(credential.document.name)
            return FileResponse(credential.document.open('rb'), content_type=content_type or 'application/octet-stream')
        elif credential.document_reference:
            from django.http import HttpResponseRedirect
            return HttpResponseRedirect(credential.document_reference)
        return Response({'detail': 'No document attached to this credential.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='upload-document')
    def upload_document(self, request, pk=None):
        credential = self.get_object()
        file_obj = request.FILES.get('document') or request.data.get('document')
        if not file_obj:
            return Response({'detail': 'No document file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        credential.document = file_obj
        credential.document_status = 'pending_review'
        credential.save()

        is_ece = (credential.category == 'ece')
        AuditLog.objects.create(
            user=request.user,
            user_type='DaycareAdmin',
            action='CREDENTIAL_DOCUMENT_UPLOADED',
            module='employees',
            entity_type='ece_credential' if is_ece else 'credential',
            entity_id=str(credential.id),
            new_values={
                'employee': f"{credential.employee.first_name} {credential.employee.last_name}",
                'credential_type': credential.credential_type.name,
                'filename': str(file_obj)
            }
        )
        return Response(self.get_serializer(credential).data)

    @action(detail=False, methods=['get'], url_path='expiring')
    def expiring(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({'threshold_days': 30, 'count': 0, 'results': []})

        try:
            days = int(request.query_params.get('days', 30))
        except (ValueError, TypeError):
            days = 30

        today = timezone.now().date()
        target_date = today + timedelta(days=days)

        qs = ECECredential.objects.filter(
            daycare=daycare,
            is_current=True,
            expiry_date__isnull=False,
            expiry_date__lte=target_date,
            expiry_date__gte=today
        ).exclude(status__in=['Superseded', 'Inactive', 'Revoked', 'Expired'])

        category_param = request.query_params.get('category')
        if category_param:
            qs = qs.filter(credential_type__category=category_param)

        qs = qs.select_related('employee', 'credential_type', 'province').order_by('expiry_date')
        serializer = self.get_serializer(qs, many=True)
        # Augment with days_remaining
        data = []
        for item in serializer.data:
            exp_str = item.get('expiry_date')
            days_diff = None
            if exp_str:
                exp_date = datetime.strptime(exp_str, '%Y-%m-%d').date()
                days_diff = (exp_date - today).days
            item['days_remaining'] = days_diff
            item['status_label'] = "Expired" if (days_diff is not None and days_diff < 0) else ("Expiring Soon" if (days_diff is not None and days_diff <= 30) else "Expiring in 60d")
            data.append(item)

        return Response({
            'threshold_days': days,
            'count': len(data),
            'results': data
        })


from daycare.services.compliance import ComplianceService


class CredentialComplianceDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "User is not assigned to a daycare."}, status=status.HTTP_400_BAD_REQUEST)

        filters = {
            'employee': request.query_params.get('employee'),
            'credential_type': request.query_params.get('credential_type'),
            'category': request.query_params.get('category'),
            'province': request.query_params.get('province'),
            'branch': request.query_params.get('branch'),
            'classroom': request.query_params.get('classroom'),
            'expiry_period': request.query_params.get('expiry_period')
        }
        filters = {k: v for k, v in filters.items() if v}

        stats = ComplianceService.get_compliance_stats(daycare, filters=filters)
        return Response(stats)


class SendComplianceAlertsView(APIView):
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def post(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "User is not assigned to a daycare."}, status=status.HTTP_400_BAD_REQUEST)

        result = ComplianceService.send_compliance_alerts(daycare, request.user)
        return Response(result, status=status.HTTP_200_OK)


class CredentialReportsView(APIView):
    """
    Generates 12 standard compliance and credential reports with multi-parameter filtering
    and CSV export support.
    """
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "User is not assigned to a daycare."}, status=status.HTTP_400_BAD_REQUEST)

        report_type = request.query_params.get('report_type', 'ece')
        export_format = request.query_params.get('export_format', 'json').lower()

        filters = {
            'employee': request.query_params.get('employee'),
            'credential_type': request.query_params.get('credential_type'),
            'province': request.query_params.get('province'),
            'branch': request.query_params.get('branch'),
            'classroom': request.query_params.get('classroom'),
            'status': request.query_params.get('status'),
            'expiry_period': request.query_params.get('expiry_period'),
            'start_date': request.query_params.get('start_date'),
            'end_date': request.query_params.get('end_date'),
            'search': request.query_params.get('search'),
        }
        filters = {k: v for k, v in filters.items() if v}

        report_data = ComplianceService.generate_credential_report(daycare, report_type, filters)

        # Handle CSV Export
        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            filename = f"credential_{report_type}_report_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            writer = csv.writer(response)
            writer.writerow([f"KIDSYNQ - {report_data['title'].upper()}"])
            writer.writerow([f"Daycare: {daycare.name}", f"Generated: {timezone.now().strftime('%Y-%m-%d %H:%M')}"])
            writer.writerow([])
            writer.writerow(report_data['columns'])

            for row in report_data['rows']:
                writer.writerow(row)

            return response

        return Response(report_data)


class EmployeeCredentialHistoryView(APIView):
    """
    Returns full chronological credential history and audit log lifecycle for an employee.
    Strict tenant isolation and permission check.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        daycare = request.user.daycare
        if not daycare and not request.user.is_superuser:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # Check guardian
        if not request.user.is_staff and not request.user.is_superuser and getattr(request.user, 'role', '') == 'Guardian':
            return Response({"detail": "Forbidden: Guardians cannot view staff credential history."}, status=status.HTTP_403_FORBIDDEN)

        try:
            if request.user.is_superuser:
                employee = Employee.objects.get(pk=pk)
            else:
                employee = Employee.objects.get(pk=pk, daycare=daycare)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        # If standard staff / teacher, only allow viewing their own profile
        if not request.user.is_staff and not request.user.is_superuser:
            if not hasattr(request.user, 'employee_profile') or str(request.user.employee_profile.id) != str(employee.id):
                return Response({"detail": "Forbidden: You may only view your own credential history."}, status=status.HTTP_403_FORBIDDEN)

        history = ComplianceService.get_employee_credential_history(employee)
        return Response({
            'employee_id': str(employee.id),
            'employee_name': f"{employee.first_name} {employee.last_name}".strip(),
            'employee_number': employee.employee_number,
            'count': len(history),
            'history': history
        })


class EmployeeComplianceProfileView(APIView):
    """
    Returns structured compliance checklist profile for an employee.
    Strict tenant isolation and role permission check.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        daycare = request.user.daycare
        if not daycare and not request.user.is_superuser:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # Block guardians
        if not request.user.is_staff and not request.user.is_superuser and getattr(request.user, 'role', '') == 'Guardian':
            return Response({"detail": "Forbidden: Guardians cannot view employee compliance profiles."}, status=status.HTTP_403_FORBIDDEN)

        try:
            if request.user.is_superuser:
                employee = Employee.objects.get(pk=pk)
            else:
                employee = Employee.objects.get(pk=pk, daycare=daycare)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        # If regular staff user, ensure own profile
        if not request.user.is_staff and not request.user.is_superuser:
            if not hasattr(request.user, 'employee_profile') or str(request.user.employee_profile.id) != str(employee.id):
                return Response({"detail": "Forbidden: You may only view your own compliance profile."}, status=status.HTTP_403_FORBIDDEN)

        profile = ComplianceService.get_employee_compliance_profile(employee)
        return Response(profile)






