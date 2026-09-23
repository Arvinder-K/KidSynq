import React, { useState, useEffect } from 'react';
import Layout from '../../../components/Layout';
import { 
    PiggyBank, PlusCircle, Settings, 
    CheckCircle2, AlertCircle,
    TrendingUp, Shield, Edit3
} from 'lucide-react';

import { 
    schedulingService, 
    type TimeBankRule, 
    type EmployeeTimeBankSummary,
    type TimeBankTransaction 
} from '../../../api/schedulingService';

export const TimeBankDashboard: React.FC = () => {
    const [rules, setRules] = useState<TimeBankRule | null>(null);
    const [employeeBalances, setEmployeeBalances] = useState<EmployeeTimeBankSummary[]>([]);
    const [transactions, setTransactions] = useState<TimeBankTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successNotice, setSuccessNotice] = useState<string | null>(null);

    // Rules Edit State
    const [isEditingRules, setIsEditingRules] = useState(false);
    const [editRulesData, setEditRulesData] = useState<Partial<TimeBankRule>>({});
    const [savingRules, setSavingRules] = useState(false);

    // Manual Adjust Modal State
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [adjustType, setAdjustType] = useState<'overtime_credit' | 'time_off_debit' | 'manual_adjustment' | 'correction'>('manual_adjustment');
    const [adjustHours, setAdjustHours] = useState(1.0);
    const [adjustReason, setAdjustReason] = useState('');
    const [submittingAdjust, setSubmittingAdjust] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [summaryData, txnData] = await Promise.all([
                schedulingService.getTimeBankSummary(),
                schedulingService.getTimeBankTransactions()
            ]);
            setRules(summaryData.rules);
            setEmployeeBalances(summaryData.employee_balances);
            setTransactions(txnData);
            setEditRulesData(summaryData.rules);
        } catch (err: any) {
            console.error("Failed to load time bank data", err);
            setError("Failed to load time bank details.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveRules = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSavingRules(true);
            const updated = await schedulingService.updateTimeBankRules(editRulesData);
            setRules(updated);
            setIsEditingRules(false);
            setSuccessNotice("Time Bank policy updated successfully.");
            setTimeout(() => setSuccessNotice(null), 3000);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to update rules.");
        } finally {
            setSavingRules(false);
        }
    };

    const handleAdjust = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployeeId || adjustHours <= 0 || !adjustReason) return;

        try {
            setSubmittingAdjust(true);
            await schedulingService.adjustTimeBank({
                employee_id: selectedEmployeeId,
                transaction_type: adjustType,
                hours: adjustHours,
                reason: adjustReason
            });
            setIsAdjustModalOpen(false);
            setSelectedEmployeeId('');
            setAdjustHours(1.0);
            setAdjustReason('');
            setSuccessNotice("Time Bank balance adjusted successfully.");
            fetchData();
            setTimeout(() => setSuccessNotice(null), 3000);
        } catch (err: any) {
            alert(err.response?.data?.hours || err.response?.data?.detail || "Adjustment failed.");
        } finally {
            setSubmittingAdjust(false);
        }
    };

    const totalBankedHours = employeeBalances.reduce((sum, b) => sum + Number(b.balance_hours), 0);
    const activeStaffWithBalance = employeeBalances.filter(b => b.balance_hours > 0).length;

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Staff Time Bank (Comp Time)
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage banked overtime hours, policy caps, and time-off debits for your team.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsAdjustModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
                        >
                            <PlusCircle className="w-4 h-4" />
                            <span>Manual Adjustment</span>
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

                {/* Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900">{totalBankedHours.toFixed(1)}h</div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Banked Hours in Org</div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900">{activeStaffWithBalance} Staff</div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employees with Active Balance</div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                                <Settings className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-sm font-black text-slate-900">Cap: {rules?.max_balance_hours || 40}h</div>
                                <div className="text-xs text-slate-400 font-semibold">{rules?.is_enabled ? 'Time Bank Active' : 'Disabled'}</div>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsEditingRules(true)}
                            className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                            <Edit3 className="w-4 h-4" />
                            <span>Edit Policy</span>
                        </button>
                    </div>
                </div>

                {/* Staff Balances Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Staff Time Bank Balances</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Real-time ledger balances per educator</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-12 text-center text-slate-400 text-xs font-medium">Loading balances...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="p-3.5">Employee</th>
                                        <th className="p-3.5">Role</th>
                                        <th className="p-3.5 text-center">Total Credited</th>
                                        <th className="p-3.5 text-center">Total Debited</th>
                                        <th className="p-3.5 text-center">Current Balance</th>
                                        <th className="p-3.5">Cap Status</th>
                                        <th className="p-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {employeeBalances.map((b) => (
                                        <tr key={b.employee_id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                                                    {b.employee_name[0] || 'E'}
                                                </div>
                                                <div>
                                                    <div>{b.employee_name}</div>
                                                    <div className="text-[10px] text-slate-400 font-normal">{b.employee_number || 'No ID'}</div>
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-slate-600 font-medium">{b.job_title || 'Educator'}</td>
                                            <td className="p-3.5 text-center font-bold text-emerald-600">+{b.total_credited_hours}h</td>
                                            <td className="p-3.5 text-center font-bold text-rose-600">-{b.total_debited_hours}h</td>
                                            <td className="p-3.5 text-center font-black text-slate-900 text-sm">
                                                {b.balance_hours}h
                                            </td>
                                            <td className="p-3.5">
                                                {b.max_limit_reached ? (
                                                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                                        Max Cap Reached
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                                        Available ({Math.max(0, (rules?.max_balance_hours || 40) - b.balance_hours)}h left)
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-right">
                                                <button
                                                    onClick={() => {
                                                        setSelectedEmployeeId(b.employee_id);
                                                        setIsAdjustModalOpen(true);
                                                    }}
                                                    className="px-3 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-lg text-[11px] font-bold transition-colors"
                                                >
                                                    Adjust
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Audit Ledger of Transactions */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                        <h2 className="text-base font-bold text-slate-900">Immutable Transaction History ({transactions.length})</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Audit log of all credits, debits, and adjustments</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-3.5">Date</th>
                                    <th className="p-3.5">Employee</th>
                                    <th className="p-3.5">Type</th>
                                    <th className="p-3.5">Reason</th>
                                    <th className="p-3.5 text-center">Hours</th>
                                    <th className="p-3.5 text-center">Balance After</th>
                                    <th className="p-3.5">Approved By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {transactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-3.5 text-slate-500">{t.date}</td>
                                        <td className="p-3.5 font-bold text-slate-900">{t.employee_name}</td>
                                        <td className="p-3.5">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                t.transaction_type === 'overtime_credit' 
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : t.transaction_type === 'time_off_debit'
                                                        ? 'bg-rose-100 text-rose-800'
                                                        : 'bg-indigo-100 text-indigo-800'
                                            }`}>
                                                {t.transaction_type.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-slate-700 max-w-xs truncate">{t.reason}</td>
                                        <td className="p-3.5 text-center font-black">
                                            {t.transaction_type === 'time_off_debit' ? (
                                                <span className="text-rose-600">-{t.hours}h</span>
                                            ) : (
                                                <span className="text-emerald-600">+{t.hours}h</span>
                                            )}
                                        </td>
                                        <td className="p-3.5 text-center font-bold text-slate-900">{t.balance_after}h</td>
                                        <td className="p-3.5 text-slate-500">{t.approved_by_name || 'System / Admin'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Edit Policy Rules Modal */}
                {isEditingRules && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
                            <h3 className="text-base font-bold text-slate-900">Configure Time Bank Policy</h3>
                            
                            <form onSubmit={handleSaveRules} className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                    <div>
                                        <div className="text-xs font-bold text-slate-900">Enable Time Bank</div>
                                        <div className="text-[11px] text-slate-400">Allow staff to accumulate comp time</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={editRulesData.is_enabled ?? true}
                                        onChange={(e) => setEditRulesData({ ...editRulesData, is_enabled: e.target.checked })}
                                        className="w-4 h-4 text-indigo-600 rounded-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Max Balance Cap (Hours)</label>
                                    <input
                                        type="number"
                                        value={editRulesData.max_balance_hours ?? 40}
                                        onChange={(e) => setEditRulesData({ ...editRulesData, max_balance_hours: Number(e.target.value) })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">Maximum hours an employee can hold at any one time.</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Policy (Months)</label>
                                    <input
                                        type="number"
                                        value={editRulesData.expiry_months ?? 12}
                                        onChange={(e) => setEditRulesData({ ...editRulesData, expiry_months: Number(e.target.value) })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">Months until banked hours expire (e.g. 12 months).</p>
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingRules(false)}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingRules}
                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                                    >
                                        {savingRules ? 'Saving...' : 'Save Policy'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Adjust Modal */}
                {isAdjustModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
                            <h3 className="text-base font-bold text-slate-900">Adjust Staff Time Bank</h3>
                            
                            <form onSubmit={handleAdjust} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Employee</label>
                                    <select
                                        value={selectedEmployeeId}
                                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    >
                                        <option value="">Select Employee</option>
                                        {employeeBalances.map(b => (
                                            <option key={b.employee_id} value={b.employee_id}>
                                                {b.employee_name} (Current: {b.balance_hours}h)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Action Type</label>
                                    <select
                                        value={adjustType}
                                        onChange={(e) => setAdjustType(e.target.value as any)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="overtime_credit">Overtime Credit (+)</option>
                                        <option value="time_off_debit">Time-off Debit (-)</option>
                                        <option value="manual_adjustment">Manual Adjustment (+)</option>
                                        <option value="correction">Correction</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Hours</label>
                                    <input
                                        type="number"
                                        step="0.25"
                                        min="0.25"
                                        max="40"
                                        value={adjustHours}
                                        onChange={(e) => setAdjustHours(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Notes</label>
                                    <textarea
                                        value={adjustReason}
                                        onChange={(e) => setAdjustReason(e.target.value)}
                                        rows={2}
                                        placeholder="Reason for adjustment..."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAdjustModalOpen(false)}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submittingAdjust}
                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                                    >
                                        {submittingAdjust ? 'Submitting...' : 'Apply Transaction'}
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

export default TimeBankDashboard;
