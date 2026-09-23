import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, Users, Filter, Search, CheckCircle2, Clock,
    AlertTriangle, Baby, Utensils, Moon, Sparkles, Plus,
    ArrowRight, ChevronRight, School, Camera, FileText, HeartPulse,
    LayoutDashboard, History
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import api from '../../../api';

interface RosterItem {
    child_id: string;
    first_name: string;
    last_name: string;
    preferred_name: string;
    photo_path: string | null;
    classroom_id: string | null;
    classroom_name: string;
    attendance_status: string;
    is_present: boolean;
    report_id: string | null;
    report_status: string; // 'Draft' | 'Completed' | 'Published' | 'Not Started' | 'No Report'
    total_events: number;
    event_counts: {
        meals: number;
        naps: number;
        toileting: number;
        activities: number;
        moods: number;
        temperatures: number;
        notes: number;
        photos: number;
        has_incident: boolean;
        has_medication: boolean;
    };
    completed_at: string | null;
    published_at: string | null;
}

interface ClassroomOption {
    id: string;
    room_name: string;
}

export const DailyReportsHub: React.FC = () => {
    const navigate = useNavigate();
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('All');

    const [roster, setRoster] = useState<RosterItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch classrooms for filter dropdown
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

    // Fetch roster summary
    const fetchRoster = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: any = { date: selectedDate };
            if (selectedClassroom) {
                params.classroom_id = selectedClassroom;
            }
            const res = await api.get('/daycare/daily-reports/roster/', { params });
            setRoster(res.data || []);
        } catch (err: any) {
            console.error('Failed to fetch daily reports roster', err);
            setError('Failed to load daily reports data. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [selectedDate, selectedClassroom]);

    useEffect(() => {
        fetchRoster();
    }, [fetchRoster]);

    // Handle Open or Start Report
    const handleOpenReport = async (item: RosterItem) => {
        try {
            navigate(`/daycare/daily-reports/${item.child_id}/${selectedDate}`);
        } catch (err) {
            console.error('Failed to navigate to report', err);
        }
    };

    // Filtered roster with null-safe protections
    const filteredRoster = (Array.isArray(roster) ? roster : []).filter(item => {
        if (!item) return false;
        const firstName = item.first_name || '';
        const lastName = item.last_name || '';
        const classroomName = item.classroom_name || '';
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        
        const matchesSearch = !searchQuery.trim() || 
            fullName.includes(searchQuery.toLowerCase()) || 
            classroomName.toLowerCase().includes(searchQuery.toLowerCase());
        
        let matchesStatus = true;
        const repStatus = (item.report_status || 'Not Started').toLowerCase();
        if (statusFilter !== 'All') {
            if (statusFilter === 'Not Started') {
                matchesStatus = repStatus === 'not started' || repStatus === 'no report';
            } else {
                matchesStatus = repStatus === statusFilter.toLowerCase();
            }
        }
        return matchesSearch && matchesStatus;
    });

    // KPI stats
    const safeRoster = Array.isArray(roster) ? roster : [];
    const totalChildren = safeRoster.length;
    const presentCount = safeRoster.filter(r => r && r.is_present).length;
    const completedCount = safeRoster.filter(r => r && ((r.report_status || '').toLowerCase() === 'completed' || (r.report_status || '').toLowerCase() === 'published')).length;
    const inProgressCount = safeRoster.filter(r => r && (r.report_status || '').toLowerCase() === 'draft').length;
    const notStartedCount = safeRoster.filter(r => r && r.is_present && ((r.report_status || '').toLowerCase() === 'not started' || (r.report_status || '').toLowerCase() === 'no report')).length;

    const getStatusBadge = (statusStr: string | undefined | null, isPresent: boolean) => {
        const s = (statusStr || '').toLowerCase();
        switch (s) {
            case 'published':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Published
                    </span>
                );
            case 'completed':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        <CheckCircle2 className="w-3 h-3 text-blue-600" /> Completed
                    </span>
                );
            case 'draft':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" /> In Progress
                    </span>
                );
            default:
                return isPresent ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        Not Started
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        Absent / No Report
                    </span>
                );
        }
    };

    return (
        <Layout>
            <div className="space-y-6 pb-20 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Daily Child Reports Hub</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Record daily activities, meals, snacks, naps, potty routines, mood, learning milestones, and photos for children in real-time.
                        </p>
                    </div>

                    {/* Date Picker & View Switchers */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-xs">
                            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                            />
                        </div>

                        <Link
                            to="/daycare/daily-reports/dashboard"
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                        >
                            <LayoutDashboard className="w-3.5 h-3.5 text-cyan-600" />
                            <span>Live Matrix</span>
                        </Link>

                        <Link
                            to="/daycare/daily-reports/history"
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                        >
                            <History className="w-3.5 h-3.5 text-slate-500" />
                            <span>Archive</span>
                        </Link>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-2xl">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Children</span>
                            <span className="text-xl font-black text-slate-900">{totalChildren}</span>
                        </div>
                        <div className="bg-emerald-50/70 border border-emerald-200/80 p-3.5 rounded-2xl">
                            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Present Today</span>
                            <span className="text-xl font-black text-emerald-900">{presentCount}</span>
                        </div>
                        <div className="bg-blue-50/70 border border-blue-200/80 p-3.5 rounded-2xl">
                            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">Completed</span>
                            <span className="text-xl font-black text-blue-900">{completedCount}</span>
                        </div>
                        <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-2xl">
                            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">In Progress</span>
                            <span className="text-xl font-black text-amber-900">{inProgressCount}</span>
                        </div>
                        <div className="bg-purple-50/70 border border-purple-200/80 p-3.5 rounded-2xl col-span-2 sm:col-span-1">
                            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block">Pending Start</span>
                            <span className="text-xl font-black text-purple-900">{notStartedCount}</span>
                        </div>
                    </div>

                {/* Filters & Search Toolbar */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by child name or room..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>

                        <select
                            value={selectedClassroom}
                            onChange={(e) => setSelectedClassroom(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-emerald-500 outline-none transition-all cursor-pointer"
                        >
                            <option value="">All Classrooms</option>
                            {classrooms.map(c => (
                                <option key={c.id} value={c.id}>{c.room_name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-stretch md:self-auto overflow-x-auto">
                        {['All', 'Draft', 'Completed', 'Published', 'Not Started'].map((st) => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                    statusFilter === st
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-semibold">
                        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Roster Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
                        <div className="w-9 h-9 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading Children Roster...</p>
                    </div>
                ) : filteredRoster.length === 0 ? (
                    <div className="bg-white p-12 text-center rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl mx-auto flex items-center justify-center">
                            <Users className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-slate-800">No Children Found</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            No children matched your filter criteria for the selected date and classroom.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredRoster.map((item) => {
                            const initialA = (item.first_name ? item.first_name.charAt(0) : (item.preferred_name ? item.preferred_name.charAt(0) : 'C')).toUpperCase();
                            const initialB = (item.last_name ? item.last_name.charAt(0) : '').toUpperCase();
                            const counts = item.event_counts || {
                                meals: 0, naps: 0, toileting: 0, activities: 0,
                                moods: 0, temperatures: 0, notes: 0, photos: 0,
                                has_incident: false, has_medication: false
                            };

                            return (
                                <motion.div
                                    key={item.child_id}
                                    whileHover={{ y: -2 }}
                                    transition={{ duration: 0.15 }}
                                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300/80 transition-all p-5 flex flex-col justify-between"
                                >
                                    <div>
                                        {/* Card Header */}
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-100 to-teal-50 border border-emerald-200 flex items-center justify-center text-emerald-900 font-black text-sm shrink-0 shadow-sm">
                                                    {initialA}{initialB}
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-slate-900">
                                                        {item.first_name || 'Child'} {item.last_name || ''}
                                                    </h3>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        <School className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>{item.classroom_name || 'General Classroom'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            {getStatusBadge(item.report_status, !!item.is_present)}
                                        </div>

                                        {/* Attendance Badge */}
                                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                item.attendance_status === 'Present'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : item.attendance_status === 'Absent'
                                                    ? 'bg-rose-100 text-rose-800'
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                Attendance: {item.attendance_status || 'Unrecorded'}
                                            </span>
                                            {counts.has_incident && (
                                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                    ⚠️ Incident Logged
                                                </span>
                                            )}
                                            {counts.has_medication && (
                                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                                    💊 Med Given
                                                </span>
                                            )}
                                        </div>

                                        {/* Event Counters Grid */}
                                        <div className="grid grid-cols-4 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 mb-4 text-center">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 block">Meals</span>
                                                <span className="text-xs font-black text-slate-700">{counts.meals || 0}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 block">Naps</span>
                                                <span className="text-xs font-black text-slate-700">{counts.naps || 0}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 block">Diapers/Potty</span>
                                                <span className="text-xs font-black text-slate-700">{counts.toileting || 0}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 block">Activities</span>
                                                <span className="text-xs font-black text-slate-700">{counts.activities || 0}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Footer Action */}
                                    <button
                                        onClick={() => handleOpenReport(item)}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm hover:shadow hover:scale-[1.01] active:scale-[0.99] transition-all"
                                    >
                                        <span>{(item.report_status || '').toLowerCase() === 'not started' || (item.report_status || '').toLowerCase() === 'no report' ? 'Start Daily Report' : 'Open Daily Report'}</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default DailyReportsHub;
