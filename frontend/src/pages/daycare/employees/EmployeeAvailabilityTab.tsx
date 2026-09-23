import React, { useEffect, useState } from 'react';
import { Clock, Save, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { employeeService, type EmployeeAvailability } from '../../../api/employeeService';

interface Props {
    employeeId: string;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const EmployeeAvailabilityTab: React.FC<Props> = ({ employeeId }) => {
    const [schedule, setSchedule] = useState<EmployeeAvailability[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedNotice, setSavedNotice] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAvailability = async () => {
        try {
            setLoading(true);
            const data = await employeeService.getAvailability(employeeId);
            
            // Build full 7-day schedule ensuring all days exist
            const fullSchedule: EmployeeAvailability[] = DAYS_OF_WEEK.map(day => {
                const existing = data.find(d => d.day_of_week.toLowerCase() === day.toLowerCase());
                if (existing) {
                    return existing;
                }
                const isWeekday = !['Saturday', 'Sunday'].includes(day);
                return {
                    day_of_week: day,
                    is_available: isWeekday,
                    start_time: isWeekday ? '08:00' : null,
                    end_time: isWeekday ? '17:00' : null,
                    notes: ''
                };
            });
            setSchedule(fullSchedule);
        } catch (err: any) {
            setError("Failed to load availability schedule.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAvailability();
    }, [employeeId]);

    const handleToggleAvailable = (day: string) => {
        setSchedule(prev => prev.map(item => {
            if (item.day_of_week === day) {
                const newAvailable = !item.is_available;
                return {
                    ...item,
                    is_available: newAvailable,
                    start_time: newAvailable ? (item.start_time || '08:00') : null,
                    end_time: newAvailable ? (item.end_time || '17:00') : null
                };
            }
            return item;
        }));
    };

    const handleTimeChange = (day: string, field: 'start_time' | 'end_time', value: string) => {
        setSchedule(prev => prev.map(item => {
            if (item.day_of_week === day) {
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const handleNotesChange = (day: string, value: string) => {
        setSchedule(prev => prev.map(item => {
            if (item.day_of_week === day) {
                return { ...item, notes: value };
            }
            return item;
        }));
    };

    const handleApplyStandardHours = () => {
        setSchedule(DAYS_OF_WEEK.map(day => {
            const isWeekday = !['Saturday', 'Sunday'].includes(day);
            return {
                day_of_week: day,
                is_available: isWeekday,
                start_time: isWeekday ? '08:00' : null,
                end_time: isWeekday ? '17:00' : null,
                notes: isWeekday ? 'Standard Full-Time Shift' : 'Weekend Off'
            };
        }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            await employeeService.updateAvailability(employeeId, schedule);
            setSavedNotice(true);
            setTimeout(() => setSavedNotice(false), 3000);
        } catch (err: any) {
            setError(err.response?.data?.detail || err.message || "Failed to update availability schedule.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Work Schedule & Availability</h2>
                    <p className="text-sm text-slate-500 mt-1">Configure weekly available days and hours for staff scheduling and classroom ratios.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleApplyStandardHours}
                        className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
                    >
                        <Sparkles className="w-4 h-4 text-indigo-600" /> Apply Standard Hours (Mon-Fri)
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-sm disabled:opacity-50"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Save Schedule
                    </button>
                </div>
            </div>

            {savedNotice && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Availability schedule saved successfully.
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden divide-y divide-slate-100">
                {schedule.map(item => (
                    <div
                        key={item.day_of_week}
                        className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                            item.is_available ? 'bg-white' : 'bg-slate-50/60 opacity-80'
                        }`}
                    >
                        <div className="w-44 flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => handleToggleAvailable(item.day_of_week)}
                                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                                    item.is_available
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                }`}
                                title={item.is_available ? 'Mark Unavailable' : 'Mark Available'}
                            >
                                {item.is_available ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                            </button>
                            <div>
                                <span className="font-bold text-slate-900 block">{item.day_of_week}</span>
                                <span className={`text-xs font-semibold ${item.is_available ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {item.is_available ? 'Available' : 'Off'}
                                </span>
                            </div>
                        </div>

                        {item.is_available ? (
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    <input
                                        type="time"
                                        value={item.start_time || '08:00'}
                                        onChange={e => handleTimeChange(item.day_of_week, 'start_time', e.target.value)}
                                        className="px-3 py-1.5 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                                    />
                                    <span className="text-slate-400 text-sm">to</span>
                                    <input
                                        type="time"
                                        value={item.end_time || '17:00'}
                                        onChange={e => handleTimeChange(item.day_of_week, 'end_time', e.target.value)}
                                        className="px-3 py-1.5 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <input
                                        type="text"
                                        value={item.notes || ''}
                                        onChange={e => handleNotesChange(item.day_of_week, e.target.value)}
                                        placeholder="Optional shift notes (e.g. Opening shift, morning only)..."
                                        className="w-full px-3 py-1.5 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-400"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 text-sm text-slate-400 italic">
                                Staff member marked as off on {item.day_of_week}s.
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
