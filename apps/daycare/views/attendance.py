from datetime import datetime, timedelta
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q

from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound

from core.models import (
    Student, StudentAttendance, Classroom, ClassroomStudent,
    ChildEnrollment, Daycare, StudentPickup, AuditLog
)
from core.serializers import (
    StudentAttendanceSerializer, AttendanceRosterSerializer,
    AttendanceAuditLogSerializer,
    DailyReportSerializer, MealRecordSerializer, NapRecordSerializer, ActivityRecordSerializer
)
from core.permissions import IsDaycareAdmin
from daycare.services.attendance import AttendanceService


class IsDaycareStaffOrAdmin(permissions.BasePermission):
    """
    Grants access to active Daycare Admins, Staff, or Superusers.
    """
    def has_permission(self, request, view):
        user = request.user
        if not bool(user and user.is_authenticated):
            return False
        if user.is_superuser:
            return True
        if not user.daycare or user.daycare.status != 'Active':
            return False
        # If user is a guardian/parent, block daycare staff operations
        if (hasattr(user, 'guardian') or hasattr(user, 'guardian_profile') or getattr(user, 'role', '') in ('Parent', 'Guardian')) and not user.is_staff:
            return False
        return True


class DailyAttendanceView(APIView):
    """
    GET /api/daycare/attendance/daily/
    Lists daily attendance roster and summary counts with filtering by date, classroom, search, and status.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare and not request.user.is_superuser:
            raise PermissionDenied("User is not associated with an active daycare.")

        target_date = request.query_params.get('date')
        classroom_id = request.query_params.get('classroom_id')
        search = request.query_params.get('search')
        status_filter = request.query_params.get('status')

        if request.user.is_superuser and not daycare:
            daycare_id = request.query_params.get('daycare_id')
            if daycare_id:
                daycare = get_object_or_404(Daycare, pk=daycare_id)
            else:
                daycare = Daycare.objects.filter(status='Active').first()

        data = AttendanceService.get_daily_roster(
            daycare=daycare,
            target_date=target_date,
            classroom_id=classroom_id,
            search=search,
            status_filter=status_filter
        )
        return Response(data, status=status.HTTP_200_OK)


class AttendanceCheckInView(APIView):
    """
    POST /api/daycare/attendance/check-in/
    Records child check-in with automatic timestamp, user, classroom, late detection, and audit log.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request):
        student_id = request.data.get('student_id') or request.data.get('child_id')
        if not student_id:
            raise ValidationError({"student_id": "This field is required."})

        attendance = AttendanceService.check_in(
            user=request.user,
            student_id=student_id,
            attendance_date=request.data.get('date') or request.data.get('attendance_date'),
            check_in_time=request.data.get('check_in_time') or request.data.get('time'),
            classroom_id=request.data.get('classroom_id'),
            arrival_type=request.data.get('arrival_type'),
            late_reason=request.data.get('late_reason'),
            remarks=request.data.get('remarks') or request.data.get('notes')
        )

        serializer = StudentAttendanceSerializer(attendance)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AttendanceCheckOutView(APIView):
    """
    POST /api/daycare/attendance/check-out/
    Records child check-out with automatic timestamp, early pickup detection, and audit log.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request):
        student_id = request.data.get('student_id') or request.data.get('child_id')
        if not student_id:
            raise ValidationError({"student_id": "This field is required."})

        attendance = AttendanceService.check_out(
            user=request.user,
            student_id=student_id,
            attendance_date=request.data.get('date') or request.data.get('attendance_date'),
            check_out_time=request.data.get('check_out_time') or request.data.get('time'),
            pickup_person_id=request.data.get('pickup_person_id'),
            departure_type=request.data.get('departure_type'),
            early_pickup_reason=request.data.get('early_pickup_reason'),
            remarks=request.data.get('remarks') or request.data.get('notes')
        )

        serializer = StudentAttendanceSerializer(attendance)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AttendanceMarkAbsentView(APIView):
    """
    POST /api/daycare/attendance/mark-absent/
    Marks a child as absent for a specified date.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request):
        student_id = request.data.get('student_id') or request.data.get('child_id')
        if not student_id:
            raise ValidationError({"student_id": "This field is required."})

        attendance = AttendanceService.mark_absent(
            user=request.user,
            student_id=student_id,
            attendance_date=request.data.get('date') or request.data.get('attendance_date'),
            remarks=request.data.get('remarks') or request.data.get('notes')
        )

        serializer = StudentAttendanceSerializer(attendance)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AttendanceMarkExcusedView(APIView):
    """
    POST /api/daycare/attendance/mark-excused/
    Marks a child as excused absence for a specified date.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request):
        student_id = request.data.get('student_id') or request.data.get('child_id')
        if not student_id:
            raise ValidationError({"student_id": "This field is required."})

        attendance = AttendanceService.mark_excused_absence(
            user=request.user,
            student_id=student_id,
            date_val=request.data.get('date') or request.data.get('attendance_date'),
            remarks=request.data.get('remarks') or request.data.get('notes'),
            excused_reason_type=request.data.get('excused_reason_type'),
            supporting_document_id=request.data.get('supporting_document_id') or request.data.get('document_id')
        )

        serializer = StudentAttendanceSerializer(attendance)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AttendanceCorrectionView(APIView):
    """
    POST /api/daycare/attendance/records/<uuid:pk>/correct/
    Performs controlled attendance correction with mandatory reason and audit snapshot.
    Restricted to Daycare Admin and Super Admin.
    """
    permission_classes = [IsDaycareAdmin]

    def post(self, request, pk):
        correction_reason = request.data.get('correction_reason') or request.data.get('reason')
        if not correction_reason or not str(correction_reason).strip():
            raise ValidationError({"correction_reason": "A valid correction reason is strictly required."})

        attendance = AttendanceService.correct_attendance(
            user=request.user,
            attendance_id=pk,
            correction_reason=correction_reason,
            check_in_time=request.data.get('check_in_time'),
            check_out_time=request.data.get('check_out_time'),
            attendance_status=request.data.get('attendance_status'),
            is_late=request.data.get('is_late'),
            is_early_pickup=request.data.get('is_early_pickup'),
            late_reason=request.data.get('late_reason'),
            early_pickup_reason=request.data.get('early_pickup_reason'),
            remarks=request.data.get('remarks'),
            notes=request.data.get('notes'),
            excused_reason_type=request.data.get('excused_reason_type'),
            supporting_document_id=request.data.get('supporting_document_id') or request.data.get('document_id'),
        )

        serializer = StudentAttendanceSerializer(attendance)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AttendanceRecordAuditView(APIView):
    """
    GET /api/daycare/attendance/records/<uuid:pk>/audit/
    Retrieves chronological audit trail for a specific attendance record.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request, pk):
        data = AttendanceService.get_attendance_audit_trail(user=request.user, attendance_id=pk)
        serialized_logs = AttendanceAuditLogSerializer(data['logs'], many=True).data

        return Response({
            "attendance_id": data['attendance_id'],
            "student_id": data['student_id'],
            "student_name": data['student_name'],
            "attendance_date": data['attendance_date'],
            "current_status": data['current_status'],
            "is_corrected": data['is_corrected'],
            "correction_reason": data['correction_reason'],
            "corrected_by_name": data['corrected_by_name'],
            "corrected_at": data['corrected_at'],
            "logs": serialized_logs,
        }, status=status.HTTP_200_OK)


