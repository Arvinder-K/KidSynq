from django.urls import path
from . import views

urlpatterns = [
    path('invoices/', views.InvoicesListView.as_view(), name='billing_invoices'),
    path('invoices/<uuid:pk>/', views.InvoiceDetailView.as_view(), name='billing_invoice_detail'),
    path('payments/', views.PaymentsReceiptsView.as_view(), name='billing_payments'),
    path('subsidies/', views.SubsidiesCWELCCView.as_view(), name='billing_subsidies'),
    path('tax-receipts/', views.TaxReceiptsStatementsView.as_view(), name='billing_tax_receipts'),
    path('fee-structures/', views.FeeStructuresView.as_view(), name='billing_fee_structures'),
    path('discounts/', views.DiscountsCreditsView.as_view(), name='billing_discounts'),
]

