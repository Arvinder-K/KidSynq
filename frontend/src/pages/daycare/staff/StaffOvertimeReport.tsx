import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
    TrendingUp, Calendar, Filter, Search, 
    Download, RefreshCw, User, Award, 
    Clock, CheckCircle2, ChevronRight, FileSpreadsheet,
    Layers, ArrowDownRight, ArrowUpRight
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';
import { useNavigate } from 'react-router-dom';

interface OvertimeSummary {
    total_shifts: number;
    total_regular_hours: number;
    total_overtime_hours: number;
    total_worked_hours: number;
    approved_overtime_hours: number;
    pending_overtime_hours: number;
    shifts_with_overtime: number;
    threshold_applied: number;
}

interface EmployeeOvertimeSummary {
    employee_id: string;
    employee_name: string;
    employee_role: string;
    employee_photo: string | null;
    total_shifts: number;
    regular_hours: number;
    overtime_hours: number;
    total_hours: number;
    shifts_with_overtime: number;
}

interface DailyOvertimeLog {
    id: string;
    employee_id: string;
    employee_name: string;
    date: string;
    classroom_name: string | null;
    scheduled_hours: number;
    actual_hours: number;
    regular_hours: number;
    overtime_hours: number;
    total_break_minutes: number;
    status: string;
    approval_status: string;
    submitted_at: string | null;
    approved_by_name: string | null;
}

