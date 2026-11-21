from datetime import datetime, date
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import views, viewsets, status, permissions, generics
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.decorators import action

from core.models import (
    Daycare, Classroom, RatioRule, RatioManualOverride, RatioComplianceHistory,
    Province, AuditLog, AgeGroup, Program, Employee
)
from core.serializers import (
    RatioRuleSerializer, RatioManualOverrideSerializer, RatioComplianceHistorySerializer,
    AuditLogSerializer
)
from core.permissions import IsDaycareAdmin
from daycare.services.ratio_monitoring import RatioMonitoringService
from daycare.services.ratio_reports import RatioReportsService
from daycare.services.qualified_staff import QualifiedStaffService
from daycare.services.ratio_rules_engine import RatioRulesEngineService


def resolve_request_daycare(request):
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


def verify_not_guardian(user):
    if getattr(user, 'guardian_profile', None) or getattr(user, 'guardian', None) or getattr(user, 'role', '') == 'Guardian':
        raise PermissionDenied("Guardians do not have permission to access internal ratio monitoring.")


class LiveRatioMonitoringView(views.APIView):
    """
    GET /api/daycare/ratio-monitoring/
    GET /api/daycare/ratio-monitoring/dashboard/
    Returns live classroom ratio calculations, room-by-room compliance status,
    rule explanations, manual overrides, and daycare summary metrics.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        verify_not_guardian(request.user)
        daycare = resolve_request_daycare(request)

        if not daycare:
            return Response(
                {"error": "Daycare not found for authenticated user."},
                status=status.HTTP_400_BAD_REQUEST
            )

        date_str = request.query_params.get('date')
        target_date = timezone.now().date()
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"error": "Invalid date format. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        time_str = request.query_params.get('time')
        target_time = timezone.now().time()
        if time_str:
            try:
                target_time = datetime.strptime(time_str, '%H:%M:%S').time()
            except ValueError:
                try:
                    target_time = datetime.strptime(time_str, '%H:%M').time()
                except ValueError:
                    pass

        classroom_id = request.query_params.get('classroom_id')
        if classroom_id:
            classroom = get_object_or_404(
                Classroom,
                id=classroom_id,
                daycare=daycare,
                deleted_at__isnull=True
            )
            result = RatioMonitoringService.calculate_classroom_ratio(
                classroom,
                target_date=target_date,
                target_time=target_time
            )
            return Response(result, status=status.HTTP_200_OK)

        summary = RatioMonitoringService.get_daycare_ratio_summary(
            daycare,
            target_date=target_date,
            target_time=target_time
        )
        return Response(summary, status=status.HTTP_200_OK)


class ClassroomLiveRatioDetailView(views.APIView):
    """
    GET /api/daycare/ratio-monitoring/classrooms/<uuid:pk>/
    Detailed live ratio inspection for a specific classroom with rule explanation and overrides.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        verify_not_guardian(request.user)
        daycare = resolve_request_daycare(request)

        if not daycare:
            return Response(
                {"error": "Daycare not found for authenticated user."},
                status=status.HTTP_400_BAD_REQUEST
            )

        classroom = get_object_or_404(
            Classroom,
            id=pk,
            daycare=daycare,
            deleted_at__isnull=True
        )

        date_str = request.query_params.get('date')
        target_date = timezone.now().date()
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"error": "Invalid date format. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        time_str = request.query_params.get('time')
        target_time = timezone.now().time()
        if time_str:
            try:
                target_time = datetime.strptime(time_str, '%H:%M:%S').time()
            except ValueError:
                try:
                    target_time = datetime.strptime(time_str, '%H:%M').time()
                except ValueError:
                    pass

        result = RatioMonitoringService.calculate_classroom_ratio(
            classroom,
            target_date=target_date,
            target_time=target_time
        )
        return Response(result, status=status.HTTP_200_OK)


