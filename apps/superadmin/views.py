from rest_framework import generics, status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from core.models import Daycare, SubscriptionPlan, DaycareSubscription
from core.serializers import AdminDaycareSerializer, AdminUserSerializer, SubscriptionPlanSerializer, DaycareSubscriptionSerializer
from core.permissions import IsSuperUser

User = get_user_model()

from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from django.utils import timezone
from core.models import AuditLog

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

class AdminDaycareListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    serializer_class = AdminDaycareSerializer
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
        queryset = Daycare.objects.all().order_by('-created_at')
        search = self.request.query_params.get('search', None)
        status_param = self.request.query_params.get('status', None)
        
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search)
            )
        if status_param:
            queryset = queryset.filter(status=status_param)
            
        return queryset

from django.db import transaction
from django.utils import timezone
from dateutil.relativedelta import relativedelta
import datetime
import uuid

from core.models import (
    Daycare, SubscriptionPlan, DaycareSubscription, SubscriptionFeature,
    Branch, User, AuditLog, SubscriptionInvoice, SubscriptionPayment,
    SupportTicket, SupportTicketMessage, Student, Employee, Classroom,
    DailyReport, StudentAttendance, Invoice, Payment, Guardian, Document,
    Province, DaycareLicense, DaycareEmergencyInformation, ClassroomStudent,
    ClassroomTeacherAssignment
)

def purge_daycare_and_data(daycare, user=None):
    """
    Permanently deletes a daycare and cleans up all related operational records,
    child profiles, families, employee entries, subscriptions, and daycare staff accounts.
    """
    with transaction.atomic():
        daycare_id_str = str(daycare.id)
        daycare_name = daycare.name

        # 1. Delete associated daycare users (except superusers)
        User.objects.filter(daycare=daycare, is_superuser=False).delete()

        # 2. Delete daycare record (Django cascade handles all foreign key relationships cleanly)
        daycare.delete()

        if user:
            AuditLog.objects.create(
                user=user, user_type='SuperAdmin',
                action='Permanent Delete Daycare', module='Daycares',
                entity_type='Daycare', entity_id=daycare_id_str,
                new_values={'deleted_daycare_name': daycare_name, 'permanent': True}
            )

class AdminDaycareDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = Daycare.objects.all()
    serializer_class = AdminDaycareSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        permanent = request.query_params.get('permanent', '').lower() in ['true', '1'] or request.data.get('permanent') is True
        
        if permanent:
            daycare_name = instance.name
            purge_daycare_and_data(instance, user=request.user)
            return Response({"status": "success", "message": f"Daycare '{daycare_name}' permanently deleted from database."}, status=status.HTTP_200_OK)
        else:
            instance.deleted_at = timezone.now()
            instance.deleted_by = request.user
            instance.status = 'Deleted'
            instance.save()
            
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Soft Delete Daycare', module='Daycares',
                entity_type='Daycare', entity_id=str(instance.id),
                new_values={'status': 'Deleted'}
            )
            return Response({"status": "success", "message": f"Daycare '{instance.name}' soft-deleted."}, status=status.HTTP_200_OK)

