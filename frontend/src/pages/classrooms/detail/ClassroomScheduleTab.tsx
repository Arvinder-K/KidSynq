import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
    Clock, Users, Plus, Edit2, Trash2,
    CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, Sun,
    Sunrise, Moon, Coffee, Utensils, RefreshCw
} from 'lucide-react';
import { 
    schedulingService, 
    type StaffSchedule, 
    type ShiftType, 
    type ScheduleStatus,
    type ClassroomScheduleResponse, 
    type ClassroomCoverageSlot 
} from '../../../api/schedulingService';
import { employeeService, type Employee } from '../../../api/employeeService';

interface BreakDraft {
    id?: string;
    break_start: string;
    break_end: string;
    break_type: 'meal' | 'rest' | 'other';
    is_paid: boolean;
    notes?: string;
}

export const ClassroomScheduleTab: React.FC = () => {
    const { id: classroomId } = useParams<{ id: string }>();

    // Current Navigation Date State
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [selectedDateStr, setSelectedDateStr] = useState<string>(new Date().toISOString().split('T')[0]);

    // Data State
    const [scheduleData, setScheduleData] = useState<ClassroomScheduleResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [, setError] = useState<string | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);

    // Shift Modal State
    const [isShiftModalOpen, setIsShiftModalOpen] = useState<boolean>(false);
    const [editingSchedule, setEditingSchedule] = useState<StaffSchedule | null>(null);
    const [saving, setSaving] = useState<boolean>(false);
    const [modalError, setModalError] = useState<string | null>(null);


    // Shift Form Fields
    const [formEmployeeId, setFormEmployeeId] = useState<string>('');
    const [formDate, setFormDate] = useState<string>(selectedDateStr);
    const [formStartTime, setFormStartTime] = useState<string>('08:00');
    const [formEndTime, setFormEndTime] = useState<string>('16:30');
    const [formShiftType, setFormShiftType] = useState<ShiftType>('regular');
    const [formStatus, setFormStatus] = useState<ScheduleStatus>('scheduled');
    const [formDuties, setFormDuties] = useState<string>('');
    const [formNotes, setFormNotes] = useState<string>('');
    const [formBreaks, setFormBreaks] = useState<BreakDraft[]>([]);

    // Calculate Monday of Current Week
    const getMonday = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    };

    const currentMonday = getMonday(currentDate);
    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentMonday);
        d.setDate(currentMonday.getDate() + i);
        return {
            dateObj: d,
            dateStr: d.toISOString().split('T')[0],
            dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNumber: d.getDate(),
            fullDateStr: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };
    });

    const weekStartStr = weekDates[0].dateStr;
    const weekEndStr = weekDates[6].dateStr;

    // Load Initial Employees for Dropdown
    useEffect(() => {
        const loadEmployees = async () => {
            try {
                const res = await employeeService.getEmployees({ status: 'active' });
                const list = Array.isArray(res) ? res : (res?.results || []);
                setEmployees(list);
            } catch (err) {
                console.error("Failed to load active employees", err);
            }
        };
        loadEmployees();
    }, []);

    // Load Classroom Schedule & Coverage for Selected Week/Date
    const loadSchedule = async () => {
        if (!classroomId) return;
        try {
            setLoading(true);
            setError(null);
            const res = await schedulingService.getClassroomSchedule(classroomId, {
                start_date: weekStartStr,
                end_date: weekEndStr,
                date: selectedDateStr
            });
            setScheduleData(res);
        } catch (err: any) {
            console.error("Failed to load classroom schedule", err);
            setError(err.response?.data?.detail || "Failed to load classroom schedule data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSchedule();
    }, [classroomId, weekStartStr, selectedDateStr]);

    // Navigate Weeks
    const handlePrevWeek = () => {
        const prev = new Date(currentMonday);
        prev.setDate(prev.getDate() - 7);
        setCurrentDate(prev);
        setSelectedDateStr(prev.toISOString().split('T')[0]);
    };

    const handleNextWeek = () => {
        const next = new Date(currentMonday);
        next.setDate(next.getDate() + 7);
        setCurrentDate(next);
        setSelectedDateStr(next.toISOString().split('T')[0]);
    };

    const handleToday = () => {
        const now = new Date();
        setCurrentDate(now);
        setSelectedDateStr(now.toISOString().split('T')[0]);
    };

    // Open Modal for Create
    const handleOpenNewShift = (defaultDate?: string) => {
        setEditingSchedule(null);
        setFormEmployeeId(employees[0]?.id || '');
        setFormDate(defaultDate || selectedDateStr);
        setFormStartTime('08:00');
        setFormEndTime('16:30');
        setFormShiftType('regular');
        setFormStatus('scheduled');
        setFormDuties('');
        setFormNotes('');
        setFormBreaks([
            { break_start: '12:00', break_end: '12:30', break_type: 'meal', is_paid: false }
        ]);
        setModalError(null);
        setIsShiftModalOpen(true);
    };

    // Open Modal for Edit
    const handleOpenEditShift = (shift: StaffSchedule) => {
        setEditingSchedule(shift);
        setFormEmployeeId(shift.employee);
        setFormDate(shift.date);
        setFormStartTime(shift.shift_start.substring(0, 5));
        setFormEndTime(shift.shift_end.substring(0, 5));
        setFormShiftType(shift.shift_type);
        setFormStatus(shift.status);
        setFormDuties(shift.duties || '');
        setFormNotes(shift.notes || '');
        setFormBreaks((shift.breaks || []).map(b => ({
            id: b.id,
            break_start: b.break_start.substring(0, 5),
            break_end: b.break_end.substring(0, 5),
            break_type: b.break_type,
            is_paid: b.is_paid,
            notes: b.notes || ''
        })));
        setModalError(null);
        setIsShiftModalOpen(true);
    };

    // Quick Break Add
    const handleAddBreak = (type: 'meal' | 'rest') => {
        const isPaid = type === 'rest';
        const newBreak: BreakDraft = {
            break_start: type === 'meal' ? '12:00' : '10:00',
            break_end: type === 'meal' ? '12:30' : '10:15',
            break_type: type,
            is_paid: isPaid,
            notes: ''
        };
        setFormBreaks([...formBreaks, newBreak]);
    };

    const handleRemoveBreak = (idx: number) => {
        setFormBreaks(formBreaks.filter((_, i) => i !== idx));
    };

    const handleBreakChange = (idx: number, field: keyof BreakDraft, value: any) => {
        const updated = [...formBreaks];
        updated[idx] = { ...updated[idx], [field]: value };
        setFormBreaks(updated);
    };

    // Calculate Working Hours live
    const calculateLiveHours = () => {
        if (!formStartTime || !formEndTime) return { total: 0, unpaid: 0, paid: 0, net: 0 };
        const [sH, sM] = formStartTime.split(':').map(Number);
        const [eH, eM] = formEndTime.split(':').map(Number);
        const totalMinutes = (eH * 60 + eM) - (sH * 60 + sM);
        const total = Math.max(0, totalMinutes / 60);

        let unpaidMinutes = 0;
        let paidMinutes = 0;
        formBreaks.forEach(b => {
            if (b.break_start && b.break_end) {
                const [bSH, bSM] = b.break_start.split(':').map(Number);
                const [bEH, bEM] = b.break_end.split(':').map(Number);
                const diff = (bEH * 60 + bEM) - (bSH * 60 + bSM);
                if (diff > 0) {
                    if (b.is_paid) paidMinutes += diff;
                    else unpaidMinutes += diff;
                }
            }
        });

        const unpaid = unpaidMinutes / 60;
        const paid = paidMinutes / 60;
        const net = Math.max(0, total - unpaid);

        return {
            total: Number(total.toFixed(2)),
            unpaid: Number(unpaid.toFixed(2)),
            paid: Number(paid.toFixed(2)),
            net: Number(net.toFixed(2))
        };
    };

    const liveHours = calculateLiveHours();

    // Preset Shift Types
    const handlePresetChange = (type: ShiftType) => {
        setFormShiftType(type);
        if (type === 'opening') {
            setFormStartTime('06:30');
            setFormEndTime('14:30');
            setFormDuties('Inspect room, verify safety gates, setup breakfast tables, review health check logs.');
        } else if (type === 'closing') {
            setFormStartTime('10:00');
            setFormEndTime('18:30');
            setFormDuties('Sanitize toys, ensure all sign-outs logged, tidy sensory bins, secure room doors.');
        } else if (type === 'regular') {
            setFormStartTime('08:00');
            setFormEndTime('16:30');
            setFormDuties('');
        }
    };

    // Save Shift Handler
    const handleSaveShift = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!classroomId || !formEmployeeId) {
            setModalError("Please select a staff member.");
            return;
        }

        try {
            setSaving(true);
            setModalError(null);

            const payload: any = {
                employee: formEmployeeId,
                date: formDate,
                shift_start: formStartTime,
                shift_end: formEndTime,
                shift_type: formShiftType,
                classroom: classroomId,
                status: formStatus,
                duties: formDuties,
                notes: formNotes,
                breaks: formBreaks.map(b => ({
                    break_start: b.break_start,
                    break_end: b.break_end,
                    break_type: b.break_type,
                    is_paid: b.is_paid,
                    notes: b.notes || null
                }))
            };

            if (editingSchedule) {
                await schedulingService.updateSchedule(editingSchedule.id, payload);
            } else {
                await schedulingService.createSchedule(payload);
            }

            setIsShiftModalOpen(false);
            loadSchedule();
        } catch (err: any) {
            console.error("Save shift failed", err);
            const detail = err.response?.data;
            if (detail?.non_field_errors) {
                setModalError(detail.non_field_errors[0]);
            } else if (typeof detail === 'object') {
                const firstKey = Object.keys(detail)[0];
                const msg = Array.isArray(detail[firstKey]) ? detail[firstKey][0] : detail[firstKey];
                setModalError(`${firstKey}: ${msg}`);
            } else {
                setModalError("Failed to save shift. Please check input parameters.");
            }
        } finally {
            setSaving(false);
        }
    };

    // Delete Shift Handler
    const handleDeleteShift = async (shiftId: string, empName: string) => {
        if (!window.confirm(`Are you sure you want to delete the scheduled shift for ${empName}?`)) return;
        try {
            await schedulingService.deleteSchedule(shiftId);
            loadSchedule();
        } catch (err) {
            console.error("Failed to delete shift", err);
            alert("Failed to delete shift.");
        }
    };

    const coverage = scheduleData?.coverage;
    const shifts = scheduleData?.shifts || [];
    const classroomMeta = scheduleData?.classroom;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header & Ratio Card */}
            <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-indigo-200 border border-white/10">
                                {classroomMeta?.age_group || 'Classroom Ratio & Schedule'}
                            </span>
                            {coverage?.overall_status === 'COMPLIANT' ? (
                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Ratio Compliant
                                </span>
                            ) : (
                                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold flex items-center gap-1.5 animate-pulse">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Coverage Shortage
                                </span>
                            )}
                        </div>
                        <h2 className="text-2xl font-black tracking-tight">{classroomMeta?.room_name || 'Classroom Schedule'}</h2>
                        <p className="text-indigo-200 text-xs mt-1 max-w-xl">
                            Live operational educator scheduling with provincial staff-to-child ratios, opening/closing coverage, and break tracking.
                        </p>
                    </div>

                    {/* Ratio & Capacity Stat Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                            <span className="text-[10px] text-indigo-200 uppercase tracking-wider font-bold">Standard Ratio</span>
                            <div className="text-xl font-black text-white mt-0.5">{coverage?.ratio_standard || '1:5'}</div>
                            <span className="text-[10px] text-indigo-300">ECE to Child</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                            <span className="text-[10px] text-indigo-200 uppercase tracking-wider font-bold">Required Staff</span>
                            <div className="text-xl font-black text-amber-300 mt-0.5">{coverage?.required_staff_per_hour || 2} Staff</div>
                            <span className="text-[10px] text-indigo-300">Per Active Hour</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                            <span className="text-[10px] text-indigo-200 uppercase tracking-wider font-bold">Enrolled / Cap</span>
                            <div className="text-xl font-black text-white mt-0.5">{coverage?.enrolled_students || 0} / {classroomMeta?.capacity || 10}</div>
                            <span className="text-[10px] text-indigo-300">Students</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                            <span className="text-[10px] text-indigo-200 uppercase tracking-wider font-bold">Coverage Hours</span>
                            <div className="text-xl font-black text-emerald-400 mt-0.5">{coverage?.ok_slots || 0}/{coverage?.total_slots || 0}</div>
                            <span className="text-[10px] text-indigo-300">Hours OK</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Week & Date Navigation Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePrevWeek}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                        title="Previous Week"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleToday}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all"
                    >
                        This Week
                    </button>
                    <button
                        onClick={handleNextWeek}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                        title="Next Week"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                    <span className="text-xs font-bold text-slate-800 ml-2">
                        {weekDates[0].fullDateStr} – {weekDates[6].fullDateStr}
                    </span>
                </div>

                {/* Day selector buttons */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
                    {weekDates.map(day => {
                        const isSelected = selectedDateStr === day.dateStr;
                        const isToday = new Date().toISOString().split('T')[0] === day.dateStr;
                        return (
                            <button
                                key={day.dateStr}
                                onClick={() => setSelectedDateStr(day.dateStr)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center min-w-[56px] ${
                                    isSelected
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                        : isToday
                                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <span className="text-[10px] uppercase font-semibold opacity-80">{day.dayName}</span>
                                <span className="text-sm font-black">{day.dayNumber}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadSchedule()}
                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                        title="Refresh Schedule"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => handleOpenNewShift(selectedDateStr)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-95"
                    >
                        <Plus className="w-4 h-4" /> Schedule Shift
                    </button>
                </div>
            </div>

            {/* Hourly Classroom Ratio & Coverage Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-600" />
                            Hourly Ratio Coverage Matrix • {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Target ratio: <strong className="text-slate-700">{coverage?.ratio_standard || '1:5'}</strong> ({coverage?.required_staff_per_hour || 2} educators required for {coverage?.effective_children_count || 10} children)
                        </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> OK ({coverage?.ok_slots || 0}h)
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-700 font-semibold">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Shortage ({coverage?.shortage_slots || 0}h)
                        </span>
                        <span className="flex items-center gap-1.5 text-indigo-700 font-semibold">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> Surplus ({coverage?.surplus_slots || 0}h)
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-slate-400 text-xs font-medium">
                        Loading ratio coverage matrix...
                    </div>
                ) : !coverage || coverage.hourly_coverage.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">No hours configured for this daycare.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {coverage.hourly_coverage.map((slot: ClassroomCoverageSlot, idx: number) => {
                            const isShortage = slot.coverage_status === 'SHORTAGE';
                            const isSurplus = slot.coverage_status === 'SURPLUS';


                            return (
                                <div
                                    key={idx}
                                    className={`p-3.5 rounded-2xl border transition-all ${
                                        isShortage
                                            ? 'bg-red-50/70 border-red-200 text-red-950 shadow-sm'
                                            : isSurplus
                                            ? 'bg-indigo-50/60 border-indigo-200 text-indigo-950'
                                            : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-black tracking-tight">{slot.time_slot}</span>
                                        <span
                                            className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                isShortage
                                                    ? 'bg-red-200 text-red-800'
                                                    : isSurplus
                                                    ? 'bg-indigo-200 text-indigo-800'
                                                    : 'bg-emerald-200 text-emerald-800'
                                            }`}
                                        >
                                            {isShortage ? `-${slot.shortage} Shortage` : isSurplus ? `+${slot.scheduled_staff_count - slot.required_staff} Surplus` : '✓ Ratio OK'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-xs mb-2">
                                        <span className="text-slate-600 font-medium">Scheduled:</span>
                                        <span className="font-bold text-slate-900">
                                            {slot.scheduled_staff_count} / {slot.required_staff} Staff
                                        </span>
                                    </div>

                                    {/* Educator Badges */}
                                    <div className="space-y-1">
                                        {slot.scheduled_educators.length > 0 ? (
                                            slot.scheduled_educators.map((edu, eIdx) => (
                                                <div
                                                    key={eIdx}
                                                    className="px-2 py-1 bg-white/80 rounded-lg text-[11px] font-semibold flex items-center justify-between text-slate-700 border border-slate-100 shadow-2xs"
                                                >
                                                    <span className="truncate max-w-[140px] flex items-center gap-1">
                                                        {edu.shift_type === 'opening' && <Sunrise className="w-3 h-3 text-amber-500 inline" />}
                                                        {edu.shift_type === 'closing' && <Moon className="w-3 h-3 text-indigo-500 inline" />}
                                                        {edu.name}
                                                    </span>
                                                    <span className="text-[9px] text-slate-500 font-mono">{edu.shift_timing}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-[11px] text-red-600 italic py-1">No educators scheduled</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Weekly Shifts List for Classroom */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Weekly Scheduled Shifts for {classroomMeta?.room_name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">All educator assignments, opening/closing responsibilities, and break schedules for the week.</p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-700 rounded-xl">
                        {shifts.length} Total Shifts
                    </span>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-xs text-slate-400">Loading classroom shifts...</div>
                ) : shifts.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs">
                        <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        No shifts scheduled for this room this week. Click <strong>"Schedule Shift"</strong> above to assign staff.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/80 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Staff Member</th>
                                    <th className="px-4 py-3">Shift Type</th>
                                    <th className="px-4 py-3">Shift Hours</th>
                                    <th className="px-4 py-3">Breaks Schedule</th>
                                    <th className="px-4 py-3">Net Working Time</th>
                                    <th className="px-4 py-3">Opening/Closing Duties</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {shifts.map((shift) => {
                                    const shiftDateObj = new Date(shift.date + 'T00:00:00');
                                    const dateLabel = shiftDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                    const isOpening = shift.shift_type === 'opening';
                                    const isClosing = shift.shift_type === 'closing';

                                    return (
                                        <tr key={shift.id} className="hover:bg-slate-50/60 transition-all">
                                            <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                                                {dateLabel}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-900">{shift.employee_name}</div>
                                                <div className="text-[10px] text-slate-400">{shift.employee_job_title || shift.employee_role}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                                        isOpening
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : isClosing
                                                            ? 'bg-indigo-100 text-indigo-800'
                                                            : 'bg-emerald-100 text-emerald-800'
                                                    }`}
                                                >
                                                    {isOpening && <Sunrise className="w-3 h-3 text-amber-600" />}
                                                    {isClosing && <Moon className="w-3 h-3 text-indigo-600" />}
                                                    {!isOpening && !isClosing && <Sun className="w-3 h-3 text-emerald-600" />}
                                                    {shift.shift_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-700">
                                                {shift.shift_start.substring(0, 5)} – {shift.shift_end.substring(0, 5)}
                                                <span className="text-[10px] text-slate-400 ml-1">({shift.total_shift_hours}h)</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {shift.breaks && shift.breaks.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {shift.breaks.map((b, bIdx) => (
                                                            <span
                                                                key={bIdx}
                                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                                                    b.is_paid
                                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                }`}
                                                            >
                                                                {b.break_type === 'meal' ? <Utensils className="w-2.5 h-2.5" /> : <Coffee className="w-2.5 h-2.5" />}
                                                                {b.break_start.substring(0, 5)}–{b.break_end.substring(0, 5)} ({b.is_paid ? 'Paid' : 'Unpaid'})
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic">No breaks logged</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                                                {shift.net_working_hours} hrs
                                            </td>
                                            <td className="px-4 py-3 max-w-xs">
                                                {shift.duties ? (
                                                    <p className="text-[11px] text-slate-600 truncate" title={shift.duties}>{shift.duties}</p>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleOpenEditShift(shift)}
                                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                                                        title="Edit Shift"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteShift(shift.id, shift.employee_name)}
                                                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Delete Shift"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Shift Modal with Integrated Breaks Manager */}
            {isShiftModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
                        <form onSubmit={handleSaveShift}>
                            {/* Modal Header */}
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">
                                        {editingSchedule ? 'Edit Classroom Shift' : 'Schedule Staff Shift'}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Assign educator, shift type, opening/closing duties, and meal/rest breaks.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsShiftModalOpen(false)}
                                    className="text-slate-400 hover:text-slate-700 p-2 rounded-xl"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-5">
                                {modalError && (
                                    <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-2xl flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                        <span>{modalError}</span>
                                    </div>
                                )}

                                {/* Shift Type Selector Presets */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Shift Preset</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(['regular', 'opening', 'closing', 'custom'] as ShiftType[]).map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => handlePresetChange(type)}
                                                className={`py-2 px-3 rounded-xl text-xs font-bold capitalize transition-all border flex items-center justify-center gap-1.5 ${
                                                    formShiftType === type
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                                }`}
                                            >
                                                {type === 'opening' && <Sunrise className="w-3.5 h-3.5" />}
                                                {type === 'closing' && <Moon className="w-3.5 h-3.5" />}
                                                {type === 'regular' && <Sun className="w-3.5 h-3.5" />}
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Staff & Date */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Staff Member <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={formEmployeeId}
                                            onChange={(e) => setFormEmployeeId(e.target.value)}
                                            required
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Select Employee...</option>
                                            {employees.map(emp => (
                                                <option key={emp.id} value={emp.id}>
                                                    {emp.first_name} {emp.last_name} ({emp.job_title || emp.role})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Shift Date <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={formDate}
                                            onChange={(e) => setFormDate(e.target.value)}
                                            required
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>

                                {/* Shift Timing */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Shift Start Time <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={formStartTime}
                                            onChange={(e) => setFormStartTime(e.target.value)}
                                            required
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Shift End Time <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={formEndTime}
                                            onChange={(e) => setFormEndTime(e.target.value)}
                                            required
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>

                                {/* Duties / Special Opening/Closing Notes */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Opening / Closing Duties & Responsibilities
                                    </label>
                                    <textarea
                                        value={formDuties}
                                        onChange={(e) => setFormDuties(e.target.value)}
                                        rows={2}
                                        placeholder="e.g. Inspect entrance, unlock gates, sanitize tables, verify student pick-ups..."
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                {/* Breaks Manager */}
                                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                                <Coffee className="w-3.5 h-3.5 text-indigo-600" /> Shift Breaks
                                            </h4>
                                            <p className="text-[11px] text-slate-500">Unpaid breaks are automatically deducted from working hours.</p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => handleAddBreak('meal')}
                                                className="px-2.5 py-1 bg-white text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-bold border border-indigo-200 shadow-2xs transition-all"
                                            >
                                                + Meal Break
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleAddBreak('rest')}
                                                className="px-2.5 py-1 bg-white text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs font-bold border border-emerald-200 shadow-2xs transition-all"
                                            >
                                                + Rest Break
                                            </button>
                                        </div>
                                    </div>

                                    {formBreaks.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic text-center py-3">No breaks scheduled for this shift.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {formBreaks.map((b, bIdx) => (
                                                <div key={bIdx} className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3">
                                                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                                        <div>
                                                            <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Type</span>
                                                            <select
                                                                value={b.break_type}
                                                                onChange={(e) => handleBreakChange(bIdx, 'break_type', e.target.value)}
                                                                className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-semibold"
                                                            >
                                                                <option value="meal">Meal Break</option>
                                                                <option value="rest">Rest Break</option>
                                                                <option value="other">Other</option>
                                                            </select>
                                                        </div>

                                                        <div>
                                                            <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Start</span>
                                                            <input
                                                                type="time"
                                                                value={b.break_start}
                                                                onChange={(e) => handleBreakChange(bIdx, 'break_start', e.target.value)}
                                                                required
                                                                className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-semibold"
                                                            />
                                                        </div>

                                                        <div>
                                                            <span className="text-[10px] text-slate-500 font-bold block mb-0.5">End</span>
                                                            <input
                                                                type="time"
                                                                value={b.break_end}
                                                                onChange={(e) => handleBreakChange(bIdx, 'break_end', e.target.value)}
                                                                required
                                                                className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-semibold"
                                                            />
                                                        </div>

                                                        <div className="flex items-center gap-2 pt-4">
                                                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={b.is_paid}
                                                                    onChange={(e) => handleBreakChange(bIdx, 'is_paid', e.target.checked)}
                                                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                                                />
                                                                Paid
                                                            </label>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveBreak(bIdx)}
                                                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg shrink-0 self-end sm:self-center"
                                                        title="Remove Break"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Live Hours Summary Box */}
                                    <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-3">
                                            <span className="text-slate-600">Total Shift: <strong>{liveHours.total}h</strong></span>
                                            <span className="text-amber-700">Unpaid Breaks: <strong>-{liveHours.unpaid}h</strong></span>
                                            {liveHours.paid > 0 && <span className="text-blue-700">Paid Breaks: <strong>{liveHours.paid}h</strong></span>}
                                        </div>
                                        <div className="font-black text-slate-900 bg-indigo-100/70 px-3 py-1 rounded-lg text-indigo-900">
                                            Net Working Time: {liveHours.net} hrs
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-3xl">
                                <button
                                    type="button"
                                    onClick={() => setIsShiftModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : editingSchedule ? 'Update Shift' : 'Save Shift'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassroomScheduleTab;
