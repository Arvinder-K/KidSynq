import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import { 
    CheckCircle, XCircle, AlertTriangle, 
    Search, ChevronLeft, ShieldAlert, Clock
} from 'lucide-react';
import schedulingService, { type LeaveRequest, type LeaveType } from '../../../api/schedulingService';

export const LeaveRequestsTable: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    
    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Modal States
    const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showConflictModal, setShowConflictModal] = useState(false);

    // Form inputs
    const [supervisorNote, setSupervisorNote] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const [reqs, types] = await Promise.all([
                schedulingService.getLeaveRequests(),
                schedulingService.getLeaveTypes()
            ]);
            setRequests(reqs);
            setLeaveTypes(types);
        } catch (error) {
            console.error('Failed to load leave requests', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleApprove = async () => {
        if (!selectedRequest) return;
        try {
            setActionLoading(true);
            await schedulingService.approveLeaveRequest(selectedRequest.id, supervisorNote);
            setShowApproveModal(false);
            setSelectedRequest(null);
            setSupervisorNote('');
            await loadData();
        } catch (error: any) {
            console.error('Approval failed', error);
            alert(error.response?.data?.detail || 'Failed to approve leave request.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!selectedRequest) return;
        if (!rejectionReason.trim()) {
            alert('Rejection reason is required.');
            return;
        }
        try {
            setActionLoading(true);
            await schedulingService.rejectLeaveRequest(selectedRequest.id, rejectionReason);
            setShowRejectModal(false);
            setSelectedRequest(null);
            setRejectionReason('');
            await loadData();
        } catch (error: any) {
            console.error('Rejection failed', error);
            alert(error.response?.data?.detail || 'Failed to reject leave request.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancel = async (req: LeaveRequest) => {
        if (!window.confirm(`Cancel leave request for ${req.employee_name}?`)) return;
        try {
            await schedulingService.cancelLeaveRequest(req.id);
            await loadData();
        } catch (error: any) {
            console.error('Cancellation failed', error);
            alert(error.response?.data?.detail || 'Failed to cancel leave request.');
        }
    };

    // Filtered data
    const filteredRequests = requests.filter(r => {
        const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
        const matchesType = typeFilter === 'all' || r.leave_type === typeFilter;
        const matchesSearch = 
            r.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (r.employee_number && r.employee_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (r.reason && r.reason.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesStatus && matchesType && matchesSearch;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100"><CheckCircle className="w-3 h-3" /> Approved</span>;
            case 'pending':
                return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100"><Clock className="w-3 h-3" /> Pending</span>;
            case 'rejected':
                return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100"><XCircle className="w-3 h-3" /> Rejected</span>;
            case 'cancelled':
                return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">Cancelled</span>;
            default:
                return <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{status}</span>;
        }
    };

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
                        <h1 className="text-2xl font-bold text-gray-900">Leave Requests & Approvals</h1>
                        <p className="text-gray-500 text-sm mt-1">Review staff time-off requests and verify classroom schedule coverage</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/daycare/scheduling/shortages')}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium rounded-xl text-sm transition"
                    >
                        <ShieldAlert className="w-4 h-4" />
                        Check Staff Shortages
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by staff name, ID, or reason..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending Approval</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="cancelled">Cancelled</option>
                    </select>

                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                    >
                        <option value="all">All Leave Types</option>
                        {leaveTypes.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Requests Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/75 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="py-4 px-6">Employee</th>
                                <th className="py-4 px-4">Leave Type</th>
                                <th className="py-4 px-4">Dates & Duration</th>
                                <th className="py-4 px-4">Coverage Impact</th>
                                <th className="py-4 px-4">Status</th>
                                <th className="py-4 px-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-slate-400">
                                        No leave requests found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50/50 transition">
                                        <td className="py-4 px-6">
                                            <div className="font-semibold text-slate-800">{r.employee_name}</div>
                                            {r.employee_number && (
                                                <div className="text-xs text-slate-400">ID: {r.employee_number}</div>
                                            )}
                                        </td>
                                        <td className="py-4 px-4">
                                            <span 
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-2xs"
                                                style={{ backgroundColor: r.leave_type_color || '#4F46E5' }}
                                            >
                                                {r.leave_type_name}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="font-medium text-slate-700">{r.start_date} → {r.end_date}</div>
                                            {r.reason && (
                                                <div className="text-xs text-slate-400 italic truncate max-w-xs mt-0.5">
                                                    "{r.reason}"
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-4">
                                            {r.affected_shifts_count > 0 ? (
                                                <button
                                                    onClick={() => {
                                                        setSelectedRequest(r);
                                                        setShowConflictModal(true);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg border border-amber-200 transition cursor-pointer"
                                                >
                                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                                    {r.affected_shifts_count} Shifts Affected
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-400 font-medium">No shift conflicts</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-4">
                                            {getStatusBadge(r.status)}
                                            {r.rejection_reason && (
                                                <div className="text-xs text-rose-500 mt-1 max-w-xs truncate" title={r.rejection_reason}>
                                                    Reason: {r.rejection_reason}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {r.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedRequest(r);
                                                                setShowApproveModal(true);
                                                            }}
                                                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium text-xs rounded-lg transition"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedRequest(r);
                                                                setShowRejectModal(true);
                                                            }}
                                                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs rounded-lg transition"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                {r.status === 'approved' && (
                                                    <button
                                                        onClick={() => handleCancel(r)}
                                                        className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition"
                                                    >
                                                        Cancel Leave
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Shift Conflict Details Modal */}
            {showConflictModal && selectedRequest && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-amber-700 font-bold">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                                Staffing Coverage Affected
                            </div>
                            <button onClick={() => setShowConflictModal(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">
                            The following scheduled shifts for <strong>{selectedRequest.employee_name}</strong> overlap with this leave period ({selectedRequest.start_date} to {selectedRequest.end_date}). Shifts are flagged for replacement.
                        </p>

                        <div className="space-y-2.5 max-h-60 overflow-y-auto mb-6">
                            {(selectedRequest.affected_shifts || []).map((s, idx) => (
                                <div key={idx} className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl text-xs">
                                    <div className="flex items-center justify-between font-semibold text-slate-800">
                                        <span>{s.date} ({s.shift_start} - {s.shift_end})</span>
                                        <span className="capitalize px-2 py-0.5 bg-white text-amber-700 rounded-full border border-amber-200">{s.shift_type} Shift</span>
                                    </div>
                                    <div className="text-slate-500 mt-1">Classroom: {s.classroom_name}</div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowConflictModal(false)}
                                className="px-5 py-2 text-sm bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Approve Modal */}
            {showApproveModal && selectedRequest && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Approve Leave Request</h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Approving <strong>{selectedRequest.leave_type_name}</strong> for <strong>{selectedRequest.employee_name}</strong> from {selectedRequest.start_date} to {selectedRequest.end_date}.
                        </p>

                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Supervisor Notes (Optional)</label>
                            <textarea
                                rows={3}
                                placeholder="Add any approval instructions or coverage notes..."
                                value={supervisorNote}
                                onChange={e => setSupervisorNote(e.target.value)}
                                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowApproveModal(false)}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={actionLoading}
                                className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition disabled:opacity-50"
                            >
                                {actionLoading ? 'Approving...' : 'Confirm Approval'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && selectedRequest && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Reject Leave Request</h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Please provide a reason for rejecting <strong>{selectedRequest.employee_name}</strong>'s request.
                        </p>

                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Rejection Reason <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                rows={3}
                                required
                                placeholder="Explain why this leave cannot be accommodated..."
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={actionLoading}
                                className="px-5 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl shadow-sm transition disabled:opacity-50"
                            >
                                {actionLoading ? 'Rejecting...' : 'Reject Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </Layout>
    );
};



export default LeaveRequestsTable;
