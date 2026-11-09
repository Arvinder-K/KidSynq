import logging
from datetime import datetime, date
from rest_framework import status, views, permissions
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.shortcuts import get_object_or_404
from django.utils import timezone

from core.models import Daycare, Employee, StaffAttendance, AuditLog
from core.serializers import StaffAttendanceSerializer, StaffBreakSerializer, AuditLogSerializer
from daycare.services.staff_attendance import StaffAttendanceService

logger = logging.getLogger(__name__)


class BaseStaffAttendanceAPIView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_daycare(self, request) -> Daycare:
        if hasattr(request.user, 'daycare') and request.user.daycare:
            return request.user.daycare
        # Platform admin fallback
        daycare_id = request.query_params.get('daycare_id') or request.data.get('daycare_id')
        if daycare_id:
            return get_object_or_404(Daycare, pk=daycare_id)
        first_daycare = Daycare.objects.first()
        if first_daycare:
            return first_daycare
        raise ValidationError({"daycare": "No active daycare associated with user."})

    def check_manager_permission(self, request):
        user = request.user
        is_admin = user.is_staff or user.is_superuser or getattr(user, 'role', '') in ('Daycare Admin', 'Owner', 'Director', 'Manager')
        if not is_admin:
            raise PermissionDenied("You do not have administrative permission to perform this action.")


class StaffClockInView(BaseStaffAttendanceAPIView):
    def post(self, request):
        daycare = self.get_daycare(request)
        employee_id = request.data.get('employee_id')
        
        # If employee_id not provided, try to resolve from logged-in user
        if not employee_id:
            emp = StaffAttendanceService.resolve_user_employee(daycare, request.user)
            if emp:
                employee_id = str(emp.id)
            else:
                raise ValidationError({"employee_id": "Employee ID is required."})

        # Check security: staff can only clock in for themselves unless admin
        is_admin = request.user.is_staff or getattr(request.user, 'role', '') in ('Daycare Admin', 'Owner', 'Director', 'Manager')
        if not is_admin:
            emp = StaffAttendanceService.resolve_user_employee(daycare, request.user)
            if not emp or str(emp.id) != str(employee_id):
                raise PermissionDenied("You can only record clock-in for your own profile.")

        attendance = StaffAttendanceService.clock_in(
            daycare=daycare,
            employee_id=employee_id,
            user=request.user,
            branch_id=request.data.get('branch_id'),
            classroom_id=request.data.get('classroom_id'),
            custom_datetime=request.data.get('clock_in') or request.data.get('datetime'),
            notes=request.data.get('notes')
        )
        return Response(StaffAttendanceSerializer(attendance).data, status=status.HTTP_201_CREATED)


class StaffClockOutView(BaseStaffAttendanceAPIView):
    def post(self, request):
        daycare = self.get_daycare(request)
        attendance_id = request.data.get('attendance_id')

        if not attendance_id:
            # Try to find active clock-in for user
            emp = StaffAttendanceService.resolve_user_employee(daycare, request.user)
            if emp:
                open_att = StaffAttendance.objects.filter(employee=emp, clock_in__isnull=False, clock_out__isnull=True).order_by('-clock_in').first()
                if open_att:
                    attendance_id = str(open_att.id)
            if not attendance_id:
                raise ValidationError({"attendance_id": "Active Attendance ID is required to clock out."})

        # Permission check
        is_admin = request.user.is_staff or getattr(request.user, 'role', '') in ('Daycare Admin', 'Owner', 'Director', 'Manager')
        if not is_admin:
            att = get_object_or_404(StaffAttendance, pk=attendance_id, daycare=daycare)
            if att.employee.user != request.user:
                raise PermissionDenied("You can only clock out from your own attendance record.")

        attendance = StaffAttendanceService.clock_out(
            daycare=daycare,
            attendance_id=attendance_id,
            user=request.user,
            custom_datetime=request.data.get('clock_out') or request.data.get('datetime'),
            notes=request.data.get('notes')
        )
        return Response(StaffAttendanceSerializer(attendance).data, status=status.HTTP_200_OK)


