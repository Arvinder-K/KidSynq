import { useState, useEffect } from 'react';
import { Edit2, Play, Pause, Ban, RefreshCw, X, Plus } from 'lucide-react';
import api from '../api';

export default function SubscriptionManagementTab() {
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState<any[]>([]);
    const [daycares, setDaycares] = useState<any[]>([]);
    
    // Modal state for assigning sub
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newSubData, setNewSubData] = useState({ daycare: '', subscription_plan: '', billing_cycle: 'Monthly' });
    
    // Modal state for changing plans
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSub, setSelectedSub] = useState<any>(null);
    const [newPlanId, setNewPlanId] = useState('');
    const [newBillingCycle, setNewBillingCycle] = useState('Monthly');

    const fetchSubscriptions = () => {
        setLoading(true);
        api.get('/super-admin/subscriptions/assigned/')
            .then(res => setSubscriptions(res.data.results || res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    const fetchPlans = () => {
        api.get('/super-admin/subscription-plans/')
            .then(res => setPlans(res.data.results || res.data))
            .catch(console.error);
    };

    const fetchDaycares = () => {
        api.get('/super-admin/daycares/')
            .then(res => setDaycares(res.data.results || res.data))
            .catch(console.error);
    };

    useEffect(() => {
        fetchSubscriptions();
        fetchPlans();
        fetchDaycares();
    }, []);

    const handleCreateSubscription = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const plan = plans.find(p => p.id === newSubData.subscription_plan);
            let amount = 0;
            if (plan) {
                if (newSubData.billing_cycle === 'Monthly') amount = plan.monthly_price;
                if (newSubData.billing_cycle === 'Quarterly') amount = plan.quarterly_price;
                if (newSubData.billing_cycle === 'Annual') amount = plan.annual_price;
            }
            
            await api.post('/super-admin/subscriptions/assigned/', {
                ...newSubData,
                amount: amount,
                subscription_status: 'Active'
            });
            setIsAddModalOpen(false);
            setNewSubData({ daycare: '', subscription_plan: '', billing_cycle: 'Monthly' });
            fetchSubscriptions();
        } catch (err) {
            alert('Failed to assign subscription');
        }
    };

    const handleAction = async (subId: string, action: string) => {
        if (!confirm(`Are you sure you want to ${action} this subscription?`)) return;
        try {
            await api.post(`/super-admin/subscriptions/assigned/${subId}/${action}/`, {});
            fetchSubscriptions();
            if (action === 'renew') {
                alert('Subscription renewed. Invoice and Payment mocked successfully.');
            }
        } catch (err) {
            alert(`Failed to ${action} subscription`);
        }
    };

    const handleUpdatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const plan = plans.find(p => p.id === newPlanId);
            let amount = 0;
            if (plan) {
                if (newBillingCycle === 'Monthly') amount = plan.monthly_price;
                if (newBillingCycle === 'Quarterly') amount = plan.quarterly_price;
                if (newBillingCycle === 'Annual') amount = plan.annual_price;
            }
            
            await api.patch(`/super-admin/subscriptions/assigned/${selectedSub.id}/`, {
                subscription_plan: newPlanId,
                billing_cycle: newBillingCycle,
                amount: amount
            });
            setIsModalOpen(false);
            fetchSubscriptions();
        } catch (err) {
            alert('Failed to update subscription');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'trial': return 'bg-blue-100 text-blue-800';
            case 'past_due': return 'bg-yellow-100 text-yellow-800';
            case 'expired': return 'bg-red-100 text-red-800';
            case 'suspended': return 'bg-orange-100 text-orange-800';
            case 'cancelled': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="p-8">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Daycare Subscriptions</h3>
                    <p className="text-sm text-gray-500 mt-1">Manage active subscriptions, change plans, and trigger renewals.</p>
                </div>
                <button onClick={() => setIsAddModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm flex items-center">
                    <Plus className="w-4 h-4 mr-1" /> Assign Sub
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading subscriptions...</div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Daycare</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Plan</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Billing Cycle</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Dates</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {subscriptions.map((sub) => (
                                    <tr key={sub.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-medium text-gray-900">{sub.daycare_name || sub.daycare}</td>
                                        <td className="p-4 text-sm text-gray-600">{sub.plan_name || 'Unknown'}</td>
                                        <td className="p-4 text-sm text-gray-600">{sub.billing_cycle}</td>
                                        <td className="p-4 text-sm font-medium text-gray-900">${sub.amount}</td>
                                        <td className="p-4 text-xs text-gray-500">
                                            <div>Start: {sub.start_date || 'N/A'}</div>
                                            <div>Exp: {sub.expiry_date || 'N/A'}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(sub.subscription_status)}`}>
                                                {sub.subscription_status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => { setSelectedSub(sub); setNewPlanId(sub.subscription_plan); setNewBillingCycle(sub.billing_cycle); setIsModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Change Plan">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleAction(sub.id, 'renew')} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Renew / Process Payment">
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                                {sub.subscription_status === 'Active' ? (
                                                    <button onClick={() => handleAction(sub.id, 'suspend')} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" title="Suspend">
                                                        <Pause className="w-4 h-4" />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleAction(sub.id, 'renew')} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded" title="Activate">
                                                        <Play className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => handleAction(sub.id, 'cancel')} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Cancel">
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {subscriptions.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-500">No subscriptions found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Update Subscription</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdatePlan} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Plan</label>
                                <select required value={newPlanId} onChange={(e) => setNewPlanId(e.target.value)} className="w-full border rounded-lg p-2.5">
                                    <option value="">Select a plan...</option>
                                    {plans.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Cycle</label>
                                <select required value={newBillingCycle} onChange={(e) => setNewBillingCycle(e.target.value)} className="w-full border rounded-lg p-2.5">
                                    <option value="Monthly">Monthly</option>
                                    <option value="Quarterly">Quarterly</option>
                                    <option value="Annual">Annual</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white rounded-lg py-2 font-medium hover:bg-indigo-700">
                                Save Changes
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Assign Subscription</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateSubscription} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Daycare</label>
                                <select required value={newSubData.daycare} onChange={(e) => setNewSubData({...newSubData, daycare: e.target.value})} className="w-full border rounded-lg p-2.5">
                                    <option value="">Select a daycare...</option>
                                    {daycares.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Plan</label>
                                <select required value={newSubData.subscription_plan} onChange={(e) => setNewSubData({...newSubData, subscription_plan: e.target.value})} className="w-full border rounded-lg p-2.5">
                                    <option value="">Select a plan...</option>
                                    {plans.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Cycle</label>
                                <select required value={newSubData.billing_cycle} onChange={(e) => setNewSubData({...newSubData, billing_cycle: e.target.value})} className="w-full border rounded-lg p-2.5">
                                    <option value="Monthly">Monthly</option>
                                    <option value="Quarterly">Quarterly</option>
                                    <option value="Annual">Annual</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white rounded-lg py-2 font-medium hover:bg-indigo-700">
                                Assign Subscription
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
