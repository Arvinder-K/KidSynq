import React, { useState, useEffect } from 'react';
import Layout from '../../../components/Layout';
import { 
    Clock, CheckCircle2, AlertCircle, RefreshCw, PiggyBank
} from 'lucide-react';
import { 
    schedulingService, 
    type OvertimeRecord 
} from '../../../api/schedulingService';
import { employeeService, type Employee } from '../../../api/employeeService';

export const OvertimeManagement: React.FC = () => {
    const [records, setRecords] = useState<OvertimeRecord[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successNotice, setSuccessNotice] = useState<string | null>(null);

    // Filters
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    // Calculate Modal / Action State
    const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
    const [calcDate, setCalcDate] = useState(new Date().toISOString().split('T')[0]);
    const [calcEmployeeId, setCalcEmployeeId] = useState('');
    const [calcThreshold, setCalcThreshold] = useState(8.0);
    const [calculating, setCalculating] = useState(false);

    // Review / Reject Modal
    const [reviewingRecord, setReviewingRecord] = useState<OvertimeRecord | null>(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [processingAction, setProcessingAction] = useState(false);


    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [otData, empData] = await Promise.all([
                schedulingService.getOvertimeRecords({
                    employee: filterEmployee || undefined,
                    status: filterStatus !== 'all' ? filterStatus : undefined,
                    start_date: filterStartDate || undefined,
                    end_date: filterEndDate || undefined,
                }),
                employeeService.getEmployees()
            ]);
            setRecords(otData);
            setEmployees(empData.results || empData || []);
        } catch (err: any) {
            console.error("Failed to load overtime records", err);
            setError("Failed to load overtime records.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filterEmployee, filterStatus, filterStartDate, filterEndDate]);

    const handleCalculate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setCalculating(true);
            await schedulingService.calculateOvertime({
                date: calcDate,
                employee_id: calcEmployeeId || undefined,
                regular_hours_threshold: calcThreshold
            });
            setIsCalcModalOpen(false);
            setSuccessNotice("Overtime calculated successfully from attendance records.");
            fetchData();
            setTimeout(() => setSuccessNotice(null), 3000);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to calculate overtime.");
        } finally {
            setCalculating(false);
        }
    };

    const handleApprove = async (record: OvertimeRecord, depositToBank: boolean) => {
        try {
            setProcessingAction(true);
            await schedulingService.approveOvertime(record.id, depositToBank);
            setReviewingRecord(null);
            setSuccessNotice(`Overtime approved successfully ${depositToBank ? 'and deposited to Time Bank.' : '.'}`);
            fetchData();
            setTimeout(() => setSuccessNotice(null), 3000);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to approve overtime.");
        } finally {
            setProcessingAction(false);
        }
    };

    const handleReject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reviewingRecord) return;
        try {
            setProcessingAction(true);
            await schedulingService.rejectOvertime(reviewingRecord.id, rejectNotes);
            setReviewingRecord(null);
            setRejectNotes('');
            setSuccessNotice("Overtime record rejected.");
            fetchData();
            setTimeout(() => setSuccessNotice(null), 3000);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to reject overtime.");
        } finally {
            setProcessingAction(false);
        }
    };

    const pendingCount = records.filter(r => r.status === 'pending').length;
    const totalOvertimeHours = records.reduce((sum, r) => sum + (r.status === 'approved' ? Number(r.overtime_hours) : 0), 0);
    const pendingOvertimeHours = records.reduce((sum, r) => sum + (r.status === 'pending' ? Number(r.overtime_hours) : 0), 0);

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Overtime Management
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Track scheduled vs actual clocked hours, review overtime requests, and deposit approved hours into Time Bank.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsCalcModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span>Calculate Overtime</span>
                        </button>
                    </div>
                </div>

                {successNotice && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{successNotice}</span>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Summary Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900">{pendingCount}</div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Approvals ({pendingOvertimeHours}h)</div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900">{totalOvertimeHours}h</div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved Overtime Hours</div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <PiggyBank className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900">Time Bank Enabled</div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Deposit directly to balances</div>
                        </div>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                        <select
                            value={filterEmployee}
                            onChange={(e) => setFilterEmployee(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">All Employees</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-40">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                        />
                        <span className="text-slate-400 text-xs">to</span>
                        <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                        />
                    </div>
                </div>

                {/* Overtime Records Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Overtime Log ({records.length})</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Discrepancies between scheduled and actual attendance hours</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-12 text-center text-slate-400 text-xs font-medium">Loading overtime records...</div>
                    ) : records.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-xs">
                            No overtime records found matching your filter criteria.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="p-3.5">Employee</th>
                                        <th className="p-3.5">Date</th>
                                        <th className="p-3.5 text-center">Scheduled</th>
                                        <th className="p-3.5 text-center">Actual Clocked</th>
                                        <th className="p-3.5 text-center">Threshold</th>
                                        <th className="p-3.5 text-center">Overtime</th>
                                        <th className="p-3.5">Status</th>
                                        <th className="p-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {records.map((r) => (
                                        <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                                                    {r.employee_name[0] || 'E'}
                                                </div>
                                                <div>
                                                    <div>{r.employee_name}</div>
                                                    <div className="text-[10px] text-slate-400 font-normal">{r.employee_number || 'No ID'}</div>
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-slate-600 font-medium">{r.date}</td>
                                            <td className="p-3.5 text-center font-semibold text-slate-700">{r.scheduled_hours}h</td>
                                            <td className="p-3.5 text-center font-bold">
                                                {r.actual_hours !== null ? (
                                                    <span className="text-slate-900">{r.actual_hours}h</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-semibold">
                                                        No Clock-in
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-center text-slate-500">{r.regular_hours}h</td>
                                            <td className="p-3.5 text-center font-black text-indigo-600">
                                                +{r.overtime_hours}h
                                            </td>
                                            <td className="p-3.5">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                    r.status === 'approved' 
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : r.status === 'rejected'
                                                            ? 'bg-red-100 text-red-800'
                                                            : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-right">
                                                {r.status === 'pending' ? (
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => handleApprove(r, false)}
                                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors"
                                                            title="Approve as Standard Overtime"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleApprove(r, true)}
                                                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                                                            title="Approve and Deposit to Time Bank"
                                                        >
                                                            <PiggyBank className="w-3.5 h-3.5" />
                                                            <span>To Bank</span>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setReviewingRecord(r);
                                                                setRejectNotes('');
                                                            }}
                                                            className="px-2 py-1 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-lg text-[11px] font-bold transition-colors"
                                                            title="Reject Overtime"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="text-[11px] text-slate-400">
                                                        {r.approved_by_name ? `By ${r.approved_by_name}` : '-'}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Calculate Overtime Modal */}
                {isCalcModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
                            <h3 className="text-base font-bold text-slate-900">Calculate Overtime from Attendance</h3>
                            <p className="text-xs text-slate-500">
                                Compares scheduled staff shifts against actual clocked timesheets for the given date.
                            </p>

                            <form onSubmit={handleCalculate} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Target Date</label>
                                    <input
                                        type="date"
                                        value={calcDate}
                                        onChange={(e) => setCalcDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Employee (Optional)</label>
                                    <select
                                        value={calcEmployeeId}
                                        onChange={(e) => setCalcEmployeeId(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">All Active Employees</option>
                                        {employees.map(e => (
                                            <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Regular Hours Threshold (Daily)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="1"
                                        max="24"
                                        value={calcThreshold}
                                        onChange={(e) => setCalcThreshold(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">Standard full-time daily hours (e.g. 8.0h).</p>
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsCalcModalOpen(false)}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={calculating}
                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                                    >
                                        {calculating ? 'Calculating...' : 'Run Calculation'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Reject Dialog */}
                {reviewingRecord && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
                            <h3 className="text-base font-bold text-slate-900">Reject Overtime Request</h3>
                            <p className="text-xs text-slate-500">
                                Rejecting {reviewingRecord.employee_name}'s {reviewingRecord.overtime_hours}h overtime request on {reviewingRecord.date}.
                            </p>

                            <form onSubmit={handleReject} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Rejection</label>
                                    <textarea
                                        value={rejectNotes}
                                        onChange={(e) => setRejectNotes(e.target.value)}
                                        rows={3}
                                        placeholder="Reason for rejecting (e.g. unapproved stay, clocked out late without notice)..."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-500"
                                        required
                                    />
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setReviewingRecord(null)}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={processingAction}
                                        className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                                    >
                                        {processingAction ? 'Rejecting...' : 'Confirm Rejection'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default OvertimeManagement;
