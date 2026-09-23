import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { 
    Calendar, Plus, Clock, CheckCircle, XCircle, 
    RefreshCw, Send, FileText
} from 'lucide-react';
import schedulingService, { type LeaveRequest, type StaffMyLeaveResponse } from '../../api/schedulingService';

export const StaffMyLeave: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [leaveData, setLeaveData] = useState<StaffMyLeaveResponse | null>(null);

    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form
    const [leaveTypeId, setLeaveTypeId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');

    const loadMyLeave = async () => {
        try {
            setLoading(true);
            const data = await schedulingService.getMyLeave();
            setLeaveData(data);
            if (data.leave_types.length > 0 && !leaveTypeId) {
                setLeaveTypeId(data.leave_types[0].id);
            }
        } catch (error) {
            console.error('Failed to load my leave records', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMyLeave();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!leaveTypeId || !startDate || !endDate) {
            alert('Please select a leave type, start date, and end date.');
            return;
        }
        try {
            setSubmitting(true);
            await schedulingService.submitMyLeave({
                leave_type: leaveTypeId,
                start_date: startDate,
                end_date: endDate,
                reason,
                notes
            });
            setShowModal(false);
            setReason('');
            setNotes('');
            await loadMyLeave();
        } catch (error: any) {
            console.error('Submission failed', error);
            alert(error.response?.data?.detail || error.response?.data?.end_date || 'Failed to submit leave request.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async (req: LeaveRequest) => {
        if (!window.confirm('Are you sure you want to cancel this leave request?')) return;
        try {
            await schedulingService.cancelLeaveRequest(req.id);
            await loadMyLeave();
        } catch (error: any) {
            console.error('Cancellation failed', error);
            alert(error.response?.data?.detail || 'Failed to cancel leave request.');
        }
    };

    const requests = leaveData?.leave_requests || [];
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    const approvedCount = requests.filter(r => r.status === 'approved').length;

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">My Leave & Time Off</h1>
                            <p className="text-slate-500 text-sm">
                                {leaveData?.employee_name ? `Welcome back, ${leaveData.employee_name}. ` : ''}
                                Submit time-off requests, track status, and view leave history
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/staff/my-schedule')}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition"
                    >
                        View My Schedule
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm shadow-sm transition"
                    >
                        <Plus className="w-4 h-4" />
                        Request Time Off
                    </button>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">Pending Requests</span>
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-800">{pendingCount}</span>
                        <span className="text-xs text-slate-400">awaiting supervisor review</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">Approved Time Off</span>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-800">{approvedCount}</span>
                        <span className="text-xs text-emerald-600 font-medium">active / past records</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">Available Policies</span>
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <FileText className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-800">{leaveData?.leave_types.length || 0}</span>
                        <span className="text-xs text-slate-400">leave types</span>
                    </div>
                </div>
            </div>

            {/* Leave History Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">My Leave Request History</h2>
                    <button
                        onClick={loadMyLeave}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/75 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="py-4 px-6">Leave Type</th>
                                <th className="py-4 px-4">Period</th>
                                <th className="py-4 px-4">Reason / Notes</th>
                                <th className="py-4 px-4">Requested On</th>
                                <th className="py-4 px-4">Status</th>
                                <th className="py-4 px-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {requests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-slate-400">
                                        You haven't submitted any leave requests yet.
                                    </td>
                                </tr>
                            ) : (
                                requests.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50/50 transition">
                                        <td className="py-4 px-6">
                                            <span 
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-2xs"
                                                style={{ backgroundColor: r.leave_type_color || '#4F46E5' }}
                                            >
                                                {r.leave_type_name}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 font-medium text-slate-800">
                                            {r.start_date} → {r.end_date}
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="text-xs text-slate-700 max-w-xs truncate">
                                                {r.reason || <span className="text-slate-400 italic">No reason provided</span>}
                                            </div>
                                            {r.rejection_reason && (
                                                <div className="text-xs text-rose-500 mt-0.5 font-medium">
                                                    Declined: {r.rejection_reason}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-4 text-xs text-slate-400">
                                            {new Date(r.requested_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-4 px-4">
                                            {getStatusBadge(r.status)}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            {r.status === 'pending' && (
                                                <button
                                                    onClick={() => handleCancel(r)}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Request Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Submit Leave Request</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Type</label>
                                <select
                                    required
                                    value={leaveTypeId}
                                    onChange={e => setLeaveTypeId(e.target.value)}
                                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                >
                                    {(leaveData?.leave_types || []).map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.name} ({t.is_paid ? 'Paid' : 'Unpaid'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Doctor appointment, Personal, Vacation"
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                                <p className="text-2xs text-slate-400 mt-1">Medical details are not required for sick leaves.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes for Supervisor (Optional)</label>
                                <textarea
                                    rows={2}
                                    placeholder="Any additional handover notes..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex items-center gap-2 px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-sm transition disabled:opacity-50"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    {submitting ? 'Submitting...' : 'Submit Request'}
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



export default StaffMyLeave;