class DaycareCareOptionsView(generics.GenericAPIView):
    """
    Database-driven Care Options & Feature Overrides endpoint for Super Admin.
    GET  /super-admin/daycares/<pk>/care-options/
    POST /super-admin/daycares/<pk>/care-options/
    """
    permission_classes = [IsSuperUser]

    def _build_care_options(self, daycare):
        active_sub = daycare.subscriptions.filter(
            subscription_status__in=['Active', 'active', 'Trial', 'trial']
        ).order_by('-created_at').first()

        plan = active_sub.subscription_plan if active_sub else None
        plan_feature_codes = set(plan.features.values_list('code', flat=True)) if plan else set()

        overrides = daycare.feature_overrides or {}
        enabled_overrides = set(overrides.get('enabled', []))
        disabled_overrides = set(overrides.get('disabled', []))

        all_features = SubscriptionFeature.objects.all().order_by('order', 'name')
        feature_list = []
        categories_set = []

        for feat in all_features:
            cat = feat.category or 'General Modules'
            if cat not in categories_set:
                categories_set.append(cat)

            is_in_plan = feat.code in plan_feature_codes
            override_status = 'inherited'
            if feat.code in enabled_overrides:
                override_status = 'force_enabled'
            elif feat.code in disabled_overrides:
                override_status = 'force_disabled'

            is_effective = (is_in_plan and override_status != 'force_disabled') or (override_status == 'force_enabled')

            feature_list.append({
                'id': str(feat.id),
                'code': feat.code,
                'name': feat.name,
                'description': feat.description or '',
                'category': cat,
                'order': feat.order,
                'is_in_plan': is_in_plan,
                'override_status': override_status,
                'is_effective': is_effective,
            })

        return {
            'daycare_id': str(daycare.id),
            'daycare_name': daycare.name,
            'license_number': daycare.license_number,
            'active_plan': {
                'id': str(plan.id) if plan else None,
                'name': plan.name if plan else 'No Active Plan',
                'description': plan.description if plan else '',
                'features_count': len(plan_feature_codes)
            },
            'overrides': {
                'enabled': list(enabled_overrides),
                'disabled': list(disabled_overrides)
            },
            'categories': categories_set,
            'features': feature_list,
            'total_features': len(feature_list),
            'effective_count': sum(1 for f in feature_list if f['is_effective'])
        }

    def get(self, request, pk):
        try:
            daycare = Daycare.objects.get(pk=pk)
        except Daycare.DoesNotExist:
            return Response({"error": "Daycare not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(self._build_care_options(daycare))

    def post(self, request, pk):
        try:
            daycare = Daycare.objects.get(pk=pk)
        except Daycare.DoesNotExist:
            return Response({"error": "Daycare not found"}, status=status.HTTP_404_NOT_FOUND)

        enabled = request.data.get('enabled', [])
        disabled = request.data.get('disabled', [])

        if not isinstance(enabled, list): enabled = []
        if not isinstance(disabled, list): disabled = []

        disabled = [c for c in disabled if c not in enabled]

        new_overrides = {
            'enabled': list(set(enabled)),
            'disabled': list(set(disabled))
        }

        old_overrides = daycare.feature_overrides or {}
        daycare.feature_overrides = new_overrides
        daycare.save(update_fields=['feature_overrides', 'updated_at'])

        AuditLog.objects.create(
            user=request.user,
            user_type='SuperAdmin',
            action='Update Care Options Overrides',
            module='Daycares',
            entity_type='Daycare',
            entity_id=str(daycare.id),
            old_values=old_overrides,
            new_values=new_overrides
        )

        return Response(self._build_care_options(daycare))

class AdminDaycareManageDetailView(generics.GenericAPIView):
    """
    Super Admin endpoint returning comprehensive details for Manage Daycare across 11 Sections:
    1. Overview
    2. Profile
    3. Subscription
    4. Care Options
    5. Usage
    6. Admins
    7. Staff
    8. Children
    9. Classrooms
    10. Activity
    11. Audit
    """
    permission_classes = [IsSuperUser]

    def get(self, request, pk):
        try:
            daycare = Daycare.objects.get(pk=pk)
        except Daycare.DoesNotExist:
            return Response({"error": "Daycare not found"}, status=status.HTTP_404_NOT_FOUND)

        from django.utils import timezone as tz
        today = tz.now().date()

        # 1. ADMINS
        admins_qs = User.objects.filter(daycare=daycare, is_staff=True).order_by('-date_joined')
        admins_data = [{
            'id': str(u.id),
            'username': u.username,
            'email': u.email,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'full_name': f"{u.first_name} {u.last_name}".strip() or u.username,
            'phone': getattr(u, 'mobile', '') or getattr(u, 'phone', '') or '',
            'mobile': getattr(u, 'mobile', '') or '',
            'is_active': u.is_active,
            'is_superuser': u.is_superuser,
            'status': getattr(u, 'status', 'Active') or ('Active' if u.is_active else 'Inactive'),
            'last_login': str(u.last_login) if u.last_login else None,
            'date_joined': str(u.date_joined) if u.date_joined else None,
        } for u in admins_qs]

        # 2. OVERVIEW & COUNTERS
        total_students = Student.objects.filter(daycare=daycare, deleted_at__isnull=True).count()
        active_students = Student.objects.filter(daycare=daycare, status='Active', deleted_at__isnull=True).count()
        total_classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).count()
        active_classrooms = Classroom.objects.filter(daycare=daycare, status='Active', deleted_at__isnull=True).count()
        total_employees = Employee.objects.filter(daycare=daycare).count()
        active_employees = Employee.objects.filter(daycare=daycare, status='active').count()
        total_teachers = Employee.objects.filter(daycare=daycare, role__icontains='teacher').count()
        total_branches = Branch.objects.filter(daycare=daycare, deleted_at__isnull=True).count()
        active_branches = total_branches

        overview_data = {
            'id': str(daycare.id),
            'name': daycare.name,
            'daycare_code': daycare.daycare_code or '',
            'status': daycare.status,
            'license_number': daycare.license_number or '',
            'registration_number': daycare.registration_number or '',
            'owner_name': daycare.owner_name or '',
            'director_name': daycare.director_name or '',
            'contact_person': daycare.contact_person or '',
            'email': daycare.email or '',
            'phone': daycare.phone or '',
            'website': daycare.website or '',
            'address1': daycare.address1 or '',
            'address2': daycare.address2 or '',
            'address': f"{daycare.address1 or ''} {daycare.address2 or ''}".strip(),
            'city': daycare.city or '',
            'state': daycare.state or (daycare.province.name if daycare.province else '') or '',
            'province': daycare.province.name if daycare.province else (daycare.state or ''),
            'province_code': daycare.province.code if daycare.province else '',
            'postal_code': daycare.postal_code or '',
            'country': daycare.country or 'Canada',
            'capacity': daycare.capacity or 0,
            'opening_time': str(daycare.opening_time) if daycare.opening_time else '07:00:00',
            'closing_time': str(daycare.closing_time) if daycare.closing_time else '18:00:00',
            'working_days': daycare.working_days or 'Monday - Friday',
            'created_at': str(daycare.created_at) if daycare.created_at else None,
            'updated_at': str(daycare.updated_at) if daycare.updated_at else None,
            'admins': admins_data,
            'stats': {
                'total_students': total_students,
                'active_students': active_students,
                'total_classrooms': total_classrooms,
                'active_classrooms': active_classrooms,
                'total_employees': total_employees,
                'active_employees': active_employees,
                'total_teachers': total_teachers,
                'total_branches': total_branches,
                'active_branches': active_branches,
            }
        }

        # 3. PROFILE DATA (with License & Emergency Info)
        license_obj = DaycareLicense.objects.filter(daycare=daycare).first()
        emergency_obj = DaycareEmergencyInformation.objects.filter(daycare=daycare).first()
        provinces_list = [{
            'id': str(p.id),
            'code': p.code,
            'name': p.name,
        } for p in Province.objects.filter(status='Active').order_by('name')]

        profile_data = {
            'id': str(daycare.id),
            'name': daycare.name,
            'daycare_code': daycare.daycare_code or '',
            'logo': daycare.logo or '',
            'status': daycare.status,
            'contact_person': daycare.contact_person or '',
            'owner_name': daycare.owner_name or '',
            'director_name': daycare.director_name or '',
            'email': daycare.email or '',
            'phone': daycare.phone or '',
            'website': daycare.website or '',
            'address1': daycare.address1 or '',
            'address2': daycare.address2 or '',
            'city': daycare.city or '',
            'state': daycare.state or (daycare.province.name if daycare.province else '') or '',
            'province_id': str(daycare.province_id) if daycare.province_id else None,
            'province_code': daycare.province.code if daycare.province else '',
            'province_name': daycare.province.name if daycare.province else '',
            'country': daycare.country or 'Canada',
            'postal_code': daycare.postal_code or '',
            'opening_time': str(daycare.opening_time) if daycare.opening_time else '07:00:00',
            'closing_time': str(daycare.closing_time) if daycare.closing_time else '18:00:00',
            'working_days': daycare.working_days or 'Monday - Friday',
            'capacity': daycare.capacity or 0,
            'license': {
                'license_number': license_obj.license_number if license_obj else (daycare.license_number or ''),
                'registration_number': daycare.registration_number or '',
                'license_type': license_obj.license_type if license_obj else 'Standard Childcare License',
                'issuing_authority': license_obj.issuing_authority if license_obj else 'Ministry of Education',
                'issue_date': str(license_obj.issue_date) if license_obj and license_obj.issue_date else None,
                'expiry_date': str(license_obj.expiry_date) if license_obj and license_obj.expiry_date else None,
                'status': license_obj.status if license_obj else 'Active',
                'document_path': license_obj.document_path if license_obj else '',
                'notes': license_obj.notes if license_obj else '',
            },
            'emergency': {
                'contact_name': emergency_obj.contact_name if emergency_obj else (daycare.contact_person or ''),
                'phone': emergency_obj.phone if emergency_obj else (daycare.phone or ''),
                'alternate_phone': emergency_obj.alternate_phone if emergency_obj else '',
                'email': emergency_obj.email if emergency_obj else (daycare.email or ''),
                'address': emergency_obj.address if emergency_obj else (f"{daycare.address1 or ''} {daycare.city or ''}".strip()),
                'police_contact': emergency_obj.police_contact if emergency_obj else '911',
                'fire_service_contact': emergency_obj.fire_service_contact if emergency_obj else '911',
                'hospital_contact': emergency_obj.hospital_contact if emergency_obj else 'Local General Hospital',
                'additional_instructions': emergency_obj.additional_instructions if emergency_obj else 'Primary evacuation assembly point is the front parking perimeter.',
            },
            'provinces': provinces_list,
        }

        # 4. SUBSCRIPTION DATA
        active_sub = daycare.subscriptions.filter(
            subscription_status__in=['Active', 'active', 'Trial', 'trial']
        ).order_by('-created_at').first()

        all_subs = daycare.subscriptions.all().order_by('-created_at')
        all_subs_data = [DaycareSubscriptionSerializer(s).data for s in all_subs]

        plan = active_sub.subscription_plan if active_sub else None
        plan_features_codes = set(plan.features.values_list('code', flat=True)) if plan else set()

        active_sub_data = None
        if active_sub:
            is_trial = active_sub.subscription_status.lower() == 'trial'
            end_date = active_sub.trial_end_date if (is_trial and active_sub.trial_end_date) else active_sub.expiry_date
            days_until_expiry = None
            is_expiring_soon = False
            is_expired = False
            if end_date:
                delta = (end_date - today).days
                days_until_expiry = delta
                is_expiring_soon = 0 <= delta <= 7
                is_expired = delta < 0

            active_sub_data = {
                'id': str(active_sub.id),
                'plan_id': str(plan.id) if plan else None,
                'plan_name': plan.name if plan else 'Custom Plan',
                'plan_description': plan.description if plan else '',
                'status': active_sub.subscription_status,
                'billing_cycle': active_sub.billing_cycle,
                'amount': float(active_sub.amount) if active_sub.amount else 0.0,
                'start_date': str(active_sub.start_date) if active_sub.start_date else None,
                'expiry_date': str(end_date) if end_date else None,
                'renewal_date': str(active_sub.renewal_date) if active_sub.renewal_date else (str(end_date) if end_date else None),
                'trial_end_date': str(active_sub.trial_end_date) if active_sub.trial_end_date else None,
                'days_until_expiry': days_until_expiry,
                'is_expiring_soon': is_expiring_soon,
                'is_expired': is_expired,
                'is_trial': is_trial,
                'features_count': len(plan_features_codes),
            }

        avail_plans = SubscriptionPlan.objects.filter(status='Active').order_by('monthly_price')
        avail_plans_data = [{
            'id': str(p.id),
            'name': p.name,
            'description': p.description,
            'monthly_price': float(p.monthly_price),
            'quarterly_price': float(p.quarterly_price) if p.quarterly_price else None,
            'annual_price': float(p.annual_price) if p.annual_price else None,
            'trial_days': p.trial_days,
            'max_students': p.max_students,
            'max_teachers': p.max_teachers,
            'max_staff': p.max_staff,
            'max_classrooms': p.max_classrooms,
            'max_branches': p.max_branches,
            'max_storage_mb': p.max_storage_mb,
            'features_count': p.features.count(),
        } for p in avail_plans]

        invoices_qs = SubscriptionInvoice.objects.filter(daycare=daycare).order_by('-created_at')[:15]
        invoices_data = [{
            'id': str(inv.id),
            'invoice_number': inv.invoice_number,
            'issue_date': str(inv.issue_date),
            'due_date': str(inv.due_date),
            'amount': float(inv.amount),
            'tax': float(inv.tax),
            'total': float(inv.total),
            'status': inv.status,
            'payment_date': str(inv.payment_date) if inv.payment_date else None,
            'created_at': str(inv.created_at),
        } for inv in invoices_qs]

        payments_qs = SubscriptionPayment.objects.filter(daycare=daycare).order_by('-created_at')[:15]
        payments_data = [{
            'id': str(pay.id),
            'amount': float(pay.amount),
            'payment_date': str(pay.payment_date),
            'currency': pay.currency,
            'payment_method': pay.payment_method,
            'payment_status': pay.payment_status,
            'transaction_reference': pay.transaction_reference,
            'created_at': str(pay.created_at),
        } for pay in payments_qs]

        subscription_section = {
            'active_subscription': active_sub_data,
            'all_subscriptions': all_subs_data,
            'available_plans': avail_plans_data,
            'invoices': invoices_data,
            'payments': payments_data,
        }

        # 5. CARE OPTIONS DATA
        overrides = daycare.feature_overrides or {}
        enabled_overrides = set(overrides.get('enabled', []))
        disabled_overrides = set(overrides.get('disabled', []))

        all_features = SubscriptionFeature.objects.all().order_by('category', 'order', 'name')
        features_list = []
        categories_set = []

        for feat in all_features:
            cat = feat.category or 'General Modules'
            if cat not in categories_set:
                categories_set.append(cat)

            is_in_plan = feat.code in plan_features_codes
            override_status = 'inherited'
            if feat.code in enabled_overrides:
                override_status = 'force_enabled'
            elif feat.code in disabled_overrides:
                override_status = 'force_disabled'

            is_effective = (is_in_plan and override_status != 'force_disabled') or (override_status == 'force_enabled')

            features_list.append({
                'id': str(feat.id),
                'code': feat.code,
                'name': feat.name,
                'description': feat.description or '',
                'category': cat,
                'order': feat.order,
                'is_in_plan': is_in_plan,
                'override_status': override_status,
                'is_effective': is_effective,
            })

        care_options_section = {
            'active_plan_name': plan.name if plan else 'No Active Plan',
            'active_plan_id': str(plan.id) if plan else None,
            'plan_features_count': len(plan_features_codes),
            'overrides': {
                'enabled': list(enabled_overrides),
                'disabled': list(disabled_overrides),
            },
            'categories': categories_set,
            'features': features_list,
            'total_features': len(features_list),
            'effective_count': sum(1 for f in features_list if f['is_effective']),
        }

        # 6. USAGE DATA
        max_stud = plan.max_students if plan and plan.max_students > 0 else (None if plan and plan.max_students == 0 else 30)
        max_teach = plan.max_teachers if plan and plan.max_teachers > 0 else (None if plan and plan.max_teachers == 0 else 5)
        max_staf = plan.max_staff if plan and plan.max_staff > 0 else (None if plan and plan.max_staff == 0 else 10)
        max_class = plan.max_classrooms if plan and plan.max_classrooms > 0 else (None if plan and plan.max_classrooms == 0 else 3)
        max_branch = plan.max_branches if plan and plan.max_branches > 0 else (None if plan and plan.max_branches in [-1, 0] else 1)
        max_storage = plan.max_storage_mb if plan and plan.max_storage_mb > 0 else 1024

        def calc_quota(current, max_val):
            if max_val is None or max_val == 0:
                return {'current': current, 'max': 'Unlimited', 'percent': 0, 'is_unlimited': True}
            pct = min(100, round((current / max_val) * 100, 1)) if max_val > 0 else 0
            return {'current': current, 'max': max_val, 'percent': pct, 'is_unlimited': False}

        total_daily_reports = DailyReport.objects.filter(daycare=daycare).count()
        total_attendance = StudentAttendance.objects.filter(daycare=daycare).count()
        total_tuition_invoices = Invoice.objects.filter(daycare=daycare).count()
        total_tuition_payments = Payment.objects.filter(daycare=daycare).count()
        total_guardians = Guardian.objects.filter(daycare=daycare).count()
        total_documents = Document.objects.filter(daycare=daycare).count()

        usage_section = {
            'quotas': {
                'students': calc_quota(active_students, max_stud),
                'teachers': calc_quota(active_employees, max_teach),
                'staff': calc_quota(total_employees, max_staf),
                'classrooms': calc_quota(active_classrooms, max_class),
                'branches': calc_quota(active_branches, max_branch),
                'storage': calc_quota(round(total_documents * 2.5, 1), max_storage),
            },
            'operations': {
                'daily_reports_count': total_daily_reports,
                'attendance_records_count': total_attendance,
                'tuition_invoices_count': total_tuition_invoices,
                'tuition_payments_count': total_tuition_payments,
                'guardians_count': total_guardians,
                'documents_count': total_documents,
            }
        }

        # 7. STAFF ROSTER
        employees_qs = Employee.objects.filter(daycare=daycare).select_related('user').order_by('first_name', 'last_name')
        staff_section = []
        for emp in employees_qs:
            assigned_rooms = list(ClassroomTeacherAssignment.objects.filter(
                employee=emp, deleted_at__isnull=True
            ).values_list('classroom__room_name', flat=True))
            staff_section.append({
                'id': str(emp.id),
                'first_name': emp.first_name,
                'last_name': emp.last_name,
                'full_name': f"{emp.first_name} {emp.last_name}".strip(),
                'employee_number': emp.employee_number or '',
                'role': emp.role or 'Staff',
                'job_title': emp.job_title or emp.role or 'Staff Member',
                'employment_type': emp.employment_type or 'Full-Time',
                'email': emp.email or (emp.user.email if emp.user else ''),
                'phone': emp.phone or '',
                'status': emp.status or 'active',
                'start_date': str(emp.start_date) if emp.start_date else None,
                'date_of_birth': str(emp.date_of_birth) if emp.date_of_birth else None,
                'photo': emp.photo or '',
                'assigned_classrooms': assigned_rooms,
            })

        # 8. CHILDREN ROSTER
        students_qs = Student.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('first_name', 'last_name')
        children_section = []
        for st in students_qs:
            active_enrollment = ClassroomStudent.objects.filter(student=st, status='Active').select_related('classroom').first()
            room_name = active_enrollment.classroom.room_name if active_enrollment and active_enrollment.classroom else 'Unassigned'
            
            emerg = st.emergency_contacts.filter(is_primary=True).first() or st.emergency_contacts.first()
            contact_name = emerg.name if emerg else ''
            contact_phone = emerg.mobile if emerg else ''

            age_str = ''
            if st.dob:
                age_years = today.year - st.dob.year - ((today.month, today.day) < (st.dob.month, st.dob.day))
                age_str = f"{age_years} yrs"

            children_section.append({
                'id': str(st.id),
                'first_name': st.first_name,
                'last_name': st.last_name,
                'full_name': f"{st.first_name} {st.last_name}".strip(),
                'admission_number': st.admission_number or '',
                'dob': str(st.dob) if st.dob else None,
                'age': age_str,
                'gender': st.gender or '',
                'status': st.status or 'Active',
                'admission_date': str(st.admission_date) if st.admission_date else None,
                'classroom_name': room_name,
                'contact_name': contact_name,
                'contact_phone': contact_phone,
                'allergies': st.allergies or '',
                'photo': st.photo or '',
            })

        # 9. CLASSROOMS
        classrooms_qs = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).select_related('age_group', 'primary_teacher').order_by('room_name')
        classrooms_section = []
        for rm in classrooms_qs:
            enrolled_count = ClassroomStudent.objects.filter(classroom=rm, status='Active').count()
            teacher_name = f"{rm.primary_teacher.first_name} {rm.primary_teacher.last_name}".strip() if rm.primary_teacher else 'Unassigned'
            classrooms_section.append({
                'id': str(rm.id),
                'room_name': rm.room_name,
                'room_code': rm.room_code or '',
                'age_group_name': rm.age_group.name if rm.age_group else 'All Ages',
                'capacity': rm.capacity or 0,
                'student_count': enrolled_count,
                'primary_teacher_name': teacher_name,
                'status': rm.status or 'Active',
                'floor': rm.floor or '',
                'building': rm.building or '',
                'color': rm.color or '#6366F1',
            })

        # 10. ACTIVITY (Operational Events Timeline)
        operational_events = []
        for att in StudentAttendance.objects.filter(daycare=daycare).select_related('student', 'classroom').order_by('-attendance_date', '-created_at')[:15]:
            status_display = getattr(att, 'attendance_status', 'Present') or 'Present'
            operational_events.append({
                'id': f"att-{att.id}",
                'type': 'attendance',
                'title': f"Attendance: {att.student.first_name} {att.student.last_name}",
                'description': f"Marked {status_display} on {att.attendance_date}",
                'timestamp': str(att.attendance_date),
                'badge_color': 'emerald' if str(status_display).upper() == 'PRESENT' else 'amber',
            })

        for dr in DailyReport.objects.filter(daycare=daycare).select_related('student').order_by('-created_at')[:15]:
            operational_events.append({
                'id': f"dr-{dr.id}",
                'type': 'daily_report',
                'title': f"Daily Report: {dr.student.first_name} {dr.student.last_name}",
                'description': f"Report published for date {dr.report_date}",
                'timestamp': str(dr.created_at),
                'badge_color': 'indigo',
            })

        for inv in Invoice.objects.filter(daycare=daycare).select_related('student').order_by('-created_at')[:10]:
            operational_events.append({
                'id': f"inv-{inv.id}",
                'type': 'invoice',
                'title': f"Tuition Invoice #{inv.invoice_number}",
                'description': f"Total ${inv.total_amount} - Status: {inv.status}",
                'timestamp': str(inv.created_at),
                'badge_color': 'blue',
            })

        operational_events = sorted(operational_events, key=lambda x: str(x['timestamp']), reverse=True)[:35]

        # 11. AUDIT (Security & System Audit Log)
        logs_qs = AuditLog.objects.filter(
            Q(entity_id=str(daycare.id)) | Q(user__daycare=daycare)
        ).order_by('-created_at')[:60]

        audit_section = [{
            'id': str(log.id),
            'timestamp': str(log.created_at),
            'created_at': str(log.created_at),
            'user_name': f"{log.user.first_name} {log.user.last_name}".strip() or log.user.username if log.user else 'System',
            'user_email': log.user.email if log.user else '',
            'user_type': log.user_type or 'SuperAdmin',
            'action': log.action,
            'module': log.module or 'System',
            'entity_type': log.entity_type,
            'entity_id': log.entity_id,
            'ip_address': log.ip_address or '—',
            'old_values': log.old_values or {},
            'new_values': log.new_values or {},
        } for log in logs_qs]

        return Response({
            'overview': overview_data,
            'profile': profile_data,
            'subscription': subscription_section,
            'care_options': care_options_section,
            'usage': usage_section,
            'admins': admins_data,
            'staff': staff_section,
            'children': children_section,
            'classrooms': classrooms_section,
            'activity': operational_events,
            'audit': audit_section,
        })

