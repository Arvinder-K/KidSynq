from django.urls import path
from . import views

urlpatterns = [
    path('', views.EmployeeListView.as_view(), name='staff_list'),
    path('new/', views.EmployeeCreateView.as_view(), name='staff_create'),
    path('<uuid:pk>/', views.EmployeeDetailView.as_view(), name='staff_detail'),
    path('dashboard/', views.StaffDashboardView.as_view(), name='staff_dashboard'),
    path('credentials/', views.CredentialDashboardView.as_view(), name='staff_credentials'),
    path('scheduling/', views.StaffSchedulingView.as_view(), name='staff_scheduling'),
    path('attendance/', views.StaffAttendanceView.as_view(), name='staff_attendance'),
    path('timesheets/', views.StaffTimesheetsView.as_view(), name='staff_timesheets'),
    path('leave/', views.LeaveManagementView.as_view(), name='staff_leave'),
    path('overtime/', views.OvertimeManagementView.as_view(), name='staff_overtime'),
    path('swaps/', views.ShiftSwapCenterView.as_view(), name='staff_swaps'),
    path('shortages/', views.StaffShortageView.as_view(), name='staff_shortages'),
]

