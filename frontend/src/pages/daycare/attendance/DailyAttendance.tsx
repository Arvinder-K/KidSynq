import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Calendar, ChevronLeft, ChevronRight, Search, 
    CheckCircle2, XCircle, Clock, AlertTriangle, UserCheck, 
    UserX, LogIn, LogOut, FileText, RefreshCw,
    Users, AlertCircle, Building2, CalendarCheck, CalendarDays,
    History, Edit3, ShieldCheck
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api, { BACKEND_URL } from '../../../api';

interface ClassroomInfo {
    id: string;
    room_name: string;
    room_code?: string;
}

interface EnrollmentInfo {
    id: string;
    status: string;
    start_date?: string;
}

interface AttendanceInfo {
    id: string | null;
    attendance_date: string;
    attendance_status: string;
    check_in_time: string | null;
    check_out_time: string | null;
    is_late: boolean;
    is_early_pickup: boolean;
    arrival_type: string | null;
    departure_type: string | null;
    late_reason: string | null;
    early_pickup_reason: string | null;
    remarks: string | null;
    received_by_name: string | null;
    released_by_name: string | null;
    pickup_person_name: string | null;
    is_corrected?: boolean;
    correction_reason?: string | null;
    corrected_by_name?: string | null;
    corrected_at?: string | null;
    excused_reason_type?: string | null;
    supporting_document_title?: string | null;
}

interface RosterItem {
    student_id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    admission_number?: string;
    photo?: string;
    status: string;
    classroom: ClassroomInfo | null;
    enrollment: EnrollmentInfo | null;
    attendance: AttendanceInfo | null;
    is_checked_in: boolean;
    is_checked_out: boolean;
}

interface AttendanceSummary {
    date: string;
    total_children: number;
    present_count: number;
    absent_count: number;
    excused_absence_count: number;
    late_count: number;
    early_pickup_count: number;
    checked_in_count: number;
    checked_out_count: number;
    unmarked_count: number;
}

interface AuthorizedPickup {
    id: string;
    name: string;
    relationship: string;
    phone: string;
}

interface AuditLogItem {
    id: string;
    user_name: string;
    user_type: string;
    action: string;
    module: string;
    old_values: Record<string, any> | null;
    new_values: Record<string, any> | null;
    created_at: string;
}

interface AuditData {
    attendance_id: string;
    student_name: string;
    attendance_date: string;
    current_status: string;
    is_corrected: boolean;
    correction_reason: string | null;
    corrected_by_name: string | null;
    corrected_at: string | null;
    logs: AuditLogItem[];
}

