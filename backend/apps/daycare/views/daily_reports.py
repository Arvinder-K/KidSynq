import datetime
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError

from core.models import (
    DailyReport, MealRecord, NapRecord, ToiletingRecord,
    ActivityRecord, MoodRecord, DailyTemperatureRecord,
    DailyNoteRecord, DailyPhotoRecord, Student, Classroom
)
from core.serializers import (
    DailyReportSerializer, MealRecordSerializer, NapRecordSerializer,
    ToiletingRecordSerializer, ActivityRecordSerializer,
    MoodRecordSerializer, DailyTemperatureRecordSerializer,
    DailyNoteRecordSerializer, DailyPhotoRecordSerializer
)
from daycare.services.daily_reports import DailyReportService


class DailyReportViewSet(viewsets.ModelViewSet):
    serializer_class = DailyReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.daycare:
            return DailyReport.objects.none()

        qs = DailyReport.objects.filter(
            daycare=user.daycare,
            deleted_at__isnull=True
        ).select_related('student', 'classroom', 'teacher', 'attendance_record').prefetch_related(
            'meals', 'naps', 'toileting', 'activities',
            'moods', 'temperatures', 'staff_notes', 'photos'
        )

        # Filters
        student_id = self.request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        classroom_id = self.request.query_params.get('classroom_id')
        if classroom_id:
            qs = qs.filter(classroom_id=classroom_id)

        date_str = self.request.query_params.get('date') or self.request.query_params.get('report_date')
        if date_str:
            try:
                dt = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
                qs = qs.filter(report_date=dt)
            except ValueError:
                pass

        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'All':
            qs = qs.filter(status__iexact=status_param)

        return qs

    def _is_guardian(self, user):
        return getattr(user, 'role', '') == 'Guardian' or getattr(user, 'guardian', False)

    def perform_create(self, serializer):
        user = self.request.user
        if self._is_guardian(user):
            raise PermissionDenied("Guardians cannot create daily reports.")
        serializer.save(daycare=user.daycare, teacher=user, updated_by=user)

    @action(detail=False, methods=['get', 'post'], url_path='get-or-create')
    def get_or_create(self, request):
        user = request.user
        if self._is_guardian(user):
            raise PermissionDenied("Guardians cannot create daily reports.")

        student_id = (
            request.data.get('student_id') 
            or request.data.get('child_id') 
            or request.query_params.get('student_id') 
            or request.query_params.get('child_id')
        )
        date_str = (
            request.data.get('date') 
            or request.data.get('report_date') 
            or request.query_params.get('date') 
            or request.query_params.get('report_date') 
            or datetime.date.today().isoformat()
        )
        classroom_id = request.data.get('classroom_id') or request.query_params.get('classroom_id')

        if not student_id:
            return Response({"detail": "student_id or child_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        student = get_object_or_404(Student, id=student_id, daycare=user.daycare, deleted_at__isnull=True)

        report = DailyReportService.get_or_create_daily_report(
            daycare=user.daycare,
            student=student,
            report_date=date_str,
            user=user,
            classroom_id=classroom_id
        )

        serializer = self.get_serializer(report)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='roster')
    def roster(self, request):
        user = request.user
        if not user.daycare:
            return Response([], status=status.HTTP_200_OK)

        classroom_id = request.query_params.get('classroom_id')
        date_str = request.query_params.get('date') or datetime.date.today().isoformat()

        roster = DailyReportService.get_classroom_roster_summary(
            daycare=user.daycare,
            classroom_id=classroom_id if classroom_id else None,
            report_date=date_str
        )
        return Response(roster, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='meals')
    def add_meal(self, request, pk=None):
        user = request.user
        if self._is_guardian(user):
            raise PermissionDenied("Guardians cannot add care entries.")

        report = self.get_object()
        data = request.data

        meal_type = data.get('meal_type', 'Lunch')
        meal_category = data.get('meal_category', 'Meal')
        food_provided = data.get('food_provided') or data.get('food_items', '')
        amount_eaten = data.get('amount_eaten') or data.get('quantity_intake', 'All')
        time_val = data.get('time') or None
        notes = data.get('notes', '')

        rec = DailyReportService.add_meal_entry(
            daily_report=report,
            meal_type=meal_type,
            meal_category=meal_category,
            food_provided=food_provided,
            amount_eaten=amount_eaten,
            time=time_val,
            notes=notes,
            user=user
        )

        return Response(MealRecordSerializer(rec).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='naps')
    def add_nap(self, request, pk=None):
        user = request.user
        if self._is_guardian(user):
            raise PermissionDenied("Guardians cannot add care entries.")

        report = self.get_object()
        data = request.data

        start_time = data.get('start_time')
        end_time = data.get('end_time') or None
        quality = data.get('quality') or data.get('nap_status', 'Slept')
        notes = data.get('notes', '')

        if not start_time:
            return Response({"detail": "start_time is required."}, status=status.HTTP_400_BAD_REQUEST)

        rec = DailyReportService.add_nap_entry(
            daily_report=report,
            start_time=start_time,
            end_time=end_time,
            quality=quality,
            notes=notes,
            user=user
        )

        return Response(NapRecordSerializer(rec).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='toileting')
    def add_toileting(self, request, pk=None):
        user = request.user
        if self._is_guardian(user):
            raise PermissionDenied("Guardians cannot add care entries.")

        report = self.get_object()
        data = request.data

        record_type = data.get('type') or data.get('record_type', 'Diaper')
        condition = data.get('condition') or data.get('diaper_status', 'Wet')
        assistance_level = data.get('assistance_level') or None
        time_val = data.get('time') or None
        notes = data.get('notes', '')

        rec = DailyReportService.add_toileting_entry(
            daily_report=report,
            record_type=record_type,
            condition=condition,
            assistance_level=assistance_level,
            time=time_val,
            notes=notes,
            user=user
        )

        return Response(ToiletingRecordSerializer(rec).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='activities')
    def add_activity(self, request, pk=None):
        user = request.user
        if self._is_guardian(user):
            raise PermissionDenied("Guardians cannot add care entries.")

        report = self.get_object()
        data = request.data

        activity_type = data.get('activity_type', 'General Activity')
        activity_category = data.get('activity_category') or activity_type
        name = data.get('name') or data.get('title') or activity_type
        description = data.get('description', '')
        teacher_notes = data.get('teacher_notes') or data.get('observations', '')
        start_time = data.get('start_time') or None
        end_time = data.get('end_time') or None
        learning_area = data.get('learning_area') or None
        participation = data.get('participation') or None

        rec = DailyReportService.add_activity_entry(
            daily_report=report,
            activity_type=activity_type,
            activity_category=activity_category,
            name=name,
            description=description,
            teacher_notes=teacher_notes,
            start_time=start_time,
            end_time=end_time,
            learning_area=learning_area,
            participation=participation,
            user=user
        )

        return Response(ActivityRecordSerializer(rec).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='moods')
    def add_mood(self, request, pk=None):
        user = request.user
        if self._is_guardian(user):
            raise PermissionDenied("Guardians cannot add care entries.")

        report = self.get_object()
        data = request.data

        mood = data.get('mood', 'Happy')
        time_val = data.get('time') or None
        notes = data.get('notes', '')

        rec = DailyReportService.add_mood_entry(
            daily_report=report,
            mood=mood,
            time=time_val,
            notes=notes,
            user=user
        )

        return Response(MoodRecordSerializer(rec).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='temperatures')
    def add_temperature(self, request, pk=None):
        user = request.user
        if self._is_guardian(user):
            raise PermissionDenied("Guardians cannot add care entries.")

        report = self.get_object()
        data = request.data

        temp_val = data.get('temperature_value') or data.get('value')
        if temp_val is None:
            return Response({"detail": "temperature_value is required."}, status=status.HTTP_400_BAD_REQUEST)

        unit = data.get('unit', 'Celsius')
        time_val = data.get('time') or None
        method = data.get('method', 'Forehead')
        notes = data.get('notes', '')

        rec = DailyReportService.add_temperature_entry(
            daily_report=report,
            temperature_value=temp_val,
            unit=unit,
            time=time_val,
            method=method,
            notes=notes,
            user=user
        )

        return Response(DailyTemperatureRecordSerializer(rec).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='notes')
    def add_note(self, request, pk=None):
        user = request.user
        if self._is_guardian(user):
            raise PermissionDenied("Guardians cannot add notes.")

        report = self.get_object()
        data = request.data

        category = data.get('category', 'General')
        note_text = data.get('note_text') or data.get('text', '')
        time_val = data.get('time') or None

        rec = DailyReportService.add_note_entry(
            daily_report=report,
            category=category,
            note_text=note_text,
            time=time_val,
            user=user
        )

        return Response(DailyNoteRecordSerializer(rec).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='photos')
    def upload_photo(self, request, pk=None):
        user = request.user
        if self._is_guardian(user):
            raise PermissionDenied("Guardians cannot upload daily photos.")

        report = self.get_object()
        file_obj = request.FILES.get('photo') or request.FILES.get('file')
        photo_url = request.data.get('photo_url', '')
        caption = request.data.get('caption', '')
        activity_context = request.data.get('activity_context', '')

        file_size = file_obj.size if file_obj else 0

        # Validate file size (max 10MB)
        if file_size > 10 * 1024 * 1024:
            return Response({"detail": "Photo size exceeds 10MB limit."}, status=status.HTTP_400_BAD_REQUEST)

        rec = DailyReportService.add_photo_entry(
            daily_report=report,
            student=report.student,
            file_path=file_obj,
            photo_url=photo_url,
            caption=caption,
            activity_context=activity_context,
            file_size=file_size,
            user=user
        )

        return Response(DailyPhotoRecordSerializer(rec).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='complete')
    def complete(self, request, pk=None):
        user = request.user
        if self._is_guardian(user):
            raise PermissionDenied("Guardians cannot complete daily reports.")

        report = self.get_object()
        DailyReportService.complete_report(report, user=user)
        return Response(self.get_serializer(report).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        user = request.user
        if self._is_guardian(user):
            raise PermissionDenied("Guardians cannot publish daily reports.")

        report = self.get_object()
        DailyReportService.publish_report(report, user=user)
        return Response(self.get_serializer(report).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path='entries/(?P<entry_type>[^/.]+)/(?P<entry_id>[^/.]+)')
    def delete_entry(self, request, pk=None, entry_type=None, entry_id=None):
        user = request.user
        if self._is_guardian(user):
            raise PermissionDenied("Guardians cannot delete daily report entries.")

        report = self.get_object()
        model_map = {
            'meals': MealRecord,
            'naps': NapRecord,
            'toileting': ToiletingRecord,
            'activities': ActivityRecord,
            'moods': MoodRecord,
            'temperatures': DailyTemperatureRecord,
            'notes': DailyNoteRecord,
            'photos': DailyPhotoRecord
        }

        model_cls = model_map.get(entry_type)
        if not model_cls:
            return Response({"detail": f"Unknown entry type '{entry_type}'."}, status=status.HTTP_400_BAD_REQUEST)

        entry = get_object_or_404(model_cls, id=entry_id, daily_report=report)
        entry.delete()

        DailyReportService._log_audit(
            user=user,
            action='DELETE',
            entity_type=model_cls.__name__,
            entity_id=str(entry_id),
            old_values={'daily_report_id': str(report.id)}
        )

        report.updated_by = user
        report.save(update_fields=['updated_by', 'updated_at'])

        return Response({"detail": f"{entry_type[:-1].capitalize() if entry_type.endswith('s') else entry_type.capitalize()} deleted successfully."}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        user = request.user
        if not user.daycare:
            return Response({"detail": "Daycare context required."}, status=status.HTTP_400_BAD_REQUEST)
        if self._is_guardian(user):
            raise PermissionDenied("Guardians cannot view daycare dashboard.")

        date_str = request.query_params.get('date') or datetime.date.today().isoformat()
        summary = DailyReportService.get_daycare_dashboard_summary(daycare=user.daycare, target_date=date_str)
        return Response(summary, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='history')
    def history(self, request):
        user = request.user
        if not user.daycare:
            return Response({"detail": "Daycare context required."}, status=status.HTTP_400_BAD_REQUEST)
        if self._is_guardian(user):
            raise PermissionDenied("Guardians must use family portal history.")

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        classroom_id = request.query_params.get('classroom_id')
        student_id = request.query_params.get('student_id')
        status_filter = request.query_params.get('status')
        query = request.query_params.get('search') or request.query_params.get('q')

        reports_qs = DailyReportService.search_historical_reports(
            daycare=user.daycare,
            start_date=start_date,
            end_date=end_date,
            classroom_id=classroom_id,
            student_id=student_id,
            status_filter=status_filter,
            query=query
        )

        serializer = self.get_serializer(reports_qs[:100], many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='checklist')
    def checklist(self, request, pk=None):
        report = self.get_object()
        data = DailyReportService.get_report_completion_checklist(report)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='export')
    def export_report(self, request, pk=None):
        report = self.get_object()
        from core.serializers import FamilyDailyReportSerializer
        serializer = FamilyDailyReportSerializer(report)

        # Log audit for export
        DailyReportService._log_audit(
            user=request.user,
            action='EXPORT',
            entity_type='DailyReport',
            entity_id=str(report.id),
            new_values={'export_type': 'print_pdf'}
        )

        return Response(serializer.data, status=status.HTTP_200_OK)
