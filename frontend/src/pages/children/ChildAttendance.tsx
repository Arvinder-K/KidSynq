import React, { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Calendar, CheckCircle2, XCircle, Clock, 
    RefreshCw, LogOut, AlertCircle, Building2,
    History, AlertTriangle
} from 'lucide-react';
import api from '../../api';

interface AttendanceSummary {
    total_days: number;
    present_count: number;
    absent_count: number;
    excused_absence_count: number;
    late_count: number;
    early_pickup_count: number;
    attendance_rate: number;
}

interface AttendanceRecord {
    id: string;
    attendance_date: string;
    attendance_status: string;
    check_in_time: string | null;
    check_out_time: string | null;
    classroom_name: string;
    is_late: boolean;
    is_early_pickup: boolean;
    arrival_type: string | null;
    departure_type: string | null;
    late_reason: string | null;
    early_pickup_reason: string | null;
    remarks: string | null;
    notes: string | null;
    received_by_name: string | null;
    released_by_name: string | null;
    pickup_person_name: string | null;
    created_by_name: string | null;
    updated_by_name: string | null;
    created_at: string;
    updated_at: string;
    is_corrected?: boolean;
    correction_reason?: string | null;
    corrected_by_name?: string | null;
    corrected_at?: string | null;
    excused_reason_type?: string | null;
    supporting_document_title?: string | null;
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

export const ChildAttendance: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { child } = useOutletContext<{ child: any }>();

