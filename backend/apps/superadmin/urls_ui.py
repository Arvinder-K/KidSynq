from django.urls import path
from . import views_ui

urlpatterns = [
    path('', views_ui.SuperAdminDashboardView.as_view(), name='superadmin_root'),
    path('login/', views_ui.SuperAdminLoginView.as_view(), name='superadmin_login'),
    path('logout/', views_ui.SuperAdminLogoutView.as_view(), name='superadmin_logout'),
    path('dashboard/', views_ui.SuperAdminDashboardView.as_view(), name='superadmin_dashboard'),
    path('daycares/', views_ui.DaycareListView.as_view(), name='superadmin_daycares'),
    path('daycares/create/', views_ui.DaycareCreateView.as_view(), name='superadmin_daycares_create'),
    path('daycares/<uuid:pk>/', views_ui.DaycareDetailView.as_view(), name='superadmin_daycare_detail'),
    path('admins/', views_ui.DaycareAdminListView.as_view(), name='superadmin_admins'),
    path('users/', views_ui.AdminUserListView.as_view(), name='superadmin_users'),
    path('plans/', views_ui.PlanListView.as_view(), name='superadmin_plans'),
    path('plans/create/', views_ui.PlanCreateEditView.as_view(), name='superadmin_plans_create'),
    path('plans/<uuid:pk>/edit/', views_ui.PlanCreateEditView.as_view(), name='superadmin_plans_edit'),
    path('subscriptions/', views_ui.SubscriptionListView.as_view(), name='superadmin_subscriptions'),
    path('invoices/', views_ui.PlatformInvoiceListView.as_view(), name='superadmin_invoices'),
    path('payments/', views_ui.PlatformPaymentListView.as_view(), name='superadmin_payments'),
    path('analytics/', views_ui.PlatformAnalyticsView.as_view(), name='superadmin_analytics'),
    path('ratio-rules/', views_ui.SystemRatioRulesView.as_view(), name='superadmin_ratio_rules'),
    path('audit-logs/', views_ui.PlatformAuditLogView.as_view(), name='superadmin_audit_logs'),
    path('announcements/', views_ui.SystemAnnouncementView.as_view(), name='superadmin_announcements'),
    path('tickets/', views_ui.SupportTicketListView.as_view(), name='superadmin_tickets'),
    path('tickets/<uuid:pk>/', views_ui.SupportTicketDetailView.as_view(), name='superadmin_ticket_detail'),
]

