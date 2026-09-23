import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Calendar, Users, CheckCircle2, Clock, AlertTriangle,
    Baby, ArrowRight, ShieldCheck, Send, Sparkles,
    BarChart3, School, History, ChevronRight, FileSpreadsheet, RefreshCw
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import api from '../../../api';

interface ClassroomSummary {
    classroom_id: string;
    classroom_name: string;
    primary_teacher_name: string;
    total_enrolled: number;
    total_present: number;
    total_draft: number;
    total_completed: number;
    total_published: number;
    total_not_started: number;
    completion_percentage: number;
}

interface PendingChild {
    child_id: string;
    child_name: string;
    classroom_name: string;
    attendance_status: string;
    report_status: string;
}

interface DashboardData {
    date: string;
    kpis: {
        total_enrolled: number;
        total_present: number;
        total_started: number;
        total_completed: number;
        total_published: number;
        total_pending: number;
        facility_completion_rate: number;
    };
    classrooms: ClassroomSummary[];
    pending_children: PendingChild[];
}

export const DailyReportsDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboard = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const res = await api.get('/daycare/daily-reports/dashboard/', {
                params: { date: selectedDate }
            });
            setData(res.data);
        } catch (err: any) {
            console.error('Failed to load dashboard data', err);
            setError(err.response?.data?.detail || 'Failed to fetch dashboard data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, [selectedDate]);

    return (
        <Layout>
            <div className="space-y-6 pb-20 max-w-7xl mx-auto">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Daily Reports Dashboard</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Real-time monitoring of daily care entries, report completion status, and guardian publishing across all classrooms.
                        </p>
                    </div>

                    {/* Date Picker & Quick Actions */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-slate-900 font-medium text-sm focus:outline-none border-none cursor-pointer"
                            />
                        </div>

                        <button
                            onClick={() => fetchDashboard(true)}
                            disabled={refreshing}
                            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-xs transition-all disabled:opacity-50"
                            title="Refresh Dashboard"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>

                        <Link
                            to="/daycare/daily-reports"
                            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition-all flex items-center gap-2"
                        >
                            <Users className="w-4 h-4" />
                            <span>Roster Hub</span>
                        </Link>

                        <Link
                            to="/daycare/daily-reports/history"
                            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold shadow-xs transition-all flex items-center gap-2"
                        >
                            <History className="w-4 h-4" />
                            <span>Archive</span>
                        </Link>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-24">
                        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : error ? (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl text-center">
                        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                        <p className="font-semibold">{error}</p>
                    </div>
                ) : data ? (
                    (() => {
                        const kpis = data.kpis || {
                            total_enrolled: 0,
                            total_present: 0,
                            total_started: 0,
                            total_completed: 0,
                            total_published: 0,
                            total_pending: 0,
                            facility_completion_rate: 0
                        };
                        const classrooms = data.classrooms || [];
                        const pendingChildren = data.pending_children || [];

                        return (
                            <>
                                {/* KPI Metrics Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.05 }}
                                        className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm"
                                    >
                                        <div className="flex items-center justify-between text-slate-500 mb-2">
                                            <span className="text-xs font-semibold uppercase tracking-wider">Present</span>
                                            <Users className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div className="text-2xl font-black text-slate-800">{kpis.total_present}</div>
                                        <div className="text-[11px] text-slate-500 mt-1">of {kpis.total_enrolled} enrolled</div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 }}
                                        className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm"
                                    >
                                        <div className="flex items-center justify-between text-amber-600 mb-2">
                                            <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
                                            <Clock className="w-4 h-4 text-amber-500" />
                                        </div>
                                        <div className="text-2xl font-black text-amber-600">{kpis.total_started}</div>
                                        <div className="text-[11px] text-slate-500 mt-1">Drafts being updated</div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.15 }}
                                        className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm"
                                    >
                                        <div className="flex items-center justify-between text-blue-600 mb-2">
                                            <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
                                            <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <div className="text-2xl font-black text-blue-600">{kpis.total_completed}</div>
                                        <div className="text-[11px] text-slate-500 mt-1">Ready for publishing</div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm"
                                    >
                                        <div className="flex items-center justify-between text-emerald-600 mb-2">
                                            <span className="text-xs font-semibold uppercase tracking-wider">Published</span>
                                            <Send className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <div className="text-2xl font-black text-emerald-600">{kpis.total_published}</div>
                                        <div className="text-[11px] text-slate-500 mt-1">Visible to guardians</div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.25 }}
                                        className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm"
                                    >
                                        <div className="flex items-center justify-between text-rose-600 mb-2">
                                            <span className="text-xs font-semibold uppercase tracking-wider">Pending</span>
                                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                                        </div>
                                        <div className="text-2xl font-black text-rose-600">{kpis.total_pending}</div>
                                        <div className="text-[11px] text-slate-500 mt-1">Present, no draft</div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm"
                                    >
                                        <div className="flex items-center justify-between text-indigo-600 mb-2">
                                            <span className="text-xs font-semibold uppercase tracking-wider">Progress</span>
                                            <BarChart3 className="w-4 h-4 text-indigo-500" />
                                        </div>
                                        <div className="text-2xl font-black text-indigo-600">{kpis.facility_completion_rate}%</div>
                                        <div className="text-[11px] text-slate-500 mt-1">Facility completion</div>
                                    </motion.div>
                                </div>

                                {/* Overall Facility Progress Bar */}
                                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="text-base font-bold text-slate-800">Facility Daily Reporting Completion</h3>
                                            <p className="text-xs text-slate-500">Breakdown of reports for all {kpis.total_present} present children today</p>
                                        </div>
                                        <span className="text-sm font-bold text-indigo-600">
                                            {kpis.total_published + kpis.total_completed} / {kpis.total_present} Finalized
                                        </span>
                                    </div>

                                    <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden flex shadow-inner">
                                        {kpis.total_present > 0 && (
                                            <>
                                                <div
                                                    style={{ width: `${(kpis.total_published / kpis.total_present) * 100}%` }}
                                                    className="bg-emerald-500 h-full transition-all"
                                                    title={`Published: ${kpis.total_published}`}
                                                />
                                                <div
                                                    style={{ width: `${(kpis.total_completed / kpis.total_present) * 100}%` }}
                                                    className="bg-blue-500 h-full transition-all"
                                                    title={`Completed: ${kpis.total_completed}`}
                                                />
                                                <div
                                                    style={{ width: `${(kpis.total_started / kpis.total_present) * 100}%` }}
                                                    className="bg-amber-400 h-full transition-all"
                                                    title={`In Progress: ${kpis.total_started}`}
                                                />
                                                <div
                                                    style={{ width: `${(kpis.total_pending / kpis.total_present) * 100}%` }}
                                                    className="bg-slate-200 h-full transition-all"
                                                    title={`Pending: ${kpis.total_pending}`}
                                                />
                                            </>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-6 mt-4 text-xs font-medium text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-emerald-500" />
                                            <span>Published ({kpis.total_published})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-blue-500" />
                                            <span>Completed ({kpis.total_completed})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-amber-400" />
                                            <span>In Progress ({kpis.total_started})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-slate-200" />
                                            <span>Pending ({kpis.total_pending})</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Classroom Progress Matrix */}
                                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800">Classroom Progress Matrix</h3>
                                            <p className="text-xs text-slate-500">Live reporting status by classroom room and educators</p>
                                        </div>
                                        <Link
                                            to="/daycare/daily-reports"
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                        >
                                            <span>Open All in Roster Hub</span>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/75 border-b border-slate-200/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                    <th className="py-3.5 px-6">Classroom</th>
                                                    <th className="py-3.5 px-4">Educator</th>
                                                    <th className="py-3.5 px-4 text-center">Present</th>
                                                    <th className="py-3.5 px-4 text-center">In Progress</th>
                                                    <th className="py-3.5 px-4 text-center">Completed</th>
                                                    <th className="py-3.5 px-4 text-center">Published</th>
                                                    <th className="py-3.5 px-4 text-center">Pending</th>
                                                    <th className="py-3.5 px-6">Progress</th>
                                                    <th className="py-3.5 px-6 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-sm">
                                                {classrooms.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={9} className="py-8 text-center text-slate-400">
                                                            No classrooms configured.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    classrooms.map((room) => (
                                                        <tr key={room.classroom_id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="py-4 px-6 font-semibold text-slate-800">
                                                                <div className="flex items-center gap-2">
                                                                    <School className="w-4 h-4 text-indigo-500" />
                                                                    <span>{room.classroom_name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-4 text-slate-600 text-xs font-medium">
                                                                {room.primary_teacher_name}
                                                            </td>
                                                            <td className="py-4 px-4 text-center font-bold text-slate-800">
                                                                {room.total_present}
                                                            </td>
                                                            <td className="py-4 px-4 text-center font-semibold text-amber-600">
                                                                {room.total_draft}
                                                            </td>
                                                            <td className="py-4 px-4 text-center font-semibold text-blue-600">
                                                                {room.total_completed}
                                                            </td>
                                                            <td className="py-4 px-4 text-center font-semibold text-emerald-600">
                                                                {room.total_published}
                                                            </td>
                                                            <td className="py-4 px-4 text-center font-semibold text-rose-600">
                                                                {room.total_not_started}
                                                            </td>
                                                            <td className="py-4 px-6">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="bg-indigo-600 h-full rounded-full transition-all"
                                                                            style={{ width: `${room.completion_percentage}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-xs font-bold text-slate-700">{room.completion_percentage}%</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-6 text-right">
                                                                <button
                                                                    onClick={() => navigate(`/daycare/daily-reports?classroom_id=${room.classroom_id}&date=${selectedDate}`)}
                                                                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-semibold transition-colors inline-flex items-center gap-1"
                                                                >
                                                                    <span>View Roster</span>
                                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Pending Reports Callout List */}
                                {pendingChildren.length > 0 && (
                                    <div className="bg-amber-50/70 border border-amber-200/90 rounded-3xl p-6 shadow-sm">
                                        <div className="flex items-center gap-2 text-amber-900 font-bold text-base mb-1">
                                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                                            <span>Children Present Requiring Daily Reports ({pendingChildren.length})</span>
                                        </div>
                                        <p className="text-xs text-amber-700 mb-4">
                                            The following children are marked present today but have not yet had care activities recorded:
                                        </p>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {pendingChildren.map((child) => (
                                                <div
                                                    key={child.child_id}
                                                    className="bg-white p-3.5 rounded-2xl border border-amber-200 flex items-center justify-between shadow-xs hover:shadow-md transition-shadow"
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <p className="font-bold text-slate-800 text-xs truncate">{child.child_name}</p>
                                                        <p className="text-[11px] text-slate-500 truncate">{child.classroom_name}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => navigate(`/daycare/daily-reports/${child.child_id}/${selectedDate}`)}
                                                        className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 text-xs font-semibold transition-all shrink-0"
                                                    >
                                                        Start Report
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()
                ) : null}
            </div>
        </Layout>
    );
};

export default DailyReportsDashboard;
