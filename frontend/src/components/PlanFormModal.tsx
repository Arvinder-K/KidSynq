import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Save, CheckSquare, Square, Search, Sparkles, ShieldCheck, DollarSign, 
    Users, Briefcase, School, FileSpreadsheet, Layers, Tag, Check, Filter
} from 'lucide-react';
import api from '../api';

interface PlanFormModalProps {
    isOpen: boolean;
    plan?: any;
    features: any[];
    onClose: () => void;
    onSuccess: () => void;
}

const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string }> = {
    staff: { label: 'Staff & Workforce', icon: Briefcase, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    families: { label: 'Families & Enrollment', icon: Users, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
    operations: { label: 'Classrooms & Operations', icon: School, color: 'text-sky-700 bg-sky-50 border-sky-200' },
    daily: { label: 'Daily Reports & Feeds', icon: Sparkles, color: 'text-teal-700 bg-teal-50 border-teal-200' },
    finance: { label: 'Finance & Subsidies', icon: DollarSign, color: 'text-purple-700 bg-purple-50 border-purple-200' },
    reports: { label: 'Reporting & Compliance', icon: FileSpreadsheet, color: 'text-blue-700 bg-blue-50 border-blue-200' },
    other: { label: 'General Options', icon: Layers, color: 'text-gray-700 bg-gray-50 border-gray-200' }
};

const getFeatureCategory = (code: string): string => {
    if (['staff_management', 'staff_scheduling', 'staff_attendance', 'timesheet_approvals', 'leave_management', 'shift_swaps', 'staff_shortages', 'overtime_timebank', 'credential_compliance'].includes(code)) {
        return 'staff';
    }
    if (['students', 'admissions_waitlist', 'waitlist', 'consent_forms', 'communication', 'messaging'].includes(code)) {
        return 'families';
    }
    if (['classrooms', 'classroom_management', 'age_groups', 'out_of_school', 'branches', 'attendance', 'attendance_command', 'safe_arrival', 'pickup_verification', 'ratio_monitoring', 'ratio_rules', 'emergency_info', 'holidays_closures'].includes(code)) {
        return 'operations';
    }
    if (['daily_reports', 'daily_reports_history'].includes(code)) {
        return 'daily';
    }
    if (['billing_invoicing', 'billing', 'payments_receipts', 'subsidies_cwelcc', 'subsidies_tax', 'tax_receipts', 'fee_structures', 'discounts_credits'].includes(code)) {
        return 'finance';
    }
    if (['analytics', 'compliance_reports', 'attendance_reports', 'staff_reports', 'attendance_audit_trail', 'document_manager', 'documents', 'document_vault'].includes(code)) {
        return 'reports';
    }
    return 'other';
};

export default function PlanFormModal({ isOpen, plan, features, onClose, onSuccess }: PlanFormModalProps) {
    const [formData, setFormData] = useState<any>({
        name: '',
        description: '',
        monthly_price: 0,
        quarterly_price: 0,
        annual_price: 0,
        trial_days: 14,
        max_students: 0,
        max_teachers: 0,
        max_staff: 0,
        max_classrooms: 0,
        max_branches: 0,
        max_storage_mb: 5120,
        status: 'Active',
        features: []
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [featureFilter, setFeatureFilter] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    useEffect(() => {
        if (plan && isOpen) {
            setFormData({
                name: plan.name || '',
                description: plan.description || '',
                monthly_price: plan.monthly_price || 0,
                quarterly_price: plan.quarterly_price || 0,
                annual_price: plan.annual_price || 0,
                trial_days: plan.trial_days || 0,
                max_students: plan.max_students || 0,
                max_teachers: plan.max_teachers || 0,
                max_staff: plan.max_staff || 0,
                max_classrooms: plan.max_classrooms || 0,
                max_branches: plan.max_branches || 0,
                max_storage_mb: plan.max_storage_mb || 0,
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
                max_students: 0,
                max_teachers: 0,
                max_staff: 0,
                max_classrooms: 0,
                max_branches: 0,
                max_storage_mb: 5120,
                status: 'Active',
                features: []
            });
        }
        setError('');
        setFeatureFilter('');
        setSelectedCategory('all');
    }, [plan, isOpen]);

    const filteredFeatures = useMemo(() => {
        return features.filter(f => {
            const matchesSearch = !featureFilter || 
                f.name.toLowerCase().includes(featureFilter.toLowerCase()) || 
                f.code.toLowerCase().includes(featureFilter.toLowerCase()) ||
                (f.description && f.description.toLowerCase().includes(featureFilter.toLowerCase()));
            
            const category = getFeatureCategory(f.code);
            const matchesCategory = selectedCategory === 'all' || category === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    }, [features, featureFilter, selectedCategory]);

    const categoriesCount = useMemo(() => {
        const counts: Record<string, number> = { all: features.length };
        features.forEach(f => {
            const cat = getFeatureCategory(f.code);
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return counts;
    }, [features]);

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

    const handleSelectAllFeatures = () => {
        if (selectedCategory === 'all' && !featureFilter) {
            const allIds = features.map(f => f.id);
            setFormData({ ...formData, features: allIds });
        } else {
            const targetIds = filteredFeatures.map(f => f.id);
            const newSet = new Set([...formData.features, ...targetIds]);
            setFormData({ ...formData, features: Array.from(newSet) });
        }
    };

    const handleDeselectAllFeatures = () => {
        if (selectedCategory === 'all' && !featureFilter) {
            setFormData({ ...formData, features: [] });
        } else {
            const targetIds = new Set(filteredFeatures.map(f => f.id));
            setFormData({ ...formData, features: formData.features.filter((id: string) => !targetIds.has(id)) });
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full my-6 flex flex-col border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-indigo-50/50">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">{plan ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}</h3>
                            <p className="text-xs text-gray-500">Configure plan pricing, limits, and all daycare tasks & subtasks.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-6 max-h-[76vh] overflow-y-auto">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-medium">
                            {error}
                        </div>
                    )}
                    <form id="planForm" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-7">
                        
                        {/* Left Column: Details & Limits (5 cols) */}
                        <div className="lg:col-span-5 space-y-5">
                            
                            {/* Plan Details Card */}
                            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4.5 space-y-3.5">
                                <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                    <School className="w-4 h-4 text-indigo-600" /> Plan Overview
                                </h4>
                                
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Plan Name *</label>
                                    <input required type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Enterprise All-In-One" className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs" />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                                    <textarea name="description" value={formData.description} onChange={handleChange} rows={2} placeholder="Summary of what is included in this tier..." className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs"></textarea>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                                        <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-white border border-gray-200 p-2 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500">
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                            <option value="Archived">Archived</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Trial Period (Days)</label>
                                        <input type="number" min="0" name="trial_days" value={formData.trial_days} onChange={handleChange} className="w-full bg-white border border-gray-200 p-2 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Pricing Strategy Card */}
                            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4.5 space-y-3">
                                <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-emerald-600" /> Pricing Strategy
                                </h4>
                                
                                <div className="grid grid-cols-3 gap-2.5">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Monthly ($)</label>
                                        <input type="number" step="0.01" min="0" name="monthly_price" value={formData.monthly_price} onChange={handleChange} className="w-full bg-white border border-gray-200 p-2 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Quarterly ($)</label>
                                        <input type="number" step="0.01" min="0" name="quarterly_price" value={formData.quarterly_price} onChange={handleChange} className="w-full bg-white border border-gray-200 p-2 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Annual ($)</label>
                                        <input type="number" step="0.01" min="0" name="annual_price" value={formData.annual_price} onChange={handleChange} className="w-full bg-white border border-gray-200 p-2 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Limits & Quotas Card */}
                            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4.5 space-y-3">
                                <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                    <Users className="w-4 h-4 text-teal-600" /> Capacity Limits <span className="text-[11px] font-normal text-gray-500">(0 = Unlimited)</span>
                                </h4>
                                <div className="grid grid-cols-3 gap-2.5">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Max Students</label>
                                        <input type="number" min="0" name="max_students" value={formData.max_students} onChange={handleChange} className="w-full bg-white border border-gray-200 p-1.5 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Max Classrooms</label>
                                        <input type="number" min="0" name="max_classrooms" value={formData.max_classrooms} onChange={handleChange} className="w-full bg-white border border-gray-200 p-1.5 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Max Branches</label>
                                        <input type="number" name="max_branches" value={formData.max_branches} onChange={handleChange} placeholder="0=none" className="w-full bg-white border border-gray-200 p-1.5 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2.5 pt-1">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Max Staff</label>
                                        <input type="number" min="0" name="max_staff" value={formData.max_staff} onChange={handleChange} className="w-full bg-white border border-gray-200 p-1.5 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Max Teachers</label>
                                        <input type="number" min="0" name="max_teachers" value={formData.max_teachers} onChange={handleChange} className="w-full bg-white border border-gray-200 p-1.5 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Storage (MB)</label>
                                        <input type="number" min="0" name="max_storage_mb" value={formData.max_storage_mb} onChange={handleChange} placeholder="5120" className="w-full bg-white border border-gray-200 p-1.5 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Dynamic All Daycare Tasks & Subtasks (7 cols) */}
                        <div className="lg:col-span-7 flex flex-col space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-indigo-600" /> All Daycare Tasks & Subtasks
                                    </h4>
                                    <p className="text-[11px] text-gray-500">
                                        <strong className="text-indigo-600">{formData.features.length}</strong> of <strong>{features.length}</strong> tasks enabled
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        type="button" 
                                        onClick={handleSelectAllFeatures}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors border border-indigo-100"
                                    >
                                        Select All
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={handleDeselectAllFeatures}
                                        className="text-xs font-bold text-gray-500 hover:text-gray-700 bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors border border-gray-200"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {/* Category Filter Pills */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setSelectedCategory('all')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                                        selectedCategory === 'all' 
                                            ? 'bg-indigo-600 text-white shadow-xs' 
                                            : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                                    }`}
                                >
                                    All ({categoriesCount.all || 0})
                                </button>
                                {Object.entries(CATEGORY_MAP).filter(([key]) => key !== 'other' && categoriesCount[key]).map(([key, cat]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setSelectedCategory(key)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                                            selectedCategory === key 
                                                ? 'bg-indigo-600 text-white shadow-xs' 
                                                : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        <cat.icon className="w-3 h-3" />
                                        {cat.label.split(' ')[0]} ({categoriesCount[key] || 0})
                                    </button>
                                ))}
                            </div>

                            {/* Search Filter */}
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="text"
                                    value={featureFilter}
                                    onChange={(e) => setFeatureFilter(e.target.value)}
                                    placeholder="Search tasks & subtasks by name, code, or description..."
                                    className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 shadow-xs"
                                />
                            </div>

                            {/* Scrollable Feature Checklist */}
                            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 max-h-[440px] overflow-y-auto space-y-2">
                                {filteredFeatures.map((feature) => {
                                    const isChecked = formData.features.includes(feature.id);
                                    const catKey = getFeatureCategory(feature.code);
                                    const catMeta = CATEGORY_MAP[catKey] || CATEGORY_MAP.other;

                                    return (
                                        <div 
                                            key={feature.id} 
                                            onClick={() => toggleFeature(feature.id)}
                                            className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                                                isChecked 
                                                    ? 'bg-white border-indigo-200 shadow-xs ring-2 ring-indigo-50/70' 
                                                    : 'bg-white/60 border-gray-100 hover:border-gray-200 opacity-75'
                                            }`}
                                        >
                                            <div className="mt-0.5">
                                                {isChecked ? (
                                                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-gray-300" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-1.5 mb-0.5">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className={`text-xs font-bold truncate ${isChecked ? 'text-indigo-950' : 'text-gray-800'}`}>
                                                            {feature.name}
                                                        </span>
                                                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-medium hidden sm:inline-flex items-center gap-0.5 ${catMeta.color}`}>
                                                            {catMeta.label}
                                                        </span>
                                                    </div>
                                                    <span className="font-mono text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded flex-shrink-0">
                                                        {feature.code}
                                                    </span>
                                                </div>
                                                {feature.description && (
                                                    <p className="text-[11px] text-gray-500 leading-snug line-clamp-2">
                                                        {feature.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredFeatures.length === 0 && (
                                    <div className="text-center py-8 text-xs text-gray-400">
                                        No tasks or subtasks matching "{featureFilter}"
                                    </div>
                                )}
                            </div>
                        </div>

                    </form>
                </div>
                
                <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/90 flex justify-between items-center rounded-b-3xl">
                    <div className="text-xs text-gray-500">
                        Active Daycare Tasks: <strong className="text-indigo-600 font-bold">{formData.features.length}</strong> of <strong>{features.length}</strong> selected
                    </div>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-gray-700 text-sm font-semibold hover:bg-gray-100 rounded-xl transition-colors">
                            Cancel
                        </button>
                        <button type="submit" form="planForm" disabled={loading} className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-bold rounded-xl hover:from-indigo-700 hover:to-indigo-800 shadow-md shadow-indigo-200 transition-all flex items-center gap-2">
                            {loading ? 'Saving...' : <><Save className="w-4 h-4" /> Save Subscription Plan</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
