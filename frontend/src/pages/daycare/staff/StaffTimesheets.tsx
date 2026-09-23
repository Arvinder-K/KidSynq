import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Clock, Search, RefreshCw, 
    CheckCircle2, XCircle, Download, 
    History, Edit3, Check, X, 
    AlertCircle, FileSpreadsheet
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';

interface TimesheetRecord {
    id: string;
    employee: string;
    employee_name: string;
    employee_role: string;
    employee_photo: string | null;
    classroom_name: string | null;
    branch_name: string | null;
    date: string;
    clock_in: string | null;
    clock_out: string | null;
    check_in_time: string | null;
    check_out_time: string | null;
    status: string;
    approval_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CORRECTED';
    total_duration_hours: number;
    total_unpaid_break_hours: number;
    total_paid_break_hours: number;
    total_break_hours: number;
    total_break_minutes: number;
    actual_working_hours: number;
    scheduled_hours: number;
    variance_minutes: number;
    scheduled_shift_info: {
        id: string;
        date: string;
        shift_start: string | null;
        shift_end: string | null;
        shift_type: string;
        net_working_hours: number;
        classroom_name: string | null;
    } | null;
    approved_by_name: string | null;
    is_corrected: boolean;
    correction_reason: string | null;
    corrected_by_name: string | null;
    notes: string | null;
    breaks: {
        id: string;
        break_start: string;
        break_end: string | null;
        break_type: string;
        is_paid: boolean;
        duration_minutes: number;
    }[];
}

