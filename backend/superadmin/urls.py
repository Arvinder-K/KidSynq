from django.urls import path
from . import views

urlpatterns = [
    path('daycares/', views.AdminDaycareListView.as_view(), name='admin_daycare_list'),
    path('daycares/<uuid:pk>/', views.AdminDaycareDetailView.as_view(), name='admin_daycare_detail'),
    path('users/', views.AdminUserListView.as_view(), name='admin_user_list'),
    path('users/<uuid:pk>/', views.AdminUserDetailView.as_view(), name='admin_user_detail'),
    path('subscription-plans/', views.AdminSubscriptionPlanListView.as_view(), name='admin_subscription_plans'),
    path('subscription-plans/<uuid:pk>/', views.AdminSubscriptionPlanDetailView.as_view(), name='admin_subscription_plan_detail'),
    path('subscription-features/', views.SubscriptionFeatureListView.as_view(), name='admin_subscription_features'),
    path('subscriptions/assigned/', views.AdminDaycareSubscriptionListView.as_view(), name='admin_assigned_subscriptions'),
    path('subscriptions/assigned/<uuid:pk>/', views.AdminDaycareSubscriptionDetailView.as_view(), name='admin_assigned_subscription_detail'),
    path('subscriptions/assigned/<uuid:pk>/<str:action>/', views.AdminDaycareSubscriptionActionView.as_view(), name='admin_assigned_subscription_action'),
    path('daycares/<uuid:pk>/<str:action>/', views.DaycareActionView.as_view(), name='admin_daycare_action'),
    path('onboarding/', views.DaycareOnboardingView.as_view(), name='admin_daycare_onboarding'),
    path('daycare-admins/', views.DaycareAdminListView.as_view(), name='admin_daycare_admin_list'),
    path('daycare-admins/<uuid:pk>/', views.DaycareAdminDetailView.as_view(), name='admin_daycare_admin_detail'),
    path('daycare-admins/<uuid:pk>/<str:action>/', views.DaycareAdminActionView.as_view(), name='admin_daycare_admin_action'),
    
    path('audit-logs/', views.AuditLogListView.as_view(), name='admin_audit_logs'),
    path('support-tickets/', views.SupportTicketListView.as_view(), name='admin_support_tickets'),
    path('support-tickets/<uuid:pk>/', views.SupportTicketDetailView.as_view(), name='admin_support_ticket_detail'),
    path('support-tickets/<uuid:pk>/messages/', views.SupportTicketMessageCreateView.as_view(), name='admin_support_ticket_messages'),
    path('invoices/', views.SubscriptionInvoiceListView.as_view(), name='admin_invoices'),
    path('invoices/<uuid:pk>/', views.SubscriptionInvoiceDetailView.as_view(), name='admin_invoice_detail'),
    path('payments/', views.SubscriptionPaymentListView.as_view(), name='admin_payments'),
    path('dashboard/', views.SuperAdminDashboardView.as_view(), name='admin_dashboard'),
    
    # Analytics
    path('analytics/', __import__('superadmin.analytics', fromlist=['']).SaaSAnalyticsView.as_view(), name='superadmin_analytics'),
    
    # System Ratio Rules (Provincial Baseline Rules)
    path('ratio-rules/', views.AdminSystemRatioRuleListView.as_view(), name='admin_system_ratio_rules'),
    path('ratio-rules/<uuid:pk>/', views.AdminSystemRatioRuleDetailView.as_view(), name='admin_system_ratio_rule_detail'),
]

