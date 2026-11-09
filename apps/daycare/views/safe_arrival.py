from datetime import datetime, date
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import views, status, permissions
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound

from core.models import Daycare, Student
from daycare.views.attendance import IsDaycareStaffOrAdmin
from daycare.views.digital_verification import get_request_daycare
from daycare.services.safe_arrival import SafeArrivalService
from daycare.services.safe_arrival_reports import SafeArrivalReportsService


class SafeArrivalDashboardView(views.APIView):
    """
    GET /api/daycare/safe-arrival/dashboard/
    Daily Safe Arrival & Departure Dashboard API.
    Returns live statistics, children expected/arrived/present/departed, late pickups, unauthorized attempts,
    failed verifications, and a real-time roster for the specified date.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request):
        daycare = get_request_daycare(request)
        if not daycare and not request.user.is_superuser:
            return Response({"error": "No daycare associated with this account."}, status=status.HTTP_400_BAD_REQUEST)

        date_str = request.query_params.get('date')
        target_date = timezone.now().date()
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({"error": "Invalid date format. Expected YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        classroom_id = request.query_params.get('classroom_id')

        data = SafeArrivalService.get_daily_safe_arrival_dashboard(
            daycare=daycare,
            target_date=target_date,
            classroom_id=classroom_id
        )

        return Response(data, status=status.HTTP_200_OK)


class ChildPickupHistoryView(views.APIView):
    """
    GET /api/daycare/children/<uuid:child_pk>/pickup-history/
    Returns complete chronological pickup and safe arrival departure history for a child.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request, child_pk):
        daycare = get_request_daycare(request)
        child = get_object_or_404(Student, id=child_pk)

        if not request.user.is_superuser and daycare and child.daycare_id != daycare.id:
            raise PermissionDenied("Cannot access pickup history for a child from another daycare.")

        limit = int(request.query_params.get('limit', 50))
        data = SafeArrivalService.get_child_pickup_history(
            daycare=daycare or child.daycare,
            child_id=str(child.id),
            limit=limit
        )

        return Response(data, status=status.HTTP_200_OK)


class PickupExceptionsListView(views.APIView):
    """
    GET /api/daycare/pickups/exceptions/
    Exception management review station for authorized staff.
    Allows reviewing unauthorized attempts, late pickups, and failed verifications.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request):
        daycare = get_request_daycare(request)
        if not daycare and not request.user.is_superuser:
            return Response([], status=status.HTTP_200_OK)

        date_str = request.query_params.get('date')
        target_date = None
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({"error": "Invalid date format. Expected YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        exception_type = request.query_params.get('type')  # 'all', 'unauthorized', 'late', 'failed'
        limit = int(request.query_params.get('limit', 100))

        exceptions = SafeArrivalService.get_pickup_exceptions(
            daycare=daycare,
            target_date=target_date,
            exception_type=exception_type,
            limit=limit
        )

        return Response(exceptions, status=status.HTTP_200_OK)


class SafeArrivalReportsView(views.APIView):
    """
    GET /api/daycare/safe-arrival/reports/
    Master reporting endpoint for Safe Arrival & Departure.
    Supports 8 distinct report types with JSON & CSV formats and multi-parameter filtering:
    - daily_arrival (Daily Safe Arrival Report)
    - daily_departure (Daily Safe Departure Report)
    - pickup_history (Pickup History Report)
    - late_pickup (Late Pickup Report)
    - unauthorized_attempts (Unauthorized Pickup Attempt Report)
    - verification_methods (Verification Method Report)
    - staff_processing (Staff Processing Report)
    - pickup_verification (Pickup Verification Report: Child, Pickup Person, Relationship, Method, Date, Time, Staff, Result)
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request):
        daycare = get_request_daycare(request)
        if not daycare and not request.user.is_superuser:
            return Response({"error": "No daycare associated with this account."}, status=status.HTTP_400_BAD_REQUEST)

        report_type = request.query_params.get('report_type', 'daily_arrival')
        export_format = (request.query_params.get('export_format') or request.query_params.get('format', 'json')).lower().strip()

        filters = {
            "date": request.query_params.get('date'),
            "start_date": request.query_params.get('start_date'),
            "end_date": request.query_params.get('end_date'),
            "classroom_id": request.query_params.get('classroom_id'),
            "child_id": request.query_params.get('child_id'),
            "pickup_person_id": request.query_params.get('pickup_person_id'),
            "staff_id": request.query_params.get('staff_id') or request.query_params.get('processed_by'),
            "verification_method": request.query_params.get('verification_method'),
            "status": request.query_params.get('status')
        }

        try:
            report_data = SafeArrivalReportsService.generate_report(
                daycare=daycare,
                report_type=report_type,
                filters=filters
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if export_format == 'csv':
            return SafeArrivalReportsService.export_csv(report_data)

        return Response(report_data, status=status.HTTP_200_OK)


class AttendancePickupCorrectionView(views.APIView):
    """
    POST /api/daycare/safe-arrival/records/<uuid:pk>/correct/
    Allows authorized staff to make necessary corrections to attendance/pickup records.
    Synchronizes attendance and SafeArrivalDepartureEvent with immutable audit tracking.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request, pk):
        daycare = get_request_daycare(request)
        if not daycare and not request.user.is_superuser:
            return Response({"error": "No daycare associated with this account."}, status=status.HTTP_400_BAD_REQUEST)

        corrections = request.data.get('corrections')
        if corrections is None:
            corrections = {k: v for k, v in request.data.items() if k != 'reason'}
        reason = request.data.get('reason')
        if not reason:
            return Response({"error": "Reason for correction is required."}, status=status.HTTP_400_BAD_REQUEST)

        result = SafeArrivalService.correct_attendance_pickup_record(
            daycare=daycare,
            attendance_id=str(pk),
            user=request.user,
            corrections=corrections,
            reason=reason
        )

        return Response(result, status=status.HTTP_200_OK)
