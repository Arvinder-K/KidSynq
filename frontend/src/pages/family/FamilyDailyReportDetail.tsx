import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, ArrowLeft, CheckCircle2, Clock,
    Utensils, Moon, Baby, Smile, BookOpen, Sun, Thermometer,
    Pill, AlertTriangle, FileText, Camera, Printer,
    Check, X, Sparkles, ChevronRight, UserCheck, ShieldCheck
} from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api';

interface MealItem {
    id: string;
    meal_type: string;
    food_provided: string;
    amount_eaten: string;
    time: string | null;
    notes: string;
}

interface SnackItem {
    id: string;
    snack_type: string;
    food_provided: string;
    amount_eaten: string;
    time: string | null;
    notes: string;
}

interface NapItem {
    id: string;
    start_time: string;
    end_time: string | null;
    duration_minutes: number | null;
    quality: string;
    notes: string;
}

interface DiaperItem {
    id: string;
    condition: string;
    time: string | null;
    notes: string;
}

interface ToiletItem {
    id: string;
    condition: string;
    assistance_level: string | null;
    time: string | null;
    notes: string;
}

interface ActivityItem {
    id: string;
    name: string;
    description: string;
    teacher_notes: string;
    time: string | null;
    participation: string | null;
}

interface LearningItem {
    id: string;
    name: string;
    learning_area: string | null;
    description: string;
    teacher_notes: string;
    time: string | null;
}

interface OutdoorPlayItem {
    id: string;
    name: string;
    description: string;
    time: string | null;
    notes: string;
}

interface MoodItem {
    id: string;
    mood: string;
    time: string | null;
    notes: string;
}

interface TemperatureItem {
    id: string;
    temperature_value: string;
    unit: string;
    time: string | null;
    method: string;
    notes: string;
}

interface MedicationItem {
    id: string;
    medication_name: string;
    dosage_given: string;
    administered_time: string | null;
    administered_by_name: string;
}

interface IncidentItem {
    id: string;
    incident_type: string;
    time: string | null;
    description: string;
    action_taken: string;
}

interface StaffNoteItem {
    id: string;
    category: string;
    note_text: string;
    time: string | null;
}

interface PhotoItem {
    id: string;
    photo_url: string;
    caption: string;
    activity_context: string;
}

interface CareSummary {
    meals_count: number;
    snacks_count: number;
    naps_count: number;
    diapers_count: number;
    toileting_count: number;
    activities_count: number;
    photos_count: number;
    medications_count: number;
    incidents_count: number;
}

interface CompletionChecklist {
    total_domains: number;
    recorded_count: number;
    completion_percentage: number;
    domains: {
        meals: { label: string; status: 'Recorded' | 'Not Recorded' | 'Not Applicable'; count: number };
        naps: { label: string; status: 'Recorded' | 'Not Recorded' | 'Not Applicable'; count: number };
        toileting: { label: string; status: 'Recorded' | 'Not Recorded' | 'Not Applicable'; count: number };
        moods: { label: string; status: 'Recorded' | 'Not Recorded' | 'Not Applicable'; count: number };
        activities: { label: string; status: 'Recorded' | 'Not Recorded' | 'Not Applicable'; count: number };
        temperatures: { label: string; status: 'Recorded' | 'Not Recorded' | 'Not Applicable'; count: number };
        notes: { label: string; status: 'Recorded' | 'Not Recorded' | 'Not Applicable'; count: number };
        photos: { label: string; status: 'Recorded' | 'Not Recorded' | 'Not Applicable'; count: number };
    };
}

interface FamilyDailyReport {
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
    check_in_time: string | null;
    check_out_time: string | null;
    notes: string;
    published_at: string | null;
    created_at: string;
    meals: MealItem[];
    snacks: SnackItem[];
    naps: NapItem[];
    diapers: DiaperItem[];
    toileting: ToiletItem[];
    moods: MoodItem[];
    activities: ActivityItem[];
    learning: LearningItem[];
    outdoor_play: OutdoorPlayItem[];
    temperatures: TemperatureItem[];
    medications: MedicationItem[];
    incidents: IncidentItem[];
    staff_notes: StaffNoteItem[];
    photos: PhotoItem[];
    care_summary: CareSummary;
    checklist: CompletionChecklist;
}

