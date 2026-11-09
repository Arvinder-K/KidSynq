from datetime import datetime, date
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q
from rest_framework import views, status, permissions
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound

from core.models import (
    Daycare, Student, StudentPickup, PickupQRToken, PickupSecurityPIN,
    SafeArrivalDepartureEvent, User
)
from core.serializers import (
    PickupQRTokenSerializer, PickupSecurityPINSetSerializer,
    PickupSecurityPINVerifySerializer, QRScanRequestSerializer,
    QRCheckInSerializer, QRCheckOutSerializer, PINCheckOutSerializer,
    DigitalSignatureCheckOutSerializer, SafeArrivalDepartureEventSerializer
)
from daycare.views.attendance import IsDaycareStaffOrAdmin
from daycare.services.digital_verification import DigitalVerificationService


def get_request_daycare(request):
    user = request.user
    if hasattr(user, 'daycare') and user.daycare:
        return user.daycare
    if hasattr(user, 'employee_profile') and user.employee_profile and getattr(user.employee_profile, 'daycare', None):
        return user.employee_profile.daycare
    daycare_id = request.query_params.get('daycare_id') or (request.data.get('daycare_id') if hasattr(request, 'data') and isinstance(request.data, dict) else None)
    if daycare_id:
        try:
            return Daycare.objects.get(pk=daycare_id)
        except Exception:
            pass
    if getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False):
        first_daycare = Daycare.objects.first()
        if first_daycare:
            return first_daycare
    return None


class QRTokenGenerateView(views.APIView):
    """
    POST /api/daycare/pickups/qr/generate/
    Generates or refreshes a secure high-entropy QR token for an authorized pickup person.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request):
        pickup_person_id = request.data.get('pickup_person_id')
        if not pickup_person_id:
            return Response({"error": "pickup_person_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        daycare = get_request_daycare(request)
        pickup_person = get_object_or_404(StudentPickup, id=pickup_person_id)

        if not request.user.is_superuser and daycare and pickup_person.student.daycare_id != daycare.id:
            raise PermissionDenied("Cannot generate QR for a pickup person belonging to another daycare.")

        expires_in_days = int(request.data.get('expires_in_days', 30))
        token_obj = DigitalVerificationService.generate_qr_token(
            pickup_person=pickup_person,
            user=request.user,
            expires_in_days=expires_in_days
        )

        serializer = PickupQRTokenSerializer(token_obj)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class QRTokenRevokeView(views.APIView):
    """
    POST /api/daycare/pickups/qr/revoke/
    Revokes an existing QR token.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request):
        token_id = request.data.get('token_id')
        pickup_person_id = request.data.get('pickup_person_id')
        reason = request.data.get('reason')

        daycare = get_request_daycare(request)

        if token_id:
            token_obj = get_object_or_404(PickupQRToken, id=token_id)
        elif pickup_person_id:
            token_obj = PickupQRToken.objects.filter(pickup_person_id=pickup_person_id, is_active=True).first()
            if not token_obj:
                raise NotFound("No active QR token found for this pickup person.")
        else:
            return Response({"error": "token_id or pickup_person_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.is_superuser and daycare and token_obj.daycare_id != daycare.id:
            raise PermissionDenied("Cannot revoke QR token from another daycare.")

        revoked_obj = DigitalVerificationService.revoke_qr_token(
            token_id_or_obj=token_obj,
            user=request.user,
            reason=reason
        )

        return Response({
            "status": "revoked",
            "token_id": str(revoked_obj.id),
            "revoked_at": str(revoked_obj.revoked_at)
        }, status=status.HTTP_200_OK)


class QRScanView(views.APIView):
    """
    POST /api/daycare/pickups/qr/scan/
    Scans and verifies a QR token, returning authorized pickup person info and eligible children.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request):
        serializer = QRScanRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        daycare = get_request_daycare(request)
        token_str = serializer.validated_data['token']

        result = DigitalVerificationService.scan_and_resolve_qr(
            daycare=daycare,
            token_str=token_str,
            user=request.user
        )

        return Response(result, status=status.HTTP_200_OK)


class QRCheckInView(views.APIView):
    """
    POST /api/daycare/pickups/qr/check-in/
    Executes a QR-based child arrival check-in.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request):
        serializer = QRCheckInSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        daycare = get_request_daycare(request)
        token_str = serializer.validated_data['token']
        child_id = str(serializer.validated_data['child_id'])
        notes = serializer.validated_data.get('notes')

        result = DigitalVerificationService.process_qr_checkin(
            daycare=daycare,
            token_str=token_str,
            child_id=child_id,
            staff_user=request.user,
            notes=notes
        )

        return Response(result, status=status.HTTP_200_OK)


class QRCheckOutView(views.APIView):
    """
    POST /api/daycare/pickups/qr/check-out/
    Executes a QR-based child departure check-out.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request):
        serializer = QRCheckOutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        daycare = get_request_daycare(request)
        token_str = serializer.validated_data['token']
        child_id = str(serializer.validated_data['child_id'])
        notes = serializer.validated_data.get('notes')

        result = DigitalVerificationService.process_qr_checkout(
            daycare=daycare,
            token_str=token_str,
            child_id=child_id,
            staff_user=request.user,
            notes=notes
        )

        return Response(result, status=status.HTTP_200_OK)


class PINSetView(views.APIView):
    """
    POST /api/daycare/pickups/pin/set/
    Configures or resets a 4-6 digit numeric PIN for an authorized pickup person.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request):
        serializer = PickupSecurityPINSetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        daycare = get_request_daycare(request)
        pickup_person_id = serializer.validated_data['pickup_person_id']
        raw_pin = serializer.validated_data['pin']

        pickup_person = get_object_or_404(StudentPickup, id=pickup_person_id)
        if not request.user.is_superuser and daycare and pickup_person.student.daycare_id != daycare.id:
            raise PermissionDenied("Cannot configure PIN for a pickup person belonging to another daycare.")

        pin_obj = DigitalVerificationService.set_pickup_pin(
            pickup_person=pickup_person,
            raw_pin=raw_pin,
            user=request.user
        )

        return Response({
            "status": "success",
            "message": "Security PIN configured successfully.",
            "pickup_person_id": str(pickup_person.id),
            "is_active": pin_obj.is_active
        }, status=status.HTTP_200_OK)


