import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Calendar, Search, Filter, History, CheckCircle2, Clock,
    Send, Printer, ArrowRight, School, User, Sparkles, AlertCircle, RefreshCw
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import api from '../../../api';

interface DailyReportSummary {
    id: string;
    student: string;
    child_id: string;
    child_name: string;
    preferred_name: string;
    child_photo: string | null;
    classroom_name: string;
    teacher_name: string;
    report_date: string;
    status: string;
    completed_at: string | null;
    published_at: string | null;
    created_at: string;
    attendance_status: string;
    care_summary?: {
        meals_count: number;
        snacks_count: number;
        naps_count: number;
        diapers_count: number;
        toileting_count: number;
        activities_count: number;
        photos_count: number;
        medications_count: number;
        incidents_count: number;
    };
}

interface ClassroomOption {
    id: string;
    room_name: string;
}

export const DailyReportsHistory: React.FC = () => {
    const navigate = useNavigate();

    // Default to last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const [startDate, setStartDate] = useState<string>(thirtyDaysAgo.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState<string>(today.toISOString().split('T')[0]);
    const [classroomId, setClassroomId] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
    const [reports, setReports] = useState<DailyReportSummary[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch classrooms
    useEffect(() => {
        const fetchClassrooms = async () => {
            try {
                const res = await api.get('/daycare/classrooms/');
                const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
                setClassrooms(data);
            } catch (err) {
                console.error('Failed to load classrooms', err);
            }
        };
        fetchClassrooms();
    }, []);

    // Search historical reports
    const fetchHistory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: any = {
                start_date: startDate,
                end_date: endDate,
            };
            if (classroomId) params.classroom_id = classroomId;
            if (statusFilter && statusFilter !== 'All') params.status = statusFilter;
            if (searchQuery) params.search = searchQuery;

            const res = await api.get('/daycare/daily-reports/history/', { params });
            setReports(res.data || []);
        } catch (err: any) {
            console.error('Failed to search historical reports', err);
            setError(err.response?.data?.detail || 'Failed to search historical daily reports.');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, classroomId, statusFilter, searchQuery]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const setQuickRange = (type: 'today' | '7days' | '30days' | 'this_month') => {
        const now = new Date();
        const endStr = now.toISOString().split('T')[0];
        let start = new Date();

        if (type === 'today') {
            setStartDate(endStr);
            setEndDate(endStr);
        } else if (type === '7days') {
            start.setDate(now.getDate() - 7);
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(endStr);
        } else if (type === '30days') {
            start.setDate(now.getDate() - 30);
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(endStr);
        } else if (type === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            setStartDate(firstDay.toISOString().split('T')[0]);
            setEndDate(endStr);
        }
    };

    const getStatusBadge = (statusStr: string) => {
        switch (statusStr.toLowerCase()) {
            case 'published':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <Send className="w-3 h-3 text-emerald-600" /> Published
                    </span>
                );
            case 'completed':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        <CheckCircle2 className="w-3 h-3 text-blue-600" /> Completed
                    </span>
                );
            case 'draft':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" /> In Progress
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {statusStr}
                    </span>
                );
        }
    };

    return (
        <Layout>
            <div className="space-y-6 pb-20 max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs tracking-wider uppercase mb-1">
                                <History className="w-4 h-4" />
                                <span>Historical Records & Archives</span>
                            </div>
                            <h1 className="text-2xl font-bold text-slate-800">Daily Child Reports History</h1>
                            <p className="text-slate-500 text-sm mt-0.5">
                                Search, audit, review and print past daily care reports across all enrolled children.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <Link
                                to="/daycare/daily-reports/dashboard"
                                className="px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                            >
                                Dashboard View
                            </Link>
                            <Link
                                to="/daycare/daily-reports"
                                className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition-colors"
                            >
                                Live Roster Hub
                            </Link>
                        </div>
                    </div>

                    {/* Filter Controls Bar */}
                    <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 mr-2">Quick Dates:</span>
                            <button
                                onClick={() => setQuickRange('today')}
                                className="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition-colors"
                            >
                                Today
                            </button>
                            <button
                                onClick={() => setQuickRange('7days')}
                                className="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition-colors"
                            >
                                Last 7 Days
                            </button>
                            <button
                                onClick={() => setQuickRange('this_month')}
                                className="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition-colors"
                            >
                                This Month
                            </button>
                            <button
                                onClick={() => setQuickRange('30days')}
                                className="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition-colors"
                            >
                                Last 30 Days
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Classroom
                                </label>
                                <select
                                    value={classroomId}
                                    onChange={(e) => setClassroomId(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="">All Classrooms</option>
                                    {classrooms.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.room_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Status
                                </label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="All">All Statuses</option>
                                    <option value="Draft">In Progress (Draft)</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Published">Published</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Child / Educator Search
                                </label>
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by name..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results Table */}
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">Matching Reports ({reports.length})</span>
                            <span className="text-xs text-slate-400">| Showing up to 100 recent entries</span>
                        </div>
                        <button
                            onClick={() => window.print()}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print Table</span>
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center text-rose-600 font-semibold text-sm">
                            {error}
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="p-16 text-center text-slate-400">
                            <History className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                            <p className="font-semibold text-slate-600 text-sm">No historical daily reports found</p>
                            <p className="text-xs text-slate-400 mt-1">Try expanding your date range or adjusting the filters.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/75 border-b border-slate-200/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="py-3.5 px-6">Child</th>
                                        <th className="py-3.5 px-4">Classroom</th>
                                        <th className="py-3.5 px-4">Date</th>
                                        <th className="py-3.5 px-4">Educator</th>
                                        <th className="py-3.5 px-4 text-center">Status</th>
                                        <th className="py-3.5 px-6 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {reports.map((report) => (
                                        <tr key={report.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4 px-6 font-semibold text-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase overflow-hidden shrink-0">
                                                        {report.child_photo ? (
                                                            <img src={report.child_photo} alt={report.child_name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            report.child_name.charAt(0)
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800 text-xs">
                                                            {report.preferred_name || report.child_name}
                                                        </div>
                                                        {report.preferred_name && report.preferred_name !== report.child_name && (
                                                            <div className="text-[10px] text-slate-400">({report.child_name})</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-slate-600 text-xs">
                                                {report.classroom_name}
                                            </td>
                                            <td className="py-4 px-4 font-semibold text-slate-700 text-xs">
                                                {new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-CA', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </td>
                                            <td className="py-4 px-4 text-slate-600 text-xs">
                                                {report.teacher_name}
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                {getStatusBadge(report.status)}
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <button
                                                    onClick={() => navigate(`/daycare/daily-reports/${report.student || report.child_id}/${report.report_date}`)}
                                                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-semibold transition-colors inline-flex items-center gap-1"
                                                >
                                                    <span>Open Report</span>
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default DailyReportsHistory;
