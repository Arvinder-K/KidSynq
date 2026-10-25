import { useState, useEffect } from 'react';
import { Plus, Edit2, CheckCircle2, ShieldAlert, Trash2, Users, School, HardDrive, Building2, Check, Sparkles } from 'lucide-react';
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
            .then(res => setFeatures(res.data.results || res.data || []))
            .catch(console.error);
    };

    const fetchPlans = () => {
        setLoading(true);
        api.get('/super-admin/subscription-plans/')
            .then(res => setPlans(res.data.results || res.data || []))
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
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600" /> SaaS Subscription Plans & Daycare Options
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Configure daycare tiers, module options (Classrooms, Ratios, Billing, Staff, QR Pickups), capacity limits, and pricing.
                    </p>
                </div>
                <button 
                    onClick={() => { setSelectedPlan(null); setIsFormOpen(true); }}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-2.5 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all font-bold text-sm shadow-md shadow-indigo-200"
                >
                    <Plus className="w-4 h-4" /> Create New Plan
                </button>
            </div>

            {loading ? (
                <div className="text-center py-16 text-gray-500">Loading subscription plans...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {plans.map((plan) => {
                        const includedFeatureCount = plan.features?.length || 0;
                        return (
                            <div key={plan.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden flex flex-col transition-all ${plan.status === 'Inactive' ? 'border-gray-200 opacity-75' : 'border-indigo-100 hover:shadow-lg hover:border-indigo-200'}`}>
                                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-indigo-50/30 flex justify-between items-start">
                                    <div>
                                        <h4 className="text-lg font-black text-gray-900 tracking-tight">{plan.name}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${plan.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}`}>
                                                {plan.status}
                                            </span>
                                            <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
                                                {includedFeatureCount}/{features.length} Options Enabled
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button onClick={() => { setSelectedPlan(plan); setIsFormOpen(true); }} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-white rounded-xl transition-colors" title="Edit Plan">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => togglePlanStatus(plan)} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-white rounded-xl transition-colors" title="Toggle Status">
                                            {plan.status === 'Active' ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                                        </button>
                                        <button onClick={() => deletePlan(plan.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-white rounded-xl transition-colors" title="Delete Plan">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="p-6 flex-1 flex flex-col space-y-5">
                                    {plan.description && (
                                        <p className="text-xs text-gray-600 leading-relaxed">
                                            {plan.description}
                                        </p>
                                    )}

                                    {/* Pricing Breakdown */}
                                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1.5 text-xs">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Monthly</span>
                                            <span className="font-bold text-gray-900">${plan.monthly_price}/mo</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Annual</span>
                                            <span className="font-bold text-emerald-600">${plan.annual_price}/yr</span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-slate-200/60 pt-1.5 mt-1.5 text-[11px]">
                                            <span className="text-gray-500">Trial Period</span>
                                            <span className="font-semibold text-gray-700">{plan.trial_days} days</span>
                                        </div>
                                    </div>

                                    {/* Capacity Quotas */}
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="p-2 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2">
                                            <Users className="w-4 h-4 text-teal-600 shrink-0" />
                                            <div>
                                                <div className="text-[10px] text-gray-500">Students</div>
                                                <div className="font-bold text-gray-800">{plan.max_students === 0 ? 'Unlimited' : plan.max_students}</div>
                                            </div>
                                        </div>
                                        <div className="p-2 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2">
                                            <School className="w-4 h-4 text-indigo-600 shrink-0" />
                                            <div>
                                                <div className="text-[10px] text-gray-500">Classrooms</div>
                                                <div className="font-bold text-gray-800">{plan.max_classrooms === 0 ? 'Unlimited' : plan.max_classrooms}</div>
                                            </div>
                                        </div>
                                        <div className="p-2 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                                            <div>
                                                <div className="text-[10px] text-gray-500">Branches</div>
                                                <div className="font-bold text-gray-800">{plan.max_branches === -1 ? 'Unlimited' : plan.max_branches === 0 ? 'Disabled' : plan.max_branches}</div>
                                            </div>
                                        </div>
                                        <div className="p-2 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2">
                                            <HardDrive className="w-4 h-4 text-purple-600 shrink-0" />
                                            <div>
                                                <div className="text-[10px] text-gray-500">Storage</div>
                                                <div className="font-bold text-gray-800">{plan.max_storage_mb ? `${(plan.max_storage_mb/1024).toFixed(1)} GB` : 'Unlimited'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Included Features List */}
                                    <div className="mt-auto pt-2 border-t border-gray-100">
                                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">
                                            Daycare Options Enabled ({includedFeatureCount})
                                        </h5>
                                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                                            {features.map((feature) => {
                                                const isIncluded = plan.features?.includes(feature.id);
                                                return (
                                                    <div key={feature.id} className={`flex items-center gap-2 text-xs py-1 px-2 rounded-lg ${isIncluded ? 'bg-indigo-50/70 text-indigo-900 font-medium' : 'text-gray-400 opacity-40'}`}>
                                                        <Check className={`w-3.5 h-3.5 shrink-0 ${isIncluded ? 'text-indigo-600 font-bold' : 'text-gray-300'}`} />
                                                        <span className="truncate">{feature.name}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    {plans.length === 0 && (
                        <div className="col-span-full text-center py-16 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">No Plans Available</h3>
                            <p className="text-gray-500 text-sm mb-4">Create your first SaaS subscription plan with all daycare options.</p>
                            <button onClick={() => setIsFormOpen(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors font-bold text-sm inline-flex items-center gap-2 shadow-sm">
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
