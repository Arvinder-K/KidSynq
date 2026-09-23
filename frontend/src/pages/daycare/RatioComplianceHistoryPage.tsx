import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Scale, Users, UserCheck, ShieldCheck, AlertTriangle,
    AlertCircle, RefreshCw, Search, Filter, Clock,
    GraduationCap, CheckCircle2, XCircle, ChevronDown,
    ChevronUp, Layers, Info, Calendar, Baby, ArrowRight,
    Sparkles, BookOpen, ShieldAlert, Award, FileSpreadsheet,
    Camera, ArrowLeft, Check, ShieldOff
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api';

interface RuleSnapshot {
    name?: string;
    max_children_per_staff?: number;
    warning_threshold_buffer?: number;
    requires_qualified_ece?: boolean;
    qualification_requirement?: string;
    province_code?: string;
    province_name?: string;
    program_name?: string;
    age_group_name?: string;
    effective_from?: string;
    explanation_source?: string;
}

interface ComplianceHistoryRecord {
    id: string;
    daycare: string;
    classroom: string;
    classroom_name: string;
    classroom_code: string;
    evaluated_at: string;
    children_present: number;
    qualified_staff_present: number;
    total_staff_present: number;
    required_staff: number;
    calculated_ratio: string;
    calculated_status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT';
    rule_used: string | null;
    rule_snapshot: RuleSnapshot;
    override_applied: boolean;
    override_status: string | null;
    override_reason: string | null;
    override_by: string | null;
    override_by_name: string | null;
    final_status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT' | 'EXEMPT';
    created_at: string;
}

