import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Calendar, ChevronLeft, ChevronRight, Search, 
    CheckCircle2, XCircle, Clock, AlertTriangle, 
    LogOut, Users, AlertCircle, 
    CalendarDays, Download, ShieldCheck,
    History, Edit3
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api, { BACKEND_URL } from '../../../api';

interface ClassroomInfo {
    id: string;
    room_name: string;
    room_code?: string;
}

interface DayMeta {
    day: number;
    date: string;
    weekday: string;
    is_weekend: boolean;
}

interface DailyCellData {
    id: string | null;
    code: string; // 'P' | 'A' | 'E' | 'L' | 'EP' | '-'
    status: string;
    check_in_time: string | null;
    check_out_time: string | null;
    is_late: boolean;
    is_early_pickup: boolean;
    is_corrected: boolean;
    correction_reason: string | null;
    remarks: string | null;
    notes: string | null;
    excused_reason_type: string | null;
}

interface StudentMonthlyRow {
    student_id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    admission_number?: string;
    photo?: string;
    classroom: ClassroomInfo | null;
    daily_cells: Record<string, DailyCellData>;
    summary: {
        present_count: number;
        absent_count: number;
        excused_count: number;
        late_count: number;
        early_pickup_count: number;
        total_recorded_days: number;
        attendance_rate: number;
    };
}

interface MonthSummary {
    total_present: number;
    total_absent: number;
    total_excused: number;
    total_late: number;
    total_early_pickup: number;
}

interface MonthlyMatrixResponse {
    year: number;
    month: number;
    month_name: string;
    num_days: number;
    days_in_month: DayMeta[];
    total_students: number;
    month_summary: MonthSummary;
    students: StudentMonthlyRow[];
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

export const MonthlyAttendance: React.FC = () => {
    const today = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);

    const [matrixData, setMatrixData] = useState<MonthlyMatrixResponse | null>(null);
    const [classrooms, setClassrooms] = useState<ClassroomInfo[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);


    // Correction Modal State
    const [correctionModalOpen, setCorrectionModalOpen] = useState<boolean>(false);
    const [correctionRecord, setCorrectionRecord] = useState<{
        attendance_id: string;
        student_name: string;
        date: string;
        cell: DailyCellData;
    } | null>(null);
    const [corrCheckIn, setCorrCheckIn] = useState<string>('');
    const [corrCheckOut, setCorrCheckOut] = useState<string>('');
    const [corrStatus, setCorrStatus] = useState<string>('PRESENT');
    const [corrIsLate, setCorrIsLate] = useState<boolean>(false);
    const [corrLateReason, setCorrLateReason] = useState<string>('');
    const [corrIsEarly, setCorrIsEarly] = useState<boolean>(false);
    const [corrEarlyReason, setCorrEarlyReason] = useState<string>('');
    const [corrExcusedType, setCorrExcusedType] = useState<string>('');
    const [corrRemarks, setCorrRemarks] = useState<string>('');
    const [corrReason, setCorrReason] = useState<string>('');
    const [actionLoading, setActionLoading] = useState<boolean>(false);

