import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Sparkles, Search, Sliders, CheckCircle2, XCircle, RotateCcw, 
    Save, ShieldCheck, Check, Layers, AlertCircle, Info, Lock, Unlock,
    Users, School, Calendar, DollarSign, FileText, CheckSquare
} from 'lucide-react';
import api from '../api';

interface FeatureItem {
    id: string;
    code: string;
    name: string;
    description: string;
    category: string;
    is_in_plan: boolean;
    override_status: 'inherited' | 'force_enabled' | 'force_disabled';
    is_effective: boolean;
}

interface CareOptionsData {
    daycare_id: string;
    daycare_name: string;
    license_number?: string;
    active_plan: {
        id: string | null;
        name: string;
        features_count: number;
    };
    overrides: {
        enabled: string[];
        disabled: string[];
    };
    features: FeatureItem[];
    total_features: number;
    effective_count: number;
}

interface DaycareCareOptionsModalProps {
    isOpen: boolean;
    daycareId: string | null;
    daycareName?: string;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function DaycareCareOptionsModal({
    isOpen,
    daycareId,
    daycareName,
    onClose,
    onSuccess
}: DaycareCareOptionsModalProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState<CareOptionsData | null>(null);
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');

    // Local state for overrides before saving: code -> 'inherited' | 'force_enabled' | 'force_disabled'
    const [localOverrides, setLocalOverrides] = useState<Record<string, 'inherited' | 'force_enabled' | 'force_disabled'>>({});
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const fetchCareOptions = () => {
        if (!daycareId) return;
        setLoading(true);
        api.get(`/super-admin/daycares/${daycareId}/care-options/`)
            .then(res => {
                setData(res.data);
                const initialMap: Record<string, 'inherited' | 'force_enabled' | 'force_disabled'> = {};
                res.data.features.forEach((f: FeatureItem) => {
                    initialMap[f.code] = f.override_status;
                });
                setLocalOverrides(initialMap);
            })
            .catch(err => {
                console.error(err);
                setNotification({ type: 'error', message: 'Failed to load daycare care options.' });
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (isOpen && daycareId) {
            setSearch('');
            setSelectedCategory('All');
            setStatusFilter('All');
            setNotification(null);
            fetchCareOptions();
        }
    }, [isOpen, daycareId]);

    const categories = useMemo(() => {
        if (!data?.features) return ['All'];
        const cats = Array.from(new Set(data.features.map(f => f.category)));
        return ['All', ...cats];
    }, [data]);

    const handleOverrideChange = (code: string, newStatus: 'inherited' | 'force_enabled' | 'force_disabled') => {
        setLocalOverrides(prev => ({
            ...prev,
            [code]: newStatus
        }));
    };

    const handleResetAllToPlan = () => {
        if (!data) return;
        const resetMap: Record<string, 'inherited' | 'force_enabled' | 'force_disabled'> = {};
        data.features.forEach(f => {
            resetMap[f.code] = 'inherited';
        });
        setLocalOverrides(resetMap);
    };

    const handleEnableAll = () => {
        if (!data) return;
        const map: Record<string, 'inherited' | 'force_enabled' | 'force_disabled'> = {};
        data.features.forEach(f => {
            map[f.code] = 'force_enabled';
        });
        setLocalOverrides(map);
    };

    const handleDisableAll = () => {
        if (!data) return;
        const map: Record<string, 'inherited' | 'force_enabled' | 'force_disabled'> = {};
        data.features.forEach(f => {
            map[f.code] = 'force_disabled';
        });
        setLocalOverrides(map);
    };

    const handleSave = async () => {
        if (!daycareId || !data) return;
        setSaving(true);
        setNotification(null);

        const enabled: string[] = [];
        const disabled: string[] = [];

        Object.entries(localOverrides).forEach(([code, overrideStatus]) => {
            if (overrideStatus === 'force_enabled') enabled.push(code);
            if (overrideStatus === 'force_disabled') disabled.push(code);
        });

        try {
            const res = await api.post(`/super-admin/daycares/${daycareId}/care-options/`, {
                enabled,
                disabled
            });
            setData(res.data);
            setNotification({ type: 'success', message: 'Care options and feature overrides saved successfully!' });
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error(err);
            setNotification({ type: 'error', message: 'Failed to save care option overrides.' });
        } finally {
            setSaving(false);
        }
    };

    // Calculate live summary stats based on localOverrides
    const stats = useMemo(() => {
        if (!data?.features) return { total: 0, inPlan: 0, forceEnabled: 0, forceDisabled: 0, effective: 0 };
        let forceEnabled = 0;
        let forceDisabled = 0;
        let effective = 0;

        data.features.forEach(f => {
            const override = localOverrides[f.code] || 'inherited';
            if (override === 'force_enabled') forceEnabled++;
            if (override === 'force_disabled') forceDisabled++;

            const isEff = (f.is_in_plan && override !== 'force_disabled') || (override === 'force_enabled');
            if (isEff) effective++;
        });

        return {
            total: data.features.length,
            inPlan: data.features.filter(f => f.is_in_plan).length,
            forceEnabled,
            forceDisabled,
            effective
        };
    }, [data, localOverrides]);

    // Filter features
    const filteredFeatures = useMemo(() => {
        if (!data?.features) return [];
        return data.features.filter(f => {
            const currentOverride = localOverrides[f.code] || 'inherited';
            const isEff = (f.is_in_plan && currentOverride !== 'force_disabled') || (currentOverride === 'force_enabled');

            // Category filter
            if (selectedCategory !== 'All' && f.category !== selectedCategory) return false;

            // Status filter
            if (statusFilter === 'Force Enabled' && currentOverride !== 'force_enabled') return false;
            if (statusFilter === 'Force Disabled' && currentOverride !== 'force_disabled') return false;
            if (statusFilter === 'Inherited' && currentOverride !== 'inherited') return false;
            if (statusFilter === 'Active' && !isEff) return false;
            if (statusFilter === 'Inactive' && isEff) return false;

            // Search query
            if (search.trim()) {
                const q = search.toLowerCase();
                return f.name.toLowerCase().includes(q) || f.code.toLowerCase().includes(q) || f.description.toLowerCase().includes(q);
            }

            return true;
        });
    }, [data, localOverrides, selectedCategory, statusFilter, search]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
                
                {/* 1. Header with Daycare Context & Plan Badge */}
                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-cyan-50/30 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">
                                    {data?.daycare_name || daycareName || 'Daycare Center'}
                                </h3>
                                <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                                    Care Options & Overrides
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1">
                                <span>Active Plan: <strong className="text-slate-800">{data?.active_plan?.name || 'Loading...'}</strong></span>
                                <span>•</span>
                                <span>Plan Features: <strong className="text-indigo-700">{data?.active_plan?.features_count || 0} Included</strong></span>
                                {data?.license_number && (
                                    <>
                                        <span>•</span>
                                        <span>License: <strong className="text-slate-700">{data.license_number}</strong></span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Notification Banner */}
                {notification && (
                    <div className={`px-6 py-3 text-xs font-bold flex items-center justify-between border-b ${
                        notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                        <div className="flex items-center gap-2">
                            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                            <span>{notification.message}</span>
                        </div>
                        <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-700">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* 2. Key Metrics & Action Strip */}
                <div className="bg-slate-50/80 px-6 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 shrink-0">
                    {/* Stat Badges */}
                    <div className="flex items-center gap-2.5 flex-wrap text-xs">
                        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs font-semibold">
                            <span className="text-slate-500">Effective Active:</span>
                            <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                {stats.effective} / {stats.total}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs font-semibold">
                            <span className="text-slate-500">From Plan:</span>
                            <span className="font-bold text-slate-700">{stats.inPlan}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs font-semibold">
                            <span className="text-slate-500">Force Enabled:</span>
                            <span className="font-extrabold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-200">
                                +{stats.forceEnabled}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs font-semibold">
                            <span className="text-slate-500">Force Disabled:</span>
                            <span className="font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                                -{stats.forceDisabled}
                            </span>
                        </div>
                    </div>

                    {/* Bulk Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleResetAllToPlan}
                            className="px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-all flex items-center gap-1.5 shadow-2xs"
                            title="Reset all daycare options to match the active subscription tier exactly"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-500" /> Reset to Plan
                        </button>
                        <button
                            type="button"
                            onClick={handleEnableAll}
                            className="px-2.5 py-1.5 text-xs font-bold text-cyan-800 hover:text-cyan-950 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg transition-all flex items-center gap-1.5 shadow-2xs"
                        >
                            <Unlock className="w-3.5 h-3.5 text-cyan-600" /> Enable All
                        </button>
                        <button
                            type="button"
                            onClick={handleDisableAll}
                            className="px-2.5 py-1.5 text-xs font-bold text-rose-800 hover:text-rose-950 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all flex items-center gap-1.5 shadow-2xs"
                        >
                            <Lock className="w-3.5 h-3.5 text-rose-600" /> Disable All
                        </button>
                    </div>
                </div>

                {/* 3. Search & Filter Bar */}
                <div className="p-4 border-b border-slate-100 bg-white flex flex-wrap items-center gap-3 shrink-0">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search daycare options, features, modules..."
                            className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                        />
                    </div>

                    {/* Category Filter */}
                    <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                    >
                        {categories.map(c => (
                            <option key={c} value={c}>{c === 'All' ? 'All Domains & Categories' : c}</option>
                        ))}
                    </select>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                    >
                        <option value="All">All Override States</option>
                        <option value="Force Enabled">Force Enabled Overrides</option>
                        <option value="Force Disabled">Force Disabled Overrides</option>
                        <option value="Inherited">Inherited from Plan</option>
                        <option value="Active">Active for Daycare</option>
                        <option value="Inactive">Inactive for Daycare</option>
                    </select>
                </div>

                {/* 4. Feature List Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 space-y-3 scrollbar-thin">
                    {loading ? (
                        <div className="py-20 text-center text-slate-400 text-sm font-medium flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <span>Loading care options for daycare...</span>
                        </div>
                    ) : filteredFeatures.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 text-sm font-medium bg-white rounded-2xl border border-dashed border-slate-200 p-8">
                            No daycare options match your search or filter criteria.
                        </div>
                    ) : (
                        filteredFeatures.map(feat => {
                            const currentOverride = localOverrides[feat.code] || 'inherited';
                            const isEffective = (feat.is_in_plan && currentOverride !== 'force_disabled') || (currentOverride === 'force_enabled');

                            return (
                                <div 
                                    key={feat.id}
                                    className={`p-4 rounded-2xl border transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                        isEffective 
                                            ? 'bg-white border-slate-200/90 shadow-2xs hover:border-indigo-200' 
                                            : 'bg-slate-100/70 border-slate-200 opacity-80'
                                    }`}
                                >
                                    {/* Left Info */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <span className="font-black text-sm text-slate-900 tracking-tight">
                                                {feat.name}
                                            </span>
                                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                                {feat.code}
                                            </span>
                                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                {feat.category}
                                            </span>
                                            {feat.is_in_plan ? (
                                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                                                    Plan Default: Included
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600">
                                                    Plan Default: Not in Plan
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                            {feat.description}
                                        </p>
                                    </div>

                                    {/* Right Control Strip */}
                                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                                        
                                        {/* 3-State Segmented Control */}
                                        <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs font-bold shadow-2xs">
                                            <button
                                                type="button"
                                                onClick={() => handleOverrideChange(feat.code, 'inherited')}
                                                className={`px-2.5 py-1 rounded-lg transition-all ${
                                                    currentOverride === 'inherited'
                                                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-extrabold'
                                                        : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                                title="Follow the subscription plan default"
                                            >
                                                Inherit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleOverrideChange(feat.code, 'force_enabled')}
                                                className={`px-2.5 py-1 rounded-lg transition-all ${
                                                    currentOverride === 'force_enabled'
                                                        ? 'bg-cyan-600 text-white shadow-xs font-extrabold'
                                                        : 'text-cyan-700 hover:text-cyan-900'
                                                }`}
                                                title="Force this feature active for this daycare"
                                            >
                                                Force ON
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleOverrideChange(feat.code, 'force_disabled')}
                                                className={`px-2.5 py-1 rounded-lg transition-all ${
                                                    currentOverride === 'force_disabled'
                                                        ? 'bg-rose-600 text-white shadow-xs font-extrabold'
                                                        : 'text-rose-700 hover:text-rose-900'
                                                }`}
                                                title="Force this feature disabled for this daycare"
                                            >
                                                Force OFF
                                            </button>
                                        </div>

                                        {/* Effective Status Pill */}
                                        <div className="min-w-[85px] text-right">
                                            {isEffective ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                                    <Check className="w-3 h-3 text-emerald-600" /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-200/80 border border-slate-300 px-2.5 py-1 rounded-lg">
                                                    <X className="w-3 h-3 text-slate-400" /> Inactive
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* 5. Modal Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                    <div className="text-xs text-slate-500 font-medium">
                        Showing <strong className="text-slate-800">{filteredFeatures.length}</strong> of {stats.total} daycare options
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={saving || loading}
                            onClick={handleSave}
                            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white px-5 py-2.5 rounded-xl hover:from-indigo-700 hover:to-indigo-900 transition-all font-bold text-xs shadow-md shadow-indigo-200 disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    <span>Saving Care Options...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>Save Care Options</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