class RatioComplianceHistoryListView(generics.ListAPIView):
    """
    GET /api/daycare/ratio-monitoring/history/
    Lists immutable compliance evaluation snapshots with rich filtering.
    """
    serializer_class = RatioComplianceHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        verify_not_guardian(self.request.user)
        daycare = resolve_request_daycare(self.request)
        if not daycare:
            return RatioComplianceHistory.objects.none()

        qs = RatioComplianceHistory.objects.filter(daycare=daycare).select_related('classroom', 'rule_used', 'override_by')

        # Filters
        classroom_id = self.request.query_params.get('classroom_id')
        if classroom_id:
            qs = qs.filter(classroom_id=classroom_id)

        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'ALL':
            if status_param == 'OVERRIDDEN':
                qs = qs.filter(override_applied=True)
            else:
                qs = qs.filter(final_status=status_param)

        date_param = self.request.query_params.get('date')
        if date_param:
            try:
                d = datetime.strptime(date_param, '%Y-%m-%d').date()
                qs = qs.filter(evaluated_at__date=d)
            except ValueError:
                pass

        start_date = self.request.query_params.get('start_date')
        if start_date:
            try:
                sd = datetime.strptime(start_date, '%Y-%m-%d').date()
                qs = qs.filter(evaluated_at__date__gte=sd)
            except ValueError:
                pass

        end_date = self.request.query_params.get('end_date')
        if end_date:
            try:
                ed = datetime.strptime(end_date, '%Y-%m-%d').date()
                qs = qs.filter(evaluated_at__date__lte=ed)
            except ValueError:
                pass

        program_id = self.request.query_params.get('program_id')
        if program_id:
            qs = qs.filter(classroom__program_id=program_id)

        age_group_id = self.request.query_params.get('age_group_id')
        if age_group_id:
            qs = qs.filter(classroom__age_group_id=age_group_id)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(classroom__room_name__icontains=search) |
                Q(classroom__room_code__icontains=search) |
                Q(rule_snapshot__name__icontains=search)
            )

        return qs.order_by('-evaluated_at')


class RatioManualOverrideViewSet(viewsets.ModelViewSet):
    """
    CRUD API for RatioManualOverride models with AuditLog tracking.
    """
    serializer_class = RatioManualOverrideSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        verify_not_guardian(self.request.user)
        daycare = resolve_request_daycare(self.request)
        if not daycare:
            return RatioManualOverride.objects.none()
        return RatioManualOverride.objects.filter(daycare=daycare).select_related('classroom', 'created_by')

    def perform_create(self, serializer):
        verify_not_guardian(self.request.user)
        daycare = resolve_request_daycare(self.request)
        classroom_id = self.request.data.get('classroom')
        classroom = get_object_or_404(Classroom, id=classroom_id, daycare=daycare)

        # Deactivate any previous active override for this classroom
        RatioManualOverride.objects.filter(classroom=classroom, daycare=daycare, is_active=True).update(is_active=False)

        instance = serializer.save(
            daycare=daycare,
            classroom=classroom,
            created_by=self.request.user
        )

        # AuditLog
        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin' if not self.request.user.is_superuser else 'SuperAdmin',
            action='RATIO_OVERRIDE_CREATE',
            module='RATIO_MONITORING',
            entity_type='RatioManualOverride',
            entity_id=str(instance.id),
            new_values={
                "classroom": classroom.room_name,
                "override_status": instance.override_status,
                "reason": instance.reason,
                "expires_at": instance.expires_at.isoformat() if instance.expires_at else None
            }
        )

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        verify_not_guardian(request.user)
        override = self.get_object()
        override.is_active = False
        override.save()

        AuditLog.objects.create(
            user=request.user,
            user_type='DaycareAdmin' if not request.user.is_superuser else 'SuperAdmin',
            action='RATIO_OVERRIDE_DEACTIVATE',
            module='RATIO_MONITORING',
            entity_type='RatioManualOverride',
            entity_id=str(override.id),
            new_values={"is_active": False}
        )

        return Response({"status": "Override deactivated."}, status=status.HTTP_200_OK)


