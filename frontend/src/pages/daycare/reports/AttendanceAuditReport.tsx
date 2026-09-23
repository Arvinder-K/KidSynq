import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
    Calendar, Download, RefreshCw, Search, 
    Filter, ArrowLeft, Printer, ShieldCheck, 
    FileText, User, AlertCircle
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';
import { useNavigate } from 'react-router-dom';

interface AuditLogEntry {
    id: string;
    created_at: string;
    module: string;
    action: string;
    entity_type: string;
    entity_id: string;
    user_name: string;
    old_values: Record<string, any>;
    new_values: Record<string, any>;
    correction_reason: string | null;
    rejection_reason: string | null;
}

const AttendanceAuditReport: React.FC = () => {
    const navigate = useNavigate();

    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedModule, setSelectedModule] = useState<string>('all');
    const [selectedAction, setSelectedAction] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const fetchAuditLogs = async () => {
        setLoading(true);
        try {
            const res = await api.get('/daycare/reports/attendance-audit/', {
                params: {
                    start_date: startDate || undefined,
                    end_date: endDate || undefined,
                    module: selectedModule !== 'all' ? selectedModule : undefined,
                    action: selectedAction !== 'all' ? selectedAction : undefined
                }
            });
            setLogs(res.data.logs || []);
        } catch (err) {
            console.error("Failed to load audit logs:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAuditLogs();
    }, [startDate, endDate, selectedModule, selectedAction]);

    const exportCSV = () => {
        const url = `/api/daycare/reports/attendance-audit/?export=csv${
            startDate ? `&start_date=${startDate}` : ''
        }${endDate ? `&end_date=${endDate}` : ''}${
            selectedModule !== 'all' ? `&module=${selectedModule}` : ''
        }${selectedAction !== 'all' ? `&action=${selectedAction}` : ''}`;
        window.open(url, '_blank');
    };

    const filteredLogs = useMemo(() => {
        if (!searchQuery.trim()) return logs;
        const q = searchQuery.toLowerCase();
        return logs.filter(l => 
            l.user_name.toLowerCase().includes(q) ||
            l.action.toLowerCase().includes(q) ||
            l.entity_type.toLowerCase().includes(q) ||
            (l.correction_reason && l.correction_reason.toLowerCase().includes(q)) ||
            (l.rejection_reason && l.rejection_reason.toLowerCase().includes(q))
        );
    }, [logs, searchQuery]);

    return (
        <Layout>
            <div className="space-y-6 pb-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <button
                            onClick={() => navigate('/daycare/attendance/dashboard')}
                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-1 font-semibold transition"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Back to Master Dashboard
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">Unified Attendance Audit Trail</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Immutable audit trail of manager corrections, timesheet approvals, rejections, and attendance adjustments.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => window.print()}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs flex items-center gap-1.5 transition"
                        >
                            <Printer className="w-4 h-4 text-slate-500" />
                            Print
                        </button>
                        <button
                            onClick={exportCSV}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                        >
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                    <div>
                        <label className="block text-slate-400 font-medium mb-1">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        />
                    </div>

                    <div>
                        <label className="block text-slate-400 font-medium mb-1">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        />
                    </div>

                    <div>
                        <label className="block text-slate-400 font-medium mb-1">Module Area</label>
                        <select
                            value={selectedModule}
                            onChange={e => setSelectedModule(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        >
                            <option value="all">All Modules</option>
                            <option value="ATTENDANCE">Child Attendance</option>
                            <option value="STAFF_ATTENDANCE">Staff Timesheets</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-slate-400 font-medium mb-1">Action Type</label>
                        <select
                            value={selectedAction}
                            onChange={e => setSelectedAction(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        >
                            <option value="all">All Actions</option>
                            <option value="CORRECTION">Correction</option>
                            <option value="APPROVE">Approve</option>
                            <option value="REJECT">Reject</option>
                            <option value="UPDATE">Update</option>
                            <option value="CREATE">Create</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-slate-400 font-medium mb-1">Search Reason/User</label>
                        <input
                            type="text"
                            placeholder="Reason or username..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        />
                    </div>
                </div>

                {/* Audit Logs Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                    <th className="p-4">Timestamp</th>
                                    <th className="p-4">Module / Entity</th>
                                    <th className="p-4">Action</th>
                                    <th className="p-4">Actor</th>
                                    <th className="p-4">Reason / Notes</th>
                                    <th className="p-4">Before vs After Changes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-slate-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                                            Loading audit logs...
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-slate-500">
                                            No audit entries found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(l => (
                                        <tr key={l.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                            <td className="p-4 font-mono text-slate-600 dark:text-slate-300">
                                                {new Date(l.created_at).toLocaleString()}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                                    l.module === 'ATTENDANCE'
                                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                                                }`}>
                                                    {l.module}
                                                </span>
                                                <p className="text-[10px] text-slate-400 mt-0.5">{l.entity_type}</p>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                    l.action === 'APPROVE'
                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                        : l.action === 'REJECT'
                                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                                        : l.action === 'CORRECTION'
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                                                }`}>
                                                    {l.action}
                                                </span>
                                            </td>
                                            <td className="p-4 font-medium text-slate-900 dark:text-slate-100">
                                                {l.user_name}
                                            </td>
                                            <td className="p-4 text-slate-600 dark:text-slate-300">
                                                {l.correction_reason && (
                                                    <p className="text-amber-700 dark:text-amber-300 font-medium">
                                                        Correction: {l.correction_reason}
                                                    </p>
                                                )}
                                                {l.rejection_reason && (
                                                    <p className="text-rose-700 dark:text-rose-300 font-medium">
                                                        Rejection: {l.rejection_reason}
                                                    </p>
                                                )}
                                                {!l.correction_reason && !l.rejection_reason && (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 font-mono text-[11px]">
                                                {Object.keys(l.old_values || {}).length > 0 ? (
                                                    <div className="space-y-1">
                                                        {Object.entries(l.old_values).map(([k, v]) => (
                                                            <div key={k} className="flex items-center space-x-1">
                                                                <span className="text-slate-400">{k}:</span>
                                                                <span className="text-rose-600 line-through">{String(v || 'empty')}</span>
                                                                <span className="text-slate-400">→</span>
                                                                <span className="text-emerald-600 font-semibold">{String(l.new_values?.[k] || 'empty')}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">No attribute diff</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default AttendanceAuditReport;
