import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck, Clock, UserCheck, Users, Calendar, ArrowLeft,
    CheckCircle2, XCircle, AlertTriangle, AlertOctagon, UserX,
    QrCode, KeyRound, PenTool, FileText, ChevronRight, RefreshCw,
    Sparkles, ShieldAlert, LogIn, LogOut, Eye, Filter
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';

interface ChildSummary {
    id: string;
    name: string;
    admission_number: string;
    photo: string | null;
    status: string;
}

interface PickupPerson {
    id: string;
    name: string;
    relationship: string;
    phone: string | null;
}

interface HistoryItem {
    id: string;
    date: string;
    time: string;
    iso_timestamp: string;
    event_type: string; // 'CHECK_IN' | 'CHECK_OUT' | 'LATE_PICKUP' | 'UNAUTHORIZED_ATTEMPT' | 'VERIFICATION_FAILED'
    verification_method: string; // 'QR' | 'PIN' | 'DIGITAL_SIGNATURE' | 'MANUAL'
    verification_status: string; // 'SUCCESS' | 'FAILED'
    is_late_pickup: boolean;
    expected_pickup_time: string | null;
    actual_checkout_time: string | null;
    late_duration_minutes: number;
    pickup_person: PickupPerson | null;
    attempted_person_name: string | null;
    processed_by: {
        id: string | null;
        name: string;
    };
    failure_reason: string | null;
    has_signature: boolean;
    signature_data: string | null;
    notes: string | null;
}

