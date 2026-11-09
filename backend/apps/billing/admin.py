from django.contrib import admin
from core.models import Invoice, Payment, FeeStructure

try:
    @admin.register(Invoice)
    class BillingInvoiceAdmin(admin.ModelAdmin):
        list_display = ('invoice_number', 'student', 'total_amount', 'status', 'due_date')
        list_filter = ('status',)
except admin.sites.AlreadyRegistered:
    pass

try:
    @admin.register(Payment)
    class BillingPaymentAdmin(admin.ModelAdmin):
        list_display = ('invoice', 'amount', 'payment_method', 'payment_date')
except admin.sites.AlreadyRegistered:
    pass

