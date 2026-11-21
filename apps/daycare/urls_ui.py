from django.urls import path
from . import views_ui

urlpatterns = [
    # Dashboard & Profile
    path('dashboard/', views_ui.DaycareDashboardView.as_view(), name='daycare_dashboard'),
    path('settings/', views_ui.DaycareSettingsView.as_view(), name='daycare_settings'),
    path('profile/', views_ui.UserProfileView.as_view(), name='daycare_profile'),
    path('branches/', views_ui.BranchListView.as_view(), name='daycare_branches'),
    path('holidays/', views_ui.DaycareHolidaysView.as_view(), name='daycare_holidays'),
    path('emergency-info/', views_ui.EmergencyInfoView.as_view(), name='daycare_emergency_info'),
    path('documents/', views_ui.DocumentManagerView.as_view(), name='daycare_documents'),
    path('compliance/', views_ui.ComplianceDashboardView.as_view(), name='daycare_compliance'),
    path('communication/', views_ui.CommunicationDashboardView.as_view(), name='daycare_communication'),
    path('consent-forms/', views_ui.ConsentFormsView.as_view(), name='daycare_consent_forms'),

    # Children
    path('children/', views_ui.ChildListView.as_view(), name='daycare_children'),
    path('children/new/', views_ui.ChildCreateView.as_view(), name='daycare_child_new'),
    path('children/<uuid:pk>/', views_ui.ChildDetailView.as_view(), name='daycare_child_detail'),
    path('admissions/', views_ui.AdmissionsListView.as_view(), name='daycare_admissions'),
    path('waitlist/', views_ui.WaitlistListView.as_view(), name='daycare_waitlist'),

    # Staff & Scheduling
    path('employees/', views_ui.EmployeeListView.as_view(), name='daycare_employees'),
    path('employees/new/', views_ui.EmployeeCreateView.as_view(), name='daycare_employee_new'),
    path('employees/<uuid:pk>/', views_ui.EmployeeDetailView.as_view(), name='daycare_employee_detail'),
    path('employees/dashboard/', views_ui.StaffDashboardView.as_view(), name='daycare_staff_dashboard'),
    path('credentials/', views_ui.CredentialDashboardView.as_view(), name='daycare_credentials'),
    path('scheduling/', views_ui.StaffSchedulingView.as_view(), name='daycare_scheduling'),
    path('scheduling/overtime/', views_ui.OvertimeManagementView.as_view(), name='daycare_overtime'),
    path('scheduling/swaps/', views_ui.ShiftSwapCenterView.as_view(), name='daycare_shift_swaps'),
    path('scheduling/shortages/', views_ui.StaffShortageView.as_view(), name='daycare_shortages'),
    path('leave/', views_ui.LeaveManagementView.as_view(), name='daycare_leave'),
    path('staff/attendance/', views_ui.StaffAttendanceView.as_view(), name='daycare_staff_attendance'),
    path('staff/timesheets/', views_ui.StaffTimesheetsView.as_view(), name='daycare_timesheets'),

    # Classrooms, Programs & Ratios
    path('classrooms/', views_ui.ClassroomListView.as_view(), name='daycare_classrooms'),
    path('classrooms/new/', views_ui.ClassroomCreateEditView.as_view(), name='daycare_classroom_new'),
    path('classrooms/<uuid:pk>/', views_ui.ClassroomDetailView.as_view(), name='daycare_classroom_detail'),
    path('classrooms/<uuid:pk>/edit/', views_ui.ClassroomCreateEditView.as_view(), name='daycare_classroom_edit'),
    path('programs/', views_ui.ProgramsDashboardView.as_view(), name='daycare_programs'),
    path('age-groups/', views_ui.AgeGroupManagementView.as_view(), name='daycare_age_groups'),
    path('ratio-monitoring/', views_ui.RatioMonitoringView.as_view(), name='daycare_ratio_monitoring'),
    path('ratio-rules/', views_ui.DaycareRatioRulesView.as_view(), name='daycare_ratio_rules'),

    # Attendance & Operations
    path('attendance/', views_ui.DailyAttendanceRollCallView.as_view(), name='daycare_attendance'),
    path('attendance/dashboard/', views_ui.MasterAttendanceDashboardView.as_view(), name='daycare_attendance_command'),
    path('safe-arrival/', views_ui.SafeArrivalDashboardView.as_view(), name='daycare_safe_arrival'),
    path('pickup-verification/', views_ui.PickupVerificationKioskView.as_view(), name='daycare_pickup_verification'),
    path('daily-reports/', views_ui.DailyReportsHubView.as_view(), name='daycare_daily_reports'),
    path('daily-reports/<uuid:child_id>/<str:date>/', views_ui.DailyChildReportDetailView.as_view(), name='daycare_daily_report_detail'),
    path('health/', views_ui.HealthDashboardView.as_view(), name='daycare_health'),

    # Finance & Billing
    path('billing/invoices/', views_ui.InvoicesListView.as_view(), name='daycare_invoices'),
    path('billing/invoices/<uuid:pk>/', views_ui.InvoiceDetailView.as_view(), name='daycare_invoice_detail'),
    path('billing/payments/', views_ui.PaymentsReceiptsView.as_view(), name='daycare_payments'),
    path('billing/subsidies/', views_ui.SubsidiesCWELCCView.as_view(), name='daycare_subsidies'),
    path('billing/tax-receipts/', views_ui.TaxReceiptsStatementsView.as_view(), name='daycare_tax_receipts'),
    path('billing/fee-structures/', views_ui.FeeStructuresView.as_view(), name='daycare_fee_structures'),
    path('billing/discounts-credits/', views_ui.DiscountsCreditsView.as_view(), name='daycare_discounts'),
    path('subscription/', views_ui.DaycareSubscriptionView.as_view(), name='daycare_subscription'),
]

