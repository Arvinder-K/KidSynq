import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Scale, Users, UserCheck, ShieldCheck, AlertTriangle,
    AlertCircle, RefreshCw, Search, Filter, Clock,
    GraduationCap, CheckCircle2, XCircle, ChevronDown,
    ChevronUp, Layers, Info, Calendar, Baby, ArrowRight,
    Sparkles, BookOpen, ShieldAlert, Award, FileSpreadsheet,
    Shield, Check, Camera
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api';

interface PresentChild {
    student_id: string;
    name: string;
    admission_number: string;
    check_in_time: string | null;
    age_months: number | null;
    attendance_id: string;
    attendance_status: string;
}

interface PresentStaff {
    employee_id: string;
    name: string;
    role: string;
    employee_number: string;
    clock_in_time: string | null;
    status: string;
    is_qualified: boolean;
    credentials: string[];
    attendance_id: string;
}

interface RatioRuleConfig {
    rule_id: string | null;
    name: string;
    max_children_per_staff: number;
    warning_threshold_buffer: number;
    requires_qualified_ece: boolean;
    qualification_requirement?: string;
    is_custom: boolean;
    is_system_rule?: boolean;
    province_code?: string;
    province_name?: string;
    program_name?: string;
    age_group_name?: string;
    effective_from?: string;
}

interface RuleExplanation {
    applicable_rule: string;
    rule_id: string | null;
    province: string;
    province_code: string;
    program: string;
    age_group: string;
    effective_date: string;
    max_children_per_staff: number;
    required_staff: number;
    qualification_requirement: string;
    explanation_source?: string;
    explanation_text: string;
    disclaimer: string;
}

interface OverrideInfo {
    id: string;
    override_status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT' | 'EXEMPT';
    reason: string;
    created_by: string;
    created_at: string;
    expires_at: string | null;
    is_active: boolean;
    is_expired: boolean;
}

interface ClassroomRatioData {
    classroom_id: string;
    classroom_name: string;
    room_code: string;
    age_group: string;
    capacity: number;
    rule: RatioRuleConfig;
    rule_explanation?: RuleExplanation;
    children_present: number;
    qualified_staff_present: number;
    total_staff_present: number;
    unqualified_staff_present: number;
    required_staff: number;
    ratio: string;
    calculated_status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT';
    status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT' | 'EXEMPT';
    final_status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT' | 'EXEMPT';
    status_display: string;
    override_applied: boolean;
    override?: OverrideInfo | null;
    children: PresentChild[];
    staff: PresentStaff[];
    calculated_at: string;
}

interface RatioDashboardSummary {
    daycare_id: string;
    daycare_name?: string;
    province_code?: string;
    province_name?: string;
    target_date: string;
    target_time: string;
    total_classrooms: number;
    total_children_present: number;
    total_qualified_staff_present: number;
    total_required_staff: number;
    compliant_classrooms_count: number;
    warning_classrooms_count: number;
    non_compliant_classrooms_count: number;
    overridden_classrooms_count?: number;
    overall_status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT';
    classrooms: ClassroomRatioData[];
    timestamp: string;
}

