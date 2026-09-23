import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Scale, Plus, Edit2, Trash2, CheckCircle2,
    XCircle, Info, Calendar, Baby, ArrowLeft,
    RefreshCw, Search, ShieldCheck, BookOpen, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api';

interface RatioRuleItem {
    id: string;
    daycare: string | null;
    province: string | null;
    province_code: string | null;
    province_name: string | null;
    program: string | null;
    program_name: string | null;
    program_type: string | null;
    age_group: string | null;
    age_group_name: string | null;
    name: string;
    min_age_months: number;
    max_age_months: number;
    max_children_per_staff: number;
    warning_threshold_buffer: number;
    requires_qualified_ece: boolean;
    qualification_requirement: string;
    effective_from: string;
    effective_to: string | null;
    is_system_rule: boolean;
    is_active: boolean;
    notes: string | null;
    created_at: string;
}

export const DaycareRatioRulesPage: React.FC = () => {
    const [rules, setRules] = useState<RatioRuleItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Modal state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [editingRule, setEditingRule] = useState<RatioRuleItem | null>(null);

    // Form data
    const [formName, setFormName] = useState('');
    const [formMinAge, setFormMinAge] = useState(18);
    const [formMaxAge, setFormMaxAge] = useState(30);
    const [formMaxChildren, setFormMaxChildren] = useState(5);
    const [formWarningBuffer, setFormWarningBuffer] = useState(1);
    const [formRequiresECE, setFormRequiresECE] = useState(true);
    const [formQualRequirement, setFormQualRequirement] = useState('Certified ECE');
    const [formEffectiveFrom, setFormEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
    const [formEffectiveTo, setFormEffectiveTo] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [formSubmitting, setFormSubmitting] = useState(false);

    const fetchRules = useCallback(async () => {
        setRefreshing(true);
        setError(null);
        try {
            const res = await api.get('/daycare/ratio-rules/', { params: { include_system: 'true' } });
            const dataList = Array.isArray(res.data) ? res.data : (res.data.results || []);
            setRules(dataList);
        } catch (err: any) {
            console.error('Failed to load ratio rules:', err);
            setError('Unable to load ratio rules.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    const handleOpenCreate = () => {
        setEditingRule(null);
        setFormName('');
        setFormMinAge(18);
        setFormMaxAge(30);
        setFormMaxChildren(5);
        setFormWarningBuffer(1);
        setFormRequiresECE(true);
        setFormQualRequirement('Certified ECE');
        setFormEffectiveFrom(new Date().toISOString().split('T')[0]);
        setFormEffectiveTo('');
        setFormNotes('');
        setIsCreateModalOpen(true);
    };

    const handleOpenEdit = (rule: RatioRuleItem) => {
        if (rule.is_system_rule) return;
        setEditingRule(rule);
        setFormName(rule.name);
        setFormMinAge(rule.min_age_months);
        setFormMaxAge(rule.max_age_months);
        setFormMaxChildren(rule.max_children_per_staff);
        setFormWarningBuffer(rule.warning_threshold_buffer);
        setFormRequiresECE(rule.requires_qualified_ece);
        setFormQualRequirement(rule.qualification_requirement || 'Certified ECE');
        setFormEffectiveFrom(rule.effective_from || new Date().toISOString().split('T')[0]);
        setFormEffectiveTo(rule.effective_to || '');
        setFormNotes(rule.notes || '');
        setIsCreateModalOpen(true);
    };

    const handleSaveRule = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormSubmitting(true);
        setError(null);

        const payload = {
            name: formName,
            min_age_months: formMinAge,
            max_age_months: formMaxAge,
            max_children_per_staff: formMaxChildren,
            warning_threshold_buffer: formWarningBuffer,
            requires_qualified_ece: formRequiresECE,
            qualification_requirement: formQualRequirement,
            effective_from: formEffectiveFrom,
            effective_to: formEffectiveTo || null,
            notes: formNotes || null
        };

        try {
            if (editingRule) {
                await api.patch(`/daycare/ratio-rules/${editingRule.id}/`, payload);
                setSuccessMessage('Ratio rule updated successfully.');
            } else {
                await api.post('/daycare/ratio-rules/', payload);
                setSuccessMessage('Custom ratio rule created successfully.');
            }
            setIsCreateModalOpen(false);
            setTimeout(() => setSuccessMessage(null), 4000);
            await fetchRules();
        } catch (err: any) {
            console.error('Failed to save rule:', err);
            setError(err.response?.data?.detail || 'Failed to save ratio rule.');
        } finally {
            setFormSubmitting(false);
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        if (!window.confirm('Are you sure you want to delete this custom ratio rule? Past compliance snapshots will remain preserved.')) {
            return;
        }
        try {
            await api.delete(`/daycare/ratio-rules/${ruleId}/`);
            setSuccessMessage('Custom ratio rule deleted.');
            setTimeout(() => setSuccessMessage(null), 4000);
            await fetchRules();
        } catch (err) {
            console.error('Failed to delete rule:', err);
            setError('Failed to delete ratio rule.');
        }
    };

    const daycareCustomRules = rules.filter(r => !r.is_system_rule && r.daycare);
    const systemBaselineRules = rules.filter(r => r.is_system_rule || !r.daycare);

    return (
        <Layout>
            <div className="space-y-6 pb-16 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <Link
                            to="/daycare/ratio-monitoring"
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1.5 mb-1 transition"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Back to Live Ratio Monitoring
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Ratio Rules & Provincial Policies
                        </h1>
                        <p className="text-sm font-medium text-gray-500 max-w-2xl mt-1">
                            Configure and maintain child-to-educator ratio thresholds, qualification requirements, and warning buffers for your center.
                        </p>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={handleOpenCreate}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create Custom Rule</span>
                        </button>

                        <button
                            onClick={fetchRules}
                            disabled={loading}
                            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs shadow-xs transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                {/* Notifications */}
                <AnimatePresence>
                    {successMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-semibold"
                        >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{successMessage}</span>
                        </motion.div>
                    )}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-semibold"
                        >
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{error}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Section 1: Daycare Custom Rules */}
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-emerald-600" />
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                                Center-Specific Custom Ratio Rules
                            </h2>
                            <span className="text-xs font-bold text-slate-400">({daycareCustomRules.length})</span>
                        </div>
                    </div>

                    {daycareCustomRules.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-center px-4">
                            <Scale className="w-10 h-10 text-slate-300 mb-2" />
                            <p className="text-xs font-semibold text-slate-600">No custom daycare rules created yet.</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Your classrooms will automatically utilize the provincial baseline policies below.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-600">
                                <thead className="bg-slate-50 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                    <tr>
                                        <th className="px-5 py-3">Rule Name</th>
                                        <th className="px-5 py-3">Age Range</th>
                                        <th className="px-5 py-3">Max Ratio</th>
                                        <th className="px-5 py-3">Warning Buffer</th>
                                        <th className="px-5 py-3">Qualification</th>
                                        <th className="px-5 py-3">Effective Date</th>
                                        <th className="px-5 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {daycareCustomRules.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-3.5 font-bold text-slate-900">{r.name}</td>
                                            <td className="px-5 py-3.5">{r.min_age_months} - {r.max_age_months} months</td>
                                            <td className="px-5 py-3.5">
                                                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold font-mono text-xs">
                                                    1 : {r.max_children_per_staff}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">{r.warning_threshold_buffer} child buffer</td>
                                            <td className="px-5 py-3.5">{r.qualification_requirement}</td>
                                            <td className="px-5 py-3.5">{r.effective_from}</td>
                                            <td className="px-5 py-3.5 text-right space-x-1.5">
                                                <button
                                                    onClick={() => handleOpenEdit(r)}
                                                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRule(r.id)}
                                                    className="p-1.5 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Section 2: Provincial Baseline Rules */}
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                                Applicable Provincial Baseline Policies
                            </h2>
                            <span className="text-xs font-bold text-slate-400">({systemBaselineRules.length})</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600">
                            <thead className="bg-slate-50 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                <tr>
                                    <th className="px-5 py-3">Jurisdiction</th>
                                    <th className="px-5 py-3">Policy Name</th>
                                    <th className="px-5 py-3">Age Range</th>
                                    <th className="px-5 py-3">Standard Ratio</th>
                                    <th className="px-5 py-3">Qualification Requirement</th>
                                    <th className="px-5 py-3">Effective Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {systemBaselineRules.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700">
                                                {r.province_code || 'General'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 font-bold text-slate-900">{r.name}</td>
                                        <td className="px-5 py-3.5">{r.min_age_months} - {r.max_age_months} months</td>
                                        <td className="px-5 py-3.5">
                                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-extrabold font-mono text-xs">
                                                1 : {r.max_children_per_staff}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">{r.qualification_requirement}</td>
                                        <td className="px-5 py-3.5">{r.effective_from}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Create/Edit Rule Modal */}
                <AnimatePresence>
                    {isCreateModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-slate-200 overflow-hidden"
                            >
                                <form onSubmit={handleSaveRule}>
                                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                        <h3 className="text-base font-black text-slate-900">
                                            {editingRule ? 'Edit Custom Ratio Rule' : 'Create Custom Ratio Rule'}
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => setIsCreateModalOpen(false)}
                                            className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                                        >
                                            <XCircle className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Rule Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={formName}
                                                onChange={e => setFormName(e.target.value)}
                                                placeholder="e.g. Toddler Enhanced 1:4"
                                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Min Age (Months)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    value={formMinAge}
                                                    onChange={e => setFormMinAge(Number(e.target.value))}
                                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Max Age (Months)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    value={formMaxAge}
                                                    onChange={e => setFormMaxAge(Number(e.target.value))}
                                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Max Children Per Staff</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="50"
                                                    required
                                                    value={formMaxChildren}
                                                    onChange={e => setFormMaxChildren(Number(e.target.value))}
                                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Warning Buffer (Children)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formWarningBuffer}
                                                    onChange={e => setFormWarningBuffer(Number(e.target.value))}
                                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Qualification Requirement</label>
                                            <input
                                                type="text"
                                                value={formQualRequirement}
                                                onChange={e => setFormQualRequirement(e.target.value)}
                                                placeholder="e.g. Registered ECE Certificate"
                                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Effective From</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={formEffectiveFrom}
                                                    onChange={e => setFormEffectiveFrom(e.target.value)}
                                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Effective To (Optional)</label>
                                                <input
                                                    type="date"
                                                    value={formEffectiveTo}
                                                    onChange={e => setFormEffectiveTo(e.target.value)}
                                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Internal Notes</label>
                                            <textarea
                                                rows={2}
                                                value={formNotes}
                                                onChange={e => setFormNotes(e.target.value)}
                                                placeholder="Optional notes regarding this ratio policy"
                                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsCreateModalOpen(false)}
                                            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={formSubmitting}
                                            className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                        >
                                            {formSubmitting ? 'Saving...' : 'Save Rule'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </Layout>
    );
};

export default DaycareRatioRulesPage;