class AdminDaycareProfileView(generics.GenericAPIView):
    """
    Super Admin endpoint to fetch and update complete Daycare Profile:
    - Daycare basic info
    - Licensing info (DaycareLicense)
    - Emergency info (DaycareEmergencyInformation)
    GET  /super-admin/daycares/<pk>/profile/
    PUT  /super-admin/daycares/<pk>/profile/
    PATCH /super-admin/daycares/<pk>/profile/
    """
    permission_classes = [IsSuperUser]

    def get(self, request, pk):
        try:
            daycare = Daycare.objects.get(pk=pk)
        except Daycare.DoesNotExist:
            return Response({"error": "Daycare not found"}, status=status.HTTP_404_NOT_FOUND)

        license_obj = DaycareLicense.objects.filter(daycare=daycare).first()
        emergency_obj = DaycareEmergencyInformation.objects.filter(daycare=daycare).first()
        provinces_list = [{
            'id': str(p.id),
            'code': p.code,
            'name': p.name,
        } for p in Province.objects.filter(status='Active').order_by('name')]

        return Response({
            'id': str(daycare.id),
            'name': daycare.name,
            'daycare_code': daycare.daycare_code or '',
            'logo': daycare.logo or '',
            'status': daycare.status,
            'contact_person': daycare.contact_person or '',
            'owner_name': daycare.owner_name or '',
            'director_name': daycare.director_name or '',
            'email': daycare.email or '',
            'phone': daycare.phone or '',
            'website': daycare.website or '',
            'address1': daycare.address1 or '',
            'address2': daycare.address2 or '',
            'city': daycare.city or '',
            'state': daycare.state or (daycare.province.name if daycare.province else '') or '',
            'province_id': str(daycare.province_id) if daycare.province_id else None,
            'province_code': daycare.province.code if daycare.province else '',
            'province_name': daycare.province.name if daycare.province else '',
            'country': daycare.country or 'Canada',
            'postal_code': daycare.postal_code or '',
            'opening_time': str(daycare.opening_time) if daycare.opening_time else '07:00:00',
            'closing_time': str(daycare.closing_time) if daycare.closing_time else '18:00:00',
            'working_days': daycare.working_days or 'Monday - Friday',
            'capacity': daycare.capacity or 0,
            'license': {
                'license_number': license_obj.license_number if license_obj else (daycare.license_number or ''),
                'registration_number': daycare.registration_number or '',
                'license_type': license_obj.license_type if license_obj else 'Standard Childcare License',
                'issuing_authority': license_obj.issuing_authority if license_obj else 'Ministry of Education',
                'issue_date': str(license_obj.issue_date) if license_obj and license_obj.issue_date else None,
                'expiry_date': str(license_obj.expiry_date) if license_obj and license_obj.expiry_date else None,
                'status': license_obj.status if license_obj else 'Active',
                'document_path': license_obj.document_path if license_obj else '',
                'notes': license_obj.notes if license_obj else '',
            },
            'emergency': {
                'contact_name': emergency_obj.contact_name if emergency_obj else (daycare.contact_person or ''),
                'phone': emergency_obj.phone if emergency_obj else (daycare.phone or ''),
                'alternate_phone': emergency_obj.alternate_phone if emergency_obj else '',
                'email': emergency_obj.email if emergency_obj else (daycare.email or ''),
                'address': emergency_obj.address if emergency_obj else (f"{daycare.address1 or ''} {daycare.city or ''}".strip()),
                'police_contact': emergency_obj.police_contact if emergency_obj else '911',
                'fire_service_contact': emergency_obj.fire_service_contact if emergency_obj else '911',
                'hospital_contact': emergency_obj.hospital_contact if emergency_obj else '',
                'additional_instructions': emergency_obj.additional_instructions if emergency_obj else '',
            },
            'provinces': provinces_list,
        })

    def patch(self, request, pk):
        return self.put(request, pk)

    def put(self, request, pk):
        try:
            daycare = Daycare.objects.get(pk=pk)
        except Daycare.DoesNotExist:
            return Response({"error": "Daycare not found"}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        old_values = {
            'name': daycare.name,
            'status': daycare.status,
            'email': daycare.email,
            'phone': daycare.phone,
            'capacity': daycare.capacity,
        }

        with transaction.atomic():
            for field in ['name', 'logo', 'contact_person', 'owner_name', 'director_name', 'email', 'phone', 'website', 'address1', 'address2', 'city', 'state', 'country', 'postal_code', 'capacity', 'status', 'working_days']:
                if field in data:
                    setattr(daycare, field, data[field])

            if 'opening_time' in data:
                daycare.opening_time = data['opening_time'] or None
            if 'closing_time' in data:
                daycare.closing_time = data['closing_time'] or None

            province_id = data.get('province_id') or data.get('province')
            if province_id:
                try:
                    daycare.province = Province.objects.get(id=province_id)
                except Exception:
                    try:
                        daycare.province = Province.objects.get(code__iexact=str(province_id))
                    except Exception:
                        pass
            elif 'province_id' in data and data['province_id'] is None:
                daycare.province = None

            daycare.save()

            # License
            license_data = data.get('license', {})
            if license_data or 'license_number' in data:
                lic_num = license_data.get('license_number') or data.get('license_number') or daycare.license_number
                reg_num = license_data.get('registration_number') or data.get('registration_number') or daycare.registration_number
                
                daycare.license_number = lic_num
                daycare.registration_number = reg_num
                daycare.save(update_fields=['license_number', 'registration_number', 'updated_at'])

                DaycareLicense.objects.update_or_create(
                    daycare=daycare,
                    defaults={
                        'license_number': lic_num,
                        'license_type': license_data.get('license_type', 'Standard Childcare License'),
                        'issuing_authority': license_data.get('issuing_authority', 'Ministry of Education'),
                        'issue_date': license_data.get('issue_date') or None,
                        'expiry_date': license_data.get('expiry_date') or None,
                        'status': license_data.get('status', 'Active'),
                        'notes': license_data.get('notes', ''),
                    }
                )

            # Emergency
            emerg_data = data.get('emergency', {})
            if emerg_data:
                DaycareEmergencyInformation.objects.update_or_create(
                    daycare=daycare,
                    defaults={
                        'contact_name': emerg_data.get('contact_name', '') or daycare.contact_person or '',
                        'phone': emerg_data.get('phone', '') or daycare.phone or '',
                        'alternate_phone': emerg_data.get('alternate_phone', '') or '',
                        'email': emerg_data.get('email', '') or daycare.email or '',
                        'address': emerg_data.get('address', '') or '',
                        'police_contact': emerg_data.get('police_contact', '911') or '911',
                        'fire_service_contact': emerg_data.get('fire_service_contact', '911') or '911',
                        'hospital_contact': emerg_data.get('hospital_contact', '') or '',
                        'additional_instructions': emerg_data.get('additional_instructions', '') or '',
                    }
                )

            AuditLog.objects.create(
                user=request.user,
                user_type='SuperAdmin',
                action='Update Daycare Profile',
                module='Daycares',
                entity_type='Daycare',
                entity_id=str(daycare.id),
                old_values=old_values,
                new_values={'name': daycare.name, 'status': daycare.status, 'email': daycare.email, 'phone': daycare.phone, 'capacity': daycare.capacity},
                ip_address=request.META.get('REMOTE_ADDR')
            )

        return Response({"status": "success", "message": "Daycare profile updated successfully."})

class AdminDaycareAdminCreateView(generics.GenericAPIView):
    """
    POST /super-admin/daycares/<pk>/admins/
    Create a new Daycare Admin assigned directly to this daycare.
    """
    permission_classes = [IsSuperUser]

    def post(self, request, pk):
        try:
            daycare = Daycare.objects.get(pk=pk)
        except Daycare.DoesNotExist:
            return Response({"error": "Daycare not found"}, status=status.HTTP_404_NOT_FOUND)

        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        mobile = request.data.get('mobile', '') or request.data.get('phone', '')

        if not username or not password:
            return Response({"error": "Username and password are required"}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Username is already taken"}, status=status.HTTP_400_BAD_REQUEST)

        if email and User.objects.filter(email=email).exists():
            return Response({"error": "Email is already in use"}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create(
            username=username,
            email=email or '',
            first_name=first_name,
            last_name=last_name,
            mobile=mobile,
            daycare=daycare,
            is_staff=True,
            is_active=True,
            status='Active'
        )
        user.set_password(password)
        user.save()

        from django.contrib.auth.models import Group
        admin_group = Group.objects.filter(name='daycare_admin').first()
        if admin_group:
            user.groups.add(admin_group)

        AuditLog.objects.create(
            user=request.user,
            user_type='SuperAdmin',
            action='Create Daycare Admin',
            module='Users',
            entity_type='User',
            entity_id=str(user.id),
            new_values={'username': username, 'daycare': daycare.name},
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return Response({
            "status": "success",
            "message": f"Daycare Admin '{username}' created successfully.",
            "admin": {
                'id': str(user.id),
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'phone': user.mobile,
                'status': user.status,
                'is_active': user.is_active,
                'date_joined': str(user.date_joined),
            }
        }, status=status.HTTP_201_CREATED)

class AdminDaycareAssignPlanView(generics.GenericAPIView):
    """
    Super Admin endpoint to assign or change subscription plan for a daycare.
    POST /super-admin/daycares/<uuid:pk>/assign-plan/
    """
    permission_classes = [IsSuperUser]

    def post(self, request, pk):
        try:
            daycare = Daycare.objects.get(pk=pk)
        except Daycare.DoesNotExist:
            return Response({"error": "Daycare not found"}, status=status.HTTP_404_NOT_FOUND)

        plan_id = request.data.get('plan_id')
        billing_cycle = request.data.get('billing_cycle', 'Monthly')
        start_date = request.data.get('start_date') or timezone.now().date()
        status_val = request.data.get('status', 'Active')
        custom_amount = request.data.get('amount')

        try:
            plan = SubscriptionPlan.objects.get(pk=plan_id)
        except SubscriptionPlan.DoesNotExist:
            return Response({"error": "Selected Subscription Plan does not exist"}, status=status.HTTP_400_BAD_REQUEST)

        # Determine price
        if custom_amount is not None and str(custom_amount).strip() != '':
            amount = float(custom_amount)
        else:
            if billing_cycle == 'Annual' and plan.annual_price:
                amount = float(plan.annual_price)
            elif billing_cycle == 'Quarterly' and plan.quarterly_price:
                amount = float(plan.quarterly_price)
            else:
                amount = float(plan.monthly_price)

        if isinstance(start_date, str):
            from datetime import datetime as dt
            start_date_obj = dt.strptime(start_date, '%Y-%m-%d').date()
        else:
            start_date_obj = start_date

        if billing_cycle == 'Annual':
            delta = relativedelta(years=1)
        elif billing_cycle == 'Quarterly':
            delta = relativedelta(months=3)
        else:
            delta = relativedelta(months=1)

        expiry_date_obj = start_date_obj + delta

        with transaction.atomic():
            # Deactivate previous active subscriptions
            daycare.subscriptions.filter(subscription_status__in=['Active', 'active', 'Trial', 'trial']).update(
                subscription_status='superseded'
            )

            # Create new subscription
            sub = DaycareSubscription.objects.create(
                daycare=daycare,
                subscription_plan=plan,
                billing_cycle=billing_cycle,
                amount=amount,
                start_date=start_date_obj,
                expiry_date=expiry_date_obj,
                renewal_date=expiry_date_obj,
                subscription_status=status_val
            )

            # Ensure daycare is Active
            daycare.status = 'Active'
            daycare.save(update_fields=['status', 'updated_at'])

            # Create invoice & payment records
            now_dt = timezone.now()
            invoice = SubscriptionInvoice.objects.create(
                invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
                daycare=daycare,
                subscription=sub,
                issue_date=start_date_obj,
                due_date=start_date_obj,
                amount=amount,
                tax=0.0,
                total=amount,
                status='paid',
                payment_date=start_date_obj,
                created_at=now_dt,
                updated_at=now_dt
            )

            SubscriptionPayment.objects.create(
                daycare=daycare,
                invoice=invoice,
                subscription=sub,
                amount=amount,
                payment_date=start_date_obj,
                currency='CAD',
                payment_method='SuperAdmin Direct Assignment',
                payment_status='completed',
                transaction_reference=f"ADM-ASSIGN-{uuid.uuid4().hex[:8].upper()}",
                created_at=now_dt,
                updated_at=now_dt
            )

            AuditLog.objects.create(
                user=request.user,
                user_type='SuperAdmin',
                action='Assign Subscription Plan',
                module='Subscriptions',
                entity_type='Daycare',
                entity_id=str(daycare.id),
                new_values={
                    'plan_name': plan.name,
                    'billing_cycle': billing_cycle,
                    'amount': amount,
                    'start_date': str(start_date_obj),
                    'expiry_date': str(expiry_date_obj)
                }
            )

        return Response({
            "status": "success",
            "message": f"Successfully assigned plan '{plan.name}' to {daycare.name}. All {plan.features.count()} features are immediately active!",
            "subscription": DaycareSubscriptionSerializer(sub).data
        })

from django.db.models import Q

class AdminUserListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    serializer_class = AdminUserSerializer
    
    def get_queryset(self):
        return User.objects.filter(Q(is_staff=True) | Q(is_superuser=True)).order_by('-date_joined')
    
class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = User.objects.all()
    serializer_class = AdminUserSerializer

    def destroy(self, request, *args, **kwargs):
        user_obj = self.get_object()
        if user_obj.id == request.user.id:
            return Response({"error": "You cannot delete your own active account."}, status=status.HTTP_400_BAD_REQUEST)
        username = user_obj.username
        user_obj.delete()
        AuditLog.objects.create(
            user=request.user, user_type='SuperAdmin',
            action='Delete Platform User', module='Users',
            entity_type='User', entity_id=str(user_obj.id),
            new_values={'deleted_username': username}
        )
        return Response({"status": "success", "message": f"User '{username}' deleted successfully."}, status=status.HTTP_200_OK)

class AdminSubscriptionPlanListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = SubscriptionPlan.objects.all().order_by('monthly_price')
    serializer_class = SubscriptionPlanSerializer

class AdminSubscriptionPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = SubscriptionPlan.objects.all()
    serializer_class = SubscriptionPlanSerializer

class AdminDaycareSubscriptionListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    serializer_class = DaycareSubscriptionSerializer

    def get_queryset(self):
        from django.utils import timezone
        today = timezone.now().date()
        # Auto-expire past due subscriptions
        DaycareSubscription.objects.filter(
            expiry_date__lt=today,
            subscription_status__in=['Active', 'active', 'Trial', 'trial']
        ).update(subscription_status='expired')

        return DaycareSubscription.objects.all().order_by('-created_at')

from django.db import transaction
from django.utils import timezone
from core.models import AuditLog
import uuid
import datetime
from dateutil.relativedelta import relativedelta

class AdminDaycareSubscriptionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = DaycareSubscription.objects.all()
    serializer_class = DaycareSubscriptionSerializer

    def perform_destroy(self, instance):
        sub_id = str(instance.id)
        dc_name = instance.daycare.name if instance.daycare else 'Unknown'
        plan_name = instance.subscription_plan.name if instance.subscription_plan else 'Plan'
        
        # Log deletion in audit log
        AuditLog.objects.create(
            user=self.request.user,
            user_type='SuperAdmin',
            action='Deleted Subscription',
            module='Subscriptions',
            entity_type='DaycareSubscription',
            entity_id=sub_id,
            old_values={'daycare': dc_name, 'plan': plan_name, 'status': instance.subscription_status},
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
        instance.delete()

class AdminDaycareSubscriptionActionView(generics.GenericAPIView):
    permission_classes = [IsSuperUser]
    queryset = DaycareSubscription.objects.all()

    def post(self, request, pk, action):
        sub = self.get_object()
        
        if action == 'renew':
            # create payment & invoice
            now_dt = timezone.now()
            invoice = SubscriptionInvoice.objects.create(
                invoice_number=f"MOCK-INV-{uuid.uuid4().hex[:8].upper()}",
                daycare=sub.daycare,
                subscription=sub,
                issue_date=timezone.now().date(),
                due_date=timezone.now().date() + datetime.timedelta(days=7),
                amount=sub.amount,
                tax=0.0,
                total=sub.amount,
                status='paid',
                payment_date=timezone.now().date(),
                created_at=now_dt,
                updated_at=now_dt
            )
            
            SubscriptionPayment.objects.create(
                daycare=sub.daycare,
                invoice=invoice,
                subscription=sub,
                amount=sub.amount,
                payment_date=timezone.now().date(),
                currency='USD',
                payment_method='Mock Credit Card',
                payment_status='completed',
                transaction_reference=f"MOCK-TXN-{uuid.uuid4().hex[:8].upper()}",
                created_at=now_dt,
                updated_at=now_dt
            )
            
            # update dates
            if sub.billing_cycle == 'Monthly':
                delta = relativedelta(months=1)
            elif sub.billing_cycle == 'Quarterly':
                delta = relativedelta(months=3)
            elif sub.billing_cycle == 'Annual':
                delta = relativedelta(years=1)
            else:
                delta = relativedelta(months=1)
                
            if not sub.expiry_date or sub.expiry_date < timezone.now().date():
                sub.expiry_date = timezone.now().date() + delta
            else:
                sub.expiry_date = sub.expiry_date + delta
                
            sub.renewal_date = sub.expiry_date
            sub.subscription_status = 'Active'
            sub.save()
            
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Subscription Renewed', module='Subscriptions',
                entity_type='DaycareSubscription', entity_id=str(sub.id),
                new_values={'expiry_date': str(sub.expiry_date)}
            )
            return Response({"status": "success", "message": "Subscription renewed", "expiry_date": sub.expiry_date})
            
        elif action in ['activate', 'renew_active']:
            sub.subscription_status = 'Active'
            if not sub.expiry_date or sub.expiry_date < timezone.now().date():
                sub.expiry_date = timezone.now().date() + relativedelta(months=1)
                sub.renewal_date = sub.expiry_date
            sub.save()
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Subscription Activated', module='Subscriptions',
                entity_type='DaycareSubscription', entity_id=str(sub.id),
                new_values={'status': 'Active', 'expiry_date': str(sub.expiry_date)}
            )
            return Response({"status": "success", "message": "Subscription activated successfully", "expiry_date": sub.expiry_date})

        elif action in ['suspend', 'stop']:
            sub.subscription_status = 'suspended'
            sub.suspended_by = request.user
            sub.suspended_at = timezone.now()
            sub.suspension_reason = request.data.get('reason', 'Admin stop action')
            sub.save()
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Subscription Suspended', module='Subscriptions',
                entity_type='DaycareSubscription', entity_id=str(sub.id),
                new_values={'status': 'suspended'}
            )
            return Response({"status": "success", "message": "Subscription stopped/suspended"})
            
        elif action == 'cancel':
            sub.subscription_status = 'cancelled'
            sub.save()
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Subscription Cancelled', module='Subscriptions',
                entity_type='DaycareSubscription', entity_id=str(sub.id),
                new_values={'status': 'cancelled'}
            )
            return Response({"status": "success", "message": "Subscription cancelled"})
            
        return Response({"error": "Invalid action"}, status=400)

class DaycareActionView(generics.GenericAPIView):
    permission_classes = [IsSuperUser]
    queryset = Daycare.objects.all()

    def post(self, request, pk, action):
        daycare = self.get_object()
        
        if action == 'suspend':
            daycare.status = 'Suspended'
            daycare.save()
            reason = request.data.get('reason', '')
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Suspend Daycare', module='Daycares',
                entity_type='Daycare', entity_id=str(daycare.id),
                new_values={'status': 'Suspended', 'reason': reason}
            )
            return Response({"status": "success", "daycare_status": daycare.status, "message": "Daycare suspended successfully."})
            
        elif action == 'activate':
            daycare.status = 'Active'
            daycare.save()
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Activate Daycare', module='Daycares',
                entity_type='Daycare', entity_id=str(daycare.id),
                new_values={'status': 'Active'}
            )
            return Response({"status": "success", "daycare_status": daycare.status, "message": "Daycare activated successfully."})
            
        elif action == 'restore':
            daycare.deleted_at = None
            daycare.deleted_by = None
            daycare.status = 'Active'
            daycare.save()
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Restore Daycare', module='Daycares',
                entity_type='Daycare', entity_id=str(daycare.id),
                new_values={'deleted_at': None, 'status': 'Active'}
            )
            return Response({"status": "success", "daycare_status": daycare.status, "message": f"Daycare '{daycare.name}' restored to Active status."})
            
        elif action in ['delete', 'soft_delete']:
            daycare.deleted_at = timezone.now()
            daycare.deleted_by = request.user
            daycare.status = 'Deleted'
            daycare.save()
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Soft Delete Daycare', module='Daycares',
                entity_type='Daycare', entity_id=str(daycare.id),
                new_values={'status': 'Deleted'}
            )
            return Response({"status": "success", "daycare_status": daycare.status, "message": f"Daycare '{daycare.name}' marked as deleted."})
            
        elif action in ['permanent_delete', 'hard_delete', 'purge']:
            daycare_name = daycare.name
            purge_daycare_and_data(daycare, user=request.user)
            return Response({"status": "success", "message": f"Daycare '{daycare_name}' and all related records were permanently deleted."})
            
        else:
            return Response({"error": f"Invalid action '{action}'"}, status=status.HTTP_400_BAD_REQUEST)

