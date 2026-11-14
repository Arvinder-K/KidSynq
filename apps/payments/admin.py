from django.contrib import admin
from core.models import Payment, CreditTransaction

try:
    @admin.register(Payment)
    class PaymentAdmin(admin.ModelAdmin):
        list_display = ('id', 'invoice', 'amount', 'payment_method', 'status', 'payment_date')
        list_filter = ('status', 'payment_method', 'payment_date')
        search_fields = ('transaction_reference', 'notes', 'receipt_number')
except admin.sites.AlreadyRegistered:
    pass

try:
    @admin.register(CreditTransaction)
    class CreditTransactionAdmin(admin.ModelAdmin):
        list_display = ('id', 'family', 'amount', 'transaction_type', 'created_at')
        list_filter = ('transaction_type', 'created_at')
except admin.sites.AlreadyRegistered:
    pass
