"""
Billing and Invoicing Domain Services.
Business logic for invoice calculations, payments, and subsidy reconciliation.
"""
from core.models import Invoice, Payment

class BillingService:
    @staticmethod
    def get_unpaid_invoices(daycare):
        return Invoice.objects.filter(daycare=daycare, status__in=['Issued', 'Overdue'])

    @staticmethod
    def get_payment_summary(daycare):
        return Payment.objects.filter(invoice__daycare=daycare)
