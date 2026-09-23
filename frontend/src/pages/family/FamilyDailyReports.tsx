import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../api';
import { motion } from 'framer-motion';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
    ClipboardList, Utensils, Moon, Droplets, Activity, Smile,
    ChevronLeft, ChevronRight, History, ArrowRight, Camera,
    Baby, BookOpen, ShieldCheck, Sparkles, CheckCircle2
} from 'lucide-react';

interface Child {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    photo: string | null;
}

interface MealRecord {
    id: string;
    meal_type: string;
    food_provided: string;
    amount_eaten: string;
}

interface NapRecord {
    id: string;
    start_time: string;
    end_time: string;
    quality: string;
}

interface ToiletRecord {
    id: string;
    type: string;
    condition: string;
}

interface ActivityRecord {
    id: string;
    name: string;
    description: string;
    teacher_notes: string;
}

interface MoodRecord {
    id: string;
    mood: string;
}

interface DailyReport {
    id: string;
    student: string;
    child_id: string;
    report_date: string;
    status: string;
    classroom_name: string;
    teacher_name: string;
    attendance_status: string;
    check_in_time: string | null;
    check_out_time: string | null;
    meals: MealRecord[];
    snacks: MealRecord[];
    naps: NapRecord[];
    diapers: ToiletRecord[];
    toileting: ToiletRecord[];
    activities: ActivityRecord[];
    moods: MoodRecord[];
    photos: { id: string; photo_url: string; caption: string }[];
    care_summary?: {
        meals_count: number;
        snacks_count: number;
        naps_count: number;
        diapers_count: number;
        toileting_count: number;
        activities_count: number;
        photos_count: number;
    };
    checklist?: {
        completion_percentage: number;
    };
}

const moodEmojis: Record<string, string> = {
    Happy: '😊',
    Joyful: '😁',
    Sad: '😢',
    Fussy: '😤',
    Calm: '😌',
    Excited: '🤩',
    Tired: '😴',
    Cranky: '😠',
    Curious: '🧐'
};

