import React, { useEffect, useState } from 'react';
import {
    Award, ShieldCheck, Clock, XCircle, AlertTriangle,
    FileSpreadsheet, Search, RefreshCw, Printer,
    FileCheck, HeartPulse, BookOpen, UtensilsCrossed,
    Users, History, ChevronLeft, ChevronRight,
    Eye, X, Copy, Check, FileText
} from 'lucide-react';

import Layout from '../../../components/Layout';
import {
    employeeService,
    type CredentialReportData,
    type Province,
    type CredentialType
} from '../../../api/employeeService';

const CREDENTIAL_REPORTS = [
    { id: 'ece', name: 'ECE Credential Report', icon: Award, desc: 'Registered Early Childhood Educators (RECE), ECE Level 1/2/3 and assistants.' },
    { id: 'certification', name: 'Certification Report', icon: FileCheck, desc: 'All certifications including First Aid, CPR, Food Safety, and specialized credentials.' },
    { id: 'expiring', name: 'Expiring Credential Report', icon: Clock, desc: 'Certificates expiring within the next 30, 60, or 90 days requiring immediate renewal.' },
    { id: 'expired', name: 'Expired Credential Report', icon: XCircle, desc: 'All expired staff credentials and checks requiring administrative action.' },
    { id: 'missing', name: 'Missing Credential Report', icon: AlertTriangle, desc: 'Active employees missing mandatory role-specific credentials and background checks.' },
    { id: 'background_check', name: 'Background Check Report', icon: ShieldCheck, desc: 'Vulnerable Sector Checks (VSC), Criminal Record Checks (CRC), and Judicial Matters.' },
    { id: 'first_aid', name: 'First Aid Report', icon: HeartPulse, desc: 'Standard First Aid & Emergency First Aid certifications across all daycare staff.' },
    { id: 'cpr', name: 'CPR Report', icon: HeartPulse, desc: 'CPR Level C, HCP, and Basic Life Support (BLS) certification tracking.' },
    { id: 'food_safety', name: 'Food Safety Report', icon: UtensilsCrossed, desc: 'Certified Food Handler and kitchen sanitation credentials.' },
    { id: 'training', name: 'Training Compliance Report', icon: BookOpen, desc: 'Mandatory professional development, health & safety, and accessibility training.' },
    { id: 'employee_compliance', name: 'Employee Compliance Report', icon: Users, desc: 'Comprehensive staff compliance matrix with overall statuses and individual checks.' },
    { id: 'renewals', name: 'Credential Renewal Report', icon: History, desc: 'Historical renewal chains, superseded certificates, and renewal timelines.' },
];

