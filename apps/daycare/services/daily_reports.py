import datetime
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import ValidationError

from core.models import (
    DailyReport, MealRecord, NapRecord, ToiletingRecord,
    ActivityRecord, MoodRecord, DailyTemperatureRecord,
    DailyNoteRecord, DailyPhotoRecord, Student, Classroom,
    StudentAttendance, ClassroomStudent, IncidentReport,
    MedicationAdministration, AuditLog, Family, Guardian,
    FamilyGuardian, FamilyChild, StaffNotification, User,
    StudentPickup
)


class DailyReportService:
    @staticmethod
    def get_or_create_daily_report(daycare, student, report_date, user, classroom_id=None):
        """
        Retrieves or creates a DailyReport for the given student, daycare, and date.
        Automatically links active attendance, classroom, and enrollment.
        """
        if isinstance(report_date, str):
            try:
                report_date = datetime.datetime.strptime(report_date, '%Y-%m-%d').date()
            except ValueError:
                raise ValidationError({"report_date": "Invalid date format. Expected YYYY-MM-DD."})

        with transaction.atomic():
            report = DailyReport.objects.filter(
                daycare=daycare,
                student=student,
                report_date=report_date
            ).first()

            if not report:
                # Find active classroom assignment if not provided
                classroom = None
                if classroom_id:
                    classroom = Classroom.objects.filter(id=classroom_id, daycare=daycare).first()
                if not classroom:
                    active_cs = ClassroomStudent.objects.filter(
                        student=student,
                        status='Active',
                        classroom__deleted_at__isnull=True
                    ).select_related('classroom').first()
                    if active_cs:
                        classroom = active_cs.classroom

                # Find attendance record for date
                attendance = StudentAttendance.objects.filter(
                    daycare=daycare,
                    student=student,
                    attendance_date=report_date
                ).first()

                report = DailyReport.objects.create(
                    daycare=daycare,
                    student=student,
                    branch=student.branch if hasattr(student, 'branch') else None,
                    classroom=classroom,
                    attendance_record=attendance,
                    report_date=report_date,
                    teacher=user,
                    updated_by=user,
                    status='Draft'
                )

                # Log audit
                DailyReportService._log_audit(
                    user=user,
                    action='CREATE',
                    entity_type='DailyReport',
                    entity_id=str(report.id),
                    new_values={
                        'student_id': str(student.id),
                        'report_date': str(report_date),
                        'status': 'Draft'
                    }
                )
            else:
                # Update attendance/classroom if missing
                dirty = False
                if not report.attendance_record:
                    att = StudentAttendance.objects.filter(
                        daycare=daycare, student=student, attendance_date=report_date
                    ).first()
                    if att:
                        report.attendance_record = att
                        dirty = True
                if not report.classroom and classroom_id:
                    cls = Classroom.objects.filter(id=classroom_id, daycare=daycare).first()
                    if cls:
                        report.classroom = cls
                        dirty = True
                if dirty:
                    report.updated_by = user
                    report.save()

            return report

    @staticmethod
    def get_classroom_roster_summary(daycare, classroom_id=None, report_date=None):
        """
        Returns a roster list for the given daycare, optional classroom, and date.
        """
        if not report_date:
            report_date = datetime.date.today()
        elif isinstance(report_date, str):
            try:
                report_date = datetime.datetime.strptime(report_date, '%Y-%m-%d').date()
            except ValueError:
                report_date = datetime.date.today()

        students_qs = Student.objects.filter(daycare=daycare, deleted_at__isnull=True)
        if classroom_id:
            student_ids = ClassroomStudent.objects.filter(
                classroom_id=classroom_id,
                classroom__daycare=daycare,
                status='Active'
            ).values_list('student_id', flat=True)
            students_qs = students_qs.filter(id__in=student_ids)

        cls_students = ClassroomStudent.objects.filter(
            student__daycare=daycare,
            status='Active'
        ).select_related('classroom')
        cls_map = {cs.student_id: cs.classroom for cs in cls_students}

        reports = {
            r.student_id: r for r in DailyReport.objects.filter(
                daycare=daycare,
                report_date=report_date
            ).prefetch_related(
                'meals', 'naps', 'toileting', 'activities',
                'moods', 'temperatures', 'staff_notes', 'photos'
            )
        }

        attendances = {
            a.student_id: a for a in StudentAttendance.objects.filter(
                daycare=daycare,
                attendance_date=report_date
            )
        }

        roster = []
        for s in students_qs:
            rep = reports.get(s.id)
            att = attendances.get(s.id)
            cls = cls_map.get(s.id)

            photo_url = s.photo if isinstance(s.photo, str) else (s.photo.url if getattr(s, 'photo', None) and hasattr(s.photo, 'url') else "")

            att_status = 'Unrecorded'
            if att:
                att_status = att.attendance_status if getattr(att, 'attendance_status', None) else (att.status if hasattr(att, 'status') else 'Unrecorded')

            is_present = str(att_status).lower() in ['present', 'late', 'checked in', 'checked_in']

            event_counts = {
                'meals': len(rep.meals.all()) if rep else 0,
                'naps': len(rep.naps.all()) if rep else 0,
                'toileting': len(rep.toileting.all()) if rep else 0,
                'activities': len(rep.activities.all()) if rep else 0,
                'moods': len(rep.moods.all()) if rep else 0,
                'temperatures': len(rep.temperatures.all()) if rep else 0,
                'notes': len(rep.staff_notes.all()) if rep else 0,
                'photos': len(rep.photos.all()) if rep else 0,
                'has_incident': bool(rep.notes and 'incident' in rep.notes.lower()) if (rep and rep.notes) else False,
                'has_medication': False,
            }
            total_events = (
                event_counts['meals'] + event_counts['naps'] +
                event_counts['toileting'] + event_counts['activities'] +
                event_counts['moods'] + event_counts['temperatures'] +
                event_counts['notes'] + event_counts['photos']
            ) if rep else 0

            roster.append({
                'child_id': str(s.id),
                'student_id': str(s.id),
                'child_name': f"{s.first_name or ''} {s.last_name or ''}".strip() or "Unnamed Child",
                'student_name': f"{s.first_name or ''} {s.last_name or ''}".strip() or "Unnamed Child",
                'first_name': s.first_name or '',
                'last_name': s.last_name or '',
                'preferred_name': getattr(s, 'preferred_name', '') or s.first_name or '',
                'photo_path': photo_url,
                'photo': photo_url,
                'classroom_id': str(cls.id) if cls else (str(classroom_id) if classroom_id else None),
                'classroom_name': cls.room_name if cls else 'General Classroom',
                'attendance_status': att_status,
                'is_present': is_present,
                'report_status': rep.status if rep else 'Not Started',
                'report_id': str(rep.id) if rep else None,
                'total_events': total_events,
                'event_counts': event_counts,
                'completed_at': rep.completed_at.isoformat() if (rep and rep.completed_at) else None,
                'published_at': rep.published_at.isoformat() if (rep and rep.published_at) else None,
            })
        return roster

    @staticmethod
    def calculate_duration_minutes(start_time, end_time):
        """
        Calculates duration in minutes between two time objects.
        Validates that end_time is not before start_time.
        """
        if not start_time or not end_time:
            return None

        if isinstance(start_time, str):
            start_time = datetime.datetime.strptime(start_time, '%H:%M:%S' if len(start_time) == 8 else '%H:%M').time()
        if isinstance(end_time, str):
            end_time = datetime.datetime.strptime(end_time, '%H:%M:%S' if len(end_time) == 8 else '%H:%M').time()

        if end_time < start_time:
            raise ValidationError({"end_time": "End time cannot be earlier than start time."})

        # Calculate difference in minutes
        dummy_date = datetime.date(2000, 1, 1)
        dt_start = datetime.datetime.combine(dummy_date, start_time)
        dt_end = datetime.datetime.combine(dummy_date, end_time)
        delta = dt_end - dt_start
        return int(delta.total_seconds() // 60)

    @staticmethod
    def check_nap_overlap(daily_report, start_time, end_time, exclude_id=None):
        """
        Verifies that a proposed nap does not overlap with existing naps in the same report.
        """
        if not start_time or not end_time:
            return

        if isinstance(start_time, str):
            start_time = datetime.datetime.strptime(start_time, '%H:%M:%S' if len(start_time) == 8 else '%H:%M').time()
        if isinstance(end_time, str):
            end_time = datetime.datetime.strptime(end_time, '%H:%M:%S' if len(end_time) == 8 else '%H:%M').time()

        qs = NapRecord.objects.filter(daily_report=daily_report)
        if exclude_id:
            qs = qs.exclude(id=exclude_id)

        for nap in qs:
            if nap.start_time and nap.end_time:
                # Overlap condition: start < other_end and end > other_start
                if start_time < nap.end_time and end_time > nap.start_time:
                    raise ValidationError({
                        "detail": f"Nap from {start_time.strftime('%H:%M')} to {end_time.strftime('%H:%M')} overlaps with an existing nap ({nap.start_time.strftime('%H:%M')} to {nap.end_time.strftime('%H:%M')})."
                    })

    @staticmethod
    def validate_temperature(temperature_value, unit='Celsius'):
        """
        Validates that a temperature value is within a reasonable human range.
        """
        try:
            val = float(temperature_value)
        except (ValueError, TypeError):
            raise ValidationError({"temperature_value": "Temperature value must be a valid number."})

        if unit == 'Fahrenheit':
            if val < 86.0 or val > 113.0:
                raise ValidationError({"temperature_value": "Fahrenheit temperature must be between 86.0°F and 113.0°F."})
        else: # Celsius
            if val < 30.0 or val > 45.0:
                raise ValidationError({"temperature_value": "Celsius temperature must be between 30.0°C and 45.0°C."})

        return val

    @staticmethod
    def add_meal_entry(daily_report, meal_type, meal_category='Meal', food_provided='', amount_eaten='All', time=None, notes='', user=None):
        with transaction.atomic():
            rec = MealRecord.objects.create(
                daily_report=daily_report,
                meal_type=meal_type,
                meal_category=meal_category,
                food_provided=food_provided or '',
                amount_eaten=amount_eaten or 'All',
                time=time,
                notes=notes or '',
                recorded_by=user
            )
            daily_report.updated_by = user
            daily_report.save(update_fields=['updated_by', 'updated_at'])

            DailyReportService._log_audit(
                user=user,
                action='CREATE',
                entity_type='MealRecord',
                entity_id=str(rec.id),
                new_values={
                    'daily_report_id': str(daily_report.id),
                    'meal_type': meal_type,
                    'meal_category': meal_category,
                    'amount_eaten': amount_eaten
                }
            )
            return rec

    @staticmethod
    def add_nap_entry(daily_report, start_time, end_time=None, quality='Slept', notes='', user=None):
        duration = None
        if start_time and end_time:
            duration = DailyReportService.calculate_duration_minutes(start_time, end_time)
            DailyReportService.check_nap_overlap(daily_report, start_time, end_time)

        with transaction.atomic():
            rec = NapRecord.objects.create(
                daily_report=daily_report,
                start_time=start_time,
                end_time=end_time,
                duration_minutes=duration,
                quality=quality or 'Slept',
                notes=notes or '',
                recorded_by=user
            )
            daily_report.updated_by = user
            daily_report.save(update_fields=['updated_by', 'updated_at'])

            DailyReportService._log_audit(
                user=user,
                action='CREATE',
                entity_type='NapRecord',
                entity_id=str(rec.id),
                new_values={
                    'daily_report_id': str(daily_report.id),
                    'start_time': str(start_time),
                    'end_time': str(end_time) if end_time else None,
                    'duration_minutes': duration,
                    'quality': quality
                }
            )
            return rec

    @staticmethod
    def add_toileting_entry(daily_report, record_type='Diaper', condition='Wet', assistance_level=None, time=None, notes='', user=None):
        with transaction.atomic():
            rec = ToiletingRecord.objects.create(
                daily_report=daily_report,
                type=record_type,
                condition=condition or 'Wet',
                assistance_level=assistance_level,
                time=time,
                notes=notes or '',
                recorded_by=user
            )
            daily_report.updated_by = user
            daily_report.save(update_fields=['updated_by', 'updated_at'])

            DailyReportService._log_audit(
                user=user,
                action='CREATE',
                entity_type='ToiletingRecord',
                entity_id=str(rec.id),
                new_values={
                    'daily_report_id': str(daily_report.id),
                    'type': record_type,
                    'condition': condition,
                    'assistance_level': assistance_level
                }
            )
            return rec

    @staticmethod
    def add_activity_entry(daily_report, activity_type='General Activity', activity_category='General Activity', name='', description='', teacher_notes='', start_time=None, end_time=None, learning_area=None, participation=None, user=None):
        duration = None
        if start_time and end_time:
            duration = DailyReportService.calculate_duration_minutes(start_time, end_time)

        with transaction.atomic():
            rec = ActivityRecord.objects.create(
                daily_report=daily_report,
                activity_type=activity_type,
                activity_category=activity_category or 'General Activity',
                name=name or activity_type,
                description=description or '',
                teacher_notes=teacher_notes or '',
                start_time=start_time,
                end_time=end_time,
                duration_minutes=duration,
                learning_area=learning_area,
                participation=participation,
                recorded_by=user
            )
            daily_report.updated_by = user
            daily_report.save(update_fields=['updated_by', 'updated_at'])

            DailyReportService._log_audit(
                user=user,
                action='CREATE',
                entity_type='ActivityRecord',
                entity_id=str(rec.id),
                new_values={
                    'daily_report_id': str(daily_report.id),
                    'activity_type': activity_type,
                    'name': name,
                    'duration_minutes': duration
                }
            )
            return rec

    @staticmethod
    def add_mood_entry(daily_report, mood='Happy', time=None, notes='', user=None):
        with transaction.atomic():
            rec = MoodRecord.objects.create(
                daily_report=daily_report,
                mood=mood or 'Happy',
                time=time,
                notes=notes or '',
                recorded_by=user
            )
            daily_report.updated_by = user
            daily_report.save(update_fields=['updated_by', 'updated_at'])

            DailyReportService._log_audit(
                user=user,
                action='CREATE',
                entity_type='MoodRecord',
                entity_id=str(rec.id),
                new_values={
                    'daily_report_id': str(daily_report.id),
                    'mood': mood
                }
            )
            return rec

    @staticmethod
    def add_temperature_entry(daily_report, temperature_value, unit='Celsius', time=None, method='Forehead', notes='', user=None):
        DailyReportService.validate_temperature(temperature_value, unit)

        with transaction.atomic():
            rec = DailyTemperatureRecord.objects.create(
                daily_report=daily_report,
                temperature_value=temperature_value,
                unit=unit or 'Celsius',
                time=time,
                method=method or 'Forehead',
                notes=notes or '',
                recorded_by=user
            )
            daily_report.updated_by = user
            daily_report.save(update_fields=['updated_by', 'updated_at'])

            DailyReportService._log_audit(
                user=user,
                action='CREATE',
                entity_type='DailyTemperatureRecord',
                entity_id=str(rec.id),
                new_values={
                    'daily_report_id': str(daily_report.id),
                    'temperature_value': str(temperature_value),
                    'unit': unit,
                    'method': method
                }
            )
            return rec

    @staticmethod
    def add_note_entry(daily_report, category='General', note_text='', time=None, user=None):
        if not note_text or not note_text.strip():
            raise ValidationError({"note_text": "Note text is required."})

        with transaction.atomic():
            rec = DailyNoteRecord.objects.create(
                daily_report=daily_report,
                time=time,
                category=category or 'General',
                note_text=note_text.strip(),
                created_by=user
            )
            daily_report.updated_by = user
            daily_report.save(update_fields=['updated_by', 'updated_at'])

            DailyReportService._log_audit(
                user=user,
                action='CREATE',
                entity_type='DailyNoteRecord',
                entity_id=str(rec.id),
                new_values={
                    'daily_report_id': str(daily_report.id),
                    'category': category
                }
            )
            return rec

    @staticmethod
    def add_photo_entry(daily_report, student, file_path=None, photo_url='', caption='', activity_context='', file_size=0, user=None):
        with transaction.atomic():
            rec = DailyPhotoRecord.objects.create(
                daily_report=daily_report,
                student=student,
                file_path=file_path,
                photo_url=photo_url or '',
                caption=caption or '',
                activity_context=activity_context or '',
                file_size=file_size or 0,
                uploaded_by=user
            )
            daily_report.updated_by = user
            daily_report.save(update_fields=['updated_by', 'updated_at'])

            DailyReportService._log_audit(
                user=user,
                action='CREATE',
                entity_type='DailyPhotoRecord',
                entity_id=str(rec.id),
                new_values={
                    'daily_report_id': str(daily_report.id),
                    'student_id': str(student.id),
                    'caption': caption
                }
            )
            return rec

    @staticmethod
    def complete_report(daily_report, user=None):
        daily_report.status = 'Completed'
        daily_report.completed_at = timezone.now()
        daily_report.updated_by = user
        daily_report.save(update_fields=['status', 'completed_at', 'updated_by', 'updated_at'])

        DailyReportService._log_audit(
            user=user,
            action='UPDATE',
            entity_type='DailyReport',
            entity_id=str(daily_report.id),
            new_values={'status': 'Completed', 'completed_at': str(daily_report.completed_at)}
        )
        return daily_report

    @staticmethod
    def publish_report(daily_report, user=None):
        was_published = daily_report.status == 'Published'
        daily_report.status = 'Published'
        daily_report.published_at = timezone.now()
        if not daily_report.completed_at:
            daily_report.completed_at = timezone.now()
        daily_report.updated_by = user
        daily_report.save(update_fields=['status', 'published_at', 'completed_at', 'updated_by', 'updated_at'])

        DailyReportService._log_audit(
            user=user,
            action='PUBLISH',
            entity_type='DailyReport',
            entity_id=str(daily_report.id),
            new_values={'status': 'Published', 'published_at': str(daily_report.published_at)}
        )

        # Notify authorized guardians if not previously published
        if not was_published:
            DailyReportService._notify_guardians_of_published_report(daily_report)

        return daily_report

    @staticmethod
    def _notify_guardians_of_published_report(daily_report):
        """
        Dispatches in-app notification to authorized guardians for this child.
        Ensures non-sensitive notification content and avoids duplicate notifications.
        """
        try:
            student = daily_report.student
            daycare = daily_report.daycare
            
            # Find guardians linked through FamilyChild -> FamilyGuardian -> Guardian
            guardian_user_ids = set()
            family_ids = FamilyChild.objects.filter(student=student).values_list('family_id', flat=True)
            if family_ids:
                guardians = Guardian.objects.filter(
                    guardian_families__family_id__in=family_ids,
                    user__isnull=False
                ).select_related('user')
                for g in guardians:
                    if g.user:
                        guardian_user_ids.add(g.user.id)

            # Also check Authorized pickups with linked user account
            pickups = StudentPickup.objects.filter(student=student, daycare=daycare)
            for p in pickups:
                if p.email:
                    pickup_user = User.objects.filter(email=p.email).first()
                    if pickup_user:
                        guardian_user_ids.add(pickup_user.id)

            report_date_str = daily_report.report_date.strftime('%B %d, %Y')
            child_name = student.preferred_name or student.first_name
            title = "Daily Report Available"
            message = f"{child_name}'s daily report for {report_date_str} is now available in the Family Portal."

            for uid in guardian_user_ids:
                # Check for existing duplicate notification
                exists = StaffNotification.objects.filter(
                    daycare=daycare,
                    user_id=uid,
                    notification_type='daily_report_published',
                    title=title,
                    message__icontains=str(daily_report.id)
                ).exists()

                if not exists:
                    StaffNotification.objects.create(
                        daycare=daycare,
                        user_id=uid,
                        notification_type='daily_report_published',
                        title=title,
                        message=f"{message} [ref:{daily_report.id}]",
                        is_read=False
                    )
        except Exception:
            # Non-blocking notification dispatch
            pass

    @staticmethod
    def get_guardian_authorized_student_ids(user):
        """
        Returns list of student UUIDs that the given guardian user has access to.
        Checks both FamilyGuardian relations and StudentPickup authorizations.
        """
        if not user or not user.is_authenticated:
            return []

        student_ids = set()

        # 1. Family Guardian profile link
        guardian = getattr(user, 'guardian_profile', None) or getattr(user, 'guardian', None)
        if not guardian:
            guardian = Guardian.objects.filter(user=user).first()

        if guardian:
            family_ids = FamilyGuardian.objects.filter(guardian=guardian).values_list('family_id', flat=True)
            s_ids = FamilyChild.objects.filter(family_id__in=family_ids).values_list('student_id', flat=True)
            student_ids.update(s_ids)

        # 2. Email matching on Guardian record
        if user.email:
            guardians_by_email = Guardian.objects.filter(email=user.email)
            fam_ids = FamilyGuardian.objects.filter(guardian__in=guardians_by_email).values_list('family_id', flat=True)
            s_ids = FamilyChild.objects.filter(family_id__in=fam_ids).values_list('student_id', flat=True)
            student_ids.update(s_ids)

            pickup_s_ids = StudentPickup.objects.filter(email=user.email).values_list('student_id', flat=True)
            student_ids.update(pickup_s_ids)

        return list(student_ids)

    @staticmethod
    def get_guardian_daily_reports(user, student_id=None, date=None, start_date=None, end_date=None, year=None, month=None):
        """
        Returns published daily reports for the guardian's authorized children.
        """
        authorized_ids = DailyReportService.get_guardian_authorized_student_ids(user)
        if not authorized_ids:
            return DailyReport.objects.none()

        qs = DailyReport.objects.filter(
            student_id__in=authorized_ids,
            status='Published',
            deleted_at__isnull=True
        ).select_related('student', 'classroom', 'teacher', 'attendance_record').prefetch_related(
            'meals', 'naps', 'toileting', 'activities',
            'moods', 'temperatures', 'staff_notes', 'photos'
        ).order_by('-report_date', '-created_at')

        if student_id:
            if str(student_id) in [str(s) for s in authorized_ids]:
                qs = qs.filter(student_id=student_id)
            else:
                return DailyReport.objects.none()

        if date:
            if isinstance(date, str):
                try:
                    date = datetime.datetime.strptime(date, '%Y-%m-%d').date()
                except ValueError:
                    pass
            qs = qs.filter(report_date=date)

        if start_date:
            if isinstance(start_date, str):
                try:
                    start_date = datetime.datetime.strptime(start_date, '%Y-%m-%d').date()
                except ValueError:
                    pass
            qs = qs.filter(report_date__gte=start_date)

        if end_date:
            if isinstance(end_date, str):
                try:
                    end_date = datetime.datetime.strptime(end_date, '%Y-%m-%d').date()
                except ValueError:
                    pass
            qs = qs.filter(report_date__lte=end_date)

        if year and month:
            try:
                qs = qs.filter(report_date__year=int(year), report_date__month=int(month))
            except ValueError:
                pass

        return qs

    @staticmethod
    def get_guardian_daily_report_detail(user, student_id=None, report_date=None, date=None, report_id=None):
        """
        Fetches single published daily report for an authorized guardian child and logs audit access.
        """
        report_date = report_date or date
        authorized_ids = DailyReportService.get_guardian_authorized_student_ids(user)
        if not authorized_ids:
            return None

        qs = DailyReport.objects.filter(
            status='Published',
            deleted_at__isnull=True
        ).select_related('student', 'classroom', 'teacher', 'attendance_record').prefetch_related(
            'meals', 'naps', 'toileting', 'activities',
            'moods', 'temperatures', 'staff_notes', 'photos'
        )

        if report_id:
            report = qs.filter(id=report_id, student_id__in=authorized_ids).first()
        elif student_id and report_date:
            if str(student_id) not in [str(s) for s in authorized_ids]:
                return None
            if isinstance(report_date, str):
                try:
                    report_date = datetime.datetime.strptime(report_date, '%Y-%m-%d').date()
                except ValueError:
                    pass
            report = qs.filter(student_id=student_id, report_date=report_date).first()
        else:
            return None

        if report:
            DailyReportService._log_audit(
                user=user,
                action='VIEW',
                entity_type='DailyReport',
                entity_id=str(report.id),
                new_values={'guardian_viewed': True, 'report_date': str(report.report_date)}
            )

        return report

    @staticmethod
    def get_daycare_dashboard_summary(daycare, target_date=None):
        """
        Returns aggregated daily KPI stats and per-classroom breakdown.
        """
        if not target_date:
            target_date = datetime.date.today()
        elif isinstance(target_date, str):
            try:
                target_date = datetime.datetime.strptime(target_date, '%Y-%m-%d').date()
            except ValueError:
                target_date = datetime.date.today()

        all_students = Student.objects.filter(daycare=daycare, status='Active', deleted_at__isnull=True)
        total_enrolled = all_students.count()

        # Attendances
        attendances = {
            att.student_id: att
            for att in StudentAttendance.objects.filter(daycare=daycare, attendance_date=target_date)
        }

        # Daily Reports for today
        reports = {
            rep.student_id: rep
            for rep in DailyReport.objects.filter(daycare=daycare, report_date=target_date, deleted_at__isnull=True).select_related('classroom')
        }

        total_present = 0
        total_absent = 0
        for s in all_students:
            att = attendances.get(s.id)
            if att:
                status_upper = getattr(att, 'attendance_status', '').upper()
                if status_upper in ['PRESENT', 'LATE', 'EARLY_PICKUP']:
                    total_present += 1
                elif status_upper in ['ABSENT', 'EXCUSED_ABSENCE']:
                    total_absent += 1

        reports_started = 0
        reports_completed = 0
        reports_published = 0
        for rep in reports.values():
            if rep.status == 'Draft':
                reports_started += 1
            elif rep.status == 'Completed':
                reports_completed += 1
            elif rep.status == 'Published':
                reports_published += 1

        reports_pending = max(0, total_present - reports_published)

        # Classroom Breakdown
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')
        classroom_summaries = []

        for room in classrooms:
            room_student_ids = ClassroomStudent.objects.filter(
                classroom=room, status='Active'
            ).values_list('student_id', flat=True)

            room_students = all_students.filter(id__in=room_student_ids)
            r_enrolled = room_students.count()

            r_present = 0
            r_started = 0
            r_completed = 0
            r_published = 0
            pending_list = []

            for st in room_students:
                att = attendances.get(st.id)
                is_pres = att and (getattr(att, 'attendance_status', '').upper() in ['PRESENT', 'LATE', 'EARLY_PICKUP'])
                if is_pres:
                    r_present += 1

                rep = reports.get(st.id)
                st_status = rep.status if rep else ('Not Started' if is_pres else 'No Report')

                if rep:
                    if rep.status == 'Draft':
                        r_started += 1
                    elif rep.status == 'Completed':
                        r_completed += 1
                    elif rep.status == 'Published':
                        r_published += 1

                if is_pres and (not rep or rep.status != 'Published'):
                    pending_list.append({
                        'child_id': str(st.id),
                        'child_name': f"{st.first_name} {st.last_name}".strip(),
                        'photo': st.photo if hasattr(st, 'photo') else None,
                        'attendance_status': getattr(att, 'attendance_status', 'PRESENT') if att else 'PRESENT',
                        'report_status': st_status,
                        'report_id': str(rep.id) if rep else None,
                    })

            r_pending = max(0, r_present - r_published)
            completion_rate = int(round((r_published / r_present) * 100)) if r_present > 0 else 100

            classroom_summaries.append({
                'classroom_id': str(room.id),
                'room_name': room.room_name,
                'room_code': room.room_code or '',
                'total_enrolled': r_enrolled,
                'total_present': r_present,
                'reports_started': r_started,
                'reports_completed': r_completed,
                'reports_published': r_published,
                'reports_pending': r_pending,
                'completion_rate_percent': completion_rate,
                'pending_reports': pending_list,
            })

        # Flatten all pending children across classrooms
        all_pending_children = []
        for c in classroom_summaries:
            all_pending_children.extend(c.get('pending_reports', []))

        return {
            'target_date': str(target_date),
            'kpis': {
                'total_enrolled': total_enrolled,
                'total_present': total_present,
                'total_absent': total_absent,
                'reports_started': reports_started,
                'reports_completed': reports_completed,
                'reports_published': reports_published,
                'total_published': reports_published,
                'reports_pending': reports_pending,
                'total_pending': reports_pending,
            },
            'classrooms': classroom_summaries,
            'pending_children': all_pending_children,
        }

    @staticmethod
    def get_report_completion_checklist(daily_report):
        """
        Calculates checklist completion status across care categories:
        Recorded / Not Recorded / Not Applicable.
        """
        meal_count = daily_report.meals.filter(meal_category='Meal').count()
        snack_count = daily_report.meals.filter(meal_category='Snack').count()
        nap_count = daily_report.naps.count()
        toileting_count = daily_report.toileting.count()
        activity_count = daily_report.activities.filter(activity_category__in=['General Activity', 'Circle Time', 'Sensory', 'Creative Arts', 'Music', 'STEM', 'Other']).count()
        outdoor_count = daily_report.activities.filter(activity_category='Outdoor Play').count()
        learning_count = daily_report.activities.filter(Q(activity_category='Learning & Development') | Q(learning_area__isnull=False)).count()
        mood_count = daily_report.moods.count()
        temp_count = daily_report.temperatures.count()
        notes_count = daily_report.staff_notes.count()
        photos_count = daily_report.photos.count()

        sections = [
            {
                'key': 'meals',
                'label': 'Meals (Breakfast / Lunch / Dinner)',
                'status': 'Recorded' if meal_count > 0 else 'Not Recorded',
                'count': meal_count,
                'icon': 'Utensils',
            },
            {
                'key': 'snacks',
                'label': 'Snacks (AM / PM / Late Snack)',
                'status': 'Recorded' if snack_count > 0 else 'Not Recorded',
                'count': snack_count,
                'icon': 'Coffee',
            },
            {
                'key': 'naps',
                'label': 'Nap & Rest Sessions',
                'status': 'Recorded' if nap_count > 0 else 'Not Recorded',
                'count': nap_count,
                'icon': 'Moon',
            },
            {
                'key': 'toileting',
                'label': 'Diapers & Potty Routine',
                'status': 'Recorded' if toileting_count > 0 else 'Not Recorded',
                'count': toileting_count,
                'icon': 'Baby',
            },
            {
                'key': 'activities',
                'label': 'Activities & Play',
                'status': 'Recorded' if activity_count > 0 else 'Not Recorded',
                'count': activity_count,
                'icon': 'BookOpen',
            },
            {
                'key': 'learning',
                'label': 'Learning & Milestones',
                'status': 'Recorded' if learning_count > 0 else 'Not Recorded',
                'count': learning_count,
                'icon': 'Sparkles',
            },
            {
                'key': 'outdoor_play',
                'label': 'Outdoor Play',
                'status': 'Recorded' if outdoor_count > 0 else 'Not Recorded',
                'count': outdoor_count,
                'icon': 'Sun',
            },
            {
                'key': 'mood',
                'label': 'Mood & Demeanor',
                'status': 'Recorded' if mood_count > 0 else 'Not Recorded',
                'count': mood_count,
                'icon': 'Smile',
            },
            {
                'key': 'temperature',
                'label': 'Health & Temperature Checks',
                'status': 'Recorded' if temp_count > 0 else 'Not Applicable',
                'count': temp_count,
                'icon': 'Thermometer',
            },
            {
                'key': 'notes',
                'label': 'Staff Notes & Reminders',
                'status': 'Recorded' if notes_count > 0 else 'Not Recorded',
                'count': notes_count,
                'icon': 'FileText',
            },
            {
                'key': 'photos',
                'label': 'Daily Photos',
                'status': 'Recorded' if photos_count > 0 else 'Not Recorded',
                'count': photos_count,
                'icon': 'Camera',
            },
        ]

        core_keys = ['meals', 'naps', 'toileting', 'activities', 'mood']
        recorded_count = sum(1 for s in sections if s['status'] == 'Recorded')
        total_domains = len(sections)
        recorded_core = sum(1 for s in sections if s['key'] in core_keys and s['status'] == 'Recorded')
        score_percent = int(round((recorded_core / len(core_keys)) * 100))

        domains_dict = {s['key']: s for s in sections}
        domains_dict['moods'] = domains_dict.get('mood')
        domains_dict['temperatures'] = domains_dict.get('temperature')
        domains_dict['staff_notes'] = domains_dict.get('notes')

        return {
            'report_id': str(daily_report.id),
            'status': daily_report.status,
            'completion_percentage': score_percent,
            'total_domains': total_domains,
            'recorded_count': recorded_count,
            'is_ready_to_publish': recorded_core >= 3,
            'sections': sections,
            'domains': domains_dict,
        }

    @staticmethod
    def search_historical_reports(daycare, start_date=None, end_date=None, classroom_id=None, student_id=None, status_filter=None, query=None):
        """
        Historical search query engine for daycare staff and administrators.
        """
        qs = DailyReport.objects.filter(
            daycare=daycare,
            deleted_at__isnull=True
        ).select_related('student', 'classroom', 'teacher', 'attendance_record').prefetch_related(
            'meals', 'naps', 'toileting', 'activities',
            'moods', 'temperatures', 'staff_notes', 'photos'
        ).order_by('-report_date', '-created_at')

        if start_date:
            if isinstance(start_date, str):
                try:
                    start_date = datetime.datetime.strptime(start_date, '%Y-%m-%d').date()
                except ValueError:
                    pass
            qs = qs.filter(report_date__gte=start_date)

        if end_date:
            if isinstance(end_date, str):
                try:
                    end_date = datetime.datetime.strptime(end_date, '%Y-%m-%d').date()
                except ValueError:
                    pass
            qs = qs.filter(report_date__lte=end_date)

        if classroom_id:
            qs = qs.filter(classroom_id=classroom_id)

        if student_id:
            qs = qs.filter(student_id=student_id)

        if status_filter and status_filter.lower() != 'all':
            qs = qs.filter(status__iexact=status_filter)

        if query:
            qs = qs.filter(
                Q(student__first_name__icontains=query) |
                Q(student__last_name__icontains=query) |
                Q(notes__icontains=query) |
                Q(classroom__room_name__icontains=query)
            )

        return qs

    @staticmethod
    def _log_audit(user, action, entity_type, entity_id, old_values=None, new_values=None):
        try:
            user_type = getattr(user, 'role', 'Staff') if user else 'System'
            AuditLog.objects.create(
                user=user if user and hasattr(user, 'is_authenticated') and user.is_authenticated else None,
                user_type=user_type,
                action=action,
                module='DailyReports',
                entity_type=entity_type,
                entity_id=entity_id,
                old_values=old_values,
                new_values=new_values
            )
        except Exception:
            pass
