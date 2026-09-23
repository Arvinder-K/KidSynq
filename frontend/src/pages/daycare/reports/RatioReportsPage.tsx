import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileSpreadsheet, Download, Printer, RefreshCw, Search,
    Filter, Calendar, ChevronRight, ArrowLeft, ShieldAlert,
    CheckCircle2, AlertTriangle, XCircle, Clock, Users,
    UserCheck, Scale, Award, Shield, Layers, BookOpen
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../../../components/Layout';
import api from '../../../api';

type ReportType = 
    | 'daily_ratio'
    | 'classroom_compliance'
    | 'staff_shortages'
    | 'violations'
    | 'qualified_staff'
    | 'ratio_history'
    | 'provincial_rules';

const REPORT_TABS = [
    { id: 'daily_ratio', label: '1. Daily Ratio', icon: Scale, desc: 'Per-classroom live ratio snapshot' },
    { id: 'classroom_compliance', label: '2. Classroom Compliance', icon: Layers, desc: 'Aggregated compliance over time' },
    { id: 'staff_shortages', label: '3. Staff Shortages', icon: ShieldAlert, desc: 'Classrooms with staff deficits' },
    { id: 'violations', label: '4. Ratio Violations', icon: XCircle, desc: 'Non-compliant incident audit log' },
    { id: 'qualified_staff', label: '5. Staff Qualifications', icon: UserCheck, desc: 'ECE credential qualification status' },
    { id: 'ratio_history', label: '6. Ratio History', icon: Clock, desc: 'Immutable snapshot audit trail' },
    { id: 'provincial_rules', label: '7. Policy & Provincial Rules', icon: BookOpen, desc: 'Active rules and provincial baselines' },
];