export const FamilyDailyReports: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const preselectedChild = searchParams.get('child');

    const [children, setChildren] = useState<Child[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(preselectedChild);
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [currentDate, setCurrentDate] = useState<Date>(new Date());

    useEffect(() => {
        api.get('/family/children/').then((res) => {
            const list = res.data || [];
            setChildren(list);
            if (!selectedChildId && list.length > 0) {
                setSelectedChildId(list[0].id);
            }
        });
    }, []);

    useEffect(() => {
        if (!selectedChildId) return;
        setLoading(true);
        api.get(`/family/daily-reports/?student_id=${selectedChildId}&year=${currentDate.getFullYear()}&month=${currentDate.getMonth() + 1}`)
            .then((res) => setReports(res.data || []))
            .catch(() => {
                // Fallback to child-specific route if needed
                api.get(`/family/children/${selectedChildId}/daily-reports/?year=${currentDate.getFullYear()}&month=${currentDate.getMonth() + 1}`)
                    .then((res) => setReports(res.data || []));
            })
            .finally(() => setLoading(false));
    }, [selectedChildId, currentDate]);

    const monthLabel = currentDate.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
    const selectedChild = children.find((c) => c.id === selectedChildId);

    return (
        <Layout>
            <div className="space-y-6 pb-20 max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Daily Reports</h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Real-time activities, nutrition, nap times, learning and photos from daycare.
                        </p>
                    </div>

                    <Link
                        to="/family/daily-reports/history"
                        className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all inline-flex items-center gap-2 self-start sm:self-auto"
                    >
                        <History className="w-4 h-4 text-indigo-600" />
                        <span>Report Archive</span>
                    </Link>
                </div>

                {/* Child Selector Tabs */}
                {children.length > 1 && (
                    <div className="flex gap-2 flex-wrap">
                        {children.map((child) => (
                            <button
                                key={child.id}
                                onClick={() => setSelectedChildId(child.id)}
                                className={`px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all ${
                                    selectedChildId === child.id
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                                }`}
                            >
                                {child.preferred_name || `${child.first_name} ${child.last_name}`}
                            </button>
                        ))}
                    </div>
                )}

                {/* Month Navigator */}
                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                            className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-bold text-slate-800 min-w-[140px] text-center">
                            {monthLabel}
                        </span>
                        <button
                            onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                            disabled={
                                currentDate.getMonth() >= new Date().getMonth() &&
                                currentDate.getFullYear() >= new Date().getFullYear()
                            }
                            className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="text-xs font-bold text-slate-500">
                        {reports.length} Published {reports.length === 1 ? 'Report' : 'Reports'}
                    </div>
                </div>

                {/* Reports Feed */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : reports.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-3xl p-14 text-center space-y-2">
                        <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <h3 className="font-bold text-slate-700 text-base">No Published Reports for this Month</h3>
                        <p className="text-slate-500 text-xs max-w-sm mx-auto">
                            Daily reports will appear here as soon as they are completed and published by the educator.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reports.map((report, i) => {
                            const dateObj = new Date(report.report_date + 'T00:00:00');
                            const dateTitle = dateObj.toLocaleDateString('en-CA', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                            });

                            return (
                                <motion.div
                                    key={report.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="bg-white border border-slate-200/90 rounded-3xl shadow-xs overflow-hidden hover:shadow-md transition-shadow"
                                >
                                    {/* Card Header */}
                                    <div className="bg-gradient-to-r from-slate-50 to-indigo-50/40 px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <p className="font-bold text-slate-900 text-base">{dateTitle}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {report.classroom_name} • Educator: {report.teacher_name}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                <span>Published</span>
                                            </span>

                                            <button
                                                onClick={() =>
                                                    navigate(
                                                        `/family/daily-reports/${report.student || report.child_id || selectedChildId}/${report.report_date}`
                                                    )
                                                }
                                                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
                                            >
                                                <span>View Full 16-Section Report</span>
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Card Summary Quick View */}
                                    <div className="p-6 space-y-4">
                                        {/* Attendance & Mood */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-700">Attendance:</span>
                                                <span className="text-slate-600">{report.attendance_status || 'Present'}</span>
                                                {report.check_in_time && (
                                                    <span className="text-slate-400">
                                                        ({report.check_in_time}{report.check_out_time ? ` - ${report.check_out_time}` : ''})
                                                    </span>
                                                )}
                                            </div>

                                            {report.moods && report.moods.length > 0 && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-slate-700">Mood:</span>
                                                    <span>{moodEmojis[report.moods[0].mood] || report.moods[0].mood}</span>
                                                    <span className="text-slate-600">{report.moods[0].mood}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Care Metrics Grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 text-xs">
                                            <div className="bg-amber-50/50 border border-amber-100/80 p-3 rounded-2xl">
                                                <div className="flex items-center gap-1.5 text-amber-900 font-bold mb-1">
                                                    <Utensils className="w-3.5 h-3.5 text-amber-600" />
                                                    <span>Meals & Snacks</span>
                                                </div>
                                                <p className="text-slate-700">
                                                    {(report.meals?.length || 0) + (report.snacks?.length || 0)} recorded
                                                </p>
                                            </div>

                                            <div className="bg-indigo-50/50 border border-indigo-100/80 p-3 rounded-2xl">
                                                <div className="flex items-center gap-1.5 text-indigo-900 font-bold mb-1">
                                                    <Moon className="w-3.5 h-3.5 text-indigo-600" />
                                                    <span>Nap Time</span>
                                                </div>
                                                <p className="text-slate-700">
                                                    {report.naps && report.naps.length > 0
                                                        ? `${report.naps[0].start_time} (${report.naps[0].quality})`
                                                        : 'Not Recorded'}
                                                </p>
                                            </div>

                                            <div className="bg-teal-50/50 border border-teal-100/80 p-3 rounded-2xl">
                                                <div className="flex items-center gap-1.5 text-teal-900 font-bold mb-1">
                                                    <Baby className="w-3.5 h-3.5 text-teal-600" />
                                                    <span>Diaper / Potty</span>
                                                </div>
                                                <p className="text-slate-700">
                                                    {(report.diapers?.length || 0) + (report.toileting?.length || 0)} changes
                                                </p>
                                            </div>

                                            <div className="bg-blue-50/50 border border-blue-100/80 p-3 rounded-2xl">
                                                <div className="flex items-center gap-1.5 text-blue-900 font-bold mb-1">
                                                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                                                    <span>Activities</span>
                                                </div>
                                                <p className="text-slate-700">
                                                    {report.activities?.length || 0} logged
                                                </p>
                                            </div>

                                            <div className="bg-purple-50/50 border border-purple-100/80 p-3 rounded-2xl">
                                                <div className="flex items-center gap-1.5 text-purple-900 font-bold mb-1">
                                                    <Camera className="w-3.5 h-3.5 text-purple-600" />
                                                    <span>Photos</span>
                                                </div>
                                                <p className="text-slate-700">
                                                    {report.photos?.length || 0} photos
                                                </p>
                                            </div>
                                        </div>

                                        {/* Photo Previews */}
                                        {report.photos && report.photos.length > 0 && (
                                            <div className="flex items-center gap-2 overflow-x-auto py-1">
                                                {report.photos.slice(0, 4).map((p) => (
                                                    <img
                                                        key={p.id}
                                                        src={p.photo_url}
                                                        alt={p.caption || 'Daily photo'}
                                                        className="w-14 h-14 rounded-xl object-cover border border-slate-200"
                                                    />
                                                ))}
                                                {report.photos.length > 4 && (
                                                    <span className="text-xs font-bold text-slate-500 pl-2">
                                                        +{report.photos.length - 4} more
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default FamilyDailyReports;
