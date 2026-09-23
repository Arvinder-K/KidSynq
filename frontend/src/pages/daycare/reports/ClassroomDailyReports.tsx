import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Calendar, ArrowLeft, CheckCircle2, Clock, Users,
    School, ArrowRight, AlertTriangle, FileText, Plus
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';

interface RosterItem {
    child_id: string;
    first_name: string;
    last_name: string;
    preferred_name: string;
    classroom_id: string | null;
    classroom_name: string;
    attendance_status: string;
    is_present: boolean;
    report_id: string | null;
    report_status: string;
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

export const ClassroomDailyReports: React.FC = () => {
    const { classroomId } = useParams<{ classroomId: string }>();
    const navigate = useNavigate();

    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [classroomName, setClassroomName] = useState<string>('Classroom');
    const [roster, setRoster] = useState<RosterItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch classroom details
    useEffect(() => {
        const fetchClassroom = async () => {
            if (!classroomId) return;
            try {
                const res = await api.get(`/daycare/classrooms/${classroomId}/`);
                setClassroomName(res.data.room_name || 'Classroom');
            } catch (err) {
                console.error('Failed to load classroom', err);
            }
        };
        fetchClassroom();
    }, [classroomId]);

    // Fetch classroom roster for date
    const fetchClassroomRoster = useCallback(async () => {
        if (!classroomId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/daycare/daily-reports/roster/', {
                params: {
                    classroom_id: classroomId,
                    date: selectedDate
                }
            });
            setRoster(res.data || []);
        } catch (err: any) {
            console.error('Failed to load classroom roster', err);
            setError('Failed to load classroom daily reports.');
        } finally {
            setLoading(false);
        }
    }, [classroomId, selectedDate]);

    useEffect(() => {
        fetchClassroomRoster();
    }, [fetchClassroomRoster]);

    const totalEnrolled = roster.length;
    const presentCount = roster.filter(r => r.is_present).length;
    const completedCount = roster.filter(r => r.report_status === 'Completed' || r.report_status === 'Published').length;
    const inProgressCount = roster.filter(r => r.report_status === 'Draft').length;

    return (
        <Layout>
            <div className="space-y-6 pb-20 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <Link
                            to="/daycare/classrooms"
                            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-colors shadow-xs"
                            title="Back to Classrooms"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                                {classroomName} – Daily Reports
                            </h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Track, log, and publish daily reports for all children in this room.
                            </p>
                        </div>
                    </div>

                    {/* Date Picker */}
                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-xs">
                        <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                        />
                    </div>
                </div>

                {/* Progress Bar & KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Room Roster</span>
                        <span className="text-xl font-black text-slate-900">{totalEnrolled}</span>
                    </div>
                    <div className="bg-emerald-50/70 border border-emerald-200/80 p-3.5 rounded-2xl">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Checked In (Present)</span>
                        <span className="text-xl font-black text-emerald-900">{presentCount}</span>
                    </div>
                    <div className="bg-blue-50/70 border border-blue-200/80 p-3.5 rounded-2xl">
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Completed Reports</span>
                        <span className="text-xl font-black text-blue-900">{completedCount}</span>
                    </div>
                    <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-2xl">
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">In Progress (Draft)</span>
                        <span className="text-xl font-black text-amber-900">{inProgressCount}</span>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-semibold">
                        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Room Roster Table / Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center min-h-[250px] space-y-3">
                        <div className="w-9 h-9 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading Classroom Roster...</p>
                    </div>
                ) : roster.length === 0 ? (
                    <div className="bg-white p-12 text-center rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                        <Users className="w-10 h-10 text-slate-300 mx-auto" />
                        <h3 className="text-base font-bold text-slate-800">No Children Assigned</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            There are currently no active children assigned to this classroom.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-base font-bold text-slate-900">Classroom Children Roster ({roster.length})</h2>
                            <Link
                                to="/daycare/daily-reports"
                                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                            >
                                <span>All Center Reports</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {roster.map(child => (
                                <div
                                    key={child.child_id}
                                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                                >
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-100 to-teal-50 border border-emerald-200 flex items-center justify-center text-emerald-950 font-black text-sm shrink-0 shadow-sm">
                                            {child.first_name[0]}{child.last_name[0]}
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-900">
                                                {child.first_name} {child.last_name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                    child.attendance_status === 'Present'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : child.attendance_status === 'Absent'
                                                        ? 'bg-rose-100 text-rose-800'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {child.attendance_status}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    {child.total_events} events logged
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action & Status */}
                                    <div className="flex items-center gap-3 self-end sm:self-auto">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                            child.report_status === 'Published'
                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                : child.report_status === 'Completed'
                                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                                : child.report_status === 'Draft'
                                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {child.report_status}
                                        </span>

                                        <button
                                            onClick={() => navigate(`/daycare/daily-reports/${child.child_id}/${selectedDate}`)}
                                            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1.5"
                                        >
                                            <span>Open Report</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default ClassroomDailyReports;
