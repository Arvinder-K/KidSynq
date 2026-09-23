import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, ArrowLeft, CheckCircle2, Clock, AlertCircle,
    Utensils, Moon, Baby, Smile, BookOpen, Sun, Thermometer,
    Pill, AlertTriangle, FileText, Camera, Plus, Trash2,
    Check, X, ChevronRight, UserCheck, ShieldAlert, Sparkles
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';

interface MealItem {
    id: string;
    meal_type: string;
    meal_category: string;
    food_provided: string;
    amount_eaten: string;
    time: string | null;
    notes: string;
    recorded_by_name: string;
}

interface NapItem {
    id: string;
    start_time: string;
    end_time: string | null;
    duration_minutes: number | null;
    quality: string;
    notes: string;
    recorded_by_name: string;
}

interface ToiletingItem {
    id: string;
    type: string;
    condition: string;
    assistance_level: string | null;
    time: string | null;
    notes: string;
    recorded_by_name: string;
}

interface ActivityItem {
    id: string;
    activity_type: string;
    activity_category: string;
    name: string;
    description: string;
    teacher_notes: string;
    start_time: string | null;
    end_time: string | null;
    duration_minutes: number | null;
    learning_area: string | null;
    participation: string | null;
    recorded_by_name: string;
}

interface MoodItem {
    id: string;
    mood: string;
    time: string | null;
    notes: string;
    recorded_by_name: string;
}

interface TemperatureItem {
    id: string;
    temperature_value: string;
    unit: string;
    time: string | null;
    method: string;
    notes: string;
    recorded_by_name: string;
}

interface NoteItem {
    id: string;
    time: string | null;
    category: string;
    note_text: string;
    created_by_name: string;
}

interface PhotoItem {
    id: string;
    photo_url: string;
    file_path: string | null;
    caption: string;
    activity_context: string;
    uploaded_by_name: string;
    created_at: string;
}

interface MedicationItem {
    id: string;
    medication_name: string;
    dosage: string;
    administration_time: string | null;
    administered_by_name: string;
    notes: string;
    status: string;
}

interface IncidentItem {
    id: string;
    incident_type: string;
    time: string | null;
    description: string;
    action_taken: string;
    severity: string;
    reporter_name: string;
}

interface DailyReportDetail {
    id: string;
    report_date: string;
    status: string;
    child_name: string;
    child_photo: string | null;
    classroom_name: string;
    teacher_name: string;
    attendance_status: string;
    notes: string | null;
    completed_at: string | null;
    published_at: string | null;
    meals: MealItem[];
    naps: NapItem[];
    toileting: ToiletingItem[];
    activities: ActivityItem[];
    moods: MoodItem[];
    temperatures: TemperatureItem[];
    staff_notes: NoteItem[];
    photos: PhotoItem[];
    medications: MedicationItem[];
    incidents: IncidentItem[];
}

