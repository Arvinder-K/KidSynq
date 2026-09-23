from rest_framework.decorators import action
from .dashboard import DashboardStatsView
from .dashboard import DaycareDashboardView
from .dashboard import ClassroomDashboardStatsView
from .profile import DaycareProfileSerializer
from .profile import DaycareProfileView
from .profile import UserProfileView
from .profile import UserPasswordView
from .profile import UserDetailView
from .holidays import DaycareHolidaySerializer
from .holidays import DaycareHolidayViewSet
from .emergency import DaycareEmergencyInfoSerializer
from .emergency import DaycareEmergencyInfoView
from .age_groups import AgeGroupViewSet
from .branches import BranchViewSet, BranchSerializer
from .classrooms import ClassroomListView, ClassroomViewSet
from .classrooms import ClassroomAssignTeacherView
from .classrooms import ClassroomAssignStudentView
from .classrooms import ClassroomTeacherViewSet
from .classrooms import AvailableTeachersView
from .classrooms import ClassroomTeachersView
from .classrooms import ClassroomScheduleView
from .classrooms import ClassroomCoverageView

from .programs import ProgramListView
from .activities import DailyReportView
from .activities import ActivityLogView
from .daily_reports import DailyReportViewSet
from .health import HealthDashboardView
from .health import StudentHealthDetailView
from .health import MedicationAdministrationView
from .billing import InvoiceListView
from .billing import InvoiceDetailView
from .billing import SubscriptionPlanListView
from .billing import SubscriptionCheckoutView
from .billing import (
    FeeStructureViewSet,
    ChildFeeAssignmentViewSet,
    RegistrationFeeRecordViewSet,
    DepositRecordViewSet,
    DiscountRuleViewSet,
    SiblingDiscountRuleViewSet,
    CreditTransactionViewSet,
    LateFeeRuleViewSet,
    BillingCalculatorView,
    InvoiceViewSet,
    RecurringBillingProfileViewSet,
    PaymentViewSet,
    SubsidyProfileViewSet,
    TaxReceiptViewSet,
    FamilyAccountStatementView
)
from .communication import AnnouncementListView
from .communication import DaycareSystemAnnouncementListView
from .communication import CommunicationStatsView
from .communication import CommunicationTemplatesView
from .documents import DocumentFolderView
from .documents import DocumentListView
from .compliance import IncidentListView
from .compliance import InspectionListView
from .staff import StaffListView
from .students import StudentViewSet, StudentDocumentView
from .students import StudentEmergencyContactViewSet
from .students import StudentPickupViewSet
from .family import FamilyListView
from .family import FamilyDetailView
from .family import FamilyGuardianListView
from .family import FamilyGuardianDetailView
from .family import FamilyChildListView
from .family import FamilyChildDetailView
from .attendance import (
    AttendanceListView, DailyAttendanceView, AttendanceCheckInView,
    AttendanceCheckOutView, AttendanceMarkAbsentView, AttendanceMarkExcusedView,
    ChildAttendanceHistoryView, AttendanceRecordDetailView, AttendanceStatsView,
    MonthlyAttendanceView, AttendanceCorrectionView, AttendanceRecordAuditView,
    MasterAttendanceDashboardView, DailyChildAttendanceReportView,
    MonthlyChildAttendanceReportView, StaffAttendanceReportView,
    TimesheetReportView, AttendanceAuditReportView
)
from .settings import DaycareSettingsView

