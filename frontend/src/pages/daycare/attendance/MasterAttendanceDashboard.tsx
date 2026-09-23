import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    Users, UserCheck, Clock, CheckCircle2, 
    XCircle, AlertTriangle, Calendar, Search, 
    RefreshCw, ChevronLeft, ChevronRight, School, 
    ArrowUpRight, Award, ShieldAlert, FileSpreadsheet, 
    Layers, UserX, AlertCircle, TrendingUp, Check
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';
import { useNavigate } from 'react-router-dom';

interface MasterDashboardData {
    date: string;
    children: {
        total_enrolled: number;
        present: number;
        absent: number;
        excused: number;
        late: number;
        early_pickup: number;
        not_arrived: number;
        currently_in_daycare: number;
    };
    staff: {
        scheduled_today: number;
        clocked_in: number;
        on_break: number;
        clocked_out: number;
        missing_clock_out: number;
        late_staff: number;
        overtime_candidates: number;
    };
    classrooms: {
        id: string;
        room_name: string;
        room_code: string;
        capacity: number;
        enrolled_children: number;
        present_children: number;
        absent_children: number;
        late_children: number;
        checked_in_children: number;
        checked_out_children: number;
        occupancy_percentage: number;
        assigned_staff_count: number;
        assigned_staff: string[];
    }[];
}

const MasterAttendanceDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState<MasterDashboardData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'children' | 'staff' | 'classrooms'>('overview');

    const fetchDashboard = async (dateStr: string) => {
        setLoading(true);
        try {
            const res = await api.get('/daycare/attendance/dashboard/', {
                params: { date: dateStr }
            });
            setData(res.data);
        } catch (err) {
            console.error("Failed to load master attendance dashboard:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard(selectedDate);
    }, [selectedDate]);

    const changeDate = (days: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    return (
        <Layout>
            <div className="space-y-6 pb-12">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Unified Attendance Command Center
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Live operational monitoring of enrolled children, scheduled educators, classroom occupancies, and ratio compliance.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Date Navigation */}
                        <div className="flex items-center bg-white rounded-xl p-1 border border-slate-200 shadow-xs">
                            <button
                                onClick={() => changeDate(-1)}
                                className="p-1.5 hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 rounded-lg transition"
                                title="Previous Day"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-slate-900 text-xs font-bold px-2 focus:outline-none"
                            />
                            <button
                                onClick={() => changeDate(1)}
                                className="p-1.5 hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 rounded-lg transition"
                                title="Next Day"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        <button
                            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition"
                        >
                            Today
                        </button>

                        <button
                            onClick={() => fetchDashboard(selectedDate)}
                            disabled={loading}
                            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-xs transition"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Quick Reports Bar */}
                <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs font-semibold">
                    <span className="text-slate-400 px-2 uppercase tracking-wider text-[10px]">Reports & Logs:</span>
                    <button
                        onClick={() => navigate('/daycare/reports/attendance/daily')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                    >
                        Daily Child Report
                    </button>
                    <button
                        onClick={() => navigate('/daycare/reports/attendance/monthly')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                    >
                        Monthly Child Report
                    </button>
                    <button
                        onClick={() => navigate('/daycare/reports/staff-attendance')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                    >
                        Staff Attendance Report
                    </button>
                    <button
                        onClick={() => navigate('/daycare/reports/timesheets')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                    >
                        Timesheets Report
                    </button>
                    <button
                        onClick={() => navigate('/daycare/staff/reports/overtime')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                    >
                        Overtime Analytics
                    </button>
                    <button
                        onClick={() => navigate('/daycare/reports/attendance-audit')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                    >
                        Audit Trail
                    </button>
                </div>

                {/* Section 1: Children Attendance Status (Part A) */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Children Live Attendance Status
                            </h2>
                        </div>
                        <button
                            onClick={() => navigate('/daycare/attendance')}
                            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                        >
                            Open Child Roster <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                        {/* Total Enrolled */}
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-slate-400">Total Enrolled</p>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{data?.children.total_enrolled ?? 0}</h3>
                        </div>

                        {/* Present */}
                        <div className="bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">Present Today</p>
                            <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{data?.children.present ?? 0}</h3>
                        </div>

                        {/* Currently In Daycare */}
                        <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/40 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-indigo-600 dark:text-indigo-400">In Facility Now</p>
                            <h3 className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">{data?.children.currently_in_daycare ?? 0}</h3>
                        </div>

                        {/* Not Arrived */}
                        <div className="bg-amber-50/50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">Not Arrived</p>
                            <h3 className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{data?.children.not_arrived ?? 0}</h3>
                        </div>

                        {/* Late */}
                        <div className="bg-amber-50/50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">Late Arrivals</p>
                            <h3 className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{data?.children.late ?? 0}</h3>
                        </div>

                        {/* Early Pickup */}
                        <div className="bg-violet-50/50 dark:bg-violet-950/30 p-3.5 rounded-xl border border-violet-200 dark:border-violet-800/40 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-violet-600 dark:text-violet-400">Early Pickups</p>
                            <h3 className="text-xl font-bold text-violet-700 dark:text-violet-300 mt-1">{data?.children.early_pickup ?? 0}</h3>
                        </div>

                        {/* Absent */}
                        <div className="bg-rose-50/50 dark:bg-rose-950/30 p-3.5 rounded-xl border border-rose-200 dark:border-rose-800/40 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-rose-600 dark:text-rose-400">Unexcused Absent</p>
                            <h3 className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">{data?.children.absent ?? 0}</h3>
                        </div>

                        {/* Excused */}
                        <div className="bg-blue-50/50 dark:bg-blue-950/30 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800/40 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-blue-600 dark:text-blue-400">Excused Absence</p>
                            <h3 className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-1">{data?.children.excused ?? 0}</h3>
                        </div>
                    </div>
                </div>

                {/* Section 2: Staff Attendance Status (Part A) */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Staff Live Attendance & Shift Tracking
                            </h2>
                        </div>
                        <button
                            onClick={() => navigate('/daycare/staff/attendance')}
                            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                            Open Staff Dashboard <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                        {/* Scheduled */}
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-slate-400">Scheduled Today</p>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{data?.staff.scheduled_today ?? 0}</h3>
                        </div>

                        {/* Clocked In */}
                        <div className="bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">Clocked In Now</p>
                            <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{data?.staff.clocked_in ?? 0}</h3>
                        </div>

                        {/* On Break */}
                        <div className="bg-amber-50/50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">On Active Break</p>
                            <h3 className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{data?.staff.on_break ?? 0}</h3>
                        </div>

                        {/* Clocked Out */}
                        <div className="bg-slate-100 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-slate-500">Shift Completed</p>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-1">{data?.staff.clocked_out ?? 0}</h3>
                        </div>

                        {/* Missing Clock-Out */}
                        <div className="bg-rose-50/50 dark:bg-rose-950/30 p-3.5 rounded-xl border border-rose-200 dark:border-rose-800/40 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-rose-600 dark:text-rose-400">Missing Clock-Out</p>
                            <h3 className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">{data?.staff.missing_clock_out ?? 0}</h3>
                        </div>

                        {/* Late Staff */}
                        <div className="bg-amber-50/50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">Late Staff</p>
                            <h3 className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{data?.staff.late_staff ?? 0}</h3>
                        </div>

                        {/* Overtime Candidates */}
                        <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/40 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-indigo-600 dark:text-indigo-400">Overtime &gt; 8h</p>
                            <h3 className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">{data?.staff.overtime_candidates ?? 0}</h3>
                        </div>
                    </div>
                </div>

                {/* Section 3: Classroom Integration & Occupancy (Part G) */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <School className="w-4 h-4 text-indigo-500" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Classroom Occupancy & Ratio Coverage
                            </h2>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {loading ? (
                            <div className="col-span-3 p-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                                Loading classroom occupancy data...
                            </div>
                        ) : !data?.classrooms || data.classrooms.length === 0 ? (
                            <div className="col-span-3 p-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                                No classrooms registered in this daycare.
                            </div>
                        ) : (
                            data.classrooms.map(c => (
                                <div
                                    key={c.id}
                                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 hover:border-indigo-500/50 transition"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-slate-100">{c.room_name}</h3>
                                            <p className="text-xs text-slate-500">Code: {c.room_code || 'N/A'} • Capacity: {c.capacity}</p>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                            c.occupancy_percentage >= 100
                                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                                : c.occupancy_percentage >= 80
                                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                        }`}>
                                            {c.occupancy_percentage}% Full
                                        </span>
                                    </div>

                                    {/* Occupancy Progress Bar */}
                                    <div className="space-y-1">
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                            <div
                                                style={{ width: `${Math.min(100, c.occupancy_percentage)}%` }}
                                                className={`h-full ${
                                                    c.occupancy_percentage >= 100
                                                        ? 'bg-rose-500'
                                                        : c.occupancy_percentage >= 80
                                                        ? 'bg-amber-500'
                                                        : 'bg-emerald-500'
                                                }`}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[11px] text-slate-500">
                                            <span>{c.checked_in_children} in room</span>
                                            <span>{c.capacity} max</span>
                                        </div>
                                    </div>

                                    {/* Metrics Grid */}
                                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-center text-xs">
                                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                            <p className="text-[10px] text-slate-400">Enrolled</p>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{c.enrolled_children}</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30">
                                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Present</p>
                                            <p className="font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{c.present_children}</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/30">
                                            <p className="text-[10px] text-rose-600 dark:text-rose-400">Absent</p>
                                            <p className="font-bold text-rose-700 dark:text-rose-300 mt-0.5">{c.absent_children}</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/30">
                                            <p className="text-[10px] text-amber-600 dark:text-amber-400">Late</p>
                                            <p className="font-bold text-amber-700 dark:text-amber-300 mt-0.5">{c.late_children}</p>
                                        </div>
                                    </div>

                                    {/* Assigned Staff */}
                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                                        <p className="text-[11px] font-semibold text-slate-500 mb-1">
                                            Assigned Educators ({c.assigned_staff_count}):
                                        </p>
                                        {c.assigned_staff && c.assigned_staff.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {c.assigned_staff.map((name, idx) => (
                                                    <span key={idx} className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-medium border border-indigo-200 dark:border-indigo-800">
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 italic text-[11px]">No staff scheduled</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default MasterAttendanceDashboard;