class StaffStartBreakView(BaseStaffAttendanceAPIView):
    def post(self, request):
        daycare = self.get_daycare(request)
        attendance_id = request.data.get('attendance_id')

        if not attendance_id:
            emp = StaffAttendanceService.resolve_user_employee(daycare, request.user)
            if emp:
                open_att = StaffAttendance.objects.filter(employee=emp, clock_in__isnull=False, clock_out__isnull=True).order_by('-clock_in').first()
                if open_att:
                    attendance_id = str(open_att.id)
            if not attendance_id:
                raise ValidationError({"attendance_id": "Active Attendance ID is required to start a break."})

        # Permission check
        is_admin = request.user.is_staff or getattr(request.user, 'role', '') in ('Daycare Admin', 'Owner', 'Director', 'Manager')
        if not is_admin:
            att = get_object_or_404(StaffAttendance, pk=attendance_id, daycare=daycare)
            if att.employee.user != request.user:
                raise PermissionDenied("You can only manage breaks for your own attendance record.")

        staff_break = StaffAttendanceService.start_break(
            daycare=daycare,
            attendance_id=attendance_id,
            break_type=request.data.get('break_type', 'MEAL'),
            is_paid=request.data.get('is_paid', False),
            user=request.user,
            custom_datetime=request.data.get('break_start') or request.data.get('datetime'),
            notes=request.data.get('notes')
        )
        return Response(StaffBreakSerializer(staff_break).data, status=status.HTTP_201_CREATED)


class StaffEndBreakView(BaseStaffAttendanceAPIView):
    def post(self, request):
        daycare = self.get_daycare(request)
        attendance_id = request.data.get('attendance_id')
        break_id = request.data.get('break_id')

        if not attendance_id:
            emp = StaffAttendanceService.resolve_user_employee(daycare, request.user)
            if emp:
                open_att = StaffAttendance.objects.filter(employee=emp, clock_in__isnull=False, clock_out__isnull=True).order_by('-clock_in').first()
                if open_att:
                    attendance_id = str(open_att.id)
            if not attendance_id:
                raise ValidationError({"attendance_id": "Active Attendance ID is required to end a break."})

        # Permission check
        is_admin = request.user.is_staff or getattr(request.user, 'role', '') in ('Daycare Admin', 'Owner', 'Director', 'Manager')
        if not is_admin:
            att = get_object_or_404(StaffAttendance, pk=attendance_id, daycare=daycare)
            if att.employee.user != request.user:
                raise PermissionDenied("You can only manage breaks for your own attendance record.")

        staff_break = StaffAttendanceService.end_break(
            daycare=daycare,
            attendance_id=attendance_id,
            break_id=break_id,
            user=request.user,
            custom_datetime=request.data.get('break_end') or request.data.get('datetime'),
            notes=request.data.get('notes')
        )
        return Response(StaffBreakSerializer(staff_break).data, status=status.HTTP_200_OK)


class StaffAttendanceDashboardView(BaseStaffAttendanceAPIView):
    def get(self, request):
        daycare = self.get_daycare(request)
        date_str = request.query_params.get('date')
        target_date = None
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                raise ValidationError({"date": "Invalid date format. Use YYYY-MM-DD."})

        dashboard_data = StaffAttendanceService.get_staff_attendance_dashboard(
            daycare=daycare,
            target_date=target_date,
            classroom_id=request.query_params.get('classroom_id'),
            branch_id=request.query_params.get('branch_id')
        )
        return Response(dashboard_data, status=status.HTTP_200_OK)


class StaffTimesheetsListView(BaseStaffAttendanceAPIView):
    def get(self, request):
        daycare = self.get_daycare(request)
        
        start_date = None
        start_date_str = request.query_params.get('start_date')
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        end_date = None
        end_date_str = request.query_params.get('end_date')
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        timesheets = StaffAttendanceService.get_timesheets_list(
            daycare=daycare,
            start_date=start_date,
            end_date=end_date,
            employee_id=request.query_params.get('employee_id'),
            classroom_id=request.query_params.get('classroom_id'),
            status=request.query_params.get('status'),
            approval_status=request.query_params.get('approval_status'),
            user=request.user
        )
        return Response(StaffAttendanceSerializer(timesheets, many=True).data, status=status.HTTP_200_OK)


class StaffCurrentStatusView(BaseStaffAttendanceAPIView):
    def get(self, request):
        daycare = self.get_daycare(request)
        current_status = StaffAttendanceService.get_current_staff_status(daycare, request.user)
        return Response(current_status, status=status.HTTP_200_OK)


class StaffTimesheetSubmitView(BaseStaffAttendanceAPIView):
    def post(self, request, pk):
        daycare = self.get_daycare(request)
        attendance = StaffAttendanceService.submit_timesheet(
            daycare=daycare,
            attendance_id=str(pk),
            user=request.user,
            notes=request.data.get('notes')
        )
        return Response(StaffAttendanceSerializer(attendance, context={'request': request}).data, status=status.HTTP_200_OK)