export const DailyAttendance: React.FC = () => {
    const [currentDate, setCurrentDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [roster, setRoster] = useState<RosterItem[]>([]);
    const [summary, setSummary] = useState<AttendanceSummary | null>(null);
    const [classrooms, setClassrooms] = useState<ClassroomInfo[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Modal States
    const [activeModal, setActiveModal] = useState<'check_in' | 'check_out' | 'mark_absent' | 'mark_excused' | 'correct' | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<RosterItem | null>(null);
    const [customTime, setCustomTime] = useState<string>('');
    const [customOutTime, setCustomOutTime] = useState<string>('');
    const [remarksInput, setRemarksInput] = useState<string>('');
    const [lateReasonInput, setLateReasonInput] = useState<string>('');
    const [earlyReasonInput, setEarlyReasonInput] = useState<string>('');
    const [excusedReasonTypeInput, setExcusedReasonTypeInput] = useState<string>('OTHER');
    const [correctionReasonInput, setCorrectionReasonInput] = useState<string>('');
    const [correctStatusInput, setCorrectStatusInput] = useState<string>('PRESENT');
    const [correctIsLate, setCorrectIsLate] = useState<boolean>(false);
    const [correctIsEarly, setCorrectIsEarly] = useState<boolean>(false);
    const [authorizedPickups, setAuthorizedPickups] = useState<AuthorizedPickup[]>([]);
    const [selectedPickupId, setSelectedPickupId] = useState<string>('');

    // Audit Modal State
    const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);
    const [auditData, setAuditData] = useState<AuditData | null>(null);
    const [auditLoading, setAuditLoading] = useState<boolean>(false);

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    const getImageUrl = (url?: string) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const fetchClassrooms = async () => {
        try {
            const res = await api.get('/daycare/classrooms/');
            const results = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setClassrooms(results);
        } catch (error) {
            console.error('Failed to load classrooms', error);
        }
    };

    const fetchDailyAttendance = async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { date: currentDate };
            if (selectedClassroom !== 'all') {
                params.classroom_id = selectedClassroom;
            }
            if (searchQuery.trim()) {
                params.search = searchQuery.trim();
            }
            if (statusFilter !== 'all') {
                params.status = statusFilter;
            }

            const res = await api.get('/daycare/attendance/daily/', { params });
            setRoster(res.data.roster || []);
            setSummary(res.data.summary || null);
        } catch (error: any) {
            console.error('Failed to fetch daily attendance', error);
            showToast(error?.response?.data?.detail || 'Failed to fetch attendance roster.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClassrooms();
    }, []);

    useEffect(() => {
        fetchDailyAttendance();
    }, [currentDate, selectedClassroom, statusFilter]);

    // Handle Search with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchDailyAttendance();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleDateShift = (days: number) => {
        const d = new Date(currentDate + 'T00:00:00');
        d.setDate(d.getDate() + days);
        setCurrentDate(d.toISOString().split('T')[0]);
    };

    const handleTodayClick = () => {
        setCurrentDate(new Date().toISOString().split('T')[0]);
    };

    const getCurrentTimeStr = () => {
        const now = new Date();
        return now.toTimeString().slice(0, 5); // HH:MM
    };

    // Open Modals
    const openCheckInModal = (student: RosterItem) => {
        setSelectedStudent(student);
        setCustomTime(getCurrentTimeStr());
        setRemarksInput('');
        setLateReasonInput('');
        setActiveModal('check_in');
    };

    const openCheckOutModal = async (student: RosterItem) => {
        setSelectedStudent(student);
        setCustomTime(getCurrentTimeStr());
        setRemarksInput('');
        setEarlyReasonInput('');
        setSelectedPickupId('');
        setActiveModal('check_out');

        // Fetch authorized pickups for this child
        try {
            const res = await api.get(`/students/${student.student_id}/pickups/`);
            const pickups = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setAuthorizedPickups(pickups);
        } catch (error) {
            console.error('Failed to fetch pickups', error);
            setAuthorizedPickups([]);
        }
    };

    const openAbsentModal = (student: RosterItem) => {
        setSelectedStudent(student);
        setRemarksInput('');
        setActiveModal('mark_absent');
    };

    const openExcusedModal = (student: RosterItem) => {
        setSelectedStudent(student);
        setRemarksInput('');
        setExcusedReasonTypeInput('OTHER');
        setActiveModal('mark_excused');
    };

    const openCorrectionModal = (student: RosterItem) => {
        const att = student.attendance;
        if (!att || !att.id) {
            showToast('No existing attendance record for this date to correct.', 'error');
            return;
        }
        setSelectedStudent(student);
        setCorrectStatusInput(att.attendance_status || 'PRESENT');
        setCustomTime(att.check_in_time ? att.check_in_time.slice(0, 5) : '');
        setCustomOutTime(att.check_out_time ? att.check_out_time.slice(0, 5) : '');
        setCorrectIsLate(att.is_late || false);
        setLateReasonInput(att.late_reason || '');
        setCorrectIsEarly(att.is_early_pickup || false);
        setEarlyReasonInput(att.early_pickup_reason || '');
        setExcusedReasonTypeInput(att.excused_reason_type || 'OTHER');
        setRemarksInput(att.remarks || '');
        setCorrectionReasonInput('');
        setActiveModal('correct');
    };

    const openAuditHistoryModal = async (attendanceId: string) => {
        setAuditLoading(true);
        setAuditModalOpen(true);
        try {
            const res = await api.get(`/daycare/attendance/records/${attendanceId}/audit/`);
            setAuditData(res.data);
        } catch (error: any) {
            console.error('Failed to load audit history', error);
            showToast('Failed to load audit history.', 'error');
        } finally {
            setAuditLoading(false);
        }
    };

    // Execute Actions
    const handleQuickCheckIn = async (student: RosterItem) => {
        setActionLoading(student.student_id);
        try {
            await api.post('/daycare/attendance/check-in/', {
                student_id: student.student_id,
                date: currentDate,
            });
            showToast(`${student.first_name} checked in successfully.`);
            await fetchDailyAttendance();
        } catch (error: any) {
            showToast(error?.response?.data?.detail || error?.response?.data?.[0] || 'Check-in failed.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleQuickCheckOut = async (student: RosterItem) => {
        setActionLoading(student.student_id);
        try {
            await api.post('/daycare/attendance/check-out/', {
                student_id: student.student_id,
                date: currentDate,
            });
            showToast(`${student.first_name} checked out successfully.`);
            await fetchDailyAttendance();
        } catch (error: any) {
            showToast(error?.response?.data?.detail || error?.response?.data?.[0] || 'Check-out failed.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleModalCheckInSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudent) return;
        setActionLoading(selectedStudent.student_id);
        try {
            await api.post('/daycare/attendance/check-in/', {
                student_id: selectedStudent.student_id,
                date: currentDate,
                check_in_time: customTime ? `${customTime}:00` : undefined,
                late_reason: lateReasonInput || undefined,
                remarks: remarksInput || undefined,
            });
            showToast(`${selectedStudent.first_name} checked in successfully.`);
            setActiveModal(null);
            await fetchDailyAttendance();
        } catch (error: any) {
            showToast(error?.response?.data?.detail || 'Check-in failed.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleModalCheckOutSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudent) return;
        setActionLoading(selectedStudent.student_id);
        try {
            await api.post('/daycare/attendance/check-out/', {
                student_id: selectedStudent.student_id,
                date: currentDate,
                check_out_time: customTime ? `${customTime}:00` : undefined,
                pickup_person_id: selectedPickupId || undefined,
                early_pickup_reason: earlyReasonInput || undefined,
                remarks: remarksInput || undefined,
            });
            showToast(`${selectedStudent.first_name} checked out successfully.`);
            setActiveModal(null);
            await fetchDailyAttendance();
        } catch (error: any) {
            showToast(error?.response?.data?.detail || 'Check-out failed.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleModalAbsentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudent) return;
        setActionLoading(selectedStudent.student_id);
        try {
            await api.post('/daycare/attendance/mark-absent/', {
                student_id: selectedStudent.student_id,
                date: currentDate,
                remarks: remarksInput || 'Marked absent',
            });
            showToast(`${selectedStudent.first_name} marked as Absent.`);
            setActiveModal(null);
            await fetchDailyAttendance();
        } catch (error: any) {
            showToast(error?.response?.data?.detail || 'Failed to mark absent.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleModalExcusedSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudent) return;
        setActionLoading(selectedStudent.student_id);
        try {
            await api.post('/daycare/attendance/mark-excused/', {
                student_id: selectedStudent.student_id,
                date: currentDate,
                excused_reason_type: excusedReasonTypeInput || 'OTHER',
                remarks: remarksInput || 'Excused absence',
            });
            showToast(`${selectedStudent.first_name} marked as Excused Absence.`);
            setActiveModal(null);
            await fetchDailyAttendance();
        } catch (error: any) {
            showToast(error?.response?.data?.detail || 'Failed to mark excused absence.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleModalCorrectionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudent || !selectedStudent.attendance?.id) return;
        if (!correctionReasonInput.trim()) {
            showToast('Correction reason is mandatory.', 'error');
            return;
        }

        setActionLoading(selectedStudent.student_id);
        try {
            await api.post(`/daycare/attendance/records/${selectedStudent.attendance.id}/correct/`, {
                correction_reason: correctionReasonInput.trim(),
                check_in_time: customTime ? `${customTime}:00` : null,
                check_out_time: customOutTime ? `${customOutTime}:00` : null,
                attendance_status: correctStatusInput,
                is_late: correctIsLate,
                late_reason: lateReasonInput || undefined,
                is_early_pickup: correctIsEarly,
                early_pickup_reason: earlyReasonInput || undefined,
                excused_reason_type: correctStatusInput === 'EXCUSED_ABSENCE' ? excusedReasonTypeInput : undefined,
                remarks: remarksInput || undefined,
            });
            showToast(`Attendance record corrected successfully.`);
            setActiveModal(null);
            await fetchDailyAttendance();
        } catch (error: any) {
            console.error('Correction failed', error);
            showToast(error?.response?.data?.detail || error?.response?.data?.correction_reason?.[0] || 'Correction failed.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const formatTimeDisplay = (timeStr?: string | null) => {
        if (!timeStr) return '--:--';
        try {
            const parts = timeStr.split(':');
            let h = parseInt(parts[0], 10);
            const m = parts[1];
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${h}:${m} ${ampm}`;
        } catch {
            return timeStr;
        }
    };

    const formatDateDisplay = (dateStr: string) => {
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    const getStatusBadge = (item: RosterItem) => {
        const att = item.attendance;
        if (!att || att.attendance_status === 'UNMARKED') {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    Not Arrived
                </span>
            );
        }

        const statusUpper = att.attendance_status.toUpperCase();

        if (statusUpper === 'ABSENT') {
            return (
                <div className="flex items-center space-x-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="w-3 h-3 mr-1 text-rose-500" />
                        Absent
                    </span>
                    {att.is_corrected && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-200" title={`Corrected: ${att.correction_reason}`}>
                            CORRECTED
                        </span>
                    )}
                </div>
            );
        }

        if (statusUpper === 'EXCUSED_ABSENCE' || statusUpper === 'EXCUSED') {
            return (
                <div className="flex items-center space-x-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3 h-3 mr-1 text-amber-500" />
                        Excused
                    </span>
                    {att.is_corrected && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-200" title={`Corrected: ${att.correction_reason}`}>
                            CORRECTED
                        </span>
                    )}
                </div>
            );
        }

        if (statusUpper === 'LATE' || att.is_late) {
            return (
                <div className="flex items-center space-x-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                        <Clock className="w-3 h-3 mr-1 text-orange-500" />
                        Late Arrival
                    </span>
                    {att.is_corrected && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-200" title={`Corrected: ${att.correction_reason}`}>
                            CORRECTED
                        </span>
                    )}
                </div>
            );
        }

        if (statusUpper === 'EARLY_PICKUP' || att.is_early_pickup) {
            return (
                <div className="flex items-center space-x-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <LogOut className="w-3 h-3 mr-1 text-indigo-500" />
                        Early Pickup
                    </span>
                    {att.is_corrected && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-200" title={`Corrected: ${att.correction_reason}`}>
                            CORRECTED
                        </span>
                    )}
                </div>
            );
        }

        if (item.is_checked_out) {
            return (
                <div className="flex items-center space-x-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <CheckCircle2 className="w-3 h-3 mr-1 text-blue-500" />
                        Completed
                    </span>
                    {att.is_corrected && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-200" title={`Corrected: ${att.correction_reason}`}>
                            CORRECTED
                        </span>
                    )}
                </div>
            );
        }

        return (
            <div className="flex items-center space-x-1.5">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" />
                    Present
                </span>
                {att.is_corrected && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-200" title={`Corrected: ${att.correction_reason}`}>
                        CORRECTED
                    </span>
                )}
            </div>
        );
    };

    return (
        <Layout>
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
                
                {/* Toast Notification */}
                <AnimatePresence>
                    {toastMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center space-x-2 ${
                                toastMessage.type === 'success'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : 'bg-rose-50 border-rose-200 text-rose-800'
                            }`}
                        >
                            {toastMessage.type === 'success' ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-rose-600" />
                            )}
                            <span>{toastMessage.text}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Top Header & Date Navigation */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Daily Child Attendance</h1>
                        <p className="text-sm text-gray-500 mt-1">Real-time check-in, check-out, and attendance verification.</p>
                    </div>

                    {/* View Switcher & Date Controls */}
                    <div className="flex items-center flex-wrap gap-2.5">
                        <Link
                            to="/daycare/attendance/monthly"
                            className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition flex items-center space-x-1.5"
                        >
                            <CalendarDays className="w-4 h-4 text-indigo-600" />
                            <span>Monthly Matrix</span>
                        </Link>

                        <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                            <button
                                onClick={() => handleDateShift(-1)}
                                className="p-2 rounded-xl text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-xs transition"
                                title="Previous Day"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            <button
                                onClick={handleTodayClick}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                                    currentDate === new Date().toISOString().split('T')[0]
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                Today
                            </button>

                            <div className="flex items-center bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                                <Calendar className="w-4 h-4 text-indigo-600 mr-2" />
                                <input
                                    type="date"
                                    value={currentDate}
                                    onChange={(e) => setCurrentDate(e.target.value)}
                                    className="text-sm font-semibold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                                />
                            </div>

                            <button
                                onClick={() => handleDateShift(1)}
                                className="p-2 rounded-xl text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-xs transition"
                                title="Next Day"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>

                            <button
                                onClick={fetchDailyAttendance}
                                className="p-2 rounded-xl text-slate-600 hover:bg-white hover:text-indigo-600 transition"
                                title="Refresh Roster"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Stat Cards Grid */}
                {summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                        {/* 1. Total Enrolled */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                            <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
                                <span>Enrolled</span>
                                <Users className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="text-2xl font-bold text-slate-900 mt-1">{summary.total_children}</div>
                            <div className="text-xs text-slate-400 mt-0.5">Active children</div>
                        </div>

                        {/* 2. Present */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                            <div className="text-xs font-medium text-emerald-600 flex items-center justify-between">
                                <span>Present</span>
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div className="text-2xl font-bold text-emerald-600 mt-1">{summary.present_count}</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                                {summary.total_children > 0 ? `${Math.round((summary.present_count / summary.total_children) * 100)}% total` : '0%'}
                            </div>
                        </div>

                        {/* 3. On Site (Checked In) */}
                        <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
                            <div className="text-xs font-semibold text-emerald-700 flex items-center justify-between">
                                <span>On Site</span>
                                <LogIn className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="text-2xl font-bold text-emerald-700 mt-1">{summary.checked_in_count}</div>
                            <div className="text-xs text-emerald-600 mt-0.5">In building now</div>
                        </div>

                        {/* 4. Departed (Checked Out) */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                            <div className="text-xs font-medium text-blue-600 flex items-center justify-between">
                                <span>Checked Out</span>
                                <LogOut className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="text-2xl font-bold text-blue-600 mt-1">{summary.checked_out_count}</div>
                            <div className="text-xs text-slate-400 mt-0.5">Departed</div>
                        </div>

                        {/* 5. Late Arrivals */}
                        <div className={`bg-white p-4 rounded-2xl border shadow-2xs ${summary.late_count > 0 ? 'border-orange-200 bg-orange-50/30' : 'border-slate-100'}`}>
                            <div className="text-xs font-medium text-orange-600 flex items-center justify-between">
                                <span>Late</span>
                                <Clock className="w-4 h-4 text-orange-500" />
                            </div>
                            <div className="text-2xl font-bold text-orange-600 mt-1">{summary.late_count}</div>
                            <div className="text-xs text-slate-400 mt-0.5">After opening</div>
                        </div>

                        {/* 6. Early Pickups */}
                        <div className={`bg-white p-4 rounded-2xl border shadow-2xs ${summary.early_pickup_count > 0 ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100'}`}>
                            <div className="text-xs font-medium text-indigo-600 flex items-center justify-between">
                                <span>Early Pickup</span>
                                <UserCheck className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div className="text-2xl font-bold text-indigo-600 mt-1">{summary.early_pickup_count}</div>
                            <div className="text-xs text-slate-400 mt-0.5">Before closing</div>
                        </div>

                        {/* 7. Absent & Excused */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                            <div className="text-xs font-medium text-rose-600 flex items-center justify-between">
                                <span>Absent / Excused</span>
                                <UserX className="w-4 h-4 text-rose-500" />
                            </div>
                            <div className="text-2xl font-bold text-rose-600 mt-1">
                                {summary.absent_count + summary.excused_absence_count}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                                {summary.absent_count} abs, {summary.excused_absence_count} exc
                            </div>
                        </div>
                    </div>
                )}

                {/* Filter Toolbar */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search child name or adm #..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                            />
                        </div>

                        {/* Classroom Dropdown */}
                        <div className="relative min-w-[180px]">
                            <select
                                value={selectedClassroom}
                                onChange={(e) => setSelectedClassroom(e.target.value)}
                                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-700 font-medium cursor-pointer"
                            >
                                <option value="all">All Classrooms</option>
                                {classrooms.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.room_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Status Filter Dropdown */}
                        <div className="relative min-w-[170px]">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-700 font-medium cursor-pointer"
                            >
                                <option value="all">All Statuses</option>
                                <option value="ON_SITE">Currently On Site</option>
                                <option value="PRESENT">Present</option>
                                <option value="LATE">Late Arrival</option>
                                <option value="EARLY_PICKUP">Early Pickup</option>
                                <option value="ABSENT">Absent</option>
                                <option value="EXCUSED_ABSENCE">Excused Absence</option>
                                <option value="UNMARKED">Not Arrived</option>
                            </select>
                        </div>
                    </div>

                    <div className="text-xs text-slate-500 font-medium flex items-center space-x-1.5 self-end md:self-center">
                        <span>Showing {roster.length} children for {formatDateDisplay(currentDate)}</span>
                    </div>
                </div>

                {/* Child Attendance Roster Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
                            <p className="text-sm font-medium">Loading attendance roster...</p>
                        </div>
                    ) : roster.length === 0 ? (
                        <div className="py-20 text-center text-slate-500">
                            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <h3 className="text-base font-semibold text-slate-800">No children match criteria</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                                Adjust your classroom, search or status filters to view attendance records.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-left border-collapse">
                                <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500">
                                    <tr>
                                        <th className="px-6 py-3.5">Child</th>
                                        <th className="px-6 py-3.5">Classroom</th>
                                        <th className="px-6 py-3.5">Check-In</th>
                                        <th className="px-6 py-3.5">Check-Out</th>
                                        <th className="px-6 py-3.5">Status</th>
                                        <th className="px-6 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {roster.map((item) => {
                                        const att = item.attendance;
                                        const isActionPending = actionLoading === item.student_id;

                                        return (
                                            <tr key={item.student_id} className="hover:bg-slate-50/80 transition-colors">
                                                {/* Child Identity */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="shrink-0">
                                                            {item.photo ? (
                                                                <img
                                                                    src={getImageUrl(item.photo)}
                                                                    alt={item.first_name}
                                                                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                                                                />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                                                                    {item.first_name[0]}{item.last_name[0]}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <Link
                                                                to={`/daycare/children/${item.student_id}/attendance`}
                                                                className="font-bold text-slate-900 hover:text-indigo-600 transition"
                                                            >
                                                                {item.first_name} {item.last_name}
                                                            </Link>
                                                            <div className="text-xs text-slate-400">
                                                                Adm: {item.admission_number || 'N/A'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Classroom */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {item.classroom ? (
                                                        <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-medium">
                                                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>{item.classroom.room_name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">Unassigned</span>
                                                    )}
                                                </td>

                                                {/* Check-In */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {att?.check_in_time ? (
                                                        <div>
                                                            <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
                                                                <span>{formatTimeDisplay(att.check_in_time)}</span>
                                                                {att.is_late && (
                                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 rounded-md">
                                                                        LATE
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {att.received_by_name && (
                                                                <div className="text-[11px] text-slate-400">by {att.received_by_name}</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">--:--</span>
                                                    )}
                                                </td>

                                                {/* Check-Out */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {att?.check_out_time ? (
                                                        <div>
                                                            <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
                                                                <span>{formatTimeDisplay(att.check_out_time)}</span>
                                                                {att.is_early_pickup && (
                                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-md">
                                                                        EARLY
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {att.pickup_person_name ? (
                                                                <div className="text-[11px] text-slate-500">to {att.pickup_person_name}</div>
                                                            ) : att.released_by_name ? (
                                                                <div className="text-[11px] text-slate-400">by {att.released_by_name}</div>
                                                            ) : null}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">--:--</span>
                                                    )}
                                                </td>

                                                {/* Status Badge */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {getStatusBadge(item)}
                                                </td>

                                                {/* Action Buttons */}
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        {/* If not checked in and not absent */}
                                                        {!item.is_checked_in && !item.is_checked_out && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleQuickCheckIn(item)}
                                                                    disabled={isActionPending}
                                                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center space-x-1 disabled:opacity-50"
                                                                >
                                                                    <LogIn className="w-3.5 h-3.5" />
                                                                    <span>Check In</span>
                                                                </button>

                                                                <button
                                                                    onClick={() => openCheckInModal(item)}
                                                                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                                                                    title="Check In with details"
                                                                >
                                                                    <Clock className="w-4 h-4" />
                                                                </button>

                                                                <button
                                                                    onClick={() => openAbsentModal(item)}
                                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-xl text-xs font-medium transition"
                                                                    title="Mark Absent"
                                                                >
                                                                    Absent
                                                                </button>

                                                                <button
                                                                    onClick={() => openExcusedModal(item)}
                                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-600 rounded-xl text-xs font-medium transition"
                                                                    title="Mark Excused Absence"
                                                                >
                                                                    Excused
                                                                </button>
                                                            </>
                                                        )}

                                                        {/* If checked in and on site */}
                                                        {item.is_checked_in && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleQuickCheckOut(item)}
                                                                    disabled={isActionPending}
                                                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center space-x-1 disabled:opacity-50"
                                                                >
                                                                    <LogOut className="w-3.5 h-3.5" />
                                                                    <span>Check Out</span>
                                                                </button>

                                                                <button
                                                                    onClick={() => openCheckOutModal(item)}
                                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                                                                    title="Check Out with pickup person & notes"
                                                                >
                                                                    <UserCheck className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}

                                                        {/* Controlled Correction Button (When record exists) */}
                                                        {att && att.id && (
                                                            <button
                                                                onClick={() => openCorrectionModal(item)}
                                                                className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition"
                                                                title="Controlled Attendance Correction"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {/* Audit Trail Button */}
                                                        {att && att.id && (
                                                            <button
                                                                onClick={() => openAuditHistoryModal(att.id!)}
                                                                className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
                                                                title="View Audit Trail"
                                                            >
                                                                <History className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {/* History link button */}
                                                        <Link
                                                            to={`/daycare/children/${item.student_id}/attendance`}
                                                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition ml-1"
                                                            title="View Attendance History"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* CHECK-IN MODAL */}
                <AnimatePresence>
                    {activeModal === 'check_in' && selectedStudent && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100"
                            >
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                    <div className="flex items-center space-x-2.5">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                            <LogIn className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg">Check In Child</h3>
                                            <p className="text-xs text-slate-500">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setActiveModal(null)}
                                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                                    >
                                        &times;
                                    </button>
                                </div>

                                <form onSubmit={handleModalCheckInSubmit} className="mt-4 space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Check-In Time
                                        </label>
                                        <input
                                            type="time"
                                            value={customTime}
                                            onChange={(e) => setCustomTime(e.target.value)}
                                            required
                                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Late Reason (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Doctor appointment, traffic..."
                                            value={lateReasonInput}
                                            onChange={(e) => setLateReasonInput(e.target.value)}
                                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Notes / Remarks
                                        </label>
                                        <textarea
                                            rows={2}
                                            placeholder="Add arrival notes, mood, dropped off by..."
                                            value={remarksInput}
                                            onChange={(e) => setRemarksInput(e.target.value)}
                                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white resize-none"
                                        />
                                    </div>

                                    <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setActiveModal(null)}
                                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={actionLoading !== null}
                                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
                                        >
                                            Confirm Check-In
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* CHECK-OUT MODAL */}
                <AnimatePresence>
                    {activeModal === 'check_out' && selectedStudent && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100"
                            >
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                    <div className="flex items-center space-x-2.5">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                            <LogOut className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg">Check Out Child</h3>
                                            <p className="text-xs text-slate-500">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setActiveModal(null)}
                                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                                    >
                                        &times;
                                    </button>
                                </div>

                                <form onSubmit={handleModalCheckOutSubmit} className="mt-4 space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Check-Out Time
                                        </label>
                                        <input
                                            type="time"
                                            value={customTime}
                                            onChange={(e) => setCustomTime(e.target.value)}
                                            required
                                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Authorized Pickup Person
                                        </label>
                                        <select
                                            value={selectedPickupId}
                                            onChange={(e) => setSelectedPickupId(e.target.value)}
                                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                                        >
                                            <option value="">-- Select Pickup Person (Optional) --</option>
                                            {authorizedPickups.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.relationship || 'Guardian'}) {p.phone ? `- ${p.phone}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Early Pickup Reason (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Doctor appointment, family trip..."
                                            value={earlyReasonInput}
                                            onChange={(e) => setEarlyReasonInput(e.target.value)}
                                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Notes / Remarks
                                        </label>
                                        <textarea
                                            rows={2}
                                            placeholder="Add departure notes..."
                                            value={remarksInput}
                                            onChange={(e) => setRemarksInput(e.target.value)}
                                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none"
                                        />
                                    </div>

                                    <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setActiveModal(null)}
                                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={actionLoading !== null}
                                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
                                        >
                                            Confirm Check-Out
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ABSENT MODAL */}
                <AnimatePresence>
                    {activeModal === 'mark_absent' && selectedStudent && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100"
                            >
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                    <div className="flex items-center space-x-2.5">
                                        <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                                            <XCircle className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg">Mark Absent</h3>
                                            <p className="text-xs text-slate-500">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setActiveModal(null)}
                                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                                    >
                                        &times;
                                    </button>
                                </div>

                                <form onSubmit={handleModalAbsentSubmit} className="mt-4 space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Reason / Remarks (Optional)
                                        </label>
                                        <textarea
                                            rows={3}
                                            placeholder="e.g. Called in sick, unnotified absence..."
                                            value={remarksInput}
                                            onChange={(e) => setRemarksInput(e.target.value)}
                                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:bg-white resize-none"
                                        />
                                    </div>

                                    <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setActiveModal(null)}
                                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={actionLoading !== null}
                                            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
                                        >
                                            Confirm Absence
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* EXCUSED ABSENCE MODAL */}
                <AnimatePresence>
                    {activeModal === 'mark_excused' && selectedStudent && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100"
                            >
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                    <div className="flex items-center space-x-2.5">
                                        <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                                            <AlertCircle className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg">Mark Excused Absence</h3>
                                            <p className="text-xs text-slate-500">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setActiveModal(null)}
                                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                                    >
                                        &times;
                                    </button>
                                </div>

                                <form onSubmit={handleModalExcusedSubmit} className="mt-4 space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Exemption Reason Category
                                        </label>
                                        <select
                                            value={excusedReasonTypeInput}
                                            onChange={(e) => setExcusedReasonTypeInput(e.target.value)}
                                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-800 font-medium"
                                        >
                                            <option value="MEDICAL">Medical Exemption</option>
                                            <option value="FAMILY_APPROVED">Family-Approved Absence</option>
                                            <option value="PLANNED">Planned / Vacation</option>
                                            <option value="ILLNESS">Illness / Doctor Visit</option>
                                            <option value="OTHER">Other Approved Reason</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Reason Details / Notes
                                        </label>
                                        <textarea
                                            rows={3}
                                            placeholder="Provide notes regarding the approved absence reason..."
                                            value={remarksInput}
                                            onChange={(e) => setRemarksInput(e.target.value)}
                                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white resize-none"
                                        />
                                    </div>

                                    <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setActiveModal(null)}
                                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={actionLoading !== null}
                                            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
                                        >
                                            Confirm Excused
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* CONTROLLED CORRECTION MODAL */}
                <AnimatePresence>
                    {activeModal === 'correct' && selectedStudent && selectedStudent.attendance && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-100 max-h-[90vh] overflow-y-auto"
                            >
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                    <div className="flex items-center space-x-2.5">
                                        <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                                            <Edit3 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg">Controlled Attendance Correction</h3>
                                            <p className="text-xs text-slate-500">
                                                {selectedStudent.first_name} {selectedStudent.last_name} &bull; {currentDate}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setActiveModal(null)}
                                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                                    >
                                        &times;
                                    </button>
                                </div>

                                <form onSubmit={handleModalCorrectionSubmit} className="mt-4 space-y-4 text-xs">
                                    {/* Status & Times Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                                Attendance Status
                                            </label>
                                            <select
                                                value={correctStatusInput}
                                                onChange={(e) => setCorrectStatusInput(e.target.value)}
                                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white font-medium"
                                            >
                                                <option value="PRESENT">Present</option>
                                                <option value="LATE">Late Arrival</option>
                                                <option value="EARLY_PICKUP">Early Pickup</option>
                                                <option value="ABSENT">Absent</option>
                                                <option value="EXCUSED_ABSENCE">Excused Absence</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                                Excused Reason Type
                                            </label>
                                            <select
                                                value={excusedReasonTypeInput}
                                                onChange={(e) => setExcusedReasonTypeInput(e.target.value)}
                                                disabled={correctStatusInput !== 'EXCUSED_ABSENCE'}
                                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white disabled:opacity-50 font-medium"
                                            >
                                                <option value="MEDICAL">Medical Exemption</option>
                                                <option value="FAMILY_APPROVED">Family-Approved</option>
                                                <option value="PLANNED">Planned Absence</option>
                                                <option value="ILLNESS">Illness</option>
                                                <option value="OTHER">Other Approved Reason</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                                Check-In Time
                                            </label>
                                            <input
                                                type="time"
                                                value={customTime}
                                                onChange={(e) => setCustomTime(e.target.value)}
                                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                                Check-Out Time
                                            </label>
                                            <input
                                                type="time"
                                                value={customOutTime}
                                                onChange={(e) => setCustomOutTime(e.target.value)}
                                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white"
                                            />
                                        </div>
                                    </div>

                                    {/* Late / Early Flags */}
                                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={correctIsLate}
                                                onChange={(e) => setCorrectIsLate(e.target.checked)}
                                                className="rounded-sm text-amber-600 focus:ring-amber-500"
                                            />
                                            <span className="font-semibold text-slate-800">Late Arrival Flag</span>
                                        </label>

                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={correctIsEarly}
                                                onChange={(e) => setCorrectIsEarly(e.target.checked)}
                                                className="rounded-sm text-amber-600 focus:ring-amber-500"
                                            />
                                            <span className="font-semibold text-slate-800">Early Pickup Flag</span>
                                        </label>
                                    </div>

                                    {/* Remarks & Notes */}
                                    <div>
                                        <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                            Attendance Notes / Remarks
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Optional general remarks..."
                                            value={remarksInput}
                                            onChange={(e) => setRemarksInput(e.target.value)}
                                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white"
                                        />
                                    </div>

                                    {/* MANDATORY CORRECTION REASON */}
                                    <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200">
                                        <div className="flex items-center space-x-1.5 mb-1.5">
                                            <ShieldCheck className="w-4 h-4 text-amber-600" />
                                            <label className="font-bold text-amber-900 uppercase tracking-wider">
                                                Correction Reason <span className="text-rose-600">*</span> (Mandatory)
                                            </label>
                                        </div>
                                        <textarea
                                            rows={2}
                                            required
                                            placeholder="Explain why this correction is being made (e.g. Parent confirmed time, mistaken checkout logged)..."
                                            value={correctionReasonInput}
                                            onChange={(e) => setCorrectionReasonInput(e.target.value)}
                                            className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden resize-none font-medium"
                                        />
                                        <p className="text-[10px] text-amber-700 mt-1">
                                            This justification will be permanently stored in the audit trail.
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => openAuditHistoryModal(selectedStudent.attendance!.id!)}
                                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                                        >
                                            <History className="w-3.5 h-3.5" />
                                            <span>View Audit Trail</span>
                                        </button>

                                        <div className="flex items-center space-x-2">
                                            <button
                                                type="button"
                                                onClick={() => setActiveModal(null)}
                                                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={actionLoading !== null}
                                                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
                                            >
                                                Save Correction
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* AUDIT TRAIL MODAL */}
                <AnimatePresence>
                    {auditModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 border border-slate-100 max-h-[90vh] overflow-y-auto"
                            >
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                    <div className="flex items-center space-x-2.5">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                            <History className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg">Attendance Audit History</h3>
                                            {auditData && (
                                                <p className="text-xs text-slate-500">
                                                    {auditData.student_name} &bull; {auditData.attendance_date}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setAuditModalOpen(false)}
                                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                                    >
                                        &times;
                                    </button>
                                </div>

                                {auditLoading ? (
                                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                                        <div className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-600 border-t-transparent"></div>
                                        <p className="text-xs font-medium">Loading audit trail...</p>
                                    </div>
                                ) : !auditData || !auditData.logs.length ? (
                                    <div className="py-12 text-center text-slate-500 text-xs">
                                        No audit entries recorded for this attendance record.
                                    </div>
                                ) : (
                                    <div className="mt-4 space-y-3 text-xs">
                                        {auditData.is_corrected && (
                                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 mb-3">
                                                <div className="font-bold flex items-center space-x-1.5">
                                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                    <span>Record Has Undergone Controlled Correction</span>
                                                </div>
                                                <p className="text-[11px] mt-1">
                                                    Reason: "{auditData.correction_reason}"
                                                </p>
                                                {auditData.corrected_by_name && (
                                                    <p className="text-[10px] text-amber-700 mt-0.5">
                                                        Corrected by {auditData.corrected_by_name} at {new Date(auditData.corrected_at || '').toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                                            {auditData.logs.map((log) => (
                                                <div key={log.id} className="p-3.5 bg-white space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] px-2 py-0.5 bg-slate-100 rounded-md">
                                                            {log.action}
                                                        </span>
                                                        <span className="text-slate-400 text-[10px]">
                                                            {new Date(log.created_at).toLocaleString()}
                                                        </span>
                                                    </div>

                                                    <div className="text-slate-600 text-[11px]">
                                                        Performed by <strong className="text-slate-900">{log.user_name}</strong> ({log.user_type || 'User'})
                                                    </div>

                                                    {log.old_values && (
                                                        <div className="p-2 bg-slate-50 rounded-lg text-[11px] space-y-0.5">
                                                            <div className="font-semibold text-slate-500 text-[10px]">Previous Values:</div>
                                                            <div className="font-mono text-slate-700 truncate">
                                                                {JSON.stringify(log.old_values)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {log.new_values && (
                                                        <div className="p-2 bg-indigo-50/50 rounded-lg text-[11px] space-y-0.5">
                                                            <div className="font-semibold text-indigo-700 text-[10px]">Updated Values:</div>
                                                            <div className="font-mono text-indigo-900 truncate">
                                                                {JSON.stringify(log.new_values)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex justify-end pt-3">
                                            <button
                                                type="button"
                                                onClick={() => setAuditModalOpen(false)}
                                                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
                                            >
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </Layout>
    );
};

export default DailyAttendance;