    const [summary, setSummary] = useState<AttendanceSummary | null>(null);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Date Range Filters
    const [datePreset, setDatePreset] = useState<'30days' | 'this_month' | 'last_month' | 'all' | 'custom'>('30days');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Audit Modal
    const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);
    const [auditData, setAuditData] = useState<AuditData | null>(null);
    const [auditLoading, setAuditLoading] = useState<boolean>(false);

    const calculatePresetDates = (preset: '30days' | 'this_month' | 'last_month' | 'all' | 'custom') => {
        const today = new Date();
        const y = today.getFullYear();
        const m = today.getMonth();

        if (preset === '30days') {
            const start = new Date(today);
            start.setDate(today.getDate() - 30);
            return {
                start: start.toISOString().split('T')[0],
                end: today.toISOString().split('T')[0]
            };
        } else if (preset === 'this_month') {
            const start = new Date(y, m, 1);
            return {
                start: start.toISOString().split('T')[0],
                end: today.toISOString().split('T')[0]
            };
        } else if (preset === 'last_month') {
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 0);
            return {
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0]
            };
        } else {
            return { start: '', end: '' };
        }
    };

    const fetchHistory = async (start?: string, end?: string) => {
        if (!id) return;
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (start) params.start_date = start;
            if (end) params.end_date = end;

            const res = await api.get(`/daycare/children/${id}/attendance/`, { params });
            setSummary(res.data.summary || null);
            setRecords(res.data.records || []);
        } catch (error) {
            console.error('Failed to load child attendance history', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const { start, end } = calculatePresetDates(datePreset);
        setStartDate(start);
        setEndDate(end);
        fetchHistory(start, end);
    }, [id, datePreset]);

    const handleApplyCustomFilter = (e: React.FormEvent) => {
        e.preventDefault();
        setDatePreset('custom');
        fetchHistory(startDate, endDate);
    };

    const openAuditHistoryModal = async (attendanceId: string) => {
        setAuditLoading(true);
        setAuditModalOpen(true);
        try {
            const res = await api.get(`/daycare/attendance/records/${attendanceId}/audit/`);
            setAuditData(res.data);
        } catch (error) {
            console.error('Failed to load audit history', error);
        } finally {
            setAuditLoading(false);
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

    const getStatusBadge = (record: AttendanceRecord) => {
        const st = (record.attendance_status || '').toUpperCase();

        if (st === 'ABSENT') {
            return (
                <div className="flex items-center space-x-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="w-3 h-3 mr-1 text-rose-500" />
                        Absent
                    </span>
                    {record.is_corrected && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-200" title={`Corrected: ${record.correction_reason}`}>
                            CORRECTED
                        </span>
                    )}
                </div>
            );
        }

        if (st === 'EXCUSED_ABSENCE' || st === 'EXCUSED') {
            return (
                <div className="flex items-center space-x-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3 h-3 mr-1 text-amber-500" />
                        Excused
                    </span>
                    {record.is_corrected && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-200" title={`Corrected: ${record.correction_reason}`}>
                            CORRECTED
                        </span>
                    )}
                </div>
            );
        }

        if (st === 'LATE' || record.is_late) {
            return (
                <div className="flex items-center space-x-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                        <Clock className="w-3 h-3 mr-1 text-orange-500" />
                        Late
                    </span>
                    {record.is_corrected && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-200" title={`Corrected: ${record.correction_reason}`}>
                            CORRECTED
                        </span>
                    )}
                </div>
            );
        }

        if (st === 'EARLY_PICKUP' || record.is_early_pickup) {
            return (
                <div className="flex items-center space-x-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <LogOut className="w-3 h-3 mr-1 text-indigo-500" />
                        Early Pickup
                    </span>
                    {record.is_corrected && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-200" title={`Corrected: ${record.correction_reason}`}>
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
                {record.is_corrected && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-200" title={`Corrected: ${record.correction_reason}`}>
                        CORRECTED
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header / Summary Card */}
            {summary && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Attendance History & Performance</h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Verified check-in and departure records for {child?.first_name || 'child'}.
                            </p>
                        </div>
                        <div className="flex items-center space-x-3 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                            <div>
                                <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Attendance Rate</div>
                                <div className="text-2xl font-black text-emerald-700">{summary.attendance_rate}%</div>
                            </div>
                        </div>
                    </div>

                    {/* Metric Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                            <div className="text-xs font-medium text-slate-500">Total Recorded</div>
                            <div className="text-xl font-bold text-slate-900 mt-1">{summary.total_days} days</div>
                        </div>
                        <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100">
                            <div className="text-xs font-medium text-emerald-700">Present Days</div>
                            <div className="text-xl font-bold text-emerald-700 mt-1">{summary.present_count}</div>
                        </div>
                        <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-100">
                            <div className="text-xs font-medium text-rose-700">Absent Days</div>
                            <div className="text-xl font-bold text-rose-700 mt-1">{summary.absent_count}</div>
                        </div>
                        <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-100">
                            <div className="text-xs font-medium text-amber-700">Excused Absence</div>
                            <div className="text-xl font-bold text-amber-700 mt-1">{summary.excused_absence_count}</div>
                        </div>
                        <div className="bg-orange-50/50 p-3.5 rounded-xl border border-orange-100">
                            <div className="text-xs font-medium text-orange-700">Late Arrivals</div>
                            <div className="text-xl font-bold text-orange-700 mt-1">{summary.late_count}</div>
                        </div>
                        <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100">
                            <div className="text-xs font-medium text-indigo-700">Early Pickups</div>
                            <div className="text-xl font-bold text-indigo-700 mt-1">{summary.early_pickup_count}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Date Filtering Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Preset Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200/60">
                    <button
                        onClick={() => setDatePreset('30days')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                            datePreset === '30days' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Last 30 Days
                    </button>
                    <button
                        onClick={() => setDatePreset('this_month')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                            datePreset === 'this_month' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        This Month
                    </button>
                    <button
                        onClick={() => setDatePreset('last_month')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                            datePreset === 'last_month' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Last Month
                    </button>
                    <button
                        onClick={() => setDatePreset('all')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                            datePreset === 'all' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        All Time
                    </button>
                </div>

                {/* Custom Date Range Form */}
                <form onSubmit={handleApplyCustomFilter} className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center space-x-2">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-700"
                        />
                        <span className="text-slate-400 text-xs">to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-700"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
                    >
                        Apply
                    </button>
                    <button
                        type="button"
                        onClick={() => fetchHistory(startDate, endDate)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                    </button>
                </form>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
                        <p className="text-sm font-medium">Loading history records...</p>
                    </div>
                ) : records.length === 0 ? (
                    <div className="py-16 text-center text-slate-500">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-base font-semibold text-slate-800">No attendance records found</h3>
                        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                            No attendance events have been logged for this date range.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                            <thead className="bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-3.5">Date</th>
                                    <th className="px-6 py-3.5">Classroom</th>
                                    <th className="px-6 py-3.5">Check-In</th>
                                    <th className="px-6 py-3.5">Check-Out</th>
                                    <th className="px-6 py-3.5">Status</th>
                                    <th className="px-6 py-3.5">Notes & Remarks</th>
                                    <th className="px-6 py-3.5">Logged By</th>
                                    <th className="px-6 py-3.5 text-right">Audit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {records.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                                            {formatDateDisplay(r.attendance_date)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700">
                                                <Building2 className="w-3 h-3 mr-1 text-slate-400" />
                                                {r.classroom_name || 'Unassigned'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {r.check_in_time ? (
                                                <div>
                                                    <div className="font-semibold text-slate-800 flex items-center space-x-1">
                                                        <span>{formatTimeDisplay(r.check_in_time)}</span>
                                                        {r.is_late && (
                                                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 rounded-md">
                                                                LATE
                                                            </span>
                                                        )}
                                                    </div>
                                                    {r.received_by_name && (
                                                        <div className="text-[11px] text-slate-400">by {r.received_by_name}</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">--:--</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {r.check_out_time ? (
                                                <div>
                                                    <div className="font-semibold text-slate-800 flex items-center space-x-1">
                                                        <span>{formatTimeDisplay(r.check_out_time)}</span>
                                                        {r.is_early_pickup && (
                                                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-md">
                                                                EARLY
                                                            </span>
                                                        )}
                                                    </div>
                                                    {r.pickup_person_name ? (
                                                        <div className="text-[11px] text-slate-500">to {r.pickup_person_name}</div>
                                                    ) : r.released_by_name ? (
                                                        <div className="text-[11px] text-slate-400">by {r.released_by_name}</div>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">--:--</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(r)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-slate-700 max-w-xs truncate">
                                                {r.remarks || r.notes || (r.late_reason ? `Late: ${r.late_reason}` : (r.early_pickup_reason ? `Early: ${r.early_pickup_reason}` : '-'))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                                            {r.updated_by_name || r.created_by_name || 'Staff'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => openAuditHistoryModal(r.id)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
                                                title="View Audit Trail"
                                            >
                                                <History className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

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
    );
};

export default ChildAttendance;
