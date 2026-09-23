import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck, AlertTriangle, Clock, UserCheck, Users,
    Calendar, ArrowRight, RefreshCw, Search, Filter,
    CheckCircle2, XCircle, AlertOctagon, UserX, ChevronRight,
    Sparkles, DoorOpen, LogIn, LogOut, Eye, ShieldAlert, FileText
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';

interface DashboardSummary {
    children_expected: number;
    children_checked_in: number;
    children_not_arrived: number;
    children_currently_present: number;
    children_checked_out: number;
    late_pickups: number;
    unauthorized_attempts: number;
    failed_verifications?: number;
}

interface RosterChild {
    child_id: string;
    name: string;
    first_name: string;
    last_name: string;
    admission_number: string;
    photo: string | null;
    classroom_name: string | null;
    status: string; // 'PRESENT' | 'CHECKED_OUT' | 'NOT_ARRIVED' | 'ABSENT'
    check_in_time: string | null;
    check_out_time: string | null;
    expected_pickup_time: string | null;
    is_late_pickup: boolean;
    late_duration_minutes: number;
    pickup_person_name: string | null;
    verification_method: string | null;
    staff_handler: string | null;
}

interface ExceptionEvent {
    id: string;
    date: string;
    time: string;
    iso_timestamp: string;
    category: string; // 'UNAUTHORIZED_ATTEMPT' | 'LATE_PICKUP' | 'FAILED_VERIFICATION'
    event_type: string;
    verification_method: string;
    verification_status: string;
    child: {
        id: string;
        name: string;
        admission_number: string;
    };
    collector_name: string | null;
    is_late_pickup: boolean;
    expected_pickup_time: string | null;
    actual_checkout_time: string | null;
    late_duration_minutes: number;
    failure_reason: string | null;
    processed_by_name: string;
    notes: string | null;
}

interface RecentEvent {
    id: string;
    child_id: string;
    child_name: string;
    event_type: string;
    verification_method: string;
    verification_status: string;
    timestamp: string;
    time: string;
    is_late_pickup: boolean;
    late_duration_minutes: number;
    pickup_person_name: string | null;
    processed_by_name: string | null;
    failure_reason: string | null;
}

const SafeArrivalDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [activeTab, setActiveTab] = useState<'roster' | 'exceptions' | 'feed'>('roster');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [exceptionTypeFilter, setExceptionTypeFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [summary, setSummary] = useState<DashboardSummary>({
        children_expected: 0,
        children_checked_in: 0,
        children_not_arrived: 0,
        children_currently_present: 0,
        children_checked_out: 0,
        late_pickups: 0,
        unauthorized_attempts: 0
    });
    const [roster, setRoster] = useState<RosterChild[]>([]);
    const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
    const [exceptions, setExceptions] = useState<ExceptionEvent[]>([]);

    const fetchDashboardData = async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const [dashRes, excRes] = await Promise.all([
                api.get(`/daycare/safe-arrival/dashboard/?date=${selectedDate}`),
                api.get(`/daycare/pickups/exceptions/?date=${selectedDate}&type=${exceptionTypeFilter}`)
            ]);

            setSummary(dashRes.data.summary);
            setRoster(dashRes.data.roster || []);
            setRecentEvents(dashRes.data.recent_events || []);
            setExceptions(excRes.data || []);
        } catch (error) {
            console.error("Failed to load safe arrival dashboard data", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [selectedDate, exceptionTypeFilter]);

    // Filter roster
    const filteredRoster = roster.filter(child => {
        const matchesSearch = 
            child.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            child.admission_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (child.classroom_name && child.classroom_name.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesSearch) return false;

        if (statusFilter === 'ALL') return true;
        if (statusFilter === 'PRESENT') return child.status === 'PRESENT';
        if (statusFilter === 'CHECKED_OUT') return child.status === 'CHECKED_OUT';
        if (statusFilter === 'NOT_ARRIVED') return child.status === 'NOT_ARRIVED';
        if (statusFilter === 'LATE') return child.is_late_pickup;
        return true;
    });

    const formatTime = (timeStr: string | null) => {
        if (!timeStr) return '--:--';
        try {
            const parts = timeStr.split(':');
            let hours = parseInt(parts[0], 10);
            const minutes = parts[1];
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            return `${hours}:${minutes} ${ampm}`;
        } catch {
            return timeStr;
        }
    };

    return (
        <Layout>
            <div className="space-y-6 max-w-7xl mx-auto pb-12">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Daily Safe Arrival Dashboard
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Real-time child attendance tracking, scheduled pickup monitoring, late departure management, and security exception controls.
                        </p>
                    </div>

                    {/* Controls & Quick Launcher */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                            />
                        </div>

                        <button
                            onClick={() => fetchDashboardData(true)}
                            disabled={refreshing}
                            className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 transition-all shadow-xs"
                            title="Refresh Live Data"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
                        </button>

                        <Link
                            to="/daycare/safe-arrival/reports"
                            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-200 transition-all shadow-xs"
                        >
                            <FileText className="w-4 h-4 text-slate-500" />
                            <span>Reports & Audits</span>
                        </Link>

                        <Link
                            to="/daycare/pickup-verification"
                            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all"
                        >
                            <DoorOpen className="w-4 h-4" />
                            <span>Arrival & Departure Station</span>
                        </Link>
                    </div>
                </div>

                {/* KPI Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
                    
                    {/* Expected */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider">Expected</span>
                            <Users className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="text-2xl font-black text-slate-900">{summary.children_expected}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Enrolled for today</div>
                    </div>

                    {/* Checked In */}
                    <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between text-emerald-700 mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider">Checked In</span>
                            <LogIn className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="text-2xl font-black text-emerald-600">{summary.children_checked_in}</div>
                        <div className="text-[11px] text-emerald-700/80 mt-0.5">Total arrived</div>
                    </div>

                    {/* Not Arrived */}
                    <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between text-amber-700 mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider">Not Arrived</span>
                            <Clock className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="text-2xl font-black text-amber-600">{summary.children_not_arrived}</div>
                        <div className="text-[11px] text-amber-700/80 mt-0.5">Awaiting arrival</div>
                    </div>

                    {/* Currently Present */}
                    <div className="bg-white rounded-2xl p-4 border border-teal-100 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between text-teal-700 mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider">In Center</span>
                            <UserCheck className="w-4 h-4 text-teal-500" />
                        </div>
                        <div className="text-2xl font-black text-teal-700">{summary.children_currently_present}</div>
                        <div className="text-[11px] text-teal-700/80 mt-0.5">Present right now</div>
                    </div>

                    {/* Checked Out */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between text-slate-600 mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider">Departed</span>
                            <LogOut className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="text-2xl font-black text-slate-700">{summary.children_checked_out}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Checked out</div>
                    </div>

                    {/* Late Pickups */}
                    <div className="bg-white rounded-2xl p-4 border border-orange-200 bg-orange-50/20 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between text-orange-700 mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider">Late Pickups</span>
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                        </div>
                        <div className="text-2xl font-black text-orange-600">{summary.late_pickups}</div>
                        <div className="text-[11px] text-orange-700/80 mt-0.5">Past scheduled time</div>
                    </div>

                    {/* Unauthorized Attempts */}
                    <div className="bg-white rounded-2xl p-4 border border-rose-200 bg-rose-50/20 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between text-rose-700 mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider">Exceptions</span>
                            <ShieldAlert className="w-4 h-4 text-rose-500" />
                        </div>
                        <div className="text-2xl font-black text-rose-600">{summary.unauthorized_attempts}</div>
                        <div className="text-[11px] text-rose-700/80 mt-0.5">Unauthorized attempts</div>
                    </div>

                </div>

                {/* Main Content Tabs */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                    
                    {/* Tab Navigation Header */}
                    <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        
                        <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-2xl w-fit">
                            <button
                                onClick={() => setActiveTab('roster')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    activeTab === 'roster'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Live Child Roster ({roster.length})
                            </button>

                            <button
                                onClick={() => setActiveTab('exceptions')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    activeTab === 'exceptions'
                                        ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/20'
                                        : 'text-slate-600 hover:text-rose-700'
                                }`}
                            >
                                <span>Exception Station</span>
                                {summary.unauthorized_attempts + summary.late_pickups > 0 && (
                                    <span className={`px-1.5 py-0.2 text-[10px] font-black rounded-full ${
                                        activeTab === 'exceptions' ? 'bg-white text-rose-600' : 'bg-rose-100 text-rose-700'
                                    }`}>
                                        {summary.unauthorized_attempts + summary.late_pickups}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => setActiveTab('feed')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    activeTab === 'feed'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Activity Feed ({recentEvents.length})
                            </button>
                        </div>

                        {/* Search and Filters for Roster */}
                        {activeTab === 'roster' && (
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative min-w-[200px]">
                                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search children, room..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-xl">
                                    {[
                                        { id: 'ALL', label: 'All' },
                                        { id: 'PRESENT', label: 'In Center' },
                                        { id: 'CHECKED_OUT', label: 'Departed' },
                                        { id: 'NOT_ARRIVED', label: 'Not Arrived' },
                                        { id: 'LATE', label: 'Late Pickups' },
                                    ].map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => setStatusFilter(f.id)}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                                statusFilter === f.id
                                                    ? 'bg-emerald-700 text-white shadow-xs'
                                                    : 'text-slate-600 hover:bg-slate-200/60'
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Exception Sub-filter */}
                        {activeTab === 'exceptions' && (
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-xl">
                                {[
                                    { id: 'all', label: 'All Exceptions' },
                                    { id: 'unauthorized', label: 'Unauthorized Attempts' },
                                    { id: 'late', label: 'Late Pickups' },
                                    { id: 'failed', label: 'Failed PIN/QR' },
                                ].map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => setExceptionTypeFilter(f.id)}
                                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                            exceptionTypeFilter === f.id
                                                ? 'bg-slate-900 text-white shadow-xs'
                                                : 'text-slate-600 hover:bg-slate-200/60'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tab 1: Live Child Roster Table */}
                    {activeTab === 'roster' && (
                        <div className="overflow-x-auto">
                            {loading ? (
                                <div className="py-20 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto" />
                                    <p className="text-xs text-slate-500 font-bold mt-3">Loading live roster...</p>
                                </div>
                            ) : filteredRoster.length === 0 ? (
                                <div className="py-16 text-center text-slate-500">
                                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No children match the current filter.</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Try clearing your search query or selecting a different status filter.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                                            <th className="py-3 px-5">Child</th>
                                            <th className="py-3 px-4">Classroom</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4">Check-In</th>
                                            <th className="py-3 px-4">Expected Pickup</th>
                                            <th className="py-3 px-4">Actual Departure</th>
                                            <th className="py-3 px-4">Pickup Person</th>
                                            <th className="py-3 px-4">Staff Handler</th>
                                            <th className="py-3 px-5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs">
                                        {filteredRoster.map((c) => (
                                            <tr key={c.child_id} className="hover:bg-slate-50/60 transition-colors group">
                                                
                                                {/* Child Name & Photo */}
                                                <td className="py-3.5 px-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0 border border-emerald-200">
                                                            {c.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                                                                {c.name}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 font-mono">
                                                                #{c.admission_number || 'KID'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Classroom */}
                                                <td className="py-3.5 px-4 font-medium text-slate-600">
                                                    {c.classroom_name || <span className="text-slate-300 italic">Unassigned</span>}
                                                </td>

                                                {/* Status Pill */}
                                                <td className="py-3.5 px-4">
                                                    {c.status === 'PRESENT' && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            In Center
                                                        </span>
                                                    )}
                                                    {c.status === 'CHECKED_OUT' && (
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                                            c.is_late_pickup 
                                                                ? 'bg-orange-100 text-orange-800 border border-orange-200' 
                                                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                                                        }`}>
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            {c.is_late_pickup ? 'Departed (Late)' : 'Departed'}
                                                        </span>
                                                    )}
                                                    {c.status === 'NOT_ARRIVED' && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                            <Clock className="w-3 h-3" />
                                                            Not Arrived
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Check In */}
                                                <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                                                    {formatTime(c.check_in_time)}
                                                </td>

                                                {/* Expected Pickup */}
                                                <td className="py-3.5 px-4 font-mono text-slate-600">
                                                    {formatTime(c.expected_pickup_time)}
                                                </td>

                                                {/* Actual Departure */}
                                                <td className="py-3.5 px-4">
                                                    <div className="font-mono font-medium text-slate-800">
                                                        {formatTime(c.check_out_time)}
                                                    </div>
                                                    {c.is_late_pickup && c.late_duration_minutes > 0 && (
                                                        <span className="inline-block text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.2 rounded mt-0.5">
                                                            +{c.late_duration_minutes}m Late
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Pickup Person */}
                                                <td className="py-3.5 px-4 text-slate-700 font-medium">
                                                    {c.pickup_person_name || <span className="text-slate-300">—</span>}
                                                    {c.verification_method && (
                                                        <div className="text-[10px] text-slate-400">
                                                            via {c.verification_method}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Staff Handler */}
                                                <td className="py-3.5 px-4 text-slate-600">
                                                    {c.staff_handler || <span className="text-slate-300">—</span>}
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3.5 px-5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link
                                                            to={`/daycare/children/${c.child_id}/pickup-history`}
                                                            className="p-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 rounded-lg transition-colors"
                                                            title="View Pickup History"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </Link>
                                                        {c.status === 'PRESENT' && (
                                                            <Link
                                                                to={`/daycare/pickup-verification?child_id=${c.child_id}`}
                                                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors"
                                                            >
                                                                Checkout
                                                            </Link>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* Tab 2: Exception Management Station */}
                    {activeTab === 'exceptions' && (
                        <div className="p-6 space-y-4">
                            
                            {/* Security Ledger Notice */}
                            <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-start gap-3 border border-slate-800 shadow-md">
                                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                <div className="text-xs">
                                    <p className="font-bold text-slate-100">Immutable Security & Audit Ledger</p>
                                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                                        Unauthorized attempts, failed verifications, and late pickups are recorded immutably. Normal staff cannot silently modify or delete exception events.
                                    </p>
                                </div>
                            </div>

                            {loading ? (
                                <div className="py-16 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600 mx-auto" />
                                    <p className="text-xs text-slate-500 font-bold mt-3">Loading security exceptions...</p>
                                </div>
                            ) : exceptions.length === 0 ? (
                                <div className="py-16 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-2xl">
                                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                                    <p className="text-sm font-bold text-slate-800">Zero Security Exceptions for this Date</p>
                                    <p className="text-xs text-slate-400 mt-0.5">All arrival and pickup events were authorized and on-schedule.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {exceptions.map((exc) => (
                                        <div
                                            key={exc.id}
                                            className={`p-5 rounded-2xl border transition-all ${
                                                exc.category === 'UNAUTHORIZED_ATTEMPT'
                                                    ? 'bg-rose-50/40 border-rose-200 shadow-sm shadow-rose-500/5'
                                                    : exc.category === 'LATE_PICKUP'
                                                    ? 'bg-orange-50/40 border-orange-200 shadow-sm shadow-orange-500/5'
                                                    : 'bg-slate-50 border-slate-200'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div className="flex items-center gap-2">
                                                    {exc.category === 'UNAUTHORIZED_ATTEMPT' ? (
                                                        <span className="p-1.5 bg-rose-100 text-rose-700 rounded-xl">
                                                            <UserX className="w-4 h-4" />
                                                        </span>
                                                    ) : (
                                                        <span className="p-1.5 bg-orange-100 text-orange-700 rounded-xl">
                                                            <AlertTriangle className="w-4 h-4" />
                                                        </span>
                                                    )}
                                                    <div>
                                                        <div className="text-xs font-black uppercase tracking-wider text-slate-900">
                                                            {exc.category.replace('_', ' ')}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 font-medium">
                                                            {exc.time} • via {exc.verification_method}
                                                        </div>
                                                    </div>
                                                </div>

                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                                    exc.verification_status === 'FAILED'
                                                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                                                        : 'bg-orange-100 text-orange-800 border-orange-300'
                                                }`}>
                                                    {exc.verification_status}
                                                </span>
                                            </div>

                                            <div className="space-y-2 text-xs">
                                                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                                                    <span className="text-slate-500">Child:</span>
                                                    <span className="font-bold text-slate-900">{exc.child.name}</span>
                                                </div>

                                                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                                                    <span className="text-slate-500">Collector Name:</span>
                                                    <span className="font-bold text-slate-800">
                                                        {exc.collector_name || <span className="text-slate-400 italic">Unknown</span>}
                                                    </span>
                                                </div>

                                                {exc.is_late_pickup && (
                                                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                                                        <span className="text-slate-500">Late Duration:</span>
                                                        <span className="font-bold text-orange-700">
                                                            {exc.late_duration_minutes} minutes late (Expected {formatTime(exc.expected_pickup_time)})
                                                        </span>
                                                    </div>
                                                )}

                                                {exc.failure_reason && (
                                                    <div className="p-2.5 bg-white rounded-xl border border-rose-100 text-rose-800 text-[11px] leading-relaxed">
                                                        <strong>Reason:</strong> {exc.failure_reason}
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                                                    <span>Handled by: <strong className="text-slate-600">{exc.processed_by_name}</strong></span>
                                                    <Link
                                                        to={`/daycare/children/${exc.child.id}/pickup-history`}
                                                        className="text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center gap-1"
                                                    >
                                                        History <ChevronRight className="w-3 h-3" />
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 3: Activity Feed */}
                    {activeTab === 'feed' && (
                        <div className="p-6">
                            {recentEvents.length === 0 ? (
                                <div className="py-16 text-center text-slate-400">
                                    <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No activity recorded for this date yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {recentEvents.map((ev) => (
                                        <div
                                            key={ev.id}
                                            className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white transition-all"
                                        >
                                            <div className={`p-2 rounded-xl shrink-0 ${
                                                ev.event_type === 'CHECK_IN'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : ev.is_late_pickup
                                                    ? 'bg-orange-100 text-orange-800'
                                                    : ev.verification_status === 'FAILED'
                                                    ? 'bg-rose-100 text-rose-800'
                                                    : 'bg-teal-100 text-teal-800'
                                            }`}>
                                                {ev.event_type === 'CHECK_IN' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="font-bold text-xs text-slate-900 truncate">
                                                        {ev.child_name || 'Child'}
                                                    </div>
                                                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                                                        {ev.time}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-600 mt-0.5">
                                                    {ev.event_type.replace('_', ' ')} via <span className="font-semibold">{ev.verification_method}</span>
                                                    {ev.pickup_person_name && ` by ${ev.pickup_person_name}`}
                                                    {ev.is_late_pickup && (
                                                        <span className="ml-2 text-orange-700 font-bold">
                                                            (Late +{ev.late_duration_minutes}m)
                                                        </span>
                                                    )}
                                                </div>
                                                {ev.failure_reason && (
                                                    <div className="text-[11px] text-rose-600 mt-1 font-medium">
                                                        Failed: {ev.failure_reason}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                </div>

            </div>
        </Layout>
    );
};

export default SafeArrivalDashboard;
