import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StaffList from './pages/StaffList';
import StudentList from './pages/StudentList';
import StudentForm from './pages/StudentForm';
import StudentProfileLayout from './pages/students/StudentProfileLayout';
import StudentOverview from './pages/students/StudentOverview';
import StudentMedical from './pages/students/StudentMedical';
import StudentContacts from './pages/students/StudentContacts';
import StudentDocuments from './pages/students/StudentDocuments';
import ChildList from './pages/ChildList';
import ChildProfileLayout from './pages/children/ChildProfileLayout';
import ChildOverview from './pages/children/ChildOverview';
import ChildPersonal from './pages/children/ChildPersonal';
import ChildEnrollment from './pages/children/ChildEnrollment';
import ChildNotes from './pages/children/ChildNotes';
import ChildMedical from './pages/children/ChildMedical';
import ChildEmergency from './pages/children/ChildEmergency';
import ChildPickup from './pages/children/ChildPickup';
import PickupVerificationPage from './pages/daycare/pickups/PickupVerificationPage';
import ChildDocuments from './pages/children/ChildDocuments';
import ChildVaccinations from './pages/children/ChildVaccinations';
import ChildClassroom from './pages/children/ChildClassroom';
import ChildHistory from './pages/children/ChildHistory';
import ChildAdmission from './pages/ChildAdmission';
import ClassroomList from './pages/classrooms/ClassroomList';
import ClassroomForm from './pages/classrooms/ClassroomForm';
import ClassroomDetailLayout from './pages/classrooms/detail/ClassroomDetailLayout';
import ClassroomOverview from './pages/classrooms/detail/ClassroomOverview';
import ClassroomTeachers from './pages/classrooms/detail/ClassroomTeachers';
import ClassroomScheduleTab from './pages/classrooms/detail/ClassroomScheduleTab';
import ClassroomOccupancyTab from './pages/classrooms/detail/ClassroomOccupancyTab';
import ClassroomStudentsTab from './pages/classrooms/detail/ClassroomStudentsTab';
import ClassroomRatioTab from './pages/classrooms/detail/ClassroomRatioTab';
import ClassroomHistoryTab from './pages/classrooms/detail/ClassroomHistoryTab';
import ClassroomReportsTab from './pages/classrooms/detail/ClassroomReportsTab';

