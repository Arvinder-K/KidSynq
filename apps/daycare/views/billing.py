"""
Module 16: Billing & Invoicing (Phase 1)
Daycare Admin ViewSets for Fee Structures, Fee Assignments, Registration Fees, and Deposits.
"""

from datetime import date, datetime
from decimal import Decimal
from django.db import models, transaction
from django.utils import timezone
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from core.models import (
    Daycare,
    Student,
    Family,
    ClassroomStudent,
    FeeStructure,
    ChildFeeAssignment,
    RegistrationFeeRecord,
    DepositRecord,
    DiscountRule,
    SiblingDiscountRule,
    CreditTransaction,
    LateFeeRule,
    Invoice,
    InvoiceItem,
    InvoiceLineItem,
    Payment,
    RecurringBillingProfile,
    ChildSubsidyProfile,
    TaxReceipt,
    StudentAttendance,
    AuditLog
)
from core.serializers import (
    FeeStructureSerializer,
    ChildFeeAssignmentSerializer,
    RegistrationFeeRecordSerializer,
    DepositRecordSerializer,
    DiscountRuleSerializer,
    SiblingDiscountRuleSerializer,
    CreditTransactionSerializer,
    LateFeeRuleSerializer,
    InvoiceSerializer,
    InvoiceDetailSerializer,
    InvoiceCreateSerializer,
    InvoiceItemSerializer,
    RecurringBillingProfileSerializer,
    PaymentSerializer,
    PaymentCreateSerializer,
    PaymentRefundSerializer,
    ChildSubsidyProfileSerializer,
    TaxReceiptSerializer,
    TaxReceiptCreateSerializer,
    TaxReceiptBatchGenerateSerializer
)
from daycare.services.billing import BillingCalculationService, quantize_money

# Legacy SaaS subscription views compatibility
try:
    from core.api_views import (
        InvoiceListView,
        InvoiceDetailView,
        SubscriptionPlanListView,
        SubscriptionCheckoutView
    )
except ImportError:
    pass



def resolve_daycare(request, data=None):
    """
    Safely resolves the active daycare instance for multi-tenant and admin scenarios.
    """
    if hasattr(request.user, 'daycare') and request.user.daycare:
        return request.user.daycare
    daycare_id = None
    if data and isinstance(data, dict):
        daycare_id = data.get('daycare') or data.get('daycare_id')
    if not daycare_id and hasattr(request, 'data') and isinstance(request.data, dict):
        daycare_id = request.data.get('daycare') or request.data.get('daycare_id')
    if not daycare_id and hasattr(request, 'query_params'):
        daycare_id = request.query_params.get('daycare') or request.query_params.get('daycare_id')
    if daycare_id:
        if isinstance(daycare_id, Daycare):
            return daycare_id
        dc = Daycare.objects.filter(id=daycare_id).first()
        if dc:
            return dc
    return Daycare.objects.first()


