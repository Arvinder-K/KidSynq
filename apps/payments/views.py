from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from django.contrib import messages
from core.decorators import StaffRequiredMixin
from core.models import Payment, Invoice
from .forms import PaymentRecordForm


def get_user_daycare(user):
    if hasattr(user, 'employee_profile') and user.employee_profile.daycare:
        return user.employee_profile.daycare
    from core.models import Daycare
    return Daycare.objects.first()


class PaymentsReceiptsView(StaffRequiredMixin, View):
    template_name = 'daycare/billing/payments_list.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        payments = Payment.objects.filter(invoice__daycare=daycare).select_related(
            'invoice', 'family').order_by('-payment_date')
        form = PaymentRecordForm()
        return render(request, self.template_name, {
            'payments': payments,
            'form': form,
            'daycare': daycare,
        })

    def post(self, request):
        daycare = get_user_daycare(request.user)
        form = PaymentRecordForm(request.POST)
        if form.is_valid():
            payment = form.save()
            messages.success(
                request, f"Payment #{payment.id} recorded successfully.")
            return redirect('payments_receipts')
        payments = Payment.objects.filter(invoice__daycare=daycare).select_related(
            'invoice', 'family').order_by('-payment_date')
        return render(request, self.template_name, {
            'payments': payments,
            'form': form,
            'daycare': daycare,
        })