class AdminDaycareBulkActionView(generics.GenericAPIView):
    permission_classes = [IsSuperUser]

    def post(self, request):
        action = request.data.get('action')
        daycare_ids = request.data.get('ids', [])

        if not action:
            return Response({"error": "Action is required."}, status=status.HTTP_400_BAD_REQUEST)

        if action == 'purge_all_deleted':
            deleted_daycares = Daycare.objects.filter(status='Deleted')
            count = deleted_daycares.count()
            for d in list(deleted_daycares):
                purge_daycare_and_data(d, user=request.user)
            return Response({"status": "success", "message": f"Successfully permanently deleted {count} deleted daycare(s).", "affected_count": count})

        if not daycare_ids:
            return Response({"error": "No daycare IDs provided."}, status=status.HTTP_400_BAD_REQUEST)

        daycares = Daycare.objects.filter(id__in=daycare_ids)
        affected_count = 0

        for daycare in list(daycares):
            if action in ['permanent_delete', 'hard_delete', 'purge']:
                purge_daycare_and_data(daycare, user=request.user)
                affected_count += 1
            elif action == 'restore':
                daycare.deleted_at = None
                daycare.deleted_by = None
                daycare.status = 'Active'
                daycare.save()
                affected_count += 1
            elif action in ['delete', 'soft_delete']:
                daycare.deleted_at = timezone.now()
                daycare.deleted_by = request.user
                daycare.status = 'Deleted'
                daycare.save()
                affected_count += 1
            elif action == 'suspend':
                daycare.status = 'Suspended'
                daycare.save()
                affected_count += 1
            elif action == 'activate':
                daycare.status = 'Active'
                daycare.save()
                affected_count += 1

        return Response({
            "status": "success",
            "message": f"Bulk {action} completed on {affected_count} daycare(s).",
            "affected_count": affected_count
        })