const StaffOvertimeReport: React.FC = () => {
    const navigate = useNavigate();

    // Filters
    const [preset, setPreset] = useState<'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'>('this_month');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
    const [selectedApproval, setSelectedApproval] = useState<string>('all');
    const [threshold, setThreshold] = useState<number>(8.0);
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Data State
    const [loading, setLoading] = useState<boolean>(true);
    const [summary, setSummary] = useState<OvertimeSummary | null>(null);
    const [employeesList, setEmployeesList] = useState<EmployeeOvertimeSummary[]>([]);
    const [dailyLogs, setDailyLogs] = useState<DailyOvertimeLog[]>([]);
    const [allEmployees, setAllEmployees] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
    const [classrooms, setClassrooms] = useState<{ id: string; room_name: string }[]>([]);
    const [activeTab, setActiveTab] = useState<'employees' | 'daily'>('employees');

    // Date Range Presets
    useEffect(() => {
        const now = new Date();
        if (preset === 'this_week') {
            const currentDay = now.getDay();
            const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
            const monday = new Date(now);
            monday.setDate(now.getDate() + diffToMonday);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            setStartDate(monday.toISOString().split('T')[0]);
            setEndDate(sunday.toISOString().split('T')[0]);
        } else if (preset === 'last_week') {
            const currentDay = now.getDay();
            const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay - 7;
            const monday = new Date(now);
            monday.setDate(now.getDate() + diffToMonday);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            setStartDate(monday.toISOString().split('T')[0]);
            setEndDate(sunday.toISOString().split('T')[0]);
        } else if (preset === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            setStartDate(firstDay.toISOString().split('T')[0]);
            setEndDate(lastDay.toISOString().split('T')[0]);
        } else if (preset === 'last_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
            setStartDate(firstDay.toISOString().split('T')[0]);
            setEndDate(lastDay.toISOString().split('T')[0]);
        }
    }, [preset]);

    // Fetch Filter Dropdowns
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [empRes, classRes] = await Promise.all([
                    api.get('/daycare/employees/'),
                    api.get('/classrooms/')
                ]);
                setAllEmployees(Array.isArray(empRes.data) ? empRes.data : (empRes.data.results || []));
                setClassrooms(Array.isArray(classRes.data) ? classRes.data : (classRes.data.results || []));
            } catch (err) {
                console.error("Filter loading error:", err);
            }
        };
        fetchFilters();
    }, []);

    // Fetch Overtime Report Data
    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await api.get('/daycare/staff/attendance/overtime/report/', {
                params: {
                    start_date: startDate || undefined,
                    end_date: endDate || undefined,
                    employee_id: selectedEmployee !== 'all' ? selectedEmployee : undefined,
                    classroom_id: selectedClassroom !== 'all' ? selectedClassroom : undefined,
                    approval_status: selectedApproval !== 'all' ? selectedApproval : undefined,
                    threshold: threshold
                }
            });
            setSummary(res.data.summary);
            setEmployeesList(res.data.employees || []);
            setDailyLogs(res.data.daily_logs || []);
        } catch (err) {
            console.error("Failed to load overtime report:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (startDate && endDate) {
            fetchReport();
        }
    }, [startDate, endDate, selectedEmployee, selectedClassroom, selectedApproval, threshold]);

    // CSV Export
    const exportToCSV = () => {
        if (!dailyLogs.length) return;
        const headers = ["Employee", "Date", "Classroom", "Scheduled (h)", "Actual (h)", "Regular (h)", "Overtime (h)", "Breaks (mins)", "Approval Status"];
        const rows = dailyLogs.map(l => [
            `"${l.employee_name}"`,
            l.date,
            `"${l.classroom_name || 'N/A'}"`,
            l.scheduled_hours,
            l.actual_hours,
            l.regular_hours,
            l.overtime_hours,
            l.total_break_minutes,
            l.approval_status
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `overtime_report_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredEmployees = useMemo(() => {
        return employeesList.filter(e => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return e.employee_name.toLowerCase().includes(q) || e.employee_role?.toLowerCase().includes(q);
        });
    }, [employeesList, searchQuery]);

    return (
        <Layout>
            <div className="space-y-6 pb-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Staff Overtime & Working Hours Report
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Track actual working hours, overtime distribution, threshold compliance, and time banking exports.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={exportToCSV}
                            disabled={loading || !dailyLogs.length}
                            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs flex items-center gap-2 transition disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            Export to CSV
                        </button>
                        <button
                            onClick={fetchReport}
                            disabled={loading}
                            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Summary Metrics */}
                {summary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Regular Hours</p>
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600">
                                    <Clock className="w-4 h-4" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{summary.total_regular_hours} hrs</h3>
                            <p className="text-xs text-slate-500 mt-1">Across {summary.total_shifts} shifts</p>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Overtime</p>
                                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600">
                                    <Award className="w-4 h-4" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">+{summary.total_overtime_hours} hrs</h3>
                            <p className="text-xs text-slate-500 mt-1">{summary.shifts_with_overtime} shift(s) with OT</p>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Approved OT</p>
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{summary.approved_overtime_hours} hrs</h3>
                            <p className="text-xs text-slate-500 mt-1">{summary.pending_overtime_hours} hrs pending review</p>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Hours Worked</p>
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600">
                                    <TrendingUp className="w-4 h-4" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">{summary.total_worked_hours} hrs</h3>
                            <p className="text-xs text-slate-500 mt-1">Threshold applied: {summary.threshold_applied}h/day</p>
                        </div>
                    </div>
                )}

                {/* Filter Controls */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
                        {[
                            { id: 'this_week', label: 'This Week' },
                            { id: 'last_week', label: 'Last Week' },
                            { id: 'this_month', label: 'This Month' },
                            { id: 'last_month', label: 'Last Month' },
                            { id: 'custom', label: 'Custom Range' }
                        ].map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPreset(p.id as any)}
                                className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                                    preset === p.id
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                        {preset === 'custom' && (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Employee</label>
                            <select
                                value={selectedEmployee}
                                onChange={e => setSelectedEmployee(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">All Employees</option>
                                {allEmployees.map(e => (
                                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Classroom</label>
                            <select
                                value={selectedClassroom}
                                onChange={e => setSelectedClassroom(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">All Classrooms</option>
                                {classrooms.map(c => (
                                    <option key={c.id} value={c.id}>{c.room_name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Daily OT Threshold (h)</label>
                            <input
                                type="number"
                                step="0.5"
                                value={threshold}
                                onChange={e => setThreshold(parseFloat(e.target.value) || 8.0)}
                                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Approval Status</label>
                            <select
                                value={selectedApproval}
                                onChange={e => setSelectedApproval(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">All Statuses</option>
                                <option value="APPROVED">Approved Only</option>
                                <option value="SUBMITTED">Submitted Only</option>
                                <option value="CORRECTION_REQUIRED">Correction Required</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* View Switcher Tabs */}
                <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <button
                        onClick={() => setActiveTab('employees')}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                            activeTab === 'employees'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <User className="w-4 h-4" />
                        Summary by Staff ({employeesList.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('daily')}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                            activeTab === 'daily'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <Calendar className="w-4 h-4" />
                        Detailed Shift Logs ({dailyLogs.length})
                    </button>
                </div>

                {/* Content: Employees Aggregation */}
                {activeTab === 'employees' && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                        <th className="p-4">Staff Member</th>
                                        <th className="p-4 text-center">Total Shifts</th>
                                        <th className="p-4">Regular Hours</th>
                                        <th className="p-4">Overtime Hours</th>
                                        <th className="p-4">Total Hours</th>
                                        <th className="p-4">Hours Distribution</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-slate-500">
                                                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                                                Loading report data...
                                            </td>
                                        </tr>
                                    ) : filteredEmployees.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-slate-500">
                                                No overtime recorded in selected period.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEmployees.map(emp => {
                                            const regularPct = emp.total_hours > 0 ? (emp.regular_hours / emp.total_hours) * 100 : 0;
                                            const otPct = emp.total_hours > 0 ? (emp.overtime_hours / emp.total_hours) * 100 : 0;

                                            return (
                                                <tr key={emp.employee_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                                    <td className="p-4">
                                                        <div className="flex items-center space-x-3">
                                                            {emp.employee_photo ? (
                                                                <img src={emp.employee_photo} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                                                    {emp.employee_name?.charAt(0)}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="font-semibold text-slate-900 dark:text-slate-100">{emp.employee_name}</p>
                                                                <p className="text-[11px] text-slate-500">{emp.employee_role}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center font-medium text-slate-700 dark:text-slate-300">
                                                        {emp.total_shifts}
                                                    </td>
                                                    <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                                                        {emp.regular_hours} hrs
                                                    </td>
                                                    <td className="p-4">
                                                        {emp.overtime_hours > 0 ? (
                                                            <span className="font-bold text-amber-600 dark:text-amber-400">
                                                                +{emp.overtime_hours} hrs
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">0.00 hrs</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 font-bold text-slate-900 dark:text-slate-100">
                                                        {emp.total_hours} hrs
                                                    </td>
                                                    <td className="p-4 w-48">
                                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 flex overflow-hidden">
                                                            <div style={{ width: `${regularPct}%` }} className="bg-indigo-500" title={`Regular: ${emp.regular_hours}h`} />
                                                            <div style={{ width: `${otPct}%` }} className="bg-amber-500" title={`Overtime: ${emp.overtime_hours}h`} />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Content: Detailed Daily Logs */}
                {activeTab === 'daily' && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                        <th className="p-4">Employee</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Classroom</th>
                                        <th className="p-4">Actual Hours</th>
                                        <th className="p-4">Regular Hours</th>
                                        <th className="p-4">Overtime Hours</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Verified By</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8} className="p-12 text-center text-slate-500">
                                                Loading shift logs...
                                            </td>
                                        </tr>
                                    ) : dailyLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-12 text-center text-slate-500">
                                                No daily logs found.
                                            </td>
                                        </tr>
                                    ) : (
                                        dailyLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                                <td className="p-4 font-semibold text-slate-900 dark:text-slate-100">{log.employee_name}</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-300">{log.date}</td>
                                                <td className="p-4 text-slate-500">{log.classroom_name || 'General Area'}</td>
                                                <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{log.actual_hours} hrs</td>
                                                <td className="p-4 text-slate-700 dark:text-slate-300">{log.regular_hours} hrs</td>
                                                <td className="p-4">
                                                    {log.overtime_hours > 0 ? (
                                                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                                            +{log.overtime_hours} hrs OT
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">0.00</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                        log.approval_status === 'APPROVED'
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                    }`}>
                                                        {log.approval_status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-slate-500">{log.approved_by_name || 'Pending Review'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default StaffOvertimeReport;
