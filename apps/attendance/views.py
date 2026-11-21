import datetime
from django.contrib import messages
from django.db.models import Q
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from django.views import View

from core.decorators import StaffRequiredMixin
from core.models import (
    Daycare, Student, Classroom, StudentAttendance, DailyReport,
    MealRecord, NapRecord, ActivityRecord, ToiletingRecord, MoodRecord,
    DailyTemperatureRecord, DailyPhotoRecord, IncidentReport,
    Medication, MedicationAdministration, StudentPickup, Employee, AuditLog
)
from daycare.services.attendance import AttendanceService
from daycare.services.pickup import PickupVerificationService
from daycare.services.daily_reports import DailyReportService
from daycare.services.ratio_monitoring import RatioMonitoringService


def get_user_daycare(user):
    if hasattr(user, 'daycare') and user.daycare:
        return user.daycare
    if hasattr(user, 'employee_profile') and user.employee_profile and getattr(user.employee_profile, 'daycare', None):
        return user.employee_profile.daycare
    first = Daycare.objects.first()
    return first


class DailyAttendanceRollCallView(StaffRequiredMixin, View):
    """
    Phase 1 (Morning Arrival) & Phase 3 (Afternoon Departure) Workstation:
    1. Authorized drop-off / pickup identity verification
    2. Check-in and check-out processing (PIN, QR, or staff-assisted)
    3. Live provincial ratio evaluation and real-time classroom presence
    4. Auto-generation & publishing of daily child reports
    """
    template_name = 'daycare/attendance/daily.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.now().date()
        date_str = request.GET.get('date', today.strftime('%Y-%m-%d'))
        try:
            target_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            target_date = today
            date_str = today.strftime('%Y-%m-%d')

        room_id = request.GET.get('classroom_id')

        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')
        children_qs = Student.objects.filter(
            daycare=daycare,
            status__iexact='Active',
            deleted_at__isnull=True
        ).prefetch_related(
            'classroom_enrollments__classroom',
            'pickups'
        ).order_by('first_name', 'last_name')

        selected_room_obj = None
        if room_id:
            selected_room_obj = classrooms.filter(id=room_id).first()
            if selected_room_obj:
                children_qs = children_qs.filter(
                    classroom_enrollments__classroom=selected_room_obj,
                    classroom_enrollments__status__iexact='Active'
                ).distinct()

        # Fetch attendance records for this date
        attendance_map = {
            att.student_id: att
            for att in StudentAttendance.objects.filter(
                daycare=daycare,
                attendance_date=target_date
            ).select_related('classroom', 'received_by', 'released_by', 'pickup_person')
        }

        # Fetch daily reports for this date
        reports_map = {
            rep.student_id: rep
            for rep in DailyReport.objects.filter(
                daycare=daycare,
                report_date=target_date
            )
        }

        child_list = []
        checked_in_count = 0
        checked_out_count = 0
        absent_count = 0
        unrecorded_count = 0

        for child in children_qs:
            att = attendance_map.get(child.id)
            report = reports_map.get(child.id)
            status_normalized = (att.attendance_status if att else '').upper()

            if status_normalized in ['PRESENT', 'CHECKED_IN', 'LATE']:
                if att and att.check_out_time:
                    checked_out_count += 1
                else:
                    checked_in_count += 1
            elif status_normalized in ['CHECKED_OUT', 'EARLY_PICKUP']:
                checked_out_count += 1
            elif status_normalized in ['ABSENT', 'EXCUSED']:
                absent_count += 1
            else:
                unrecorded_count += 1

            # Authorized pickups for modal
            active_pickups = [p for p in child.pickups.all() if (p.authorization_status or '').upper() == 'ACTIVE']

            # Resolve primary classroom
            child_room = None
            if selected_room_obj:
                child_room = selected_room_obj
            elif child.classroom:
                child_room = child.classroom
            else:
                active_enrollment = child.classroom_enrollments.filter(status__iexact='Active').first()
                if active_enrollment:
                    child_room = active_enrollment.classroom

            child_list.append({
                'child': child,
                'attendance': att,
                'report': report,
                'classroom': child_room,
                'active_pickups': active_pickups,
            })

        # Calculate live ratios
        room_ratios = []
        active_ratio_banner = None
        for room in classrooms:
            try:
                ratio_info = RatioMonitoringService.calculate_classroom_ratio(room, target_date=target_date)
            except Exception:
                ratio_info = {
                    'children_present': 0,
                    'total_staff_present': 0,
                    'required_staff': 1,
                    'ratio': '0:0',
                    'status': 'COMPLIANT',
                    'rule': {'max_children_per_staff': getattr(room, 'capacity', 5) or 5}
                }
            room_entry = {
                'classroom': room,
                'ratio': ratio_info
            }
            room_ratios.append(room_entry)
            if selected_room_obj and selected_room_obj.id == room.id:
                active_ratio_banner = ratio_info

        if not active_ratio_banner and room_ratios:
            active_ratio_banner = room_ratios[0]['ratio']

        context = {
            'child_list': child_list,
            'classrooms': classrooms,
            'selected_date': date_str,
            'selected_room': room_id,
            'selected_room_obj': selected_room_obj,
            'room_ratios': room_ratios,
            'active_ratio_banner': active_ratio_banner,
            'total_children': len(children_qs),
            'checked_in_count': checked_in_count,
            'checked_out_count': checked_out_count,
            'absent_count': absent_count,
            'unrecorded_count': unrecorded_count,
        }
        return render(request, self.template_name, context)

    def post(self, request):
        daycare = get_user_daycare(request.user)
        action = request.POST.get('action', 'quick_toggle')
        student_id = request.POST.get('student_id')
        date_str = request.POST.get('date', timezone.now().date().strftime('%Y-%m-%d'))

        try:
            target_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            target_date = timezone.now().date()
            date_str = target_date.strftime('%Y-%m-%d')

        student = get_object_or_404(Student, pk=student_id, daycare=daycare)
        acting_emp = Employee.objects.filter(user=request.user, daycare=daycare).first()

        # ==========================================
        # 1. MORNING CHECK-IN WORKFLOW
        # ==========================================
        if action == 'check_in':
            time_val = request.POST.get('check_in_time')
            if time_val:
                try:
                    actual_time = datetime.datetime.strptime(time_val.strip(), '%H:%M').time()
                except ValueError:
                    actual_time = timezone.now().time()
            else:
                actual_time = timezone.now().time()

            drop_off_person_id = request.POST.get('drop_off_person_id')
            drop_off_name = request.POST.get('drop_off_name', '').strip()
            arrival_type = request.POST.get('arrival_type', 'STAFF_ASSISTED')
            remarks = request.POST.get('remarks', '').strip()
            classroom_id = request.POST.get('classroom_id')

            classroom = None
            if classroom_id:
                classroom = Classroom.objects.filter(id=classroom_id, daycare=daycare).first()
            if not classroom:
                classroom = student.classroom

            # Drop-off verification & notes
            drop_off_label = ""
            if drop_off_person_id:
                pickup_rec = StudentPickup.objects.filter(id=drop_off_person_id, student=student).first()
                if pickup_rec:
                    drop_off_label = f"Drop-off by: {pickup_rec.name} ({pickup_rec.relationship})"
            elif drop_off_name:
                drop_off_label = f"Drop-off by: {drop_off_name}"

            full_remarks = f"{drop_off_label} | {remarks}".strip(' |') if drop_off_label else remarks

            att, created = StudentAttendance.objects.get_or_create(
                daycare=daycare,
                student=student,
                attendance_date=target_date,
                defaults={
                    'classroom': classroom,
                    'created_by': request.user
                }
            )
            att.classroom = classroom or att.classroom
            att.attendance_status = 'PRESENT'
            att.check_in_time = actual_time
            att.check_out_time = None
            att.arrival_type = arrival_type
            att.received_by = acting_emp
            att.remarks = full_remarks
            att.notes = full_remarks
            att.updated_by = request.user
            att.save()

            # Ensure draft DailyReport exists for educator activities
            DailyReportService.get_or_create_daily_report(
                daycare=daycare,
                student=student,
                report_date=target_date,
                user=request.user,
                classroom_id=classroom.id if classroom else None
            )

            # Ratio verification feedback
            ratio_status = "Compliant"
            if classroom:
                try:
                    r_calc = RatioMonitoringService.calculate_classroom_ratio(classroom, target_date=target_date)
                    ratio_status = r_calc.get('status', 'Compliant')
                except Exception:
                    pass

            messages.success(
                request,
                f"Successfully checked in {student.first_name} {student.last_name} at {actual_time.strftime('%I:%M %p')}. "
                f"Room ratio: {ratio_status}."
            )

        # ==========================================
        # 2. AFTERNOON CHECK-OUT WORKFLOW
        # ==========================================
        elif action == 'check_out':
            time_val = request.POST.get('check_out_time')
            if time_val:
                try:
                    actual_time = datetime.datetime.strptime(time_val.strip(), '%H:%M').time()
                except ValueError:
                    actual_time = timezone.now().time()
            else:
                actual_time = timezone.now().time()

            pickup_person_id = request.POST.get('pickup_person_id')
            departure_type = request.POST.get('departure_type', 'STANDARD')
            early_reason = request.POST.get('early_pickup_reason', '').strip()
            remarks = request.POST.get('remarks', '').strip()
            publish_report = request.POST.get('publish_daily_report') == '1'

            pickup_person = None
            if pickup_person_id:
                pickup_person = StudentPickup.objects.filter(id=pickup_person_id, student=student).first()
                try:
                    verification = PickupVerificationService.verify(
                        daycare=daycare,
                        child_id=student.id,
                        pickup_person_id=pickup_person_id,
                        verification_date=target_date,
                        user=request.user,
                        notes=remarks
                    )
                    if not verification.get('is_authorized'):
                        messages.warning(
                            request,
                            f"Warning: Authorization check flagged '{verification.get('reason')}'. Proceeding with staff oversight."
                        )
                except Exception:
                    pass

            att, _ = StudentAttendance.objects.get_or_create(
                daycare=daycare,
                student=student,
                attendance_date=target_date,
                defaults={'classroom': student.classroom, 'created_by': request.user}
            )
            att.check_out_time = actual_time
            att.attendance_status = 'CHECKED_OUT'
            att.departure_type = departure_type
            att.released_by = acting_emp
            if pickup_person:
                att.pickup_person = pickup_person
            if early_reason:
                att.early_pickup_reason = early_reason
            if remarks:
                att.remarks = f"{att.remarks or ''} | Departure: {remarks}".strip(' |')
                att.notes = att.remarks
            att.updated_by = request.user
            att.save()

            # Handle Auto / Prompt publishing of Daily Report
            published_note = ""
            if publish_report:
                daily_report = DailyReport.objects.filter(
                    daycare=daycare,
                    student=student,
                    report_date=target_date
                ).first()
                if daily_report:
                    daily_report.status = 'Published'
                    daily_report.published_at = timezone.now()
                    daily_report.updated_by = request.user
                    daily_report.save()
                    published_note = " Daily report completed & published to Family Portal."

            pickup_name = pickup_person.name if pickup_person else "Authorized Guardian"
            messages.success(
                request,
                f"Successfully checked out {student.first_name} with {pickup_name} at {actual_time.strftime('%I:%M %p')}.{published_note}"
            )

        # ==========================================
        # 3. ABSENCE WORKFLOW
        # ==========================================
        elif action == 'mark_absent':
            reason = request.POST.get('reason', 'Absent').strip()
            att, _ = StudentAttendance.objects.get_or_create(
                daycare=daycare,
                student=student,
                attendance_date=target_date,
                defaults={'classroom': student.classroom, 'created_by': request.user}
            )
            att.attendance_status = 'ABSENT'
            att.check_in_time = None
            att.check_out_time = None
            att.remarks = f"Absence recorded: {reason}"
            att.notes = att.remarks
            att.updated_by = request.user
            att.save()
            messages.info(request, f"Marked {student.first_name} as Absent ({reason}).")

        # ==========================================
        # 4. QUICK TOGGLE (BACKWARD COMPATIBILITY)
        # ==========================================
        else:
            new_status = request.POST.get('status', 'PRESENT')
            att, _ = StudentAttendance.objects.get_or_create(
                daycare=daycare,
                student=student,
                attendance_date=target_date,
                defaults={'classroom': student.classroom}
            )
            att.attendance_status = new_status
            if new_status in ['present', 'checked_in', 'PRESENT', 'CHECKED_IN'] and not att.check_in_time:
                att.check_in_time = timezone.now().time()
            elif new_status in ['checked_out', 'CHECKED_OUT'] and not att.check_out_time:
                att.check_out_time = timezone.now().time()
            att.save()
            messages.success(request, f"Updated attendance for {student.first_name} to {new_status}.")

        redirect_url = f"{request.path}?date={date_str}"
        room_id = request.POST.get('classroom_id')
        if room_id:
            redirect_url += f"&classroom_id={room_id}"
        return redirect(redirect_url)


