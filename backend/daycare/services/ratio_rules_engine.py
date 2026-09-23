import logging
from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from django.utils import timezone
from django.db.models import Q
from django.contrib.auth import get_user_model

from core.models import (
    Daycare, Classroom, AgeGroup, Program, Province, RatioRule, AuditLog
)

logger = logging.getLogger(__name__)
User = get_user_model()


class RatioRulesEngineService:
    """
    Module 13 Phase 1: Provincial Rules Engine Foundation.
    
    Provides multi-tiered hierarchical rule resolution, historical rule lookups,
    rule versioning with non-overlapping effective dates, and conflict detection.
    """

    @classmethod
    def resolve_applicable_rule(
        cls,
        daycare: Optional[Daycare] = None,
        classroom: Optional[Classroom] = None,
        program: Optional[Program] = None,
        program_type: Optional[str] = None,
        age_group: Optional[AgeGroup] = None,
        age_months: Optional[int] = None,
        target_date: Optional[date] = None,
        province: Optional[Province] = None
    ) -> Dict[str, Any]:
        """
        Resolves the single highest-priority applicable RatioRule for the given parameters and date.
        
        Resolution Priority Hierarchy:
        1. Direct classroom assigned rule (effective on date)
        2. Daycare custom rule: Program + AgeGroup
        3. Daycare custom rule: Program + Age range
        4. Daycare custom rule: AgeGroup
        5. Daycare custom rule: Age range
        6. Provincial baseline rule: Province + Program + AgeGroup
        7. Provincial baseline rule: Province + Program + Age range
        8. Provincial baseline rule: Province + AgeGroup
        9. Provincial baseline rule: Province + Age range
        10. Universal System Baseline fallback
        """
        if not target_date:
            target_date = timezone.now().date()

        if classroom:
            if not daycare:
                daycare = classroom.daycare
            if not program and classroom.program:
                program = classroom.program
            if not age_group and classroom.age_group:
                age_group = classroom.age_group
            c_min = classroom.min_age_months if classroom.min_age_months is not None else 0
            c_max = classroom.max_age_months if classroom.max_age_months is not None else 72
        else:
            c_min = age_months if age_months is not None else 0
            c_max = age_months if age_months is not None else 72

        # Inferred province
        if not province and daycare:
            province = getattr(daycare, 'province', None)
            if not province and daycare.state:
                province = Province.objects.filter(
                    Q(code__iexact=daycare.state) | Q(name__iexact=daycare.state)
                ).first()

        # 1. Direct Classroom Assigned Rule
        if classroom and classroom.ratio_rule and classroom.ratio_rule.is_active:
            r = classroom.ratio_rule
            if r.effective_from <= target_date and (r.effective_to is None or r.effective_to >= target_date):
                return cls._build_rule_result(r, is_custom=True, source="Direct Classroom Assignment", priority=1)

        # 2-5: Daycare Custom Rules
        if daycare:
            daycare_rules = RatioRule.objects.filter(
                daycare=daycare,
                is_active=True,
                effective_from__lte=target_date
            ).filter(
                Q(effective_to__isnull=True) | Q(effective_to__gte=target_date)
            ).select_related('province', 'program', 'age_group')

            # 2. Match program + age_group
            if program and age_group:
                rule = daycare_rules.filter(
                    Q(program=program) | (Q(program_type__iexact=program.name) if hasattr(program, 'name') else Q()),
                    age_group=age_group
                ).first()
                if rule:
                    return cls._build_rule_result(rule, is_custom=True, source="Daycare Program & Age Group Rule", priority=2)

            # 3. Match program + age range
            if program:
                rule = daycare_rules.filter(
                    Q(program=program) | (Q(program_type__iexact=program.name) if hasattr(program, 'name') else Q()),
                    min_age_months__lte=c_min,
                    max_age_months__gte=c_max
                ).first()
                if rule:
                    return cls._build_rule_result(rule, is_custom=True, source="Daycare Program Rule", priority=3)

            # 4. Match age_group
            if age_group:
                rule = daycare_rules.filter(age_group=age_group).first()
                if rule:
                    return cls._build_rule_result(rule, is_custom=True, source="Daycare Age Group Rule", priority=4)

            # 5. Match age range
            rule = daycare_rules.filter(
                min_age_months__lte=c_min,
                max_age_months__gte=c_max
            ).first()
            if rule:
                return cls._build_rule_result(rule, is_custom=True, source="Daycare Age Range Rule", priority=5)

        # 6-9: Provincial Baseline System Rules
        system_rules = RatioRule.objects.filter(
            Q(daycare__isnull=True) | Q(is_system_rule=True),
            is_active=True,
            effective_from__lte=target_date
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=target_date)
        ).select_related('province', 'program', 'age_group')

        if province:
            prov_rules = system_rules.filter(province=province)

            # 6. Provincial program + age group
            if program and age_group:
                rule = prov_rules.filter(
                    Q(program=program) | (Q(program_type__iexact=program.name) if hasattr(program, 'name') else Q()),
                    age_group=age_group
                ).first()
                if rule:
                    return cls._build_rule_result(rule, is_custom=False, source=f"Provincial Base Rule ({province.code})", priority=6)

            # 7. Provincial program + age range
            if program:
                rule = prov_rules.filter(
                    Q(program=program) | (Q(program_type__iexact=program.name) if hasattr(program, 'name') else Q()),
                    min_age_months__lte=c_min,
                    max_age_months__gte=c_max
                ).first()
                if rule:
                    return cls._build_rule_result(rule, is_custom=False, source=f"Provincial Base Rule ({province.code})", priority=7)

            # 8. Provincial age group
            if age_group:
                rule = prov_rules.filter(age_group=age_group).first()
                if rule:
                    return cls._build_rule_result(rule, is_custom=False, source=f"Provincial Base Rule ({province.code})", priority=8)

            # 9. Provincial age range
            rule = prov_rules.filter(
                min_age_months__lte=c_min,
                max_age_months__gte=c_max
            ).first()
            if rule:
                return cls._build_rule_result(rule, is_custom=False, source=f"Provincial Base Rule ({province.code})", priority=9)

        # 10. General System Baseline Rule (no province specified or fallback)
        gen_rules = system_rules.filter(province__isnull=True)
        if age_group:
            rule = gen_rules.filter(age_group=age_group).first()
            if rule:
                return cls._build_rule_result(rule, is_custom=False, source="Universal System Base Rule", priority=10)

        gen_range_rule = gen_rules.filter(
            min_age_months__lte=c_min,
            max_age_months__gte=c_max
        ).first()
        if gen_range_rule:
            return cls._build_rule_result(gen_range_rule, is_custom=False, source="Universal System Base Rule", priority=10)

        # 11. Fallback Default Rule Object
        return cls._build_fallback_result(c_min, c_max, province)

    @classmethod
    def lookup_candidate_rules(
        cls,
        daycare: Optional[Daycare] = None,
        province: Optional[Province] = None,
        program: Optional[Program] = None,
        program_type: Optional[str] = None,
        age_group: Optional[AgeGroup] = None,
        age_months: Optional[int] = None,
        min_age_months: Optional[int] = None,
        max_age_months: Optional[int] = None,
        target_date: Optional[date] = None,
        is_active: bool = True,
        include_system: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Finds all candidate rules matching the criteria, ranked by relevance and specificity.
        """
        if not target_date:
            target_date = timezone.now().date()

        q = Q(is_active=is_active)
        if target_date:
            q &= Q(effective_from__lte=target_date) & (Q(effective_to__isnull=True) | Q(effective_to__gte=target_date))

        # Scope query
        if daycare:
            if include_system:
                sys_q = Q(daycare__isnull=True) | Q(is_system_rule=True)
                if province:
                    sys_q &= (Q(province=province) | Q(province__isnull=True))
                q &= (Q(daycare=daycare) | sys_q)
            else:
                q &= Q(daycare=daycare)
        else:
            if province:
                q &= Q(province=province)
            if not include_system:
                q &= Q(daycare__isnull=False)

        qs = RatioRule.objects.filter(q).select_related('province', 'program', 'age_group', 'daycare')

        # Criteria filters
        if program:
            qs = qs.filter(Q(program=program) | Q(program__isnull=True))
        if program_type:
            qs = qs.filter(Q(program_type__iexact=program_type) | Q(program_type__isnull=True))
        if age_group:
            qs = qs.filter(Q(age_group=age_group) | Q(age_group__isnull=True))

        if age_months is not None:
            qs = qs.filter(min_age_months__lte=age_months, max_age_months__gte=age_months)
        elif min_age_months is not None and max_age_months is not None:
            qs = qs.filter(min_age_months__lte=max_age_months, max_age_months__gte=min_age_months)

        candidate_list = []
        for r in qs.order_by('daycare__isnull', 'province__isnull', 'min_age_months'):
            is_custom = bool(r.daycare_id and daycare and r.daycare_id == daycare.id)
            candidate_list.append(cls._build_rule_result(
                r,
                is_custom=is_custom,
                source="Daycare Custom Rule" if is_custom else (f"Provincial Rule ({r.province.code})" if r.province else "System Baseline Rule"),
                priority=1 if is_custom else 2
            ))

        return candidate_list

    @classmethod
    def version_rule(
        cls,
        rule: RatioRule,
        updated_data: Dict[str, Any],
        effective_date: date,
        user: Optional[Any] = None
    ) -> Tuple[RatioRule, RatioRule]:
        """
        Creates a new version of an existing RatioRule effective from effective_date.
        Closes out the old rule with effective_to = effective_date - 1 day,
        preserving historical compliance records intact.
        """
        if effective_date <= rule.effective_from:
            raise ValueError(
                f"New effective date ({effective_date}) must be after the original rule's start date ({rule.effective_from})."
            )

        # 1. Update old rule's effective_to date
        old_effective_to = rule.effective_to
        rule.effective_to = effective_date - timedelta(days=1)
        if user and not user.is_anonymous:
            rule.updated_by = user
        rule.save()

        # 2. Create new rule starting from effective_date
        new_rule_data = {
            "daycare": rule.daycare,
            "province": rule.province,
            "program": rule.program,
            "program_type": rule.program_type,
            "age_group": rule.age_group,
            "name": updated_data.get("name", rule.name),
            "min_age_months": updated_data.get("min_age_months", rule.min_age_months),
            "max_age_months": updated_data.get("max_age_months", rule.max_age_months),
            "minimum_children": updated_data.get("minimum_children", rule.minimum_children),
            "maximum_children": updated_data.get("maximum_children", rule.maximum_children),
            "required_staff": updated_data.get("required_staff", rule.required_staff),
            "qualified_staff_required": updated_data.get("qualified_staff_required", rule.qualified_staff_required),
            "max_children_per_staff": updated_data.get("max_children_per_staff", rule.max_children_per_staff),
            "warning_threshold_buffer": updated_data.get("warning_threshold_buffer", rule.warning_threshold_buffer),
            "requires_qualified_ece": updated_data.get("requires_qualified_ece", rule.requires_qualified_ece),
            "qualification_requirement": updated_data.get("qualification_requirement", rule.qualification_requirement),
            "effective_from": effective_date,
            "effective_to": updated_data.get("effective_to", old_effective_to),
            "is_system_rule": rule.is_system_rule,
            "is_active": updated_data.get("is_active", True),
            "notes": updated_data.get("notes", rule.notes),
            "created_by": user if (user and not user.is_anonymous) else None,
            "updated_by": user if (user and not user.is_anonymous) else None
        }

        new_rule = RatioRule.objects.create(**new_rule_data)

        # Audit Log
        if user and not user.is_anonymous:
            AuditLog.objects.create(
                user=user,
                user_type='DaycareAdmin' if not getattr(user, 'is_superuser', False) else 'SuperAdmin',
                action='RATIO_RULE_VERSION',
                module='RATIO_MONITORING',
                entity_type='RatioRule',
                entity_id=str(new_rule.id),
                new_values={
                    "previous_rule_id": str(rule.id),
                    "new_rule_id": str(new_rule.id),
                    "effective_from": effective_date.isoformat(),
                    "max_children_per_staff": new_rule.max_children_per_staff
                }
            )

        return rule, new_rule

    @classmethod
    def check_rule_overlap(
        cls,
        daycare: Optional[Daycare] = None,
        province: Optional[Province] = None,
        program: Optional[Program] = None,
        program_type: Optional[str] = None,
        age_group: Optional[AgeGroup] = None,
        min_age_months: int = 0,
        max_age_months: int = 72,
        effective_from: Optional[date] = None,
        effective_to: Optional[date] = None,
        exclude_rule_id: Optional[Any] = None
    ) -> Optional[RatioRule]:
        """
        Checks whether an active ratio rule with overlapping dates and scope already exists.
        Returns the conflicting RatioRule or None.
        """
        if not effective_from:
            effective_from = timezone.now().date()

        qs = RatioRule.objects.filter(is_active=True)
        if exclude_rule_id:
            qs = qs.exclude(id=exclude_rule_id)

        if daycare:
            qs = qs.filter(daycare=daycare)
        else:
            qs = qs.filter(Q(daycare__isnull=True) | Q(is_system_rule=True))
            if province:
                qs = qs.filter(province=province)

        if program:
            qs = qs.filter(program=program)
        elif program_type:
            qs = qs.filter(program_type__iexact=program_type)

        for rule in qs:
            # If both specify programs and they differ, no conflict
            if (program or program_type) and (rule.program or rule.program_type):
                p1 = str(program.id) if program else (program_type or "").lower()
                p2 = str(rule.program.id) if rule.program else (rule.program_type or "").lower()
                if p1 != p2:
                    continue

            # If both specify age groups and they differ, no conflict
            if age_group and rule.age_group:
                if age_group.id != rule.age_group.id:
                    continue
            else:
                e_min = rule.min_age_months if rule.min_age_months is not None else 0
                e_max = rule.max_age_months if rule.max_age_months is not None else 72
                if not (min_age_months < e_max and max_age_months > e_min):
                    continue

            e_start = rule.effective_from
            e_end = rule.effective_to

            start_before_end = (e_end is None or effective_from <= e_end)
            end_after_start = (effective_to is None or effective_to >= e_start)

            if start_before_end and end_after_start:
                return rule

        return None

    @classmethod
    def _build_rule_result(
        cls,
        rule: RatioRule,
        is_custom: bool,
        source: str,
        priority: int
    ) -> Dict[str, Any]:
        """
        Formats a RatioRule instance into a standard structured result dict.
        """
        return {
            "rule_id": str(rule.id),
            "name": rule.name,
            "max_children_per_staff": rule.max_children_per_staff,
            "required_staff": rule.required_staff,
            "minimum_children": rule.minimum_children,
            "maximum_children": rule.maximum_children,
            "qualified_staff_required": rule.qualified_staff_required,
            "warning_threshold_buffer": rule.warning_threshold_buffer,
            "requires_qualified_ece": rule.requires_qualified_ece,
            "qualification_requirement": rule.qualification_requirement,
            "is_custom": is_custom,
            "is_system_rule": rule.is_system_rule,
            "source": source,
            "priority": priority,
            "province": rule.province.code if rule.province else None,
            "province_name": rule.province.name if rule.province else None,
            "program_name": rule.program.name if rule.program else (rule.program_type or None),
            "age_group_name": rule.age_group.name if rule.age_group else None,
            "min_age_months": rule.min_age_months,
            "max_age_months": rule.max_age_months,
            "effective_from": rule.effective_from.isoformat() if rule.effective_from else None,
            "effective_to": rule.effective_to.isoformat() if rule.effective_to else None,
            "notes": rule.notes
        }

    @classmethod
    def _build_fallback_result(
        cls,
        min_age: int,
        max_age: int,
        province: Optional[Province] = None
    ) -> Dict[str, Any]:
        """
        Standard fallback result when no custom or baseline rule matches.
        """
        return {
            "rule_id": None,
            "name": "Default Fallback Ratio Policy (1:8)",
            "max_children_per_staff": 8,
            "required_staff": 1,
            "minimum_children": 0,
            "maximum_children": None,
            "qualified_staff_required": 1,
            "warning_threshold_buffer": 1,
            "requires_qualified_ece": True,
            "qualification_requirement": "Certified ECE",
            "is_custom": False,
            "is_system_rule": True,
            "source": "Default Platform Baseline Fallback",
            "priority": 99,
            "province": province.code if province else None,
            "province_name": province.name if province else None,
            "program_name": None,
            "age_group_name": None,
            "min_age_months": min_age,
            "max_age_months": max_age,
            "effective_from": None,
            "effective_to": None,
            "notes": "System default fallback policy"
        }