class DaycareOnboardingView(generics.GenericAPIView):
    permission_classes = [IsSuperUser]
    
    @transaction.atomic
    def post(self, request):
        data = request.data
        
        # 1. Create Daycare
        daycare_serializer = AdminDaycareSerializer(data=data.get('daycare'))
        daycare_serializer.is_valid(raise_exception=True)
        daycare = daycare_serializer.save()
        
        # 2. Create Admin
        admin_data = data.get('admin')
        if admin_data:
            admin_data['daycare'] = daycare.id
            admin_serializer = AdminUserSerializer(data=admin_data)
            admin_serializer.is_valid(raise_exception=True)
            admin = admin_serializer.save(is_staff=True, is_superuser=False)
        # 3. Create Subscription & Invoice
        subscription_info = {}
        invoice_info = {}
        subscription_data = data.get('subscription')
        if subscription_data:
            plan_id = subscription_data.get('plan_id')
            billing_cycle = subscription_data.get('billing_cycle', 'Monthly')
            if plan_id:
                try:
                    plan = SubscriptionPlan.objects.get(id=plan_id)
                    amount = getattr(plan, f"{billing_cycle.lower()}_price", plan.price)

                    trial_days = plan.trial_days or 0
                    today = timezone.now().date()

                    sub = DaycareSubscription.objects.create(
                        daycare=daycare,
                        subscription_plan=plan,
                        billing_cycle=billing_cycle,
                        amount=amount,
                        subscription_status='trial' if trial_days > 0 else 'active',
                        start_date=today if trial_days == 0 else today + datetime.timedelta(days=trial_days),
                        trial_start_date=today if trial_days > 0 else None,
                        trial_end_date=today + datetime.timedelta(days=trial_days) if trial_days > 0 else None
                    )

                    subscription_info = {
                        'plan_name': plan.name,
                        'billing_cycle': billing_cycle,
                        'amount': float(amount),
                        'status': sub.subscription_status,
                        'start_date': str(sub.start_date) if sub.start_date else None,
                        'trial_end_date': str(sub.trial_end_date) if sub.trial_end_date else None,
                        'is_trial': trial_days > 0,
                        'trial_days': trial_days,
                    }

                    if amount > 0:
                        from core.models import SubscriptionInvoice
                        import random
                        invoice_number = f"INV-{today.strftime('%Y%m%d')}-{random.randint(1000, 9999)}"
                        due_date = sub.start_date if sub.start_date else today
                        now_dt = timezone.now()
                        inv = SubscriptionInvoice.objects.create(
                            daycare=daycare,
                            subscription=sub,
                            invoice_number=invoice_number,
                            issue_date=today,
                            due_date=due_date,
                            amount=amount,
                            tax=0,
                            total=amount,
                            status='unpaid',
                            created_at=now_dt,
                            updated_at=now_dt,
                        )
                        invoice_info = {
                            'invoice_number': inv.invoice_number,
                            'amount': float(inv.amount),
                            'total': float(inv.total),
                            'issue_date': str(inv.issue_date),
                            'due_date': str(inv.due_date),
                            'status': inv.status,
                        }
                except SubscriptionPlan.DoesNotExist:
                    pass

        # 4. Audit Log
        AuditLog.objects.create(
            user=request.user, user_type='SuperAdmin',
            action='Onboard Daycare', module='Daycares',
            entity_type='Daycare', entity_id=str(daycare.id),
        )

        # 5. Return all created data for the success screen
        admin_credentials = {}
        if admin_data:
            admin_credentials = {
                'full_name': f"{admin_data.get('first_name', '')} {admin_data.get('last_name', '')}".strip(),
                'username': admin_data.get('username', ''),
                'email': admin_data.get('email', ''),
                'password': admin_data.get('password', ''),
            }

        return Response({
            "status": "success",
            "daycare_id": str(daycare.id),
            "daycare_name": daycare.name,
            "admin_credentials": admin_credentials,
            "subscription": subscription_info,
            "invoice": invoice_info,
        }, status=status.HTTP_201_CREATED)


class DaycareAdminListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    serializer_class = AdminUserSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return User.objects.filter(is_staff=True, daycare__isnull=False).order_by('-date_joined')
        
    def perform_create(self, serializer):
        if not self.request.data.get('daycare'):
            raise serializers.ValidationError({"daycare": "Daycare is required for a Daycare Admin."})
        serializer.save(is_staff=True, is_superuser=False)

class DaycareAdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    serializer_class = AdminUserSerializer
    
    def get_queryset(self):
        return User.objects.filter(is_staff=True, daycare__isnull=False)

    def destroy(self, request, *args, **kwargs):
        admin = self.get_object()
        if admin.id == request.user.id:
            return Response({"error": "You cannot delete your own active account."}, status=status.HTTP_400_BAD_REQUEST)
        username = admin.username
        admin.delete()
        AuditLog.objects.create(
            user=request.user, user_type='SuperAdmin',
            action='Delete Daycare Admin', module='Users',
            entity_type='User', entity_id=str(admin.id),
            new_values={'deleted_username': username}
        )
        return Response({"status": "success", "message": f"Daycare admin '{username}' deleted successfully."}, status=status.HTTP_200_OK)

class DaycareAdminActionView(generics.GenericAPIView):
    permission_classes = [IsSuperUser]
    
    def get_queryset(self):
        return User.objects.filter(is_staff=True, daycare__isnull=False)

    def post(self, request, pk, action):
        admin = self.get_object()
        
        if action == 'suspend':
            admin.status = 'Suspended'
            admin.is_active = False
            admin.save()
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Suspend Daycare Admin', module='Users',
                entity_type='User', entity_id=str(admin.id),
                new_values={'status': 'Suspended'}
            )
            return Response({"status": "success", "admin_status": admin.status, "message": f"Admin '{admin.username}' suspended."})
            
        elif action == 'activate':
            admin.status = 'Active'
            admin.is_active = True
            admin.save()
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Activate Daycare Admin', module='Users',
                entity_type='User', entity_id=str(admin.id),
                new_values={'status': 'Active'}
            )
            return Response({"status": "success", "admin_status": admin.status, "message": f"Admin '{admin.username}' activated."})
            
        elif action == 'reset_password':
            new_password = request.data.get('password')
            if not new_password:
                return Response({"error": "Password is required"}, status=status.HTTP_400_BAD_REQUEST)
            admin.set_password(new_password)
            admin.save()
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Reset Admin Password', module='Users',
                entity_type='User', entity_id=str(admin.id)
            )
            return Response({"status": "success", "message": f"Password reset for '{admin.username}'."})
            
        elif action in ['delete', 'permanent_delete']:
            if admin.id == request.user.id:
                return Response({"error": "You cannot delete your own active account."}, status=status.HTTP_400_BAD_REQUEST)
            username = admin.username
            admin.delete()
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Delete Daycare Admin', module='Users',
                entity_type='User', entity_id=str(admin.id),
                new_values={'deleted_username': username}
            )
            return Response({"status": "success", "message": f"Daycare admin '{username}' deleted successfully."})
            
        else:
            return Response({"error": f"Invalid action '{action}'"}, status=status.HTTP_400_BAD_REQUEST)

