import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Clock, Play, Square, Coffee, CheckCircle2, 
    AlertTriangle, Calendar, Search, 
    RefreshCw, History, Edit3, 
    ChevronLeft, ChevronRight, Check, X, AlertCircle
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';


interface RosterItem {
    employee_id: string;
    employee_name: string;
    role: string;
    photo: string | null;
    classroom: { id: string; name: string } | null;
    scheduled_shift: {
        id: string;
        shift_start: string | null;
        shift_end: string | null;
        shift_type: string;
        net_working_hours: number;
    } | null;
    attendance: {
        id: string;
        clock_in: string | null;
        clock_out: string | null;
        status: string;
        approval_status: string;
        actual_working_hours: number;
        total_break_minutes: number;
        active_break: {
            id: string;
            break_start: string;
            break_type: string;
            is_paid: boolean;
        } | null;
    } | null;
    status_badge: 'WORKING' | 'ON_BREAK' | 'COMPLETED' | 'NOT_CLOCKED_IN';
    is_late: boolean;
    is_early_departure: boolean;
    is_missing_clock_out: boolean;
}

interface DashboardSummary {
    total_scheduled: number;
    clocked_in: number;
    on_break: number;
    clocked_out: number;
    not_clocked_in: number;
    late_arrivals: number;
    early_departures: number;
    missing_clock_out: number;
}

interface CurrentStaffStatus {
    employee: { id: string; name: string; role: string } | null;
    is_clocked_in: boolean;
    is_on_break: boolean;
    active_attendance: {
        id: string;
        date: string;
        clock_in: string | null;
        status: string;
        actual_working_hours: number;
        total_break_minutes: number;
        active_break: {
            id: string;
            break_start: string;
            break_type: string;
            is_paid: boolean;
        } | null;
    } | null;
    today_schedule: {
        id: string;
        shift_start: string | null;
        shift_end: string | null;
        net_working_hours: number;
    } | null;
}

