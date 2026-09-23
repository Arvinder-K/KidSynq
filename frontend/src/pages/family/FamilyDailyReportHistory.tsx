import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Calendar, Search, Filter, History, ArrowRight,
    Camera, Utensils, Moon, Baby, BookOpen, Smile, ChevronLeft
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api';

interface Child {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
}

interface HistoricalReport {
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
    attendance_status: string;
    care_summary?: {
        meals_count: number;
        snacks_count: number;
        naps_count: number;
        diapers_count: number;
        toileting_count: number;
        activities_count: number;
        photos_count: number;
    };
    photos: { id: string; photo_url: string; caption: string }[];
    moods: { id: string; mood: string }[];
}

export const FamilyDailyReportHistory: React.FC = () => {
    const navigate = useNavigate();

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 60);

    const [children, setChildren] = useState<Child[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string>('');
    const [startDate, setStartDate] = useState<string>(thirtyDaysAgo.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState<string>(today.toISOString().split('T')[0]);

    const [reports, setReports] = useState<HistoricalReport[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch authorized children
    useEffect(() => {
        api.get('/family/children/').then((res) => {
            const list = res.data || [];
            setChildren(list);
            if (list.length > 0 && !selectedChildId) {
                setSelectedChildId(list[0].id);
            }
        });
    }, []);

    // Search historical reports
    const fetchHistory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: any = {
                start_date: startDate,
                end_date: endDate
            };
            if (selectedChildId) {
                params.student_id = selectedChildId;
            }
            const res = await api.get('/family/daily-reports/history/', { params });
            setReports(res.data || []);
        } catch (err: any) {
            console.error('Failed to search family daily reports history', err);
            setError(err.response?.data?.detail || 'Failed to load report history.');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, selectedChildId]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    return (
        <Layout>
            <div className="space-y-6 pb-20 max-w-5xl mx-auto">
                {/* Header Card */}
                <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <Link
                                to="/family/daily-reports"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 mb-2 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span>Back to Daily Reports Hub</span>
                            </Link>
                            <h1 className="text-2xl font-bold text-slate-800">Daily Report History & Archive</h1>
                            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                                Search and browse past daily reports, memories, and care records for your child.
                            </p>
                        </div>
                    </div>

                    {/* Filter Controls */}
                    <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Child selector */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Child
                            </label>
                            <select
                                value={selectedChildId}
                                onChange={(e) => setSelectedChildId(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="">All Children</option>
                                {children.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.preferred_name || `${c.first_name} ${c.last_name}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Start Date */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                From Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        {/* End Date */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                To Date
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>
                </div>

                {/* Reports Grid */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-rose-600 font-semibold text-sm bg-white rounded-3xl border border-slate-200">
                        {error}
                    </div>
                ) : reports.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
                        <History className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600 text-sm">No daily reports found in this date range.</p>
                        <p className="text-xs text-slate-400 mt-1">Try expanding the date range above.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {reports.map((report) => (
                            <motion.div
                                key={report.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all space-y-4"
                            >
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">
                                            {new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-CA', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </p>
                                        <p className="text-[11px] text-slate-400">
                                            {report.preferred_name || report.child_name} • {report.classroom_name}
                                        </p>
                                    </div>

                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                        Published
                                    </span>
                                </div>

                                {/* Care Summary counts */}
                                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                    <div className="bg-slate-50 p-2 rounded-xl">
                                        <Utensils className="w-3.5 h-3.5 text-amber-500 mx-auto mb-0.5" />
                                        <span className="font-bold text-slate-700">{report.care_summary?.meals_count || 0} Meals</span>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-xl">
                                        <Moon className="w-3.5 h-3.5 text-indigo-500 mx-auto mb-0.5" />
                                        <span className="font-bold text-slate-700">{report.care_summary?.naps_count || 0} Naps</span>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-xl">
                                        <BookOpen className="w-3.5 h-3.5 text-blue-500 mx-auto mb-0.5" />
                                        <span className="font-bold text-slate-700">{report.care_summary?.activities_count || 0} Acts</span>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-xl">
                                        <Camera className="w-3.5 h-3.5 text-purple-500 mx-auto mb-0.5" />
                                        <span className="font-bold text-slate-700">{report.care_summary?.photos_count || 0} Photos</span>
                                    </div>
                                </div>

                                <div className="pt-2 text-right">
                                    <button
                                        onClick={() => navigate(`/family/daily-reports/${report.student || report.child_id}/${report.report_date}`)}
                                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
                                    >
                                        <span>View Full Report</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default FamilyDailyReportHistory;
