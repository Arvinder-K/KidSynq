import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    BarChart3, Search, Users,
    FileSpreadsheet, AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react';

import Layout from '../../../components/Layout';
import { employeeService, type StaffReportData, type EmployeeType } from '../../../api/employeeService';
import api from '../../../api';

const REPORTS = [
    { id: 'directory', name: 'Employee Directory', desc: 'Comprehensive listing of all staff members and core details.' },
    { id: 'status', name: 'Employee Status Report', desc: 'Breakdown of active, on-leave, suspended, and terminated staff.' },
    { id: 'type', name: 'Employee Type & Roles', desc: 'Staff categorization and classroom teaching eligibility.' },
    { id: 'employment_history', name: 'Employment History Report', desc: 'Historical record of role changes, departments, and tenures.' },
    { id: 'qualifications', name: 'Qualification Report', desc: 'Degrees, diplomas, institutions, and completion dates.' },
    { id: 'certifications', name: 'Certification Expiry Report', desc: 'First Aid, CPR, background checks with expiry tracking.' },
    { id: 'documents', name: 'Document Expiry Report', desc: 'Uploaded employee compliance documents and renewal dates.' },
    { id: 'assignments', name: 'Classroom Staff Assignment', desc: 'Active and past Primary & Assistant Teacher room assignments.' },
    { id: 'availability', name: 'Staff Availability Report', desc: 'Weekly work schedules and daily shift availability.' },
    { id: 'compensation', name: 'Compensation Report', desc: 'Salary, hourly rates, and pay types (Admin only).' },
];

const StaffReports: React.FC = () => {
    const [selectedReport, setSelectedReport] = useState('directory');
    const [reportData, setReportData] = useState<StaffReportData | null>(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [classroomFilter, setClassroomFilter] = useState('');
    const [typesList, setTypesList] = useState<EmployeeType[]>([]);
    const [classroomsList, setClassroomsList] = useState<any[]>([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const types = await employeeService.getEmployeeTypes();
                setTypesList(types);
                const classRes = await api.get('/classrooms/');
                setClassroomsList(classRes.data || []);
            } catch (e) {
                console.error("Failed to load filter options", e);
            }
        };
        fetchFilters();
    }, []);

    const fetchReport = async () => {
        try {
            setLoading(true);
            setError(null);
            const params: any = {
                report_type: selectedReport,
            };
            if (search) params.search = search;
            if (statusFilter) params.status = statusFilter;
            if (typeFilter) params.employee_type = typeFilter;
            if (classroomFilter) params.classroom = classroomFilter;

            const res = await employeeService.getStaffReports(params);
            setReportData(res);
            setCurrentPage(1);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to generate report.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [selectedReport, statusFilter, typeFilter, classroomFilter]);

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
            if (statusFilter) params.status = statusFilter;
            if (typeFilter) params.employee_type = typeFilter;
            if (classroomFilter) params.classroom = classroomFilter;

            await employeeService.exportStaffReportsCsv(params);
        } catch (err: any) {
            setError("Failed to export CSV file.");
        } finally {
            setExporting(false);
        }
    };

    // Client-side pagination for rendered rows
    const allRows = reportData?.rows || [];
    const totalPages = Math.ceil(allRows.length / itemsPerPage) || 1;
    const paginatedRows = allRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <Layout>
            <div className="space-y-6 max-w-7xl mx-auto font-sans">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm mb-1">
                            <BarChart3 className="w-4 h-4" /> Reporting & Analytics
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Staff & Compliance Reports</h1>
                        <p className="text-slate-500 text-sm mt-1">Generate, filter, and export administrative staff reports.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            to="/daycare/employees/dashboard"
                            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 font-medium rounded-xl text-sm transition-colors shadow-sm"
                        >
                            Staff Dashboard
                        </Link>
                        <button
                            onClick={handleExportCsv}
                            disabled={exporting || allRows.length === 0}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                        >
                            {exporting ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <FileSpreadsheet className="w-4 h-4" />
                            )}
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Report Selector Grid */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Select Report Type</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {REPORTS.map((rep) => {
                            const isSelected = selectedReport === rep.id;
                            return (
                                <button
                                    key={rep.id}
                                    type="button"
                                    onClick={() => setSelectedReport(rep.id)}
                                    className={`p-3.5 rounded-xl border text-left transition-all ${
                                        isSelected
                                            ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-200 shadow-sm'
                                            : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/70'
                                    }`}
                                >
                                    <div className="font-bold text-sm text-slate-900 mb-1">{rep.name}</div>
                                    <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{rep.desc}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                    <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by name, ID..."
                                className="w-full pl-10 pr-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div>
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="on_leave">On Leave</option>
                                <option value="suspended">Suspended</option>
                                <option value="terminated">Terminated</option>
                            </select>
                        </div>

                        <div>
                            <select
                                value={typeFilter}
                                onChange={e => setTypeFilter(e.target.value)}
                                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">All Roles / Types</option>
                                {typesList.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <select
                                value={classroomFilter}
                                onChange={e => setClassroomFilter(e.target.value)}
                                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">All Classrooms</option>
                                {classroomsList.map(c => (
                                    <option key={c.id} value={c.id}>{c.room_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm"
                            >
                                Filter
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch('');
                                    setStatusFilter('');
                                    setTypeFilter('');
                                    setClassroomFilter('');
                                }}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-xl text-sm transition-colors"
                                title="Clear filters"
                            >
                                Reset
                            </button>
                        </div>
                    </form>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" /> {error}
                    </div>
                )}

                {/* Report Table Card */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">{reportData?.title || 'Report Output'}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Showing {allRows.length} total records found matching current filters.</p>
                        </div>
                        <span className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
                            Page {currentPage} of {totalPages}
                        </span>
                    </div>

                    {loading ? (
                        <div className="p-16 flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : allRows.length === 0 ? (
                        <div className="p-16 text-center text-slate-400">
                            <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                            <h4 className="font-semibold text-slate-700">No records found</h4>
                            <p className="text-xs text-slate-400 mt-1">Try adjusting your filter criteria or search terms.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50/75 text-slate-600 font-bold border-b border-slate-100">
                                    <tr>
                                        {reportData?.headers.map((h, idx) => (
                                            <th key={idx} className="px-5 py-3.5 whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedRows.map((row, rIdx) => (
                                        <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                                            {row.map((cell, cIdx) => (
                                                <td key={cIdx} className="px-5 py-3.5 whitespace-nowrap text-slate-700">
                                                    {cIdx === 1 ? (
                                                        <span className="font-bold text-slate-900">{cell}</span>
                                                    ) : cell === 'Active' || cell === 'Valid' || cell === 'Yes' ? (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                                                            {cell}
                                                        </span>
                                                    ) : cell === 'Expired' || cell === 'Terminated' || cell === 'Suspended' ? (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700">
                                                            {cell}
                                                        </span>
                                                    ) : cell === 'On Leave' ? (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                                                            {cell}
                                                        </span>
                                                    ) : (
                                                        cell
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <span className="text-xs text-slate-500 font-medium">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, allRows.length)} of {allRows.length}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-xs font-bold text-slate-700 px-2">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default StaffReports;
