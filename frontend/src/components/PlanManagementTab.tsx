import { useState, useEffect } from 'react';
import { Plus, Edit2, CheckCircle2, ShieldAlert, Trash2 } from 'lucide-react';
import api from '../api';
import PlanFormModal from './PlanFormModal';

export default function PlanManagementTab() {
    const [plans, setPlans] = useState<any[]>([]);
    const [features, setFeatures] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<any>(null);

    const fetchFeatures = () => {
        api.get('/super-admin/subscription-features/')
            .then(res => setFeatures(res.data.results || res.data))
            .catch(console.error);
    };

    const fetchPlans = () => {
        setLoading(true);
        api.get('/super-admin/subscription-plans/')
            .then(res => setPlans(res.data.results || res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchFeatures();
        fetchPlans();
    }, []);

    const togglePlanStatus = (plan: any) => {
        const newStatus = plan.status === 'Active' ? 'Inactive' : 'Active';
        api.patch(`/super-admin/subscription-plans/${plan.id}/`, { status: newStatus })
            .then(fetchPlans)
            .catch(() => alert('Failed to update plan status.'));
    };

    const deletePlan = (planId: string) => {
        if (window.confirm('Are you sure you want to delete this subscription plan? This may affect daycares currently subscribed to it.')) {
            api.delete(`/super-admin/subscription-plans/${planId}/`)
                .then(fetchPlans)
                .catch((err) => {
                    alert(err.response?.data?.detail || 'Failed to delete plan.');
                });
        }
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Subscription Plans</h3>
                    <p className="text-sm text-gray-500 mt-1">Configure SaaS tiers, features, and pricing structures.</p>
                </div>
                <button 
                    onClick={() => { setSelectedPlan(null); setIsFormOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm"
                >
                    <Plus className="w-4 h-4" /> Create New Plan
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading subscription plans...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {plans.map((plan) => (
                        <div key={plan.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col ${plan.status === 'Inactive' ? 'border-gray-200 opacity-75' : 'border-indigo-100 hover:shadow-md transition-shadow'}`}>
                            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-start">
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900">{plan.name}</h4>
                                    <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium ${plan.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                                        {plan.status}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setSelectedPlan(plan); setIsFormOpen(true); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Plan">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => togglePlanStatus(plan)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Toggle Status">
                                        {plan.status === 'Active' ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => deletePlan(plan.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Plan">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="p-6 flex-1 flex flex-col">
                                <div className="mb-6 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Monthly</span>
                                        <span className="font-semibold">${plan.monthly_price}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Quarterly</span>
                                        <span className="font-semibold">${plan.quarterly_price}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Annual</span>
                                        <span className="font-semibold">${plan.annual_price}</span>
                                    </div>
                                    <div className="flex justify-between text-sm border-t pt-2 mt-2">
                                        <span className="text-gray-500">Trial Period</span>
                                        <span className="font-semibold">{plan.trial_days} days</span>
                                    </div>
                                </div>

                                <div className="mt-auto">
                                    <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Included Features</h5>
                                    <ul className="space-y-2">
                                        {features.map((feature) => {
                                            const isIncluded = plan.features?.includes(feature.id);
                                            return (
                                                <li key={feature.id} className={`flex items-center gap-2 text-sm ${isIncluded ? 'text-gray-700' : 'text-gray-400 opacity-50'}`}>
                                                    <CheckCircle2 className={`w-4 h-4 ${isIncluded ? 'text-indigo-500' : 'text-gray-300'}`} />
                                                    {feature.name}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {plans.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Plans Available</h3>
                            <p className="text-gray-500 mb-4">Create your first SaaS subscription plan to get started.</p>
                            <button onClick={() => setIsFormOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm inline-flex items-center gap-2">
                                <Plus className="w-4 h-4" /> Create Plan
                            </button>
                        </div>
                    )}
                </div>
            )}

            <PlanFormModal
                isOpen={isFormOpen}
                plan={selectedPlan}
                features={features}
                onClose={() => setIsFormOpen(false)}
                onSuccess={() => { setIsFormOpen(false); fetchPlans(); }}
            />
        </div>
    );
}
