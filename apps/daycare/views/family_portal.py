from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db.models import Q, Sum

from core.models import (
    Family, Guardian, FamilyGuardian, FamilyChild,
    Student, StudentAttendance, DailyReport, Invoice, Payment,
    StudentEmergencyContact, StudentPickup, Document,
    Announcement, AnnouncementRead,
    FamilyMessage, ConsentForm, ConsentFormAssignment, ConsentFormSignature,
    DepositRecord, CreditTransaction, TaxReceipt
)
from core.serializers import (
    FamilyAttendanceSerializer, FamilyDailyReportSerializer,
    FamilyInvoiceSerializer, FamilyPaymentSerializer, FamilyTaxReceiptSerializer,
    FamilyMessageSerializer, ConsentFormAssignmentSerializer,
    FamilyEmergencyContactSerializer, FamilyAuthorizedPickupSerializer,
    ChildDocumentSerializer, InvoiceDetailSerializer
)
from core.permissions import IsAuthenticatedGuardian
from daycare.services.billing import BillingCalculationService, quantize_money


def get_guardian_family_and_students(user):
    """Returns (guardian, family, student_ids) for the authenticated guardian user."""
    guardian = getattr(user, 'guardian_profile', None) or getattr(user, 'guardian', None)
    if not guardian:
        return None, None, []
    family_ids = FamilyGuardian.objects.filter(guardian=guardian).values_list('family_id', flat=True)
    family = Family.objects.filter(id__in=family_ids).first()
    student_ids = FamilyChild.objects.filter(family_id__in=family_ids).values_list('student_id', flat=True)
    return guardian, family, list(student_ids)


def verify_child_access(student_id, student_ids):
    """Returns True if the guardian has access to this student_id."""
    return str(student_id) in [str(sid) for sid in student_ids]


# ─── Dashboard ───────────────────────────────────────────────────────────────

class FamilyDashboardView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        guardian, family, student_ids = get_guardian_family_and_students(request.user)
        today = timezone.now().date()

        students = Student.objects.filter(id__in=student_ids, deleted_at__isnull=True)

        children_status = []
        for student in students:
            att = StudentAttendance.objects.filter(student=student, attendance_date=today).first()
            report = DailyReport.objects.filter(
                student=student, report_date=today, status__in=['Completed', 'Shared']
            ).first()
            children_status.append({
                'id': str(student.id),
                'name': f"{student.first_name} {student.last_name}",
                'preferred_name': student.preferred_name,
                'photo': student.photo,
                'attendance_status': att.attendance_status if att else 'Not Recorded',
                'check_in': str(att.check_in_time) if att and att.check_in_time else None,
                'check_out': str(att.check_out_time) if att and att.check_out_time else None,
                'has_daily_report': report is not None,
            })

        unread_messages = FamilyMessage.objects.filter(
            family=family,
            message_type='staff_to_guardian',
            is_read=False
        ).count() if family else 0

        pending_consents = ConsentFormAssignment.objects.filter(
            student__in=student_ids,
            status='Pending'
        ).count()

        outstanding = Invoice.objects.filter(
            student__in=student_ids,
            status__in=['Unpaid', 'Overdue', 'Partially Paid']
        ).aggregate(total=Sum('total_amount'))['total'] or 0

        amount_paid_on_outstanding = Invoice.objects.filter(
            student__in=student_ids,
            status__in=['Unpaid', 'Overdue', 'Partially Paid']
        ).aggregate(paid=Sum('amount_paid'))['paid'] or 0

        amount_due = float(outstanding) - float(amount_paid_on_outstanding)

        announcements = Announcement.objects.filter(
            daycare=request.user.daycare,
            status='Published'
        ).order_by('-published_at')[:3]

        announcement_data = [
            {
                'id': str(a.id),
                'title': a.title,
                'type': a.type,
                'published_at': a.published_at,
            }
            for a in announcements
        ]

        return Response({
            'children': children_status,
            'unread_messages': unread_messages,
            'pending_consents': pending_consents,
            'outstanding_amount_due': round(amount_due, 2),
            'recent_announcements': announcement_data,
            'family_name': family.family_name if family else '',
        })


# ─── Child-Specific Views ─────────────────────────────────────────────────────