export const RatioMonitoringDashboard: React.FC = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState<string>(todayStr);
    const [data, setData] = useState<RatioDashboardSummary | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('ALL');
    const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
    const [selectedClassroom, setSelectedClassroom] = useState<ClassroomRatioData | null>(null);
    const [activeModalTab, setActiveModalTab] = useState<'children' | 'staff' | 'rule' | 'explanation'>('children');

    // Override Modal State
    const [isOverrideModalOpen, setIsOverrideModalOpen] = useState<boolean>(false);
    const [overrideRoom, setOverrideRoom] = useState<ClassroomRatioData | null>(null);
    const [overrideStatus, setOverrideStatus] = useState<'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT' | 'EXEMPT'>('COMPLIANT');
    const [overrideReason, setOverrideReason] = useState<string>('');
    const [overrideExpiresAt, setOverrideExpiresAt] = useState<string>('');
    const [overrideSubmitting, setOverrideSubmitting] = useState<boolean>(false);

    const fetchRatioData = useCallback(async (isSilent = false) => {
        if (!isSilent) setRefreshing(true);
        setError(null);
        try {
            const res = await api.get<RatioDashboardSummary>('/daycare/ratio-monitoring/', {
                params: { date: selectedDate }
            });
            setData(res.data);
            if (selectedClassroom) {
                const updatedSelected = res.data.classrooms.find(c => c.classroom_id === selectedClassroom.classroom_id);
                if (updatedSelected) setSelectedClassroom(updatedSelected);
            }
        } catch (err: any) {
            console.error('Failed to fetch ratio monitoring data:', err);
            setError(err.response?.data?.error || 'Unable to load live ratio metrics.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedDate, selectedClassroom]);

    useEffect(() => {
        setLoading(true);
        fetchRatioData();
    }, [selectedDate]);

    // Auto-refresh timer every 15 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => {
            fetchRatioData(true);
        }, 15000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchRatioData]);

    // Record Live Snapshot
    const handleTakeSnapshot = async () => {
        setRefreshing(true);
        setError(null);
        try {
            await api.post('/daycare/ratio-monitoring/log-snapshot/', {});
            setSuccessMessage('Live ratio compliance snapshot successfully captured for all classrooms.');
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err: any) {
            console.error('Failed to log snapshot:', err);
            setError('Failed to record compliance snapshot.');
        } finally {
            setRefreshing(false);
        }
    };

    // Open Override Modal
    const handleOpenOverride = (room: ClassroomRatioData) => {
        setOverrideRoom(room);
        setOverrideStatus('COMPLIANT');
        setOverrideReason('');
        setOverrideExpiresAt('');
        setIsOverrideModalOpen(true);
    };

    // Submit Manual Override
    const handleSubmitOverride = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!overrideRoom) return;
        if (!overrideReason.trim()) {
            setError('A valid justification/reason is required for manual override.');
            return;
        }

        setOverrideSubmitting(true);
        setError(null);
        try {
            const payload: any = {
                classroom: overrideRoom.classroom_id,
                override_status: overrideStatus,
                reason: overrideReason.trim(),
            };
            if (overrideExpiresAt) {
                payload.expires_at = new Date(overrideExpiresAt).toISOString();
            }

            await api.post('/daycare/ratio-monitoring/overrides/', payload);
            setSuccessMessage(`Manual override applied to ${overrideRoom.classroom_name}.`);
            setIsOverrideModalOpen(false);
            setTimeout(() => setSuccessMessage(null), 4000);
            await fetchRatioData();
        } catch (err: any) {
            console.error('Failed to create manual override:', err);
            setError(err.response?.data?.detail || 'Failed to apply manual override.');
        } finally {
            setOverrideSubmitting(false);
        }
    };

    // Revoke Override
    const handleRevokeOverride = async (overrideId: string) => {
        if (!window.confirm('Are you sure you want to revoke this manual override? Ratio status will revert to calculated value.')) {
            return;
        }
        try {
            await api.patch(`/daycare/ratio-monitoring/overrides/${overrideId}/`, { is_active: false });
            setSuccessMessage('Manual override revoked successfully.');
            setTimeout(() => setSuccessMessage(null), 4000);
            await fetchRatioData();
        } catch (err) {
            console.error('Failed to revoke override:', err);
            setError('Failed to revoke override.');
        }
    };

    // Distinct Age Groups
    const ageGroups = useMemo(() => {
        if (!data?.classrooms) return [];
        const groups = new Set<string>();
        data.classrooms.forEach(c => {
            if (c.age_group) groups.add(c.age_group);
        });
        return Array.from(groups);
    }, [data]);

    // Filtered Classrooms
    const filteredClassrooms = useMemo(() => {
        if (!data?.classrooms) return [];
        return data.classrooms.filter(room => {
            const matchesSearch = room.classroom_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                room.room_code.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesAge = selectedAgeGroup === 'ALL' || room.age_group === selectedAgeGroup;
            let matchesStatus = true;
            if (selectedStatus === 'COMPLIANT') matchesStatus = room.status === 'COMPLIANT' || room.status === 'EXEMPT';
            else if (selectedStatus === 'WARNING') matchesStatus = room.status === 'WARNING';
            else if (selectedStatus === 'NON_COMPLIANT') matchesStatus = room.status === 'NON_COMPLIANT';
            else if (selectedStatus === 'OVERRIDDEN') matchesStatus = room.override_applied;

            return matchesSearch && matchesAge && matchesStatus;
        });
    }, [data, searchQuery, selectedAgeGroup, selectedStatus]);

    return (
        <Layout>
            <div className="space-y-6 pb-16 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Live Classroom Ratio Monitoring
                        </h1>
                        <p className="text-sm font-medium text-gray-500 max-w-2xl mt-1">
                            Real-time child-to-educator ratio compliance, actual attendance sync, ECE credential verification, and provincial policy evaluations.
                        </p>
                    </div>

                        {/* Top Action Bar */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <Link
                                to="/daycare/ratio-monitoring/reports"
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold text-xs transition-colors shadow-xs"
                            >
                                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                                <span>Ratio Reports</span>
                            </Link>

                            <Link
                                to="/daycare/ratio-monitoring/history"
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                            >
                                <Clock className="w-4 h-4 text-slate-500" />
                                <span>History & Audits</span>
                            </Link>

                            <Link
                                to="/daycare/ratio-rules"
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                            >
                                <BookOpen className="w-4 h-4 text-slate-500" />
                                <span>Ratio Rules</span>
                            </Link>

                            <button
                                onClick={handleTakeSnapshot}
                                disabled={refreshing}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors disabled:opacity-50"
                                title="Record live snapshot to immutable history"
                            >
                                <Camera className="w-4 h-4 text-emerald-600" />
                                <span>Snapshot</span>
                            </button>

                            <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-2xl border border-slate-200/80">
                                <Calendar className="w-4 h-4 text-slate-500" />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                                />
                            </div>

                            <button
                                onClick={() => setAutoRefresh(!autoRefresh)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all ${
                                    autoRefresh 
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs' 
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200/80'
                                }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                <span>Auto-sync {autoRefresh ? 'ON' : 'OFF'}</span>
                            </button>

                            <button
                                onClick={() => fetchRatioData()}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white font-bold text-xs shadow-md shadow-emerald-900/15 hover:shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Disclaimer Banner */}
                    <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[11.5px] text-amber-900 font-medium leading-relaxed">
                            <span className="font-bold">Operational Disclaimer:</span> Ratio rules, provincial guidelines, and calculations shown are configurable operational policies maintained by authorized administrators for compliance and quality management.
                        </p>
                    </div>

                {/* Notifications */}
                <AnimatePresence>
                    {successMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-semibold"
                        >
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{successMessage}</span>
                        </motion.div>
                    )}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-semibold"
                        >
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{error}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* KPI Summary Cards */}
                {data && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
                            {/* 1. Total Classrooms */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
                                <span className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">Total Rooms</span>
                                <div className="text-2xl font-black text-slate-900">{data.total_classrooms}</div>
                                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Active Classrooms</p>
                            </div>

                            {/* 2. Compliant */}
                            <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs relative overflow-hidden">
                                <span className="text-[10.5px] font-black text-emerald-800 uppercase tracking-wider block mb-1">Compliant</span>
                                <div className="text-2xl font-black text-emerald-700">{data.compliant_classrooms_count}</div>
                                <p className="text-[10px] font-bold text-emerald-600 mt-0.5">Meeting Ratios</p>
                            </div>

                            {/* 3. Warning */}
                            <div className="bg-white p-4 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-xs relative overflow-hidden">
                                <span className="text-[10.5px] font-black text-amber-800 uppercase tracking-wider block mb-1">Warning</span>
                                <div className="text-2xl font-black text-amber-700">{data.warning_classrooms_count}</div>
                                <p className="text-[10px] font-bold text-amber-600 mt-0.5">Near Capacity</p>
                            </div>

                            {/* 4. Non-Compliant */}
                            <div className="bg-white p-4 rounded-2xl border border-rose-200/80 bg-rose-50/20 shadow-xs relative overflow-hidden">
                                <span className="text-[10.5px] font-black text-rose-800 uppercase tracking-wider block mb-1">Non-Compliant</span>
                                <div className="text-2xl font-black text-rose-700">{data.non_compliant_classrooms_count}</div>
                                <p className="text-[10px] font-bold text-rose-600 mt-0.5">Ratio Violation</p>
                            </div>

                            {/* 5. Staff Required */}
                            <div className="bg-white p-4 rounded-2xl border border-blue-200/80 bg-blue-50/20 shadow-xs relative overflow-hidden">
                                <span className="text-[10.5px] font-black text-blue-800 uppercase tracking-wider block mb-1">Staff Required</span>
                                <div className="text-2xl font-black text-blue-700">{data.total_required_staff}</div>
                                <p className="text-[10px] font-bold text-blue-600 mt-0.5">
                                    {Math.max(0, data.total_required_staff - data.total_qualified_staff_present)} Staff Deficit
                                </p>
                            </div>

                            {/* 6. Children Present */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
                                <span className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">Children Present</span>
                                <div className="text-2xl font-black text-slate-900">{data.total_children_present}</div>
                                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Checked In</p>
                            </div>

                            {/* 7. Qualified Staff Present */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
                                <span className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">Qualified Staff</span>
                                <div className="text-2xl font-black text-slate-900">{data.total_qualified_staff_present}</div>
                                <p className="text-[10px] font-bold text-emerald-700 mt-0.5">On Duty & Verified</p>
                            </div>
                        </div>

                        {/* Critical Classrooms Alert Banner */}
                        {data.non_compliant_classrooms_count > 0 && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-4 rounded-2xl bg-rose-500 text-white shadow-md shadow-rose-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                        <ShieldAlert className="w-6 h-6 text-white animate-pulse" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-extrabold text-sm">CRITICAL RATIO VIOLATION ALERT</h3>
                                            <span className="px-2 py-0.5 rounded-full bg-white text-rose-900 text-[10px] font-black uppercase">
                                                Action Required
                                            </span>
                                        </div>
                                        <p className="text-xs text-rose-100 font-medium mt-0.5">
                                            {data.non_compliant_classrooms_count} classroom(s) require immediate staffing attention.
                                            {data.classrooms.filter(c => c.status === 'NON_COMPLIANT').map(c => ` ${c.classroom_name} (Short by ${Math.max(1, c.required_staff - c.qualified_staff_present)})`).join(', ')}.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Link
                                        to="/daycare/scheduling"
                                        className="px-3.5 py-1.5 bg-white text-rose-700 hover:bg-rose-50 rounded-xl font-bold text-xs transition-colors shadow-xs"
                                    >
                                        Staff Scheduling
                                    </Link>
                                    <Link
                                        to="/daycare/ratio-monitoring/reports"
                                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 border border-rose-400 text-white rounded-xl font-bold text-xs transition-colors"
                                    >
                                        View Shortage Report
                                    </Link>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}

                {/* Filter & Search Bar */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:w-80">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search classroom name or code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        {/* Status Filter Chips */}
                        {[
                            { key: 'ALL', label: 'All' },
                            { key: 'COMPLIANT', label: 'Compliant' },
                            { key: 'WARNING', label: 'Warning' },
                            { key: 'NON_COMPLIANT', label: 'Alert' },
                            { key: 'OVERRIDDEN', label: 'Overridden' }
                        ].map(st => (
                            <button
                                key={st.key}
                                onClick={() => setSelectedStatus(st.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    selectedStatus === st.key
                                        ? 'bg-slate-900 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                                }`}
                            >
                                {st.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Classroom Cards Grid */}
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-emerald-600" />
                        <p className="text-xs font-semibold">Calculating live classroom ratios...</p>
                    </div>
                ) : filteredClassrooms.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center">
                        <Scale className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-slate-700">No classroom ratio records found.</h3>
                        <p className="text-xs text-slate-400 mt-1">Try changing search filters or selecting another date.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredClassrooms.map((room) => {
                            const isCompliant = room.status === 'COMPLIANT' || room.status === 'EXEMPT';
                            const isWarning = room.status === 'WARNING';
                            const isNonCompliant = room.status === 'NON_COMPLIANT';

                            return (
                                <motion.div
                                    key={room.classroom_id}
                                    layout
                                    className={`bg-white rounded-3xl border transition-all duration-200 shadow-xs hover:shadow-md relative overflow-hidden flex flex-col justify-between ${
                                        isCompliant 
                                            ? 'border-emerald-200 hover:border-emerald-300' 
                                            : isWarning 
                                                ? 'border-amber-200 hover:border-amber-300' 
                                                : 'border-rose-200 hover:border-rose-300 ring-1 ring-rose-300/40'
                                    }`}
                                >
                                    {/* Top Status Bar */}
                                    <div className={`h-1.5 w-full ${
                                        isCompliant 
                                            ? 'bg-emerald-500' 
                                            : isWarning 
                                                ? 'bg-amber-500' 
                                                : 'bg-rose-500'
                                    }`} />

                                    <div className="p-5 space-y-4">
                                        {/* Room Header */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-base font-black text-slate-900 tracking-tight">
                                                        {room.classroom_name}
                                                    </h3>
                                                    {room.room_code && (
                                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-[10px] text-slate-500 uppercase">
                                                            {room.room_code}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-semibold text-slate-400 mt-0.5">
                                                    {room.age_group} • {room.rule.name}
                                                </p>
                                            </div>

                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-black border uppercase tracking-wider ${
                                                    isCompliant 
                                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                                                        : isWarning 
                                                            ? 'bg-amber-100 text-amber-800 border-amber-200' 
                                                            : 'bg-rose-100 text-rose-800 border-rose-200'
                                                }`}>
                                                    {room.status}
                                                </span>
                                                {room.override_applied && (
                                                    <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-black text-[9px] border border-purple-200 uppercase">
                                                        Overridden
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Override Alert Banner if applied */}
                                        {room.override_applied && room.override && (
                                            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-[11px] text-purple-950 font-medium">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold">Override: {room.override.override_status}</span>
                                                    <span className="text-[10px] text-purple-700 font-semibold">
                                                        Calc: {room.calculated_status}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-purple-800 truncate mt-0.5">{room.override.reason}</p>
                                            </div>
                                        )}

                                        {/* Ratio Comparison Metric Box */}
                                        <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 grid grid-cols-2 gap-3">
                                            <div>
                                                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                                                    Live Ratio (Child : ECE)
                                                </span>
                                                <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">
                                                    {room.ratio}
                                                </div>
                                                <span className="text-[10px] font-semibold text-slate-500">
                                                    Max Allowable 1:{room.rule.max_children_per_staff}
                                                </span>
                                            </div>

                                            <div className="text-right">
                                                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                                                    Staff on Duty
                                                </span>
                                                <div className="text-xl font-black text-slate-900 mt-0.5">
                                                    <span className={room.qualified_staff_present < room.required_staff ? 'text-rose-600' : 'text-emerald-700'}>
                                                        {room.qualified_staff_present}
                                                    </span>
                                                    <span className="text-slate-400 text-xs font-normal"> / {room.required_staff} req</span>
                                                </div>
                                                <span className="text-[10px] font-semibold text-slate-500">
                                                    {room.children_present} children present
                                                </span>
                                            </div>
                                        </div>

                                        {/* Occupancy Bar */}
                                        <div>
                                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                                                <span>Room Occupancy</span>
                                                <span>{room.children_present} / {room.capacity || '—'} Seats</span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                        isCompliant ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500'
                                                    }`}
                                                    style={{ width: `${Math.min(100, ((room.children_present / (room.capacity || 15)) * 100))}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Footer Actions */}
                                    <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                                        <button
                                            onClick={() => handleOpenOverride(room)}
                                            className="text-xs font-bold text-slate-600 hover:text-purple-700 transition-colors"
                                        >
                                            {room.override_applied ? 'Edit Override' : 'Override'}
                                        </button>

                                        <button
                                            onClick={() => {
                                                setSelectedClassroom(room);
                                                setActiveModalTab('children');
                                            }}
                                            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 hover:text-emerald-800 transition-colors"
                                        >
                                            <span>View Details & Roster</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {/* Classroom Inspection Modal */}
                <AnimatePresence>
                    {selectedClassroom && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white w-full max-w-2xl rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
                            >
                                {/* Modal Header */}
                                <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-black text-slate-900">
                                                {selectedClassroom.classroom_name}
                                            </h3>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                selectedClassroom.status === 'COMPLIANT' 
                                                    ? 'bg-emerald-100 text-emerald-800' 
                                                    : selectedClassroom.status === 'WARNING' 
                                                        ? 'bg-amber-100 text-amber-800' 
                                                        : 'bg-rose-100 text-rose-800'
                                            }`}>
                                                {selectedClassroom.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                            {selectedClassroom.age_group} • Ratio: {selectedClassroom.ratio} (Required Staff: {selectedClassroom.required_staff})
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => setSelectedClassroom(null)}
                                        className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Modal Tabs */}
                                <div className="flex items-center gap-6 px-6 border-b border-slate-200 text-xs font-bold">
                                    <button
                                        onClick={() => setActiveModalTab('children')}
                                        className={`py-3 border-b-2 flex items-center gap-2 transition-all ${
                                            activeModalTab === 'children'
                                                ? 'border-emerald-600 text-emerald-800'
                                                : 'border-transparent text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        <Baby className="w-4 h-4" />
                                        Present Children ({selectedClassroom.children.length})
                                    </button>
                                    <button
                                        onClick={() => setActiveModalTab('staff')}
                                        className={`py-3 border-b-2 flex items-center gap-2 transition-all ${
                                            activeModalTab === 'staff'
                                                ? 'border-emerald-600 text-emerald-800'
                                                : 'border-transparent text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        <UserCheck className="w-4 h-4" />
                                        Educators On-Duty ({selectedClassroom.staff.length})
                                    </button>
                                    <button
                                        onClick={() => setActiveModalTab('explanation')}
                                        className={`py-3 border-b-2 flex items-center gap-2 transition-all ${
                                            activeModalTab === 'explanation'
                                                ? 'border-emerald-600 text-emerald-800'
                                                : 'border-transparent text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        <BookOpen className="w-4 h-4" />
                                        Rule Explanation
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                                    {/* Active Override Info Banner */}
                                    {selectedClassroom.override_applied && selectedClassroom.override && (
                                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <ShieldAlert className="w-4 h-4 text-purple-700" />
                                                    <span className="font-extrabold text-purple-900 text-xs uppercase">
                                                        Manual Override Active ({selectedClassroom.override.override_status})
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleRevokeOverride(selectedClassroom.override!.id)}
                                                    className="px-2 py-1 rounded bg-purple-200 hover:bg-purple-300 text-purple-900 font-bold text-[10px]"
                                                >
                                                    Revoke Override
                                                </button>
                                            </div>
                                            <div className="text-xs text-purple-900 mt-2 space-y-0.5 font-medium">
                                                <p><span className="font-bold">Reason:</span> {selectedClassroom.override.reason}</p>
                                                <p><span className="font-bold">Authorized By:</span> {selectedClassroom.override.created_by}</p>
                                                {selectedClassroom.override.expires_at && (
                                                    <p><span className="font-bold">Expires:</span> {new Date(selectedClassroom.override.expires_at).toLocaleString()}</p>
                                                )}
                                                <p className="text-[11px] text-purple-700 font-semibold pt-1">
                                                    Calculated Status: {selectedClassroom.calculated_status}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {activeModalTab === 'children' && (
                                        <div className="space-y-3">
                                            {selectedClassroom.children.length === 0 ? (
                                                <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                                                    No children currently checked in for this classroom.
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                                                    {selectedClassroom.children.map((ch, idx) => (
                                                        <div key={ch.student_id} className="p-3 bg-white flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-[10px]">
                                                                    {idx + 1}
                                                                </span>
                                                                <div>
                                                                    <p className="font-extrabold text-slate-900">{ch.name}</p>
                                                                    <p className="text-[11px] text-slate-500 font-medium">
                                                                        {ch.admission_number ? `Adm #${ch.admission_number}` : 'Student'} {ch.age_months ? `• ${ch.age_months} mos` : ''}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                                                                    <Clock className="w-3 h-3 text-emerald-600" />
                                                                    In at {ch.check_in_time || 'Present'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeModalTab === 'staff' && (
                                        <div className="space-y-3">
                                            {selectedClassroom.staff.length === 0 ? (
                                                <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                                                    No educators currently clocked in for this classroom.
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                                                    {selectedClassroom.staff.map((st) => (
                                                        <div key={st.employee_id} className="p-3 bg-white flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-extrabold text-slate-900">{st.name}</p>
                                                                    {st.is_qualified ? (
                                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                            Qualified ECE
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-300">
                                                                            Assistant / Aide
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[11px] text-slate-500 font-medium">
                                                                    {st.role} • Clock-in: {st.clock_in_time || 'Active'}
                                                                </p>
                                                                {st.credentials.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {st.credentials.map(c => (
                                                                            <span key={c} className="text-[9.5px] px-1.5 py-0.5 bg-teal-50 text-teal-800 rounded border border-teal-200 font-semibold">
                                                                                {c}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="text-right">
                                                                <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">
                                                                    <Clock className="w-3 h-3 text-slate-500" />
                                                                    {st.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeModalTab === 'explanation' && (
                                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-xs space-y-4">
                                            <div className="border-b border-slate-200 pb-3">
                                                <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Applicable Policy</span>
                                                <h4 className="text-sm font-black text-slate-900 mt-0.5">
                                                    {selectedClassroom.rule_explanation?.applicable_rule || selectedClassroom.rule.name}
                                                </h4>
                                                <p className="text-[11px] text-slate-500 font-medium mt-1">
                                                    {selectedClassroom.rule_explanation?.explanation_text}
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 border-b border-slate-200 pb-3">
                                                <div>
                                                    <span className="font-bold text-slate-400">Jurisdiction / Province:</span>
                                                    <p className="font-bold text-slate-800">{selectedClassroom.rule_explanation?.province || 'General'}</p>
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-400">Program Assignment:</span>
                                                    <p className="font-bold text-slate-800">{selectedClassroom.rule_explanation?.program || 'All Programs'}</p>
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-400">Age Group:</span>
                                                    <p className="font-bold text-slate-800">{selectedClassroom.rule_explanation?.age_group || selectedClassroom.age_group}</p>
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-400">Effective Date:</span>
                                                    <p className="font-bold text-slate-800">{selectedClassroom.rule_explanation?.effective_date || '2026-01-01'}</p>
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-400">Required Staff:</span>
                                                    <p className="font-extrabold text-emerald-800">{selectedClassroom.required_staff} Educator(s)</p>
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-400">Qualification Requirement:</span>
                                                    <p className="font-bold text-slate-800">{selectedClassroom.rule_explanation?.qualification_requirement || 'Certified ECE'}</p>
                                                </div>
                                            </div>

                                            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-medium">
                                                {selectedClassroom.rule_explanation?.disclaimer || 'Configurable policy maintained by authorized administrators.'}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer */}
                                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                                    <button
                                        onClick={() => {
                                            const room = selectedClassroom;
                                            setSelectedClassroom(null);
                                            handleOpenOverride(room);
                                        }}
                                        className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-100 text-purple-900 hover:bg-purple-200 transition-colors"
                                    >
                                        Apply Manual Override
                                    </button>

                                    <button
                                        onClick={() => setSelectedClassroom(null)}
                                        className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
                                    >
                                        Close
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Apply Manual Override Modal */}
                <AnimatePresence>
                    {isOverrideModalOpen && overrideRoom && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-200 overflow-hidden"
                            >
                                <form onSubmit={handleSubmitOverride}>
                                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-purple-600 text-white rounded-xl">
                                                <ShieldAlert className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-black text-slate-900">
                                                    Manual Ratio Override
                                                </h3>
                                                <p className="text-xs text-slate-400 font-semibold">{overrideRoom.classroom_name}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsOverrideModalOpen(false)}
                                            className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                                        >
                                            <XCircle className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="p-6 space-y-4">
                                        <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-600 font-medium">
                                            <p><span className="font-bold">Calculated Status:</span> {overrideRoom.calculated_status}</p>
                                            <p><span className="font-bold">Children : Staff:</span> {overrideRoom.children_present} : {overrideRoom.qualified_staff_present}</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Override Compliance Status</label>
                                            <select
                                                value={overrideStatus}
                                                onChange={(e: any) => setOverrideStatus(e.target.value)}
                                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                                            >
                                                <option value="COMPLIANT">COMPLIANT (Compliant)</option>
                                                <option value="EXEMPT">EXEMPT (Temporary Exemption)</option>
                                                <option value="WARNING">WARNING (Warning)</option>
                                                <option value="NON_COMPLIANT">NON_COMPLIANT (Non-Compliant)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                Mandatory Justification / Reason *
                                            </label>
                                            <textarea
                                                required
                                                rows={3}
                                                value={overrideReason}
                                                onChange={e => setOverrideReason(e.target.value)}
                                                placeholder="State the administrative reason or permit number for this override..."
                                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                Expiry Date & Time (Optional)
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={overrideExpiresAt}
                                                onChange={e => setOverrideExpiresAt(e.target.value)}
                                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1">If blank, override remains active until manually revoked.</p>
                                        </div>
                                    </div>

                                    <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsOverrideModalOpen(false)}
                                            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={overrideSubmitting}
                                            className="px-5 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 transition-colors disabled:opacity-50"
                                        >
                                            {overrideSubmitting ? 'Applying...' : 'Apply Override'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </Layout>
    );
};

export default RatioMonitoringDashboard;