class LogComplianceSnapshotView(views.APIView):
    """
    POST /api/daycare/ratio-monitoring/log-snapshot/
    Triggers an immediate immutable compliance snapshot for a classroom or all classrooms.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        verify_not_guardian(request.user)
        daycare = resolve_request_daycare(request)
        if not daycare:
            return Response({"error": "Daycare not found."}, status=status.HTTP_400_BAD_REQUEST)

        classroom_id = request.data.get('classroom_id')
        if classroom_id:
            classroom = get_object_or_404(Classroom, id=classroom_id, daycare=daycare, deleted_at__isnull=True)
            snapshot = RatioMonitoringService.log_compliance_snapshot(classroom)
            return Response(RatioComplianceHistorySerializer(snapshot).data, status=status.HTTP_201_CREATED)

        snapshots = RatioMonitoringService.bulk_log_daycare_compliance(daycare)
        return Response(RatioComplianceHistorySerializer(snapshots, many=True).data, status=status.HTTP_201_CREATED)


class RatioRuleViewSet(viewsets.ModelViewSet):
    """
    CRUD API for configurable RatioRule models with AuditLog tracking.
    Supports querying daycare custom rules and provincial system baseline rules,
    hierarchical applicable rule lookups, staff qualification evaluations, and rule versioning.
    """
    serializer_class = RatioRuleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        verify_not_guardian(self.request.user)
        daycare = resolve_request_daycare(self.request)
        if not daycare:
            return RatioRule.objects.filter(Q(daycare__isnull=True) | Q(is_system_rule=True))
        
        include_system = self.request.query_params.get('include_system', 'true').lower() == 'true'
        if include_system:
            province = getattr(daycare, 'province', None)
            if not province and daycare.state:
                province = Province.objects.filter(Q(code__iexact=daycare.state) | Q(name__iexact=daycare.state)).first()
            
            system_q = Q(daycare__isnull=True) | Q(is_system_rule=True)
            if province:
                system_q = system_q & (Q(province=province) | Q(province__isnull=True))

            return RatioRule.objects.filter(Q(daycare=daycare) | system_q).select_related('province', 'program', 'age_group', 'created_by', 'updated_by')

        return RatioRule.objects.filter(daycare=daycare).select_related('province', 'program', 'age_group', 'created_by', 'updated_by')

    def perform_create(self, serializer):
        verify_not_guardian(self.request.user)
        daycare = resolve_request_daycare(self.request)
        is_system = False
        if getattr(self.request.user, 'is_superuser', False) and not daycare:
            is_system = True

        instance = serializer.save(
            daycare=daycare,
            is_system_rule=is_system,
            created_by=self.request.user,
            updated_by=self.request.user
        )

        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin' if not self.request.user.is_superuser else 'SuperAdmin',
            action='RATIO_RULE_CREATE',
            module='RATIO_MONITORING',
            entity_type='RatioRule',
            entity_id=str(instance.id),
            new_values={
                "name": instance.name,
                "max_children_per_staff": instance.max_children_per_staff,
                "age_range": f"{instance.min_age_months}-{instance.max_age_months}",
                "requires_qualified_ece": instance.requires_qualified_ece
            }
        )

    def perform_update(self, serializer):
        verify_not_guardian(self.request.user)
        instance = serializer.save(updated_by=self.request.user)

        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin' if not self.request.user.is_superuser else 'SuperAdmin',
            action='RATIO_RULE_UPDATE',
            module='RATIO_MONITORING',
            entity_type='RatioRule',
            entity_id=str(instance.id),
            new_values={
                "name": instance.name,
                "max_children_per_staff": instance.max_children_per_staff,
                "is_active": instance.is_active
            }
        )

    def perform_destroy(self, instance):
        verify_not_guardian(self.request.user)
        rule_id = str(instance.id)
        rule_name = instance.name
        instance.delete()

        AuditLog.objects.create(
            user=self.request.user,
            user_type='DaycareAdmin' if not self.request.user.is_superuser else 'SuperAdmin',
            action='RATIO_RULE_DELETE',
            module='RATIO_MONITORING',
            entity_type='RatioRule',
            entity_id=rule_id,
            old_values={"name": rule_name}
        )

    @action(detail=False, methods=['get', 'post'], url_path='lookup')
    def lookup(self, request):
        """
        GET/POST /api/daycare/ratio-rules/lookup/
        Searches all candidate rules matching query parameters, ranked by specificity.
        """
        verify_not_guardian(request.user)
        daycare = resolve_request_daycare(request)

        params = request.query_params if request.method == 'GET' else request.data
        
        target_date = timezone.now().date()
        date_str = params.get('date')
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        province = None
        prov_id = params.get('province_id')
        prov_code = params.get('province_code') or params.get('province')
        if prov_id:
            province = Province.objects.filter(id=prov_id).first()
        elif prov_code:
            province = Province.objects.filter(Q(code__iexact=prov_code) | Q(name__iexact=prov_code)).first()
        elif daycare and getattr(daycare, 'province', None):
            province = daycare.province

        program = None
        program_id = params.get('program_id')
        if program_id:
            program = Program.objects.filter(id=program_id).first()
        program_type = params.get('program_type')

        age_group = None
        age_group_id = params.get('age_group_id')
        if age_group_id:
            age_group = AgeGroup.objects.filter(id=age_group_id).first()

        age_months = None
        if params.get('age_months') is not None:
            try:
                age_months = int(params.get('age_months'))
            except (ValueError, TypeError):
                pass

        min_age_months = None
        if params.get('min_age_months') is not None:
            try:
                min_age_months = int(params.get('min_age_months'))
            except (ValueError, TypeError):
                pass

        max_age_months = None
        if params.get('max_age_months') is not None:
            try:
                max_age_months = int(params.get('max_age_months'))
            except (ValueError, TypeError):
                pass

        include_system = str(params.get('include_system', 'true')).lower() == 'true'

        candidates = RatioRulesEngineService.lookup_candidate_rules(
            daycare=daycare,
            province=province,
            program=program,
            program_type=program_type,
            age_group=age_group,
            age_months=age_months,
            min_age_months=min_age_months,
            max_age_months=max_age_months,
            target_date=target_date,
            is_active=True,
            include_system=include_system
        )

        return Response({
            "target_date": target_date.isoformat(),
            "count": len(candidates),
            "results": candidates
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get', 'post'], url_path='applicable')
    def applicable(self, request):
        """
        GET/POST /api/daycare/ratio-rules/applicable/
        Resolves the exact single applicable ratio rule for a classroom or given criteria on a date.
        """
        verify_not_guardian(request.user)
        daycare = resolve_request_daycare(request)

        params = request.query_params if request.method == 'GET' else request.data

        target_date = timezone.now().date()
        date_str = params.get('date')
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        classroom = None
        classroom_id = params.get('classroom_id')
        if classroom_id:
            classroom = Classroom.objects.filter(id=classroom_id, deleted_at__isnull=True).first()
            if classroom and daycare and classroom.daycare_id != daycare.id and not request.user.is_superuser:
                return Response({"error": "Classroom not found in daycare."}, status=status.HTTP_404_NOT_FOUND)

        program = None
        program_id = params.get('program_id')
        if program_id:
            program = Program.objects.filter(id=program_id).first()
        program_type = params.get('program_type')

        age_group = None
        age_group_id = params.get('age_group_id')
        if age_group_id:
            age_group = AgeGroup.objects.filter(id=age_group_id).first()

        age_months = None
        if params.get('age_months') is not None:
            try:
                age_months = int(params.get('age_months'))
            except (ValueError, TypeError):
                pass

        province = None
        prov_id = params.get('province_id')
        prov_code = params.get('province_code') or params.get('province')
        if prov_id:
            province = Province.objects.filter(id=prov_id).first()
        elif prov_code:
            province = Province.objects.filter(Q(code__iexact=prov_code) | Q(name__iexact=prov_code)).first()

        rule_result = RatioRulesEngineService.resolve_applicable_rule(
            daycare=daycare,
            classroom=classroom,
            program=program,
            program_type=program_type,
            age_group=age_group,
            age_months=age_months,
            target_date=target_date,
            province=province
        )

        return Response(rule_result, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='evaluate-qualification')
    def evaluate_qualification(self, request):
        """
        POST /api/daycare/ratio-rules/evaluate-qualification/
        Evaluates whether a staff member or list of staff members qualifies under a configured rule.
        """
        verify_not_guardian(request.user)
        daycare = resolve_request_daycare(request)

        data = request.data
        employee_id = data.get('employee_id')
        employee_ids = data.get('employee_ids')

        if not employee_id and not employee_ids:
            return Response({"error": "employee_id or employee_ids is required."}, status=status.HTTP_400_BAD_REQUEST)

        target_date = timezone.now().date()
        date_str = data.get('date')
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        rule = None
        rule_id = data.get('rule_id')
        if rule_id:
            rule = RatioRule.objects.filter(id=rule_id).first()

        classroom_id = data.get('classroom_id')
        if classroom_id and not rule:
            classroom = Classroom.objects.filter(id=classroom_id, deleted_at__isnull=True).first()
            if classroom:
                rule_res = RatioRulesEngineService.resolve_applicable_rule(
                    daycare=daycare or classroom.daycare,
                    classroom=classroom,
                    target_date=target_date
                )
                if rule_res.get("rule_id"):
                    rule = RatioRule.objects.filter(id=rule_res["rule_id"]).first()

        if employee_ids and isinstance(employee_ids, list):
            emp_qs = Employee.objects.filter(id__in=employee_ids)
            if daycare:
                emp_qs = emp_qs.filter(daycare=daycare)
            result = QualifiedStaffService.evaluate_multiple_staff(
                employees=list(emp_qs),
                rule=rule,
                target_date=target_date
            )
            return Response(result, status=status.HTTP_200_OK)

        emp = get_object_or_404(Employee, id=employee_id)
        if daycare and emp.daycare_id != daycare.id and not request.user.is_superuser:
            raise PermissionDenied("Employee belongs to another daycare.")

        result = QualifiedStaffService.evaluate_staff_qualification(
            employee=emp,
            rule=rule,
            target_date=target_date
        )
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='version')
    def version(self, request, pk=None):
        """
        POST /api/daycare/ratio-rules/<id>/version/
        Creates a new historical version of a RatioRule effective from effective_date,
        closing out the previous rule's effective_to date.
        """
        verify_not_guardian(request.user)
        rule = self.get_object()

        effective_date_str = request.data.get('effective_date') or request.data.get('effective_from')
        if not effective_date_str:
            return Response({"error": "effective_date is required to create a new rule version."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            effective_date = datetime.strptime(effective_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"error": "Invalid effective_date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            old_rule, new_rule = RatioRulesEngineService.version_rule(
                rule=rule,
                updated_data=request.data,
                effective_date=effective_date,
                user=request.user
            )
            return Response({
                "message": "Ratio rule version created successfully.",
                "previous_rule": RatioRuleSerializer(old_rule).data,
                "new_rule": RatioRuleSerializer(new_rule).data
            }, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class RatioReportsView(views.APIView):
    """
    GET /api/daycare/ratio-monitoring/reports/
    Generates any of the 7 Staff-to-Child Ratio Reports with JSON and CSV export support.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        verify_not_guardian(request.user)
        daycare = resolve_request_daycare(request)

        if not daycare:
            return Response({"error": "Daycare not found."}, status=status.HTTP_400_BAD_REQUEST)

        report_type = request.query_params.get('report_type', 'daily_ratio')
        filters = {
            'date': request.query_params.get('date'),
            'start_date': request.query_params.get('start_date'),
            'end_date': request.query_params.get('end_date'),
            'branch': request.query_params.get('branch'),
            'classroom': request.query_params.get('classroom'),
            'age_group': request.query_params.get('age_group'),
            'program': request.query_params.get('program'),
            'status': request.query_params.get('status'),
            'search': request.query_params.get('search'),
        }

        report = RatioReportsService.generate_report(daycare, report_type, filters)

        # Check for CSV export request
        if request.query_params.get('export') == 'csv':
            response = HttpResponse(report.get('csv_content', ''), content_type='text/csv')
            filename = f"ratio_{report_type}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        return Response(report, status=status.HTTP_200_OK)


class RatioAuditLogListView(generics.ListAPIView):
    """
    GET /api/daycare/ratio-monitoring/audit-logs/
    Returns audit trail records for ratio rules and overrides.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        verify_not_guardian(self.request.user)
        daycare = resolve_request_daycare(self.request)
        if not daycare:
            return AuditLog.objects.none()

        qs = AuditLog.objects.filter(module='RATIO_MONITORING').select_related('user').order_by('-created_at')

        action_param = self.request.query_params.get('action')
        if action_param:
            qs = qs.filter(action=action_param)

        return qs