class MonthlyAttendanceView(APIView):
    """
    GET /api/daycare/attendance/monthly/
    Retrieves monthly attendance calendar matrix, day-by-day status codes, and summary stats.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request):
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        classroom_id = request.query_params.get('classroom_id')
        student_id = request.query_params.get('student_id')
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search')

        data = AttendanceService.get_monthly_attendance_matrix(
            user=request.user,
            year=year,
            month=month,
            classroom_id=classroom_id,
            student_id=student_id,
            status_filter=status_filter,
            search=search
        )
        return Response(data, status=status.HTTP_200_OK)


class ChildAttendanceHistoryView(APIView):
    """
    GET /api/daycare/children/<uuid:pk>/attendance/
    Fetches full attendance history and summary stats for a single child with date range filtering.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request, pk):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        month = request.query_params.get('month')
        year = request.query_params.get('year')

        data = AttendanceService.get_child_history(
            user=request.user,
            student_id=pk,
            start_date=start_date,
            end_date=end_date,
            month=month,
            year=year
        )

        # Serialize records
        serialized_records = StudentAttendanceSerializer(data['records'], many=True).data

        return Response({
            'student': data['student'],
            'summary': data['summary'],
            'records': serialized_records
        }, status=status.HTTP_200_OK)


class AttendanceRecordDetailView(APIView):
    """
    GET, PATCH, DELETE /api/daycare/attendance/records/<uuid:pk>/
    Manage an individual attendance record.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request, pk):
        daycare = request.user.daycare
        if request.user.is_superuser:
            attendance = get_object_or_404(StudentAttendance, pk=pk)
        else:
            attendance = get_object_or_404(StudentAttendance, pk=pk, daycare=daycare)

        serializer = StudentAttendanceSerializer(attendance)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        daycare = request.user.daycare
        if request.user.is_superuser:
            attendance = get_object_or_404(StudentAttendance, pk=pk)
        else:
            attendance = get_object_or_404(StudentAttendance, pk=pk, daycare=daycare)

        data = request.data
        if 'attendance_status' in data:
            attendance.attendance_status = data['attendance_status']
        if 'check_in_time' in data:
            attendance.check_in_time = AttendanceService._parse_time(data['check_in_time'])
        if 'check_out_time' in data:
            attendance.check_out_time = AttendanceService._parse_time(data['check_out_time'])
        if 'arrival_type' in data:
            attendance.arrival_type = data['arrival_type']
        if 'departure_type' in data:
            attendance.departure_type = data['departure_type']
        if 'is_late' in data:
            attendance.is_late = bool(data['is_late'])
        if 'is_early_pickup' in data:
            attendance.is_early_pickup = bool(data['is_early_pickup'])
        if 'late_reason' in data:
            attendance.late_reason = data['late_reason']
        if 'early_pickup_reason' in data:
            attendance.early_pickup_reason = data['early_pickup_reason']
        if 'remarks' in data or 'notes' in data:
            attendance.remarks = data.get('remarks') or data.get('notes')
            attendance.notes = attendance.remarks

        if attendance.check_in_time and attendance.check_out_time:
            if attendance.check_out_time < attendance.check_in_time:
                raise ValidationError("Check-out time cannot be earlier than check-in time.")

        attendance.updated_by = request.user
        attendance.save()

        AuditLog.objects.create(
            user=request.user,
            user_type=getattr(request.user, 'role', 'Daycare Admin'),
            action="CHILD_ATTENDANCE_UPDATED",
            module="Attendance Management",
            entity_type="StudentAttendance",
            entity_id=str(attendance.id),
            new_values=data
        )

        serializer = StudentAttendanceSerializer(attendance)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        daycare = request.user.daycare
        if request.user.is_superuser:
            attendance = get_object_or_404(StudentAttendance, pk=pk)
        else:
            attendance = get_object_or_404(StudentAttendance, pk=pk, daycare=daycare)

        AuditLog.objects.create(
            user=request.user,
            user_type=getattr(request.user, 'role', 'Daycare Admin'),
            action="CHILD_ATTENDANCE_DELETED",
            module="Attendance Management",
            entity_type="StudentAttendance",
            entity_id=str(attendance.id),
            new_values={"student_id": str(attendance.student_id), "date": str(attendance.attendance_date)}
        )

        attendance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AttendanceStatsView(APIView):
    """
    GET /api/daycare/attendance/stats/
    Returns weekly/monthly daycare attendance trends.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare and not request.user.is_superuser:
            raise PermissionDenied("User is not associated with an active daycare.")

        days = int(request.query_params.get('days', 7))
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days - 1)

        records = StudentAttendance.objects.filter(
            daycare=daycare,
            attendance_date__gte=start_date,
            attendance_date__lte=end_date
        )

        daily_stats = []
        cur_date = start_date
        while cur_date <= end_date:
            day_records = [r for r in records if r.attendance_date == cur_date]
            present = sum(1 for r in day_records if (r.attendance_status or '').upper() in ('PRESENT', 'LATE', 'EARLY_PICKUP') or r.check_in_time)
            absent = sum(1 for r in day_records if (r.attendance_status or '').upper() == 'ABSENT')
            excused = sum(1 for r in day_records if (r.attendance_status or '').upper() in ('EXCUSED_ABSENCE', 'EXCUSED'))
            late = sum(1 for r in day_records if r.is_late or (r.attendance_status or '').upper() == 'LATE')

            daily_stats.append({
                'date': cur_date.strftime('%Y-%m-%d'),
                'day': cur_date.strftime('%a'),
                'present': present,
                'absent': absent,
                'excused': excused,
                'late': late,
                'total': len(day_records)
            })
            cur_date += timedelta(days=1)

        return Response({
            'period': f"{start_date} to {end_date}",
            'days': days,
            'daily_stats': daily_stats
        }, status=status.HTTP_200_OK)


