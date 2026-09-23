import logging
from datetime import date, datetime, time
from typing import Optional, Dict, Any, List
from django.utils import timezone
from django.db.models import Q

from core.models import (
    Daycare, Classroom, Student, StudentAttendance, ClassroomStudent, 
    ChildEnrollment, Employee, StaffAttendance, StaffSchedule, 
    ClassroomTeacherAssignment, ECECredential, AgeGroup, RatioRule, 
    LeaveRequest, Province, RatioManualOverride, RatioComplianceHistory
)
from daycare.services.qualified_staff import QualifiedStaffService
from daycare.services.ratio_rules_engine import RatioRulesEngineService

logger = logging.getLogger(__name__)


class RatioMonitoringService:
    """
    Module 13 Phase 4: Provincial Configuration, Live Ratio Calculation,
    Rule Explanations, Manual Overrides, and Immutable Compliance History.
    """

    @staticmethod
    def get_children_present(
        classroom: Classroom, 
        target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        PART A: Determine children currently present based on actual attendance.
        
        Do NOT count:
        - withdrawn children
        - inactive enrollments
        - children belonging to another daycare
        - children who have checked out
        """
        if not target_date:
            target_date = timezone.now().date()

        daycare = classroom.daycare

        # 1. Base query for attendance on target date and daycare
        attendance_qs = StudentAttendance.objects.filter(
            daycare=daycare,
            attendance_date=target_date,
            check_in_time__isnull=False,
            check_out_time__isnull=True
        ).filter(
            attendance_status__in=['PRESENT', 'LATE']
        ).select_related('student', 'classroom')

        # 2. Scope to classroom: either recorded on attendance or student is enrolled in classroom
        enrolled_student_ids = ClassroomStudent.objects.filter(
            classroom=classroom,
            status='Active'
        ).values_list('student_id', flat=True)

        classroom_attendance = attendance_qs.filter(
            Q(classroom=classroom) | (Q(classroom__isnull=True) & Q(student_id__in=enrolled_student_ids))
        ).distinct()

        present_children = []
        for att in classroom_attendance:
            student = att.student
            
            # Tenant isolation
            if student.daycare_id != daycare.id:
                continue

            # Withdrawn check on student model
            if student.status and student.status.lower() == 'withdrawn':
                continue

            # Withdrawn check on ChildEnrollment model
            withdrawn_enrollment = ChildEnrollment.objects.filter(
                student=student,
                status__iexact='withdrawn'
            ).exists()
            if withdrawn_enrollment:
                continue

            # Check if student is actively enrolled in this classroom (if ClassroomStudent exists)
            enrollment_record = ClassroomStudent.objects.filter(
                classroom=classroom,
                student=student
            ).first()
            if enrollment_record and enrollment_record.status.lower() != 'active':
                continue

            # Calculate child age in months if birth date is available
            age_months = None
            if hasattr(student, 'dob') and student.dob:
                dob = student.dob
                age_months = (target_date.year - dob.year) * 12 + (target_date.month - dob.month)
            elif hasattr(student, 'date_of_birth') and student.date_of_birth:
                dob = student.date_of_birth
                age_months = (target_date.year - dob.year) * 12 + (target_date.month - dob.month)

            present_children.append({
                "student_id": str(student.id),
                "name": f"{student.first_name} {student.last_name}",
                "admission_number": getattr(student, 'admission_number', '') or '',
                "check_in_time": att.check_in_time.strftime('%H:%M:%S') if att.check_in_time else None,
                "age_months": age_months,
                "attendance_id": str(att.id),
                "attendance_status": att.attendance_status
            })

        return {
            "children": present_children,
            "count": len(present_children)
        }

    @staticmethod
    def get_qualified_staff_present(
        classroom: Classroom,
        target_date: Optional[date] = None,
        target_time: Optional[time] = None,
        requires_ece: bool = True
    ) -> Dict[str, Any]:
        """
        PART B & C: Determine staff currently present using actual staff attendance and ECE credentials.
        
        A staff member should NOT count as present if:
        - not clocked in
        - clocked out
        - on approved leave
        - inactive/terminated
        - outside relevant assignment where applicable
        """
        if not target_date:
            target_date = timezone.now().date()
        if not target_time:
            target_time = timezone.now().time()

        daycare = classroom.daycare

        # 1. Identify staff eligible / assigned to this classroom
        # A) Classroom direct teacher assignments
        teacher_emp_ids = set(
            ClassroomTeacherAssignment.objects.filter(
                classroom=classroom,
                daycare=daycare,
                status='Active'
            ).values_list('employee_id', flat=True)
        )

        # B) Classroom scheduled staff for target_date
        scheduled_emp_ids = set(
            StaffSchedule.objects.filter(
                classroom=classroom,
                daycare=daycare,
                date=target_date
            ).exclude(status='cancelled').values_list('employee_id', flat=True)
        )

        # C) Classroom direct staff relations (if user linked to employee)
        if classroom.primary_teacher:
            pe = Employee.objects.filter(user=classroom.primary_teacher, daycare=daycare, is_active=True).first()
            if pe:
                teacher_emp_ids.add(pe.id)
        if classroom.assistant_teacher:
            ae = Employee.objects.filter(user=classroom.assistant_teacher, daycare=daycare, is_active=True).first()
            if ae:
                teacher_emp_ids.add(ae.id)

        # D) Staff with attendance specifically logged for this classroom
        direct_att_emp_ids = set(
            StaffAttendance.objects.filter(
                classroom=classroom,
                daycare=daycare,
                date=target_date
            ).values_list('employee_id', flat=True)
        )

        eligible_emp_ids = teacher_emp_ids | scheduled_emp_ids | direct_att_emp_ids

        # 2. Get active staff attendances on target_date
        staff_att_qs = StaffAttendance.objects.filter(
            daycare=daycare,
            date=target_date,
            clock_in__isnull=False,
            clock_out__isnull=True
        ).exclude(
            status__in=['CLOCKED_OUT', 'ABSENT', 'EXCUSED', 'AUTO_CLOSED']
        ).select_related('employee', 'classroom')

        matching_attendances = []
        for sa in staff_att_qs:
            emp = sa.employee
            
            # Tenant isolation
            if emp.daycare_id != daycare.id:
                continue

            # Inactive or terminated staff check
            if not emp.status or emp.status.lower() != 'active':
                continue

            # Approved leave check
            is_on_approved_leave = LeaveRequest.objects.filter(
                employee=emp,
                status='approved',
                start_date__lte=target_date,
                end_date__gte=target_date
            ).exists()
            if is_on_approved_leave:
                continue

            # Classroom assignment check
            if sa.classroom_id:
                if sa.classroom_id == classroom.id:
                    matching_attendances.append(sa)
            else:
                if emp.id in eligible_emp_ids:
                    matching_attendances.append(sa)

        all_present_staff = []
        qualified_staff = []
        unqualified_staff = []

        for sa in matching_attendances:
            emp = sa.employee
            
            # ECE Credential Qualification Check
            active_creds = ECECredential.objects.filter(
                employee=emp,
                daycare=daycare,
                status='Active'
            ).exclude(
                status__in=['Expired', 'Revoked', 'Suspended', 'Inactive', 'Superseded']
            ).filter(
                Q(expiry_date__gte=target_date) | Q(expiry_date__isnull=True)
            )

            is_qualified = active_creds.exists() if requires_ece else True
            cred_names = list(active_creds.values_list('credential_type__name', flat=True))

            clock_in_str = None
            if sa.clock_in:
                clock_in_str = sa.clock_in.strftime('%H:%M:%S')
            elif sa.check_in_time:
                clock_in_str = sa.check_in_time.strftime('%H:%M:%S')

            staff_info = {
                "employee_id": str(emp.id),
                "name": f"{emp.first_name} {emp.last_name}",
                "role": emp.job_title or emp.role or "Educator",
                "employee_number": getattr(emp, 'employee_number', '') or '',
                "clock_in_time": clock_in_str,
                "status": sa.status,
                "is_qualified": is_qualified,
                "credentials": cred_names,
                "attendance_id": str(sa.id)
            }

            all_present_staff.append(staff_info)
            if is_qualified:
                qualified_staff.append(staff_info)
            else:
                unqualified_staff.append(staff_info)

        return {
            "all_present_staff": all_present_staff,
            "qualified_staff": qualified_staff,
            "unqualified_staff": unqualified_staff,
            "qualified_count": len(qualified_staff),
            "total_count": len(all_present_staff)
        }

    @classmethod
    def resolve_ratio_rule(
        cls, 
        classroom: Classroom, 
        target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        PART A, B, C: Resolves the applicable RatioRule using:
        1. Explicit classroom rule
        2. Daycare custom rule matching Program, AgeGroup, and Effective Date
        3. Provincial baseline rule matching Province, Program, AgeGroup, and Effective Date
        4. Standard fallback default
        """
        if not target_date:
            target_date = timezone.now().date()

        daycare = classroom.daycare
        c_min = classroom.min_age_months or 0
        c_max = classroom.max_age_months or 72

        # 1. Direct classroom rule (if effective and active)
        if classroom.ratio_rule and classroom.ratio_rule.is_active:
            r = classroom.ratio_rule
            if r.effective_from <= target_date and (r.effective_to is None or r.effective_to >= target_date):
                return cls._build_rule_dict(r, is_custom=True, explanation_source="Direct Classroom Assignment")

        # 2. Daycare custom rule matching Program & AgeGroup & Effective Date
        daycare_rules = RatioRule.objects.filter(
            daycare=daycare,
            is_active=True,
            effective_from__lte=target_date
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=target_date)
        )

        # 2A: Match program + age_group
        if classroom.program and classroom.age_group:
            p_ag_rule = daycare_rules.filter(program=classroom.program, age_group=classroom.age_group).first()
            if p_ag_rule:
                return cls._build_rule_dict(p_ag_rule, is_custom=True, explanation_source="Daycare Program & Age Group Rule")

        # 2B: Match program + age range
        if classroom.program:
            p_range_rule = daycare_rules.filter(
                program=classroom.program,
                min_age_months__lte=c_min,
                max_age_months__gte=c_max
            ).first()
            if p_range_rule:
                return cls._build_rule_dict(p_range_rule, is_custom=True, explanation_source="Daycare Program Rule")

        # 2C: Match age_group
        if classroom.age_group:
            ag_rule = daycare_rules.filter(age_group=classroom.age_group).first()
            if ag_rule:
                return cls._build_rule_dict(ag_rule, is_custom=True, explanation_source="Daycare Age Group Rule")

        # 2D: Match age range
        range_rule = daycare_rules.filter(
            min_age_months__lte=c_min,
            max_age_months__gte=c_max
        ).first()
        if range_rule:
            return cls._build_rule_dict(range_rule, is_custom=True, explanation_source="Daycare Age Range Rule")

        # 3. Provincial Baseline System Rules (where daycare is None or is_system_rule=True)
        province = getattr(daycare, 'province', None)
        if not province and daycare.state:
            province = Province.objects.filter(
                Q(code__iexact=daycare.state) | Q(name__iexact=daycare.state)
            ).first()

        system_rules = RatioRule.objects.filter(
            Q(daycare__isnull=True) | Q(is_system_rule=True),
            is_active=True,
            effective_from__lte=target_date
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=target_date)
        )

        if province:
            prov_rules = system_rules.filter(province=province)
            
            # 3A: Provincial program + age group
            if classroom.program and classroom.age_group:
                prov_p_ag_rule = prov_rules.filter(
                    Q(program=classroom.program) | Q(program_type__iexact=classroom.program.name),
                    age_group=classroom.age_group
                ).first()
                if prov_p_ag_rule:
                    return cls._build_rule_dict(prov_p_ag_rule, is_custom=False, explanation_source=f"Provincial Base Rule ({province.code})")

            # 3B: Provincial age group
            if classroom.age_group:
                prov_ag_rule = prov_rules.filter(age_group=classroom.age_group).first()
                if prov_ag_rule:
                    return cls._build_rule_dict(prov_ag_rule, is_custom=False, explanation_source=f"Provincial Base Rule ({province.code})")

            # 3C: Provincial age range
            prov_range_rule = prov_rules.filter(
                min_age_months__lte=c_min,
                max_age_months__gte=c_max
            ).first()
            if prov_range_rule:
                return cls._build_rule_dict(prov_range_rule, is_custom=False, explanation_source=f"Provincial Base Rule ({province.code})")

        # 4. Standard Default Fallback
        max_age = c_max
        if classroom.age_group and classroom.age_group.max_age_months:
            max_age = classroom.age_group.max_age_months

        if max_age <= 18:
            ratio_val = 3
            rule_name = "Infant Standard"
        elif max_age <= 30:
            ratio_val = 5
            rule_name = "Toddler Standard"
        elif max_age <= 60:
            ratio_val = 8
            rule_name = "Preschool Standard"
        else:
            ratio_val = 10
            rule_name = "Kindergarten / School Age Standard"

        prov_code = province.code if province else "Standard"
        prov_name = province.name if province else "General"

        return {
            "rule_id": None,
            "name": f"{rule_name} (1:{ratio_val})",
            "province_code": prov_code,
            "province_name": prov_name,
            "program_name": classroom.program.name if classroom.program else "All Programs",
            "age_group_name": classroom.age_group.name if classroom.age_group else f"{c_min}-{c_max} months",
            "effective_from": "2026-01-01",
            "effective_to": None,
            "max_children_per_staff": ratio_val,
            "warning_threshold_buffer": 1,
            "requires_qualified_ece": True,
            "qualification_requirement": "Certified ECE",
            "is_custom": False,
            "is_system_rule": True,
            "explanation_source": "System Default Ratio Policy"
        }

    @staticmethod
    def _build_rule_dict(rule: RatioRule, is_custom: bool, explanation_source: str) -> Dict[str, Any]:
        return {
            "rule_id": str(rule.id),
            "name": rule.name,
            "province_code": rule.province.code if rule.province else "General",
            "province_name": rule.province.name if rule.province else "General",
            "program_name": rule.program.name if rule.program else (rule.program_type or "All Programs"),
            "age_group_name": rule.age_group.name if rule.age_group else f"{rule.min_age_months}-{rule.max_age_months} months",
            "effective_from": rule.effective_from.isoformat() if rule.effective_from else None,
            "effective_to": rule.effective_to.isoformat() if rule.effective_to else None,
            "max_children_per_staff": rule.max_children_per_staff,
            "warning_threshold_buffer": rule.warning_threshold_buffer,
            "requires_qualified_ece": rule.requires_qualified_ece,
            "qualification_requirement": rule.qualification_requirement or ("Certified ECE" if rule.requires_qualified_ece else "General Staff"),
            "is_custom": is_custom,
            "is_system_rule": rule.is_system_rule,
            "explanation_source": explanation_source
        }

    @classmethod
    def calculate_classroom_ratio(
        cls,
        classroom: Classroom,
        target_date: Optional[date] = None,
        target_time: Optional[time] = None
    ) -> Dict[str, Any]:
        """
        PART C, D & E: Calculate live ratio, rule explanation, manual overrides, and compliance status.
        """
        if not target_date:
            target_date = timezone.now().date()
        if not target_time:
            target_time = timezone.now().time()

        # 1. Resolve ratio configuration
        rule_config = cls.resolve_ratio_rule(classroom, target_date=target_date)
        max_children_per_staff = rule_config["max_children_per_staff"]
        warning_buffer = rule_config["warning_threshold_buffer"]
        requires_ece = rule_config["requires_qualified_ece"]

        # 2. Get children and staff present
        children_data = cls.get_children_present(classroom, target_date=target_date)
        children_present_count = children_data["count"]

        staff_data = cls.get_qualified_staff_present(
            classroom, 
            target_date=target_date, 
            target_time=target_time,
            requires_ece=requires_ece
        )
        qualified_staff_count = staff_data["qualified_count"]
        total_staff_count = staff_data["total_count"]

        # 3. Determine required qualified staff
        if children_present_count == 0:
            required_staff = 0
        else:
            required_staff = (children_present_count + max_children_per_staff - 1) // max_children_per_staff

        # 4. Formatted ratio string
        ratio_str = f"{children_present_count}:{qualified_staff_count}"

        # 5. Calculated Status (underlying algorithmic status)
        if children_present_count > 0 and qualified_staff_count == 0:
            calculated_status = "NON_COMPLIANT"
            status_display = "Staff Required (Non-Compliant)"
        elif children_present_count == 0:
            calculated_status = "COMPLIANT"
            status_display = "Compliant (Room Empty)"
        else:
            max_capacity_supported = qualified_staff_count * max_children_per_staff
            if children_present_count > max_capacity_supported:
                calculated_status = "NON_COMPLIANT"
                status_display = f"Non-Compliant (Short by {required_staff - qualified_staff_count} staff)"
            elif (max_capacity_supported - children_present_count) <= warning_buffer:
                calculated_status = "WARNING"
                status_display = "Warning (Approaching Ratio Limit)"
            else:
                calculated_status = "COMPLIANT"
                status_display = "Compliant"

        # 6. Check Active Manual Override (PART E)
        # Manual override NEVER deletes or alters the underlying calculated ratio.
        active_override = RatioManualOverride.objects.filter(
            classroom=classroom,
            daycare=classroom.daycare,
            is_active=True
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
        ).select_related('created_by').first()

        override_applied = False
        override_data = None
        final_status = calculated_status

        if active_override:
            override_applied = True
            final_status = active_override.override_status
            creator_name = active_override.created_by.get_full_name() or active_override.created_by.username
            override_data = {
                "id": str(active_override.id),
                "override_status": active_override.override_status,
                "reason": active_override.reason,
                "created_by": creator_name,
                "created_at": active_override.created_at.isoformat(),
                "expires_at": active_override.expires_at.isoformat() if active_override.expires_at else None,
                "is_active": active_override.is_active,
                "is_expired": active_override.is_expired
            }
            status_display = f"Overridden: {active_override.get_override_status_display()} ({active_override.reason})"

        # 7. Construct Rule Explanation (PART C)
        rule_explanation = {
            "applicable_rule": rule_config["name"],
            "rule_id": rule_config.get("rule_id"),
            "province": rule_config.get("province_name", "General"),
            "province_code": rule_config.get("province_code", "General"),
            "program": rule_config.get("program_name", "All Programs"),
            "age_group": rule_config.get("age_group_name", "General"),
            "effective_date": rule_config.get("effective_from", "Ongoing"),
            "max_children_per_staff": max_children_per_staff,
            "required_staff": required_staff,
            "qualification_requirement": rule_config.get("qualification_requirement", "Certified ECE"),
            "explanation_source": rule_config.get("explanation_source", "Policy"),
            "explanation_text": (
                f"Rule '{rule_config['name']}' ({rule_config.get('province_code', 'General')}) mandates 1 staff per "
                f"{max_children_per_staff} children. With {children_present_count} children present, {required_staff} "
                f"qualified educator(s) ({rule_config.get('qualification_requirement', 'Certified ECE')}) are required."
            ),
            "disclaimer": "Note: Configurable policy rules maintained by authorized administrators."
        }

        return {
            "classroom_id": str(classroom.id),
            "classroom_name": classroom.room_name,
            "room_code": classroom.room_code or "",
            "age_group": classroom.age_group.name if classroom.age_group else "General",
            "capacity": classroom.capacity or 0,
            "rule": rule_config,
            "rule_explanation": rule_explanation,
            "children_present": children_present_count,
            "qualified_staff_present": qualified_staff_count,
            "total_staff_present": total_staff_count,
            "unqualified_staff_present": len(staff_data["unqualified_staff"]),
            "required_staff": required_staff,
            "ratio": ratio_str,
            "calculated_status": calculated_status,
            "status": final_status,
            "final_status": final_status,
            "status_display": status_display,
            "override_applied": override_applied,
            "override": override_data,
            "children": children_data["children"],
            "staff": staff_data["all_present_staff"],
            "calculated_at": timezone.now().isoformat()
        }

    @classmethod
    def log_compliance_snapshot(
        cls, 
        classroom: Classroom,
        target_date: Optional[date] = None,
        target_time: Optional[time] = None
    ) -> RatioComplianceHistory:
        """
        PART D: Store immutable historical compliance evaluation log with rule snapshot.
        """
        result = cls.calculate_classroom_ratio(classroom, target_date=target_date, target_time=target_time)
        
        rule_obj = None
        if result["rule"].get("rule_id"):
            try:
                rule_obj = RatioRule.objects.get(id=result["rule"]["rule_id"])
            except RatioRule.DoesNotExist:
                pass

        # Capture complete immutable snapshot of rule and evaluation
        rule_snapshot = {
            "name": result["rule"]["name"],
            "max_children_per_staff": result["rule"]["max_children_per_staff"],
            "warning_threshold_buffer": result["rule"]["warning_threshold_buffer"],
            "requires_qualified_ece": result["rule"]["requires_qualified_ece"],
            "qualification_requirement": result["rule"].get("qualification_requirement", "Certified ECE"),
            "province_code": result["rule"].get("province_code"),
            "province_name": result["rule"].get("province_name"),
            "program_name": result["rule"].get("program_name"),
            "age_group_name": result["rule"].get("age_group_name"),
            "effective_from": result["rule"].get("effective_from"),
            "explanation_source": result["rule"].get("explanation_source")
        }

        override_info = result.get("override") or {}

        history = RatioComplianceHistory.objects.create(
            daycare=classroom.daycare,
            classroom=classroom,
            evaluated_at=timezone.now(),
            children_present=result["children_present"],
            qualified_staff_present=result["qualified_staff_present"],
            total_staff_present=result["total_staff_present"],
            required_staff=result["required_staff"],
            calculated_ratio=result["ratio"],
            calculated_status=result["calculated_status"],
            rule_used=rule_obj,
            rule_snapshot=rule_snapshot,
            override_applied=result["override_applied"],
            override_status=override_info.get("override_status"),
            override_reason=override_info.get("reason"),
            final_status=result["status"]
        )

        return history

    @classmethod
    def bulk_log_daycare_compliance(
        cls, 
        daycare: Daycare,
        target_date: Optional[date] = None,
        target_time: Optional[time] = None
    ) -> List[RatioComplianceHistory]:
        """
        Logs snapshots for all active classrooms of a daycare.
        """
        logs = []
        for classroom in daycare.classrooms.filter(deleted_at__isnull=True, status='Active'):
            logs.append(cls.log_compliance_snapshot(classroom, target_date=target_date, target_time=target_time))
        return logs

    @classmethod
    def get_daycare_ratio_summary(
        cls, 
        daycare: Daycare, 
        target_date: Optional[date] = None,
        target_time: Optional[time] = None
    ) -> Dict[str, Any]:
        """
        Aggregates live ratio calculation across all classrooms of a daycare.
        """
        if not target_date:
            target_date = timezone.now().date()
        if not target_time:
            target_time = timezone.now().time()

        classrooms = daycare.classrooms.filter(
            deleted_at__isnull=True,
            status='Active'
        ).select_related('age_group', 'ratio_rule', 'program')

        classroom_results = []
        total_children = 0
        total_qualified_staff = 0
        total_required_staff = 0
        compliant_count = 0
        warning_count = 0
        non_compliant_count = 0
        overridden_count = 0

        for room in classrooms:
            ratio_res = cls.calculate_classroom_ratio(room, target_date=target_date, target_time=target_time)
            classroom_results.append(ratio_res)

            total_children += ratio_res["children_present"]
            total_qualified_staff += ratio_res["qualified_staff_present"]
            total_required_staff += ratio_res["required_staff"]

            if ratio_res["override_applied"]:
                overridden_count += 1

            if ratio_res["status"] == "COMPLIANT":
                compliant_count += 1
            elif ratio_res["status"] == "WARNING":
                warning_count += 1
            elif ratio_res["status"] == "NON_COMPLIANT":
                non_compliant_count += 1

        overall_status = "COMPLIANT"
        if non_compliant_count > 0:
            overall_status = "NON_COMPLIANT"
        elif warning_count > 0:
            overall_status = "WARNING"

        prov = getattr(daycare, 'province', None)
        if not prov and daycare.state:
            prov = Province.objects.filter(
                Q(code__iexact=daycare.state) | Q(name__iexact=daycare.state)
            ).first()

        return {
            "daycare_id": str(daycare.id),
            "daycare_name": daycare.name,
            "province_code": prov.code if prov else (daycare.state or "General"),
            "province_name": prov.name if prov else (daycare.state or "General"),
            "target_date": target_date.isoformat(),
            "target_time": target_time.strftime('%H:%M:%S'),
            "total_classrooms": len(classroom_results),
            "total_children_present": total_children,
            "total_qualified_staff_present": total_qualified_staff,
            "total_required_staff": total_required_staff,
            "compliant_classrooms_count": compliant_count,
            "warning_classrooms_count": warning_count,
            "non_compliant_classrooms_count": non_compliant_count,
            "overridden_classrooms_count": overridden_count,
            "overall_status": overall_status,
            "classrooms": classroom_results,
            "timestamp": timezone.now().isoformat()
        }
