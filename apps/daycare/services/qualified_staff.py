import logging
from datetime import date, datetime
from typing import Optional, Dict, Any, List, Tuple, Sequence
from django.utils import timezone
from django.db.models import Q

from core.models import (
    Employee, EmployeeType, ECECredential, EmployeeCertification,
    EmployeeQualification, RatioRule, Daycare, Province
)

logger = logging.getLogger(__name__)


class QualifiedStaffService:
    """
    Module 13 Phase 1: Reusable Staff Qualification Evaluation Service.
    
    Determines whether a staff member qualifies under a configured RatioRule
    by evaluating:
    1. Staff status (must be Active)
    2. Employee type / role classroom teaching eligibility
    3. ECE Credentials, Provincial requirements, Certifications, Qualifications
    4. Credential validity as of target evaluation date (not expired/revoked)
    """

    @classmethod
    def is_status_active(cls, employee: Employee) -> bool:
        """
        Checks if the employee has an active status and is not terminated/inactive.
        """
        if not employee:
            return False
        status_val = getattr(employee, 'status', None)
        if status_val and str(status_val).strip().lower() in ['inactive', 'terminated', 'suspended', 'on_leave', 'withdrawn']:
            return False
        return True

    @classmethod
    def is_teaching_eligible(cls, employee: Employee) -> bool:
        """
        Checks if the employee's role/job_title or associated EmployeeType makes them
        eligible for classroom teaching vs administrative/support duties (e.g. Cook, Janitor).
        """
        if not employee:
            return False

        # If employee has can_teach method on model
        if hasattr(employee, 'can_teach') and callable(getattr(employee, 'can_teach')):
            return employee.can_teach()

        # Check associated EmployeeTypes
        if hasattr(employee, 'types') and employee.types.exists():
            for et in employee.types.all():
                if getattr(et, 'is_eligible_for_classroom', False):
                    return True
                if hasattr(et, 'can_teach') and callable(getattr(et, 'can_teach')) and et.can_teach():
                    return True

        # Check job title / role keywords
        role_str = (employee.job_title or employee.role or "").strip().lower()
        non_teaching_keywords = [
            'accountant', 'receptionist', 'cook', 'chef', 'cleaner',
            'driver', 'janitor', 'maintenance', 'security', 'billing', 'admin'
        ]
        if any(nt in role_str for nt in non_teaching_keywords):
            return False

        teaching_keywords = [
            'teacher', 'ece', 'educator', 'assistant', 'lead', 'caregiver',
            'instructor', 'practitioner', 'staff', 'substitute', 'float', 'director', 'supervisor'
        ]
        if any(tk in role_str for tk in teaching_keywords):
            return True

        # Default to True for general childcare employees unless explicitly non-teaching
        return True

    @classmethod
    def get_active_credentials(
        cls,
        employee: Employee,
        target_date: Optional[date] = None,
        province: Optional[Province] = None,
        qualification_requirement: Optional[str] = None
    ) -> List[ECECredential]:
        """
        Retrieves active, non-expired ECE credentials for the employee as of target_date.
        """
        if not target_date:
            target_date = timezone.now().date()

        daycare = getattr(employee, 'daycare', None)
        qs = ECECredential.objects.filter(
            employee=employee,
            status='Active'
        ).exclude(
            status__in=['Expired', 'Revoked', 'Suspended', 'Inactive', 'Superseded']
        ).filter(
            Q(expiry_date__gte=target_date) | Q(expiry_date__isnull=True)
        )

        if daycare:
            qs = qs.filter(Q(daycare=daycare) | Q(daycare__isnull=True))

        matching_creds = []
        for cred in qs.select_related('credential_type', 'province'):
            # Province check if specified
            if province and cred.province and cred.province != province:
                # Still check if credential type belongs to this province or is generic
                if cred.credential_type and cred.credential_type.province and cred.credential_type.province != province:
                    continue

            # Qualification requirement keyword check if specified
            if qualification_requirement and qualification_requirement.strip():
                req_lower = qualification_requirement.strip().lower()
                cred_name = (cred.credential_type.name if cred.credential_type else "").lower()
                cred_cat = (cred.credential_type.category if cred.credential_type else "").lower()
                
                # Check if requirement matches credential name, category, or generic ECE
                matches = (
                    req_lower in cred_name or
                    cred_name in req_lower or
                    req_lower in cred_cat or
                    ('ece' in req_lower and ('ece' in cred_name or cred_cat == 'ece')) or
                    ('certified' in req_lower and ('certified' in cred_name or 'ece' in cred_name or cred_cat == 'ece'))
                )
                if not matches:
                    continue

            matching_creds.append(cred)

        return matching_creds

    @classmethod
    def get_active_certifications(
        cls,
        employee: Employee,
        target_date: Optional[date] = None,
        qualification_requirement: Optional[str] = None
    ) -> List[EmployeeCertification]:
        """
        Retrieves active, non-expired EmployeeCertification records as of target_date.
        """
        if not target_date:
            target_date = timezone.now().date()

        qs = EmployeeCertification.objects.filter(
            employee=employee
        ).filter(
            Q(expiry_date__gte=target_date) | Q(expiry_date__isnull=True)
        )

        matching_certs = []
        for cert in qs:
            if qualification_requirement and qualification_requirement.strip():
                req_lower = qualification_requirement.strip().lower()
                cert_name = (cert.certification_name or "").lower()
                if req_lower not in cert_name and cert_name not in req_lower and 'first aid' not in req_lower:
                    continue
            matching_certs.append(cert)

        return matching_certs

    @classmethod
    def evaluate_staff_qualification(
        cls,
        employee: Employee,
        rule: Optional[RatioRule] = None,
        target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Performs a full evaluation of the staff member against the given RatioRule
        and target date, returning detailed pass/fail status and reasons.
        """
        if not target_date:
            target_date = timezone.now().date()

        disqualification_reasons = []

        # 1. Staff Active Status Check
        is_active = cls.is_status_active(employee)
        if not is_active:
            disqualification_reasons.append(f"Staff member is not active (status: {getattr(employee, 'status', 'Unknown')}).")

        # 2. Teaching Eligibility Check
        can_teach = cls.is_teaching_eligible(employee)
        if not can_teach:
            role_desc = employee.job_title or employee.role or "Non-teaching"
            disqualification_reasons.append(f"Staff member role '{role_desc}' is not eligible for classroom teaching.")

        # 3. Rule Qualification Requirements
        requires_ece = True
        qualification_req = "Certified ECE"
        prov = None

        if rule:
            requires_ece = getattr(rule, 'requires_qualified_ece', True)
            if hasattr(rule, 'qualified_staff_required') and rule.qualified_staff_required == 0:
                requires_ece = False
            qualification_req = getattr(rule, 'qualification_requirement', 'Certified ECE') or 'Certified ECE'
            prov = getattr(rule, 'province', None)

        active_creds = cls.get_active_credentials(
            employee=employee,
            target_date=target_date,
            province=prov,
            qualification_requirement=qualification_req if requires_ece else None
        )

        active_certs = cls.get_active_certifications(
            employee=employee,
            target_date=target_date,
            qualification_requirement=qualification_req if requires_ece else None
        )

        # Check if staff has active qualifications on EmployeeQualification model
        active_quals = []
        if requires_ece:
            eq_qs = EmployeeQualification.objects.filter(
                employee=employee,
                status='Active'
            ).filter(
                Q(expiry_date__gte=target_date) | Q(expiry_date__isnull=True)
            )
            active_quals = list(eq_qs)

        has_valid_credential = bool(active_creds or active_certs or active_quals)

        if requires_ece and not has_valid_credential:
            disqualification_reasons.append(
                f"Staff member does not hold an active, non-expired qualification matching '{qualification_req}' as of {target_date}."
            )

        is_qualified = is_active and can_teach and (not requires_ece or has_valid_credential)

        # Build credential summary list
        cred_summaries = []
        for c in active_creds:
            cred_summaries.append({
                "id": str(c.id),
                "type": c.credential_type.name if c.credential_type else "ECE",
                "category": c.credential_type.category if c.credential_type else "ece",
                "certificate_number": c.certificate_number or "",
                "province": c.province.code if c.province else (c.credential_type.province.code if c.credential_type and c.credential_type.province else None),
                "issue_date": c.issue_date.isoformat() if c.issue_date else None,
                "expiry_date": c.expiry_date.isoformat() if c.expiry_date else None,
                "status": c.status
            })

        cert_summaries = []
        for cert in active_certs:
            cert_summaries.append({
                "id": str(cert.id),
                "name": cert.certification_name,
                "issuing_organization": cert.issuing_organization,
                "expiry_date": cert.expiry_date.isoformat() if cert.expiry_date else None
            })

        return {
            "employee_id": str(employee.id),
            "employee_number": getattr(employee, 'employee_number', '') or '',
            "name": f"{employee.first_name} {employee.last_name}".strip(),
            "role": employee.job_title or employee.role or "Educator",
            "is_active": is_active,
            "can_teach": can_teach,
            "requires_ece": requires_ece,
            "has_valid_credential": has_valid_credential,
            "is_qualified": is_qualified,
            "target_date": target_date.isoformat(),
            "disqualification_reasons": disqualification_reasons,
            "active_credentials": cred_summaries,
            "active_certifications": cert_summaries,
            "rule_evaluated": {
                "rule_id": str(rule.id) if rule else None,
                "rule_name": rule.name if rule else "Default System Policy",
                "requires_qualified_ece": requires_ece,
                "qualification_requirement": qualification_req,
                "province": rule.province.code if rule and rule.province else None
            }
        }

    @classmethod
    def is_staff_qualified(
        cls,
        employee: Employee,
        rule: Optional[RatioRule] = None,
        target_date: Optional[date] = None
    ) -> bool:
        """
        Fast boolean check determining whether an employee qualifies under the given rule.
        """
        evaluation = cls.evaluate_staff_qualification(employee, rule, target_date)
        return evaluation["is_qualified"]

    @classmethod
    def evaluate_multiple_staff(
        cls,
        employees: Sequence[Employee],
        rule: Optional[RatioRule] = None,
        target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Evaluates a list of staff members and partitions them into qualified and unqualified.
        """
        if not target_date:
            target_date = timezone.now().date()

        evaluations = []
        qualified = []
        unqualified = []

        for emp in employees:
            ev = cls.evaluate_staff_qualification(emp, rule, target_date)
            evaluations.append(ev)
            if ev["is_qualified"]:
                qualified.append(ev)
            else:
                unqualified.append(ev)

        return {
            "target_date": target_date.isoformat(),
            "total_evaluated": len(evaluations),
            "qualified_count": len(qualified),
            "unqualified_count": len(unqualified),
            "qualified_staff": qualified,
            "unqualified_staff": unqualified,
            "all_evaluations": evaluations
        }

    @classmethod
    def filter_qualified_staff(
        cls,
        daycare: Daycare,
        staff_members: Sequence,
        rule: Optional[RatioRule] = None,
        target_date: Optional[date] = None
    ) -> Tuple[List[Any], List[Any]]:
        """
        Filters staff records/dictionaries into (qualified_staff, unqualified_staff).
        Supports Employee model instances or dicts containing employee_id.
        """
        if not target_date:
            target_date = timezone.now().date()

        qualified = []
        unqualified = []

        for item in staff_members:
            emp = None
            if isinstance(item, Employee):
                emp = item
            elif isinstance(item, dict) and 'employee_id' in item:
                emp = Employee.objects.filter(id=item['employee_id'], daycare=daycare).first()
            elif isinstance(item, str):
                emp = Employee.objects.filter(id=item, daycare=daycare).first()

            if emp and cls.is_staff_qualified(emp, rule, target_date):
                qualified.append(item)
            else:
                unqualified.append(item)

        return qualified, unqualified
