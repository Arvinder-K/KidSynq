from datetime import datetime
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from core.models import StaffSchedule, AuditLog
from core.permissions import IsDaycareAdmin
from core.serializers import StaffScheduleSerializer, StaffScheduleCopySerializer
from daycare.services.scheduling import SchedulingService


class StaffScheduleViewSet(viewsets.ModelViewSet):
    """
    CRUD API for weekly staff shift scheduling with strict tenant isolation,
    availability matching, overlapping prevention, and batch schedule duplication.
    """
    serializer_class = StaffScheduleSerializer
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get_queryset(self):
        user = self.request.user
        daycare = getattr(user, 'daycare', None)
        if not daycare:
            return StaffSchedule.objects.none()

        qs = StaffSchedule.objects.filter(daycare=daycare).select_related(
            'employee', 'classroom', 'branch', 'created_by'
        )

        params = self.request.query_params

        # Filter by date range (e.g. for weekly calendar)
        start_date = params.get('start_date')
        end_date = params.get('end_date')
        if start_date:
            qs = qs.filter(date__gte=start_date)
        if end_date:
            qs = qs.filter(date__lte=end_date)

        # Filter by single date (e.g. for day view)
        single_date = params.get('date')
        if single_date:
            qs = qs.filter(date=single_date)

        # Filter by employee
        employee_id = params.get('employee') or params.get('employee_id')
        if employee_id:
            qs = qs.filter(employee_id=employee_id)

        # Filter by classroom
        classroom_id = params.get('classroom') or params.get('classroom_id')
        if classroom_id:
            qs = qs.filter(classroom_id=classroom_id)

        # Filter by branch
        branch_id = params.get('branch') or params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        # Filter by shift type
        shift_type = params.get('shift_type')
        if shift_type:
            qs = qs.filter(shift_type=shift_type)

        # Filter by status
        status_val = params.get('status')
        if status_val:
            qs = qs.filter(status=status_val)

        return qs.order_by('date', 'shift_start')

    def perform_create(self, serializer):
        daycare = self.request.user.daycare
        schedule = serializer.save(daycare=daycare, created_by=self.request.user)

        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='STAFF_SCHEDULE_CREATED',
            module='scheduling',
            entity_type='staff_schedule',
            entity_id=str(schedule.id),
            new_values={
                'employee': f"{schedule.employee.first_name} {schedule.employee.last_name}",
                'date': str(schedule.date),
                'shift': f"{schedule.shift_start.strftime('%H:%M')}–{schedule.shift_end.strftime('%H:%M')}",
                'shift_type': schedule.shift_type,
                'classroom': schedule.classroom.room_name if schedule.classroom else None,
                'status': schedule.status
            }
        )

    def perform_update(self, serializer):
        old_schedule = self.get_object()
        schedule = serializer.save()

        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='STAFF_SCHEDULE_UPDATED',
            module='scheduling',
            entity_type='staff_schedule',
            entity_id=str(schedule.id),
            old_values={
                'shift': f"{old_schedule.shift_start.strftime('%H:%M')}–{old_schedule.shift_end.strftime('%H:%M')}",
                'status': old_schedule.status
            },
            new_values={
                'employee': f"{schedule.employee.first_name} {schedule.employee.last_name}",
                'date': str(schedule.date),
                'shift': f"{schedule.shift_start.strftime('%H:%M')}–{schedule.shift_end.strftime('%H:%M')}",
                'status': schedule.status
            }
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin',
            action='STAFF_SCHEDULE_DELETED',
            module='scheduling',
            entity_type='staff_schedule',
            entity_id=str(instance.id),
            new_values={
                'employee': f"{instance.employee.first_name} {instance.employee.last_name}",
                'date': str(instance.date),
                'shift': f"{instance.shift_start.strftime('%H:%M')}–{instance.shift_end.strftime('%H:%M')}"
            }
        )
        instance.delete()

    @action(detail=False, methods=['post'], url_path='copy')
    def copy_schedule(self, request):
        """
        Batch copies schedules from a source date range to a target start date.
        """
        daycare = request.user.daycare
        if not daycare:
            raise PermissionDenied("User is not associated with an active daycare.")

        serializer = StaffScheduleCopySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        val = serializer.validated_data
        result = SchedulingService.copy_schedule(
            daycare=daycare,
            user=request.user,
            source_start=val['source_start_date'],
            source_end=val['source_end_date'],
            target_start=val['target_start_date'],
            employee_ids=[str(eid) for eid in val.get('employee_ids', [])],
            classroom_id=str(val['classroom_id']) if val.get('classroom_id') else None,
            overwrite_conflicts=val.get('overwrite_conflicts', False)
        )

        return Response(result, status=status.HTTP_200_OK if result['copied_count'] > 0 else status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='breaks')
    def breaks(self, request, pk=None):
        schedule = self.get_object()
        if request.method == 'GET':
            from core.serializers import ShiftBreakSerializer
            return Response(ShiftBreakSerializer(schedule.breaks.all(), many=True).data)

        from core.serializers import ShiftBreakSerializer
        serializer = ShiftBreakSerializer(data=request.data, context={'schedule': schedule, 'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        b = serializer.save(schedule=schedule)
        return Response(ShiftBreakSerializer(b).data, status=status.HTTP_201_CREATED)


    @action(detail=True, methods=['delete'], url_path='breaks/(?P<break_id>[^/.]+)')
    def delete_break(self, request, pk=None, break_id=None):
        schedule = self.get_object()
        try:
            b = schedule.breaks.get(id=break_id)
            b.delete()
            return Response({"detail": "Break deleted successfully."}, status=status.HTTP_204_NO_CONTENT)
        except Exception:
            return Response({"detail": "Break not found."}, status=status.HTTP_404_NOT_FOUND)