export const CredentialReports: React.FC = () => {
    const [selectedReport, setSelectedReport] = useState('ece');
    const [reportData, setReportData] = useState<CredentialReportData | null>(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Selected row for detail modal
    const [selectedRecord, setSelectedRecord] = useState<{ columns: string[]; values: any[] } | null>(null);
    const [copied, setCopied] = useState(false);


    // Filters
    const [search, setSearch] = useState('');
    const [provinceFilter, setProvinceFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [expiryPeriodFilter, setExpiryPeriodFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [provinces, setProvinces] = useState<Province[]>([]);
    const [credentialTypes, setCredentialTypes] = useState<CredentialType[]>([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    useEffect(() => {
        const loadFilterOptions = async () => {
            try {
                const [provs, types] = await Promise.all([
                    employeeService.getProvinces(),
                    employeeService.getCredentialTypes()
                ]);
                setProvinces(provs);
                setCredentialTypes(types);
            } catch (err) {
                console.error("Failed to load report filter options", err);
            }
        };
        loadFilterOptions();
    }, []);

    const fetchReport = async () => {
        try {
            setLoading(true);
            setError(null);
            const params: any = {
                report_type: selectedReport,
            };
            if (search) params.search = search;
            if (provinceFilter) params.province = provinceFilter;
            if (typeFilter) params.credential_type = typeFilter;
            if (statusFilter) params.status = statusFilter;
            if (expiryPeriodFilter) params.expiry_period = expiryPeriodFilter;
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const res = await employeeService.getCredentialReports(params);
            setReportData(res);
            setCurrentPage(1);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to generate compliance report.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [selectedReport, provinceFilter, typeFilter, statusFilter, expiryPeriodFilter]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchReport();
    };

    const handleExportCsv = async () => {
        try {
            setExporting(true);
            const params: any = {
                report_type: selectedReport,
            };
            if (search) params.search = search;
            if (provinceFilter) params.province = provinceFilter;
            if (typeFilter) params.credential_type = typeFilter;
            if (statusFilter) params.status = statusFilter;
            if (expiryPeriodFilter) params.expiry_period = expiryPeriodFilter;
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            await employeeService.exportCredentialReportsCsv(params);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to export CSV report.");
        } finally {
            setExporting(false);
        }
    };

    const handleResetFilters = () => {
        setSearch('');
        setProvinceFilter('');
        setTypeFilter('');
        setStatusFilter('');
        setExpiryPeriodFilter('');
        setStartDate('');
        setEndDate('');
        fetchReport();
    };

    // Calculate paginated rows
    const rows = reportData?.rows || [];
    const totalPages = Math.ceil(rows.length / itemsPerPage) || 1;
    const paginatedRows = rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const activeReportObj = CREDENTIAL_REPORTS.find(r => r.id === selectedReport) || CREDENTIAL_REPORTS[0];

    return (
        <Layout>
            <div className="space-y-6 pb-12">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                            <FileSpreadsheet className="w-7 h-7 text-indigo-600" />
                            ECE & CREDENTIAL COMPLIANCE REPORTS
                        </h1>
                        <p className="text-xs text-slate-500 mt-1">
                            Exportable audit and compliance reports for provincial regulatory reviews, licensing, and credential renewal tracking.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={handleExportCsv}
                            disabled={exporting || loading}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            {exporting ? 'Exporting...' : 'Export CSV'}
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-colors"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            Print
                        </button>
                        <button
                            onClick={fetchReport}
                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-slate-200"
                            title="Refresh Report"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-medium flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                    </div>
                )}

                {/* 2-Column Layout: Reports Selector Sidebar + Main Report Table */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                    {/* Left Column: 12 Selectable Reports */}
                    <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200 shadow-xs p-3 space-y-1">
                        <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Available Reports (12)
                        </div>
                        {CREDENTIAL_REPORTS.map((report) => {
                            const IconComponent = report.icon;
                            const isSelected = selectedReport === report.id;
                            return (
                                <button
                                    key={report.id}
                                    onClick={() => setSelectedReport(report.id)}
                                    className={`w-full text-left p-3 rounded-2xl transition-all flex items-start gap-3 ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                >
                                    <div className={`p-2 rounded-xl flex-shrink-0 ${
                                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-indigo-600'
                                    }`}>
                                        <IconComponent className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                            {report.name}
                                        </div>
                                        <div className={`text-[11px] line-clamp-2 mt-0.5 leading-snug ${
                                            isSelected ? 'text-indigo-100' : 'text-slate-400'
                                        }`}>
                                            {report.desc}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right Column: Active Report & Filter Bar & Table */}
                    <div className="lg:col-span-3 space-y-4">
                        {/* Report Header Card */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                                    Report Preview
                                </span>
                                <h2 className="text-xl font-black text-slate-900 mt-2 tracking-tight">
                                    {reportData?.title || activeReportObj.name}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {activeReportObj.desc}
                                </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <span className="text-2xl font-black text-indigo-700">
                                    {reportData?.total ?? 0}
                                </span>
                                <div className="text-[11px] font-semibold text-slate-400 uppercase">Records Found</div>
                            </div>
                        </div>

                        {/* Filter Toolbar */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-2">
                                <div className="relative flex-1 w-full">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                    <input
                                        type="text"
                                        placeholder="Search employee, certificate number..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors"
                                >
                                    Filter
                                </button>
                            </form>

                            <div className="flex items-center gap-2 flex-wrap text-xs">
                                {/* Province Filter */}
                                <select
                                    value={provinceFilter}
                                    onChange={(e) => setProvinceFilter(e.target.value)}
                                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 outline-none"
                                >
                                    <option value="">All Provinces</option>
                                    {provinces.map(p => (
                                        <option key={p.id} value={p.code}>{p.name} ({p.code})</option>
                                    ))}
                                </select>

                                {/* Credential Type Filter */}
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 outline-none max-w-[180px]"
                                >
                                    <option value="">All Credential Types</option>
                                    {credentialTypes.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>

                                {/* Status Filter */}
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 outline-none"
                                >
                                    <option value="">All Statuses</option>
                                    <option value="Active">Active</option>
                                    <option value="Pending Review">Pending Review</option>
                                    <option value="Superseded">Superseded</option>
                                    <option value="Inactive">Inactive</option>
                                    <option value="Revoked">Revoked</option>
                                </select>

                                {/* Expiry Filter */}
                                <select
                                    value={expiryPeriodFilter}
                                    onChange={(e) => setExpiryPeriodFilter(e.target.value)}
                                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 outline-none font-semibold text-slate-700"
                                >
                                    <option value="">All Expiry Limits</option>
                                    <option value="30">Expiring in 30 Days</option>
                                    <option value="60">Expiring in 60 Days</option>
                                    <option value="90">Expiring in 90 Days</option>
                                </select>

                                {(search || provinceFilter || typeFilter || statusFilter || expiryPeriodFilter || startDate || endDate) && (
                                    <button
                                        onClick={handleResetFilters}
                                        className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Report Data Table */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                            {loading ? (
                                <div className="py-16 flex justify-center items-center">
                                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                                            <tr>
                                                {reportData?.columns.map((col, idx) => (
                                                    <th key={idx} className="py-3.5 px-4 whitespace-nowrap">
                                                        {col}
                                                    </th>
                                                ))}
                                                <th className="py-3.5 px-4 text-right whitespace-nowrap">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {paginatedRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={(reportData?.columns.length || 6) + 1} className="py-12 text-center text-slate-500">
                                                        No records found for the selected report and filter criteria.
                                                    </td>
                                                </tr>
                                            ) : (
                                                paginatedRows.map((row, rowIdx) => (
                                                    <tr 
                                                        key={rowIdx} 
                                                        onClick={() => setSelectedRecord({ columns: reportData?.columns || [], values: row })}
                                                        className="hover:bg-indigo-50/50 cursor-pointer transition-colors group"
                                                    >
                                                        {row.map((cell, cellIdx) => {
                                                            const cellStr = String(cell ?? '');
                                                            const isStatus = cellStr === 'Active' || cellStr === 'COMPLIANT' || cellStr === 'Verified' || cellStr === 'Compliant';
                                                            const isWarning = cellStr === 'WARNING' || cellStr.includes('Expires in') || cellStr === 'Expiring Soon' || cellStr === 'Pending Review';
                                                            const isDanger = cellStr === 'NON_COMPLIANT' || cellStr === 'Expired' || cellStr === 'Rejected' || cellStr.includes('Missing');

                                                            return (
                                                                <td key={cellIdx} className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                                                                    {isStatus ? (
                                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                            {cellStr}
                                                                        </span>
                                                                    ) : isWarning ? (
                                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                                                            {cellStr}
                                                                        </span>
                                                                    ) : isDanger ? (
                                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                                                                            {cellStr}
                                                                        </span>
                                                                    ) : (
                                                                        cellStr
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="py-3 px-4 text-right whitespace-nowrap">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedRecord({ columns: reportData?.columns || [], values: row });
                                                                }}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg text-indigo-600 hover:bg-indigo-100 transition-colors"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                                View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination Controls */}
                            {rows.length > itemsPerPage && (
                                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                    <div>
                                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, rows.length)} of {rows.length} records
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="px-3 font-semibold text-slate-700">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Record Detail Modal */}
                {selectedRecord && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
                        <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
                            {/* Modal Header */}
                            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-600/80 flex items-center justify-center text-white">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-base text-white">Record Information</h3>
                                        <p className="text-xs text-slate-400">
                                            {CREDENTIAL_REPORTS.find(r => r.id === selectedReport)?.name || 'Compliance Report'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedRecord(null)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {selectedRecord.columns.map((colName, idx) => {
                                        const val = selectedRecord.values[idx];
                                        const cellStr = String(val ?? '—');
                                        const isStatus = cellStr === 'Active' || cellStr === 'COMPLIANT' || cellStr === 'Verified' || cellStr === 'Compliant';
                                        const isWarning = cellStr === 'WARNING' || cellStr.includes('Expires in') || cellStr === 'Expiring Soon' || cellStr === 'Pending Review';
                                        const isDanger = cellStr === 'NON_COMPLIANT' || cellStr === 'Expired' || cellStr === 'Rejected' || cellStr.includes('Missing');

                                        return (
                                            <div key={idx} className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                    {colName}
                                                </div>
                                                <div className="text-sm font-semibold text-slate-800 break-words">
                                                    {isStatus ? (
                                                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            {cellStr}
                                                        </span>
                                                    ) : isWarning ? (
                                                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                                            {cellStr}
                                                        </span>
                                                    ) : isDanger ? (
                                                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                                                            {cellStr}
                                                        </span>
                                                    ) : (
                                                        cellStr || '—'
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                                <button
                                    onClick={() => {
                                        const textToCopy = selectedRecord.columns.map((c, i) => `${c}: ${selectedRecord.values[i] || '—'}`).join('\n');
                                        navigator.clipboard.writeText(textToCopy);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors shadow-2xs"
                                >
                                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                                    {copied ? 'Copied to Clipboard!' : 'Copy Info'}
                                </button>
                                <button
                                    onClick={() => setSelectedRecord(null)}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </Layout>
    );
};

export default CredentialReports;
