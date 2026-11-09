from django.urls import path
from . import views

urlpatterns = [
    path('', views.DailyAttendanceRollCallView.as_view(), name='attendance_rollcall'),
    path('dashboard/', views.MasterAttendanceDashboardView.as_view(), name='attendance_command'),
    path('safe-arrival/', views.SafeArrivalDashboardView.as_view(), name='attendance_safe_arrival'),
    path('pickup-kiosk/', views.PickupVerificationKioskView.as_view(), name='attendance_kiosk'),
    path('daily-reports/', views.DailyReportsHubView.as_view(), name='attendance_daily_reports'),
    path('daily-reports/<uuid:child_id>/<str:date>/', views.DailyChildReportDetailView.as_view(), name='attendance_daily_report_detail'),
    path('health/', views.HealthDashboardView.as_view(), name='attendance_health'),
]

