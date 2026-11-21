from rest_framework import viewsets, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from datetime import datetime, date, timedelta
from django.utils import timezone


from core.models import (
    Daycare, Employee, Classroom, LeaveType, LeaveRequest,
    StaffShortageAlert, StaffNotification
)
from core.serializers import (
    LeaveTypeSerializer, LeaveRequestSerializer,
    StaffShortageAlertSerializer, StaffNotificationSerializer
)
from core.permissions import IsDaycareAdmin
from daycare.services.scheduling import LeaveService, ShortageDetectionService, NotificationService


class LeaveTypeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsDaycareAdmin]
    serializer_class = LeaveTypeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active', 'is_paid', 'requires_approval']
    search_fields = ['name', 'code']

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare:
            return LeaveType.objects.none()
        LeaveService.get_or_create_default_leave_types(daycare)
        return LeaveType.objects.filter(daycare=daycare)

    def perform_create(self, serializer):
        serializer.save(daycare=self.request.user.daycare)


class LeaveRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveRequestSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['employee', 'status', 'leave_type']
    search_fields = ['employee__first_name', 'employee__last_name', 'reason', 'notes']
    ordering_fields = ['start_date', 'requested_at', 'status']
    ordering = ['-requested_at']

    def get_queryset(self):
        user = self.request.user
        daycare = user.daycare
        if not daycare:
            return LeaveRequest.objects.none()

        qs = LeaveRequest.objects.filter(daycare=daycare)

        # Non-admin employee sees only their own requests
        if not (user.is_staff or user.is_superuser):
            emp = getattr(user, 'employee_profile', None) or Employee.objects.filter(daycare=daycare, email=user.email).first()
            if emp:
                qs = qs.filter(employee=emp)
            else:
                return LeaveRequest.objects.none()

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(end_date__gte=start_date)
        if end_date:
            qs = qs.filter(start_date__lte=end_date)

        return qs

    def create(self, request, *args, **kwargs):
        daycare = request.user.daycare
        emp_id = request.data.get('employee')
        leave_type_id = request.data.get('leave_type')
        start_date_str = request.data.get('start_date')
        end_date_str = request.data.get('end_date')
        reason = request.data.get('reason', '')
        notes = request.data.get('notes', '')

        # Default employee if logged in as regular staff
        if not emp_id and not (request.user.is_staff or request.user.is_superuser):
            emp = getattr(request.user, 'employee_profile', None) or Employee.objects.filter(daycare=daycare, email=request.user.email).first()
            if emp:
                emp_id = str(emp.id)

        if not emp_id or not leave_type_id or not start_date_str or not end_date_str:
            return Response({
                "detail": "employee, leave_type, start_date, and end_date are required."
            }, status=status.HTTP_400_BAD_REQUEST)

        emp = get_object_or_404(Employee, id=emp_id, daycare=daycare)
        leave_type = get_object_or_404(LeaveType, id=leave_type_id, daycare=daycare)

        try:
            s_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            e_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        leave_req = LeaveService.create_leave_request(
            daycare=daycare,
            employee=emp,
            leave_type=leave_type,
            start_date=s_date,
            end_date=e_date,
            reason=reason,
            notes=notes
        )

        return Response(LeaveRequestSerializer(leave_req).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        leave_req = self.get_object()
        review_notes = request.data.get('notes', '')
        leave_req = LeaveService.approve_leave_request(
            leave_request=leave_req,
            user=request.user,
            review_notes=review_notes
        )
        return Response(LeaveRequestSerializer(leave_req).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        leave_req = self.get_object()
        rejection_reason = request.data.get('rejection_reason', '')
        leave_req = LeaveService.reject_leave_request(
            leave_request=leave_req,
            user=request.user,
            rejection_reason=rejection_reason
        )
        return Response(LeaveRequestSerializer(leave_req).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        leave_req = self.get_object()
        leave_req = LeaveService.cancel_leave_request(
            leave_request=leave_req,
            user=request.user
        )
        return Response(LeaveRequestSerializer(leave_req).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='calendar')
    def calendar(self, request):
        """
        Returns approved leave records formatted for calendar rendering.
        """
        daycare = request.user.daycare
        start_date = request.query_params.get('start_date', date.today().replace(day=1).isoformat())
        end_date = request.query_params.get('end_date', (date.today() + timedelta(days=31)).isoformat())

        leaves = LeaveRequest.objects.filter(
            daycare=daycare,
            status='approved',
            end_date__gte=start_date,
            start_date__lte=end_date
        )

        serializer = LeaveRequestSerializer(leaves, many=True)
        return Response(serializer.data)


class StaffShortageViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsDaycareAdmin]
    serializer_class = StaffShortageAlertSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'alert_level', 'classroom', 'date']
    ordering_fields = ['date', 'created_at', 'alert_level']
    ordering = ['-date', '-created_at']

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare:
            return StaffShortageAlert.objects.none()
        qs = StaffShortageAlert.objects.filter(daycare=daycare)
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(date__gte=start_date)
        if end_date:
            qs = qs.filter(date__lte=end_date)
        return qs

    @action(detail=False, methods=['post'], url_path='scan')
    def scan_range(self, request):
        """
        Scans a date range to detect shortages and calculate ratio compliance.
        """
        daycare = request.user.daycare
        start_date_str = request.data.get('start_date', timezone.now().date().isoformat())
        end_date_str = request.data.get('end_date', (timezone.now().date() + timedelta(days=14)).isoformat())

        try:
            s_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            e_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        alerts = ShortageDetectionService.detect_shortages_range(daycare, s_date, e_date)
        serializer = StaffShortageAlertSerializer(alerts, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve_alert(self, request, pk=None):
        alert = self.get_object()
        new_status = request.data.get('status', 'resolved')
        if new_status not in ['acknowledged', 'resolved', 'active']:
            return Response({"status": "Invalid status value."}, status=status.HTTP_400_BAD_REQUEST)
        alert.status = new_status
        alert.save()
        return Response(StaffShortageAlertSerializer(alert).data, status=status.HTTP_200_OK)


class StaffMyLeaveView(APIView):
    """
    Staff portal endpoint to view personal leave requests, leave types, and submit new requests.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        daycare = user.daycare
        emp = getattr(user, 'employee_profile', None) or Employee.objects.filter(daycare=daycare, email=user.email).first()

        if not emp:
            return Response({"detail": "No employee profile found for this account."}, status=status.HTTP_404_NOT_FOUND)

        requests_qs = LeaveRequest.objects.filter(daycare=daycare, employee=emp)
        types_qs = LeaveService.get_or_create_default_leave_types(daycare)

        return Response({
            'employee_id': str(emp.id),
            'employee_name': f"{emp.first_name} {emp.last_name}",
            'leave_types': LeaveTypeSerializer(types_qs, many=True).data,
            'leave_requests': LeaveRequestSerializer(requests_qs, many=True).data
        })

    def post(self, request):
        user = request.user
        daycare = user.daycare
        emp = getattr(user, 'employee_profile', None) or Employee.objects.filter(daycare=daycare, email=user.email).first()

        if not emp:
            return Response({"detail": "No employee profile found for this account."}, status=status.HTTP_404_NOT_FOUND)

        leave_type_id = request.data.get('leave_type')
        start_date_str = request.data.get('start_date')
        end_date_str = request.data.get('end_date')
        reason = request.data.get('reason', '')
        notes = request.data.get('notes', '')

        if not leave_type_id or not start_date_str or not end_date_str:
            return Response({"detail": "leave_type, start_date, and end_date are required."}, status=status.HTTP_400_BAD_REQUEST)

        leave_type = get_object_or_404(LeaveType, id=leave_type_id, daycare=daycare)

        try:
            s_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            e_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        leave_req = LeaveService.create_leave_request(
            daycare=daycare,
            employee=emp,
            leave_type=leave_type,
            start_date=s_date,
            end_date=e_date,
            reason=reason,
            notes=notes
        )

        return Response(LeaveRequestSerializer(leave_req).data, status=status.HTTP_201_CREATED)


class StaffNotificationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = StaffNotificationSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['is_read', 'notification_type']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        daycare = user.daycare
        if not daycare:
            return StaffNotification.objects.none()

        qs = StaffNotification.objects.filter(daycare=daycare)
        if user.is_staff or user.is_superuser:
            qs = qs.filter(user=user)
        else:
            emp = getattr(user, 'employee_profile', None) or Employee.objects.filter(daycare=daycare, email=user.email).first()
            if emp:
                qs = qs.filter(employee=emp)
            else:
                return StaffNotification.objects.none()

        return qs

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save()
        return Response(StaffNotificationSerializer(notif).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        qs = self.get_queryset().filter(is_read=False)
        count = qs.count()
        qs.update(is_read=True)
        return Response({"marked_read_count": count}, status=status.HTTP_200_OK)