class MasterAttendanceDashboardView(StaffRequiredMixin, View):
    template_name = 'daycare/attendance/master_dashboard.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.now().date()
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')
        
        room_data = []
        for room in classrooms:
            ratio_info = RatioMonitoringService.calculate_classroom_ratio(room, target_date=today)
            room_data.append({
                'classroom': room,
                'ratio': ratio_info
            })

        return render(request, self.template_name, {
            'classrooms': classrooms,
            'room_data': room_data,
            'today': today
        })


class SafeArrivalDashboardView(StaffRequiredMixin, View):
    template_name = 'daycare/pickups/safe_arrival.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.now().date()
        date_str = request.GET.get('date', today.strftime('%Y-%m-%d'))
        try:
            target_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except Exception:
            target_date = today

        # Active students not checked in yet
        checked_in_ids = StudentAttendance.objects.filter(
            daycare=daycare,
            attendance_date=target_date,
            check_in_time__isnull=False
        ).values_list('student_id', flat=True)

        unnotified_absent = Student.objects.filter(
            daycare=daycare,
            status__iexact='Active',
            deleted_at__isnull=True
        ).exclude(id__in=checked_in_ids).prefetch_related('pickups')

        return render(request, self.template_name, {
            'unnotified_absent': unnotified_absent,
            'today': target_date,
            'selected_date': target_date.strftime('%Y-%m-%d')
        })


