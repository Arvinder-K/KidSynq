import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Download, Filter, Calendar, Search, RefreshCw,
    ShieldCheck, AlertTriangle, UserCheck, Clock, UserX,
    ChevronRight, ArrowLeft, Users, CheckCircle2, ShieldAlert,
    QrCode, KeyRound, Edit3, BarChart3, Layers
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';

interface ReportSummary {
    [key: string]: any;
}

const REPORT_DEFINITIONS = [
    {
        id: 'daily_arrival',
        name: 'Daily Safe Arrival Report',
        description: 'Chronological record of all child arrivals, check-in timestamps, methods, receiving staff, and notes.',
        icon: UserCheck,
        badge: 'Arrivals'
    },
    {
        id: 'daily_departure',
        name: 'Daily Safe Departure Report',
        description: 'Complete departure logs, authorized collectors, verification methods, departure timestamps, and late tracking.',
        icon: Users,
        badge: 'Departures'
    },
    {
        id: 'pickup_verification',
        name: 'Pickup Verification Report (Part B)',
        description: 'Comprehensive verification audit showing Child, Pickup Person, Relationship, Verification Method, Date, Time, Staff, and Result.',
        icon: ShieldCheck,
        badge: 'Audited'
    },
    {
        id: 'late_pickup',
        name: 'Late Pickup Incident Report',
        description: 'Detailed analysis of children collected past expected hours, late duration in minutes, collectors, and staff.',
        icon: AlertTriangle,
        badge: 'Compliance'
    },
    {
        id: 'unauthorized_attempts',
        name: 'Unauthorized Attempt Security Report',
        description: 'Audit log of blocked pickup attempts, invalid QR/PIN entries, unverified persons, and security alerts.',
        icon: ShieldAlert,
        badge: 'Security'
    },
    {
        id: 'pickup_history',
        name: 'Comprehensive Pickup History Report',
        description: 'Full multi-day historical ledger of all safe arrival and departure events with multi-parameter filtering.',
        icon: Layers,
        badge: 'History'
    },
    {
        id: 'verification_methods',
        name: 'Verification Method Breakdown Report',
        description: 'Analytical distribution, success rates, and volume metrics across QR, PIN, Digital Signature, and Manual.',
        icon: BarChart3,
        badge: 'Analytics'
    },
    {
        id: 'staff_processing',
        name: 'Staff Processing & Operations Report',
        description: 'Operational volume handled by each educator/staff member including check-ins, check-outs, and security incidents.',
        icon: FileText,
        badge: 'Staff Ops'
    }
];

