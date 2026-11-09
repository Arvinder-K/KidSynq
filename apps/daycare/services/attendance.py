from datetime import datetime, time, date
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound

from core.models import (
    Student, StudentAttendance, Classroom, ClassroomStudent,
    ChildEnrollment, Daycare, StudentPickup, AuditLog, Employee, Document
)


class AttendanceService:
    @staticmethod
    def _parse_time(t_val):
        if not t_val:
            return None
        if isinstance(t_val, time):
            return t_val
        if isinstance(t_val, str):
            t_val = t_val.strip()
            for fmt in ("%H:%M:%S", "%H:%M", "%I:%M %p", "%I:%M:%S %p"):
                try:
                    return datetime.strptime(t_val, fmt).time()
                except ValueError:
                    continue
        raise ValidationError(f"Invalid time format: '{t_val}'. Expected HH:MM or HH:MM:SS.")

    @staticmethod
    def _parse_date(d_val):
        if not d_val:
            return timezone.now().date()
        if isinstance(d_val, date):
            return d_val
        if isinstance(d_val, str):
            d_val = d_val.strip()
            for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
                try:
                    return datetime.strptime(d_val, fmt).date()
                except ValueError:
                    continue
        raise ValidationError(f"Invalid date format: '{d_val}'. Expected YYYY-MM-DD.")

    @classmethod
    def get_daily_roster(cls, daycare, target_date=None, classroom_id=None, search=None, status_filter=None):
        target_date = cls._parse_date(target_date)

        # 1. Fetch active children for the daycare
        students_qs = Student.objects.filter(
            daycare=daycare,
            status='Active',
            deleted_at__isnull=True
        ).select_related('branch')

        if search:
            search = search.strip()
            students_qs = students_qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(admission_number__icontains=search) |
                Q(preferred_name__icontains=search)
            )

        students = list(students_qs.order_by('first_name', 'last_name'))
        student_ids = [s.id for s in students]

        # 2. Fetch existing attendance records for target_date
        attendances = StudentAttendance.objects.filter(
            daycare=daycare,
            attendance_date=target_date,
            student_id__in=student_ids
        ).select_related('classroom', 'received_by', 'released_by', 'pickup_person', 'created_by', 'updated_by')

        attendance_map = {att.student_id: att for att in attendances}

        # 3. Fetch active classroom assignments on target_date
        # Classroom assignments that were active on target_date: start_date <= target_date and (end_date is null or end_date >= target_date)
        assignments = ClassroomStudent.objects.filter(
            student_id__in=student_ids,
            status='Active'
        ).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=target_date)
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=target_date)
        ).select_related('classroom').order_by('-start_date', '-created_at')

        student_classroom_map = {}
        for asgn in assignments:
            if asgn.student_id not in student_classroom_map:
                student_classroom_map[asgn.student_id] = asgn.classroom

        # 4. Fetch active enrollments on target_date
        enrollments = ChildEnrollment.objects.filter(
            student_id__in=student_ids,
            status='Active'
        ).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=target_date)
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=target_date)
        ).order_by('-start_date', '-created_at')

        student_enrollment_map = {}
        for enr in enrollments:
            if enr.student_id not in student_enrollment_map:
                student_enrollment_map[enr.student_id] = enr

        # 5. Build roster list
        roster = []
        for student in students:
            att = attendance_map.get(student.id)
            active_classroom = student_classroom_map.get(student.id)
            active_enrollment = student_enrollment_map.get(student.id)

            # Historical preservation: if attendance record exists, use its historical classroom
            effective_classroom = att.classroom if (att and att.classroom) else active_classroom

            # Apply classroom_id filter if provided
            if classroom_id:
                if not effective_classroom or str(effective_classroom.id) != str(classroom_id):
                    continue

            # Determine normalized display status
            if att:
                status_val = att.attendance_status
                is_checked_in = bool(att.check_in_time and not att.check_out_time)
                is_checked_out = bool(att.check_out_time)
            else:
                status_val = 'UNMARKED'
                is_checked_in = False
                is_checked_out = False

            # Status filter
            if status_filter:
                filter_upper = status_filter.upper()
                if filter_upper == 'CHECKED_IN' and not is_checked_in:
                    continue
                elif filter_upper == 'CHECKED_OUT' and not is_checked_out:
                    continue
                elif filter_upper not in ('CHECKED_IN', 'CHECKED_OUT') and status_val.upper() != filter_upper:
                    continue

            roster.append({
                'student_id': str(student.id),
                'first_name': student.first_name,
                'last_name': student.last_name,
                'preferred_name': student.preferred_name,
                'admission_number': student.admission_number,
                'photo': student.photo,
                'status': student.status,
                'classroom': {
                    'id': str(effective_classroom.id) if effective_classroom else None,
                    'room_name': effective_classroom.room_name if effective_classroom else 'Unassigned',
                    'room_code': effective_classroom.room_code if effective_classroom else None,
                } if effective_classroom else None,
                'enrollment': {
                    'id': str(active_enrollment.id) if active_enrollment else None,
                    'status': active_enrollment.status if active_enrollment else None,
                    'start_date': str(active_enrollment.start_date) if active_enrollment and active_enrollment.start_date else None,
                } if active_enrollment else None,
                'attendance': {
                    'id': str(att.id) if att else None,
                    'attendance_date': str(att.attendance_date) if att else str(target_date),
                    'attendance_status': att.attendance_status if att else 'UNMARKED',
                    'check_in_time': att.check_in_time.strftime('%H:%M:%S') if (att and att.check_in_time) else None,
                    'check_out_time': att.check_out_time.strftime('%H:%M:%S') if (att and att.check_out_time) else None,
                    'is_late': att.is_late if att else False,
                    'is_early_pickup': att.is_early_pickup if att else False,
                    'arrival_type': att.arrival_type if att else None,
                    'departure_type': att.departure_type if att else None,
                    'late_reason': att.late_reason if att else None,
                    'early_pickup_reason': att.early_pickup_reason if att else None,
                    'remarks': att.remarks or att.notes if att else None,
                    'received_by_name': f"{att.received_by.first_name} {att.received_by.last_name}" if (att and att.received_by) else None,
                    'released_by_name': f"{att.released_by.first_name} {att.released_by.last_name}" if (att and att.released_by) else None,
                    'pickup_person_name': att.pickup_person.name if (att and att.pickup_person) else None,
                } if att else None,
                'is_checked_in': is_checked_in,
                'is_checked_out': is_checked_out,
            })

        # 6. Calculate summary counts
        total_students_count = len(students)
        all_day_attendances = StudentAttendance.objects.filter(
            daycare=daycare,
            attendance_date=target_date,
            student__status='Active',
            student__deleted_at__isnull=True
        )

        present_count = 0
        absent_count = 0
        excused_count = 0
        late_count = 0
        early_pickup_count = 0
        checked_in_count = 0
        checked_out_count = 0

        for record in all_day_attendances:
            st = (record.attendance_status or '').upper()
            if st in ('PRESENT', 'LATE', 'EARLY_PICKUP') or record.check_in_time is not None:
                present_count += 1
            if st == 'ABSENT':
                absent_count += 1
            if st in ('EXCUSED_ABSENCE', 'EXCUSED'):
                excused_count += 1
            if record.is_late or st == 'LATE':
                late_count += 1
            if record.is_early_pickup or st == 'EARLY_PICKUP':
                early_pickup_count += 1
            if record.check_in_time and not record.check_out_time:
                checked_in_count += 1
            if record.check_out_time:
                checked_out_count += 1

        unmarked_count = max(0, total_students_count - (present_count + absent_count + excused_count))

        summary = {
            'date': str(target_date),
            'total_children': total_students_count,
            'present_count': present_count,
            'absent_count': absent_count,
            'excused_absence_count': excused_count,
            'late_count': late_count,
            'early_pickup_count': early_pickup_count,
            'checked_in_count': checked_in_count,
            'checked_out_count': checked_out_count,
            'unmarked_count': unmarked_count,
        }

        return {
            'summary': summary,
            'roster': roster
        }

    @classmethod
    def check_in(cls, user, student_id, attendance_date=None, check_in_time=None, classroom_id=None,
                 arrival_type=None, late_reason=None, remarks=None):
        daycare = user.daycare
        if not daycare:
            raise PermissionDenied("User is not associated with an active daycare.")

        target_date = cls._parse_date(attendance_date)
        actual_check_in_time = cls._parse_time(check_in_time) if check_in_time else timezone.now().time()

        # 1. Fetch and validate student ownership
        try:
            student = Student.objects.get(pk=student_id, daycare=daycare, deleted_at__isnull=True)
        except Student.DoesNotExist:
            raise NotFound("Student not found in your daycare.")

        # 2. Prevent check-in for inactive/unenrolled child
        if student.status != 'Active':
            raise ValidationError("Cannot check in an inactive or withdrawn child.")

        # 3. Check for existing attendance record for this date (prevent duplicate check-in)
        existing_att = StudentAttendance.objects.filter(student=student, attendance_date=target_date).first()
        if existing_att and existing_att.check_in_time is not None:
            raise ValidationError("Child is already checked in for this attendance date.")

        # 4. Resolve classroom assignment
        classroom = None
        if classroom_id:
            try:
                classroom = Classroom.objects.get(pk=classroom_id, daycare=daycare, deleted_at__isnull=True)
            except Classroom.DoesNotExist:
                raise ValidationError("Specified classroom not found in your daycare.")
        else:
            # Active assignment on target_date
            active_asgn = ClassroomStudent.objects.filter(
                student=student,
                status='Active'
            ).filter(
                Q(start_date__isnull=True) | Q(start_date__lte=target_date)
            ).filter(
                Q(end_date__isnull=True) | Q(end_date__gte=target_date)
            ).order_by('-start_date', '-created_at').first()
            if active_asgn:
                classroom = active_asgn.classroom

        # 5. Resolve active enrollment
        enrollment = ChildEnrollment.objects.filter(
            student=student,
            status='Active'
        ).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=target_date)
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=target_date)
        ).order_by('-start_date', '-created_at').first()

        # 6. Late arrival calculation (Part C)
        # Check expected arrival time from daycare opening_time, daycare settings default_operating_start, or default 09:00:00
        expected_arrival = None
        if hasattr(daycare, 'opening_time') and daycare.opening_time:
            expected_arrival = daycare.opening_time
        elif hasattr(daycare, 'settings') and daycare.settings.default_operating_start:
            expected_arrival = daycare.settings.default_operating_start
        else:
            expected_arrival = time(9, 0)

        is_late = False
        if actual_check_in_time and expected_arrival:
            if actual_check_in_time > expected_arrival:
                is_late = True

        status_val = 'LATE' if is_late else 'PRESENT'
        resolved_arrival_type = arrival_type or ('LATE' if is_late else 'STANDARD')

        # 7. Resolve acting employee (if user is linked to an Employee record)
        received_by_emp = Employee.objects.filter(user=user, daycare=daycare).first()

        # 8. Create or update StudentAttendance
        if existing_att:
            attendance = existing_att
            attendance.attendance_status = status_val
            attendance.check_in_time = actual_check_in_time
            attendance.expected_arrival_time = expected_arrival
            attendance.arrival_type = resolved_arrival_type
            attendance.is_late = is_late
            if late_reason:
                attendance.late_reason = late_reason
            if remarks:
                attendance.remarks = remarks
                attendance.notes = remarks
            if classroom:
                attendance.classroom = classroom
            if enrollment:
                attendance.enrollment = enrollment
            if received_by_emp:
                attendance.received_by = received_by_emp
            attendance.updated_by = user
            attendance.save()
        else:
            attendance = StudentAttendance.objects.create(
                daycare=daycare,
                branch=student.branch,
                student=student,
                enrollment=enrollment,
                classroom=classroom,
                attendance_date=target_date,
                attendance_status=status_val,
                check_in_time=actual_check_in_time,
                expected_arrival_time=expected_arrival,
                arrival_type=resolved_arrival_type,
                is_late=is_late,
                late_reason=late_reason or '',
                received_by=received_by_emp,
                remarks=remarks or '',
                notes=remarks or '',
                created_by=user,
                updated_by=user
            )

        # 9. Audit Log
        AuditLog.objects.create(
            user=user,
            user_type=getattr(user, 'role', 'Daycare Admin'),
            action="CHILD_CHECK_IN",
            module="Attendance Management",
            entity_type="StudentAttendance",
            entity_id=str(attendance.id),
            new_values={
                "student_id": str(student.id),
                "student_name": f"{student.first_name} {student.last_name}",
                "date": str(target_date),
                "check_in_time": str(actual_check_in_time),
                "is_late": is_late,
                "classroom_id": str(classroom.id) if classroom else None,
            }
        )

        return attendance

    @classmethod
    def check_out(cls, user, student_id, attendance_date=None, check_out_time=None, pickup_person_id=None,
                  departure_type=None, early_pickup_reason=None, remarks=None):
        daycare = user.daycare
        if not daycare:
            raise PermissionDenied("User is not associated with an active daycare.")

        target_date = cls._parse_date(attendance_date)
        actual_check_out_time = cls._parse_time(check_out_time) if check_out_time else timezone.now().time()

        # 1. Fetch student
        try:
            student = Student.objects.get(pk=student_id, daycare=daycare, deleted_at__isnull=True)
        except Student.DoesNotExist:
            raise NotFound("Student not found in your daycare.")

        # 2. Fetch existing attendance record
        attendance = StudentAttendance.objects.filter(student=student, attendance_date=target_date).first()
        if not attendance or not attendance.check_in_time:
            raise ValidationError("Cannot check out a child who has not been checked in.")

        # 3. Prevent double checkout
        if attendance.check_out_time is not None:
            raise ValidationError("Child is already checked out for this attendance date.")

        # 4. Validate checkout cannot occur before check-in
        if actual_check_out_time < attendance.check_in_time:
            raise ValidationError("Check-out time cannot be earlier than check-in time.")

        # 5. Early pickup calculation (Part E)
        # Check expected departure time from daycare closing_time, daycare settings default_operating_end, or default 17:00:00
        expected_departure = None
        if hasattr(daycare, 'closing_time') and daycare.closing_time:
            expected_departure = daycare.closing_time
        elif hasattr(daycare, 'settings') and daycare.settings.default_operating_end:
            expected_departure = daycare.settings.default_operating_end
        else:
            expected_departure = time(17, 0)

        is_early_pickup = False
        if actual_check_out_time and expected_departure:
            if actual_check_out_time < expected_departure:
                is_early_pickup = True

        resolved_departure_type = departure_type or ('EARLY_PICKUP' if is_early_pickup else 'STANDARD')

        # 6. Pickup person validation
        pickup_person = None
        if pickup_person_id:
            try:
                pickup_person = StudentPickup.objects.get(pk=pickup_person_id, student=student)
            except StudentPickup.DoesNotExist:
                raise ValidationError("Specified authorized pickup person not found for this child.")

        # 7. Released by employee
        released_by_emp = Employee.objects.filter(user=user, daycare=daycare).first()

        # 8. Update record
        attendance.check_out_time = actual_check_out_time
        attendance.expected_departure_time = expected_departure
        attendance.departure_type = resolved_departure_type
        attendance.is_early_pickup = is_early_pickup
        if is_early_pickup and attendance.attendance_status in ('PRESENT', 'Present'):
            attendance.attendance_status = 'EARLY_PICKUP'
        if early_pickup_reason:
            attendance.early_pickup_reason = early_pickup_reason
        if pickup_person:
            attendance.pickup_person = pickup_person
        if released_by_emp:
            attendance.released_by = released_by_emp
        if remarks:
            current_remarks = attendance.remarks or ''
            attendance.remarks = f"{current_remarks} | Checkout: {remarks}".strip(' |')
            attendance.notes = attendance.remarks
        attendance.updated_by = user
        attendance.save()

        # 9. Audit Log
        AuditLog.objects.create(
            user=user,
            user_type=getattr(user, 'role', 'Daycare Admin'),
            action="CHILD_CHECK_OUT",
            module="Attendance Management",
            entity_type="StudentAttendance",
            entity_id=str(attendance.id),
            new_values={
                "student_id": str(student.id),
                "student_name": f"{student.first_name} {student.last_name}",
                "date": str(target_date),
                "check_out_time": str(actual_check_out_time),
                "is_early_pickup": is_early_pickup,
                "pickup_person_id": str(pickup_person.id) if pickup_person else None,
            }
        )

        return attendance

    @classmethod
    def mark_absent(cls, user, student_id, attendance_date=None, remarks=None):
        daycare = user.daycare
        if not daycare:
            raise PermissionDenied("User is not associated with an active daycare.")

        target_date = cls._parse_date(attendance_date)

        try:
            student = Student.objects.get(pk=student_id, daycare=daycare, deleted_at__isnull=True)
        except Student.DoesNotExist:
            raise NotFound("Student not found in your daycare.")

        if student.status != 'Active':
            raise ValidationError("Cannot mark attendance for an inactive child.")

        # Resolve active classroom and enrollment
        active_asgn = ClassroomStudent.objects.filter(
            student=student,
            status='Active'
        ).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=target_date)
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=target_date)
        ).order_by('-start_date', '-created_at').first()
        classroom = active_asgn.classroom if active_asgn else None

        enrollment = ChildEnrollment.objects.filter(
            student=student,
            status='Active'
        ).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=target_date)
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=target_date)
        ).order_by('-start_date', '-created_at').first()

        attendance, created = StudentAttendance.objects.update_or_create(
            student=student,
            attendance_date=target_date,
            defaults={
                'daycare': daycare,
                'branch': student.branch,
                'classroom': classroom,
                'enrollment': enrollment,
                'attendance_status': 'ABSENT',
                'check_in_time': None,
                'check_out_time': None,
                'is_late': False,
                'is_early_pickup': False,
                'arrival_type': 'STANDARD',
                'departure_type': 'STANDARD',
                'remarks': remarks or 'Marked absent',
                'notes': remarks or 'Marked absent',
                'updated_by': user,
            }
        )
        if created:
            attendance.created_by = user
            attendance.save()

        AuditLog.objects.create(
            user=user,
            user_type=getattr(user, 'role', 'Daycare Admin'),
            action="CHILD_MARK_ABSENT",
            module="Attendance Management",
            entity_type="StudentAttendance",
            entity_id=str(attendance.id),
            new_values={
                "student_id": str(student.id),
                "date": str(target_date),
                "status": "ABSENT",
                "remarks": remarks
            }
        )

        return attendance

    @classmethod
    def mark_excused_absence(cls, user, student_id, date_val=None, remarks=None, excused_reason_type=None, supporting_document_id=None):
        daycare = user.daycare
        if not daycare and not user.is_superuser:
            raise PermissionDenied("User is not associated with an active daycare.")

        target_date = cls._parse_date(date_val)

        if user.is_superuser:
            student = get_object_or_404(Student, pk=student_id, deleted_at__isnull=True)
        else:
            student = get_object_or_404(Student, pk=student_id, daycare=daycare, deleted_at__isnull=True)

        if student.status != 'Active':
            raise ValidationError("Cannot mark attendance for an inactive child.")

        active_asgn = ClassroomStudent.objects.filter(
            student=student,
            status='Active'
        ).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=target_date)
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=target_date)
        ).order_by('-start_date', '-created_at').first()
        classroom = active_asgn.classroom if active_asgn else None

        enrollment = ChildEnrollment.objects.filter(
            student=student,
            status='Active'
        ).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=target_date)
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=target_date)
        ).order_by('-start_date', '-created_at').first()

        doc = None
        if supporting_document_id:
            if user.is_superuser:
                doc = get_object_or_404(Document, pk=supporting_document_id)
            else:
                doc = get_object_or_404(Document, pk=supporting_document_id, daycare=daycare)

        attendance, created = StudentAttendance.objects.update_or_create(
            student=student,
            attendance_date=target_date,
            defaults={
                'daycare': daycare,
                'branch': student.branch,
                'classroom': classroom,
                'enrollment': enrollment,
                'attendance_status': 'EXCUSED_ABSENCE',
                'check_in_time': None,
                'check_out_time': None,
                'is_late': False,
                'is_early_pickup': False,
                'arrival_type': 'STANDARD',
                'departure_type': 'STANDARD',
                'excused_reason_type': excused_reason_type,
                'supporting_document': doc,
                'remarks': remarks or 'Excused absence',
                'notes': remarks or 'Excused absence',
                'updated_by': user,
            }
        )
        if created:
            attendance.created_by = user
            attendance.save()

        AuditLog.objects.create(
            user=user,
            user_type=getattr(user, 'role', 'Daycare Admin'),
            action="CHILD_MARK_EXCUSED",
            module="Attendance Management",
            entity_type="StudentAttendance",
            entity_id=str(attendance.id),
            new_values={
                "student_id": str(student.id),
                "date": str(target_date),
                "status": "EXCUSED_ABSENCE",
                "excused_reason_type": excused_reason_type,
                "supporting_document_id": str(doc.id) if doc else None,
                "remarks": remarks
            }
        )

        return attendance

    @classmethod
    def correct_attendance(cls, user, attendance_id, correction_reason, check_in_time=None,
                           check_out_time=None, attendance_status=None, is_late=None,
                           is_early_pickup=None, late_reason=None, early_pickup_reason=None,
                           remarks=None, notes=None, excused_reason_type=None,
                           supporting_document_id=None):
        if not correction_reason or not str(correction_reason).strip():
            raise ValidationError({"correction_reason": "A valid correction reason is strictly required."})

        daycare = user.daycare
        if not daycare and not user.is_superuser:
            raise PermissionDenied("User is not associated with an active daycare.")

        # Permission verification: Staff cannot correct without supervisor/admin rights
        is_admin = (
            user.is_superuser or 
            getattr(user, 'role', '') in ['Daycare Admin', 'Super Admin', 'Director', 'Owner'] or 
            getattr(user, 'is_staff', False)
        )
        if not is_admin:
            raise PermissionDenied("Only daycare administrators or authorized supervisors can correct attendance records.")

        if user.is_superuser:
            attendance = get_object_or_404(StudentAttendance, pk=attendance_id)
        else:
            attendance = get_object_or_404(StudentAttendance, pk=attendance_id, daycare=daycare)

        # Snapshot old values
        old_values = {
            "attendance_status": attendance.attendance_status,
            "check_in_time": str(attendance.check_in_time) if attendance.check_in_time else None,
            "check_out_time": str(attendance.check_out_time) if attendance.check_out_time else None,
            "is_late": attendance.is_late,
            "is_early_pickup": attendance.is_early_pickup,
            "late_reason": attendance.late_reason,
            "early_pickup_reason": attendance.early_pickup_reason,
            "remarks": attendance.remarks,
            "notes": attendance.notes,
            "excused_reason_type": attendance.excused_reason_type,
            "supporting_document_id": str(attendance.supporting_document_id) if attendance.supporting_document_id else None,
        }

        # Apply changes
        if check_in_time is not None:
            if check_in_time == '' or check_in_time is False:
                attendance.check_in_time = None
            else:
                attendance.check_in_time = cls._parse_time(check_in_time)

        if check_out_time is not None:
            if check_out_time == '' or check_out_time is False:
                attendance.check_out_time = None
            else:
                attendance.check_out_time = cls._parse_time(check_out_time)

        # Validate time ordering if both present
        if attendance.check_in_time and attendance.check_out_time:
            if attendance.check_out_time < attendance.check_in_time:
                raise ValidationError({"check_out_time": "Check-out time cannot be earlier than check-in time."})

        if attendance_status is not None:
            attendance.attendance_status = str(attendance_status).strip()

        if is_late is not None:
            if is_late in (False, 'false', 'False', 0, '0'):
                attendance.is_late = False
                if attendance.arrival_type == 'LATE':
                    attendance.arrival_type = 'STANDARD'
            elif is_late in (True, 'true', 'True', 1, '1'):
                attendance.is_late = True
                attendance.arrival_type = 'LATE'

        if is_early_pickup is not None:
            if is_early_pickup in (False, 'false', 'False', 0, '0'):
                attendance.is_early_pickup = False
                if attendance.departure_type == 'EARLY_PICKUP':
                    attendance.departure_type = 'STANDARD'
            elif is_early_pickup in (True, 'true', 'True', 1, '1'):
                attendance.is_early_pickup = True
                attendance.departure_type = 'EARLY_PICKUP'

        if late_reason is not None:
            attendance.late_reason = late_reason
        if early_pickup_reason is not None:
            attendance.early_pickup_reason = early_pickup_reason
        if remarks is not None:
            attendance.remarks = remarks
        if notes is not None:
            attendance.notes = notes
        if excused_reason_type is not None:
            attendance.excused_reason_type = excused_reason_type

        if supporting_document_id is not None:
            if supporting_document_id == '' or supporting_document_id is False:
                attendance.supporting_document = None
            else:
                doc = get_object_or_404(Document, pk=supporting_document_id, daycare=daycare)
                attendance.supporting_document = doc

        # Mark correction metadata
        now = timezone.now()
        attendance.is_corrected = True
        attendance.correction_reason = str(correction_reason).strip()
        attendance.corrected_by = user
        attendance.corrected_at = now
        attendance.updated_by = user
        attendance.save()

        # New values snapshot for audit
        new_values = {
            "attendance_status": attendance.attendance_status,
            "check_in_time": str(attendance.check_in_time) if attendance.check_in_time else None,
            "check_out_time": str(attendance.check_out_time) if attendance.check_out_time else None,
            "is_late": attendance.is_late,
            "is_early_pickup": attendance.is_early_pickup,
            "late_reason": attendance.late_reason,
            "early_pickup_reason": attendance.early_pickup_reason,
            "remarks": attendance.remarks,
            "notes": attendance.notes,
            "excused_reason_type": attendance.excused_reason_type,
            "correction_reason": attendance.correction_reason,
            "corrected_by": user.username,
            "corrected_at": str(now),
        }

        # Create AuditLog
        AuditLog.objects.create(
            user=user,
            user_type=getattr(user, 'role', 'Daycare Admin'),
            action="CORRECTION",
            module="Attendance Management",
            entity_type="StudentAttendance",
            entity_id=str(attendance.id),
            old_values=old_values,
            new_values=new_values
        )

        return attendance

    @classmethod
    def get_attendance_audit_trail(cls, user, attendance_id):
        daycare = user.daycare
        if not daycare and not user.is_superuser:
            raise PermissionDenied("User is not associated with an active daycare.")

        if user.is_superuser:
            attendance = get_object_or_404(StudentAttendance, pk=attendance_id)
        else:
            attendance = get_object_or_404(StudentAttendance, pk=attendance_id, daycare=daycare)

        logs = AuditLog.objects.filter(
            entity_type='StudentAttendance',
            entity_id=str(attendance.id)
        ).select_related('user').order_by('-created_at')

        return {
            "attendance_id": str(attendance.id),
            "student_id": str(attendance.student_id),
            "student_name": f"{attendance.student.first_name} {attendance.student.last_name}",
            "attendance_date": str(attendance.attendance_date),
            "current_status": attendance.attendance_status,
            "is_corrected": attendance.is_corrected,
            "correction_reason": attendance.correction_reason,
            "corrected_by_name": f"{attendance.corrected_by.first_name} {attendance.corrected_by.last_name}".strip() if attendance.corrected_by else None,
            "corrected_at": str(attendance.corrected_at) if attendance.corrected_at else None,
            "logs": logs
        }

    @classmethod
    def get_monthly_attendance_matrix(cls, user, year=None, month=None, classroom_id=None, student_id=None, status_filter=None, search=None):
        import calendar
        daycare = user.daycare
        if not daycare and not user.is_superuser:
            raise PermissionDenied("User is not associated with an active daycare.")

        now = timezone.now()
        target_year = int(year) if year else now.year
        target_month = int(month) if month else now.month

        if not (1 <= target_month <= 12):
            raise ValidationError("Month must be an integer between 1 and 12.")

        _, num_days = calendar.monthrange(target_year, target_month)
        month_start = date(target_year, target_month, 1)
        month_end = date(target_year, target_month, num_days)

        # Generate days list metadata
        days_in_month = []
        for d in range(1, num_days + 1):
            curr_date = date(target_year, target_month, d)
            weekday_abbr = curr_date.strftime("%a") # Mon, Tue, ...
            is_wknd = curr_date.weekday() >= 5 # 5=Sat, 6=Sun
            days_in_month.append({
                "day": d,
                "date": curr_date.isoformat(),
                "weekday": weekday_abbr,
                "is_weekend": is_wknd,
            })

        # Query active students for daycare
        if user.is_superuser:
            student_qs = Student.objects.filter(deleted_at__isnull=True, status='Active')
        else:
            student_qs = Student.objects.filter(daycare=daycare, deleted_at__isnull=True, status='Active')

        if student_id:
            student_qs = student_qs.filter(pk=student_id)

        if classroom_id and classroom_id != 'all':
            student_qs = student_qs.filter(
                classroom_assignments__classroom_id=classroom_id,
                classroom_assignments__status='Active'
            )

        if search:
            search = search.strip()
            student_qs = student_qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(admission_number__icontains=search)
            )

        students = student_qs.distinct().order_by('first_name', 'last_name')

        # Query all attendances in this month
        if user.is_superuser:
            att_qs = StudentAttendance.objects.filter(
                attendance_date__gte=month_start,
                attendance_date__lte=month_end
            )
        else:
            att_qs = StudentAttendance.objects.filter(
                daycare=daycare,
                attendance_date__gte=month_start,
                attendance_date__lte=month_end
            )

        # Map attendances by (student_id, day)
        att_map = {}
        for att in att_qs.select_related('classroom', 'received_by', 'released_by', 'pickup_person', 'corrected_by', 'supporting_document'):
            att_map[(att.student_id, att.attendance_date.day)] = att

        # Build student roster with monthly cells and counters
        student_rows = []
        month_total_present = 0
        month_total_absent = 0
        month_total_excused = 0
        month_total_late = 0
        month_total_early_pickup = 0

        for s in students:
            # Active classroom
            active_asgn = ClassroomStudent.objects.filter(
                student=s, status='Active'
            ).order_by('-start_date', '-created_at').first()
            classroom_info = {
                "id": str(active_asgn.classroom.id),
                "room_name": active_asgn.classroom.room_name
            } if active_asgn and active_asgn.classroom else None

            daily_cells = {}
            s_present = 0
            s_absent = 0
            s_excused = 0
            s_late = 0
            s_early = 0
            s_recorded = 0

            for d in range(1, num_days + 1):
                att = att_map.get((s.id, d))
                if att:
                    st = (att.attendance_status or '').upper()
                    code = '-'
                    if st == 'ABSENT':
                        code = 'A'
                        s_absent += 1
                        s_recorded += 1
                    elif st in ('EXCUSED_ABSENCE', 'EXCUSED'):
                        code = 'E'
                        s_excused += 1
                        s_recorded += 1
                    elif att.is_late or st == 'LATE':
                        code = 'L'
                        s_late += 1
                        s_present += 1
                        s_recorded += 1
                    elif att.is_early_pickup or st == 'EARLY_PICKUP':
                        code = 'EP'
                        s_early += 1
                        s_present += 1
                        s_recorded += 1
                    elif st == 'PRESENT' or att.check_in_time:
                        code = 'P'
                        s_present += 1
                        s_recorded += 1

                    daily_cells[str(d)] = {
                        "id": str(att.id),
                        "code": code,
                        "status": att.attendance_status,
                        "check_in_time": str(att.check_in_time) if att.check_in_time else None,
                        "check_out_time": str(att.check_out_time) if att.check_out_time else None,
                        "is_late": att.is_late,
                        "is_early_pickup": att.is_early_pickup,
                        "is_corrected": att.is_corrected,
                        "correction_reason": att.correction_reason,
                        "remarks": att.remarks,
                        "notes": att.notes,
                        "excused_reason_type": att.excused_reason_type,
                    }
                else:
                    daily_cells[str(d)] = {
                        "id": None,
                        "code": "-",
                        "status": "UNMARKED",
                        "check_in_time": None,
                        "check_out_time": None,
                        "is_late": False,
                        "is_early_pickup": False,
                        "is_corrected": False,
                        "correction_reason": None,
                        "remarks": None,
                        "notes": None,
                        "excused_reason_type": None,
                    }

            rate = round((s_present / s_recorded * 100), 1) if s_recorded > 0 else 100.0

            month_total_present += s_present
            month_total_absent += s_absent
            month_total_excused += s_excused
            month_total_late += s_late
            month_total_early_pickup += s_early

            # If status_filter is applied, filter out students with 0 occurrences of that status
            if status_filter and status_filter != 'all':
                st_f = status_filter.upper()
                if st_f == 'PRESENT' and s_present == 0:
                    continue
                elif st_f == 'ABSENT' and s_absent == 0:
                    continue
                elif st_f in ('EXCUSED_ABSENCE', 'EXCUSED') and s_excused == 0:
                    continue
                elif st_f == 'LATE' and s_late == 0:
                    continue
                elif st_f == 'EARLY_PICKUP' and s_early == 0:
                    continue

            student_rows.append({
                "student_id": str(s.id),
                "first_name": s.first_name,
                "last_name": s.last_name,
                "preferred_name": s.preferred_name,
                "admission_number": s.admission_number,
                "photo": s.photo,
                "classroom": classroom_info,
                "daily_cells": daily_cells,
                "summary": {
                    "present_count": s_present,
                    "absent_count": s_absent,
                    "excused_count": s_excused,
                    "late_count": s_late,
                    "early_pickup_count": s_early,
                    "total_recorded_days": s_recorded,
                    "attendance_rate": rate,
                }
            })

        return {
            "year": target_year,
            "month": target_month,
            "month_name": date(target_year, target_month, 1).strftime("%B"),
            "num_days": num_days,
            "days_in_month": days_in_month,
            "total_students": len(student_rows),
            "month_summary": {
                "total_present": month_total_present,
                "total_absent": month_total_absent,
                "total_excused": month_total_excused,
                "total_late": month_total_late,
                "total_early_pickup": month_total_early_pickup,
            },
            "students": student_rows,
        }

    @classmethod
    def get_child_history(cls, user, student_id, start_date=None, end_date=None, month=None, year=None):
        daycare = user.daycare
        if not daycare and not user.is_superuser:
            raise PermissionDenied("User is not associated with an active daycare.")

        if user.is_superuser:
            student = get_object_or_404(Student, pk=student_id, deleted_at__isnull=True)
        else:
            student = get_object_or_404(Student, pk=student_id, daycare=daycare, deleted_at__isnull=True)

        queryset = StudentAttendance.objects.filter(student=student)

        if start_date:
            parsed_start = cls._parse_date(start_date)
            queryset = queryset.filter(attendance_date__gte=parsed_start)

        if end_date:
            parsed_end = cls._parse_date(end_date)
            queryset = queryset.filter(attendance_date__lte=parsed_end)

        if year:
            queryset = queryset.filter(attendance_date__year=year)
        if month:
            queryset = queryset.filter(attendance_date__month=month)

        records = queryset.select_related(
            'classroom', 'received_by', 'released_by', 'pickup_person', 'created_by', 'updated_by'
        ).order_by('-attendance_date', '-created_at')

        # Summary statistics
        total_records = len(records)
        present_count = 0
        absent_count = 0
        excused_count = 0
        late_count = 0
        early_pickup_count = 0

        for r in records:
            st = (r.attendance_status or '').upper()
            if st in ('PRESENT', 'LATE', 'EARLY_PICKUP') or r.check_in_time is not None:
                present_count += 1
            if st == 'ABSENT':
                absent_count += 1
            if st in ('EXCUSED_ABSENCE', 'EXCUSED'):
                excused_count += 1
            if r.is_late or st == 'LATE':
                late_count += 1
            if r.is_early_pickup or st == 'EARLY_PICKUP':
                early_pickup_count += 1

        attendance_rate = round((present_count / total_records * 100), 1) if total_records > 0 else 100.0

        return {
            'student': {
                'id': str(student.id),
                'first_name': student.first_name,
                'last_name': student.last_name,
                'preferred_name': student.preferred_name,
                'admission_number': student.admission_number,
                'photo': student.photo,
                'status': student.status,
            },
            'summary': {
                'total_days': total_records,
                'present_count': present_count,
                'absent_count': absent_count,
                'excused_absence_count': excused_count,
                'late_count': late_count,
                'early_pickup_count': early_pickup_count,
                'attendance_rate': attendance_rate,
            },
            'records': records
        }

    @classmethod
    def get_master_attendance_dashboard(cls, daycare: Daycare, target_date=None) -> dict:
        """
        Aggregates live unified real-time dashboard data for Children and Staff on target_date.
        """
        from core.models import StaffAttendance, StaffSchedule

        target_date = cls._parse_date(target_date)

        # 1. Active enrolled children
        active_students = Student.objects.filter(daycare=daycare, status='Active', deleted_at__isnull=True)
        total_enrolled_children = active_students.count()

        # 2. Child attendance records for target_date
        child_att_qs = StudentAttendance.objects.filter(
            daycare=daycare, 
            attendance_date=target_date
        ).select_related('classroom', 'student')

        present_children = 0
        absent_children = 0
        excused_children = 0
        late_children = 0
        early_pickup_children = 0
        currently_in_daycare_children = 0

        for r in child_att_qs:
            st = (r.attendance_status or '').upper()
            if st in ('PRESENT', 'LATE', 'EARLY_PICKUP') or r.check_in_time is not None:
                present_children += 1
            if st == 'ABSENT':
                absent_children += 1
            if st in ('EXCUSED', 'EXCUSED_ABSENCE'):
                excused_children += 1
            if r.is_late or st == 'LATE':
                late_children += 1
            if r.is_early_pickup or st == 'EARLY_PICKUP':
                early_pickup_children += 1
            if r.check_in_time and not r.check_out_time:
                currently_in_daycare_children += 1

        not_arrived_children = max(0, total_enrolled_children - (present_children + absent_children + excused_children))

        # 3. Staff scheduling & attendance
        scheduled_shifts = StaffSchedule.objects.filter(
            daycare=daycare,
            date=target_date
        ).exclude(status='cancelled').select_related('employee', 'classroom')
        total_scheduled_staff = scheduled_shifts.count()

        staff_att_qs = StaffAttendance.objects.filter(
            daycare=daycare, 
            date=target_date
        ).select_related('employee', 'classroom')

        clocked_in_staff = 0
        on_break_staff = 0
        clocked_out_staff = 0
        missing_clock_out_staff = 0
        late_staff = 0
        overtime_candidates = 0

        now_time = timezone.now().time()
        is_today = (target_date == timezone.now().date())

        for s in staff_att_qs:
            st = s.status
            if st == 'CLOCKED_IN':
                clocked_in_staff += 1
            elif st == 'ON_BREAK':
                on_break_staff += 1
            elif st == 'CLOCKED_OUT':
                clocked_out_staff += 1

            if s.is_late:
                late_staff += 1

            if s.actual_working_hours > 8.0:
                overtime_candidates += 1

            if s.clock_in and not s.clock_out:
                if s.scheduled_shift and s.scheduled_shift.shift_end:
                    if not is_today or now_time > s.scheduled_shift.shift_end:
                        missing_clock_out_staff += 1
                elif not is_today:
                    missing_clock_out_staff += 1

        # 4. Classroom breakdown
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')
        classroom_summaries = []

        for c in classrooms:
            c_assignments = ClassroomStudent.objects.filter(
                classroom=c,
                status='Active'
            ).filter(
                Q(start_date__isnull=True) | Q(start_date__lte=target_date)
            ).filter(
                Q(end_date__isnull=True) | Q(end_date__gte=target_date)
            )
            c_enrolled = c_assignments.count()

            c_att = [r for r in child_att_qs if r.classroom_id == c.id]
            c_present = sum(1 for r in c_att if (r.attendance_status or '').upper() in ('PRESENT', 'LATE', 'EARLY_PICKUP') or r.check_in_time is not None)
            c_absent = sum(1 for r in c_att if (r.attendance_status or '').upper() == 'ABSENT')
            c_late = sum(1 for r in c_att if r.is_late or (r.attendance_status or '').upper() == 'LATE')
            c_checked_in = sum(1 for r in c_att if r.check_in_time and not r.check_out_time)
            c_checked_out = sum(1 for r in c_att if r.check_out_time)

            c_staff_shifts = [s for s in scheduled_shifts if s.classroom_id == c.id]
            c_staff_names = [f"{s.employee.first_name} {s.employee.last_name}" for s in c_staff_shifts]
            c_capacity = c.capacity or 10
            c_occupancy_pct = round((c_checked_in / c_capacity * 100), 1) if c_capacity > 0 else 0.0

            classroom_summaries.append({
                "id": str(c.id),
                "room_name": c.room_name,
                "room_code": getattr(c, 'room_code', ''),
                "capacity": c_capacity,
                "enrolled_children": c_enrolled,
                "present_children": c_present,
                "absent_children": c_absent,
                "late_children": c_late,
                "checked_in_children": c_checked_in,
                "checked_out_children": c_checked_out,
                "occupancy_percentage": c_occupancy_pct,
                "assigned_staff_count": len(c_staff_names),
                "assigned_staff": c_staff_names
            })

        return {
            "date": str(target_date),
            "children": {
                "total_enrolled": total_enrolled_children,
                "present": present_children,
                "absent": absent_children,
                "excused": excused_children,
                "late": late_children,
                "early_pickup": early_pickup_children,
                "not_arrived": not_arrived_children,
                "currently_in_daycare": currently_in_daycare_children,
            },
            "staff": {
                "scheduled_today": total_scheduled_staff,
                "clocked_in": clocked_in_staff,
                "on_break": on_break_staff,
                "clocked_out": clocked_out_staff,
                "missing_clock_out": missing_clock_out_staff,
                "late_staff": late_staff,
                "overtime_candidates": overtime_candidates,
            },
            "classrooms": classroom_summaries
        }

    @classmethod
    def get_daily_child_report(
        cls,
        daycare: Daycare,
        target_date=None,
        branch_id=None,
        classroom_id=None,
        student_id=None,
        status_filter=None,
        search=None
    ) -> dict:
        """
        Detailed Daily Child Attendance Report with filtering and summary metrics.
        """
        target_date = cls._parse_date(target_date)

        qs = StudentAttendance.objects.filter(
            daycare=daycare,
            attendance_date=target_date
        ).select_related(
            'student', 'classroom', 'branch', 'received_by', 'released_by', 'pickup_person'
        ).order_by('student__first_name', 'student__last_name')

        if branch_id and branch_id != 'all':
            qs = qs.filter(branch_id=branch_id)
        if classroom_id and classroom_id != 'all':
            qs = qs.filter(classroom_id=classroom_id)
        if student_id and student_id != 'all':
            qs = qs.filter(student_id=student_id)
        if status_filter and status_filter != 'all':
            qs = qs.filter(attendance_status__iexact=status_filter)
        if search:
            q = search.strip()
            qs = qs.filter(
                Q(student__first_name__icontains=q) |
                Q(student__last_name__icontains=q) |
                Q(student__admission_number__icontains=q)
            )

        records = list(qs)
        logs = []
        present_count = 0
        absent_count = 0
        excused_count = 0
        late_count = 0
        early_pickup_count = 0

        for r in records:
            st = (r.attendance_status or '').upper()
            if st in ('PRESENT', 'LATE', 'EARLY_PICKUP') or r.check_in_time is not None:
                present_count += 1
            if st == 'ABSENT':
                absent_count += 1
            if st in ('EXCUSED', 'EXCUSED_ABSENCE'):
                excused_count += 1
            if r.is_late or st == 'LATE':
                late_count += 1
            if r.is_early_pickup or st == 'EARLY_PICKUP':
                early_pickup_count += 1

            logs.append({
                "id": str(r.id),
                "student_id": str(r.student_id),
                "student_name": f"{r.student.first_name} {r.student.last_name}",
                "admission_number": r.student.admission_number,
                "classroom_name": r.classroom.room_name if r.classroom else 'General',
                "branch_name": r.branch.name if r.branch else 'Main',
                "check_in_time": r.check_in_time.strftime('%H:%M') if r.check_in_time else None,
                "check_out_time": r.check_out_time.strftime('%H:%M') if r.check_out_time else None,
                "status": r.attendance_status,
                "is_late": r.is_late,
                "is_early_pickup": r.is_early_pickup,
                "late_reason": r.late_reason or '',
                "remarks": r.remarks or r.notes or '',
                "received_by_name": f"{r.received_by.first_name} {r.received_by.last_name}".strip() if r.received_by else None,
                "released_by_name": f"{r.released_by.first_name} {r.released_by.last_name}".strip() if r.released_by else None,
                "pickup_person_name": r.pickup_person.name if r.pickup_person else None,
            })

        return {
            "summary": {
                "date": str(target_date),
                "total_records": len(records),
                "present": present_count,
                "absent": absent_count,
                "excused": excused_count,
                "late": late_count,
                "early_pickup": early_pickup_count
            },
            "records": logs
        }

    @classmethod
    def get_monthly_child_report(
        cls,
        daycare: Daycare,
        year: int,
        month: int,
        branch_id=None,
        classroom_id=None,
        student_id=None
    ) -> dict:
        """
        Monthly Child Attendance Report with centralized attendance percentage calculation.
        Excludes days outside enrollment periods.
        """
        from calendar import monthrange
        num_days = monthrange(year, month)[1]
        start_month = date(year, month, 1)
        end_month = date(year, month, num_days)

        students_qs = Student.objects.filter(
            daycare=daycare,
            status='Active',
            deleted_at__isnull=True
        ).order_by('first_name', 'last_name')

        if branch_id and branch_id != 'all':
            students_qs = students_qs.filter(branch_id=branch_id)
        if student_id and student_id != 'all':
            students_qs = students_qs.filter(id=student_id)

        attendances = StudentAttendance.objects.filter(
            daycare=daycare,
            attendance_date__year=year,
            attendance_date__month=month
        ).select_related('classroom')

        if classroom_id and classroom_id != 'all':
            attendances = attendances.filter(classroom_id=classroom_id)

        att_by_student = {}
        for a in attendances:
            att_by_student.setdefault(a.student_id, []).append(a)

        student_reports = []
        tot_present = 0
        tot_absent = 0
        tot_excused = 0
        tot_late = 0
        tot_early_pickup = 0

        # Calculate weekdays (operating days) in month
        operating_days_in_month = sum(1 for d in range(1, num_days + 1) if date(year, month, d).weekday() < 5)

        for s in students_qs:
            # Check enrollment date bounds within month
            enrollment = ChildEnrollment.objects.filter(student=s, status='Active').order_by('-start_date').first()
            enrolled_days = operating_days_in_month
            if enrollment:
                if enrollment.start_date and enrollment.start_date > start_month:
                    # Enrolled midway through month
                    enrolled_days = sum(
                        1 for d in range(1, num_days + 1)
                        if date(year, month, d).weekday() < 5 and date(year, month, d) >= enrollment.start_date
                    )
                if enrollment.end_date and enrollment.end_date < end_month:
                    enrolled_days = sum(
                        1 for d in range(1, num_days + 1)
                        if date(year, month, d).weekday() < 5 and date(year, month, d) <= enrollment.end_date
                    )

            s_records = att_by_student.get(s.id, [])
            present_days = 0
            absent_days = 0
            excused_days = 0
            late_days = 0
            early_pickup_days = 0

            for a in s_records:
                st = (a.attendance_status or '').upper()
                if st in ('PRESENT', 'LATE', 'EARLY_PICKUP') or a.check_in_time is not None:
                    present_days += 1
                if st == 'ABSENT':
                    absent_days += 1
                if st in ('EXCUSED', 'EXCUSED_ABSENCE'):
                    excused_days += 1
                if a.is_late or st == 'LATE':
                    late_days += 1
                if a.is_early_pickup or st == 'EARLY_PICKUP':
                    early_pickup_days += 1

            att_pct = round((present_days / enrolled_days * 100), 1) if enrolled_days > 0 else 0.0

            tot_present += present_days
            tot_absent += absent_days
            tot_excused += excused_days
            tot_late += late_days
            tot_early_pickup += early_pickup_days

            # Get classroom name
            c_name = 'General'
            if s_records and s_records[0].classroom:
                c_name = s_records[0].classroom.room_name
            else:
                asgn = ClassroomStudent.objects.filter(student=s, status='Active').first()
                if asgn and asgn.classroom:
                    c_name = asgn.classroom.room_name

            student_reports.append({
                "student_id": str(s.id),
                "student_name": f"{s.first_name} {s.last_name}",
                "admission_number": s.admission_number,
                "classroom_name": c_name,
                "enrolled_days": enrolled_days,
                "days_present": present_days,
                "days_absent": absent_days,
                "excused_absences": excused_days,
                "late_arrivals": late_days,
                "early_pickups": early_pickup_days,
                "attendance_percentage": att_pct
            })

        return {
            "summary": {
                "year": year,
                "month": month,
                "total_children": len(student_reports),
                "total_operating_days": operating_days_in_month,
                "total_days_present": tot_present,
                "total_days_absent": tot_absent,
                "total_excused_absences": tot_excused,
                "total_late_arrivals": tot_late,
                "total_early_pickups": tot_early_pickup,
            },
            "students": student_reports
        }

    @classmethod
    def get_unified_attendance_audit(
        cls,
        daycare: Daycare,
        start_date=None,
        end_date=None,
        user_id=None,
        student_id=None,
        employee_id=None,
        action=None,
        module=None
    ) -> dict:
        """
        Unified Audit Report across Child Attendance and Staff Attendance logs.
        """
        qs = AuditLog.objects.filter(
            module__in=["ATTENDANCE", "STAFF_ATTENDANCE"]
        ).select_related('user').order_by('-created_at')

        if start_date:
            qs = qs.filter(created_at__date__gte=start_date)
        if end_date:
            qs = qs.filter(created_at__date__lte=end_date)
        if user_id:
            qs = qs.filter(user_id=user_id)
        if action:
            qs = qs.filter(action=action)
        if module:
            qs = qs.filter(module=module)
        if student_id:
            qs = qs.filter(entity_id=str(student_id))
        if employee_id:
            qs = qs.filter(entity_id=str(employee_id))

        logs = []
        for log in qs[:300]:
            logs.append({
                "id": str(log.id),
                "created_at": log.created_at.isoformat(),
                "module": log.module,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "user_name": log.user.username if log.user else (log.user_type or 'System'),
                "old_values": log.old_values or {},
                "new_values": log.new_values or {},
                "correction_reason": (log.new_values or {}).get('correction_reason') or (log.new_values or {}).get('reason'),
                "rejection_reason": (log.new_values or {}).get('rejection_reason')
            })

        return {
            "count": len(logs),
            "logs": logs
        }