from core.models import AuditLog, SupportTicket, SupportTicketMessage, SubscriptionInvoice, SubscriptionPayment, User, Student, SubscriptionFeature, SystemAnnouncement
from core.serializers import (AuditLogSerializer, SupportTicketSerializer, SupportTicketMessageSerializer,
                             SubscriptionInvoiceSerializer, SubscriptionPaymentSerializer, SystemAnnouncementSerializer, SubscriptionFeatureSerializer)

class SubscriptionFeatureListView(generics.ListAPIView):
    permission_classes = [IsSuperUser]
    queryset = SubscriptionFeature.objects.all().order_by('name')
    serializer_class = SubscriptionFeatureSerializer

class AuditLogListView(generics.ListAPIView):
    permission_classes = [IsSuperUser]
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        queryset = AuditLog.objects.all().order_by('-created_at')
        
        user_id = self.request.query_params.get('user', None)
        module = self.request.query_params.get('module', None)
        action = self.request.query_params.get('action', None)
        search = self.request.query_params.get('search', None)
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        
        if user_id:
            queryset = queryset.filter(user__id=user_id)
        if module:
            queryset = queryset.filter(module__iexact=module)
        if action:
            queryset = queryset.filter(action__iexact=action)
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        if search:
            queryset = queryset.filter(Q(action__icontains=search) | Q(module__icontains=search) | Q(entity_type__icontains=search))
            
        return queryset

class SupportTicketListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = SupportTicket.objects.all().order_by('-created_at')
    serializer_class = SupportTicketSerializer

class SupportTicketDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = SupportTicket.objects.all()
    serializer_class = SupportTicketSerializer

    def perform_update(self, serializer):
        old_ticket = self.get_object()
        old_status = old_ticket.status
        old_priority = old_ticket.priority
        
        ticket = serializer.save()
        
        if old_status != ticket.status or old_priority != ticket.priority:
            AuditLog.objects.create(
                user=self.request.user,
                user_type='SuperAdmin',
                action='Updated Support Ticket',
                module='Support',
                entity_type='SupportTicket',
                entity_id=str(ticket.id),
                old_values={'status': old_status, 'priority': old_priority},
                new_values={'status': ticket.status, 'priority': ticket.priority},
                ip_address=self.request.META.get('REMOTE_ADDR')
            )