const moodEmojis: Record<string, string> = {
    Happy: '😊',
    Joyful: '😁',
    Calm: '😌',
    Excited: '🤩',
    Energetic: '⚡',
    Tired: '😴',
    Fussy: '🥺',
    Cranky: '😤',
    Sad: '😢',
    Curious: '🧐'
};

export const FamilyDailyReportDetail: React.FC = () => {
    const { childId, date } = useParams<{ childId: string; date: string }>();
    const navigate = useNavigate();

    const [report, setReport] = useState<FamilyDailyReport | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await api.get(`/family/daily-reports/${childId}/${date}/`);
                setReport(res.data);
            } catch (err: any) {
                console.error('Failed to load daily report', err);
                setError(err.response?.data?.detail || 'Daily report not found or not yet published.');
            } finally {
                setLoading(false);
            }
        };

        if (childId && date) {
            fetchReport();
        }
    }, [childId, date]);

    if (loading) {
        return (
            <Layout>
                <div className="flex justify-center items-center min-h-[60vh]">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
            </Layout>
        );
    }

    if (error || !report) {
        return (
            <Layout>
                <div className="max-w-2xl mx-auto py-16 text-center">
                    <div className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                            <Clock className="w-7 h-7" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Report In Progress</h2>
                        <p className="text-slate-600 text-sm max-w-md mx-auto">
                            {error || 'The daily report for this day has not yet been published by the educator.'}
                        </p>
                        <div className="pt-2">
                            <Link
                                to="/family/daily-reports"
                                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-2 shadow"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Back to Daily Reports</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    const formattedDate = new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-CA', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    const displayName = report.preferred_name || report.child_name;

    return (
        <Layout>
            <div className="space-y-6 pb-24 max-w-5xl mx-auto print:p-0 print:space-y-4">
                {/* Back Link & Print Bar */}
                <div className="flex items-center justify-between gap-4 print:hidden">
                    <Link
                        to="/family/daily-reports"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to All Reports</span>
                    </Link>

                    <button
                        onClick={() => window.print()}
                        className="px-4 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm transition-all flex items-center gap-2"
                    >
                        <Printer className="w-4 h-4 text-slate-500" />
                        <span>Print Report</span>
                    </button>
                </div>

                {/* 1. CHILD & ATTENDANCE HEADER */}
                <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200/90 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 overflow-hidden flex items-center justify-center text-xl font-bold text-indigo-700 shadow-inner">
                                {report.child_photo ? (
                                    <img src={report.child_photo} alt={displayName} className="w-full h-full object-cover" />
                                ) : (
                                    displayName.charAt(0)
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 text-indigo-600 text-xs font-semibold uppercase tracking-wider">
                                    <span>{report.classroom_name}</span>
                                    <span>•</span>
                                    <span>Educator: {report.teacher_name}</span>
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
                                    {displayName}'s Daily Report
                                </h1>
                                <p className="text-gray-500 text-xs sm:text-sm mt-0.5">{formattedDate}</p>
                            </div>
                        </div>

                        {/* Attendance Pill */}
                        <div className="bg-slate-50 px-5 py-3 rounded-2xl border border-slate-200 flex items-center gap-4 self-start md:self-auto">
                            <div>
                                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Attendance</span>
                                <span className="font-extrabold text-sm text-indigo-700">{report.attendance_status}</span>
                            </div>
                            {(report.check_in_time || report.check_out_time) && (
                                <div className="border-l border-slate-200 pl-4 space-y-0.5 text-xs text-slate-600">
                                    {report.check_in_time && <div>In: <strong className="text-slate-900">{report.check_in_time}</strong></div>}
                                    {report.check_out_time && <div>Out: <strong className="text-slate-900">{report.check_out_time}</strong></div>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. CARE SUMMARY HIGHLIGHTS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 print:grid-cols-7">
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
                        <Utensils className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Meals</span>
                        <span className="text-lg font-black text-slate-800">{report.care_summary?.meals_count || 0}</span>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
                        <Moon className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Naps</span>
                        <span className="text-lg font-black text-slate-800">{report.care_summary?.naps_count || 0}</span>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
                        <Baby className="w-4 h-4 text-teal-500 mx-auto mb-1" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Diaper / Potty</span>
                        <span className="text-lg font-black text-slate-800">
                            {(report.care_summary?.diapers_count || 0) + (report.care_summary?.toileting_count || 0)}
                        </span>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
                        <Smile className="w-4 h-4 text-rose-500 mx-auto mb-1" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mood</span>
                        <span className="text-lg font-black text-slate-800">
                            {report.moods.length > 0 ? (moodEmojis[report.moods[0].mood] || report.moods[0].mood) : '—'}
                        </span>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
                        <BookOpen className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Activities</span>
                        <span className="text-lg font-black text-slate-800">{report.care_summary?.activities_count || 0}</span>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center">
                        <Camera className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Photos</span>
                        <span className="text-lg font-black text-slate-800">{report.care_summary?.photos_count || 0}</span>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs text-center col-span-2 sm:col-span-2 lg:col-span-1">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Checklist</span>
                        <span className="text-sm font-black text-emerald-600">
                            {report.checklist?.completion_percentage || 100}%
                        </span>
                    </div>
                </div>

                {/* 3. MEALS & SNACKS */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <Utensils className="w-5 h-5 text-amber-500" />
                        <h2 className="text-base font-bold text-slate-800">Meals & Snacks</h2>
                    </div>

                    {report.meals.length === 0 && report.snacks.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Not Recorded</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {report.meals.map((meal) => (
                                <div key={meal.id} className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-amber-900 uppercase">{meal.meal_type}</span>
                                        {meal.time && <span className="text-slate-500">{meal.time}</span>}
                                    </div>
                                    <p className="text-sm font-semibold text-slate-800">{meal.food_provided}</p>
                                    <p className="text-xs text-amber-800">
                                        Amount Eaten: <strong>{meal.amount_eaten}</strong>
                                    </p>
                                    {meal.notes && <p className="text-xs text-slate-500 pt-1 italic">"{meal.notes}"</p>}
                                </div>
                            ))}

                            {report.snacks.map((snack) => (
                                <div key={snack.id} className="p-4 rounded-2xl bg-amber-50/30 border border-amber-100/70 space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-amber-900 uppercase">{snack.snack_type}</span>
                                        {snack.time && <span className="text-slate-500">{snack.time}</span>}
                                    </div>
                                    <p className="text-sm font-semibold text-slate-800">{snack.food_provided}</p>
                                    <p className="text-xs text-amber-800">
                                        Amount Eaten: <strong>{snack.amount_eaten}</strong>
                                    </p>
                                    {snack.notes && <p className="text-xs text-slate-500 pt-1 italic">"{snack.notes}"</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 4. NAPS & REST */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <Moon className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-base font-bold text-slate-800">Naps & Quiet Rest Time</h2>
                    </div>

                    {report.naps.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Not Recorded</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {report.naps.map((nap) => (
                                <div key={nap.id} className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-indigo-900">
                                            {nap.start_time} - {nap.end_time || 'Woke Up'}
                                        </span>
                                        {nap.duration_minutes && (
                                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                {nap.duration_minutes} mins
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-indigo-900">
                                        Rest Quality: <strong>{nap.quality}</strong>
                                    </p>
                                    {nap.notes && <p className="text-xs text-slate-500 pt-1 italic">"{nap.notes}"</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 5. DIAPER & TOILETING */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <Baby className="w-5 h-5 text-teal-500" />
                        <h2 className="text-base font-bold text-slate-800">Diaper Changes & Potty Training</h2>
                    </div>

                    {report.diapers.length === 0 && report.toileting.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Not Recorded</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {report.diapers.map((diaper) => (
                                <div key={diaper.id} className="p-3 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-0.5 text-xs">
                                    <div className="flex items-center justify-between font-bold text-teal-900">
                                        <span>Diaper</span>
                                        <span className="text-slate-500 text-[11px] font-normal">{diaper.time}</span>
                                    </div>
                                    <p className="font-semibold text-teal-800">{diaper.condition}</p>
                                    {diaper.notes && <p className="text-[11px] text-slate-500 italic">"{diaper.notes}"</p>}
                                </div>
                            ))}

                            {report.toileting.map((toilet) => (
                                <div key={toilet.id} className="p-3 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-0.5 text-xs">
                                    <div className="flex items-center justify-between font-bold text-teal-900">
                                        <span>Potty</span>
                                        <span className="text-slate-500 text-[11px] font-normal">{toilet.time}</span>
                                    </div>
                                    <p className="font-semibold text-teal-800">{toilet.condition}</p>
                                    {toilet.assistance_level && (
                                        <p className="text-[11px] text-teal-700">Assistance: {toilet.assistance_level}</p>
                                    )}
                                    {toilet.notes && <p className="text-[11px] text-slate-500 italic">"{toilet.notes}"</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 6. ACTIVITIES & LEARNING */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <BookOpen className="w-5 h-5 text-blue-500" />
                        <h2 className="text-base font-bold text-slate-800">Learning, Activities & Play</h2>
                    </div>

                    {report.activities.length === 0 && report.learning.length === 0 && report.outdoor_play.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Not Recorded</p>
                    ) : (
                        <div className="space-y-3">
                            {report.activities.map((act) => (
                                <div key={act.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-800 text-sm">{act.name}</span>
                                        {act.time && <span className="text-slate-400">{act.time}</span>}
                                    </div>
                                    {act.description && <p className="text-xs text-slate-600">{act.description}</p>}
                                    {act.teacher_notes && (
                                        <p className="text-xs text-indigo-700 bg-indigo-50/50 p-2 rounded-xl mt-1">
                                            <strong>Educator observation:</strong> {act.teacher_notes}
                                        </p>
                                    )}
                                </div>
                            ))}

                            {report.learning.map((learn) => (
                                <div key={learn.id} className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-blue-900 text-sm">{learn.name}</span>
                                        {learn.learning_area && (
                                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                {learn.learning_area}
                                            </span>
                                        )}
                                    </div>
                                    {learn.description && <p className="text-xs text-slate-600">{learn.description}</p>}
                                    {learn.teacher_notes && (
                                        <p className="text-xs text-blue-800 bg-white/70 p-2 rounded-xl mt-1">
                                            <strong>Observation:</strong> {learn.teacher_notes}
                                        </p>
                                    )}
                                </div>
                            ))}

                            {report.outdoor_play.map((out) => (
                                <div key={out.id} className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-emerald-900 text-sm">{out.name} (Outdoor Play)</span>
                                        {out.time && <span className="text-slate-400">{out.time}</span>}
                                    </div>
                                    {out.description && <p className="text-xs text-slate-600">{out.description}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 7. PHOTOS GALLERY */}
                {report.photos.length > 0 && (
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <Camera className="w-5 h-5 text-purple-500" />
                            <h2 className="text-base font-bold text-slate-800">Today's Photos ({report.photos.length})</h2>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {report.photos.map((photo) => (
                                <div
                                    key={photo.id}
                                    onClick={() => setSelectedPhoto(photo)}
                                    className="group cursor-pointer bg-slate-50 rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-md transition-all relative aspect-square"
                                >
                                    <img
                                        src={photo.photo_url}
                                        alt={photo.caption || 'Daily report photo'}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    {photo.caption && (
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white text-[11px] truncate">
                                            {photo.caption}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 8. HEALTH, TEMPERATURE & MEDICATIONS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Temperature */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <Thermometer className="w-5 h-5 text-rose-500" />
                            <h2 className="text-base font-bold text-slate-800">Health & Temperature</h2>
                        </div>

                        {report.temperatures.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">Not Recorded</p>
                        ) : (
                            <div className="space-y-2">
                                {report.temperatures.map((temp) => (
                                    <div key={temp.id} className="p-3 rounded-2xl bg-rose-50/50 border border-rose-100 flex items-center justify-between text-xs">
                                        <div>
                                            <span className="font-bold text-rose-900 text-sm">
                                                {temp.temperature_value}° {temp.unit === 'Celsius' ? 'C' : 'F'}
                                            </span>
                                            <span className="text-slate-500 ml-2">({temp.method})</span>
                                        </div>
                                        {temp.time && <span className="text-slate-400 font-medium">{temp.time}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Medications & Incidents */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <Pill className="w-5 h-5 text-emerald-500" />
                            <h2 className="text-base font-bold text-slate-800">Medications & Health Logs</h2>
                        </div>

                        {report.medications.length === 0 && report.incidents.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No medications or incidents logged today</p>
                        ) : (
                            <div className="space-y-2">
                                {report.medications.map((med) => (
                                    <div key={med.id} className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-0.5 text-xs">
                                        <div className="flex items-center justify-between font-bold text-emerald-900">
                                            <span>{med.medication_name}</span>
                                            <span className="text-slate-500">{med.administered_time}</span>
                                        </div>
                                        <p className="text-emerald-800">Dosage: {med.dosage_given}</p>
                                    </div>
                                ))}

                                {report.incidents.map((inc) => (
                                    <div key={inc.id} className="p-3 rounded-2xl bg-amber-50 border border-amber-200 space-y-1 text-xs">
                                        <div className="flex items-center justify-between font-bold text-amber-900">
                                            <span>Incident: {inc.incident_type}</span>
                                            <span className="text-slate-500">{inc.time}</span>
                                        </div>
                                        <p className="text-slate-700">{inc.description}</p>
                                        <p className="text-amber-800"><strong>Action Taken:</strong> {inc.action_taken}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 9. NOTES FROM EDUCATOR */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <FileText className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-base font-bold text-slate-800">Notes from Educators</h2>
                    </div>

                    {report.staff_notes.length === 0 && !report.notes ? (
                        <p className="text-xs text-slate-400 italic">No additional notes recorded for today.</p>
                    ) : (
                        <div className="space-y-3">
                            {report.notes && (
                                <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 text-xs text-slate-700 leading-relaxed">
                                    {report.notes}
                                </div>
                            )}

                            {report.staff_notes.map((note) => (
                                <div key={note.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 space-y-1">
                                    <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                                        <span className="uppercase">{note.category}</span>
                                        {note.time && <span>{note.time}</span>}
                                    </div>
                                    <p className="text-slate-800 leading-relaxed font-medium">{note.note_text}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Photo Modal / Lightbox */}
                <AnimatePresence>
                    {selectedPhoto && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedPhoto(null)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        >
                            <div
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white rounded-3xl overflow-hidden max-w-2xl w-full shadow-2xl space-y-3 p-4"
                            >
                                <div className="relative rounded-2xl overflow-hidden bg-black max-h-[70vh] flex items-center justify-center">
                                    <img
                                        src={selectedPhoto.photo_url}
                                        alt={selectedPhoto.caption || 'Photo'}
                                        className="max-h-[70vh] w-auto object-contain"
                                    />
                                </div>
                                {selectedPhoto.caption && (
                                    <p className="text-sm font-semibold text-slate-800 px-2">{selectedPhoto.caption}</p>
                                )}
                                <div className="text-right">
                                    <button
                                        onClick={() => setSelectedPhoto(null)}
                                        className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Layout>
    );
};

export default FamilyDailyReportDetail;
