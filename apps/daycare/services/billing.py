"""
Module 16: Billing & Invoicing (Phase 1)
Billing Calculation and Configuration Service
"""

import calendar
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Dict, Any, List

from django.db import models, transaction
from django.utils import timezone
from core.models import (
    Daycare,
    DaycareSettings,
    Student,
    Family,
    FamilyChild,
    ClassroomStudent,
    StudentAttendance,
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
    AuditLog,
    User,
)

TWOPLACES = Decimal('0.01')


def quantize_money(amount: Decimal) -> Decimal:
    """Helper to consistently round money using standard accounting ROUND_HALF_UP to 2 decimal places."""
    if amount is None:
        return Decimal('0.00')
    if not isinstance(amount, Decimal):
        amount = Decimal(str(amount))
    return amount.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


class BillingCalculationService:
    """
    Reusable domain service for fee resolution, monetary calculations,
    discounts, prorations, deposits, and registration fee lifecycle.
    """

    @staticmethod
    def get_daycare_currency(daycare: Daycare) -> str:
        """Fetch the daycare's configured currency, defaulting to CAD if unset."""
        try:
            settings = DaycareSettings.objects.filter(daycare=daycare).first()
            if settings and settings.currency:
                return settings.currency.strip().upper()
        except Exception:
            pass
        return 'CAD'

    @classmethod
    def resolve_effective_fee_for_student(
        cls,
        student: Student,
        target_date: Optional[date] = None,
        fee_type: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Resolves the applicable fee structure for a student on a specific date.
        Precedence:
        1. Explicit active ChildFeeAssignment for the student
        2. FeeStructure matching student's current classroom
        3. FeeStructure matching student's current program
        4. FeeStructure matching student's branch
        5. Default Daycare-wide FeeStructure (applies_to='ALL')
        """
        if target_date is None:
            target_date = date.today()

        daycare = student.daycare
        currency = cls.get_daycare_currency(daycare)

        # 1. Check direct child fee assignment
        assignment_qs = ChildFeeAssignment.objects.filter(
            daycare=daycare,
            student=student,
            is_active=True,
            effective_from__lte=target_date
        ).filter(
            models_q := (models_q_filter := None) # placeholder
        ) if False else ChildFeeAssignment.objects.filter(
            daycare=daycare,
            student=student,
            is_active=True,
            effective_from__lte=target_date
        )

        for assignment in assignment_qs.select_related('fee_structure'):
            if assignment.effective_until and target_date > assignment.effective_until:
                continue
            if fee_type and assignment.fee_structure.fee_type != fee_type:
                continue
            
            rate = assignment.effective_rate
            return {
                'source': 'CUSTOM_ASSIGNMENT',
                'assignment_id': str(assignment.id),
                'fee_structure_id': str(assignment.fee_structure.id),
                'fee_name': assignment.fee_structure.name,
                'fee_type': assignment.fee_structure.fee_type,
                'frequency': assignment.fee_structure.frequency,
                'base_amount': quantize_money(assignment.fee_structure.amount),
                'custom_amount': quantize_money(assignment.custom_amount) if assignment.custom_amount is not None else None,
                'discount_percentage': Decimal(str(assignment.discount_percentage)),
                'effective_amount': quantize_money(rate),
                'currency': assignment.currency or currency,
                'effective_from': assignment.effective_from,
                'effective_until': assignment.effective_until,
            }

        # Find student's active classroom enrollment if any
        enrollment = ClassroomStudent.objects.filter(
            student=student,
            status='Active'
        ).select_related('classroom', 'classroom__program').first()

        classroom = enrollment.classroom if enrollment else None
        program = classroom.program if classroom else None
        branch = student.branch or (classroom.branch if classroom else None)

        # Base query for active fee structures on target_date
        fees_qs = FeeStructure.objects.filter(
            daycare=daycare,
            is_active=True,
            effective_from__lte=target_date
        )
        if fee_type:
            fees_qs = fees_qs.filter(fee_type=fee_type)

        active_fees = [f for f in fees_qs if not f.effective_until or f.effective_until >= target_date]

        # 2. Check Classroom-specific fee
        if classroom:
            classroom_fee = next((f for f in active_fees if f.applies_to == 'CLASSROOM' and f.classroom_id == classroom.id), None)
            if classroom_fee:
                return cls._format_fee_dict(classroom_fee, 'CLASSROOM_MATCH', currency)

        # 3. Check Program-specific fee
        if program:
            program_fee = next((f for f in active_fees if f.applies_to == 'PROGRAM' and f.program_id == program.id), None)
            if program_fee:
                return cls._format_fee_dict(program_fee, 'PROGRAM_MATCH', currency)

        # 4. Check Branch-specific fee
        if branch:
            branch_fee = next((f for f in active_fees if f.applies_to == 'BRANCH' and f.branch_id == branch.id), None)
            if branch_fee:
                return cls._format_fee_dict(branch_fee, 'BRANCH_MATCH', currency)

        # 5. Check Daycare-wide fee
        all_fee = next((f for f in active_fees if f.applies_to == 'ALL'), None)
        if all_fee:
            return cls._format_fee_dict(all_fee, 'DAYCARE_DEFAULT', currency)

        return None

    @staticmethod
    def _format_fee_dict(fee: FeeStructure, source: str, default_currency: str) -> Dict[str, Any]:
        return {
            'source': source,
            'assignment_id': None,
            'fee_structure_id': str(fee.id),
            'fee_name': fee.name,
            'fee_type': fee.fee_type,
            'frequency': fee.frequency,
            'base_amount': quantize_money(fee.amount),
            'custom_amount': None,
            'discount_percentage': Decimal('0.00'),
            'effective_amount': quantize_money(fee.amount),
            'currency': fee.currency or default_currency,
            'effective_from': fee.effective_from,
            'effective_until': fee.effective_until,
        }

    @classmethod
    def calculate_prorated_monthly_fee(
        cls,
        monthly_amount: Decimal,
        start_date: date,
        end_date: Optional[date] = None,
        year: Optional[int] = None,
        month: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Calculates exact prorated amount for partial month attendance.
        Uses exact calendar day division: (enrolled_days / days_in_month) * monthly_amount.
        """
        monthly_amount = quantize_money(monthly_amount)
        target_year = year or start_date.year
        target_month = month or start_date.month

        days_in_month = calendar.monthrange(target_year, target_month)[1]
        month_start = date(target_year, target_month, 1)
        month_end = date(target_year, target_month, days_in_month)

        effective_start = max(start_date, month_start)
        effective_end = min(end_date, month_end) if end_date else month_end

        if effective_start > month_end or effective_end < month_start or effective_start > effective_end:
            enrolled_days = 0
        else:
            enrolled_days = (effective_end - effective_start).days + 1

        if enrolled_days >= days_in_month:
            prorated_amount = monthly_amount
            is_prorated = False
        else:
            ratio = Decimal(str(enrolled_days)) / Decimal(str(days_in_month))
            prorated_amount = quantize_money(monthly_amount * ratio)
            is_prorated = True

        return {
            'monthly_base': monthly_amount,
            'days_in_month': days_in_month,
            'enrolled_days': enrolled_days,
            'effective_start': effective_start,
            'effective_end': effective_end,
            'is_prorated': is_prorated,
            'prorated_amount': prorated_amount
        }

    @classmethod
    def calculate_sibling_discount(
        cls,
        base_amount: Decimal,
        sibling_count_in_daycare: int,
        sibling_discount_percentage: Decimal = Decimal('10.00')
    ) -> Dict[str, Any]:
        """
        Calculates sibling discount. Typically applied to the 2nd, 3rd child etc.
        If sibling_count_in_daycare > 1, applies discount percentage.
        """
        base_amount = quantize_money(base_amount)
        disc_pct = Decimal(str(sibling_discount_percentage))
        
        if sibling_count_in_daycare > 1 and disc_pct > Decimal('0.00'):
            discount_amount = quantize_money(base_amount * (disc_pct / Decimal('100.00')))
            final_amount = quantize_money(base_amount - discount_amount)
            has_discount = True
        else:
            discount_amount = Decimal('0.00')
            final_amount = base_amount
            has_discount = False

        return {
            'base_amount': base_amount,
            'sibling_count': sibling_count_in_daycare,
            'discount_percentage': disc_pct,
            'discount_amount': discount_amount,
            'final_amount': final_amount,
            'has_discount': has_discount
        }

    @classmethod
    @transaction.atomic
    def record_or_check_registration_fee(
        cls,
        daycare: Daycare,
        student: Student,
        fee_structure: FeeStructure,
        actor: Optional[User] = None,
        notes: str = ""
    ) -> Dict[str, Any]:
        """
        Ensures a registration fee record exists for a child while strictly preventing
        duplicate charges.
        """
        currency = cls.get_daycare_currency(daycare)
        existing = RegistrationFeeRecord.objects.filter(
            daycare=daycare,
            student=student,
            fee_structure=fee_structure
        ).first()

        if existing:
            return {
                'created': False,
                'already_exists': True,
                'record': existing,
                'status': existing.status,
                'amount': quantize_money(existing.amount),
                'currency': existing.currency,
                'message': f"Registration fee record already exists with status: {existing.status}"
            }

        enrollment = ClassroomStudent.objects.filter(student=student, status='Active').first()
        family_child = student.child_families.first()
        family = family_child.family if family_child else None

        record = RegistrationFeeRecord.objects.create(
            daycare=daycare,
            student=student,
            enrollment=enrollment,
            family=family,
            fee_structure=fee_structure,
            amount=quantize_money(fee_structure.amount),
            currency=fee_structure.currency or currency,
            status='PENDING',
            notes=notes,
            created_by=actor
        )

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='CREATE_REGISTRATION_FEE_RECORD',
            module='Billing & Invoicing',
            entity_type='RegistrationFeeRecord',
            entity_id=str(record.id),
            new_values={
                'student_id': str(student.id),
                'fee_structure_id': str(fee_structure.id),
                'amount': str(record.amount),
                'currency': record.currency,
                'status': record.status,
            }
        )

        return {
            'created': True,
            'already_exists': False,
            'record': record,
            'status': record.status,
            'amount': quantize_money(record.amount),
            'currency': record.currency,
            'message': "Registration fee record created successfully."
        }

    @classmethod
    @transaction.atomic
    def process_deposit_action(
        cls,
        deposit_record: DepositRecord,
        action_type: str,
        amount: Decimal,
        actor: Optional[User] = None,
        notes: str = ""
    ) -> Dict[str, Any]:
        """
        Transitions deposit lifecycle:
        - RECEIVE_DEPOSIT: moves charged -> held in trust
        - APPLY_TO_BILLING: applies held deposit towards childcare fees
        - REFUND_DEPOSIT: refunds held deposit to family
        - FORFEIT_DEPOSIT: marks deposit forfeited
        """
        amount = quantize_money(amount)
        if amount <= Decimal('0.00'):
            raise ValueError("Action amount must be strictly greater than 0.00")

        old_state = {
            'status': deposit_record.status,
            'amount_charged': str(deposit_record.amount_charged),
            'amount_held': str(deposit_record.amount_held),
            'amount_applied': str(deposit_record.amount_applied),
            'amount_refunded': str(deposit_record.amount_refunded),
            'amount_forfeited': str(deposit_record.amount_forfeited),
        }

        if action_type == 'RECEIVE_DEPOSIT':
            deposit_record.amount_held = quantize_money(Decimal(str(deposit_record.amount_held)) + amount)
            deposit_record.received_date = date.today()
            deposit_record.status = 'HELD'

        elif action_type == 'APPLY_TO_BILLING':
            remaining = deposit_record.remaining_held
            if amount > remaining:
                raise ValueError(f"Cannot apply {amount}; only {remaining} remaining held in deposit.")
            deposit_record.amount_applied = quantize_money(Decimal(str(deposit_record.amount_applied)) + amount)
            if deposit_record.remaining_held == Decimal('0.00'):
                deposit_record.status = 'FULLY_APPLIED'
            else:
                deposit_record.status = 'PARTIALLY_APPLIED'

        elif action_type == 'REFUND_DEPOSIT':
            remaining = deposit_record.remaining_held
            if amount > remaining:
                raise ValueError(f"Cannot refund {amount}; only {remaining} remaining held in deposit.")
            deposit_record.amount_refunded = quantize_money(Decimal(str(deposit_record.amount_refunded)) + amount)
            if deposit_record.remaining_held == Decimal('0.00'):
                deposit_record.status = 'REFUNDED'
            else:
                deposit_record.status = 'PARTIALLY_REFUNDED'

        elif action_type == 'FORFEIT_DEPOSIT':
            remaining = deposit_record.remaining_held
            if amount > remaining:
                raise ValueError(f"Cannot forfeit {amount}; only {remaining} remaining held in deposit.")
            deposit_record.amount_forfeited = quantize_money(Decimal(str(deposit_record.amount_forfeited)) + amount)
            deposit_record.status = 'FORFEITED'
        else:
            raise ValueError(f"Unsupported deposit action: {action_type}")

        if notes:
            deposit_record.notes = (deposit_record.notes or "") + f"\n[{timezone.now().strftime('%Y-%m-%d %H:%M')}] {action_type}: {notes}"

        deposit_record.updated_by = actor
        deposit_record.save()

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action=f'DEPOSIT_{action_type}',
            module='Billing & Invoicing',
            entity_type='DepositRecord',
            entity_id=str(deposit_record.id),
            old_values=old_state,
            new_values={
                'status': deposit_record.status,
                'amount_charged': str(deposit_record.amount_charged),
                'amount_held': str(deposit_record.amount_held),
                'amount_applied': str(deposit_record.amount_applied),
                'amount_refunded': str(deposit_record.amount_refunded),
                'amount_forfeited': str(deposit_record.amount_forfeited),
                'action_amount': str(amount),
            }
        )

        return {
            'success': True,
            'deposit_id': str(deposit_record.id),
            'status': deposit_record.status,
            'amount_held': deposit_record.amount_held,
            'amount_applied': deposit_record.amount_applied,
            'amount_refunded': deposit_record.amount_refunded,
            'amount_forfeited': deposit_record.amount_forfeited,
            'remaining_held': deposit_record.remaining_held,
        }

    @classmethod
    @transaction.atomic
    def create_new_fee_version(
        cls,
        existing_fee: FeeStructure,
        new_amount: Decimal,
        effective_from: date,
        actor: Optional[User] = None,
        notes: str = ""
    ) -> FeeStructure:
        """
        Creates a new version of an existing fee structure for historical pricing preservation.
        Caps the old fee's effective_until to effective_from - 1 day, and links new version.
        """
        from datetime import timedelta
        new_amount = quantize_money(new_amount)

        if effective_from <= existing_fee.effective_from:
            raise ValueError(f"New version effective date ({effective_from}) must be strictly after the current version's start date ({existing_fee.effective_from}).")

        # Cap previous version
        existing_fee.effective_until = effective_from - timedelta(days=1)
        existing_fee.updated_by = actor
        existing_fee.save()

        # Create new version
        root_parent = existing_fee.parent_fee or existing_fee
        new_version = FeeStructure.objects.create(
            daycare=existing_fee.daycare,
            branch=existing_fee.branch,
            program=existing_fee.program,
            classroom=existing_fee.classroom,
            name=existing_fee.name,
            description=notes or existing_fee.description,
            fee_type=existing_fee.fee_type,
            frequency=existing_fee.frequency,
            amount=new_amount,
            currency=existing_fee.currency,
            effective_from=effective_from,
            effective_until=None,
            is_active=True,
            applies_to=existing_fee.applies_to,
            version=existing_fee.version + 1,
            parent_fee=root_parent,
            created_by=actor,
            updated_by=actor
        )

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='CREATE_FEE_STRUCTURE_VERSION',
            module='Billing & Invoicing',
            entity_type='FeeStructure',
            entity_id=str(new_version.id),
            old_values={
                'fee_id': str(existing_fee.id),
                'amount': str(existing_fee.amount),
                'effective_until': str(existing_fee.effective_until),
            },
            new_values={
                'fee_id': str(new_version.id),
                'amount': str(new_version.amount),
                'version': new_version.version,
                'effective_from': str(new_version.effective_from),
            }
        )

        return new_version

    # =========================================================================
    # PHASE 2: DISCOUNT RESOLUTION & VERSIONING
    # =========================================================================

    @classmethod
    def resolve_discounts_for_student(
        cls,
        student: Student,
        target_date: Optional[date] = None,
        base_amount: Optional[Decimal] = None,
        fee_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Resolves all applicable standard discounts for a student on target_date.
        Evaluates scoping rules (STUDENT, FAMILY, ENROLLMENT, CLASSROOM, PROGRAM, BRANCH, FEE_TYPE, ALL).
        Calculates fixed or percentage amounts, capping total discount at base_amount.
        """
        if target_date is None:
            target_date = date.today()

        daycare = student.daycare
        currency = cls.get_daycare_currency(daycare)

        if base_amount is None:
            fee_res = cls.resolve_effective_fee_for_student(student, target_date, fee_type)
            base_amount = fee_res['effective_amount'] if fee_res else Decimal('0.00')
        else:
            base_amount = quantize_money(base_amount)

        enrollment = ClassroomStudent.objects.filter(student=student, status='Active').select_related('classroom', 'classroom__program').first()
        classroom = enrollment.classroom if enrollment else None
        program = classroom.program if classroom else None
        branch = student.branch or (classroom.branch if classroom else None)
        family_child = student.child_families.first()
        family = family_child.family if family_child else None

        active_rules = DiscountRule.objects.filter(
            daycare=daycare,
            is_active=True,
            effective_from__lte=target_date
        ).order_by('priority', '-value')

        matched_discounts = []
        running_discount = Decimal('0.00')

        for rule in active_rules:
            if rule.effective_until and target_date > rule.effective_until:
                continue
            if rule.target_fee_type and fee_type and rule.target_fee_type != fee_type:
                continue

            applies = False
            scope = rule.applies_to

            if scope == 'ALL':
                applies = True
            elif scope == 'STUDENT' and rule.student_id == student.id:
                applies = True
            elif scope == 'FAMILY' and family and rule.family_id == family.id:
                applies = True
            elif scope == 'ENROLLMENT' and enrollment and rule.enrollment_id == enrollment.id:
                applies = True
            elif scope == 'CLASSROOM' and classroom and rule.classroom_id == classroom.id:
                applies = True
            elif scope == 'PROGRAM' and program and rule.program_id == program.id:
                applies = True
            elif scope == 'BRANCH' and branch and rule.branch_id == branch.id:
                applies = True
            elif scope == 'FEE_TYPE' and fee_type and rule.target_fee_type == fee_type:
                applies = True

            if applies:
                if rule.discount_type == 'PERCENTAGE':
                    disc_amount = quantize_money(base_amount * (Decimal(str(rule.value)) / Decimal('100.00')))
                else:  # FIXED
                    disc_amount = quantize_money(Decimal(str(rule.value)))

                # Ensure individual discount cannot exceed base amount
                disc_amount = min(disc_amount, base_amount)

                # Cap so total cumulative discounts don't exceed base amount
                allowed_amount = min(disc_amount, max(Decimal('0.00'), base_amount - running_discount))
                if allowed_amount > Decimal('0.00'):
                    matched_discounts.append({
                        'rule_id': str(rule.id),
                        'name': rule.name,
                        'scope': scope,
                        'discount_type': rule.discount_type,
                        'value': Decimal(str(rule.value)),
                        'calculated_amount': allowed_amount,
                        'currency': rule.currency or currency,
                    })
                    running_discount += allowed_amount

        net_amount = max(Decimal('0.00'), base_amount - running_discount)

        return {
            'student_id': str(student.id),
            'student_name': f"{student.first_name} {student.last_name}",
            'base_amount': base_amount,
            'currency': currency,
            'discounts': matched_discounts,
            'total_discount': quantize_money(running_discount),
            'net_amount_after_discounts': quantize_money(net_amount),
        }

    @classmethod
    @transaction.atomic
    def create_new_discount_version(
        cls,
        existing_rule: DiscountRule,
        new_value: Decimal,
        effective_from: date,
        actor: Optional[User] = None,
        notes: str = ""
    ) -> DiscountRule:
        """
        Creates a new version of an existing discount rule for historical traceability.
        Caps previous version's effective_until.
        """
        from datetime import timedelta
        new_value = quantize_money(new_value)

        if effective_from <= existing_rule.effective_from:
            raise ValueError(f"New version effective date ({effective_from}) must be strictly after the current version's start date ({existing_rule.effective_from}).")

        existing_rule.effective_until = effective_from - timedelta(days=1)
        existing_rule.updated_by = actor
        existing_rule.save()

        root_parent = existing_rule.parent_rule or existing_rule
        new_version = DiscountRule.objects.create(
            daycare=existing_rule.daycare,
            branch=existing_rule.branch,
            program=existing_rule.program,
            classroom=existing_rule.classroom,
            family=existing_rule.family,
            student=existing_rule.student,
            enrollment=existing_rule.enrollment,
            name=existing_rule.name,
            description=notes or existing_rule.description,
            discount_type=existing_rule.discount_type,
            value=new_value,
            currency=existing_rule.currency,
            applies_to=existing_rule.applies_to,
            target_fee_type=existing_rule.target_fee_type,
            eligibility_criteria=existing_rule.eligibility_criteria,
            priority=existing_rule.priority,
            effective_from=effective_from,
            effective_until=None,
            is_active=True,
            version=existing_rule.version + 1,
            parent_rule=root_parent,
            created_by=actor,
            updated_by=actor
        )

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='CREATE_DISCOUNT_RULE_VERSION',
            module='Billing & Invoicing',
            entity_type='DiscountRule',
            entity_id=str(new_version.id),
            old_values={
                'rule_id': str(existing_rule.id),
                'value': str(existing_rule.value),
                'effective_until': str(existing_rule.effective_until),
            },
            new_values={
                'rule_id': str(new_version.id),
                'value': str(new_version.value),
                'version': new_version.version,
                'effective_from': str(new_version.effective_from),
            }
        )

        return new_version

    # =========================================================================
    # PHASE 2: SIBLING DISCOUNT ENGINE & VERSIONING
    # =========================================================================

    @classmethod
    def resolve_sibling_discounts_for_family(
        cls,
        family: Family,
        daycare: Daycare,
        target_date: Optional[date] = None,
        student_fee_map: Optional[Dict[str, Decimal]] = None
    ) -> Dict[str, Any]:
        """
        Calculates sibling discounts for a family based on actual FamilyChild relationships.
        Evaluates configurable SiblingDiscountRule (SECOND_CHILD, SUBSEQUENT_CHILDREN, ALL_SIBLINGS, LOWEST_FEE, etc.).
        """
        if target_date is None:
            target_date = date.today()

        currency = cls.get_daycare_currency(daycare)

        # 1. Fetch all children belonging to this family in this daycare
        family_children_links = FamilyChild.objects.filter(
            family=family,
            student__daycare=daycare
        ).select_related('student')

        students = [fc.student for fc in family_children_links if fc.student.status != 'Archived']
        if student_fee_map is not None:
            students = [s for s in students if (str(s.id) in student_fee_map or s.id in student_fee_map)]

        # Determine fee for each student
        student_items = []
        for s in students:
            if student_fee_map and str(s.id) in student_fee_map:
                base_fee = quantize_money(student_fee_map[str(s.id)])
            elif student_fee_map and s.id in student_fee_map:
                base_fee = quantize_money(student_fee_map[s.id])
            else:
                fee_res = cls.resolve_effective_fee_for_student(s, target_date)
                base_fee = fee_res['effective_amount'] if fee_res else Decimal('0.00')

            enrollment = ClassroomStudent.objects.filter(student=s, status='Active').first()
            start_date = enrollment.start_date if enrollment and enrollment.start_date else (s.admission_date or s.joining_date or date(2000, 1, 1))

            student_items.append({
                'student': s,
                'student_id': str(s.id),
                'student_name': f"{s.first_name} {s.last_name}",
                'dob': s.dob or date(2000, 1, 1),
                'start_date': start_date,
                'base_fee': base_fee,
                'enrollment': enrollment
            })

        sibling_count = len(student_items)

        # Fetch active SiblingDiscountRule for daycare
        rule_qs = SiblingDiscountRule.objects.filter(
            daycare=daycare,
            is_active=True,
            effective_from__lte=target_date
        ).order_by('-effective_from')

        active_rule = next((r for r in rule_qs if not r.effective_until or r.effective_until >= target_date), None)

        if not active_rule or sibling_count < active_rule.min_enrolled_siblings:
            return {
                'family_id': str(family.id),
                'family_name': family.family_name,
                'has_sibling_discount': False,
                'sibling_count': sibling_count,
                'rule_applied': None,
                'total_sibling_discount': Decimal('0.00'),
                'currency': currency,
                'discounts_by_student': {item['student_id']: Decimal('0.00') for item in student_items},
                'student_breakdowns': []
            }

        # Order siblings according to rule criteria
        if active_rule.ordering_criteria in ['AGE_DESCENDING', 'ELDEST_FIRST', 'OLDEST_FIRST']:
            # Eldest first (earliest DOB first)
            student_items.sort(key=lambda x: (x['dob'], x['start_date']))
        elif active_rule.ordering_criteria in ['FEE_DESCENDING', 'HIGHEST_FEE']:
            # Highest fee first
            student_items.sort(key=lambda x: -x['base_fee'])
        elif active_rule.ordering_criteria == 'ENROLLMENT_DATE':
            student_items.sort(key=lambda x: (x['start_date'], x['dob']))
        else:
            student_items.sort(key=lambda x: x['dob'])

        # Determine eligible indices based on applies_to_target and target_fee_selection
        eligible_indices = set()

        if active_rule.target_fee_selection == 'LOWEST_FEE' and active_rule.applies_to_target in ['SECOND_CHILD', 'SECOND_CHILD_ONWARDS', 'SUBSEQUENT_CHILDREN']:
            # Find index of child with lowest base fee
            lowest_idx = min(range(len(student_items)), key=lambda i: student_items[i]['base_fee'])
            eligible_indices.add(lowest_idx)
        elif active_rule.applies_to_target == 'SECOND_CHILD':
            if len(student_items) >= 2:
                eligible_indices.add(1)  # 2nd child
        elif active_rule.applies_to_target in ['SUBSEQUENT_CHILDREN', 'SECOND_CHILD_ONWARDS', 'SECOND_CHILD_AND_SUBSEQUENT']:
            # 2nd, 3rd, 4th... child (index >= 1)
            for i in range(1, len(student_items)):
                eligible_indices.add(i)
        elif active_rule.applies_to_target in ['ALL_SIBLINGS', 'ALL']:
            for i in range(len(student_items)):
                eligible_indices.add(i)
        else:
            # Default to second child onwards if more than 1
            for i in range(1, len(student_items)):
                eligible_indices.add(i)

        discounts_by_student = {}
        student_breakdowns = []
        total_sibling_discount = Decimal('0.00')

        for idx, item in enumerate(student_items):
            s_id = item['student_id']
            base_fee = item['base_fee']
            is_eligible = idx in eligible_indices

            if is_eligible and active_rule.value > Decimal('0.00'):
                if active_rule.discount_type == 'PERCENTAGE':
                    disc = quantize_money(base_fee * (Decimal(str(active_rule.value)) / Decimal('100.00')))
                else:
                    disc = min(quantize_money(Decimal(str(active_rule.value))), base_fee)
            else:
                disc = Decimal('0.00')

            discounts_by_student[s_id] = disc
            total_sibling_discount += disc

            student_breakdowns.append({
                'student_id': s_id,
                'student_name': item['student_name'],
                'sibling_order_index': idx + 1,
                'dob': item['dob'],
                'base_fee': base_fee,
                'is_eligible_for_sibling_discount': is_eligible,
                'sibling_discount_amount': disc,
                'net_fee_after_sibling_discount': quantize_money(base_fee - disc)
            })

        return {
            'family_id': str(family.id),
            'family_name': family.family_name,
            'has_sibling_discount': total_sibling_discount > Decimal('0.00'),
            'sibling_count': sibling_count,
            'rule_applied': {
                'rule_id': str(active_rule.id),
                'name': active_rule.name,
                'discount_type': active_rule.discount_type,
                'value': Decimal(str(active_rule.value)),
                'applies_to_target': active_rule.applies_to_target,
                'target_fee_selection': active_rule.target_fee_selection,
                'ordering_criteria': active_rule.ordering_criteria,
            },
            'total_sibling_discount': quantize_money(total_sibling_discount),
            'currency': currency,
            'discounts_by_student': discounts_by_student,
            'student_breakdowns': student_breakdowns
        }

    @classmethod
    @transaction.atomic
    def create_new_sibling_discount_version(
        cls,
        existing_rule: SiblingDiscountRule,
        new_value: Decimal,
        effective_from: date,
        actor: Optional[User] = None,
        notes: str = ""
    ) -> SiblingDiscountRule:
        """
        Creates a new version of an existing sibling discount rule for historical traceability.
        """
        from datetime import timedelta
        new_value = quantize_money(new_value)

        if effective_from <= existing_rule.effective_from:
            raise ValueError(f"New version effective date ({effective_from}) must be strictly after the current version's start date ({existing_rule.effective_from}).")

        existing_rule.effective_until = effective_from - timedelta(days=1)
        existing_rule.updated_by = actor
        existing_rule.save()

        root_parent = existing_rule.parent_rule or existing_rule
        new_version = SiblingDiscountRule.objects.create(
            daycare=existing_rule.daycare,
            name=existing_rule.name,
            description=notes or existing_rule.description,
            discount_type=existing_rule.discount_type,
            value=new_value,
            currency=existing_rule.currency,
            applies_to_target=existing_rule.applies_to_target,
            target_fee_selection=existing_rule.target_fee_selection,
            ordering_criteria=existing_rule.ordering_criteria,
            min_enrolled_siblings=existing_rule.min_enrolled_siblings,
            effective_from=effective_from,
            effective_until=None,
            is_active=True,
            version=existing_rule.version + 1,
            parent_rule=root_parent,
            created_by=actor,
            updated_by=actor
        )

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='CREATE_SIBLING_DISCOUNT_VERSION',
            module='Billing & Invoicing',
            entity_type='SiblingDiscountRule',
            entity_id=str(new_version.id),
            old_values={
                'rule_id': str(existing_rule.id),
                'value': str(existing_rule.value),
                'effective_until': str(existing_rule.effective_until),
            },
            new_values={
                'rule_id': str(new_version.id),
                'value': str(new_version.value),
                'version': new_version.version,
                'effective_from': str(new_version.effective_from),
            }
        )

        return new_version

    # =========================================================================
    # PHASE 2: CREDIT LEDGER ENGINE
    # =========================================================================

    @classmethod
    def get_family_credit_balance(cls, family: Family, daycare: Optional[Daycare] = None) -> Decimal:
        """
        Deterministically calculates a family's available credit balance from immutable ledger entries.
        Balance = (CREDIT + Positive CREDIT_ADJUSTMENT) - (CREDIT_APPLIED + Negative CREDIT_ADJUSTMENT + CREDIT_REVERSAL)
        """
        qs = CreditTransaction.objects.filter(family=family, status='ACTIVE')
        if daycare:
            qs = qs.filter(daycare=daycare)

        total_credit = Decimal('0.00')
        total_applied = Decimal('0.00')

        for tx in qs:
            amt = Decimal(str(tx.amount))
            if tx.transaction_type == 'CREDIT':
                total_credit += amt
            elif tx.transaction_type == 'CREDIT_APPLIED':
                total_applied += amt
            elif tx.transaction_type == 'CREDIT_REVERSAL':
                total_applied += amt
            elif tx.transaction_type == 'CREDIT_ADJUSTMENT':
                if amt >= 0:
                    total_credit += amt
                else:
                    total_applied += abs(amt)

        available_balance = max(Decimal('0.00'), total_credit - total_applied)
        return quantize_money(available_balance)

    @classmethod
    @transaction.atomic
    def grant_family_credit(
        cls,
        daycare: Daycare,
        family: Family,
        amount: Decimal,
        reason: str,
        transaction_type: str = 'CREDIT',
        student: Optional[Student] = None,
        enrollment: Optional[ClassroomStudent] = None,
        reference: Optional[str] = None,
        actor: Optional[User] = None,
        notes: str = ""
    ) -> CreditTransaction:
        """
        Grants customer / family credit into the immutable credit ledger.
        Examples: overpayment, service adjustment, compensation, previous balance.
        """
        amount = quantize_money(amount)
        if amount <= Decimal('0.00'):
            raise ValueError("Credit amount must be strictly greater than 0.00.")

        currency = cls.get_daycare_currency(daycare)

        tx = CreditTransaction.objects.create(
            daycare=daycare,
            family=family,
            student=student,
            enrollment=enrollment,
            amount=amount,
            currency=currency,
            transaction_type=transaction_type,
            reason=reason,
            reference=reference,
            notes=notes,
            status='ACTIVE',
            created_by=actor
        )

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='GRANT_FAMILY_CREDIT',
            module='Billing & Invoicing',
            entity_type='CreditTransaction',
            entity_id=str(tx.id),
            new_values={
                'family_id': str(family.id),
                'family_name': family.family_name,
                'amount': str(tx.amount),
                'currency': tx.currency,
                'transaction_type': tx.transaction_type,
                'reason': tx.reason,
                'reference': tx.reference,
            }
        )

        return tx

    @classmethod
    @transaction.atomic
    def apply_family_credit(
        cls,
        daycare: Daycare,
        family: Family,
        amount: Decimal,
        reference: str,
        student: Optional[Student] = None,
        actor: Optional[User] = None,
        notes: str = ""
    ) -> CreditTransaction:
        """
        Applies available family credits towards billing / invoicing.
        Validates against current available credit balance.
        """
        amount = quantize_money(amount)
        if amount <= Decimal('0.00'):
            raise ValueError("Application amount must be strictly greater than 0.00.")

        current_balance = cls.get_family_credit_balance(family, daycare)
        if amount > current_balance:
            raise ValueError(f"Cannot apply {amount}; available credit balance is only {current_balance}.")

        currency = cls.get_daycare_currency(daycare)

        tx = CreditTransaction.objects.create(
            daycare=daycare,
            family=family,
            student=student,
            amount=amount,
            currency=currency,
            transaction_type='CREDIT_APPLIED',
            reason=f"Applied towards {reference}",
            reference=reference,
            notes=notes,
            status='ACTIVE',
            created_by=actor
        )

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='APPLY_FAMILY_CREDIT',
            module='Billing & Invoicing',
            entity_type='CreditTransaction',
            entity_id=str(tx.id),
            new_values={
                'family_id': str(family.id),
                'amount': str(tx.amount),
                'reference': reference,
                'remaining_balance': str(cls.get_family_credit_balance(family, daycare)),
            }
        )

        return tx

    @classmethod
    @transaction.atomic
    def reverse_family_credit(
        cls,
        credit_transaction: CreditTransaction,
        reason: str,
        actor: Optional[User] = None
    ) -> CreditTransaction:
        """
        Reverses a previously granted credit or adjustment.
        Maintains immutable transaction history by issuing a CREDIT_REVERSAL transaction.
        """
        if credit_transaction.status != 'ACTIVE':
            raise ValueError(f"Cannot reverse transaction with status: {credit_transaction.status}.")

        if credit_transaction.transaction_type == 'CREDIT_REVERSAL':
            raise ValueError("Cannot reverse a reversal transaction.")

        family = credit_transaction.family
        daycare = credit_transaction.daycare

        if credit_transaction.transaction_type in ['CREDIT', 'CREDIT_ADJUSTMENT']:
            balance = cls.get_family_credit_balance(family, daycare)
            if balance < credit_transaction.amount:
                raise ValueError(f"Cannot reverse credit of {credit_transaction.amount}; family has already applied credits and available balance is only {balance}.")

        reversal_tx = CreditTransaction.objects.create(
            daycare=daycare,
            family=family,
            student=credit_transaction.student,
            enrollment=credit_transaction.enrollment,
            amount=credit_transaction.amount,
            currency=credit_transaction.currency,
            transaction_type='CREDIT_REVERSAL',
            reason=reason or f"Reversal of transaction {credit_transaction.id}",
            reference=credit_transaction.reference,
            notes=f"Reversed original TX {credit_transaction.id}",
            status='ACTIVE',
            reversed_transaction=credit_transaction,
            created_by=actor
        )

        credit_transaction.status = 'REVERSED'
        credit_transaction.save()

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='REVERSE_FAMILY_CREDIT',
            module='Billing & Invoicing',
            entity_type='CreditTransaction',
            entity_id=str(reversal_tx.id),
            new_values={
                'original_tx_id': str(credit_transaction.id),
                'reversed_amount': str(reversal_tx.amount),
                'reason': reason,
                'family_id': str(family.id),
            }
        )

        return reversal_tx

    # =========================================================================
    # PHASE 2: LATE FEE ENGINE & VERSIONING
    # =========================================================================

    @classmethod
    def calculate_late_fee(
        cls,
        daycare: Daycare,
        due_date: date,
        overdue_balance: Decimal,
        evaluation_date: Optional[date] = None,
        rule: Optional[LateFeeRule] = None,
        already_applied_fee: Optional[Decimal] = None
    ) -> Dict[str, Any]:
        """
        Calculates applicable late fee for an overdue invoice / balance.
        Strictly enforces grace period (no fee before due_date + grace_period_days).
        Prevents duplicate charges and honors max_amount cap.
        """
        if evaluation_date is None:
            evaluation_date = date.today()

        overdue_balance = quantize_money(overdue_balance)
        currency = cls.get_daycare_currency(daycare)

        if overdue_balance <= Decimal('0.00') or evaluation_date <= due_date:
            return {
                'has_late_fee': False,
                'late_fee_amount': Decimal('0.00'),
                'is_overdue': False,
                'days_overdue': 0,
                'within_grace_period': True,
                'grace_period_days': 0,
                'rule_applied': None,
                'currency': currency,
                'message': "Balance is not overdue."
            }

        days_overdue = (evaluation_date - due_date).days

        # Fetch active late fee rule if not provided
        if rule is None:
            rule_qs = LateFeeRule.objects.filter(
                daycare=daycare,
                is_active=True
            ).filter(
                models.Q(effective_from__isnull=True) | models.Q(effective_from__lte=evaluation_date)
            ).order_by('-effective_from')
            rule = next((r for r in rule_qs if not r.effective_until or r.effective_until >= evaluation_date), None)
            if not rule:
                rule = LateFeeRule.objects.filter(daycare=daycare, is_active=True).first()

        if not rule:
            return {
                'has_late_fee': False,
                'late_fee_amount': Decimal('0.00'),
                'is_overdue': True,
                'days_overdue': days_overdue,
                'within_grace_period': False,
                'grace_period_days': 0,
                'rule_applied': None,
                'currency': currency,
                'message': "No active late fee rule configured for daycare."
            }

        # Check grace period
        if days_overdue <= rule.grace_period_days:
            return {
                'has_late_fee': False,
                'late_fee_amount': Decimal('0.00'),
                'is_overdue': True,
                'days_overdue': days_overdue,
                'within_grace_period': True,
                'grace_period_days': rule.grace_period_days,
                'rule_applied': {
                    'rule_id': str(rule.id),
                    'name': rule.name,
                    'grace_period_days': rule.grace_period_days,
                },
                'currency': currency,
                'message': f"Within grace period ({days_overdue}/{rule.grace_period_days} days)."
            }

        days_past_grace = days_overdue - rule.grace_period_days

        # Frequency & duplication logic
        if rule.frequency == 'ONE_TIME':
            if already_applied_fee and already_applied_fee > Decimal('0.00'):
                return {
                    'has_late_fee': False,
                    'late_fee_amount': Decimal('0.00'),
                    'is_overdue': True,
                    'days_overdue': days_overdue,
                    'within_grace_period': False,
                    'grace_period_days': rule.grace_period_days,
                    'rule_applied': {'rule_id': str(rule.id), 'name': rule.name},
                    'currency': currency,
                    'message': "One-time late fee already charged previously."
                }
            multiplier = 1
        elif rule.frequency == 'DAILY':
            multiplier = max(1, days_past_grace)
        elif rule.frequency == 'WEEKLY':
            multiplier = max(1, (days_past_grace + 6) // 7)
        elif rule.frequency == 'MONTHLY':
            multiplier = max(1, (days_past_grace + 29) // 30)
        else:
            multiplier = 1

        if rule.fee_type == 'PERCENTAGE':
            raw_fee = quantize_money(overdue_balance * (Decimal(str(rule.amount)) / Decimal('100.00')) * Decimal(str(multiplier)))
        else:  # FIXED
            raw_fee = quantize_money(Decimal(str(rule.amount)) * Decimal(str(multiplier)))

        # Apply maximum cap if configured
        if rule.max_amount and rule.max_amount > Decimal('0.00'):
            capped_fee = min(raw_fee, quantize_money(rule.max_amount))
        else:
            capped_fee = raw_fee

        return {
            'has_late_fee': capped_fee > Decimal('0.00'),
            'late_fee_amount': capped_fee,
            'is_overdue': True,
            'days_overdue': days_overdue,
            'days_past_grace': days_past_grace,
            'within_grace_period': False,
            'grace_period_days': rule.grace_period_days,
            'rule_applied': {
                'rule_id': str(rule.id),
                'name': rule.name,
                'fee_type': rule.fee_type,
                'rate': Decimal(str(rule.amount)),
                'frequency': rule.frequency,
                'max_amount': rule.max_amount,
            },
            'currency': currency,
            'message': f"Late fee calculated: {capped_fee} {currency}"
        }

    @classmethod
    @transaction.atomic
    def create_new_late_fee_version(
        cls,
        existing_rule: LateFeeRule,
        new_amount: Decimal,
        effective_from: date,
        actor: Optional[User] = None,
        notes: str = ""
    ) -> LateFeeRule:
        """
        Creates a new version of an existing late fee rule for historical traceability.
        """
        from datetime import timedelta
        new_amount = quantize_money(new_amount)

        if effective_from <= existing_rule.effective_from:
            raise ValueError(f"New version effective date ({effective_from}) must be strictly after the current version's start date ({existing_rule.effective_from}).")

        existing_rule.effective_until = effective_from - timedelta(days=1)
        existing_rule.updated_by = actor
        existing_rule.save()

        root_parent = existing_rule.parent_rule or existing_rule
        new_version = LateFeeRule.objects.create(
            daycare=existing_rule.daycare,
            name=existing_rule.name,
            description=notes or existing_rule.description,
            fee_type=existing_rule.fee_type,
            amount=new_amount,
            currency=existing_rule.currency,
            grace_period_days=existing_rule.grace_period_days,
            frequency=existing_rule.frequency,
            max_amount=existing_rule.max_amount,
            effective_from=effective_from,
            effective_until=None,
            is_active=True,
            version=existing_rule.version + 1,
            parent_rule=root_parent,
            created_by=actor,
            updated_by=actor
        )

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='CREATE_LATE_FEE_RULE_VERSION',
            module='Billing & Invoicing',
            entity_type='LateFeeRule',
            entity_id=str(new_version.id),
            old_values={
                'rule_id': str(existing_rule.id),
                'amount': str(existing_rule.amount),
                'effective_until': str(existing_rule.effective_until),
            },
            new_values={
                'rule_id': str(new_version.id),
                'amount': str(new_version.amount),
                'version': new_version.version,
                'effective_from': str(new_version.effective_from),
            }
        )

        return new_version

    # =========================================================================
    # PHASE 2: MASTER DETERMINISTIC BILLING CALCULATION ENGINE
    # =========================================================================

    @classmethod
    def calculate_student_billing_breakdown(
        cls,
        student: Student,
        target_date: Optional[date] = None,
        base_amount: Optional[Decimal] = None,
        fee_type: Optional[str] = None,
        due_date: Optional[date] = None,
        overdue_balance: Optional[Decimal] = None,
        evaluation_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Calculates itemized billing breakdown for a single student.
        Order: Base Fee + Applicable Charges - Standard Discounts + Late Fees = Net Due.
        """
        if target_date is None:
            target_date = date.today()

        daycare = student.daycare
        currency = cls.get_daycare_currency(daycare)

        if base_amount is None:
            fee_res = cls.resolve_effective_fee_for_student(student, target_date, fee_type)
            base_fee = fee_res['effective_amount'] if fee_res else Decimal('0.00')
            fee_source = fee_res['source'] if fee_res else 'NONE'
        else:
            base_fee = quantize_money(base_amount)
            fee_source = 'EXPLICIT_BASE'

        # Resolve standard discounts
        discount_res = cls.resolve_discounts_for_student(student, target_date, base_fee, fee_type)
        total_discount = discount_res['total_discount']
        net_after_discount = quantize_money(max(Decimal('0.00'), base_fee - total_discount))

        # Check late fee if applicable
        late_fee_res = None
        late_fee_amount = Decimal('0.00')
        if due_date and overdue_balance and overdue_balance > Decimal('0.00'):
            late_fee_res = cls.calculate_late_fee(daycare, due_date, overdue_balance, evaluation_date)
            late_fee_amount = late_fee_res['late_fee_amount']

        final_amount = quantize_money(net_after_discount + late_fee_amount)

        return {
            'student_id': str(student.id),
            'student_name': f"{student.first_name} {student.last_name}",
            'target_date': target_date,
            'currency': currency,
            'fee_source': fee_source,
            'base_fee': base_fee,
            'discounts': discount_res['discounts'],
            'total_discount': total_discount,
            'subtotal_after_discount': net_after_discount,
            'late_fee': late_fee_res,
            'late_fee_amount': late_fee_amount,
            'final_amount_due': final_amount,
        }

    @classmethod
    def calculate_family_billing_breakdown(
        cls,
        family: Family,
        daycare: Daycare,
        target_date: Optional[date] = None,
        target_students: Optional[List[Student]] = None,
        due_date: Optional[date] = None,
        apply_available_credits: bool = True,
        evaluation_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Master calculation engine for multi-child family billing.
        Deterministic order:
        1. Base Fees (per child)
        2. - Standard Discounts (per child)
        3. - Sibling Discounts (cross-family)
        4. = Family Subtotal After Discounts
        5. - Applied Credits (up to available credit balance in ledger)
        6. + Late Fees (if overdue past grace period)
        7. = Net Invoice / Prepared Calculation Amount
        """
        if target_date is None:
            target_date = date.today()

        currency = cls.get_daycare_currency(daycare)

        # 1. Identify enrolled children
        if target_students is None:
            family_links = FamilyChild.objects.filter(family=family, student__daycare=daycare).select_related('student')
            students = [fc.student for fc in family_links if fc.student.status != 'Archived']
        else:
            students = target_students

        child_breakdowns = []
        student_fee_map = {}
        total_base_fees = Decimal('0.00')
        total_standard_discounts = Decimal('0.00')

        for s in students:
            fee_res = cls.resolve_effective_fee_for_student(s, target_date)
            base_fee = fee_res['effective_amount'] if fee_res else Decimal('0.00')
            student_fee_map[str(s.id)] = base_fee
            total_base_fees += base_fee

            disc_res = cls.resolve_discounts_for_student(s, target_date, base_fee)
            total_standard_discounts += disc_res['total_discount']

            child_breakdowns.append({
                'student_id': str(s.id),
                'student_name': f"{s.first_name} {s.last_name}",
                'base_fee': base_fee,
                'fee_source': fee_res['source'] if fee_res else 'NONE',
                'standard_discounts': disc_res['discounts'],
                'standard_discount_amount': disc_res['total_discount'],
                'net_after_standard_discount': disc_res['net_amount_after_discounts'],
            })

        # 2. Sibling Discounts
        sibling_res = cls.resolve_sibling_discounts_for_family(family, daycare, target_date, student_fee_map)
        total_sibling_discount = sibling_res['total_sibling_discount']

        # Annotate sibling discount to each child
        for cb in child_breakdowns:
            s_id = cb['student_id']
            s_disc = sibling_res['discounts_by_student'].get(s_id, Decimal('0.00'))
            cb['sibling_discount_amount'] = s_disc
            child_net = max(Decimal('0.00'), cb['base_fee'] - cb['standard_discount_amount'] - s_disc)
            cb['child_final_subtotal'] = quantize_money(child_net)

        total_all_discounts = total_standard_discounts + total_sibling_discount
        subtotal_after_discounts = max(Decimal('0.00'), total_base_fees - total_all_discounts)

        # 3. Credits
        available_credit_balance = cls.get_family_credit_balance(family, daycare)
        if apply_available_credits and available_credit_balance > Decimal('0.00'):
            applied_credit = min(available_credit_balance, subtotal_after_discounts)
            remaining_credit = max(Decimal('0.00'), available_credit_balance - applied_credit)
        else:
            applied_credit = Decimal('0.00')
            remaining_credit = available_credit_balance

        net_after_credits = max(Decimal('0.00'), subtotal_after_discounts - applied_credit)

        # 4. Late Fees (evaluated on net_after_credits if due_date is passed and overdue)
        late_fee_res = None
        late_fee_amount = Decimal('0.00')
        if due_date and net_after_credits > Decimal('0.00'):
            late_fee_res = cls.calculate_late_fee(daycare, due_date, net_after_credits, evaluation_date)
            late_fee_amount = late_fee_res['late_fee_amount']

        final_net_amount = quantize_money(net_after_credits + late_fee_amount)

        return {
            'family_id': str(family.id),
            'family_name': family.family_name,
            'target_date': target_date,
            'currency': currency,
            'enrolled_children_count': len(students),
            'child_breakdowns': child_breakdowns,
            'summary': {
                'total_base_fees': quantize_money(total_base_fees),
                'total_standard_discounts': quantize_money(total_standard_discounts),
                'total_sibling_discounts': quantize_money(total_sibling_discount),
                'total_discounts': quantize_money(total_all_discounts),
                'subtotal_after_discounts': quantize_money(subtotal_after_discounts),
                'available_credit_balance': quantize_money(available_credit_balance),
                'applied_credits': quantize_money(applied_credit),
                'remaining_credit_balance': quantize_money(remaining_credit),
                'subtotal_after_credits': quantize_money(net_after_credits),
                'late_fee_amount': quantize_money(late_fee_amount),
                'final_invoice_amount': quantize_money(final_net_amount),
            },
            'sibling_discount_details': sibling_res,
            'late_fee_details': late_fee_res,
        }

    # =========================================================================
    # PHASE 3: INVOICE GENERATION, RECURRING BILLING & LIFECYCLE MANAGEMENT
    # =========================================================================

    @classmethod
    def generate_invoice_number(cls, daycare: Daycare, issue_date: Optional[date] = None) -> str:
        """
        Generates a unique, non-guessable, structured, permanent invoice number.
        Format: INV-{DAYCARE_PREFIX}-{YYYYMM}-{SEQUENCE:04d} (e.g. INV-SUN001-202609-0001)
        """
        if issue_date is None:
            issue_date = date.today()

        prefix_code = getattr(daycare, 'daycare_code', None) or str(daycare.name or 'DC')[:4].upper().replace(' ', '')
        if not prefix_code or len(prefix_code) < 2:
            prefix_code = str(daycare.id)[:6].upper()

        ym_str = issue_date.strftime('%Y%m')
        base_prefix = f"INV-{prefix_code}-{ym_str}-"

        # Count existing invoices with this pattern
        count = Invoice.objects.filter(daycare=daycare, invoice_number__startswith=base_prefix).count()
        seq = count + 1

        while True:
            candidate = f"{base_prefix}{seq:04d}"
            if not Invoice.objects.filter(daycare=daycare, invoice_number=candidate).exists():
                return candidate
            seq += 1

    @classmethod
    def calculate_attendance_based_fee(
        cls,
        student: Student,
        fee_structure: FeeStructure,
        period_start: date,
        period_end: date
    ) -> Dict[str, Any]:
        """
        Calculates childcare fees dynamically based on verified StudentAttendance records.
        Supports:
        - DAILY basis: counts verified present/late/early-pickup attendance days.
        - HOURLY basis: calculates actual checked-in billable hours from timesheets.
        - WEEKLY basis: computes weeks in service period.
        - MONTHLY basis: charges configured monthly rate.
        """
        fee_type = fee_structure.fee_type or fee_structure.frequency
        currency = fee_structure.currency or cls.get_daycare_currency(student.daycare)

        if fee_type == 'DAILY':
            attendances = StudentAttendance.objects.filter(
                student=student,
                attendance_date__range=(period_start, period_end),
                attendance_status__in=['PRESENT', 'LATE', 'EARLY_PICKUP']
            ).order_by('attendance_date')
            days_count = Decimal(str(attendances.count()))
            unit_price = quantize_money(fee_structure.amount)
            subtotal = quantize_money(days_count * unit_price)

            return {
                'basis': 'DAILY',
                'quantity': days_count,
                'units': days_count,
                'unit_price': unit_price,
                'rate': unit_price,
                'subtotal': subtotal,
                'amount': subtotal,
                'currency': currency,
                'attendance_meta': {
                    'days_present': int(days_count),
                    'period_start': str(period_start),
                    'period_end': str(period_end),
                    'dates': [str(a.attendance_date) for a in attendances]
                }
            }

        elif fee_type == 'HOURLY':
            attendances = StudentAttendance.objects.filter(
                student=student,
                attendance_date__range=(period_start, period_end),
                attendance_status__in=['PRESENT', 'LATE', 'EARLY_PICKUP']
            ).order_by('attendance_date')

            total_hours = Decimal('0.00')
            session_records = []

            for att in attendances:
                if att.check_in_time and att.check_out_time:
                    t_in = att.check_in_time
                    t_out = att.check_out_time
                    dt_in = datetime.combine(att.attendance_date, t_in)
                    dt_out = datetime.combine(att.attendance_date, t_out)
                    diff_seconds = max(0, (dt_out - dt_in).total_seconds())
                    hours = Decimal(str(diff_seconds / 3600.0)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
                else:
                    # Fallback to standard 8-hour day if checkin times are unrecorded
                    hours = Decimal('8.00')

                total_hours += hours
                session_records.append({
                    'date': str(att.attendance_date),
                    'hours': str(hours),
                    'check_in': str(att.check_in_time) if att.check_in_time else None,
                    'check_out': str(att.check_out_time) if att.check_out_time else None,
                })

            unit_price = quantize_money(fee_structure.amount)
            subtotal = quantize_money(total_hours * unit_price)

            return {
                'basis': 'HOURLY',
                'quantity': total_hours,
                'units': total_hours,
                'unit_price': unit_price,
                'rate': unit_price,
                'subtotal': subtotal,
                'amount': subtotal,
                'currency': currency,
                'attendance_meta': {
                    'total_hours': str(total_hours),
                    'sessions_count': len(session_records),
                    'period_start': str(period_start),
                    'period_end': str(period_end),
                    'sessions': session_records,
                }
            }

        elif fee_type == 'WEEKLY':
            days = (period_end - period_start).days + 1
            weeks = max(Decimal('1.00'), Decimal(str(days / 7.0)).quantize(TWOPLACES, rounding=ROUND_HALF_UP))
            unit_price = quantize_money(fee_structure.amount)
            subtotal = quantize_money(weeks * unit_price)

            return {
                'basis': 'WEEKLY',
                'quantity': weeks,
                'units': weeks,
                'unit_price': unit_price,
                'rate': unit_price,
                'subtotal': subtotal,
                'amount': subtotal,
                'currency': currency,
                'attendance_meta': {
                    'weeks': str(weeks),
                    'period_start': str(period_start),
                    'period_end': str(period_end)
                }
            }

        else: # MONTHLY / STANDARD
            unit_price = quantize_money(fee_structure.amount)
            return {
                'basis': 'MONTHLY',
                'quantity': Decimal('1.00'),
                'units': Decimal('1.00'),
                'unit_price': unit_price,
                'rate': unit_price,
                'subtotal': unit_price,
                'amount': unit_price,
                'currency': currency,
                'attendance_meta': {
                    'period_start': str(period_start),
                    'period_end': str(period_end)
                }
            }

    @classmethod
    @transaction.atomic
    def create_student_invoice(
        cls,
        daycare: Daycare,
        student: Student,
        issue_date: Optional[date] = None,
        due_date: Optional[date] = None,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None,
        billing_period_start: Optional[date] = None,
        billing_period_end: Optional[date] = None,
        fee_structure: Optional[FeeStructure] = None,
        custom_line_items: Optional[List[Dict[str, Any]]] = None,
        apply_credits: Optional[bool] = None,
        apply_available_credits: Optional[bool] = None,
        apply_deposits: Optional[bool] = None,
        apply_available_deposits: Optional[bool] = None,
        actor: Optional[User] = None,
        notes: str = "",
        invoice_type: str = 'STANDARD',
        recurring_profile: Optional[RecurringBillingProfile] = None,
        status: str = 'DRAFT'
    ) -> Invoice:
        """
        Creates an immutable, itemized single-child invoice with snapshot pricing and discounts.
        """
        from datetime import timedelta
        effective_start = billing_period_start or period_start or issue_date or date.today()
        effective_end = billing_period_end or period_end or due_date or (effective_start + timedelta(days=30))
        issue_date = issue_date or effective_start or date.today()
        due_date = due_date or (issue_date + timedelta(days=14))
        should_apply_credits = apply_available_credits if apply_available_credits is not None else (apply_credits if apply_credits is not None else False)
        should_apply_deposits = apply_available_deposits if apply_available_deposits is not None else (apply_deposits if apply_deposits is not None else False)

        fc = FamilyChild.objects.filter(student=student).first()
        family = fc.family if fc else None

        invoice_number = cls.generate_invoice_number(daycare, issue_date)
        currency = cls.get_daycare_currency(daycare)

        invoice = Invoice.objects.create(
            daycare=daycare,
            family=family,
            student=student,
            branch=student.branch,
            invoice_number=invoice_number,
            invoice_type=invoice_type,
            billing_period_start=effective_start,
            billing_period_end=effective_end,
            issue_date=issue_date,
            due_date=due_date,
            currency=currency,
            status=status,
            notes=notes,
            recurring_profile=recurring_profile,
            created_by=actor,
            updated_by=actor
        )

        # Build Line Items
        if custom_line_items:
            for item_data in custom_line_items:
                qty = Decimal(str(item_data.get('quantity', 1.0)))
                rate = Decimal(str(item_data.get('unit_price', 0.0)))
                item_subtotal = quantize_money(qty * rate)
                item_discount = quantize_money(Decimal(str(item_data.get('discount_amount', 0.0))))
                item_tax = quantize_money(Decimal(str(item_data.get('tax_amount', 0.0))))
                item_total = quantize_money(max(Decimal('0.00'), item_subtotal - item_discount + item_tax))

                InvoiceItem.objects.create(
                    invoice=invoice,
                    student=student,
                    fee_structure=item_data.get('fee_structure'),
                    fee_type_code=item_data.get('fee_type_code', 'CUSTOM'),
                    description=item_data.get('description', 'Childcare Charge'),
                    quantity=qty,
                    unit_price=rate,
                    subtotal=item_subtotal,
                    discount_amount=item_discount,
                    discount_description=item_data.get('discount_description', ''),
                    tax_amount=item_tax,
                    total=item_total,
                    service_period_start=item_data.get('service_period_start', effective_start),
                    service_period_end=item_data.get('service_period_end', effective_end),
                    attendance_basis_meta=item_data.get('attendance_basis_meta', {})
                )
        else:
            # Resolve fee structure
            if not fee_structure:
                resolved = cls.resolve_effective_fee_for_student(student, issue_date)
                base_amount = resolved['effective_amount'] if resolved else Decimal('0.00')
                fee_struct_obj = None
                if resolved:
                    if 'fee_structure' in resolved and resolved['fee_structure']:
                        fee_struct_obj = resolved['fee_structure']
                    elif resolved.get('fee_structure_id'):
                        fee_struct_obj = FeeStructure.objects.filter(id=resolved['fee_structure_id']).first()
            else:
                fee_struct_obj = fee_structure
                if effective_start and effective_end and fee_structure.fee_type in ['DAILY', 'HOURLY', 'WEEKLY']:
                    att_calc = cls.calculate_attendance_based_fee(student, fee_structure, effective_start, effective_end)
                    base_amount = att_calc['subtotal']
                else:
                    base_amount = quantize_money(fee_structure.amount)

            # Resolve discounts
            disc_res = cls.resolve_discounts_for_student(student, issue_date, base_amount)
            discount_amount = disc_res['total_discount']
            disc_desc = ", ".join([d['name'] for d in disc_res.get('discounts', [])])
            net_line_total = quantize_money(max(Decimal('0.00'), base_amount - discount_amount))

            InvoiceItem.objects.create(
                invoice=invoice,
                student=student,
                fee_structure=fee_struct_obj,
                fee_type_code=fee_struct_obj.fee_type if fee_struct_obj else 'MONTHLY',
                description=f"{fee_struct_obj.name if fee_struct_obj else 'Tuition'} - {student.first_name} {student.last_name}",
                quantity=Decimal('1.00'),
                unit_price=base_amount,
                subtotal=base_amount,
                discount_amount=discount_amount,
                discount_description=disc_desc,
                tax_amount=Decimal('0.00'),
                total=net_line_total,
                service_period_start=effective_start,
                service_period_end=effective_end
            )

        invoice.recalculate_totals(save=True)

        # Apply Available Credits if requested and family exists
        if should_apply_credits and family:
            avail_credit = cls.get_family_credit_balance(family, daycare)
            if avail_credit > Decimal('0.00') and invoice.balance_due > Decimal('0.00'):
                credit_to_apply = min(avail_credit, invoice.balance_due)
                cls.apply_credit_to_invoice(invoice, credit_to_apply, actor=actor, notes="Auto-applied available credit on invoice creation")

        # Apply Held Deposits if requested
        if should_apply_deposits and family:
            deposit_rec = DepositRecord.objects.filter(daycare=daycare, student=student, status__in=['HELD', 'PARTIALLY_APPLIED']).first()
            if deposit_rec and deposit_rec.remaining_held > Decimal('0.00') and invoice.balance_due > Decimal('0.00'):
                dep_to_apply = min(deposit_rec.remaining_held, invoice.balance_due)
                cls.apply_deposit_to_invoice(invoice, deposit_rec, dep_to_apply, actor=actor, notes="Auto-applied held deposit on invoice creation")

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='CREATE_INVOICE',
            module='Billing & Invoicing',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            new_values={
                'invoice_number': invoice.invoice_number,
                'student_id': str(student.id),
                'total_amount': str(invoice.total_amount),
                'balance_due': str(invoice.balance_due),
                'status': invoice.status,
            }
        )

        return invoice

    @classmethod
    @transaction.atomic
    def create_family_invoice(
        cls,
        daycare: Daycare,
        family: Family,
        issue_date: Optional[date] = None,
        due_date: Optional[date] = None,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None,
        billing_period_start: Optional[date] = None,
        billing_period_end: Optional[date] = None,
        target_students: Optional[List[Student]] = None,
        apply_credits: Optional[bool] = None,
        apply_available_credits: Optional[bool] = None,
        apply_deposits: Optional[bool] = None,
        apply_available_deposits: Optional[bool] = None,
        actor: Optional[User] = None,
        notes: str = "",
        invoice_type: str = 'STANDARD',
        recurring_profile: Optional[RecurringBillingProfile] = None,
        status: str = 'DRAFT'
    ) -> Invoice:
        """
        Creates a consolidated multi-child family invoice with snapshot pricing, standard discounts, sibling discounts, and credit ledger deduction.
        """
        from datetime import timedelta
        effective_start = billing_period_start or period_start or issue_date or date.today()
        effective_end = billing_period_end or period_end or due_date or (effective_start + timedelta(days=30))
        issue_date = issue_date or effective_start or date.today()
        due_date = due_date or (issue_date + timedelta(days=14))
        should_apply_credits = apply_available_credits if apply_available_credits is not None else (apply_credits if apply_credits is not None else False)
        should_apply_deposits = apply_available_deposits if apply_available_deposits is not None else (apply_deposits if apply_deposits is not None else False)

        breakdown = cls.calculate_family_billing_breakdown(
            family=family,
            daycare=daycare,
            target_date=issue_date,
            target_students=target_students,
            due_date=due_date,
            apply_available_credits=False # We apply credits through atomic ledger method below
        )

        invoice_number = cls.generate_invoice_number(daycare, issue_date)
        currency = cls.get_daycare_currency(daycare)

        invoice = Invoice.objects.create(
            daycare=daycare,
            family=family,
            student=None, # Consolidated family invoice
            branch=None,
            invoice_number=invoice_number,
            invoice_type=invoice_type,
            billing_period_start=effective_start,
            billing_period_end=effective_end,
            issue_date=issue_date,
            due_date=due_date,
            currency=currency,
            status=status,
            notes=notes,
            recurring_profile=recurring_profile,
            created_by=actor,
            updated_by=actor
        )

        # Create Line Items for each enrolled child
        for cb in breakdown['child_breakdowns']:
            s_obj = Student.objects.filter(id=cb['student_id']).first()
            base_fee = cb['base_fee']
            std_disc = cb['standard_discount_amount']
            sib_disc = cb.get('sibling_discount_amount', Decimal('0.00'))
            total_child_disc = std_disc + sib_disc

            disc_parts = []
            if std_disc > Decimal('0.00'):
                disc_parts.append(f"Standard Discount (-{std_disc} {currency})")
            if sib_disc > Decimal('0.00'):
                disc_parts.append(f"Sibling Policy Discount (-{sib_disc} {currency})")
            disc_desc = "; ".join(disc_parts)

            child_net = cb['child_final_subtotal']

            InvoiceItem.objects.create(
                invoice=invoice,
                student=s_obj,
                description=f"Childcare Tuition - {cb['student_name']}",
                quantity=Decimal('1.00'),
                unit_price=base_fee,
                subtotal=base_fee,
                discount_amount=total_child_disc,
                discount_description=disc_desc,
                tax_amount=Decimal('0.00'),
                total=child_net,
                service_period_start=period_start or issue_date,
                service_period_end=period_end or due_date
            )

        invoice.recalculate_totals(save=True)

        # Apply Available Credits
        if apply_credits:
            avail_credit = cls.get_family_credit_balance(family, daycare)
            if avail_credit > Decimal('0.00') and invoice.balance_due > Decimal('0.00'):
                credit_to_apply = min(avail_credit, invoice.balance_due)
                cls.apply_credit_to_invoice(invoice, credit_to_apply, actor=actor, notes="Consolidated family invoice credit application")

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='CREATE_FAMILY_INVOICE',
            module='Billing & Invoicing',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            new_values={
                'invoice_number': invoice.invoice_number,
                'family_id': str(family.id),
                'total_amount': str(invoice.total_amount),
                'balance_due': str(invoice.balance_due),
                'status': invoice.status,
            }
        )

        return invoice

    @classmethod
    @transaction.atomic
    def generate_registration_invoice(
        cls,
        registration_record: Optional[RegistrationFeeRecord] = None,
        daycare: Optional[Daycare] = None,
        student: Optional[Student] = None,
        fee_structure: Optional[FeeStructure] = None,
        issue_date: Optional[date] = None,
        due_date: Optional[date] = None,
        actor: Optional[User] = None
    ) -> Invoice:
        """
        Generates a registration invoice for a registration fee and prevents duplicate billing.
        """
        if registration_record is None:
            if not daycare or not student:
                raise ValueError("Either registration_record or daycare + student must be provided.")
            if not fee_structure:
                fee_structure = FeeStructure.objects.filter(daycare=daycare, fee_type='REGISTRATION', is_active=True).first()
                if not fee_structure:
                    raise ValueError("No active REGISTRATION fee structure found.")

            res = cls.record_or_check_registration_fee(daycare, student, fee_structure, actor=actor)
            registration_record = res['record']
            if res['already_exists'] and res['status'] in ['INVOICED', 'PAID']:
                raise ValueError(f"Registration fee for {student.first_name} is already {res['status']}.")

        if registration_record.status in ['INVOICED', 'PAID']:
            raise ValueError(f"Registration fee for {registration_record.student.first_name} is already {registration_record.status}.")

        if issue_date is None:
            issue_date = date.today()
        if due_date is None:
            from datetime import timedelta
            due_date = issue_date + timedelta(days=14)

        daycare = daycare or registration_record.daycare
        student = student or registration_record.student
        family = registration_record.family or getattr(FamilyChild.objects.filter(student=student).first(), 'family', None)

        invoice_number = cls.generate_invoice_number(daycare, issue_date)
        currency = registration_record.currency or cls.get_daycare_currency(daycare)

        invoice = Invoice.objects.create(
            daycare=daycare,
            family=family,
            student=student,
            branch=student.branch,
            enrollment=registration_record.enrollment,
            invoice_number=invoice_number,
            invoice_type='REGISTRATION',
            issue_date=issue_date,
            due_date=due_date,
            currency=currency,
            status='ISSUED',
            notes=f"One-time Registration Fee for {student.first_name} {student.last_name}",
            created_by=actor,
            updated_by=actor
        )

        InvoiceItem.objects.create(
            invoice=invoice,
            student=student,
            fee_structure=registration_record.fee_structure,
            fee_type_code='REGISTRATION',
            description=f"Registration / Enrolment Fee: {registration_record.fee_structure.name}",
            quantity=Decimal('1.00'),
            unit_price=registration_record.amount,
            subtotal=registration_record.amount,
            discount_amount=Decimal('0.00'),
            tax_amount=Decimal('0.00'),
            total=registration_record.amount,
            service_period_start=issue_date,
            service_period_end=due_date
        )

        invoice.recalculate_totals(save=True)

        registration_record.status = 'INVOICED'
        registration_record.save()

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='GENERATE_REGISTRATION_INVOICE',
            module='Billing & Invoicing',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            new_values={
                'invoice_number': invoice.invoice_number,
                'registration_record_id': str(registration_record.id),
                'amount': str(invoice.total_amount)
            }
        )

        return invoice

    @classmethod
    @transaction.atomic
    def process_recurring_billing_run(
        cls,
        daycare: Daycare,
        target_date: Optional[date] = None,
        profile: Optional[RecurringBillingProfile] = None,
        actor: Optional[User] = None
    ) -> Dict[str, Any]:
        """
        Batch recurring billing generator.
        Processes all active RecurringBillingProfiles due on or before target_date,
        prevents duplicate invoices for the same cycle, and advances next_billing_date.
        """
        from datetime import timedelta
        if target_date is None:
            target_date = date.today()

        if profile is not None:
            profiles = [profile] if (profile.is_active and profile.next_billing_date <= target_date) else []
        else:
            profiles = list(RecurringBillingProfile.objects.filter(
                daycare=daycare,
                is_active=True,
                next_billing_date__lte=target_date
            ).select_related('family', 'student', 'fee_structure', 'branch'))

        generated_invoices = []
        skipped_count = 0

        for prof in profiles:
            period_start = prof.next_billing_date
            if prof.frequency == 'MONTHLY':
                # Period end is 1 month ahead - 1 day
                # Find days in month
                year = period_start.year + (1 if period_start.month == 12 else 0)
                month = 1 if period_start.month == 12 else period_start.month + 1
                next_cycle = date(year, month, min(period_start.day, calendar.monthrange(year, month)[1]))
                period_end = next_cycle - timedelta(days=1)
                next_bill = next_cycle
            elif prof.frequency == 'WEEKLY':
                period_end = period_start + timedelta(days=6)
                next_bill = period_start + timedelta(days=7)
            elif prof.frequency == 'BI_WEEKLY':
                period_end = period_start + timedelta(days=13)
                next_bill = period_start + timedelta(days=14)
            else: # DAILY
                period_end = period_start
                next_bill = period_start + timedelta(days=1)

            due_date = period_start + timedelta(days=7)

            # Prevent duplicate invoices for the exact same recurring profile and billing period
            existing_inv = Invoice.objects.filter(
                recurring_profile=prof,
                billing_period_start=period_start,
                billing_period_end=period_end,
                status__in=['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID']
            ).first()

            if existing_inv:
                skipped_count += 1
                prof.next_billing_date = next_bill
                prof.last_billed_date = target_date
                prof.save()
                continue

            if prof.student:
                inv = cls.create_student_invoice(
                    daycare=daycare,
                    student=prof.student,
                    issue_date=period_start,
                    due_date=due_date,
                    period_start=period_start,
                    period_end=period_end,
                    fee_structure=prof.fee_structure,
                    apply_credits=prof.auto_apply_credits,
                    apply_deposits=prof.auto_apply_deposits,
                    actor=actor,
                    notes=f"Automated {prof.frequency} Recurring Billing",
                    invoice_type='RECURRING',
                    recurring_profile=prof,
                    status='ISSUED'
                )
            else:
                inv = cls.create_family_invoice(
                    daycare=daycare,
                    family=prof.family,
                    issue_date=period_start,
                    due_date=due_date,
                    period_start=period_start,
                    period_end=period_end,
                    apply_credits=prof.auto_apply_credits,
                    apply_deposits=prof.auto_apply_deposits,
                    actor=actor,
                    notes=f"Automated {prof.frequency} Recurring Family Billing",
                    invoice_type='RECURRING',
                    recurring_profile=prof,
                    status='ISSUED'
                )

            prof.next_billing_date = next_bill
            prof.last_billed_date = target_date
            prof.save()

            generated_invoices.append({
                'invoice_id': str(inv.id),
                'invoice_number': inv.invoice_number,
                'target': prof.student.first_name if prof.student else prof.family.family_name,
                'total_amount': str(inv.total_amount),
                'balance_due': str(inv.balance_due),
                'status': inv.status
            })

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='RECURRING_BILLING_BATCH_RUN',
            module='Billing & Invoicing',
            entity_type='RecurringBillingProfile',
            entity_id=str(daycare.id),
            new_values={
                'target_date': str(target_date),
                'generated_count': len(generated_invoices),
                'skipped_duplicate_count': skipped_count
            }
        )

        return {
            'target_date': target_date,
            'processed_profiles_count': len(profiles),
            'total_profiles_processed': len(profiles),
            'generated_invoices_count': len(generated_invoices),
            'total_invoices_generated': len(generated_invoices),
            'skipped_duplicate_count': skipped_count,
            'invoices': generated_invoices
        }

    @classmethod
    @transaction.atomic
    def apply_credit_to_invoice(
        cls,
        invoice: Invoice,
        amount: Decimal,
        actor: Optional[User] = None,
        notes: str = ""
    ) -> CreditTransaction:
        """
        Applies a credit amount from the family ledger towards an unpaid/issued invoice.
        Enforces balance bounds and creates immutable audit transaction.
        """
        amount = quantize_money(amount)
        if amount <= Decimal('0.00'):
            raise ValueError("Credit application amount must be strictly positive.")

        if not invoice.family:
            raise ValueError("Invoice has no associated family to deduct credit from.")

        avail_bal = cls.get_family_credit_balance(invoice.family, invoice.daycare)
        if amount > avail_bal:
            raise ValueError(f"Requested credit ({amount}) exceeds available family balance ({avail_bal}).")

        if amount > invoice.balance_due:
            raise ValueError(f"Requested credit ({amount}) exceeds invoice balance due ({invoice.balance_due}).")

        tx = cls.apply_family_credit(
            daycare=invoice.daycare,
            family=invoice.family,
            amount=amount,
            reference=invoice.invoice_number,
            student=invoice.student,
            actor=actor,
            notes=notes or f"Applied to Invoice {invoice.invoice_number}"
        )

        invoice.credit_total = quantize_money(invoice.credit_total + amount)
        invoice.recalculate_totals(save=True)

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='APPLY_CREDIT_TO_INVOICE',
            module='Billing & Invoicing',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            new_values={
                'invoice_number': invoice.invoice_number,
                'credit_applied': str(amount),
                'new_balance_due': str(invoice.balance_due),
                'status': invoice.status
            }
        )

        return tx

    @classmethod
    @transaction.atomic
    def apply_deposit_to_invoice(
        cls,
        invoice: Invoice,
        deposit_record: DepositRecord,
        amount: Decimal,
        actor: Optional[User] = None,
        notes: str = ""
    ) -> DepositRecord:
        """
        Applies funds from a held deposit record towards an invoice balance.
        """
        amount = quantize_money(amount)
        if amount <= Decimal('0.00'):
            raise ValueError("Deposit application amount must be strictly positive.")

        if amount > deposit_record.remaining_held:
            raise ValueError(f"Requested deposit ({amount}) exceeds remaining deposit held ({deposit_record.remaining_held}).")

        if amount > invoice.balance_due:
            raise ValueError(f"Requested deposit ({amount}) exceeds invoice balance due ({invoice.balance_due}).")

        deposit_record.amount_applied = quantize_money(deposit_record.amount_applied + amount)
        if deposit_record.remaining_held == Decimal('0.00'):
            deposit_record.status = 'FULLY_APPLIED'
        else:
            deposit_record.status = 'PARTIALLY_APPLIED'
        deposit_record.updated_by = actor
        deposit_record.save()

        invoice.deposit_applied_total = quantize_money(invoice.deposit_applied_total + amount)
        invoice.recalculate_totals(save=True)

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='APPLY_DEPOSIT_TO_INVOICE',
            module='Billing & Invoicing',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            new_values={
                'invoice_number': invoice.invoice_number,
                'deposit_record_id': str(deposit_record.id),
                'deposit_applied': str(amount),
                'new_balance_due': str(invoice.balance_due),
                'status': invoice.status
            }
        )

        return deposit_record

    @classmethod
    @transaction.atomic
    def assess_late_fee_on_invoice(
        cls,
        invoice: Invoice,
        evaluation_date: Optional[date] = None,
        actor: Optional[User] = None
    ) -> Invoice:
        """
        Evaluates late fee rules and attaches an itemized late fee to an overdue invoice.
        """
        if evaluation_date is None:
            evaluation_date = date.today()

        if invoice.balance_due <= Decimal('0.00'):
            return invoice

        late_res = cls.calculate_late_fee(
            daycare=invoice.daycare,
            due_date=invoice.due_date,
            overdue_balance=invoice.balance_due,
            evaluation_date=evaluation_date
        )

        fee_amount = late_res['late_fee_amount']
        if fee_amount <= Decimal('0.00'):
            return invoice

        # Create or update late fee item
        existing_item = invoice.items.filter(fee_type_code='LATE_FEE').first()
        if existing_item:
            existing_item.unit_price = fee_amount
            existing_item.subtotal = fee_amount
            existing_item.total = fee_amount
            existing_item.save()
            late_item = existing_item
        else:
            late_item = InvoiceItem.objects.create(
                invoice=invoice,
                student=invoice.student,
                fee_type_code='LATE_FEE',
                description=f"Late Payment Fee ({late_res.get('rule_applied', {}).get('name', 'Policy')})",
                quantity=Decimal('1.00'),
                unit_price=fee_amount,
                subtotal=fee_amount,
                discount_amount=Decimal('0.00'),
                tax_amount=Decimal('0.00'),
                total=fee_amount
            )

        invoice.late_fee_total = fee_amount
        invoice.recalculate_totals(save=True)

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='ASSESS_LATE_FEE_ON_INVOICE',
            module='Billing & Invoicing',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            new_values={
                'invoice_number': invoice.invoice_number,
                'late_fee_amount': str(fee_amount),
                'new_total': str(invoice.total_amount),
                'new_balance_due': str(invoice.balance_due)
            }
        )

        return invoice

    @classmethod
    @transaction.atomic
    def void_invoice(
        cls,
        invoice: Invoice,
        reason: str,
        actor: Optional[User] = None
    ) -> Invoice:
        """
        Voids an issued/unpaid invoice, restores any applied credits back to the family ledger,
        and logs audit trail.
        """
        if not reason:
            raise ValueError("A reason is strictly required to void an invoice.")

        # Reverse any credits that were applied to this invoice
        if invoice.credit_total > Decimal('0.00') and invoice.family:
            CreditTransaction.objects.create(
                daycare=invoice.daycare,
                family=invoice.family,
                student=invoice.student,
                amount=invoice.credit_total,
                currency=invoice.currency,
                transaction_type='CREDIT',
                reason=f"Restored credit from voided Invoice {invoice.invoice_number}",
                reference=f"VOID-{invoice.invoice_number}",
                notes=reason,
                created_by=actor
            )

        # Restore any deposits that were applied
        if invoice.deposit_applied_total > Decimal('0.00'):
            for dep in DepositRecord.objects.filter(daycare=invoice.daycare, family=invoice.family, status__in=['FULLY_APPLIED', 'PARTIALLY_APPLIED']):
                if dep.amount_applied > Decimal('0.00'):
                    restoration = min(dep.amount_applied, invoice.deposit_applied_total)
                    dep.amount_applied = quantize_money(dep.amount_applied - restoration)
                    dep.status = 'HELD'
                    dep.save()

        invoice.status = 'VOID'
        invoice.void_reason = reason
        invoice.updated_by = actor
        invoice.save()

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='VOID_INVOICE',
            module='Billing & Invoicing',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            new_values={
                'invoice_number': invoice.invoice_number,
                'status': 'VOID',
                'void_reason': reason
            }
        )

        return invoice

    @classmethod
    @transaction.atomic
    def cancel_invoice(
        cls,
        invoice: Invoice,
        reason: str,
        actor: Optional[User] = None
    ) -> Invoice:
        """
        Cancels an invoice with audit reasoning.
        """
        if not reason:
            raise ValueError("A reason is strictly required to cancel an invoice.")

        invoice.status = 'CANCELLED'
        invoice.cancelled_reason = reason
        invoice.updated_by = actor
        invoice.save()

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='CANCEL_INVOICE',
            module='Billing & Invoicing',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            new_values={
                'invoice_number': invoice.invoice_number,
                'status': 'CANCELLED',
                'cancelled_reason': reason
            }
        )

        return invoice

    @classmethod
    @transaction.atomic
    def issue_invoice(
        cls,
        invoice: Invoice,
        actor: Optional[User] = None
    ) -> Invoice:
        """
        Transitions an invoice from DRAFT to ISSUED.
        """
        invoice.status = 'ISSUED'
        invoice.updated_by = actor
        invoice.recalculate_totals(save=True)

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='ISSUE_INVOICE',
            module='Billing & Invoicing',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            new_values={
                'invoice_number': invoice.invoice_number,
                'status': 'ISSUED',
                'total_amount': str(invoice.total_amount),
                'balance_due': str(invoice.balance_due)
            }
        )

        return invoice

    # ==============================================================================
    # MODULE 16 PHASE 4: PAYMENTS, RECEIPTS, SUBSIDIES & TAX RECEIPTS
    # ==============================================================================

    @classmethod
    def generate_receipt_number(cls, daycare: Daycare, payment_date: Optional[date] = None) -> str:
        """
        Generates a structured, unique receipt number e.g. RCP-SUN-202609-0001
        """
        if payment_date is None:
            payment_date = date.today()
        
        prefix = ''.join(c for c in (daycare.name or 'DAY') if c.isalnum())[:3].upper() or 'DAY'
        period_str = payment_date.strftime('%Y%m')
        
        count = Payment.objects.filter(
            daycare=daycare,
            payment_date__year=payment_date.year,
            payment_date__month=payment_date.month
        ).count() + 1

        receipt_num = f"RCP-{prefix}-{period_str}-{count:04d}"
        attempts = 0
        while Payment.objects.filter(receipt_number=receipt_num).exists():
            attempts += 1
            receipt_num = f"RCP-{prefix}-{period_str}-{(count + attempts):04d}"
        
        return receipt_num

    @classmethod
    @transaction.atomic
    def record_payment(
        cls,
        daycare: Daycare,
        invoice: Invoice,
        amount: Decimal,
        payment_method: str = 'ETRANSFER',
        payment_date: Optional[date] = None,
        transaction_reference: str = '',
        payer_name: str = '',
        payer_email: str = '',
        notes: str = '',
        actor: Optional[User] = None
    ) -> Payment:
        """
        Records a payment against an invoice, decrements invoice balance_due,
        updates invoice status (PAID or PARTIALLY_PAID), generates an official receipt,
        and auto-clears linked registration/deposit records if applicable.
        """
        amount = quantize_money(amount)
        if amount <= Decimal('0.00'):
            raise ValueError("Payment amount must be greater than zero.")
        
        if invoice.status in ['VOID', 'CANCELLED']:
            raise ValueError(f"Cannot record payment on an invoice with status '{invoice.status}'.")

        if payment_date is None:
            payment_date = date.today()

        receipt_number = cls.generate_receipt_number(daycare, payment_date=payment_date)
        currency = invoice.currency or cls.get_daycare_currency(daycare)

        # Resolve family and student from invoice if available
        family = invoice.family
        student = invoice.student
        if not family and student:
            fam_child = student.child_families.first()
            if fam_child:
                family = fam_child.family

        if not payer_name and family:
            primary_g = family.family_guardians.filter(is_primary=True).first()
            payer_name = f"{primary_g.guardian.first_name} {primary_g.guardian.last_name}" if primary_g else family.family_name

        payment = Payment.objects.create(
            daycare=daycare,
            invoice=invoice,
            family=family,
            student=student,
            receipt_number=receipt_number,
            amount=amount,
            currency=currency,
            payment_date=payment_date,
            payment_method=payment_method,
            status='COMPLETED',
            transaction_reference=transaction_reference,
            payer_name=payer_name,
            payer_email=payer_email,
            notes=notes,
            created_by=actor,
            updated_by=actor
        )

        # Update invoice balance due
        current_bal = quantize_money(invoice.balance_due)
        new_balance = max(Decimal('0.00'), quantize_money(current_bal - amount))
        invoice.balance_due = new_balance
        
        if invoice.balance_due <= Decimal('0.00'):
            invoice.status = 'PAID'
        else:
            invoice.status = 'PARTIALLY_PAID'
        
        invoice.updated_by = actor
        invoice.save()

        # If this was a registration fee invoice and is now fully paid, update RegistrationFeeRecord
        if invoice.invoice_type == 'REGISTRATION' and invoice.status == 'PAID':
            reg_records = RegistrationFeeRecord.objects.filter(daycare=daycare, student=student, status='INVOICED')
            for reg in reg_records:
                reg.status = 'PAID'
                reg.save()

        # If this was a deposit invoice and is now fully paid, mark DepositRecord as HELD
        if invoice.invoice_type == 'DEPOSIT' and invoice.status == 'PAID':
            dep_records = DepositRecord.objects.filter(daycare=daycare, student=student, status='CHARGED')
            for dep in dep_records:
                dep.status = 'HELD'
                dep.amount_held = dep.amount_charged
                dep.received_date = payment_date
                dep.save()

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='RECORD_PAYMENT',
            module='Billing & Invoicing',
            entity_type='Payment',
            entity_id=str(payment.id),
            new_values={
                'receipt_number': payment.receipt_number,
                'invoice_number': invoice.invoice_number,
                'amount': str(payment.amount),
                'payment_method': payment.payment_method,
                'invoice_status': invoice.status,
                'invoice_balance_due': str(invoice.balance_due)
            }
        )

        return payment

    @classmethod
    @transaction.atomic
    def process_refund(
        cls,
        payment: Payment,
        refund_amount: Decimal,
        reason: str = '',
        actor: Optional[User] = None
    ) -> Payment:
        """
        Processes a partial or full refund on a recorded payment, restores the invoice
        balance_due, updates invoice status accordingly, and logs an audit trail.
        """
        refund_amount = quantize_money(refund_amount)
        if refund_amount <= Decimal('0.00'):
            raise ValueError("Refund amount must be greater than zero.")

        max_refundable = quantize_money(payment.amount - payment.refunded_amount)
        if refund_amount > max_refundable:
            raise ValueError(f"Refund amount ({refund_amount}) exceeds max refundable balance ({max_refundable}).")

        payment.refunded_amount = quantize_money(payment.refunded_amount + refund_amount)
        payment.refund_reason = reason
        payment.refunded_at = timezone.now()
        payment.updated_by = actor

        if payment.refunded_amount >= payment.amount:
            payment.status = 'REFUNDED'
        else:
            payment.status = 'PARTIALLY_REFUNDED'

        payment.save()

        # Restore invoice balance
        invoice = payment.invoice
        invoice.balance_due = quantize_money(invoice.balance_due + refund_amount)
        if invoice.balance_due >= invoice.total:
            invoice.status = 'ISSUED'
        elif invoice.balance_due > Decimal('0.00'):
            invoice.status = 'PARTIALLY_PAID'

        invoice.updated_by = actor
        invoice.save()

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='REFUND_PAYMENT',
            module='Billing & Invoicing',
            entity_type='Payment',
            entity_id=str(payment.id),
            new_values={
                'receipt_number': payment.receipt_number,
                'invoice_number': invoice.invoice_number,
                'refund_amount': str(refund_amount),
                'total_refunded': str(payment.refunded_amount),
                'payment_status': payment.status,
                'invoice_balance_due': str(invoice.balance_due)
            }
        )

        return payment

    @classmethod
    def resolve_effective_subsidy(
        cls,
        student: Student,
        target_date: Optional[date] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Resolves the active government subsidy profile for a student on a target date.
        """
        if target_date is None:
            target_date = date.today()

        profile = ChildSubsidyProfile.objects.filter(
            daycare=student.daycare,
            student=student,
            is_active=True,
            effective_from__lte=target_date
        ).filter(
            models.Q(effective_until__isnull=True) | models.Q(effective_until__gte=target_date)
        ).first()

        if not profile:
            return None

        return {
            'profile_id': str(profile.id),
            'program_name': profile.program_name,
            'subsidy_type': profile.subsidy_type,
            'subsidy_rate': profile.subsidy_rate,
            'currency': profile.currency,
            'government_case_number': profile.government_case_number,
            'parent_co_pay_amount': profile.parent_co_pay_amount,
            'approved_days_per_week': profile.approved_days_per_week,
        }

    @classmethod
    def calculate_subsidy_deduction(
        cls,
        gross_amount: Decimal,
        subsidy_profile: ChildSubsidyProfile,
        days_count: int = 1
    ) -> Dict[str, Decimal]:
        """
        Calculates the government subsidy contribution and remaining parent co-pay portion.
        """
        gross_amount = quantize_money(gross_amount)
        stype = subsidy_profile.subsidy_type
        rate = subsidy_profile.subsidy_rate

        if stype == 'PERCENTAGE':
            subsidy_amount = quantize_money(gross_amount * (rate / Decimal('100.00')))
            parent_portion = max(Decimal('0.00'), quantize_money(gross_amount - subsidy_amount))
        elif stype == 'FIXED_DAILY':
            subsidy_amount = quantize_money(rate * Decimal(days_count))
            subsidy_amount = min(gross_amount, subsidy_amount)
            parent_portion = max(Decimal('0.00'), quantize_money(gross_amount - subsidy_amount))
        elif stype == 'FIXED_MONTHLY':
            subsidy_amount = min(gross_amount, quantize_money(rate))
            parent_portion = max(Decimal('0.00'), quantize_money(gross_amount - subsidy_amount))
        elif stype == 'CUSTOM_RATE':
            parent_portion = quantize_money(subsidy_profile.parent_co_pay_amount or Decimal('0.00'))
            parent_portion = min(gross_amount, parent_portion)
            subsidy_amount = max(Decimal('0.00'), quantize_money(gross_amount - parent_portion))
        else:
            subsidy_amount = Decimal('0.00')
            parent_portion = gross_amount

        return {
            'subsidy_amount': subsidy_amount,
            'parent_portion': parent_portion
        }

    @classmethod
    @transaction.atomic
    def generate_tax_receipt(
        cls,
        daycare: Daycare,
        family: Family,
        tax_year: int,
        actor: Optional[User] = None,
        student: Optional[Student] = None
    ) -> TaxReceipt:
        """
        Generates an official calendar-year Child Care Expense Tax Receipt aggregating
        all eligible payments received for the family/child in that tax year.
        """
        start_date = date(tax_year, 1, 1)
        end_date = date(tax_year, 12, 31)

        payments_qs = Payment.objects.filter(
            daycare=daycare,
            family=family,
            payment_date__range=[start_date, end_date],
            status__in=['COMPLETED', 'PARTIALLY_REFUNDED']
        )
        if student:
            payments_qs = payments_qs.filter(student=student)

        total_eligible = sum((p.net_amount for p in payments_qs), Decimal('0.00'))
        total_eligible = quantize_money(total_eligible)

        primary_g = family.family_guardians.filter(is_primary=True).first()
        recipient_name = f"{primary_g.guardian.first_name} {primary_g.guardian.last_name}" if primary_g and primary_g.guardian else family.family_name
        recipient_addr = getattr(primary_g.guardian, 'address', '') if primary_g and primary_g.guardian else (getattr(family, 'address', '') or '')

        settings = DaycareSettings.objects.filter(daycare=daycare).first()
        daycare_legal = getattr(settings, 'legal_name', None) or daycare.name
        biz_num = getattr(settings, 'tax_id', None) or getattr(settings, 'business_number', None) or getattr(daycare, 'license_number', '') or 'BN-PENDING'
        daycare_addr = daycare.address1 or getattr(settings, 'address', '') or ''
        currency = cls.get_daycare_currency(daycare)

        prefix = ''.join(c for c in (daycare.name or 'DAY') if c.isalnum())[:3].upper() or 'DAY'
        count = TaxReceipt.objects.filter(daycare=daycare, tax_year=tax_year).count() + 1
        receipt_num = f"TAX-{prefix}-{tax_year}-{count:04d}"

        # If a receipt already exists for this exact family + year, update it or create new
        tax_receipt, created = TaxReceipt.objects.update_or_create(
            daycare=daycare,
            family=family,
            tax_year=tax_year,
            defaults={
                'student': student,
                'receipt_number': receipt_num,
                'recipient_name': recipient_name,
                'recipient_address': recipient_addr,
                'daycare_legal_name': daycare_legal,
                'daycare_business_number': biz_num,
                'daycare_address': daycare_addr,
                'total_eligible_fees_paid': total_eligible,
                'total_subsidies_deducted': Decimal('0.00'),
                'net_claimable_amount': total_eligible,
                'currency': currency,
                'service_period_start': start_date,
                'service_period_end': end_date,
                'issued_date': date.today(),
                'status': 'ISSUED',
                'created_by': actor,
                'updated_by': actor,
            }
        )

        AuditLog.objects.create(
            user=actor,
            user_type='Daycare Admin' if actor else 'System',
            action='GENERATE_TAX_RECEIPT',
            module='Billing & Invoicing',
            entity_type='TaxReceipt',
            entity_id=str(tax_receipt.id),
            new_values={
                'receipt_number': tax_receipt.receipt_number,
                'tax_year': tax_year,
                'recipient_name': tax_receipt.recipient_name,
                'net_claimable_amount': str(tax_receipt.net_claimable_amount)
            }
        )

        return tax_receipt

    @classmethod
    def generate_batch_tax_receipts(
        cls,
        daycare: Daycare,
        tax_year: int,
        actor: Optional[User] = None
    ) -> Dict[str, Any]:
        """
        Batch generates tax receipts for all families with payment activity in the specified tax year.
        """
        start_date = date(tax_year, 1, 1)
        end_date = date(tax_year, 12, 31)

        active_family_ids = Payment.objects.filter(
            daycare=daycare,
            payment_date__range=[start_date, end_date],
            status__in=['COMPLETED', 'PARTIALLY_REFUNDED'],
            family__isnull=False
        ).values_list('family_id', flat=True).distinct()

        receipts_generated = []
        for fam_id in active_family_ids:
            fam = Family.objects.filter(id=fam_id, daycare=daycare).first()
            if fam:
                receipt = cls.generate_tax_receipt(daycare, fam, tax_year, actor=actor)
                receipts_generated.append(str(receipt.id))

        return {
            'tax_year': tax_year,
            'generated_count': len(receipts_generated),
            'receipt_ids': receipts_generated
        }

    @classmethod
    def get_family_account_statement(
        cls,
        daycare: Daycare,
        family: Family,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Generates a chronological running statement of account for a family.
        """
        if end_date is None:
            end_date = date.today()
        if start_date is None:
            start_date = end_date - timedelta(days=90) if 'timedelta' in globals() else date(end_date.year, 1, 1)

        currency = cls.get_daycare_currency(daycare)

        # Invoices in period
        invoices = Invoice.objects.filter(
            daycare=daycare,
            family=family,
            issue_date__range=[start_date, end_date]
        ).exclude(status__in=['VOID', 'CANCELLED']).order_by('issue_date')

        # Payments in period
        payments = Payment.objects.filter(
            daycare=daycare,
            family=family,
            payment_date__range=[start_date, end_date]
        ).order_by('payment_date')

        # Credits in period
        credits = CreditTransaction.objects.filter(
            daycare=daycare,
            family=family,
            status='ACTIVE'
        ).filter(
            models.Q(created_at__date__range=[start_date, end_date])
        ).order_by('created_at')

        entries = []
        running_balance = Decimal('0.00')

        for inv in invoices:
            running_balance += quantize_money(inv.total)
            entries.append({
                'date': str(inv.issue_date),
                'type': 'INVOICE',
                'reference': inv.invoice_number,
                'description': f"Invoice #{inv.invoice_number} ({inv.get_invoice_type_display() if hasattr(inv, 'get_invoice_type_display') else inv.invoice_type})",
                'debit': str(inv.total),
                'credit': '0.00',
                'running_balance': str(quantize_money(running_balance)),
                'status': inv.status
            })

        for p in payments:
            net_p = p.net_amount
            running_balance -= quantize_money(net_p)
            entries.append({
                'date': str(p.payment_date),
                'type': 'PAYMENT',
                'reference': p.receipt_number or str(p.id)[:8],
                'description': f"Payment ({p.get_payment_method_display() if hasattr(p, 'get_payment_method_display') else p.payment_method}) - Receipt {p.receipt_number or 'N/A'}",
                'debit': '0.00',
                'credit': str(net_p),
                'running_balance': str(quantize_money(running_balance)),
                'status': p.status
            })

        # Sort combined entries by date
        entries.sort(key=lambda x: x['date'])

        total_invoiced = sum((quantize_money(inv.total) for inv in invoices), Decimal('0.00'))
        total_paid = sum((p.net_amount for p in payments), Decimal('0.00'))
        total_credits = sum((quantize_money(c.amount) for c in credits if c.transaction_type == 'CREDIT'), Decimal('0.00'))

        return {
            'family_id': str(family.id),
            'family_name': family.family_name,
            'statement_period_start': str(start_date),
            'statement_period_end': str(end_date),
            'currency': currency,
            'total_invoiced': str(quantize_money(total_invoiced)),
            'total_paid': str(quantize_money(total_paid)),
            'total_credits': str(quantize_money(total_credits)),
            'closing_balance': str(quantize_money(running_balance)),
            'entries': entries
        }