const StaffAttendanceDashboard: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [summary, setSummary] = useState<DashboardSummary>({
        total_scheduled: 0,
        clocked_in: 0,
        on_break: 0,
        clocked_out: 0,
        not_clocked_in: 0,
        late_arrivals: 0,
        early_departures: 0,
        missing_clock_out: 0
    });
    const [roster, setRoster] = useState<RosterItem[]>([]);
    const [currentStatus, setCurrentStatus] = useState<CurrentStaffStatus | null>(null);
    const [classrooms, setClassrooms] = useState<{ id: string; room_name: string }[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Live Ticker for Elapsed Working & Break Time
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Audit Modal State
    const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);
    const [auditLoading, setAuditLoading] = useState<boolean>(false);
    const [auditData, setAuditData] = useState<any>(null);

    // Correction Modal State
    const [correctionModalOpen, setCorrectionModalOpen] = useState<boolean>(false);
    const [correctionTarget, setCorrectionTarget] = useState<RosterItem | null>(null);
    const [corrClockIn, setCorrClockIn] = useState<string>('');
    const [corrClockOut, setCorrClockOut] = useState<string>('');
    const [corrStatus, setCorrStatus] = useState<string>('CLOCKED_OUT');
    const [corrReason, setCorrReason] = useState<string>('');
    const [corrNotes, setCorrNotes] = useState<string>('');

    // Fetch Initial Classrooms
    useEffect(() => {
        const fetchClassrooms = async () => {
            try {
                const res = await api.get('/classrooms/');
                const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
                setClassrooms(data);
            } catch (err) {
                console.error("Failed to load classrooms:", err);
            }
        };
        fetchClassrooms();
    }, []);

    // Fetch Dashboard Data & My Current Status
    const fetchData = async () => {
        setLoading(true);
        try {
            const [dashRes, statusRes] = await Promise.all([
                api.get('/daycare/staff/attendance/dashboard/', {
                    params: {
                        date: selectedDate,
                        classroom_id: selectedClassroom !== 'all' ? selectedClassroom : undefined
                    }
                }),
                api.get('/daycare/staff/attendance/current-status/')
            ]);

            setSummary(dashRes.data.summary);
            setRoster(dashRes.data.roster);
            setCurrentStatus(statusRes.data);
        } catch (err: any) {
            console.error("Failed to fetch staff attendance dashboard:", err);
            showToast(err.response?.data?.detail || "Failed to load staff attendance data", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedDate, selectedClassroom]);

    const showToast = (text: string, type: 'success' | 'error') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    const extractErrorMessage = (err: any, defaultMsg: string) => {
        if (!err.response?.data) return defaultMsg;
        const data = err.response.data;
        if (typeof data === 'string') return data;
        if (data.detail) return data.detail;
        if (data.error) return data.error;
        if (data.clock_in) return Array.isArray(data.clock_in) ? data.clock_in[0] : data.clock_in;
        if (data.clock_out) return Array.isArray(data.clock_out) ? data.clock_out[0] : data.clock_out;
        if (data.break) return Array.isArray(data.break) ? data.break[0] : data.break;
        if (data.employee_id) return Array.isArray(data.employee_id) ? data.employee_id[0] : data.employee_id;
        if (data.employee) return Array.isArray(data.employee) ? data.employee[0] : data.employee;
        if (data.leave) return Array.isArray(data.leave) ? data.leave[0] : data.leave;
        const firstKey = Object.keys(data)[0];
        if (firstKey) {
            const val = data[firstKey];
            return `${firstKey}: ${Array.isArray(val) ? val[0] : val}`;
        }
        return defaultMsg;
    };

    // Quick Actions
    const handleClockIn = async (employeeId?: string | null) => {
        setActionLoading(true);
        try {
            const empId = typeof employeeId === 'string' ? employeeId : currentStatus?.employee?.id;
            await api.post('/daycare/staff/attendance/clock-in/', {
                employee_id: empId || undefined
            });
            showToast("Successfully clocked in! Have a great shift.", "success");
            fetchData();
        } catch (err: any) {
            showToast(extractErrorMessage(err, "Failed to clock in"), "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleClockOut = async (attendanceId?: string | null) => {
        setActionLoading(true);
        try {
            const attId = typeof attendanceId === 'string' ? attendanceId : currentStatus?.active_attendance?.id;
            await api.post('/daycare/staff/attendance/clock-out/', {
                attendance_id: attId || undefined
            });
            showToast("Successfully clocked out! Shift recorded.", "success");
            fetchData();
        } catch (err: any) {
            showToast(extractErrorMessage(err, "Failed to clock out"), "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleStartBreak = async (breakType = 'MEAL', isPaid = false, attendanceId?: string | null) => {
        setActionLoading(true);
        try {
            const attId = typeof attendanceId === 'string' ? attendanceId : currentStatus?.active_attendance?.id;
            await api.post('/daycare/staff/attendance/start-break/', {
                attendance_id: attId || undefined,
                break_type: breakType,
                is_paid: isPaid
            });
            showToast(`Break started (${breakType}). Enjoy your break!`, "success");
            fetchData();
        } catch (err: any) {
            showToast(extractErrorMessage(err, "Failed to start break"), "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleEndBreak = async (attendanceId?: string | null) => {
        setActionLoading(true);
        try {
            const attId = typeof attendanceId === 'string' ? attendanceId : currentStatus?.active_attendance?.id;
            await api.post('/daycare/staff/attendance/end-break/', {
                attendance_id: attId || undefined
            });
            showToast("Break ended. Welcome back!", "success");
            fetchData();
        } catch (err: any) {
            showToast(extractErrorMessage(err, "Failed to end break"), "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Audit Modal
    const openAuditModal = async (attendanceId: string) => {
        setAuditLoading(true);
        setAuditModalOpen(true);
        try {
            const res = await api.get(`/daycare/staff/attendance/records/${attendanceId}/audit/`);
            setAuditData(res.data);
        } catch (err) {
            showToast("Failed to load audit history", "error");
        } finally {
            setAuditLoading(false);
        }
    };

    // Correction Modal
    const openCorrectionModal = (item: RosterItem) => {
        if (!item.attendance) return;
        setCorrectionTarget(item);
        setCorrClockIn(item.attendance.clock_in ? item.attendance.clock_in.substring(11, 16) : '');
        setCorrClockOut(item.attendance.clock_out ? item.attendance.clock_out.substring(11, 16) : '');
        setCorrStatus(item.attendance.status);
        setCorrReason('');
        setCorrNotes('');
        setCorrectionModalOpen(true);
    };

    const handleCorrectionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!correctionTarget || !correctionTarget.attendance) return;

        if (!corrReason.trim()) {
            showToast("A correction reason is required to modify attendance.", "error");
            return;
        }

        setActionLoading(true);
        try {
            await api.post(`/daycare/staff/attendance/records/${correctionTarget.attendance.id}/correct/`, {
                correction_reason: corrReason,
                clock_in: corrClockIn ? `${selectedDate}T${corrClockIn}:00` : null,
                clock_out: corrClockOut ? `${selectedDate}T${corrClockOut}:00` : null,
                status: corrStatus,
                notes: corrNotes
            });

            showToast("Staff attendance record corrected and audited successfully!", "success");
            setCorrectionModalOpen(false);
            fetchData();
        } catch (err: any) {
            showToast(err.response?.data?.error || err.response?.data?.detail || "Failed to correct attendance", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Calculate worked elapsed timer string for current user
    const liveTimeWorkedStr = useMemo(() => {
        if (!currentStatus?.active_attendance?.clock_in) return '00:00:00';
        const start = new Date(currentStatus.active_attendance.clock_in).getTime();
        const diffMs = Math.max(0, currentTime.getTime() - start);
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, [currentStatus, currentTime]);

    const liveBreakTimeStr = useMemo(() => {
        if (!currentStatus?.active_attendance?.active_break?.break_start) return '00:00:00';
        const start = new Date(currentStatus.active_attendance.active_break.break_start).getTime();
        const diffMs = Math.max(0, currentTime.getTime() - start);
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, [currentStatus, currentTime]);

    // Filter Roster
    const filteredRoster = useMemo(() => {
        return roster.filter(item => {
            const matchesSearch = item.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.role && item.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (item.classroom && item.classroom.name.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;

            if (statusFilter === 'all') return true;
            if (statusFilter === 'WORKING') return item.status_badge === 'WORKING';
            if (statusFilter === 'ON_BREAK') return item.status_badge === 'ON_BREAK';
            if (statusFilter === 'COMPLETED') return item.status_badge === 'COMPLETED';
            if (statusFilter === 'NOT_CLOCKED_IN') return item.status_badge === 'NOT_CLOCKED_IN';
            if (statusFilter === 'LATE') return item.is_late;
            if (statusFilter === 'MISSING_CLOCK_OUT') return item.is_missing_clock_out;
            return true;
        });
    }, [roster, searchQuery, statusFilter]);

    const formatTimeDisplay = (isoOrTime: string | null) => {
        if (!isoOrTime) return '--:--';
        if (isoOrTime.includes('T')) {
            const d = new Date(isoOrTime);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return isoOrTime.substring(0, 5);
    };

    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    return (
        <Layout>
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Staff Attendance & Time Tracking</h1>
                        <p className="text-gray-500 text-sm mt-1">Live clocking, meal/rest breaks, planned schedule variances, and timesheet approvals.</p>
                    </div>

                    {/* Quick Date Switcher */}
                    <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs">
                        <button
                            onClick={() => {
                                const d = new Date(selectedDate);
                                d.setDate(d.getDate() - 1);
                                setSelectedDate(d.toISOString().split('T')[0]);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition"
                            title="Previous Day"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-slate-900 font-medium text-sm px-2 focus:outline-none cursor-pointer"
                        />
                        <button
                            onClick={() => {
                                const d = new Date(selectedDate);
                                d.setDate(d.getDate() + 1);
                                setSelectedDate(d.toISOString().split('T')[0]);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition"
                            title="Next Day"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        {!isToday && (
                            <button
                                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                                className="px-2.5 py-1 text-xs font-semibold bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 rounded-lg transition"
                            >
                                Today
                            </button>
                        )}
                        <button
                            onClick={fetchData}
                            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition"
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

                {/* Mobile / Tablet Quick-Action Control Banner (Part I) */}
                <div className="bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-950 p-6 rounded-2xl border border-indigo-900/40 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
                        {/* Status Widget */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">My Active Time Tracker</span>
                                {currentStatus?.is_clocked_in && (
                                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                        On Duty (Working)
                                    </span>
                                )}
                                {currentStatus?.is_on_break && (
                                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                                        <Coffee className="w-3.5 h-3.5" />
                                        Currently On Break
                                    </span>
                                )}
                                {!currentStatus?.is_clocked_in && !currentStatus?.is_on_break && (
                                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                        Off Duty (Not Clocked In)
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap items-baseline gap-4">
                                <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                                    {currentStatus?.is_on_break ? liveBreakTimeStr : liveTimeWorkedStr}
                                </div>
                                <div className="text-xs text-slate-400">
                                    {currentStatus?.is_on_break ? (
                                        <span className="text-amber-400 font-medium">Break Duration ({currentStatus.active_attendance?.active_break?.break_type})</span>
                                    ) : currentStatus?.is_clocked_in ? (
                                        <span>Clocked in at <strong className="text-slate-200">{formatTimeDisplay(currentStatus.active_attendance?.clock_in || null)}</strong></span>
                                    ) : (
                                        <span>Ready to start shift</span>
                                    )}
                                </div>
                            </div>

                            {currentStatus?.today_schedule && (
                                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                                    Scheduled Today: <strong className="text-slate-200">{formatTimeDisplay(currentStatus.today_schedule.shift_start)} – {formatTimeDisplay(currentStatus.today_schedule.shift_end)}</strong> ({currentStatus.today_schedule.net_working_hours}h)
                                </p>
                            )}
                        </div>

                        {/* Big Touch-Friendly Action Controls */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
                            {/* CLOCK IN */}
                            <button
                                onClick={() => handleClockIn()}
                                disabled={actionLoading || currentStatus?.is_clocked_in || currentStatus?.is_on_break}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl font-bold text-sm transition-all shadow-lg ${
                                    !currentStatus?.is_clocked_in && !currentStatus?.is_on_break
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 scale-100 hover:scale-[1.02] cursor-pointer'
                                        : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-50'
                                }`}
                            >
                                <Play className="w-6 h-6 mb-1 text-emerald-300" />
                                <span>CLOCK IN</span>
                            </button>

                            {/* START BREAK */}
                            <button
                                onClick={() => handleStartBreak('MEAL', false)}
                                disabled={actionLoading || !currentStatus?.is_clocked_in || currentStatus?.is_on_break}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl font-bold text-sm transition-all shadow-lg ${
                                    currentStatus?.is_clocked_in && !currentStatus?.is_on_break
                                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30 scale-100 hover:scale-[1.02] cursor-pointer'
                                        : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-50'
                                }`}
                            >
                                <Coffee className="w-6 h-6 mb-1 text-amber-300" />
                                <span>START BREAK</span>
                            </button>

                            {/* END BREAK */}
                            <button
                                onClick={() => handleEndBreak()}
                                disabled={actionLoading || !currentStatus?.is_on_break}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl font-bold text-sm transition-all shadow-lg ${
                                    currentStatus?.is_on_break
                                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 scale-100 hover:scale-[1.02] cursor-pointer animate-pulse'
                                        : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-50'
                                }`}
                            >
                                <CheckCircle2 className="w-6 h-6 mb-1 text-indigo-300" />
                                <span>END BREAK</span>
                            </button>

                            {/* CLOCK OUT */}
                            <button
                                onClick={() => handleClockOut()}
                                disabled={actionLoading || (!currentStatus?.is_clocked_in && !currentStatus?.is_on_break)}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl font-bold text-sm transition-all shadow-lg ${
                                    currentStatus?.is_clocked_in || currentStatus?.is_on_break
                                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 scale-100 hover:scale-[1.02] cursor-pointer'
                                        : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-50'
                                }`}
                            >
                                <Square className="w-6 h-6 mb-1 text-rose-300" />
                                <span>CLOCK OUT</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* KPI Metrics Summary (Part H) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                        <div className="text-slate-400 text-xs font-medium">Scheduled</div>
                        <div className="text-2xl font-bold text-white mt-1">{summary.total_scheduled}</div>
                    </div>

                    <div className="bg-emerald-950/30 p-4 rounded-xl border border-emerald-900/40">
                        <div className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Clocked In
                        </div>
                        <div className="text-2xl font-bold text-emerald-300 mt-1">{summary.clocked_in}</div>
                    </div>

                    <div className="bg-amber-950/30 p-4 rounded-xl border border-amber-900/40">
                        <div className="text-amber-400 text-xs font-medium flex items-center gap-1">
                            <Coffee className="w-3.5 h-3.5" /> On Break
                        </div>
                        <div className="text-2xl font-bold text-amber-300 mt-1">{summary.on_break}</div>
                    </div>

                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                        <div className="text-slate-400 text-xs font-medium">Completed</div>
                        <div className="text-2xl font-bold text-slate-300 mt-1">{summary.clocked_out}</div>
                    </div>

                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                        <div className="text-slate-400 text-xs font-medium">Not Clocked In</div>
                        <div className="text-2xl font-bold text-slate-400 mt-1">{summary.not_clocked_in}</div>
                    </div>

                    <div className="bg-orange-950/30 p-4 rounded-xl border border-orange-900/40">
                        <div className="text-orange-400 text-xs font-medium">Late Staff</div>
                        <div className="text-2xl font-bold text-orange-300 mt-1">{summary.late_arrivals}</div>
                    </div>

                    <div className="bg-blue-950/30 p-4 rounded-xl border border-blue-900/40">
                        <div className="text-blue-400 text-xs font-medium">Early Departures</div>
                        <div className="text-2xl font-bold text-blue-300 mt-1">{summary.early_departures}</div>
                    </div>

                    <div className="bg-rose-950/30 p-4 rounded-xl border border-rose-900/40">
                        <div className="text-rose-400 text-xs font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Missing Clock-Out
                        </div>
                        <div className="text-2xl font-bold text-rose-300 mt-1">{summary.missing_clock_out}</div>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative min-w-[240px]">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search staff or classroom..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-800/80 text-white text-sm pl-9 pr-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <select
                            value={selectedClassroom}
                            onChange={(e) => setSelectedClassroom(e.target.value)}
                            className="bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="all">All Classrooms</option>
                            {classrooms.map(c => (
                                <option key={c.id} value={c.id}>{c.room_name}</option>
                            ))}
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="all">All Statuses</option>
                            <option value="WORKING">Working (Clocked In)</option>
                            <option value="ON_BREAK">On Break</option>
                            <option value="COMPLETED">Completed (Clocked Out)</option>
                            <option value="NOT_CLOCKED_IN">Not Clocked In</option>
                            <option value="LATE">Late Arrivals</option>
                            <option value="MISSING_CLOCK_OUT">Missing Clock-Out</option>
                        </select>
                    </div>

                    <div className="text-xs text-slate-400 font-medium">
                        Showing {filteredRoster.length} staff records
                    </div>
                </div>

                {/* Staff Attendance Roster Table */}
                <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Employee</th>
                                    <th className="px-4 py-4">Classroom</th>
                                    <th className="px-4 py-4">Scheduled Shift</th>
                                    <th className="px-4 py-4">Clock In</th>
                                    <th className="px-4 py-4">Clock Out</th>
                                    <th className="px-4 py-4">Break Time</th>
                                    <th className="px-4 py-4">Actual Hours</th>
                                    <th className="px-4 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                                            Loading staff attendance roster...
                                        </td>
                                    </tr>
                                ) : filteredRoster.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                                            No staff attendance records match your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRoster.map((item) => (
                                        <tr key={item.employee_id} className="hover:bg-slate-800/40 transition-colors">
                                            {/* Employee */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white overflow-hidden text-sm">
                                                        {item.photo ? (
                                                            <img src={item.photo} alt={item.employee_name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            item.employee_name.charAt(0)
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-white">{item.employee_name}</p>
                                                        <p className="text-xs text-slate-400">{item.role || 'Staff Member'}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Classroom */}
                                            <td className="px-4 py-4">
                                                {item.classroom ? (
                                                    <span className="text-xs font-medium text-slate-300 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700">
                                                        {item.classroom.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-500">Floating / General</span>
                                                )}
                                            </td>

                                            {/* Scheduled Shift (Part F) */}
                                            <td className="px-4 py-4">
                                                {item.scheduled_shift ? (
                                                    <div className="text-xs">
                                                        <p className="font-semibold text-slate-200">
                                                            {formatTimeDisplay(item.scheduled_shift.shift_start)} – {formatTimeDisplay(item.scheduled_shift.shift_end)}
                                                        </p>
                                                        <p className="text-[11px] text-slate-400 capitalize">{item.scheduled_shift.shift_type} ({item.scheduled_shift.net_working_hours}h)</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-500 italic">Unscheduled</span>
                                                )}
                                            </td>

                                            {/* Clock In */}
                                            <td className="px-4 py-4">
                                                {item.attendance?.clock_in ? (
                                                    <div>
                                                        <span className="font-mono font-medium text-white text-xs">
                                                            {formatTimeDisplay(item.attendance.clock_in)}
                                                        </span>
                                                        {item.is_late && (
                                                            <span className="block text-[10px] text-orange-400 font-semibold">Late</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 text-xs">--:--</span>
                                                )}
                                            </td>

                                            {/* Clock Out */}
                                            <td className="px-4 py-4">
                                                {item.attendance?.clock_out ? (
                                                    <div>
                                                        <span className="font-mono font-medium text-white text-xs">
                                                            {formatTimeDisplay(item.attendance.clock_out)}
                                                        </span>
                                                        {item.is_early_departure && (
                                                            <span className="block text-[10px] text-blue-400 font-semibold">Early Exit</span>
                                                        )}
                                                    </div>
                                                ) : item.is_missing_clock_out ? (
                                                    <span className="text-rose-400 text-xs font-semibold flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" /> Missing Out
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500 text-xs">--:--</span>
                                                )}
                                            </td>

                                            {/* Break Time */}
                                            <td className="px-4 py-4">
                                                {item.attendance ? (
                                                    item.status_badge === 'ON_BREAK' ? (
                                                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse font-medium">
                                                            <Coffee className="w-3 h-3" /> Break Running
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-300">
                                                            {item.attendance.total_break_minutes > 0 ? `${item.attendance.total_break_minutes} min` : '0 min'}
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-slate-500 text-xs">-</span>
                                                )}
                                            </td>

                                            {/* Actual Working Hours (Part E) */}
                                            <td className="px-4 py-4">
                                                {item.attendance?.clock_out ? (
                                                    <span className="font-semibold text-emerald-400 text-xs">
                                                        {item.attendance.actual_working_hours.toFixed(2)} hrs
                                                    </span>
                                                ) : item.attendance?.clock_in ? (
                                                    <span className="text-xs text-slate-400 italic">In progress</span>
                                                ) : (
                                                    <span className="text-slate-500 text-xs">0.00 hrs</span>
                                                )}
                                            </td>

                                            {/* Status Badge */}
                                            <td className="px-4 py-4">
                                                {item.status_badge === 'WORKING' && (
                                                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        Working
                                                    </span>
                                                )}
                                                {item.status_badge === 'ON_BREAK' && (
                                                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                        On Break
                                                    </span>
                                                )}
                                                {item.status_badge === 'COMPLETED' && (
                                                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                                        Completed
                                                    </span>
                                                )}
                                                {item.status_badge === 'NOT_CLOCKED_IN' && (
                                                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                        Not In
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {item.status_badge === 'NOT_CLOCKED_IN' && (
                                                        <button
                                                            onClick={() => handleClockIn(item.employee_id)}
                                                            disabled={actionLoading}
                                                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg transition flex items-center gap-1 shadow-xs"
                                                            title="Clock In this staff member"
                                                        >
                                                            <Play className="w-3 h-3 text-emerald-200" /> Clock In
                                                        </button>
                                                    )}
                                                    {item.status_badge === 'WORKING' && item.attendance && (
                                                        <>
                                                            <button
                                                                onClick={() => handleStartBreak('MEAL', false, item.attendance!.id)}
                                                                disabled={actionLoading}
                                                                className="px-2 py-1 text-xs font-semibold bg-amber-600/90 hover:bg-amber-500 text-white rounded-lg transition flex items-center gap-1 shadow-xs"
                                                                title="Start Break"
                                                            >
                                                                <Coffee className="w-3 h-3 text-amber-200" /> Break
                                                            </button>
                                                            <button
                                                                onClick={() => handleClockOut(item.attendance!.id)}
                                                                disabled={actionLoading}
                                                                className="px-2 py-1 text-xs font-semibold bg-rose-600/90 hover:bg-rose-500 text-white rounded-lg transition flex items-center gap-1 shadow-xs"
                                                                title="Clock Out"
                                                            >
                                                                <Square className="w-3 h-3 text-rose-200" /> Out
                                                            </button>
                                                        </>
                                                    )}
                                                    {item.status_badge === 'ON_BREAK' && item.attendance && (
                                                        <button
                                                            onClick={() => handleEndBreak(item.attendance!.id)}
                                                            disabled={actionLoading}
                                                            className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition flex items-center gap-1 shadow-xs animate-pulse"
                                                            title="End Break"
                                                        >
                                                            <CheckCircle2 className="w-3 h-3 text-indigo-200" /> End Break
                                                        </button>
                                                    )}
                                                    {item.attendance && (
                                                        <>
                                                            <button
                                                                onClick={() => openCorrectionModal(item)}
                                                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                                                                title="Admin Correction"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => openAuditModal(item.attendance!.id)}
                                                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-lg transition"
                                                                title="View Audit Trail"
                                                            >
                                                                <History className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
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
                    {correctionModalOpen && correctionTarget && (
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
                                            <h3 className="font-bold text-white text-base">Controlled Attendance Correction</h3>
                                            <p className="text-xs text-slate-400">Admin audit trail will record all adjustments.</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setCorrectionModalOpen(false)} className="text-slate-400 hover:text-white">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleCorrectionSubmit} className="p-6 space-y-4">
                                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1">
                                        <p className="text-slate-400">Employee: <strong className="text-white">{correctionTarget.employee_name}</strong></p>
                                        <p className="text-slate-400">Date: <strong className="text-white">{selectedDate}</strong></p>
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

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1">Shift Status</label>
                                        <select
                                            value={corrStatus}
                                            onChange={(e) => setCorrStatus(e.target.value)}
                                            className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                                        >
                                            <option value="CLOCKED_IN">Clocked In (Working)</option>
                                            <option value="ON_BREAK">On Break</option>
                                            <option value="CLOCKED_OUT">Clocked Out (Completed)</option>
                                            <option value="ABSENT">Absent</option>
                                            <option value="EXCUSED">Excused Absence</option>
                                        </select>
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
                                        <label className="block text-xs font-semibold text-slate-300 mb-1">Administrative Notes</label>
                                        <input
                                            type="text"
                                            value={corrNotes}
                                            onChange={(e) => setCorrNotes(e.target.value)}
                                            placeholder="Optional internal remarks..."
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
                                            <h3 className="font-bold text-white text-base">Attendance Audit Trail</h3>
                                            <p className="text-xs text-slate-400">Complete chronological change log with diff snapshots.</p>
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
                                            Loading audit records...
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
                                                    Performed By: <strong className="text-white">{log.user?.first_name || log.user?.username || 'System'}</strong> ({log.user_type || 'User'})
                                                </p>
                                                {log.old_values && (
                                                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 overflow-x-auto">
                                                        <span className="text-rose-400 font-semibold block mb-1">Old Values:</span>
                                                        <pre>{JSON.stringify(log.old_values, null, 2)}</pre>
                                                    </div>
                                                )}
                                                {log.new_values && (
                                                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 overflow-x-auto">
                                                        <span className="text-emerald-400 font-semibold block mb-1">New Values:</span>
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

export default StaffAttendanceDashboard;
