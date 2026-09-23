import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import api from '../api';

interface PlanFormModalProps {
    isOpen: boolean;
    plan?: any;
    features: any[];
    onClose: () => void;
    onSuccess: () => void;
}

export default function PlanFormModal({ isOpen, plan, features, onClose, onSuccess }: PlanFormModalProps) {
    const [formData, setFormData] = useState<any>({
        name: '',
        description: '',
        monthly_price: 0,
        quarterly_price: 0,
        annual_price: 0,
        trial_days: 14,
        max_staff: 0,
        max_teachers: 0,
        max_branches: 0,
        status: 'Active',
        features: []
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (plan && isOpen) {
            setFormData({
                name: plan.name || '',
                description: plan.description || '',
                monthly_price: plan.monthly_price || 0,
                quarterly_price: plan.quarterly_price || 0,
                annual_price: plan.annual_price || 0,
                trial_days: plan.trial_days || 0,
                max_staff: plan.max_staff || 0,
                max_teachers: plan.max_teachers || 0,
                max_branches: plan.max_branches || 0,
                status: plan.status || 'Active',
                features: plan.features || []
            });
        } else {
            setFormData({
                name: '',
                description: '',
                monthly_price: 0,
                quarterly_price: 0,
                annual_price: 0,
                trial_days: 14,
                max_staff: 0,
                max_teachers: 0,
                max_branches: 0,
                status: 'Active',
                features: []
            });
        }
        setError('');
    }, [plan, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const toggleFeature = (featureId: string) => {
        if (formData.features.includes(featureId)) {
            setFormData({ ...formData, features: formData.features.filter((id: string) => id !== featureId) });
        } else {
            setFormData({ ...formData, features: [...formData.features, featureId] });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            if (plan) {
                await api.patch(`/super-admin/subscription-plans/${plan.id}/`, formData);
            } else {
                await api.post('/super-admin/subscription-plans/', formData);
            }
            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'An error occurred while saving the plan.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full my-8 flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h3 className="text-xl font-bold text-gray-900">{plan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-6">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 text-sm">
                            {error}
                        </div>
                    )}
                    <form id="planForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        
                        {/* Left Column: Details & Pricing */}
                        <div className="space-y-5">
                            <h4 className="font-semibold text-gray-800 border-b pb-2">Plan Details</h4>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name *</label>
                                <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500"></textarea>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select name="status" value={formData.status} onChange={handleChange} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500">
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                        <option value="Archived">Archived</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Trial Days</label>
                                    <input type="number" min="0" name="trial_days" value={formData.trial_days} onChange={handleChange} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>

                            <h4 className="font-semibold text-gray-800 border-b pb-2 pt-4">Pricing Strategy</h4>
                            
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Monthly ($)</label>
                                    <input type="number" step="0.01" min="0" name="monthly_price" value={formData.monthly_price} onChange={handleChange} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Quarterly ($)</label>
                                    <input type="number" step="0.01" min="0" name="quarterly_price" value={formData.quarterly_price} onChange={handleChange} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Annual ($)</label>
                                    <input type="number" step="0.01" min="0" name="annual_price" value={formData.annual_price} onChange={handleChange} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>

                            <h4 className="font-semibold text-gray-800 border-b pb-2 pt-4">Limits</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Staff (0=unlimited)</label>
                                    <input type="number" min="0" name="max_staff" value={formData.max_staff} onChange={handleChange} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Teachers (0=unlimited)</label>
                                    <input type="number" min="0" name="max_teachers" value={formData.max_teachers} onChange={handleChange} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Branches (0=disabled, -1=unlimited)</label>
                                    <input type="number" name="max_branches" value={formData.max_branches} onChange={handleChange} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Dynamic Features */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-800 border-b pb-2">Included Features</h4>
                            <p className="text-sm text-gray-500 mb-4">Select the modules available for this subscription plan.</p>
                            
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-[500px] overflow-y-auto">
                                <div className="space-y-3">
                                    {features.map((feature) => (
                                        <label key={feature.id} className="flex items-start gap-3 cursor-pointer group">
                                            <div className="flex items-center h-6">
                                                <input 
                                                    type="checkbox" 
                                                    checked={formData.features.includes(feature.id)}
                                                    onChange={() => toggleFeature(feature.id)}
                                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">{feature.name}</span>
                                                {feature.description && (
                                                    <span className="text-xs text-gray-500">{feature.description}</span>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                    {features.length === 0 && (
                                        <div className="text-sm text-gray-500 italic text-center py-4">No features available in the database.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </form>
                </div>
                
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                    <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="planForm" disabled={loading} className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                        {loading ? 'Saving...' : <><Save className="w-4 h-4" /> Save Plan</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
