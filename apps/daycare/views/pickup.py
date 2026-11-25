import mimetypes
from datetime import datetime, date
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from django.db.models import Q

from rest_framework import viewsets, status, permissions
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, NotFound, ValidationError

from core.models import User, Student, StudentPickup, AuditLog, Daycare, FamilyChild, FamilyGuardian

from core.serializers import (
    StudentPickupSerializer, AuthorizedPickupSerializer,
    PickupVerificationRequestSerializer
)
from core.permissions import IsDaycareAdmin, IsAuthenticatedGuardian
from daycare.views.attendance import IsDaycareStaffOrAdmin
from daycare.services.pickup import PickupVerificationService


class AuthorizedPickupViewSet(viewsets.ModelViewSet):
    serializer_class = StudentPickupSerializer
    permission_classes = [IsDaycareStaffOrAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare and not self.request.user.is_superuser:
            return StudentPickup.objects.none()

        qs = StudentPickup.objects.all()
        if not self.request.user.is_superuser:
            qs = qs.filter(student__daycare=daycare)

        child_pk = self.kwargs.get('child_pk')
        if child_pk:
            qs = qs.filter(student_id=child_pk)

        # Filters
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(authorization_status__iexact=status_filter)

        search = self.request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(phone__icontains=search) |
                Q(email__icontains=search) |
                Q(relationship__icontains=search)
            )

        return qs.select_related('student', 'daycare', 'created_by')

    def perform_create(self, serializer):
        child_pk = self.kwargs.get('child_pk') or self.request.data.get('student') or self.request.data.get('student_id')
        if not child_pk:
            raise ValidationError({"student": "Child/Student ID is required."})

        student = get_object_or_404(Student, id=child_pk)
        if not self.request.user.is_superuser and student.daycare_id != self.request.user.daycare_id:
            raise PermissionDenied("Cannot add authorized pickup for a child from another daycare.")

        daycare = self.request.user.daycare or student.daycare
        pickup = serializer.save(
            student=student,
            daycare=daycare,
            created_by=self.request.user,
            updated_by=self.request.user,
            approval_status='Approved',
            id_proof_status='Verified'
        )

        # Audit
        AuditLog.objects.create(
            user=self.request.user,
            user_type=getattr(self.request.user, 'role', 'Staff') or 'Staff',
            action="Created Pickup Authorization",
            module="Safe Arrival Departure",
            entity_type="StudentPickup",
            entity_id=str(pickup.id),
            new_values={
                "name": pickup.name,
                "relationship": pickup.relationship,
                "phone": pickup.phone,
                "child_id": str(student.id),
                "child_name": f"{student.first_name} {student.last_name}",
                "authorization_status": pickup.authorization_status,
                "valid_until": str(pickup.valid_until) if pickup.valid_until else None
            }
        )

    def perform_update(self, serializer):
        old_pickup = self.get_object()
        old_values = {
            "name": old_pickup.name,
            "relationship": old_pickup.relationship,
            "phone": old_pickup.phone,
            "authorization_status": old_pickup.authorization_status,
            "valid_from": str(old_pickup.valid_from) if old_pickup.valid_from else None,
            "valid_until": str(old_pickup.valid_until) if old_pickup.valid_until else None
        }

        pickup = serializer.save(updated_by=self.request.user)

        AuditLog.objects.create(
            user=self.request.user,
            user_type=getattr(self.request.user, 'role', 'Staff') or 'Staff',
            action="Updated Pickup Authorization",
            module="Safe Arrival Departure",
            entity_type="StudentPickup",
            entity_id=str(pickup.id),
            old_values=old_values,
            new_values={
                "name": pickup.name,
                "relationship": pickup.relationship,
                "phone": pickup.phone,
                "authorization_status": pickup.authorization_status,
                "valid_from": str(pickup.valid_from) if pickup.valid_from else None,
                "valid_until": str(pickup.valid_until) if pickup.valid_until else None
            }
        )

    def perform_destroy(self, instance):
        if not self.request.user.is_superuser and instance.student.daycare_id != self.request.user.daycare_id:
            raise PermissionDenied("Cannot delete pickup from another daycare.")

        AuditLog.objects.create(
            user=self.request.user,
            user_type=getattr(self.request.user, 'role', 'Staff') or 'Staff',
            action="Deleted Pickup Authorization",
            module="Safe Arrival Departure",
            entity_type="StudentPickup",
            entity_id=str(instance.id),
            old_values={"name": instance.name, "child_id": str(instance.student_id)}
        )
        instance.delete()

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None, child_pk=None):
        pickup = self.get_object()
        old_status = pickup.authorization_status
        pickup.authorization_status = StudentPickup.STATUS_ACTIVE
        pickup.updated_by = request.user
        pickup.save(update_fields=['authorization_status', 'updated_by', 'updated_at'])

        AuditLog.objects.create(
            user=request.user,
            user_type=getattr(request.user, 'role', 'Staff') or 'Staff',
            action="Activated Pickup Authorization",
            module="Safe Arrival Departure",
            entity_type="StudentPickup",
            entity_id=str(pickup.id),
            old_values={"authorization_status": old_status},
            new_values={"authorization_status": StudentPickup.STATUS_ACTIVE}
        )
        return Response(StudentPickupSerializer(pickup).data)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None, child_pk=None):
        pickup = self.get_object()
        old_status = pickup.authorization_status
        pickup.authorization_status = StudentPickup.STATUS_INACTIVE
        pickup.updated_by = request.user
        pickup.save(update_fields=['authorization_status', 'updated_by', 'updated_at'])

        AuditLog.objects.create(
            user=request.user,
            user_type=getattr(request.user, 'role', 'Staff') or 'Staff',
            action="Deactivated Pickup Authorization",
            module="Safe Arrival Departure",
            entity_type="StudentPickup",
            entity_id=str(pickup.id),
            old_values={"authorization_status": old_status},
            new_values={"authorization_status": StudentPickup.STATUS_INACTIVE}
        )
        return Response(StudentPickupSerializer(pickup).data)

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None, child_pk=None):
        pickup = self.get_object()
        old_status = pickup.authorization_status
        reason = request.data.get('reason', 'Revoked by staff')
        pickup.authorization_status = StudentPickup.STATUS_REVOKED
        if reason:
            pickup.notes = f"{pickup.notes or ''}\n[REVOKED {timezone.now().date()}]: {reason}".strip()
        pickup.updated_by = request.user
        pickup.save(update_fields=['authorization_status', 'notes', 'updated_by', 'updated_at'])

        AuditLog.objects.create(
            user=request.user,
            user_type=getattr(request.user, 'role', 'Staff') or 'Staff',
            action="Revoked Pickup Authorization",
            module="Safe Arrival Departure",
            entity_type="StudentPickup",
            entity_id=str(pickup.id),
            old_values={"authorization_status": old_status},
            new_values={"authorization_status": StudentPickup.STATUS_REVOKED, "reason": reason}
        )
        return Response(StudentPickupSerializer(pickup).data)

    @action(detail=True, methods=['post'], url_path='set-expiry')
    def set_expiry(self, request, pk=None, child_pk=None):
        pickup = self.get_object()
        valid_until_str = request.data.get('valid_until')
        if not valid_until_str:
            pickup.valid_until = None
        else:
            try:
                pickup.valid_until = datetime.strptime(valid_until_str, "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError({"valid_until": "Invalid date format. Expected YYYY-MM-DD."})

        # If expiry date is in future and status was expired, revert to active
        today = timezone.now().date()
        if pickup.valid_until and pickup.valid_until >= today and pickup.authorization_status == StudentPickup.STATUS_EXPIRED:
            pickup.authorization_status = StudentPickup.STATUS_ACTIVE
        elif pickup.valid_until and pickup.valid_until < today:
            pickup.authorization_status = StudentPickup.STATUS_EXPIRED

        pickup.updated_by = request.user
        pickup.save()

        AuditLog.objects.create(
            user=request.user,
            user_type=getattr(request.user, 'role', 'Staff') or 'Staff',
            action="Updated Pickup Expiry",
            module="Safe Arrival Departure",
            entity_type="StudentPickup",
            entity_id=str(pickup.id),
            new_values={"valid_until": str(pickup.valid_until) if pickup.valid_until else None, "authorization_status": pickup.authorization_status}
        )
        return Response(StudentPickupSerializer(pickup).data)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None, child_pk=None):
        pickup = self.get_object()
        logs = AuditLog.objects.filter(
            entity_type='StudentPickup',
            entity_id=str(pickup.id)
        ).order_by('-created_at')[:50]

        history_data = [
            {
                "id": str(log.id),
                "action": log.action,
                "actor": log.user.get_full_name() if log.user else (log.user_type or 'System'),
                "details": log.new_values,
                "timestamp": log.created_at.isoformat()
            }
            for log in logs
        ]
        return Response(history_data)

    @action(detail=True, methods=['get', 'post'], permission_classes=[AllowAny])
    def photo(self, request, pk=None, child_pk=None):
        from rest_framework_simplejwt.tokens import AccessToken
        pickup = self.get_object()

        # Check authentication (Header or ?token=)
        auth_user = request.user if request.user and request.user.is_authenticated else None
        if not auth_user:
            token_str = request.GET.get('token')
            if token_str:
                try:
                    token_obj = AccessToken(token_str)
                    user_id = token_obj['user_id']
                    auth_user = User.objects.filter(id=user_id).first()
                except Exception:
                    auth_user = None

        if not auth_user:
            raise PermissionDenied("Authentication credentials were not provided.")

        # Daycare isolation check
        if not auth_user.is_superuser and pickup.student.daycare_id != auth_user.daycare_id:
            raise PermissionDenied("Cannot access photo of another daycare's pickup person.")

        if request.method == 'POST':
            photo_file = request.FILES.get('photo')
            if not photo_file:
                return Response({"error": "No photo file provided."}, status=status.HTTP_400_BAD_REQUEST)

            pickup.photo = photo_file
            pickup.updated_by = auth_user
            pickup.save(update_fields=['photo', 'updated_by', 'updated_at'])

            AuditLog.objects.create(
                user=auth_user,
                user_type=getattr(auth_user, 'role', 'Staff') or 'Staff',
                action="Uploaded Pickup Photo",
                module="Safe Arrival Departure",
                entity_type="StudentPickup",
                entity_id=str(pickup.id),
                new_values={"file_name": photo_file.name}
            )
            return Response({
                "status": "Photo uploaded successfully",
                "photo": pickup.photo.url if pickup.photo else None,
                "photo_url": f"/api/daycare/authorized-pickups/{pickup.id}/photo/"
            })

        # GET method: Securely stream the protected photo
        if not pickup.photo:
            raise Http404("No photo found for this pickup person.")

        try:
            file_handle = pickup.photo.open('rb')
            response = FileResponse(file_handle)
            content_type, _ = mimetypes.guess_type(pickup.photo.name)
            response['Content-Type'] = content_type or 'image/jpeg'
            return response
        except Exception:
            raise Http404("Photo file not accessible.")


    # Legacy workflow approvals
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None, child_pk=None):
        pickup = self.get_object()
        if pickup.approval_status == 'Pending_Removal':
            pickup.delete()
            return Response({'status': 'Pickup removed'})

        if pickup.pending_changes:
            for k, v in pickup.pending_changes.items():
                if hasattr(pickup, k):
                    setattr(pickup, k, v)
            pickup.pending_changes = None

        pickup.approval_status = 'Approved'
        pickup.authorization_status = StudentPickup.STATUS_ACTIVE
        if pickup.id_proof_status == 'Pending':
            pickup.id_proof_status = 'Verified'
        pickup.updated_by = request.user
        pickup.save()

        # Notify family
        try:
            from daycare.services.family_notifications import FamilyNotificationService
            FamilyNotificationService.notify_student_family(
                student=pickup.student,
                notification_type=FamilyNotificationService.NOTIFICATION_PICKUP_APPROVED,
                title="Pickup Authorization Approved",
                message=f"Pickup authorization for {pickup.name} ({pickup.relationship}) for {pickup.student.first_name} {pickup.student.last_name} has been approved.",
                sender=request.user
            )
        except Exception:
            pass

        return Response({'status': 'Approved', 'data': StudentPickupSerializer(pickup).data})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None, child_pk=None):
        pickup = self.get_object()
        if pickup.approval_status == 'Pending_Removal':
            pickup.approval_status = 'Approved'
            pickup.save()
            return Response({'status': 'Removal rejected'})

        if pickup.approval_status == 'Pending':
            pickup.approval_status = 'Rejected'
            pickup.authorization_status = StudentPickup.STATUS_INACTIVE
            pickup.save()

            # Notify family
            try:
                from daycare.services.family_notifications import FamilyNotificationService
                FamilyNotificationService.notify_student_family(
                    student=pickup.student,
                    notification_type=FamilyNotificationService.NOTIFICATION_PICKUP_REJECTED,
                    title="Pickup Authorization Rejected",
                    message=f"Pickup authorization request for {pickup.name} ({pickup.relationship}) for {pickup.student.first_name} {pickup.student.last_name} was rejected.",
                    sender=request.user
                )
            except Exception:
                pass

            return Response({'status': 'Creation rejected'})

        if pickup.pending_changes:
            pickup.pending_changes = None
            pickup.approval_status = 'Approved'
            pickup.save()
            return Response({'status': 'Changes rejected'})

        return Response({'status': 'Nothing to reject'})