export const RatioComplianceHistoryPage: React.FC = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [records, setRecords] = useState<ComplianceHistoryRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Filters
    const [startDate, setStartDate] = useState<string>(thirtyDaysAgoStr);
    const [endDate, setEndDate] = useState<string>(todayStr);
    const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedClassroom, setSelectedClassroom] = useState<string>('ALL');

    // Detail Modal
    const [selectedRecord, setSelectedRecord] = useState<ComplianceHistoryRecord | null>(null);

    const fetchHistory = useCallback(async () => {
        setRefreshing(true);
        setError(null);
        try {
            const params: any = {};
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;
            if (selectedStatus !== 'ALL') params.status = selectedStatus;
            if (selectedClassroom !== 'ALL') params.classroom_id = selectedClassroom;
            if (searchQuery) params.search = searchQuery;

            const res = await api.get('/daycare/ratio-monitoring/history/', { params });
            const dataList = Array.isArray(res.data) ? res.data : (res.data.results || []);
            setRecords(dataList);
        } catch (err: any) {
            console.error('Failed to load compliance history:', err);
            setError(err.response?.data?.error || 'Unable to load compliance history records.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [startDate, endDate, selectedStatus, selectedClassroom, searchQuery]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // Distinct Classrooms for filter dropdown
    const distinctClassrooms = useMemo(() => {
        const map = new Map<string, string>();
        records.forEach(r => {
            if (r.classroom && r.classroom_name) {
                map.set(r.classroom, r.classroom_name);
            }
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [records]);

    // KPI Metrics calculation
    const metrics = useMemo(() => {
        const total = records.length;
        if (total === 0) {
            return { total: 0, compliantRate: 100, violations: 0, warnings: 0, overrides: 0 };
        }
        let compliantCount = 0;
        let violationsCount = 0;
        let warningsCount = 0;
        let overridesCount = 0;

        records.forEach(r => {
            if (r.override_applied) overridesCount++;
            if (r.final_status === 'COMPLIANT' || r.final_status === 'EXEMPT') compliantCount++;
            if (r.final_status === 'NON_COMPLIANT') violationsCount++;
            if (r.final_status === 'WARNING') warningsCount++;
        });

        const compliantRate = Math.round((compliantCount / total) * 100);
        return {
            total,
            compliantRate,
            violations: violationsCount,
            warnings: warningsCount,
            overrides: overridesCount
        };
    }, [records]);

    // Trigger immediate live snapshot
    const handleTakeSnapshot = async () => {
        setRefreshing(true);
        setError(null);
        try {
            await api.post('/daycare/ratio-monitoring/log-snapshot/', {});
            setSuccessMessage('Live ratio compliance snapshot successfully captured for all classrooms.');
            setTimeout(() => setSuccessMessage(null), 4000);
            await fetchHistory();
        } catch (err: any) {
            console.error('Failed to log snapshot:', err);
            setError('Failed to record compliance snapshot.');
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <Layout>
            <div className="space-y-6 pb-16 max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <Link
                            to="/daycare/ratio-monitoring"
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1.5 mb-1 transition"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Back to Live Ratio Monitoring
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Compliance & Ratio History
                        </h1>
                        <p className="text-sm font-medium text-gray-500 max-w-2xl mt-1">
                            Immutable audit trail of snapshot records, room-by-room status checks, staff-child ratios, and threshold compliance logs.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={handleTakeSnapshot}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-all disabled:opacity-50"
                        >
                            <Camera className="w-4 h-4" />
                            <span>Record Live Snapshot</span>
                        </button>

                        <button
                            onClick={fetchHistory}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs shadow-xs transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                {/* Legal Notice Banner */}
                <div className="mt-4 p-3 bg-amber-50/80 border border-amber-200/90 rounded-2xl flex items-start gap-3">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900 font-medium leading-relaxed">
                        <span className="font-bold">Notice on Regulatory Compliance:</span> The ratios and rules evaluated below reflect configurable operational policies maintained by authorized administrators for internal quality assurance and monitoring.
                    </p>
                </div>

                {/* Notifications */}
                <AnimatePresence>
                    {successMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-semibold"
                        >
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
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

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Evaluated</span>
                            <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
                                <FileSpreadsheet className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-900">{metrics.total}</div>
                        <p className="text-[11px] font-semibold text-slate-400 mt-1">Recorded Snapshots</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Compliance Rate</span>
                            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-emerald-700">{metrics.compliantRate}%</div>
                        <p className="text-[11px] font-semibold text-emerald-600/90 mt-1">Compliant or Exempt</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Violations / Warnings</span>
                            <div className="p-2 bg-amber-100 rounded-xl text-amber-700">
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-amber-700">{metrics.violations + metrics.warnings}</div>
                        <p className="text-[11px] font-semibold text-amber-600/90 mt-1">
                            {metrics.violations} Breach, {metrics.warnings} Warning
                        </p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Manual Overrides</span>
                            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-700">
                                <ShieldAlert className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-indigo-700">{metrics.overrides}</div>
                        <p className="text-[11px] font-semibold text-indigo-600/90 mt-1">Admin Authorized Overrides</p>
                    </div>
                </div>

                {/* Filters & Search Toolbar */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Search */}
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search classroom, code, or rule..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                            />
                        </div>

                        {/* Classroom Filter */}
                        <div>
                            <select
                                value={selectedClassroom}
                                onChange={(e) => setSelectedClassroom(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold text-slate-700"
                            >
                                <option value="ALL">All Classrooms</option>
                                {distinctClassrooms.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date From */}
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">From:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white font-medium"
                            />
                        </div>

                        {/* Date To */}
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">To:</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white font-medium"
                            />
                        </div>
                    </div>

                    {/* Status Filter Chips */}
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-bold text-slate-400 mr-1">Status Filter:</span>
                        {[
                            { key: 'ALL', label: 'All Records' },
                            { key: 'COMPLIANT', label: 'Compliant' },
                            { key: 'WARNING', label: 'Warning' },
                            { key: 'NON_COMPLIANT', label: 'Non-Compliant' },
                            { key: 'OVERRIDDEN', label: 'Overridden Only' },
                        ].map(s => (
                            <button
                                key={s.key}
                                onClick={() => setSelectedStatus(s.key)}
                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                                    selectedStatus === s.key
                                        ? 'bg-slate-900 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* History Table */}
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-600" />
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                                Historical Evaluation Log
                            </h2>
                            <span className="text-xs font-bold text-slate-400">({records.length} records)</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-emerald-600" />
                            <p className="text-xs font-semibold">Loading ratio evaluation history...</p>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-center px-4">
                            <Scale className="w-12 h-12 text-slate-300 mb-3" />
                            <h3 className="text-base font-bold text-slate-700">No evaluation records found</h3>
                            <p className="text-xs max-w-md text-slate-500 mt-1 mb-4">
                                No historical compliance snapshots match the selected filter criteria. Click "Record Live Snapshot" above to log current classroom compliance states.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-600">
                                <thead className="bg-slate-50/80 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                    <tr>
                                        <th className="px-5 py-3.5">Timestamp</th>
                                        <th className="px-5 py-3.5">Classroom</th>
                                        <th className="px-5 py-3.5">Children Present</th>
                                        <th className="px-5 py-3.5">Educators On-Duty</th>
                                        <th className="px-5 py-3.5">Recorded Ratio</th>
                                        <th className="px-5 py-3.5">Compliance Status</th>
                                        <th className="px-5 py-3.5">Applied Rule</th>
                                        <th className="px-5 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {records.map((r) => {
                                        const dt = new Date(r.evaluated_at);
                                        const dateStr = dt.toLocaleDateString('en-CA');
                                        const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                        return (
                                            <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="font-bold text-slate-900">{dateStr}</div>
                                                    <div className="text-[10.5px] text-slate-400">{timeStr}</div>
                                                </td>

                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="font-bold text-slate-900">{r.classroom_name}</div>
                                                    {r.classroom_code && (
                                                        <div className="text-[10px] font-mono text-slate-400 uppercase">
                                                            {r.classroom_code}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span className="font-extrabold text-slate-900 text-sm">
                                                        {r.children_present}
                                                    </span>
                                                    <span className="text-slate-400 text-[10px] ml-1">children</span>
                                                </td>

                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-extrabold text-slate-900 text-sm">
                                                            {r.qualified_staff_present}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            / {r.required_staff} required
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 font-black text-xs font-mono">
                                                        {r.calculated_ratio}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {r.final_status === 'COMPLIANT' && (
                                                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] border border-emerald-200">
                                                                COMPLIANT
                                                            </span>
                                                        )}
                                                        {r.final_status === 'WARNING' && (
                                                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[10px] border border-amber-200">
                                                                WARNING
                                                            </span>
                                                        )}
                                                        {r.final_status === 'NON_COMPLIANT' && (
                                                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-extrabold text-[10px] border border-rose-200">
                                                                BREACH
                                                            </span>
                                                        )}
                                                        {r.final_status === 'EXEMPT' && (
                                                            <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 font-extrabold text-[10px] border border-indigo-200">
                                                                EXEMPT
                                                            </span>
                                                        )}

                                                        {r.override_applied && (
                                                            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-black text-[9px] border border-purple-200 uppercase tracking-tight">
                                                                Overridden
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="font-semibold text-slate-800 text-[11px] truncate max-w-[180px]">
                                                        {r.rule_snapshot?.name || 'Standard Default'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        Province: {r.rule_snapshot?.province_code || 'General'}
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 whitespace-nowrap text-right">
                                                    <button
                                                        onClick={() => setSelectedRecord(r)}
                                                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-bold text-xs transition-colors"
                                                    >
                                                        Details
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Snapshot Details Modal */}
                <AnimatePresence>
                    {selectedRecord && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white w-full max-w-2xl rounded-3xl shadow-xl border border-slate-200 overflow-hidden"
                            >
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 bg-emerald-600 text-white rounded-xl">
                                            <Scale className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black text-slate-900">
                                                Snapshot Inspection: {selectedRecord.classroom_name}
                                            </h3>
                                            <p className="text-xs font-semibold text-slate-400">
                                                Evaluated at {new Date(selectedRecord.evaluated_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedRecord(null)}
                                        className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                                    {/* Override Status Callout */}
                                    {selectedRecord.override_applied && (
                                        <div className="p-4 bg-purple-50/90 border border-purple-200 rounded-2xl">
                                            <div className="flex items-center gap-2 mb-1">
                                                <ShieldAlert className="w-4 h-4 text-purple-700" />
                                                <h4 className="text-xs font-extrabold text-purple-900 uppercase tracking-wide">
                                                    Manual Override Recorded
                                                </h4>
                                            </div>
                                            <div className="text-xs text-purple-950 font-medium space-y-1 mt-2">
                                                <p><span className="font-bold">Calculated Status:</span> {selectedRecord.calculated_status}</p>
                                                <p><span className="font-bold">Effective Status:</span> {selectedRecord.override_status}</p>
                                                <p><span className="font-bold">Justification / Reason:</span> {selectedRecord.override_reason}</p>
                                                {selectedRecord.override_by_name && (
                                                    <p><span className="font-bold">Authorized By:</span> {selectedRecord.override_by_name}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Summary Stats Grid */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                                            <div className="text-lg font-black text-slate-900">{selectedRecord.children_present}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Children Present</div>
                                        </div>
                                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                                            <div className="text-lg font-black text-slate-900">{selectedRecord.qualified_staff_present}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Qualified Staff</div>
                                        </div>
                                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                                            <div className="text-lg font-black text-emerald-700">{selectedRecord.calculated_ratio}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Recorded Ratio</div>
                                        </div>
                                    </div>

                                    {/* Rule Snapshot Breakdown */}
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
                                        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                                            <BookOpen className="w-4 h-4 text-emerald-600" />
                                            Applicable Rule Policy (Immutable Snapshot)
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                                            <div>
                                                <span className="text-slate-400 font-semibold">Rule Name:</span>
                                                <p className="font-bold text-slate-800">{selectedRecord.rule_snapshot?.name || 'Standard Ratio'}</p>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 font-semibold">Province Jurisdiction:</span>
                                                <p className="font-bold text-slate-800">{selectedRecord.rule_snapshot?.province_name || 'General'} ({selectedRecord.rule_snapshot?.province_code || 'N/A'})</p>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 font-semibold">Max Ratio Threshold:</span>
                                                <p className="font-bold text-slate-800">1 : {selectedRecord.rule_snapshot?.max_children_per_staff || 5}</p>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 font-semibold">Qualification Requirement:</span>
                                                <p className="font-bold text-slate-800">{selectedRecord.rule_snapshot?.qualification_requirement || 'Certified ECE'}</p>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 font-semibold">Program:</span>
                                                <p className="font-bold text-slate-800">{selectedRecord.rule_snapshot?.program_name || 'All Programs'}</p>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 font-semibold">Age Group:</span>
                                                <p className="font-bold text-slate-800">{selectedRecord.rule_snapshot?.age_group_name || 'General'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Disclaimer */}
                                    <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-slate-500 font-medium text-center">
                                        This snapshot is cryptographically stored for auditing. Historical records are immutable and do not alter when new ratio rules are created or modified.
                                    </div>
                                </div>

                                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                                    <button
                                        onClick={() => setSelectedRecord(null)}
                                        className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
                                    >
                                        Close
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

export default RatioComplianceHistoryPage;
