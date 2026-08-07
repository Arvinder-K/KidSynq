import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StaffList from './pages/StaffList';
import StudentList from './pages/StudentList';
import StudentForm from './pages/StudentForm';
import DocumentManager from './pages/DocumentManager';
import ComplianceDashboard from './pages/ComplianceDashboard';
import ProgramsDashboard from './pages/ProgramsDashboard';
import AttendanceTracker from './pages/AttendanceTracker';
import DailyActivities from './pages/DailyActivities';
import HealthDashboard from './pages/HealthDashboard';
import BillingDashboard from './pages/BillingDashboard';
import CommunicationDashboard from './pages/CommunicationDashboard';
import UserProfile from './pages/UserProfile';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import ClassroomDashboard from './pages/ClassroomDashboard';
import AgeGroupList from './pages/AgeGroupList';
import AgeGroupForm from './pages/AgeGroupForm';
import AgeGroupDetails from './pages/AgeGroupDetails';
import TeacherAssignmentPage from './pages/TeacherAssignmentPage';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <div>Loading...</div>;
    return user ? <>{children}</> : <Navigate to="/login" />;
};

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();
    if (loading) return <div>Loading...</div>;
    if (!user) return <Navigate to="/admin/login" />;
    if (!user.is_superuser) return <Navigate to="/dashboard" />;
    return <>{children}</>;
};

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login type="daycare" />} />
            <Route path="/admin/login" element={<Login type="admin" />} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/classrooms" element={<PrivateRoute><ClassroomDashboard /></PrivateRoute>} />
            <Route path="/classrooms/:id/teachers" element={<PrivateRoute><TeacherAssignmentPage /></PrivateRoute>} />
            <Route path="/age-groups" element={<PrivateRoute><AgeGroupList /></PrivateRoute>} />
            <Route path="/age-groups/new" element={<PrivateRoute><AgeGroupForm /></PrivateRoute>} />
            <Route path="/age-groups/:id/edit" element={<PrivateRoute><AgeGroupForm /></PrivateRoute>} />
            <Route path="/age-groups/:id" element={<PrivateRoute><AgeGroupDetails /></PrivateRoute>} />
            <Route path="/staff" element={<PrivateRoute><StaffList /></PrivateRoute>} />
            <Route path="/students" element={<PrivateRoute><StudentList /></PrivateRoute>} />
            <Route path="/students/new" element={<PrivateRoute><StudentForm /></PrivateRoute>} />
            <Route path="/attendance" element={<PrivateRoute><AttendanceTracker /></PrivateRoute>} />
            <Route path="/activities" element={<PrivateRoute><DailyActivities /></PrivateRoute>} />
            <Route path="/health" element={<PrivateRoute><HealthDashboard /></PrivateRoute>} />
            <Route path="/billing" element={<PrivateRoute><BillingDashboard /></PrivateRoute>} />
            <Route path="/communication" element={<PrivateRoute><CommunicationDashboard /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
            <Route path="/documents" element={<PrivateRoute><DocumentManager /></PrivateRoute>} />
            <Route path="/compliance" element={<PrivateRoute><ComplianceDashboard /></PrivateRoute>} />
            <Route path="/programs" element={<PrivateRoute><ProgramsDashboard /></PrivateRoute>} />
            <Route path="/admin" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}

const queryClient = new QueryClient();

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <BrowserRouter>
                    <AppRoutes />
                </BrowserRouter>
            </AuthProvider>
        </QueryClientProvider>
    );
}

export default App;
