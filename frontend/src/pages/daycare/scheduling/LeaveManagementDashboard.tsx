import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import { 
    Calendar, Users, Clock, AlertCircle, Plus, CheckCircle, 
    XCircle, ChevronRight, Settings, ShieldAlert
} from 'lucide-react';
import schedulingService, { type LeaveType, type LeaveRequest } from '../../../api/schedulingService';

export const LeaveManagementDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [showTypeModal, setShowTypeModal] = useState(false);
    
    // New Leave Type Form
    const [typeForm, setTypeForm] = useState({
        name: '',
        code: '',
        is_paid: true,
        requires_approval: true,
        color_code: '#4F46E5'
    });

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [typesData, reqsData] = await Promise.all([
                schedulingService.getLeaveTypes(),
                schedulingService.getLeaveRequests()
            ]);
            setLeaveTypes(typesData);
            setRequests(reqsData);
        } catch (error) {
            console.error('Failed to load leave management data', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const handleCreateType = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await schedulingService.createLeaveType(typeForm);
            setShowTypeModal(false);
            setTypeForm({ name: '', code: '', is_paid: true, requires_approval: true, color_code: '#4F46E5' });
            await fetchDashboardData();
        } catch (error) {
            console.error('Failed to create leave type', error);
            alert('Failed to save leave type.');
        }
    };

    // Calculate metrics
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    const approvedCount = requests.filter(r => r.status === 'approved').length;
    
    const todayStr = new Date().toISOString().slice(0, 10);
    const onLeaveToday = requests.filter(r => 
        r.status === 'approved' && r.start_date <= todayStr && r.end_date >= todayStr
    );

    // Monthly calendar filtering
    const monthRequests = requests.filter(r => 
        r.status === 'approved' && (r.start_date.startsWith(selectedMonth) || r.end_date.startsWith(selectedMonth))
    );

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
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Leave & Time-Off Management</h1>
                    <p className="text-gray-500 text-sm mt-1">Configure daycare leave policies, review employee requests, and track time off</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/daycare/scheduling/shortages')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium rounded-xl text-sm transition"
                    >
                        <ShieldAlert className="w-4 h-4" />
                        Shortage Alerts
                    </button>
                    <button
                        onClick={() => navigate('/daycare/leave/requests')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm shadow-sm transition"
                    >
                        Review Requests ({pendingCount})
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">Pending Approvals</span>
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-800">{pendingCount}</span>
                        {pendingCount > 0 && (
                            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                Action Needed
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">On Leave Today</span>
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-800">{onLeaveToday.length}</span>
                        <span className="text-xs text-slate-400">staff members</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">Approved Total</span>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-800">{approvedCount}</span>
                        <span className="text-xs text-emerald-600 font-medium">scheduled</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">Active Leave Types</span>
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Settings className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-800">{leaveTypes.length}</span>
                        <span className="text-xs text-slate-400">custom policies</span>
                    </div>
                </div>
            </div>

            {/* Currently On Leave Highlight */}
            {onLeaveToday.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 text-rose-800 font-semibold mb-3">
                        <AlertCircle className="w-5 h-5 text-rose-600" />
                        Staff Members On Leave Today ({todayStr})
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {onLeaveToday.map(r => (
                            <div key={r.id} className="bg-white p-3.5 rounded-xl border border-rose-100 flex items-center justify-between shadow-xs">
                                <div>
                                    <div className="font-semibold text-slate-800 text-sm">{r.employee_name}</div>
                                    <div className="text-xs text-slate-500">{r.leave_type_name} ({r.start_date} to {r.end_date})</div>
                                </div>
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
                                    Away
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Grid: Policy Configuration & Monthly Calendar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Leave Types & Policy Configuration */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-800">Leave Policies</h2>
                        <button
                            onClick={() => setShowTypeModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium text-xs rounded-lg transition"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add Policy
                        </button>
                    </div>

                    <div className="space-y-3">
                        {leaveTypes.map(t => (
                            <div key={t.id} className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 transition bg-slate-50/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div 
                                            className="w-3 h-3 rounded-full" 
                                            style={{ backgroundColor: t.color_code || '#4F46E5' }} 
                                        />
                                        <span className="font-semibold text-sm text-slate-800">{t.name}</span>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_paid ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {t.is_paid ? 'Paid' : 'Unpaid'}
                                    </span>
                                </div>
                                <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                                    <span>Code: {t.code}</span>
                                    <span>•</span>
                                    <span>Approval: {t.requires_approval ? 'Required' : 'Automatic'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Monthly Leave Schedule Overview */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Approved Leave Calendar</h2>
                            <p className="text-xs text-slate-500">Upcoming planned employee time off</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(e.target.value)}
                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    {monthRequests.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm font-medium text-slate-600">No approved leave records in {selectedMonth}</p>
                            <p className="text-xs text-slate-400 mt-1">Leave requests will appear here once approved by management.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {monthRequests.map(r => (
                                <div key={r.id} className="py-3.5 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-xl transition">
                                    <div className="flex items-center gap-3">
                                        <div 
                                            className="w-2.5 h-10 rounded-full" 
                                            style={{ backgroundColor: r.leave_type_color || '#4F46E5' }} 
                                        />
                                        <div>
                                            <div className="font-semibold text-sm text-slate-800">{r.employee_name}</div>
                                            <div className="text-xs text-slate-500">{r.leave_type_name} • {r.start_date} to {r.end_date}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                            Approved
                                        </span>
                                        {r.reason && (
                                            <div className="text-xs text-slate-400 mt-1 italic max-w-xs truncate">
                                                "{r.reason}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Leave Type Modal */}
            {showTypeModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Add Daycare Leave Policy</h3>
                            <button onClick={() => setShowTypeModal(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateType} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Policy Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g., Bereavement Leave, Personal Day"
                                    value={typeForm.name}
                                    onChange={e => setTypeForm({ ...typeForm, name: e.target.value })}
                                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">System Code</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g., bereavement, personal"
                                    value={typeForm.code}
                                    onChange={e => setTypeForm({ ...typeForm, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Compensation</label>
                                    <select
                                        value={typeForm.is_paid ? 'paid' : 'unpaid'}
                                        onChange={e => setTypeForm({ ...typeForm, is_paid: e.target.value === 'paid' })}
                                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    >
                                        <option value="paid">Paid Leave</option>
                                        <option value="unpaid">Unpaid Leave</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Color Tag</label>
                                    <input
                                        type="color"
                                        value={typeForm.color_code}
                                        onChange={e => setTypeForm({ ...typeForm, color_code: e.target.value })}
                                        className="w-full h-9.5 p-1 border border-slate-200 rounded-xl cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="req_appr"
                                    checked={typeForm.requires_approval}
                                    onChange={e => setTypeForm({ ...typeForm, requires_approval: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                                />
                                <label htmlFor="req_appr" className="text-xs text-slate-700 font-medium">
                                    Requires manager approval
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowTypeModal(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-sm transition"
                                >
                                    Save Policy
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



export default LeaveManagementDashboard;
