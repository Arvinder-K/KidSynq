import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Tag, Percent, Users, CreditCard, Clock, Calculator, Plus, Filter,
    Search, CheckCircle2, XCircle, History, Calendar, RefreshCw,
    ArrowRight, AlertCircle, Edit, Trash2, ShieldAlert, Sparkles,
    ShieldCheck, DollarSign, ArrowUpRight, HelpCircle, FileText, ChevronRight, X
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';
import {
    billingService,
    type DiscountRule,
    type SiblingDiscountRule,
    type CreditTransaction,
    type LateFeeRule
} from '../../../api/billingService';

export const DiscountsCreditsLateFeesPage: React.FC = () => {
    // Active Tab
    const [activeTab, setActiveTab] = useState<'discounts' | 'sibling' | 'credits' | 'late_fees' | 'calculator'>('discounts');

    // Data States
    const [discounts, setDiscounts] = useState<DiscountRule[]>([]);
    const [siblingRules, setSiblingRules] = useState<SiblingDiscountRule[]>([]);
    const [credits, setCredits] = useState<CreditTransaction[]>([]);
    const [lateFees, setLateFees] = useState<LateFeeRule[]>([]);
    const [families, setFamilies] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [programs, setPrograms] = useState<any[]>([]);
    const [classrooms, setClassrooms] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);

    // UI States
    const [loading, setLoading] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filterScope, setFilterScope] = useState<string>('ALL');
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Modals
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [editingDiscount, setEditingDiscount] = useState<DiscountRule | null>(null);
    const [versioningDiscount, setVersioningDiscount] = useState<DiscountRule | null>(null);
    const [discountHistoryList, setDiscountHistoryList] = useState<DiscountRule[]>([]);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);

    const [isSiblingModalOpen, setIsSiblingModalOpen] = useState(false);
    const [editingSiblingRule, setEditingSiblingRule] = useState<SiblingDiscountRule | null>(null);

    const [isGrantCreditModalOpen, setIsGrantCreditModalOpen] = useState(false);
    const [reversalTarget, setReversalTarget] = useState<CreditTransaction | null>(null);
    const [reversalReason, setReversalReason] = useState<string>('');

    const [isLateFeeModalOpen, setIsLateFeeModalOpen] = useState(false);
    const [editingLateFee, setEditingLateFee] = useState<LateFeeRule | null>(null);

    // Form States
    const [discountForm, setDiscountForm] = useState({
        name: '',
        description: '',
        discount_type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
        value: '10.00',
        currency: 'CAD',
        applies_to: 'ALL' as any,
        program: '',
        classroom: '',
        branch: '',
        family: '',
        student: '',
        target_fee_type: '',
        priority: 10,
        effective_from: new Date().toISOString().split('T')[0],
        effective_until: '',
        is_active: true
    });

    const [versionForm, setVersionForm] = useState({
        value: '',
        effective_from: '',
        notes: ''
    });

    const [siblingForm, setSiblingForm] = useState({
        name: 'Standard Sibling Discount Policy',
        description: '',
        discount_type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
        value: '10.00',
        currency: 'CAD',
        applies_to_target: 'SUBSEQUENT_CHILDREN' as any,
        target_fee_selection: 'LOWEST_FEE' as any,
        ordering_criteria: 'AGE_DESCENDING' as any,
        min_enrolled_siblings: 2,
        effective_from: new Date().toISOString().split('T')[0],
        effective_until: '',
        is_active: true
    });

    const [creditForm, setCreditForm] = useState({
        family: '',
        student: '',
        amount: '',
        reason: '',
        transaction_type: 'CREDIT',
        reference: '',
        notes: ''
    });

    const [lateFeeForm, setLateFeeForm] = useState({
        name: 'Standard Overdue Late Fee',
        description: '',
        fee_type: 'FIXED' as 'FIXED' | 'PERCENTAGE',
        amount: '25.00',
        currency: 'CAD',
        grace_period_days: 5,
        frequency: 'ONE_TIME' as any,
        max_amount: '100.00',
        effective_from: new Date().toISOString().split('T')[0],
        effective_until: '',
        is_active: true
    });

    // Sibling Preview Interactive State
    const [previewFamilyId, setPreviewFamilyId] = useState<string>('');
    const [siblingPreviewResult, setSiblingPreviewResult] = useState<any>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    // Credit Balance Lookup State
    const [lookupFamilyId, setLookupFamilyId] = useState<string>('');
    const [familyBalanceInfo, setFamilyBalanceInfo] = useState<any>(null);

    // Late Fee Evaluation Simulator State
    const [simDueDate, setSimDueDate] = useState<string>(new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0]);
    const [simOverdueBalance, setSimOverdueBalance] = useState<string>('1200.00');
    const [simEvalDate, setSimEvalDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [simLateFeeResult, setSimLateFeeResult] = useState<any>(null);

    // Master Calculator State
    const [calcMode, setCalcMode] = useState<'child' | 'family'>('family');
    const [calcFamilyId, setCalcFamilyId] = useState<string>('');
    const [calcStudentId, setCalcStudentId] = useState<string>('');
    const [calcTargetDate, setCalcTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [calcApplyCredits, setCalcApplyCredits] = useState<boolean>(true);
    const [masterCalcResult, setMasterCalcResult] = useState<any>(null);
    const [calcLoading, setCalcLoading] = useState<boolean>(false);

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    const extractErrorMessage = (err: any, fallback: string) => {
        if (err.response?.data?.error) return err.response.data.error;
        if (err.response?.data?.detail) return err.response.data.detail;
        if (err.response?.data && typeof err.response.data === 'object') {
            const entries = Object.entries(err.response.data);
            if (entries.length > 0) {
                return entries.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | ');
            }
        }
        return err.message || fallback;
    };

    const loadAllData = useCallback(async () => {
        try {
            setLoading(true);
            const [
                discountsData,
                siblingData,
                creditsData,
                lateFeesData,
                familiesRes,
                studentsRes,
                programsRes,
                classroomsRes,
                branchesRes
            ] = await Promise.all([
                billingService.getDiscounts().catch(() => []),
                billingService.getSiblingDiscounts().catch(() => []),
                billingService.getCredits().catch(() => []),
                billingService.getLateFees().catch(() => []),
                api.get('daycare/families/').catch(() => ({ data: [] })),
                api.get('daycare/students/').catch(() => ({ data: [] })),
                api.get('daycare/programs/').catch(() => ({ data: [] })),
                api.get('daycare/classrooms/').catch(() => ({ data: [] })),
                api.get('daycare/branches/').catch(() => ({ data: [] })),
            ]);

            setDiscounts(Array.isArray(discountsData) ? discountsData : []);
            setSiblingRules(Array.isArray(siblingData) ? siblingData : []);
            setCredits(Array.isArray(creditsData) ? creditsData : []);
            setLateFees(Array.isArray(lateFeesData) ? lateFeesData : []);
            setFamilies(familiesRes.data?.results || familiesRes.data || []);
            setStudents(studentsRes.data?.results || studentsRes.data || []);
            setPrograms(programsRes.data?.results || programsRes.data || []);
            setClassrooms(classroomsRes.data?.results || classroomsRes.data || []);
            setBranches(branchesRes.data?.results || branchesRes.data || []);
        } catch (err: any) {
            showToast(extractErrorMessage(err, 'Failed to load billing configuration'), 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    // Handle Discount Submit
    const handleSaveDiscount = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...discountForm,
                program: discountForm.program || null,
                classroom: discountForm.classroom || null,
                branch: discountForm.branch || null,
                family: discountForm.family || null,
                student: discountForm.student || null,
                target_fee_type: discountForm.target_fee_type || null,
                effective_until: discountForm.effective_until || null
            };

            if (editingDiscount) {
                await billingService.updateDiscount(editingDiscount.id, payload);
                showToast('Discount rule updated successfully.');
            } else {
                await billingService.createDiscount(payload);
                showToast('Discount rule created successfully.');
            }
            setIsDiscountModalOpen(false);
            setEditingDiscount(null);
            loadAllData();
        } catch (err: any) {
            showToast(extractErrorMessage(err, 'Failed to save discount rule.'), 'error');
        }
    };

    // Handle Discount Versioning
    const handleCreateDiscountVersion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!versioningDiscount) return;
        try {
            await billingService.createDiscountVersion(versioningDiscount.id, {
                value: versionForm.value,
                effective_from: versionForm.effective_from,
                notes: versionForm.notes
            });
            showToast('New discount rule version created successfully.');
            setVersioningDiscount(null);
            loadAllData();
        } catch (err: any) {
            showToast(extractErrorMessage(err, 'Failed to create discount version.'), 'error');
        }
    };

    // Handle Sibling Rule Submit
    const handleSaveSiblingRule = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...siblingForm,
                effective_until: siblingForm.effective_until || null
            };
            if (editingSiblingRule) {
                await billingService.updateSiblingDiscount(editingSiblingRule.id, payload);
                showToast('Sibling discount rule updated.');
            } else {
                await billingService.createSiblingDiscount(payload);
                showToast('Sibling discount rule configured.');
            }
            setIsSiblingModalOpen(false);
            setEditingSiblingRule(null);
            loadAllData();
        } catch (err: any) {
            showToast(extractErrorMessage(err, 'Failed to save sibling rule.'), 'error');
        }
    };

    // Handle Sibling Preview
    const handleRunSiblingPreview = async () => {
        if (!previewFamilyId) return;
        try {
            setPreviewLoading(true);
            const res = await billingService.previewFamilySiblingDiscount(previewFamilyId);
            setSiblingPreviewResult(res);
        } catch (err: any) {
            showToast(extractErrorMessage(err, 'Failed to preview sibling discounts.'), 'error');
        } finally {
            setPreviewLoading(false);
        }
    };

    // Handle Credit Grant
    const handleGrantCredit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await billingService.grantCredit({
                family: creditForm.family,
                student: creditForm.student || undefined,
                amount: creditForm.amount,
                reason: creditForm.reason,
                transaction_type: creditForm.transaction_type,
                reference: creditForm.reference,
                notes: creditForm.notes
            });
            showToast('Customer credit granted successfully.');
            setIsGrantCreditModalOpen(false);
            setCreditForm({ family: '', student: '', amount: '', reason: '', transaction_type: 'CREDIT', reference: '', notes: '' });
            loadAllData();
        } catch (err: any) {
            showToast(extractErrorMessage(err, 'Failed to grant credit.'), 'error');
        }
    };

    // Handle Credit Reversal
    const handleReverseCredit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reversalTarget) return;
        try {
            await billingService.reverseCredit(reversalTarget.id, reversalReason || 'Administrative reversal');
            showToast('Credit transaction reversed.');
            setReversalTarget(null);
            setReversalReason('');
            loadAllData();
        } catch (err: any) {
            showToast(extractErrorMessage(err, 'Failed to reverse credit.'), 'error');
        }
    };

    // Handle Late Fee Submit
    const handleSaveLateFee = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...lateFeeForm,
                max_amount: lateFeeForm.max_amount || null,
                effective_until: lateFeeForm.effective_until || null
            };
            if (editingLateFee) {
                await billingService.updateLateFee(editingLateFee.id, payload);
                showToast('Late fee rule updated.');
            } else {
                await billingService.createLateFee(payload);
                showToast('Late fee rule created.');
            }
            setIsLateFeeModalOpen(false);
            setEditingLateFee(null);
            loadAllData();
        } catch (err: any) {
            showToast(extractErrorMessage(err, 'Failed to save late fee rule.'), 'error');
        }
    };

    // Handle Run Late Fee Simulator
    const handleRunLateFeeSim = async () => {
        try {
            const res = await billingService.evaluateLateFee({
                due_date: simDueDate,
                overdue_balance: simOverdueBalance,
                evaluation_date: simEvalDate
            });
            setSimLateFeeResult(res);
        } catch (err: any) {
            showToast(extractErrorMessage(err, 'Late fee calculation failed.'), 'error');
        }
    };

    // Handle Master Billing Calculator
    const handleRunMasterCalculation = async () => {
        try {
            setCalcLoading(true);
            if (calcMode === 'family') {
                if (!calcFamilyId) return;
                const res = await billingService.calculateFamilyBreakdown({
                    family_id: calcFamilyId,
                    target_date: calcTargetDate,
                    apply_available_credits: calcApplyCredits
                });
                setMasterCalcResult(res);
            } else {
                if (!calcStudentId) return;
                const res = await billingService.calculateChildBreakdown({
                    student_id: calcStudentId,
                    target_date: calcTargetDate
                });
                setMasterCalcResult(res);
            }
        } catch (err: any) {
            showToast(extractErrorMessage(err, 'Calculation failed.'), 'error');
        } finally {
            setCalcLoading(false);
        }
    };

    return (
        <Layout>
            <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
                {/* Toast Notification */}
                <AnimatePresence>
                    {toastMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-bold ${
                                toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                            }`}
                        >
                            {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            <span>{toastMessage.text}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Billing Policies, Discounts & Credits</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Configure standard discounts, deterministic sibling policies, customer credit ledgers, and overdue late fees.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2.5 items-center">
                        {activeTab === 'discounts' && (
                            <button
                                onClick={() => {
                                    setEditingDiscount(null);
                                    setDiscountForm({
                                        name: '',
                                        description: '',
                                        discount_type: 'PERCENTAGE',
                                        value: '10.00',
                                        currency: 'CAD',
                                        applies_to: 'ALL',
                                        program: '',
                                        classroom: '',
                                        branch: '',
                                        family: '',
                                        student: '',
                                        target_fee_type: '',
                                        priority: 10,
                                        effective_from: new Date().toISOString().split('T')[0],
                                        effective_until: '',
                                        is_active: true
                                    });
                                    setIsDiscountModalOpen(true);
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                <span>New Discount Rule</span>
                            </button>
                        )}
                        {activeTab === 'sibling' && (
                            <button
                                onClick={() => {
                                    setEditingSiblingRule(null);
                                    setSiblingForm({
                                        name: 'Standard Sibling Discount Policy',
                                        description: '',
                                        discount_type: 'PERCENTAGE',
                                        value: '10.00',
                                        currency: 'CAD',
                                        applies_to_target: 'SUBSEQUENT_CHILDREN',
                                        target_fee_selection: 'LOWEST_FEE',
                                        ordering_criteria: 'AGE_DESCENDING',
                                        min_enrolled_siblings: 2,
                                        effective_from: new Date().toISOString().split('T')[0],
                                        effective_until: '',
                                        is_active: true
                                    });
                                    setIsSiblingModalOpen(true);
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Configure Sibling Rule</span>
                            </button>
                        )}
                        {activeTab === 'credits' && (
                            <button
                                onClick={() => setIsGrantCreditModalOpen(true)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Grant Customer Credit</span>
                            </button>
                        )}
                        {activeTab === 'late_fees' && (
                            <button
                                onClick={() => {
                                    setEditingLateFee(null);
                                    setLateFeeForm({
                                        name: 'Standard Overdue Late Fee',
                                        description: '',
                                        fee_type: 'FIXED',
                                        amount: '25.00',
                                        currency: 'CAD',
                                        grace_period_days: 5,
                                        frequency: 'ONE_TIME',
                                        max_amount: '100.00',
                                        effective_from: new Date().toISOString().split('T')[0],
                                        effective_until: '',
                                        is_active: true
                                    });
                                    setIsLateFeeModalOpen(true);
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                <span>New Late Fee Policy</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl overflow-x-auto">
                    {[
                        { id: 'discounts', label: 'Standard Discounts', icon: Tag, count: discounts.length },
                        { id: 'sibling', label: 'Sibling Policies', icon: Users, count: siblingRules.length },
                        { id: 'credits', label: 'Family Credit Ledger', icon: CreditCard, count: credits.length },
                        { id: 'late_fees', label: 'Late Fee Rules', icon: Clock, count: lateFees.length },
                        { id: 'calculator', label: 'Billing Breakdown Simulator', icon: Calculator },
                    ].map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
                                    isActive
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                                }`}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                                <span>{tab.label}</span>
                                {tab.count !== undefined && (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                        isActive ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ─── TAB 1: STANDARD DISCOUNTS ───────────────────────────────── */}
                {activeTab === 'discounts' && (
                    <div className="space-y-4">
                        {/* Search & Filter Bar */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                            <div className="relative w-full sm:w-80">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search discount rules..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Filter className="w-4 h-4 text-slate-400" />
                                <select
                                    value={filterScope}
                                    onChange={e => setFilterScope(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                                >
                                    <option value="ALL">All Scopes</option>
                                    <option value="STUDENT">Child Specific</option>
                                    <option value="FAMILY">Family Specific</option>
                                    <option value="PROGRAM">Program Specific</option>
                                    <option value="CLASSROOM">Classroom Specific</option>
                                    <option value="BRANCH">Branch Specific</option>
                                    <option value="FEE_TYPE">Fee Type Specific</option>
                                </select>
                            </div>
                        </div>

                        {/* Discounts Table */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                                        <tr>
                                            <th className="py-4 px-6">Discount Rule</th>
                                            <th className="py-4 px-4">Type & Value</th>
                                            <th className="py-4 px-4">Applicability Scope</th>
                                            <th className="py-4 px-4">Effective Dates</th>
                                            <th className="py-4 px-4">Version</th>
                                            <th className="py-4 px-4">Status</th>
                                            <th className="py-4 px-6 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {discounts.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="text-center py-12 text-slate-400">
                                                    No discount rules configured yet. Click "+ New Discount Rule" to create one.
                                                </td>
                                            </tr>
                                        ) : (
                                            discounts
                                                .filter(d => filterScope === 'ALL' || d.applies_to === filterScope)
                                                .filter(d => !searchTerm || d.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                                .map(d => (
                                                    <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                                                        <td className="py-4 px-6 font-bold text-slate-900">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-black">
                                                                    {d.discount_type === 'PERCENTAGE' ? '%' : '$'}
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-black">{d.name}</div>
                                                                    {d.description && <div className="text-[11px] text-slate-400">{d.description}</div>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-4">
                                                            <span className="font-extrabold text-teal-700 text-sm">
                                                                {d.discount_type === 'PERCENTAGE' ? `${d.value}%` : `${d.value} ${d.currency}`}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-4">
                                                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-[11px] font-extrabold">
                                                                {d.applies_to}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-4 font-mono text-[11px] text-slate-500">
                                                            {d.effective_from} {d.effective_until ? `→ ${d.effective_until}` : '(ongoing)'}
                                                        </td>
                                                        <td className="py-4 px-4">
                                                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono text-[11px] font-bold border border-indigo-200">
                                                                v{d.version}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-4">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                                d.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                                                            }`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${d.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                                                {d.is_active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-6 text-right space-x-2">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingDiscount(d);
                                                                    setDiscountForm({
                                                                        name: d.name,
                                                                        description: d.description || '',
                                                                        discount_type: d.discount_type,
                                                                        value: d.value,
                                                                        currency: d.currency || 'CAD',
                                                                        applies_to: d.applies_to,
                                                                        program: d.program || '',
                                                                        classroom: d.classroom || '',
                                                                        branch: d.branch || '',
                                                                        family: d.family || '',
                                                                        student: d.student || '',
                                                                        target_fee_type: d.target_fee_type || '',
                                                                        priority: d.priority || 10,
                                                                        effective_from: d.effective_from,
                                                                        effective_until: d.effective_until || '',
                                                                        is_active: d.is_active
                                                                    });
                                                                    setIsDiscountModalOpen(true);
                                                                }}
                                                                className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    if (d.is_active) {
                                                                        await billingService.deactivateDiscount(d.id);
                                                                        showToast('Discount deactivated.');
                                                                    } else {
                                                                        await billingService.activateDiscount(d.id);
                                                                        showToast('Discount activated.');
                                                                    }
                                                                    loadAllData();
                                                                }}
                                                                className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold"
                                                            >
                                                                {d.is_active ? 'Deactivate' : 'Activate'}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setVersioningDiscount(d);
                                                                    setVersionForm({
                                                                        value: d.value,
                                                                        effective_from: new Date().toISOString().split('T')[0],
                                                                        notes: ''
                                                                    });
                                                                }}
                                                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold"
                                                            >
                                                                New Version
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    const history = await billingService.getDiscountHistory(d.id);
                                                                    setDiscountHistoryList(history);
                                                                    setHistoryModalOpen(true);
                                                                }}
                                                                className="px-2.5 py-1 text-slate-400 hover:text-slate-700"
                                                                title="View Version History"
                                                            >
                                                                <History className="w-4 h-4 inline" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── TAB 2: SIBLING POLICIES ─────────────────────────────────── */}
                {activeTab === 'sibling' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left 2 Cols: Active Sibling Policies */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-black text-slate-900">Configured Sibling Discount Policies</h3>
                                    <span className="text-xs text-slate-500 font-medium">Deterministic verified relationship rules</span>
                                </div>

                                {siblingRules.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400">
                                        No sibling discount policy configured. Click "+ Configure Sibling Rule" to create one.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {siblingRules.map(sr => (
                                            <div key={sr.id} className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/60 to-purple-50/40 border border-indigo-100 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white text-xs font-black">
                                                            {sr.discount_type === 'PERCENTAGE' ? `${sr.value}% Discount` : `${sr.value} ${sr.currency}`}
                                                        </span>
                                                        <h4 className="font-extrabold text-slate-900">{sr.name}</h4>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono font-bold text-indigo-700">v{sr.version}</span>
                                                        <button
                                                            onClick={() => {
                                                                setEditingSiblingRule(sr);
                                                                setSiblingForm({
                                                                    name: sr.name,
                                                                    description: sr.description || '',
                                                                    discount_type: sr.discount_type,
                                                                    value: sr.value,
                                                                    currency: sr.currency || 'CAD',
                                                                    applies_to_target: sr.applies_to_target,
                                                                    target_fee_selection: sr.target_fee_selection,
                                                                    ordering_criteria: sr.ordering_criteria,
                                                                    min_enrolled_siblings: sr.min_enrolled_siblings || 2,
                                                                    effective_from: sr.effective_from,
                                                                    effective_until: sr.effective_until || '',
                                                                    is_active: sr.is_active
                                                                });
                                                                setIsSiblingModalOpen(true);
                                                            }}
                                                            className="p-1.5 bg-white text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200"
                                                        >
                                                            <Edit className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                                    <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Applies To</span>
                                                        <span className="font-extrabold text-slate-800">{sr.applies_to_target?.replace('_', ' ')}</span>
                                                    </div>
                                                    <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Fee Selection</span>
                                                        <span className="font-extrabold text-slate-800">{sr.target_fee_selection?.replace('_', ' ')}</span>
                                                    </div>
                                                    <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Ordering Criteria</span>
                                                        <span className="font-extrabold text-slate-800">{sr.ordering_criteria?.replace('_', ' ')}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-indigo-100">
                                                    <span>Effective: {sr.effective_from} {sr.effective_until ? `→ ${sr.effective_until}` : '(ongoing)'}</span>
                                                    <span>Min Siblings: {sr.min_enrolled_siblings}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Col: Live Family Sibling Simulator */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                            <div className="space-y-1">
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-purple-600" />
                                    <span>Live Sibling Preview</span>
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Select any family to inspect real-time sibling ordering and calculated discounts.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Select Family</label>
                                    <select
                                        value={previewFamilyId}
                                        onChange={e => setPreviewFamilyId(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                                    >
                                        <option value="">-- Choose Family --</option>
                                        {families.map(f => (
                                            <option key={f.id} value={f.id}>{f.family_name || f.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    onClick={handleRunSiblingPreview}
                                    disabled={!previewFamilyId || previewLoading}
                                    className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-black shadow-sm disabled:opacity-50"
                                >
                                    {previewLoading ? 'Evaluating...' : 'Preview Sibling Discount'}
                                </button>
                            </div>

                            {siblingPreviewResult && (
                                <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-3 text-xs">
                                    <div className="flex items-center justify-between font-black">
                                        <span>Total Sibling Discount:</span>
                                        <span className="text-purple-700 text-sm font-black">
                                            {siblingPreviewResult.total_sibling_discount} {siblingPreviewResult.currency}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Child Breakdown:</span>
                                        {siblingPreviewResult.student_breakdowns?.map((sb: any) => (
                                            <div key={sb.student_id} className="p-2 bg-white rounded-lg border border-purple-100 flex justify-between items-center text-[11px]">
                                                <div>
                                                    <span className="font-bold">#{sb.sibling_order_index} {sb.student_name}</span>
                                                    <span className="text-slate-400 ml-1">({sb.dob})</span>
                                                </div>
                                                <div className="font-mono font-bold">
                                                    {sb.is_eligible_for_sibling_discount ? (
                                                        <span className="text-emerald-700">-{sb.sibling_discount_amount}</span>
                                                    ) : (
                                                        <span className="text-slate-400">Standard</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── TAB 3: FAMILY CREDIT LEDGER ─────────────────────────────── */}
                {activeTab === 'credits' && (
                    <div className="space-y-6">
                        {/* Balance Lookup & Grant Quick Actions */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                            <div className="md:col-span-2 flex flex-col sm:flex-row items-center gap-3">
                                <select
                                    value={lookupFamilyId}
                                    onChange={async e => {
                                        setLookupFamilyId(e.target.value);
                                        if (e.target.value) {
                                            const bal = await billingService.getFamilyCreditBalance(e.target.value);
                                            setFamilyBalanceInfo(bal);
                                        } else {
                                            setFamilyBalanceInfo(null);
                                        }
                                    }}
                                    className="w-full sm:w-80 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                                >
                                    <option value="">-- Check Family Credit Balance --</option>
                                    {families.map(f => (
                                        <option key={f.id} value={f.id}>{f.family_name || f.name}</option>
                                    ))}
                                </select>

                                {familyBalanceInfo && (
                                    <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black">
                                        <span>Available Balance:</span>
                                        <span className="text-sm">{familyBalanceInfo.available_credit_balance} {familyBalanceInfo.currency}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={() => setIsGrantCreditModalOpen(true)}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm"
                                >
                                    + Issue Credit
                                </button>
                            </div>
                        </div>

                        {/* Credits Table */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                                        <tr>
                                            <th className="py-4 px-6">Transaction Date</th>
                                            <th className="py-4 px-4">Family / Child</th>
                                            <th className="py-4 px-4">Type</th>
                                            <th className="py-4 px-4">Amount</th>
                                            <th className="py-4 px-4">Reason & Ref</th>
                                            <th className="py-4 px-4">Status</th>
                                            <th className="py-4 px-6 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {credits.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="text-center py-12 text-slate-400">
                                                    No credit transactions recorded yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            credits.map(tx => (
                                                <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="py-4 px-6 font-mono text-[11px] text-slate-500">
                                                        {tx.created_at ? new Date(tx.created_at).toLocaleString() : 'N/A'}
                                                    </td>
                                                    <td className="py-4 px-4 font-bold text-slate-900">
                                                        <div>{tx.family_name || 'Family'}</div>
                                                        {tx.student_name && <div className="text-[10px] text-slate-400">Child: {tx.student_name}</div>}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                                                            tx.transaction_type === 'CREDIT' ? 'bg-emerald-100 text-emerald-800' :
                                                            tx.transaction_type === 'CREDIT_APPLIED' ? 'bg-blue-100 text-blue-800' :
                                                            tx.transaction_type === 'CREDIT_REVERSAL' ? 'bg-rose-100 text-rose-800' :
                                                            'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {tx.transaction_type}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-4 font-mono font-black text-sm text-slate-900">
                                                        {tx.amount} {tx.currency}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="font-semibold text-slate-800">{tx.reason}</div>
                                                        {tx.reference && <div className="text-[10px] text-slate-400 font-mono">Ref: {tx.reference}</div>}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            tx.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                            {tx.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        {tx.status === 'ACTIVE' && tx.transaction_type !== 'CREDIT_REVERSAL' && (
                                                            <button
                                                                onClick={() => {
                                                                    setReversalTarget(tx);
                                                                    setReversalReason('');
                                                                }}
                                                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold"
                                                            >
                                                                Reverse
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── TAB 4: LATE FEES ───────────────────────────────────────── */}
                {activeTab === 'late_fees' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left 2 Cols: Late Fee Rules */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                                <h3 className="text-base font-black text-slate-900">Configured Overdue Late Fee Policies</h3>

                                {lateFees.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400">
                                        No late fee rule configured. Click "+ New Late Fee Rule" to create one.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {lateFees.map(lf => (
                                            <div key={lf.id} className="p-5 rounded-2xl bg-gradient-to-br from-rose-50/60 to-amber-50/40 border border-rose-100 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2.5 py-1 rounded-xl bg-rose-600 text-white text-xs font-black">
                                                            {lf.fee_type === 'PERCENTAGE' ? `${lf.amount}%` : `${lf.amount} ${lf.currency}`}
                                                        </span>
                                                        <h4 className="font-extrabold text-slate-900">{lf.name}</h4>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono font-bold text-rose-700">v{lf.version}</span>
                                                        <button
                                                            onClick={() => {
                                                                setEditingLateFee(lf);
                                                                setLateFeeForm({
                                                                    name: lf.name,
                                                                    description: lf.description || '',
                                                                    fee_type: lf.fee_type,
                                                                    amount: lf.amount,
                                                                    currency: lf.currency || 'CAD',
                                                                    grace_period_days: lf.grace_period_days || 5,
                                                                    frequency: lf.frequency || 'ONE_TIME',
                                                                    max_amount: lf.max_amount || '',
                                                                    effective_from: lf.effective_from,
                                                                    effective_until: lf.effective_until || '',
                                                                    is_active: lf.is_active
                                                                });
                                                                setIsLateFeeModalOpen(true);
                                                            }}
                                                            className="p-1.5 bg-white text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200"
                                                        >
                                                            <Edit className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-3 text-xs">
                                                    <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100">
                                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Grace Period</span>
                                                        <span className="font-extrabold text-slate-800">{lf.grace_period_days} Days</span>
                                                    </div>
                                                    <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100">
                                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Frequency</span>
                                                        <span className="font-extrabold text-slate-800">{lf.frequency}</span>
                                                    </div>
                                                    <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100">
                                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Max Cap</span>
                                                        <span className="font-extrabold text-slate-800">{lf.max_amount ? `${lf.max_amount} ${lf.currency}` : 'No Cap'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Col: Late Fee Simulator */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-rose-600" />
                                    <span>Late Fee Evaluation Simulator</span>
                                </h3>
                                <p className="text-xs text-slate-500">Test grace period rules and frequency multipliers.</p>
                            </div>

                            <div className="space-y-3 text-xs">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Invoice Due Date</label>
                                    <input
                                        type="date"
                                        value={simDueDate}
                                        onChange={e => setSimDueDate(e.target.value)}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Overdue Balance</label>
                                    <input
                                        type="number"
                                        value={simOverdueBalance}
                                        onChange={e => setSimOverdueBalance(e.target.value)}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Evaluation Date</label>
                                    <input
                                        type="date"
                                        value={simEvalDate}
                                        onChange={e => setSimEvalDate(e.target.value)}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                                    />
                                </div>

                                <button
                                    onClick={handleRunLateFeeSim}
                                    className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 text-white rounded-xl text-xs font-black shadow-sm"
                                >
                                    Evaluate Overdue Fee
                                </button>
                            </div>

                            {simLateFeeResult && (
                                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2 text-xs">
                                    <div className="flex justify-between font-black text-sm">
                                        <span>Late Fee Assessed:</span>
                                        <span className="text-rose-700 font-mono">{simLateFeeResult.late_fee_amount} {simLateFeeResult.currency}</span>
                                    </div>
                                    <div className="text-slate-600">{simLateFeeResult.message}</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── TAB 5: MASTER DETERMINISTIC BILLING SIMULATOR ───────────── */}
                {activeTab === 'calculator' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Col: Setup form */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <Calculator className="w-4 h-4 text-teal-600" />
                                <span>Master Billing Engine Simulator</span>
                            </h3>

                            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                                <button
                                    onClick={() => setCalcMode('family')}
                                    className={`flex-1 py-1.5 rounded-lg ${calcMode === 'family' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}
                                >
                                    Family Breakdown
                                </button>
                                <button
                                    onClick={() => setCalcMode('child')}
                                    className={`flex-1 py-1.5 rounded-lg ${calcMode === 'child' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}
                                >
                                    Single Child
                                </button>
                            </div>

                            <div className="space-y-3 text-xs">
                                {calcMode === 'family' ? (
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Select Family</label>
                                        <select
                                            value={calcFamilyId}
                                            onChange={e => setCalcFamilyId(e.target.value)}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                        >
                                            <option value="">-- Choose Family --</option>
                                            {families.map(f => (
                                                <option key={f.id} value={f.id}>{f.family_name || f.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Select Student</label>
                                        <select
                                            value={calcStudentId}
                                            onChange={e => setCalcStudentId(e.target.value)}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                        >
                                            <option value="">-- Choose Student --</option>
                                            {students.map(s => (
                                                <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Target Billing Date</label>
                                    <input
                                        type="date"
                                        value={calcTargetDate}
                                        onChange={e => setCalcTargetDate(e.target.value)}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                                    />
                                </div>

                                {calcMode === 'family' && (
                                    <label className="flex items-center gap-2 pt-2">
                                        <input
                                            type="checkbox"
                                            checked={calcApplyCredits}
                                            onChange={e => setCalcApplyCredits(e.target.checked)}
                                            className="rounded text-teal-600"
                                        />
                                        <span className="font-bold text-slate-700">Apply available credit balance</span>
                                    </label>
                                )}

                                <button
                                    onClick={handleRunMasterCalculation}
                                    disabled={calcLoading || (calcMode === 'family' ? !calcFamilyId : !calcStudentId)}
                                    className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl text-xs font-black shadow-sm disabled:opacity-50"
                                >
                                    {calcLoading ? 'Calculating...' : 'Run Deterministic Calculation'}
                                </button>
                            </div>
                        </div>

                        {/* Right 2 Cols: Master Calculation Output */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                            <h3 className="text-base font-black text-slate-900">Calculation Breakdown Pipeline</h3>

                            {!masterCalcResult ? (
                                <div className="text-center py-16 text-slate-400 text-xs">
                                    Select a family or student and click "Run Deterministic Calculation" to inspect itemized breakdown.
                                </div>
                            ) : (
                                <div className="space-y-4 text-xs">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Base Fees</span>
                                            <span className="font-black text-slate-900 text-base">{masterCalcResult.total_base_fees || masterCalcResult.base_fee} {masterCalcResult.currency}</span>
                                        </div>
                                        <div className="p-3 bg-teal-50 rounded-2xl border border-teal-200">
                                            <span className="text-[10px] uppercase font-bold text-teal-600 block">Total Discounts</span>
                                            <span className="font-black text-teal-700 text-base">-{masterCalcResult.total_discounts || masterCalcResult.total_discount} {masterCalcResult.currency}</span>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
                                            <span className="text-[10px] uppercase font-bold text-blue-600 block">Credits Applied</span>
                                            <span className="font-black text-blue-700 text-base">-{masterCalcResult.credit_applied || '0.00'} {masterCalcResult.currency}</span>
                                        </div>
                                        <div className="p-3 bg-slate-900 text-white rounded-2xl border border-slate-800">
                                            <span className="text-[10px] uppercase font-bold text-teal-400 block">Final Balance Due</span>
                                            <span className="font-black text-white text-base">{masterCalcResult.final_amount_due} {masterCalcResult.currency}</span>
                                        </div>
                                    </div>

                                    {masterCalcResult.children_breakdowns && (
                                        <div className="space-y-2 pt-2">
                                            <h4 className="font-black text-slate-800 text-sm">Per-Child Itemization:</h4>
                                            {masterCalcResult.children_breakdowns.map((cb: any) => (
                                                <div key={cb.student_id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                                                    <div>
                                                        <span className="font-bold text-slate-900">{cb.student_name}</span>
                                                        <span className="text-slate-400 ml-2">(Base: {cb.base_fee} {masterCalcResult.currency})</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-mono font-bold text-slate-900">{cb.subtotal_after_discount} {masterCalcResult.currency}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* MODALS & DIALOGS */}
            {/* ═══════════════════════════════════════════════════════════════════ */}

            {/* 1. DISCOUNT RULE MODAL */}
            <AnimatePresence>
                {isDiscountModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 sm:p-7 my-8 space-y-5 text-xs text-slate-800"
                        >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">
                                        {editingDiscount ? 'Edit Discount Rule' : 'Create New Discount Rule'}
                                    </h3>
                                    <p className="text-[11px] text-slate-400">Configure standard percentage or fixed discount policies.</p>
                                </div>
                                <button
                                    onClick={() => setIsDiscountModalOpen(false)}
                                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveDiscount} className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="block font-bold mb-1">Discount Name *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Summer Special 15% or Educator Family Discount"
                                            value={discountForm.name}
                                            onChange={e => setDiscountForm({ ...discountForm, name: e.target.value })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block font-bold mb-1">Description / Notes</label>
                                        <textarea
                                            rows={2}
                                            placeholder="Optional details regarding qualification criteria..."
                                            value={discountForm.description}
                                            onChange={e => setDiscountForm({ ...discountForm, description: e.target.value })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block font-bold mb-1">Discount Type *</label>
                                            <select
                                                value={discountForm.discount_type}
                                                onChange={e => setDiscountForm({ ...discountForm, discount_type: e.target.value as any })}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                            >
                                                <option value="PERCENTAGE">Percentage (%)</option>
                                                <option value="FIXED">Fixed Amount ($)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block font-bold mb-1">Value * ({discountForm.discount_type === 'PERCENTAGE' ? '%' : 'Amount'})</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                value={discountForm.value}
                                                onChange={e => setDiscountForm({ ...discountForm, value: e.target.value })}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block font-bold mb-1">Applicability Scope *</label>
                                            <select
                                                value={discountForm.applies_to}
                                                onChange={e => setDiscountForm({ ...discountForm, applies_to: e.target.value as any })}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                            >
                                                <option value="ALL">Daycare Wide (All Children)</option>
                                                <option value="STUDENT">Specific Child</option>
                                                <option value="FAMILY">Specific Family</option>
                                                <option value="PROGRAM">Specific Program</option>
                                                <option value="CLASSROOM">Specific Classroom</option>
                                                <option value="BRANCH">Specific Branch</option>
                                                <option value="FEE_TYPE">Specific Fee Type</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block font-bold mb-1">Priority (1 = Highest)</label>
                                            <input
                                                type="number"
                                                value={discountForm.priority}
                                                onChange={e => setDiscountForm({ ...discountForm, priority: parseInt(e.target.value) || 10 })}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                            />
                                        </div>
                                    </div>

                                    {/* Scope Target Selectors */}
                                    {discountForm.applies_to === 'STUDENT' && (
                                        <div>
                                            <label className="block font-bold mb-1">Select Target Child *</label>
                                            <select
                                                value={discountForm.student}
                                                onChange={e => setDiscountForm({ ...discountForm, student: e.target.value })}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                            >
                                                <option value="">-- Choose Child --</option>
                                                {students.map(s => (
                                                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {discountForm.applies_to === 'FAMILY' && (
                                        <div>
                                            <label className="block font-bold mb-1">Select Target Family *</label>
                                            <select
                                                value={discountForm.family}
                                                onChange={e => setDiscountForm({ ...discountForm, family: e.target.value })}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                            >
                                                <option value="">-- Choose Family --</option>
                                                {families.map(f => (
                                                    <option key={f.id} value={f.id}>{f.family_name || f.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {discountForm.applies_to === 'PROGRAM' && (
                                        <div>
                                            <label className="block font-bold mb-1">Select Target Program *</label>
                                            <select
                                                value={discountForm.program}
                                                onChange={e => setDiscountForm({ ...discountForm, program: e.target.value })}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                            >
                                                <option value="">-- Choose Program --</option>
                                                {programs.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {discountForm.applies_to === 'CLASSROOM' && (
                                        <div>
                                            <label className="block font-bold mb-1">Select Target Classroom *</label>
                                            <select
                                                value={discountForm.classroom}
                                                onChange={e => setDiscountForm({ ...discountForm, classroom: e.target.value })}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                            >
                                                <option value="">-- Choose Classroom --</option>
                                                {classrooms.map(c => (
                                                    <option key={c.id} value={c.id}>{c.room_name || c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {discountForm.applies_to === 'BRANCH' && (
                                        <div>
                                            <label className="block font-bold mb-1">Select Target Branch *</label>
                                            <select
                                                value={discountForm.branch}
                                                onChange={e => setDiscountForm({ ...discountForm, branch: e.target.value })}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                            >
                                                <option value="">-- Choose Branch --</option>
                                                {branches.map(b => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {discountForm.applies_to === 'FEE_TYPE' && (
                                        <div>
                                            <label className="block font-bold mb-1">Select Target Fee Type *</label>
                                            <select
                                                value={discountForm.target_fee_type}
                                                onChange={e => setDiscountForm({ ...discountForm, target_fee_type: e.target.value })}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                            >
                                                <option value="">-- Choose Fee Type --</option>
                                                <option value="MONTHLY">Monthly Tuition</option>
                                                <option value="WEEKLY">Weekly Fee</option>
                                                <option value="REGISTRATION">Registration Fee</option>
                                                <option value="DAILY">Daily Drop-in</option>
                                                <option value="HOURLY">Hourly</option>
                                                <option value="DEPOSIT">Deposit</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block font-bold mb-1">Effective From *</label>
                                            <input
                                                type="date"
                                                required
                                                value={discountForm.effective_from}
                                                onChange={e => setDiscountForm({ ...discountForm, effective_from: e.target.value })}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-bold mb-1">Effective Until (Optional)</label>
                                            <input
                                                type="date"
                                                value={discountForm.effective_until}
                                                onChange={e => setDiscountForm({ ...discountForm, effective_until: e.target.value })}
                                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                                            />
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-2 pt-1">
                                        <input
                                            type="checkbox"
                                            checked={discountForm.is_active}
                                            onChange={e => setDiscountForm({ ...discountForm, is_active: e.target.checked })}
                                            className="rounded text-teal-600 focus:ring-teal-500"
                                        />
                                        <span className="font-bold">Active and ready for immediate calculation</span>
                                    </label>
                                </div>

                                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsDiscountModalOpen(false)}
                                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black rounded-xl shadow-sm"
                                    >
                                        {editingDiscount ? 'Save Changes' : 'Create Discount'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 2. VERSIONING DISCOUNT MODAL */}
            <AnimatePresence>
                {versioningDiscount && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs"
                        >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">New Version: {versioningDiscount.name}</h3>
                                    <p className="text-[11px] text-slate-400">Creates version {versioningDiscount.version + 1} with historical audit protection.</p>
                                </div>
                                <button onClick={() => setVersioningDiscount(null)} className="text-slate-400 hover:text-slate-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateDiscountVersion} className="space-y-3">
                                <div>
                                    <label className="block font-bold mb-1">New Value ({versioningDiscount.discount_type === 'PERCENTAGE' ? '%' : '$'}) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={versionForm.value}
                                        onChange={e => setVersionForm({ ...versionForm, value: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold mb-1">Effective Start Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={versionForm.effective_from}
                                        onChange={e => setVersionForm({ ...versionForm, effective_from: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold mb-1">Version Notes / Rationale</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Reason for rate change..."
                                        value={versionForm.notes}
                                        onChange={e => setVersionForm({ ...versionForm, notes: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setVersioningDiscount(null)}
                                        className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-indigo-600 text-white font-black rounded-xl"
                                    >
                                        Create Version
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 3. DISCOUNT VERSION HISTORY MODAL */}
            <AnimatePresence>
                {historyModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl p-6 space-y-4 text-xs max-h-[85vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">Historical Version Audit Trail</h3>
                                    <p className="text-[11px] text-slate-400">Complete immutable record of all version changes.</p>
                                </div>
                                <button onClick={() => setHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {discountHistoryList.map(h => (
                                    <div key={h.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-black text-indigo-700">v{h.version}</span>
                                                <span className="font-bold text-slate-900">{h.name}</span>
                                                <span className="text-slate-400">({h.discount_type === 'PERCENTAGE' ? `${h.value}%` : `${h.value} ${h.currency}`})</span>
                                            </div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">
                                                Effective: {h.effective_from} {h.effective_until ? `→ ${h.effective_until}` : '(active)'}
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                            h.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'
                                        }`}>
                                            {h.is_active ? 'Active' : 'Archived'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 4. SIBLING DISCOUNT RULE MODAL */}
            <AnimatePresence>
                {isSiblingModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 sm:p-7 space-y-4 text-xs"
                        >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">
                                        {editingSiblingRule ? 'Edit Sibling Discount Policy' : 'Configure Sibling Discount Policy'}
                                    </h3>
                                    <p className="text-[11px] text-slate-400">Deterministic verified relationship rules.</p>
                                </div>
                                <button onClick={() => setIsSiblingModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveSiblingRule} className="space-y-3">
                                <div>
                                    <label className="block font-bold mb-1">Policy Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={siblingForm.name}
                                        onChange={e => setSiblingForm({ ...siblingForm, name: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold mb-1">Discount Type *</label>
                                        <select
                                            value={siblingForm.discount_type}
                                            onChange={e => setSiblingForm({ ...siblingForm, discount_type: e.target.value as any })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                        >
                                            <option value="PERCENTAGE">Percentage (%)</option>
                                            <option value="FIXED">Fixed Amount ($)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block font-bold mb-1">Discount Value *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            value={siblingForm.value}
                                            onChange={e => setSiblingForm({ ...siblingForm, value: e.target.value })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold mb-1">Applies To Target *</label>
                                        <select
                                            value={siblingForm.applies_to_target}
                                            onChange={e => setSiblingForm({ ...siblingForm, applies_to_target: e.target.value as any })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                        >
                                            <option value="SECOND_CHILD">Second Child Only</option>
                                            <option value="SUBSEQUENT_CHILDREN">2nd & Subsequent Children</option>
                                            <option value="ALL_SIBLINGS">All Siblings in Family</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block font-bold mb-1">Target Fee Selection *</label>
                                        <select
                                            value={siblingForm.target_fee_selection}
                                            onChange={e => setSiblingForm({ ...siblingForm, target_fee_selection: e.target.value as any })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                        >
                                            <option value="LOWEST_FEE">Lowest Fee Child</option>
                                            <option value="HIGHEST_FEE">Highest Fee Child</option>
                                            <option value="EQUAL_APPLY">Equal Apply to Eligible</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold mb-1">Ordering Criteria *</label>
                                        <select
                                            value={siblingForm.ordering_criteria}
                                            onChange={e => setSiblingForm({ ...siblingForm, ordering_criteria: e.target.value as any })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                        >
                                            <option value="AGE_DESCENDING">Age (Eldest is 1st)</option>
                                            <option value="FEE_DESCENDING">Fee (Highest fee is 1st)</option>
                                            <option value="ENROLLMENT_DATE">Enrollment Date</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block font-bold mb-1">Min Enrolled Siblings</label>
                                        <input
                                            type="number"
                                            value={siblingForm.min_enrolled_siblings}
                                            onChange={e => setSiblingForm({ ...siblingForm, min_enrolled_siblings: parseInt(e.target.value) || 2 })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-bold mb-1">Effective Start Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={siblingForm.effective_from}
                                        onChange={e => setSiblingForm({ ...siblingForm, effective_from: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsSiblingModalOpen(false)}
                                        className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-indigo-600 text-white font-black rounded-xl"
                                    >
                                        Save Sibling Policy
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 5. GRANT CREDIT MODAL */}
            <AnimatePresence>
                {isGrantCreditModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 sm:p-7 space-y-4 text-xs"
                        >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">Grant Customer / Family Credit</h3>
                                    <p className="text-[11px] text-slate-400">Records an entry in the double-entry credit ledger.</p>
                                </div>
                                <button onClick={() => setIsGrantCreditModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleGrantCredit} className="space-y-3">
                                <div>
                                    <label className="block font-bold mb-1">Select Family *</label>
                                    <select
                                        required
                                        value={creditForm.family}
                                        onChange={e => setCreditForm({ ...creditForm, family: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                    >
                                        <option value="">-- Choose Family --</option>
                                        {families.map(f => (
                                            <option key={f.id} value={f.id}>{f.family_name || f.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold mb-1">Credit Amount ($) *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            placeholder="150.00"
                                            value={creditForm.amount}
                                            onChange={e => setCreditForm({ ...creditForm, amount: e.target.value })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold mb-1">Transaction Type</label>
                                        <select
                                            value={creditForm.transaction_type}
                                            onChange={e => setCreditForm({ ...creditForm, transaction_type: e.target.value })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                        >
                                            <option value="CREDIT">Standard Credit Grant</option>
                                            <option value="CREDIT_ADJUSTMENT">Administrative Adjustment</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-bold mb-1">Reason / Justification *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Overpayment deposit / Service disruption compensation"
                                        value={creditForm.reason}
                                        onChange={e => setCreditForm({ ...creditForm, reason: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold mb-1">Reference / Invoice ID (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. INV-2026-0042 or CHQ-9912"
                                        value={creditForm.reference}
                                        onChange={e => setCreditForm({ ...creditForm, reference: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsGrantCreditModalOpen(false)}
                                        className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-emerald-600 text-white font-black rounded-xl"
                                    >
                                        Issue Credit
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 6. REVERSE CREDIT MODAL */}
            <AnimatePresence>
                {reversalTarget && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs"
                        >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-base font-black text-rose-900">Reverse Credit Transaction</h3>
                                    <p className="text-[11px] text-slate-400">Reverses {reversalTarget.amount} {reversalTarget.currency} for {reversalTarget.family_name}.</p>
                                </div>
                                <button onClick={() => setReversalTarget(null)} className="text-slate-400 hover:text-slate-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleReverseCredit} className="space-y-3">
                                <div>
                                    <label className="block font-bold mb-1">Reversal Reason *</label>
                                    <textarea
                                        rows={3}
                                        required
                                        placeholder="Specify justification for reversing this credit entry..."
                                        value={reversalReason}
                                        onChange={e => setReversalReason(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setReversalTarget(null)}
                                        className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-rose-600 text-white font-black rounded-xl"
                                    >
                                        Confirm Reversal
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 7. LATE FEE MODAL */}
            <AnimatePresence>
                {isLateFeeModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 sm:p-7 space-y-4 text-xs"
                        >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">
                                        {editingLateFee ? 'Edit Late Fee Rule' : 'Configure Overdue Late Fee Rule'}
                                    </h3>
                                    <p className="text-[11px] text-slate-400">Automated assessment policy with grace periods and caps.</p>
                                </div>
                                <button onClick={() => setIsLateFeeModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveLateFee} className="space-y-3">
                                <div>
                                    <label className="block font-bold mb-1">Rule Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={lateFeeForm.name}
                                        onChange={e => setLateFeeForm({ ...lateFeeForm, name: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold mb-1">Fee Type *</label>
                                        <select
                                            value={lateFeeForm.fee_type}
                                            onChange={e => setLateFeeForm({ ...lateFeeForm, fee_type: e.target.value as any })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                        >
                                            <option value="FIXED">Fixed Amount ($)</option>
                                            <option value="PERCENTAGE">Percentage of Balance (%)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block font-bold mb-1">Amount / Rate *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            value={lateFeeForm.amount}
                                            onChange={e => setLateFeeForm({ ...lateFeeForm, amount: e.target.value })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold mb-1">Grace Period (Days) *</label>
                                        <input
                                            type="number"
                                            required
                                            value={lateFeeForm.grace_period_days}
                                            onChange={e => setLateFeeForm({ ...lateFeeForm, grace_period_days: parseInt(e.target.value) || 0 })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold mb-1">Frequency *</label>
                                        <select
                                            value={lateFeeForm.frequency}
                                            onChange={e => setLateFeeForm({ ...lateFeeForm, frequency: e.target.value as any })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                        >
                                            <option value="ONE_TIME">One-Time Fee</option>
                                            <option value="DAILY">Daily Recurring</option>
                                            <option value="WEEKLY">Weekly Recurring</option>
                                            <option value="MONTHLY">Monthly</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold mb-1">Max Cap Amount (Optional)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="e.g. 100.00"
                                            value={lateFeeForm.max_amount}
                                            onChange={e => setLateFeeForm({ ...lateFeeForm, max_amount: e.target.value })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold mb-1">Effective Start Date *</label>
                                        <input
                                            type="date"
                                            required
                                            value={lateFeeForm.effective_from}
                                            onChange={e => setLateFeeForm({ ...lateFeeForm, effective_from: e.target.value })}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsLateFeeModalOpen(false)}
                                        className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-rose-600 text-white font-black rounded-xl"
                                    >
                                        Save Late Fee Rule
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </Layout>
    );
};

export default DiscountsCreditsLateFeesPage;
