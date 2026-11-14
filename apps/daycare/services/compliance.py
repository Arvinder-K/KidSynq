from datetime import date, timedelta
from django.utils import timezone
from django.db.models import Q
from core.models import Daycare, Employee, ECECredential, CredentialType, AuditLog


class ComplianceService:
    @staticmethod
    def get_compliance_stats(daycare: Daycare, filters: dict = None):
        """
        Calculates dynamic, real-time compliance statistics, expiring credentials,
        and employee compliance matrix for a daycare.
        """
        if not daycare:
            return {
                'total_credentials': 0,
                'active_credentials': 0,
                'expiring_30_days': 0,
                'expiring_60_days': 0,
                'expired_credentials': 0,
                'pending_verification': 0,
                'missing_required_credentials': 0,
                'non_compliant_employees': 0,
                'total_employees': 0,
                'compliant_employees': 0,
                'warning_employees': 0,
                'expiring_list': [],
                'employee_compliance_summary': []
            }

        filters = filters or {}
        today = timezone.now().date()
        date_30 = today + timedelta(days=30)
        date_60 = today + timedelta(days=60)

        # Base active employees query
        emp_qs = Employee.objects.filter(daycare=daycare)
        if filters.get('employee'):
            emp_qs = emp_qs.filter(id=filters['employee'])
        if filters.get('branch'):
            emp_qs = emp_qs.filter(branch_id=filters['branch'])
        if filters.get('classroom'):
            emp_qs = emp_qs.filter(teacher_assignments__classroom_id=filters['classroom'], teacher_assignments__deleted_at__isnull=True).distinct()

        # Base current credentials query
        cred_qs = ECECredential.objects.filter(daycare=daycare, is_current=True).select_related(
            'employee', 'credential_type', 'province'
        )

        if filters.get('employee'):
            cred_qs = cred_qs.filter(employee_id=filters['employee'])
        if filters.get('credential_type'):
            cred_qs = cred_qs.filter(credential_type_id=filters['credential_type'])
        if filters.get('category'):
            cred_qs = cred_qs.filter(credential_type__category=filters['category'])
        if filters.get('province'):
            cred_qs = cred_qs.filter(province__code=filters['province'])
        if filters.get('branch'):
            cred_qs = cred_qs.filter(employee__branch_id=filters['branch'])
        if filters.get('classroom'):
            cred_qs = cred_qs.filter(employee__teacher_assignments__classroom_id=filters['classroom'], employee__teacher_assignments__deleted_at__isnull=True).distinct()

        # Aggregate counts
        total_credentials = cred_qs.count()

        # Expired: expiry_date < today
        expired_qs = cred_qs.filter(
            expiry_date__isnull=False,
            expiry_date__lt=today
        ).exclude(status='Superseded')
        expired_count = expired_qs.count()

        # Expiring in 30 days: today <= expiry_date <= today + 30
        expiring_30_qs = cred_qs.filter(
            expiry_date__isnull=False,
            expiry_date__gte=today,
            expiry_date__lte=date_30
        ).exclude(status__in=['Superseded', 'Inactive', 'Revoked'])
        expiring_30_count = expiring_30_qs.count()

        # Expiring in 60 days: today <= expiry_date <= today + 60
        expiring_60_qs = cred_qs.filter(
            expiry_date__isnull=False,
            expiry_date__gte=today,
            expiry_date__lte=date_60
        ).exclude(status__in=['Superseded', 'Inactive', 'Revoked'])
        expiring_60_count = expiring_60_qs.count()

        # Pending verification
        pending_qs = cred_qs.filter(
            Q(verification_status__in=['Pending Verification', 'Unverified', 'Pending Review', 'Requires Review']) |
            Q(status__in=['Pending Review', 'Requires Review'])
        ).exclude(status='Superseded')
        pending_count = pending_qs.count()

        # Active & Valid
        active_valid_qs = cred_qs.filter(
            status='Active',
            verification_status='Verified'
        ).filter(
            Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
        )
        active_count = active_valid_qs.count()

        # Build expiring detailed list
        expiry_period_filter = filters.get('expiry_period')
        if expiry_period_filter == '30':
            expiring_records_qs = expiring_30_qs
        elif expiry_period_filter == '60':
            expiring_records_qs = expiring_60_qs
        elif expiry_period_filter == 'expired':
            expiring_records_qs = expired_qs
        else:
            # Default: all expiring in 60 days or already expired
            expiring_records_qs = cred_qs.filter(
                expiry_date__isnull=False,
                expiry_date__lte=date_60
            ).exclude(status__in=['Superseded', 'Inactive', 'Revoked']).order_by('expiry_date')

        expiring_list = []
        for cred in expiring_records_qs:
            days_diff = (cred.expiry_date - today).days if cred.expiry_date else None
            status_label = "Expired" if (days_diff is not None and days_diff < 0) else ("Expiring Soon" if (days_diff is not None and days_diff <= 30) else "Expiring in 60d")

            expiring_list.append({
                'id': str(cred.id),
                'employee_id': str(cred.employee_id),
                'employee_name': f"{cred.employee.first_name} {cred.employee.last_name}".strip(),
                'employee_number': cred.employee.employee_number,
                'credential_name': cred.credential_type.name,
                'category': cred.credential_type.category,
                'category_display': cred.credential_type.get_category_display(),
                'certificate_number': cred.certificate_number,
                'province': cred.province.name if cred.province else 'Nationwide',
                'province_code': cred.province.code if cred.province else 'CA',
                'issue_date': str(cred.issue_date),
                'expiry_date': str(cred.expiry_date) if cred.expiry_date else None,
                'days_remaining': days_diff,
                'status': cred.status,
                'status_label': status_label,
                'verification_status': cred.verification_status,
                'document_url': f"/api/daycare/credentials/{cred.id}/document/" if cred.document else cred.document_reference
            })

        # Evaluate Employee Compliance
        total_missing_credentials = 0
        non_compliant_count = 0
        compliant_count = 0
        warning_count = 0
        pending_review_count = 0
        employee_compliance_summary = []

        all_employees = list(emp_qs.filter(status__iexact='active').prefetch_related('types', 'ece_credentials'))

        for emp in all_employees:
            eval_result = ComplianceService.evaluate_employee_compliance(emp, today=today)
            total_missing_credentials += len(eval_result['missing_required'])

            if eval_result['compliance_status'] == 'NON_COMPLIANT':
                non_compliant_count += 1
            elif eval_result['compliance_status'] == 'WARNING':
                warning_count += 1
            elif eval_result['compliance_status'] == 'PENDING_REVIEW':
                pending_review_count += 1
            else:
                compliant_count += 1

            employee_compliance_summary.append({
                'employee_id': str(emp.id),
                'employee_name': f"{emp.first_name} {emp.last_name}".strip(),
                'employee_number': emp.employee_number,
                'job_title': emp.job_title or emp.role or 'Staff',
                'compliance_status': eval_result['compliance_status'],
                'compliance_reason': eval_result['compliance_reason'],
                'has_ece': eval_result['has_ece'],
                'has_first_aid': eval_result['has_first_aid'],
                'has_background_check': eval_result['has_background_check'],
                'missing_required': eval_result['missing_required'],
                'expiring_credentials': eval_result['expiring_credentials'],
                'expired_credentials': eval_result['expired_credentials'],
                'pending_credentials': eval_result['pending_credentials']
            })

        return {
            'total_credentials': total_credentials,
            'active_credentials': active_count,
            'expiring_30_days': expiring_30_count,
            'expiring_60_days': expiring_60_count,
            'expired_credentials': expired_count,
            'pending_verification': pending_count,
            'missing_required_credentials': total_missing_credentials,
            'non_compliant_employees': non_compliant_count,
            'total_employees': len(all_employees),
            'compliant_employees': compliant_count,
            'warning_employees': warning_count,
            'pending_review_employees': pending_review_count,
            'expiring_list': expiring_list,
            'employee_compliance_summary': employee_compliance_summary
        }

    @staticmethod
    def evaluate_employee_compliance(employee: Employee, today: date = None) -> dict:
        """
        Evaluates an individual employee's compliance based on Canadian childcare requirements:
        1. ECE Credential (if in teaching / educator / classroom role)
        2. First Aid & CPR Certification
        3. Criminal Record Check / Vulnerable Sector Check
        """
        today = today or timezone.now().date()
        date_30 = today + timedelta(days=30)

        # Get all current non-superseded credentials for this employee
        creds = ECECredential.objects.filter(
            employee=employee,
            is_current=True
        ).exclude(status='Superseded').select_related('credential_type', 'province')

        # Check credentials by category
        ece_creds = [c for c in creds if (c.credential_type and c.credential_type.category == 'ece')]
        fa_creds = [c for c in creds if (c.credential_type and (c.credential_type.category == 'certification' or 'first aid' in c.credential_type.name.lower() or 'cpr' in c.credential_type.name.lower()))]
        bg_creds = [c for c in creds if (c.credential_type and (c.credential_type.category == 'background_check' or 'vulnerable' in c.credential_type.name.lower() or 'criminal' in c.credential_type.name.lower() or 'police' in c.credential_type.name.lower()))]

        # Check validity (active, verified, not expired)
        valid_ece = [c for c in ece_creds if c.status == 'Active' and c.verification_status == 'Verified' and (not c.expiry_date or c.expiry_date >= today)]
        valid_fa = [c for c in fa_creds if c.status == 'Active' and c.verification_status == 'Verified' and (not c.expiry_date or c.expiry_date >= today)]
        valid_bg = [c for c in bg_creds if c.status == 'Active' and c.verification_status == 'Verified' and (not c.expiry_date or c.expiry_date >= today)]

        # Check expiring soon (<= 30 days)
        expiring_creds = [
            f"{c.credential_type.name} expires in {(c.expiry_date - today).days} days"
            for c in creds
            if c.expiry_date and today <= c.expiry_date <= date_30 and c.status not in ['Superseded', 'Inactive', 'Revoked']
        ]

        # Check expired
        expired_creds = [
            f"{c.credential_type.name} (Expired on {c.expiry_date})"
            for c in creds
            if c.expiry_date and c.expiry_date < today and c.status not in ['Superseded']
        ]

        # Check pending verification
        pending_creds = [
            c.credential_type.name
            for c in creds
            if c.verification_status in ['Pending Verification', 'Unverified', 'Pending Review', 'Requires Review'] or c.status in ['Pending Review', 'Requires Review']
        ]

        # Check rejected
        rejected_creds = [
            c.credential_type.name
            for c in creds
            if c.verification_status == 'Rejected'
        ]

        # Determine required checks based on role
        job_lower = (employee.job_title or '').lower() + ' ' + (employee.role or '').lower()
        emp_type_names = ' '.join([t.name.lower() for t in employee.types.all()])
        full_role_str = f"{job_lower} {emp_type_names}"

        is_teaching_staff = any(k in full_role_str for k in ['teacher', 'ece', 'educator', 'lead', 'instructor', 'assistant', 'supervisor'])

        missing_required = []
        if is_teaching_staff and not valid_ece:
            missing_required.append("ECE Credential")
        if not valid_fa:
            missing_required.append("First Aid & CPR")
        if not valid_bg:
            missing_required.append("Vulnerable Sector Check (VSC)")

        # Determine overall compliance status
        if expired_creds:
            compliance_status = 'NON_COMPLIANT'
            compliance_reason = f"Expired: {', '.join(expired_creds)}"
        elif rejected_creds:
            compliance_status = 'NON_COMPLIANT'
            compliance_reason = f"Rejected credential: {', '.join(rejected_creds)}"
        elif missing_required:
            compliance_status = 'NON_COMPLIANT'
            compliance_reason = f"Missing required: {', '.join(missing_required)}"
        elif expiring_creds:
            compliance_status = 'WARNING'
            compliance_reason = f"Expiring soon: {', '.join(expiring_creds)}"
        elif pending_creds:
            compliance_status = 'PENDING_REVIEW'
            compliance_reason = f"Pending verification: {', '.join(pending_creds)}"
        else:
            compliance_status = 'COMPLIANT'
            compliance_reason = "All required credentials valid and up to date."

        return {
            'compliance_status': compliance_status,
            'compliance_reason': compliance_reason,
            'has_ece': len(valid_ece) > 0,
            'has_first_aid': len(valid_fa) > 0,
            'has_background_check': len(valid_bg) > 0,
            'missing_required': missing_required,
            'expiring_credentials': expiring_creds,
            'expired_credentials': expired_creds,
            'pending_credentials': pending_creds
        }

    @staticmethod
    def send_compliance_alerts(daycare: Daycare, user) -> dict:
        """
        Generates compliance notifications/alerts for:
        - 30-day expiry
        - 60-day expiry
        - Expired credentials
        - Missing required credentials
        - Pending verification
        Avoids sending duplicate alerts within the same day.
        """
        today = timezone.now().date()
        date_30 = today + timedelta(days=30)
        date_60 = today + timedelta(days=60)

        stats = ComplianceService.get_compliance_stats(daycare)
        alerts_generated = []

        # Check 30-day expiry alerts
        exp_30_creds = ECECredential.objects.filter(
            daycare=daycare,
            is_current=True,
            expiry_date__isnull=False,
            expiry_date__gte=today,
            expiry_date__lte=date_30
        ).exclude(status__in=['Superseded', 'Inactive', 'Revoked'])

        for c in exp_30_creds:
            days = (c.expiry_date - today).days
            action_code = f"ALERT_EXPIRING_30D_{c.id}_{today}"
            if not AuditLog.objects.filter(entity_id=str(c.id), action=action_code).exists():
                AuditLog.objects.create(
                    user=user,
                    user_type='System',
                    action=action_code,
                    module='compliance',
                    entity_type='credential_alert',
                    entity_id=str(c.id),
                    new_values={
                        'type': '30_day_expiry',
                        'employee': f"{c.employee.first_name} {c.employee.last_name}",
                        'credential': c.credential_type.name,
                        'expiry_date': str(c.expiry_date),
                        'days_remaining': days,
                        'message': f"Certification for {c.employee.first_name} {c.employee.last_name} ({c.credential_type.name}) expires in {days} days."
                    }
                )
                alerts_generated.append(f"30-day expiry alert: {c.employee.first_name} {c.employee.last_name} - {c.credential_type.name}")

        # Check expired alerts
        exp_creds = ECECredential.objects.filter(
            daycare=daycare,
            is_current=True,
            expiry_date__isnull=False,
            expiry_date__lt=today
        ).exclude(status='Superseded')

        for c in exp_creds:
            action_code = f"ALERT_EXPIRED_{c.id}_{today}"
            if not AuditLog.objects.filter(entity_id=str(c.id), action=action_code).exists():
                AuditLog.objects.create(
                    user=user,
                    user_type='System',
                    action=action_code,
                    module='compliance',
                    entity_type='credential_alert',
                    entity_id=str(c.id),
                    new_values={
                        'type': 'expired_credential',
                        'employee': f"{c.employee.first_name} {c.employee.last_name}",
                        'credential': c.credential_type.name,
                        'expiry_date': str(c.expiry_date),
                        'message': f"EXPIRED CREDENTIAL: {c.employee.first_name} {c.employee.last_name} - {c.credential_type.name} expired on {c.expiry_date}."
                    }
                )
                alerts_generated.append(f"Expired alert: {c.employee.first_name} {c.employee.last_name} - {c.credential_type.name}")

        # Check missing required alerts
        for item in stats['employee_compliance_summary']:
            if item['missing_required']:
                action_code = f"ALERT_MISSING_{item['employee_id']}_{today}"
                if not AuditLog.objects.filter(entity_id=str(item['employee_id']), action=action_code).exists():
                    AuditLog.objects.create(
                        user=user,
                        user_type='System',
                        action=action_code,
                        module='compliance',
                        entity_type='employee_alert',
                        entity_id=str(item['employee_id']),
                        new_values={
                            'type': 'missing_required',
                            'employee': item['employee_name'],
                            'missing': item['missing_required'],
                            'message': f"NON-COMPLIANT: {item['employee_name']} is missing required credentials: {', '.join(item['missing_required'])}."
                        }
                    )
                    alerts_generated.append(f"Missing credential alert: {item['employee_name']} ({', '.join(item['missing_required'])})")

        return {
            'alerts_sent': len(alerts_generated),
            'details': alerts_generated,
            'timestamp': str(timezone.now())
        }

    @staticmethod
    def get_employee_compliance_profile(employee: Employee, today: date = None) -> dict:
        """
        Generates structured compliance checklist profile for an employee:
        - ECE Credential
        - First Aid
        - CPR
        - Criminal Record Check
        - Vulnerable Sector Check
        - Food Safety
        - Overall Status (COMPLIANT, WARNING, NON_COMPLIANT, PENDING_REVIEW)
        """
        today = today or timezone.now().date()
        date_30 = today + timedelta(days=30)
        eval_res = ComplianceService.evaluate_employee_compliance(employee, today=today)

        # Retrieve all active / current credentials
        creds = ECECredential.objects.filter(
            employee=employee,
            is_current=True
        ).exclude(status='Superseded').select_related('credential_type', 'province')

        # Helper to get specific check status
        def inspect_check(category=None, name_keywords=None, is_required=True):
            matched = []
            for c in creds:
                tname = c.credential_type.name.lower() if c.credential_type else ''
                tcat = c.credential_type.category if c.credential_type else ''
                if category and tcat == category:
                    matched.append(c)
                elif name_keywords and any(k.lower() in tname for k in name_keywords):
                    matched.append(c)

            if not matched:
                if not is_required:
                    return {"status": "N/A", "badge": "neutral", "detail": "Not Required / None on File"}
                return {"status": "Missing", "badge": "danger", "detail": "Required check is missing"}

            # Check primary match
            c = matched[0]
            if c.verification_status == 'Rejected':
                return {"status": "Rejected", "badge": "danger", "detail": f"Rejected: {c.rejection_reason or 'Documentation invalid'}"}
            if c.expiry_date and c.expiry_date < today:
                return {"status": "Expired", "badge": "danger", "detail": f"Expired on {c.expiry_date}"}
            if c.verification_status in ['Pending Review', 'Pending Verification', 'Unverified']:
                return {"status": "Pending Review", "badge": "warning", "detail": f"Awaiting verification ({c.credential_type.name})"}
            if c.expiry_date and c.expiry_date <= date_30:
                days = (c.expiry_date - today).days
                return {"status": f"Expires in {days} days", "badge": "warning", "detail": f"{c.credential_type.name} (Exp: {c.expiry_date})"}
            if c.status == 'Active' and c.verification_status == 'Verified':
                exp_str = f"Exp: {c.expiry_date}" if c.expiry_date else "No Expiry"
                return {"status": "Valid", "badge": "success", "detail": f"{c.credential_type.name} ({exp_str})"}

            return {"status": c.status, "badge": "neutral", "detail": f"{c.credential_type.name}"}

        # Check teacher / classroom eligibility
        is_educator = False
        if employee.job_title and any(k in employee.job_title.lower() for k in ['teacher', 'ece', 'educator', 'assistant', 'lead']):
            is_educator = True
        if employee.role and any(k in employee.role.lower() for k in ['teacher', 'educator', 'assistant']):
            is_educator = True
        for t in employee.types.all():
            if t.can_teach():
                is_educator = True

        ece_check = inspect_check(category='ece', name_keywords=['ece', 'rece', 'early childhood'], is_required=is_educator)
        first_aid_check = inspect_check(name_keywords=['first aid', 'standard first aid', 'emergency first aid'], is_required=True)
        cpr_check = inspect_check(name_keywords=['cpr', 'cpr level c', 'bls', 'hcp'], is_required=True)
        crc_check = inspect_check(name_keywords=['criminal', 'police check', 'crc', 'judicial'], is_required=False)
        vsc_check = inspect_check(name_keywords=['vulnerable', 'vsc', 'vulnerable sector'], is_required=True)
        food_safety_check = inspect_check(name_keywords=['food', 'food handler', 'food safety'], is_required=False)

        return {
            'employee_id': str(employee.id),
            'employee_name': f"{employee.first_name} {employee.last_name}".strip(),
            'employee_number': employee.employee_number,
            'job_title': employee.job_title or employee.role or 'Staff Member',
            'overall_status': eval_res['compliance_status'],
            'overall_badge': eval_res['compliance_status'],
            'compliance_reason': eval_res['compliance_reason'],
            'is_educator': is_educator,
            'checks': {
                'ece': {'name': 'ECE Credential', **ece_check},
                'first_aid': {'name': 'First Aid', **first_aid_check},
                'cpr': {'name': 'CPR', **cpr_check},
                'criminal_record': {'name': 'Criminal Record Check', **crc_check},
                'vulnerable_sector': {'name': 'Vulnerable Sector Check', **vsc_check},
                'food_safety': {'name': 'Food Safety', **food_safety_check},
            },
            'missing_required': eval_res['missing_required'],
            'expiring_credentials': eval_res['expiring_credentials'],
            'expired_credentials': eval_res['expired_credentials'],
            'pending_credentials': eval_res['pending_credentials']
        }

    @staticmethod
    def get_employee_credential_history(employee: Employee) -> list:
        """
        Retrieves the complete historical audit log timeline and lifecycle of all credentials
        belonging to an employee (Added, Verified, Rejected, Renewed, Expired, Uploaded).
        """
        events = []

        # 1. Fetch all audit logs for ECECredential entities related to this employee
        cred_ids = list(ECECredential.objects.filter(employee=employee).values_list('id', flat=True))
        str_cred_ids = [str(cid) for cid in cred_ids]

        audit_logs = AuditLog.objects.filter(
            Q(entity_id__in=str_cred_ids) | Q(entity_id=str(employee.id))
        ).order_by('-created_at')

        for log in audit_logs:
            user_name = "System"
            if log.user:
                user_name = f"{log.user.first_name} {log.user.last_name}".strip() or log.user.username

            action_display = log.action
            if "CREATE_ECE_CREDENTIAL" in log.action:
                action_display = "Credential Added"
            elif "UPDATE_ECE_CREDENTIAL" in log.action:
                action_display = "Credential Updated"
            elif "VERIFY_ECE_CREDENTIAL" in log.action:
                action_display = "Credential Verified"
            elif "REJECT_ECE_CREDENTIAL" in log.action:
                action_display = "Credential Rejected"
            elif "RENEW_ECE_CREDENTIAL" in log.action:
                action_display = "Credential Renewed"
            elif "UPLOAD_DOCUMENT_ECE_CREDENTIAL" in log.action:
                action_display = "Document Uploaded"
            elif "ALERT_" in log.action:
                action_display = "Compliance Alert Triggered"

            details = ""
            if isinstance(log.new_values, dict):
                details = log.new_values.get('notes') or log.new_values.get('rejection_reason') or log.new_values.get('message') or ""
                cred_name = log.new_values.get('credential_type') or log.new_values.get('credential') or "ECE Credential"
                cert_num = log.new_values.get('certificate_number') or ""
            else:
                cred_name = "ECE Credential"
                cert_num = ""

            events.append({
                'id': str(log.id),
                'date': log.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'credential_name': cred_name,
                'certificate_number': cert_num,
                'action': action_display,
                'old_status': log.old_values.get('status') if isinstance(log.old_values, dict) else None,
                'new_status': log.new_values.get('status') if isinstance(log.new_values, dict) else None,
                'performed_by': user_name,
                'details': details
            })

        # 2. Also retrieve all credential records directly (including superseded)
        all_creds = ECECredential.objects.filter(employee=employee).select_related('credential_type', 'province', 'verified_by').order_by('-created_at')
        for cred in all_creds:
            # If not already present as a create action
            verifier = f"{cred.verified_by.first_name} {cred.verified_by.last_name}".strip() if cred.verified_by else "Pending"
            if cred.status == 'Superseded':
                events.append({
                    'id': f"sup_{cred.id}",
                    'date': cred.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
                    'credential_name': cred.credential_type.name,
                    'certificate_number': cred.certificate_number,
                    'action': "Credential Superseded / Renewed",
                    'old_status': "Active",
                    'new_status': "Superseded",
                    'performed_by': verifier,
                    'details': f"Replaced during renewal on {cred.updated_at.strftime('%Y-%m-%d')}"
                })

        # Sort deduplicated by date descending
        events.sort(key=lambda x: x['date'], reverse=True)
        return events

    @staticmethod
    def generate_credential_report(daycare: Daycare, report_type: str, filters: dict = None) -> dict:
        """
        Generates 12 standard compliance and credential reports:
        1. ece - ECE Credential Report
        2. certification - Certification Report
        3. expiring - Expiring Credential Report
        4. expired - Expired Credential Report
        5. missing - Missing Credential Report
        6. background_check - Background Check Report
        7. first_aid - First Aid Report
        8. cpr - CPR Report
        9. food_safety - Food Safety Report
        10. training - Training Compliance Report
        11. employee_compliance - Employee Compliance Report
        12. renewals - Credential Renewal Report
        """
        filters = filters or {}
        today = timezone.now().date()
        date_30 = today + timedelta(days=30)
        date_60 = today + timedelta(days=60)
        date_90 = today + timedelta(days=90)

        # Base active credentials
        cred_qs = ECECredential.objects.filter(daycare=daycare).select_related(
            'employee', 'credential_type', 'province', 'verified_by'
        )

        if filters.get('employee'):
            cred_qs = cred_qs.filter(employee_id=filters['employee'])
        if filters.get('credential_type'):
            cred_qs = cred_qs.filter(credential_type_id=filters['credential_type'])
        if filters.get('province'):
            cred_qs = cred_qs.filter(province__code=filters['province'])
        if filters.get('branch'):
            cred_qs = cred_qs.filter(employee__branch_id=filters['branch'])
        if filters.get('classroom'):
            cred_qs = cred_qs.filter(employee__teacher_assignments__classroom_id=filters['classroom'], employee__teacher_assignments__deleted_at__isnull=True).distinct()
        if filters.get('status'):
            cred_qs = cred_qs.filter(status=filters['status'])
        if filters.get('start_date'):
            cred_qs = cred_qs.filter(issue_date__gte=filters['start_date'])
        if filters.get('end_date'):
            cred_qs = cred_qs.filter(expiry_date__lte=filters['end_date'])
        if filters.get('search'):
            q = filters['search']
            cred_qs = cred_qs.filter(
                Q(employee__first_name__icontains=q) |
                Q(employee__last_name__icontains=q) |
                Q(credential_type__name__icontains=q) |
                Q(certificate_number__icontains=q)
            )

        standard_columns = [
            "Employee", "Employee #", "Role", "Credential Name", "Category",
            "Province", "Certificate #", "Issue Date", "Expiry Date",
            "Days Remaining", "Status", "Verification"
        ]

        def cred_to_row(c):
            days_diff = (c.expiry_date - today).days if c.expiry_date else "N/A"
            emp_name = f"{c.employee.first_name} {c.employee.last_name}".strip()
            return [
                emp_name,
                c.employee.employee_number or "",
                c.employee.job_title or c.employee.role or "Staff",
                c.credential_type.name,
                c.credential_type.get_category_display(),
                c.province.code if c.province else "CA",
                c.certificate_number or "N/A",
                str(c.issue_date),
                str(c.expiry_date) if c.expiry_date else "No Expiry",
                str(days_diff),
                c.status,
                c.verification_status
            ]

        # 1. ECE Credential Report
        if report_type == 'ece':
            title = "ECE Credential Report"
            qs = cred_qs.filter(credential_type__category='ece', is_current=True).order_by('employee__last_name')
            rows = [cred_to_row(c) for c in qs]
            return {'title': title, 'columns': standard_columns, 'rows': rows, 'total': len(rows)}

        # 2. Certification Report
        elif report_type == 'certification':
            title = "Staff Certification Report"
            qs = cred_qs.filter(credential_type__category='certification', is_current=True).order_by('employee__last_name')
            rows = [cred_to_row(c) for c in qs]
            return {'title': title, 'columns': standard_columns, 'rows': rows, 'total': len(rows)}

        # 3. Expiring Credential Report
        elif report_type == 'expiring':
            title = "Expiring Credential Report"
            expiry_limit = date_60
            if filters.get('expiry_period') == '30':
                expiry_limit = date_30
            elif filters.get('expiry_period') == '90':
                expiry_limit = date_90

            qs = cred_qs.filter(
                is_current=True,
                expiry_date__isnull=False,
                expiry_date__gte=today,
                expiry_date__lte=expiry_limit
            ).exclude(status__in=['Superseded', 'Inactive', 'Revoked']).order_by('expiry_date')
            rows = [cred_to_row(c) for c in qs]
            return {'title': title, 'columns': standard_columns, 'rows': rows, 'total': len(rows)}

        # 4. Expired Credential Report
        elif report_type == 'expired':
            title = "Expired Credential Report"
            qs = cred_qs.filter(
                is_current=True,
                expiry_date__isnull=False,
                expiry_date__lt=today
            ).exclude(status='Superseded').order_by('-expiry_date')
            rows = [cred_to_row(c) for c in qs]
            return {'title': title, 'columns': standard_columns, 'rows': rows, 'total': len(rows)}

        # 5. Missing Credential Report
        elif report_type == 'missing':
            title = "Missing Required Credential Report"
            cols = ["Employee", "Employee #", "Role", "Missing Requirements", "Compliance Status", "Has ECE", "Has First Aid", "Has Background Check"]
            emp_qs = Employee.objects.filter(daycare=daycare, status__iexact='active')
            if filters.get('employee'):
                emp_qs = emp_qs.filter(id=filters['employee'])
            if filters.get('branch'):
                emp_qs = emp_qs.filter(branch_id=filters['branch'])
            if filters.get('classroom'):
                emp_qs = emp_qs.filter(teacher_assignments__classroom_id=filters['classroom'], teacher_assignments__deleted_at__isnull=True).distinct()

            rows = []
            for emp in emp_qs:
                eval_res = ComplianceService.evaluate_employee_compliance(emp, today=today)
                if eval_res['missing_required']:
                    rows.append([
                        f"{emp.first_name} {emp.last_name}".strip(),
                        emp.employee_number or "",
                        emp.job_title or emp.role or "Staff",
                        ", ".join(eval_res['missing_required']),
                        eval_res['compliance_status'],
                        "Yes" if eval_res['has_ece'] else "No",
                        "Yes" if eval_res['has_first_aid'] else "No",
                        "Yes" if eval_res['has_background_check'] else "No"
                    ])
            return {'title': title, 'columns': cols, 'rows': rows, 'total': len(rows)}

        # 6. Background Check Report
        elif report_type == 'background_check':
            title = "Background Check & VSC Report"
            qs = cred_qs.filter(credential_type__category='background_check', is_current=True).order_by('employee__last_name')
            rows = [cred_to_row(c) for c in qs]
            return {'title': title, 'columns': standard_columns, 'rows': rows, 'total': len(rows)}

        # 7. First Aid Report
        elif report_type == 'first_aid':
            title = "First Aid Certification Report"
            qs = cred_qs.filter(
                Q(credential_type__name__icontains='first aid') | Q(credential_type__name__icontains='sfa'),
                is_current=True
            ).order_by('employee__last_name')
            rows = [cred_to_row(c) for c in qs]
            return {'title': title, 'columns': standard_columns, 'rows': rows, 'total': len(rows)}

        # 8. CPR Report
        elif report_type == 'cpr':
            title = "CPR Certification Report"
            qs = cred_qs.filter(
                Q(credential_type__name__icontains='cpr') | Q(credential_type__name__icontains='bls'),
                is_current=True
            ).order_by('employee__last_name')
            rows = [cred_to_row(c) for c in qs]
            return {'title': title, 'columns': standard_columns, 'rows': rows, 'total': len(rows)}

        # 9. Food Safety Report
        elif report_type == 'food_safety':
            title = "Food Safety & Handling Report"
            qs = cred_qs.filter(
                Q(credential_type__name__icontains='food') | Q(credential_type__name__icontains='sanitation'),
                is_current=True
            ).order_by('employee__last_name')
            rows = [cred_to_row(c) for c in qs]
            return {'title': title, 'columns': standard_columns, 'rows': rows, 'total': len(rows)}

        # 10. Training Compliance Report
        elif report_type == 'training':
            title = "Staff Training Compliance Report"
            qs = cred_qs.filter(credential_type__category='training', is_current=True).order_by('employee__last_name')
            rows = [cred_to_row(c) for c in qs]
            return {'title': title, 'columns': standard_columns, 'rows': rows, 'total': len(rows)}

        # 11. Employee Compliance Report
        elif report_type == 'employee_compliance':
            title = "Employee Credential Compliance Matrix"
            cols = ["Employee", "Employee #", "Role", "Compliance Status", "ECE Check", "First Aid Check", "Police/VSC Check", "Issues / Details"]
            emp_qs = Employee.objects.filter(daycare=daycare, status__iexact='active').order_by('last_name')
            if filters.get('employee'):
                emp_qs = emp_qs.filter(id=filters['employee'])
            if filters.get('branch'):
                emp_qs = emp_qs.filter(branch_id=filters['branch'])
            if filters.get('classroom'):
                emp_qs = emp_qs.filter(teacher_assignments__classroom_id=filters['classroom'], teacher_assignments__deleted_at__isnull=True).distinct()

            rows = []
            for emp in emp_qs:
                eval_res = ComplianceService.evaluate_employee_compliance(emp, today=today)
                issues = []
                if eval_res['missing_required']:
                    issues.append(f"Missing: {', '.join(eval_res['missing_required'])}")
                if eval_res['expired_credentials']:
                    issues.append(f"Expired: {', '.join(eval_res['expired_credentials'])}")
                if eval_res['expiring_credentials']:
                    issues.append(f"Expiring: {', '.join(eval_res['expiring_credentials'])}")

                rows.append([
                    f"{emp.first_name} {emp.last_name}".strip(),
                    emp.employee_number or "",
                    emp.job_title or emp.role or "Staff",
                    eval_res['compliance_status'],
                    "Compliant" if eval_res['has_ece'] else "Non-Compliant / Missing",
                    "Compliant" if eval_res['has_first_aid'] else "Missing",
                    "Compliant" if eval_res['has_background_check'] else "Missing",
                    "; ".join(issues) if issues else "All checks valid"
                ])
            return {'title': title, 'columns': cols, 'rows': rows, 'total': len(rows)}

        # 12. Credential Renewal Report
        elif report_type == 'renewals':
            title = "Credential Renewal & Superseded History Report"
            cols = ["Employee", "Credential", "Certificate #", "Current Status", "Renewal Date", "Previous Certificate #", "Previous Expiry"]
            qs = cred_qs.filter(previous_credential__isnull=False).select_related('previous_credential').order_by('-updated_at')
            rows = []
            for c in qs:
                prev = c.previous_credential
                rows.append([
                    f"{c.employee.first_name} {c.employee.last_name}".strip(),
                    c.credential_type.name,
                    c.certificate_number or "N/A",
                    c.status,
                    c.created_at.strftime('%Y-%m-%d'),
                    prev.certificate_number if prev else "N/A",
                    str(prev.expiry_date) if prev and prev.expiry_date else "N/A"
                ])
            return {'title': title, 'columns': cols, 'rows': rows, 'total': len(rows)}

        # Fallback to general active credentials
        else:
            title = "Credential Summary Report"
            qs = cred_qs.filter(is_current=True).order_by('employee__last_name')
            rows = [cred_to_row(c) for c in qs]
            return {'title': title, 'columns': standard_columns, 'rows': rows, 'total': len(rows)}

