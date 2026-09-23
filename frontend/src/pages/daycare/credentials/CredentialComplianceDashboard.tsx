import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ShieldCheck, AlertTriangle, Clock, XCircle, CheckCircle2,
    RefreshCw, Bell, Search, UserX, FileWarning,
    ArrowUpRight, Check, X, FileSpreadsheet
} from 'lucide-react';

import {
    employeeService,
    type ComplianceStats,
    type Province,
    type CredentialType
} from '../../../api/employeeService';
import Layout from '../../../components/Layout';



export const CredentialComplianceDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [stats, setStats] = useState<ComplianceStats | null>(null);
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [credentialTypes, setCredentialTypes] = useState<CredentialType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Active View Tab: 'expiring' | 'matrix'
    const [activeTab, setActiveTab] = useState<'expiring' | 'matrix'>('expiring');

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProvince, setSelectedProvince] = useState(searchParams.get('province') || '');
    const [selectedType, setSelectedType] = useState(searchParams.get('type') || '');
    const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
    const [expiryPeriod, setExpiryPeriod] = useState(searchParams.get('days') || 'all');

    // Alert triggering
    const [sendingAlerts, setSendingAlerts] = useState(false);
    const [alertResult, setAlertResult] = useState<string | null>(null);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            const filters: any = {};
            if (selectedProvince) filters.province = selectedProvince;
            if (selectedType) filters.credential_type = selectedType;
            if (selectedCategory) filters.category = selectedCategory;
            if (expiryPeriod && expiryPeriod !== 'all') filters.expiry_period = expiryPeriod;

            const [dashboardStats, provs, types] = await Promise.all([
                employeeService.getComplianceDashboard(filters),
                employeeService.getProvinces(),
                employeeService.getCredentialTypes()
            ]);

            setStats(dashboardStats);
            setProvinces(provs);
            setCredentialTypes(types);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to load credential compliance dashboard.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedProvince, selectedType, selectedCategory, expiryPeriod]);

    const handleProminentCardClick = () => {
        setExpiryPeriod('30');
        setActiveTab('expiring');
        setSearchParams({ days: '30' });
    };

    const handleSendAlerts = async () => {
        try {
            setSendingAlerts(true);
            setAlertResult(null);
            const res = await employeeService.sendComplianceAlerts();
            setAlertResult(`Successfully generated ${res.alerts_sent} compliance alert(s).`);
            setTimeout(() => setAlertResult(null), 6000);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to trigger compliance alerts.");
        } finally {
            setSendingAlerts(false);
        }
    };

    const handleResetFilters = () => {
        setSelectedProvince('');
        setSelectedType('');
        setSelectedCategory('');
        setExpiryPeriod('all');
        setSearchQuery('');
        setSearchParams({});
    };

    // Filter list by search query
    const filteredExpiringList = (stats?.expiring_list || []).filter(item => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            item.employee_name.toLowerCase().includes(q) ||
            item.credential_name.toLowerCase().includes(q) ||
            (item.certificate_number && item.certificate_number.toLowerCase().includes(q))
        );
    });

    const filteredEmployeeMatrix = (stats?.employee_compliance_summary || []).filter(item => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            item.employee_name.toLowerCase().includes(q) ||
            item.job_title.toLowerCase().includes(q) ||
            item.compliance_reason.toLowerCase().includes(q)
        );
    });

    const getComplianceStatusBadge = (st: string) => {
        switch (st) {
            case 'COMPLIANT':
                return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> COMPLIANT</span>;
            case 'WARNING':
                return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> WARNING</span>;
            case 'NON_COMPLIANT':
                return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200"><XCircle className="w-3.5 h-3.5 text-red-600" /> NON-COMPLIANT</span>;
            case 'PENDING_REVIEW':
                return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-200"><Clock className="w-3.5 h-3.5 text-indigo-600" /> PENDING REVIEW</span>;
            default:
                return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{st}</span>;
        }
    };

    const getDaysRemainingBadge = (days: number | null) => {
        if (days === null) return <span className="text-slate-400 text-xs">No Expiry</span>;
        if (days < 0) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                    <XCircle className="w-3 h-3" /> Expired ({Math.abs(days)}d ago)
                </span>
            );
        }
        if (days <= 30) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                    <Clock className="w-3 h-3 text-amber-700" /> {days} days left
                </span>
            );
        }
        if (days <= 60) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-100">
                    {days} days left
                </span>
            );
        }
        return <span className="text-xs font-medium text-slate-700">{days} days</span>;
    };

    if (loading && !stats) {
        return (
            <Layout>
                <div className="min-h-[400px] flex justify-center items-center">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-6 pb-12">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                        <ShieldCheck className="w-7 h-7 text-indigo-600" />
                        ECE & STAFF CREDENTIAL COMPLIANCE
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Real-time operational dashboard for tracking Canadian childcare certifications, background checks, and automated expiry alerts.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/daycare/credentials/reports')}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Compliance Reports (12)
                    </button>
                    <button
                        onClick={handleSendAlerts}
                        disabled={sendingAlerts}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                    >
                        <Bell className="w-3.5 h-3.5 text-indigo-600" />
                        {sendingAlerts ? 'Generating Alerts...' : 'Trigger Compliance Alerts'}
                    </button>
                    <button
                        onClick={loadData}
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-slate-200"
                        title="Refresh Compliance Data"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

            </div>

            {alertResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center justify-between animate-in fade-in">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        {alertResult}
                    </div>
                    <button onClick={() => setAlertResult(null)} className="text-emerald-700 font-bold hover:text-emerald-900">&times;</button>
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
            )}

            {/* 1. REQUIRED PROMINENT CARD & STAT METRIC CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* PROMINENT REQUIRED CARD: CERTIFICATIONS EXPIRING IN 30 DAYS */}
                <div
                    onClick={handleProminentCardClick}
                    className="md:col-span-2 cursor-pointer p-6 rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 relative overflow-hidden group"
                >
                    <div className="absolute right-4 bottom-2 opacity-15 group-hover:opacity-25 transition-opacity">
                        <Clock className="w-32 h-32 text-white" />
                    </div>
                    <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-white/20 backdrop-blur-md text-white tracking-wide uppercase">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-200" /> Action Required
                            </span>
                            <span className="flex items-center gap-1 text-xs font-semibold text-amber-100 group-hover:text-white transition-colors">
                                View Details <ArrowUpRight className="w-4 h-4" />
                            </span>
                        </div>

                        <div>
                            <div className="text-4xl sm:text-5xl font-black tracking-tight">
                                {stats?.expiring_30_days ?? 0}
                            </div>
                            <h3 className="text-base sm:text-lg font-bold text-amber-50 mt-1 uppercase tracking-wider">
                                CERTIFICATIONS EXPIRING IN 30 DAYS
                            </h3>
                            <p className="text-xs text-amber-100/90 mt-0.5">
                                Critical credentials requiring renewal within the next 30 days to avoid compliance interruption.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Card 2: Expired Credentials */}
                <div
                    onClick={() => { setExpiryPeriod('expired'); setActiveTab('expiring'); }}
                    className="cursor-pointer p-5 rounded-3xl bg-white border border-red-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Expired</span>
                        <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                            <XCircle className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900">{stats?.expired_credentials ?? 0}</div>
                        <p className="text-xs text-slate-500 mt-0.5">Expired credentials on file</p>
                    </div>
                </div>

                {/* Card 3: Non-Compliant Staff */}
                <div
                    onClick={() => setActiveTab('matrix')}
                    className="cursor-pointer p-5 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Non-Compliant Staff</span>
                        <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                            <UserX className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900">{stats?.non_compliant_employees ?? 0}</div>
                        <p className="text-xs text-slate-500 mt-0.5">Employees with missing/expired checks</p>
                    </div>
                </div>
            </div>

            {/* Other 5 Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Total Credentials</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{stats?.total_credentials ?? 0}</div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-emerald-600 uppercase">Active & Valid</span>
                    <div className="text-2xl font-bold text-emerald-700 mt-1">{stats?.active_credentials ?? 0}</div>
                </div>

                <div
                    onClick={() => { setExpiryPeriod('60'); setActiveTab('expiring'); }}
                    className="cursor-pointer p-4 rounded-2xl bg-white border border-indigo-100 hover:border-indigo-300 shadow-xs transition-colors"
                >
                    <span className="text-[11px] font-bold text-indigo-600 uppercase">Expiring in 60 Days</span>
                    <div className="text-2xl font-bold text-indigo-900 mt-1">{stats?.expiring_60_days ?? 0}</div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-amber-100 shadow-xs">
                    <span className="text-[11px] font-bold text-amber-700 uppercase">Pending Review</span>
                    <div className="text-2xl font-bold text-amber-800 mt-1">{stats?.pending_verification ?? 0}</div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-purple-100 shadow-xs">
                    <span className="text-[11px] font-bold text-purple-700 uppercase">Missing Required</span>
                    <div className="text-2xl font-bold text-purple-900 mt-1">{stats?.missing_required_credentials ?? 0}</div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                    <div className="relative w-full md:w-80">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            placeholder="Search employee, credential..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
                        {/* Expiry Period Filter */}
                        <select
                            value={expiryPeriod}
                            onChange={(e) => setExpiryPeriod(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 outline-none"
                        >
                            <option value="all">All Expiry Periods</option>
                            <option value="30">Expiring in 30 Days</option>
                            <option value="60">Expiring in 60 Days</option>
                            <option value="expired">Expired Records</option>
                        </select>

                        {/* Category Filter */}
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 outline-none"
                        >
                            <option value="">All Categories</option>
                            <option value="ece">ECE Credentials</option>
                            <option value="certification">Certifications (First Aid/CPR)</option>
                            <option value="background_check">Background Checks (VSC/CRC)</option>
                            <option value="training">Required Training</option>
                        </select>

                        {/* Credential Type Filter */}
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 outline-none max-w-[180px]"
                        >
                            <option value="">All Credential Types</option>
                            {credentialTypes.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>

                        {/* Province Filter */}
                        <select
                            value={selectedProvince}
                            onChange={(e) => setSelectedProvince(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 outline-none"
                        >
                            <option value="">All Provinces</option>
                            {provinces.map(p => (
                                <option key={p.id} value={p.code}>{p.name} ({p.code})</option>
                            ))}
                        </select>


                        {(selectedProvince || selectedType || selectedCategory || expiryPeriod !== 'all' || searchQuery) && (
                            <button
                                onClick={handleResetFilters}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Navigation Tabs for Views */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('expiring')}
                    className={`px-5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'expiring'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Clock className="w-4 h-4" />
                    Expiring & Expired Credentials ({filteredExpiringList.length})
                </button>
                <button
                    onClick={() => setActiveTab('matrix')}
                    className={`px-5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'matrix'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <ShieldCheck className="w-4 h-4" />
                    Staff Compliance Matrix ({filteredEmployeeMatrix.length})
                </button>
            </div>

            {/* VIEW 1: Expiring & Expired Credentials Table */}
            {activeTab === 'expiring' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="py-3 px-4">Employee</th>
                                    <th className="py-3 px-4">Credential</th>
                                    <th className="py-3 px-4">Category</th>
                                    <th className="py-3 px-4">Province</th>
                                    <th className="py-3 px-4">Expiry Date</th>
                                    <th className="py-3 px-4">Days Remaining</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredExpiringList.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-slate-500">
                                            No credentials match the selected expiry criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredExpiringList.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-900">{item.employee_name}</div>
                                                {item.employee_number && (
                                                    <div className="text-[10px] text-slate-400 font-mono">#{item.employee_number}</div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 font-semibold text-slate-800">
                                                {item.credential_name}
                                                {item.certificate_number && (
                                                    <div className="text-[10px] text-slate-400 font-mono">{item.certificate_number}</div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600">
                                                {item.category_display}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px]">
                                                    {item.province_code}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 font-medium text-slate-700">
                                                {item.expiry_date || 'N/A'}
                                            </td>
                                            <td className="py-3 px-4">
                                                {getDaysRemainingBadge(item.days_remaining)}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                                                    item.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right space-x-2">
                                                <button
                                                    onClick={() => navigate(`/daycare/employees/${item.employee_id}`)}
                                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs transition-colors"
                                                >
                                                    Manage
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* VIEW 2: Staff Compliance Matrix & Missing Requirements */}
            {activeTab === 'matrix' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="py-3 px-4">Employee</th>
                                    <th className="py-3 px-4">Role</th>
                                    <th className="py-3 px-4">Compliance Status</th>
                                    <th className="py-3 px-4 text-center">ECE Credential</th>
                                    <th className="py-3 px-4 text-center">First Aid & CPR</th>
                                    <th className="py-3 px-4 text-center">Police / VSC</th>
                                    <th className="py-3 px-4">Details / Missing Items</th>
                                    <th className="py-3 px-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredEmployeeMatrix.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-slate-500">
                                            No employee records found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEmployeeMatrix.map(emp => (
                                        <tr key={emp.employee_id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-3 px-4 font-bold text-slate-900">
                                                {emp.employee_name}
                                                {emp.employee_number && (
                                                    <div className="text-[10px] text-slate-400 font-mono">#{emp.employee_number}</div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600">
                                                {emp.job_title}
                                            </td>
                                            <td className="py-3 px-4">
                                                {getComplianceStatusBadge(emp.compliance_status)}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {emp.has_ece ? (
                                                    <span className="inline-flex p-1 bg-emerald-100 text-emerald-700 rounded-full"><Check className="w-3.5 h-3.5" /></span>
                                                ) : (
                                                    <span className="inline-flex p-1 bg-slate-100 text-slate-400 rounded-full"><X className="w-3.5 h-3.5" /></span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {emp.has_first_aid ? (
                                                    <span className="inline-flex p-1 bg-emerald-100 text-emerald-700 rounded-full"><Check className="w-3.5 h-3.5" /></span>
                                                ) : (
                                                    <span className="inline-flex p-1 bg-red-100 text-red-700 rounded-full"><X className="w-3.5 h-3.5" /></span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {emp.has_background_check ? (
                                                    <span className="inline-flex p-1 bg-emerald-100 text-emerald-700 rounded-full"><Check className="w-3.5 h-3.5" /></span>
                                                ) : (
                                                    <span className="inline-flex p-1 bg-red-100 text-red-700 rounded-full"><X className="w-3.5 h-3.5" /></span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {emp.missing_required.length > 0 ? (
                                                    <div className="text-red-700 font-bold flex items-center gap-1">
                                                        <FileWarning className="w-3.5 h-3.5 flex-shrink-0" />
                                                        Missing: {emp.missing_required.join(', ')}
                                                    </div>
                                                ) : emp.expiring_credentials.length > 0 ? (
                                                    <div className="text-amber-800 font-medium">
                                                        {emp.expiring_credentials.join(', ')}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 text-[11px]">All required checks complete</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    onClick={() => navigate(`/daycare/employees/${emp.employee_id}`)}
                                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs transition-colors"
                                                >
                                                    View Profile
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            </div>
        </Layout>
    );
};

export default CredentialComplianceDashboard;