export default function RatioReportsPage() {
    const [activeReport, setActiveReport] = useState<ReportType>('daily_ratio');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 14);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [classrooms, setClassrooms] = useState<{ id: string; room_name: string }[]>([]);
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch dropdowns
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [cRes, bRes] = await Promise.all([
                    api.get('/classrooms/').catch(() => ({ data: [] })),
                    api.get('/branches/').catch(() => ({ data: [] }))
                ]);
                setClassrooms(Array.isArray(cRes.data) ? cRes.data : (cRes.data.results || []));
                setBranches(Array.isArray(bRes.data) ? bRes.data : (bRes.data.results || []));
            } catch (err) {
                console.error("Failed to load filter options", err);
            }
        };
        fetchFilters();
    }, []);

    // Fetch report data
    const fetchReport = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/daycare/ratio-monitoring/reports/', {
                params: {
                    report_type: activeReport,
                    date: selectedDate,
                    start_date: startDate,
                    end_date: endDate,
                    classroom: selectedClassroom !== 'all' ? selectedClassroom : undefined,
                    branch: selectedBranch !== 'all' ? selectedBranch : undefined,
                    status: selectedStatus !== 'all' ? selectedStatus : undefined,
                    search: searchQuery || undefined
                }
            });
            setReportData(res.data);
        } catch (err: any) {
            console.error("Report fetch error:", err);
            setError(err.response?.data?.error || "Failed to generate report. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [activeReport, selectedDate, startDate, endDate, selectedClassroom, selectedBranch, selectedStatus]);

    const handleExportCSV = () => {
        const params = new URLSearchParams({
            report_type: activeReport,
            date: selectedDate,
            start_date: startDate,
            end_date: endDate,
            export: 'csv'
        });
        if (selectedClassroom !== 'all') params.append('classroom', selectedClassroom);
        if (selectedBranch !== 'all') params.append('branch', selectedBranch);
        if (selectedStatus !== 'all') params.append('status', selectedStatus);

        const url = `http://127.0.0.1:8000/api/daycare/ratio-monitoring/reports/?${params.toString()}`;
        window.open(url, '_blank');
    };

    const handlePrint = () => {
        window.print();
    };

    const isRangeReport = ['classroom_compliance', 'violations', 'ratio_history'].includes(activeReport);

    const filteredRecords = useMemo(() => {
        const list = reportData?.records || [];
        if (!searchQuery.trim()) return list;
        const q = searchQuery.toLowerCase();
        return list.filter((r: any) => 
            (r.classroom_name && r.classroom_name.toLowerCase().includes(q)) ||
            (r.name && r.name.toLowerCase().includes(q)) ||
            (r.rule_name && r.rule_name.toLowerCase().includes(q)) ||
            (r.room_code && r.room_code.toLowerCase().includes(q)) ||
            (r.job_title && r.job_title.toLowerCase().includes(q))
        );
    }, [reportData, searchQuery]);

    return (
        <Layout>
            <div className="space-y-6 pb-20 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link 
                            to="/daycare/ratio-monitoring" 
                            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-colors shadow-xs"
                            title="Back to Live Monitoring"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                                Staff-to-Child Ratio Reports Hub
                            </h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Export compliance audits, staff shortage analytics, violation logs, and ECE credential qualification reports.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99]"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export CSV</span>
                        </button>

                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs transition-colors shadow-xs"
                        >
                            <Printer className="w-3.5 h-3.5 text-slate-500" />
                            <span>Print</span>
                        </button>

                        <button
                            onClick={fetchReport}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs transition-colors shadow-xs disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                {/* Report Tabs Navigation */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {REPORT_TABS.map((tab) => {
                        const isSelected = activeReport === tab.id;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveReport(tab.id as ReportType);
                                    setSearchQuery('');
                                }}
                                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                                    isSelected
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]'
                                        : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <Icon className={`w-4 h-4 ${isSelected ? 'text-lime-300' : 'text-emerald-600'}`} />
                                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-lime-300"></span>}
                                </div>
                                <div>
                                    <p className="text-xs font-black tracking-tight leading-tight">{tab.label}</p>
                                    <p className={`text-[10px] font-medium mt-0.5 line-clamp-1 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                                        {tab.desc}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Filter Bar */}
                <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
                    {/* Date Filters */}
                    {isRangeReport ? (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 bg-slate-100/80 px-3 py-1.5 rounded-2xl border border-slate-200/80">
                                <span className="text-[10px] font-black text-slate-400 uppercase">From</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                                />
                            </div>
                            <div className="flex items-center gap-1.5 bg-slate-100/80 px-3 py-1.5 rounded-2xl border border-slate-200/80">
                                <span className="text-[10px] font-black text-slate-400 uppercase">To</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                                />
                            </div>
                        </div>
                    ) : activeReport !== 'provincial_rules' && (
                        <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-2xl border border-slate-200/80">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                            />
                        </div>
                    )}

                    {/* Classroom Dropdown */}
                    {activeReport !== 'provincial_rules' && activeReport !== 'qualified_staff' && (
                        <div className="min-w-[160px]">
                            <select
                                value={selectedClassroom}
                                onChange={(e) => setSelectedClassroom(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            >
                                <option value="all">All Classrooms</option>
                                {classrooms.map(c => (
                                    <option key={c.id} value={c.id}>{c.room_name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Branch Dropdown */}
                    {branches.length > 0 && activeReport !== 'provincial_rules' && (
                        <div className="min-w-[140px]">
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            >
                                <option value="all">All Branches</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Status Filter */}
                    {['daily_ratio', 'ratio_history'].includes(activeReport) && (
                        <div className="min-w-[140px]">
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            >
                                <option value="all">All Statuses</option>
                                <option value="COMPLIANT">Compliant</option>
                                <option value="WARNING">Warning</option>
                                <option value="NON_COMPLIANT">Non-Compliant</option>
                                <option value="OVERRIDDEN">Overridden</option>
                            </select>
                        </div>
                    )}

                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Filter records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                        />
                    </div>
                </div>

                {/* Summary KPI Cards */}
                {reportData?.summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {activeReport === 'daily_ratio' && (
                            <>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Rooms Evaluated</span>
                                    <div className="text-2xl font-black text-slate-900">{reportData.summary.total_classrooms}</div>
                                    <p className="text-[10.5px] font-bold text-emerald-700 mt-0.5">{reportData.summary.compliance_rate}% Compliance Rate</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs">
                                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block mb-1">Compliant Rooms</span>
                                    <div className="text-2xl font-black text-emerald-700">{reportData.summary.compliant_count}</div>
                                    <p className="text-[10.5px] font-bold text-emerald-600 mt-0.5">Meeting Legal Rules</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-rose-200/80 bg-rose-50/20 shadow-xs">
                                    <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block mb-1">Non-Compliant</span>
                                    <div className="text-2xl font-black text-rose-700">{reportData.summary.non_compliant_count}</div>
                                    <p className="text-[10.5px] font-bold text-rose-600 mt-0.5">{reportData.summary.warning_count} Warning</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Staff Present / Req</span>
                                    <div className="text-2xl font-black text-slate-900">{reportData.summary.total_qualified_staff_present} / {reportData.summary.total_required_staff}</div>
                                    <p className="text-[10.5px] font-bold text-slate-500 mt-0.5">{reportData.summary.total_children_present} Children Checked-In</p>
                                </div>
                            </>
                        )}

                        {activeReport === 'classroom_compliance' && (
                            <>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Rooms Monitored</span>
                                    <div className="text-2xl font-black text-slate-900">{reportData.summary.total_classrooms_evaluated}</div>
                                    <p className="text-[10.5px] font-bold text-slate-400 mt-0.5">Across Date Range</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs">
                                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block mb-1">Overall Compliance</span>
                                    <div className="text-2xl font-black text-emerald-700">{reportData.summary.overall_compliance_rate}%</div>
                                    <p className="text-[10.5px] font-bold text-emerald-600 mt-0.5">{reportData.summary.total_evaluations} Total Snapshots</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-rose-200/80 bg-rose-50/20 shadow-xs">
                                    <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block mb-1">Total Violations</span>
                                    <div className="text-2xl font-black text-rose-700">{reportData.summary.total_violations}</div>
                                    <p className="text-[10.5px] font-bold text-rose-600 mt-0.5">Over Date Range</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Date Period</span>
                                    <div className="text-sm font-black text-slate-900 mt-1">{reportData.summary.start_date} → {reportData.summary.end_date}</div>
                                </div>
                            </>
                        )}

                        {activeReport === 'staff_shortages' && (
                            <>
                                <div className="bg-white p-4 rounded-2xl border border-rose-200/80 bg-rose-50/20 shadow-xs">
                                    <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block mb-1">Shortage Rooms</span>
                                    <div className="text-2xl font-black text-rose-700">{reportData.summary.shortage_rooms_count}</div>
                                    <p className="text-[10.5px] font-bold text-rose-600 mt-0.5">{reportData.summary.critical_shortages_count} Critical</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Staff Deficit</span>
                                    <div className="text-2xl font-black text-rose-600">-{reportData.summary.total_staff_deficit}</div>
                                    <p className="text-[10.5px] font-bold text-slate-400 mt-0.5">Educators Needed</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Affected Children</span>
                                    <div className="text-2xl font-black text-slate-900">{reportData.summary.total_affected_children}</div>
                                    <p className="text-[10.5px] font-bold text-slate-500 mt-0.5">In Deficit Classrooms</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Status</span>
                                    <div className={`text-lg font-black mt-1 ${reportData.summary.shortage_rooms_count > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                        {reportData.summary.shortage_rooms_count > 0 ? 'Action Required' : 'Fully Staffed'}
                                    </div>
                                </div>
                            </>
                        )}

                        {activeReport === 'qualified_staff' && (
                            <>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Active Educators</span>
                                    <div className="text-2xl font-black text-slate-900">{reportData.summary.total_active_staff}</div>
                                    <p className="text-[10.5px] font-bold text-slate-400 mt-0.5">Employed Staff</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs">
                                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block mb-1">Counted as Qualified</span>
                                    <div className="text-2xl font-black text-emerald-700">{reportData.summary.qualified_staff_count}</div>
                                    <p className="text-[10.5px] font-bold text-emerald-600 mt-0.5">{reportData.summary.qualification_rate}% Qualification Rate</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-xs">
                                    <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block mb-1">Expiring Soon</span>
                                    <div className="text-2xl font-black text-amber-700">{reportData.summary.expiring_soon_count}</div>
                                    <p className="text-[10.5px] font-bold text-amber-600 mt-0.5">Within 60 Days</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Unqualified / Aides</span>
                                    <div className="text-2xl font-black text-slate-600">{reportData.summary.unqualified_staff_count}</div>
                                    <p className="text-[10.5px] font-bold text-slate-400 mt-0.5">General Staff</p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Table View */}
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-black text-slate-900 tracking-tight">
                                {reportData?.title || 'Report Records'}
                            </h2>
                            <p className="text-xs font-semibold text-slate-400 mt-0.5">
                                Showing {filteredRecords.length} record(s)
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-emerald-600" />
                            <p className="text-xs font-semibold">Generating report dataset...</p>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-500">No records found for the selected filters.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                    {activeReport === 'daily_ratio' && (
                                        <tr>
                                            <th className="py-3 px-4">Classroom</th>
                                            <th className="py-3 px-4">Age / Program</th>
                                            <th className="py-3 px-4">Present Children</th>
                                            <th className="py-3 px-4">Qualified Staff</th>
                                            <th className="py-3 px-4">Required Staff</th>
                                            <th className="py-3 px-4">Calculated Ratio</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4">Rule Used</th>
                                        </tr>
                                    )}

                                    {activeReport === 'classroom_compliance' && (
                                        <tr>
                                            <th className="py-3 px-4">Classroom</th>
                                            <th className="py-3 px-4">Total Evals</th>
                                            <th className="py-3 px-4">Compliant</th>
                                            <th className="py-3 px-4">Warning</th>
                                            <th className="py-3 px-4">Non-Compliant</th>
                                            <th className="py-3 px-4">Overrides</th>
                                            <th className="py-3 px-4">Compliance Rate</th>
                                            <th className="py-3 px-4">Avg Children / Staff</th>
                                        </tr>
                                    )}

                                    {activeReport === 'staff_shortages' && (
                                        <tr>
                                            <th className="py-3 px-4">Classroom</th>
                                            <th className="py-3 px-4">Present Children</th>
                                            <th className="py-3 px-4">Qualified Staff</th>
                                            <th className="py-3 px-4">Required Staff</th>
                                            <th className="py-3 px-4">Staff Deficit</th>
                                            <th className="py-3 px-4">Urgency</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4">Rule Used</th>
                                        </tr>
                                    )}

                                    {activeReport === 'violations' && (
                                        <tr>
                                            <th className="py-3 px-4">Timestamp</th>
                                            <th className="py-3 px-4">Classroom</th>
                                            <th className="py-3 px-4">Children / Staff</th>
                                            <th className="py-3 px-4">Required</th>
                                            <th className="py-3 px-4">Deficit</th>
                                            <th className="py-3 px-4">Ratio</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4">Override Applied</th>
                                        </tr>
                                    )}

                                    {activeReport === 'qualified_staff' && (
                                        <tr>
                                            <th className="py-3 px-4">Educator</th>
                                            <th className="py-3 px-4">Role / Title</th>
                                            <th className="py-3 px-4">Counted Qualified?</th>
                                            <th className="py-3 px-4">Active Credentials</th>
                                            <th className="py-3 px-4">Next Expiry</th>
                                            <th className="py-3 px-4">Status</th>
                                        </tr>
                                    )}

                                    {activeReport === 'ratio_history' && (
                                        <tr>
                                            <th className="py-3 px-4">Timestamp</th>
                                            <th className="py-3 px-4">Classroom</th>
                                            <th className="py-3 px-4">Children</th>
                                            <th className="py-3 px-4">Staff</th>
                                            <th className="py-3 px-4">Required</th>
                                            <th className="py-3 px-4">Ratio</th>
                                            <th className="py-3 px-4">Final Status</th>
                                            <th className="py-3 px-4">Rule Used</th>
                                        </tr>
                                    )}

                                    {activeReport === 'provincial_rules' && (
                                        <tr>
                                            <th className="py-3 px-4">Rule Name</th>
                                            <th className="py-3 px-4">Type</th>
                                            <th className="py-3 px-4">Province</th>
                                            <th className="py-3 px-4">Program</th>
                                            <th className="py-3 px-4">Age Band</th>
                                            <th className="py-3 px-4">Max Ratio</th>
                                            <th className="py-3 px-4">Qualification Required</th>
                                            <th className="py-3 px-4">Status</th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                    {activeReport === 'daily_ratio' && filteredRecords.map((r: any) => (
                                        <tr key={r.classroom_id} className="hover:bg-slate-50/70">
                                            <td className="py-3 px-4 font-bold text-slate-900">{r.classroom_name}</td>
                                            <td className="py-3 px-4 text-slate-500">{r.age_group} • {r.program}</td>
                                            <td className="py-3 px-4">{r.children_present}</td>
                                            <td className="py-3 px-4">{r.qualified_staff_present}</td>
                                            <td className="py-3 px-4 text-slate-900">{r.required_staff}</td>
                                            <td className="py-3 px-4 font-mono font-bold">{r.calculated_ratio}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                    r.status === 'COMPLIANT' ? 'bg-emerald-100 text-emerald-800' :
                                                    r.status === 'WARNING' ? 'bg-amber-100 text-amber-800' :
                                                    'bg-rose-100 text-rose-800'
                                                }`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-slate-500">{r.rule_name}</td>
                                        </tr>
                                    ))}

                                    {activeReport === 'classroom_compliance' && filteredRecords.map((r: any) => (
                                        <tr key={r.classroom_id} className="hover:bg-slate-50/70">
                                            <td className="py-3 px-4 font-bold text-slate-900">{r.classroom_name}</td>
                                            <td className="py-3 px-4">{r.total_evaluations}</td>
                                            <td className="py-3 px-4 text-emerald-700">{r.compliant_count}</td>
                                            <td className="py-3 px-4 text-amber-700">{r.warning_count}</td>
                                            <td className="py-3 px-4 text-rose-700">{r.non_compliant_count}</td>
                                            <td className="py-3 px-4 text-purple-700">{r.overridden_count}</td>
                                            <td className="py-3 px-4 font-bold">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                                    r.compliance_rate >= 95 ? 'bg-emerald-100 text-emerald-800' :
                                                    r.compliance_rate >= 80 ? 'bg-amber-100 text-amber-800' :
                                                    'bg-rose-100 text-rose-800'
                                                }`}>
                                                    {r.compliance_rate}%
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-slate-500">{r.avg_children} / {r.avg_staff}</td>
                                        </tr>
                                    ))}

                                    {activeReport === 'staff_shortages' && filteredRecords.map((r: any) => (
                                        <tr key={r.classroom_id} className="hover:bg-slate-50/70">
                                            <td className="py-3 px-4 font-bold text-slate-900">{r.classroom_name}</td>
                                            <td className="py-3 px-4">{r.children_present}</td>
                                            <td className="py-3 px-4 text-rose-600">{r.qualified_staff_present}</td>
                                            <td className="py-3 px-4">{r.required_staff}</td>
                                            <td className="py-3 px-4 font-bold text-rose-700">-{r.staff_deficit}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase ${
                                                    r.urgency === 'HIGH' ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {r.urgency}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold uppercase">
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-slate-500">{r.rule_used}</td>
                                        </tr>
                                    ))}

                                    {activeReport === 'violations' && filteredRecords.map((r: any) => (
                                        <tr key={r.id} className="hover:bg-slate-50/70">
                                            <td className="py-3 px-4 font-mono text-slate-500">{r.date} {r.time}</td>
                                            <td className="py-3 px-4 font-bold text-slate-900">{r.classroom_name}</td>
                                            <td className="py-3 px-4">{r.children_present} / {r.qualified_staff_present}</td>
                                            <td className="py-3 px-4">{r.required_staff}</td>
                                            <td className="py-3 px-4 text-rose-700 font-bold">-{r.staff_deficit}</td>
                                            <td className="py-3 px-4 font-mono">{r.calculated_ratio}</td>
                                            <td className="py-3 px-4">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold uppercase">
                                                    {r.final_status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-slate-500">
                                                {r.override_applied ? `Yes (${r.override_reason})` : 'No'}
                                            </td>
                                        </tr>
                                    ))}

                                    {activeReport === 'qualified_staff' && filteredRecords.map((r: any) => (
                                        <tr key={r.employee_id} className="hover:bg-slate-50/70">
                                            <td className="py-3 px-4 font-bold text-slate-900">{r.name}</td>
                                            <td className="py-3 px-4 text-slate-500">{r.job_title} ({r.employee_type})</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                    r.is_counted_qualified ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {r.is_counted_qualified ? 'Qualified ECE' : 'Unqualified'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                {r.credentials?.length > 0 ? (
                                                    <span className="text-slate-700">{r.credentials.map((c: any) => c.name).join(', ')}</span>
                                                ) : (
                                                    <span className="text-slate-400">None Recorded</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-slate-500">
                                                {r.next_expiry_date}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold uppercase ${
                                                    r.is_expiring_soon ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                                                }`}>
                                                    {r.is_expiring_soon ? 'Expiring Soon' : 'Valid'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}

                                    {activeReport === 'ratio_history' && filteredRecords.map((r: any) => (
                                        <tr key={r.id} className="hover:bg-slate-50/70">
                                            <td className="py-3 px-4 font-mono text-slate-500">{r.date} {r.time}</td>
                                            <td className="py-3 px-4 font-bold text-slate-900">{r.classroom_name}</td>
                                            <td className="py-3 px-4">{r.children_present}</td>
                                            <td className="py-3 px-4">{r.qualified_staff_present}</td>
                                            <td className="py-3 px-4">{r.required_staff}</td>
                                            <td className="py-3 px-4 font-mono font-bold">{r.calculated_ratio}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                    r.final_status === 'COMPLIANT' ? 'bg-emerald-100 text-emerald-800' :
                                                    r.final_status === 'WARNING' ? 'bg-amber-100 text-amber-800' :
                                                    'bg-rose-100 text-rose-800'
                                                }`}>
                                                    {r.final_status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-slate-500">{r.rule_name}</td>
                                        </tr>
                                    ))}

                                    {activeReport === 'provincial_rules' && filteredRecords.map((r: any) => (
                                        <tr key={r.id} className="hover:bg-slate-50/70">
                                            <td className="py-3 px-4 font-bold text-slate-900">{r.name}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold uppercase ${
                                                    r.is_system_rule ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                                }`}>
                                                    {r.rule_type}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-slate-500">{r.province_name} ({r.province_code})</td>
                                            <td className="py-3 px-4 text-slate-500">{r.program_name}</td>
                                            <td className="py-3 px-4 font-mono">{r.age_range}</td>
                                            <td className="py-3 px-4 font-mono font-bold">{r.ratio_string}</td>
                                            <td className="py-3 px-4 text-slate-500">{r.qualification_requirement}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                    r.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {r.is_active ? 'Active' : 'Inactive'}
                                                </span>
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
}
