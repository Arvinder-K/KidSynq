from django.urls import path
from .views import ReportsHubView, AttendanceReportView, FinancialReportView

urlpatterns = [
    path('', ReportsHubView.as_view(), name='reports_hub'),
    path('attendance/', AttendanceReportView.as_view(), name='reports_attendance'),
    path('financial/', FinancialReportView.as_view(), name='reports_financial'),
]