class IsDaycareAdminOrSuperUser(permissions.BasePermission):
    """Permission check ensuring only Daycare Admins or Super Admins can configure fees."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        from core.models import Guardian
        if hasattr(request.user, 'guardian_profile') and request.user.guardian_profile is not None:
            return False
        if Guardian.objects.filter(user=request.user).exists():
            return False
        user_type = getattr(request.user, 'user_type', None) or getattr(request.user, 'role', None)
        if user_type in ['Parent', 'Family', 'Guardian']:
            return False
        return bool(getattr(request.user, 'daycare', None))


class FeeStructureViewSet(viewsets.ModelViewSet):
    """
    CRUD and versioning management for Daycare Fee Structures.
    """
    serializer_class = FeeStructureSerializer
    permission_classes = [IsDaycareAdminOrSuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description', 'fee_type']
    ordering_fields = ['name', 'amount', 'effective_from', 'created_at', 'is_active']
    ordering = ['-is_active', 'name']

    def get_queryset(self):
        user = self.request.user
        daycare = resolve_daycare(self.request)
        if user.is_superuser and not getattr(user, 'daycare', None):
            qs = FeeStructure.objects.all()
        else:
            qs = FeeStructure.objects.filter(daycare=daycare)

        # Optional query param filters
        fee_type = self.request.query_params.get('fee_type')
        if fee_type:
            qs = qs.filter(fee_type=fee_type)

        frequency = self.request.query_params.get('frequency')
        if frequency:
            qs = qs.filter(frequency=frequency)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            if is_active.lower() in ['true', '1']:
                qs = qs.filter(is_active=True)
            elif is_active.lower() in ['false', '0']:
                qs = qs.filter(is_active=False)

        # By default only return latest or non-superseded records unless include_history=true
        include_history = self.request.query_params.get('include_history', 'false').lower() in ['true', '1']
        if not include_history:
            # We want either root fees with no children, or the highest version child
            pass

        return qs.select_related('branch', 'program', 'classroom', 'created_by')

    def perform_create(self, serializer):
        daycare = resolve_daycare(self.request, serializer.validated_data)
        currency = serializer.validated_data.get('currency') or BillingCalculationService.get_daycare_currency(daycare)
        instance = serializer.save(
            daycare=daycare,
            currency=currency,
            created_by=self.request.user,
            updated_by=self.request.user
        )

        AuditLog.objects.create(
            user=self.request.user,
            user_type='Daycare Admin',
            action='CREATE_FEE_STRUCTURE',
            module='Billing & Invoicing',
            entity_type='FeeStructure',
            entity_id=str(instance.id),
            new_values={
                'name': instance.name,
                'fee_type': instance.fee_type,
                'frequency': instance.frequency,
                'amount': str(instance.amount),
                'currency': instance.currency,
                'effective_from': str(instance.effective_from),
                'is_active': instance.is_active,
            }
        )

    def perform_update(self, serializer):
        old_inst = self.get_object()
        old_state = {
            'name': old_inst.name,
            'amount': str(old_inst.amount),
            'is_active': old_inst.is_active,
            'effective_from': str(old_inst.effective_from),
            'effective_until': str(old_inst.effective_until),
        }

        instance = serializer.save(updated_by=self.request.user)

        AuditLog.objects.create(
            user=self.request.user,
            user_type='Daycare Admin',
            action='UPDATE_FEE_STRUCTURE',
            module='Billing & Invoicing',
            entity_type='FeeStructure',
            entity_id=str(instance.id),
            old_values=old_state,
            new_values={
                'name': instance.name,
                'amount': str(instance.amount),
                'is_active': instance.is_active,
                'effective_from': str(instance.effective_from),
                'effective_until': str(instance.effective_until),
            }
        )

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a fee structure."""
        fee = self.get_object()
        fee.is_active = True
        fee.updated_by = request.user
        fee.save()

        AuditLog.objects.create(
            user=request.user,
            user_type='Daycare Admin',
            action='ACTIVATE_FEE_STRUCTURE',
            module='Billing & Invoicing',
            entity_type='FeeStructure',
            entity_id=str(fee.id),
            new_values={'is_active': True}
        )
        return Response({'status': 'activated', 'fee': self.get_serializer(fee).data})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a fee structure."""
        fee = self.get_object()
        fee.is_active = False
        fee.updated_by = request.user
        fee.save()

        AuditLog.objects.create(
            user=request.user,
            user_type='Daycare Admin',
            action='DEACTIVATE_FEE_STRUCTURE',
            module='Billing & Invoicing',
            entity_type='FeeStructure',
            entity_id=str(fee.id),
            new_values={'is_active': False}
        )
        return Response({'status': 'deactivated', 'fee': self.get_serializer(fee).data})

    @action(detail=True, methods=['post'])
    def create_version(self, request, pk=None):
        """
        Creates a new historical pricing version for this fee structure.
        """
        existing_fee = self.get_object()
        new_amount_raw = request.data.get('amount')
        effective_from_raw = request.data.get('effective_from')
        notes = request.data.get('notes', '')

        if not new_amount_raw or not effective_from_raw:
            return Response({'error': 'amount and effective_from are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_amount = Decimal(str(new_amount_raw))
            if isinstance(effective_from_raw, str):
                effective_from = datetime.strptime(effective_from_raw, '%Y-%m-%d').date()
            else:
                effective_from = effective_from_raw
        except Exception as e:
            return Response({'error': f'Invalid input format: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_fee = BillingCalculationService.create_new_fee_version(
                existing_fee=existing_fee,
                new_amount=new_amount,
                effective_from=effective_from,
                actor=request.user,
                notes=notes
            )
            return Response(self.get_serializer(new_fee).data, status=status.HTTP_201_CREATED)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Returns all versions associated with this fee structure."""
        fee = self.get_object()
        root = fee.parent_fee or fee
        versions = FeeStructure.objects.filter(
            models.Q(id=root.id) | models.Q(parent_fee=root)
        ).order_by('-version')
        serializer = self.get_serializer(versions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Returns billing configuration summary metrics."""
        daycare = request.user.daycare
        currency = BillingCalculationService.get_daycare_currency(daycare) if daycare else 'CAD'

        qs = FeeStructure.objects.filter(daycare=daycare) if daycare else FeeStructure.objects.all()
        
        active_count = qs.filter(is_active=True).count()
        monthly_count = qs.filter(is_active=True, fee_type='MONTHLY').count()
        registration_count = qs.filter(is_active=True, fee_type='REGISTRATION').count()
        deposit_count = qs.filter(is_active=True, fee_type='DEPOSIT').count()
        assignments_count = ChildFeeAssignment.objects.filter(daycare=daycare, is_active=True).count() if daycare else 0
        deposits_held_total = sum(
            [d.remaining_held for d in DepositRecord.objects.filter(daycare=daycare)]
        ) if daycare else Decimal('0.00')

        return Response({
            'currency': currency,
            'total_fee_structures': qs.count(),
            'active_fee_structures': active_count,
            'monthly_childcare_fees': monthly_count,
            'registration_fees': registration_count,
            'deposit_fees': deposit_count,
            'active_child_assignments': assignments_count,
            'total_deposits_held': quantize_money(deposits_held_total),
        })


class ChildFeeAssignmentViewSet(viewsets.ModelViewSet):
    """
    CRUD management for child-specific fee assignments and custom rates.
    """
    serializer_class = ChildFeeAssignmentSerializer
    permission_classes = [IsDaycareAdminOrSuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['student__first_name', 'student__last_name', 'fee_structure__name', 'discount_reason']
    ordering_fields = ['effective_from', 'created_at', 'is_active']
    ordering = ['-is_active', 'student__first_name']

    def get_queryset(self):
        user = self.request.user
        daycare = resolve_daycare(self.request)
        if user.is_superuser and not getattr(user, 'daycare', None):
            qs = ChildFeeAssignment.objects.all()
        else:
            qs = ChildFeeAssignment.objects.filter(daycare=daycare)

        student_id = self.request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=(is_active.lower() in ['true', '1']))

        return qs.select_related('student', 'fee_structure', 'enrollment', 'family')

    def perform_create(self, serializer):
        daycare = resolve_daycare(self.request, serializer.validated_data)
        student = serializer.validated_data['student']
        
        # Link family and enrollment automatically if omitted
        enrollment = serializer.validated_data.get('enrollment') or ClassroomStudent.objects.filter(student=student, status='Active').first()
        family_child = student.child_families.first()
        family = serializer.validated_data.get('family') or (family_child.family if family_child else None)

        currency = serializer.validated_data.get('currency') or BillingCalculationService.get_daycare_currency(daycare)

        instance = serializer.save(
            daycare=daycare,
            enrollment=enrollment,
            family=family,
            currency=currency,
            created_by=self.request.user,
            updated_by=self.request.user
        )

        AuditLog.objects.create(
            user=self.request.user,
            user_type='Daycare Admin',
            action='ASSIGN_CHILD_FEE',
            module='Billing & Invoicing',
            entity_type='ChildFeeAssignment',
            entity_id=str(instance.id),
            new_values={
                'student': f"{student.first_name} {student.last_name}",
                'fee_structure': instance.fee_structure.name,
                'custom_amount': str(instance.custom_amount) if instance.custom_amount else None,
                'discount_percentage': str(instance.discount_percentage),
                'effective_rate': str(instance.effective_rate),
            }
        )

    @action(detail=False, methods=['get'])
    def resolve_for_child(self, request):
        """
        Resolves the exact effective fee rate for a student on a target date.
        """
        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'error': 'student_id query param is required.'}, status=status.HTTP_400_BAD_REQUEST)

        student = Student.objects.filter(id=student_id).first()
        if not student:
            return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        target_date_raw = request.query_params.get('date')
        if target_date_raw:
            try:
                target_date = datetime.strptime(target_date_raw, '%Y-%m-%d').date()
            except Exception:
                target_date = date.today()
        else:
            target_date = date.today()

        fee_type = request.query_params.get('fee_type')
        result = BillingCalculationService.resolve_effective_fee_for_student(
            student=student,
            target_date=target_date,
            fee_type=fee_type
        )

        if not result:
            return Response({'found': False, 'message': 'No applicable fee structure found for student.'})

        return Response({'found': True, 'resolved_fee': result})


class RegistrationFeeRecordViewSet(viewsets.ModelViewSet):
    """
    Tracking and managing child one-time registration fees.
    """
    serializer_class = RegistrationFeeRecordSerializer
    permission_classes = [IsDaycareAdminOrSuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['student__first_name', 'student__last_name', 'fee_structure__name']
    ordering_fields = ['created_at', 'status', 'amount']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        daycare = resolve_daycare(self.request)
        if user.is_superuser and not getattr(user, 'daycare', None):
            qs = RegistrationFeeRecord.objects.all()
        else:
            qs = RegistrationFeeRecord.objects.filter(daycare=daycare)

        student_id = self.request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        return qs.select_related('student', 'fee_structure', 'family', 'waived_by')

    def create(self, request, *args, **kwargs):
        daycare = resolve_daycare(request)
        student_id = request.data.get('student')
        fee_structure_id = request.data.get('fee_structure')
        notes = request.data.get('notes', '')

        if not student_id or not fee_structure_id:
            return Response({'error': 'student and fee_structure are required.'}, status=status.HTTP_400_BAD_REQUEST)

        student = Student.objects.filter(id=student_id).first()
        fee_structure = FeeStructure.objects.filter(id=fee_structure_id).first()

        if not student or not fee_structure:
            return Response({'error': 'Student or FeeStructure not found.'}, status=status.HTTP_404_NOT_FOUND)

        daycare = student.daycare or daycare

        result = BillingCalculationService.record_or_check_registration_fee(
            daycare=daycare,
            student=student,
            fee_structure=fee_structure,
            actor=request.user,
            notes=notes
        )

        serializer = self.get_serializer(result['record'])
        status_code = status.HTTP_201_CREATED if result['created'] else status.HTTP_200_OK
        return Response({
            'created': result['created'],
            'already_exists': result['already_exists'],
            'message': result['message'],
            'data': serializer.data
        }, status=status_code)

    @action(detail=True, methods=['post'])
    def waive(self, request, pk=None):
        """Waive a child registration fee with a reason."""
        record = self.get_object()
        reason = request.data.get('reason', 'Administrative Waiver')
        record.status = 'WAIVED'
        record.waived_reason = reason
        record.waived_by = request.user
        record.waived_at = timezone.now()
        record.save()

        AuditLog.objects.create(
            user=request.user,
            user_type='Daycare Admin',
            action='WAIVE_REGISTRATION_FEE',
            module='Billing & Invoicing',
            entity_type='RegistrationFeeRecord',
            entity_id=str(record.id),
            new_values={
                'status': 'WAIVED',
                'waived_reason': reason,
                'waived_by': request.user.username,
            }
        )

        return Response({'status': 'waived', 'record': self.get_serializer(record).data})


class DepositRecordViewSet(viewsets.ModelViewSet):
    """
    Tracking and managing child held deposit funds.
    """
    serializer_class = DepositRecordSerializer
    permission_classes = [IsDaycareAdminOrSuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['student__first_name', 'student__last_name', 'fee_structure__name', 'notes']
    ordering_fields = ['created_at', 'amount_charged', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        daycare = resolve_daycare(self.request)
        if user.is_superuser and not getattr(user, 'daycare', None):
            qs = DepositRecord.objects.all()
        else:
            qs = DepositRecord.objects.filter(daycare=daycare)

        student_id = self.request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        return qs.select_related('student', 'fee_structure', 'family', 'created_by')

    def perform_create(self, serializer):
        daycare = resolve_daycare(self.request, serializer.validated_data)
        student = serializer.validated_data['student']
        
        enrollment = serializer.validated_data.get('enrollment') or ClassroomStudent.objects.filter(student=student, status='Active').first()
        family_child = student.child_families.first()
        family = serializer.validated_data.get('family') or (family_child.family if family_child else None)

        currency = serializer.validated_data.get('currency') or BillingCalculationService.get_daycare_currency(daycare)

        instance = serializer.save(
            daycare=daycare,
            enrollment=enrollment,
            family=family,
            currency=currency,
            created_by=self.request.user,
            updated_by=self.request.user
        )

        AuditLog.objects.create(
            user=self.request.user,
            user_type='Daycare Admin',
            action='CREATE_DEPOSIT_RECORD',
            module='Billing & Invoicing',
            entity_type='DepositRecord',
            entity_id=str(instance.id),
            new_values={
                'student': f"{student.first_name} {student.last_name}",
                'amount_charged': str(instance.amount_charged),
                'amount_held': str(instance.amount_held),
                'currency': instance.currency,
                'status': instance.status,
            }
        )

    @action(detail=True, methods=['post'])
    def process_action(self, request, pk=None):
        """
        Process a deposit lifecycle event (RECEIVE_DEPOSIT, APPLY_TO_BILLING, REFUND_DEPOSIT, FORFEIT_DEPOSIT).
        """
        deposit = self.get_object()
        action_type = request.data.get('action_type')
        amount_raw = request.data.get('amount')
        notes = request.data.get('notes', '')

        if not action_type or amount_raw is None:
            return Response({'error': 'action_type and amount are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount_raw))
            result = BillingCalculationService.process_deposit_action(
                deposit_record=deposit,
                action_type=action_type,
                amount=amount,
                actor=request.user,
                notes=notes
            )
            deposit.refresh_from_db()
            return Response({
                'result': result,
                'deposit': self.get_serializer(deposit).data
            })
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Failed to process deposit action: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BillingCalculatorView(viewsets.ViewSet):
    """
    Utility endpoint to test/preview fee calculations, prorations, and discounts.
    """
    permission_classes = [IsDaycareAdminOrSuperUser]

    @action(detail=False, methods=['post'])
    def calculate_proration(self, request):
        monthly_amount_raw = request.data.get('monthly_amount')
        start_date_raw = request.data.get('start_date')
        end_date_raw = request.data.get('end_date')

        if not monthly_amount_raw or not start_date_raw:
            return Response({'error': 'monthly_amount and start_date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            monthly_amount = Decimal(str(monthly_amount_raw))
            start_date = datetime.strptime(start_date_raw, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_raw, '%Y-%m-%d').date() if end_date_raw else None
            
            res = BillingCalculationService.calculate_prorated_monthly_fee(
                monthly_amount=monthly_amount,
                start_date=start_date,
                end_date=end_date
            )
            return Response(res)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def calculate_sibling_discount(self, request):
        base_amount_raw = request.data.get('base_amount')
        sibling_count = int(request.data.get('sibling_count', 1))
        discount_percentage_raw = request.data.get('discount_percentage', '10.00')

        if not base_amount_raw:
            return Response({'error': 'base_amount is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            base_amount = Decimal(str(base_amount_raw))
            discount_percentage = Decimal(str(discount_percentage_raw))
            res = BillingCalculationService.calculate_sibling_discount(
                base_amount=base_amount,
                sibling_count_in_daycare=sibling_count,
                sibling_discount_percentage=discount_percentage
            )
            return Response(res)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def child_breakdown(self, request):
        student_id = request.data.get('student_id')
        if not student_id:
            return Response({'error': 'student_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        daycare = getattr(request.user, 'daycare', None)
        if request.user.is_superuser and not daycare:
            student = Student.objects.filter(id=student_id).first()
        else:
            student = Student.objects.filter(id=student_id, daycare=daycare).first()
        if not student:
            return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        target_date_raw = request.data.get('target_date')
        target_date = datetime.strptime(target_date_raw, '%Y-%m-%d').date() if target_date_raw else date.today()

        base_amount_raw = request.data.get('base_amount')
        base_amount = Decimal(str(base_amount_raw)) if base_amount_raw else None

        fee_type = request.data.get('fee_type')
        due_date_raw = request.data.get('due_date')
        due_date = datetime.strptime(due_date_raw, '%Y-%m-%d').date() if due_date_raw else None

        overdue_balance_raw = request.data.get('overdue_balance')
        overdue_balance = Decimal(str(overdue_balance_raw)) if overdue_balance_raw else None

        eval_date_raw = request.data.get('evaluation_date')
        eval_date = datetime.strptime(eval_date_raw, '%Y-%m-%d').date() if eval_date_raw else None

        try:
            res = BillingCalculationService.calculate_student_billing_breakdown(
                student=student,
                target_date=target_date,
                base_amount=base_amount,
                fee_type=fee_type,
                due_date=due_date,
                overdue_balance=overdue_balance,
                evaluation_date=eval_date
            )
            return Response(res)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def family_breakdown(self, request):
        family_id = request.data.get('family_id')
        if not family_id:
            return Response({'error': 'family_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        daycare = getattr(request.user, 'daycare', None)
        if request.user.is_superuser and not daycare:
            family = Family.objects.filter(id=family_id).first()
            daycare = family.daycare if family else resolve_daycare(request)
        else:
            family = Family.objects.filter(id=family_id, daycare=daycare).first()

        if not family:
            return Response({'error': 'Family not found.'}, status=status.HTTP_404_NOT_FOUND)

        target_date_raw = request.data.get('target_date')
        target_date = datetime.strptime(target_date_raw, '%Y-%m-%d').date() if target_date_raw else date.today()

        due_date_raw = request.data.get('due_date')
        due_date = datetime.strptime(due_date_raw, '%Y-%m-%d').date() if due_date_raw else None

        apply_credits = request.data.get('apply_available_credits', True)
        eval_date_raw = request.data.get('evaluation_date')
        eval_date = datetime.strptime(eval_date_raw, '%Y-%m-%d').date() if eval_date_raw else None

        try:
            res = BillingCalculationService.calculate_family_billing_breakdown(
                family=family,
                daycare=daycare,
                target_date=target_date,
                due_date=due_date,
                apply_available_credits=apply_credits,
                evaluation_date=eval_date
            )
            return Response(res)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ==============================================================================
# MODULE 16: BILLING & INVOICING (PHASE 2 VIEWSETS)
# ==============================================================================

class DiscountRuleViewSet(viewsets.ModelViewSet):
    """
    CRUD, versioning, and activation management for Daycare Discount Rules.
    """
    serializer_class = DiscountRuleSerializer
    permission_classes = [IsDaycareAdminOrSuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description', 'discount_type', 'applies_to']
    ordering_fields = ['priority', 'value', 'effective_from', 'name', 'created_at', 'is_active']
    ordering = ['-is_active', 'priority', 'name']

    def get_queryset(self):
        user = self.request.user
        daycare = resolve_daycare(self.request)
        if user.is_superuser and not getattr(user, 'daycare', None):
            qs = DiscountRule.objects.all()
        else:
            qs = DiscountRule.objects.filter(daycare=daycare)

        applies_to = self.request.query_params.get('applies_to')
        if applies_to:
            qs = qs.filter(applies_to=applies_to)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=(is_active.lower() in ['true', '1']))

        student_id = self.request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        family_id = self.request.query_params.get('family_id')
        if family_id:
            qs = qs.filter(family_id=family_id)

        return qs.select_related('branch', 'program', 'classroom', 'family', 'student', 'enrollment', 'created_by')

    def perform_create(self, serializer):
        daycare = resolve_daycare(self.request, serializer.validated_data)
        currency = serializer.validated_data.get('currency') or BillingCalculationService.get_daycare_currency(daycare)
        instance = serializer.save(
            daycare=daycare,
            currency=currency,
            created_by=self.request.user,
            updated_by=self.request.user
        )

        AuditLog.objects.create(
            user=self.request.user,
            user_type='Daycare Admin',
            action='CREATE_DISCOUNT_RULE',
            module='Billing & Invoicing',
            entity_type='DiscountRule',
            entity_id=str(instance.id),
            new_values={
                'name': instance.name,
                'discount_type': instance.discount_type,
                'value': str(instance.value),
                'currency': instance.currency,
                'applies_to': instance.applies_to,
                'effective_from': str(instance.effective_from),
                'is_active': instance.is_active,
            }
        )

    def perform_update(self, serializer):
        old_inst = self.get_object()
        old_state = {
            'name': old_inst.name,
            'value': str(old_inst.value),
            'is_active': old_inst.is_active,
            'effective_from': str(old_inst.effective_from),
            'effective_until': str(old_inst.effective_until),
        }

        instance = serializer.save(updated_by=self.request.user)

        AuditLog.objects.create(
            user=self.request.user,
            user_type='Daycare Admin',
            action='UPDATE_DISCOUNT_RULE',
            module='Billing & Invoicing',
            entity_type='DiscountRule',
            entity_id=str(instance.id),
            old_values=old_state,
            new_values={
                'name': instance.name,
                'value': str(instance.value),
                'is_active': instance.is_active,
                'effective_from': str(instance.effective_from),
                'effective_until': str(instance.effective_until),
            }
        )

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        rule = self.get_object()
        rule.is_active = True
        rule.updated_by = request.user
        rule.save()

        AuditLog.objects.create(
            user=request.user,
            user_type='Daycare Admin',
            action='ACTIVATE_DISCOUNT_RULE',
            module='Billing & Invoicing',
            entity_type='DiscountRule',
            entity_id=str(rule.id),
            new_values={'is_active': True}
        )
        return Response({'status': 'activated', 'discount_rule': self.get_serializer(rule).data})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        rule = self.get_object()
        rule.is_active = False
        rule.updated_by = request.user
        rule.save()

        AuditLog.objects.create(
            user=request.user,
            user_type='Daycare Admin',
            action='DEACTIVATE_DISCOUNT_RULE',
            module='Billing & Invoicing',
            entity_type='DiscountRule',
            entity_id=str(rule.id),
            new_values={'is_active': False}
        )
        return Response({'status': 'deactivated', 'discount_rule': self.get_serializer(rule).data})

    @action(detail=True, methods=['post'])
    def create_version(self, request, pk=None):
        existing_rule = self.get_object()
        new_value_raw = request.data.get('value')
        effective_from_raw = request.data.get('effective_from')
        notes = request.data.get('notes', '')

        if not new_value_raw or not effective_from_raw:
            return Response({'error': 'value and effective_from are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_value = Decimal(str(new_value_raw))
            if isinstance(effective_from_raw, str):
                effective_from = datetime.strptime(effective_from_raw, '%Y-%m-%d').date()
            else:
                effective_from = effective_from_raw
        except Exception as e:
            return Response({'error': f'Invalid input format: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_rule = BillingCalculationService.create_new_discount_version(
                existing_rule=existing_rule,
                new_value=new_value,
                effective_from=effective_from,
                actor=request.user,
                notes=notes
            )
            return Response(self.get_serializer(new_rule).data, status=status.HTTP_201_CREATED)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        rule = self.get_object()
        root = rule.parent_rule or rule
        versions = DiscountRule.objects.filter(
            models.Q(id=root.id) | models.Q(parent_rule=root)
        ).order_by('-version')
        serializer = self.get_serializer(versions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def applicable(self, request):
        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'error': 'student_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        daycare = getattr(request.user, 'daycare', None)
        if request.user.is_superuser and not daycare:
            student = Student.objects.filter(id=student_id).first()
        else:
            student = Student.objects.filter(id=student_id, daycare=daycare).first()

        if not student:
            return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        target_date_raw = request.query_params.get('date')
        if target_date_raw:
            try:
                target_date = datetime.strptime(target_date_raw, '%Y-%m-%d').date()
            except Exception:
                target_date = date.today()
        else:
            target_date = date.today()

        base_amount_raw = request.query_params.get('base_amount')
        base_amount = Decimal(str(base_amount_raw)) if base_amount_raw else None
        fee_type = request.query_params.get('fee_type')

        res = BillingCalculationService.resolve_discounts_for_student(
            student=student,
            target_date=target_date,
            base_amount=base_amount,
            fee_type=fee_type
        )
        return Response(res)


class SiblingDiscountRuleViewSet(viewsets.ModelViewSet):
    """
    CRUD and versioning management for Daycare Sibling Discount Rules.
    """
    serializer_class = SiblingDiscountRuleSerializer
    permission_classes = [IsDaycareAdminOrSuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['effective_from', 'name', 'is_active']
    ordering = ['-is_active', '-effective_from']

    def get_queryset(self):
        user = self.request.user
        daycare = resolve_daycare(self.request)
        if user.is_superuser and not getattr(user, 'daycare', None):
            qs = SiblingDiscountRule.objects.all()
        else:
            qs = SiblingDiscountRule.objects.filter(daycare=daycare)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=(is_active.lower() in ['true', '1']))

        return qs.select_related('created_by')

    def perform_create(self, serializer):
        daycare = resolve_daycare(self.request, serializer.validated_data)
        currency = serializer.validated_data.get('currency') or BillingCalculationService.get_daycare_currency(daycare)
        instance = serializer.save(
            daycare=daycare,
            currency=currency,
            created_by=self.request.user,
            updated_by=self.request.user
        )

        AuditLog.objects.create(
            user=self.request.user,
            user_type='Daycare Admin',
            action='CREATE_SIBLING_DISCOUNT_RULE',
            module='Billing & Invoicing',
            entity_type='SiblingDiscountRule',
            entity_id=str(instance.id),
            new_values={
                'name': instance.name,
                'discount_type': instance.discount_type,
                'value': str(instance.value),
                'applies_to_target': instance.applies_to_target,
                'target_fee_selection': instance.target_fee_selection,
                'ordering_criteria': instance.ordering_criteria,
            }
        )

    def perform_update(self, serializer):
        old_inst = self.get_object()
        old_state = {
            'name': old_inst.name,
            'value': str(old_inst.value),
            'is_active': old_inst.is_active,
            'effective_from': str(old_inst.effective_from),
            'effective_until': str(old_inst.effective_until),
        }

        instance = serializer.save(updated_by=self.request.user)

        AuditLog.objects.create(
            user=self.request.user,
            user_type='Daycare Admin',
            action='UPDATE_SIBLING_DISCOUNT_RULE',
            module='Billing & Invoicing',
            entity_type='SiblingDiscountRule',
            entity_id=str(instance.id),
            old_values=old_state,
            new_values={
                'name': instance.name,
                'value': str(instance.value),
                'is_active': instance.is_active,
                'effective_from': str(instance.effective_from),
                'effective_until': str(instance.effective_until),
            }
        )

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        rule = self.get_object()
        rule.is_active = True
        rule.updated_by = request.user
        rule.save()

        AuditLog.objects.create(
            user=request.user,
            user_type='Daycare Admin',
            action='ACTIVATE_SIBLING_DISCOUNT_RULE',
            module='Billing & Invoicing',
            entity_type='SiblingDiscountRule',
            entity_id=str(rule.id),
            new_values={'is_active': True}
        )
        return Response({'status': 'activated', 'sibling_discount_rule': self.get_serializer(rule).data})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        rule = self.get_object()
        rule.is_active = False
        rule.updated_by = request.user
        rule.save()

        AuditLog.objects.create(
            user=request.user,
            user_type='Daycare Admin',
            action='DEACTIVATE_SIBLING_DISCOUNT_RULE',
            module='Billing & Invoicing',
            entity_type='SiblingDiscountRule',
            entity_id=str(rule.id),
            new_values={'is_active': False}
        )
        return Response({'status': 'deactivated', 'sibling_discount_rule': self.get_serializer(rule).data})

    @action(detail=True, methods=['post'])
    def create_version(self, request, pk=None):
        existing_rule = self.get_object()
        new_value_raw = request.data.get('value')
        effective_from_raw = request.data.get('effective_from')
        notes = request.data.get('notes', '')

        if not new_value_raw or not effective_from_raw:
            return Response({'error': 'value and effective_from are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_value = Decimal(str(new_value_raw))
            if isinstance(effective_from_raw, str):
                effective_from = datetime.strptime(effective_from_raw, '%Y-%m-%d').date()
            else:
                effective_from = effective_from_raw
        except Exception as e:
            return Response({'error': f'Invalid input format: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_rule = BillingCalculationService.create_new_sibling_discount_version(
                existing_rule=existing_rule,
                new_value=new_value,
                effective_from=effective_from,
                actor=request.user,
                notes=notes
            )
            return Response(self.get_serializer(new_rule).data, status=status.HTTP_201_CREATED)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def preview_family(self, request):
        family_id = request.data.get('family_id')
        if not family_id:
            return Response({'error': 'family_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        daycare = getattr(request.user, 'daycare', None)
        if request.user.is_superuser and not daycare:
            family = Family.objects.filter(id=family_id).first()
            daycare = family.daycare if family else resolve_daycare(request)
        else:
            family = Family.objects.filter(id=family_id, daycare=daycare).first()

        if not family:
            return Response({'error': 'Family not found.'}, status=status.HTTP_404_NOT_FOUND)

        target_date_raw = request.data.get('date')
        if target_date_raw:
            try:
                target_date = datetime.strptime(target_date_raw, '%Y-%m-%d').date()
            except Exception:
                target_date = date.today()
        else:
            target_date = date.today()

        student_fee_map = request.data.get('student_fee_map')
        res = BillingCalculationService.resolve_sibling_discounts_for_family(
            family=family,
            daycare=daycare,
            target_date=target_date,
            student_fee_map=student_fee_map
        )
        return Response(res)


class CreditTransactionViewSet(viewsets.ModelViewSet):
    """
    Credit Ledger management: granting, applying, reversing, and viewing family credit balances.
    """
    serializer_class = CreditTransactionSerializer
    permission_classes = [IsDaycareAdminOrSuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['family__family_name', 'reason', 'reference', 'notes']
    ordering_fields = ['created_at', 'amount', 'transaction_type', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        daycare = resolve_daycare(self.request)
        if user.is_superuser and not getattr(user, 'daycare', None):
            qs = CreditTransaction.objects.all()
        else:
            qs = CreditTransaction.objects.filter(daycare=daycare)

        family_id = self.request.query_params.get('family_id')
        if family_id:
            qs = qs.filter(family_id=family_id)

        student_id = self.request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        tx_type = self.request.query_params.get('transaction_type')
        if tx_type:
            qs = qs.filter(transaction_type=tx_type)

        tx_status = self.request.query_params.get('status')
        if tx_status:
            qs = qs.filter(status=tx_status)

        return qs.select_related('family', 'student', 'created_by', 'reversed_transaction')

    @action(detail=False, methods=['post'])
    def grant(self, request):
        """Grants manual credit / compensation / overpayment credit."""
        family_id = request.data.get('family')
        amount_raw = request.data.get('amount')
        reason = request.data.get('reason', 'Administrative Credit Grant')
        student_id = request.data.get('student')
        reference = request.data.get('reference', '')
        notes = request.data.get('notes', '')

        if not family_id or amount_raw is None:
            return Response({'error': 'family and amount are required.'}, status=status.HTTP_400_BAD_REQUEST)

        daycare = getattr(request.user, 'daycare', None)
        if request.user.is_superuser and not daycare:
            family = Family.objects.filter(id=family_id).first()
            daycare = family.daycare if family else resolve_daycare(request)
        else:
            family = Family.objects.filter(id=family_id, daycare=daycare).first()

        if not family:
            return Response({'error': 'Family not found.'}, status=status.HTTP_404_NOT_FOUND)

        student = None
        if student_id:
            student = Student.objects.filter(id=student_id, daycare=daycare).first()

        try:
            amount = Decimal(str(amount_raw))
            tx = BillingCalculationService.grant_family_credit(
                daycare=daycare,
                family=family,
                amount=amount,
                reason=reason,
                student=student,
                reference=reference,
                actor=request.user,
                notes=notes
            )
            return Response(self.get_serializer(tx).data, status=status.HTTP_201_CREATED)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Failed to grant credit: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def apply(self, request):
        """Applies credit towards billing / invoice."""
        family_id = request.data.get('family')
        amount_raw = request.data.get('amount')
        reference = request.data.get('reference', 'Invoice Application')
        student_id = request.data.get('student')
        notes = request.data.get('notes', '')

        if not family_id or amount_raw is None:
            return Response({'error': 'family and amount are required.'}, status=status.HTTP_400_BAD_REQUEST)

        daycare = getattr(request.user, 'daycare', None)
        if request.user.is_superuser and not daycare:
            family = Family.objects.filter(id=family_id).first()
            daycare = family.daycare if family else resolve_daycare(request)
        else:
            family = Family.objects.filter(id=family_id, daycare=daycare).first()

        if not family:
            return Response({'error': 'Family not found.'}, status=status.HTTP_404_NOT_FOUND)

        student = None
        if student_id:
            student = Student.objects.filter(id=student_id, daycare=daycare).first()

        try:
            amount = Decimal(str(amount_raw))
            tx = BillingCalculationService.apply_family_credit(
                daycare=daycare,
                family=family,
                amount=amount,
                reference=reference,
                student=student,
                actor=request.user,
                notes=notes
            )
            return Response(self.get_serializer(tx).data, status=status.HTTP_201_CREATED)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Failed to apply credit: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def reverse(self, request, pk=None):
        """Reverses a credit transaction with reason."""
        tx = self.get_object()
        reason = request.data.get('reason', 'Administrative Reversal')

        try:
            reversal_tx = BillingCalculationService.reverse_family_credit(
                credit_transaction=tx,
                reason=reason,
                actor=request.user
            )
            return Response({
                'status': 'reversed',
                'reversal_transaction': self.get_serializer(reversal_tx).data
            })
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Failed to reverse credit: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def balance(self, request):
        """Returns available credit balance for a family."""
        family_id = request.query_params.get('family_id')
        if not family_id:
            return Response({'error': 'family_id query param is required.'}, status=status.HTTP_400_BAD_REQUEST)

        daycare = getattr(request.user, 'daycare', None)
        if request.user.is_superuser and not daycare:
            family = Family.objects.filter(id=family_id).first()
            daycare = family.daycare if family else resolve_daycare(request)
        else:
            family = Family.objects.filter(id=family_id, daycare=daycare).first()

        if not family:
            return Response({'error': 'Family not found.'}, status=status.HTTP_404_NOT_FOUND)

        balance = BillingCalculationService.get_family_credit_balance(family, daycare)
        currency = BillingCalculationService.get_daycare_currency(daycare)

        return Response({
            'family_id': str(family.id),
            'family_name': family.family_name,
            'available_credit_balance': balance,
            'currency': currency,
        })


class LateFeeRuleViewSet(viewsets.ModelViewSet):
    """
    CRUD and versioning management for Daycare Late Fee Rules.
    """
    serializer_class = LateFeeRuleSerializer
    permission_classes = [IsDaycareAdminOrSuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description', 'fee_type']
    ordering_fields = ['effective_from', 'amount', 'name', 'is_active']
    ordering = ['-is_active', 'name']

    def get_queryset(self):
        user = self.request.user
        daycare = resolve_daycare(self.request)
        if user.is_superuser and not getattr(user, 'daycare', None):
            qs = LateFeeRule.objects.all()
        else:
            qs = LateFeeRule.objects.filter(daycare=daycare)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=(is_active.lower() in ['true', '1']))

        return qs.select_related('created_by')

    def perform_create(self, serializer):
        daycare = resolve_daycare(self.request, serializer.validated_data)
        currency = serializer.validated_data.get('currency') or BillingCalculationService.get_daycare_currency(daycare)
        instance = serializer.save(
            daycare=daycare,
            currency=currency,
            created_by=self.request.user,
            updated_by=self.request.user
        )

        AuditLog.objects.create(
            user=self.request.user,
            user_type='Daycare Admin',
            action='CREATE_LATE_FEE_RULE',
            module='Billing & Invoicing',
            entity_type='LateFeeRule',
            entity_id=str(instance.id),
            new_values={
                'name': instance.name,
                'fee_type': instance.fee_type,
                'amount': str(instance.amount),
                'grace_period_days': instance.grace_period_days,
                'frequency': instance.frequency,
            }
        )

    def perform_update(self, serializer):
        old_inst = self.get_object()
        old_state = {
            'name': old_inst.name,
            'amount': str(old_inst.amount),
            'is_active': old_inst.is_active,
            'effective_from': str(old_inst.effective_from),
            'effective_until': str(old_inst.effective_until),
        }

        instance = serializer.save(updated_by=self.request.user)

        AuditLog.objects.create(
            user=self.request.user,
            user_type='Daycare Admin',
            action='UPDATE_LATE_FEE_RULE',
            module='Billing & Invoicing',
            entity_type='LateFeeRule',
            entity_id=str(instance.id),
            old_values=old_state,
            new_values={
                'name': instance.name,
                'amount': str(instance.amount),
                'is_active': instance.is_active,
                'effective_from': str(instance.effective_from),
                'effective_until': str(instance.effective_until),
            }
        )

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        rule = self.get_object()
        rule.is_active = True
        rule.updated_by = request.user
        rule.save()

        AuditLog.objects.create(
            user=request.user,
            user_type='Daycare Admin',
            action='ACTIVATE_LATE_FEE_RULE',
            module='Billing & Invoicing',
            entity_type='LateFeeRule',
            entity_id=str(rule.id),
            new_values={'is_active': True}
        )
        return Response({'status': 'activated', 'late_fee_rule': self.get_serializer(rule).data})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        rule = self.get_object()
        rule.is_active = False
        rule.updated_by = request.user
        rule.save()

        AuditLog.objects.create(
            user=request.user,
            user_type='Daycare Admin',
            action='DEACTIVATE_LATE_FEE_RULE',
            module='Billing & Invoicing',
            entity_type='LateFeeRule',
            entity_id=str(rule.id),
            new_values={'is_active': False}
        )
        return Response({'status': 'deactivated', 'late_fee_rule': self.get_serializer(rule).data})

    @action(detail=True, methods=['post'])
    def create_version(self, request, pk=None):
        existing_rule = self.get_object()
        new_amount_raw = request.data.get('amount')
        effective_from_raw = request.data.get('effective_from')
        notes = request.data.get('notes', '')

        if not new_amount_raw or not effective_from_raw:
            return Response({'error': 'amount and effective_from are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_amount = Decimal(str(new_amount_raw))
            if isinstance(effective_from_raw, str):
                effective_from = datetime.strptime(effective_from_raw, '%Y-%m-%d').date()
            else:
                effective_from = effective_from_raw
        except Exception as e:
            return Response({'error': f'Invalid input format: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_rule = BillingCalculationService.create_new_late_fee_version(
                existing_rule=existing_rule,
                new_amount=new_amount,
                effective_from=effective_from,
                actor=request.user,
                notes=notes
            )
            return Response(self.get_serializer(new_rule).data, status=status.HTTP_201_CREATED)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def evaluate(self, request):
        due_date_raw = request.data.get('due_date')
        overdue_balance_raw = request.data.get('overdue_balance')
        eval_date_raw = request.data.get('evaluation_date')

        if not due_date_raw or overdue_balance_raw is None:
            return Response({'error': 'due_date and overdue_balance are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            due_date = datetime.strptime(due_date_raw, '%Y-%m-%d').date() if isinstance(due_date_raw, str) else due_date_raw
            overdue_balance = Decimal(str(overdue_balance_raw))
            eval_date = datetime.strptime(eval_date_raw, '%Y-%m-%d').date() if eval_date_raw else date.today()
            daycare = resolve_daycare(request)

            res = BillingCalculationService.calculate_late_fee(
                daycare=daycare,
                due_date=due_date,
                overdue_balance=overdue_balance,
                evaluation_date=eval_date
            )
            return Response(res)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ==============================================================================
# MODULE 16: BILLING & INVOICING (PHASE 3 VIEWSETS)
# ==============================================================================

class InvoiceViewSet(viewsets.ModelViewSet):
    """
    CRUD, generation, and lifecycle management for Daycare Invoices.
    """
    serializer_class = InvoiceSerializer
    permission_classes = [IsDaycareAdminOrSuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'invoice_number',
        'family__family_name',
        'student__first_name',
        'student__last_name',
        'notes'
    ]
    ordering_fields = ['issue_date', 'due_date', 'total', 'balance_due', 'created_at', 'invoice_number', 'status']
    ordering = ['-issue_date', '-created_at']

    def get_serializer_class(self):
        if self.action in ['retrieve', 'issue', 'void', 'cancel', 'apply_credit', 'apply_deposit', 'assess_late_fee']:
            return InvoiceDetailSerializer
        if self.action == 'create':
            return InvoiceCreateSerializer
        return InvoiceSerializer

    def get_queryset(self):
        user = self.request.user
        daycare = resolve_daycare(self.request)
        if user.is_superuser and not getattr(user, 'daycare', None):
            qs = Invoice.objects.all()
        else:
            qs = Invoice.objects.filter(daycare=daycare)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        invoice_type = self.request.query_params.get('invoice_type')
        if invoice_type:
            qs = qs.filter(invoice_type=invoice_type)

        family_id = self.request.query_params.get('family_id')
        if family_id:
            qs = qs.filter(family_id=family_id)

        student_id = self.request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        branch_id = self.request.query_params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        start_date = self.request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(issue_date__gte=start_date)

        end_date = self.request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(issue_date__lte=end_date)

        due_date_from = self.request.query_params.get('due_date_from')
        if due_date_from:
            qs = qs.filter(due_date__gte=due_date_from)

        due_date_to = self.request.query_params.get('due_date_to')
        if due_date_to:
            qs = qs.filter(due_date__lte=due_date_to)

        is_overdue = self.request.query_params.get('is_overdue')
        if is_overdue is not None:
            if is_overdue.lower() in ['true', '1']:
                qs = qs.filter(status='OVERDUE')
            elif is_overdue.lower() in ['false', '0']:
                qs = qs.exclude(status='OVERDUE')

        return qs.select_related(
            'daycare', 'family', 'student', 'branch', 'created_by'
        ).prefetch_related(
            'items', 'items__fee_structure', 'payments'
        )

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        daycare = resolve_daycare(request)
        data = request.data

        family_id = data.get('family')
        student_id = data.get('student')
        branch_id = data.get('branch')
        items_data = data.get('items', [])
        apply_available_credits = data.get('apply_available_credits', True)
        apply_available_deposits = data.get('apply_available_deposits', False)
        notes = data.get('notes', '')
        terms = data.get('terms', '')

        issue_date_raw = data.get('issue_date')
        issue_date = datetime.strptime(issue_date_raw, '%Y-%m-%d').date() if issue_date_raw else date.today()

        due_date_raw = data.get('due_date')
        due_date = datetime.strptime(due_date_raw, '%Y-%m-%d').date() if due_date_raw else None

        period_start_raw = data.get('billing_period_start')
        period_start = datetime.strptime(period_start_raw, '%Y-%m-%d').date() if period_start_raw else None

        period_end_raw = data.get('billing_period_end')
        period_end = datetime.strptime(period_end_raw, '%Y-%m-%d').date() if period_end_raw else None

        student = Student.objects.filter(id=student_id).first() if student_id else None
        family = Family.objects.filter(id=family_id).first() if family_id else None

        if student and not family:
            fam_child = student.child_families.first()
            if fam_child:
                family = fam_child.family

        if not student and not family:
            return Response(
                {'error': 'Either a student or a family must be specified.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        daycare = getattr(student, 'daycare', None) or getattr(family, 'daycare', None) or daycare
        currency = data.get('currency') or BillingCalculationService.get_daycare_currency(daycare)

        branch = None
        if branch_id:
            from core.models import Branch
            branch = Branch.objects.filter(id=branch_id).first()
        elif student and getattr(student, 'branch', None):
            branch = student.branch

        # If explicit line items are provided:
        if items_data and len(items_data) > 0:
            invoice_num = BillingCalculationService.generate_invoice_number(daycare, issue_date=issue_date)
            inv_type = 'STUDENT' if student and not family else 'FAMILY'

            invoice = Invoice.objects.create(
                daycare=daycare,
                branch=branch,
                family=family,
                student=student,
                invoice_number=invoice_num,
                invoice_type=inv_type,
                issue_date=issue_date,
                due_date=due_date or issue_date,
                billing_period_start=period_start,
                billing_period_end=period_end,
                currency=currency,
                status='DRAFT',
                notes=notes,
                terms=terms,
                created_by=request.user,
                updated_by=request.user
            )

            for itm in items_data:
                fee_struct_id = itm.get('fee_structure')
                fee_struct = FeeStructure.objects.filter(id=fee_struct_id).first() if fee_struct_id else None

                qty = Decimal(str(itm.get('quantity', '1.00')))
                unit_p = Decimal(str(itm.get('unit_price', '0.00')))
                disc_amt = Decimal(str(itm.get('discount_amount', '0.00')))
                tax_amt = Decimal(str(itm.get('tax_amount', '0.00')))
                subt = Decimal(str(itm.get('subtotal', (qty * unit_p) - disc_amt)))

                item_student = student
                if itm.get('student'):
                    item_student = Student.objects.filter(id=itm['student']).first() or student

                item_total = quantize_money(max(Decimal('0.00'), subt - disc_amt + tax_amt))

                InvoiceItem.objects.create(
                    invoice=invoice,
                    fee_structure=fee_struct,
                    student=item_student,
                    fee_type_code=itm.get('fee_type_code', fee_struct.fee_type if fee_struct else 'MANUAL'),
                    description=itm.get('description', fee_struct.name if fee_struct else 'Childcare Service'),
                    quantity=qty,
                    unit_price=unit_p,
                    discount_amount=disc_amt,
                    discount_description=itm.get('discount_description', ''),
                    tax_amount=tax_amt,
                    subtotal=subt,
                    total=item_total,
                    rate_snapshot={
                        'fee_structure_id': str(fee_struct.id) if fee_struct else None,
                        'unit_price': str(unit_p),
                        'quantity': str(qty)
                    }
                )

            invoice.recalculate_totals()

            # Apply credits or deposits if requested
            if apply_available_credits and family:
                avail_credit = BillingCalculationService.get_family_credit_balance(family, daycare)
                if avail_credit > Decimal('0.00') and invoice.balance_due > Decimal('0.00'):
                    to_apply = min(avail_credit, invoice.balance_due)
                    BillingCalculationService.apply_credit_to_invoice(
                        invoice=invoice,
                        amount=to_apply,
                        actor=request.user,
                        notes="Auto-applied available credit on invoice creation."
                    )

            if apply_available_deposits and student:
                held_deposit = BillingCalculationService.get_student_held_deposit(student)
                if held_deposit > Decimal('0.00') and invoice.balance_due > Decimal('0.00'):
                    dep_record = DepositRecord.objects.filter(
                        student=student,
                        status__in=['HELD', 'PARTIALLY_APPLIED']
                    ).first()
                    if dep_record:
                        to_apply = min(dep_record.remaining_held, invoice.balance_due)
                        BillingCalculationService.apply_deposit_to_invoice(
                            invoice=invoice,
                            deposit_record=dep_record,
                            amount=to_apply,
                            actor=request.user,
                            notes="Auto-applied held deposit on invoice creation."
                        )

            AuditLog.objects.create(
                user=request.user,
                user_type='Daycare Admin',
                action='CREATE_INVOICE',
                module='Billing & Invoicing',
                entity_type='Invoice',
                entity_id=str(invoice.id),
                new_values={
                    'invoice_number': invoice.invoice_number,
                    'total': str(invoice.total),
                    'status': invoice.status,
                    'family': family.family_name if family else None,
                    'student': f"{student.first_name} {student.last_name}" if student else None,
                }
            )

            serializer = InvoiceDetailSerializer(invoice)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        # If no explicit line items provided, use standard calculation engine:
        try:
            if family:
                invoice = BillingCalculationService.create_family_invoice(
                    daycare=daycare,
                    family=family,
                    billing_period_start=period_start or issue_date,
                    billing_period_end=period_end or issue_date,
                    issue_date=issue_date,
                    due_date=due_date,
                    apply_available_credits=apply_available_credits,
                    actor=request.user,
                    notes=notes,
                    terms=terms
                )
            else:
                invoice = BillingCalculationService.create_student_invoice(
                    daycare=daycare,
                    student=student,
                    billing_period_start=period_start or issue_date,
                    billing_period_end=period_end or issue_date,
                    issue_date=issue_date,
                    due_date=due_date,
                    apply_available_credits=apply_available_credits,
                    apply_available_deposits=apply_available_deposits,
                    actor=request.user,
                    notes=notes,
                    terms=terms
                )

            serializer = InvoiceDetailSerializer(invoice)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def issue(self, request, pk=None):
        """Transition invoice status from DRAFT to ISSUED."""
        invoice = self.get_object()
        try:
            inv = BillingCalculationService.issue_invoice(invoice, actor=request.user)
            return Response(InvoiceDetailSerializer(inv).data)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        """Void an invoice and reverse any applied ledger credits/deposits."""
        invoice = self.get_object()
        reason = request.data.get('reason', 'Administrative Void')
        try:
            inv = BillingCalculationService.void_invoice(invoice, reason=reason, actor=request.user)
            return Response(InvoiceDetailSerializer(inv).data)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel an invoice."""
        invoice = self.get_object()
        reason = request.data.get('reason', 'Administrative Cancellation')
        try:
            inv = BillingCalculationService.cancel_invoice(invoice, reason=reason, actor=request.user)
            return Response(InvoiceDetailSerializer(inv).data)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def apply_credit(self, request, pk=None):
        """Applies family ledger credit balance towards this invoice."""
        invoice = self.get_object()
        amount_raw = request.data.get('amount')
        notes = request.data.get('notes', '')

        if amount_raw is None:
            return Response({'error': 'amount is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount_raw))
            inv = BillingCalculationService.apply_credit_to_invoice(
                invoice=invoice,
                amount=amount,
                actor=request.user,
                notes=notes
            )
            return Response(InvoiceDetailSerializer(inv).data)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Failed to apply credit: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def apply_deposit(self, request, pk=None):
        """Applies child held deposit funds towards this invoice."""
        invoice = self.get_object()
        deposit_record_id = request.data.get('deposit_record_id')
        amount_raw = request.data.get('amount')
        notes = request.data.get('notes', '')

        if not deposit_record_id or amount_raw is None:
            return Response({'error': 'deposit_record_id and amount are required.'}, status=status.HTTP_400_BAD_REQUEST)

        dep_record = DepositRecord.objects.filter(id=deposit_record_id).first()
        if not dep_record:
            return Response({'error': 'DepositRecord not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            amount = Decimal(str(amount_raw))
            inv = BillingCalculationService.apply_deposit_to_invoice(
                invoice=invoice,
                deposit_record=dep_record,
                amount=amount,
                actor=request.user,
                notes=notes
            )
            return Response(InvoiceDetailSerializer(inv).data)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Failed to apply deposit: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def assess_late_fee(self, request, pk=None):
        """Assesses and appends late fee item to an overdue invoice."""
        invoice = self.get_object()
        eval_date_raw = request.data.get('evaluation_date')
        eval_date = datetime.strptime(eval_date_raw, '%Y-%m-%d').date() if eval_date_raw else date.today()

        try:
            inv = BillingCalculationService.assess_late_fee_on_invoice(
                invoice=invoice,
                evaluation_date=eval_date,
                actor=request.user
            )
            return Response(InvoiceDetailSerializer(inv).data)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def generate_registration_invoice(self, request):
        """Generates dedicated one-time registration invoice for a child."""
        student_id = request.data.get('student_id')
        fee_structure_id = request.data.get('fee_structure_id')
        issue_date_raw = request.data.get('issue_date')
        due_date_raw = request.data.get('due_date')
        notes = request.data.get('notes', '')

        if not student_id:
            return Response({'error': 'student_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        daycare = resolve_daycare(request)
        student = Student.objects.filter(id=student_id).first()
        if not student:
            return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        fee_structure = None
        if fee_structure_id:
            fee_structure = FeeStructure.objects.filter(id=fee_structure_id).first()

        issue_date = datetime.strptime(issue_date_raw, '%Y-%m-%d').date() if issue_date_raw else date.today()
        due_date = datetime.strptime(due_date_raw, '%Y-%m-%d').date() if due_date_raw else None

        try:
            inv = BillingCalculationService.generate_registration_invoice(
                daycare=daycare,
                student=student,
                fee_structure=fee_structure,
                issue_date=issue_date,
                due_date=due_date,
                actor=request.user,
                notes=notes
            )
            return Response(InvoiceDetailSerializer(inv).data, status=status.HTTP_201_CREATED)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def generate_batch(self, request):
        """
        Batch-generates invoices for all active families or enrolled students across the daycare or a specific branch.
        """
        daycare = resolve_daycare(request)
        period_start_raw = request.data.get('billing_period_start')
        period_end_raw = request.data.get('billing_period_end')
        issue_date_raw = request.data.get('issue_date')
        due_date_raw = request.data.get('due_date')
        branch_id = request.data.get('branch_id')
        invoice_type = request.data.get('invoice_type', 'FAMILY')
        apply_credits = request.data.get('apply_available_credits', True)
        apply_deposits = request.data.get('apply_available_deposits', False)
        notes = request.data.get('notes', '')

        if not period_start_raw or not period_end_raw:
            return Response(
                {'error': 'billing_period_start and billing_period_end are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        period_start = datetime.strptime(period_start_raw, '%Y-%m-%d').date()
        period_end = datetime.strptime(period_end_raw, '%Y-%m-%d').date()
        issue_date = datetime.strptime(issue_date_raw, '%Y-%m-%d').date() if issue_date_raw else date.today()
        due_date = datetime.strptime(due_date_raw, '%Y-%m-%d').date() if due_date_raw else None

        generated = []
        skipped = []

        if invoice_type == 'FAMILY':
            families_qs = Family.objects.filter(daycare=daycare)
            for fam in families_qs:
                # Check if family has active enrolled children
                active_children = Student.objects.filter(
                    child_families__family=fam,
                    deleted_at__isnull=True
                ).distinct()
                if not active_children.exists():
                    continue

                if branch_id and not active_children.filter(branch_id=branch_id).exists():
                    continue

                # Check duplicate invoice for this period
                existing = Invoice.objects.filter(
                    daycare=daycare,
                    family=fam,
                    billing_period_start=period_start,
                    billing_period_end=period_end,
                    status__in=['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID']
                ).first()

                if existing:
                    skipped.append({'family': fam.family_name, 'reason': f'Already invoiced #{existing.invoice_number}'})
                    continue

                try:
                    inv = BillingCalculationService.create_family_invoice(
                        daycare=daycare,
                        family=fam,
                        billing_period_start=period_start,
                        billing_period_end=period_end,
                        issue_date=issue_date,
                        due_date=due_date,
                        apply_available_credits=apply_credits,
                        actor=request.user,
                        notes=notes
                    )
                    generated.append(InvoiceSerializer(inv).data)
                except Exception as e:
                    skipped.append({'family': fam.family_name, 'reason': str(e)})

        else:
            students_qs = Student.objects.filter(daycare=daycare, deleted_at__isnull=True)
            if branch_id:
                students_qs = students_qs.filter(branch_id=branch_id)

            for stu in students_qs:
                existing = Invoice.objects.filter(
                    daycare=daycare,
                    student=stu,
                    billing_period_start=period_start,
                    billing_period_end=period_end,
                    status__in=['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID']
                ).first()

                if existing:
                    skipped.append({'student': f"{stu.first_name} {stu.last_name}", 'reason': f'Already invoiced #{existing.invoice_number}'})
                    continue

                try:
                    inv = BillingCalculationService.create_student_invoice(
                        daycare=daycare,
                        student=stu,
                        billing_period_start=period_start,
                        billing_period_end=period_end,
                        issue_date=issue_date,
                        due_date=due_date,
                        apply_available_credits=apply_credits,
                        apply_available_deposits=apply_deposits,
                        actor=request.user,
                        notes=notes
                    )
                    generated.append(InvoiceSerializer(inv).data)
                except Exception as e:
                    skipped.append({'student': f"{stu.first_name} {stu.last_name}", 'reason': str(e)})

        return Response({
            'total_generated': len(generated),
            'total_skipped': len(skipped),
            'generated_invoices': generated,
            'skipped': skipped
        })

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Returns comprehensive summary KPIs for daycare invoices."""
        daycare = resolve_daycare(request)
        user = request.user
        qs = Invoice.objects.all() if user.is_superuser and not daycare else Invoice.objects.filter(daycare=daycare)

        currency = BillingCalculationService.get_daycare_currency(daycare) if daycare else 'CAD'
        now = timezone.now()
        current_year = now.year

        # Recalculate overdue statuses for any past due invoices
        today = now.date()
        overdue_candidates = qs.filter(
            status__in=['ISSUED', 'PARTIALLY_PAID'],
            due_date__lt=today
        )
        for cand in overdue_candidates:
            cand.status = 'OVERDUE'
            cand.save(update_fields=['status'])

        total_invoiced_ytd = qs.filter(
            issue_date__year=current_year
        ).exclude(status__in=['VOID', 'CANCELLED']).aggregate(total=models.Sum('total_amount'))['total'] or Decimal('0.00')

        total_collected_ytd = qs.filter(
            issue_date__year=current_year
        ).aggregate(total=models.Sum('amount_paid'))['total'] or Decimal('0.00')

        total_outstanding = qs.filter(
            status__in=['ISSUED', 'PARTIALLY_PAID', 'OVERDUE']
        ).aggregate(total=models.Sum('balance_due'))['total'] or Decimal('0.00')

        total_overdue = qs.filter(
            status='OVERDUE'
        ).aggregate(total=models.Sum('balance_due'))['total'] or Decimal('0.00')

        return Response({
            'currency': currency,
            'total_invoiced_ytd': f"{quantize_money(total_invoiced_ytd):.2f}",
            'total_collected_ytd': f"{quantize_money(total_collected_ytd):.2f}",
            'total_outstanding': f"{quantize_money(total_outstanding):.2f}",
            'total_overdue': f"{quantize_money(total_overdue):.2f}",
            'counts': {
                'draft': qs.filter(status='DRAFT').count(),
                'issued': qs.filter(status='ISSUED').count(),
                'partially_paid': qs.filter(status='PARTIALLY_PAID').count(),
                'paid': qs.filter(status='PAID').count(),
                'overdue': qs.filter(status='OVERDUE').count(),
                'void': qs.filter(status='VOID').count(),
                'cancelled': qs.filter(status='CANCELLED').count(),
                'total': qs.count()
            }
        })

    @action(detail=False, methods=['get'])
    def families(self, request):
        """Lists families belonging to the authenticated Daycare Admin's daycare."""
        daycare = resolve_daycare(request)
        if request.user.is_superuser and not daycare:
            families_qs = Family.objects.all()
        elif daycare:
            families_qs = Family.objects.filter(daycare=daycare)
        else:
            families_qs = Family.objects.all()

        # If no families found for this daycare, but students exist, auto-create / associate families for active students
        if daycare and not families_qs.exists():
            students = Student.objects.filter(daycare=daycare, deleted_at__isnull=True)
            for stu in students:
                fam_name = f"{stu.last_name} Family" if stu.last_name else (f"{stu.first_name} Family" if stu.first_name else "Student Family")
                fam, _ = Family.objects.get_or_create(
                    daycare=daycare,
                    family_name=fam_name,
                    defaults={'status': 'Active'}
                )
                FamilyChild.objects.get_or_create(family=fam, student=stu)
            families_qs = Family.objects.filter(daycare=daycare)

        if not families_qs.exists() and not daycare:
            families_qs = Family.objects.all()

        data = []
        for fam in families_qs:
            children = [
                {
                    'id': str(fc.student.id),
                    'name': f"{fc.student.first_name or ''} {fc.student.last_name or ''}".strip() or f"Student #{str(fc.student.id)[:6]}",
                    'first_name': fc.student.first_name or '',
                    'last_name': fc.student.last_name or '',
                }
                for fc in fam.family_children.select_related('student').all() if fc.student
            ]
            data.append({
                'id': str(fam.id),
                'family_name': fam.family_name or 'Family',
                'primary_contact': fam.primary_contact or (children[0]['name'] if children else ''),
                'primary_email': fam.primary_email or '',
                'primary_phone': fam.primary_phone or '',
                'status': fam.status,
                'children': children
            })
        return Response(data)

    @action(detail=False, methods=['get'])
    def students(self, request):
        """Lists active students belonging to the authenticated Daycare Admin's daycare."""
        daycare = resolve_daycare(request)
        if request.user.is_superuser and not daycare:
            students = Student.objects.filter(deleted_at__isnull=True)
        elif daycare:
            students = Student.objects.filter(daycare=daycare, deleted_at__isnull=True)
            if not students.exists():
                students = Student.objects.filter(deleted_at__isnull=True)
        else:
            students = Student.objects.filter(deleted_at__isnull=True)

        data = []
        for stu in students.select_related('daycare'):
            fam_child = stu.child_families.select_related('family').first()
            data.append({
                'id': str(stu.id),
                'first_name': stu.first_name or '',
                'last_name': stu.last_name or '',
                'name': f"{stu.first_name or ''} {stu.last_name or ''}".strip() or f"Student #{str(stu.id)[:6]}",
                'admission_number': getattr(stu, 'admission_number', '') or '',
                'family_id': str(fam_child.family.id) if fam_child and fam_child.family else None,
                'family_name': fam_child.family.family_name if fam_child and fam_child.family else None,
            })
        return Response(data)


class RecurringBillingProfileViewSet(viewsets.ModelViewSet):
    """
    CRUD and execution trigger management for Recurring Billing Profiles.
    """
    serializer_class = RecurringBillingProfileSerializer
    permission_classes = [IsDaycareAdminOrSuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'profile_name',
        'family__family_name',
        'student__first_name',
        'student__last_name'
    ]
    ordering_fields = ['next_billing_date', 'profile_name', 'frequency', 'is_active', 'created_at']
    ordering = ['-is_active', 'next_billing_date']

    def get_queryset(self):
        user = self.request.user
        daycare = resolve_daycare(self.request)
        if user.is_superuser and not getattr(user, 'daycare', None):
            qs = RecurringBillingProfile.objects.all()
        else:
            qs = RecurringBillingProfile.objects.filter(daycare=daycare)

        family_id = self.request.query_params.get('family_id')
        if family_id:
            qs = qs.filter(family_id=family_id)

        student_id = self.request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        frequency = self.request.query_params.get('frequency')
        if frequency:
            qs = qs.filter(frequency=frequency)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=(is_active.lower() in ['true', '1']))

        return qs.select_related('daycare', 'family', 'student', 'branch', 'fee_structure', 'created_by')

    def perform_create(self, serializer):
        daycare = resolve_daycare(self.request, serializer.validated_data)
        currency = serializer.validated_data.get('currency') or BillingCalculationService.get_daycare_currency(daycare)
        instance = serializer.save(
            daycare=daycare,
            currency=currency,
            created_by=self.request.user,
            updated_by=self.request.user
        )

        AuditLog.objects.create(
            user=self.request.user,
            user_type='Daycare Admin',
            action='CREATE_RECURRING_BILLING_PROFILE',
            module='Billing & Invoicing',
            entity_type='RecurringBillingProfile',
            entity_id=str(instance.id),
            new_values={
                'profile_name': instance.profile_name,
                'frequency': instance.frequency,
                'billing_basis': instance.billing_basis,
                'next_billing_date': str(instance.next_billing_date) if instance.next_billing_date else None,
                'is_active': instance.is_active,
            }
        )

    @action(detail=True, methods=['post'])
    def trigger_run(self, request, pk=None):
        """Triggers a single recurring billing profile immediately."""
        profile = self.get_object()
        target_date_raw = request.data.get('target_date')
        target_date = datetime.strptime(target_date_raw, '%Y-%m-%d').date() if target_date_raw else date.today()

        results = BillingCalculationService.process_recurring_billing_run(
            daycare=profile.daycare,
            target_date=target_date,
            profile=profile,
            actor=request.user
        )
        return Response(results)

    @action(detail=False, methods=['post'])
    def trigger_all_runs(self, request):
        """Triggers all active recurring billing profiles due on or before target date."""
        daycare = resolve_daycare(request)
        target_date_raw = request.data.get('target_date')
        target_date = datetime.strptime(target_date_raw, '%Y-%m-%d').date() if target_date_raw else date.today()

        results = BillingCalculationService.process_recurring_billing_run(
            daycare=daycare,
            target_date=target_date,
            actor=request.user
        )
        return Response(results)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        profile = self.get_object()
        profile.is_active = True
        profile.updated_by = request.user
        profile.save()
        return Response({'status': 'activated', 'profile': self.get_serializer(profile).data})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        profile = self.get_object()
        profile.is_active = False
        profile.updated_by = request.user
        profile.save()
        return Response({'status': 'deactivated', 'profile': self.get_serializer(profile).data})


# ==============================================================================
# MODULE 16: BILLING & INVOICING (PHASE 4 VIEWSETS)
# ==============================================================================

class PaymentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for recording payments, issuing receipts, processing refunds,
    and querying payment transactions.
    """
    serializer_class = PaymentSerializer
    permission_classes = [IsDaycareAdminOrSuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'receipt_number',
        'payer_name',
        'payer_email',
        'transaction_reference',
        'invoice__invoice_number',
        'family__family_name',
        'student__first_name',
        'student__last_name'
    ]
    ordering_fields = ['payment_date', 'amount', 'created_at']
    ordering = ['-payment_date', '-created_at']

    def get_queryset(self):
        user = self.request.user
        daycare = resolve_daycare(self.request)
        if user.is_superuser and not getattr(user, 'daycare', None):
            qs = Payment.objects.all()
        else:
            qs = Payment.objects.filter(daycare=daycare)

        invoice_id = self.request.query_params.get('invoice_id')
        if invoice_id:
            qs = qs.filter(invoice_id=invoice_id)

        family_id = self.request.query_params.get('family_id')
        if family_id:
            qs = qs.filter(family_id=family_id)

        student_id = self.request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        payment_method = self.request.query_params.get('payment_method')
        if payment_method:
            qs = qs.filter(payment_method=payment_method)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        start_date = self.request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(payment_date__gte=start_date)

        end_date = self.request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(payment_date__lte=end_date)

        return qs.select_related('daycare', 'invoice', 'family', 'student', 'created_by')

    def create(self, request, *args, **kwargs):
        """Record a new payment towards an invoice."""
        serializer = PaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        daycare = resolve_daycare(request)
        try:
            invoice = Invoice.objects.get(id=data['invoice_id'], daycare=daycare)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            payment = BillingCalculationService.record_payment(
                daycare=daycare,
                invoice=invoice,
                amount=data['amount'],
                payment_method=data.get('payment_method', 'ETRANSFER'),
                payment_date=data.get('payment_date'),
                transaction_reference=data.get('transaction_reference', ''),
                payer_name=data.get('payer_name', ''),
                payer_email=data.get('payer_email', ''),
                notes=data.get('notes', ''),
                actor=request.user
            )
            return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def refund(self, request, pk=None):
        """Process a full or partial refund on a completed payment."""
        payment = self.get_object()
        serializer = PaymentRefundSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            updated_payment = BillingCalculationService.process_refund(
                payment=payment,
                refund_amount=data['refund_amount'],
                reason=data.get('reason', 'Administrative Refund'),
                actor=request.user
            )
            return Response(PaymentSerializer(updated_payment).data)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def receipt(self, request, pk=None):
        """Returns structured official receipt printout data."""
        payment = self.get_object()
        daycare = payment.daycare
        invoice = payment.invoice
        family = payment.family or (payment.student.child_families.first().family if payment.student and payment.student.child_families.exists() else None)

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
            'payer_name': payment.payer_name or (family.family_name if family else 'Valued Guardian'),
            'payer_email': payment.payer_email or getattr(family, 'primary_email', '') or '',
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

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Returns payments dashboard KPI summary metrics."""
        daycare = resolve_daycare(request)
        payments_qs = self.get_queryset()

        total_collected = sum((p.amount for p in payments_qs if p.status in ['COMPLETED', 'PARTIALLY_REFUNDED']), Decimal('0.00'))
        total_refunded = sum((p.refunded_amount for p in payments_qs), Decimal('0.00'))
        net_collected = max(Decimal('0.00'), total_collected - total_refunded)

        methods_breakdown = {}
        for m_code, m_label in Payment.PAYMENT_METHOD_CHOICES:
            cnt = payments_qs.filter(payment_method=m_code).count()
            if cnt > 0:
                methods_breakdown[m_label] = cnt

        return Response({
            'total_payments_count': payments_qs.count(),
            'total_collected': str(quantize_money(total_collected)),
            'total_refunded': str(quantize_money(total_refunded)),
            'net_collected': str(quantize_money(net_collected)),
            'currency': BillingCalculationService.get_daycare_currency(daycare),
            'methods_breakdown': methods_breakdown
        })


class SubsidyProfileViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for managing Government Subsidies and CWELCC Affordability profiles.
    """
    serializer_class = ChildSubsidyProfileSerializer
    permission_classes = [IsDaycareAdminOrSuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'program_name',
        'government_case_number',
        'student__first_name',
        'student__last_name',
        'family__family_name'
    ]
    ordering_fields = ['effective_from', 'program_name', 'is_active', 'created_at']
    ordering = ['-is_active', '-effective_from']

    def get_queryset(self):
        user = self.request.user
        daycare = resolve_daycare(self.request)
        if user.is_superuser and not getattr(user, 'daycare', None):
            qs = ChildSubsidyProfile.objects.all()
        else:
            qs = ChildSubsidyProfile.objects.filter(daycare=daycare)

        student_id = self.request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        family_id = self.request.query_params.get('family_id')
        if family_id:
            qs = qs.filter(family_id=family_id)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=(is_active.lower() in ['true', '1']))

        subsidy_type = self.request.query_params.get('subsidy_type')
        if subsidy_type:
            qs = qs.filter(subsidy_type=subsidy_type)

        return qs.select_related('daycare', 'student', 'family', 'created_by')

    def perform_create(self, serializer):
        daycare = resolve_daycare(self.request, serializer.validated_data)
        currency = serializer.validated_data.get('currency') or BillingCalculationService.get_daycare_currency(daycare)
        
        # Auto-link family if not explicitly supplied
        student = serializer.validated_data.get('student')
        family = serializer.validated_data.get('family')
        if not family and student:
            fam_child = student.child_families.first()
            if fam_child:
                family = fam_child.family

        instance = serializer.save(
            daycare=daycare,
            family=family,
            currency=currency,
            created_by=self.request.user,
            updated_by=self.request.user
        )

        AuditLog.objects.create(
            user=self.request.user,
            user_type='Daycare Admin',
            action='CREATE_SUBSIDY_PROFILE',
            module='Billing & Invoicing',
            entity_type='ChildSubsidyProfile',
            entity_id=str(instance.id),
            new_values={
                'student': f"{instance.student.first_name} {instance.student.last_name}",
                'program_name': instance.program_name,
                'subsidy_rate': str(instance.subsidy_rate),
                'subsidy_type': instance.subsidy_type
            }
        )

    @action(detail=False, methods=['get'])
    def claims_summary(self, request):
        """Monthly reconciliation overview for government subsidy claims."""
        daycare = resolve_daycare(request)
        profiles = self.get_queryset().filter(is_active=True)

        cwelcc_count = profiles.filter(subsidy_type='PERCENTAGE').count()
        direct_subsidy_count = profiles.exclude(subsidy_type='PERCENTAGE').count()

        return Response({
            'active_subsidized_children': profiles.count(),
            'cwelcc_profiles_count': cwelcc_count,
            'provincial_direct_subsidy_count': direct_subsidy_count,
            'currency': BillingCalculationService.get_daycare_currency(daycare),
        })


class TaxReceiptViewSet(viewsets.ModelViewSet):
    """
    ViewSet for generating, issuing, voiding, and printing official Annual Childcare Tax Receipts.
    """
    serializer_class = TaxReceiptSerializer
    permission_classes = [IsDaycareAdminOrSuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'receipt_number',
        'recipient_name',
        'family__family_name',
        'daycare_legal_name',
        'daycare_business_number'
    ]
    ordering_fields = ['tax_year', 'issued_date', 'receipt_number']
    ordering = ['-tax_year', '-issued_date']

    def get_queryset(self):
        user = self.request.user
        daycare = resolve_daycare(self.request)
        if user.is_superuser and not getattr(user, 'daycare', None):
            qs = TaxReceipt.objects.all()
        else:
            qs = TaxReceipt.objects.filter(daycare=daycare)

        tax_year = self.request.query_params.get('tax_year')
        if tax_year:
            qs = qs.filter(tax_year=int(tax_year))

        family_id = self.request.query_params.get('family_id')
        if family_id:
            qs = qs.filter(family_id=family_id)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        return qs.select_related('daycare', 'family', 'student', 'created_by')

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate or update an annual tax receipt for a single family."""
        serializer = TaxReceiptCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        daycare = resolve_daycare(request)
        try:
            family = Family.objects.get(id=data['family_id'], daycare=daycare)
        except Family.DoesNotExist:
            return Response({'error': 'Family not found.'}, status=status.HTTP_404_NOT_FOUND)

        student = None
        if data.get('student_id'):
            try:
                student = Student.objects.get(id=data['student_id'], daycare=daycare)
            except Student.DoesNotExist:
                pass

        receipt = BillingCalculationService.generate_tax_receipt(
            daycare=daycare,
            family=family,
            tax_year=data['tax_year'],
            actor=request.user,
            student=student
        )
        return Response(TaxReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def generate_batch(self, request):
        """Batch generate tax receipts for all families for a given tax year."""
        serializer = TaxReceiptBatchGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        daycare = resolve_daycare(request)
        result = BillingCalculationService.generate_batch_tax_receipts(
            daycare=daycare,
            tax_year=data['tax_year'],
            actor=request.user
        )
        return Response(result)

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        """Void an issued tax receipt with an audit reason."""
        receipt = self.get_object()
        reason = request.data.get('reason', 'Administrative Void')
        receipt.status = 'VOID'
        receipt.void_reason = reason
        receipt.updated_by = request.user
        receipt.save()

        AuditLog.objects.create(
            user=request.user,
            user_type='Daycare Admin',
            action='VOID_TAX_RECEIPT',
            module='Billing & Invoicing',
            entity_type='TaxReceipt',
            entity_id=str(receipt.id),
            new_values={'status': 'VOID', 'reason': reason}
        )
        return Response(TaxReceiptSerializer(receipt).data)

    @action(detail=True, methods=['get'])
    def print_slip(self, request, pk=None):
        """Returns official Canadian/CRA standard Child Care Receipt structured slip."""
        receipt = self.get_object()
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


class FamilyAccountStatementView(viewsets.ViewSet):
    """
    Daycare Admin View for generating dynamic running statements of account.
    """
    permission_classes = [IsDaycareAdminOrSuperUser]

    def list(self, request):
        daycare = resolve_daycare(request)
        family_id = request.query_params.get('family_id')
        if not family_id:
            return Response({'error': 'family_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            family = Family.objects.get(id=family_id, daycare=daycare)
        except Family.DoesNotExist:
            return Response({'error': 'Family not found.'}, status=status.HTTP_404_NOT_FOUND)

        start_date_raw = request.query_params.get('start_date')
        end_date_raw = request.query_params.get('end_date')

        start_date = datetime.strptime(start_date_raw, '%Y-%m-%d').date() if start_date_raw else None
        end_date = datetime.strptime(end_date_raw, '%Y-%m-%d').date() if end_date_raw else None

        statement = BillingCalculationService.get_family_account_statement(
            daycare=daycare,
            family=family,
            start_date=start_date,
            end_date=end_date
        )
        return Response(statement)



