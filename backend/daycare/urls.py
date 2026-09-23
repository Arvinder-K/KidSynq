from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from . import views
from core import api_views as core_api_views

urlpatterns = [
    # Auth
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Users
    path('users/me/', views.UserDetailView.as_view(), name='user_me'),
    
    # Subscription
    path('subscription/', views.SubscriptionPlanListView.as_view(), name='subscription_plans'),
    path('subscription/checkout/', views.SubscriptionCheckoutView.as_view(), name='subscription_checkout'),
    path('daycare/dashboard/', views.DaycareDashboardView.as_view(), name='daycare_dashboard_main'),
    path('dashboard/stats/', views.DashboardStatsView.as_view(), name='dashboard_stats'),
    path('dashboard/classrooms/', views.ClassroomDashboardStatsView.as_view(), name='dashboard_classrooms'),
    
    # Staff / Employees
    path('staff/', views.StaffListView.as_view(), name='staff_list'), # Legacy
    path('daycare/employees/dashboard/', views.StaffDashboardView.as_view(), name='staff_dashboard'),
    path('daycare/employees/reports/', views.StaffReportsView.as_view(), name='staff_reports'),
    path('daycare/provinces/', views.ProvinceListView.as_view(), name='province_list'),
    path('daycare/credential-types/', views.CredentialTypeListView.as_view(), name='credential_type_list'),
    path('daycare/credentials/dashboard/', views.CredentialComplianceDashboardView.as_view(), name='credential_compliance_dashboard'),
    path('daycare/credentials/reports/', views.CredentialReportsView.as_view(), name='credential_reports'),
    path('daycare/credentials/send-alerts/', views.SendComplianceAlertsView.as_view(), name='credential_send_compliance_alerts'),
    path('daycare/credentials/expiring/', views.ECECredentialViewSet.as_view({'get': 'expiring'}), name='credential_expiring'),
    path('daycare/credentials/', views.ECECredentialViewSet.as_view({'get': 'list', 'post': 'create'}), name='credential_list'),


    path('daycare/credentials/<uuid:pk>/', views.ECECredentialViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='credential_detail'),
    path('daycare/credentials/<uuid:pk>/verify/', views.ECECredentialViewSet.as_view({'post': 'verify'}), name='credential_verify'),
    path('daycare/credentials/<uuid:pk>/reject/', views.ECECredentialViewSet.as_view({'post': 'reject'}), name='credential_reject'),
    path('daycare/credentials/<uuid:pk>/renew/', views.ECECredentialViewSet.as_view({'post': 'renew'}), name='credential_renew'),
    path('daycare/credentials/<uuid:pk>/history/', views.ECECredentialViewSet.as_view({'get': 'history'}), name='credential_history'),
    path('daycare/credentials/<uuid:pk>/document/', views.ECECredentialViewSet.as_view({'get': 'document'}), name='credential_document'),
    path('daycare/credentials/<uuid:pk>/upload-document/', views.ECECredentialViewSet.as_view({'post': 'upload_document'}), name='credential_upload_document'),

    path('daycare/ece-credentials/expiring/', views.ECECredentialViewSet.as_view({'get': 'expiring'}), name='ece_credential_expiring'),
    path('daycare/ece-credentials/', views.ECECredentialViewSet.as_view({'get': 'list', 'post': 'create'}), name='ece_credential_list'),
    path('daycare/ece-credentials/<uuid:pk>/', views.ECECredentialViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='ece_credential_detail'),
    path('daycare/ece-credentials/<uuid:pk>/verify/', views.ECECredentialViewSet.as_view({'post': 'verify'}), name='ece_credential_verify'),
    path('daycare/ece-credentials/<uuid:pk>/reject/', views.ECECredentialViewSet.as_view({'post': 'reject'}), name='ece_credential_reject'),
    path('daycare/ece-credentials/<uuid:pk>/renew/', views.ECECredentialViewSet.as_view({'post': 'renew'}), name='ece_credential_renew'),
    path('daycare/ece-credentials/<uuid:pk>/history/', views.ECECredentialViewSet.as_view({'get': 'history'}), name='ece_credential_history'),
    path('daycare/ece-credentials/<uuid:pk>/document/', views.ECECredentialViewSet.as_view({'get': 'document'}), name='ece_credential_document'),
    path('daycare/ece-credentials/<uuid:pk>/upload-document/', views.ECECredentialViewSet.as_view({'post': 'upload_document'}), name='ece_credential_upload_document'),

    path('daycare/employees/', views.EmployeeViewSet.as_view({'get': 'list', 'post': 'create'}), name='employee_list'),
    path('daycare/employees/<uuid:pk>/', views.EmployeeViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='employee_detail'),
    path('daycare/employees/<uuid:pk>/qualifications/', views.EmployeeViewSet.as_view({'get': 'qualifications', 'post': 'qualifications'}), name='employee_qualifications'),
    path('daycare/employees/<uuid:pk>/certifications/', views.EmployeeViewSet.as_view({'get': 'certifications', 'post': 'certifications'}), name='employee_certifications'),
    path('daycare/employees/<uuid:pk>/credentials/', views.EmployeeViewSet.as_view({'get': 'credentials', 'post': 'credentials'}), name='employee_credentials'),
    path('daycare/employees/<uuid:pk>/ece-credentials/', views.EmployeeViewSet.as_view({'get': 'ece_credentials', 'post': 'ece_credentials'}), name='employee_ece_credentials'),
    path('daycare/employees/<uuid:pk>/credential-history/', views.EmployeeCredentialHistoryView.as_view(), name='employee_credential_history'),
    path('daycare/employees/<uuid:pk>/compliance-profile/', views.EmployeeComplianceProfileView.as_view(), name='employee_compliance_profile'),


    path('daycare/employees/<uuid:pk>/emergency-contacts/', views.EmployeeViewSet.as_view({'get': 'emergency_contacts', 'post': 'emergency_contacts'}), name='employee_emergency_contacts'),
    path('daycare/employees/<uuid:pk>/availability/', views.EmployeeViewSet.as_view({'get': 'availability', 'post': 'availability', 'put': 'availability'}), name='employee_availability'),
    path('daycare/employees/<uuid:pk>/classrooms/', views.EmployeeViewSet.as_view({'get': 'classrooms'}), name='employee_classrooms'),
    path('daycare/employees/<uuid:pk>/history/', views.EmployeeViewSet.as_view({'get': 'history'}), name='employee_history'),
    path('daycare/employeetypes/', views.EmployeeTypeViewSet.as_view({'get': 'list', 'post': 'create'}), name='employeetype_list'),


    # Phase 3: Employment History, Compensation, Documents
    path('daycare/employment-history/', views.EmploymentHistoryViewSet.as_view({'get': 'list', 'post': 'create'}), name='employmenthistory_list'),
    path('daycare/employment-history/<uuid:pk>/', views.EmploymentHistoryViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='employmenthistory_detail'),
    path('daycare/employee-compensation/', views.EmployeeCompensationViewSet.as_view({'get': 'list', 'post': 'create'}), name='employeecompensation_list'),
    path('daycare/employee-compensation/<uuid:pk>/', views.EmployeeCompensationViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='employeecompensation_detail'),
    path('daycare/employee-documents/', views.EmployeeDocumentViewSet.as_view({'get': 'list', 'post': 'create'}), name='employeedocument_list'),
    path('daycare/employee-documents/<uuid:pk>/', views.EmployeeDocumentViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='employeedocument_detail'),
    path('daycare/employee-emergency-contacts/', views.EmployeeEmergencyContactViewSet.as_view({'get': 'list', 'post': 'create'}), name='employee_emergency_contact_list'),
    path('daycare/employee-emergency-contacts/<uuid:pk>/', views.EmployeeEmergencyContactViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='employee_emergency_contact_detail'),
    path('daycare/employee-availability/', views.EmployeeAvailabilityViewSet.as_view({'get': 'list', 'post': 'create'}), name='employee_availability_list'),
    path('daycare/employee-availability/<uuid:pk>/', views.EmployeeAvailabilityViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='employee_availability_detail'),

    path('daycare/employeetypes/<uuid:pk>/', views.EmployeeTypeViewSet.as_view({'patch': 'partial_update', 'delete': 'destroy'}), name='employeetype_detail'),
    path('daycare/qualifications/<uuid:pk>/', views.EmployeeQualificationViewSet.as_view({'patch': 'partial_update', 'delete': 'destroy'}), name='qualification_detail'),
    path('daycare/certifications/<uuid:pk>/', views.EmployeeCertificationViewSet.as_view({'patch': 'partial_update', 'delete': 'destroy'}), name='certification_detail'),
    
    # Staff Scheduling (Module 9 Phase 1 & 2)
    path('daycare/schedules/', views.StaffScheduleViewSet.as_view({'get': 'list', 'post': 'create'}), name='staff_schedule_list'),
    path('daycare/schedules/copy/', views.StaffScheduleViewSet.as_view({'post': 'copy_schedule'}), name='staff_schedule_copy'),
    path('daycare/schedules/<uuid:pk>/', views.StaffScheduleViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='staff_schedule_detail'),
    path('daycare/schedules/<uuid:pk>/breaks/', views.StaffScheduleViewSet.as_view({'get': 'breaks', 'post': 'breaks'}), name='staff_schedule_breaks'),
    path('daycare/schedules/<uuid:pk>/breaks/<uuid:break_id>/', views.StaffScheduleViewSet.as_view({'delete': 'delete_break'}), name='staff_schedule_break_delete'),

    # Staff Scheduling Phase 3: Overtime, Time Bank & Shift Swaps
    path('daycare/scheduling/overtime/', views.OvertimeViewSet.as_view({'get': 'list', 'post': 'create'}), name='overtime_list'),
    path('daycare/scheduling/overtime/calculate/', views.OvertimeViewSet.as_view({'post': 'calculate_daily'}), name='overtime_calculate'),
    path('daycare/scheduling/overtime/<uuid:pk>/', views.OvertimeViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='overtime_detail'),
    path('daycare/scheduling/overtime/<uuid:pk>/approve/', views.OvertimeViewSet.as_view({'post': 'approve'}), name='overtime_approve'),
    path('daycare/scheduling/overtime/<uuid:pk>/reject/', views.OvertimeViewSet.as_view({'post': 'reject'}), name='overtime_reject'),

    path('daycare/scheduling/time-bank/', views.TimeBankViewSet.as_view({'get': 'list'}), name='timebank_list'),
    path('daycare/scheduling/time-bank/summary/', views.TimeBankViewSet.as_view({'get': 'summary'}), name='timebank_summary'),
    path('daycare/scheduling/time-bank/adjust/', views.TimeBankViewSet.as_view({'post': 'adjust'}), name='timebank_adjust'),
    path('daycare/scheduling/time-bank/rules/', views.TimeBankRuleView.as_view(), name='timebank_rules'),

    path('daycare/scheduling/swaps/', views.ShiftSwapViewSet.as_view({'get': 'list', 'post': 'create'}), name='shiftswap_list'),
    path('daycare/scheduling/swaps/<uuid:pk>/', views.ShiftSwapViewSet.as_view({'get': 'retrieve', 'delete': 'destroy'}), name='shiftswap_detail'),
    path('daycare/scheduling/swaps/<uuid:pk>/approve/', views.ShiftSwapViewSet.as_view({'post': 'approve'}), name='shiftswap_approve'),
    path('daycare/scheduling/swaps/<uuid:pk>/reject/', views.ShiftSwapViewSet.as_view({'post': 'reject'}), name='shiftswap_reject'),
    path('daycare/scheduling/swaps/<uuid:pk>/cancel/', views.ShiftSwapViewSet.as_view({'post': 'cancel'}), name='shiftswap_cancel'),

    path('daycare/staff/my-schedule/', views.StaffMyScheduleView.as_view(), name='staff_my_schedule'),
    path('daycare/staff/my-swaps/', views.StaffMySwapsView.as_view(), name='staff_my_swaps'),

    # Staff Scheduling Phase 4: Leave Management, Holidays & Staff Shortage Alerts
    path('daycare/leave/types/', views.LeaveTypeViewSet.as_view({'get': 'list', 'post': 'create'}), name='leave_type_list'),
    path('daycare/leave/types/<uuid:pk>/', views.LeaveTypeViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='leave_type_detail'),
    path('daycare/leave/requests/', views.LeaveRequestViewSet.as_view({'get': 'list', 'post': 'create'}), name='leave_request_list'),
    path('daycare/leave/requests/<uuid:pk>/', views.LeaveRequestViewSet.as_view({'get': 'retrieve', 'delete': 'destroy'}), name='leave_request_detail'),
    path('daycare/leave/requests/<uuid:pk>/approve/', views.LeaveRequestViewSet.as_view({'post': 'approve'}), name='leave_request_approve'),
    path('daycare/leave/requests/<uuid:pk>/reject/', views.LeaveRequestViewSet.as_view({'post': 'reject'}), name='leave_request_reject'),
    path('daycare/leave/requests/<uuid:pk>/cancel/', views.LeaveRequestViewSet.as_view({'post': 'cancel'}), name='leave_request_cancel'),
    path('daycare/leave/calendar/', views.LeaveRequestViewSet.as_view({'get': 'calendar'}), name='leave_calendar'),

    path('daycare/scheduling/shortages/', views.StaffShortageViewSet.as_view({'get': 'list'}), name='shortages_list'),
    path('daycare/scheduling/shortages/scan/', views.StaffShortageViewSet.as_view({'post': 'scan_range'}), name='shortages_scan'),
    path('daycare/scheduling/shortages/<uuid:pk>/resolve/', views.StaffShortageViewSet.as_view({'post': 'resolve_alert'}), name='shortages_resolve'),

    path('daycare/staff/leave/', views.StaffMyLeaveView.as_view(), name='staff_my_leave'),

    path('daycare/notifications/', views.StaffNotificationViewSet.as_view({'get': 'list'}), name='notification_list'),
    path('daycare/notifications/<uuid:pk>/mark-read/', views.StaffNotificationViewSet.as_view({'post': 'mark_read'}), name='notification_mark_read'),
    path('daycare/notifications/mark-all-read/', views.StaffNotificationViewSet.as_view({'post': 'mark_all_read'}), name='notification_mark_all_read'),

    # Phase 5: Dashboard, Reports & History
    path('daycare/scheduling/dashboard/', views.SchedulingDashboardView.as_view(), name='scheduling_dashboard'),
    path('daycare/scheduling/reports/', views.SchedulingReportsView.as_view(), name='scheduling_reports'),
    path('daycare/scheduling/history/', views.SchedulingHistoryView.as_view(), name='scheduling_history'),
    path('daycare/classrooms/<uuid:classroom_id>/schedule-details/', views.ClassroomScheduleDetailView.as_view(), name='classroom_schedule_details'),
    
    # Staff Attendance
    
    # Students
    path('students/', views.StudentViewSet.as_view({'get': 'list', 'post': 'create'}), name='student_list'),
    path('students/<uuid:pk>/', views.StudentViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='student_detail'),
    
    # Children (Phase 19 specific routes pointing to the new ChildViewSet in core.api_views)
    path('daycare/children/', core_api_views.ChildViewSet.as_view({'get': 'list', 'post': 'create'}), name='child_list'),
    path('daycare/children/<uuid:pk>/', core_api_views.ChildViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='child_detail'),
    path('daycare/children/<uuid:pk>/medical/', core_api_views.ChildViewSet.as_view({'get': 'medical', 'put': 'medical', 'patch': 'medical'}), name='child_medical'),
    path('daycare/children/<uuid:pk>/photo/', core_api_views.ChildViewSet.as_view({'post': 'photo'}), name='child_photo'),
    path('daycare/children/<uuid:pk>/withdraw/', core_api_views.ChildViewSet.as_view({'post': 'withdraw'}), name='child_withdraw'),
    path('daycare/children/<uuid:pk>/transfer/', core_api_views.ChildViewSet.as_view({'post': 'transfer'}), name='child_transfer'),
    path('daycare/children/<uuid:pk>/archive/', core_api_views.ChildViewSet.as_view({'post': 'archive'}), name='child_archive'),
    path('daycare/children/<uuid:pk>/re-enroll/', core_api_views.ChildViewSet.as_view({'post': 're_enroll'}), name='child_re_enroll'),
    path('daycare/children/<uuid:pk>/unarchive/', core_api_views.ChildViewSet.as_view({'post': 'unarchive'}), name='child_unarchive'),
    path('daycare/children/<uuid:pk>/history/', core_api_views.ChildViewSet.as_view({'get': 'history'}), name='child_history'),
    path('daycare/children/<uuid:pk>/add_guardian/', core_api_views.ChildViewSet.as_view({'post': 'add_guardian'}), name='child_add_guardian'),
    path('daycare/children/<uuid:pk>/remove_guardian/', core_api_views.ChildViewSet.as_view({'post': 'remove_guardian'}), name='child_remove_guardian'),
    path('daycare/children/<uuid:pk>/guardians/', core_api_views.ChildViewSet.as_view({'get': 'guardians'}), name='child_guardians'),
    path('family/profile/', core_api_views.FamilyProfileView.as_view(), name='family_profile'),
    path('family/guardians/', core_api_views.FamilyGuardiansView.as_view(), name='family_guardians'),
    path('family/guardians/<uuid:pk>/', core_api_views.FamilyGuardianDetailView.as_view(), name='family_guardian_detail'),
    path('family/children/', core_api_views.FamilyChildrenView.as_view(), name='family_children_list'),
    path('family/children/<uuid:pk>/', core_api_views.FamilyChildDetailView.as_view(), name='family_child_detail'),
    path('family/children/<uuid:pk>/attendance/', core_api_views.FamilyChildAttendanceView.as_view(), name='family_child_attendance'),
    path('family/children/<uuid:pk>/daily-reports/', core_api_views.FamilyChildDailyReportsView.as_view(), name='family_child_daily_reports'),
    path('family/billing/invoices/', views.FamilyBillingInvoicesView.as_view(), name='family_billing_invoices'),
    path('family/billing/invoices/<uuid:pk>/', views.FamilyBillingInvoiceDetailView.as_view(), name='family_billing_invoice_detail'),
    path('family/billing/payments/', views.FamilyBillingPaymentsView.as_view(), name='family_billing_payments'),
    path('family/billing/payments/<uuid:pk>/receipt/', views.FamilyBillingPaymentReceiptView.as_view(), name='family_billing_payment_receipt'),
    path('family/billing/tax-receipts/', views.FamilyBillingTaxReceiptsView.as_view(), name='family_billing_tax_receipts'),
    path('family/billing/tax-receipts/<uuid:pk>/print/', views.FamilyBillingTaxReceiptDetailView.as_view(), name='family_billing_tax_receipt_detail'),
    path('family/billing/statement/', views.FamilyBillingStatementView.as_view(), name='family_billing_statement'),
    path('daycare/invitations/', core_api_views.DaycareInvitationsView.as_view(), name='daycare_invitations'),
    path('daycare/invitations/<uuid:pk>/resend/', core_api_views.DaycareInvitationResendView.as_view(), name='daycare_invitation_resend'),
    path('daycare/invitations/<uuid:pk>/cancel/', core_api_views.DaycareInvitationCancelView.as_view(), name='daycare_invitation_cancel'),
    path('family/activate/', core_api_views.GuardianActivateView.as_view(), name='guardian_activate'),
    path('family/forgot-password/', core_api_views.GuardianForgotPasswordView.as_view(), name='guardian_forgot_password'),
    path('family/reset-password/', core_api_views.GuardianResetPasswordView.as_view(), name='guardian_reset_password'),
    path('daycare/children/<uuid:child_pk>/emergency-contacts/', core_api_views.ChildEmergencyContactViewSet.as_view({'get': 'list', 'post': 'create'}), name='child_emergency_contact_list'),
    path('daycare/emergency-contacts/<uuid:pk>/', core_api_views.ChildEmergencyContactViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='child_emergency_contact_detail'),
    path('daycare/emergency-contacts/<uuid:pk>/approve/', core_api_views.ChildEmergencyContactViewSet.as_view({'post': 'approve'}), name='child_emergency_contact_approve'),
    path('daycare/emergency-contacts/<uuid:pk>/reject/', core_api_views.ChildEmergencyContactViewSet.as_view({'post': 'reject'}), name='child_emergency_contact_reject'),
    path('daycare/children/<uuid:child_pk>/authorized-pickups/', views.AuthorizedPickupViewSet.as_view({'get': 'list', 'post': 'create'}), name='child_authorized_pickup_list'),
    path('daycare/children/<uuid:child_pk>/pickups/active/', views.ActiveChildPickupsView.as_view(), name='child_active_pickups'),
    path('daycare/authorized-pickups/', views.AuthorizedPickupViewSet.as_view({'get': 'list', 'post': 'create'}), name='authorized_pickup_root_list'),
    path('daycare/authorized-pickups/<uuid:pk>/', views.AuthorizedPickupViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='child_authorized_pickup_detail'),
    path('daycare/authorized-pickups/<uuid:pk>/activate/', views.AuthorizedPickupViewSet.as_view({'post': 'activate'}), name='child_authorized_pickup_activate'),
    path('daycare/authorized-pickups/<uuid:pk>/deactivate/', views.AuthorizedPickupViewSet.as_view({'post': 'deactivate'}), name='child_authorized_pickup_deactivate'),
    path('daycare/authorized-pickups/<uuid:pk>/revoke/', views.AuthorizedPickupViewSet.as_view({'post': 'revoke'}), name='child_authorized_pickup_revoke'),
    path('daycare/authorized-pickups/<uuid:pk>/set-expiry/', views.AuthorizedPickupViewSet.as_view({'post': 'set_expiry'}), name='child_authorized_pickup_set_expiry'),
    path('daycare/authorized-pickups/<uuid:pk>/history/', views.AuthorizedPickupViewSet.as_view({'get': 'history'}), name='child_authorized_pickup_history'),
    path('daycare/authorized-pickups/<uuid:pk>/photo/', views.AuthorizedPickupViewSet.as_view({'get': 'photo', 'post': 'photo'}), name='child_authorized_pickup_photo'),
    path('daycare/authorized-pickups/<uuid:pk>/approve/', views.AuthorizedPickupViewSet.as_view({'post': 'approve'}), name='child_authorized_pickup_approve'),
    path('daycare/authorized-pickups/<uuid:pk>/reject/', views.AuthorizedPickupViewSet.as_view({'post': 'reject'}), name='child_authorized_pickup_reject'),
    path('daycare/pickups/verify/', views.PickupVerificationView.as_view(), name='pickup_verification_verify'),
    path('daycare/pickups/qr/generate/', views.QRTokenGenerateView.as_view(), name='pickup_qr_generate'),
    path('daycare/pickups/qr/revoke/', views.QRTokenRevokeView.as_view(), name='pickup_qr_revoke'),
    path('daycare/pickups/qr/scan/', views.QRScanView.as_view(), name='pickup_qr_scan'),
    path('daycare/pickups/qr/check-in/', views.QRCheckInView.as_view(), name='pickup_qr_checkin'),
    path('daycare/pickups/qr/check-out/', views.QRCheckOutView.as_view(), name='pickup_qr_checkout'),
    path('daycare/pickups/pin/set/', views.PINSetView.as_view(), name='pickup_pin_set'),
    path('daycare/pickups/pin/verify/', views.PINVerifyView.as_view(), name='pickup_pin_verify'),
    path('daycare/pickups/pin/check-out/', views.PINCheckOutView.as_view(), name='pickup_pin_checkout'),
    path('daycare/pickups/signature/check-out/', views.DigitalSignatureCheckOutView.as_view(), name='pickup_signature_checkout'),
    path('daycare/pickups/events/', views.SafeArrivalDepartureEventsListView.as_view(), name='pickup_events_list'),
    path('daycare/pickups/exceptions/', views.PickupExceptionsListView.as_view(), name='pickup_exceptions_list'),
    path('daycare/safe-arrival/exceptions/', views.PickupExceptionsListView.as_view(), name='safe_arrival_exceptions_alias'),
    path('daycare/safe-arrival/dashboard/', views.SafeArrivalDashboardView.as_view(), name='safe_arrival_dashboard'),
    path('daycare/safe-arrival/reports/', views.SafeArrivalReportsView.as_view(), name='safe_arrival_reports'),
    path('daycare/safe-arrival/records/<uuid:pk>/correct/', views.AttendancePickupCorrectionView.as_view(), name='safe_arrival_record_correction'),
    path('daycare/children/<uuid:child_pk>/pickup-history/', views.ChildPickupHistoryView.as_view(), name='child_pickup_history'),

    path('daycare/children/<uuid:child_pk>/documents/', core_api_views.ChildDocumentViewSet.as_view({'get': 'list', 'post': 'create'}), name='child_document_list'),
    path('daycare/documents/<uuid:pk>/', core_api_views.ChildDocumentViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='child_document_detail'),
    path('daycare/documents/<uuid:pk>/download/', core_api_views.SecureDocumentDownloadView.as_view(), name='child_document_download'),
    path('daycare/children/<uuid:child_pk>/vaccinations/', core_api_views.ChildVaccinationViewSet.as_view({'get': 'list', 'post': 'create'}), name='child_vaccination_list'),
    path('daycare/vaccinations/<uuid:pk>/', core_api_views.ChildVaccinationViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='child_vaccination_detail'),
    path('daycare/children/<uuid:child_pk>/classrooms/', core_api_views.ChildClassroomViewSet.as_view({'get': 'list', 'post': 'create'}), name='child_classroom_list'),
    path('daycare/children/<uuid:child_pk>/enrollments/', core_api_views.ChildEnrollmentViewSet.as_view({'get': 'list'}), name='child_enrollment_list'),
    path('daycare/classroom-assignments/<uuid:pk>/', core_api_views.ChildClassroomViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='child_classroom_detail'),
    path('daycare/classrooms/', views.ClassroomViewSet.as_view({'get': 'list', 'post': 'create'}), name='classroom_list_create'),
    path('daycare/classrooms/<uuid:pk>/', views.ClassroomViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='classroom_detail_update'),
    path('students/<uuid:pk>/medical/', views.StudentViewSet.as_view({'get': 'medical', 'put': 'medical', 'patch': 'medical'}), name='student_medical'),
    path('students/<uuid:pk>/photo/', views.StudentViewSet.as_view({'post': 'photo'}), name='student_photo'),
    path('students/<uuid:pk>/withdraw/', views.StudentViewSet.as_view({'post': 'withdraw'}), name='student_withdraw'),
    path('students/<uuid:pk>/transfer/', views.StudentViewSet.as_view({'post': 'transfer'}), name='student_transfer'),
    path('students/<uuid:pk>/archive/', views.StudentViewSet.as_view({'post': 'archive'}), name='student_archive'),
    
    path('students/<uuid:student_pk>/contacts/', views.StudentEmergencyContactViewSet.as_view({'get': 'list', 'post': 'create'}), name='student_contact_list'),
    path('students/<uuid:student_pk>/contacts/<uuid:pk>/', views.StudentEmergencyContactViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='student_contact_detail'),
    path('students/<uuid:student_pk>/contacts/<uuid:pk>/approve/', views.StudentEmergencyContactViewSet.as_view({'post': 'approve'}), name='student_contact_approve'),
    path('students/<uuid:student_pk>/contacts/<uuid:pk>/reject/', views.StudentEmergencyContactViewSet.as_view({'post': 'reject'}), name='student_contact_reject'),
    
    path('students/<uuid:student_pk>/pickups/', views.StudentPickupViewSet.as_view({'get': 'list', 'post': 'create'}), name='student_pickup_list'),
    path('students/<uuid:student_pk>/pickups/<uuid:pk>/', views.StudentPickupViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='student_pickup_detail'),
    path('students/<uuid:student_pk>/pickups/<uuid:pk>/approve/', views.StudentPickupViewSet.as_view({'post': 'approve'}), name='student_pickup_approve'),
    path('students/<uuid:student_pk>/pickups/<uuid:pk>/reject/', views.StudentPickupViewSet.as_view({'post': 'reject'}), name='student_pickup_reject'),
    
    path('students/<uuid:student_pk>/documents/', views.StudentDocumentView.as_view({'get': 'list', 'post': 'create'}), name='student_document_list'),
    path('students/<uuid:student_pk>/documents/<uuid:pk>/', views.StudentDocumentView.as_view({'delete': 'destroy'}), name='student_document_detail'),
    
    # Teachers & Assignments
    path('teachers/available/', views.AvailableTeachersView.as_view(), name='available_teachers'),
    path('classroom-teachers/', views.ClassroomTeacherViewSet.as_view({'get': 'list', 'post': 'create'}), name='classroom_teacher_list'),
    path('classroom-teachers/<uuid:pk>/', views.ClassroomTeacherViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='classroom_teacher_detail'),
    path('classrooms/<uuid:pk>/teachers/', views.ClassroomTeachersView.as_view(), name='classroom_teachers_list'),
    
    # Age Groups
    path('age-groups/', views.AgeGroupViewSet.as_view({'get': 'list', 'post': 'create'}), name='age_group_list'),
    path('age-groups/<uuid:pk>/', views.AgeGroupViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='age_group_detail'),
    path('age-groups/<uuid:pk>/archive/', views.AgeGroupViewSet.as_view({'post': 'archive'}), name='age_group_archive'),
    path('age-groups/<uuid:pk>/restore/', views.AgeGroupViewSet.as_view({'post': 'restore'}), name='age_group_restore'),
    path('daycare/age-groups/', views.AgeGroupViewSet.as_view({'get': 'list', 'post': 'create'}), name='daycare_age_group_list'),
    path('daycare/age-groups/<uuid:pk>/', views.AgeGroupViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='daycare_age_group_detail'),
    path('daycare/age-groups/<uuid:pk>/archive/', views.AgeGroupViewSet.as_view({'post': 'archive'}), name='daycare_age_group_archive'),
    path('daycare/age-groups/<uuid:pk>/restore/', views.AgeGroupViewSet.as_view({'post': 'restore'}), name='daycare_age_group_restore'),
    
    # Programs & Classrooms
    path('programs/', views.ProgramListView.as_view(), name='program_list'),
    path('classrooms/', views.ClassroomListView.as_view(), name='classroom_list'),
    path('daycare/classrooms/<uuid:pk>/staff/', core_api_views.ClassroomStaffListView.as_view(), name='classroom_staff_list'),
    path('daycare/classrooms/<uuid:pk>/primary-teacher/', core_api_views.ClassroomPrimaryTeacherView.as_view(), name='classroom_primary_teacher'),
    path('daycare/classrooms/<uuid:pk>/assistants/', core_api_views.ClassroomAssistantTeacherView.as_view(), name='classroom_assistant_teacher'),
    path('daycare/classrooms/<uuid:pk>/schedule/', views.ClassroomScheduleView.as_view(), name='classroom_schedule'),
    path('daycare/classrooms/<uuid:pk>/coverage/', views.ClassroomCoverageView.as_view(), name='classroom_coverage'),
    path('daycare/classroom-staff/<uuid:pk>/', core_api_views.ClassroomStaffDetailView.as_view(), name='classroom_staff_detail'),
    path('daycare/classrooms/<uuid:pk>/assign-student/', views.ClassroomAssignStudentView.as_view(), name='classroom_assign_student'),

    # Attendance (Module 11 Phase 1 & Phase 2)
    path('daycare/attendance/daily/', views.DailyAttendanceView.as_view(), name='daycare_attendance_daily'),
    path('daycare/attendance/monthly/', views.MonthlyAttendanceView.as_view(), name='daycare_attendance_monthly'),
    path('daycare/attendance/check-in/', views.AttendanceCheckInView.as_view(), name='daycare_attendance_check_in'),
    path('daycare/attendance/check-out/', views.AttendanceCheckOutView.as_view(), name='daycare_attendance_check_out'),
    path('daycare/attendance/mark-absent/', views.AttendanceMarkAbsentView.as_view(), name='daycare_attendance_mark_absent'),
    path('daycare/attendance/mark-excused/', views.AttendanceMarkExcusedView.as_view(), name='daycare_attendance_mark_excused'),
    path('daycare/attendance/records/<uuid:pk>/correct/', views.AttendanceCorrectionView.as_view(), name='daycare_attendance_correct'),
    path('daycare/attendance/records/<uuid:pk>/audit/', views.AttendanceRecordAuditView.as_view(), name='daycare_attendance_audit'),
    path('daycare/attendance/records/<uuid:pk>/', views.AttendanceRecordDetailView.as_view(), name='daycare_attendance_record_detail'),
    path('daycare/attendance/stats/', views.AttendanceStatsView.as_view(), name='daycare_attendance_stats'),
    path('daycare/children/<uuid:pk>/attendance/', views.ChildAttendanceHistoryView.as_view(), name='daycare_child_attendance_history'),
    path('attendance/', views.AttendanceListView.as_view(), name='attendance_list'),

    # Master Attendance Dashboard & Comprehensive Reports (Module 11 Phase 5)
    path('daycare/attendance/dashboard/', views.MasterAttendanceDashboardView.as_view(), name='master_attendance_dashboard'),
    path('daycare/reports/attendance/daily/', views.DailyChildAttendanceReportView.as_view(), name='daily_child_attendance_report'),
    path('daycare/reports/attendance/monthly/', views.MonthlyChildAttendanceReportView.as_view(), name='monthly_child_attendance_report'),
    path('daycare/reports/staff-attendance/', views.StaffAttendanceReportView.as_view(), name='staff_attendance_report'),
    path('daycare/reports/timesheets/', views.TimesheetReportView.as_view(), name='staff_timesheets_report'),
    path('daycare/reports/attendance-audit/', views.AttendanceAuditReportView.as_view(), name='attendance_audit_report'),

    # Staff Attendance, Timesheets & Approvals (Module 11 Phase 3 & 4)
    path('daycare/staff/attendance/clock-in/', views.StaffClockInView.as_view(), name='staff_clock_in'),
    path('daycare/staff/attendance/clock-out/', views.StaffClockOutView.as_view(), name='staff_clock_out'),
    path('daycare/staff/attendance/start-break/', views.StaffStartBreakView.as_view(), name='staff_start_break'),
    path('daycare/staff/attendance/end-break/', views.StaffEndBreakView.as_view(), name='staff_end_break'),
    path('daycare/staff/attendance/dashboard/', views.StaffAttendanceDashboardView.as_view(), name='staff_attendance_dashboard'),
    path('daycare/staff/attendance/timesheets/', views.StaffTimesheetsListView.as_view(), name='staff_timesheets_list'),
    path('daycare/staff/attendance/current-status/', views.StaffCurrentStatusView.as_view(), name='staff_current_status'),
    path('daycare/staff/attendance/submit-batch/', views.StaffTimesheetBatchSubmitView.as_view(), name='staff_timesheet_batch_submit'),
    path('daycare/staff/attendance/overtime/report/', views.StaffAttendanceOvertimeReportView.as_view(), name='staff_attendance_overtime_report'),
    path('daycare/staff/attendance/records/<uuid:pk>/submit/', views.StaffTimesheetSubmitView.as_view(), name='staff_timesheet_submit'),
    path('daycare/staff/attendance/records/<uuid:pk>/resubmit/', views.StaffTimesheetResubmitView.as_view(), name='staff_timesheet_resubmit'),
    path('daycare/staff/attendance/records/<uuid:pk>/approve/', views.StaffTimesheetApproveView.as_view(), name='staff_timesheet_approve'),
    path('daycare/staff/attendance/records/<uuid:pk>/reject/', views.StaffTimesheetRejectView.as_view(), name='staff_timesheet_reject'),
    path('daycare/staff/attendance/records/<uuid:pk>/request-correction/', views.StaffTimesheetRequestCorrectionView.as_view(), name='staff_timesheet_request_correction'),
    path('daycare/staff/attendance/records/<uuid:pk>/correct/', views.StaffAttendanceCorrectionView.as_view(), name='staff_attendance_correct'),
    path('daycare/staff/attendance/records/<uuid:pk>/breaks/add/', views.StaffBreakAddView.as_view(), name='staff_break_add'),
    path('daycare/staff/attendance/records/<uuid:pk>/breaks/<uuid:break_id>/correct/', views.StaffBreakCorrectionView.as_view(), name='staff_break_correct'),
    path('daycare/staff/attendance/records/<uuid:pk>/audit/', views.StaffAttendanceAuditView.as_view(), name='staff_attendance_audit'),
    path('daycare/staff/attendance/records/<uuid:pk>/', views.StaffAttendanceRecordDetailView.as_view(), name='staff_attendance_record_detail'),


    # Module 14: Daily Child Reports
    path('daycare/daily-reports/', views.DailyReportViewSet.as_view({'get': 'list', 'post': 'create'}), name='daily_report_list'),
    path('daycare/daily-reports/dashboard/', views.DailyReportViewSet.as_view({'get': 'dashboard'}), name='daily_report_dashboard'),
    path('daycare/daily-reports/history/', views.DailyReportViewSet.as_view({'get': 'history'}), name='daily_report_history'),
    path('daycare/daily-reports/roster/', views.DailyReportViewSet.as_view({'get': 'roster'}), name='daily_report_roster'),
    path('daycare/daily-reports/get-or-create/', views.DailyReportViewSet.as_view({'get': 'get_or_create', 'post': 'get_or_create'}), name='daily_report_get_or_create'),
    path('daycare/daily-reports/<uuid:pk>/', views.DailyReportViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='daily_report_detail'),
    path('daycare/daily-reports/<uuid:pk>/checklist/', views.DailyReportViewSet.as_view({'get': 'checklist'}), name='daily_report_checklist'),
    path('daycare/daily-reports/<uuid:pk>/export/', views.DailyReportViewSet.as_view({'get': 'export_report'}), name='daily_report_export'),
    path('daycare/daily-reports/<uuid:pk>/meals/', views.DailyReportViewSet.as_view({'post': 'add_meal'}), name='daily_report_add_meal'),
    path('daycare/daily-reports/<uuid:pk>/naps/', views.DailyReportViewSet.as_view({'post': 'add_nap'}), name='daily_report_add_nap'),
    path('daycare/daily-reports/<uuid:pk>/toileting/', views.DailyReportViewSet.as_view({'post': 'add_toileting'}), name='daily_report_add_toileting'),
    path('daycare/daily-reports/<uuid:pk>/activities/', views.DailyReportViewSet.as_view({'post': 'add_activity'}), name='daily_report_add_activity'),
    path('daycare/daily-reports/<uuid:pk>/moods/', views.DailyReportViewSet.as_view({'post': 'add_mood'}), name='daily_report_add_mood'),
    path('daycare/daily-reports/<uuid:pk>/temperatures/', views.DailyReportViewSet.as_view({'post': 'add_temperature'}), name='daily_report_add_temperature'),
    path('daycare/daily-reports/<uuid:pk>/notes/', views.DailyReportViewSet.as_view({'post': 'add_note'}), name='daily_report_add_note'),
    path('daycare/daily-reports/<uuid:pk>/photos/', views.DailyReportViewSet.as_view({'post': 'upload_photo'}), name='daily_report_upload_photo'),
    path('daycare/daily-reports/<uuid:pk>/complete/', views.DailyReportViewSet.as_view({'post': 'complete'}), name='daily_report_complete'),
    path('daycare/daily-reports/<uuid:pk>/publish/', views.DailyReportViewSet.as_view({'post': 'publish'}), name='daily_report_publish'),
    path('daycare/daily-reports/<uuid:pk>/entries/<str:entry_type>/<uuid:entry_id>/', views.DailyReportViewSet.as_view({'delete': 'delete_entry'}), name='daily_report_delete_entry'),

    # Activities (Legacy)
    path('activities/report/', views.DailyReportView.as_view(), name='daily_report'),
    path('activities/log/', views.ActivityLogView.as_view(), name='activity_log'),
    
    # Health & Medical
    path('health/dashboard/', views.HealthDashboardView.as_view(), name='health_dashboard'),
    path('system-announcements/', views.DaycareSystemAnnouncementListView.as_view(), name='daycare_system_announcements'),
    path('health/student/<uuid:pk>/', views.StudentHealthDetailView.as_view(), name='health_student_detail'),
    path('health/medication/log/', views.MedicationAdministrationView.as_view(), name='health_medication_log'),
    
    # Billing & Subscriptions
    path('billing/invoices/', views.InvoiceListView.as_view(), name='invoice_list'),
    path('billing/invoices/<uuid:pk>/', views.InvoiceDetailView.as_view(), name='invoice_detail'),
    path('billing/subscriptions/', views.SubscriptionPlanListView.as_view(), name='subscription_plan_list'),
    path('billing/subscriptions/checkout/', views.SubscriptionCheckoutView.as_view(), name='subscription_checkout'),
    
    # Communication
    path('communication/announcements/', views.AnnouncementListView.as_view(), name='announcement_list'),
    path('communication/system-announcements/', views.DaycareSystemAnnouncementListView.as_view(), name='system_announcements_list'),
    path('communication/stats/', views.CommunicationStatsView.as_view(), name='communication_stats'),
    path('communication/templates/', views.CommunicationTemplatesView.as_view(), name='communication_templates'),
    
    # Profile & Settings
    path('daycare/profile/', views.DaycareProfileView.as_view(), name='daycare_profile'),
    path('daycare/settings/', views.DaycareSettingsView.as_view(), name='daycare_settings'),
    path('profile/', views.UserProfileView.as_view(), name='profile_detail'),
    path('profile/password/', views.UserPasswordView.as_view(), name='profile_password'),
    
    # Documents
    path('documents/folders/', views.DocumentFolderView.as_view(), name='document_folders'),
    path('documents/', views.DocumentListView.as_view(), name='document_list'),
    
    # Compliance
    path('compliance/incidents/', views.IncidentListView.as_view(), name='incident_list'),
    path('compliance/inspections/', views.InspectionListView.as_view(), name='inspection_list'),
    
    # Holidays
    path('daycare/holidays/', views.DaycareHolidayViewSet.as_view({'get': 'list', 'post': 'create'}), name='holiday_list'),
    path('daycare/holidays/<uuid:pk>/', views.DaycareHolidayViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='holiday_detail'),
    
    # Branches
    path('branches/', views.BranchViewSet.as_view({'get': 'list', 'post': 'create'}), name='branches_root_list'),
    path('branches/<uuid:pk>/', views.BranchViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='branches_root_detail'),
    path('daycare/branches/', views.BranchViewSet.as_view({'get': 'list', 'post': 'create'}), name='branch_list'),
    path('daycare/branches/check-limit/', views.BranchViewSet.as_view({'get': 'check_limit'}), name='branch_check_limit'),
    path('daycare/branches/<uuid:pk>/', views.BranchViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='branch_detail'),
    path('daycare/branches/<uuid:pk>/restore/', views.BranchViewSet.as_view({'post': 'restore'}), name='branch_restore'),

    # Emergency Information
    path('daycare/emergency-information/', views.DaycareEmergencyInfoView.as_view(), name='emergency_info'),

    # Daycare Families & Guardians Administration
    path('daycare/families/', views.FamilyListView.as_view(), name='daycare_family_list'),
    path('daycare/families/<uuid:pk>/', views.FamilyDetailView.as_view(), name='daycare_family_detail'),
    path('daycare/families/<uuid:family_id>/guardians/', views.FamilyGuardianListView.as_view(), name='daycare_family_guardian_list'),
    path('daycare/families/<uuid:family_id>/guardians/<uuid:guardian_id>/', views.FamilyGuardianDetailView.as_view(), name='daycare_family_guardian_detail'),
    path('daycare/families/<uuid:family_id>/children/', views.FamilyChildListView.as_view(), name='daycare_family_child_list'),
    path('daycare/families/<uuid:family_id>/children/<uuid:student_id>/', views.FamilyChildDetailView.as_view(), name='daycare_family_child_detail'),

    # ─── Family / Guardian Portal ────────────────────────────────────────────────
    path('family/dashboard/', views.FamilyDashboardView.as_view(), name='family_dashboard'),
    path('family/safe-arrival/status/', views.FamilySafeArrivalStatusView.as_view(), name='family_safe_arrival_status'),

    # Daily Reports (Family Portal)
    path('family/daily-reports/', views.FamilyDailyReportsView.as_view(), name='family_daily_reports_list'),
    path('family/daily-reports/history/', views.FamilyDailyReportHistoryView.as_view(), name='family_daily_reports_history'),
    path('family/daily-reports/<uuid:child_id>/<str:date>/', views.FamilyDailyReportDetailView.as_view(), name='family_daily_report_detail_child_date'),
    path('family/daily-reports/<uuid:pk>/', views.FamilyDailyReportDetailView.as_view(), name='family_daily_report_detail_by_id'),

    # Child-specific (attendance, daily reports, emergency contacts, pickups, documents)
    path('family/children/<uuid:pk>/attendance/', views.FamilyChildAttendanceView.as_view(), name='family_child_attendance'),
    path('family/children/<uuid:pk>/daily-reports/', views.FamilyChildDailyReportsView.as_view(), name='family_child_daily_reports'),
    path('family/children/<uuid:pk>/emergency-contacts/', views.FamilyChildEmergencyContactsView.as_view(), name='family_child_emergency_contacts'),
    path('family/emergency-contacts/<uuid:pk>/', views.FamilyEmergencyContactDetailView.as_view(), name='family_emergency_contact_detail'),
    path('family/children/<uuid:pk>/authorized-pickups/', views.FamilyChildAuthorizedPickupsView.as_view(), name='family_child_authorized_pickups'),
    path('family/authorized-pickups/<uuid:pk>/', views.FamilyAuthorizedPickupDetailView.as_view(), name='family_authorized_pickup_detail'),
    path('family/authorized-pickups/<uuid:pk>/photo/', views.GuardianPickupPhotoView.as_view(), name='family_authorized_pickup_photo'),
    path('family/authorized-pickups/<uuid:pk>/qr-pass/', views.FamilyAuthorizedPickupQRPassView.as_view(), name='family_authorized_pickup_qr_pass'),
    path('family/authorized-pickups/<uuid:pk>/pin/', views.FamilyAuthorizedPickupPINView.as_view(), name='family_authorized_pickup_pin'),
    path('family/children/<uuid:pk>/documents/', views.FamilyChildDocumentsView.as_view(), name='family_child_documents'),

    # Billing
    path('family/billing/invoices/', views.FamilyBillingInvoicesView.as_view(), name='family_billing_invoices'),
    path('family/billing/invoices/<uuid:pk>/', views.FamilyBillingInvoiceDetailView.as_view(), name='family_billing_invoice_detail'),
    path('family/billing/payments/', views.FamilyBillingPaymentsView.as_view(), name='family_billing_payments'),

    # Messages
    path('family/messages/', views.FamilyMessagesView.as_view(), name='family_messages'),
    path('family/messages/<uuid:pk>/', views.FamilyMessageDetailView.as_view(), name='family_message_detail'),

    # Announcements
    path('family/announcements/', views.FamilyAnnouncementsView.as_view(), name='family_announcements'),

    # Consent Forms (guardian)
    path('family/consent-forms/', views.FamilyConsentFormsView.as_view(), name='family_consent_forms'),
    path('family/consent-forms/<uuid:pk>/sign/', views.FamilyConsentFormSignView.as_view(), name='family_consent_form_sign'),

    # ─── Admin Consent Form Management ───────────────────────────────────────────
    path('daycare/consent-forms/', views.ConsentFormListView.as_view(), name='admin_consent_form_list'),
    path('daycare/consent-forms/<uuid:pk>/', views.ConsentFormDetailView.as_view(), name='admin_consent_form_detail'),
    path('daycare/consent-forms/<uuid:pk>/assign/', views.ConsentFormAssignView.as_view(), name='admin_consent_form_assign'),
    path('daycare/consent-forms/<uuid:pk>/signatures/', views.ConsentFormSignaturesView.as_view(), name='admin_consent_form_signatures'),

    # ─── Public Registration ─────────────────────────────────────────────────────
    path('daycare/applications/', core_api_views.AdminRegistrationApplicationViewSet.as_view({'get': 'list'}), name='admin_applications_list'),
    path('daycare/applications/<uuid:pk>/', core_api_views.AdminRegistrationApplicationViewSet.as_view({'get': 'retrieve'}), name='admin_applications_detail'),
    path('daycare/applications/<uuid:pk>/approve/', core_api_views.AdminRegistrationApplicationViewSet.as_view({'post': 'approve'}), name='admin_applications_approve'),
    path('daycare/applications/<uuid:pk>/reject/', core_api_views.AdminRegistrationApplicationViewSet.as_view({'post': 'reject'}), name='admin_applications_reject'),
    path('daycare/applications/<uuid:pk>/waitlist/', core_api_views.AdminRegistrationApplicationViewSet.as_view({'post': 'waitlist'}), name='admin_applications_waitlist'),

    path('public/daycares/<str:identifier>/registration/', core_api_views.PublicDaycareRegistrationView.as_view(), name='public_daycare_registration'),
    path('public/registrations/', core_api_views.RegistrationApplicationCreateView.as_view(), name='public_registration_create'),
    path('public/registrations/<str:application_number>/', core_api_views.RegistrationApplicationDetailView.as_view(), name='public_registration_detail'),
    path('public/registrations/<str:application_number>/update/', core_api_views.RegistrationApplicationUpdateView.as_view(), name='public_registration_update'),
    path('public/registrations/<str:application_number>/submit/', core_api_views.RegistrationApplicationSubmitView.as_view(), name='public_registration_submit'),


    # Phase 42 Enrollment Forms, Documents & Consent
    path('daycare/enrollment-forms/', core_api_views.EnrollmentFormViewSet.as_view({'get': 'list', 'post': 'create'}), name='enrollment_form_list'),
    path('daycare/enrollment-forms/<uuid:pk>/', core_api_views.EnrollmentFormViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='enrollment_form_detail'),
    path('public/daycares/<str:identifier>/enrollment-forms/', core_api_views.PublicEnrollmentFormView.as_view(), name='public_enrollment_forms'),
    path('daycare/applications/<str:application_number>/documents/', core_api_views.DocumentUploadView.as_view(), name='application_documents'),
    path('daycare/documents/<uuid:document_id>/download/', core_api_views.SecureFileDownloadView.as_view(), name='secure_document_download'),
    path('daycare/applications/<str:application_number>/consent/', core_api_views.ApplicationConsentView.as_view(), name='application_consent'),
# Phase 44 Waitlist
    path('daycare/waitlist/', core_api_views.WaitlistViewSet.as_view({'get': 'list', 'post': 'create'}), name='waitlist_list'),
    path('daycare/waitlist/<uuid:pk>/', core_api_views.WaitlistViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='waitlist_detail'),
    path('daycare/waitlist/<uuid:pk>/contact/', core_api_views.WaitlistViewSet.as_view({'post': 'contact'}), name='waitlist_contact'),
    path('daycare/waitlist/<uuid:pk>/offer/', core_api_views.WaitlistViewSet.as_view({'post': 'offer'}), name='waitlist_offer'),
    # Module 13 Phase 2, 4 & 5: Live Ratio Monitoring, Reports, Compliance History, Overrides & Ratio Rules
    path('daycare/ratio-monitoring/', views.LiveRatioMonitoringView.as_view(), name='live_ratio_monitoring'),
    path('daycare/ratio-monitoring/dashboard/', views.LiveRatioMonitoringView.as_view(), name='live_ratio_monitoring_dashboard'),
    path('daycare/ratio-monitoring/reports/', views.RatioReportsView.as_view(), name='ratio_monitoring_reports'),
    path('daycare/ratio-monitoring/audit-logs/', views.RatioAuditLogListView.as_view(), name='ratio_monitoring_audit_logs'),
    path('daycare/ratio-monitoring/classrooms/<uuid:pk>/', views.ClassroomLiveRatioDetailView.as_view(), name='classroom_live_ratio_detail'),
    path('daycare/ratio-monitoring/history/', views.RatioComplianceHistoryListView.as_view(), name='ratio_compliance_history'),
    path('daycare/ratio-monitoring/log-snapshot/', views.LogComplianceSnapshotView.as_view(), name='ratio_log_snapshot'),
    path('daycare/ratio-monitoring/overrides/', views.RatioManualOverrideViewSet.as_view({'get': 'list', 'post': 'create'}), name='ratio_override_list'),
    path('daycare/ratio-monitoring/overrides/<uuid:pk>/', views.RatioManualOverrideViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='ratio_override_detail'),
    path('daycare/ratio-monitoring/overrides/<uuid:pk>/deactivate/', views.RatioManualOverrideViewSet.as_view({'post': 'deactivate'}), name='ratio_override_deactivate'),
    path('daycare/ratio-rules/', views.RatioRuleViewSet.as_view({'get': 'list', 'post': 'create'}), name='ratio_rule_list'),
    path('daycare/ratio-rules/lookup/', views.RatioRuleViewSet.as_view({'get': 'lookup', 'post': 'lookup'}), name='ratio_rule_lookup'),
    path('daycare/ratio-rules/applicable/', views.RatioRuleViewSet.as_view({'get': 'applicable', 'post': 'applicable'}), name='ratio_rule_applicable'),
    path('daycare/ratio-rules/evaluate-qualification/', views.RatioRuleViewSet.as_view({'post': 'evaluate_qualification'}), name='ratio_rule_evaluate_qualification'),
    path('daycare/ratio-rules/<uuid:pk>/', views.RatioRuleViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='ratio_rule_detail'),
    path('daycare/ratio-rules/<uuid:pk>/version/', views.RatioRuleViewSet.as_view({'post': 'version'}), name='ratio_rule_version'),

    # =========================================================================
    # MODULE 16: BILLING & INVOICING (PHASE 1 - FEE STRUCTURE & CONFIGURATION)
    # =========================================================================
    # Fee Structures
    path('daycare/billing/fee-structures/summary/', views.FeeStructureViewSet.as_view({'get': 'summary'}), name='fee_structure_summary'),
    path('daycare/billing/fee-structures/', views.FeeStructureViewSet.as_view({'get': 'list', 'post': 'create'}), name='fee_structure_list'),
    path('daycare/billing/fee-structures/<uuid:pk>/', views.FeeStructureViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='fee_structure_detail'),
    path('daycare/billing/fee-structures/<uuid:pk>/activate/', views.FeeStructureViewSet.as_view({'post': 'activate'}), name='fee_structure_activate'),
    path('daycare/billing/fee-structures/<uuid:pk>/deactivate/', views.FeeStructureViewSet.as_view({'post': 'deactivate'}), name='fee_structure_deactivate'),
    path('daycare/billing/fee-structures/<uuid:pk>/create_version/', views.FeeStructureViewSet.as_view({'post': 'create_version'}), name='fee_structure_create_version'),
    path('daycare/billing/fee-structures/<uuid:pk>/history/', views.FeeStructureViewSet.as_view({'get': 'history'}), name='fee_structure_history'),

    # Fee Assignments
    path('daycare/billing/fee-assignments/resolve-for-child/', views.ChildFeeAssignmentViewSet.as_view({'get': 'resolve_for_child'}), name='fee_assignment_resolve'),
    path('daycare/billing/fee-assignments/', views.ChildFeeAssignmentViewSet.as_view({'get': 'list', 'post': 'create'}), name='fee_assignment_list'),
    path('daycare/billing/fee-assignments/<uuid:pk>/', views.ChildFeeAssignmentViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='fee_assignment_detail'),

    # Registration Fees
    path('daycare/billing/registration-fees/', views.RegistrationFeeRecordViewSet.as_view({'get': 'list', 'post': 'create'}), name='registration_fee_list'),
    path('daycare/billing/registration-fees/<uuid:pk>/', views.RegistrationFeeRecordViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='registration_fee_detail'),
    path('daycare/billing/registration-fees/<uuid:pk>/waive/', views.RegistrationFeeRecordViewSet.as_view({'post': 'waive'}), name='registration_fee_waive'),

    # Deposits
    path('daycare/billing/deposits/', views.DepositRecordViewSet.as_view({'get': 'list', 'post': 'create'}), name='deposit_list'),
    path('daycare/billing/deposits/<uuid:pk>/', views.DepositRecordViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='deposit_detail'),
    path('daycare/billing/deposits/<uuid:pk>/process-action/', views.DepositRecordViewSet.as_view({'post': 'process_action'}), name='deposit_process_action'),

    # Calculation Preview Utilities
    path('daycare/billing/calculator/proration/', views.BillingCalculatorView.as_view({'post': 'calculate_proration'}), name='billing_calc_proration'),
    path('daycare/billing/calculator/sibling-discount/', views.BillingCalculatorView.as_view({'post': 'calculate_sibling_discount'}), name='billing_calc_sibling_discount'),
    path('daycare/billing/calculator/child-breakdown/', views.BillingCalculatorView.as_view({'post': 'child_breakdown'}), name='billing_calc_child_breakdown'),
    path('daycare/billing/calculator/family-breakdown/', views.BillingCalculatorView.as_view({'post': 'family_breakdown'}), name='billing_calc_family_breakdown'),

    # =========================================================================
    # MODULE 16: BILLING & INVOICING (PHASE 2 - DISCOUNTS, CREDITS & LATE FEES)
    # =========================================================================
    # Discount Rules
    path('daycare/billing/discounts/applicable/', views.DiscountRuleViewSet.as_view({'get': 'applicable'}), name='discount_rule_applicable'),
    path('daycare/billing/discounts/', views.DiscountRuleViewSet.as_view({'get': 'list', 'post': 'create'}), name='discount_rule_list'),
    path('daycare/billing/discounts/<uuid:pk>/', views.DiscountRuleViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='discount_rule_detail'),
    path('daycare/billing/discounts/<uuid:pk>/activate/', views.DiscountRuleViewSet.as_view({'post': 'activate'}), name='discount_rule_activate'),
    path('daycare/billing/discounts/<uuid:pk>/deactivate/', views.DiscountRuleViewSet.as_view({'post': 'deactivate'}), name='discount_rule_deactivate'),
    path('daycare/billing/discounts/<uuid:pk>/create_version/', views.DiscountRuleViewSet.as_view({'post': 'create_version'}), name='discount_rule_create_version'),
    path('daycare/billing/discounts/<uuid:pk>/history/', views.DiscountRuleViewSet.as_view({'get': 'history'}), name='discount_rule_history'),

    # Sibling Discounts
    path('daycare/billing/sibling-discounts/preview-family/', views.SiblingDiscountRuleViewSet.as_view({'post': 'preview_family'}), name='sibling_discount_preview_family'),
    path('daycare/billing/sibling-discounts/', views.SiblingDiscountRuleViewSet.as_view({'get': 'list', 'post': 'create'}), name='sibling_discount_list'),
    path('daycare/billing/sibling-discounts/<uuid:pk>/', views.SiblingDiscountRuleViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='sibling_discount_detail'),
    path('daycare/billing/sibling-discounts/<uuid:pk>/activate/', views.SiblingDiscountRuleViewSet.as_view({'post': 'activate'}), name='sibling_discount_activate'),
    path('daycare/billing/sibling-discounts/<uuid:pk>/deactivate/', views.SiblingDiscountRuleViewSet.as_view({'post': 'deactivate'}), name='sibling_discount_deactivate'),
    path('daycare/billing/sibling-discounts/<uuid:pk>/create_version/', views.SiblingDiscountRuleViewSet.as_view({'post': 'create_version'}), name='sibling_discount_create_version'),

    # Credit Ledger
    path('daycare/billing/credits/balance/', views.CreditTransactionViewSet.as_view({'get': 'balance'}), name='credit_balance'),
    path('daycare/billing/credits/grant/', views.CreditTransactionViewSet.as_view({'post': 'grant'}), name='credit_grant'),
    path('daycare/billing/credits/apply/', views.CreditTransactionViewSet.as_view({'post': 'apply'}), name='credit_apply'),
    path('daycare/billing/credits/', views.CreditTransactionViewSet.as_view({'get': 'list'}), name='credit_list'),
    path('daycare/billing/credits/<uuid:pk>/', views.CreditTransactionViewSet.as_view({'get': 'retrieve'}), name='credit_detail'),
    path('daycare/billing/credits/<uuid:pk>/reverse/', views.CreditTransactionViewSet.as_view({'post': 'reverse'}), name='credit_reverse'),

    # Late Fee Rules
    path('daycare/billing/late-fees/evaluate/', views.LateFeeRuleViewSet.as_view({'post': 'evaluate'}), name='late_fee_evaluate'),
    path('daycare/billing/late-fees/', views.LateFeeRuleViewSet.as_view({'get': 'list', 'post': 'create'}), name='late_fee_list'),
    path('daycare/billing/late-fees/<uuid:pk>/', views.LateFeeRuleViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='late_fee_detail'),
    path('daycare/billing/late-fees/<uuid:pk>/activate/', views.LateFeeRuleViewSet.as_view({'post': 'activate'}), name='late_fee_activate'),
    path('daycare/billing/late-fees/<uuid:pk>/deactivate/', views.LateFeeRuleViewSet.as_view({'post': 'deactivate'}), name='late_fee_deactivate'),
    path('daycare/billing/late-fees/<uuid:pk>/create_version/', views.LateFeeRuleViewSet.as_view({'post': 'create_version'}), name='late_fee_create_version'),

    # =========================================================================
    # MODULE 16: BILLING & INVOICING (PHASE 3 - INVOICES & RECURRING BILLING)
    # =========================================================================
    # Invoices
    path('daycare/billing/invoices/stats/', views.InvoiceViewSet.as_view({'get': 'stats'}), name='invoice_stats'),
    path('daycare/billing/invoices/families/', views.InvoiceViewSet.as_view({'get': 'families'}), name='invoice_families'),
    path('daycare/billing/invoices/students/', views.InvoiceViewSet.as_view({'get': 'students'}), name='invoice_students'),
    path('daycare/billing/invoices/generate-registration-invoice/', views.InvoiceViewSet.as_view({'post': 'generate_registration_invoice'}), name='invoice_generate_registration'),
    path('daycare/billing/invoices/generate-batch/', views.InvoiceViewSet.as_view({'post': 'generate_batch'}), name='invoice_generate_batch'),
    path('daycare/billing/invoices/', views.InvoiceViewSet.as_view({'get': 'list', 'post': 'create'}), name='daycare_invoice_list'),
    path('daycare/billing/invoices/<uuid:pk>/', views.InvoiceViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='daycare_invoice_detail'),
    path('daycare/billing/invoices/<uuid:pk>/issue/', views.InvoiceViewSet.as_view({'post': 'issue'}), name='daycare_invoice_issue'),
    path('daycare/billing/invoices/<uuid:pk>/void/', views.InvoiceViewSet.as_view({'post': 'void'}), name='daycare_invoice_void'),
    path('daycare/billing/invoices/<uuid:pk>/cancel/', views.InvoiceViewSet.as_view({'post': 'cancel'}), name='daycare_invoice_cancel'),
    path('daycare/billing/invoices/<uuid:pk>/apply-credit/', views.InvoiceViewSet.as_view({'post': 'apply_credit'}), name='daycare_invoice_apply_credit'),
    path('daycare/billing/invoices/<uuid:pk>/apply-deposit/', views.InvoiceViewSet.as_view({'post': 'apply_deposit'}), name='daycare_invoice_apply_deposit'),
    path('daycare/billing/invoices/<uuid:pk>/assess-late-fee/', views.InvoiceViewSet.as_view({'post': 'assess_late_fee'}), name='daycare_invoice_assess_late_fee'),

    # Recurring Billing Profiles
    path('daycare/billing/recurring-profiles/trigger-all/', views.RecurringBillingProfileViewSet.as_view({'post': 'trigger_all_runs'}), name='recurring_profile_trigger_all'),
    path('daycare/billing/recurring-profiles/', views.RecurringBillingProfileViewSet.as_view({'get': 'list', 'post': 'create'}), name='recurring_profile_list'),
    path('daycare/billing/recurring-profiles/<uuid:pk>/', views.RecurringBillingProfileViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='recurring_profile_detail'),
    path('daycare/billing/recurring-profiles/<uuid:pk>/trigger-run/', views.RecurringBillingProfileViewSet.as_view({'post': 'trigger_run'}), name='recurring_profile_trigger_run'),
    path('daycare/billing/recurring-profiles/<uuid:pk>/activate/', views.RecurringBillingProfileViewSet.as_view({'post': 'activate'}), name='recurring_profile_activate'),
    path('daycare/billing/recurring-profiles/<uuid:pk>/deactivate/', views.RecurringBillingProfileViewSet.as_view({'post': 'deactivate'}), name='recurring_profile_deactivate'),

    # =========================================================================
    # MODULE 16: BILLING & INVOICING (PHASE 4 - PAYMENTS, SUBSIDIES & TAX RECEIPTS)
    # =========================================================================
    # Payments & Receipts
    path('daycare/billing/payments/summary/', views.PaymentViewSet.as_view({'get': 'summary'}), name='payment_summary'),
    path('daycare/billing/payments/', views.PaymentViewSet.as_view({'get': 'list', 'post': 'create'}), name='payment_list'),
    path('daycare/billing/payments/<uuid:pk>/', views.PaymentViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='payment_detail'),
    path('daycare/billing/payments/<uuid:pk>/refund/', views.PaymentViewSet.as_view({'post': 'refund'}), name='payment_refund'),
    path('daycare/billing/payments/<uuid:pk>/receipt/', views.PaymentViewSet.as_view({'get': 'receipt'}), name='payment_receipt'),

    # Subsidies
    path('daycare/billing/subsidies/claims-summary/', views.SubsidyProfileViewSet.as_view({'get': 'claims_summary'}), name='subsidy_claims_summary'),
    path('daycare/billing/subsidies/', views.SubsidyProfileViewSet.as_view({'get': 'list', 'post': 'create'}), name='subsidy_list'),
    path('daycare/billing/subsidies/<uuid:pk>/', views.SubsidyProfileViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='subsidy_detail'),

    # Tax Receipts
    path('daycare/billing/tax-receipts/generate/', views.TaxReceiptViewSet.as_view({'post': 'generate'}), name='tax_receipt_generate'),
    path('daycare/billing/tax-receipts/generate-batch/', views.TaxReceiptViewSet.as_view({'post': 'generate_batch'}), name='tax_receipt_generate_batch'),
    path('daycare/billing/tax-receipts/', views.TaxReceiptViewSet.as_view({'get': 'list'}), name='tax_receipt_list'),
    path('daycare/billing/tax-receipts/<uuid:pk>/', views.TaxReceiptViewSet.as_view({'get': 'retrieve', 'delete': 'destroy'}), name='tax_receipt_detail'),
    path('daycare/billing/tax-receipts/<uuid:pk>/void/', views.TaxReceiptViewSet.as_view({'post': 'void'}), name='tax_receipt_void'),
    path('daycare/billing/tax-receipts/<uuid:pk>/print/', views.TaxReceiptViewSet.as_view({'get': 'print_slip'}), name='tax_receipt_print_slip'),

    # Account Statement
    path('daycare/billing/statements/', views.FamilyAccountStatementView.as_view({'get': 'list'}), name='daycare_billing_statement'),
]