class FamilyChildAttendanceView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        _, _, student_ids = get_guardian_family_and_students(request.user)
        if not verify_child_access(pk, student_ids):
            return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        year = request.query_params.get('year', timezone.now().date().year)
        month = request.query_params.get('month', timezone.now().date().month)
        try:
            year, month = int(year), int(month)
        except ValueError:
            return Response({'detail': 'Invalid year or month.'}, status=status.HTTP_400_BAD_REQUEST)

        records = StudentAttendance.objects.filter(
            student_id=pk,
            attendance_date__year=year,
            attendance_date__month=month,
        ).order_by('attendance_date')

        serializer = FamilyAttendanceSerializer(records, many=True)

        present = records.filter(attendance_status='Present').count()
        absent = records.filter(attendance_status='Absent').count()
        late = records.filter(attendance_status='Late').count()
        sick = records.filter(attendance_status='Sick').count()

        return Response({
            'records': serializer.data,
            'summary': {
                'present': present,
                'absent': absent,
                'late': late,
                'sick': sick,
                'total': records.count(),
            }
        })


class FamilyChildDailyReportsView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        _, _, student_ids = get_guardian_family_and_students(request.user)
        if not verify_child_access(pk, student_ids):
            return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        date_str = request.query_params.get('date')
        year = request.query_params.get('year', timezone.now().date().year)
        month = request.query_params.get('month', timezone.now().date().month)

        qs = DailyReport.objects.filter(
            student_id=pk,
            status__in=['Published', 'Completed', 'Shared'],
            deleted_at__isnull=True
        ).select_related('student', 'classroom', 'teacher', 'attendance_record').prefetch_related(
            'meals', 'naps', 'toileting', 'activities',
            'moods', 'temperatures', 'staff_notes', 'photos'
        )

        if date_str:
            from datetime import date
            try:
                target_date = date.fromisoformat(date_str)
                qs = qs.filter(report_date=target_date)
            except ValueError:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            try:
                year, month = int(year), int(month)
            except ValueError:
                return Response({'detail': 'Invalid year or month.'}, status=status.HTTP_400_BAD_REQUEST)
            qs = qs.filter(report_date__year=year, report_date__month=month)

        qs = qs.order_by('-report_date')
        serializer = FamilyDailyReportSerializer(qs, many=True)
        return Response(serializer.data)