class PickupVerificationKioskView(StaffRequiredMixin, View):
    """
    Security Kiosk Terminal:
    - Search child or enter Guardian PIN / QR code
    - Verify identity, custodial permissions, and active authorization status
    - Execute check-in or checkout directly from terminal
    """
    template_name = 'daycare/pickups/verification_kiosk.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.now().date()
        children = Student.objects.filter(
            daycare=daycare,
            status__iexact='Active',
            deleted_at__isnull=True
        ).prefetch_related('pickups').order_by('first_name')

        return render(request, self.template_name, {
            'daycare': daycare,
            'children': children,
            'today': today
        })

    def post(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.now().date()
        action = request.POST.get('action', 'verify')
        child_id = request.POST.get('child_id')
        pickup_person_id = request.POST.get('pickup_person_id')
        pin_code = request.POST.get('pin_code', '').strip()

        child = None
        if child_id:
            child = Student.objects.filter(id=child_id, daycare=daycare).first()

        verification_result = None
        if child and pickup_person_id:
            try:
                verification_result = PickupVerificationService.verify(
                    daycare=daycare,
                    child_id=child.id,
                    pickup_person_id=pickup_person_id,
                    verification_date=today,
                    user=request.user,
                    notes=f"Kiosk PIN/Identity Verification (PIN: {pin_code})" if pin_code else "Kiosk Verification"
                )
            except Exception as e:
                verification_result = {
                    'is_authorized': False,
                    'status_code': 'ERROR',
                    'reason': str(e)
                }

        # Process direct Kiosk Check-In / Check-Out
        if action == 'kiosk_check_in' and child:
            att, _ = StudentAttendance.objects.get_or_create(
                daycare=daycare,
                student=child,
                attendance_date=today,
                defaults={'classroom': child.classroom, 'created_by': request.user}
            )
            att.check_in_time = timezone.now().time()
            att.attendance_status = 'PRESENT'
            att.arrival_type = 'KIOSK_PIN' if pin_code else 'KIOSK_VERIFIED'
            att.save()
            DailyReportService.get_or_create_daily_report(daycare, child, today, request.user)
            messages.success(request, f"Arrival confirmed: {child.first_name} checked in via security terminal.")

        elif action == 'kiosk_check_out' and child:
            pickup = StudentPickup.objects.filter(id=pickup_person_id, student=child).first()
            att, _ = StudentAttendance.objects.get_or_create(
                daycare=daycare,
                student=child,
                attendance_date=today,
                defaults={'classroom': child.classroom, 'created_by': request.user}
            )
            att.check_out_time = timezone.now().time()
            att.attendance_status = 'CHECKED_OUT'
            att.departure_type = 'KIOSK_VERIFIED'
            if pickup:
                att.pickup_person = pickup
            att.save()
            messages.success(request, f"Departure authorized: {child.first_name} dismissed with {pickup.name if pickup else 'Guardian'}.")

        children = Student.objects.filter(
            daycare=daycare,
            status__iexact='Active',
            deleted_at__isnull=True
        ).prefetch_related('pickups').order_by('first_name')

        return render(request, self.template_name, {
            'daycare': daycare,
            'children': children,
            'selected_child': child,
            'verification_result': verification_result,
            'today': today
        })


class DailyReportsHubView(StaffRequiredMixin, View):
    """
    Classroom Educator Daily Hub:
    - View all children in classroom and their attendance presence
    - Track progress of meals, naps, diaper checks, curriculum activities
    - Batch publish or single-click publish daily reports to the Family Portal
    """
    template_name = 'daycare/daily_reports/hub.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        today = timezone.now().date()
        date_str = request.GET.get('date', today.strftime('%Y-%m-%d'))
        try:
            target_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except Exception:
            target_date = today
            date_str = today.strftime('%Y-%m-%d')

        room_id = request.GET.get('classroom_id')
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')
        
        students_qs = Student.objects.filter(
            daycare=daycare,
            status__iexact='Active',
            deleted_at__isnull=True
        ).prefetch_related('classroom_enrollments__classroom')

        selected_room = None
        if room_id:
            selected_room = classrooms.filter(id=room_id).first()
            if selected_room:
                students_qs = students_qs.filter(
                    classroom_enrollments__classroom=selected_room,
                    classroom_enrollments__status__iexact='Active'
                ).distinct()

        # Existing reports and attendances
        reports = {
            r.student_id: r
            for r in DailyReport.objects.filter(
                daycare=daycare,
                report_date=target_date
            ).prefetch_related(
                'meals', 'naps', 'toileting', 'activities', 'moods', 'temperatures', 'photos'
            )
        }

        attendances = {
            a.student_id: a
            for a in StudentAttendance.objects.filter(
                daycare=daycare,
                attendance_date=target_date
            )
        }

        report_cards = []
        total_reports = 0
        published_count = 0
        draft_count = 0

        for student in students_qs:
            report = reports.get(student.id)
            att = attendances.get(student.id)
            total_reports += 1

            if report:
                if report.status == 'Published':
                    published_count += 1
                else:
                    draft_count += 1
                
                meal_count = report.meals.count()
                nap_count = report.naps.count()
                toilet_count = report.toileting.count()
                activity_count = report.activities.count()
                mood_count = report.moods.count()
                photo_count = report.photos.count()
            else:
                draft_count += 1
                meal_count = nap_count = toilet_count = activity_count = mood_count = photo_count = 0

            report_cards.append({
                'student': student,
                'attendance': att,
                'report': report,
                'meal_count': meal_count,
                'nap_count': nap_count,
                'toilet_count': toilet_count,
                'activity_count': activity_count,
                'mood_count': mood_count,
                'photo_count': photo_count,
                'is_published': report.status == 'Published' if report else False,
            })

        # Classroom live ratio
        room_ratio = None
        if selected_room:
            try:
                room_ratio = RatioMonitoringService.calculate_classroom_ratio(selected_room, target_date=target_date)
            except Exception:
                pass

        return render(request, self.template_name, {
            'report_cards': report_cards,
            'classrooms': classrooms,
            'selected_room': room_id,
            'selected_room_obj': selected_room,
            'selected_date': date_str,
            'total_reports': total_reports,
            'published_count': published_count,
            'draft_count': draft_count,
            'room_ratio': room_ratio,
        })

    def post(self, request):
        daycare = get_user_daycare(request.user)
        action = request.POST.get('action')
        date_str = request.POST.get('date', timezone.now().date().strftime('%Y-%m-%d'))
        try:
            target_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except Exception:
            target_date = timezone.now().date()

        if action == 'publish_all':
            room_id = request.POST.get('classroom_id')
            reports_qs = DailyReport.objects.filter(
                daycare=daycare,
                report_date=target_date,
                status__in=['Draft', 'Completed']
            )
            if room_id:
                reports_qs = reports_qs.filter(classroom_id=room_id)

            count = reports_qs.count()
            reports_qs.update(
                status='Published',
                published_at=timezone.now(),
                updated_by=request.user
            )
            messages.success(request, f"Successfully published {count} daily reports to the Family Portal.")

        elif action == 'publish_single':
            report_id = request.POST.get('report_id')
            report = get_object_or_404(DailyReport, id=report_id, daycare=daycare)
            report.status = 'Published'
            report.published_at = timezone.now()
            report.updated_by = request.user
            report.save()
            messages.success(request, f"Daily report for {report.student.first_name} is now visible to parents.")

        redirect_url = f"{request.path}?date={date_str}"
        room_id = request.POST.get('classroom_id')
        if room_id:
            redirect_url += f"&classroom_id={room_id}"
        return redirect(redirect_url)


class DailyChildReportDetailView(StaffRequiredMixin, View):
    """
    Phase 2 (Classroom Activities) Educator Workstation:
    - View child live presence and attendance
    - Record nutrition (breakfast, lunch, snacks, water intake)
    - Record naps & rest times
    - Record diaper checks & toileting
    - Record mood, curriculum activities, and outdoor play
    - Record authorized medication administration with witness
    - Record health checks (temperature, incidents) & photos
    - 1-Click publish report to Family Portal
    """
    template_name = 'daycare/daily_reports/detail.html'

    def get(self, request, child_id, date):
        daycare = get_user_daycare(request.user)
        child = get_object_or_404(Student, pk=child_id, daycare=daycare)
        
        try:
            target_date = datetime.datetime.strptime(date, '%Y-%m-%d').date()
        except Exception:
            target_date = timezone.now().date()
            date = target_date.strftime('%Y-%m-%d')

        # Retrieve or initialize daily report
        report, _ = DailyReport.objects.get_or_create(
            daycare=daycare,
            student=child,
            report_date=target_date,
            defaults={
                'teacher': request.user,
                'classroom': child.classroom,
                'status': 'Draft'
            }
        )

        # Related sub-records
        meals = report.meals.all().order_by('time')
        naps = report.naps.all().order_by('start_time')
        toileting = report.toileting.all().order_by('time')
        activities = report.activities.all().order_by('start_time')
        moods = report.moods.all().order_by('time')
        temperatures = report.temperatures.all().order_by('time')
        photos = report.photos.all().order_by('-created_at')

        # Medication records
        medications_prescribed = Medication.objects.filter(student=child, is_active=True)
        medications_administered = MedicationAdministration.objects.filter(
            medication__student=child,
            date=target_date
        ).select_related('medication', 'administered_by', 'witness').order_by('time')

        # Incidents
        incidents = IncidentReport.objects.filter(
            daycare=daycare,
            student=child,
            activity_date=target_date
        ).order_by('time')

        # Attendance record
        attendance = StudentAttendance.objects.filter(
            daycare=daycare,
            student=child,
            attendance_date=target_date
        ).select_related('pickup_person', 'received_by', 'released_by').first()

        # Daycare employees for witness dropdown
        employees = Employee.objects.filter(daycare=daycare, status__iexact='Active').order_by('first_name')

        return render(request, self.template_name, {
            'child': child,
            'report': report,
            'date': date,
            'target_date': target_date,
            'meals': meals,
            'naps': naps,
            'toileting': toileting,
            'activities': activities,
            'moods': moods,
            'temperatures': temperatures,
            'photos': photos,
            'medications_prescribed': medications_prescribed,
            'medications_administered': medications_administered,
            'incidents': incidents,
            'attendance': attendance,
            'employees': employees,
        })

    def post(self, request, child_id, date):
        daycare = get_user_daycare(request.user)
        child = get_object_or_404(Student, pk=child_id, daycare=daycare)
        action = request.POST.get('action')

        try:
            target_date = datetime.datetime.strptime(date, '%Y-%m-%d').date()
        except Exception:
            target_date = timezone.now().date()

        report, _ = DailyReport.objects.get_or_create(
            daycare=daycare,
            student=child,
            report_date=target_date,
            defaults={'teacher': request.user, 'classroom': child.classroom, 'status': 'Draft'}
        )

        # ----------------------------------------------------
        # 1. RECORD MEAL & WATER INTAKE
        # ----------------------------------------------------
        if action == 'add_meal':
            meal_type = request.POST.get('meal_type', 'Lunch')
            food_provided = request.POST.get('food_provided', '').strip()
            amount_eaten = request.POST.get('amount_eaten', 'All')
            fluid_intake = request.POST.get('fluid_intake', '').strip()
            time_str = request.POST.get('time')
            notes = request.POST.get('notes', '').strip()

            if fluid_intake:
                notes = f"Fluid Intake: {fluid_intake} | {notes}".strip(' |')

            DailyReportService.add_meal_entry(
                daily_report=report,
                meal_type=meal_type,
                meal_category='Hydration' if 'Water' in meal_type else 'Meal',
                food_provided=food_provided or meal_type,
                amount_eaten=amount_eaten,
                time=time_str or None,
                notes=notes,
                user=request.user
            )
            messages.success(request, f"Logged {meal_type} entry for {child.first_name}.")

        # ----------------------------------------------------
        # 2. RECORD NAP & REST
        # ----------------------------------------------------
        elif action == 'add_nap':
            start_time = request.POST.get('start_time')
            end_time = request.POST.get('end_time')
            quality = request.POST.get('quality', 'Slept')
            notes = request.POST.get('notes', '').strip()

            try:
                DailyReportService.add_nap_entry(
                    daily_report=report,
                    start_time=start_time,
                    end_time=end_time or None,
                    quality=quality,
                    notes=notes,
                    user=request.user
                )
                messages.success(request, f"Recorded nap period for {child.first_name}.")
            except Exception as e:
                err_msg = getattr(e, 'detail', str(e))
                messages.warning(request, f"Nap record note: {err_msg}")

        # ----------------------------------------------------
        # 3. RECORD DIAPER & TOILET ACTIVITIES
        # ----------------------------------------------------
        elif action == 'add_toileting':
            record_type = request.POST.get('record_type', 'Diaper')
            condition = request.POST.get('condition', 'Dry')
            assistance = request.POST.get('assistance_level', 'Assisted')
            time_str = request.POST.get('time')
            notes = request.POST.get('notes', '').strip()

            DailyReportService.add_toileting_entry(
                daily_report=report,
                record_type=record_type,
                condition=condition,
                assistance_level=assistance,
                time=time_str or None,
                notes=notes,
                user=request.user
            )
            messages.success(request, f"Logged {record_type} ({condition}) check.")

        # ----------------------------------------------------
        # 4. RECORD MOOD & WELL-BEING
        # ----------------------------------------------------
        elif action == 'add_mood':
            mood = request.POST.get('mood', 'Happy')
            time_str = request.POST.get('time')
            notes = request.POST.get('notes', '').strip()

            DailyReportService.add_mood_entry(
                daily_report=report,
                mood=mood,
                time=time_str or None,
                notes=notes,
                user=request.user
            )
            messages.success(request, f"Recorded mood: {mood}.")

        # ----------------------------------------------------
        # 5. RECORD LEARNING, ACTIVITIES & OUTDOOR PLAY
        # ----------------------------------------------------
        elif action == 'add_activity':
            name = request.POST.get('name', 'Classroom Learning').strip()
            category = request.POST.get('activity_category', 'General Activity')
            learning_area = request.POST.get('learning_area', 'Cognitive')
            participation = request.POST.get('participation', 'Engaged')
            start_time = request.POST.get('start_time')
            end_time = request.POST.get('end_time')
            description = request.POST.get('description', '').strip()
            notes = request.POST.get('teacher_notes', '').strip()

            DailyReportService.add_activity_entry(
                daily_report=report,
                activity_type=category,
                activity_category=category,
                name=name,
                description=description,
                teacher_notes=notes,
                start_time=start_time or None,
                end_time=end_time or None,
                learning_area=learning_area,
                participation=participation,
                user=request.user
            )
            messages.success(request, f"Added activity '{name}'.")

        # ----------------------------------------------------
        # 6. RECORD MEDICATION ADMINISTRATION
        # ----------------------------------------------------
        elif action == 'add_medication':
            med_id = request.POST.get('medication_id')
            dosage = request.POST.get('dosage_given', '').strip()
            time_str = request.POST.get('time')
            outcome = request.POST.get('outcome', 'Normal')
            witness_id = request.POST.get('witness_id')
            notes = request.POST.get('teacher_notes', '').strip()

            med = get_object_or_404(Medication, id=med_id, student=child)
            witness_user = None
            if witness_id:
                w_emp = Employee.objects.filter(id=witness_id, daycare=daycare).first()
                if w_emp and w_emp.user:
                    witness_user = w_emp.user
                else:
                    witness_user = User.objects.filter(id=witness_id).first()

            med_time = timezone.now().time()
            if time_str:
                try:
                    med_time = datetime.datetime.strptime(time_str.strip(), '%H:%M').time()
                except ValueError:
                    pass

            MedicationAdministration.objects.create(
                medication=med,
                administered_by=request.user,
                witness=witness_user,
                date=target_date,
                time=med_time,
                dosage_given=dosage or med.dosage,
                outcome=outcome,
                teacher_notes=notes
            )
            messages.success(request, f"Administered {med.medication_name} ({dosage or med.dosage}) to {child.first_name}.")

        # ----------------------------------------------------
        # 7. RECORD TEMPERATURE & INCIDENTS
        # ----------------------------------------------------
        elif action == 'add_temperature':
            temp_val = request.POST.get('temperature_value')
            method = request.POST.get('method', 'Forehead')
            notes = request.POST.get('notes', '').strip()

            DailyReportService.add_temperature_entry(
                daily_report=report,
                temperature_value=temp_val,
                method=method,
                notes=notes,
                user=request.user
            )
            messages.success(request, f"Logged temperature {temp_val}°C.")

        elif action == 'add_incident':
            inc_type = request.POST.get('incident_type', 'Scratch')
            severity = request.POST.get('severity', 'Low')
            time_str = request.POST.get('time')
            desc = request.POST.get('description', '').strip()
            action_taken = request.POST.get('action_taken', '').strip()
            witness = request.POST.get('witness', '').strip()

            inc_time = timezone.now().time()
            if time_str:
                try:
                    inc_time = datetime.datetime.strptime(time_str.strip(), '%H:%M').time()
                except ValueError:
                    pass

            acting_emp = Employee.objects.filter(user=request.user, daycare=daycare).first() or Employee.objects.filter(daycare=daycare).first()

            IncidentReport.objects.create(
                daycare=daycare,
                student=child,
                reporting_employee=acting_emp,
                activity_date=target_date,
                time=inc_time,
                incident_type=inc_type,
                severity=severity,
                description=desc,
                action_taken=action_taken,
                witness=witness
            )
            messages.warning(request, f"Recorded incident report ({inc_type} - {severity} severity).")

        # ----------------------------------------------------
        # 8. EDUCATOR GENERAL NOTE & PHOTO
        # ----------------------------------------------------
        elif action == 'save_notes':
            notes = request.POST.get('notes', '').strip()
            report.notes = notes
            report.updated_by = request.user
            report.save()
            messages.success(request, "Daily educator notes saved.")

        elif action == 'upload_photo':
            photo_file = request.FILES.get('photo')
            caption = request.POST.get('caption', '').strip()
            activity_ctx = request.POST.get('activity_context', 'Classroom Learning').strip()

            if photo_file:
                DailyPhotoRecord.objects.create(
                    daily_report=report,
                    student=child,
                    file_path=photo_file,
                    caption=caption,
                    activity_context=activity_ctx,
                    uploaded_by=request.user
                )
                messages.success(request, "Daily activity photo uploaded.")

        # ----------------------------------------------------
        # 9. PUBLISH TO FAMILY PORTAL
        # ----------------------------------------------------
        elif action == 'publish_report':
            report.status = 'Published'
            report.published_at = timezone.now()
            report.updated_by = request.user
            report.save()
            messages.success(request, f"Daily report for {child.first_name} has been published to the Family Portal!")

        return redirect(f"{request.path}")


class HealthDashboardView(StaffRequiredMixin, View):
    template_name = 'daycare/health/dashboard.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        allergies = Student.objects.filter(daycare=daycare, status__iexact='Active').filter(
            Q(allergies__isnull=False, allergies__gt='') |
            Q(medical_notes__isnull=False, medical_notes__gt='') |
            Q(medical_conditions__isnull=False, medical_conditions__gt='')
        ).prefetch_related('classroom_enrollments__classroom')
        return render(request, self.template_name, {'allergies': allergies})
