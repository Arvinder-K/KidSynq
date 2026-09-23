import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { 
    Calendar, Clock, PiggyBank, ArrowLeftRight, Coffee, 
    CheckCircle2, AlertCircle, MapPin
} from 'lucide-react';

import { 
    schedulingService, 
    type StaffSchedule, 
    type StaffMyScheduleResponse 
} from '../../api/schedulingService';
import { employeeService, type Employee } from '../../api/employeeService';

export const StaffMySchedule: React.FC = () => {
    const [data, setData] = useState<StaffMyScheduleResponse | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successNotice, setSuccessNotice] = useState<string | null>(null);

    // Shift Swap from Schedule Modal
    const [swapShift, setSwapShift] = useState<StaffSchedule | null>(null);
    const [targetEmpId, setTargetEmpId] = useState('');
    const [swapReason, setSwapReason] = useState('');
    const [submittingSwap, setSubmittingSwap] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [schedData, empData] = await Promise.all([
                schedulingService.getMySchedule(),
                employeeService.getEmployees()
            ]);
            setData(schedData);
            setEmployees(empData.results || empData || []);
        } catch (err: any) {
            console.error("Failed to load personal schedule", err);
            setError("Could not load your staff schedule.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleProposeSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!swapShift || !targetEmpId) return;

        try {
            setSubmittingSwap(true);
            await schedulingService.createShiftSwap({
                target_employee: targetEmpId,
                requesting_shift: swapShift.id,
                reason: swapReason
            });
            setSwapShift(null);
            setTargetEmpId('');
            setSwapReason('');
            setSuccessNotice("Swap request submitted to supervisor!");
            fetchData();
            setTimeout(() => setSuccessNotice(null), 3000);
        } catch (err: any) {
            const msg = err.response?.data?.target_employee || err.response?.data?.detail || "Failed to request swap.";
            alert(msg);
        } finally {
            setSubmittingSwap(false);
        }
    };

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                            <Calendar className="w-7 h-7 text-indigo-600" />
                            <span>My Schedule & Shifts</span>
                        </h1>
                        <p className="text-xs text-slate-500 mt-1">
                            Welcome back, {data?.employee_name || 'Educator'}. Here is your upcoming roster, breaks, and comp balance.
                        </p>
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

                {/* Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900">{data?.shifts?.length || 0}</div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming Shifts</div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <PiggyBank className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900">{data?.time_bank_balance || 0}h</div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time Bank (Comp Time)</div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <ArrowLeftRight className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900">{data?.pending_swaps_count || 0}</div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Swap Requests</div>
                        </div>
                    </div>
                </div>

                {/* Upcoming Shifts List */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Upcoming Shifts & Duties</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Assigned classrooms, timings, and breaks</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-12 text-center text-slate-400 text-xs font-medium">Loading schedule...</div>
                    ) : !data?.shifts || data.shifts.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-xs">
                            You have no upcoming shifts scheduled.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {data.shifts.map((s) => (
                                <div key={s.id} className="p-5 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-900 text-sm">{s.date}</span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                s.shift_type === 'opening'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : s.shift_type === 'closing'
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : 'bg-indigo-50 text-indigo-700'
                                            }`}>
                                                {s.shift_type} shift
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                                                {s.classroom_name || 'Floating / General'}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                                            <div className="flex items-center gap-1 font-semibold text-slate-900">
                                                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                                <span>{s.shift_start} – {s.shift_end}</span>
                                                <span className="text-slate-400 font-normal">({s.duration_hours}h total, {s.net_working_hours}h work)</span>
                                            </div>

                                            {s.branch_name && (
                                                <div className="flex items-center gap-1 text-slate-500">
                                                    <MapPin className="w-3.5 h-3.5" />
                                                    <span>{s.branch_name}</span>
                                                </div>
                                            )}
                                        </div>

                                        {s.duties && (
                                            <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                <span className="font-bold text-slate-700">Duties: </span>
                                                <span>{s.duties}</span>
                                            </div>
                                        )}

                                        {s.breaks && s.breaks.length > 0 && (
                                            <div className="flex items-center gap-2 pt-1">
                                                <Coffee className="w-3.5 h-3.5 text-amber-500" />
                                                <span className="text-[11px] font-bold text-slate-700">Scheduled Breaks:</span>
                                                {s.breaks.map((b, idx) => (
                                                    <span key={idx} className="text-[11px] text-slate-600 bg-amber-50/80 px-2 py-0.5 rounded-md">
                                                        {b.break_start}–{b.break_end} ({b.break_type}, {b.is_paid ? 'Paid' : 'Unpaid'})
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => setSwapShift(s)}
                                            className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                                        >
                                            <ArrowLeftRight className="w-3.5 h-3.5" />
                                            <span>Request Swap</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Propose Swap Modal */}
                {swapShift && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
                            <h3 className="text-base font-bold text-slate-900">Propose Shift Swap</h3>
                            <p className="text-xs text-slate-500">
                                Propose swapping your shift on {swapShift.date} ({swapShift.shift_start}–{swapShift.shift_end}) with a colleague.
                            </p>

                            <form onSubmit={handleProposeSwap} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Colleague to Swap With</label>
                                    <select
                                        value={targetEmpId}
                                        onChange={(e) => setTargetEmpId(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    >
                                        <option value="">Select Colleague</option>
                                        {employees.filter(e => e.id !== data?.employee_id).map(e => (
                                            <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Note</label>
                                    <textarea
                                        value={swapReason}
                                        onChange={(e) => setSwapReason(e.target.value)}
                                        rows={2}
                                        placeholder="Reason for requesting swap..."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSwapShift(null)}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submittingSwap}
                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                                    >
                                        {submittingSwap ? 'Submitting...' : 'Send Swap Request'}
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

export default StaffMySchedule;