const StaffTimesheets: React.FC = () => {
    // Filters State
    const [dateRangePreset, setDateRangePreset] = useState<'this_week' | 'last_week' | 'this_month' | 'custom'>('this_week');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [approvalFilter, setApprovalFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Data State
    const [timesheets, setTimesheets] = useState<TimesheetRecord[]>([]);
    const [employees, setEmployees] = useState<{ id: string; first_name: string; last_name: string; role: string }[]>([]);
    const [classrooms, setClassrooms] = useState<{ id: string; room_name: string }[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Controlled Correction Modal State
    const [correctionModalOpen, setCorrectionModalOpen] = useState<boolean>(false);
    const [selectedRecord, setSelectedRecord] = useState<TimesheetRecord | null>(null);
    const [corrClockIn, setCorrClockIn] = useState<string>('');
    const [corrClockOut, setCorrClockOut] = useState<string>('');
    const [corrStatus, setCorrStatus] = useState<string>('CLOCKED_OUT');
    const [corrApproval, setCorrApproval] = useState<string>('APPROVED');
    const [corrReason, setCorrReason] = useState<string>('');
    const [corrNotes, setCorrNotes] = useState<string>('');

    // Audit Modal State
    const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);
    const [auditLoading, setAuditLoading] = useState<boolean>(false);
    const [auditData, setAuditData] = useState<any>(null);

    // Initialize Date Presets
    useEffect(() => {
        const now = new Date();
        if (dateRangePreset === 'this_week') {
            const currentDay = now.getDay();
            const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
            const monday = new Date(now);
            monday.setDate(now.getDate() + diffToMonday);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            setStartDate(monday.toISOString().split('T')[0]);
            setEndDate(sunday.toISOString().split('T')[0]);
        } else if (dateRangePreset === 'last_week') {
            const currentDay = now.getDay();
            const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay - 7;
            const monday = new Date(now);
            monday.setDate(now.getDate() + diffToMonday);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            setStartDate(monday.toISOString().split('T')[0]);
            setEndDate(sunday.toISOString().split('T')[0]);
        } else if (dateRangePreset === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            setStartDate(firstDay.toISOString().split('T')[0]);
            setEndDate(lastDay.toISOString().split('T')[0]);
        }
    }, [dateRangePreset]);

    // Initial Dropdown Data
    useEffect(() => {
        const fetchDropdowns = async () => {
            try {
                const [empRes, classRes] = await Promise.all([
                    api.get('/daycare/employees/'),
                    api.get('/classrooms/')
                ]);
                const empData = Array.isArray(empRes.data) ? empRes.data : (empRes.data.results || []);
                const classData = Array.isArray(classRes.data) ? classRes.data : (classRes.data.results || []);
                setEmployees(empData);
                setClassrooms(classData);
            } catch (err) {
                console.error("Failed to load filter options:", err);
            }
        };
        fetchDropdowns();
    }, []);

    // Fetch Timesheets
    const fetchTimesheets = async () => {
        setLoading(true);
        try {
            const res = await api.get('/daycare/staff/attendance/timesheets/', {
                params: {
                    start_date: startDate || undefined,
                    end_date: endDate || undefined,
                    employee_id: selectedEmployee !== 'all' ? selectedEmployee : undefined,
                    classroom_id: selectedClassroom !== 'all' ? selectedClassroom : undefined,
                    status: statusFilter !== 'all' ? statusFilter : undefined,
                    approval_status: approvalFilter !== 'all' ? approvalFilter : undefined
                }
            });
            setTimesheets(res.data);
        } catch (err: any) {
            console.error("Failed to load timesheets:", err);
            showToast(err.response?.data?.detail || "Failed to load timesheet records", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (startDate && endDate) {
            fetchTimesheets();
        }
    }, [startDate, endDate, selectedEmployee, selectedClassroom, statusFilter, approvalFilter]);

    const showToast = (text: string, type: 'success' | 'error') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    // Quick Submit for Approval
    const handleSubmitTimesheet = async (recordId: string) => {
        setActionLoading(true);
        try {
            await api.post(`/daycare/staff/attendance/records/${recordId}/submit/`, {
                notes: "Submitted for manager verification"
            });
            showToast("Timesheet submitted for manager approval!", "success");
            fetchTimesheets();
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Failed to submit timesheet", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Resubmit after correction
    const handleResubmitTimesheet = async (recordId: string) => {
        setActionLoading(true);
        try {
            await api.post(`/daycare/staff/attendance/records/${recordId}/resubmit/`, {
                notes: "Resubmitted after addressing requested corrections"
            });
            showToast("Timesheet resubmitted for manager review!", "success");
            fetchTimesheets();
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Failed to resubmit timesheet", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Quick Approve
    const handleApprove = async (recordId: string) => {
        setActionLoading(true);
        try {
            await api.post(`/daycare/staff/attendance/records/${recordId}/approve/`);
            showToast("Timesheet record approved successfully!", "success");
            fetchTimesheets();
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Failed to approve timesheet", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Open Correction Modal
    const openCorrectionModal = (rec: TimesheetRecord) => {
        setSelectedRecord(rec);
        setCorrClockIn(rec.clock_in ? rec.clock_in.substring(11, 16) : (rec.check_in_time ? rec.check_in_time.substring(0, 5) : ''));
        setCorrClockOut(rec.clock_out ? rec.clock_out.substring(11, 16) : (rec.check_out_time ? rec.check_out_time.substring(0, 5) : ''));
        setCorrStatus(rec.status);
        setCorrApproval(rec.approval_status);
        setCorrReason('');
        setCorrNotes(rec.notes || '');
        setCorrectionModalOpen(true);
    };

    const handleCorrectionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecord) return;

        if (!corrReason.trim()) {
            showToast("A correction reason is required for timesheet audit compliance.", "error");
            return;
        }

        setActionLoading(true);
        try {
            await api.post(`/daycare/staff/attendance/records/${selectedRecord.id}/correct/`, {
                correction_reason: corrReason,
                clock_in: corrClockIn ? `${selectedRecord.date}T${corrClockIn}:00` : null,
                clock_out: corrClockOut ? `${selectedRecord.date}T${corrClockOut}:00` : null,
                status: corrStatus,
                approval_status: corrApproval,
                notes: corrNotes
            });

            showToast("Timesheet corrected and logged in audit trail!", "success");
            setCorrectionModalOpen(false);
            fetchTimesheets();
        } catch (err: any) {
            showToast(err.response?.data?.error || err.response?.data?.detail || "Failed to correct timesheet", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Open Audit Modal
    const openAuditModal = async (recordId: string) => {
        setAuditLoading(true);
        setAuditModalOpen(true);
        try {
            const res = await api.get(`/daycare/staff/attendance/records/${recordId}/audit/`);
            setAuditData(res.data);
        } catch (err) {
            showToast("Failed to load audit history", "error");
        } finally {
            setAuditLoading(false);
        }
    };

    // CSV Export
    const handleExportCSV = () => {
        if (filteredTimesheets.length === 0) {
            showToast("No timesheet data available to export.", "error");
            return;
        }

        const headers = [
            "Employee",
            "Role",
            "Date",
            "Classroom",
            "Scheduled Start",
            "Scheduled End",
            "Scheduled Hours",
            "Clock In",
            "Clock Out",
            "Total Break (mins)",
            "Unpaid Break (hrs)",
            "Actual Working Hours",
            "Variance (mins)",
            "Shift Status",
            "Approval Status",
            "Approved By",
            "Is Corrected",
            "Correction Reason"
        ];

        const rows = filteredTimesheets.map(t => [
            `"${t.employee_name}"`,
            `"${t.employee_role || ''}"`,
            t.date,
            `"${t.classroom_name || ''}"`,
            t.scheduled_shift_info?.shift_start || '',
            t.scheduled_shift_info?.shift_end || '',
            t.scheduled_hours,
            t.clock_in ? t.clock_in.substring(11, 16) : (t.check_in_time || ''),
            t.clock_out ? t.clock_out.substring(11, 16) : (t.check_out_time || ''),
            t.total_break_minutes,
            t.total_unpaid_break_hours,
            t.actual_working_hours,
            t.variance_minutes,
            t.status,
            t.approval_status,
            `"${t.approved_by_name || ''}"`,
            t.is_corrected ? "YES" : "NO",
            `"${t.correction_reason || ''}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Staff_Timesheets_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filtered Timesheets
    const filteredTimesheets = useMemo(() => {
        return timesheets.filter(t => {
            const matchesSearch = t.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.employee_role && t.employee_role.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (t.classroom_name && t.classroom_name.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesSearch;
        });
    }, [timesheets, searchQuery]);

    // KPI Summary Metrics
    const kpiSummary = useMemo(() => {
        let totalHours = 0;
        let totalUnpaidBreak = 0;
        let approvedCount = 0;
        let pendingCount = 0;

        filteredTimesheets.forEach(t => {
            totalHours += Number(t.actual_working_hours || 0);
            totalUnpaidBreak += Number(t.total_unpaid_break_hours || 0);
            if (t.approval_status === 'APPROVED') approvedCount++;
            if (t.approval_status === 'PENDING') pendingCount++;
        });

        return {
            totalShifts: filteredTimesheets.length,
            totalHours: Math.round(totalHours * 100) / 100,
            totalUnpaidBreak: Math.round(totalUnpaidBreak * 100) / 100,
            approvedCount,
            pendingCount
        };
    }, [filteredTimesheets]);

    const formatTime = (isoOrTime: string | null) => {
        if (!isoOrTime) return '--:--';
        if (isoOrTime.includes('T')) {
            const d = new Date(isoOrTime);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return isoOrTime.substring(0, 5);
    };

    return (
        <Layout>
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Staff Timesheets & Approvals</h1>
                        <p className="mt-1 text-sm text-gray-500">Audit verified hours, schedule variances, and perform administrative sign-offs.</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={handleExportCSV}
                            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition flex items-center gap-2 shadow-xs"
                        >
                            <Download className="w-4 h-4 text-slate-500" />
                            Export CSV
                        </button>
                        <button
                            onClick={fetchTimesheets}
                            className="p-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 transition shadow-xs"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Toast Notification */}
                <AnimatePresence>
                    {toastMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`p-4 rounded-xl flex items-center justify-between shadow-xl ${
                                toastMessage.type === 'success' 
                                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300' 
                                    : 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                <span className="text-sm font-medium">{toastMessage.text}</span>
                            </div>
                            <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* KPI Metrics Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                        <div className="text-slate-400 text-xs font-medium">Total Shifts Logged</div>
                        <div className="text-2xl font-bold text-white mt-1">{kpiSummary.totalShifts}</div>
                    </div>

                    <div className="bg-emerald-950/30 p-4 rounded-xl border border-emerald-900/40">
                        <div className="text-emerald-400 text-xs font-medium">Total Actual Hours</div>
                        <div className="text-2xl font-bold text-emerald-300 mt-1">{kpiSummary.totalHours} hrs</div>
                    </div>

                    <div className="bg-amber-950/30 p-4 rounded-xl border border-amber-900/40">
                        <div className="text-amber-400 text-xs font-medium">Unpaid Breaks Deducted</div>
                        <div className="text-2xl font-bold text-amber-300 mt-1">{kpiSummary.totalUnpaidBreak} hrs</div>
                    </div>

                    <div className="bg-indigo-950/30 p-4 rounded-xl border border-indigo-900/40">
                        <div className="text-indigo-400 text-xs font-medium">Approved Shifts</div>
                        <div className="text-2xl font-bold text-indigo-300 mt-1">{kpiSummary.approvedCount}</div>
                    </div>

                    <div className="bg-rose-950/30 p-4 rounded-xl border border-rose-900/40">
                        <div className="text-rose-400 text-xs font-medium">Pending Sign-Off</div>
                        <div className="text-2xl font-bold text-rose-300 mt-1">{kpiSummary.pendingCount}</div>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400 mr-2">Range Preset:</span>
                        <button
                            onClick={() => setDateRangePreset('this_week')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                dateRangePreset === 'this_week' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            This Week
                        </button>
                        <button
                            onClick={() => setDateRangePreset('last_week')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                dateRangePreset === 'last_week' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            Last Week
                        </button>
                        <button
                            onClick={() => setDateRangePreset('this_month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                dateRangePreset === 'this_month' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            This Month
                        </button>
                        <button
                            onClick={() => setDateRangePreset('custom')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                dateRangePreset === 'custom' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            Custom Range
                        </button>

                        <div className="ml-auto flex items-center gap-2 text-xs">
                            <span className="text-slate-400 font-medium">From:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setDateRangePreset('custom');
                                    setStartDate(e.target.value);
                                }}
                                className="bg-slate-800 text-white text-xs px-2 py-1 rounded-lg border border-slate-700 focus:outline-none"
                            />
                            <span className="text-slate-400 font-medium">To:</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => {
                                    setDateRangePreset('custom');
                                    setEndDate(e.target.value);
                                }}
                                className="bg-slate-800 text-white text-xs px-2 py-1 rounded-lg border border-slate-700 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-800/80">
                        {/* Search */}
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search staff name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-800 text-white text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        {/* Employee Select */}
                        <select
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            className="bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="all">All Employees</option>
                            {employees.map(e => (
                                <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                            ))}
                        </select>

                        {/* Classroom Select */}
                        <select
                            value={selectedClassroom}
                            onChange={(e) => setSelectedClassroom(e.target.value)}
                            className="bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="all">All Classrooms</option>
                            {classrooms.map(c => (
                                <option key={c.id} value={c.id}>{c.room_name}</option>
                            ))}
                        </select>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="all">All Shift Statuses</option>
                            <option value="CLOCKED_IN">Clocked In</option>
                            <option value="ON_BREAK">On Break</option>
                            <option value="CLOCKED_OUT">Clocked Out</option>
                            <option value="ABSENT">Absent</option>
                            <option value="EXCUSED">Excused Absence</option>
                        </select>

                        {/* Approval Filter */}
                        <select
                            value={approvalFilter}
                            onChange={(e) => setApprovalFilter(e.target.value)}
                            className="bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="all">All Approval States</option>
                            <option value="PENDING">Pending Approval</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="CORRECTED">Corrected</option>
                        </select>
                    </div>
                </div>

                {/* Timesheets Table (Part G) */}
                <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Employee</th>
                                    <th className="px-4 py-4">Date</th>
                                    <th className="px-4 py-4">Scheduled Shift</th>
                                    <th className="px-4 py-4">Clock In</th>
                                    <th className="px-4 py-4">Clock Out</th>
                                    <th className="px-4 py-4">Break Duration</th>
                                    <th className="px-4 py-4">Actual Hours</th>
                                    <th className="px-4 py-4">Difference</th>
                                    <th className="px-4 py-4">Approval</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {loading ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                                            Loading staff timesheets...
                                        </td>
                                    </tr>
                                ) : filteredTimesheets.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                                            No timesheets found matching your filter criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTimesheets.map((record) => (
                                        <tr key={record.id} className="hover:bg-slate-800/40 transition-colors">
                                            {/* Employee */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs overflow-hidden">
                                                        {record.employee_photo ? (
                                                            <img src={record.employee_photo} alt={record.employee_name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            record.employee_name.charAt(0)
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-white text-sm flex items-center gap-1.5">
                                                            {record.employee_name}
                                                            {record.is_corrected && (
                                                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold" title={record.correction_reason || "Corrected record"}>
                                                                    CORRECTED
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-slate-400">{record.employee_role || 'Staff'}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Date */}
                                            <td className="px-4 py-4 text-xs font-mono text-slate-200">
                                                {record.date}
                                            </td>

                                            {/* Scheduled Shift (Start - End) */}
                                            <td className="px-4 py-4">
                                                {record.scheduled_shift_info ? (
                                                    <div className="text-xs">
                                                        <span className="font-medium text-slate-200">
                                                            {formatTime(record.scheduled_shift_info.shift_start)} – {formatTime(record.scheduled_shift_info.shift_end)}
                                                        </span>
                                                        <span className="block text-[11px] text-slate-500">
                                                            {record.scheduled_shift_info.net_working_hours}h sched
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-500 italic">Unscheduled</span>
                                                )}
                                            </td>

                                            {/* Clock In */}
                                            <td className="px-4 py-4 text-xs font-mono text-white">
                                                {formatTime(record.clock_in || record.check_in_time)}
                                            </td>

                                            {/* Clock Out */}
                                            <td className="px-4 py-4 text-xs font-mono text-white">
                                                {formatTime(record.clock_out || record.check_out_time)}
                                            </td>

                                            {/* Break Duration */}
                                            <td className="px-4 py-4">
                                                <div className="text-xs">
                                                    <span className="text-slate-300 font-medium">
                                                        {record.total_break_minutes} mins
                                                    </span>
                                                    {record.total_unpaid_break_hours > 0 && (
                                                        <span className="block text-[11px] text-amber-400/90">
                                                            -{record.total_unpaid_break_hours}h unpaid
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Actual Hours (Backend Source of Truth) */}
                                            <td className="px-4 py-4">
                                                <span className="font-bold text-emerald-400 text-sm">
                                                    {record.actual_working_hours.toFixed(2)} hrs
                                                </span>
                                            </td>

                                            {/* Difference (Part F) */}
                                            <td className="px-4 py-4 text-xs">
                                                {record.scheduled_shift_info && record.clock_out ? (
                                                    record.variance_minutes > 0 ? (
                                                        <span className="font-semibold text-emerald-400">+{record.variance_minutes}m</span>
                                                    ) : record.variance_minutes < 0 ? (
                                                        <span className="font-semibold text-rose-400">{record.variance_minutes}m</span>
                                                    ) : (
                                                        <span className="text-slate-400 font-medium">0m</span>
                                                    )
                                                ) : (
                                                    <span className="text-slate-500">-</span>
                                                )}
                                            </td>

                                            {/* Approval Status */}
                                            <td className="px-4 py-4">
                                                {record.approval_status === 'APPROVED' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                                                    </span>
                                                ) : record.approval_status === 'REJECTED' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                        <XCircle className="w-3.5 h-3.5" /> Rejected
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                        <Clock className="w-3.5 h-3.5" /> Pending
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {record.approval_status !== 'APPROVED' && (
                                                        <button
                                                            onClick={() => handleApprove(record.id)}
                                                            disabled={actionLoading}
                                                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition flex items-center gap-1 shadow-xs"
                                                            title="Sign-off & Approve"
                                                        >
                                                            <Check className="w-3.5 h-3.5" /> Approve
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => openCorrectionModal(record)}
                                                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                                                        title="Admin Correction"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => openAuditModal(record.id)}
                                                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-lg transition"
                                                        title="Audit Trail"
                                                    >
                                                        <History className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Controlled Correction Modal */}
                <AnimatePresence>
                    {correctionModalOpen && selectedRecord && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
                            >
                                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                                            <Edit3 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-base">Timesheet Correction Workflow</h3>
                                            <p className="text-xs text-slate-400">All modifications are preserved in the central audit ledger.</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setCorrectionModalOpen(false)} className="text-slate-400 hover:text-white">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleCorrectionSubmit} className="p-6 space-y-4">
                                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1">
                                        <p className="text-slate-400">Employee: <strong className="text-white">{selectedRecord.employee_name}</strong></p>
                                        <p className="text-slate-400">Date: <strong className="text-white">{selectedRecord.date}</strong></p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">Clock In Time</label>
                                            <input
                                                type="time"
                                                value={corrClockIn}
                                                onChange={(e) => setCorrClockIn(e.target.value)}
                                                className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">Clock Out Time</label>
                                            <input
                                                type="time"
                                                value={corrClockOut}
                                                onChange={(e) => setCorrClockOut(e.target.value)}
                                                className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">Shift Status</label>
                                            <select
                                                value={corrStatus}
                                                onChange={(e) => setCorrStatus(e.target.value)}
                                                className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="CLOCKED_OUT">Clocked Out</option>
                                                <option value="CLOCKED_IN">Clocked In</option>
                                                <option value="ON_BREAK">On Break</option>
                                                <option value="ABSENT">Absent</option>
                                                <option value="EXCUSED">Excused Absence</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">Approval State</label>
                                            <select
                                                value={corrApproval}
                                                onChange={(e) => setCorrApproval(e.target.value)}
                                                className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="APPROVED">Approved</option>
                                                <option value="PENDING">Pending</option>
                                                <option value="REJECTED">Rejected</option>
                                                <option value="CORRECTED">Corrected</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                                            Correction Reason <span className="text-rose-400">*</span>
                                        </label>
                                        <textarea
                                            required
                                            rows={2}
                                            value={corrReason}
                                            onChange={(e) => setCorrReason(e.target.value)}
                                            placeholder="Mandatory explanation for audit compliance..."
                                            className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1">Notes / Remarks</label>
                                        <input
                                            type="text"
                                            value={corrNotes}
                                            onChange={(e) => setCorrNotes(e.target.value)}
                                            placeholder="Optional notes..."
                                            className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setCorrectionModalOpen(false)}
                                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={actionLoading}
                                            className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
                                        >
                                            {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            Save Correction
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Audit Trail Modal */}
                <AnimatePresence>
                    {auditModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
                            >
                                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                                            <History className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-base">Timesheet Audit Trail</h3>
                                            <p className="text-xs text-slate-400">Full history of clocking events, sign-offs, and administrative corrections.</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setAuditModalOpen(false)} className="text-slate-400 hover:text-white">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                                    {auditLoading ? (
                                        <div className="text-center py-10 text-slate-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                                            Loading audit logs...
                                        </div>
                                    ) : auditData?.audit_trail?.length === 0 ? (
                                        <p className="text-center text-slate-500 py-6">No audit records found for this shift.</p>
                                    ) : (
                                        auditData?.audit_trail?.map((log: any, idx: number) => (
                                            <div key={idx} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-indigo-400 uppercase tracking-wide">{log.action}</span>
                                                    <span className="text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                                                </div>
                                                <p className="text-slate-400">
                                                    Author: <strong className="text-white">{log.user?.first_name || log.user?.username || 'System'}</strong> ({log.user_type || 'User'})
                                                </p>
                                                {log.old_values && (
                                                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 overflow-x-auto">
                                                        <span className="text-rose-400 font-semibold block mb-1">Before:</span>
                                                        <pre>{JSON.stringify(log.old_values, null, 2)}</pre>
                                                    </div>
                                                )}
                                                {log.new_values && (
                                                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 overflow-x-auto">
                                                        <span className="text-emerald-400 font-semibold block mb-1">After:</span>
                                                        <pre>{JSON.stringify(log.new_values, null, 2)}</pre>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="p-4 border-t border-slate-800 flex justify-end">
                                    <button
                                        onClick={() => setAuditModalOpen(false)}
                                        className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition"
                                    >
                                        Close
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </Layout>
    );
};

export default StaffTimesheets;
