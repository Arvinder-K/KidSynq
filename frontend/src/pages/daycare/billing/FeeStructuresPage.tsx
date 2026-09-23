import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    DollarSign, Plus, Filter, Search, CheckCircle2, XCircle, History,
    Calendar, Layers, ShieldCheck, UserCheck, RefreshCw, ArrowRight,
    Sparkles, AlertCircle, Edit, Trash2, Tag, Percent, ArrowUpRight,
    CreditCard, ChevronRight, HelpCircle, FileText, Check, Clock, Eye
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';
import {
    billingService,
    type FeeStructure,
    type ChildFeeAssignment,
    type RegistrationFeeRecord,
    type DepositRecord,
    type BillingSummary
} from '../../../api/billingService';

export const FeeStructuresPage: React.FC = () => {
    // Active Tab
    const [activeTab, setActiveTab] = useState<'structures' | 'assignments' | 'registrations' | 'deposits' | 'calculator'>('structures');

    // Data State
    const [summary, setSummary] = useState<BillingSummary | null>(null);
    const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
    const [assignments, setAssignments] = useState<ChildFeeAssignment[]>([]);
    const [registrations, setRegistrations] = useState<RegistrationFeeRecord[]>([]);
    const [deposits, setDeposits] = useState<DepositRecord[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [programs, setPrograms] = useState<any[]>([]);
    const [classrooms, setClassrooms] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);

    // Loading & UI States
    const [loading, setLoading] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('ALL');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [editingFee, setEditingFee] = useState<FeeStructure | null>(null);
    const [versioningFee, setVersioningFee] = useState<FeeStructure | null>(null);
    const [historyModalFee, setHistoryModalFee] = useState<FeeStructure | null>(null);
    const [feeHistoryList, setFeeHistoryList] = useState<FeeStructure[]>([]);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
    const [isDepositModalOpen, setIsDepositModalOpen] = useState<boolean>(false);
    const [depositActionTarget, setDepositActionTarget] = useState<DepositRecord | null>(null);
    const [depositActionType, setDepositActionType] = useState<string>('RECEIVE_DEPOSIT');

    // Form States
    const [feeForm, setFeeForm] = useState({
        name: '',
        description: '',
        fee_type: 'MONTHLY',
        frequency: 'MONTHLY',
        amount: '',
        currency: 'CAD',
        effective_from: new Date().toISOString().split('T')[0],
        effective_until: '',
        applies_to: 'ALL',
        program: '',
        classroom: '',
        branch: '',
        is_active: true,
    });

    const [versionForm, setVersionForm] = useState({
        amount: '',
        effective_from: '',
        notes: '',
    });

    const [assignForm, setAssignForm] = useState({
        student: '',
        fee_structure: '',
        custom_amount: '',
        discount_percentage: '0.00',
        discount_reason: '',
        effective_from: new Date().toISOString().split('T')[0],
        effective_until: '',
        notes: '',
    });

    const [depositActionForm, setDepositActionForm] = useState({
        amount: '',
        notes: '',
    });

    // Calculator Interactive State
    const [calcMonthlyAmount, setCalcMonthlyAmount] = useState<string>('1200.00');
    const [calcStartDate, setCalcStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [prorationResult, setProrationResult] = useState<any>(null);

    const [calcSiblingBase, setCalcSiblingBase] = useState<string>('1200.00');
    const [calcSiblingCount, setCalcSiblingCount] = useState<number>(2);
    const [calcSiblingPct, setCalcSiblingPct] = useState<string>('10.00');
    const [siblingResult, setSiblingResult] = useState<any>(null);

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    // Fetch master data
    const loadAllData = useCallback(async () => {
        setLoading(true);
        try {
            const [sumRes, feesRes, assignRes, regRes, depRes, studRes, progRes, classRes, branchRes] = await Promise.all([
                billingService.getSummary().catch(() => null),
                billingService.getFeeStructures().catch(() => []),
                billingService.getChildAssignments().catch(() => []),
                billingService.getRegistrationFees().catch(() => []),
                billingService.getDeposits().catch(() => []),
                api.get('daycare/students/').then(r => r.data.results || r.data).catch(() => []),
                api.get('daycare/programs/').then(r => r.data.results || r.data).catch(() => []),
                api.get('daycare/classrooms/').then(r => r.data.results || r.data).catch(() => []),
                api.get('daycare/branches/').then(r => r.data.results || r.data).catch(() => []),
            ]);

            setSummary(sumRes);
            setFeeStructures(feesRes);
            setAssignments(assignRes);
            setRegistrations(regRes);
            setDeposits(depRes);
            setStudents(studRes);
            setPrograms(progRes);
            setClassrooms(classRes);
            setBranches(branchRes);
        } catch (err: any) {
            console.error('Error loading billing data:', err);
            showToast('Failed to load some billing records.', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    // Handle Create/Update Fee Structure
    const handleSaveFee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!feeForm.name || !feeForm.amount || !feeForm.effective_from) {
            showToast('Please fill all required fields.', 'error');
            return;
        }

        const payload: any = {
            name: feeForm.name,
            description: feeForm.description || null,
            fee_type: feeForm.fee_type,
            frequency: feeForm.frequency,
            amount: feeForm.amount,
            currency: feeForm.currency || summary?.currency || 'CAD',
            effective_from: feeForm.effective_from,
            effective_until: feeForm.effective_until || null,
            applies_to: feeForm.applies_to,
            is_active: feeForm.is_active,
            program: feeForm.applies_to === 'PROGRAM' && feeForm.program ? feeForm.program : null,
            classroom: feeForm.applies_to === 'CLASSROOM' && feeForm.classroom ? feeForm.classroom : null,
            branch: feeForm.applies_to === 'BRANCH' && feeForm.branch ? feeForm.branch : null,
        };

        try {
            if (editingFee) {
                await billingService.updateFeeStructure(editingFee.id, payload);
                showToast('Fee structure updated successfully.');
            } else {
                await billingService.createFeeStructure(payload);
                showToast('New fee structure created.');
            }
            setIsCreateModalOpen(false);
            setEditingFee(null);
            loadAllData();
        } catch (err: any) {
            const msg = err.response?.data?.error || err.response?.data?.effective_until?.[0] || 'Failed to save fee structure.';
            showToast(msg, 'error');
        }
    };

    // Toggle Active Status
    const handleToggleActive = async (fee: FeeStructure) => {
        try {
            if (fee.is_active) {
                await billingService.deactivateFeeStructure(fee.id);
                showToast(`"${fee.name}" deactivated.`);
            } else {
                await billingService.activateFeeStructure(fee.id);
                showToast(`"${fee.name}" activated.`);
            }
            loadAllData();
        } catch (err: any) {
            showToast('Failed to update status.', 'error');
        }
    };

    // Create New Price Version
    const handleSaveVersion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!versioningFee || !versionForm.amount || !versionForm.effective_from) {
            showToast('Please enter new amount and effective start date.', 'error');
            return;
        }

        try {
            await billingService.createFeeVersion(versioningFee.id, {
                amount: versionForm.amount,
                effective_from: versionForm.effective_from,
                notes: versionForm.notes,
            });
            showToast(`New version (v${versioningFee.version + 1}) created successfully.`);
            setVersioningFee(null);
            loadAllData();
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Failed to create new version.';
            showToast(msg, 'error');
        }
    };

    // Open History Modal
    const handleOpenHistory = async (fee: FeeStructure) => {
        setHistoryModalFee(fee);
        try {
            const history = await billingService.getFeeHistory(fee.id);
            setFeeHistoryList(history);
        } catch (err) {
            showToast('Failed to load version history.', 'error');
        }
    };

    // Save Child Fee Assignment
    const handleSaveAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignForm.student || !assignForm.fee_structure || !assignForm.effective_from) {
            showToast('Please select child, fee structure, and start date.', 'error');
            return;
        }

        try {
            await billingService.createChildAssignment({
                student: assignForm.student,
                fee_structure: assignForm.fee_structure,
                custom_amount: assignForm.custom_amount || null,
                discount_percentage: assignForm.discount_percentage || '0.00',
                discount_reason: assignForm.discount_reason || null,
                effective_from: assignForm.effective_from,
                effective_until: assignForm.effective_until || null,
                notes: assignForm.notes || null,
            });
            showToast('Fee assigned to student successfully.');
            setIsAssignModalOpen(false);
            loadAllData();
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Failed to assign fee.';
            showToast(msg, 'error');
        }
    };

    // Waive Registration Fee
    const handleWaiveRegFee = async (regId: string) => {
        const reason = window.prompt('Enter reason for waiving this registration fee:');
        if (reason === null) return;
        try {
            await billingService.waiveRegistrationFee(regId, reason || 'Administrative waiver');
            showToast('Registration fee waived.');
            loadAllData();
        } catch (err) {
            showToast('Failed to waive registration fee.', 'error');
        }
    };

    // Execute Deposit Action
    const handleProcessDepositAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!depositActionTarget || !depositActionForm.amount) {
            showToast('Please enter an amount.', 'error');
            return;
        }

        try {
            await billingService.processDepositAction(depositActionTarget.id, {
                action_type: depositActionType,
                amount: depositActionForm.amount,
                notes: depositActionForm.notes,
            });
            showToast('Deposit updated successfully.');
            setDepositActionTarget(null);
            loadAllData();
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Failed to process deposit action.';
            showToast(msg, 'error');
        }
    };

    // Run Proration Calculator
    const handleRunProration = async () => {
        try {
            const res = await billingService.calculateProration(calcMonthlyAmount, calcStartDate);
            setProrationResult(res);
        } catch (err: any) {
            showToast('Proration calculation failed.', 'error');
        }
    };

    // Run Sibling Calculator
    const handleRunSiblingCalc = async () => {
        try {
            const res = await billingService.calculateSiblingDiscount(calcSiblingBase, calcSiblingCount, calcSiblingPct);
            setSiblingResult(res);
        } catch (err: any) {
            showToast('Sibling discount calculation failed.', 'error');
        }
    };

    // Filtering Fee Structures
    const filteredFees = feeStructures.filter(f => {
        const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesType = filterType === 'ALL' || f.fee_type === filterType;
        const matchesStatus = filterStatus === 'ALL' ||
            (filterStatus === 'ACTIVE' && f.is_active) ||
            (filterStatus === 'INACTIVE' && !f.is_active);
        return matchesSearch && matchesType && matchesStatus;
    });

    const currencySymbol = summary?.currency || 'CAD';

    return (
        <Layout>
            <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 space-y-6">
                {/* Top Toast Notification */}
                <AnimatePresence>
                    {toastMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={`fixed top-5 right-5 z-50 px-5 py-3.5 rounded-xl shadow-xl border flex items-center gap-3 ${
                                toastMessage.type === 'success'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : 'bg-rose-50 border-rose-200 text-rose-800'
                            }`}
                        >
                            {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
                            <span className="text-sm font-medium">{toastMessage.text}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Fee Structure & Billing Configuration</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Configure daycare childcare fees, historical versioning, child custom assignments, and security deposits.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={loadAllData}
                            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        {activeTab === 'structures' && (
                            <button
                                onClick={() => {
                                    setEditingFee(null);
                                    setFeeForm({
                                        name: '',
                                        description: '',
                                        fee_type: 'MONTHLY',
                                        frequency: 'MONTHLY',
                                        amount: '',
                                        currency: summary?.currency || 'CAD',
                                        effective_from: new Date().toISOString().split('T')[0],
                                        effective_until: '',
                                        applies_to: 'ALL',
                                        program: '',
                                        classroom: '',
                                        branch: '',
                                        is_active: true,
                                    });
                                    setIsCreateModalOpen(true);
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                            >
                                <Plus className="w-4 h-4" />
                                Add Fee Structure
                            </button>
                        )}
                        {activeTab === 'assignments' && (
                            <button
                                onClick={() => {
                                    setAssignForm({
                                        student: '',
                                        fee_structure: feeStructures[0]?.id || '',
                                        custom_amount: '',
                                        discount_percentage: '0.00',
                                        discount_reason: '',
                                        effective_from: new Date().toISOString().split('T')[0],
                                        effective_until: '',
                                        notes: '',
                                    });
                                    setIsAssignModalOpen(true);
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                            >
                                <Plus className="w-4 h-4" />
                                Assign Fee to Child
                            </button>
                        )}
                    </div>
                </div>

                {/* KPI Metrics Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Fees</span>
                            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Layers className="w-4 h-4" /></span>
                        </div>
                        <div className="mt-2 text-2xl font-bold text-slate-900">{summary?.active_fee_structures ?? 0}</div>
                        <span className="text-xs text-slate-400">of {summary?.total_fee_structures ?? 0} configured</span>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Plans</span>
                            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Calendar className="w-4 h-4" /></span>
                        </div>
                        <div className="mt-2 text-2xl font-bold text-blue-600">{summary?.monthly_childcare_fees ?? 0}</div>
                        <span className="text-xs text-slate-400">Childcare rates</span>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Child Assignments</span>
                            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><UserCheck className="w-4 h-4" /></span>
                        </div>
                        <div className="mt-2 text-2xl font-bold text-emerald-600">{summary?.active_child_assignments ?? 0}</div>
                        <span className="text-xs text-slate-400">Custom enrolled rates</span>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deposits in Trust</span>
                            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg"><ShieldCheck className="w-4 h-4" /></span>
                        </div>
                        <div className="mt-2 text-2xl font-bold text-amber-600">
                            ${summary?.total_deposits_held ?? '0.00'}
                        </div>
                        <span className="text-xs text-slate-400">{summary?.deposit_fees ?? 0} active deposits</span>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs col-span-2 lg:col-span-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Billing Currency</span>
                            <span className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Tag className="w-4 h-4" /></span>
                        </div>
                        <div className="mt-2 text-2xl font-bold text-purple-700">{summary?.currency || 'CAD'}</div>
                        <span className="text-xs text-slate-400">From Daycare Settings</span>
                    </div>
                </div>

                {/* Main Navigation Tabs */}
                <div className="border-b border-slate-200">
                    <nav className="flex space-x-6 overflow-x-auto pb-px">
                        {[
                            { id: 'structures', label: 'Fee Structures', count: feeStructures.length, icon: Layers },
                            { id: 'assignments', label: 'Child Rate Assignments', count: assignments.length, icon: UserCheck },
                            { id: 'registrations', label: 'Registration Fees', count: registrations.length, icon: FileText },
                            { id: 'deposits', label: 'Security Deposits', count: deposits.length, icon: ShieldCheck },
                            { id: 'calculator', label: 'Proration & Discount Calc', count: null, icon: Sparkles },
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`py-3 px-1 border-b-2 font-medium text-sm inline-flex items-center gap-2 whitespace-nowrap transition-colors ${
                                        isActive
                                            ? 'border-indigo-600 text-indigo-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                    {tab.count !== null && (
                                        <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                            isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* TAB 1: FEE STRUCTURES */}
                {activeTab === 'structures' && (
                    <div className="space-y-4">
                        {/* Search & Filters */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 md:items-center justify-between">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search fee structures by name or description..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex items-center gap-2 overflow-x-auto">
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                    className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
                                >
                                    <option value="ALL">All Fee Types</option>
                                    <option value="MONTHLY">Monthly</option>
                                    <option value="REGISTRATION">Registration</option>
                                    <option value="DEPOSIT">Deposit</option>
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="DAILY">Daily</option>
                                    <option value="HOURLY">Hourly</option>
                                    <option value="OTHER">Other</option>
                                </select>

                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
                                >
                                    <option value="ALL">All Status</option>
                                    <option value="ACTIVE">Active Only</option>
                                    <option value="INACTIVE">Inactive Only</option>
                                </select>
                            </div>
                        </div>

                        {/* Fee Structures Table */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                            {filteredFees.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <h3 className="text-base font-semibold text-slate-700">No fee structures found</h3>
                                    <p className="text-sm text-slate-400 mt-1">Get started by creating your daycare's monthly or registration rates.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200">
                                            <tr>
                                                <th className="py-3.5 px-4">Fee Name</th>
                                                <th className="py-3.5 px-4">Fee Type</th>
                                                <th className="py-3.5 px-4">Frequency</th>
                                                <th className="py-3.5 px-4">Amount</th>
                                                <th className="py-3.5 px-4">Applies To</th>
                                                <th className="py-3.5 px-4">Effective Dates</th>
                                                <th className="py-3.5 px-4">Version</th>
                                                <th className="py-3.5 px-4">Status</th>
                                                <th className="py-3.5 px-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredFees.map(fee => (
                                                <tr key={fee.id} className="hover:bg-slate-50/70 transition">
                                                    <td className="py-3.5 px-4">
                                                        <div className="font-semibold text-slate-900">{fee.name}</div>
                                                        {fee.description && <div className="text-xs text-slate-400 truncate max-w-xs">{fee.description}</div>}
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg">
                                                            {fee.fee_type}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-slate-600 font-medium text-xs">
                                                        {fee.frequency}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-bold text-slate-900">
                                                        ${fee.amount} <span className="text-xs font-normal text-slate-400">{fee.currency}</span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-xs text-slate-600">
                                                        {fee.applies_to === 'ALL' && <span className="text-indigo-600 font-semibold">All Children</span>}
                                                        {fee.applies_to === 'PROGRAM' && <span>Program: {fee.program_name || 'Assigned'}</span>}
                                                        {fee.applies_to === 'CLASSROOM' && <span>Room: {fee.classroom_name || 'Assigned'}</span>}
                                                        {fee.applies_to === 'BRANCH' && <span>Branch: {fee.branch_name || 'Assigned'}</span>}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-xs text-slate-600">
                                                        <div>From: <span className="font-medium text-slate-800">{fee.effective_from}</span></div>
                                                        {fee.effective_until ? (
                                                            <div>To: <span className="font-medium text-slate-800">{fee.effective_until}</span></div>
                                                        ) : (
                                                            <div className="text-slate-400 italic">No expiry</div>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <button
                                                            onClick={() => handleOpenHistory(fee)}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-md transition"
                                                            title="View historical versions"
                                                        >
                                                            <History className="w-3 h-3" />
                                                            v{fee.version}
                                                        </button>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <button
                                                            onClick={() => handleToggleActive(fee)}
                                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition ${
                                                                fee.is_active
                                                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                            }`}
                                                        >
                                                            {fee.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                            {fee.is_active ? 'Active' : 'Inactive'}
                                                        </button>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right">
                                                        <div className="inline-flex items-center gap-1.5">
                                                            <button
                                                                onClick={() => {
                                                                    setVersioningFee(fee);
                                                                    setVersionForm({
                                                                        amount: fee.amount,
                                                                        effective_from: new Date().toISOString().split('T')[0],
                                                                        notes: `Updated from v${fee.version}`,
                                                                    });
                                                                }}
                                                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition"
                                                                title="Revise Price (New Version)"
                                                            >
                                                                New Rate
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setEditingFee(fee);
                                                                    setFeeForm({
                                                                        name: fee.name,
                                                                        description: fee.description || '',
                                                                        fee_type: fee.fee_type,
                                                                        frequency: fee.frequency,
                                                                        amount: fee.amount,
                                                                        currency: fee.currency,
                                                                        effective_from: fee.effective_from,
                                                                        effective_until: fee.effective_until || '',
                                                                        applies_to: fee.applies_to,
                                                                        program: fee.program || '',
                                                                        classroom: fee.classroom || '',
                                                                        branch: fee.branch || '',
                                                                        is_active: fee.is_active,
                                                                    });
                                                                    setIsCreateModalOpen(true);
                                                                }}
                                                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                                                                title="Edit Fee"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: CHILD RATE ASSIGNMENTS */}
                {activeTab === 'assignments' && (
                    <div className="space-y-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">Child-Specific Rate Assignments</h3>
                                <p className="text-xs text-slate-400">Override default program rates with customized negotiated rates or sibling discounts.</p>
                            </div>
                            <button
                                onClick={() => setIsAssignModalOpen(true)}
                                className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Assign Rate to Child
                            </button>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                            {assignments.length === 0 ? (
                                <div className="p-12 text-center">
                                    <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <h3 className="text-base font-semibold text-slate-700">No custom rate assignments</h3>
                                    <p className="text-sm text-slate-400 mt-1">Children will automatically inherit the standard fee for their program/room.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200">
                                            <tr>
                                                <th className="py-3.5 px-4">Student</th>
                                                <th className="py-3.5 px-4">Classroom</th>
                                                <th className="py-3.5 px-4">Base Fee</th>
                                                <th className="py-3.5 px-4">Custom Rate Override</th>
                                                <th className="py-3.5 px-4">Discount</th>
                                                <th className="py-3.5 px-4">Effective Billing Rate</th>
                                                <th className="py-3.5 px-4">Effective Dates</th>
                                                <th className="py-3.5 px-4">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {assignments.map(ass => (
                                                <tr key={ass.id} className="hover:bg-slate-50/70 transition">
                                                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                                                        {ass.student_name}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-xs text-slate-600">
                                                        {ass.classroom_name || 'Standard'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-slate-700">
                                                        {ass.fee_structure_name}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-xs">
                                                        {ass.custom_amount ? (
                                                            <span className="font-semibold text-indigo-600">${ass.custom_amount}</span>
                                                        ) : (
                                                            <span className="text-slate-400">Inherit Base</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-xs">
                                                        {parseFloat(ass.discount_percentage) > 0 ? (
                                                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-semibold rounded">
                                                                {ass.discount_percentage}% ({ass.discount_reason || 'Discount'})
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">None</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-bold text-slate-900">
                                                        ${ass.effective_rate} <span className="text-xs font-normal text-slate-400">{ass.currency}</span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-xs text-slate-600">
                                                        {ass.effective_from} {ass.effective_until ? `to ${ass.effective_until}` : '(ongoing)'}
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                            ass.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                            {ass.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 3: REGISTRATION FEES */}
                {activeTab === 'registrations' && (
                    <div className="space-y-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">One-Time Registration Fees</h3>
                                <p className="text-xs text-slate-400">Tracking registration fees with automatic duplicate prevention and fee waivers.</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                            {registrations.length === 0 ? (
                                <div className="p-12 text-center">
                                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <h3 className="text-base font-semibold text-slate-700">No registration fee records</h3>
                                    <p className="text-sm text-slate-400 mt-1">Registration records are automatically generated upon new student admission.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200">
                                            <tr>
                                                <th className="py-3.5 px-4">Child Name</th>
                                                <th className="py-3.5 px-4">Registration Fee Plan</th>
                                                <th className="py-3.5 px-4">Amount</th>
                                                <th className="py-3.5 px-4">Status</th>
                                                <th className="py-3.5 px-4">Recorded Date</th>
                                                <th className="py-3.5 px-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {registrations.map(reg => (
                                                <tr key={reg.id} className="hover:bg-slate-50/70 transition">
                                                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                                                        {reg.student_name}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-slate-700">
                                                        {reg.fee_structure_name}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-bold text-slate-900">
                                                        ${reg.amount} <span className="text-xs font-normal text-slate-400">{reg.currency}</span>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
                                                            reg.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' :
                                                            reg.status === 'INVOICED' ? 'bg-blue-50 text-blue-700' :
                                                            reg.status === 'WAIVED' ? 'bg-slate-100 text-slate-600' :
                                                            'bg-amber-50 text-amber-700'
                                                        }`}>
                                                            {reg.status}
                                                        </span>
                                                        {reg.status === 'WAIVED' && reg.waived_reason && (
                                                            <div className="text-xs text-slate-400 mt-0.5">Reason: {reg.waived_reason}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-xs text-slate-500">
                                                        {reg.created_at ? new Date(reg.created_at).toLocaleDateString() : 'N/A'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right">
                                                        {reg.status === 'PENDING' && (
                                                            <button
                                                                onClick={() => handleWaiveRegFee(reg.id)}
                                                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition"
                                                            >
                                                                Waive Fee
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 4: SECURITY DEPOSITS */}
                {activeTab === 'deposits' && (
                    <div className="space-y-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">Deposit Lifecycle & Trust Accounting</h3>
                                <p className="text-xs text-slate-400">Maintain deposits separately from revenue until applied to billing or refunded.</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                            {deposits.length === 0 ? (
                                <div className="p-12 text-center">
                                    <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <h3 className="text-base font-semibold text-slate-700">No deposit records</h3>
                                    <p className="text-sm text-slate-400 mt-1">Collect security or enrollment deposits to safeguard against late withdrawal.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200">
                                            <tr>
                                                <th className="py-3.5 px-4">Student</th>
                                                <th className="py-3.5 px-4">Charged</th>
                                                <th className="py-3.5 px-4">Held in Trust</th>
                                                <th className="py-3.5 px-4">Applied</th>
                                                <th className="py-3.5 px-4">Refunded</th>
                                                <th className="py-3.5 px-4">Remaining Held</th>
                                                <th className="py-3.5 px-4">Status</th>
                                                <th className="py-3.5 px-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {deposits.map(dep => (
                                                <tr key={dep.id} className="hover:bg-slate-50/70 transition">
                                                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                                                        {dep.student_name}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                                                        ${dep.amount_charged}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-medium text-amber-600">
                                                        ${dep.amount_held}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-medium text-blue-600">
                                                        ${dep.amount_applied}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-medium text-emerald-600">
                                                        ${dep.amount_refunded}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-bold text-slate-900">
                                                        ${dep.remaining_held} <span className="text-xs font-normal text-slate-400">{dep.currency}</span>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
                                                            dep.status === 'HELD' ? 'bg-amber-50 text-amber-700' :
                                                            dep.status === 'FULLY_APPLIED' ? 'bg-blue-50 text-blue-700' :
                                                            dep.status === 'REFUNDED' ? 'bg-emerald-50 text-emerald-700' :
                                                            'bg-slate-100 text-slate-700'
                                                        }`}>
                                                            {dep.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right">
                                                        <div className="inline-flex items-center gap-1.5">
                                                            {dep.status === 'CHARGED' && (
                                                                <button
                                                                    onClick={() => {
                                                                        setDepositActionTarget(dep);
                                                                        setDepositActionType('RECEIVE_DEPOSIT');
                                                                        setDepositActionForm({ amount: dep.amount_charged, notes: '' });
                                                                    }}
                                                                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg transition"
                                                                >
                                                                    Receive
                                                                </button>
                                                            )}
                                                            {parseFloat(dep.remaining_held) > 0 && (
                                                                <>
                                                                    <button
                                                                        onClick={() => {
                                                                            setDepositActionTarget(dep);
                                                                            setDepositActionType('APPLY_TO_BILLING');
                                                                            setDepositActionForm({ amount: dep.remaining_held, notes: '' });
                                                                        }}
                                                                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition"
                                                                    >
                                                                        Apply
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setDepositActionTarget(dep);
                                                                            setDepositActionType('REFUND_DEPOSIT');
                                                                            setDepositActionForm({ amount: dep.remaining_held, notes: '' });
                                                                        }}
                                                                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition"
                                                                    >
                                                                        Refund
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 5: PRORATION & SIBLING DISCOUNT CALCULATOR PREVIEW */}
                {activeTab === 'calculator' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Proration Tool */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-wide">
                                <Clock className="w-4 h-4" />
                                Mid-Month Enrollment Proration Calculator
                            </div>
                            <p className="text-xs text-slate-500">
                                Backend Decimal precision engine computes the exact day-count ratio for partial month enrollments.
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Base Fee ({currencySymbol})</label>
                                    <input
                                        type="number"
                                        value={calcMonthlyAmount}
                                        onChange={(e) => setCalcMonthlyAmount(e.target.value)}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Enrolment Start Date</label>
                                    <input
                                        type="date"
                                        value={calcStartDate}
                                        onChange={(e) => setCalcStartDate(e.target.value)}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    />
                                </div>

                                <button
                                    onClick={handleRunProration}
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition"
                                >
                                    Calculate Prorated Amount
                                </button>
                            </div>

                            {prorationResult && (
                                <div className="mt-4 p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-xs text-indigo-900">
                                        <span>Days in Month:</span>
                                        <span className="font-bold">{prorationResult.days_in_month} days</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-indigo-900">
                                        <span>Enrolled Days:</span>
                                        <span className="font-bold">{prorationResult.enrolled_days} days</span>
                                    </div>
                                    <div className="border-t border-indigo-200/60 pt-2 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-indigo-900">Prorated Fee:</span>
                                        <span className="text-lg font-bold text-indigo-700">${prorationResult.prorated_amount} {currencySymbol}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sibling Discount Tool */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                            <div className="flex items-center gap-2 text-blue-600 font-bold text-sm uppercase tracking-wide">
                                <Percent className="w-4 h-4" />
                                Multi-Child & Sibling Discount Calculator
                            </div>
                            <p className="text-xs text-slate-500">
                                Compute family sibling percentage discounts seamlessly with standard accounting rounding.
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Base Childcare Fee ({currencySymbol})</label>
                                    <input
                                        type="number"
                                        value={calcSiblingBase}
                                        onChange={(e) => setCalcSiblingBase(e.target.value)}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Sibling Count in Daycare</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={calcSiblingCount}
                                            onChange={(e) => setCalcSiblingCount(parseInt(e.target.value) || 1)}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Discount %</label>
                                        <input
                                            type="number"
                                            value={calcSiblingPct}
                                            onChange={(e) => setCalcSiblingPct(e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleRunSiblingCalc}
                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
                                >
                                    Calculate Sibling Rate
                                </button>
                            </div>

                            {siblingResult && (
                                <div className="mt-4 p-4 bg-blue-50/70 border border-blue-100 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-xs text-blue-900">
                                        <span>Discount Status:</span>
                                        <span className="font-bold">{siblingResult.has_discount ? 'Applied' : 'Not Applicable (1st Child)'}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-blue-900">
                                        <span>Discount Amount:</span>
                                        <span className="font-bold">-${siblingResult.discount_amount} {currencySymbol}</span>
                                    </div>
                                    <div className="border-t border-blue-200/60 pt-2 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-blue-900">Final Rate:</span>
                                        <span className="text-lg font-bold text-blue-700">${siblingResult.final_amount} {currencySymbol}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* MODAL 1: CREATE / EDIT FEE STRUCTURE */}
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h3 className="text-lg font-bold text-slate-900">
                                    {editingFee ? 'Edit Fee Structure' : 'Create New Fee Structure'}
                                </h3>
                                <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                            </div>

                            <form onSubmit={handleSaveFee} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fee Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g., Infant Full-Time Monthly"
                                        value={feeForm.name}
                                        onChange={(e) => setFeeForm({ ...feeForm, name: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Details regarding age group, schedule, inclusions..."
                                        value={feeForm.description}
                                        onChange={(e) => setFeeForm({ ...feeForm, description: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Fee Type *</label>
                                        <select
                                            value={feeForm.fee_type}
                                            onChange={(e) => setFeeForm({ ...feeForm, fee_type: e.target.value })}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                        >
                                            <option value="MONTHLY">Monthly Childcare</option>
                                            <option value="REGISTRATION">Registration Fee</option>
                                            <option value="DEPOSIT">Security Deposit</option>
                                            <option value="WEEKLY">Weekly Childcare</option>
                                            <option value="DAILY">Daily Childcare</option>
                                            <option value="HOURLY">Hourly Childcare</option>
                                            <option value="OTHER">Other Activity Fee</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Frequency *</label>
                                        <select
                                            value={feeForm.frequency}
                                            onChange={(e) => setFeeForm({ ...feeForm, frequency: e.target.value })}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                        >
                                            <option value="MONTHLY">Monthly</option>
                                            <option value="ONE_TIME">One-Time</option>
                                            <option value="WEEKLY">Weekly</option>
                                            <option value="DAILY">Daily</option>
                                            <option value="HOURLY">Hourly</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Amount *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            placeholder="1200.00"
                                            value={feeForm.amount}
                                            onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={feeForm.currency || summary?.currency || 'CAD'}
                                            className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-semibold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Effective From *</label>
                                        <input
                                            type="date"
                                            required
                                            value={feeForm.effective_from}
                                            onChange={(e) => setFeeForm({ ...feeForm, effective_from: e.target.value })}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Effective Until</label>
                                        <input
                                            type="date"
                                            value={feeForm.effective_until}
                                            onChange={(e) => setFeeForm({ ...feeForm, effective_until: e.target.value })}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Applies To</label>
                                    <select
                                        value={feeForm.applies_to}
                                        onChange={(e) => setFeeForm({ ...feeForm, applies_to: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    >
                                        <option value="ALL">All Children in Daycare</option>
                                        <option value="PROGRAM">Specific Program</option>
                                        <option value="CLASSROOM">Specific Classroom</option>
                                        <option value="BRANCH">Specific Branch</option>
                                    </select>
                                </div>

                                {feeForm.applies_to === 'PROGRAM' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Select Program</label>
                                        <select
                                            value={feeForm.program}
                                            onChange={(e) => setFeeForm({ ...feeForm, program: e.target.value })}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                        >
                                            <option value="">-- Choose Program --</option>
                                            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                {feeForm.applies_to === 'CLASSROOM' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Select Classroom</label>
                                        <select
                                            value={feeForm.classroom}
                                            onChange={(e) => setFeeForm({ ...feeForm, classroom: e.target.value })}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                        >
                                            <option value="">-- Choose Classroom --</option>
                                            {classrooms.map(c => <option key={c.id} value={c.id}>{c.room_name}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="fee_active_chk"
                                        checked={feeForm.is_active}
                                        onChange={(e) => setFeeForm({ ...feeForm, is_active: e.target.checked })}
                                        className="w-4 h-4 rounded text-indigo-600"
                                    />
                                    <label htmlFor="fee_active_chk" className="text-xs font-medium text-slate-700">Active and available for billing</label>
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateModalOpen(false)}
                                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                                    >
                                        {editingFee ? 'Update Fee' : 'Save Fee Structure'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL 2: CREATE NEW VERSION (HISTORICAL PRICING) */}
                {versioningFee && (
                    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">Create New Pricing Version</h3>
                                    <p className="text-xs text-slate-400">Current version (v{versioningFee.version}) will be preserved historically.</p>
                                </div>
                                <button onClick={() => setVersioningFee(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                            </div>

                            <form onSubmit={handleSaveVersion} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fee Name</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={versioningFee.name}
                                        className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-semibold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">New Rate Amount ({currencySymbol}) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={versionForm.amount}
                                        onChange={(e) => setVersionForm({ ...versionForm, amount: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    />
                                    <span className="text-[11px] text-slate-400">Previous amount: ${versioningFee.amount}</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Effective Start Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={versionForm.effective_from}
                                        onChange={(e) => setVersionForm({ ...versionForm, effective_from: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    />
                                    <span className="text-[11px] text-slate-400">v{versioningFee.version} will be automatically capped up to 1 day prior.</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Version Notes / Revision Reason</label>
                                    <textarea
                                        rows={2}
                                        placeholder="e.g., Annual inflation revision / budget adjustment"
                                        value={versionForm.notes}
                                        onChange={(e) => setVersionForm({ ...versionForm, notes: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setVersioningFee(null)}
                                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                                    >
                                        Save New Version
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL 3: VIEW VERSION HISTORY */}
                {historyModalFee && (
                    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">Historical Price Versions</h3>
                                    <p className="text-xs text-slate-400">{historyModalFee.name}</p>
                                </div>
                                <button onClick={() => setHistoryModalFee(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                            </div>

                            <div className="space-y-3 max-h-80 overflow-y-auto">
                                {feeHistoryList.map(v => (
                                    <div key={v.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">
                                                    v{v.version}
                                                </span>
                                                <span className="font-bold text-slate-900 text-sm">
                                                    ${v.amount} {v.currency}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                Effective: {v.effective_from} {v.effective_until ? `to ${v.effective_until}` : '(current ongoing)'}
                                            </div>
                                            {v.description && <div className="text-xs text-slate-400 mt-0.5 italic">{v.description}</div>}
                                        </div>

                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                            v.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'
                                        }`}>
                                            {v.is_active ? 'Active' : 'Superseded'}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end pt-3 border-t border-slate-100">
                                <button
                                    onClick={() => setHistoryModalFee(null)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL 4: ASSIGN FEE TO CHILD */}
                {isAssignModalOpen && (
                    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h3 className="text-base font-bold text-slate-900">Assign Fee Structure to Child</h3>
                                <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                            </div>

                            <form onSubmit={handleSaveAssignment} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Select Child *</label>
                                    <select
                                        required
                                        value={assignForm.student}
                                        onChange={(e) => setAssignForm({ ...assignForm, student: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    >
                                        <option value="">-- Choose Child --</option>
                                        {students.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.first_name} {s.last_name} ({s.admission_number || 'Enrolled'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fee Structure Plan *</label>
                                    <select
                                        required
                                        value={assignForm.fee_structure}
                                        onChange={(e) => setAssignForm({ ...assignForm, fee_structure: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    >
                                        <option value="">-- Choose Plan --</option>
                                        {feeStructures.map(f => (
                                            <option key={f.id} value={f.id}>
                                                {f.name} (${f.amount} {f.currency} / {f.frequency})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Custom Amount Override</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Optional override"
                                            value={assignForm.custom_amount}
                                            onChange={(e) => setAssignForm({ ...assignForm, custom_amount: e.target.value })}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Discount %</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={assignForm.discount_percentage}
                                            onChange={(e) => setAssignForm({ ...assignForm, discount_percentage: e.target.value })}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Reason</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Sibling discount / staff child subsidy"
                                        value={assignForm.discount_reason}
                                        onChange={(e) => setAssignForm({ ...assignForm, discount_reason: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Effective Start *</label>
                                        <input
                                            type="date"
                                            required
                                            value={assignForm.effective_from}
                                            onChange={(e) => setAssignForm({ ...assignForm, effective_from: e.target.value })}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Effective End</label>
                                        <input
                                            type="date"
                                            value={assignForm.effective_until}
                                            onChange={(e) => setAssignForm({ ...assignForm, effective_until: e.target.value })}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsAssignModalOpen(false)}
                                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                                    >
                                        Confirm Assignment
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL 5: PROCESS DEPOSIT ACTION */}
                {depositActionTarget && (
                    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">Process Deposit Action</h3>
                                    <p className="text-xs text-slate-400">{depositActionTarget.student_name} • Action: {depositActionType}</p>
                                </div>
                                <button onClick={() => setDepositActionTarget(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                            </div>

                            <form onSubmit={handleProcessDepositAction} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Action Type</label>
                                    <select
                                        value={depositActionType}
                                        onChange={(e) => setDepositActionType(e.target.value)}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    >
                                        <option value="RECEIVE_DEPOSIT">Receive Deposit into Trust</option>
                                        <option value="APPLY_TO_BILLING">Apply Deposit to Childcare Invoice</option>
                                        <option value="REFUND_DEPOSIT">Refund Deposit to Family</option>
                                        <option value="FORFEIT_DEPOSIT">Forfeit Deposit</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ({currencySymbol}) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={depositActionForm.amount}
                                        onChange={(e) => setDepositActionForm({ ...depositActionForm, amount: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    />
                                    <span className="text-[11px] text-slate-400">
                                        Current remaining held in trust: ${depositActionTarget.remaining_held}
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Audit Memo</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Add relevant receipt or reason memo..."
                                        value={depositActionForm.notes}
                                        onChange={(e) => setDepositActionForm({ ...depositActionForm, notes: e.target.value })}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setDepositActionTarget(null)}
                                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                                    >
                                        Execute Action
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

export default FeeStructuresPage;
