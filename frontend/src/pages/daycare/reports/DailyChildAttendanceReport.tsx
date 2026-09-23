import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
    Calendar, Download, RefreshCw, Search, 
    Filter, CheckCircle2, XCircle, Clock, 
    ChevronRight, ArrowLeft, Printer, School
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';
import { useNavigate } from 'react-router-dom';

interface DailyReportRecord {
    id: string;
    student_id: string;
    student_name: string;
    admission_number: string | null;
    classroom_name: string;
    branch_name: string;
    check_in_time: string | null;
    check_out_time: string | null;
    status: string;
    is_late: boolean;
    is_early_pickup: boolean;
    late_reason: string;
    remarks: string;
    received_by_name: string | null;
    released_by_name: string | null;
    pickup_person_name: string | null;
}

const DailyChildAttendanceReport: React.FC = () => {
    const navigate = useNavigate();
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [classrooms, setClassrooms] = useState<{ id: string; room_name: string }[]>([]);
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [records, setRecords] = useState<DailyReportRecord[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [cRes, bRes] = await Promise.all([
                    api.get('/classrooms/'),
                    api.get('/branches/')
                ]);
                setClassrooms(Array.isArray(cRes.data) ? cRes.data : (cRes.data.results || []));
                setBranches(Array.isArray(bRes.data) ? bRes.data : (bRes.data.results || []));
            } catch (err) {
                console.error("Failed to load dropdowns:", err);
            }
        };
        fetchFilters();
    }, []);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await api.get('/daycare/reports/attendance/daily/', {
                params: {
                    date: selectedDate,
                    classroom: selectedClassroom !== 'all' ? selectedClassroom : undefined,
                    branch: selectedBranch !== 'all' ? selectedBranch : undefined,
                    status: selectedStatus !== 'all' ? selectedStatus : undefined,
                    search: searchQuery || undefined
                }
            });
            setSummary(res.data.summary);
            setRecords(res.data.records || []);
        } catch (err) {
            console.error("Report fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [selectedDate, selectedClassroom, selectedBranch, selectedStatus]);

    const exportCSV = () => {
        const url = `/api/daycare/reports/attendance/daily/?date=${selectedDate}&export=csv${
            selectedClassroom !== 'all' ? `&classroom=${selectedClassroom}` : ''
        }${selectedBranch !== 'all' ? `&branch=${selectedBranch}` : ''}${
            selectedStatus !== 'all' ? `&status=${selectedStatus}` : ''
        }`;
        window.open(url, '_blank');
    };

    const handlePrint = () => {
        window.print();
    };

    const filteredRecords = useMemo(() => {
        if (!searchQuery.trim()) return records;
        const q = searchQuery.toLowerCase();
        return records.filter(r => 
            r.student_name.toLowerCase().includes(q) ||
            r.classroom_name.toLowerCase().includes(q) ||
            (r.admission_number && r.admission_number.toLowerCase().includes(q))
        );
    }, [records, searchQuery]);

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
                        <h1 className="text-2xl font-bold text-gray-900">Daily Child Attendance Report</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Detailed child check-in/out records, arrival classifications, and educator sign-offs.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs flex items-center gap-1.5 transition"
                        >
                            <Printer className="w-4 h-4 text-slate-500" />
                            Print Report
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

                {/* Summary KPIs */}
                {summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] uppercase font-semibold text-slate-400">Total Enrolled</p>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{summary.total_records}</h3>
                        </div>
                        <div className="bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                            <p className="text-[10px] uppercase font-semibold text-emerald-600">Present</p>
                            <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{summary.present}</h3>
                        </div>
                        <div className="bg-rose-50/50 dark:bg-rose-950/30 p-3.5 rounded-xl border border-rose-200 dark:border-rose-800/40">
                            <p className="text-[10px] uppercase font-semibold text-rose-600">Absent</p>
                            <h3 className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">{summary.absent}</h3>
                        </div>
                        <div className="bg-blue-50/50 dark:bg-blue-950/30 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800/40">
                            <p className="text-[10px] uppercase font-semibold text-blue-600">Excused</p>
                            <h3 className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-1">{summary.excused}</h3>
                        </div>
                        <div className="bg-amber-50/50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40">
                            <p className="text-[10px] uppercase font-semibold text-amber-600">Late Arrivals</p>
                            <h3 className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{summary.late}</h3>
                        </div>
                        <div className="bg-violet-50/50 dark:bg-violet-950/30 p-3.5 rounded-xl border border-violet-200 dark:border-violet-800/40">
                            <p className="text-[10px] uppercase font-semibold text-violet-600">Early Pickups</p>
                            <h3 className="text-xl font-bold text-violet-700 dark:text-violet-300 mt-1">{summary.early_pickup}</h3>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                    <div>
                        <label className="block text-slate-400 font-medium mb-1">Date</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        />
                    </div>

                    <div>
                        <label className="block text-slate-400 font-medium mb-1">Classroom</label>
                        <select
                            value={selectedClassroom}
                            onChange={e => setSelectedClassroom(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        >
                            <option value="all">All Classrooms</option>
                            {classrooms.map(c => (
                                <option key={c.id} value={c.id}>{c.room_name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-slate-400 font-medium mb-1">Branch</label>
                        <select
                            value={selectedBranch}
                            onChange={e => setSelectedBranch(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        >
                            <option value="all">All Branches</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-slate-400 font-medium mb-1">Status</label>
                        <select
                            value={selectedStatus}
                            onChange={e => setSelectedStatus(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        >
                            <option value="all">All Statuses</option>
                            <option value="PRESENT">Present</option>
                            <option value="ABSENT">Absent</option>
                            <option value="EXCUSED">Excused</option>
                            <option value="LATE">Late</option>
                            <option value="EARLY_PICKUP">Early Pickup</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-slate-400 font-medium mb-1">Search Child</label>
                        <input
                            type="text"
                            placeholder="Name or ID..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        />
                    </div>
                </div>

                {/* Records Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                    <th className="p-4">Child</th>
                                    <th className="p-4">Classroom</th>
                                    <th className="p-4">Check In</th>
                                    <th className="p-4">Check Out</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Received / Released By</th>
                                    <th className="p-4">Notes & Exceptions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-slate-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                                            Loading daily report...
                                        </td>
                                    </tr>
                                ) : filteredRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-slate-500">
                                            No attendance records found for this filter selection.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                            <td className="p-4">
                                                <p className="font-semibold text-slate-900 dark:text-slate-100">{r.student_name}</p>
                                                {r.admission_number && (
                                                    <p className="text-[10px] text-slate-400">ID: {r.admission_number}</p>
                                                )}
                                            </td>
                                            <td className="p-4 font-medium text-slate-700 dark:text-slate-300">
                                                {r.classroom_name}
                                            </td>
                                            <td className="p-4 font-mono text-slate-800 dark:text-slate-200">
                                                {r.check_in_time || '--:--'}
                                            </td>
                                            <td className="p-4 font-mono text-slate-800 dark:text-slate-200">
                                                {r.check_out_time || '--:--'}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                    r.status === 'PRESENT' || r.status === 'Present'
                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                        : r.status === 'LATE' || r.status === 'Late'
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                        : r.status === 'ABSENT' || r.status === 'Absent'
                                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                                }`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-600 dark:text-slate-400">
                                                <p>In: {r.received_by_name || 'Staff'}</p>
                                                {r.released_by_name && <p>Out: {r.released_by_name}</p>}
                                                {r.pickup_person_name && <p className="text-[10px] text-slate-400">By: {r.pickup_person_name}</p>}
                                            </td>
                                            <td className="p-4 text-slate-500 text-[11px]">
                                                {r.late_reason && <p className="text-amber-600 dark:text-amber-400 font-medium">Late: {r.late_reason}</p>}
                                                {r.remarks && <p>{r.remarks}</p>}
                                                {!r.late_reason && !r.remarks && <span className="text-slate-400">-</span>}
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

export default DailyChildAttendanceReport;
