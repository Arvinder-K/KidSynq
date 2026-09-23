import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle2, XCircle, AlertCircle, Clock, 
    Calendar, Search, Filter, RefreshCw, 
    ChevronRight, ArrowUpRight, History, Edit3, 
    Check, X, FileSpreadsheet, User, ShieldAlert, 
    TrendingUp, Award, Layers, HelpCircle, Send
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

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
    approval_status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED' | 'PENDING' | 'CORRECTED';
    total_duration_hours: number;
    total_unpaid_break_hours: number;
    total_paid_break_hours: number;
    total_break_hours: number;
    total_break_minutes: number;
    actual_working_hours: number;
    scheduled_hours: number;
    variance_minutes: number;
    overtime_candidate_hours: number;
    can_approve: boolean;
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
    approved_at: string | null;
    submitted_by_name: string | null;
    submitted_at: string | null;
    rejection_reason: string | null;
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

const StaffTimesheetApprovals: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Filters
    const [datePreset, setDatePreset] = useState<'this_week' | 'last_week' | 'this_month' | 'custom'>('this_week');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedStatus, setSelectedStatus] = useState<string>('SUBMITTED');
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Data State
    const [timesheets, setTimesheets] = useState<TimesheetRecord[]>([]);
    const [employees, setEmployees] = useState<{ id: string; first_name: string; last_name: string; role: string }[]>([]);
    const [classrooms, setClassrooms] = useState<{ id: string; room_name: string }[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Approval Modal with Time Bank Toggle
    const [approvalModalOpen, setApprovalModalOpen] = useState<boolean>(false);
    const [approvalTarget, setApprovalTarget] = useState<TimesheetRecord | null>(null);
    const [sendToTimeBank, setSendToTimeBank] = useState<boolean>(true);
    const [overtimeThreshold, setOvertimeThreshold] = useState<number>(8.0);
    const [approvalNotes, setApprovalNotes] = useState<string>('');

    // Rejection Modal
    const [rejectionModalOpen, setRejectionModalOpen] = useState<boolean>(false);
    const [rejectionTarget, setRejectionTarget] = useState<TimesheetRecord | null>(null);
    const [rejectionReason, setRejectionReason] = useState<string>('');

    // Correction Request Modal
    const [correctionReqModalOpen, setCorrectionReqModalOpen] = useState<boolean>(false);
    const [correctionReqTarget, setCorrectionReqTarget] = useState<TimesheetRecord | null>(null);
    const [correctionInstructions, setCorrectionInstructions] = useState<string>('');

    // Controlled Shift Correction Modal
    const [correctionModalOpen, setCorrectionModalOpen] = useState<boolean>(false);
    const [selectedRecord, setSelectedRecord] = useState<TimesheetRecord | null>(null);
    const [corrClockIn, setCorrClockIn] = useState<string>('');
    const [corrClockOut, setCorrClockOut] = useState<string>('');
    const [corrStatus, setCorrStatus] = useState<string>('CLOCKED_OUT');
    const [corrApproval, setCorrApproval] = useState<string>('APPROVED');
    const [corrReason, setCorrReason] = useState<string>('');
    const [corrNotes, setCorrNotes] = useState<string>('');

    // Audit Modal
    const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);
    const [auditLoading, setAuditLoading] = useState<boolean>(false);
    const [auditData, setAuditData] = useState<any>(null);

    // Date Range Presets
    useEffect(() => {
        const now = new Date();
        if (datePreset === 'this_week') {
            const currentDay = now.getDay();
            const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
            const monday = new Date(now);
            monday.setDate(now.getDate() + diffToMonday);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            setStartDate(monday.toISOString().split('T')[0]);
            setEndDate(sunday.toISOString().split('T')[0]);
        } else if (datePreset === 'last_week') {
            const currentDay = now.getDay();
            const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay - 7;
            const monday = new Date(now);
            monday.setDate(now.getDate() + diffToMonday);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            setStartDate(monday.toISOString().split('T')[0]);
            setEndDate(sunday.toISOString().split('T')[0]);
        } else if (datePreset === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            setStartDate(firstDay.toISOString().split('T')[0]);
            setEndDate(lastDay.toISOString().split('T')[0]);
        }
    }, [datePreset]);

    // Initial Dropdown Options
    useEffect(() => {
        const fetchFilters = async () => {
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
                console.error("Failed to load options:", err);
            }
        };
        fetchFilters();
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
                    approval_status: selectedStatus !== 'all' ? selectedStatus : undefined,
                }
            });
            const data = Array.isArray(res.data) ? res.data : [];
            setTimesheets(data);
        } catch (err: any) {
            console.error("Error fetching timesheets:", err);
            showToast("Failed to fetch timesheet approvals data.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (startDate && endDate) {
            fetchTimesheets();
        }
    }, [startDate, endDate, selectedStatus, selectedEmployee, selectedClassroom]);

    const showToast = (text: string, type: 'success' | 'error') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    // Filtered by Search
    const filteredTimesheets = useMemo(() => {
        return timesheets.filter(t => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                t.employee_name?.toLowerCase().includes(q) ||
                t.employee_role?.toLowerCase().includes(q) ||
                t.classroom_name?.toLowerCase().includes(q) ||
                t.date?.includes(q)
            );
        });
    }, [timesheets, searchQuery]);

    // Metrics
    const metrics = useMemo(() => {
        let pendingCount = 0;
        let approvedCount = 0;
        let correctionReqCount = 0;
        let totalOvertimeHours = 0;

        timesheets.forEach(t => {
            if (t.approval_status === 'SUBMITTED' || t.approval_status === 'PENDING') pendingCount++;
            if (t.approval_status === 'APPROVED') approvedCount++;
            if (t.approval_status === 'CORRECTION_REQUIRED') correctionReqCount++;
            if (t.actual_working_hours > 8.0) {
                totalOvertimeHours += (t.actual_working_hours - 8.0);
            }
        });

        return {
            pending: pendingCount,
            approved: approvedCount,
            correctionRequired: correctionReqCount,
            overtimeHours: round(totalOvertimeHours)
        };
    }, [timesheets]);

    function round(num: number) {
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }

    // Handlers
    const handleOpenApprove = (record: TimesheetRecord) => {
        if (!record.can_approve) {
            showToast("Self-approval is blocked by policy. Another administrator must approve your shift.", "error");
            return;
        }
        setApprovalTarget(record);
        setApprovalNotes('');
        setApprovalModalOpen(true);
    };

    const confirmApprove = async () => {
        if (!approvalTarget) return;
        setActionLoading(true);
        try {
            await api.post(`/daycare/staff/attendance/records/${approvalTarget.id}/approve/`, {
                send_to_time_bank: sendToTimeBank,
                threshold: overtimeThreshold,
                notes: approvalNotes
            });
            showToast(`Timesheet for ${approvalTarget.employee_name} approved successfully!`, "success");
            setApprovalModalOpen(false);
            setApprovalTarget(null);
            fetchTimesheets();
        } catch (err: any) {
            console.error("Approval error:", err);
            const msg = err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || "Failed to approve timesheet.";
            showToast(msg, "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenReject = (record: TimesheetRecord) => {
        setRejectionTarget(record);
        setRejectionReason('');
        setRejectionModalOpen(true);
    };

    const confirmReject = async () => {
        if (!rejectionTarget || !rejectionReason.trim()) {
            showToast("Please enter a mandatory rejection reason.", "error");
            return;
        }
        setActionLoading(true);
        try {
            await api.post(`/daycare/staff/attendance/records/${rejectionTarget.id}/reject/`, {
                rejection_reason: rejectionReason
            });
            showToast(`Timesheet rejected with feedback.`, "success");
            setRejectionModalOpen(false);
            setRejectionTarget(null);
            fetchTimesheets();
        } catch (err: any) {
            const msg = err.response?.data?.rejection_reason || "Failed to reject timesheet.";
            showToast(msg, "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenCorrectionReq = (record: TimesheetRecord) => {
        setCorrectionReqTarget(record);
        setCorrectionInstructions('');
        setCorrectionReqModalOpen(true);
    };

    const confirmCorrectionReq = async () => {
        if (!correctionReqTarget || !correctionInstructions.trim()) {
            showToast("Please provide instructions for the required correction.", "error");
            return;
        }
        setActionLoading(true);
        try {
            await api.post(`/daycare/staff/attendance/records/${correctionReqTarget.id}/request-correction/`, {
                correction_reason: correctionInstructions
            });
            showToast(`Correction requested from employee.`, "success");
            setCorrectionReqModalOpen(false);
            setCorrectionReqTarget(null);
            fetchTimesheets();
        } catch (err: any) {
            showToast("Failed to request correction.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleBatchApprove = async () => {
        if (selectedIds.length === 0) return;
        setActionLoading(true);
        try {
            for (const id of selectedIds) {
                const rec = timesheets.find(t => t.id === id);
                if (rec && rec.can_approve) {
                    await api.post(`/daycare/staff/attendance/records/${id}/approve/`, {
                        send_to_time_bank: true,
                        threshold: 8.0
                    });
                }
            }
            showToast(`Approved ${selectedIds.length} timesheets!`, "success");
            setSelectedIds([]);
            fetchTimesheets();
        } catch (err) {
            showToast("Error approving selected timesheets.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenCorrectionModal = (record: TimesheetRecord) => {
        setSelectedRecord(record);
        setCorrClockIn(record.clock_in ? record.clock_in.substring(11, 16) : '');
        setCorrClockOut(record.clock_out ? record.clock_out.substring(11, 16) : '');
        setCorrStatus(record.status || 'CLOCKED_OUT');
        setCorrApproval(record.approval_status || 'APPROVED');
        setCorrReason('');
        setCorrNotes(record.notes || '');
        setCorrectionModalOpen(true);
    };

    const submitCorrection = async () => {
        if (!selectedRecord) return;
        if (!corrReason.trim()) {
            showToast("A correction reason is required for audit compliance.", "error");
            return;
        }
        setActionLoading(true);
        try {
            await api.post(`/daycare/staff/attendance/records/${selectedRecord.id}/correct/`, {
                clock_in: corrClockIn ? `${selectedRecord.date}T${corrClockIn}:00` : null,
                clock_out: corrClockOut ? `${selectedRecord.date}T${corrClockOut}:00` : null,
                status: corrStatus,
                approval_status: corrApproval,
                correction_reason: corrReason,
                notes: corrNotes
            });
            showToast("Attendance record corrected and audited successfully.", "success");
            setCorrectionModalOpen(false);
            fetchTimesheets();
        } catch (err: any) {
            showToast(err.response?.data?.error || "Correction failed.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const openAuditDrawer = async (recordId: string) => {
        setAuditLoading(true);
        setAuditModalOpen(true);
        try {
            const res = await api.get(`/daycare/staff/attendance/records/${recordId}/audit/`);
            setAuditData(res.data);
        } catch (err) {
            showToast("Failed to load audit history.", "error");
            setAuditModalOpen(false);
        } finally {
            setAuditLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                        Approved
                    </span>
                );
            case 'SUBMITTED':
            case 'PENDING':
                return (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60">
                        <Clock className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400 animate-pulse" />
                        Submitted (Review)
                    </span>
                );
            case 'CORRECTION_REQUIRED':
                return (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-300 dark:border-violet-800/60">
                        <AlertCircle className="w-3.5 h-3.5 mr-1 text-violet-600 dark:text-violet-400" />
                        Correction Required
                    </span>
                );
            case 'REJECTED':
                return (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60">
                        <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600 dark:text-rose-400" />
                        Rejected
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Draft
                    </span>
                );
        }
    };

    return (
        <Layout>
            <div className="space-y-6 pb-12">
                {/* Toast Notification */}
                <AnimatePresence>
                    {toastMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 text-sm font-medium border ${
                                toastMessage.type === 'success'
                                    ? 'bg-emerald-900/90 text-emerald-100 border-emerald-600'
                                    : 'bg-rose-900/90 text-rose-100 border-rose-600'
                            } backdrop-blur-md`}
                        >
                            {toastMessage.type === 'success' ? <Check className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
                            <span>{toastMessage.text}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Timesheet Approvals & Overtime Verification</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Review submitted staff timesheets, authorize overtime, prevent self-approvals, and sync hours with Time Bank.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => navigate('/daycare/staff/reports/overtime')}
                            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold border border-slate-200 shadow-xs flex items-center gap-2 transition"
                        >
                            <TrendingUp className="w-4 h-4 text-indigo-600" />
                            Overtime Report
                        </button>
                        {selectedIds.length > 0 && (
                            <button
                                onClick={handleBatchApprove}
                                disabled={actionLoading}
                                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-xs flex items-center gap-2 transition"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Approve Selected ({selectedIds.length})
                            </button>
                        )}
                        <button
                            onClick={fetchTimesheets}
                            disabled={loading}
                            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition"
                            title="Refresh List"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Requires Review</p>
                            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{metrics.pending}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Submitted shifts waiting</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 border border-amber-200 dark:border-amber-800/40">
                            <Clock className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Approved Shifts</p>
                            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{metrics.approved}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Verified & confirmed</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 border border-emerald-200 dark:border-emerald-800/40">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Correction Requested</p>
                            <h3 className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">{metrics.correctionRequired}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Sent back for staff fix</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center text-violet-600 border border-violet-200 dark:border-violet-800/40">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Overtime</p>
                            <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{metrics.overtimeHours} hrs</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Eligible for Time Bank</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 border border-indigo-200 dark:border-indigo-800/40">
                            <Award className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                {/* Filters & Actions Bar */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    {/* Status Tabs */}
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
                        {[
                            { id: 'SUBMITTED', label: 'Requires Review', count: metrics.pending },
                            { id: 'all', label: 'All Statuses' },
                            { id: 'CORRECTION_REQUIRED', label: 'Correction Required', count: metrics.correctionRequired },
                            { id: 'APPROVED', label: 'Approved', count: metrics.approved },
                            { id: 'REJECTED', label: 'Rejected' },
                            { id: 'DRAFT', label: 'Draft' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setSelectedStatus(tab.id)}
                                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                                    selectedStatus === tab.id
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                {tab.label}
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        selectedStatus === tab.id
                                            ? 'bg-white/20 text-white'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                                    }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Secondary Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Date Range</label>
                            <div className="flex gap-2">
                                <select
                                    value={datePreset}
                                    onChange={(e: any) => setDatePreset(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="this_week">This Week</option>
                                    <option value="last_week">Last Week</option>
                                    <option value="this_month">This Month</option>
                                    <option value="custom">Custom Range</option>
                                </select>
                            </div>
                        </div>

                        {datePreset === 'custom' && (
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Employee</label>
                            <select
                                value={selectedEmployee}
                                onChange={e => setSelectedEmployee(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">All Staff Members</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.role})</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Classroom</label>
                            <select
                                value={selectedClassroom}
                                onChange={e => setSelectedClassroom(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">All Classrooms</option>
                                {classrooms.map(c => (
                                    <option key={c.id} value={c.id}>{c.room_name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Search Staff</label>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name, role..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timesheet List Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/75 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                    <th className="p-4 w-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length > 0 && selectedIds.length === filteredTimesheets.filter(t => t.can_approve).length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    const approvable = filteredTimesheets.filter(t => t.can_approve).map(t => t.id);
                                                    setSelectedIds(approvable);
                                                } else {
                                                    setSelectedIds([]);
                                                }
                                            }}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </th>
                                    <th className="p-4">Staff Member</th>
                                    <th className="p-4">Date & Classroom</th>
                                    <th className="p-4">Actual Shift</th>
                                    <th className="p-4">Breaks</th>
                                    <th className="p-4">Working Hours</th>
                                    <th className="p-4">Overtime Candidate</th>
                                    <th className="p-4">Status & Submitter</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="p-12 text-center text-slate-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                                            Loading submitted timesheets...
                                        </td>
                                    </tr>
                                ) : filteredTimesheets.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-12 text-center text-slate-500">
                                            <CheckCircle2 className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                                            No timesheets matching selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTimesheets.map(record => {
                                        const isOvertime = record.actual_working_hours > 8.0;
                                        const otAmount = round(Math.max(0, record.actual_working_hours - 8.0));

                                        return (
                                            <tr key={record.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                                <td className="p-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(record.id)}
                                                        disabled={!record.can_approve}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedIds([...selectedIds, record.id]);
                                                            } else {
                                                                setSelectedIds(selectedIds.filter(id => id !== record.id));
                                                            }
                                                        }}
                                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30"
                                                    />
                                                </td>

                                                {/* Employee */}
                                                <td className="p-4">
                                                    <div className="flex items-center space-x-3">
                                                        {record.employee_photo ? (
                                                            <img src={record.employee_photo} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                                                {record.employee_name?.charAt(0) || 'U'}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="font-semibold text-slate-900 dark:text-slate-100">{record.employee_name}</p>
                                                            <p className="text-[11px] text-slate-500">{record.employee_role}</p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Date & Room */}
                                                <td className="p-4">
                                                    <p className="font-medium text-slate-800 dark:text-slate-200">{record.date}</p>
                                                    <p className="text-[11px] text-slate-500">{record.classroom_name || 'General Area'}</p>
                                                </td>

                                                {/* Actual Shift */}
                                                <td className="p-4">
                                                    <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300">
                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>
                                                            {record.clock_in ? record.clock_in.substring(11, 16) : '--:--'} - {record.clock_out ? record.clock_out.substring(11, 16) : '--:--'}
                                                        </span>
                                                    </div>
                                                    {record.is_corrected && (
                                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center mt-0.5" title={record.correction_reason || ''}>
                                                            <Edit3 className="w-2.5 h-2.5 mr-0.5" /> Corrected
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Breaks */}
                                                <td className="p-4">
                                                    <p className="font-medium text-slate-800 dark:text-slate-200">{record.total_break_minutes} mins</p>
                                                    <p className="text-[11px] text-slate-500">{record.breaks?.length || 0} break(s)</p>
                                                </td>

                                                {/* Working Hours */}
                                                <td className="p-4">
                                                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{record.actual_working_hours} hrs</p>
                                                    {record.scheduled_hours > 0 && (
                                                        <p className="text-[10px] text-slate-400">Sched: {record.scheduled_hours}h</p>
                                                    )}
                                                </td>

                                                {/* Overtime Candidate */}
                                                <td className="p-4">
                                                    {isOvertime ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                                            +{otAmount} hrs OT
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">Regular</span>
                                                    )}
                                                </td>

                                                {/* Status & Submitter */}
                                                <td className="p-4">
                                                    <div>
                                                        {getStatusBadge(record.approval_status)}
                                                        {record.submitted_at && (
                                                            <p className="text-[10px] text-slate-400 mt-1">
                                                                by {record.submitted_by_name || 'Staff'} on {record.submitted_at.substring(0, 10)}
                                                            </p>
                                                        )}
                                                        {record.rejection_reason && (
                                                            <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-0.5 truncate max-w-[150px]" title={record.rejection_reason}>
                                                                Reason: {record.rejection_reason}
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Action Buttons */}
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end space-x-1.5">
                                                        {/* Approve Button */}
                                                        {record.approval_status !== 'APPROVED' && (
                                                            <button
                                                                onClick={() => handleOpenApprove(record)}
                                                                disabled={!record.can_approve}
                                                                className={`p-1.5 rounded-lg border transition ${
                                                                    record.can_approve
                                                                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                                                        : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700 cursor-not-allowed'
                                                                }`}
                                                                title={record.can_approve ? "Approve Timesheet" : "Self-approval blocked by policy"}
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {/* Request Correction Button */}
                                                        {record.approval_status !== 'APPROVED' && (
                                                            <button
                                                                onClick={() => handleOpenCorrectionReq(record)}
                                                                className="p-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800 transition"
                                                                title="Request Staff Correction"
                                                            >
                                                                <AlertCircle className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {/* Reject Button */}
                                                        {record.approval_status !== 'REJECTED' && record.approval_status !== 'APPROVED' && (
                                                            <button
                                                                onClick={() => handleOpenReject(record)}
                                                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 transition"
                                                                title="Reject Timesheet"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {/* Manager Correction Button */}
                                                        <button
                                                            onClick={() => handleOpenCorrectionModal(record)}
                                                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 transition"
                                                            title="Direct Manager Correction"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>

                                                        {/* Audit Trail Button */}
                                                        <button
                                                            onClick={() => openAuditDrawer(record.id)}
                                                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 transition"
                                                            title="View Audit Trail"
                                                        >
                                                            <History className="w-4 h-4" />
                                                        </button>
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

                {/* APPROVAL MODAL */}
                <AnimatePresence>
                    {approvalModalOpen && approvalTarget && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5"
                            >
                                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                                            <CheckCircle2 className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Approve Timesheet</h3>
                                            <p className="text-xs text-slate-500">{approvalTarget.employee_name} • {approvalTarget.date}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setApprovalModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="space-y-4 text-xs">
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-slate-500">Actual Working Hours</p>
                                            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{approvalTarget.actual_working_hours} hrs</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500">Overtime Candidate</p>
                                            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                                                +{round(Math.max(0, approvalTarget.actual_working_hours - overtimeThreshold))} hrs
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Daily Regular Hours Threshold
                                        </label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={overtimeThreshold}
                                            onChange={e => setOvertimeThreshold(parseFloat(e.target.value) || 8.0)}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-0.5">Hours worked beyond this threshold become overtime credit.</p>
                                    </div>

                                    <div className="flex items-center space-x-3 p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40">
                                        <input
                                            type="checkbox"
                                            id="timebank_cb"
                                            checked={sendToTimeBank}
                                            onChange={e => setSendToTimeBank(e.target.checked)}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="timebank_cb" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                                            Credit overtime hours directly to employee's Time Bank
                                        </label>
                                    </div>

                                    <div>
                                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Approval Note (Optional)
                                        </label>
                                        <textarea
                                            value={approvalNotes}
                                            onChange={e => setApprovalNotes(e.target.value)}
                                            placeholder="Add an internal confirmation note..."
                                            rows={2}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                                    <button
                                        onClick={() => setApprovalModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmApprove}
                                        disabled={actionLoading}
                                        className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center gap-2"
                                    >
                                        {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        Confirm Approval
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* REJECTION MODAL */}
                <AnimatePresence>
                    {rejectionModalOpen && rejectionTarget && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
                            >
                                <div className="flex items-center space-x-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                                    <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                                        <XCircle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Reject Timesheet</h3>
                                        <p className="text-xs text-slate-500">{rejectionTarget.employee_name} • {rejectionTarget.date}</p>
                                    </div>
                                </div>

                                <div className="space-y-3 text-xs">
                                    <div>
                                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Rejection Reason <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={e => setRejectionReason(e.target.value)}
                                            placeholder="Explain why this timesheet cannot be approved..."
                                            rows={3}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                                    <button
                                        onClick={() => setRejectionModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmReject}
                                        disabled={actionLoading}
                                        className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md flex items-center gap-2"
                                    >
                                        {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                        Reject Timesheet
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* CORRECTION REQUEST MODAL */}
                <AnimatePresence>
                    {correctionReqModalOpen && correctionReqTarget && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
                            >
                                <div className="flex items-center space-x-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                                    <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 flex items-center justify-center">
                                        <AlertCircle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Request Correction</h3>
                                        <p className="text-xs text-slate-500">{correctionReqTarget.employee_name} • {correctionReqTarget.date}</p>
                                    </div>
                                </div>

                                <div className="space-y-3 text-xs">
                                    <div>
                                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Correction Instructions <span className="text-violet-500">*</span>
                                        </label>
                                        <textarea
                                            value={correctionInstructions}
                                            onChange={e => setCorrectionInstructions(e.target.value)}
                                            placeholder="Describe what the employee needs to fix before resubmitting..."
                                            rows={3}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-violet-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                                    <button
                                        onClick={() => setCorrectionReqModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmCorrectionReq}
                                        disabled={actionLoading}
                                        className="px-5 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-md flex items-center gap-2"
                                    >
                                        {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        Send Request
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* MANAGER DIRECT CORRECTION MODAL */}
                <AnimatePresence>
                    {correctionModalOpen && selectedRecord && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4"
                            >
                                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                                            <Edit3 className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Correct Shift Log</h3>
                                            <p className="text-xs text-slate-500">{selectedRecord.employee_name} • {selectedRecord.date}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setCorrectionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="space-y-3 text-xs">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Clock In (HH:MM)</label>
                                            <input
                                                type="time"
                                                value={corrClockIn}
                                                onChange={e => setCorrClockIn(e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Clock Out (HH:MM)</label>
                                            <input
                                                type="time"
                                                value={corrClockOut}
                                                onChange={e => setCorrClockOut(e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Attendance Status</label>
                                            <select
                                                value={corrStatus}
                                                onChange={e => setCorrStatus(e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="CLOCKED_OUT">Clocked Out</option>
                                                <option value="CLOCKED_IN">Clocked In</option>
                                                <option value="ON_BREAK">On Break</option>
                                                <option value="ABSENT">Absent</option>
                                                <option value="EXCUSED">Excused</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Approval Status</label>
                                            <select
                                                value={corrApproval}
                                                onChange={e => setCorrApproval(e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="APPROVED">Approved</option>
                                                <option value="SUBMITTED">Submitted</option>
                                                <option value="CORRECTION_REQUIRED">Correction Required</option>
                                                <option value="REJECTED">Rejected</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Correction Reason <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea
                                            value={corrReason}
                                            onChange={e => setCorrReason(e.target.value)}
                                            placeholder="Mandatory reason for updating attendance logs (saved to immutable audit history)..."
                                            rows={2}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                                    <button
                                        onClick={() => setCorrectionModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={submitCorrection}
                                        disabled={actionLoading}
                                        className="px-5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-md flex items-center gap-2"
                                    >
                                        {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        Apply Correction
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* AUDIT TRAIL MODAL */}
                <AnimatePresence>
                    {auditModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
                            >
                                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                                            <History className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Immutable Audit Trail</h3>
                                            <p className="text-xs text-slate-500">Record #{auditData?.attendance?.id?.substring(0, 8)}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setAuditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="overflow-y-auto flex-1 space-y-3 pr-2 text-xs">
                                    {auditLoading ? (
                                        <div className="p-8 text-center text-slate-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                                            Loading audit logs...
                                        </div>
                                    ) : !auditData?.audit_trail || auditData.audit_trail.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500">
                                            No audit entries found.
                                        </div>
                                    ) : (
                                        auditData.audit_trail.map((log: any) => (
                                            <div key={log.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-slate-900 dark:text-slate-100">{log.action}</span>
                                                    <span className="text-[10px] text-slate-400">{log.created_at ? new Date(log.created_at).toLocaleString() : ''}</span>
                                                </div>
                                                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                                    User: <span className="font-medium text-slate-800 dark:text-slate-200">{log.user_username || log.user_type || 'System'}</span>
                                                </p>
                                                {log.new_values?.correction_reason && (
                                                    <p className="text-amber-600 dark:text-amber-400 text-[11px] font-medium">
                                                        Reason: {log.new_values.correction_reason}
                                                    </p>
                                                )}
                                                {log.new_values?.rejection_reason && (
                                                    <p className="text-rose-600 dark:text-rose-400 text-[11px] font-medium">
                                                        Rejection: {log.new_values.rejection_reason}
                                                    </p>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-right">
                                    <button
                                        onClick={() => setAuditModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
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

export default StaffTimesheetApprovals;
