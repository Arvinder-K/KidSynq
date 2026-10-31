"""
Billing and Invoicing Domain URLs.
"""
from django.urls import path
from daycare import views

urlpatterns = [
    path('subscription/', views.SubscriptionPlanListView.as_view(), name='subscription_plans'),
    path('subscription/checkout/', views.SubscriptionCheckoutView.as_view(), name='subscription_checkout'),
    path('daycare/billing/invoices/', views.InvoiceViewSet.as_view({'get': 'list', 'post': 'create'}), name='daycare_invoice_list'),
    path('daycare/billing/invoices/<uuid:pk>/', views.InvoiceViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='daycare_invoice_detail'),
    path('daycare/billing/payments/', views.PaymentViewSet.as_view({'get': 'list', 'post': 'create'}), name='payment_list'),
    path('daycare/billing/fee-structures/', views.FeeStructureViewSet.as_view({'get': 'list', 'post': 'create'}), name='fee_structure_list'),
    path('daycare/billing/subsidies/', views.SubsidyProfileViewSet.as_view({'get': 'list', 'post': 'create'}), name='subsidy_list'),
    path('daycare/billing/tax-receipts/', views.TaxReceiptViewSet.as_view({'get': 'list'}), name='tax_receipt_list'),
]