# Family/Guardian Portal
from .family_portal import (
    FamilyDashboardView,
    FamilyDailyReportsView,
    FamilyDailyReportDetailView,
    FamilyDailyReportHistoryView,
    FamilyChildAttendanceView,
    FamilyChildDailyReportsView,
    FamilyChildEmergencyContactsView,
    FamilyEmergencyContactDetailView,
    FamilyChildAuthorizedPickupsView,
    FamilyAuthorizedPickupDetailView,
    FamilyAuthorizedPickupQRPassView,
    FamilyAuthorizedPickupPINView,
    FamilySafeArrivalStatusView,
    FamilyChildDocumentsView,
    FamilyBillingInvoicesView,
    FamilyBillingInvoiceDetailView,
    FamilyBillingPaymentsView,
    FamilyBillingPaymentReceiptView,
    FamilyBillingTaxReceiptsView,
    FamilyBillingTaxReceiptDetailView,
    FamilyBillingStatementView,
    FamilyMessagesView,
    FamilyMessageDetailView,
    FamilyAnnouncementsView,
    FamilyConsentFormsView,
    FamilyConsentFormSignView,
)

# Admin Consent Forms
from .consent_forms import (
    ConsentFormListView,
    ConsentFormDetailView,
    ConsentFormAssignView,
    ConsentFormSignaturesView,
)


from .employees import (
    EmployeeViewSet, EmployeeQualificationViewSet, EmployeeCertificationViewSet,
    EmployeeTypeViewSet, EmploymentHistoryViewSet, EmployeeCompensationViewSet,
    EmployeeDocumentViewSet, EmployeeEmergencyContactViewSet,
    EmployeeAvailabilityViewSet, StaffDashboardView, StaffReportsView,
    ProvinceListView, CredentialTypeListView, ECECredentialViewSet,
    CredentialComplianceDashboardView, SendComplianceAlertsView,
    CredentialReportsView, EmployeeCredentialHistoryView, EmployeeComplianceProfileView
)

from .scheduling import StaffScheduleViewSet
from .scheduling_overtime import (
    OvertimeViewSet, TimeBankViewSet, TimeBankRuleView,
    ShiftSwapViewSet, StaffMyScheduleView, StaffMySwapsView
)
from .scheduling_leave import (
    LeaveTypeViewSet, LeaveRequestViewSet, StaffShortageViewSet,
    StaffMyLeaveView, StaffNotificationViewSet
)
from .scheduling_dashboard_reports import (
    SchedulingDashboardView, SchedulingReportsView,
    SchedulingHistoryView, ClassroomScheduleDetailView
)

from .staff_attendance import (
    StaffClockInView,
    StaffClockOutView,
    StaffStartBreakView,
    StaffEndBreakView,
    StaffAttendanceDashboardView,
    StaffTimesheetsListView,
    StaffCurrentStatusView,
    StaffTimesheetSubmitView,
    StaffTimesheetBatchSubmitView,
    StaffTimesheetResubmitView,
    StaffTimesheetApproveView,
    StaffTimesheetRejectView,
    StaffTimesheetRequestCorrectionView,
    StaffAttendanceCorrectionView,
    StaffBreakCorrectionView,
    StaffBreakAddView,
    StaffAttendanceOvertimeReportView,
    StaffAttendanceAuditView,
    StaffAttendanceRecordDetailView
)

from .pickup import (
    AuthorizedPickupViewSet,
    PickupVerificationView,
    ActiveChildPickupsView,
    GuardianPickupPhotoView
)

from .ratio_monitoring import (
    LiveRatioMonitoringView,
    ClassroomLiveRatioDetailView,
    RatioRuleViewSet,
    RatioComplianceHistoryListView,
    RatioManualOverrideViewSet,
    LogComplianceSnapshotView,
    RatioReportsView,
    RatioAuditLogListView
)

from .digital_verification import (
    QRTokenGenerateView,
    QRTokenRevokeView,
    QRScanView,
    QRCheckInView,
    QRCheckOutView,
    PINSetView,
    PINVerifyView,
    PINCheckOutView,
    DigitalSignatureCheckOutView,
    SafeArrivalDepartureEventsListView
)

from .safe_arrival import (
    SafeArrivalDashboardView,
    ChildPickupHistoryView,
    PickupExceptionsListView,
    SafeArrivalReportsView,
    AttendancePickupCorrectionView
)


