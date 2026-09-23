import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import { 
    ShieldAlert, AlertTriangle, CheckCircle, RefreshCw, Calendar, 
    ChevronLeft, Check
} from 'lucide-react';
import schedulingService, { type StaffShortageAlert } from '../../../api/schedulingService';

export const StaffShortageDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [alerts, setAlerts] = useState<StaffShortageAlert[]>([]);

    const [statusFilter, setStatusFilter] = useState<string>('active');
    const [levelFilter, setLevelFilter] = useState<string>('all');

    // Date range scan filters (default: next 14 days)
    const todayStr = new Date().toISOString().slice(0, 10);
    const defaultEnd = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(defaultEnd);

    const loadAlerts = async () => {
        try {
            setLoading(true);
            const data = await schedulingService.getShortages({
                start_date: startDate,
                end_date: endDate
            });
            setAlerts(data);
        } catch (error) {
            console.error('Failed to load shortage alerts', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAlerts();
    }, [startDate, endDate]);

    const handleRunScan = async () => {
        try {
            setScanning(true);
            await schedulingService.scanShortages({
                start_date: startDate,
                end_date: endDate
            });
            await loadAlerts();
        } catch (error) {
            console.error('Scan failed', error);
            alert('Failed to run staffing ratio scan.');
        } finally {
            setScanning(false);
        }
    };

    const handleResolve = async (id: string, newStatus: 'acknowledged' | 'resolved') => {
        try {
            await schedulingService.resolveShortageAlert(id, newStatus);
            await loadAlerts();
        } catch (error) {
            console.error('Failed to update alert status', error);
            alert('Failed to update alert status.');
        }
    };

    // Filtered alerts
    const filteredAlerts = alerts.filter(a => {
        const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
        const matchesLevel = levelFilter === 'all' || a.alert_level === levelFilter;
        return matchesStatus && matchesLevel;
    });

    const criticalCount = alerts.filter(a => a.status === 'active' && a.alert_level === 'critical').length;
    const warningCount = alerts.filter(a => a.status === 'active' && a.alert_level === 'warning').length;
    const resolvedCount = alerts.filter(a => a.status === 'resolved').length;

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">


            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/daycare/leave')}
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Staff Shortage & Ratio Alerts</h1>
                        <p className="text-gray-500 text-sm mt-1">Automated ratio compliance engine and staffing deficit monitoring</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRunScan}
                        disabled={scanning}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm shadow-sm transition disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                        {scanning ? 'Scanning Coverage...' : 'Scan Now'}
                    </button>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">Critical Deficits</span>
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-rose-600">{criticalCount}</span>
                        <span className="text-xs text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded-full">Non-compliant</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">Warning Limits</span>
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-amber-600">{warningCount}</span>
                        <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">Zero Buffer</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">Resolved Alerts</span>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-800">{resolvedCount}</span>
                        <span className="text-xs text-emerald-600 font-medium">covered</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">Scan Window</span>
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Calendar className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-600 font-medium">
                        <div>From: {startDate}</div>
                        <div>To: {endDate}</div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <span>From:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <span>To:</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                    >
                        <option value="all">All Alert Statuses</option>
                        <option value="active">Active Shortages</option>
                        <option value="acknowledged">Acknowledged</option>
                        <option value="resolved">Resolved</option>
                    </select>

                    <select
                        value={levelFilter}
                        onChange={e => setLevelFilter(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                    >
                        <option value="all">All Severity Levels</option>
                        <option value="critical">Critical Only</option>
                        <option value="warning">Warning Only</option>
                    </select>
                </div>
            </div>

            {/* Alerts List */}
            <div className="space-y-3">
                {filteredAlerts.length === 0 ? (
                    <div className="bg-white p-12 text-center rounded-2xl border border-slate-100 shadow-sm">
                        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-800">No Staff Shortages Detected</h3>
                        <p className="text-slate-500 text-sm mt-1">
                            All scheduled shifts comply with provincial educator-to-child ratios across active classrooms.
                        </p>
                    </div>
                ) : (
                    filteredAlerts.map(alert => (
                        <div 
                            key={alert.id} 
                            className={`p-5 rounded-2xl border transition shadow-sm ${
                                alert.alert_level === 'critical' 
                                    ? 'bg-rose-50/40 border-rose-200' 
                                    : 'bg-amber-50/40 border-amber-200'
                            }`}
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2.5">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                            alert.alert_level === 'critical'
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-amber-500 text-white'
                                        }`}>
                                            {alert.alert_level}
                                        </span>
                                        <span className="font-bold text-slate-800">{alert.classroom_name}</span>
                                        <span className="text-xs text-slate-500 font-medium">• Date: {alert.date}</span>
                                    </div>
                                    <p className="text-sm text-slate-700 font-medium">{alert.reason}</p>
                                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                                        <span>Required Staff: <strong>{alert.required_staff}</strong></span>
                                        <span>•</span>
                                        <span>Active Scheduled: <strong>{alert.scheduled_staff}</strong></span>
                                        {alert.shortage_count > 0 && (
                                            <>
                                                <span>•</span>
                                                <span className="text-rose-600 font-bold">Short By: {alert.shortage_count} Educator(s)</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end md:self-center">
                                    {alert.status === 'active' && (
                                        <>
                                            <button
                                                onClick={() => handleResolve(alert.id, 'acknowledged')}
                                                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition"
                                            >
                                                Acknowledge
                                            </button>
                                            <button
                                                onClick={() => handleResolve(alert.id, 'resolved')}
                                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                                Mark Resolved
                                            </button>
                                        </>
                                    )}
                                    {alert.status !== 'active' && (
                                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
                                            {alert.status}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            </div>
        </Layout>
    );
};



export default StaffShortageDashboard;