const ChildPickupHistory: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [child, setChild] = useState<ChildSummary | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [filterType, setFilterType] = useState<string>('all');
    const [selectedSignature, setSelectedSignature] = useState<string | null>(null);

    const fetchHistory = async (isManual = false) => {
        if (!id) return;
        if (isManual) setRefreshing(true);
        else setLoading(true);

        try {
            const resp = await api.get(`/daycare/children/${id}/pickup-history/`);
            setChild(resp.data.child);
            setHistory(resp.data.history || []);
        } catch (error) {
            console.error("Failed to load child pickup history", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [id]);

    const filteredHistory = history.filter(item => {
        if (filterType === 'all') return true;
        if (filterType === 'checkin') return item.event_type === 'CHECK_IN';
        if (filterType === 'checkout') return item.event_type === 'CHECK_OUT' && !item.is_late_pickup;
        if (filterType === 'late') return item.is_late_pickup;
        if (filterType === 'exceptions') return item.verification_status === 'FAILED' || item.event_type === 'UNAUTHORIZED_ATTEMPT';
        return true;
    });

    const stats = {
        total: history.length,
        checkins: history.filter(h => h.event_type === 'CHECK_IN').length,
        checkouts: history.filter(h => h.event_type === 'CHECK_OUT').length,
        late: history.filter(h => h.is_late_pickup).length,
        exceptions: history.filter(h => h.verification_status === 'FAILED' || h.event_type === 'UNAUTHORIZED_ATTEMPT').length,
    };

    const getMethodIcon = (method: string) => {
        switch (method?.toUpperCase()) {
            case 'QR':
                return <QrCode className="w-3.5 h-3.5" />;
            case 'PIN':
                return <KeyRound className="w-3.5 h-3.5" />;
            case 'DIGITAL_SIGNATURE':
                return <PenTool className="w-3.5 h-3.5" />;
            default:
                return <UserCheck className="w-3.5 h-3.5" />;
        }
    };

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
            <div className="space-y-6 max-w-5xl mx-auto pb-12">
                
                {/* Back Button & Breadcrumb */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-emerald-700 transition-colors bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <Link
                            to={`/daycare/children/${id}`}
                            className="text-xs font-bold text-emerald-700 hover:underline"
                        >
                            View Child Profile
                        </Link>
                        <span className="text-slate-300">•</span>
                        <Link
                            to="/daycare/safe-arrival"
                            className="text-xs font-bold text-slate-600 hover:text-slate-900"
                        >
                            Daily Dashboard
                        </Link>
                    </div>
                </div>

                {/* Profile Header */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-lg flex items-center justify-center border border-emerald-200 shadow-xs shrink-0">
                                {child?.name ? child.name.charAt(0) : 'C'}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                                        {child?.name || 'Child'}
                                    </h1>
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                        {child?.status || 'Active'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    Admission #{child?.admission_number || 'N/A'} • Complete Safe Arrival & Departure History
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => fetchHistory(true)}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                            <span>Refresh Logs</span>
                        </button>
                    </div>

                    {/* Quick Metric Pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Total Events</span>
                            <div className="text-xl font-black text-slate-900">{stats.total}</div>
                        </div>

                        <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-100">
                            <span className="text-[10.5px] font-bold text-emerald-800 uppercase tracking-wider">Arrivals (Check-In)</span>
                            <div className="text-xl font-black text-emerald-700">{stats.checkins}</div>
                        </div>

                        <div className="bg-orange-50/60 p-3 rounded-2xl border border-orange-100">
                            <span className="text-[10.5px] font-bold text-orange-800 uppercase tracking-wider">Late Pickups</span>
                            <div className="text-xl font-black text-orange-700">{stats.late}</div>
                        </div>

                        <div className="bg-rose-50/60 p-3 rounded-2xl border border-rose-100">
                            <span className="text-[10.5px] font-bold text-rose-800 uppercase tracking-wider">Security Flags</span>
                            <div className="text-xl font-black text-rose-700">{stats.exceptions}</div>
                        </div>
                    </div>
                </div>

                {/* Filter Controls */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs">
                        {[
                            { id: 'all', label: 'All History' },
                            { id: 'checkin', label: 'Arrivals' },
                            { id: 'checkout', label: 'On-Time Pickups' },
                            { id: 'late', label: 'Late Pickups' },
                            { id: 'exceptions', label: 'Exceptions & Rejected' },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setFilterType(f.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    filterType === f.id
                                        ? 'bg-slate-900 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="text-xs font-semibold text-slate-400">
                        Showing {filteredHistory.length} of {history.length} records
                    </div>
                </div>

                {/* Timeline History */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
                    {loading ? (
                        <div className="py-20 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto" />
                            <p className="text-xs text-slate-500 font-bold mt-3">Loading history ledger...</p>
                        </div>
                    ) : filteredHistory.length === 0 ? (
                        <div className="py-16 text-center text-slate-400">
                            <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            <p className="text-sm font-bold text-slate-700">No events found for this filter.</p>
                        </div>
                    ) : (
                        <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-100 space-y-6">
                            {filteredHistory.map((item) => {
                                const isFailed = item.verification_status === 'FAILED' || item.event_type === 'UNAUTHORIZED_ATTEMPT';
                                const isLate = item.is_late_pickup;
                                const isCheckIn = item.event_type === 'CHECK_IN';

                                return (
                                    <div key={item.id} className="relative group">
                                        
                                        {/* Dot on Timeline */}
                                        <div className={`absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
                                            isFailed 
                                                ? 'bg-rose-500' 
                                                : isLate 
                                                ? 'bg-orange-500' 
                                                : isCheckIn 
                                                ? 'bg-emerald-500' 
                                                : 'bg-teal-500'
                                        }`} />

                                        <div className={`p-5 rounded-2xl border transition-all ${
                                            isFailed 
                                                ? 'bg-rose-50/40 border-rose-200' 
                                                : isLate 
                                                ? 'bg-orange-50/40 border-orange-200' 
                                                : 'bg-slate-50/60 border-slate-200/80 hover:bg-white'
                                        }`}>
                                            
                                            {/* Header */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                                                        isFailed
                                                            ? 'bg-rose-100 text-rose-800'
                                                            : isLate
                                                            ? 'bg-orange-100 text-orange-800'
                                                            : isCheckIn
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-teal-100 text-teal-800'
                                                    }`}>
                                                        {isCheckIn ? <LogIn className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
                                                        <span>{isLate ? 'LATE PICKUP' : item.event_type.replace('_', ' ')}</span>
                                                    </span>

                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 shadow-xs">
                                                        {getMethodIcon(item.verification_method)}
                                                        <span>{item.verification_method}</span>
                                                    </span>
                                                </div>

                                                <div className="text-xs font-mono font-bold text-slate-500 flex items-center gap-2">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>{item.date} at {item.time}</span>
                                                </div>
                                            </div>

                                            {/* Event Details Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                                
                                                {/* Pickup Collector */}
                                                <div className="bg-white p-3 rounded-xl border border-slate-100">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        {isCheckIn ? 'Delivered By' : 'Pickup Collector'}
                                                    </span>
                                                    <div className="font-bold text-slate-900 mt-0.5">
                                                        {item.pickup_person ? item.pickup_person.name : item.attempted_person_name || 'Authorized Guardian'}
                                                    </div>
                                                    {item.pickup_person && (
                                                        <div className="text-[11px] text-slate-500">
                                                            {item.pickup_person.relationship} {item.pickup_person.phone && `• ${item.pickup_person.phone}`}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Staff Processor */}
                                                <div className="bg-white p-3 rounded-xl border border-slate-100">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        Processed By Staff
                                                    </span>
                                                    <div className="font-bold text-slate-900 mt-0.5">
                                                        {item.processed_by.name}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        Authenticated Backend Context
                                                    </div>
                                                </div>

                                            </div>

                                            {/* Late Departure Metrics */}
                                            {isLate && (
                                                <div className="mt-3 p-3 bg-orange-100/60 rounded-xl border border-orange-200 flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2 text-orange-900 font-bold">
                                                        <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
                                                        <span>Checked out past expected time ({formatTime(item.expected_pickup_time)})</span>
                                                    </div>
                                                    <span className="px-2 py-0.5 bg-orange-200/80 text-orange-950 font-black rounded-md text-[11px]">
                                                        +{item.late_duration_minutes} minutes late
                                                    </span>
                                                </div>
                                            )}

                                            {/* Failure Reason */}
                                            {item.failure_reason && (
                                                <div className="mt-3 p-3 bg-rose-100/60 rounded-xl border border-rose-200 text-xs text-rose-900">
                                                    <div className="font-bold flex items-center gap-1.5 mb-0.5">
                                                        <UserX className="w-4 h-4 text-rose-600 shrink-0" />
                                                        <span>Verification / Security Failure</span>
                                                    </div>
                                                    <p className="text-rose-800 leading-relaxed text-[11px]">{item.failure_reason}</p>
                                                </div>
                                            )}

                                            {/* Digital Signature Preview */}
                                            {item.has_signature && item.signature_data && (
                                                <div className="mt-3 flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                        <PenTool className="w-4 h-4 text-teal-600" />
                                                        <span>Digital Signature Attached</span>
                                                    </div>
                                                    <button
                                                        onClick={() => setSelectedSignature(item.signature_data)}
                                                        className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-lg text-xs transition-colors"
                                                    >
                                                        View Signature
                                                    </button>
                                                </div>
                                            )}

                                            {/* Notes */}
                                            {item.notes && (
                                                <div className="mt-2 text-[11px] text-slate-500 italic">
                                                    Notes: {item.notes}
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Signature Modal */}
                <AnimatePresence>
                    {selectedSignature && (
                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100"
                            >
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                        <PenTool className="w-4 h-4 text-emerald-600" />
                                        Captured Digital Signature
                                    </h3>
                                    <button
                                        onClick={() => setSelectedSignature(null)}
                                        className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                                    >
                                        Close
                                    </button>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-center min-h-[160px]">
                                    <img
                                        src={selectedSignature}
                                        alt="Digital Signature"
                                        className="max-h-40 max-w-full object-contain"
                                    />
                                </div>

                                <div className="mt-4 text-center">
                                    <button
                                        onClick={() => setSelectedSignature(null)}
                                        className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
                                    >
                                        Done
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

            </div>
        </Layout>
    );
};

export default ChildPickupHistory;
