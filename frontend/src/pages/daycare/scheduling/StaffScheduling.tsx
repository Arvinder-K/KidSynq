import React, { useEffect, useState, useMemo } from 'react';
import {
    CalendarDays, Plus, Copy, ChevronLeft, ChevronRight,
    Search, Clock, School,
    AlertCircle, CheckCircle2, Edit2, Trash2, X,
    Calendar, AlertTriangle, Users, Grid
} from 'lucide-react';


import Layout from '../../../components/Layout';
import {
    schedulingService,
    type StaffSchedule,
    type ShiftType,
    type ScheduleStatus,
    type ScheduleCopyPayload
} from '../../../api/schedulingService';
import {
    employeeService,
    type Employee,
    type EmployeeAvailability
} from '../../../api/employeeService';
import api from '../../../api';

const SHIFT_PRESETS = [
    { label: 'Opening (07:30 - 16:00)', type: 'opening' as ShiftType, start: '07:30', end: '16:00' },
    { label: 'Standard (08:30 - 17:00)', type: 'regular' as ShiftType, start: '08:30', end: '17:00' },
    { label: 'Closing (09:30 - 18:00)', type: 'closing' as ShiftType, start: '09:30', end: '18:00' },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const StaffScheduling: React.FC = () => {
    // Current Week Anchor (Monday of the displayed week)
    const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    });

    const [viewMode, setViewMode] = useState<'week' | 'day' | 'employee' | 'classroom'>('week');
    const [selectedDayDate, setSelectedDayDate] = useState<string>(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });

    // Data states
    const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [classrooms, setClassrooms] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successNotice, setSuccessNotice] = useState<string | null>(null);

    // Filters
    const [search, setSearch] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterClassroom, setFilterClassroom] = useState('');
    const [filterBranch, setFilterBranch] = useState('');
    const [filterShiftType, setFilterShiftType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Modal States
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<StaffSchedule | null>(null);
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingSchedule, setDeletingSchedule] = useState<StaffSchedule | null>(null);
    const [savingShift, setSavingShift] = useState(false);
    const [shiftFormError, setShiftFormError] = useState<string | null>(null);

    // Shift Form State
    const [formEmployeeId, setFormEmployeeId] = useState('');
    const [formDate, setFormDate] = useState('');
    const [formStartTime, setFormStartTime] = useState('08:30');
    const [formEndTime, setFormEndTime] = useState('17:00');
    const [formShiftType, setFormShiftType] = useState<ShiftType>('regular');
    const [formClassroomId, setFormClassroomId] = useState('');
    const [formBranchId, setFormBranchId] = useState('');
    const [formStatus, setFormStatus] = useState<ScheduleStatus>('scheduled');
    const [formNotes, setFormNotes] = useState('');
    const [employeeAvailability, setEmployeeAvailability] = useState<EmployeeAvailability[]>([]);
    const [loadingAvailability, setLoadingAvailability] = useState(false);

    // Copy Form State
    const [copyTargetDate, setCopyTargetDate] = useState('');
    const [copyOverwrite, setCopyOverwrite] = useState(false);
    const [copying, setCopying] = useState(false);


    // Calculate Week Dates (Mon - Sun)
    const weekDates = useMemo(() => {
        const dates: { name: string; dateStr: string; dateObj: Date }[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(currentWeekMonday);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            dates.push({
                name: DAYS_OF_WEEK[i],
                dateStr,
                dateObj: d
            });
        }
        return dates;
    }, [currentWeekMonday]);

    const weekStartStr = weekDates[0].dateStr;
    const weekEndStr = weekDates[6].dateStr;

    // Load Metadata (Employees, Classrooms, Branches)
    useEffect(() => {
        const loadInitialMeta = async () => {
            try {
                const [empRes, classRes, branchRes] = await Promise.all([
                    employeeService.getEmployees({ status: 'active' }).catch(() => []),
                    api.get('/daycare/classrooms/').catch(() => ({ data: [] })),
                    api.get('/daycare/branches/').catch(() => ({ data: [] }))
                ]);
                const employeeList = Array.isArray(empRes) ? empRes : (empRes?.results || []);
                setEmployees(employeeList);
                setClassrooms(Array.isArray(classRes.data) ? classRes.data : classRes.data?.results || []);
                setBranches(Array.isArray(branchRes.data) ? branchRes.data : branchRes.data?.results || []);
            } catch (err) {
                console.error("Failed to load scheduling metadata", err);
            }
        };
        loadInitialMeta();
    }, []);


    // Load Schedules for Current Week
    const fetchSchedules = async () => {
        try {
            setLoading(true);
            setError(null);
            const params: any = {
                start_date: weekStartStr,
                end_date: weekEndStr,
            };
            if (filterEmployee) params.employee = filterEmployee;
            if (filterClassroom) params.classroom = filterClassroom;
            if (filterBranch) params.branch = filterBranch;
            if (filterShiftType) params.shift_type = filterShiftType;
            if (filterStatus) params.status = filterStatus;

            const data = await schedulingService.getSchedules(params);
            setSchedules(data);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to load staff schedules.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedules();
    }, [weekStartStr, weekEndStr, filterEmployee, filterClassroom, filterBranch, filterShiftType, filterStatus]);

    // Fetch availability when selected employee changes in modal
    useEffect(() => {
        if (!formEmployeeId) {
            setEmployeeAvailability([]);
            return;
        }
        const loadAvail = async () => {
            try {
                setLoadingAvailability(true);
                const avails = await employeeService.getAvailability(formEmployeeId);
                setEmployeeAvailability(avails);
            } catch (err) {
                console.error("Failed to fetch employee availability", err);
            } finally {
                setLoadingAvailability(false);
            }
        };
        loadAvail();
    }, [formEmployeeId]);

    // Check availability status for selected date
    const selectedDateAvailability = useMemo(() => {
        if (!formDate || employeeAvailability.length === 0) return null;
        const d = new Date(formDate + 'T00:00:00');
        const dayName = DAYS_OF_WEEK[(d.getDay() + 6) % 7];
        const item = employeeAvailability.find(a => a.day_of_week.toLowerCase() === dayName.toLowerCase());
        return item || null;
    }, [formDate, employeeAvailability]);

    // Week Navigation
    const handlePrevWeek = () => {
        const prev = new Date(currentWeekMonday);
        prev.setDate(prev.getDate() - 7);
        setCurrentWeekMonday(prev);
    };

    const handleNextWeek = () => {
        const next = new Date(currentWeekMonday);
        next.setDate(next.getDate() + 7);
        setCurrentWeekMonday(next);
    };

    const handleTodayWeek = () => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        setCurrentWeekMonday(monday);
        setSelectedDayDate(new Date().toISOString().split('T')[0]);
    };

    // Open Modal for New Shift
    const handleOpenNewShift = (defaultDate?: string) => {
        setEditingSchedule(null);
        setFormEmployeeId(employees[0]?.id || '');
        setFormDate(defaultDate || weekStartStr);
        setFormStartTime('08:30');
        setFormEndTime('17:00');
        setFormShiftType('regular');
        setFormClassroomId('');
        setFormBranchId('');
        setFormStatus('scheduled');
        setFormNotes('');
        setShiftFormError(null);
        setIsShiftModalOpen(true);
    };

    // Open Modal for Edit Shift
    const handleOpenEditShift = (shift: StaffSchedule) => {
        setEditingSchedule(shift);
        setFormEmployeeId(shift.employee);
        setFormDate(shift.date);
        setFormStartTime(shift.shift_start.substring(0, 5));
        setFormEndTime(shift.shift_end.substring(0, 5));
        setFormShiftType(shift.shift_type);
        setFormClassroomId(shift.classroom || '');
        setFormBranchId(shift.branch || '');
        setFormStatus(shift.status);
        setFormNotes(shift.notes || '');
        setShiftFormError(null);
        setIsShiftModalOpen(true);
    };

    // Save Shift Handler
    const handleSaveShift = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingShift(true);
        setShiftFormError(null);

        const payload: Partial<StaffSchedule> = {
            employee: formEmployeeId,
            date: formDate,
            shift_start: formStartTime,
            shift_end: formEndTime,
            shift_type: formShiftType,
            classroom: formClassroomId || null,
            branch: formBranchId || null,
            status: formStatus,
            notes: formNotes || null
        };

        try {
            if (editingSchedule) {
                await schedulingService.updateSchedule(editingSchedule.id, payload);
                setSuccessNotice("Shift updated successfully.");
            } else {
                await schedulingService.createSchedule(payload);
                setSuccessNotice("Shift created and scheduled successfully.");
            }
            setIsShiftModalOpen(false);
            fetchSchedules();
            setTimeout(() => setSuccessNotice(null), 3000);
        } catch (err: any) {
            const data = err.response?.data;
            if (data) {
                if (data.non_field_errors) {
                    setShiftFormError(data.non_field_errors.join(' '));
                } else if (typeof data === 'object') {
                    const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | ');
                    setShiftFormError(msgs);
                } else {
                    setShiftFormError("Failed to save schedule shift.");
                }
            } else {
                setShiftFormError("An unexpected network error occurred.");
            }
        } finally {
            setSavingShift(false);
        }
    };

    // Delete Shift Handler
    const handleDeleteShift = async () => {
        if (!deletingSchedule) return;
        try {
            await schedulingService.deleteSchedule(deletingSchedule.id);
            setSuccessNotice("Shift deleted successfully.");
            setIsDeleteModalOpen(false);
            setDeletingSchedule(null);
            fetchSchedules();
            setTimeout(() => setSuccessNotice(null), 3000);
        } catch (err: any) {
            setError("Failed to delete shift.");
        }
    };

    // Copy Week Handler
    const handleCopyWeekSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!copyTargetDate) return;
        setCopying(true);

        const payload: ScheduleCopyPayload = {
            source_start_date: weekStartStr,
            source_end_date: weekEndStr,
            target_start_date: copyTargetDate,
            overwrite_conflicts: copyOverwrite
        };


        try {
            const res = await schedulingService.copySchedule(payload);
            setSuccessNotice(`Successfully copied ${res.copied_count} shift(s). (${res.skipped_count} skipped due to conflicts).`);
            setIsCopyModalOpen(false);
            setTimeout(() => setSuccessNotice(null), 4000);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to copy schedule.");
        } finally {
            setCopying(false);
        }
    };

    // Filtered Schedules by Search
    const filteredSchedules = useMemo(() => {
        return schedules.filter(s => {
            if (!search) return true;
            const q = search.toLowerCase();
            return (
                s.employee_name.toLowerCase().includes(q) ||
                (s.classroom_name && s.classroom_name.toLowerCase().includes(q)) ||
                s.shift_type.toLowerCase().includes(q) ||
                (s.employee_job_title && s.employee_job_title.toLowerCase().includes(q))
            );
        });
    }, [schedules, search]);

    // Metrics
    const totalHours = useMemo(() => {
        return filteredSchedules.reduce((sum, s) => sum + (s.duration_hours || 0), 0);
    }, [filteredSchedules]);

    const scheduledStaffCount = useMemo(() => {
        const unique = new Set(filteredSchedules.map(s => s.employee));
        return unique.size;
    }, [filteredSchedules]);

    // Helpers for Badge Styling
    const getShiftTypeBadge = (type: ShiftType) => {
        switch (type) {
            case 'opening':
                return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">Opening</span>;
            case 'closing':
                return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">Closing</span>;
            case 'custom':
                return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-900 border border-cyan-200">Custom</span>;
            default:
                return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">Regular</span>;
        }
    };

    const getStatusBadge = (status: ScheduleStatus) => {
        switch (status) {
            case 'confirmed':
                return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">Confirmed</span>;
            case 'completed':
                return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800">Completed</span>;
            case 'cancelled':
                return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-800">Cancelled</span>;
            default:
                return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700">Scheduled</span>;
        }
    };

    return (
        <Layout>
            <div className="space-y-6 pb-16">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Staff Scheduling & Shift Management
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Weekly operational staff scheduling with conflict prevention, educator availability validation, and room coverage tracking.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => {
                                const nextMon = new Date(currentWeekMonday);
                                nextMon.setDate(nextMon.getDate() + 7);
                                setCopyTargetDate(nextMon.toISOString().split('T')[0]);
                                setIsCopyModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-colors"
                        >
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            Copy Week
                        </button>
                        <button
                            onClick={() => handleOpenNewShift()}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Shift
                        </button>
                    </div>
                </div>

                {/* Alerts / Notices */}
                {successNotice && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{successNotice}</span>
                    </div>
                )}

                {error && (
                    <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                        <div className="text-[11px] font-bold text-slate-400 uppercase">Total Shifts</div>
                        <div className="text-2xl font-black text-slate-900 mt-1">{filteredSchedules.length}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">This week</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                        <div className="text-[11px] font-bold text-slate-400 uppercase">Scheduled Hours</div>
                        <div className="text-2xl font-black text-indigo-600 mt-1">{totalHours.toFixed(1)} <span className="text-xs font-normal text-slate-500">hrs</span></div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Total capacity</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                        <div className="text-[11px] font-bold text-slate-400 uppercase">Active Staff Rota</div>
                        <div className="text-2xl font-black text-emerald-600 mt-1">{scheduledStaffCount} <span className="text-xs font-normal text-slate-500">of {employees.length}</span></div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Educators on schedule</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                        <div className="text-[11px] font-bold text-slate-400 uppercase">Active Classrooms</div>
                        <div className="text-2xl font-black text-purple-600 mt-1">{classrooms.length}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Program rooms</div>
                    </div>
                </div>

                {/* Navigation Toolbar & Filters */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Week Switcher Controls */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrevWeek}
                                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                                title="Previous Week"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleTodayWeek}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
                            >
                                Today
                            </button>
                            <button
                                onClick={handleNextWeek}
                                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                                title="Next Week"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                            <div className="px-3 py-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                {weekDates[0].dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekDates[6].dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                        </div>

                        {/* View Mode Selector Tabs */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                            <button
                                onClick={() => setViewMode('week')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    viewMode === 'week' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Grid className="w-3.5 h-3.5" />
                                Week
                            </button>
                            <button
                                onClick={() => setViewMode('day')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    viewMode === 'day' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Clock className="w-3.5 h-3.5" />
                                Day
                            </button>
                            <button
                                onClick={() => setViewMode('employee')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    viewMode === 'employee' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                Employee
                            </button>
                            <button
                                onClick={() => setViewMode('classroom')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    viewMode === 'classroom' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <School className="w-3.5 h-3.5" />
                                Classroom
                            </button>
                        </div>
                    </div>

                    {/* Filter Row */}
                    <div className="flex items-center gap-2 flex-wrap text-xs pt-2 border-t border-slate-100">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                placeholder="Search staff, room, shift..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        {/* Filter Employee */}
                        <select
                            value={filterEmployee}
                            onChange={(e) => setFilterEmployee(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 outline-none max-w-[170px]"
                        >
                            <option value="">All Employees</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                            ))}
                        </select>

                        {/* Filter Classroom */}
                        <select
                            value={filterClassroom}
                            onChange={(e) => setFilterClassroom(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 outline-none max-w-[160px]"
                        >
                            <option value="">All Classrooms</option>
                            {classrooms.map(c => (
                                <option key={c.id} value={c.id}>{c.room_name}</option>
                            ))}
                        </select>

                        {/* Filter Shift Type */}
                        <select
                            value={filterShiftType}
                            onChange={(e) => setFilterShiftType(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 outline-none"
                        >
                            <option value="">All Shift Types</option>
                            <option value="regular">Regular</option>
                            <option value="opening">Opening</option>
                            <option value="closing">Closing</option>
                            <option value="custom">Custom</option>
                        </select>

                        {/* Filter Status */}
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 outline-none"
                        >
                            <option value="">All Statuses</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>

                        {(search || filterEmployee || filterClassroom || filterBranch || filterShiftType || filterStatus) && (
                            <button
                                onClick={() => {
                                    setSearch('');
                                    setFilterEmployee('');
                                    setFilterClassroom('');
                                    setFilterBranch('');
                                    setFilterShiftType('');
                                    setFilterStatus('');
                                }}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="py-8 text-center text-xs font-semibold text-indigo-600 animate-pulse flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4 animate-spin" />
                        Loading schedules...
                    </div>
                )}

                {/* VIEW 1: WEEK VIEW (7 DAY GRID) */}
                {!loading && viewMode === 'week' && (

                    <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                        {weekDates.map(day => {
                            const daySchedules = filteredSchedules.filter(s => s.date === day.dateStr);
                            const dayTotalHours = daySchedules.reduce((sum, s) => sum + (s.duration_hours || 0), 0);
                            const isToday = day.dateStr === new Date().toISOString().split('T')[0];

                            return (
                                <div
                                    key={day.dateStr}
                                    className={`bg-white rounded-2xl border flex flex-col min-h-[420px] transition-all shadow-2xs ${
                                        isToday ? 'border-indigo-400 ring-2 ring-indigo-500/20' : 'border-slate-200'
                                    }`}
                                >
                                    {/* Column Header */}
                                    <div className={`p-3 border-b text-center rounded-t-2xl ${
                                        isToday ? 'bg-indigo-50/80 border-indigo-200' : 'bg-slate-50/70 border-slate-200'
                                    }`}>
                                        <div className="text-xs font-bold text-slate-700">{day.name}</div>
                                        <div className="text-base font-black text-slate-900 mt-0.5">
                                            {day.dateObj.getDate()}
                                        </div>
                                        <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                            {daySchedules.length} shifts · {dayTotalHours.toFixed(1)}h
                                        </div>
                                    </div>

                                    {/* Shifts Cards in Day */}
                                    <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[500px]">
                                        {daySchedules.length === 0 ? (
                                            <div className="h-28 flex flex-col items-center justify-center text-slate-400 text-[11px] italic">
                                                No shifts
                                            </div>
                                        ) : (
                                            daySchedules.map(shift => (
                                                <div
                                                    key={shift.id}
                                                    onClick={() => handleOpenEditShift(shift)}
                                                    className="p-2.5 rounded-xl border border-slate-200/90 bg-white hover:border-indigo-300 hover:shadow-xs cursor-pointer transition-all space-y-1.5 group relative"
                                                >
                                                    <div className="flex items-start justify-between gap-1">
                                                        <div className="font-bold text-xs text-slate-900 truncate">
                                                            {shift.employee_name}
                                                        </div>
                                                        {getShiftTypeBadge(shift.shift_type)}
                                                    </div>

                                                    <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                                                        <Clock className="w-3 h-3 text-slate-400" />
                                                        {shift.shift_start.substring(0, 5)} – {shift.shift_end.substring(0, 5)}
                                                        <span className="text-[10px] text-slate-400">({shift.duration_hours}h)</span>
                                                    </div>

                                                    {shift.classroom_name && (
                                                        <div className="flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded">
                                                            <School className="w-2.5 h-2.5" />
                                                            {shift.classroom_name}
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                                        {getStatusBadge(shift.status)}
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDeletingSchedule(shift);
                                                                    setIsDeleteModalOpen(true);
                                                                }}
                                                                className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                                                title="Delete shift"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Add Shift Button for this day */}
                                    <div className="p-2 border-t border-slate-100">
                                        <button
                                            onClick={() => handleOpenNewShift(day.dateStr)}
                                            className="w-full py-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 font-bold text-[11px] rounded-xl transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" /> Add
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* VIEW 2: DAY VIEW */}
                {!loading && viewMode === 'day' && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="font-bold text-base text-slate-900">
                                    Day Schedule: {new Date(selectedDayDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                </h3>
                                <p className="text-xs text-slate-500">Detailed list of shifts scheduled for this day</p>
                            </div>
                            <input
                                type="date"
                                value={selectedDayDate}
                                onChange={(e) => setSelectedDayDate(e.target.value)}
                                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                            />
                        </div>

                        {filteredSchedules.filter(s => s.date === selectedDayDate).length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-sm italic">
                                No shifts scheduled for this date.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredSchedules.filter(s => s.date === selectedDayDate).map(shift => (
                                    <div key={shift.id} className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-sm">
                                                {shift.employee_name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-slate-900">{shift.employee_name}</div>
                                                <div className="text-xs text-slate-500">{shift.employee_job_title || shift.employee_role}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 text-xs">
                                            <div>
                                                <div className="font-bold text-slate-800">{shift.shift_start.substring(0, 5)} – {shift.shift_end.substring(0, 5)}</div>
                                                <div className="text-slate-400">{shift.duration_hours} hours</div>
                                            </div>
                                            <div>{getShiftTypeBadge(shift.shift_type)}</div>
                                            {shift.classroom_name && (
                                                <div className="font-semibold text-indigo-600">{shift.classroom_name}</div>
                                            )}
                                            <div>{getStatusBadge(shift.status)}</div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleOpenEditShift(shift)}
                                                className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setDeletingSchedule(shift);
                                                    setIsDeleteModalOpen(true);
                                                }}
                                                className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* VIEW 3: EMPLOYEE MATRIX VIEW */}
                {!loading && viewMode === 'employee' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="py-3.5 px-4 min-w-[180px]">Employee</th>
                                    {weekDates.map(d => (
                                        <th key={d.dateStr} className="py-3.5 px-3 min-w-[130px] text-center">
                                            {d.name.substring(0, 3)} {d.dateObj.getDate()}
                                        </th>
                                    ))}
                                    <th className="py-3.5 px-4 text-right">Total Hours</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {employees.map(emp => {
                                    const empSchedules = filteredSchedules.filter(s => s.employee === emp.id);
                                    const empWeeklyHours = empSchedules.reduce((sum, s) => sum + (s.duration_hours || 0), 0);

                                    return (
                                        <tr key={emp.id} className="hover:bg-slate-50/70">
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-900">{emp.first_name} {emp.last_name}</div>
                                                <div className="text-[11px] text-slate-400">{emp.job_title || emp.role}</div>
                                            </td>
                                            {weekDates.map(d => {
                                                const dayShift = empSchedules.find(s => s.date === d.dateStr);
                                                return (
                                                    <td key={d.dateStr} className="py-2 px-2 text-center">
                                                        {dayShift ? (
                                                            <div
                                                                onClick={() => handleOpenEditShift(dayShift)}
                                                                className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-[10px] font-bold text-indigo-900 cursor-pointer hover:bg-indigo-100"
                                                            >
                                                                <div>{dayShift.shift_start.substring(0, 5)}–{dayShift.shift_end.substring(0, 5)}</div>
                                                                {dayShift.classroom_name && (
                                                                    <div className="text-[9px] text-indigo-600 truncate">{dayShift.classroom_name}</div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    handleOpenNewShift(d.dateStr);
                                                                    setFormEmployeeId(emp.id);
                                                                }}
                                                                className="w-full py-2 text-slate-300 hover:text-indigo-600 hover:bg-slate-100 rounded text-[11px]"
                                                            >
                                                                +
                                                            </button>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="py-3 px-4 text-right font-black text-slate-900">
                                                {empWeeklyHours.toFixed(1)}h
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* VIEW 4: CLASSROOM COVERAGE VIEW */}
                {!loading && viewMode === 'classroom' && (

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="py-3.5 px-4 min-w-[180px]">Classroom</th>
                                    {weekDates.map(d => (
                                        <th key={d.dateStr} className="py-3.5 px-3 min-w-[140px] text-center">
                                            {d.name.substring(0, 3)} {d.dateObj.getDate()}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {classrooms.map(room => (
                                    <tr key={room.id} className="hover:bg-slate-50/70">
                                        <td className="py-3 px-4 font-bold text-slate-900">
                                            <div className="flex items-center gap-2">
                                                <School className="w-4 h-4 text-indigo-600" />
                                                <span>{room.room_name}</span>
                                            </div>
                                        </td>
                                        {weekDates.map(d => {
                                            const roomShifts = filteredSchedules.filter(s => s.classroom === room.id && s.date === d.dateStr);
                                            return (
                                                <td key={d.dateStr} className="py-2 px-2">
                                                    {roomShifts.length === 0 ? (
                                                        <div className="text-center text-slate-300 text-[10px] italic">—</div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            {roomShifts.map(s => (
                                                                <div
                                                                    key={s.id}
                                                                    onClick={() => handleOpenEditShift(s)}
                                                                    className="p-1 rounded bg-indigo-50 text-[10px] font-semibold text-indigo-900 truncate cursor-pointer hover:bg-indigo-100"
                                                                >
                                                                    {s.employee_name} ({s.shift_start.substring(0, 5)})
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* MODAL 1: ADD / EDIT SHIFT */}
                {isShiftModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
                        <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
                            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white">
                                        <CalendarDays className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-base text-white">
                                            {editingSchedule ? 'Edit Staff Shift' : 'Schedule Staff Shift'}
                                        </h3>
                                        <p className="text-xs text-slate-400">Configure educator shift time, room, and type</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsShiftModalOpen(false)}
                                    className="p-2 text-slate-400 hover:text-white rounded-xl"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveShift} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                                {shiftFormError && (
                                    <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                        <span>{shiftFormError}</span>
                                    </div>
                                )}

                                {/* Employee Selector */}
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
                                    {loadingAvailability && (
                                        <p className="text-[10px] text-indigo-600 mt-1">Checking employee availability...</p>
                                    )}
                                </div>


                                {/* Date Selector */}
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

                                {/* Live Availability Status Card */}
                                {selectedDateAvailability && (
                                    <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                                        selectedDateAvailability.status === 'Unavailable' || !selectedDateAvailability.is_available
                                            ? 'bg-red-50 border-red-200 text-red-800'
                                            : selectedDateAvailability.status === 'Custom hours'
                                                ? 'bg-amber-50 border-amber-200 text-amber-900'
                                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    }`}>
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-bold">Availability on {selectedDateAvailability.day_of_week}: </span>
                                            {selectedDateAvailability.status === 'Unavailable' || !selectedDateAvailability.is_available
                                                ? 'Marked as Unavailable.'
                                                : selectedDateAvailability.status === 'Custom hours'
                                                    ? `Available from ${selectedDateAvailability.start_time?.substring(0, 5)} to ${selectedDateAvailability.end_time?.substring(0, 5)}.`
                                                    : 'Standard Availability (All day).'}
                                        </div>
                                    </div>
                                )}

                                {/* Quick Shift Presets */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Quick Shift Presets</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {SHIFT_PRESETS.map(preset => (
                                            <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() => {
                                                    setFormStartTime(preset.start);
                                                    setFormEndTime(preset.end);
                                                    setFormShiftType(preset.type);
                                                }}
                                                className="p-2 border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 rounded-xl text-[10px] font-bold text-slate-700 transition-colors text-center"
                                            >
                                                {preset.label.split(' ')[0]}
                                                <div className="text-[9px] text-slate-400 font-normal">{preset.start}–{preset.end}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Time Start and End */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Start Time <span className="text-red-500">*</span>
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
                                            End Time <span className="text-red-500">*</span>
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

                                {/* Shift Type & Status */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Shift Type</label>
                                        <select
                                            value={formShiftType}
                                            onChange={(e) => setFormShiftType(e.target.value as ShiftType)}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="regular">Regular</option>
                                            <option value="opening">Opening</option>
                                            <option value="closing">Closing</option>
                                            <option value="custom">Custom</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                                        <select
                                            value={formStatus}
                                            onChange={(e) => setFormStatus(e.target.value as ScheduleStatus)}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="scheduled">Scheduled</option>
                                            <option value="confirmed">Confirmed</option>
                                            <option value="completed">Completed</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Classroom & Branch */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Classroom</label>
                                        <select
                                            value={formClassroomId}
                                            onChange={(e) => setFormClassroomId(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">No Classroom (Floating)</option>
                                            {classrooms.map(c => (
                                                <option key={c.id} value={c.id}>{c.room_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Branch</label>
                                        <select
                                            value={formBranchId}
                                            onChange={(e) => setFormBranchId(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Default Branch</option>
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Shift Notes</label>
                                    <textarea
                                        value={formNotes}
                                        onChange={(e) => setFormNotes(e.target.value)}
                                        rows={2}
                                        placeholder="Optional shift notes, ratio coverage instructions..."
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                {/* Modal Footer */}
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsShiftModalOpen(false)}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingShift}
                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                                    >
                                        {savingShift ? 'Saving...' : editingSchedule ? 'Update Shift' : 'Schedule Shift'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL 2: COPY WEEK SCHEDULE */}
                {isCopyModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
                        <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
                            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white">
                                        <Copy className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-base text-white">Copy Weekly Schedule</h3>
                                        <p className="text-xs text-slate-400">Replicate current week rota to target date</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsCopyModalOpen(false)}
                                    className="p-2 text-slate-400 hover:text-white rounded-xl"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCopyWeekSchedule} className="p-6 space-y-4">
                                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900">
                                    Source Week: <span className="font-bold">{weekStartStr} to {weekEndStr}</span> ({filteredSchedules.length} active shifts)
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Target Week Monday <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={copyTargetDate}
                                        onChange={(e) => setCopyTargetDate(e.target.value)}
                                        required
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Shifts will be mapped to the matching days of the target week.</p>
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="overwriteConf"
                                        checked={copyOverwrite}
                                        onChange={(e) => setCopyOverwrite(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 rounded"
                                    />
                                    <label htmlFor="overwriteConf" className="text-xs font-semibold text-slate-700">
                                        Overwrite conflicting shifts on target dates
                                    </label>
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsCopyModalOpen(false)}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={copying}
                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                                    >
                                        {copying ? 'Copying...' : 'Confirm Copy'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL 3: DELETE CONFIRMATION */}
                {isDeleteModalOpen && deletingSchedule && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
                        <div className="bg-white rounded-3xl max-w-sm w-full border border-slate-200 p-6 shadow-2xl space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-bold text-base text-slate-900">Delete Shift</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Are you sure you want to remove the shift for <span className="font-bold text-slate-800">{deletingSchedule.employee_name}</span> on <span className="font-bold text-slate-800">{deletingSchedule.date}</span> ({deletingSchedule.shift_start.substring(0, 5)}–{deletingSchedule.shift_end.substring(0, 5)})?
                                </p>
                            </div>
                            <div className="flex items-center justify-center gap-2 pt-2">
                                <button
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteShift}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs"
                                >
                                    Delete Shift
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default StaffScheduling;