class StaffTimesheetBatchSubmitView(BaseStaffAttendanceAPIView):
    def post(self, request):
        daycare = self.get_daycare(request)
        attendance_ids = request.data.get('attendance_ids', [])
        if isinstance(attendance_ids, str):
            attendance_ids = [attendance_ids]
        elif hasattr(request.data, 'getlist') and not attendance_ids:
            attendance_ids = request.data.getlist('attendance_ids') or request.data.getlist('attendance_ids[]')
        elif not isinstance(attendance_ids, list):
            attendance_ids = list(attendance_ids)

        if not attendance_ids:
            raise ValidationError({"attendance_ids": "A list of attendance_ids is required."})
        attendances = StaffAttendanceService.submit_batch_timesheets(
            daycare=daycare,
            attendance_ids=attendance_ids,
            user=request.user
        )
        return Response(StaffAttendanceSerializer(attendances, many=True, context={'request': request}).data, status=status.HTTP_200_OK)


class StaffTimesheetResubmitView(BaseStaffAttendanceAPIView):
    def post(self, request, pk):
        daycare = self.get_daycare(request)
        attendance = StaffAttendanceService.resubmit_timesheet(
            daycare=daycare,
            attendance_id=str(pk),
            user=request.user,
            notes=request.data.get('notes')
        )
        return Response(StaffAttendanceSerializer(attendance, context={'request': request}).data, status=status.HTTP_200_OK)


class StaffTimesheetApproveView(BaseStaffAttendanceAPIView):
    def post(self, request, pk):
        self.check_manager_permission(request)
        daycare = self.get_daycare(request)
        threshold = float(request.data.get('threshold', 8.0))
        send_to_time_bank = bool(request.data.get('send_to_time_bank', False))
        attendance = StaffAttendanceService.approve_timesheet(
            daycare=daycare,
            attendance_id=str(pk),
            approved_by=request.user,
            send_to_time_bank=send_to_time_bank,
            notes=request.data.get('notes'),
            regular_hours_threshold=threshold
        )
        return Response(StaffAttendanceSerializer(attendance, context={'request': request}).data, status=status.HTTP_200_OK)


class StaffTimesheetRejectView(BaseStaffAttendanceAPIView):
    def post(self, request, pk):
        self.check_manager_permission(request)
        daycare = self.get_daycare(request)
        rejection_reason = request.data.get('rejection_reason') or request.data.get('reason')
        if not rejection_reason or not str(rejection_reason).strip():
            raise ValidationError({"rejection_reason": "A valid rejection reason is required."})
        attendance = StaffAttendanceService.reject_timesheet(
            daycare=daycare,
            attendance_id=str(pk),
            user=request.user,
            rejection_reason=rejection_reason,
            notes=request.data.get('notes')
        )
        return Response(StaffAttendanceSerializer(attendance, context={'request': request}).data, status=status.HTTP_200_OK)


class StaffTimesheetRequestCorrectionView(BaseStaffAttendanceAPIView):
    def post(self, request, pk):
        self.check_manager_permission(request)
        daycare = self.get_daycare(request)
        correction_reason = request.data.get('correction_reason') or request.data.get('reason')
        if not correction_reason or not str(correction_reason).strip():
            raise ValidationError({"correction_reason": "Correction reason/instructions are required."})
        attendance = StaffAttendanceService.request_timesheet_correction(
            daycare=daycare,
            attendance_id=str(pk),
            user=request.user,
            correction_reason=correction_reason,
            notes=request.data.get('notes')
        )
        return Response(StaffAttendanceSerializer(attendance, context={'request': request}).data, status=status.HTTP_200_OK)


class StaffAttendanceCorrectionView(BaseStaffAttendanceAPIView):
    def post(self, request, pk):
        self.check_manager_permission(request)
        daycare = self.get_daycare(request)
        
        correction_reason = request.data.get('correction_reason')
        if not correction_reason or not str(correction_reason).strip():
            return Response(
                {"error": "A correction reason is mandatory to adjust attendance logs."},
                status=status.HTTP_400_BAD_REQUEST
            )

        attendance = StaffAttendanceService.correct_staff_attendance(
            daycare=daycare,
            attendance_id=str(pk),
            user=request.user,
            correction_reason=correction_reason,
            clock_in=request.data.get('clock_in'),
            clock_out=request.data.get('clock_out'),
            status=request.data.get('status'),
            approval_status=request.data.get('approval_status'),
            breaks_data=request.data.get('breaks'),
            notes=request.data.get('notes')
        )
        return Response(StaffAttendanceSerializer(attendance, context={'request': request}).data, status=status.HTTP_200_OK)


