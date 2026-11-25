import io
import csv
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
from django.utils import timezone
from django.db.models import Q, Count

from core.models import (
    Daycare, Classroom, RatioRule, RatioManualOverride, RatioComplianceHistory,
    Employee, ECECredential, Province, Program, AgeGroup
)
from daycare.services.ratio_monitoring import RatioMonitoringService


class RatioReportsService:
    """
    Module 13 Phase 5: Comprehensive Staff-to-Child Ratio Reports Service.
    Generates structured report datasets and CSV exports for:
    1. Daily Ratio Report
    2. Classroom Compliance Report
    3. Staff Shortage Report
    4. Ratio Violation Report
    5. Staff Qualification Report (reusing Module 8 ECE Credential Management)
    6. Ratio History Report
    7. Provincial Rule Configuration Report
    """

    @classmethod
    def generate_report(
        cls, 
        daycare: Daycare, 
        report_type: str, 
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        filters = filters or {}
        report_type = (report_type or 'daily_ratio').lower()

        if report_type == 'daily_ratio':
            return cls.generate_daily_ratio_report(daycare, filters)
        elif report_type == 'classroom_compliance':
            return cls.generate_classroom_compliance_report(daycare, filters)
        elif report_type == 'staff_shortages':
            return cls.generate_staff_shortage_report(daycare, filters)
        elif report_type == 'violations':
            return cls.generate_ratio_violation_report(daycare, filters)
        elif report_type == 'qualified_staff':
            return cls.generate_staff_qualification_report(daycare, filters)
        elif report_type == 'ratio_history':
            return cls.generate_ratio_history_report(daycare, filters)
        elif report_type == 'provincial_rules':
            return cls.generate_provincial_rules_report(daycare, filters)
        else:
            return cls.generate_daily_ratio_report(daycare, filters)

    @classmethod
    def generate_daily_ratio_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        1. Daily Ratio Report
        For each classroom shows:
        - Children present
        - Qualified staff present
        - Required staff
        - Calculated ratio
        - Status
        - Rule used
        """
        target_date = cls._parse_date(filters.get('date')) or timezone.now().date()
        target_time = cls._parse_time(filters.get('time')) or timezone.now().time()

        classrooms = daycare.classrooms.filter(deleted_at__isnull=True, status='Active')
        classroom_id = filters.get('classroom') or filters.get('classroom_id')
        if classroom_id and classroom_id != 'all':
            classrooms = classrooms.filter(id=classroom_id)

        branch_id = filters.get('branch') or filters.get('branch_id')
        if branch_id and branch_id != 'all':
            classrooms = classrooms.filter(branch_id=branch_id)

        age_group_id = filters.get('age_group') or filters.get('age_group_id')
        if age_group_id and age_group_id != 'all':
            classrooms = classrooms.filter(age_group_id=age_group_id)

        program_id = filters.get('program') or filters.get('program_id')
        if program_id and program_id != 'all':
            classrooms = classrooms.filter(program_id=program_id)

        records = []
        compliant_count = 0
        warning_count = 0
        non_compliant_count = 0
        total_children = 0
        total_staff = 0
        total_required_staff = 0

        status_filter = filters.get('status')
        if status_filter and status_filter.upper() == 'ALL':
            status_filter = None

        for room in classrooms.select_related('age_group', 'program', 'branch'):
            res = RatioMonitoringService.calculate_classroom_ratio(
                room, target_date=target_date, target_time=target_time
            )

            if status_filter and res['status'].upper() != status_filter.upper():
                continue

            record = {
                "classroom_id": str(room.id),
                "classroom_name": room.room_name,
                "room_code": room.room_code or "",
                "branch_name": room.branch.name if room.branch else "Main Branch",
                "age_group": room.age_group.name if room.age_group else "General",
                "program": room.program.name if room.program else "General",
                "children_present": res["children_present"],
                "qualified_staff_present": res["qualified_staff_present"],
                "total_staff_present": res["total_staff_present"],
                "required_staff": res["required_staff"],
                "calculated_ratio": res["ratio"],
                "status": res["status"],
                "calculated_status": res["calculated_status"],
                "status_display": res["status_display"],
                "rule_name": res["rule"]["name"],
                "rule_ratio": f"1:{res['rule']['max_children_per_staff']}",
                "qualification_requirement": res["rule"].get("qualification_requirement", "Certified ECE"),
                "override_applied": res["override_applied"],
                "override_reason": res.get("override", {}).get("reason") if res.get("override") else None,
                "date": target_date.isoformat(),
                "time": target_time.strftime('%H:%M:%S')
            }
            records.append(record)

            total_children += res["children_present"]
            total_staff += res["qualified_staff_present"]
            total_required_staff += res["required_staff"]

            if res["status"] == "COMPLIANT":
                compliant_count += 1
            elif res["status"] == "WARNING":
                warning_count += 1
            elif res["status"] == "NON_COMPLIANT":
                non_compliant_count += 1

        summary = {
            "total_classrooms": len(records),
            "compliant_count": compliant_count,
            "warning_count": warning_count,
            "non_compliant_count": non_compliant_count,
            "total_children_present": total_children,
            "total_qualified_staff_present": total_staff,
            "total_required_staff": total_required_staff,
            "compliance_rate": round((compliant_count / len(records) * 100), 1) if records else 100.0,
            "date": target_date.isoformat()
        }

        # Build CSV
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow([
            "Classroom", "Room Code", "Branch", "Age Group", "Program",
            "Children Present", "Qualified Staff", "Required Staff",
            "Calculated Ratio", "Status", "Rule Used", "Override Applied"
        ])
        for r in records:
            writer.writerow([
                r["classroom_name"], r["room_code"], r["branch_name"], r["age_group"], r["program"],
                r["children_present"], r["qualified_staff_present"], r["required_staff"],
                r["calculated_ratio"], r["status"], r["rule_name"], "Yes" if r["override_applied"] else "No"
            ])

        return {
            "report_type": "daily_ratio",
            "title": "Daily Staff-to-Child Ratio Report",
            "date": target_date.isoformat(),
            "summary": summary,
            "records": records,
            "csv_content": csv_buffer.getvalue()
        }

    @classmethod
    def generate_classroom_compliance_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        2. Classroom Compliance Report
        Aggregates historical compliance over a date range per classroom.
        """
        start_date = cls._parse_date(filters.get('start_date')) or (timezone.now().date() - timedelta(days=7))
        end_date = cls._parse_date(filters.get('end_date')) or timezone.now().date()

        history_qs = RatioComplianceHistory.objects.filter(
            daycare=daycare,
            evaluated_at__date__gte=start_date,
            evaluated_at__date__lte=end_date
        ).select_related('classroom', 'classroom__branch', 'classroom__age_group', 'classroom__program')

        classroom_id = filters.get('classroom') or filters.get('classroom_id')
        if classroom_id and classroom_id != 'all':
            history_qs = history_qs.filter(classroom_id=classroom_id)

        # Aggregate by classroom
        room_stats: Dict[str, Dict[str, Any]] = {}
        for h in history_qs:
            cid = str(h.classroom_id)
            if cid not in room_stats:
                room_stats[cid] = {
                    "classroom_id": cid,
                    "classroom_name": h.classroom.room_name if h.classroom else "Unknown Room",
                    "room_code": h.classroom.room_code if h.classroom else "",
                    "branch_name": h.classroom.branch.name if h.classroom and h.classroom.branch else "Main Branch",
                    "age_group": h.classroom.age_group.name if h.classroom and h.classroom.age_group else "General",
                    "program": h.classroom.program.name if h.classroom and h.classroom.program else "General",
                    "total_evaluations": 0,
                    "compliant_count": 0,
                    "warning_count": 0,
                    "non_compliant_count": 0,
                    "overridden_count": 0,
                    "avg_children": 0,
                    "avg_staff": 0,
                    "_sum_children": 0,
                    "_sum_staff": 0
                }

            st = room_stats[cid]
            st["total_evaluations"] += 1
            st["_sum_children"] += h.children_present
            st["_sum_staff"] += h.qualified_staff_present

            if h.override_applied:
                st["overridden_count"] += 1

            if h.final_status == "COMPLIANT":
                st["compliant_count"] += 1
            elif h.final_status == "WARNING":
                st["warning_count"] += 1
            elif h.final_status == "NON_COMPLIANT":
                st["non_compliant_count"] += 1

        records = []
        for cid, st in room_stats.items():
            tot = st["total_evaluations"]
            st["avg_children"] = round(st["_sum_children"] / tot, 1) if tot else 0
            st["avg_staff"] = round(st["_sum_staff"] / tot, 1) if tot else 0
            st["compliance_rate"] = round((st["compliant_count"] / tot * 100), 1) if tot else 100.0
            del st["_sum_children"]
            del st["_sum_staff"]
            records.append(st)

        records.sort(key=lambda x: x["compliance_rate"])

        summary = {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_classrooms_evaluated": len(records),
            "total_evaluations": sum(r["total_evaluations"] for r in records),
            "total_violations": sum(r["non_compliant_count"] for r in records),
            "overall_compliance_rate": round(
                (sum(r["compliant_count"] for r in records) / max(1, sum(r["total_evaluations"] for r in records))) * 100, 1
            ) if records else 100.0
        }

        # Build CSV
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow([
            "Classroom", "Room Code", "Branch", "Age Group", "Program",
            "Total Evaluations", "Compliant", "Warnings", "Non-Compliant",
            "Overrides", "Compliance Rate (%)", "Avg Children", "Avg Staff"
        ])
        for r in records:
            writer.writerow([
                r["classroom_name"], r["room_code"], r["branch_name"], r["age_group"], r["program"],
                r["total_evaluations"], r["compliant_count"], r["warning_count"], r["non_compliant_count"],
                r["overridden_count"], f"{r['compliance_rate']}%", r["avg_children"], r["avg_staff"]
            ])

        return {
            "report_type": "classroom_compliance",
            "title": "Classroom Compliance Summary Report",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "summary": summary,
            "records": records,
            "csv_content": csv_buffer.getvalue()
        }

    @classmethod
    def generate_staff_shortage_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        3. Staff Shortage Report
        Identifies rooms where required staff exceeds qualified staff present.
        """
        target_date = cls._parse_date(filters.get('date')) or timezone.now().date()
        target_time = cls._parse_time(filters.get('time')) or timezone.now().time()

        classrooms = daycare.classrooms.filter(deleted_at__isnull=True, status='Active')
        
        classroom_id = filters.get('classroom') or filters.get('classroom_id')
        if classroom_id and classroom_id != 'all':
            classrooms = classrooms.filter(id=classroom_id)

        records = []
        total_deficit = 0
        total_affected_children = 0

        for room in classrooms.select_related('age_group', 'program', 'branch'):
            res = RatioMonitoringService.calculate_classroom_ratio(
                room, target_date=target_date, target_time=target_time
            )

            req = res["required_staff"]
            qual = res["qualified_staff_present"]
            deficit = max(0, req - qual)

            if deficit > 0 or res["status"] == "NON_COMPLIANT":
                urgency = "HIGH" if deficit >= 2 or qual == 0 else "MEDIUM"
                record = {
                    "classroom_id": str(room.id),
                    "classroom_name": room.room_name,
                    "room_code": room.room_code or "",
                    "branch_name": room.branch.name if room.branch else "Main Branch",
                    "age_group": room.age_group.name if room.age_group else "General",
                    "program": room.program.name if room.program else "General",
                    "children_present": res["children_present"],
                    "qualified_staff_present": qual,
                    "required_staff": req,
                    "staff_deficit": deficit,
                    "urgency": urgency,
                    "status": res["status"],
                    "calculated_ratio": res["ratio"],
                    "rule_used": res["rule"]["name"],
                    "qualification_requirement": res["rule"].get("qualification_requirement", "Certified ECE"),
                    "date": target_date.isoformat(),
                    "time": target_time.strftime('%H:%M:%S')
                }
                records.append(record)
                total_deficit += deficit
                total_affected_children += res["children_present"]

        records.sort(key=lambda x: (0 if x["urgency"] == "HIGH" else 1, -x["staff_deficit"]))

        summary = {
            "date": target_date.isoformat(),
            "shortage_rooms_count": len(records),
            "total_staff_deficit": total_deficit,
            "total_affected_children": total_affected_children,
            "critical_shortages_count": sum(1 for r in records if r["urgency"] == "HIGH")
        }

        # Build CSV
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow([
            "Classroom", "Room Code", "Branch", "Age Group", "Children Present",
            "Qualified Staff", "Required Staff", "Staff Deficit", "Urgency", "Status", "Rule Used"
        ])
        for r in records:
            writer.writerow([
                r["classroom_name"], r["room_code"], r["branch_name"], r["age_group"],
                r["children_present"], r["qualified_staff_present"], r["required_staff"],
                r["staff_deficit"], r["urgency"], r["status"], r["rule_used"]
            ])

        return {
            "report_type": "staff_shortages",
            "title": "Classroom Staff Shortage & Ratio Alert Report",
            "date": target_date.isoformat(),
            "summary": summary,
            "records": records,
            "csv_content": csv_buffer.getvalue()
        }

    @classmethod
    def generate_ratio_violation_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        4. Ratio Violation Report
        Detailed log of all NON_COMPLIANT ratio evaluations over a date range.
        """
        start_date = cls._parse_date(filters.get('start_date')) or (timezone.now().date() - timedelta(days=30))
        end_date = cls._parse_date(filters.get('end_date')) or timezone.now().date()

        history_qs = RatioComplianceHistory.objects.filter(
            daycare=daycare,
            evaluated_at__date__gte=start_date,
            evaluated_at__date__lte=end_date
        ).filter(
            Q(calculated_status='NON_COMPLIANT') | Q(final_status='NON_COMPLIANT')
        ).select_related('classroom', 'classroom__branch', 'rule_used', 'override_by').order_by('-evaluated_at')

        classroom_id = filters.get('classroom') or filters.get('classroom_id')
        if classroom_id and classroom_id != 'all':
            history_qs = history_qs.filter(classroom_id=classroom_id)

        records = []
        for h in history_qs:
            deficit = max(0, h.required_staff - h.qualified_staff_present)
            records.append({
                "id": str(h.id),
                "timestamp": h.evaluated_at.isoformat(),
                "date": h.evaluated_at.date().isoformat(),
                "time": h.evaluated_at.time().strftime('%H:%M:%S'),
                "classroom_name": h.classroom.room_name if h.classroom else "Unknown Room",
                "room_code": h.classroom.room_code if h.classroom else "",
                "branch_name": h.classroom.branch.name if h.classroom and h.classroom.branch else "Main Branch",
                "children_present": h.children_present,
                "qualified_staff_present": h.qualified_staff_present,
                "required_staff": h.required_staff,
                "staff_deficit": deficit,
                "calculated_ratio": h.calculated_ratio,
                "calculated_status": h.calculated_status,
                "final_status": h.final_status,
                "rule_name": h.rule_snapshot.get("name") if h.rule_snapshot else (h.rule_used.name if h.rule_used else "Standard"),
                "rule_ratio": f"1:{h.rule_snapshot.get('max_children_per_staff', 5)}" if h.rule_snapshot else "1:5",
                "override_applied": h.override_applied,
                "override_reason": h.override_reason,
                "override_by": h.override_by.get_full_name() if h.override_by else None
            })

        summary = {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_violations": len(records),
            "overridden_violations": sum(1 for r in records if r["override_applied"]),
            "unresolved_violations": sum(1 for r in records if not r["override_applied"] and r["final_status"] == "NON_COMPLIANT")
        }

        # Build CSV
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow([
            "Timestamp", "Classroom", "Room Code", "Branch", "Children Present",
            "Qualified Staff", "Required Staff", "Deficit", "Calculated Ratio",
            "Status", "Rule Used", "Override Applied", "Override Reason"
        ])
        for r in records:
            writer.writerow([
                r["timestamp"], r["classroom_name"], r["room_code"], r["branch_name"],
                r["children_present"], r["qualified_staff_present"], r["required_staff"],
                r["staff_deficit"], r["calculated_ratio"], r["final_status"],
                r["rule_name"], "Yes" if r["override_applied"] else "No", r["override_reason"] or ""
            ])

        return {
            "report_type": "violations",
            "title": "Ratio Violation & Non-Compliance Incident Report",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "summary": summary,
            "records": records,
            "csv_content": csv_buffer.getvalue()
        }

    @classmethod
    def generate_staff_qualification_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        5. Staff Qualification Report (Reuses Module 8 ECE Credential Management)
        Shows:
        - Employee
        - Employee type / job title
        - Qualification / Credential type
        - Credential status
        - Expiry status
        - Whether counted as qualified for the applicable rule
        """
        target_date = cls._parse_date(filters.get('date')) or timezone.now().date()

        employees = Employee.objects.filter(
            daycare=daycare
        ).exclude(status__in=['terminated', 'inactive']).select_related('user', 'branch')

        branch_id = filters.get('branch') or filters.get('branch_id')
        if branch_id and branch_id != 'all':
            employees = employees.filter(branch_id=branch_id)

        records = []
        qualified_count = 0
        unqualified_count = 0
        expiring_soon_count = 0

        for emp in employees:
            creds = ECECredential.objects.filter(
                employee=emp,
                daycare=daycare
            ).select_related('credential_type')

            active_creds = creds.filter(
                status='Active'
            ).exclude(
                status__in=['Expired', 'Revoked', 'Suspended', 'Inactive', 'Superseded']
            ).filter(
                Q(expiry_date__gte=target_date) | Q(expiry_date__isnull=True)
            )

            is_qualified = active_creds.exists()

            # Find next expiring credential
            next_exp_date = None
            is_expiring_soon = False
            for c in creds:
                if c.expiry_date and c.expiry_date >= target_date:
                    if not next_exp_date or c.expiry_date < next_exp_date:
                        next_exp_date = c.expiry_date
                    if (c.expiry_date - target_date).days <= 60:
                        is_expiring_soon = True

            if is_expiring_soon:
                expiring_soon_count += 1

            if is_qualified:
                qualified_count += 1
            else:
                unqualified_count += 1

            cred_list = []
            for c in creds:
                cred_list.append({
                    "id": str(c.id),
                    "name": c.credential_type.name if c.credential_type else "Credential",
                    "status": c.status,
                    "license_number": c.license_number or "",
                    "issued_date": c.issued_date.isoformat() if c.issued_date else None,
                    "expiry_date": c.expiry_date.isoformat() if c.expiry_date else None,
                    "is_active_and_valid": (c.status == 'Active' and (not c.expiry_date or c.expiry_date >= target_date))
                })

            records.append({
                "employee_id": str(emp.id),
                "name": f"{emp.first_name} {emp.last_name}",
                "employee_number": getattr(emp, 'employee_number', '') or '',
                "job_title": emp.job_title or emp.role or "Educator",
                "employee_type": emp.employment_type or "Full-Time",
                "branch_name": emp.branch.name if emp.branch else "Main Branch",
                "status": emp.status,
                "is_counted_qualified": is_qualified,
                "qualification_summary": "Qualified ECE Educator" if is_qualified else "Unqualified / General Staff",
                "active_credentials_count": len(active_creds),
                "next_expiry_date": next_exp_date.isoformat() if next_exp_date else "N/A / No Expiry",
                "is_expiring_soon": is_expiring_soon,
                "credentials": cred_list
            })

        summary = {
            "target_date": target_date.isoformat(),
            "total_active_staff": len(records),
            "qualified_staff_count": qualified_count,
            "unqualified_staff_count": unqualified_count,
            "expiring_soon_count": expiring_soon_count,
            "qualification_rate": round((qualified_count / max(1, len(records))) * 100, 1) if records else 0.0
        }

        # Build CSV
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow([
            "Employee Name", "Employee ID", "Job Title", "Employment Type", "Branch",
            "Counted as Qualified?", "Active Credentials Count", "Next Expiry Date", "Expiring Soon"
        ])
        for r in records:
            writer.writerow([
                r["name"], r["employee_number"], r["job_title"], r["employee_type"], r["branch_name"],
                "Yes" if r["is_counted_qualified"] else "No", r["active_credentials_count"],
                r["next_expiry_date"], "Yes" if r["is_expiring_soon"] else "No"
            ])

        return {
            "report_type": "qualified_staff",
            "title": "Staff ECE Qualification & Credential Compliance Report",
            "date": target_date.isoformat(),
            "summary": summary,
            "records": records,
            "csv_content": csv_buffer.getvalue()
        }

    @classmethod
    def generate_ratio_history_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        6. Ratio History Report
        Point-in-time compliance evaluation snapshots with full rule snapshots.
        """
        start_date = cls._parse_date(filters.get('start_date')) or (timezone.now().date() - timedelta(days=14))
        end_date = cls._parse_date(filters.get('end_date')) or timezone.now().date()

        history_qs = RatioComplianceHistory.objects.filter(
            daycare=daycare,
            evaluated_at__date__gte=start_date,
            evaluated_at__date__lte=end_date
        ).select_related('classroom', 'classroom__branch', 'rule_used', 'override_by').order_by('-evaluated_at')

        classroom_id = filters.get('classroom') or filters.get('classroom_id')
        if classroom_id and classroom_id != 'all':
            history_qs = history_qs.filter(classroom_id=classroom_id)

        status_filter = filters.get('status')
        if status_filter and status_filter.upper() != 'ALL':
            if status_filter.upper() == 'OVERRIDDEN':
                history_qs = history_qs.filter(override_applied=True)
            else:
                history_qs = history_qs.filter(final_status=status_filter.upper())

        records = []
        for h in history_qs:
            records.append({
                "id": str(h.id),
                "timestamp": h.evaluated_at.isoformat(),
                "date": h.evaluated_at.date().isoformat(),
                "time": h.evaluated_at.time().strftime('%H:%M:%S'),
                "classroom_name": h.classroom.room_name if h.classroom else "Unknown",
                "room_code": h.classroom.room_code if h.classroom else "",
                "branch_name": h.classroom.branch.name if h.classroom and h.classroom.branch else "Main Branch",
                "children_present": h.children_present,
                "qualified_staff_present": h.qualified_staff_present,
                "required_staff": h.required_staff,
                "calculated_ratio": h.calculated_ratio,
                "calculated_status": h.calculated_status,
                "final_status": h.final_status,
                "rule_name": h.rule_snapshot.get("name") if h.rule_snapshot else (h.rule_used.name if h.rule_used else "Standard Rule"),
                "rule_ratio": f"1:{h.rule_snapshot.get('max_children_per_staff', 5)}" if h.rule_snapshot else "1:5",
                "override_applied": h.override_applied,
                "override_status": h.override_status,
                "override_reason": h.override_reason,
                "override_by": h.override_by.get_full_name() if h.override_by else None,
                "rule_snapshot": h.rule_snapshot
            })

        summary = {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_records": len(records),
            "compliant_count": sum(1 for r in records if r["final_status"] == "COMPLIANT"),
            "warning_count": sum(1 for r in records if r["final_status"] == "WARNING"),
            "non_compliant_count": sum(1 for r in records if r["final_status"] == "NON_COMPLIANT"),
            "overridden_count": sum(1 for r in records if r["override_applied"])
        }

        # Build CSV
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow([
            "Timestamp", "Classroom", "Room Code", "Children Present", "Qualified Staff",
            "Required Staff", "Calculated Ratio", "Status", "Rule Used", "Override Applied", "Override Reason"
        ])
        for r in records:
            writer.writerow([
                r["timestamp"], r["classroom_name"], r["room_code"], r["children_present"],
                r["qualified_staff_present"], r["required_staff"], r["calculated_ratio"],
                r["final_status"], r["rule_name"], "Yes" if r["override_applied"] else "No", r["override_reason"] or ""
            ])

        return {
            "report_type": "ratio_history",
            "title": "Ratio Compliance Evaluation History & Audit Report",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "summary": summary,
            "records": records,
            "csv_content": csv_buffer.getvalue()
        }

    @classmethod
    def generate_provincial_rules_report(cls, daycare: Daycare, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        7. Provincial Rule Configuration Report
        Lists active provincial baseline rules vs daycare custom ratio rules.
        """
        prov = getattr(daycare, 'province', None)
        if not prov and daycare.state:
            prov = Province.objects.filter(
                Q(code__iexact=daycare.state) | Q(name__iexact=daycare.state)
            ).first()

        # Daycare custom rules
        custom_rules = RatioRule.objects.filter(
            daycare=daycare
        ).select_related('province', 'program', 'age_group')

        # Provincial system baseline rules
        system_rules_q = Q(daycare__isnull=True) | Q(is_system_rule=True)
        if prov:
            system_rules_q = system_rules_q & (Q(province=prov) | Q(province__isnull=True))

        system_rules = RatioRule.objects.filter(system_rules_q).select_related('province', 'program', 'age_group')

        records = []
        for r in custom_rules:
            records.append({
                "id": str(r.id),
                "name": r.name,
                "rule_type": "Daycare Custom Rule",
                "is_system_rule": False,
                "province_name": r.province.name if r.province else (prov.name if prov else "Daycare Specific"),
                "province_code": r.province.code if r.province else (prov.code if prov else "DC"),
                "program_name": r.program.name if r.program else (r.program_type or "All Programs"),
                "age_group_name": r.age_group.name if r.age_group else f"{r.min_age_months}-{r.max_age_months} months",
                "age_range": f"{r.min_age_months} - {r.max_age_months} mos",
                "max_children_per_staff": r.max_children_per_staff,
                "ratio_string": f"1:{r.max_children_per_staff}",
                "warning_threshold_buffer": r.warning_threshold_buffer,
                "requires_qualified_ece": r.requires_qualified_ece,
                "qualification_requirement": r.qualification_requirement or ("Certified ECE" if r.requires_qualified_ece else "General Staff"),
                "effective_from": r.effective_from.isoformat() if r.effective_from else "2026-01-01",
                "effective_to": r.effective_to.isoformat() if r.effective_to else "Ongoing",
                "is_active": r.is_active
            })

        for r in system_rules:
            records.append({
                "id": str(r.id),
                "name": r.name,
                "rule_type": "Provincial Baseline System Rule",
                "is_system_rule": True,
                "province_name": r.province.name if r.province else "National / General",
                "province_code": r.province.code if r.province else "CAN",
                "program_name": r.program.name if r.program else (r.program_type or "All Programs"),
                "age_group_name": r.age_group.name if r.age_group else f"{r.min_age_months}-{r.max_age_months} months",
                "age_range": f"{r.min_age_months} - {r.max_age_months} mos",
                "max_children_per_staff": r.max_children_per_staff,
                "ratio_string": f"1:{r.max_children_per_staff}",
                "warning_threshold_buffer": r.warning_threshold_buffer,
                "requires_qualified_ece": r.requires_qualified_ece,
                "qualification_requirement": r.qualification_requirement or "Certified ECE",
                "effective_from": r.effective_from.isoformat() if r.effective_from else "2026-01-01",
                "effective_to": r.effective_to.isoformat() if r.effective_to else "Ongoing",
                "is_active": r.is_active
            })

        summary = {
            "daycare_province": prov.name if prov else (daycare.state or "Not Configured"),
            "total_custom_rules": len(custom_rules),
            "total_system_rules": len(system_rules),
            "total_active_rules": sum(1 for r in records if r["is_active"]),
            "legal_disclaimer": "Configured ratio rules are administrative guidelines and KidSynq does not warrant legal compliance. Authorized administrators must maintain and verify applicable provincial regulations."
        }

        # Build CSV
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow([
            "Rule Name", "Rule Type", "Province", "Program", "Age Range",
            "Max Ratio", "Warning Buffer", "Requires ECE", "Qualification Required",
            "Effective From", "Effective To", "Status"
        ])
        for r in records:
            writer.writerow([
                r["name"], r["rule_type"], r["province_code"], r["program_name"], r["age_range"],
                r["ratio_string"], r["warning_threshold_buffer"], "Yes" if r["requires_qualified_ece"] else "No",
                r["qualification_requirement"], r["effective_from"], r["effective_to"], "Active" if r["is_active"] else "Inactive"
            ])

        return {
            "report_type": "provincial_rules",
            "title": "Ratio Policy & Provincial Rule Configuration Report",
            "summary": summary,
            "records": records,
            "csv_content": csv_buffer.getvalue()
        }

    @staticmethod
    def _parse_date(val: Any) -> Optional[date]:
        if not val or val == 'null' or val == 'undefined':
            return None
        if isinstance(val, date):
            return val
        if isinstance(val, datetime):
            return val.date()
        try:
            return datetime.strptime(str(val).split('T')[0], '%Y-%m-%d').date()
        except Exception:
            return None

    @staticmethod
    def _parse_time(val: Any) -> Optional[datetime.time]:
        if not val or val == 'null' or val == 'undefined':
            return None
        if isinstance(val, datetime):
            return val.time()
        try:
            return datetime.strptime(str(val), '%H:%M:%S').time()
        except Exception:
            try:
                return datetime.strptime(str(val), '%H:%M').time()
            except Exception:
                return None