export const DailyChildReportDetail: React.FC = () => {
    const { childId, date } = useParams<{ childId: string; date: string }>();
    const navigate = useNavigate();

    const [currentDate, setCurrentDate] = useState<string>(date || new Date().toISOString().split('T')[0]);
    const [report, setReport] = useState<DailyReportDetail | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Active logger modal
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState<boolean>(false);

    // Form states
    const [mealType, setMealType] = useState('Lunch');
    const [mealCategory, setMealCategory] = useState('Meal');
    const [foodProvided, setFoodProvided] = useState('');
    const [amountEaten, setAmountEaten] = useState('All');
    const [entryTime, setEntryTime] = useState(new Date().toTimeString().slice(0, 5));
    const [entryNotes, setEntryNotes] = useState('');

    // Nap form
    const [napStart, setNapStart] = useState('12:30');
    const [napEnd, setNapEnd] = useState('14:00');
    const [napQuality, setNapQuality] = useState('Slept');

    // Toileting form
    const [toiletType, setToiletType] = useState('Diaper');
    const [toiletCondition, setToiletCondition] = useState('Wet');
    const [assistanceLevel, setAssistanceLevel] = useState('Assisted');

    // Mood form
    const [moodValue, setMoodValue] = useState('Happy');

    // Activity & Learning form
    const [activityType, setActivityType] = useState('Learning & Development');
    const [activityName, setActivityName] = useState('');
    const [activityDesc, setActivityDesc] = useState('');
    const [learningArea, setLearningArea] = useState('Cognitive');
    const [participation, setParticipation] = useState('High');
    const [actStart, setActStart] = useState('10:00');
    const [actEnd, setActEnd] = useState('10:30');
    const [teacherNotes, setTeacherNotes] = useState('');

    // Temperature form
    const [tempValue, setTempValue] = useState('36.8');
    const [tempUnit, setTempUnit] = useState('Celsius');
    const [tempMethod, setTempMethod] = useState('Forehead');

    // Note form
    const [noteCategory, setNoteCategory] = useState('General');
    const [noteText, setNoteText] = useState('');

    // Photo form
    const [photoUrl, setPhotoUrl] = useState('');
    const [photoCaption, setPhotoCaption] = useState('');
    const [photoContext, setPhotoContext] = useState('Creative Arts');

    const fetchReport = useCallback(async () => {
        if (!childId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.post('/daycare/daily-reports/get-or-create/', {
                student_id: childId,
                date: currentDate
            });
            setReport(res.data);
        } catch (err: any) {
            console.error('Failed to load daily report', err);
            setError(err.response?.data?.detail || 'Failed to initialize daily report.');
        } finally {
            setLoading(false);
        }
    }, [childId, currentDate]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const handleDateChange = (newDate: string) => {
        setCurrentDate(newDate);
        navigate(`/daycare/daily-reports/${childId}/${newDate}`);
    };

    const showSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(null), 4000);
    };

    // Submissions
    const handleAddMeal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!report) return;
        setSubmitting(true);
        try {
            await api.post(`/daycare/daily-reports/${report.id}/meals/`, {
                meal_type: mealType,
                meal_category: mealCategory,
                food_provided: foodProvided,
                amount_eaten: amountEaten,
                time: entryTime ? `${entryTime}:00` : null,
                notes: entryNotes
            });
            showSuccess('Meal record added.');
            setActiveModal(null);
            setFoodProvided('');
            setEntryNotes('');
            await fetchReport();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to add meal record.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddNap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!report) return;
        setSubmitting(true);
        try {
            await api.post(`/daycare/daily-reports/${report.id}/naps/`, {
                start_time: napStart,
                end_time: napEnd || null,
                quality: napQuality,
                notes: entryNotes
            });
            showSuccess('Nap record added.');
            setActiveModal(null);
            setEntryNotes('');
            await fetchReport();
        } catch (err: any) {
            alert(err.response?.data?.detail || err.response?.data?.end_time || 'Failed to add nap record.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddToileting = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!report) return;
        setSubmitting(true);
        try {
            await api.post(`/daycare/daily-reports/${report.id}/toileting/`, {
                type: toiletType,
                condition: toiletCondition,
                assistance_level: toiletType === 'Diaper' ? null : assistanceLevel,
                time: entryTime ? `${entryTime}:00` : null,
                notes: entryNotes
            });
            showSuccess('Diaper/toilet record added.');
            setActiveModal(null);
            setEntryNotes('');
            await fetchReport();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to add record.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddMood = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!report) return;
        setSubmitting(true);
        try {
            await api.post(`/daycare/daily-reports/${report.id}/moods/`, {
                mood: moodValue,
                time: entryTime ? `${entryTime}:00` : null,
                notes: entryNotes
            });
            showSuccess('Mood record added.');
            setActiveModal(null);
            setEntryNotes('');
            await fetchReport();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to add mood record.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddActivity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!report) return;
        setSubmitting(true);
        try {
            await api.post(`/daycare/daily-reports/${report.id}/activities/`, {
                activity_type: activityType,
                activity_category: activityType,
                name: activityName || activityType,
                description: activityDesc,
                teacher_notes: teacherNotes,
                start_time: actStart || null,
                end_time: actEnd || null,
                learning_area: learningArea,
                participation: participation
            });
            showSuccess('Activity record added.');
            setActiveModal(null);
            setActivityName('');
            setActivityDesc('');
            setTeacherNotes('');
            await fetchReport();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to add activity.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddTemperature = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!report) return;
        setSubmitting(true);
        try {
            await api.post(`/daycare/daily-reports/${report.id}/temperatures/`, {
                temperature_value: tempValue,
                unit: tempUnit,
                method: tempMethod,
                time: entryTime ? `${entryTime}:00` : null,
                notes: entryNotes
            });
            showSuccess('Temperature record added.');
            setActiveModal(null);
            setEntryNotes('');
            await fetchReport();
        } catch (err: any) {
            alert(err.response?.data?.temperature_value || err.response?.data?.detail || 'Failed to add temperature record.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!report) return;
        setSubmitting(true);
        try {
            await api.post(`/daycare/daily-reports/${report.id}/notes/`, {
                category: noteCategory,
                note_text: noteText,
                time: entryTime ? `${entryTime}:00` : null
            });
            showSuccess('Staff note added.');
            setActiveModal(null);
            setNoteText('');
            await fetchReport();
        } catch (err: any) {
            alert(err.response?.data?.note_text || err.response?.data?.detail || 'Failed to add note.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddPhoto = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!report) return;
        setSubmitting(true);
        try {
            await api.post(`/daycare/daily-reports/${report.id}/photos/`, {
                photo_url: photoUrl,
                caption: photoCaption,
                activity_context: photoContext
            });
            showSuccess('Photo added.');
            setActiveModal(null);
            setPhotoUrl('');
            setPhotoCaption('');
            await fetchReport();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to upload photo.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteEntry = async (entryType: string, entryId: string) => {
        if (!report || !window.confirm(`Are you sure you want to delete this ${entryType} record?`)) return;
        try {
            await api.delete(`/daycare/daily-reports/${report.id}/entries/${entryType}/${entryId}/`);
            showSuccess('Entry deleted.');
            await fetchReport();
        } catch (err: any) {
            alert('Failed to delete entry.');
        }
    };

    const handleStatusTransition = async (action: 'complete' | 'publish') => {
        if (!report) return;
        try {
            await api.post(`/daycare/daily-reports/${report.id}/${action}/`);
            showSuccess(`Daily report marked as ${action === 'complete' ? 'Completed' : 'Published'}.`);
            await fetchReport();
        } catch (err: any) {
            alert(err.response?.data?.detail || `Failed to ${action} daily report.`);
        }
    };

    return (
        <Layout>
            <div className="space-y-6 pb-24 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/daycare/daily-reports"
                            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-colors shadow-xs"
                            title="Back to Daily Reports Hub"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>

                        <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold text-lg shrink-0 shadow-xs">
                            {report?.child_name ? report.child_name.trim().split(/\s+/).map(n => n.charAt(0)).join('').toUpperCase() : 'C'}
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                                    {report?.child_name || 'Daily Child Report'}
                                </h1>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                    report?.status === 'Published'
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                        : report?.status === 'Completed'
                                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                                        : 'bg-amber-100 text-amber-800 border-amber-200'
                                }`}>
                                    {report?.status || 'Draft'}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                                <span>Classroom: <strong className="text-slate-700">{report?.classroom_name || 'Unassigned'}</strong></span>
                                <span>•</span>
                                <span>
                                    Attendance: <strong className={report?.attendance_status === 'Present' ? 'text-emerald-700' : 'text-rose-600'}>{report?.attendance_status || 'Unrecorded'}</strong>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Date Switcher & Workflow Buttons */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-xs">
                            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                            <input
                                type="date"
                                value={currentDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                            />
                        </div>

                        {report?.status !== 'Completed' && report?.status !== 'Published' && (
                            <button
                                onClick={() => handleStatusTransition('complete')}
                                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Complete Report</span>
                            </button>
                        )}

                        {report?.status !== 'Published' && (
                            <button
                                onClick={() => handleStatusTransition('publish')}
                                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
                            >
                                <Sparkles className="w-4 h-4" />
                                <span>Publish Report</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Attendance Warning Alert if Child is Absent */}
                {report?.attendance_status !== 'Present' && (
                    <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Child Attendance Notice</p>
                            <p className="text-amber-800 text-[11px] mt-0.5">
                                This child is marked as <strong>{report?.attendance_status || 'Unrecorded'}</strong> for {currentDate}. Ensure care entries logged reflect actual presence.
                            </p>
                        </div>
                    </div>
                )}

                {/* Notifications */}
                <AnimatePresence>
                    {successMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-semibold"
                        >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{successMessage}</span>
                        </motion.div>
                    )}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-semibold"
                        >
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{error}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Quick Log Action Bar */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">
                        Quick Add Care Event
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                        <button
                            onClick={() => { setMealCategory('Meal'); setActiveModal('meal'); }}
                            className="p-3 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 rounded-2xl flex flex-col items-center gap-2 text-center transition-all group"
                        >
                            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl group-hover:scale-110 transition-transform">
                                <Utensils className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">Meal / Snack</span>
                        </button>

                        <button
                            onClick={() => setActiveModal('nap')}
                            className="p-3 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded-2xl flex flex-col items-center gap-2 text-center transition-all group"
                        >
                            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl group-hover:scale-110 transition-transform">
                                <Moon className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">Nap / Rest</span>
                        </button>

                        <button
                            onClick={() => setActiveModal('toileting')}
                            className="p-3 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 border border-slate-200 rounded-2xl flex flex-col items-center gap-2 text-center transition-all group"
                        >
                            <div className="p-2 bg-teal-100 text-teal-700 rounded-xl group-hover:scale-110 transition-transform">
                                <Baby className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">Diaper / Potty</span>
                        </button>

                        <button
                            onClick={() => setActiveModal('mood')}
                            className="p-3 bg-slate-50 hover:bg-rose-50 hover:border-rose-300 border border-slate-200 rounded-2xl flex flex-col items-center gap-2 text-center transition-all group"
                        >
                            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl group-hover:scale-110 transition-transform">
                                <Smile className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">Mood</span>
                        </button>

                        <button
                            onClick={() => setActiveModal('activity')}
                            className="p-3 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-2xl flex flex-col items-center gap-2 text-center transition-all group"
                        >
                            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl group-hover:scale-110 transition-transform">
                                <BookOpen className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">Activity / Play</span>
                        </button>

                        <button
                            onClick={() => setActiveModal('temperature')}
                            className="p-3 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 border border-slate-200 rounded-2xl flex flex-col items-center gap-2 text-center transition-all group"
                        >
                            <div className="p-2 bg-sky-100 text-sky-700 rounded-xl group-hover:scale-110 transition-transform">
                                <Thermometer className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">Temperature</span>
                        </button>

                        <button
                            onClick={() => setActiveModal('note')}
                            className="p-3 bg-slate-50 hover:bg-violet-50 hover:border-violet-300 border border-slate-200 rounded-2xl flex flex-col items-center gap-2 text-center transition-all group"
                        >
                            <div className="p-2 bg-violet-100 text-violet-700 rounded-xl group-hover:scale-110 transition-transform">
                                <FileText className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">Staff Note</span>
                        </button>

                        <button
                            onClick={() => setActiveModal('photo')}
                            className="p-3 bg-slate-50 hover:bg-pink-50 hover:border-pink-300 border border-slate-200 rounded-2xl flex flex-col items-center gap-2 text-center transition-all group"
                        >
                            <div className="p-2 bg-pink-100 text-pink-700 rounded-xl group-hover:scale-110 transition-transform">
                                <Camera className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">Photo / Media</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Grid: Categories & Event Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 1. Meals & Snacks Card */}
                    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                                    <Utensils className="w-4 h-4" />
                                </div>
                                <h2 className="text-base font-bold text-slate-900">Meals & Snacks</h2>
                            </div>
                            <button
                                onClick={() => setActiveModal('meal')}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                        </div>

                        {report?.meals && report.meals.length > 0 ? (
                            <div className="space-y-2.5">
                                {report.meals.map(m => (
                                    <div key={m.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-slate-900">{m.meal_type}</span>
                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-md">
                                                    Intake: {m.amount_eaten || 'All'}
                                                </span>
                                                {m.time && <span className="text-[10px] text-slate-400">{m.time.slice(0, 5)}</span>}
                                            </div>
                                            {m.food_provided && <p className="text-xs text-slate-600 mt-1">{m.food_provided}</p>}
                                            {m.notes && <p className="text-[11px] text-slate-400 italic mt-0.5">{m.notes}</p>}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteEntry('meals', m.id)}
                                            className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors"
                                            title="Delete entry"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic py-2">No meal entries recorded yet.</p>
                        )}
                    </div>

                    {/* 2. Nap & Rest Card */}
                    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                                    <Moon className="w-4 h-4" />
                                </div>
                                <h2 className="text-base font-bold text-slate-900">Nap & Rest</h2>
                            </div>
                            <button
                                onClick={() => setActiveModal('nap')}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                        </div>

                        {report?.naps && report.naps.length > 0 ? (
                            <div className="space-y-2.5">
                                {report.naps.map(n => (
                                    <div key={n.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-slate-900">
                                                    {n.start_time.slice(0, 5)} - {n.end_time ? n.end_time.slice(0, 5) : 'Ongoing'}
                                                </span>
                                                {n.duration_minutes && (
                                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded-md">
                                                        {n.duration_minutes} mins
                                                    </span>
                                                )}
                                                <span className="text-[11px] text-slate-500 font-semibold">{n.quality}</span>
                                            </div>
                                            {n.notes && <p className="text-[11px] text-slate-400 italic mt-0.5">{n.notes}</p>}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteEntry('naps', n.id)}
                                            className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic py-2">No nap records entered.</p>
                        )}
                    </div>

                    {/* 3. Diaper & Potty Card */}
                    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-teal-100 text-teal-700 rounded-xl">
                                    <Baby className="w-4 h-4" />
                                </div>
                                <h2 className="text-base font-bold text-slate-900">Diaper & Toilet</h2>
                            </div>
                            <button
                                onClick={() => setActiveModal('toileting')}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                        </div>

                        {report?.toileting && report.toileting.length > 0 ? (
                            <div className="space-y-2.5">
                                {report.toileting.map(t => (
                                    <div key={t.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-slate-900">{t.type}</span>
                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-800 rounded-md">
                                                    Condition: {t.condition}
                                                </span>
                                                {t.assistance_level && (
                                                    <span className="text-[10px] text-slate-500">({t.assistance_level})</span>
                                                )}
                                                {t.time && <span className="text-[10px] text-slate-400">{t.time.slice(0, 5)}</span>}
                                            </div>
                                            {t.notes && <p className="text-[11px] text-slate-400 italic mt-0.5">{t.notes}</p>}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteEntry('toileting', t.id)}
                                            className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic py-2">No toileting / diaper entries.</p>
                        )}
                    </div>

                    {/* 4. Mood Card */}
                    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                                    <Smile className="w-4 h-4" />
                                </div>
                                <h2 className="text-base font-bold text-slate-900">Mood</h2>
                            </div>
                            <button
                                onClick={() => setActiveModal('mood')}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                        </div>

                        {report?.moods && report.moods.length > 0 ? (
                            <div className="space-y-2.5">
                                {report.moods.map(m => (
                                    <div key={m.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2.5 py-0.5 text-xs font-bold bg-rose-100 text-rose-800 rounded-md">
                                                    😊 {m.mood}
                                                </span>
                                                {m.time && <span className="text-[10px] text-slate-400">{m.time.slice(0, 5)}</span>}
                                            </div>
                                            {m.notes && <p className="text-xs text-slate-600 mt-1">{m.notes}</p>}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteEntry('moods', m.id)}
                                            className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic py-2">No mood logs yet.</p>
                        )}
                    </div>

                    {/* 5. Activities & Learning Card */}
                    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 lg:col-span-2">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                                    <BookOpen className="w-4 h-4" />
                                </div>
                                <h2 className="text-base font-bold text-slate-900">Activities, Learning & Outdoor Play</h2>
                            </div>
                            <button
                                onClick={() => setActiveModal('activity')}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add Activity
                            </button>
                        </div>

                        {report?.activities && report.activities.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {report.activities.map(a => (
                                    <div key={a.id} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-black text-slate-900">{a.name}</span>
                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md">
                                                    {a.activity_type}
                                                </span>
                                                {a.learning_area && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded">
                                                        Area: {a.learning_area}
                                                    </span>
                                                )}
                                                {a.duration_minutes && (
                                                    <span className="text-[10px] text-slate-400 font-bold">{a.duration_minutes}m</span>
                                                )}
                                            </div>
                                            {a.description && <p className="text-xs text-slate-600 mt-1">{a.description}</p>}
                                            {a.teacher_notes && (
                                                <p className="text-xs text-emerald-900 bg-emerald-50/70 p-2 rounded-xl mt-2 border border-emerald-100">
                                                    <strong>Observation:</strong> {a.teacher_notes}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteEntry('activities', a.id)}
                                            className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors shrink-0"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic py-2">No learning or outdoor play activities recorded today.</p>
                        )}
                    </div>

                    {/* 6. Health, Temperature & Medications Card */}
                    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
                                    <Thermometer className="w-4 h-4" />
                                </div>
                                <h2 className="text-base font-bold text-slate-900">Health & Temperature</h2>
                            </div>
                            <button
                                onClick={() => setActiveModal('temperature')}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> Check Temp
                            </button>
                        </div>

                        {report?.temperatures && report.temperatures.length > 0 ? (
                            <div className="space-y-2">
                                {report.temperatures.map(t => (
                                    <div key={t.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-sm font-black text-sky-900">
                                                {t.temperature_value}°{t.unit === 'Fahrenheit' ? 'F' : 'C'}
                                            </span>
                                            <span className="text-xs text-slate-500">Method: {t.method}</span>
                                            {t.time && <span className="text-[10px] text-slate-400">({t.time.slice(0, 5)})</span>}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteEntry('temperatures', t.id)}
                                            className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic">No temperature checks recorded.</p>
                        )}

                        {/* Medications from Core */}
                        {report?.medications && report.medications.length > 0 && (
                            <div className="pt-3 border-t border-slate-100">
                                <span className="text-xs font-bold text-purple-900 block mb-2">Medications Administered Today</span>
                                <div className="space-y-2">
                                    {report.medications.map(m => (
                                        <div key={m.id} className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl">
                                            <div className="flex items-center justify-between text-xs">
                                                <strong className="text-purple-950 font-bold">{m.medication_name} ({m.dosage})</strong>
                                                <span className="text-purple-700 text-[10px]">By {m.administered_by_name}</span>
                                            </div>
                                            {m.notes && <p className="text-[11px] text-purple-800 mt-0.5">{m.notes}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 7. Incidents Card */}
                    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                                    <AlertTriangle className="w-4 h-4" />
                                </div>
                                <h2 className="text-base font-bold text-slate-900">Incidents Logged</h2>
                            </div>
                        </div>

                        {report?.incidents && report.incidents.length > 0 ? (
                            <div className="space-y-2.5">
                                {report.incidents.map(inc => (
                                    <div key={inc.id} className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-rose-900">
                                                ⚠️ {inc.incident_type} ({inc.severity})
                                            </span>
                                            {inc.time && <span className="text-[10px] text-rose-700 font-bold">{inc.time}</span>}
                                        </div>
                                        <p className="text-xs text-rose-800">{inc.description}</p>
                                        <p className="text-[11px] text-slate-500"><strong>Action:</strong> {inc.action_taken}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic py-2">No incidents reported today. 👍</p>
                        )}
                    </div>

                    {/* 8. Staff Notes & Photos */}
                    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 lg:col-span-2">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-violet-100 text-violet-700 rounded-xl">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <h2 className="text-base font-bold text-slate-900">Staff Notes & Photos</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setActiveModal('note')}
                                    className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Note
                                </button>
                                <button
                                    onClick={() => setActiveModal('photo')}
                                    className="px-2.5 py-1 text-xs font-bold text-pink-700 bg-pink-50 hover:bg-pink-100 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Photo
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Notes column */}
                            <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Daily Notes</span>
                                {report?.staff_notes && report.staff_notes.length > 0 ? (
                                    report.staff_notes.map(sn => (
                                        <div key={sn.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-violet-100 text-violet-800 rounded-md">
                                                        {sn.category}
                                                    </span>
                                                    {sn.time && <span className="text-[10px] text-slate-400">{sn.time.slice(0, 5)}</span>}
                                                </div>
                                                <p className="text-xs text-slate-700 mt-1">{sn.note_text}</p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteEntry('notes', sn.id)}
                                                className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-400 italic">No notes added.</p>
                                )}
                            </div>

                            {/* Photos column */}
                            <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Daily Photos</span>
                                {report?.photos && report.photos.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {report.photos.map(p => (
                                            <div key={p.id} className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                                                <img
                                                    src={p.photo_url || p.file_path || ''}
                                                    alt={p.caption || 'Daily photo'}
                                                    className="w-full h-28 object-cover"
                                                />
                                                <div className="p-2 bg-white">
                                                    <p className="text-[11px] font-semibold text-slate-800 truncate">{p.caption || 'Activity photo'}</p>
                                                    <p className="text-[9px] text-slate-400">{p.activity_context}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteEntry('photos', p.id)}
                                                    className="absolute top-1.5 right-1.5 p-1 bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">No photos attached.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* MODALS */}
                <AnimatePresence>
                    {activeModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
                            >
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                                    <h3 className="text-base font-black text-slate-900 capitalize">
                                        Add {activeModal === 'meal' ? 'Meal / Snack' : activeModal}
                                    </h3>
                                    <button
                                        onClick={() => setActiveModal(null)}
                                        className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Form switch */}
                                {activeModal === 'meal' && (
                                    <form onSubmit={handleAddMeal} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Meal / Snack Type</label>
                                            <select
                                                value={mealType}
                                                onChange={e => setMealType(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            >
                                                <option value="Breakfast">Breakfast</option>
                                                <option value="AM Snack">AM Snack</option>
                                                <option value="Lunch">Lunch</option>
                                                <option value="PM Snack">PM Snack</option>
                                                <option value="Late Snack">Late Snack</option>
                                                <option value="Dinner">Dinner</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Food / Items Provided</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Scrambled eggs & whole wheat toast"
                                                value={foodProvided}
                                                onChange={e => setFoodProvided(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Quantity / Intake</label>
                                            <div className="grid grid-cols-5 gap-1.5">
                                                {['All', 'Most', 'Some', 'Little', 'None'].map(amt => (
                                                    <button
                                                        type="button"
                                                        key={amt}
                                                        onClick={() => setAmountEaten(amt)}
                                                        className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                            amountEaten === amt
                                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                        }`}
                                                    >
                                                        {amt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Time</label>
                                            <input
                                                type="time"
                                                value={entryTime}
                                                onChange={e => setEntryTime(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Notes (Optional)</label>
                                            <textarea
                                                rows={2}
                                                placeholder="Any food preferences or notes..."
                                                value={entryNotes}
                                                onChange={e => setEntryNotes(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => setActiveModal(null)}
                                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                                            >
                                                {submitting ? 'Saving...' : 'Save Meal'}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {activeModal === 'nap' && (
                                    <form onSubmit={handleAddNap} className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Start Time *</label>
                                                <input
                                                    type="time"
                                                    required
                                                    value={napStart}
                                                    onChange={e => setNapStart(e.target.value)}
                                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">End Time</label>
                                                <input
                                                    type="time"
                                                    value={napEnd}
                                                    onChange={e => setNapEnd(e.target.value)}
                                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Nap Status / Quality</label>
                                            <select
                                                value={napQuality}
                                                onChange={e => setNapQuality(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            >
                                                <option value="Slept">Slept soundly</option>
                                                <option value="Rested">Quiet rest / Did not sleep</option>
                                                <option value="Restless">Restless</option>
                                                <option value="Woke Early">Woke early</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                                            <textarea
                                                rows={2}
                                                value={entryNotes}
                                                onChange={e => setEntryNotes(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => setActiveModal(null)}
                                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                                            >
                                                {submitting ? 'Saving...' : 'Save Nap'}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {activeModal === 'toileting' && (
                                    <form onSubmit={handleAddToileting} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Type</label>
                                            <select
                                                value={toiletType}
                                                onChange={e => setToiletType(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            >
                                                <option value="Diaper">Diaper Change</option>
                                                <option value="Toilet">Toilet / Potty</option>
                                                <option value="Accident">Accident</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Condition</label>
                                            <select
                                                value={toiletCondition}
                                                onChange={e => setToiletCondition(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            >
                                                <option value="Wet">Wet</option>
                                                <option value="BM">BM (Soiled)</option>
                                                <option value="Both">Both (Wet & BM)</option>
                                                <option value="Dry">Dry / Checked</option>
                                                <option value="Clean">Clean</option>
                                            </select>
                                        </div>
                                        {toiletType !== 'Diaper' && (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Assistance Level</label>
                                                <select
                                                    value={assistanceLevel}
                                                    onChange={e => setAssistanceLevel(e.target.value)}
                                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                                >
                                                    <option value="Independent">Independent</option>
                                                    <option value="Prompted">Prompted</option>
                                                    <option value="Assisted">Assisted</option>
                                                    <option value="Full Assistance">Full Assistance</option>
                                                </select>
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Time</label>
                                            <input
                                                type="time"
                                                value={entryTime}
                                                onChange={e => setEntryTime(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                                            <textarea
                                                rows={2}
                                                value={entryNotes}
                                                onChange={e => setEntryNotes(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => setActiveModal(null)}
                                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl"
                                            >
                                                {submitting ? 'Saving...' : 'Save Entry'}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {activeModal === 'mood' && (
                                    <form onSubmit={handleAddMood} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-2">Select Mood</label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {['Happy', 'Calm', 'Excited', 'Playful', 'Tired', 'Sad', 'Upset', 'Fussy'].map(m => (
                                                    <button
                                                        type="button"
                                                        key={m}
                                                        onClick={() => setMoodValue(m)}
                                                        className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                                                            moodValue === m
                                                                ? 'bg-rose-50 border-rose-400 text-rose-800 shadow-sm'
                                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {m}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Time</label>
                                            <input
                                                type="time"
                                                value={entryTime}
                                                onChange={e => setEntryTime(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                                            <textarea
                                                rows={2}
                                                placeholder="Observations..."
                                                value={entryNotes}
                                                onChange={e => setEntryNotes(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => setActiveModal(null)}
                                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
                                            >
                                                {submitting ? 'Saving...' : 'Save Mood'}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {activeModal === 'activity' && (
                                    <form onSubmit={handleAddActivity} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                                            <select
                                                value={activityType}
                                                onChange={e => setActivityType(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            >
                                                <option value="Learning & Development">Learning & Development</option>
                                                <option value="Outdoor Play">Outdoor Play / Playground</option>
                                                <option value="Creative Arts">Creative Arts / Painting</option>
                                                <option value="Sensory Play">Sensory Play</option>
                                                <option value="Circle Time">Circle Time / Storytime</option>
                                                <option value="Music & Movement">Music & Movement</option>
                                                <option value="STEM / Math">STEM / Math</option>
                                                <option value="General Activity">General Activity</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Activity Name *</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Fingerpainting Colors"
                                                value={activityName}
                                                onChange={e => setActivityName(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Learning Area</label>
                                                <select
                                                    value={learningArea}
                                                    onChange={e => setLearningArea(e.target.value)}
                                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                                >
                                                    <option value="Cognitive">Cognitive</option>
                                                    <option value="Physical / Gross Motor">Gross Motor</option>
                                                    <option value="Fine Motor">Fine Motor</option>
                                                    <option value="Social-Emotional">Social-Emotional</option>
                                                    <option value="Language & Literacy">Language & Literacy</option>
                                                    <option value="Creative Expression">Creative Expression</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Participation</label>
                                                <select
                                                    value={participation}
                                                    onChange={e => setParticipation(e.target.value)}
                                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                                >
                                                    <option value="High">High / Active</option>
                                                    <option value="Medium">Medium</option>
                                                    <option value="Low">Low / Reluctant</option>
                                                    <option value="Observed">Observed</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Start Time</label>
                                                <input
                                                    type="time"
                                                    value={actStart}
                                                    onChange={e => setActStart(e.target.value)}
                                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">End Time</label>
                                                <input
                                                    type="time"
                                                    value={actEnd}
                                                    onChange={e => setActEnd(e.target.value)}
                                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Teacher Observation / Notes</label>
                                            <textarea
                                                rows={2}
                                                placeholder="Factual developmental observations..."
                                                value={teacherNotes}
                                                onChange={e => setTeacherNotes(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => setActiveModal(null)}
                                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                                            >
                                                {submitting ? 'Saving...' : 'Save Activity'}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {activeModal === 'temperature' && (
                                    <form onSubmit={handleAddTemperature} className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Temperature *</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    required
                                                    value={tempValue}
                                                    onChange={e => setTempValue(e.target.value)}
                                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                                                <select
                                                    value={tempUnit}
                                                    onChange={e => setTempUnit(e.target.value)}
                                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                                >
                                                    <option value="Celsius">Celsius (°C)</option>
                                                    <option value="Fahrenheit">Fahrenheit (°F)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Method</label>
                                            <select
                                                value={tempMethod}
                                                onChange={e => setTempMethod(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            >
                                                <option value="Forehead">Forehead / Temporal</option>
                                                <option value="Ear">Ear / Tympanic</option>
                                                <option value="Armpit">Armpit / Axillary</option>
                                                <option value="Oral">Oral</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                                            <textarea
                                                rows={2}
                                                value={entryNotes}
                                                onChange={e => setEntryNotes(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => setActiveModal(null)}
                                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl"
                                            >
                                                {submitting ? 'Saving...' : 'Save Temperature'}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {activeModal === 'note' && (
                                    <form onSubmit={handleAddNote} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                                            <select
                                                value={noteCategory}
                                                onChange={e => setNoteCategory(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            >
                                                <option value="General">General Daily Note</option>
                                                <option value="Reminder">Parent Reminder (e.g. Diapers/Clothes)</option>
                                                <option value="Health">Health / Wellbeing</option>
                                                <option value="Behavior">Behavior Note</option>
                                                <option value="Supplies Needed">Supplies Needed</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Note Text *</label>
                                            <textarea
                                                rows={3}
                                                required
                                                placeholder="Write staff note here..."
                                                value={noteText}
                                                onChange={e => setNoteText(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => setActiveModal(null)}
                                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="px-5 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl"
                                            >
                                                {submitting ? 'Saving...' : 'Save Note'}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {activeModal === 'photo' && (
                                    <form onSubmit={handleAddPhoto} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Photo URL *</label>
                                            <input
                                                type="url"
                                                required
                                                placeholder="https://..."
                                                value={photoUrl}
                                                onChange={e => setPhotoUrl(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Caption</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Having fun painting blocks"
                                                value={photoCaption}
                                                onChange={e => setPhotoCaption(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Context</label>
                                            <select
                                                value={photoContext}
                                                onChange={e => setPhotoContext(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                            >
                                                <option value="Creative Arts">Creative Arts</option>
                                                <option value="Outdoor Play">Outdoor Play</option>
                                                <option value="Learning Activity">Learning Activity</option>
                                                <option value="Mealtime">Mealtime</option>
                                                <option value="Circle Time">Circle Time</option>
                                            </select>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => setActiveModal(null)}
                                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="px-5 py-2 text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 rounded-xl"
                                            >
                                                {submitting ? 'Saving...' : 'Add Photo'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </Layout>
    );
};

export default DailyChildReportDetail;
