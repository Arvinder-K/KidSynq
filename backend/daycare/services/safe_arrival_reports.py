import csv
import io
from datetime import date, datetime, time, timedelta
from typing import Dict, Any, Optional, List, Tuple
from django.utils import timezone
from django.db.models import Q, Count, Sum, Avg
from django.http import HttpResponse

from core.models import (
    Daycare, Student, StudentPickup, StudentAttendance, ChildEnrollment,
    Classroom, ClassroomStudent, User, Employee, SafeArrivalDepartureEvent,
    AuditLog, PickupQRToken, PickupSecurityPIN
)


class SafeArrivalReportsService:
    """
    Module 12 Phase 5: Safe Arrival & Departure Reporting Service.
    Generates 8 standard Safe Arrival & Departure reports with comprehensive multi-parameter filtering
    and CSV/JSON export capabilities.
    """

    REPORT_TYPES = {
        'daily_arrival': 'Daily Safe Arrival Report',
        'daily_departure': 'Daily Safe Departure Report',
        'pickup_history': 'Pickup History Report',
        'late_pickup': 'Late Pickup Report',
        'unauthorized_attempts': 'Unauthorized Pickup Attempt Report',
        'verification_methods': 'Verification Method Report',
        'staff_processing': 'Staff Processing Report',
        'pickup_verification': 'Pickup Verification Report'
    }

    @classmethod
    def _parse_date(cls, val, default=None) -> Optional[date]:
        if not val:
            return default
        if isinstance(val, date):
            return val
        if isinstance(val, datetime):
            return val.date()
        try:
            return datetime.strptime(str(val).strip(), '%Y-%m-%d').date()
        except ValueError:
            return default

    @classmethod
    def _format_time(cls, t_val) -> Optional[str]:
        if not t_val:
            return None
        if isinstance(t_val, str):
            return t_val
        return t_val.strftime('%H:%M:%S')

    @classmethod
    def _format_display_time(cls, t_val) -> Optional[str]:
        if not t_val:
            return None
        if isinstance(t_val, (time, datetime)):
            return t_val.strftime('%I:%M %p')
        return str(t_val)

    @classmethod
    def generate_report(
        cls,
        daycare: Daycare,
        report_type: str,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Master report generator delegating to specific report builders based on report_type.
        """
        filters = filters or {}
        report_type = report_type.lower().strip()

        if report_type == 'daily_arrival':
            return cls._build_daily_arrival_report(daycare, filters)
        elif report_type == 'daily_departure':
            return cls._build_daily_departure_report(daycare, filters)
        elif report_type == 'pickup_history':
            return cls._build_pickup_history_report(daycare, filters)
        elif report_type == 'late_pickup':
            return cls._build_late_pickup_report(daycare, filters)
        elif report_type == 'unauthorized_attempts':
            return cls._build_unauthorized_attempts_report(daycare, filters)
        elif report_type == 'verification_methods':
            return cls._build_verification_methods_report(daycare, filters)
        elif report_type == 'staff_processing':
            return cls._build_staff_processing_report(daycare, filters)
        elif report_type == 'pickup_verification':
            return cls._build_pickup_verification_report(daycare, filters)
        else:
            raise ValueError(f"Unknown report type: '{report_type}'. Supported types: {list(cls.REPORT_TYPES.keys())}")

    # --- 1. Daily Safe Arrival Report ---
    @classmethod
    def _build_daily_arrival_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        start_date = cls._parse_date(filters.get('start_date') or filters.get('date'), timezone.now().date())
        end_date = cls._parse_date(filters.get('end_date'), start_date)

        # Base attendances with check_in_time
        att_qs = StudentAttendance.objects.filter(
            daycare=daycare,
            attendance_date__gte=start_date,
            attendance_date__lte=end_date,
            check_in_time__isnull=False
        ).select_related('student', 'classroom', 'received_by', 'pickup_person')

        # Filter by classroom
        classroom_id = filters.get('classroom_id')
        if classroom_id:
            att_qs = att_qs.filter(student__classroom_enrollments__classroom_id=classroom_id, student__classroom_enrollments__status='Active')

        # Filter by child
        child_id = filters.get('child_id')
        if child_id:
            att_qs = att_qs.filter(student_id=child_id)

        # Filter by verification method
        method = filters.get('verification_method')
        if method:
            att_qs = att_qs.filter(arrival_type__iexact=method)

        # Filter by staff member
        staff_id = filters.get('staff_id') or filters.get('processed_by')
        if staff_id:
            att_qs = att_qs.filter(Q(received_by__user_id=staff_id) | Q(received_by_id=staff_id))

        records = []
        for att in att_qs.order_by('-attendance_date', 'check_in_time'):
            staff_name = f"{att.received_by.first_name} {att.received_by.last_name}".strip() if att.received_by else "Staff"
            cr_name = att.classroom.room_name if att.classroom else (
                att.student.classroom_enrollments.filter(status='Active').first().classroom.room_name
                if att.student.classroom_enrollments.filter(status='Active').exists() else "Unassigned"
            )

            records.append({
                "id": str(att.id),
                "date": att.attendance_date.isoformat(),
                "child_id": str(att.student_id),
                "child_name": f"{att.student.first_name} {att.student.last_name}",
                "admission_number": getattr(att.student, 'admission_number', ''),
                "classroom": cr_name,
                "arrival_time": cls._format_time(att.check_in_time),
                "display_time": cls._format_display_time(att.check_in_time),
                "arrival_type": att.arrival_type or "MANUAL",
                "received_by": staff_name,
                "status": att.attendance_status or "PRESENT",
                "notes": att.notes or ""
            })

        return {
            "report_type": "daily_arrival",
            "title": cls.REPORT_TYPES['daily_arrival'],
            "daycare_name": daycare.name if daycare else "",
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "summary": {
                "total_arrivals": len(records),
                "qr_arrivals": sum(1 for r in records if r["arrival_type"].upper() == "QR"),
                "manual_arrivals": sum(1 for r in records if r["arrival_type"].upper() == "MANUAL"),
                "other_arrivals": sum(1 for r in records if r["arrival_type"].upper() not in ["QR", "MANUAL"])
            },
            "records": records
        }

    # --- 2. Daily Safe Departure Report ---
    @classmethod
    def _build_daily_departure_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        start_date = cls._parse_date(filters.get('start_date') or filters.get('date'), timezone.now().date())
        end_date = cls._parse_date(filters.get('end_date'), start_date)

        events_qs = SafeArrivalDepartureEvent.objects.filter(
            daycare=daycare,
            timestamp__date__gte=start_date,
            timestamp__date__lte=end_date,
            event_type=SafeArrivalDepartureEvent.EVENT_CHECK_OUT
        ).select_related('student', 'authorized_pickup', 'processed_by', 'attendance_record')

        # Filters
        classroom_id = filters.get('classroom_id')
        if classroom_id:
            events_qs = events_qs.filter(student__classroom_enrollments__classroom_id=classroom_id, student__classroom_enrollments__status='Active')

        child_id = filters.get('child_id')
        if child_id:
            events_qs = events_qs.filter(student_id=child_id)

        pickup_person_id = filters.get('pickup_person_id')
        if pickup_person_id:
            events_qs = events_qs.filter(authorized_pickup_id=pickup_person_id)

        staff_id = filters.get('staff_id') or filters.get('processed_by')
        if staff_id:
            events_qs = events_qs.filter(processed_by_id=staff_id)

        method = filters.get('verification_method')
        if method:
            events_qs = events_qs.filter(verification_method__iexact=method)

        status_param = filters.get('status')
        if status_param == 'LATE':
            events_qs = events_qs.filter(is_late_pickup=True)

        records = []
        for ev in events_qs.order_by('-timestamp'):
            proc_name = f"{ev.processed_by.first_name} {ev.processed_by.last_name}".strip() if ev.processed_by else "Staff"
            collector_name = ev.authorized_pickup.name if ev.authorized_pickup else ev.attempted_person_name or "Unknown"
            relationship = ev.authorized_pickup.relationship if ev.authorized_pickup else "Other"

            cr_name = "Unassigned"
            if ev.student and ev.student.classroom_enrollments.filter(status='Active').exists():
                cr_name = ev.student.classroom_enrollments.filter(status='Active').first().classroom.room_name

            records.append({
                "id": str(ev.id),
                "date": ev.timestamp.date().isoformat(),
                "time": ev.timestamp.strftime('%H:%M:%S'),
                "display_time": ev.timestamp.strftime('%I:%M %p'),
                "child_id": str(ev.student_id),
                "child_name": f"{ev.student.first_name} {ev.student.last_name}" if ev.student else "Child",
                "classroom": cr_name,
                "pickup_person": collector_name,
                "relationship": relationship,
                "verification_method": ev.verification_method,
                "verification_status": ev.verification_status,
                "is_late_pickup": ev.is_late_pickup,
                "expected_pickup_time": cls._format_time(ev.expected_pickup_time),
                "late_duration_minutes": ev.late_duration_minutes,
                "processed_by": proc_name,
                "notes": ev.notes or ""
            })

        return {
            "report_type": "daily_departure",
            "title": cls.REPORT_TYPES['daily_departure'],
            "daycare_name": daycare.name if daycare else "",
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "summary": {
                "total_departures": len(records),
                "on_time_departures": sum(1 for r in records if not r["is_late_pickup"]),
                "late_departures": sum(1 for r in records if r["is_late_pickup"]),
                "qr_departures": sum(1 for r in records if r["verification_method"] == "QR"),
                "pin_departures": sum(1 for r in records if r["verification_method"] == "PIN"),
                "signature_departures": sum(1 for r in records if r["verification_method"] == "DIGITAL_SIGNATURE")
            },
            "records": records
        }

    # --- 3. Pickup History Report ---
    @classmethod
    def _build_pickup_history_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        start_date = cls._parse_date(filters.get('start_date'), timezone.now().date() - timedelta(days=30))
        end_date = cls._parse_date(filters.get('end_date') or filters.get('date'), timezone.now().date())

        events_qs = SafeArrivalDepartureEvent.objects.filter(
            daycare=daycare,
            timestamp__date__gte=start_date,
            timestamp__date__lte=end_date
        ).select_related('student', 'authorized_pickup', 'processed_by', 'attendance_record')

        # Filters
        child_id = filters.get('child_id')
        if child_id:
            events_qs = events_qs.filter(student_id=child_id)

        pickup_person_id = filters.get('pickup_person_id')
        if pickup_person_id:
            events_qs = events_qs.filter(authorized_pickup_id=pickup_person_id)

        staff_id = filters.get('staff_id') or filters.get('processed_by')
        if staff_id:
            events_qs = events_qs.filter(processed_by_id=staff_id)

        method = filters.get('verification_method')
        if method:
            events_qs = events_qs.filter(verification_method__iexact=method)

        status_param = filters.get('status')
        if status_param == 'SUCCESS':
            events_qs = events_qs.filter(verification_status=SafeArrivalDepartureEvent.STATUS_SUCCESS)
        elif status_param == 'FAILED':
            events_qs = events_qs.filter(verification_status=SafeArrivalDepartureEvent.STATUS_FAILED)

        records = []
        for ev in events_qs.order_by('-timestamp'):
            proc_name = f"{ev.processed_by.first_name} {ev.processed_by.last_name}".strip() if ev.processed_by else "Staff"
            collector_name = ev.authorized_pickup.name if ev.authorized_pickup else ev.attempted_person_name or "Unknown"

            records.append({
                "id": str(ev.id),
                "date": ev.timestamp.date().isoformat(),
                "time": ev.timestamp.strftime('%H:%M:%S'),
                "display_time": ev.timestamp.strftime('%I:%M %p'),
                "child_id": str(ev.student_id),
                "child_name": f"{ev.student.first_name} {ev.student.last_name}" if ev.student else "Child",
                "event_type": ev.event_type,
                "pickup_person": collector_name,
                "relationship": ev.authorized_pickup.relationship if ev.authorized_pickup else "Other",
                "verification_method": ev.verification_method,
                "verification_status": ev.verification_status,
                "is_late_pickup": ev.is_late_pickup,
                "late_duration_minutes": ev.late_duration_minutes,
                "processed_by": proc_name,
                "failure_reason": ev.failure_reason or ""
            })

        return {
            "report_type": "pickup_history",
            "title": cls.REPORT_TYPES['pickup_history'],
            "daycare_name": daycare.name if daycare else "",
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "summary": {
                "total_events": len(records),
                "checkins": sum(1 for r in records if r["event_type"] == "CHECK_IN"),
                "checkouts": sum(1 for r in records if r["event_type"] == "CHECK_OUT"),
                "exceptions": sum(1 for r in records if r["verification_status"] == "FAILED" or r["event_type"] == "UNAUTHORIZED_ATTEMPT")
            },
            "records": records
        }

    # --- 4. Late Pickup Report ---
    @classmethod
    def _build_late_pickup_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        start_date = cls._parse_date(filters.get('start_date'), timezone.now().date() - timedelta(days=30))
        end_date = cls._parse_date(filters.get('end_date') or filters.get('date'), timezone.now().date())

        events_qs = SafeArrivalDepartureEvent.objects.filter(
            daycare=daycare,
            timestamp__date__gte=start_date,
            timestamp__date__lte=end_date,
            is_late_pickup=True
        ).select_related('student', 'authorized_pickup', 'processed_by', 'attendance_record')

        # Filters
        classroom_id = filters.get('classroom_id')
        if classroom_id:
            events_qs = events_qs.filter(student__classroom_enrollments__classroom_id=classroom_id, student__classroom_enrollments__status='Active')

        child_id = filters.get('child_id')
        if child_id:
            events_qs = events_qs.filter(student_id=child_id)

        pickup_person_id = filters.get('pickup_person_id')
        if pickup_person_id:
            events_qs = events_qs.filter(authorized_pickup_id=pickup_person_id)

        records = []
        total_late_minutes = 0
        for ev in events_qs.order_by('-timestamp'):
            proc_name = f"{ev.processed_by.first_name} {ev.processed_by.last_name}".strip() if ev.processed_by else "Staff"
            collector_name = ev.authorized_pickup.name if ev.authorized_pickup else ev.attempted_person_name or "Unknown"
            total_late_minutes += (ev.late_duration_minutes or 0)

            cr_name = "Unassigned"
            if ev.student and ev.student.classroom_enrollments.filter(status='Active').exists():
                cr_name = ev.student.classroom_enrollments.filter(status='Active').first().classroom.room_name

            records.append({
                "id": str(ev.id),
                "date": ev.timestamp.date().isoformat(),
                "checkout_time": ev.timestamp.strftime('%H:%M:%S'),
                "expected_time": cls._format_time(ev.expected_pickup_time),
                "late_duration_minutes": ev.late_duration_minutes,
                "child_id": str(ev.student_id),
                "child_name": f"{ev.student.first_name} {ev.student.last_name}" if ev.student else "Child",
                "classroom": cr_name,
                "pickup_person": collector_name,
                "relationship": ev.authorized_pickup.relationship if ev.authorized_pickup else "Other",
                "verification_method": ev.verification_method,
                "processed_by": proc_name,
                "notes": ev.notes or ""
            })

        avg_late = round(total_late_minutes / len(records), 1) if records else 0

        return {
            "report_type": "late_pickup",
            "title": cls.REPORT_TYPES['late_pickup'],
            "daycare_name": daycare.name if daycare else "",
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "summary": {
                "total_late_incidents": len(records),
                "total_late_minutes": total_late_minutes,
                "average_late_minutes": avg_late
            },
            "records": records
        }

    # --- 5. Unauthorized Pickup Attempt Report ---
    @classmethod
    def _build_unauthorized_attempts_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        start_date = cls._parse_date(filters.get('start_date'), timezone.now().date() - timedelta(days=30))
        end_date = cls._parse_date(filters.get('end_date') or filters.get('date'), timezone.now().date())

        events_qs = SafeArrivalDepartureEvent.objects.filter(
            daycare=daycare,
            timestamp__date__gte=start_date,
            timestamp__date__lte=end_date
        ).filter(
            Q(event_type=SafeArrivalDepartureEvent.EVENT_UNAUTHORIZED_ATTEMPT) |
            Q(verification_status=SafeArrivalDepartureEvent.STATUS_FAILED)
        ).select_related('student', 'authorized_pickup', 'processed_by')

        # Filters
        child_id = filters.get('child_id')
        if child_id:
            events_qs = events_qs.filter(student_id=child_id)

        method = filters.get('verification_method')
        if method:
            events_qs = events_qs.filter(verification_method__iexact=method)

        records = []
        for ev in events_qs.order_by('-timestamp'):
            proc_name = f"{ev.processed_by.first_name} {ev.processed_by.last_name}".strip() if ev.processed_by else "Staff"
            collector_name = ev.authorized_pickup.name if ev.authorized_pickup else ev.attempted_person_name or "Unknown"

            records.append({
                "id": str(ev.id),
                "date": ev.timestamp.date().isoformat(),
                "time": ev.timestamp.strftime('%H:%M:%S'),
                "child_id": str(ev.student_id) if ev.student else None,
                "child_name": f"{ev.student.first_name} {ev.student.last_name}" if ev.student else "Unknown Child",
                "attempted_person": collector_name,
                "verification_method": ev.verification_method,
                "reason": ev.failure_reason or "Authorization verification failed",
                "processed_by": proc_name,
                "security_status": "BLOCKED"
            })

        return {
            "report_type": "unauthorized_attempts",
            "title": cls.REPORT_TYPES['unauthorized_attempts'],
            "daycare_name": daycare.name if daycare else "",
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "summary": {
                "total_unauthorized_attempts": len(records),
                "blocked_qr_attempts": sum(1 for r in records if r["verification_method"] == "QR"),
                "blocked_pin_attempts": sum(1 for r in records if r["verification_method"] == "PIN"),
                "blocked_manual_attempts": sum(1 for r in records if r["verification_method"] == "MANUAL")
            },
            "records": records
        }

    # --- 6. Verification Method Report ---
    @classmethod
    def _build_verification_methods_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        start_date = cls._parse_date(filters.get('start_date'), timezone.now().date() - timedelta(days=30))
        end_date = cls._parse_date(filters.get('end_date') or filters.get('date'), timezone.now().date())

        events_qs = SafeArrivalDepartureEvent.objects.filter(
            daycare=daycare,
            timestamp__date__gte=start_date,
            timestamp__date__lte=end_date
        )

        method_filter = filters.get('verification_method')
        if method_filter:
            events_qs = events_qs.filter(verification_method__iexact=method_filter)

        method_stats = {}
        for ev in events_qs:
            m = ev.verification_method or 'MANUAL'
            if m not in method_stats:
                method_stats[m] = {
                    "method": m,
                    "total_verifications": 0,
                    "successful": 0,
                    "failed": 0,
                    "late_pickups": 0
                }
            method_stats[m]["total_verifications"] += 1
            if ev.verification_status == SafeArrivalDepartureEvent.STATUS_SUCCESS:
                method_stats[m]["successful"] += 1
            else:
                method_stats[m]["failed"] += 1
            if ev.is_late_pickup:
                method_stats[m]["late_pickups"] += 1

        stats_list = []
        for m, data in method_stats.items():
            succ_rate = round((data["successful"] / data["total_verifications"]) * 100, 1) if data["total_verifications"] > 0 else 0
            stats_list.append({
                **data,
                "success_rate_percent": succ_rate
            })

        stats_list.sort(key=lambda x: x["total_verifications"], reverse=True)

        return {
            "report_type": "verification_methods",
            "title": cls.REPORT_TYPES['verification_methods'],
            "daycare_name": daycare.name if daycare else "",
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "summary": {
                "total_verifications": sum(s["total_verifications"] for s in stats_list),
                "overall_success_rate": round(
                    (sum(s["successful"] for s in stats_list) / sum(s["total_verifications"] for s in stats_list)) * 100, 1
                ) if stats_list and sum(s["total_verifications"] for s in stats_list) > 0 else 0
            },
            "method_breakdown": stats_list,
            "records": stats_list
        }

    # --- 7. Staff Processing Report ---
    @classmethod
    def _build_staff_processing_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        start_date = cls._parse_date(filters.get('start_date'), timezone.now().date() - timedelta(days=30))
        end_date = cls._parse_date(filters.get('end_date') or filters.get('date'), timezone.now().date())

        events_qs = SafeArrivalDepartureEvent.objects.filter(
            daycare=daycare,
            timestamp__date__gte=start_date,
            timestamp__date__lte=end_date
        ).select_related('processed_by')

        staff_filter = filters.get('staff_id') or filters.get('processed_by')
        if staff_filter:
            events_qs = events_qs.filter(processed_by_id=staff_filter)

        staff_map = {}
        for ev in events_qs:
            staff_user = ev.processed_by
            staff_id_str = str(staff_user.id) if staff_user else "system"
            staff_name = f"{staff_user.first_name} {staff_user.last_name}".strip() or staff_user.username if staff_user else "System / Automated"

            if staff_id_str not in staff_map:
                staff_map[staff_id_str] = {
                    "staff_id": staff_id_str,
                    "staff_name": staff_name,
                    "total_processed": 0,
                    "checkins": 0,
                    "checkouts": 0,
                    "exceptions_handled": 0,
                    "late_pickups": 0
                }

            staff_map[staff_id_str]["total_processed"] += 1
            if ev.event_type == SafeArrivalDepartureEvent.EVENT_CHECK_IN:
                staff_map[staff_id_str]["checkins"] += 1
            elif ev.event_type == SafeArrivalDepartureEvent.EVENT_CHECK_OUT:
                staff_map[staff_id_str]["checkouts"] += 1

            if ev.verification_status == SafeArrivalDepartureEvent.STATUS_FAILED or ev.event_type == SafeArrivalDepartureEvent.EVENT_UNAUTHORIZED_ATTEMPT:
                staff_map[staff_id_str]["exceptions_handled"] += 1

            if ev.is_late_pickup:
                staff_map[staff_id_str]["late_pickups"] += 1

        staff_list = list(staff_map.values())
        staff_list.sort(key=lambda x: x["total_processed"], reverse=True)

        return {
            "report_type": "staff_processing",
            "title": cls.REPORT_TYPES['staff_processing'],
            "daycare_name": daycare.name if daycare else "",
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "summary": {
                "total_events_processed": sum(s["total_processed"] for s in staff_list),
                "active_staff_count": len(staff_list)
            },
            "staff_processing": staff_list,
            "records": staff_list
        }

    # --- 8. Pickup Verification Report (PART B Spec) ---
    @classmethod
    def _build_pickup_verification_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        PART B: PICKUP VERIFICATION REPORT
        Fields: Child, Pickup Person, Relationship, Verification Method, Date, Time, Staff Member, Result
        Verification Methods: Manual, QR, PIN, Digital Signature
        """
        start_date = cls._parse_date(filters.get('start_date') or filters.get('date'), timezone.now().date() - timedelta(days=7))
        end_date = cls._parse_date(filters.get('end_date'), timezone.now().date())

        events_qs = SafeArrivalDepartureEvent.objects.filter(
            daycare=daycare,
            timestamp__date__gte=start_date,
            timestamp__date__lte=end_date
        ).select_related('student', 'authorized_pickup', 'processed_by')

        # Filters
        child_id = filters.get('child_id')
        if child_id:
            events_qs = events_qs.filter(student_id=child_id)

        pickup_person_id = filters.get('pickup_person_id')
        if pickup_person_id:
            events_qs = events_qs.filter(authorized_pickup_id=pickup_person_id)

        staff_id = filters.get('staff_id') or filters.get('processed_by')
        if staff_id:
            events_qs = events_qs.filter(processed_by_id=staff_id)

        method = filters.get('verification_method')
        if method:
            events_qs = events_qs.filter(verification_method__iexact=method)

        status_param = filters.get('status')
        if status_param == 'SUCCESS':
            events_qs = events_qs.filter(verification_status=SafeArrivalDepartureEvent.STATUS_SUCCESS)
        elif status_param == 'FAILED':
            events_qs = events_qs.filter(verification_status=SafeArrivalDepartureEvent.STATUS_FAILED)

        records = []
        for ev in events_qs.order_by('-timestamp'):
            proc_name = f"{ev.processed_by.first_name} {ev.processed_by.last_name}".strip() if ev.processed_by else "Staff"
            p_name = ev.authorized_pickup.name if ev.authorized_pickup else ev.attempted_person_name or "Unknown"
            rel = ev.authorized_pickup.relationship if ev.authorized_pickup else "Other"

            result_str = "SUCCESS"
            if ev.verification_status == SafeArrivalDepartureEvent.STATUS_FAILED or ev.event_type == SafeArrivalDepartureEvent.EVENT_UNAUTHORIZED_ATTEMPT:
                result_str = "FAILED"

            records.append({
                "id": str(ev.id),
                "child": f"{ev.student.first_name} {ev.student.last_name}" if ev.student else "Unknown Child",
                "child_id": str(ev.student_id) if ev.student else None,
                "pickup_person": p_name,
                "relationship": rel,
                "verification_method": ev.verification_method or "MANUAL",
                "date": ev.timestamp.date().isoformat(),
                "time": ev.timestamp.strftime('%H:%M:%S'),
                "display_time": ev.timestamp.strftime('%I:%M %p'),
                "staff_member": proc_name,
                "result": result_str,
                "failure_reason": ev.failure_reason or ""
            })

        return {
            "report_type": "pickup_verification",
            "title": cls.REPORT_TYPES['pickup_verification'],
            "daycare_name": daycare.name if daycare else "",
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "summary": {
                "total_verifications": len(records),
                "successful": sum(1 for r in records if r["result"] == "SUCCESS"),
                "failed": sum(1 for r in records if r["result"] == "FAILED"),
                "qr_count": sum(1 for r in records if r["verification_method"] == "QR"),
                "pin_count": sum(1 for r in records if r["verification_method"] == "PIN"),
                "signature_count": sum(1 for r in records if r["verification_method"] == "DIGITAL_SIGNATURE"),
                "manual_count": sum(1 for r in records if r["verification_method"] == "MANUAL")
            },
            "records": records
        }

    # --- CSV Exporter ---
    @classmethod
    def export_csv(cls, report_data: Dict[str, Any]) -> HttpResponse:
        """
        Converts report data into standard RFC 4180 CSV response with dynamic headers.
        """
        report_type = report_data.get('report_type', 'report')
        title = report_data.get('title', 'Safe Arrival Report')

        output = io.StringIO()
        writer = csv.writer(output)

        # Header metadata
        writer.writerow([title.upper()])
        writer.writerow(["Daycare", report_data.get('daycare_name', '')])
        writer.writerow(["Generated At", timezone.now().strftime('%Y-%m-%d %H:%M:%S')])
        if 'date_range' in report_data:
            writer.writerow(["Date Range", f"{report_data['date_range'].get('start_date')} to {report_data['date_range'].get('end_date')}"])
        writer.writerow([])

        # Table data based on report type
        if report_type == 'daily_arrival':
            writer.writerow(["Date", "Arrival Time", "Child Name", "Admission #", "Classroom", "Method", "Received By", "Status", "Notes"])
            for r in report_data.get('records', []):
                writer.writerow([r["date"], r["display_time"], r["child_name"], r["admission_number"], r["classroom"], r["arrival_type"], r["received_by"], r["status"], r["notes"]])

        elif report_type == 'daily_departure':
            writer.writerow(["Date", "Departure Time", "Child Name", "Classroom", "Pickup Person", "Relationship", "Method", "Late?", "Late Mins", "Expected Time", "Processed By", "Notes"])
            for r in report_data.get('records', []):
                writer.writerow([r["date"], r["display_time"], r["child_name"], r["classroom"], r["pickup_person"], r["relationship"], r["verification_method"], "Yes" if r["is_late_pickup"] else "No", r["late_duration_minutes"], r["expected_pickup_time"] or "", r["processed_by"], r["notes"]])

        elif report_type == 'pickup_history':
            writer.writerow(["Date", "Time", "Child Name", "Event Type", "Pickup Person", "Relationship", "Method", "Status", "Late Mins", "Processed By", "Failure Reason"])
            for r in report_data.get('records', []):
                writer.writerow([r["date"], r["display_time"], r["child_name"], r["event_type"], r["pickup_person"], r["relationship"], r["verification_method"], r["verification_status"], r["late_duration_minutes"], r["processed_by"], r["failure_reason"]])

        elif report_type == 'late_pickup':
            writer.writerow(["Date", "Departure Time", "Expected Time", "Late Duration (Mins)", "Child Name", "Classroom", "Pickup Person", "Relationship", "Method", "Processed By", "Notes"])
            for r in report_data.get('records', []):
                writer.writerow([r["date"], r["checkout_time"], r["expected_time"] or "", r["late_duration_minutes"], r["child_name"], r["classroom"], r["pickup_person"], r["relationship"], r["verification_method"], r["processed_by"], r["notes"]])

        elif report_type == 'unauthorized_attempts':
            writer.writerow(["Date", "Time", "Child Name", "Attempted Person", "Method", "Reason", "Security Status", "Processed By"])
            for r in report_data.get('records', []):
                writer.writerow([r["date"], r["time"], r["child_name"], r["attempted_person"], r["verification_method"], r["reason"], r["security_status"], r["processed_by"]])

        elif report_type == 'verification_methods':
            writer.writerow(["Verification Method", "Total Verifications", "Successful", "Failed", "Late Pickups", "Success Rate (%)"])
            for r in report_data.get('method_breakdown', []):
                writer.writerow([r["method"], r["total_verifications"], r["successful"], r["failed"], r["late_pickups"], f"{r['success_rate_percent']}%"])

        elif report_type == 'staff_processing':
            writer.writerow(["Staff Member", "Total Processed", "Check-Ins", "Check-Outs", "Exceptions Handled", "Late Pickups"])
            for r in report_data.get('staff_processing', []):
                writer.writerow([r["staff_name"], r["total_processed"], r["checkins"], r["checkouts"], r["exceptions_handled"], r["late_pickups"]])

        elif report_type == 'pickup_verification':
            writer.writerow(["Child", "Pickup Person", "Relationship", "Verification Method", "Date", "Time", "Staff Member", "Result", "Failure Reason"])
            for r in report_data.get('records', []):
                writer.writerow([r["child"], r["pickup_person"], r["relationship"], r["verification_method"], r["date"], r["display_time"], r["staff_member"], r["result"], r["failure_reason"]])

        response = HttpResponse(output.getvalue(), content_type='text/csv')
        filename = f"{report_type}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