class PickupVerificationView(APIView):
    """
    POST /api/daycare/pickups/verify/
    Verifies if a specific pickup person is authorized to collect a child.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def post(self, request):
        serializer = PickupVerificationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        daycare = request.user.daycare
        child_id = serializer.validated_data['child_id']
        pickup_person_id = serializer.validated_data['pickup_person_id']
        verification_date = serializer.validated_data.get('verification_date')
        notes = serializer.validated_data.get('notes')

        result = PickupVerificationService.verify(
            daycare=daycare,
            child_id=child_id,
            pickup_person_id=pickup_person_id,
            verification_date=verification_date,
            user=request.user,
            request=request,
            notes=notes
        )

        return Response(result, status=status.HTTP_200_OK)


class ActiveChildPickupsView(APIView):
    """
    GET /api/daycare/children/<child_pk>/pickups/active/
    Returns active authorized pickups for a child.
    """
    permission_classes = [IsDaycareStaffOrAdmin]

    def get(self, request, child_pk):
        daycare = request.user.daycare
        # Strict tenant check
        child = get_object_or_404(Student, id=child_pk)
        if not request.user.is_superuser and child.daycare_id != getattr(daycare, 'id', None):
            raise PermissionDenied("Cannot access children of another daycare.")

        pickups = PickupVerificationService.get_child_active_pickups(daycare=daycare, child_id=child.id)
        serializer = StudentPickupSerializer(pickups, many=True)
        return Response(serializer.data)


class GuardianPickupPhotoView(APIView):
    """
    GET /api/family/authorized-pickups/<pk>/photo/
    Allows authenticated guardians to securely view photos of pickups for their own children.
    """
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        pickup = get_object_or_404(StudentPickup, id=pk)

        # Verify child access for this guardian
        guardian = getattr(request.user, 'guardian_profile', None) or getattr(request.user, 'guardian', None)
        if not guardian:
            raise PermissionDenied("Guardian profile required.")

        family_ids = FamilyGuardian.objects.filter(guardian=guardian).values_list('family_id', flat=True)
        student_ids = FamilyChild.objects.filter(family_id__in=family_ids).values_list('student_id', flat=True)

        if pickup.student_id not in student_ids:
            raise PermissionDenied("Access denied. Pickup does not belong to your family's children.")

        if not pickup.photo:
            raise Http404("No photo found for this pickup person.")

        try:
            file_handle = pickup.photo.open('rb')
            response = FileResponse(file_handle)
            content_type, _ = mimetypes.guess_type(pickup.photo.name)
            response['Content-Type'] = content_type or 'image/jpeg'
            return response
        except Exception:
            raise Http404("Photo file not accessible.")
