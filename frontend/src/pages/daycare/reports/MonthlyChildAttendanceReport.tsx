import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
    Calendar, Download, RefreshCw, Search, 
    Filter, ArrowLeft, Printer, School, User, TrendingUp
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';
import { useNavigate } from 'react-router-dom';

interface MonthlyChildSummary {
    student_id: string;
    student_name: string;
    admission_number: string | null;
    classroom_name: string;
    enrolled_days: number;
    days_present: number;
    days_absent: number;
    excused_absences: number;
    late_arrivals: number;
    early_pickups: number;
    attendance_percentage: number;
}

const MonthlyChildAttendanceReport: React.FC = () => {
    const navigate = useNavigate();
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
    const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [classrooms, setClassrooms] = useState<{ id: string; room_name: string }[]>([]);
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [students, setStudents] = useState<MonthlyChildSummary[]>([]);
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
                console.error("Failed to load options:", err);
            }
        };
        fetchFilters();
    }, []);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await api.get('/daycare/reports/attendance/monthly/', {
                params: {
                    year: selectedYear,
                    month: selectedMonth,
                    classroom: selectedClassroom !== 'all' ? selectedClassroom : undefined,
                    branch: selectedBranch !== 'all' ? selectedBranch : undefined
                }
            });
            setSummary(res.data.summary);
            setStudents(res.data.students || []);
        } catch (err) {
            console.error("Monthly report fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [selectedYear, selectedMonth, selectedClassroom, selectedBranch]);

    const exportCSV = () => {
        const url = `/api/daycare/reports/attendance/monthly/?year=${selectedYear}&month=${selectedMonth}&export=csv${
            selectedClassroom !== 'all' ? `&classroom=${selectedClassroom}` : ''
        }${selectedBranch !== 'all' ? `&branch=${selectedBranch}` : ''}`;
        window.open(url, '_blank');
    };

    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(s =>
            s.student_name.toLowerCase().includes(q) ||
            s.classroom_name.toLowerCase().includes(q) ||
            (s.admission_number && s.admission_number.toLowerCase().includes(q))
        );
    }, [students, searchQuery]);

    const months = [
        { val: 1, name: 'January' }, { val: 2, name: 'February' }, { val: 3, name: 'March' },
        { val: 4, name: 'April' }, { val: 5, name: 'May' }, { val: 6, name: 'June' },
        { val: 7, name: 'July' }, { val: 8, name: 'August' }, { val: 9, name: 'September' },
        { val: 10, name: 'October' }, { val: 11, name: 'November' }, { val: 12, name: 'December' }
    ];

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
                        <h1 className="text-2xl font-bold text-gray-900">Monthly Child Attendance Report</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Centralized monthly attendance percentages, enrolled days analysis, and absence summaries.
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

                {/* Summary KPIs */}
                {summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] uppercase font-semibold text-slate-400">Total Children</p>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{summary.total_children}</h3>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] uppercase font-semibold text-slate-400">Operating Days</p>
                            <h3 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{summary.total_operating_days} days</h3>
                        </div>
                        <div className="bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                            <p className="text-[10px] uppercase font-semibold text-emerald-600">Total Present Days</p>
                            <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{summary.total_days_present}</h3>
                        </div>
                        <div className="bg-rose-50/50 dark:bg-rose-950/30 p-3.5 rounded-xl border border-rose-200 dark:border-rose-800/40">
                            <p className="text-[10px] uppercase font-semibold text-rose-600">Total Absences</p>
                            <h3 className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">{summary.total_days_absent}</h3>
                        </div>
                        <div className="bg-amber-50/50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40">
                            <p className="text-[10px] uppercase font-semibold text-amber-600">Late Arrivals</p>
                            <h3 className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{summary.total_late_arrivals}</h3>
                        </div>
                        <div className="bg-violet-50/50 dark:bg-violet-950/30 p-3.5 rounded-xl border border-violet-200 dark:border-violet-800/40">
                            <p className="text-[10px] uppercase font-semibold text-violet-600">Early Pickups</p>
                            <h3 className="text-xl font-bold text-violet-700 dark:text-violet-300 mt-1">{summary.total_early_pickups}</h3>
                        </div>
                    </div>
                )}

                {/* Filters Bar */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                    <div>
                        <label className="block text-slate-400 font-medium mb-1">Month</label>
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(parseInt(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        >
                            {months.map(m => (
                                <option key={m.val} value={m.val}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-slate-400 font-medium mb-1">Year</label>
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(parseInt(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
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
                        <label className="block text-slate-400 font-medium mb-1">Search Student</label>
                        <input
                            type="text"
                            placeholder="Name or ID..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                    <th className="p-4">Student</th>
                                    <th className="p-4">Classroom</th>
                                    <th className="p-4 text-center">Enrolled Days</th>
                                    <th className="p-4 text-center">Present</th>
                                    <th className="p-4 text-center">Absent</th>
                                    <th className="p-4 text-center">Excused</th>
                                    <th className="p-4 text-center">Late</th>
                                    <th className="p-4 text-center">Early Pickups</th>
                                    <th className="p-4">Attendance Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="p-12 text-center text-slate-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                                            Loading monthly attendance data...
                                        </td>
                                    </tr>
                                ) : filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-12 text-center text-slate-500">
                                            No student records found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map(s => (
                                        <tr key={s.student_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                            <td className="p-4">
                                                <p className="font-semibold text-slate-900 dark:text-slate-100">{s.student_name}</p>
                                                {s.admission_number && (
                                                    <p className="text-[10px] text-slate-400">ID: {s.admission_number}</p>
                                                )}
                                            </td>
                                            <td className="p-4 font-medium text-slate-700 dark:text-slate-300">
                                                {s.classroom_name}
                                            </td>
                                            <td className="p-4 text-center text-slate-800 dark:text-slate-200 font-medium">
                                                {s.enrolled_days}
                                            </td>
                                            <td className="p-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                                {s.days_present}
                                            </td>
                                            <td className="p-4 text-center font-semibold text-rose-600 dark:text-rose-400">
                                                {s.days_absent}
                                            </td>
                                            <td className="p-4 text-center text-blue-600 dark:text-blue-400">
                                                {s.excused_absences}
                                            </td>
                                            <td className="p-4 text-center text-amber-600 dark:text-amber-400">
                                                {s.late_arrivals}
                                            </td>
                                            <td className="p-4 text-center text-violet-600 dark:text-violet-400">
                                                {s.early_pickups}
                                            </td>
                                            <td className="p-4 w-44">
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            style={{ width: `${s.attendance_percentage}%` }}
                                                            className={`h-full ${
                                                                s.attendance_percentage >= 90
                                                                    ? 'bg-emerald-500'
                                                                    : s.attendance_percentage >= 75
                                                                    ? 'bg-amber-500'
                                                                    : 'bg-rose-500'
                                                            }`}
                                                        />
                                                    </div>
                                                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 w-12 text-right">
                                                        {s.attendance_percentage}%
                                                    </span>
                                                </div>
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

export default MonthlyChildAttendanceReport;
