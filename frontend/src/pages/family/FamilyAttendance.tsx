import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../api';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

interface Child { id: string; first_name: string; last_name: string; preferred_name: string | null; }
interface AttendanceRecord {
    id: string; attendance_date: string; attendance_status: string;
    check_in_time: string | null; check_out_time: string | null;
    received_by_name: string; released_by_name: string; pickup_person_name: string;
}
interface Summary { present: number; absent: number; late: number; sick: number; total: number; }

const statusMap: Record<string, { bg: string; text: string; icon?: React.ReactNode }> = {
    'Present': { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <CheckCircle2 className="w-3 h-3" /> },
    'Absent': { bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle className="w-3 h-3" /> },
    'Late': { bg: 'bg-amber-100', text: 'text-amber-700', icon: <Clock className="w-3 h-3" /> },
    'Sick': { bg: 'bg-orange-100', text: 'text-orange-700', icon: <AlertCircle className="w-3 h-3" /> },
    'Holiday': { bg: 'bg-blue-100', text: 'text-blue-600' },
};

const FamilyAttendance: React.FC = () => {
    const location = useLocation();
    const preselectedChild = new URLSearchParams(location.search).get('child');

    const [children, setChildren] = useState<Child[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(preselectedChild);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        api.get('/family/children/').then(res => {
            setChildren(res.data);
            if (!selectedChildId && res.data.length > 0) setSelectedChildId(res.data[0].id);
        });
    }, []);

    useEffect(() => {
        if (!selectedChildId) return;
        setLoading(true);
        api.get(`/family/children/${selectedChildId}/attendance/?year=${currentDate.getFullYear()}&month=${currentDate.getMonth() + 1}`)
            .then(res => { setRecords(res.data.records); setSummary(res.data.summary); })
            .finally(() => setLoading(false));
    }, [selectedChildId, currentDate]);

    // Build calendar grid
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthLabel = currentDate.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

    const recordByDate: Record<string, AttendanceRecord> = {};
    records.forEach(r => { recordByDate[r.attendance_date] = r; });

    const formatDate = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return (
        <Layout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Track your child's attendance at daycare</p>
                </div>

                {/* Child Selector */}
                {children.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                        {children.map(child => (
                            <button key={child.id} onClick={() => setSelectedChildId(child.id)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${selectedChildId === child.id ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                                {child.preferred_name || `${child.first_name} ${child.last_name}`}
                            </button>
                        ))}
                    </div>
                )}

                {/* Summary */}
                {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Present', val: summary.present, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                            { label: 'Absent', val: summary.absent, color: 'bg-red-50 text-red-700 border-red-200' },
                            { label: 'Late', val: summary.late, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                            { label: 'Sick', val: summary.sick, color: 'bg-orange-50 text-orange-700 border-orange-200' },
                        ].map(s => (
                            <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
                                <div className="text-xl font-bold">{s.val}</div>
                                <div className="text-xs font-medium">{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Month Navigator */}
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                        className="p-2 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-base font-semibold text-slate-700 min-w-[160px] text-center">{monthLabel}</span>
                    <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                        disabled={month >= new Date().getMonth() && year >= new Date().getFullYear()}
                        className="p-2 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Calendar Grid */}
                {loading ? (
                    <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                        {/* Day headers */}
                        <div className="grid grid-cols-7 border-b border-slate-100">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                <div key={d} className="py-2.5 text-center text-xs font-semibold text-slate-500">{d}</div>
                            ))}
                        </div>

                        {/* Day cells */}
                        <div className="grid grid-cols-7">
                            {/* Leading empty cells */}
                            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                                <div key={`empty-${i}`} className="min-h-[60px] border-r border-b border-slate-50" />
                            ))}
                            {Array.from({ length: daysInMonth }).map((_, idx) => {
                                const day = idx + 1;
                                const dateStr = formatDate(day);
                                const rec = recordByDate[dateStr];
                                const isToday = dateStr === new Date().toISOString().split('T')[0];
                                const meta: any = rec ? (statusMap[rec.attendance_status] || {}) : {};

                                return (
                                    <div key={day} title={rec ? `${rec.attendance_status}${rec.check_in_time ? ' · In: ' + rec.check_in_time : ''}` : undefined}
                                        className={`min-h-[60px] p-1.5 border-r border-b border-slate-50 flex flex-col items-center ${rec ? meta.bg : ''}`}>
                                        <span className={`text-xs font-semibold rounded-full w-6 h-6 flex items-center justify-center ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>
                                            {day}
                                        </span>
                                        {rec && (
                                            <span className={`mt-1 text-[10px] font-medium ${meta.text}`}>
                                                {rec.attendance_status}
                                            </span>
                                        )}
                                        {rec?.check_in_time && (
                                            <span className="text-[9px] text-slate-400 mt-0.5">{rec.check_in_time}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Legend */}
                <div className="flex gap-4 flex-wrap">
                    {Object.entries(statusMap).slice(0, 4).map(([status, meta]) => (
                        <div key={status} className="flex items-center gap-1.5">
                            <div className={`w-3 h-3 rounded-sm ${meta.bg}`} />
                            <span className="text-xs text-slate-600">{status}</span>
                        </div>
                    ))}
                </div>
            </div>
        </Layout>
    );
};

export default FamilyAttendance;
