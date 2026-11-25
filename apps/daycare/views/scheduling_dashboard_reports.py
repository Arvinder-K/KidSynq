from datetime import datetime
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import views, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound

from core.models import Daycare, Classroom
from core.permissions import IsDaycareAdmin
from daycare.services.scheduling import (
    SchedulingCoverageService,
    SchedulingReportsService,
    SchedulingHistoryService
)


class SchedulingDashboardView(views.APIView):
    """
    GET /api/daycare/scheduling/dashboard/
    Master scheduling dashboard for daycare administrators.
    """
    permission_classes = [permissions.IsAuthenticated, IsDaycareAdmin]


    def get(self, request):
        user = request.user
        daycare = getattr(user, 'daycare', None)
        if not daycare and not user.is_superuser:
            raise PermissionDenied("User is not associated with a daycare.")

        target_date_str = request.query_params.get('date')
        if target_date_str:
            try:
                target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
            except ValueError:
                raise ValidationError({"date": "Invalid date format. Use YYYY-MM-DD."})
        else:
            target_date = timezone.now().date()

        data = SchedulingCoverageService.get_daycare_scheduling_dashboard(daycare, target_date)
        return Response(data, status=status.HTTP_200_OK)


class SchedulingReportsView(views.APIView):
    """
    GET /api/daycare/scheduling/reports/
    Generates any of the 16 Staff Scheduling Reports with JSON or CSV export.
    """
    permission_classes = [permissions.IsAuthenticated, IsDaycareAdmin]

    def get(self, request):
        user = request.user
        daycare = getattr(user, 'daycare', None)
        if not daycare and not user.is_superuser:
            raise PermissionDenied("User is not associated with a daycare.")

        report_type = request.query_params.get('report_type', 'weekly_schedule')
        filters = {
            'start_date': request.query_params.get('start_date'),
            'end_date': request.query_params.get('end_date'),
            'employee': request.query_params.get('employee'),
            'classroom': request.query_params.get('classroom'),
            'branch': request.query_params.get('branch'),
            'status': request.query_params.get('status'),
            'shift_type': request.query_params.get('shift_type'),
        }

        report = SchedulingReportsService.generate_report(daycare, report_type, filters)

        # Check for CSV export request
        if request.query_params.get('export') == 'csv':
            response = HttpResponse(report['csv_content'], content_type='text/csv')
            filename = f"{report_type}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        return Response(report, status=status.HTTP_200_OK)


class SchedulingHistoryView(views.APIView):
    """
    GET /api/daycare/scheduling/history/
    Immutable audit history of all schedule creations, modifications, swaps, overtime, and leaves.
    """
    permission_classes = [permissions.IsAuthenticated, IsDaycareAdmin]

    def get(self, request):
        user = request.user
        daycare = getattr(user, 'daycare', None)
        if not daycare and not user.is_superuser:
            raise PermissionDenied("User is not associated with a daycare.")

        entity_type = request.query_params.get('entity_type')
        action = request.query_params.get('action')
        limit = int(request.query_params.get('limit', 100))

        history = SchedulingHistoryService.get_history(daycare, entity_type=entity_type, action=action, limit=limit)
        return Response({"history": history, "count": len(history)}, status=status.HTTP_200_OK)


class ClassroomScheduleDetailView(views.APIView):
    """
    GET /api/daycare/classrooms/<uuid:classroom_id>/schedule-details/
    Full schedule, ratio, breaks, and educator coverage for a specific classroom.
    """
    permission_classes = [permissions.IsAuthenticated, IsDaycareAdmin]


    def get(self, request, classroom_id):
        user = request.user
        daycare = getattr(user, 'daycare', None)
        if not daycare and not user.is_superuser:
            raise PermissionDenied("User is not associated with a daycare.")

        classroom = Classroom.objects.filter(id=classroom_id, daycare=daycare).select_related('age_group').first()
        if not classroom:
            raise NotFound("Classroom not found in your daycare.")

        target_date_str = request.query_params.get('date')
        if target_date_str:
            try:
                target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
            except ValueError:
                raise ValidationError({"date": "Invalid date format. Use YYYY-MM-DD."})
        else:
            target_date = timezone.now().date()

        coverage = SchedulingCoverageService.calculate_classroom_coverage(daycare, classroom, target_date)
        return Response(coverage, status=status.HTTP_200_OK)
