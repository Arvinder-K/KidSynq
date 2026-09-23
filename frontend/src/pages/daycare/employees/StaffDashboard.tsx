import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Users, UserCheck, AlertTriangle, ShieldAlert,
    School, ArrowRight, BarChart3, TrendingUp, AlertCircle,
    RefreshCw, UserPlus, CheckCircle2, ChevronRight
} from 'lucide-react';
import Layout from '../../../components/Layout';
import { employeeService, type StaffDashboardData } from '../../../api/employeeService';

const StaffDashboard: React.FC = () => {

    const [data, setData] = useState<StaffDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setError(null);
            const res = await employeeService.getStaffDashboard();
            setData(res);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to load staff dashboard data.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </Layout>
        );
    }

    const metrics = data?.metrics || {
        total_employees: 0,
        active_employees: 0,
        on_leave_employees: 0,
        suspended_employees: 0,
        terminated_employees: 0,
        teachers: 0,
        eces: 0,
        assistants: 0,
        certifications_expiring: 0,
        documents_expiring: 0,
        unassigned_teaching_staff_count: 0
    };

    return (
        <Layout>
            <div className="space-y-6 max-w-7xl mx-auto font-sans">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm mb-1">
                            <Users className="w-4 h-4" /> Staff & Employee Management
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Staff Dashboard</h1>
                        <p className="text-slate-500 text-sm mt-1">Real-time overview of staffing levels, classroom coverage, compliance, and alerts.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                            title="Refresh Dashboard"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <Link
                            to="/daycare/employees/reports"
                            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2"
                        >
                            <BarChart3 className="w-4 h-4 text-indigo-600" /> Staff Reports
                        </Link>
                        <Link
                            to="/daycare/employees"
                            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2"
                        >
                            <Users className="w-4 h-4 text-slate-500" /> Employee Directory
                        </Link>
                        <Link
                            to="/daycare/employees/new"
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2"
                        >
                            <UserPlus className="w-4 h-4" /> Add Employee
                        </Link>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-medium flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Primary Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Total Staff */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Workforce</span>
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                <Users className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="text-3xl font-extrabold text-slate-900 mb-2">{metrics.total_employees}</div>
                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                                {metrics.active_employees} Active
                            </span>
                            {metrics.on_leave_employees > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                                    {metrics.on_leave_employees} On Leave
                                </span>
                            )}
                            {metrics.suspended_employees > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">
                                    {metrics.suspended_employees} Suspended
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Teaching Staff Breakdown */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Teaching Staff</span>
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                                <School className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="text-3xl font-extrabold text-slate-900 mb-2">
                            {metrics.teachers + metrics.eces + metrics.assistants}
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-xs text-slate-600">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium">{metrics.teachers} Teachers</span>
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium">{metrics.eces} ECE</span>
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium">{metrics.assistants} Assistants</span>
                        </div>
                    </div>

                    {/* Compliance & Expiries */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Compliance & Expiries</span>
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                                <ShieldAlert className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="text-3xl font-extrabold text-slate-900 mb-2">
                            {metrics.certifications_expiring + metrics.documents_expiring}
                        </div>
                        <div className="flex gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                                {metrics.certifications_expiring} Certs Expiring
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                                {metrics.documents_expiring} Docs Expiring
                            </span>
                        </div>
                    </div>

                    {/* Unassigned Teaching Staff */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Unassigned Staff</span>
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                                <UserCheck className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="text-3xl font-extrabold text-slate-900 mb-2">
                            {metrics.unassigned_teaching_staff_count}
                        </div>
                        <p className="text-xs text-slate-500">
                            {metrics.unassigned_teaching_staff_count === 0
                                ? 'All active teachers are assigned.'
                                : 'Eligible teachers without classroom assignment.'}
                        </p>
                    </div>
                </div>

                {/* Distributions & Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Staff by Employee Type */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-indigo-600" /> Staff by Role / Type
                            </h2>
                            <span className="text-xs font-medium text-slate-400">
                                {data?.staff_by_type?.length || 0} Categories
                            </span>
                        </div>

                        {data?.staff_by_type && data.staff_by_type.length > 0 ? (
                            <div className="space-y-3 pt-2">
                                {data.staff_by_type.map((typeItem) => {
                                    const percentage = metrics.total_employees > 0
                                        ? Math.round((typeItem.count / metrics.total_employees) * 100)
                                        : 0;
                                    return (
                                        <div key={typeItem.name} className="space-y-1.5">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-semibold text-slate-700">{typeItem.name}</span>
                                                <span className="text-slate-500 font-medium">
                                                    {typeItem.count} ({percentage}%)
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                                                    style={{ width: `${percentage}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                No employee type breakdown available.
                            </div>
                        )}
                    </div>

                    {/* Staff by Status */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Workforce Status Distribution
                            </h2>
                            <span className="text-xs font-medium text-slate-400">Current Status</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            {data?.staff_by_status?.map((item) => (
                                <div key={item.status} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                                        {item.status}
                                    </span>
                                    <span className="text-2xl font-bold text-slate-900">{item.count}</span>
                                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                                        <div
                                            className="h-1.5 rounded-full"
                                            style={{
                                                backgroundColor: item.color || '#6366F1',
                                                width: `${metrics.total_employees > 0 ? (item.count / metrics.total_employees) * 100 : 0}%`
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Alerts Section */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-500" /> Actionable Staff Alerts & Compliance
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">Certifications expiring, missing credentials, and room ratio risks.</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            {data?.alerts?.length || 0} Alerts
                        </span>
                    </div>

                    {data?.alerts && data.alerts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                            {data.alerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                                        alert.severity === 'danger'
                                            ? 'bg-red-50/60 border-red-200 text-red-900'
                                            : alert.severity === 'warning'
                                            ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                                            : 'bg-blue-50/60 border-blue-200 text-blue-900'
                                    }`}
                                >
                                    <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                        alert.severity === 'danger' ? 'text-red-600' :
                                        alert.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'
                                    }`} />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-sm leading-snug">{alert.title}</h4>
                                        <p className="text-xs opacity-90 mt-0.5">{alert.description}</p>
                                        {alert.employee_id && (
                                            <Link
                                                to={`/daycare/employees/${alert.employee_id}`}
                                                className="inline-flex items-center gap-1 text-xs font-bold mt-2 hover:underline"
                                            >
                                                View Staff Profile <ChevronRight className="w-3 h-3" />
                                            </Link>
                                        )}
                                        {alert.classroom_id && (
                                            <Link
                                                to={`/classrooms/${alert.classroom_id}/teachers`}
                                                className="inline-flex items-center gap-1 text-xs font-bold mt-2 hover:underline text-indigo-700"
                                            >
                                                Assign Teachers to Room <ChevronRight className="w-3 h-3" />
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-slate-500">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                            <h4 className="font-semibold text-slate-800">All Clear</h4>
                            <p className="text-xs text-slate-400 mt-0.5">No immediate staff compliance or classroom ratio alerts.</p>
                        </div>
                    )}
                </div>

                {/* Unassigned Teaching Staff Section */}
                {data?.unassigned_teaching_staff && data.unassigned_teaching_staff.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <UserCheck className="w-5 h-5 text-indigo-600" /> Unassigned Teaching Staff
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">Active teachers and educators ready for classroom assignment.</p>
                            </div>
                            <Link
                                to="/classrooms"
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                            >
                                Manage Classrooms <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3">Employee</th>
                                        <th className="px-4 py-3">Employee Number</th>
                                        <th className="px-4 py-3">Role</th>
                                        <th className="px-4 py-3">Start Date</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.unassigned_teaching_staff.map((staff) => (
                                        <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3.5 font-bold text-slate-900">{staff.name}</td>
                                            <td className="px-4 py-3.5 text-slate-500">{staff.employee_number}</td>
                                            <td className="px-4 py-3.5">
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                                                    {staff.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-slate-500">{staff.start_date || 'N/A'}</td>
                                            <td className="px-4 py-3.5 text-right">
                                                <Link
                                                    to={`/daycare/employees/${staff.id}`}
                                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                                                >
                                                    View Profile
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default StaffDashboard;
