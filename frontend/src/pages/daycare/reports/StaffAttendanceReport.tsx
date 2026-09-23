import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
    Calendar, Download, RefreshCw, Search, 
    Filter, ArrowLeft, Printer, User, Clock, 
    Award, AlertTriangle, AlertCircle, CheckCircle2
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';
import { useNavigate } from 'react-router-dom';

interface EmployeeSummary {
    employee_id: string;
    employee_name: string;
    employee_role: string;
    employee_photo: string | null;
    total_shifts: number;
    scheduled_hours: number;
    actual_hours: number;
    break_hours: number;
    regular_hours: number;
    overtime_hours: number;
    late_arrivals: number;
    early_departures: number;
    missing_clock_outs: number;
}

interface ShiftRecord {
    id: string;
    employee_name: string;
    employee_role: string;
    date: string;
    classroom_name: string;
    scheduled_hours: number;
    actual_hours: number;
    break_hours: number;
    regular_hours: number;
    overtime_hours: number;
    is_late: boolean;
    is_early_departure: boolean;
    is_missing_clock_out: boolean;
    status: string;
    approval_status: string;
}

const StaffAttendanceReport: React.FC = () => {
    const navigate = useNavigate();

    const [preset, setPreset] = useState<'this_week' | 'last_week' | 'this_month' | 'custom'>('this_month');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'employees' | 'shifts'>('employees');

    const [employees, setEmployees] = useState<{ id: string; first_name: string; last_name: string; role: string }[]>([]);
    const [classrooms, setClassrooms] = useState<{ id: string; room_name: string }[]>([]);
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

    const [employeeSummaries, setEmployeeSummaries] = useState<EmployeeSummary[]>([]);
    const [records, setRecords] = useState<ShiftRecord[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);

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
        }
    }, [preset]);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [eRes, cRes, bRes] = await Promise.all([
                    api.get('/daycare/employees/'),
                    api.get('/classrooms/'),
                    api.get('/branches/')
                ]);
                setEmployees(Array.isArray(eRes.data) ? eRes.data : (eRes.data.results || []));
                setClassrooms(Array.isArray(cRes.data) ? cRes.data : (cRes.data.results || []));
                setBranches(Array.isArray(bRes.data) ? bRes.data : (bRes.data.results || []));
            } catch (err) {
                console.error("Failed to load options:", err);
            }
        };
        fetchFilters();
    }, []);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await api.get('/daycare/reports/staff-attendance/', {
                params: {
                    start_date: startDate || undefined,
                    end_date: endDate || undefined,
                    employee_id: selectedEmployee !== 'all' ? selectedEmployee : undefined,
                    classroom_id: selectedClassroom !== 'all' ? selectedClassroom : undefined,
                    branch_id: selectedBranch !== 'all' ? selectedBranch : undefined
                }
            });
            setSummary(res.data.summary);
            setEmployeeSummaries(res.data.employees || []);
            setRecords(res.data.records || []);
        } catch (err) {
            console.error("Staff report fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (startDate && endDate) {
            fetchReport();
        }
    }, [startDate, endDate, selectedEmployee, selectedClassroom, selectedBranch]);

    const exportCSV = () => {
        const url = `/api/daycare/reports/staff-attendance/?start_date=${startDate}&end_date=${endDate}&export=csv${
            selectedEmployee !== 'all' ? `&employee_id=${selectedEmployee}` : ''
        }${selectedClassroom !== 'all' ? `&classroom_id=${selectedClassroom}` : ''}${
            selectedBranch !== 'all' ? `&branch_id=${selectedBranch}` : ''
        }`;
        window.open(url, '_blank');
    };

    const filteredEmployees = useMemo(() => {
        if (!searchQuery.trim()) return employeeSummaries;
        const q = searchQuery.toLowerCase();
        return employeeSummaries.filter(e => 
            e.employee_name.toLowerCase().includes(q) || e.employee_role?.toLowerCase().includes(q)
        );
    }, [employeeSummaries, searchQuery]);

    const filteredRecords = useMemo(() => {
        if (!searchQuery.trim()) return records;
        const q = searchQuery.toLowerCase();
        return records.filter(r => 
            r.employee_name.toLowerCase().includes(q) || r.classroom_name?.toLowerCase().includes(q)
        );
    }, [records, searchQuery]);

    return (
        <Layout>
            <div className="space-y-6 pb-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <button
                            onClick={() => navigate('/daycare/attendance/dashboard')}
                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-1 font-semibold transition"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Back to Master Dashboard
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">Staff Attendance & Punctuality Report</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Scheduled vs actual working hours, breaks, overtime, late arrivals, and missing clock-outs.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => window.print()}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs flex items-center gap-1.5 transition"
                        >
                            <Printer className="w-4 h-4 text-slate-500" />
                            Print
                        </button>
                        <button
                            onClick={exportCSV}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                        >
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Summary KPIs */}
                {summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] uppercase font-semibold text-slate-400">Total Shifts</p>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{summary.total_shifts}</h3>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] uppercase font-semibold text-slate-400">Actual Hours</p>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{summary.total_actual_hours}h</h3>
                            <p className="text-[10px] text-slate-400">Sched: {summary.total_scheduled_hours}h</p>
                        </div>
                        <div className="bg-amber-50/50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40">
                            <p className="text-[10px] uppercase font-semibold text-amber-600">Total Overtime</p>
                            <h3 className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">+{summary.total_overtime_hours}h</h3>
                        </div>
                        <div className="bg-amber-50/50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40">
                            <p className="text-[10px] uppercase font-semibold text-amber-600">Late Arrivals</p>
                            <h3 className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{summary.total_late_arrivals}</h3>
                        </div>
                        <div className="bg-rose-50/50 dark:bg-rose-950/30 p-3.5 rounded-xl border border-rose-200 dark:border-rose-800/40">
                            <p className="text-[10px] uppercase font-semibold text-rose-600">Early Departures</p>
                            <h3 className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">{summary.total_early_departures}</h3>
                        </div>
                        <div className="bg-rose-50/50 dark:bg-rose-950/30 p-3.5 rounded-xl border border-rose-200 dark:border-rose-800/40">
                            <p className="text-[10px] uppercase font-semibold text-rose-600">Missing Clock-Outs</p>
                            <h3 className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">{summary.total_missing_clock_outs}</h3>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <span className="text-slate-400 font-semibold">Preset:</span>
                        {[
                            { id: 'this_week', label: 'This Week' },
                            { id: 'last_week', label: 'Last Week' },
                            { id: 'this_month', label: 'This Month' },
                            { id: 'custom', label: 'Custom Range' }
                        ].map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPreset(p.id as any)}
                                className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                                    preset === p.id
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {preset === 'custom' && (
                            <>
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1">End Date</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-slate-400 font-medium mb-1">Employee</label>
                            <select
                                value={selectedEmployee}
                                onChange={e => setSelectedEmployee(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                            >
                                <option value="all">All Employees</option>
                                {employees.map(e => (
                                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-slate-400 font-medium mb-1">Classroom</label>
                            <select
                                value={selectedClassroom}
                                onChange={e => setSelectedClassroom(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                            >
                                <option value="all">All Classrooms</option>
                                {classrooms.map(c => (
                                    <option key={c.id} value={c.id}>{c.room_name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-slate-400 font-medium mb-1">Search Staff</label>
                            <input
                                type="text"
                                placeholder="Name or role..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                            />
                        </div>
                    </div>
                </div>

                {/* View Selector Tabs */}
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
                        Summary by Employee ({employeeSummaries.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('shifts')}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                            activeTab === 'shifts'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <Clock className="w-4 h-4" />
                        Detailed Shift Logs ({records.length})
                    </button>
                </div>

                {/* Tab 1: Employee Summaries */}
                {activeTab === 'employees' && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                        <th className="p-4">Employee</th>
                                        <th className="p-4 text-center">Shifts</th>
                                        <th className="p-4">Scheduled</th>
                                        <th className="p-4">Actual Hours</th>
                                        <th className="p-4">Break Hours</th>
                                        <th className="p-4">Overtime</th>
                                        <th className="p-4 text-center">Late</th>
                                        <th className="p-4 text-center">Early Out</th>
                                        <th className="p-4 text-center">Missing Out</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={9} className="p-12 text-center text-slate-500">
                                                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                                                Loading staff attendance report...
                                            </td>
                                        </tr>
                                    ) : filteredEmployees.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="p-12 text-center text-slate-500">
                                                No staff attendance records found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEmployees.map(e => (
                                            <tr key={e.employee_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                                <td className="p-4">
                                                    <p className="font-semibold text-slate-900 dark:text-slate-100">{e.employee_name}</p>
                                                    <p className="text-[11px] text-slate-500">{e.employee_role}</p>
                                                </td>
                                                <td className="p-4 text-center font-medium">{e.total_shifts}</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-400">{e.scheduled_hours}h</td>
                                                <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{e.actual_hours}h</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-400">{e.break_hours}h</td>
                                                <td className="p-4">
                                                    {e.overtime_hours > 0 ? (
                                                        <span className="font-bold text-amber-600 dark:text-amber-400">+{e.overtime_hours}h</span>
                                                    ) : (
                                                        <span className="text-slate-400">0.00h</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center font-semibold text-amber-600">{e.late_arrivals}</td>
                                                <td className="p-4 text-center font-semibold text-rose-600">{e.early_departures}</td>
                                                <td className="p-4 text-center font-semibold text-rose-600">{e.missing_clock_outs}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Tab 2: Shift Logs */}
                {activeTab === 'shifts' && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                        <th className="p-4">Employee</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Classroom</th>
                                        <th className="p-4">Actual (h)</th>
                                        <th className="p-4">Breaks (h)</th>
                                        <th className="p-4">Overtime</th>
                                        <th className="p-4">Exceptions</th>
                                        <th className="p-4">Approval</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8} className="p-12 text-center text-slate-500">
                                                Loading shift logs...
                                            </td>
                                        </tr>
                                    ) : filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-12 text-center text-slate-500">
                                                No shift logs found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRecords.map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                                <td className="p-4 font-semibold text-slate-900 dark:text-slate-100">{r.employee_name}</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-300">{r.date}</td>
                                                <td className="p-4 text-slate-500">{r.classroom_name}</td>
                                                <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{r.actual_hours}h</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-400">{r.break_hours}h</td>
                                                <td className="p-4">
                                                    {r.overtime_hours > 0 ? (
                                                        <span className="font-bold text-amber-600 dark:text-amber-400">+{r.overtime_hours}h</span>
                                                    ) : (
                                                        <span className="text-slate-400">0.00</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {r.is_late && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Late</span>}
                                                        {r.is_early_departure && <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">Early Out</span>}
                                                        {r.is_missing_clock_out && <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">No Clock-Out</span>}
                                                        {!r.is_late && !r.is_early_departure && !r.is_missing_clock_out && <span className="text-slate-400 text-[11px]">Normal</span>}
                                                    </div>
                                                </td>
                                                <td className="p-4 font-semibold">
                                                    <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                                                        r.approval_status === 'APPROVED'
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                    }`}>
                                                        {r.approval_status}
                                                    </span>
                                                </td>
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

export default StaffAttendanceReport;
