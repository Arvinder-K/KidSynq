"""
Reports and Analytics Domain URLs.
"""
from django.urls import path
from daycare import views

urlpatterns = [
    path('dashboard/stats/', views.DashboardStatsView.as_view(), name='dashboard_stats'),
    path('daycare/dashboard/', views.DaycareDashboardView.as_view(), name='daycare_dashboard_main'),
    path('daycare/daily-reports/', views.DailyReportViewSet.as_view({'get': 'list', 'post': 'create'}), name='daily_report_list'),
    path('daycare/compliance/dashboard/', views.ComplianceDashboardView.as_view(), name='compliance_dashboard'),
    path('daycare/ratio/status/', views.RatioStatusView.as_view(), name='ratio_status'),
]
