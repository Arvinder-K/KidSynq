import uuid
from decimal import Decimal
from django.contrib import messages
from django.core.paginator import Paginator
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from django.views import View

from core.decorators import StaffRequiredMixin
from core.models import (
    Daycare, Invoice, InvoiceItem, Payment, FeeStructure,
    ChildSubsidyProfile, TaxReceipt, Program, Classroom
)

def get_user_daycare(user):
    if user.daycare:
        return user.daycare
    return Daycare.objects.first()

class InvoicesListView(StaffRequiredMixin, View):
    template_name = 'daycare/billing/invoices_list.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        invoices = Invoice.objects.filter(daycare=daycare).select_related('student').order_by('-issue_date')
        paginator = Paginator(invoices, 20)
        page_obj = paginator.get_page(request.GET.get('page'))
        return render(request, self.template_name, {'page_obj': page_obj})

class InvoiceDetailView(StaffRequiredMixin, View):
    template_name = 'daycare/billing/invoice_detail.html'

    def get(self, request, pk):
        daycare = get_user_daycare(request.user)
        invoice = get_object_or_404(Invoice, pk=pk, daycare=daycare)
        items = InvoiceItem.objects.filter(invoice=invoice)
        payments = Payment.objects.filter(invoice=invoice)

        return render(request, self.template_name, {
            'invoice': invoice,
            'items': items,
            'payments': payments
        })

class PaymentsReceiptsView(StaffRequiredMixin, View):
    template_name = 'daycare/billing/payments_list.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        payments = Payment.objects.filter(invoice__daycare=daycare).select_related('invoice__student').order_by('-payment_date')
        paginator = Paginator(payments, 20)
        page_obj = paginator.get_page(request.GET.get('page'))
        return render(request, self.template_name, {'page_obj': page_obj})

class FeeStructuresView(StaffRequiredMixin, View):
    template_name = 'daycare/billing/fee_structures.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        fees = FeeStructure.objects.filter(daycare=daycare).select_related('program', 'classroom').order_by('-is_active', 'name')
        programs = Program.objects.filter(daycare=daycare).order_by('name')
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')

        total_fees = fees.count()
        active_fees = fees.filter(is_active=True).count()
        one_time_fees = fees.filter(frequency='ONE_TIME').count()

        return render(request, self.template_name, {
            'fees': fees,
            'programs': programs,
            'classrooms': classrooms,
            'fee_type_choices': FeeStructure.FEE_TYPE_CHOICES,
            'frequency_choices': FeeStructure.FREQUENCY_CHOICES,
            'applies_to_choices': FeeStructure.APPLIES_TO_CHOICES,
            'total_fees': total_fees,
            'active_fees': active_fees,
            'one_time_fees': one_time_fees,
        })

    def post(self, request):
        daycare = get_user_daycare(request.user)
        action = request.POST.get('action')

        if action == 'create':
            name = request.POST.get('name', '').strip()
            amount_str = request.POST.get('amount', '0').strip()
            fee_type = request.POST.get('fee_type', 'MONTHLY')
            frequency = request.POST.get('frequency', 'MONTHLY')
            applies_to = request.POST.get('applies_to', 'ALL')
            program_id = request.POST.get('program_id') or None
            classroom_id = request.POST.get('classroom_id') or None
            description = request.POST.get('description', '').strip()
            effective_from = request.POST.get('effective_from') or timezone.now().date()
            is_active = request.POST.get('is_active') in ['true', 'on', '1', True]

            if not name:
                messages.error(request, "Fee structure name is required.")
                return redirect('daycare_fee_structures')

            try:
                amount = Decimal(str(amount_str))
                if amount < 0:
                    raise ValueError
            except Exception:
                messages.error(request, "Please enter a valid non-negative fee amount.")
                return redirect('daycare_fee_structures')

            program = Program.objects.filter(id=program_id, daycare=daycare).first() if program_id else None
            classroom = Classroom.objects.filter(id=classroom_id, daycare=daycare).first() if classroom_id else None

            fee = FeeStructure.objects.create(
                daycare=daycare,
                name=name,
                fee_type=fee_type,
                frequency=frequency,
                amount=amount,
                currency='CAD',
                effective_from=effective_from,
                is_active=is_active,
                applies_to=applies_to,
                program=program,
                classroom=classroom,
                description=description,
                created_by=request.user,
                version=1
            )
            messages.success(request, f"Fee structure '{fee.name}' (${fee.amount:.2f}) added successfully.")

        elif action == 'edit':
            fee_id = request.POST.get('fee_id')
            fee = get_object_or_404(FeeStructure, pk=fee_id, daycare=daycare)

            name = request.POST.get('name', '').strip()
            amount_str = request.POST.get('amount', '0').strip()
            fee_type = request.POST.get('fee_type', fee.fee_type)
            frequency = request.POST.get('frequency', fee.frequency)
            applies_to = request.POST.get('applies_to', fee.applies_to)
            program_id = request.POST.get('program_id') or None
            classroom_id = request.POST.get('classroom_id') or None
            description = request.POST.get('description', '').strip()
            effective_from = request.POST.get('effective_from') or fee.effective_from
            is_active = request.POST.get('is_active') in ['true', 'on', '1', True]

            if not name:
                messages.error(request, "Fee structure name cannot be blank.")
                return redirect('daycare_fee_structures')

            try:
                amount = Decimal(str(amount_str))
                if amount < 0:
                    raise ValueError
            except Exception:
                messages.error(request, "Please enter a valid non-negative fee amount.")
                return redirect('daycare_fee_structures')

            fee.name = name
            fee.amount = amount
            fee.fee_type = fee_type
            fee.frequency = frequency
            fee.applies_to = applies_to
            fee.program = Program.objects.filter(id=program_id, daycare=daycare).first() if program_id else None
            fee.classroom = Classroom.objects.filter(id=classroom_id, daycare=daycare).first() if classroom_id else None
            fee.description = description
            fee.effective_from = effective_from
            fee.is_active = is_active
            fee.updated_by = request.user
            fee.save()

            messages.success(request, f"Fee structure '{fee.name}' updated successfully.")

        elif action == 'delete':
            fee_id = request.POST.get('fee_id')
            fee = get_object_or_404(FeeStructure, pk=fee_id, daycare=daycare)
            fee_name = fee.name
            try:
                fee.delete()
                messages.success(request, f"Fee structure '{fee_name}' was successfully deleted.")
            except Exception:
                # Fallback if protected by active billing links
                fee.is_active = False
                fee.save()
                messages.warning(request, f"Fee structure '{fee_name}' has linked historical records and was deactivated instead of permanently removed.")

        return redirect('daycare_fee_structures')

class SubsidiesCWELCCView(StaffRequiredMixin, View):
    template_name = 'daycare/billing/subsidies.html'
    def get(self, request):
        daycare = get_user_daycare(request.user)
        subsidies = ChildSubsidyProfile.objects.filter(daycare=daycare)
        return render(request, self.template_name, {'subsidies': subsidies})

class TaxReceiptsStatementsView(StaffRequiredMixin, View):
    template_name = 'daycare/billing/tax_receipts.html'
    def get(self, request):
        daycare = get_user_daycare(request.user)
        receipts = TaxReceipt.objects.filter(daycare=daycare)
        return render(request, self.template_name, {'receipts': receipts})

class DiscountsCreditsView(StaffRequiredMixin, View):
    template_name = 'daycare/billing/discounts_credits.html'
    def get(self, request):
        daycare = get_user_daycare(request.user)
        return render(request, self.template_name, {'daycare': daycare})

