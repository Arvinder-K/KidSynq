import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
    Calendar, Download, RefreshCw, Search, 
    Filter, ArrowLeft, Printer, Clock, 
    CheckCircle2, XCircle, AlertTriangle, ArrowUpRight
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';
import { useNavigate } from 'react-router-dom';

interface TimesheetRecord {
    id: string;
    employee_id: string;
    employee_name: string;
    employee_role: string;
    date: string;
    classroom_name: string;
    scheduled: string;
    clock_in: string;
    clock_out: string;
    breaks_count: number;
    total_break_minutes: number;
    actual_hours: number;
    overtime_hours: number;
    approval_status: string;
    is_corrected: boolean;
    correction_reason: string | null;
    submitted_by_name: string | null;
    approved_by_name: string | null;
}

const TimesheetReport: React.FC = () => {
    const navigate = useNavigate();

    const [preset, setPreset] = useState<'this_month' | 'last_month' | 'custom'>('this_month');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [employees, setEmployees] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
    const [classrooms, setClassrooms] = useState<{ id: string; room_name: string }[]>([]);

    const [records, setRecords] = useState<TimesheetRecord[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const now = new Date();
        if (preset === 'this_month') {
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

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [eRes, cRes] = await Promise.all([
                    api.get('/daycare/employees/'),
                    api.get('/classrooms/')
                ]);
                setEmployees(Array.isArray(eRes.data) ? eRes.data : (eRes.data.results || []));
                setClassrooms(Array.isArray(cRes.data) ? cRes.data : (cRes.data.results || []));
            } catch (err) {
                console.error("Failed to load options:", err);
            }
        };
        fetchFilters();
    }, []);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await api.get('/daycare/reports/timesheets/', {
                params: {
                    start_date: startDate || undefined,
                    end_date: endDate || undefined,
                    employee_id: selectedEmployee !== 'all' ? selectedEmployee : undefined,
                    classroom_id: selectedClassroom !== 'all' ? selectedClassroom : undefined,
                    approval_status: selectedStatus !== 'all' ? selectedStatus : undefined
                }
            });
            setSummary(res.data.summary);
            setRecords(res.data.records || []);
        } catch (err) {
            console.error("Timesheet report fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (startDate && endDate) {
            fetchReport();
        }
    }, [startDate, endDate, selectedEmployee, selectedClassroom, selectedStatus]);

    const exportCSV = () => {
        const url = `/api/daycare/reports/timesheets/?start_date=${startDate}&end_date=${endDate}&export=csv${
            selectedEmployee !== 'all' ? `&employee_id=${selectedEmployee}` : ''
        }${selectedClassroom !== 'all' ? `&classroom_id=${selectedClassroom}` : ''}${
            selectedStatus !== 'all' ? `&approval_status=${selectedStatus}` : ''
        }`;
        window.open(url, '_blank');
    };

    const filteredRecords = useMemo(() => {
        if (!searchQuery.trim()) return records;
        const q = searchQuery.toLowerCase();
        return records.filter(r => 
            r.employee_name.toLowerCase().includes(q) ||
            r.classroom_name.toLowerCase().includes(q)
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
                        <h1 className="text-2xl font-bold text-gray-900">Staff Timesheet & Payroll Ledger Report</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Shift-by-shift breakdown, break duration, overtime accumulation, and managerial approval history.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => navigate('/daycare/staff/timesheets/approvals')}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-indigo-600 text-xs font-semibold border border-indigo-200 shadow-xs flex items-center gap-1.5 transition"
                        >
                            Timesheet Approvals <ArrowUpRight className="w-4 h-4" />
                        </button>
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
                            <p className="text-[10px] uppercase font-semibold text-slate-400">Total Worked Hours</p>
                            <h3 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{summary.total_actual_hours}h</h3>
                        </div>
                        <div className="bg-amber-50/50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40">
                            <p className="text-[10px] uppercase font-semibold text-amber-600">Total Overtime</p>
                            <h3 className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">+{summary.total_overtime_hours}h</h3>
                        </div>
                        <div className="bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                            <p className="text-[10px] uppercase font-semibold text-emerald-600">Approved Shifts</p>
                            <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{summary.approved_count}</h3>
                        </div>
                        <div className="bg-amber-50/50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40">
                            <p className="text-[10px] uppercase font-semibold text-amber-600">Pending Approval</p>
                            <h3 className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{summary.submitted_count}</h3>
                        </div>
                        <div className="bg-rose-50/50 dark:bg-rose-950/30 p-3.5 rounded-xl border border-rose-200 dark:border-rose-800/40">
                            <p className="text-[10px] uppercase font-semibold text-rose-600">Rejected / Action Req.</p>
                            <h3 className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">
                                {(summary.rejected_count || 0) + (summary.correction_required_count || 0)}
                            </h3>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <span className="text-slate-400 font-semibold">Period:</span>
                        {[
                            { id: 'this_month', label: 'This Month' },
                            { id: 'last_month', label: 'Last Month' },
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
                                <option value="all">All Staff</option>
                                {employees.map(e => (
                                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-slate-400 font-medium mb-1">Approval Status</label>
                            <select
                                value={selectedStatus}
                                onChange={e => setSelectedStatus(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                            >
                                <option value="all">All Statuses</option>
                                <option value="APPROVED">Approved</option>
                                <option value="SUBMITTED">Submitted / Pending</option>
                                <option value="REJECTED">Rejected</option>
                                <option value="CORRECTION_REQUIRED">Correction Required</option>
                                <option value="DRAFT">Draft</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-slate-400 font-medium mb-1">Search Records</label>
                            <input
                                type="text"
                                placeholder="Staff name or room..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                    <th className="p-4">Employee</th>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Classroom</th>
                                    <th className="p-4">Scheduled</th>
                                    <th className="p-4">Clock In / Out</th>
                                    <th className="p-4">Breaks</th>
                                    <th className="p-4">Actual (h)</th>
                                    <th className="p-4">Overtime</th>
                                    <th className="p-4">Approval</th>
                                    <th className="p-4">Manager Sign-off</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {loading ? (
                                    <tr>
                                        <td colSpan={10} className="p-12 text-center text-slate-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                                            Loading timesheet ledger...
                                        </td>
                                    </tr>
                                ) : filteredRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="p-12 text-center text-slate-500">
                                            No timesheets found for this period.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                            <td className="p-4 font-semibold text-slate-900 dark:text-slate-100">{r.employee_name}</td>
                                            <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">{r.date}</td>
                                            <td className="p-4 text-slate-500">{r.classroom_name}</td>
                                            <td className="p-4 text-slate-600 dark:text-slate-400">{r.scheduled}</td>
                                            <td className="p-4 font-mono text-slate-800 dark:text-slate-200">
                                                {r.clock_in} – {r.clock_out}
                                            </td>
                                            <td className="p-4 text-slate-600 dark:text-slate-400">
                                                {r.breaks_count > 0 ? `${r.total_break_minutes}m (${r.breaks_count})` : '0m'}
                                            </td>
                                            <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{r.actual_hours}h</td>
                                            <td className="p-4">
                                                {r.overtime_hours > 0 ? (
                                                    <span className="font-bold text-amber-600 dark:text-amber-400">+{r.overtime_hours}h</span>
                                                ) : (
                                                    <span className="text-slate-400">0.00</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                    r.approval_status === 'APPROVED'
                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                        : r.approval_status === 'REJECTED'
                                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                                        : r.approval_status === 'CORRECTION_REQUIRED'
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                                }`}>
                                                    {r.approval_status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-500 text-[11px]">
                                                {r.approved_by_name ? (
                                                    <span className="text-emerald-700 dark:text-emerald-300 font-medium">✓ {r.approved_by_name}</span>
                                                ) : r.submitted_by_name ? (
                                                    <span>Sub: {r.submitted_by_name}</span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default TimesheetReport;