class StaffBreakCorrectionView(BaseStaffAttendanceAPIView):
    def post(self, request, pk, break_id):
        self.check_manager_permission(request)
        daycare = self.get_daycare(request)
        correction_reason = request.data.get('correction_reason') or request.data.get('reason')
        if not correction_reason or not str(correction_reason).strip():
            raise ValidationError({"correction_reason": "A valid correction reason is required."})
        staff_break = StaffAttendanceService.correct_staff_break(
            daycare=daycare,
            attendance_id=str(pk),
            break_id=str(break_id),
            user=request.user,
            correction_reason=correction_reason,
            break_start=request.data.get('break_start'),
            break_end=request.data.get('break_end'),
            break_type=request.data.get('break_type'),
            is_paid=request.data.get('is_paid'),
            notes=request.data.get('notes')
        )
        return Response(StaffBreakSerializer(staff_break).data, status=status.HTTP_200_OK)


class StaffBreakAddView(BaseStaffAttendanceAPIView):
    def post(self, request, pk):
        self.check_manager_permission(request)
        daycare = self.get_daycare(request)
        correction_reason = request.data.get('correction_reason', 'Added break entry')
        attendance = get_object_or_404(StaffAttendance, pk=pk, daycare=daycare)
        b_start = StaffAttendanceService._parse_datetime(request.data.get('break_start'), default_date=attendance.date)
        b_end = StaffAttendanceService._parse_datetime(request.data.get('break_end'), default_date=attendance.date) if request.data.get('break_end') else None
        staff_break = StaffBreak.objects.create(
            attendance=attendance,
            break_start=b_start,
            break_end=b_end,
            break_type=request.data.get('break_type', 'MEAL'),
            is_paid=bool(request.data.get('is_paid', False)),
            notes=request.data.get('notes')
        )
        attendance.is_corrected = True
        attendance.correction_reason = correction_reason
        attendance.corrected_by = request.user
        attendance.corrected_at = timezone.now()
        attendance.save()

        AuditLog.objects.create(
            user=request.user,
            user_type=request.user.role if hasattr(request.user, 'role') else 'Admin',
            action="STAFF_BREAK_ADDED",
            module="STAFF_ATTENDANCE",
            entity_type="StaffAttendance",
            entity_id=str(attendance.id),
            new_values={
                "break_id": str(staff_break.id),
                "break_start": b_start.isoformat(),
                "break_end": b_end.isoformat() if b_end else None,
                "break_type": staff_break.break_type,
                "is_paid": staff_break.is_paid,
                "correction_reason": correction_reason
            }
        )
        return Response(StaffBreakSerializer(staff_break).data, status=status.HTTP_201_CREATED)


class StaffAttendanceOvertimeReportView(BaseStaffAttendanceAPIView):
    def get(self, request):
        daycare = self.get_daycare(request)
        start_date = None
        start_date_str = request.query_params.get('start_date')
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        end_date = None
        end_date_str = request.query_params.get('end_date')
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        threshold = float(request.query_params.get('threshold', 8.0))

        report_data = StaffAttendanceService.get_overtime_report_data(
            daycare=daycare,
            start_date=start_date,
            end_date=end_date,
            employee_id=request.query_params.get('employee_id'),
            classroom_id=request.query_params.get('classroom_id'),
            approval_status=request.query_params.get('approval_status'),
            threshold=threshold,
            user=request.user
        )
        return Response(report_data, status=status.HTTP_200_OK)


class StaffAttendanceAuditView(BaseStaffAttendanceAPIView):
    def get(self, request, pk):
        daycare = self.get_daycare(request)
        attendance = get_object_or_404(StaffAttendance, pk=pk, daycare=daycare)

        # Check permissions: staff can only see their own audit logs
        is_admin = request.user.is_staff or getattr(request.user, 'role', '') in ('Daycare Admin', 'Owner', 'Director', 'Manager')
        if not is_admin and attendance.employee.user != request.user:
            raise PermissionDenied("You can only view audit logs for your own attendance records.")

        audit_logs = AuditLog.objects.filter(
            module="STAFF_ATTENDANCE",
            entity_id=str(attendance.id)
        ).order_by('-created_at')

        return Response({
            "attendance": StaffAttendanceSerializer(attendance, context={'request': request}).data,
            "audit_trail": AuditLogSerializer(audit_logs, many=True).data
        }, status=status.HTTP_200_OK)


class StaffAttendanceRecordDetailView(BaseStaffAttendanceAPIView):
    def get(self, request, pk):
        daycare = self.get_daycare(request)
        attendance = get_object_or_404(StaffAttendance, pk=pk, daycare=daycare)

        is_admin = request.user.is_staff or getattr(request.user, 'role', '') in ('Daycare Admin', 'Owner', 'Director', 'Manager')
        if not is_admin and attendance.employee.user != request.user:
            raise PermissionDenied("You can only view your own attendance records.")

        return Response(StaffAttendanceSerializer(attendance, context={'request': request}).data, status=status.HTTP_200_OK)

