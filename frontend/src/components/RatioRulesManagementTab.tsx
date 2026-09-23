import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Scale, Plus, Edit2, Trash2, CheckCircle2,
    XCircle, Info, Calendar, RefreshCw, Search,
    ShieldCheck, AlertCircle, ShieldAlert
} from 'lucide-react';
import api from '../api';

interface ProvinceItem {
    id: string;
    code: string;
    name: string;
}

interface SystemRatioRule {
    id: string;
    province: string | null;
    province_code: string | null;
    province_name: string | null;
    program_type: string | null;
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
}

export const RatioRulesManagementTab: React.FC = () => {
    const [rules, setRules] = useState<SystemRatioRule[]>([]);
    const [provinces, setProvinces] = useState<ProvinceItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Filter
    const [selectedProvinceFilter, setSelectedProvinceFilter] = useState<string>('ALL');

    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [editingRule, setEditingRule] = useState<SystemRatioRule | null>(null);

    const [formName, setFormName] = useState('');
    const [formProvince, setFormProvince] = useState('');
    const [formProgramType, setFormProgramType] = useState('');
    const [formMinAge, setFormMinAge] = useState(18);
    const [formMaxAge, setFormMaxAge] = useState(30);
    const [formMaxChildren, setFormMaxChildren] = useState(5);
    const [formWarningBuffer, setFormWarningBuffer] = useState(1);
    const [formRequiresECE, setFormRequiresECE] = useState(true);
    const [formQualRequirement, setFormQualRequirement] = useState('Certified ECE');
    const [formEffectiveFrom, setFormEffectiveFrom] = useState('2026-01-01');
    const [formEffectiveTo, setFormEffectiveTo] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchInitialData = useCallback(async () => {
        setRefreshing(true);
        setError(null);
        try {
            const [rulesRes, provRes] = await Promise.all([
                api.get('/super-admin/ratio-rules/'),
                api.get('/daycare/provinces/')
            ]);
            const rulesList = Array.isArray(rulesRes.data) ? rulesRes.data : (rulesRes.data.results || []);
            setRules(rulesList);

            const provList = Array.isArray(provRes.data) ? provRes.data : (provRes.data.results || []);
            setProvinces(provList);
        } catch (err: any) {
            console.error('Failed to load system ratio rules:', err);
            setError('Unable to load provincial ratio rules.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const handleOpenCreate = () => {
        setEditingRule(null);
        setFormName('');
        setFormProvince(provinces[0]?.id || '');
        setFormProgramType('');
        setFormMinAge(18);
        setFormMaxAge(30);
        setFormMaxChildren(5);
        setFormWarningBuffer(1);
        setFormRequiresECE(true);
        setFormQualRequirement('Certified ECE');
        setFormEffectiveFrom('2026-01-01');
        setFormEffectiveTo('');
        setFormNotes('');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (rule: SystemRatioRule) => {
        setEditingRule(rule);
        setFormName(rule.name);
        setFormProvince(rule.province || '');
        setFormProgramType(rule.program_type || '');
        setFormMinAge(rule.min_age_months);
        setFormMaxAge(rule.max_age_months);
        setFormMaxChildren(rule.max_children_per_staff);
        setFormWarningBuffer(rule.warning_threshold_buffer);
        setFormRequiresECE(rule.requires_qualified_ece);
        setFormQualRequirement(rule.qualification_requirement || 'Certified ECE');
        setFormEffectiveFrom(rule.effective_from || '2026-01-01');
        setFormEffectiveTo(rule.effective_to || '');
        setFormNotes(rule.notes || '');
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const payload = {
            name: formName,
            province: formProvince || null,
            program_type: formProgramType || null,
            min_age_months: formMinAge,
            max_age_months: formMaxAge,
            max_children_per_staff: formMaxChildren,
            warning_threshold_buffer: formWarningBuffer,
            requires_qualified_ece: formRequiresECE,
            qualification_requirement: formQualRequirement,
            effective_from: formEffectiveFrom,
            effective_to: formEffectiveTo || null,
            is_system_rule: true,
            notes: formNotes || null
        };

        try {
            if (editingRule) {
                await api.patch(`/super-admin/ratio-rules/${editingRule.id}/`, payload);
                setSuccessMessage('System baseline ratio rule updated.');
            } else {
                await api.post('/super-admin/ratio-rules/', payload);
                setSuccessMessage('System baseline ratio rule created.');
            }
            setIsModalOpen(false);
            setTimeout(() => setSuccessMessage(null), 4000);
            await fetchInitialData();
        } catch (err: any) {
            console.error('Failed to save system rule:', err);
            setError('Failed to save system ratio rule.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this system-level baseline rule?')) {
            return;
        }
        try {
            await api.delete(`/super-admin/ratio-rules/${id}/`);
            setSuccessMessage('System rule deleted.');
            setTimeout(() => setSuccessMessage(null), 4000);
            await fetchInitialData();
        } catch (err) {
            console.error('Failed to delete system rule:', err);
            setError('Failed to delete system rule.');
        }
    };

    const filteredRules = rules.filter(r => {
        if (selectedProvinceFilter === 'ALL') return true;
        return r.province === selectedProvinceFilter || r.province_code === selectedProvinceFilter;
    });

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-lime-400 to-amber-300"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-2 bg-emerald-600 text-white rounded-xl">
                                <Scale className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900">System-Level Provincial Ratio Rules</h2>
                        </div>
                        <p className="text-xs text-slate-500 max-w-2xl pl-9">
                            Manage platform-wide baseline child-to-educator ratios for all provinces. Daycares will inherit these defaults unless center-specific policies are configured.
                        </p>
                    </div>

                    <button
                        onClick={handleOpenCreate}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all self-start sm:self-auto"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Provincial Baseline</span>
                    </button>
                </div>
            </div>

            {/* Notifications */}
            <AnimatePresence>
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-semibold"
                    >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{successMessage}</span>
                    </motion.div>
                )}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-semibold"
                    >
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{error}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-slate-500">Filter by Province:</span>
                <select
                    value={selectedProvinceFilter}
                    onChange={e => setSelectedProvinceFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700"
                >
                    <option value="ALL">All Provinces / Standard</option>
                    {provinces.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                </select>
                <span className="text-xs font-semibold text-slate-400 ml-auto">
                    Showing {filteredRules.length} system rules
                </span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                            <tr>
                                <th className="px-5 py-3.5">Province</th>
                                <th className="px-5 py-3.5">Policy Name</th>
                                <th className="px-5 py-3.5">Age Range</th>
                                <th className="px-5 py-3.5">Max Ratio</th>
                                <th className="px-5 py-3.5">Buffer</th>
                                <th className="px-5 py-3.5">Qualification Requirement</th>
                                <th className="px-5 py-3.5">Effective Date</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                            {filteredRules.map(r => (
                                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-3.5">
                                        <span className="px-2.5 py-1 rounded-md bg-slate-100 font-extrabold text-slate-800 text-[11px]">
                                            {r.province_code || 'General'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 font-bold text-slate-900">{r.name}</td>
                                    <td className="px-5 py-3.5">{r.min_age_months} - {r.max_age_months} mo</td>
                                    <td className="px-5 py-3.5">
                                        <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold font-mono text-xs">
                                            1 : {r.max_children_per_staff}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5">{r.warning_threshold_buffer} child</td>
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
                                            onClick={() => handleDelete(r.id)}
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
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-slate-200 overflow-hidden"
                        >
                            <form onSubmit={handleSave}>
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <h3 className="text-base font-black text-slate-900">
                                        {editingRule ? 'Edit System Ratio Policy' : 'Create Provincial Baseline Ratio Policy'}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Policy Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={formName}
                                            onChange={e => setFormName(e.target.value)}
                                            placeholder="e.g. Ontario Preschool Baseline"
                                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Province Jurisdiction</label>
                                        <select
                                            value={formProvince}
                                            onChange={e => setFormProvince(e.target.value)}
                                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-semibold"
                                        >
                                            <option value="">General / All Provinces</option>
                                            {provinces.map(p => (
                                                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                            ))}
                                        </select>
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
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Warning Buffer</label>
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
                                            placeholder="e.g. Registered Early Childhood Educator (RECE)"
                                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                                        />
                                    </div>

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
                                </div>

                                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        {submitting ? 'Saving...' : 'Save Policy'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RatioRulesManagementTab;