    // Audit History Modal State
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
            console.error('Failed to fetch classrooms', error);
        }
    };

    const fetchMonthlyMatrix = async () => {
        setLoading(true);
        try {
            const params: Record<string, any> = {
                year: selectedYear,
                month: selectedMonth,
            };
            if (selectedClassroom !== 'all') {
                params.classroom_id = selectedClassroom;
            }
            if (statusFilter !== 'all') {
                params.status = statusFilter;
            }
            if (searchQuery.trim()) {
                params.search = searchQuery.trim();
            }

            const res = await api.get('/daycare/attendance/monthly/', { params });
            setMatrixData(res.data);
        } catch (error: any) {
            console.error('Failed to load monthly attendance', error);
            showToast(error?.response?.data?.detail || 'Failed to load monthly attendance.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClassrooms();
    }, []);

    useEffect(() => {
        fetchMonthlyMatrix();
    }, [selectedYear, selectedMonth, selectedClassroom, statusFilter]);

    // Handle Search with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchMonthlyMatrix();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleMonthShift = (delta: number) => {
        let m = selectedMonth + delta;
        let y = selectedYear;
        if (m < 1) {
            m = 12;
            y -= 1;
        } else if (m > 12) {
            m = 1;
            y += 1;
        }
        setSelectedMonth(m);
        setSelectedYear(y);
    };

    const handleCurrentMonthClick = () => {
        const now = new Date();
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth() + 1);
    };

    const openCorrectionModal = (student: StudentMonthlyRow, day: DayMeta, cell: DailyCellData) => {
        if (!cell.id) {
            showToast('No existing attendance record for this day to correct.', 'error');
            return;
        }
        setCorrectionRecord({
            attendance_id: cell.id,
            student_name: `${student.first_name} ${student.last_name}`,
            date: day.date,
            cell: cell,
        });
        setCorrCheckIn(cell.check_in_time ? cell.check_in_time.slice(0, 5) : '');
        setCorrCheckOut(cell.check_out_time ? cell.check_out_time.slice(0, 5) : '');
        setCorrStatus(cell.status || 'PRESENT');
        setCorrIsLate(cell.is_late || false);
        setCorrLateReason('');
        setCorrIsEarly(cell.is_early_pickup || false);
        setCorrEarlyReason('');
        setCorrExcusedType(cell.excused_reason_type || '');
        setCorrRemarks(cell.remarks || '');
        setCorrReason('');
        setCorrectionModalOpen(true);
    };

    const handleCorrectionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!correctionRecord) return;
        if (!corrReason.trim()) {
            showToast('Correction reason is mandatory.', 'error');
            return;
        }

        setActionLoading(true);
        try {
            await api.post(`/daycare/attendance/records/${correctionRecord.attendance_id}/correct/`, {
                correction_reason: corrReason.trim(),
                check_in_time: corrCheckIn ? `${corrCheckIn}:00` : null,
                check_out_time: corrCheckOut ? `${corrCheckOut}:00` : null,
                attendance_status: corrStatus,
                is_late: corrIsLate,
                late_reason: corrLateReason || undefined,
                is_early_pickup: corrIsEarly,
                early_pickup_reason: corrEarlyReason || undefined,
                excused_reason_type: corrExcusedType || undefined,
                remarks: corrRemarks || undefined,
            });
            showToast('Attendance record corrected successfully.');
            setCorrectionModalOpen(false);
            await fetchMonthlyMatrix();
        } catch (error: any) {
            console.error('Correction failed', error);
            showToast(error?.response?.data?.detail || error?.response?.data?.correction_reason?.[0] || 'Correction failed.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const openAuditModal = async (attendanceId: string) => {
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

    const exportToCsv = () => {
        if (!matrixData || !matrixData.students.length) return;
        const days = matrixData.days_in_month;
        const headers = ['Admission #', 'Student Name', 'Classroom', ...days.map(d => `${d.day} (${d.weekday})`), 'Present', 'Absent', 'Excused', 'Late', 'Early Pickup', 'Attendance Rate %'];
        
        const rows = matrixData.students.map(s => {
            const rowData = [
                s.admission_number || '',
                `"${s.first_name} ${s.last_name}"`,
                `"${s.classroom?.room_name || 'Unassigned'}"`,
                ...days.map(d => {
                    const c = s.daily_cells[String(d.day)];
                    return c ? c.code : '-';
                }),
                s.summary.present_count,
                s.summary.absent_count,
                s.summary.excused_count,
                s.summary.late_count,
                s.summary.early_pickup_count,
                `${s.summary.attendance_rate}%`
            ];
            return rowData.join(',');
        });

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Attendance_Matrix_${matrixData.month_name}_${matrixData.year}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getCodePillStyle = (code: string, isWeekend: boolean) => {
        if (code === 'P') {
            return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
        }
        if (code === 'L') {
            return 'bg-orange-100 text-orange-800 border-orange-300 font-bold';
        }
        if (code === 'EP') {
            return 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold';
        }
        if (code === 'A') {
            return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
        }
        if (code === 'E') {
            return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
        }
        return isWeekend ? 'bg-slate-100/50 text-slate-300 border-transparent' : 'bg-slate-50 text-slate-400 border-slate-200/60';
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

                {/* Top Header Navigation & Month Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Monthly Attendance Matrix</h1>
                        <p className="text-sm text-gray-500 mt-1">Comprehensive calendar table with status codes and controlled corrections.</p>
                    </div>

                    {/* View Switcher & Month Controls */}
                    <div className="flex items-center flex-wrap gap-2.5">
                        <Link
                            to="/daycare/attendance"
                            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center space-x-1.5"
                        >
                            <Calendar className="w-4 h-4 text-slate-500" />
                            <span>Daily Roster</span>
                        </Link>

                        <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                            <button
                                onClick={() => handleMonthShift(-1)}
                                className="p-1.5 rounded-xl text-slate-600 hover:bg-white hover:shadow-xs transition"
                                title="Previous Month"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            <button
                                onClick={handleCurrentMonthClick}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-white shadow-2xs rounded-lg mx-1"
                            >
                                This Month
                            </button>

                            <div className="flex items-center px-2 py-1 space-x-1 font-bold text-sm text-slate-800">
                                <span>{matrixData?.month_name || ''}</span>
                                <span>{selectedYear}</span>
                            </div>

                            <button
                                onClick={() => handleMonthShift(1)}
                                className="p-1.5 rounded-xl text-slate-600 hover:bg-white hover:shadow-xs transition"
                                title="Next Month"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        <button
                            onClick={exportToCsv}
                            disabled={!matrixData || !matrixData.students.length}
                            className="p-2 text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl transition shadow-2xs disabled:opacity-50"
                            title="Export to CSV"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* KPI Summary Cards Grid */}
                {matrixData && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                            <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
                                <span>Total Children</span>
                                <Users className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="text-2xl font-bold text-slate-900 mt-1">{matrixData.total_students}</div>
                            <div className="text-xs text-slate-400 mt-0.5">Active roster</div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                            <div className="text-xs font-medium text-emerald-600 flex items-center justify-between">
                                <span>Present Days (P)</span>
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div className="text-2xl font-bold text-emerald-600 mt-1">{matrixData.month_summary.total_present}</div>
                            <div className="text-xs text-slate-400 mt-0.5">Logged attendance</div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                            <div className="text-xs font-medium text-rose-600 flex items-center justify-between">
                                <span>Absent Days (A)</span>
                                <XCircle className="w-4 h-4 text-rose-500" />
                            </div>
                            <div className="text-2xl font-bold text-rose-600 mt-1">{matrixData.month_summary.total_absent}</div>
                            <div className="text-xs text-slate-400 mt-0.5">Unexcused absences</div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                            <div className="text-xs font-medium text-amber-600 flex items-center justify-between">
                                <span>Excused (E)</span>
                                <AlertCircle className="w-4 h-4 text-amber-500" />
                            </div>
                            <div className="text-2xl font-bold text-amber-600 mt-1">{matrixData.month_summary.total_excused}</div>
                            <div className="text-xs text-slate-400 mt-0.5">Approved exemptions</div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                            <div className="text-xs font-medium text-orange-600 flex items-center justify-between">
                                <span>Late Arrivals (L)</span>
                                <Clock className="w-4 h-4 text-orange-500" />
                            </div>
                            <div className="text-2xl font-bold text-orange-600 mt-1">{matrixData.month_summary.total_late}</div>
                            <div className="text-xs text-slate-400 mt-0.5">After opening</div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                            <div className="text-xs font-medium text-indigo-600 flex items-center justify-between">
                                <span>Early Pickups (EP)</span>
                                <LogOut className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div className="text-2xl font-bold text-indigo-600 mt-1">{matrixData.month_summary.total_early_pickup}</div>
                            <div className="text-xs text-slate-400 mt-0.5">Departed early</div>
                        </div>
                    </div>
                )}

                {/* Filter Toolbar & Legend */}
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
                        <div className="relative min-w-[170px]">
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
                        <div className="relative min-w-[150px]">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-700 font-medium cursor-pointer"
                            >
                                <option value="all">All Statuses</option>
                                <option value="PRESENT">Has Present (P)</option>
                                <option value="LATE">Has Late (L)</option>
                                <option value="EARLY_PICKUP">Has Early Pickup (EP)</option>
                                <option value="ABSENT">Has Absent (A)</option>
                                <option value="EXCUSED_ABSENCE">Has Excused (E)</option>
                            </select>
                        </div>
                    </div>

                    {/* Code Legend */}
                    <div className="flex items-center flex-wrap gap-2 text-xs font-semibold text-slate-600">
                        <span className="text-[11px] uppercase tracking-wider text-slate-400 mr-1">Legend:</span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">P = Present</span>
                        <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800">L = Late</span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">EP = Early</span>
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">A = Absent</span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">E = Excused</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">- = Unmarked</span>
                    </div>
                </div>

                {/* Calendar Matrix Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
                            <p className="text-sm font-medium">Computing monthly attendance matrix...</p>
                        </div>
                    ) : !matrixData || matrixData.students.length === 0 ? (
                        <div className="py-20 text-center text-slate-500">
                            <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <h3 className="text-base font-semibold text-slate-800">No children match current criteria</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                                Adjust your classroom, search or month filters to view child matrix records.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-left border-collapse">
                                <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500">
                                    <tr>
                                        {/* Sticky Left: Child info */}
                                        <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3 min-w-[200px] border-r border-slate-200">
                                            Child Details
                                        </th>

                                        {/* Days 1 to 28/30/31 */}
                                        {matrixData.days_in_month.map((d) => (
                                            <th
                                                key={d.day}
                                                className={`px-1.5 py-2.5 text-center min-w-[34px] border-r border-slate-100 ${
                                                    d.is_weekend ? 'bg-slate-100/50 text-slate-400' : 'text-slate-700'
                                                }`}
                                            >
                                                <div className="font-bold text-xs">{d.day}</div>
                                                <div className="text-[10px] uppercase font-normal text-slate-400">{d.weekday[0]}</div>
                                            </th>
                                        ))}

                                        {/* Monthly Summary Columns */}
                                        <th className="px-2 py-3 text-center min-w-[40px] text-emerald-700 bg-emerald-50/40">P</th>
                                        <th className="px-2 py-3 text-center min-w-[40px] text-rose-700 bg-rose-50/40">A</th>
                                        <th className="px-2 py-3 text-center min-w-[40px] text-amber-700 bg-amber-50/40">E</th>
                                        <th className="px-2 py-3 text-center min-w-[40px] text-orange-700 bg-orange-50/40">L</th>
                                        <th className="px-2 py-3 text-center min-w-[40px] text-indigo-700 bg-indigo-50/40">EP</th>
                                        <th className="px-3 py-3 text-center min-w-[65px] text-indigo-900 bg-indigo-50/60 font-bold">Rate</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {matrixData.students.map((student) => (
                                        <tr key={student.student_id} className="hover:bg-slate-50/80 transition-colors">
                                            {/* Sticky Left: Student Info */}
                                            <td className="sticky left-0 z-10 bg-white hover:bg-slate-50 px-4 py-2.5 border-r border-slate-200 whitespace-nowrap">
                                                <div className="flex items-center space-x-2.5">
                                                    <div className="shrink-0">
                                                        {student.photo ? (
                                                            <img
                                                                src={getImageUrl(student.photo)}
                                                                alt={student.first_name}
                                                                className="w-7 h-7 rounded-full object-cover border border-slate-200"
                                                            />
                                                        ) : (
                                                            <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-[11px] flex items-center justify-center">
                                                                {student.first_name[0]}{student.last_name[0]}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <Link
                                                            to={`/daycare/children/${student.student_id}/attendance`}
                                                            className="font-bold text-slate-800 hover:text-indigo-600 truncate block max-w-[140px]"
                                                            title={`${student.first_name} ${student.last_name}`}
                                                        >
                                                            {student.first_name} {student.last_name}
                                                        </Link>
                                                        <div className="text-[10px] text-slate-400">
                                                            {student.classroom?.room_name || 'Unassigned'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Daily Status Cells */}
                                            {matrixData.days_in_month.map((day) => {
                                                const cell = student.daily_cells[String(day.day)] || {
                                                    id: null,
                                                    code: '-',
                                                    status: 'UNMARKED',
                                                    is_corrected: false
                                                };
                                                const hasRecord = cell.id !== null;

                                                return (
                                                    <td
                                                        key={day.day}
                                                        className={`p-1 text-center border-r border-slate-100 relative group ${
                                                            day.is_weekend ? 'bg-slate-50/40' : ''
                                                        }`}
                                                    >
                                                        <button
                                                            onClick={() => hasRecord ? openCorrectionModal(student, day, cell) : null}
                                                            className={`w-7 h-7 rounded-lg text-[11px] flex items-center justify-center mx-auto transition border relative ${
                                                                getCodePillStyle(cell.code, day.is_weekend)
                                                            } ${hasRecord ? 'cursor-pointer hover:scale-110 hover:shadow-xs' : 'cursor-default'}`}
                                                            title={hasRecord ? `${day.date}: ${cell.status} (Click to correct)` : `${day.date}: No Record`}
                                                        >
                                                            {cell.code}
                                                            {cell.is_corrected && (
                                                                <span
                                                                    className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full border border-white"
                                                                    title="Corrected record"
                                                                />
                                                            )}
                                                        </button>
                                                    </td>
                                                );
                                            })}

                                            {/* Monthly Summary Counters */}
                                            <td className="px-2 py-2.5 text-center font-bold text-emerald-700 bg-emerald-50/20">
                                                {student.summary.present_count}
                                            </td>
                                            <td className="px-2 py-2.5 text-center font-bold text-rose-700 bg-rose-50/20">
                                                {student.summary.absent_count}
                                            </td>
                                            <td className="px-2 py-2.5 text-center font-bold text-amber-700 bg-amber-50/20">
                                                {student.summary.excused_count}
                                            </td>
                                            <td className="px-2 py-2.5 text-center font-bold text-orange-700 bg-orange-50/20">
                                                {student.summary.late_count}
                                            </td>
                                            <td className="px-2 py-2.5 text-center font-bold text-indigo-700 bg-indigo-50/20">
                                                {student.summary.early_pickup_count}
                                            </td>
                                            <td className="px-3 py-2.5 text-center font-black text-indigo-900 bg-indigo-50/30">
                                                {student.summary.attendance_rate}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* CORRECTION MODAL */}
                <AnimatePresence>
                    {correctionModalOpen && correctionRecord && (
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
                                                {correctionRecord.student_name} &bull; {correctionRecord.date}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setCorrectionModalOpen(false)}
                                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                                    >
                                        &times;
                                    </button>
                                </div>

                                <form onSubmit={handleCorrectionSubmit} className="mt-4 space-y-4 text-xs">
                                    
                                    {/* Status & Times Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                                Attendance Status
                                            </label>
                                            <select
                                                value={corrStatus}
                                                onChange={(e) => setCorrStatus(e.target.value)}
                                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white"
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
                                                value={corrExcusedType}
                                                onChange={(e) => setCorrExcusedType(e.target.value)}
                                                disabled={corrStatus !== 'EXCUSED_ABSENCE'}
                                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white disabled:opacity-50"
                                            >
                                                <option value="">-- Select Exemption Type --</option>
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
                                                value={corrCheckIn}
                                                onChange={(e) => setCorrCheckIn(e.target.value)}
                                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                                Check-Out Time
                                            </label>
                                            <input
                                                type="time"
                                                value={corrCheckOut}
                                                onChange={(e) => setCorrCheckOut(e.target.value)}
                                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white"
                                            />
                                        </div>
                                    </div>

                                    {/* Late / Early Flags */}
                                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={corrIsLate}
                                                onChange={(e) => setCorrIsLate(e.target.checked)}
                                                className="rounded-sm text-amber-600 focus:ring-amber-500"
                                            />
                                            <span className="font-semibold text-slate-800">Late Arrival Flag</span>
                                        </label>

                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={corrIsEarly}
                                                onChange={(e) => setCorrIsEarly(e.target.checked)}
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
                                            placeholder="Optional general notes..."
                                            value={corrRemarks}
                                            onChange={(e) => setCorrRemarks(e.target.value)}
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
                                            value={corrReason}
                                            onChange={(e) => setCorrReason(e.target.value)}
                                            className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden resize-none font-medium"
                                        />
                                        <p className="text-[10px] text-amber-700 mt-1">
                                            This justification will be permanently logged in the audit trail.
                                        </p>
                                    </div>

                                    {/* Modal Actions */}
                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => openAuditModal(correctionRecord.attendance_id)}
                                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                                        >
                                            <History className="w-3.5 h-3.5" />
                                            <span>View Audit Trail</span>
                                        </button>

                                        <div className="flex items-center space-x-2">
                                            <button
                                                type="button"
                                                onClick={() => setCorrectionModalOpen(false)}
                                                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={actionLoading}
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

export default MonthlyAttendance;