# Backward Compatibility Legacy View
class AttendanceListView(APIView):
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request):
        daycare = request.user.daycare
        date_str = request.query_params.get('date')
        if date_str:
            try:
                current_date = timezone.datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                current_date = timezone.now().date()
        else:
            current_date = timezone.now().date()

        students = Student.objects.filter(daycare=daycare, status='Active', deleted_at__isnull=True).order_by('first_name')
        attendances = StudentAttendance.objects.filter(daycare=daycare, attendance_date=current_date)
        attendance_dict = {att.student_id: att for att in attendances}

        for student in students:
            student.today_attendance = attendance_dict.get(student.id)

        serializer = AttendanceRosterSerializer(students, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        student_id = data.get('student_id')
        date_str = data.get('date', timezone.now().date().isoformat())
        status_val = data.get('status')

        try:
            if status_val == 'Present':
                AttendanceService.check_in(user=request.user, student_id=student_id, attendance_date=date_str)
            elif status_val == 'Absent':
                AttendanceService.mark_absent(user=request.user, student_id=student_id, attendance_date=date_str)
            elif status_val == 'Excused Absence':
                AttendanceService.mark_excused_absence(user=request.user, student_id=student_id, attendance_date=date_str)
            return Response({"status": "success"})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# --------------------------------------------------------------------------
# MODULE 11 PHASE 5 - MASTER ATTENDANCE DASHBOARD & REPORTING VIEWS
# --------------------------------------------------------------------------

import csv
from django.http import HttpResponse
from daycare.services.staff_attendance import StaffAttendanceService


class MasterAttendanceDashboardView(APIView):
    """
    GET /api/daycare/attendance/dashboard/
    Master real-time dashboard unifying live child and staff attendance metrics.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare and not request.user.is_superuser:
            raise PermissionDenied("User is not associated with an active daycare.")
        if not daycare:
            daycare = Daycare.objects.first()

        target_date_str = request.query_params.get('date')
        data = AttendanceService.get_master_attendance_dashboard(daycare, target_date=target_date_str)
        return Response(data, status=status.HTTP_200_OK)


class DailyChildAttendanceReportView(APIView):
    """
    GET /api/daycare/reports/attendance/daily/
    Comprehensive daily child attendance report with CSV export support.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare and not request.user.is_superuser:
            raise PermissionDenied("User is not associated with an active daycare.")
        if not daycare:
            daycare = Daycare.objects.first()

        target_date = request.query_params.get('date')
        branch_id = request.query_params.get('branch')
        classroom_id = request.query_params.get('classroom')
        student_id = request.query_params.get('child') or request.query_params.get('student_id')
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search')

        report_data = AttendanceService.get_daily_child_report(
            daycare=daycare,
            target_date=target_date,
            branch_id=branch_id,
            classroom_id=classroom_id,
            student_id=student_id,
            status_filter=status_filter,
            search=search
        )

        if request.query_params.get('export') == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="daily_child_attendance_{report_data["summary"]["date"]}.csv"'
            writer = csv.writer(response)
            writer.writerow(['Student', 'Admission #', 'Classroom', 'Branch', 'Check In', 'Check Out', 'Status', 'Late', 'Early Pickup', 'Notes', 'Received By', 'Released By'])
            for r in report_data['records']:
                writer.writerow([
                    r['student_name'],
                    r['admission_number'] or '',
                    r['classroom_name'],
                    r['branch_name'],
                    r['check_in_time'] or '',
                    r['check_out_time'] or '',
                    r['status'],
                    'Yes' if r['is_late'] else 'No',
                    'Yes' if r['is_early_pickup'] else 'No',
                    r['remarks'],
                    r['received_by_name'] or '',
                    r['released_by_name'] or ''
                ])
            return response

        return Response(report_data, status=status.HTTP_200_OK)


class MonthlyChildAttendanceReportView(APIView):
    """
    GET /api/daycare/reports/attendance/monthly/
    Monthly child attendance report with centralized percentage calculation and CSV export.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare and not request.user.is_superuser:
            raise PermissionDenied("User is not associated with an active daycare.")
        if not daycare:
            daycare = Daycare.objects.first()

        now = timezone.now().date()
        year = int(request.query_params.get('year', now.year))
        month = int(request.query_params.get('month', now.month))
        branch_id = request.query_params.get('branch')
        classroom_id = request.query_params.get('classroom')
        student_id = request.query_params.get('child') or request.query_params.get('student_id')

        report_data = AttendanceService.get_monthly_child_report(
            daycare=daycare,
            year=year,
            month=month,
            branch_id=branch_id,
            classroom_id=classroom_id,
            student_id=student_id
        )

        if request.query_params.get('export') == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="monthly_child_attendance_{year}_{month}.csv"'
            writer = csv.writer(response)
            writer.writerow(['Student', 'Admission #', 'Classroom', 'Enrolled Days', 'Days Present', 'Days Absent', 'Excused Absences', 'Late Arrivals', 'Early Pickups', 'Attendance %'])
            for s in report_data['students']:
                writer.writerow([
                    s['student_name'],
                    s['admission_number'] or '',
                    s['classroom_name'],
                    s['enrolled_days'],
                    s['days_present'],
                    s['days_absent'],
                    s['excused_absences'],
                    s['late_arrivals'],
                    s['early_pickups'],
                    f"{s['attendance_percentage']}%"
                ])
            return response

        return Response(report_data, status=status.HTTP_200_OK)


class StaffAttendanceReportView(APIView):
    """
    GET /api/daycare/reports/staff-attendance/
    Staff attendance report: Scheduled vs Actual hours, Breaks, Overtime, Late Arrivals, Early Departures, Missing Clock-outs.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare and not request.user.is_superuser:
            raise PermissionDenied("User is not associated with an active daycare.")
        if not daycare:
            daycare = Daycare.objects.first()

        start_date = None
        s_str = request.query_params.get('start_date')
        if s_str:
            try:
                start_date = datetime.strptime(s_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        end_date = None
        e_str = request.query_params.get('end_date')
        if e_str:
            try:
                end_date = datetime.strptime(e_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        report_data = StaffAttendanceService.get_staff_attendance_report(
            daycare=daycare,
            start_date=start_date,
            end_date=end_date,
            employee_id=request.query_params.get('employee_id'),
            classroom_id=request.query_params.get('classroom_id'),
            branch_id=request.query_params.get('branch_id')
        )

        if request.query_params.get('export') == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="staff_attendance_report.csv"'
            writer = csv.writer(response)
            writer.writerow(['Employee', 'Role', 'Date', 'Classroom', 'Scheduled (h)', 'Actual (h)', 'Breaks (h)', 'Regular (h)', 'Overtime (h)', 'Late', 'Early Departure', 'Missing Clock-Out', 'Status', 'Approval'])
            for r in report_data['records']:
                writer.writerow([
                    r['employee_name'],
                    r['employee_role'],
                    r['date'],
                    r['classroom_name'],
                    r['scheduled_hours'],
                    r['actual_hours'],
                    r['break_hours'],
                    r['regular_hours'],
                    r['overtime_hours'],
                    'Yes' if r['is_late'] else 'No',
                    'Yes' if r['is_early_departure'] else 'No',
                    'Yes' if r['is_missing_clock_out'] else 'No',
                    r['status'],
                    r['approval_status']
                ])
            return response

        return Response(report_data, status=status.HTTP_200_OK)


class TimesheetReportView(APIView):
    """
    GET /api/daycare/reports/timesheets/
    Timesheet Report with shift logs, break breakdowns, overtime, approval statuses, and CSV export.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare and not request.user.is_superuser:
            raise PermissionDenied("User is not associated with an active daycare.")
        if not daycare:
            daycare = Daycare.objects.first()

        start_date = None
        s_str = request.query_params.get('start_date')
        if s_str:
            try:
                start_date = datetime.strptime(s_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        end_date = None
        e_str = request.query_params.get('end_date')
        if e_str:
            try:
                end_date = datetime.strptime(e_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        report_data = StaffAttendanceService.get_timesheet_report(
            daycare=daycare,
            start_date=start_date,
            end_date=end_date,
            employee_id=request.query_params.get('employee_id'),
            classroom_id=request.query_params.get('classroom_id'),
            approval_status=request.query_params.get('approval_status'),
            branch_id=request.query_params.get('branch_id')
        )

        if request.query_params.get('export') == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="staff_timesheets_report.csv"'
            writer = csv.writer(response)
            writer.writerow(['Employee', 'Date', 'Classroom', 'Scheduled', 'Clock In', 'Clock Out', 'Break (mins)', 'Actual Hours', 'Overtime', 'Approval Status', 'Corrected', 'Submitted By', 'Approved By'])
            for r in report_data['records']:
                writer.writerow([
                    r['employee_name'],
                    r['date'],
                    r['classroom_name'],
                    r['scheduled'],
                    r['clock_in'],
                    r['clock_out'],
                    r['total_break_minutes'],
                    r['actual_hours'],
                    r['overtime_hours'],
                    r['approval_status'],
                    'Yes' if r['is_corrected'] else 'No',
                    r['submitted_by_name'] or '',
                    r['approved_by_name'] or ''
                ])
            return response

        return Response(report_data, status=status.HTTP_200_OK)


class AttendanceAuditReportView(APIView):
    """
    GET /api/daycare/reports/attendance-audit/
    Unified audit report across child and staff attendance corrections, rejections, and approvals.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare and not request.user.is_superuser:
            raise PermissionDenied("User is not associated with an active daycare.")
        if not daycare:
            daycare = Daycare.objects.first()

        start_date = None
        s_str = request.query_params.get('start_date')
        if s_str:
            try:
                start_date = datetime.strptime(s_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        end_date = None
        e_str = request.query_params.get('end_date')
        if e_str:
            try:
                end_date = datetime.strptime(e_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        audit_data = AttendanceService.get_unified_attendance_audit(
            daycare=daycare,
            start_date=start_date,
            end_date=end_date,
            user_id=request.query_params.get('user_id'),
            student_id=request.query_params.get('child') or request.query_params.get('student_id'),
            employee_id=request.query_params.get('employee_id'),
            action=request.query_params.get('action'),
            module=request.query_params.get('module')
        )

        if request.query_params.get('export') == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="attendance_audit_report.csv"'
            writer = csv.writer(response)
            writer.writerow(['Date/Time', 'Module', 'Action', 'Entity Type', 'Entity ID', 'User', 'Correction/Action Reason', 'Rejection Reason'])
            for l in audit_data['logs']:
                writer.writerow([
                    l['created_at'],
                    l['module'],
                    l['action'],
                    l['entity_type'],
                    l['entity_id'],
                    l['user_name'],
                    l['correction_reason'] or '',
                    l['rejection_reason'] or ''
                ])
            return response

        return Response(audit_data, status=status.HTTP_200_OK)

