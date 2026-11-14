from django.core.paginator import Paginator
from django.shortcuts import render, get_object_or_404
from django.views import View

from core.decorators import StaffRequiredMixin
from core.models import (
    Daycare, Invoice, InvoiceItem, Payment, FeeStructure,
    ChildSubsidyProfile, TaxReceipt
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
        fees = FeeStructure.objects.filter(daycare=daycare)
        return render(request, self.template_name, {'fees': fees})

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