class SupportTicketMessageCreateView(generics.CreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = SupportTicketMessage.objects.all()
    serializer_class = SupportTicketMessageSerializer

    def perform_create(self, serializer):
        ticket = SupportTicket.objects.get(pk=self.kwargs['pk'])
        serializer.save(ticket=ticket, sender=self.request.user)

class SystemAnnouncementListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = SystemAnnouncement.objects.all().order_by('-created_at')
    serializer_class = SystemAnnouncementSerializer

    def perform_create(self, serializer):
        announcement = serializer.save(created_by=self.request.user)
        AuditLog.objects.create(
            user=self.request.user,
            user_type='SuperAdmin',
            action='Created Announcement',
            module='Announcements',
            entity_type='SystemAnnouncement',
            entity_id=str(announcement.id),
            new_values={'title': announcement.title, 'status': announcement.status},
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

class SystemAnnouncementDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = SystemAnnouncement.objects.all()
    serializer_class = SystemAnnouncementSerializer

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        announcement = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            user_type='SuperAdmin',
            action='Updated Announcement',
            module='Announcements',
            entity_type='SystemAnnouncement',
            entity_id=str(announcement.id),
            old_values={'status': old_status},
            new_values={'status': announcement.status},
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            user_type='SuperAdmin',
            action='Deleted Announcement',
            module='Announcements',
            entity_type='SystemAnnouncement',
            entity_id=str(instance.id),
            old_values={'title': instance.title},
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
        instance.delete()

class SubscriptionInvoiceListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = SubscriptionInvoice.objects.all().order_by('-issue_date')
    serializer_class = SubscriptionInvoiceSerializer

class SubscriptionInvoiceClearMocksView(APIView):
    permission_classes = [IsSuperUser]

    def post(self, request):
        mock_invoices = SubscriptionInvoice.objects.filter(invoice_number__startswith='MOCK-')
        count = mock_invoices.count()
        SubscriptionPayment.objects.filter(invoice__in=mock_invoices).delete()
        mock_invoices.delete()
        
        AuditLog.objects.create(
            user=request.user,
            user_type='SuperAdmin',
            action='Cleared Mock Invoices',
            module='Billing',
            entity_type='SubscriptionInvoice',
            entity_id='all-mocks',
            old_values={'deleted_count': count},
            ip_address=request.META.get('REMOTE_ADDR')
        )
        return Response({"status": "success", "message": f"Successfully deleted {count} mock invoice(s).", "deleted_count": count})

class SubscriptionInvoiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = SubscriptionInvoice.objects.all()
    serializer_class = SubscriptionInvoiceSerializer

    def perform_destroy(self, instance):
        inv_id = str(instance.id)
        inv_num = instance.invoice_number
        dc_name = instance.daycare.name if instance.daycare else 'Unknown'
        
        # Delete linked payments
        SubscriptionPayment.objects.filter(invoice=instance).delete()
        
        # Audit log
        AuditLog.objects.create(
            user=self.request.user,
            user_type='SuperAdmin',
            action='Deleted Subscription Invoice',
            module='Billing',
            entity_type='SubscriptionInvoice',
            entity_id=inv_id,
            old_values={'invoice_number': inv_num, 'daycare': dc_name, 'amount': str(instance.total or instance.amount)},
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
        instance.delete()

    def perform_update(self, serializer):
        old_status = self.get_object().status
        instance = serializer.save()
        
        # If status transitioned to Paid
        if instance.status and instance.status.lower() == 'paid':
            if not instance.payment_date:
                instance.payment_date = timezone.now().date()
                instance.save(update_fields=['payment_date'])
            
            # Create payment record if none exists
            if not SubscriptionPayment.objects.filter(invoice=instance).exists():
                SubscriptionPayment.objects.create(
                    daycare=instance.daycare,
                    invoice=instance,
                    subscription=instance.subscription,
                    amount=instance.total or instance.amount or 0,
                    payment_date=instance.payment_date or timezone.now().date(),
                    currency='USD',
                    payment_method='Manual / Offline',
                    payment_status='Completed',
                    transaction_reference=f"PAY-{instance.invoice_number}",
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )
            
            # Ensure Daycare Subscription is Active
            if instance.subscription:
                sub = instance.subscription
                sub.subscription_status = 'Active'
                if not sub.renewal_date and sub.expiry_date:
                    sub.renewal_date = sub.expiry_date
                sub.save()
            elif instance.daycare:
                sub = instance.daycare.subscriptions.first()
                if sub:
                    sub.subscription_status = 'Active'
                    sub.save()

            # Audit log
            AuditLog.objects.create(
                user=self.request.user,
                user_type='SuperAdmin',
                action='Marked Invoice as Paid',
                module='Billing',
                entity_type='SubscriptionInvoice',
                entity_id=str(instance.id),
                old_values={'status': old_status},
                new_values={'status': instance.status, 'payment_date': str(instance.payment_date)},
                ip_address=self.request.META.get('REMOTE_ADDR')
            )

class SubscriptionPaymentListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = SubscriptionPayment.objects.all().order_by('-payment_date')
    serializer_class = SubscriptionPaymentSerializer

from django.db.models import Count, Sum, Q
from django.db.models.functions import TruncMonth
import datetime
from django.utils import timezone
from core.models import Daycare, DaycareSubscription, SubscriptionPlan, Student, Employee, Classroom, SubscriptionInvoice, SupportTicket

class SuperAdminDashboardView(generics.GenericAPIView):
    permission_classes = [IsSuperUser]
    
    def get(self, request):
        now = timezone.now()
        
        # Base Metrics
        total_daycares = Daycare.objects.count()
        active_daycares = Daycare.objects.filter(status__iexact='active').count()
        suspended_daycares = Daycare.objects.filter(status__iexact='suspended').count()
        
        # Trial daycares logic (based on subscription)
        trial_daycares = DaycareSubscription.objects.filter(
            Q(subscription_status__iexact='trial') |
            (Q(trial_start_date__isnull=False) & Q(trial_start_date__lte=now.date()) & Q(trial_end_date__gte=now.date()))
        ).count()
        
        active_subscriptions = DaycareSubscription.objects.filter(subscription_status__iexact='active').count()
        expired_subscriptions = DaycareSubscription.objects.filter(subscription_status__iexact='expired').count()
        
        total_students = Student.objects.count()
        total_staff = Employee.objects.count()
        total_classrooms = Classroom.objects.count()
        
        # Monthly Revenue (current month)
        current_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).date()
        revenue = SubscriptionInvoice.objects.filter(
            status__iexact='paid', 
            payment_date__gte=current_month
        ).aggregate(total=Sum('amount'))['total'] or 0.00
        
        pending_tickets = SupportTicket.objects.filter(status__iexact='open').count()
        
        # Chart Data: Daycare Growth (Last 6 months)
        six_months_ago = now - datetime.timedelta(days=180)
        daycare_growth = list(Daycare.objects.filter(created_at__gte=six_months_ago)
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month'))
            
        # Format dates for frontend
        for d in daycare_growth:
            d['month'] = d['month'].strftime('%b %Y') if d['month'] else ''

        # Chart Data: Subscription Status
        subscription_status = list(DaycareSubscription.objects.values('subscription_status')
            .annotate(count=Count('id')))
            
        # Chart Data: Revenue History (Last 6 months)
        revenue_history = list(SubscriptionInvoice.objects.filter(status__iexact='paid', payment_date__gte=six_months_ago.date())
            .annotate(month=TruncMonth('payment_date'))
            .values('month')
            .annotate(total=Sum('amount'))
            .order_by('month'))
            
        for r in revenue_history:
            r['month'] = r['month'].strftime('%b %Y') if r['month'] else ''

        return Response({
            "metrics": {
                "total_daycares": total_daycares,
                "active_daycares": active_daycares,
                "suspended_daycares": suspended_daycares,
                "trial_daycares": trial_daycares,
                "active_subscriptions": active_subscriptions,
                "expired_subscriptions": expired_subscriptions,
                "total_students": total_students,
                "total_staff": total_staff,
                "total_classrooms": total_classrooms,
                "monthly_revenue": float(revenue),
                "pending_tickets": pending_tickets
            },
            "charts": {
                "daycare_growth": daycare_growth,
                "subscription_status": subscription_status,
                "revenue_history": revenue_history
            }
        })





from core.models import RatioRule
from core.serializers import RatioRuleSerializer

class AdminSystemRatioRuleListView(generics.ListCreateAPIView):
    """
    Super Admin management for system-level baseline ratio rules.
    """
    permission_classes = [IsSuperUser]
    serializer_class = RatioRuleSerializer

    def get_queryset(self):
        qs = RatioRule.objects.filter(Q(daycare__isnull=True) | Q(is_system_rule=True)).select_related('province', 'program', 'age_group', 'created_by', 'updated_by')
        province_id = self.request.query_params.get('province_id')
        if province_id:
            qs = qs.filter(province_id=province_id)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(qualification_requirement__icontains=search))
        return qs.order_by('province__code', 'min_age_months')

    def perform_create(self, serializer):
        serializer.save(
            daycare=None,
            is_system_rule=True,
            created_by=self.request.user,
            updated_by=self.request.user
        )


class AdminSystemRatioRuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Super Admin detail, update, delete for system-level baseline ratio rules.
    """
    permission_classes = [IsSuperUser]
    serializer_class = RatioRuleSerializer
    queryset = RatioRule.objects.filter(Q(daycare__isnull=True) | Q(is_system_rule=True))

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)