class FamilyDailyReportsView(APIView):
    """
    Guardian endpoint: lists all published daily reports for the guardian's authorized children.
    Supports filtering by student_id, date, start_date, end_date, year, and month.
    """
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        from daycare.services.daily_reports import DailyReportService
        student_id = request.query_params.get('student_id')
        date_str = request.query_params.get('date')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        year = request.query_params.get('year')
        month = request.query_params.get('month')

        reports_qs = DailyReportService.get_guardian_daily_reports(
            user=request.user,
            student_id=student_id,
            date=date_str,
            start_date=start_date,
            end_date=end_date,
            year=year,
            month=month
        )

        serializer = FamilyDailyReportSerializer(reports_qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class FamilyDailyReportDetailView(APIView):
    """
    Guardian endpoint: fetches single published report for an authorized child either by
    (student_id, date) or by direct report ID (pk).
    """
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, child_id=None, date=None, pk=None):
        from daycare.services.daily_reports import DailyReportService
        if pk:
            report = DailyReportService.get_guardian_daily_report_detail(user=request.user, report_id=pk)
        elif child_id and date:
            report = DailyReportService.get_guardian_daily_report_detail(user=request.user, student_id=child_id, date=date)
        else:
            return Response({'detail': 'Child ID and date or report ID required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not report:
            return Response({'detail': 'Daily report not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = FamilyDailyReportSerializer(report)
        return Response(serializer.data, status=status.HTTP_200_OK)


class FamilyDailyReportHistoryView(APIView):
    """
    Guardian endpoint: provides historical search across reports for guardian's children.
    """
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        from daycare.services.daily_reports import DailyReportService
        student_id = request.query_params.get('student_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        reports_qs = DailyReportService.get_guardian_daily_reports(
            user=request.user,
            student_id=student_id,
            start_date=start_date,
            end_date=end_date
        )

        serializer = FamilyDailyReportSerializer(reports_qs[:100], many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class FamilyChildEmergencyContactsView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        _, _, student_ids = get_guardian_family_and_students(request.user)
        if not verify_child_access(pk, student_ids):
            return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        contacts = StudentEmergencyContact.objects.filter(student_id=pk).order_by('-is_primary', 'name')
        serializer = FamilyEmergencyContactSerializer(contacts, many=True)
        return Response(serializer.data)

    def post(self, request, pk):
        _, _, student_ids = get_guardian_family_and_students(request.user)
        if not verify_child_access(pk, student_ids):
            return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = FamilyEmergencyContactSerializer(data=request.data)
        if serializer.is_valid():
            # New contacts are pending by default due to model default
            serializer.save(student_id=pk)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class FamilyEmergencyContactDetailView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def patch(self, request, pk):
        _, _, student_ids = get_guardian_family_and_students(request.user)
        contact = StudentEmergencyContact.objects.filter(id=pk, student_id__in=student_ids).first()
        if not contact:
            return Response({'detail': 'Contact not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)
        
        # Don't overwrite the original data, store edits in pending_changes
        pending_changes = contact.pending_changes or {}
        for field in ['name', 'relationship', 'mobile', 'email', 'is_primary']:
            if field in request.data:
                pending_changes[field] = request.data[field]
        
        contact.pending_changes = pending_changes
        # Don't change approval_status if it's already Pending or Pending_Removal, otherwise set to Pending
        if contact.approval_status not in ['Pending', 'Pending_Removal']:
            contact.approval_status = 'Pending'
        contact.save()
        
        serializer = FamilyEmergencyContactSerializer(contact)
        return Response(serializer.data)

    def delete(self, request, pk):
        _, _, student_ids = get_guardian_family_and_students(request.user)
        contact = StudentEmergencyContact.objects.filter(id=pk, student_id__in=student_ids).first()
        if not contact:
            return Response({'detail': 'Contact not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)
        
        # We don't actually delete it immediately, we request removal
        contact.approval_status = 'Pending_Removal'
        contact.save()
        return Response({'detail': 'Removal requested.'}, status=status.HTTP_200_OK)

class FamilyChildAuthorizedPickupsView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        _, _, student_ids = get_guardian_family_and_students(request.user)
        if not verify_child_access(pk, student_ids):
            return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        pickups = StudentPickup.objects.filter(student_id=pk).order_by('name')
        serializer = FamilyAuthorizedPickupSerializer(pickups, many=True)
        return Response(serializer.data)

    def post(self, request, pk):
        guardian, family, student_ids = get_guardian_family_and_students(request.user)
        if not verify_child_access(pk, student_ids):
            return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        student = Student.objects.filter(id=pk).first()
        if not student:
            return Response({'detail': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = FamilyAuthorizedPickupSerializer(data=request.data)
        if serializer.is_valid():
            pickup = serializer.save(
                student=student,
                daycare=student.daycare,
                family=family,
                created_by=request.user,
                updated_by=request.user,
                approval_status='Pending',
                authorization_status=StudentPickup.STATUS_PENDING,
                id_proof_status='Pending'
            )
            if 'photo' in request.FILES:
                pickup.photo = request.FILES['photo']
                pickup.save(update_fields=['photo'])

            # Audit
            from core.models import AuditLog
            AuditLog.objects.create(
                user=request.user,
                user_type='Guardian',
                action="Submitted Pickup Authorization Request",
                module="Safe Arrival Departure",
                entity_type="StudentPickup",
                entity_id=str(pickup.id),
                new_values={
                    "name": pickup.name,
                    "relationship": pickup.relationship,
                    "child_id": str(student.id),
                    "approval_status": "Pending"
                }
            )
            return Response(FamilyAuthorizedPickupSerializer(pickup).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class FamilyAuthorizedPickupDetailView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def patch(self, request, pk):
        _, _, student_ids = get_guardian_family_and_students(request.user)
        pickup = StudentPickup.objects.filter(id=pk, student_id__in=student_ids).first()
        if not pickup:
            return Response({'detail': 'Pickup not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)
        
        pending_changes = pickup.pending_changes or {}
        for field in ['name', 'relationship', 'phone', 'email', 'valid_from', 'valid_until', 'notes']:
            if field in request.data:
                pending_changes[field] = request.data[field]
        
        pickup.pending_changes = pending_changes
        if pickup.approval_status not in ['Pending', 'Pending_Removal']:
            pickup.approval_status = 'Pending'
        pickup.save()
        
        serializer = FamilyAuthorizedPickupSerializer(pickup)
        return Response(serializer.data)

    def delete(self, request, pk):
        _, _, student_ids = get_guardian_family_and_students(request.user)
        pickup = StudentPickup.objects.filter(id=pk, student_id__in=student_ids).first()
        if not pickup:
            return Response({'detail': 'Pickup not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)
        
        pickup.approval_status = 'Pending_Removal'
        pickup.save()
        return Response({'detail': 'Removal requested.'}, status=status.HTTP_200_OK)


class FamilyAuthorizedPickupQRPassView(APIView):
    """
    GET /api/family/authorized-pickups/<pk>/qr-pass/
    POST /api/family/authorized-pickups/<pk>/qr-pass/
    Retrieves or generates a secure QR token pass for an active, approved pickup person of the family's child.
    """
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        _, family, student_ids = get_guardian_family_and_students(request.user)
        pickup = StudentPickup.objects.filter(id=pk, student_id__in=student_ids).first()
        if not pickup:
            return Response({'detail': 'Pickup person not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        if pickup.approval_status != 'Approved' or pickup.authorization_status != StudentPickup.STATUS_ACTIVE:
            return Response({
                'detail': 'QR pass is only available for approved, active pickup persons.',
                'approval_status': pickup.approval_status,
                'authorization_status': pickup.authorization_status
            }, status=status.HTTP_400_BAD_REQUEST)

        from core.models import PickupQRToken
        token_obj = PickupQRToken.objects.filter(pickup_person=pickup, is_active=True).first()
        if not token_obj or (token_obj.expires_at and token_obj.expires_at < timezone.now()):
            from daycare.services.digital_verification import DigitalVerificationService
            token_obj = DigitalVerificationService.generate_qr_token(pickup, user=request.user)

        return Response({
            'pickup_id': str(pickup.id),
            'name': pickup.name,
            'relationship': pickup.relationship,
            'child_name': f"{pickup.student.first_name} {pickup.student.last_name}",
            'qr_token': token_obj.token,
            'expires_at': token_obj.expires_at.isoformat() if token_obj.expires_at else None,
            'status': 'ACTIVE'
        })

    def post(self, request, pk):
        """Regenerate QR token pass"""
        _, family, student_ids = get_guardian_family_and_students(request.user)
        pickup = StudentPickup.objects.filter(id=pk, student_id__in=student_ids).first()
        if not pickup:
            return Response({'detail': 'Pickup person not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        if pickup.approval_status != 'Approved' or pickup.authorization_status != StudentPickup.STATUS_ACTIVE:
            return Response({
                'detail': 'QR pass can only be generated for approved, active pickup persons.',
                'approval_status': pickup.approval_status,
                'authorization_status': pickup.authorization_status
            }, status=status.HTTP_400_BAD_REQUEST)

        from daycare.services.digital_verification import DigitalVerificationService
        token_obj = DigitalVerificationService.generate_qr_token(pickup, user=request.user)

        return Response({
            'pickup_id': str(pickup.id),
            'name': pickup.name,
            'relationship': pickup.relationship,
            'child_name': f"{pickup.student.first_name} {pickup.student.last_name}",
            'qr_token': token_obj.token,
            'expires_at': token_obj.expires_at.isoformat() if token_obj.expires_at else None,
            'status': 'ACTIVE'
        })


class FamilyAuthorizedPickupPINView(APIView):
    """
    GET /api/family/authorized-pickups/<pk>/pin/
    POST /api/family/authorized-pickups/<pk>/pin/
    Views PIN status or configures 4-6 digit security PIN for an approved pickup person.
    """
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        _, family, student_ids = get_guardian_family_and_students(request.user)
        pickup = StudentPickup.objects.filter(id=pk, student_id__in=student_ids).first()
        if not pickup:
            return Response({'detail': 'Pickup person not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        pin_obj = getattr(pickup, 'security_pin', None)
        has_pin = pin_obj is not None and bool(pin_obj.pin_hash)
        is_locked = pin_obj.is_locked if pin_obj else False

        return Response({
            'pickup_id': str(pickup.id),
            'name': pickup.name,
            'has_pin': has_pin,
            'is_locked': is_locked,
            'pin_set_at': pin_obj.updated_at.isoformat() if pin_obj else None
        })

    def post(self, request, pk):
        _, family, student_ids = get_guardian_family_and_students(request.user)
        pickup = StudentPickup.objects.filter(id=pk, student_id__in=student_ids).first()
        if not pickup:
            return Response({'detail': 'Pickup person not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        if pickup.approval_status != 'Approved' or pickup.authorization_status != StudentPickup.STATUS_ACTIVE:
            return Response({
                'detail': 'PIN can only be set for approved, active pickup persons.',
                'approval_status': pickup.approval_status,
                'authorization_status': pickup.authorization_status
            }, status=status.HTTP_400_BAD_REQUEST)

        raw_pin = str(request.data.get('pin', '')).strip()
        if not raw_pin or not (4 <= len(raw_pin) <= 6) or not raw_pin.isdigit():
            return Response({'detail': 'PIN must be a 4 to 6 digit numeric code.'}, status=status.HTTP_400_BAD_REQUEST)

        from daycare.services.digital_verification import DigitalVerificationService
        pin_obj = DigitalVerificationService.set_pickup_pin(pickup, raw_pin, user=request.user)

        return Response({
            'status': 'success',
            'message': 'Security PIN configured successfully.',
            'has_pin': True,
            'is_locked': False
        }, status=status.HTTP_200_OK)


class FamilySafeArrivalStatusView(APIView):
    """
    GET /api/family/safe-arrival/status/
    Returns real-time safe arrival & departure status for the authenticated guardian's own children today.
    Uses Module 11 StudentAttendance and Module 12 SafeArrivalDepartureEvent data.
    """
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        guardian, family, student_ids = get_guardian_family_and_students(request.user)
        today = timezone.now().date()

        students = Student.objects.filter(
            id__in=student_ids,
            deleted_at__isnull=True
        ).select_related('daycare')

        children_status = []
        for s in students:
            att = StudentAttendance.objects.filter(student=s, attendance_date=today).first()
            
            # Determine state: NOT_ARRIVED, CHECKED_IN, CURRENTLY_PRESENT, CHECKED_OUT
            if not att or (not att.check_in_time and not att.check_out_time):
                arrival_status = 'NOT_ARRIVED'
                status_display = 'Not Arrived'
            elif att.check_in_time and not att.check_out_time:
                arrival_status = 'CURRENTLY_PRESENT'
                status_display = 'Currently Present'
            elif att.check_out_time:
                arrival_status = 'CHECKED_OUT'
                status_display = 'Checked Out'
            else:
                arrival_status = 'NOT_ARRIVED'
                status_display = 'Not Arrived'

            # Get pickup event if checked out
            pickup_name = None
            if att and att.pickup_person:
                pickup_name = f"{att.pickup_person.name} ({att.pickup_person.relationship})"
            elif att and att.check_out_time:
                from core.models import SafeArrivalDepartureEvent
                last_event = SafeArrivalDepartureEvent.objects.filter(
                    student=s,
                    attendance_record=att,
                    event_type=SafeArrivalDepartureEvent.EVENT_CHECK_OUT
                ).first()
                if last_event and last_event.authorized_pickup:
                    pickup_name = f"{last_event.authorized_pickup.name} ({last_event.authorized_pickup.relationship})"

            # Expected departure time
            from daycare.services.digital_verification import DigitalVerificationService
            expected_time = DigitalVerificationService.get_expected_pickup_time(s.daycare, s, attendance_date=today)

            photo_url = None
            if s.photo:
                photo_url = s.photo.url if hasattr(s.photo, 'url') else str(s.photo)

            children_status.append({
                'child_id': str(s.id),
                'child_name': f"{s.first_name} {s.last_name}",
                'preferred_name': s.preferred_name,
                'photo': photo_url,
                'status': arrival_status,
                'status_display': status_display,
                'check_in_time': att.check_in_time.strftime('%I:%M %p') if att and att.check_in_time else None,
                'check_out_time': att.check_out_time.strftime('%I:%M %p') if att and att.check_out_time else None,
                'expected_pickup_time': expected_time.strftime('%I:%M %p') if expected_time else None,
                'pickup_person_name': pickup_name,
                'is_late_pickup': getattr(att, 'is_late', False) if att else False,
                'departure_type': getattr(att, 'departure_type', None) if att else None,
                'arrival_type': getattr(att, 'arrival_type', None) if att else None,
                'date': today.isoformat()
            })

        return Response({
            'date': today.isoformat(),
            'children': children_status,
            'total_children': len(children_status)
        })

class FamilyChildDocumentsView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        _, _, student_ids = get_guardian_family_and_students(request.user)
        if not verify_child_access(pk, student_ids):
            return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        from django.contrib.contenttypes.models import ContentType
        ct = ContentType.objects.get_for_model(Student)
        all_docs = Document.objects.filter(
            content_type=ct,
            object_id=pk,
            status='active',
        ).order_by('-created_at')

        serializer = ChildDocumentSerializer(all_docs, many=True)
        return Response(serializer.data)

    def post(self, request, pk):
        _, _, student_ids = get_guardian_family_and_students(request.user)
        if not verify_child_access(pk, student_ids):
            return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        title = request.data.get('title') or request.data.get('name') or file_obj.name
        description = request.data.get('description', '')
        file_type = request.data.get('document_type', '')

        from django.contrib.contenttypes.models import ContentType
        ct = ContentType.objects.get_for_model(Student)

        doc = Document.objects.create(
            daycare=request.user.daycare,
            title=title,
            description=description,
            file_path=file_obj,
            file_type=file_type,
            file_size=file_obj.size,
            content_type=ct,
            object_id=pk,
            status='active',
            visibility='private',
            uploaded_by=request.user
        )

        serializer = ChildDocumentSerializer(doc)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ─── Billing ─────────────────────────────────────────────────────────────────

class FamilyBillingInvoicesView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        guardian, family, student_ids = get_guardian_family_and_students(request.user)
        status_filter = request.query_params.get('status')
        child_id = request.query_params.get('student_id') or request.query_params.get('child_id')

        # Parents can only see non-draft invoices
        query = Q(student__in=student_ids)
        if family:
            query = query | Q(family=family)

        qs = Invoice.objects.filter(query).exclude(status='DRAFT').order_by('-issue_date', '-created_at')

        if child_id and verify_child_access(child_id, student_ids):
            qs = qs.filter(student_id=child_id)

        if status_filter:
            qs = qs.filter(status=status_filter)

        # Totals
        total_outstanding = qs.filter(
            status__in=['ISSUED', 'PARTIALLY_PAID', 'OVERDUE', 'Unpaid', 'Overdue', 'Partially Paid']
        ).aggregate(total=Sum('balance_due'))['total'] or 0

        now = timezone.now().date()
        total_paid_this_month = Payment.objects.filter(
            Q(student__in=student_ids) | (Q(invoice__family=family) if family else Q()),
            payment_date__year=now.year,
            payment_date__month=now.month,
        ).aggregate(total=Sum('amount'))['total'] or 0

        credit_balance = BillingCalculationService.get_family_credit_balance(family, family.daycare) if family and getattr(family, 'daycare', None) else 0

        held_deposits = DepositRecord.objects.filter(
            student__in=student_ids,
            status__in=['HELD', 'PARTIALLY_APPLIED']
        )
        held_deposit_total = sum([d.remaining_held for d in held_deposits])

        serializer = FamilyInvoiceSerializer(qs, many=True)
        return Response({
            'invoices': serializer.data,
            'summary': {
                'total_outstanding': float(quantize_money(total_outstanding)),
                'total_paid_this_month': float(quantize_money(total_paid_this_month)),
                'unpaid_count': qs.filter(status__in=['ISSUED', 'Unpaid']).count(),
                'overdue_count': qs.filter(status__in=['OVERDUE', 'Overdue']).count(),
                'available_credit': float(quantize_money(credit_balance)),
                'held_deposit_total': float(quantize_money(held_deposit_total)),
            }
        })


class FamilyBillingInvoiceDetailView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        guardian, family, student_ids = get_guardian_family_and_students(request.user)
        query = Q(student__in=student_ids)
        if family:
            query = query | Q(family=family)

        invoice = Invoice.objects.filter(query, id=pk).exclude(status='DRAFT').first()
        if not invoice:
            return Response({'detail': 'Invoice not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = InvoiceDetailSerializer(invoice)
        return Response(serializer.data)


class FamilyBillingPaymentsView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        guardian, family, student_ids = get_guardian_family_and_students(request.user)
        query = Q(student__in=student_ids)
        if family:
            query = query | Q(invoice__family=family)

        payments = Payment.objects.filter(query).order_by('-payment_date')
        serializer = FamilyPaymentSerializer(payments, many=True)
        return Response(serializer.data)


class FamilyBillingPaymentReceiptView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        guardian, family, student_ids = get_guardian_family_and_students(request.user)
        query = Q(student__in=student_ids)
        if family:
            query = query | Q(invoice__family=family)

        payment = Payment.objects.filter(query, id=pk).first()
        if not payment:
            return Response({'detail': 'Payment not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        daycare = payment.daycare
        invoice = payment.invoice
        fam = payment.family or family

        receipt_data = {
            'receipt_number': payment.receipt_number,
            'payment_date': str(payment.payment_date),
            'amount': str(payment.amount),
            'refunded_amount': str(payment.refunded_amount),
            'net_amount': str(payment.net_amount),
            'currency': payment.currency,
            'payment_method': payment.get_payment_method_display(),
            'status': payment.status,
            'transaction_reference': payment.transaction_reference or 'N/A',
            'payer_name': payment.payer_name or (fam.family_name if fam else 'Valued Guardian'),
            'payer_email': payment.payer_email or getattr(fam, 'primary_email', '') or '',
            'notes': payment.notes or '',
            'daycare': {
                'name': daycare.name,
                'address': daycare.address1 or '',
                'phone': getattr(daycare, 'phone', '') or '',
                'email': getattr(daycare, 'email', '') or '',
                'license_number': getattr(daycare, 'license_number', '') or '',
            },
            'invoice': {
                'id': str(invoice.id),
                'invoice_number': invoice.invoice_number,
                'invoice_type': invoice.invoice_type,
                'total_amount': str(invoice.total_amount),
                'balance_due': str(invoice.balance_due),
                'status': invoice.status,
            },
            'student_name': f"{payment.student.first_name} {payment.student.last_name}" if payment.student else 'Family Consolidated',
        }
        return Response(receipt_data)


class FamilyBillingTaxReceiptsView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        guardian, family, student_ids = get_guardian_family_and_students(request.user)
        if not family:
            return Response([])

        tax_year = request.query_params.get('tax_year')
        qs = TaxReceipt.objects.filter(family=family, status='ISSUED').order_by('-tax_year', '-issued_date')
        if tax_year:
            qs = qs.filter(tax_year=int(tax_year))

        serializer = FamilyTaxReceiptSerializer(qs, many=True)
        return Response(serializer.data)


class FamilyBillingTaxReceiptDetailView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        guardian, family, student_ids = get_guardian_family_and_students(request.user)
        if not family:
            return Response({'detail': 'Family not found.'}, status=status.HTTP_404_NOT_FOUND)

        receipt = TaxReceipt.objects.filter(family=family, id=pk, status='ISSUED').first()
        if not receipt:
            return Response({'detail': 'Tax receipt not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'receipt_number': receipt.receipt_number,
            'tax_year': receipt.tax_year,
            'issued_date': str(receipt.issued_date),
            'service_period_start': str(receipt.service_period_start),
            'service_period_end': str(receipt.service_period_end),
            'daycare': {
                'legal_name': receipt.daycare_legal_name,
                'business_number': receipt.daycare_business_number,
                'address': receipt.daycare_address,
            },
            'payer': {
                'name': receipt.recipient_name,
                'address': receipt.recipient_address or '',
                'family_name': receipt.family.family_name,
            },
            'student_name': f"{receipt.student.first_name} {receipt.student.last_name}" if receipt.student else 'All Enrolled Siblings',
            'financials': {
                'total_eligible_fees_paid': str(receipt.total_eligible_fees_paid),
                'total_subsidies_deducted': str(receipt.total_subsidies_deducted),
                'net_claimable_amount': str(receipt.net_claimable_amount),
                'currency': receipt.currency,
            },
            'status': receipt.status,
            'notes': receipt.notes or ''
        })


class FamilyBillingStatementView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        guardian, family, student_ids = get_guardian_family_and_students(request.user)
        if not family:
            return Response({'error': 'Family not found.'}, status=status.HTTP_404_NOT_FOUND)

        start_date_raw = request.query_params.get('start_date')
        end_date_raw = request.query_params.get('end_date')

        from datetime import datetime
        start_date = datetime.strptime(start_date_raw, '%Y-%m-%d').date() if start_date_raw else None
        end_date = datetime.strptime(end_date_raw, '%Y-%m-%d').date() if end_date_raw else None

        statement = BillingCalculationService.get_family_account_statement(
            daycare=family.daycare,
            family=family,
            start_date=start_date,
            end_date=end_date
        )
        return Response(statement)



# ─── Messages ────────────────────────────────────────────────────────────────

class FamilyMessagesView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        guardian, family, _ = get_guardian_family_and_students(request.user)
        if not family:
            return Response({'detail': 'Family not found.'}, status=status.HTTP_404_NOT_FOUND)

        msg_type = request.query_params.get('type', 'all')

        qs = FamilyMessage.objects.filter(
            family=family,
            parent_message__isnull=True
        )

        if msg_type == 'inbox':
            qs = qs.filter(message_type='staff_to_guardian')
        elif msg_type == 'sent':
            qs = qs.filter(message_type='guardian_to_staff')

        qs = qs.order_by('-created_at')
        serializer = FamilyMessageSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        guardian, family, _ = get_guardian_family_and_students(request.user)
        if not family:
            return Response({'detail': 'Family not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        subject = data.get('subject', '').strip()
        body = data.get('body', '').strip()
        parent_id = data.get('parent_message')

        if not subject or not body:
            return Response({'detail': 'Subject and body are required.'}, status=status.HTTP_400_BAD_REQUEST)

        parent = None
        if parent_id:
            try:
                parent = FamilyMessage.objects.get(id=parent_id, family=family)
            except FamilyMessage.DoesNotExist:
                pass

        msg = FamilyMessage.objects.create(
            daycare=request.user.daycare,
            family=family,
            sender=request.user,
            subject=subject,
            body=body,
            message_type='guardian_to_staff',
            parent_message=parent,
        )

        serializer = FamilyMessageSerializer(msg)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FamilyMessageDetailView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        guardian, family, _ = get_guardian_family_and_students(request.user)
        try:
            msg = FamilyMessage.objects.get(id=pk, family=family)
        except FamilyMessage.DoesNotExist:
            return Response({'detail': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)

        if msg.message_type == 'staff_to_guardian' and not msg.is_read:
            msg.is_read = True
            msg.read_at = timezone.now()
            msg.save()

        replies = FamilyMessage.objects.filter(parent_message=msg).order_by('created_at')
        serializer = FamilyMessageSerializer(msg)
        reply_serializer = FamilyMessageSerializer(replies, many=True)
        return Response({
            'message': serializer.data,
            'replies': reply_serializer.data,
        })


# ─── Announcements ────────────────────────────────────────────────────────────

class FamilyAnnouncementsView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        daycare = request.user.daycare
        ann_type = request.query_params.get('type')

        qs = Announcement.objects.filter(
            daycare=daycare,
            status='Published'
        ).order_by('-published_at')

        if ann_type:
            qs = qs.filter(type=ann_type)

        data = []
        for a in qs:
            is_read = AnnouncementRead.objects.filter(
                announcement=a, user=request.user
            ).exists()
            data.append({
                'id': str(a.id),
                'title': a.title,
                'content': a.content,
                'type': a.type,
                'published_at': a.published_at,
                'is_read': is_read,
            })

        return Response(data)

    def post(self, request):
        """Mark an announcement as read."""
        announcement_id = request.data.get('announcement_id')
        if not announcement_id:
            return Response({'detail': 'announcement_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            announcement = Announcement.objects.get(
                id=announcement_id,
                daycare=request.user.daycare,
                status='Published'
            )
        except Announcement.DoesNotExist:
            return Response({'detail': 'Announcement not found.'}, status=status.HTTP_404_NOT_FOUND)

        AnnouncementRead.objects.get_or_create(announcement=announcement, user=request.user)
        return Response({'detail': 'Marked as read.'})


# ─── Consent Forms ────────────────────────────────────────────────────────────

class FamilyConsentFormsView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        _, _, student_ids = get_guardian_family_and_students(request.user)
        status_filter = request.query_params.get('status')

        qs = ConsentFormAssignment.objects.filter(
            student__in=student_ids
        ).select_related('consent_form', 'student').order_by('-created_at')

        if status_filter:
            qs = qs.filter(status=status_filter)

        serializer = ConsentFormAssignmentSerializer(qs, many=True)
        return Response(serializer.data)


class FamilyConsentFormSignView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def post(self, request, pk):
        _, _, student_ids = get_guardian_family_and_students(request.user)

        try:
            assignment = ConsentFormAssignment.objects.get(
                id=pk,
                student__in=student_ids
            )
        except ConsentFormAssignment.DoesNotExist:
            return Response({'detail': 'Consent form not found.'}, status=status.HTTP_404_NOT_FOUND)

        if assignment.status == 'Signed':
            return Response({'detail': 'This form has already been signed.'}, status=status.HTTP_400_BAD_REQUEST)
        if assignment.status == 'Declined':
            return Response({'detail': 'This form was declined.'}, status=status.HTTP_400_BAD_REQUEST)

        data = request.data
        action = data.get('action', 'sign')

        if action == 'decline':
            assignment.status = 'Declined'
            assignment.save()
            return Response({'detail': 'Form declined.'})

        signature_name = data.get('signature_name', '').strip()
        agreed = data.get('agreed', False)

        if not signature_name:
            return Response({'detail': 'Signature name is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not agreed:
            return Response({'detail': 'You must agree to the form content.'}, status=status.HTTP_400_BAD_REQUEST)

        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        ip_address = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else request.META.get('REMOTE_ADDR')

        agreement_text = (
            f"I, {signature_name}, hereby agree to the terms of '{assignment.consent_form.title}' "
            f"on behalf of {assignment.student.first_name} {assignment.student.last_name}. "
            f"Signed digitally at {timezone.now().isoformat()} from IP {ip_address}."
        )

        ConsentFormSignature.objects.create(
            assignment=assignment,
            signed_by=request.user,
            signature_name=signature_name,
            ip_address=ip_address,
            agreement_text=agreement_text,
        )

        assignment.status = 'Signed'
        assignment.save()

        serializer = ConsentFormAssignmentSerializer(assignment)
        return Response({
            'detail': 'Form signed successfully.',
            'assignment': serializer.data,
        })
