import React, { useState, useEffect } from 'react';
import Layout from '../../../components/Layout';
import { 
    ArrowLeftRight, CheckCircle2, AlertCircle, 
    PlusCircle, Clock, Calendar, User, 
    MessageSquare
} from 'lucide-react';
import { 
    schedulingService, 
    type ShiftSwapRequest,
    type StaffSchedule 
} from '../../../api/schedulingService';
import { employeeService, type Employee } from '../../../api/employeeService';

export const ShiftSwapCenter: React.FC = () => {
    const [swaps, setSwaps] = useState<ShiftSwapRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successNotice, setSuccessNotice] = useState<string | null>(null);

    // Filter
    const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

    // Create Swap Request State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [senderEmpId, setSenderEmpId] = useState('');
    const [targetEmpId, setTargetEmpId] = useState('');
    const [senderShifts, setSenderShifts] = useState<StaffSchedule[]>([]);
    const [targetShifts, setTargetShifts] = useState<StaffSchedule[]>([]);
    const [selectedSenderShiftId, setSelectedSenderShiftId] = useState('');
    const [selectedTargetShiftId, setSelectedTargetShiftId] = useState('');
    const [swapReason, setSwapReason] = useState('');
    const [submittingSwap, setSubmittingSwap] = useState(false);

    // Review Action State
    const [reviewingSwap, setReviewingSwap] = useState<ShiftSwapRequest | null>(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
    const [processingAction, setProcessingAction] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [swapsData, empData] = await Promise.all([
                schedulingService.getShiftSwaps({
                    status: activeTab !== 'all' ? activeTab : undefined
                }),
                employeeService.getEmployees()
            ]);
            setSwaps(swapsData);
            setEmployees(empData.results || empData || []);
        } catch (err: any) {
            console.error("Failed to load shift swaps", err);
            setError("Failed to load shift swap requests.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    // Load shifts when sender or target is selected in modal
    useEffect(() => {
        if (senderEmpId) {
            schedulingService.getSchedules({ employee: senderEmpId })
                .then(res => setSenderShifts(Array.isArray(res) ? res : (res as any)?.results || []))
                .catch(() => setSenderShifts([]));
        } else {
            setSenderShifts([]);
        }
    }, [senderEmpId]);

    useEffect(() => {
        if (targetEmpId) {
            schedulingService.getSchedules({ employee: targetEmpId })
                .then(res => setTargetShifts(Array.isArray(res) ? res : (res as any)?.results || []))
                .catch(() => setTargetShifts([]));
        } else {
            setTargetShifts([]);
        }
    }, [targetEmpId]);


    const handleCreateSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!senderEmpId || !targetEmpId || !selectedSenderShiftId) return;

        try {
            setSubmittingSwap(true);
            await schedulingService.createShiftSwap({
                requesting_employee: senderEmpId,
                target_employee: targetEmpId,
                requesting_shift: selectedSenderShiftId,
                target_shift: selectedTargetShiftId || undefined,
                reason: swapReason
            });
            setIsCreateModalOpen(false);
            setSenderEmpId('');
            setTargetEmpId('');
            setSelectedSenderShiftId('');
            setSelectedTargetShiftId('');
            setSwapReason('');
            setSuccessNotice("Shift swap request created and queued for supervisor review.");
            fetchData();
            setTimeout(() => setSuccessNotice(null), 3000);
        } catch (err: any) {
            const msg = err.response?.data?.target_employee || err.response?.data?.requesting_employee || err.response?.data?.detail || "Failed to create swap request.";
            alert(msg);
        } finally {
            setSubmittingSwap(false);
        }
    };

    const handleProcessAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reviewingSwap || !actionType) return;

        try {
            setProcessingAction(true);
            if (actionType === 'approve') {
                await schedulingService.approveShiftSwap(reviewingSwap.id, adminNotes);
                setSuccessNotice("Shift swap approved and schedule automatically updated!");
            } else {
                await schedulingService.rejectShiftSwap(reviewingSwap.id, adminNotes);
                setSuccessNotice("Shift swap rejected.");
            }
            setReviewingSwap(null);
            setActionType(null);
            setAdminNotes('');
            fetchData();
            setTimeout(() => setSuccessNotice(null), 3000);
        } catch (err: any) {
            alert(err.response?.data?.detail || err.response?.data?.target_employee || "Action failed.");
        } finally {
            setProcessingAction(false);
        }
    };

    const pendingCount = swaps.filter(s => s.status === 'pending').length;

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Shift Swap Center
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Review and approve peer-to-peer educator shift exchanges with automated conflict and ratio validation.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                        >
                            <PlusCircle className="w-4 h-4" />
                            <span>New Swap Request</span>
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

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200">
                    {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                                activeTab === tab
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {tab} {tab === 'pending' && pendingCount > 0 && (
                                <span className="ml-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                                    {pendingCount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Swaps Grid */}
                {loading ? (
                    <div className="py-12 text-center text-slate-400 text-xs font-medium">Loading shift swap requests...</div>
                ) : swaps.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                        No shift swap requests found in this category.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {swaps.map((s) => (
                            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-slate-300 transition-colors">
                                {/* Header / Status */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                            s.status === 'approved' 
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : s.status === 'rejected'
                                                    ? 'bg-rose-100 text-rose-800'
                                                    : s.status === 'cancelled'
                                                        ? 'bg-slate-100 text-slate-600'
                                                        : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {s.status}
                                        </span>
                                        <span className="text-[11px] text-slate-400">
                                            Requested {new Date(s.requested_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {s.status === 'pending' && (
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => {
                                                    setReviewingSwap(s);
                                                    setActionType('approve');
                                                    setAdminNotes('');
                                                }}
                                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setReviewingSwap(s);
                                                    setActionType('reject');
                                                    setAdminNotes('');
                                                }}
                                                className="px-3 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-lg text-xs font-bold transition-colors"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Exchange Details Cards */}
                                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                                    {/* Requesting Staff Shift */}
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From Staff</div>
                                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1">
                                            <User className="w-3.5 h-3.5 text-indigo-600" />
                                            <span>{s.requesting_employee_name}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-600 font-semibold flex items-center gap-1 pt-1">
                                            <Calendar className="w-3 h-3 text-slate-400" />
                                            <span>{s.requesting_shift_details.date}</span>
                                        </div>
                                        <div className="text-[11px] text-indigo-600 font-bold flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            <span>{s.requesting_shift_details.shift_start}–{s.requesting_shift_details.shift_end}</span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-medium">
                                            Room: {s.requesting_shift_details.classroom_name}
                                        </div>
                                    </div>

                                    {/* Target Staff Shift */}
                                    <div className="space-y-1 border-l border-slate-200 pl-3">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To / Exchange With</div>
                                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1">
                                            <User className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>{s.target_employee_name}</span>
                                        </div>
                                        {s.target_shift_details ? (
                                            <>
                                                <div className="text-[11px] text-slate-600 font-semibold flex items-center gap-1 pt-1">
                                                    <Calendar className="w-3 h-3 text-slate-400" />
                                                    <span>{s.target_shift_details.date}</span>
                                                </div>
                                                <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{s.target_shift_details.shift_start}–{s.target_shift_details.shift_end}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-medium">
                                                    Room: {s.target_shift_details.classroom_name}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-[11px] text-slate-400 italic pt-2">
                                                (Direct shift coverage / give-away)
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Reason / Notes */}
                                {s.reason && (
                                    <div className="text-xs text-slate-600 bg-slate-100/50 p-2.5 rounded-lg flex items-start gap-2">
                                        <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                        <span>"{s.reason}"</span>
                                    </div>
                                )}

                                {s.admin_notes && (
                                    <div className="text-xs text-indigo-700 bg-indigo-50 p-2.5 rounded-lg">
                                        <span className="font-bold">Supervisor Note: </span>
                                        <span>{s.admin_notes}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Create Swap Modal */}
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 space-y-4">
                            <h3 className="text-base font-bold text-slate-900">Initiate Shift Swap</h3>
                            <p className="text-xs text-slate-500">
                                Select the requesting employee, their shift, and target employee to propose an exchange.
                            </p>

                            <form onSubmit={handleCreateSwap} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Requesting Staff</label>
                                        <select
                                            value={senderEmpId}
                                            onChange={(e) => setSenderEmpId(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                            required
                                        >
                                            <option value="">Select Employee</option>
                                            {employees.map(e => (
                                                <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Target Staff</label>
                                        <select
                                            value={targetEmpId}
                                            onChange={(e) => setTargetEmpId(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                            required
                                        >
                                            <option value="">Select Target Staff</option>
                                            {employees.filter(e => e.id !== senderEmpId).map(e => (
                                                <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Shift to Swap (from Requesting Staff)</label>
                                    <select
                                        value={selectedSenderShiftId}
                                        onChange={(e) => setSelectedSenderShiftId(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                        disabled={!senderEmpId}
                                    >
                                        <option value="">Select Shift</option>
                                        {senderShifts.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.date}: {s.shift_start}–{s.shift_end} ({s.classroom_name || 'Floating'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Target Shift (Optional, for 2-way exchange)</label>
                                    <select
                                        value={selectedTargetShiftId}
                                        onChange={(e) => setSelectedTargetShiftId(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        disabled={!targetEmpId}
                                    >
                                        <option value="">None (One-way coverage)</option>
                                        {targetShifts.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.date}: {s.shift_start}–{s.shift_end} ({s.classroom_name || 'Floating'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Swap</label>
                                    <textarea
                                        value={swapReason}
                                        onChange={(e) => setSwapReason(e.target.value)}
                                        rows={2}
                                        placeholder="Reason for swapping shifts..."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateModalOpen(false)}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submittingSwap}
                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                                    >
                                        {submittingSwap ? 'Validating...' : 'Submit Swap'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Review Modal */}
                {reviewingSwap && actionType && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
                            <h3 className="text-base font-bold text-slate-900">
                                {actionType === 'approve' ? 'Approve Shift Swap' : 'Reject Shift Swap'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                Swap between {reviewingSwap.requesting_employee_name} and {reviewingSwap.target_employee_name}.
                            </p>

                            <form onSubmit={handleProcessAction} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Supervisor Notes (Optional)</label>
                                    <textarea
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        rows={3}
                                        placeholder="Add any supervisor comments..."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setReviewingSwap(null);
                                            setActionType(null);
                                        }}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={processingAction}
                                        className={`px-5 py-2 text-white font-bold text-xs rounded-xl disabled:opacity-50 ${
                                            actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                                        }`}
                                    >
                                        {processingAction ? 'Processing...' : actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
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

export default ShiftSwapCenter;