import StudentEnrollment from './pages/students/StudentEnrollment';
import StudentNotes from './pages/students/StudentNotes';
import DocumentManager from './pages/DocumentManager';
import ComplianceDashboard from './pages/ComplianceDashboard';
import ProgramsDashboard from './pages/ProgramsDashboard';
import ChildAttendance from './pages/children/ChildAttendance';
import DailyAttendance from './pages/daycare/attendance/DailyAttendance';
import MonthlyAttendance from './pages/daycare/attendance/MonthlyAttendance';
import HealthDashboard from './pages/HealthDashboard';
import BillingDashboard from './pages/BillingDashboard';
import CommunicationDashboard from './pages/CommunicationDashboard';
import UserProfile from './pages/UserProfile';
import DaycareHolidays from './pages/DaycareHolidays';
import DaycareEmergencyInfo from './pages/DaycareEmergencyInfo';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import ClassroomDashboard from './pages/ClassroomDashboard';
import AgeGroupList from './pages/AgeGroupList';
import AgeGroupForm from './pages/AgeGroupForm';
import AgeGroupDetails from './pages/AgeGroupDetails';
import TeacherAssignmentPage from './pages/TeacherAssignmentPage';
import Branches from './pages/Branches';
import DaycareSettings from './pages/daycare/settings/DaycareSettings';
import FamilyProfile from './pages/family/FamilyProfile';
import FamilyGuardians from './pages/family/FamilyGuardians';
import FamilyActivate from './pages/family/FamilyActivate';
import FamilyForgotPassword from './pages/family/FamilyForgotPassword';
import FamilyResetPassword from './pages/family/FamilyResetPassword';
import FamilyChildren from './pages/family/FamilyChildren';
import FamilyDocuments from './pages/family/FamilyDocuments';
import FamilyConsentForms from './pages/family/FamilyConsentForms';
import ConsentForms from './pages/ConsentForms';
import FamilyAttendance from './pages/family/FamilyAttendance';
import FamilyDailyReports from './pages/family/FamilyDailyReports';
import FamilyDashboard from './pages/family/FamilyDashboard';
import FamilyBilling from './pages/family/FamilyBilling';
import RegistrationLanding from './pages/public/RegistrationLanding';
import RegistrationWizard from './pages/public/RegistrationWizard';
import Admissions from './pages/daycare/Admissions';
import Waitlist from './pages/daycare/Waitlist';
import EmployeeList from './pages/daycare/employees/EmployeeList';
import EmployeeCreate from './pages/daycare/employees/EmployeeCreate';
import EmployeeDetail from './pages/daycare/employees/EmployeeDetail';
import StaffDashboard from './pages/daycare/employees/StaffDashboard';
import StaffReports from './pages/daycare/employees/StaffReports';
import { CredentialComplianceDashboard } from './pages/daycare/credentials/CredentialComplianceDashboard';
import { CredentialReports } from './pages/daycare/credentials/CredentialReports';
import { EmployeeCredentialHistory } from './pages/daycare/employees/EmployeeCredentialHistory';
import { StaffScheduling } from './pages/daycare/scheduling/StaffScheduling';
import { OvertimeManagement } from './pages/daycare/scheduling/OvertimeManagement';
import { TimeBankDashboard } from './pages/daycare/scheduling/TimeBankDashboard';
import { ShiftSwapCenter } from './pages/daycare/scheduling/ShiftSwapCenter';
import { StaffMySchedule } from './pages/staff/StaffMySchedule';
import { StaffShiftSwaps } from './pages/staff/StaffShiftSwaps';
import { LeaveManagementDashboard } from './pages/daycare/scheduling/LeaveManagementDashboard';
import { LeaveRequestsTable } from './pages/daycare/scheduling/LeaveRequestsTable';
import { StaffShortageDashboard } from './pages/daycare/scheduling/StaffShortageDashboard';
import { StaffMyLeave } from './pages/staff/StaffMyLeave';
import StaffAttendanceDashboard from './pages/daycare/staff/StaffAttendanceDashboard';
import StaffTimesheets from './pages/daycare/staff/StaffTimesheets';
import StaffTimesheetApprovals from './pages/daycare/staff/StaffTimesheetApprovals';
import StaffOvertimeReport from './pages/daycare/staff/StaffOvertimeReport';
import MasterAttendanceDashboard from './pages/daycare/attendance/MasterAttendanceDashboard';
import DailyChildAttendanceReport from './pages/daycare/reports/DailyChildAttendanceReport';
import MonthlyChildAttendanceReport from './pages/daycare/reports/MonthlyChildAttendanceReport';
import StaffAttendanceReport from './pages/daycare/reports/StaffAttendanceReport';
import TimesheetReport from './pages/daycare/reports/TimesheetReport';
import AttendanceAuditReport from './pages/daycare/reports/AttendanceAuditReport';
import RatioMonitoringDashboard from './pages/daycare/RatioMonitoringDashboard';
import RatioComplianceHistoryPage from './pages/daycare/RatioComplianceHistoryPage';
import DaycareRatioRulesPage from './pages/daycare/DaycareRatioRulesPage';
import RatioReportsPage from './pages/daycare/reports/RatioReportsPage';
import SafeArrivalDashboard from './pages/daycare/pickups/SafeArrivalDashboard';
import ChildPickupHistory from './pages/daycare/pickups/ChildPickupHistory';
import SafeArrivalReports from './pages/daycare/pickups/SafeArrivalReports';
import DailyReportsHub from './pages/daycare/reports/DailyReportsHub';
import DailyReportsDashboard from './pages/daycare/reports/DailyReportsDashboard';
import DailyReportsHistory from './pages/daycare/reports/DailyReportsHistory';
import DailyChildReportDetail from './pages/daycare/reports/DailyChildReportDetail';
import ClassroomDailyReports from './pages/daycare/reports/ClassroomDailyReports';
import FamilyDailyReportDetail from './pages/family/FamilyDailyReportDetail';
import FamilyDailyReportHistory from './pages/family/FamilyDailyReportHistory';
import FeeStructuresPage from './pages/daycare/billing/FeeStructuresPage';
import DiscountsCreditsLateFeesPage from './pages/daycare/billing/DiscountsCreditsLateFeesPage';
import InvoicesListPage from './pages/daycare/billing/InvoicesListPage';
import InvoiceDetailPage from './pages/daycare/billing/InvoiceDetailPage';
import PaymentsReceiptsPage from './pages/daycare/billing/PaymentsReceiptsPage';
import SubsidiesPage from './pages/daycare/billing/SubsidiesPage';
import TaxReceiptsStatementsPage from './pages/daycare/billing/TaxReceiptsStatementsPage';
import ErrorBoundary from './components/ErrorBoundary';


const DaycareRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
            </div>
        );
    }
    if (!user) return <Navigate to="/login" replace />;
    if (user.is_superuser) return <Navigate to="/admin" replace />;
    if (user.role === 'Guardian') return <Navigate to="/family/dashboard" replace />;
    return <>{children}</>;
};

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
            </div>
        );
    }
    if (!user) return <Navigate to="/admin/login" replace />;
    if (!user.is_superuser) return <Navigate to="/daycare/dashboard" replace />;
    return <>{children}</>;
};

const GuardianRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
            </div>
        );
    }
    if (!user) return <Navigate to="/family/login" replace />;
    if (user.is_superuser) return <Navigate to="/admin" replace />;
    if (user.role !== 'Guardian') return <Navigate to="/daycare/dashboard" replace />;
    return <>{children}</>;
};

const DashboardRedirect = () => {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
            </div>
        );
    }
    if (!user) return <Navigate to="/login" replace />;
    if (user.is_superuser) return <Navigate to="/admin" replace />;
    if (user.role === 'Guardian') return <Navigate to="/family/dashboard" replace />;
    return <Navigate to="/daycare/dashboard" replace />;
};

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login type="daycare" />} />
            <Route path="/admin/login" element={<Login type="admin" />} />
            <Route path="/daycare/dashboard" element={<DaycareRoute><Dashboard /></DaycareRoute>} />
            <Route path="/dashboard" element={<DashboardRedirect />} />
            <Route path="/register/:daycareIdentifier" element={<RegistrationLanding />} />
            <Route path="/register/:daycareIdentifier/apply" element={<RegistrationWizard />} />
            <Route path="/family/dashboard" element={<GuardianRoute><FamilyDashboard /></GuardianRoute>} />
            <Route path="/family/profile" element={<GuardianRoute><FamilyProfile /></GuardianRoute>} />
            <Route path="/family/guardians" element={<GuardianRoute><FamilyGuardians /></GuardianRoute>} />
            <Route path="/family/children" element={<GuardianRoute><FamilyChildren /></GuardianRoute>} />
            <Route path="/family/attendance" element={<GuardianRoute><FamilyAttendance /></GuardianRoute>} />
            <Route path="/family/daily-reports" element={<GuardianRoute><FamilyDailyReports /></GuardianRoute>} />
            <Route path="/family/daily-reports/history" element={<GuardianRoute><FamilyDailyReportHistory /></GuardianRoute>} />
            <Route path="/family/daily-reports/:childId/:date" element={<GuardianRoute><FamilyDailyReportDetail /></GuardianRoute>} />
            <Route path="/family/billing" element={<GuardianRoute><FamilyBilling /></GuardianRoute>} />
            <Route path="/family/documents" element={<GuardianRoute><FamilyDocuments /></GuardianRoute>} />
            <Route path="/family/consents" element={<GuardianRoute><FamilyConsentForms /></GuardianRoute>} />
            <Route path="/family/login" element={<Login type="family" />} />
            <Route path="/family/activate" element={<FamilyActivate />} />
            <Route path="/family/forgot-password" element={<FamilyForgotPassword />} />
            <Route path="/family/reset-password" element={<FamilyResetPassword />} />
            <Route path="/classrooms" element={<DaycareRoute><ClassroomDashboard /></DaycareRoute>} />
            <Route path="/classrooms/:id/teachers" element={<DaycareRoute><TeacherAssignmentPage /></DaycareRoute>} />
            <Route path="/age-groups" element={<DaycareRoute><AgeGroupList /></DaycareRoute>} />
            <Route path="/age-groups/new" element={<DaycareRoute><AgeGroupForm /></DaycareRoute>} />
            <Route path="/age-groups/:id/edit" element={<DaycareRoute><AgeGroupForm /></DaycareRoute>} />
            <Route path="/age-groups/:id" element={<DaycareRoute><AgeGroupDetails /></DaycareRoute>} />
            <Route path="/staff" element={<DaycareRoute><StaffList /></DaycareRoute>} />
            <Route path="/daycare/employees/dashboard" element={<DaycareRoute><StaffDashboard /></DaycareRoute>} />
            <Route path="/daycare/employees/reports" element={<DaycareRoute><StaffReports /></DaycareRoute>} />
            <Route path="/daycare/credentials/dashboard" element={<DaycareRoute><CredentialComplianceDashboard /></DaycareRoute>} />
            <Route path="/daycare/credentials/expiring" element={<DaycareRoute><CredentialComplianceDashboard /></DaycareRoute>} />
            <Route path="/daycare/credentials/reports" element={<DaycareRoute><CredentialReports /></DaycareRoute>} />
            <Route path="/daycare/scheduling" element={<DaycareRoute><StaffScheduling /></DaycareRoute>} />
            <Route path="/daycare/scheduling/overtime" element={<DaycareRoute><OvertimeManagement /></DaycareRoute>} />
            <Route path="/daycare/scheduling/time-bank" element={<DaycareRoute><TimeBankDashboard /></DaycareRoute>} />
            <Route path="/daycare/scheduling/swaps" element={<DaycareRoute><ShiftSwapCenter /></DaycareRoute>} />
            <Route path="/daycare/scheduling/shortages" element={<DaycareRoute><StaffShortageDashboard /></DaycareRoute>} />
            <Route path="/daycare/leave" element={<DaycareRoute><LeaveManagementDashboard /></DaycareRoute>} />
            <Route path="/daycare/leave/requests" element={<DaycareRoute><LeaveRequestsTable /></DaycareRoute>} />
            <Route path="/staff/schedule" element={<DaycareRoute><StaffMySchedule /></DaycareRoute>} />
            <Route path="/staff/shift-swaps" element={<DaycareRoute><StaffShiftSwaps /></DaycareRoute>} />
            <Route path="/staff/leave" element={<DaycareRoute><StaffMyLeave /></DaycareRoute>} />

            <Route path="/daycare/employees/:id/credential-history" element={<DaycareRoute><EmployeeCredentialHistory /></DaycareRoute>} />


            <Route path="/daycare/employees" element={<DaycareRoute><EmployeeList /></DaycareRoute>} />


            <Route path="/daycare/employees/new" element={<DaycareRoute><EmployeeCreate /></DaycareRoute>} />
            <Route path="/daycare/employees/:id" element={<DaycareRoute><EmployeeDetail /></DaycareRoute>} />
            <Route path="/students" element={<DaycareRoute><StudentList /></DaycareRoute>} />
            <Route path="/students/new" element={<DaycareRoute><StudentForm /></DaycareRoute>} />
            <Route path="/daycare/admissions" element={<DaycareRoute><Admissions /></DaycareRoute>} />
            <Route path="/daycare/waitlist" element={<DaycareRoute><Waitlist /></DaycareRoute>} />
            <Route path="/daycare/children" element={<DaycareRoute><ChildList /></DaycareRoute>} />
            <Route path="/daycare/children/new" element={<DaycareRoute><ChildAdmission /></DaycareRoute>} />
            <Route path="/daycare/classrooms" element={<DaycareRoute><ClassroomList /></DaycareRoute>} />
            <Route path="/daycare/classrooms/new" element={<DaycareRoute><ClassroomForm /></DaycareRoute>} />
            <Route path="/daycare/classrooms/:id/edit" element={<DaycareRoute><ClassroomForm /></DaycareRoute>} />
            <Route path="/daycare/classrooms/:id" element={<DaycareRoute><ClassroomDetailLayout /></DaycareRoute>}>
                <Route index element={<ClassroomOverview />} />
                <Route path="teachers" element={<ClassroomTeachers />} />
                <Route path="students" element={<ClassroomStudentsTab />} />
                <Route path="schedule" element={<ClassroomScheduleTab />} />
                <Route path="occupancy" element={<ClassroomOccupancyTab />} />
                <Route path="ratio" element={<ClassroomRatioTab />} />
                <Route path="history" element={<ClassroomHistoryTab />} />
                <Route path="reports" element={<ClassroomReportsTab />} />
            </Route>


            <Route path="/daycare/safe-arrival" element={<DaycareRoute><SafeArrivalDashboard /></DaycareRoute>} />
            <Route path="/daycare/safe-arrival/reports" element={<DaycareRoute><SafeArrivalReports /></DaycareRoute>} />
            <Route path="/daycare/children/:id/pickup-history" element={<DaycareRoute><ChildPickupHistory /></DaycareRoute>} />
            <Route path="/daycare/children/:id" element={<DaycareRoute><ChildProfileLayout /></DaycareRoute>}>
                <Route index element={<ChildOverview />} />
                <Route path="attendance" element={<ChildAttendance />} />
                <Route path="personal" element={<ChildPersonal />} />
                <Route path="enrollment" element={<ChildEnrollment />} />
                <Route path="classroom" element={<ChildClassroom />} />
                <Route path="medical" element={<ChildMedical />} />
                <Route path="emergency" element={<ChildEmergency />} />
                <Route path="pickup" element={<ChildPickup />} />
                <Route path="pickup-authorizations" element={<ChildPickup />} />
                <Route path="pickup-history" element={<ChildPickupHistory />} />
                <Route path="documents" element={<ChildDocuments />} />
                <Route path="vaccinations" element={<ChildVaccinations />} />
                <Route path="notes" element={<ChildNotes />} />
                <Route path="history" element={<ChildHistory />} />
            </Route>
            <Route path="/daycare/pickup-verification" element={<DaycareRoute><PickupVerificationPage /></DaycareRoute>} />

            <Route path="/students/:id" element={<DaycareRoute><StudentProfileLayout /></DaycareRoute>}>
                <Route index element={<StudentOverview />} />
                <Route path="medical" element={<StudentMedical />} />
                <Route path="contacts" element={<StudentContacts />} />
                <Route path="documents" element={<StudentDocuments />} />
                <Route path="enrollment" element={<StudentEnrollment />} />
                <Route path="notes" element={<StudentNotes />} />
            </Route>
            <Route path="/daycare/attendance/dashboard" element={<DaycareRoute><MasterAttendanceDashboard /></DaycareRoute>} />
            <Route path="/daycare/reports/attendance/daily" element={<DaycareRoute><DailyChildAttendanceReport /></DaycareRoute>} />
            <Route path="/daycare/reports/attendance/monthly" element={<DaycareRoute><MonthlyChildAttendanceReport /></DaycareRoute>} />
            <Route path="/daycare/reports/staff-attendance" element={<DaycareRoute><StaffAttendanceReport /></DaycareRoute>} />
            <Route path="/daycare/reports/attendance/staff" element={<DaycareRoute><StaffAttendanceReport /></DaycareRoute>} />
            <Route path="/daycare/reports/timesheets" element={<DaycareRoute><TimesheetReport /></DaycareRoute>} />
            <Route path="/daycare/reports/attendance-audit" element={<DaycareRoute><AttendanceAuditReport /></DaycareRoute>} />
            <Route path="/daycare/reports/attendance/audit" element={<DaycareRoute><AttendanceAuditReport /></DaycareRoute>} />
            <Route path="/daycare/credentials/reports" element={<DaycareRoute><CredentialReports /></DaycareRoute>} />
            <Route path="/daycare/credentials/dashboard" element={<DaycareRoute><CredentialComplianceDashboard /></DaycareRoute>} />
            <Route path="/daycare/credentials" element={<DaycareRoute><CredentialComplianceDashboard /></DaycareRoute>} />
            <Route path="/daycare/attendance" element={<DaycareRoute><DailyAttendance /></DaycareRoute>} />
            <Route path="/daycare/attendance/monthly" element={<DaycareRoute><MonthlyAttendance /></DaycareRoute>} />
            <Route path="/daycare/ratio-monitoring" element={<DaycareRoute><RatioMonitoringDashboard /></DaycareRoute>} />
            <Route path="/daycare/ratio-monitoring/dashboard" element={<DaycareRoute><RatioMonitoringDashboard /></DaycareRoute>} />
            <Route path="/daycare/ratio-monitoring/reports" element={<DaycareRoute><RatioReportsPage /></DaycareRoute>} />
            <Route path="/daycare/ratio-monitoring/history" element={<DaycareRoute><RatioComplianceHistoryPage /></DaycareRoute>} />
            <Route path="/daycare/ratio-rules" element={<DaycareRoute><DaycareRatioRulesPage /></DaycareRoute>} />
            <Route path="/daycare/staff/attendance" element={<DaycareRoute><StaffAttendanceDashboard /></DaycareRoute>} />
            <Route path="/daycare/staff/timesheets" element={<DaycareRoute><StaffTimesheets /></DaycareRoute>} />
            <Route path="/daycare/staff/timesheets/approvals" element={<DaycareRoute><StaffTimesheetApprovals /></DaycareRoute>} />
            <Route path="/daycare/staff/reports/overtime" element={<DaycareRoute><StaffOvertimeReport /></DaycareRoute>} />
            <Route path="/staff/attendance" element={<DaycareRoute><StaffAttendanceDashboard /></DaycareRoute>} />
            <Route path="/staff/timesheets" element={<DaycareRoute><StaffTimesheets /></DaycareRoute>} />
            <Route path="/staff/timesheets/approvals" element={<DaycareRoute><StaffTimesheetApprovals /></DaycareRoute>} />
            <Route path="/staff/reports/overtime" element={<DaycareRoute><StaffOvertimeReport /></DaycareRoute>} />
            <Route path="/attendance" element={<DaycareRoute><DailyAttendance /></DaycareRoute>} />
            <Route path="/attendance/monthly" element={<DaycareRoute><MonthlyAttendance /></DaycareRoute>} />
            <Route path="/daycare/daily-reports" element={<DaycareRoute><DailyReportsHub /></DaycareRoute>} />
            <Route path="/daycare/daily-reports/dashboard" element={<DaycareRoute><DailyReportsDashboard /></DaycareRoute>} />
            <Route path="/daycare/daily-reports/history" element={<DaycareRoute><DailyReportsHistory /></DaycareRoute>} />
            <Route path="/daycare/daily-reports/:childId/:date" element={<DaycareRoute><DailyChildReportDetail /></DaycareRoute>} />
            <Route path="/daycare/classrooms/:classroomId/daily-reports" element={<DaycareRoute><ClassroomDailyReports /></DaycareRoute>} />
            
            {/* Aliases for underscore URL paths */}
            <Route path="/daycare/daily_reports" element={<Navigate to="/daycare/daily-reports" replace />} />
            <Route path="/daycare/daily_reports/dashboard" element={<Navigate to="/daycare/daily-reports/dashboard" replace />} />
            <Route path="/daycare/daily_reports/history" element={<Navigate to="/daycare/daily-reports/history" replace />} />
            <Route path="/activities" element={<Navigate to="/daycare/daily-reports" replace />} />
            <Route path="/billing" element={<Navigate to="/daycare/billing/invoices" replace />} />
            <Route path="/daycare/subscription" element={<DaycareRoute><BillingDashboard /></DaycareRoute>} />
            <Route path="/daycare/billing/fee-structures" element={<DaycareRoute><FeeStructuresPage /></DaycareRoute>} />
            <Route path="/daycare/billing/discounts-credits" element={<DaycareRoute><DiscountsCreditsLateFeesPage /></DaycareRoute>} />
            <Route path="/daycare/billing/invoices" element={<DaycareRoute><InvoicesListPage /></DaycareRoute>} />
            <Route path="/daycare/billing/invoices/:id" element={<DaycareRoute><InvoiceDetailPage /></DaycareRoute>} />
            <Route path="/daycare/billing/payments" element={<DaycareRoute><PaymentsReceiptsPage /></DaycareRoute>} />
            <Route path="/daycare/billing/subsidies" element={<DaycareRoute><SubsidiesPage /></DaycareRoute>} />
            <Route path="/daycare/billing/tax-receipts" element={<DaycareRoute><TaxReceiptsStatementsPage /></DaycareRoute>} />
            <Route path="/daycare/billing/statements" element={<Navigate to="/daycare/billing/tax-receipts" replace />} />
            <Route path="/communication" element={<DaycareRoute><CommunicationDashboard /></DaycareRoute>} />
            <Route path="/daycare/profile" element={<DaycareRoute><UserProfile /></DaycareRoute>} />
            <Route path="/settings" element={<DaycareRoute><DaycareSettings /></DaycareRoute>} />
            <Route path="/daycare/holidays" element={<DaycareRoute><DaycareHolidays /></DaycareRoute>} />
            <Route path="/daycare/emergency-information" element={<DaycareRoute><DaycareEmergencyInfo /></DaycareRoute>} />
            <Route path="/profile" element={<Navigate to="/daycare/profile" replace />} />
            <Route path="/documents" element={<DaycareRoute><DocumentManager /></DaycareRoute>} />
            <Route path="/daycare/consent-forms" element={<DaycareRoute><ConsentForms /></DaycareRoute>} />
            <Route path="/health" element={<DaycareRoute><HealthDashboard /></DaycareRoute>} />
            <Route path="/daycare/health" element={<Navigate to="/health" replace />} />
            <Route path="/compliance" element={<DaycareRoute><ComplianceDashboard /></DaycareRoute>} />
            <Route path="/programs" element={<DaycareRoute><ProgramsDashboard /></DaycareRoute>} />
            <Route path="/admin" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
            <Route path="/branches" element={<DaycareRoute><Branches /></DaycareRoute>} />
            <Route path="*" element={<Navigate to="/daycare/dashboard" replace />} />
        </Routes>
    );
}

const queryClient = new QueryClient();

function App() {
    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <BrowserRouter>
                        <AppRoutes />
                    </BrowserRouter>
                </AuthProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    );
}

export default App;