class PINVerifyView(views.APIView):
    """
    POST /api/daycare/pickups/pin/verify/
    Verifies an entered PIN for an authorized pickup person without executing departure.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request):
        serializer = PickupSecurityPINVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        daycare = get_request_daycare(request)
        pickup_person_id = serializer.validated_data['pickup_person_id']
        raw_pin = serializer.validated_data['pin']

        pickup_person = get_object_or_404(StudentPickup, id=pickup_person_id)
        if not request.user.is_superuser and daycare and pickup_person.student.daycare_id != daycare.id:
            raise PermissionDenied("Cannot verify PIN for a pickup person belonging to another daycare.")

        is_valid, msg = DigitalVerificationService.verify_pickup_pin(
            pickup_person=pickup_person,
            raw_pin=raw_pin,
            daycare=daycare,
            user=request.user
        )

        if not is_valid:
            return Response({"valid": False, "message": msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"valid": True, "message": msg}, status=status.HTTP_200_OK)


class PINCheckOutView(views.APIView):
    """
    POST /api/daycare/pickups/pin/check-out/
    Executes a PIN-verified child departure check-out.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request):
        serializer = PINCheckOutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        daycare = get_request_daycare(request)
        pickup_person_id = str(serializer.validated_data['pickup_person_id'])
        raw_pin = serializer.validated_data['pin']
        child_id = str(serializer.validated_data['child_id'])
        notes = serializer.validated_data.get('notes')

        result = DigitalVerificationService.process_pin_checkout(
            daycare=daycare,
            pickup_person_id=pickup_person_id,
            raw_pin=raw_pin,
            child_id=child_id,
            staff_user=request.user,
            notes=notes
        )

        return Response(result, status=status.HTTP_200_OK)


class DigitalSignatureCheckOutView(views.APIView):
    """
    POST /api/daycare/pickups/signature/check-out/
    Executes a digital signature child departure check-out.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request):
        serializer = DigitalSignatureCheckOutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        daycare = get_request_daycare(request)
        pickup_person_id = str(serializer.validated_data['pickup_person_id'])
        signature_data = serializer.validated_data['signature_data']
        child_id = str(serializer.validated_data['child_id'])
        notes = serializer.validated_data.get('notes')

        result = DigitalVerificationService.process_signature_checkout(
            daycare=daycare,
            pickup_person_id=pickup_person_id,
            signature_data=signature_data,
            child_id=child_id,
            staff_user=request.user,
            notes=notes
        )

        return Response(result, status=status.HTTP_200_OK)


class SafeArrivalDepartureEventsListView(views.APIView):
    """
    GET /api/daycare/pickups/events/
    Returns recent safe arrival, departure, and verification events with filtering.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request):
        daycare = get_request_daycare(request)
        if not daycare and not request.user.is_superuser:
            return Response([], status=status.HTTP_200_OK)

        qs = SafeArrivalDepartureEvent.objects.all()
        if not request.user.is_superuser:
            qs = qs.filter(daycare=daycare)

        student_id = request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        event_type = request.query_params.get('event_type')
        if event_type:
            qs = qs.filter(event_type__iexact=event_type)

        method = request.query_params.get('method')
        if method:
            qs = qs.filter(verification_method__iexact=method)

        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(verification_status__iexact=status_filter)

        start_date = request.query_params.get('start_date')
        if start_date:
            try:
                sd = datetime.strptime(start_date, '%Y-%m-%d').date()
                qs = qs.filter(timestamp__date__gte=sd)
            except ValueError:
                pass

        end_date = request.query_params.get('end_date')
        if end_date:
            try:
                ed = datetime.strptime(end_date, '%Y-%m-%d').date()
                qs = qs.filter(timestamp__date__lte=ed)
            except ValueError:
                pass

        limit = int(request.query_params.get('limit', 50))
        events = qs.select_related('student', 'authorized_pickup', 'processed_by', 'attendance_record')[:limit]

        serializer = SafeArrivalDepartureEventSerializer(events, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
