from rest_framework import viewsets, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from datetime import datetime, date

from core.models import (
    Daycare, Employee, StaffSchedule, OvertimeRecord,
    TimeBankRule, TimeBankTransaction, ShiftSwapRequest
)
from core.serializers import (
    OvertimeRecordSerializer, TimeBankRuleSerializer,
    TimeBankTransactionSerializer, ShiftSwapRequestSerializer
)
from core.permissions import IsDaycareAdmin
from daycare.services.scheduling import OvertimeService, TimeBankService, ShiftSwapService


class OvertimeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsDaycareAdmin]
    serializer_class = OvertimeRecordSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['employee', 'status', 'date']
    search_fields = ['employee__first_name', 'employee__last_name', 'notes']
    ordering_fields = ['date', 'created_at', 'overtime_hours']
    ordering = ['-date', '-created_at']

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare:
            return OvertimeRecord.objects.none()
        qs = OvertimeRecord.objects.filter(daycare=daycare)
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(date__gte=start_date)
        if end_date:
            qs = qs.filter(date__lte=end_date)
        return qs

    @action(detail=False, methods=['post'], url_path='calculate')
    def calculate_daily(self, request):
        """
        Calculates daily scheduled vs actual hours and overtime for an employee or all active employees on a date.
        """
        daycare = request.user.daycare
        date_str = request.data.get('date')
        employee_id = request.data.get('employee_id')
        threshold = float(request.data.get('regular_hours_threshold', 8.0))

        if not date_str:
            return Response({"date": "Date is required (YYYY-MM-DD)."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"date": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        results = []
        if employee_id:
            emp = get_object_or_404(Employee, id=employee_id, daycare=daycare)
            record = OvertimeService.calculate_daily_overtime(daycare, emp, target_date, threshold)
            results.append(record)
        else:
            employees = Employee.objects.filter(daycare=daycare, status='active')
            for emp in employees:
                # Only calculate if employee had schedule or attendance
                record = OvertimeService.calculate_daily_overtime(daycare, emp, target_date, threshold)
                results.append(record)

        serializer = OvertimeRecordSerializer(results, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        record = self.get_object()
        send_to_time_bank = request.data.get('send_to_time_bank', False)
        record = OvertimeService.approve_overtime(
            overtime_record=record,
            user=request.user,
            send_to_time_bank=bool(send_to_time_bank)
        )
        return Response(OvertimeRecordSerializer(record).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        record = self.get_object()
        notes = request.data.get('notes', '')
        record = OvertimeService.reject_overtime(
            overtime_record=record,
            user=request.user,
            notes=notes
        )
        return Response(OvertimeRecordSerializer(record).data, status=status.HTTP_200_OK)


class TimeBankViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsDaycareAdmin]
    serializer_class = TimeBankTransactionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['employee', 'transaction_type']
    search_fields = ['employee__first_name', 'employee__last_name', 'reason']
    ordering_fields = ['created_at', 'date', 'hours']
    ordering = ['-created_at']

    def get_queryset(self):
        daycare = self.request.user.daycare
        if not daycare:
            return TimeBankTransaction.objects.none()
        return TimeBankTransaction.objects.filter(daycare=daycare)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """
        Returns time bank balance and statistics for all active employees.
        """
        daycare = request.user.daycare
        rules = TimeBankService.get_or_create_rules(daycare)
        employees = Employee.objects.filter(daycare=daycare).order_by('first_name')

        balances = []
        for emp in employees:
            bal = TimeBankService.get_balance(daycare, emp)
            txns = TimeBankTransaction.objects.filter(daycare=daycare, employee=emp)
            total_credited = sum([float(t.hours) for t in txns if t.transaction_type in ['overtime_credit', 'manual_adjustment', 'correction']])
            total_debited = sum([float(t.hours) for t in txns if t.transaction_type == 'time_off_debit'])

            balances.append({
                'employee_id': str(emp.id),
                'employee_name': f"{emp.first_name} {emp.last_name}",
                'employee_number': emp.employee_number,
                'job_title': emp.job_title,
                'status': emp.status,
                'balance_hours': bal,
                'total_credited_hours': round(total_credited, 2),
                'total_debited_hours': round(total_debited, 2),
                'transaction_count': txns.count(),
                'max_limit_reached': bal >= float(rules.max_balance_hours) if rules.max_balance_hours else False
            })

        return Response({
            'rules': TimeBankRuleSerializer(rules).data,
            'employee_balances': balances
        })

    @action(detail=False, methods=['post'], url_path='adjust')
    def adjust(self, request):
        """
        Creates a manual credit, debit, or correction transaction.
        """
        daycare = request.user.daycare
        employee_id = request.data.get('employee_id')
        transaction_type = request.data.get('transaction_type', 'manual_adjustment')
        hours = float(request.data.get('hours', 0.0))
        reason = request.data.get('reason', '')

        if not employee_id:
            return Response({"employee_id": "Employee ID is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not reason:
            return Response({"reason": "Reason is required for manual adjustments."}, status=status.HTTP_400_BAD_REQUEST)

        emp = get_object_or_404(Employee, id=employee_id, daycare=daycare)
        txn = TimeBankService.add_transaction(
            daycare=daycare,
            employee=emp,
            transaction_type=transaction_type,
            hours=hours,
            reason=reason,
            approved_by_user=request.user
        )

        return Response(TimeBankTransactionSerializer(txn).data, status=status.HTTP_201_CREATED)


class TimeBankRuleView(APIView):
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        rules = TimeBankService.get_or_create_rules(daycare)
        return Response(TimeBankRuleSerializer(rules).data)

    def patch(self, request):
        daycare = request.user.daycare
        rules = TimeBankService.get_or_create_rules(daycare)
        serializer = TimeBankRuleSerializer(rules, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ShiftSwapViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ShiftSwapRequestSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'requesting_employee', 'target_employee']
    search_fields = [
        'requesting_employee__first_name', 'requesting_employee__last_name',
        'target_employee__first_name', 'target_employee__last_name', 'reason'
    ]
    ordering_fields = ['requested_at', 'status']
    ordering = ['-requested_at']

    def get_queryset(self):
        user = self.request.user
        daycare = user.daycare
        if not daycare:
            return ShiftSwapRequest.objects.none()

        # If user is DaycareAdmin / Staff, return all daycare swaps
        if user.is_staff or user.is_superuser:
            return ShiftSwapRequest.objects.filter(daycare=daycare)

        # If regular employee, return only swaps where they are sender or recipient
        emp = getattr(user, 'employee_profile', None) or Employee.objects.filter(daycare=daycare, email=user.email).first()
        if emp:
            return ShiftSwapRequest.objects.filter(
                daycare=daycare
            ).filter(
                Q(requesting_employee=emp) | Q(target_employee=emp)
            )

        return ShiftSwapRequest.objects.none()

    def create(self, request, *args, **kwargs):
        daycare = request.user.daycare
        req_emp_id = request.data.get('requesting_employee')
        tgt_emp_id = request.data.get('target_employee')
        req_shift_id = request.data.get('requesting_shift')
        tgt_shift_id = request.data.get('target_shift')
        reason = request.data.get('reason', '')

        # Default requesting_employee if user has linked employee
        if not req_emp_id:
            emp = getattr(request.user, 'employee_profile', None) or Employee.objects.filter(daycare=daycare, email=request.user.email).first()
            if emp:
                req_emp_id = str(emp.id)

        if not req_emp_id or not tgt_emp_id or not req_shift_id:
            return Response({
                "detail": "requesting_employee, target_employee, and requesting_shift are required."
            }, status=status.HTTP_400_BAD_REQUEST)

        req_emp = get_object_or_404(Employee, id=req_emp_id, daycare=daycare)
        tgt_emp = get_object_or_404(Employee, id=tgt_emp_id, daycare=daycare)
        req_shift = get_object_or_404(StaffSchedule, id=req_shift_id, daycare=daycare)
        tgt_shift = get_object_or_404(StaffSchedule, id=tgt_shift_id, daycare=daycare) if tgt_shift_id else None

        swap = ShiftSwapService.create_swap_request(
            daycare=daycare,
            requesting_employee=req_emp,
            target_employee=tgt_emp,
            requesting_shift=req_shift,
            target_shift=tgt_shift,
            reason=reason
        )

        return Response(ShiftSwapRequestSerializer(swap).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        if not (request.user.is_staff or request.user.is_superuser):
            raise PermissionDenied("Employees cannot approve shift swap requests. Daycare admin approval is required.")
        swap = self.get_object()
        admin_notes = request.data.get('admin_notes', '')
        swap = ShiftSwapService.approve_swap_request(
            swap_request=swap,
            user=request.user,
            admin_notes=admin_notes
        )
        return Response(ShiftSwapRequestSerializer(swap).data, status=status.HTTP_200_OK)


    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        swap = self.get_object()
        admin_notes = request.data.get('admin_notes', '')
        swap = ShiftSwapService.reject_swap_request(
            swap_request=swap,
            user=request.user,
            admin_notes=admin_notes
        )
        return Response(ShiftSwapRequestSerializer(swap).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        swap = self.get_object()
        swap = ShiftSwapService.cancel_swap_request(
            swap_request=swap,
            user=request.user
        )
        return Response(ShiftSwapRequestSerializer(swap).data, status=status.HTTP_200_OK)


class StaffMyScheduleView(APIView):
    """
    Returns upcoming schedule, breaks, working hours, and time bank balance for the currently authenticated employee.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        daycare = user.daycare
        employee = getattr(user, 'employee', None)

        if not employee:
            # Fallback: lookup by email
            employee = Employee.objects.filter(daycare=daycare, email=user.email).first()

        if not employee:
            return Response({"detail": "No employee profile found for this user."}, status=status.HTTP_404_NOT_FOUND)

        start_date_str = request.query_params.get('start_date', timezone.now().date().isoformat())
        end_date_str = request.query_params.get('end_date')

        shifts_qs = StaffSchedule.objects.filter(
            daycare=daycare,
            employee=employee,
            date__gte=start_date_str
        )
        if end_date_str:
            shifts_qs = shifts_qs.filter(date__lte=end_date_str)

        from core.serializers import StaffScheduleSerializer
        shifts_data = StaffScheduleSerializer(shifts_qs, many=True).data

        balance = TimeBankService.get_balance(daycare, employee)
        pending_swaps = ShiftSwapRequest.objects.filter(
            daycare=daycare,
            status='pending'
        ).filter(Q(requesting_employee=employee) | Q(target_employee=employee)).count()

        return Response({
            'employee_id': str(employee.id),
            'employee_name': f"{employee.first_name} {employee.last_name}",
            'time_bank_balance': balance,
            'pending_swaps_count': pending_swaps,
            'shifts': shifts_data
        })


class StaffMySwapsView(APIView):
    """
    Returns swap requests sent and received by the current employee.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        daycare = user.daycare
        employee = getattr(user, 'employee', None) or Employee.objects.filter(daycare=daycare, email=user.email).first()

        if not employee:
            return Response({"detail": "No employee profile found for this user."}, status=status.HTTP_404_NOT_FOUND)

        sent = ShiftSwapRequest.objects.filter(daycare=daycare, requesting_employee=employee)
        received = ShiftSwapRequest.objects.filter(daycare=daycare, target_employee=employee)

        return Response({
            'sent_requests': ShiftSwapRequestSerializer(sent, many=True).data,
            'received_requests': ShiftSwapRequestSerializer(received, many=True).data
        })