const SafeArrivalReports: React.FC = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const past7DaysStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [selectedReport, setSelectedReport] = useState<string>('daily_arrival');
    const [startDate, setStartDate] = useState<string>(past7DaysStr);
    const [endDate, setEndDate] = useState<string>(todayStr);
    const [verificationMethodFilter, setVerificationMethodFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [loading, setLoading] = useState<boolean>(true);
    const [downloadingCsv, setDownloadingCsv] = useState<boolean>(false);
    const [reportData, setReportData] = useState<any>(null);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                report_type: selectedReport,
                start_date: startDate,
                end_date: endDate,
                format: 'json'
            });

            if (verificationMethodFilter) params.append('verification_method', verificationMethodFilter);
            if (statusFilter) params.append('status', statusFilter);

            const res = await api.get(`/daycare/safe-arrival/reports/?${params.toString()}`);
            setReportData(res.data);
        } catch (error) {
            console.error("Failed to load Safe Arrival report", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [selectedReport, startDate, endDate, verificationMethodFilter, statusFilter]);

    const handleDownloadCsv = async () => {
        setDownloadingCsv(true);
        try {
            const params = new URLSearchParams({
                report_type: selectedReport,
                start_date: startDate,
                end_date: endDate,
                format: 'csv'
            });

            if (verificationMethodFilter) params.append('verification_method', verificationMethodFilter);
            if (statusFilter) params.append('status', statusFilter);

            const response = await api.get(`/daycare/safe-arrival/reports/?${params.toString()}`, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${selectedReport}_${startDate}_to_${endDate}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Failed to download CSV", error);
        } finally {
            setDownloadingCsv(false);
        }
    };

    const setPresetRange = (days: number) => {
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
    };

    // Filter table records locally by search query
    const filteredRecords = (reportData?.records || []).filter((r: any) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (r.child_name && r.child_name.toLowerCase().includes(q)) ||
            (r.child && r.child.toLowerCase().includes(q)) ||
            (r.pickup_person && r.pickup_person.toLowerCase().includes(q)) ||
            (r.attempted_person && r.attempted_person.toLowerCase().includes(q)) ||
            (r.received_by && r.received_by.toLowerCase().includes(q)) ||
            (r.processed_by && r.processed_by.toLowerCase().includes(q)) ||
            (r.staff_member && r.staff_member.toLowerCase().includes(q))
        );
    });

    const activeReportDef = REPORT_DEFINITIONS.find(r => r.id === selectedReport) || REPORT_DEFINITIONS[0];

    return (
        <Layout>
            <div className="space-y-6 max-w-7xl mx-auto pb-16">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <Link
                            to="/daycare/safe-arrival"
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1.5 mb-1 transition"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back to Live Dashboard
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Safe Arrival & Departure Reports
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Official compliance audit logs, departure verifications, late pickup tracking, and security exception reports with CSV exports.
                        </p>
                    </div>

                    {/* Top Export Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchReport}
                            disabled={loading}
                            className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 transition-all shadow-xs"
                            title="Refresh Report Data"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                        </button>

                        <button
                            onClick={handleDownloadCsv}
                            disabled={downloadingCsv || loading}
                            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            <span>{downloadingCsv ? 'Exporting CSV...' : 'Export RFC CSV'}</span>
                        </button>
                    </div>
                </div>

                {/* Report Type Selector Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {REPORT_DEFINITIONS.map((r) => {
                        const Icon = r.icon;
                        const isSelected = selectedReport === r.id;
                        return (
                            <button
                                key={r.id}
                                onClick={() => setSelectedReport(r.id)}
                                className={`p-4 rounded-2xl text-left border transition-all relative overflow-hidden flex flex-col justify-between ${
                                    isSelected
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-950/10 ring-2 ring-emerald-500'
                                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-slate-50/50'
                                }`}
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className={`p-2 rounded-xl ${
                                            isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                            isSelected ? 'bg-white/10 text-lime-300' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {r.badge}
                                        </span>
                                    </div>
                                    <div className="font-bold text-xs leading-snug">
                                        {r.name}
                                    </div>
                                </div>
                                <div className={`text-[11px] mt-2 line-clamp-2 ${
                                    isSelected ? 'text-slate-300' : 'text-slate-400'
                                }`}>
                                    {r.description}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Filter Control Bar */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        
                        {/* Date Range Controls */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>From:</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-transparent focus:outline-none cursor-pointer text-slate-900 font-bold"
                                />
                            </div>

                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>To:</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-transparent focus:outline-none cursor-pointer text-slate-900 font-bold"
                                />
                            </div>

                            {/* Date Presets */}
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                                <button
                                    onClick={() => setPresetRange(0)}
                                    className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-white hover:text-slate-900 rounded-lg transition-colors"
                                >
                                    Today
                                </button>
                                <button
                                    onClick={() => setPresetRange(7)}
                                    className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-white hover:text-slate-900 rounded-lg transition-colors"
                                >
                                    Last 7d
                                </button>
                                <button
                                    onClick={() => setPresetRange(30)}
                                    className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-white hover:text-slate-900 rounded-lg transition-colors"
                                >
                                    Last 30d
                                </button>
                            </div>
                        </div>

                        {/* Search Query */}
                        <div className="relative min-w-[240px]">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search child, collector, staff..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Method & Status Sub-filters */}
                    <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-bold">Method:</span>
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-0.5 rounded-lg">
                                {['', 'QR', 'PIN', 'DIGITAL_SIGNATURE', 'MANUAL'].map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setVerificationMethodFilter(m)}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                                            verificationMethodFilter === m
                                                ? 'bg-emerald-700 text-white shadow-xs'
                                                : 'text-slate-600 hover:bg-slate-200/60'
                                        }`}
                                    >
                                        {m || 'All Methods'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-bold">Status:</span>
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-0.5 rounded-lg">
                                {['', 'SUCCESS', 'FAILED', 'LATE'].map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setStatusFilter(s)}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                                            statusFilter === s
                                                ? 'bg-slate-900 text-white shadow-xs'
                                                : 'text-slate-600 hover:bg-slate-200/60'
                                        }`}
                                    >
                                        {s ? s.replace('_', ' ') : 'All Statuses'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary KPI Cards from Backend */}
                {reportData?.summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.entries(reportData.summary).map(([key, val]) => (
                            <div key={key} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    {key.replace(/_/g, ' ')}
                                </div>
                                <div className="text-2xl font-black text-slate-900 mt-1">
                                    {typeof val === 'number' ? val.toLocaleString() : String(val)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Main Report Table Container */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-emerald-700" />
                            <h2 className="font-extrabold text-sm text-slate-900">{activeReportDef.name}</h2>
                        </div>
                        <span className="text-xs text-slate-500 font-medium">
                            {filteredRecords.length} records found
                        </span>
                    </div>

                    {loading ? (
                        <div className="py-20 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto" />
                            <p className="text-xs text-slate-500 font-bold mt-3">Compiling report data...</p>
                        </div>
                    ) : selectedReport === 'verification_methods' ? (
                        /* Method Breakdown Table */
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase">
                                        <th className="py-3 px-6">Verification Method</th>
                                        <th className="py-3 px-4">Total Count</th>
                                        <th className="py-3 px-4">Successful</th>
                                        <th className="py-3 px-4">Failed / Blocked</th>
                                        <th className="py-3 px-4">Late Pickups</th>
                                        <th className="py-3 px-6 text-right">Success Rate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(reportData?.method_breakdown || []).map((m: any) => (
                                        <tr key={m.method} className="hover:bg-slate-50">
                                            <td className="py-3.5 px-6 font-bold text-slate-900 flex items-center gap-2">
                                                {m.method === 'QR' && <QrCode className="w-4 h-4 text-emerald-600" />}
                                                {m.method === 'PIN' && <KeyRound className="w-4 h-4 text-teal-600" />}
                                                {m.method === 'DIGITAL_SIGNATURE' && <Edit3 className="w-4 h-4 text-blue-600" />}
                                                {m.method === 'MANUAL' && <Users className="w-4 h-4 text-slate-600" />}
                                                <span>{m.method}</span>
                                            </td>
                                            <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{m.total_verifications}</td>
                                            <td className="py-3.5 px-4 text-emerald-700 font-bold">{m.successful}</td>
                                            <td className="py-3.5 px-4 text-rose-700 font-bold">{m.failed}</td>
                                            <td className="py-3.5 px-4 text-orange-700 font-bold">{m.late_pickups}</td>
                                            <td className="py-3.5 px-6 text-right font-black text-emerald-800">{m.success_rate_percent}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : selectedReport === 'staff_processing' ? (
                        /* Staff Processing Table */
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase">
                                        <th className="py-3 px-6">Staff Member</th>
                                        <th className="py-3 px-4">Total Processed</th>
                                        <th className="py-3 px-4">Arrivals (In)</th>
                                        <th className="py-3 px-4">Departures (Out)</th>
                                        <th className="py-3 px-4">Exceptions Handled</th>
                                        <th className="py-3 px-4">Late Pickups</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(reportData?.staff_processing || []).map((s: any) => (
                                        <tr key={s.staff_id} className="hover:bg-slate-50">
                                            <td className="py-3.5 px-6 font-bold text-slate-900">{s.staff_name}</td>
                                            <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{s.total_processed}</td>
                                            <td className="py-3.5 px-4 text-emerald-700 font-medium">{s.checkins}</td>
                                            <td className="py-3.5 px-4 text-teal-700 font-medium">{s.checkouts}</td>
                                            <td className="py-3.5 px-4 text-rose-700 font-medium">{s.exceptions_handled}</td>
                                            <td className="py-3.5 px-4 text-orange-700 font-medium">{s.late_pickups}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="py-16 text-center text-slate-400">
                            <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            <p className="text-sm font-bold text-slate-700">No records found for the selected filters.</p>
                            <p className="text-xs text-slate-400 mt-0.5">Try expanding your date range or adjusting the verification method filter.</p>
                        </div>
                    ) : (
                        /* Standard Record Tables */
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase">
                                        <th className="py-3 px-6">Date & Time</th>
                                        <th className="py-3 px-4">Child</th>
                                        <th className="py-3 px-4">Pickup / Collector</th>
                                        <th className="py-3 px-4">Relationship</th>
                                        <th className="py-3 px-4">Method</th>
                                        <th className="py-3 px-4">Staff</th>
                                        <th className="py-3 px-4">Result / Status</th>
                                        <th className="py-3 px-6 text-right">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredRecords.map((r: any) => (
                                        <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-3.5 px-6">
                                                <div className="font-bold text-slate-900">{r.date}</div>
                                                <div className="text-[10px] text-slate-400 font-mono">{r.display_time || r.time || r.checkout_time}</div>
                                            </td>
                                            <td className="py-3.5 px-4 font-bold text-slate-900">
                                                {r.child_name || r.child || '—'}
                                            </td>
                                            <td className="py-3.5 px-4 font-medium text-slate-800">
                                                {r.pickup_person || r.attempted_person || '—'}
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-500">
                                                {r.relationship || '—'}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                    {r.verification_method || r.arrival_type || 'MANUAL'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-600">
                                                {r.processed_by || r.received_by || r.staff_member || '—'}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {r.result === 'SUCCESS' || r.verification_status === 'SUCCESS' || r.status === 'PRESENT' ? (
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        r.is_late_pickup 
                                                            ? 'bg-orange-100 text-orange-800 border border-orange-200' 
                                                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                    }`}>
                                                        {r.is_late_pickup ? `Late (+${r.late_duration_minutes}m)` : (r.result || 'Success')}
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                                        {r.result || r.verification_status || 'Blocked'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-6 text-right">
                                                {r.child_id && (
                                                    <Link
                                                        to={`/daycare/children/${r.child_id}/pickup-history`}
                                                        className="text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center gap-1 text-[11px]"
                                                    >
                                                        History <ChevronRight className="w-3 h-3" />
                                                    </Link>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </Layout>
    );
};

export default SafeArrivalReports;
