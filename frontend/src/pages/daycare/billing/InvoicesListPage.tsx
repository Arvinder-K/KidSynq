import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Plus, Filter, Search, CheckCircle2, XCircle,
    Calendar, Layers, ShieldCheck, RefreshCw, ArrowRight,
    Sparkles, AlertCircle, Trash2, Tag, ArrowUpRight,
    CreditCard, ChevronRight, Clock, Eye, Ban, DollarSign,
    Zap, Play, Check, AlertTriangle, Send, SlidersHorizontal,
    Users, UserCheck, Edit, User
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';
import {
    billingService,
    type Invoice,
    type InvoiceStats,
    type RecurringBillingProfile,
    type FeeStructure
} from '../../../api/billingService';

export const InvoicesListPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Active Tab
    const [activeTab, setActiveTab] = useState<'invoices' | 'recurring' | 'batch'>('invoices');

    // Data State
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [stats, setStats] = useState<InvoiceStats | null>(null);
    const [recurringProfiles, setRecurringProfiles] = useState<RecurringBillingProfile[]>([]);
    const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [families, setFamilies] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);

    // Loading & Filters
    const [loading, setLoading] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>(searchParams.get('search') || '');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [filterType, setFilterType] = useState<string>('ALL');
    const [filterBranch, setFilterBranch] = useState<string>('ALL');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [isRegModalOpen, setIsRegModalOpen] = useState<boolean>(false);
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState<boolean>(false);
    const [actionTargetInvoice, setActionTargetInvoice] = useState<Invoice | null>(null);
    const [actionType, setActionType] = useState<'VOID' | 'CANCEL' | 'CREDIT' | 'DEPOSIT' | 'LATE_FEE' | null>(null);
    const [actionInput, setActionInput] = useState<{ reason?: string; amount?: string; notes?: string }>({});

    // Create Invoice Form State
    const [createForm, setCreateForm] = useState({
        student: '',
        family: '',
        branch: '',
        invoice_type: 'CUSTOM',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        billing_period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        billing_period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
        apply_available_credits: true,
        apply_available_deposits: false,
        notes: '',
        terms: 'Payment is due within 14 days of invoice issuance.',
        items: [
            {
                fee_structure: '',
                description: 'Childcare Tuition',
                quantity: '1.00',
                unit_price: '0.00',
                discount_amount: '0.00',
                tax_amount: '0.00',
                subtotal: '0.00'
            }
        ]
    });

    // Registration Invoice Form
    const [regForm, setRegForm] = useState({
        student_id: '',
        fee_structure_id: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        notes: ''
    });

    // Batch Generation Form
    const [batchForm, setBatchForm] = useState({
        billing_period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        billing_period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        branch_id: '',
        invoice_type: 'FAMILY' as 'FAMILY' | 'STUDENT',
        apply_available_credits: true,
        apply_available_deposits: false,
        notes: 'Monthly childcare billing statement.'
    });
    const [batchResult, setBatchResult] = useState<any | null>(null);
    const [batchLoading, setBatchLoading] = useState<boolean>(false);

    // Recurring Profile Form
    const [profileForm, setProfileForm] = useState({
        profile_name: '',
        student: '',
        family: '',
        fee_structure: '',
        frequency: 'MONTHLY',
        billing_basis: 'CALENDAR_ADVANCE',
        auto_apply_credit: true,
        auto_apply_deposit: false,
        advance_generation_days: 5,
        next_billing_date: new Date().toISOString().split('T')[0],
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        is_active: true,
        notes: ''
    });

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [
                invoicesData,
                statsData,
                recurringData,
                feeStructuresData,
                studentsData,
                familiesData,
                branchesRes
            ] = await Promise.all([
                billingService.getInvoices().catch(err => { console.error('Error fetching invoices:', err); return []; }),
                billingService.getInvoiceStats().catch(err => { console.error('Error fetching stats:', err); return null; }),
                billingService.getRecurringProfiles().catch(err => { console.error('Error fetching recurring:', err); return []; }),
                billingService.getFeeStructures({ is_active: true }).catch(err => { console.error('Error fetching fees:', err); return []; }),
                billingService.getStudents().catch(err => { console.error('Error fetching students:', err); return []; }),
                billingService.getFamilies().catch(err => { console.error('Error fetching families:', err); return []; }),
                api.get('daycare/branches/').catch(() => ({ data: [] }))
            ]);

            setInvoices(invoicesData || []);
            setStats(statsData || null);
            setRecurringProfiles(recurringData || []);
            setFeeStructures(feeStructuresData || []);
            setStudents(Array.isArray(studentsData) ? studentsData : []);
            setFamilies(Array.isArray(familiesData) ? familiesData : []);
            setBranches(branchesRes.data?.results || branchesRes.data || []);
        } catch (error) {
            console.error('Failed to load invoice billing data:', error);
            showToast('Failed to load invoices and billing profiles.', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Format currency
    const formatCurrency = (val: string | number | undefined, currency: string = 'CAD') => {
        const num = typeof val === 'string' ? parseFloat(val) : (val || 0);
        return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(isNaN(num) ? 0 : num);
    };

    // Format invoice type badge label
    const getInvoiceTypeLabel = (inv: Invoice) => {
        if (inv.invoice_type === 'REGISTRATION') return 'Registration Fee';
        if (inv.invoice_type === 'MONTHLY') return 'Monthly Tuition';
        if (inv.invoice_type === 'WEEKLY') return 'Weekly Tuition';
        if (inv.invoice_type === 'BI_WEEKLY') return 'Bi-Weekly Tuition';
        if (inv.invoice_type === 'DAILY') return 'Daily Attendance';
        if (inv.invoice_type === 'HOURLY') return 'Hourly Timesheet';
        if (inv.invoice_type === 'DEPOSIT') return 'Security Deposit';
        if (inv.invoice_type === 'FAMILY') return inv.student_name ? 'Student Invoice' : 'Family Statement';
        return 'Custom Invoice';
    };

    // Filter Invoices
    const filteredInvoices = invoices.filter(inv => {
        if (filterStatus !== 'ALL' && inv.status !== filterStatus) return false;
        if (filterType !== 'ALL' && inv.invoice_type !== filterType) return false;
        if (filterBranch !== 'ALL' && inv.branch !== filterBranch) return false;
        if (startDate && inv.issue_date < startDate) return false;
        if (endDate && inv.issue_date > endDate) return false;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const invNum = inv.invoice_number?.toLowerCase() || '';
            const fam = inv.family_name?.toLowerCase() || '';
            const stu = inv.student_name?.toLowerCase() || '';
            const notes = inv.notes?.toLowerCase() || '';
            return invNum.includes(term) || fam.includes(term) || stu.includes(term) || notes.includes(term);
        }
        return true;
    });

    // Handle Quick Issue
    const handleIssueInvoice = async (invoice: Invoice) => {
        try {
            await billingService.issueInvoice(invoice.id);
            showToast(`Invoice #${invoice.invoice_number} has been issued.`);
            loadData();
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Failed to issue invoice.', 'error');
        }
    };

    // Handle Action Modal Submit
    const handleActionSubmit = async () => {
        if (!actionTargetInvoice || !actionType) return;
        try {
            if (actionType === 'VOID') {
                await billingService.voidInvoice(actionTargetInvoice.id, actionInput.reason || 'Administrative Void');
                showToast(`Invoice #${actionTargetInvoice.invoice_number} has been voided.`);
            } else if (actionType === 'CANCEL') {
                await billingService.cancelInvoice(actionTargetInvoice.id, actionInput.reason || 'Administrative Cancellation');
                showToast(`Invoice #${actionTargetInvoice.invoice_number} has been cancelled.`);
            } else if (actionType === 'CREDIT') {
                if (!actionInput.amount) {
                    showToast('Please specify a credit amount to apply.', 'error');
                    return;
                }
                await billingService.applyCreditToInvoice(actionTargetInvoice.id, actionInput.amount, actionInput.notes);
                showToast(`Credit of ${formatCurrency(actionInput.amount)} applied to #${actionTargetInvoice.invoice_number}.`);
            } else if (actionType === 'LATE_FEE') {
                await billingService.assessLateFee(actionTargetInvoice.id);
                showToast(`Late fee assessed and appended to #${actionTargetInvoice.invoice_number}.`);
            }
            setActionTargetInvoice(null);
            setActionType(null);
            setActionInput({});
            loadData();
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Failed to perform action.', 'error');
        }
    };

    // Handle Create Custom Invoice
    const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                family: createForm.family || undefined,
                student: createForm.student || undefined,
                branch: createForm.branch || undefined,
                issue_date: createForm.issue_date,
                due_date: createForm.due_date,
                billing_period_start: createForm.billing_period_start || undefined,
                billing_period_end: createForm.billing_period_end || undefined,
                apply_available_credits: createForm.apply_available_credits,
                apply_available_deposits: createForm.apply_available_deposits,
                notes: createForm.notes,
                terms: createForm.terms,
                items: createForm.items.map(itm => ({
                    fee_structure: itm.fee_structure || undefined,
                    description: itm.description,
                    quantity: itm.quantity,
                    unit_price: itm.unit_price,
                    discount_amount: itm.discount_amount || '0.00',
                    tax_amount: itm.tax_amount || '0.00',
                    subtotal: itm.subtotal || '0.00'
                }))
            };

            const created = await billingService.createInvoice(payload);
            showToast(`Invoice #${created.invoice_number} created successfully.`);
            setIsCreateModalOpen(false);
            loadData();
            navigate(`/daycare/billing/invoices/${created.id}`);
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Failed to create invoice.', 'error');
        }
    };

    // Handle Registration Invoice Generation
    const handleRegSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const created = await billingService.generateRegistrationInvoice(regForm);
            showToast(`Registration Invoice #${created.invoice_number} created successfully.`);
            setIsRegModalOpen(false);
            loadData();
            navigate(`/daycare/billing/invoices/${created.id}`);
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Failed to generate registration invoice.', 'error');
        }
    };

    // Handle Batch Run
    const handleRunBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        setBatchLoading(true);
        setBatchResult(null);
        try {
            const res = await billingService.generateBatchInvoices(batchForm);
            setBatchResult(res);
            showToast(`Batch run complete: ${res.total_generated} invoices generated.`);
            loadData();
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Batch generation failed.', 'error');
        } finally {
            setBatchLoading(false);
        }
    };

    // Trigger Single Recurring Run
    const handleTriggerRecurringRun = async (profile: RecurringBillingProfile) => {
        try {
            const res = await billingService.triggerRecurringProfileRun(profile.id);
            showToast(`Run complete: ${res.total_invoices_generated} invoice generated for ${profile.profile_name}.`);
            loadData();
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Failed to trigger profile run.', 'error');
        }
    };

    // Trigger All Recurring Runs
    const handleTriggerAllRuns = async () => {
        if (!window.confirm('Trigger recurring billing runs for all due active profiles now?')) return;
        try {
            const res = await billingService.triggerAllRecurringProfilesRun();
            showToast(`Batch recurring complete: ${res.total_invoices_generated} invoices generated across ${res.total_profiles_processed} profiles.`);
            loadData();
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Failed to trigger all runs.', 'error');
        }
    };

    // Handle Profile Create
    const handleCreateProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await billingService.createRecurringProfile({
                profile_name: profileForm.profile_name,
                student: profileForm.student || undefined,
                family: profileForm.family || undefined,
                fee_structure: profileForm.fee_structure || undefined,
                frequency: profileForm.frequency as any,
                billing_basis: profileForm.billing_basis as any,
                auto_apply_credit: profileForm.auto_apply_credit,
                auto_apply_deposit: profileForm.auto_apply_deposit,
                advance_generation_days: Number(profileForm.advance_generation_days),
                next_billing_date: profileForm.next_billing_date,
                start_date: profileForm.start_date,
                end_date: profileForm.end_date || null,
                is_active: profileForm.is_active,
                notes: profileForm.notes
            });
            showToast('Recurring billing profile created successfully.');
            setIsRecurringModalOpen(false);
            loadData();
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Failed to create recurring profile.', 'error');
        }
    };

    // Helper to calculate line item subtotal
    const updateLineItem = (index: number, field: string, val: any) => {
        const newItems = [...createForm.items];
        newItems[index] = { ...newItems[index], [field]: val };

        // Recalculate subtotal
        const qty = parseFloat(newItems[index].quantity) || 0;
        const price = parseFloat(newItems[index].unit_price) || 0;
        const disc = parseFloat(newItems[index].discount_amount) || 0;
        const tax = parseFloat(newItems[index].tax_amount) || 0;
        newItems[index].subtotal = ((qty * price) - disc + tax).toFixed(2);

        setCreateForm({ ...createForm, items: newItems });
    };

    const addLineItem = () => {
        setCreateForm({
            ...createForm,
            items: [
                ...createForm.items,
                {
                    fee_structure: '',
                    description: '',
                    quantity: '1.00',
                    unit_price: '0.00',
                    discount_amount: '0.00',
                    tax_amount: '0.00',
                    subtotal: '0.00'
                }
            ]
        });
    };

    const removeLineItem = (index: number) => {
        if (createForm.items.length <= 1) return;
        const newItems = createForm.items.filter((_, i) => i !== index);
        setCreateForm({ ...createForm, items: newItems });
    };

    // Status Badge Component
    const renderStatusBadge = (statusStr: string) => {
        switch (statusStr) {
            case 'PAID':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                    </span>
                );
            case 'PARTIALLY_PAID':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3.5 h-3.5" /> Partially Paid
                    </span>
                );
            case 'ISSUED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                        <Send className="w-3.5 h-3.5" /> Issued
                    </span>
                );
            case 'OVERDUE':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" /> Overdue
                    </span>
                );
            case 'DRAFT':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        <Edit className="w-3.5 h-3.5" /> Draft
                    </span>
                );
            case 'VOID':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-500 border border-zinc-200 line-through">
                        <Ban className="w-3.5 h-3.5" /> Void
                    </span>
                );
            case 'CANCELLED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                        <XCircle className="w-3.5 h-3.5" /> Cancelled
                    </span>
                );
            default:
                return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">{statusStr}</span>;
        }
    };

    return (
        <Layout>
            <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans text-slate-900">
                {/* Toast Message */}
                <AnimatePresence>
                    {toastMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-bold border ${
                                toastMessage.type === 'success'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : 'bg-rose-50 border-rose-200 text-rose-800'
                            }`}
                        >
                            {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
                            <span>{toastMessage.text}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Invoicing & Recurring Billing</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Generate standard & custom invoices, run automated recurring billing cycles, calculate actual attendance tuition, and issue statements.
                        </p>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap gap-2.5 items-center">
                        <button
                            onClick={() => setIsRegModalOpen(true)}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-all shadow-xs"
                        >
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <span>Reg. Fee Invoice</span>
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('recurring');
                                setIsRecurringModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-all shadow-xs"
                        >
                            <Zap className="w-4 h-4 text-indigo-500" />
                            <span>New Recurring Profile</span>
                        </button>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create New Invoice</span>
                        </button>
                    </div>
                </div>

                {/* KPI Metric Cards */}
                {stats && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative overflow-hidden">
                            <div className="flex items-center justify-between text-slate-500 mb-2">
                                <span className="text-xs font-extrabold uppercase tracking-wider">Invoiced YTD</span>
                                <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                                    <DollarSign className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-2xl font-black text-slate-900 mb-1">
                                {formatCurrency(stats.total_invoiced_ytd, stats.currency)}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                <span className="text-sky-600 font-bold">{stats.counts.total}</span> total invoices this year
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative overflow-hidden">
                            <div className="flex items-center justify-between text-slate-500 mb-2">
                                <span className="text-xs font-extrabold uppercase tracking-wider">Total Collected</span>
                                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-2xl font-black text-emerald-600 mb-1">
                                {formatCurrency(stats.total_collected_ytd, stats.currency)}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                <span className="text-emerald-600 font-bold">{stats.counts.paid}</span> fully settled invoices
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative overflow-hidden">
                            <div className="flex items-center justify-between text-slate-500 mb-2">
                                <span className="text-xs font-extrabold uppercase tracking-wider">Outstanding Balance</span>
                                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                                    <Clock className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-2xl font-black text-amber-600 mb-1">
                                {formatCurrency(stats.total_outstanding, stats.currency)}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                <span className="text-amber-600 font-bold">{stats.counts.issued + stats.counts.partially_paid}</span> awaiting full payment
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative overflow-hidden">
                            <div className="flex items-center justify-between text-slate-500 mb-2">
                                <span className="text-xs font-extrabold uppercase tracking-wider">Overdue Balance</span>
                                <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                                    <AlertTriangle className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-2xl font-black text-rose-600 mb-1">
                                {formatCurrency(stats.total_overdue, stats.currency)}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                <span className="text-rose-600 font-bold">{stats.counts.overdue}</span> invoices past grace period
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl overflow-x-auto">
                    {[
                        { id: 'invoices', label: 'Invoices & Statements', icon: FileText, count: invoices.length },
                        { id: 'recurring', label: 'Recurring Billing Profiles', icon: Zap, count: recurringProfiles.length },
                        { id: 'batch', label: 'Batch Invoice Generator', icon: SlidersHorizontal },
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

                {/* Tab 1: Invoices List */}
                {activeTab === 'invoices' && (
                    <div className="space-y-4">
                        {/* Search & Filter Bar */}
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                            <div className="flex-1 relative">
                                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by invoice #, family, student or notes..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                />
                            </div>

                            <div className="flex items-center flex-wrap gap-2.5">
                                <select
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="DRAFT">Draft</option>
                                    <option value="ISSUED">Issued</option>
                                    <option value="PARTIALLY_PAID">Partially Paid</option>
                                    <option value="PAID">Paid</option>
                                    <option value="OVERDUE">Overdue</option>
                                    <option value="VOID">Void</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </select>

                                <select
                                    value={filterType}
                                    onChange={e => setFilterType(e.target.value)}
                                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="ALL">All Fee Types</option>
                                    <option value="MONTHLY">Monthly</option>
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="DAILY">Daily</option>
                                    <option value="HOURLY">Hourly</option>
                                    <option value="REGISTRATION">Registration</option>
                                    <option value="DEPOSIT">Deposit</option>
                                    <option value="FAMILY">Family Combined</option>
                                    <option value="CUSTOM">Custom</option>
                                </select>

                                {branches.length > 0 && (
                                    <select
                                        value={filterBranch}
                                        onChange={e => setFilterBranch(e.target.value)}
                                        className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        <option value="ALL">All Branches</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                )}

                                <button
                                    onClick={loadData}
                                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-all"
                                    title="Refresh Invoices"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Invoices Table */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                                            <th className="py-4 px-4">Invoice #</th>
                                            <th className="py-4 px-4">Bill To</th>
                                            <th className="py-4 px-4">Period / Due</th>
                                            <th className="py-4 px-4">Subtotal</th>
                                            <th className="py-4 px-4">Discounts & Credits</th>
                                            <th className="py-4 px-4">Total</th>
                                            <th className="py-4 px-4">Balance Due</th>
                                            <th className="py-4 px-4">Status</th>
                                            <th className="py-4 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={9} className="py-12 text-center text-slate-400">
                                                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                                                    Loading invoices...
                                                </td>
                                            </tr>
                                        ) : filteredInvoices.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="py-12 text-center text-slate-400">
                                                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                                    No invoices match the specified criteria.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredInvoices.map(inv => (
                                                <tr
                                                    key={inv.id}
                                                    className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                                                    onClick={() => navigate(`/daycare/billing/invoices/${inv.id}`)}
                                                >
                                                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                                                        <div className="flex items-center gap-1.5">
                                                            <FileText className="w-3.5 h-3.5 text-teal-600" />
                                                            <span>{inv.invoice_number}</span>
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 font-sans mt-0.5">
                                                            {getInvoiceTypeLabel(inv)}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        {inv.student_name ? (
                                                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                                                <User className="w-3.5 h-3.5 text-teal-600" />
                                                                <span>{inv.student_name}</span>
                                                            </div>
                                                        ) : inv.family_name ? (
                                                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                                                <Users className="w-3.5 h-3.5 text-indigo-600" />
                                                                <span>{inv.family_name}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="font-medium text-slate-500">
                                                                Individual Student
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-xs">
                                                        <div className="text-slate-800">
                                                            Due: <span className="font-bold text-slate-900">{inv.due_date}</span>
                                                        </div>
                                                        <div className="text-slate-400 mt-0.5 text-[11px]">
                                                            Issued: {inv.issue_date}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 font-mono text-slate-700">
                                                        {formatCurrency(inv.subtotal, inv.currency)}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-xs font-mono">
                                                        {parseFloat(inv.discount_total) > 0 && (
                                                            <div className="text-emerald-600 font-bold">
                                                                Disc: -{formatCurrency(inv.discount_total, inv.currency)}
                                                            </div>
                                                        )}
                                                        {parseFloat(inv.credit_total) > 0 && (
                                                            <div className="text-sky-600 font-bold">
                                                                Credit: -{formatCurrency(inv.credit_total, inv.currency)}
                                                            </div>
                                                        )}
                                                        {parseFloat(inv.deposit_applied_total) > 0 && (
                                                            <div className="text-purple-600 font-bold">
                                                                Dep: -{formatCurrency(inv.deposit_applied_total, inv.currency)}
                                                            </div>
                                                        )}
                                                        {parseFloat(inv.discount_total) === 0 && parseFloat(inv.credit_total) === 0 && parseFloat(inv.deposit_applied_total) === 0 && (
                                                            <span className="text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                                                        {formatCurrency(inv.total, inv.currency)}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-mono font-bold">
                                                        <span className={parseFloat(inv.balance_due) > 0 ? (inv.status === 'OVERDUE' ? 'text-rose-600' : 'text-amber-600') : 'text-emerald-600'}>
                                                            {formatCurrency(inv.balance_due, inv.currency)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        {renderStatusBadge(inv.status)}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            {inv.status === 'DRAFT' && (
                                                                <button
                                                                    onClick={() => handleIssueInvoice(inv)}
                                                                    className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 transition-all text-xs flex items-center gap-1 font-bold"
                                                                    title="Issue Invoice"
                                                                >
                                                                    <Send className="w-3.5 h-3.5" /> Issue
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => navigate(`/daycare/billing/invoices/${inv.id}`)}
                                                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all text-xs font-medium"
                                                                title="View Invoice"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
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

                {/* Tab 2: Recurring Billing Profiles */}
                {activeTab === 'recurring' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Recurring Billing Profiles</h3>
                                <p className="text-xs text-slate-500">
                                    Configured recurring subscriptions generating advance tuition invoices or attendance actuals.
                                </p>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <button
                                    onClick={handleTriggerAllRuns}
                                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-all"
                                >
                                    <Play className="w-3.5 h-3.5 text-amber-600" /> Run All Due Cycles
                                </button>
                                <button
                                    onClick={() => setIsRecurringModalOpen(true)}
                                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Profile
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recurringProfiles.length === 0 ? (
                                <div className="col-span-full py-12 text-center text-slate-400 border border-dashed border-slate-300 rounded-3xl bg-white">
                                    <Zap className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                    No recurring billing profiles configured yet.
                                </div>
                            ) : (
                                recurringProfiles.map(p => (
                                    <div
                                        key={p.id}
                                        className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-teal-500/50 hover:shadow-md transition-all relative flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-3">
                                                <h4 className="font-bold text-slate-900 text-base">{p.profile_name}</h4>
                                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                    p.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {p.is_active ? 'Active' : 'Paused'}
                                                </span>
                                            </div>

                                            <div className="space-y-2 text-xs text-slate-600 mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500">Target:</span>
                                                    <span className="font-bold text-slate-800">
                                                        {p.family_name ? `Family: ${p.family_name}` : `Child: ${p.student_name}`}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500">Frequency:</span>
                                                    <span className="font-bold text-teal-700">{p.frequency}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500">Basis:</span>
                                                    <span className="font-bold text-indigo-700">{p.billing_basis}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500">Next Run Date:</span>
                                                    <span className="font-bold text-amber-700">{p.next_billing_date}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                                            <button
                                                onClick={() => handleTriggerRecurringRun(p)}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all"
                                            >
                                                <Play className="w-3.5 h-3.5 text-emerald-600" /> Run Now
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Tab 3: Batch Generator */}
                {activeTab === 'batch' && (
                    <div className="max-w-3xl mx-auto p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                                <SlidersHorizontal className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Batch Invoice Generator</h3>
                                <p className="text-xs text-slate-500">
                                    Generate monthly or cycle billing invoices in bulk across all enrolled families or students.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleRunBatch} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Billing Period Start *</label>
                                    <input
                                        type="date"
                                        required
                                        value={batchForm.billing_period_start}
                                        onChange={e => setBatchForm({ ...batchForm, billing_period_start: e.target.value })}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Billing Period End *</label>
                                    <input
                                        type="date"
                                        required
                                        value={batchForm.billing_period_end}
                                        onChange={e => setBatchForm({ ...batchForm, billing_period_end: e.target.value })}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Invoice Issue Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={batchForm.issue_date}
                                        onChange={e => setBatchForm({ ...batchForm, issue_date: e.target.value })}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Due Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={batchForm.due_date}
                                        onChange={e => setBatchForm({ ...batchForm, due_date: e.target.value })}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Grouping Basis</label>
                                    <select
                                        value={batchForm.invoice_type}
                                        onChange={e => setBatchForm({ ...batchForm, invoice_type: e.target.value as any })}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        <option value="FAMILY">Family Combined Invoices (Recommended)</option>
                                        <option value="STUDENT">Individual Child Invoices</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Branch Scope</label>
                                    <select
                                        value={batchForm.branch_id}
                                        onChange={e => setBatchForm({ ...batchForm, branch_id: e.target.value })}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        <option value="">All Daycare Branches</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 py-2">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={batchForm.apply_available_credits}
                                        onChange={e => setBatchForm({ ...batchForm, apply_available_credits: e.target.checked })}
                                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <span>Auto-apply available ledger credits</span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={batchLoading}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                            >
                                {batchLoading ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Generating Invoices in Bulk...</span>
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4" />
                                        <span>Run Bulk Invoice Generation</span>
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Batch Results Output */}
                        {batchResult && (
                            <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Batch Summary
                                </h4>
                                <div className="text-xs text-slate-600 space-y-1">
                                    <div>Generated: <span className="font-bold text-emerald-600">{batchResult.total_generated}</span> invoices</div>
                                    <div>Skipped (duplicates/inactive): <span className="font-bold text-amber-600">{batchResult.total_skipped}</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* CREATE NEW INVOICE MODAL */}
                <AnimatePresence>
                    {isCreateModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full max-w-3xl rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-8"
                            >
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
                                            <Plus className="w-5 h-5" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900">Create New Custom Invoice</h3>
                                    </div>
                                    <button
                                        onClick={() => setIsCreateModalOpen(false)}
                                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleCreateInvoiceSubmit} className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Family (Optional)</label>
                                            <select
                                                value={createForm.family}
                                                onChange={e => {
                                                    const famId = e.target.value;
                                                    const fam = families.find(f => f.id === famId);
                                                    let selectedStudent = createForm.student;
                                                    if (fam && fam.children && fam.children.length === 1) {
                                                        selectedStudent = fam.children[0].id;
                                                    }
                                                    setCreateForm({ ...createForm, family: famId, student: selectedStudent });
                                                }}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                            >
                                                <option value="">Select Family...</option>
                                                {families.map(f => (
                                                    <option key={f.id} value={f.id}>
                                                        {f.family_name || f.name || `Family #${f.id?.slice?.(0, 6)}`}{f.primary_contact ? ` (${f.primary_contact})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Student / Child (Optional)</label>
                                            <select
                                                value={createForm.student}
                                                onChange={e => {
                                                    const stuId = e.target.value;
                                                    const stu = students.find(s => s.id === stuId);
                                                    setCreateForm({
                                                        ...createForm,
                                                        student: stuId,
                                                        family: stu?.family_id || createForm.family
                                                    });
                                                }}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                            >
                                                <option value="">Select Student...</option>
                                                {students.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.first_name || s.last_name ? `${s.first_name || ''} ${s.last_name || ''}`.trim() : (s.name || `Student #${s.id?.slice?.(0, 6)}`)}{s.family_name ? ` (${s.family_name})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Issue Date *</label>
                                            <input
                                                type="date"
                                                required
                                                value={createForm.issue_date}
                                                onChange={e => setCreateForm({ ...createForm, issue_date: e.target.value })}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Due Date *</label>
                                            <input
                                                type="date"
                                                required
                                                value={createForm.due_date}
                                                onChange={e => setCreateForm({ ...createForm, due_date: e.target.value })}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                            />
                                        </div>
                                    </div>

                                    {/* Line items builder */}
                                    <div className="pt-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Line Items</label>
                                            <button
                                                type="button"
                                                onClick={addLineItem}
                                                className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 font-bold"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Add Line Item
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            {createForm.items.map((item, idx) => (
                                                <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center gap-3">
                                                    <div className="flex-1 w-full">
                                                        <input
                                                            type="text"
                                                            placeholder="Description (e.g. Infant Full-Time Care)"
                                                            required
                                                            value={item.description}
                                                            onChange={e => updateLineItem(idx, 'description', e.target.value)}
                                                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                        />
                                                    </div>
                                                    <div className="w-24">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="Qty"
                                                            required
                                                            value={item.quantity}
                                                            onChange={e => updateLineItem(idx, 'quantity', e.target.value)}
                                                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                                                        />
                                                    </div>
                                                    <div className="w-32">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="Unit Price ($)"
                                                            required
                                                            value={item.unit_price}
                                                            onChange={e => updateLineItem(idx, 'unit_price', e.target.value)}
                                                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                                                        />
                                                    </div>
                                                    <div className="w-28 font-mono text-xs text-slate-900 font-bold text-right pr-2">
                                                        ${item.subtotal}
                                                    </div>
                                                    {createForm.items.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeLineItem(idx)}
                                                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 py-2">
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={createForm.apply_available_credits}
                                                onChange={e => setCreateForm({ ...createForm, apply_available_credits: e.target.checked })}
                                                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                            />
                                            <span>Auto-apply available ledger credits</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={createForm.apply_available_deposits}
                                                onChange={e => setCreateForm({ ...createForm, apply_available_deposits: e.target.checked })}
                                                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                            />
                                            <span>Apply held deposit funds</span>
                                        </label>
                                    </div>

                                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setIsCreateModalOpen(false)}
                                            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
                                        >
                                            Create Invoice
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* REGISTRATION FEE INVOICE MODAL */}
                <AnimatePresence>
                    {isRegModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-6"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-amber-500" />
                                        <h3 className="font-bold text-slate-900 text-base">Generate Registration Invoice</h3>
                                    </div>
                                    <button onClick={() => setIsRegModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleRegSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Child / Student *</label>
                                        <select
                                            required
                                            value={regForm.student_id}
                                            onChange={e => setRegForm({ ...regForm, student_id: e.target.value })}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                        >
                                            <option value="">Select Enrolled Child...</option>
                                            {students.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.first_name || s.last_name ? `${s.first_name || ''} ${s.last_name || ''}`.trim() : (s.name || `Student #${s.id?.slice?.(0, 6)}`)}{s.family_name ? ` (${s.family_name})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Registration Fee Structure</label>
                                        <select
                                            value={regForm.fee_structure_id}
                                            onChange={e => setRegForm({ ...regForm, fee_structure_id: e.target.value })}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                        >
                                            <option value="">Auto-resolve Daycare Registration Fee</option>
                                            {feeStructures.filter(f => f.fee_type === 'REGISTRATION').map(f => (
                                                <option key={f.id} value={f.id}>{f.name} (${f.amount})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Issue Date</label>
                                            <input
                                                type="date"
                                                required
                                                value={regForm.issue_date}
                                                onChange={e => setRegForm({ ...regForm, issue_date: e.target.value })}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Due Date</label>
                                            <input
                                                type="date"
                                                required
                                                value={regForm.due_date}
                                                onChange={e => setRegForm({ ...regForm, due_date: e.target.value })}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsRegModalOpen(false)}
                                            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20"
                                        >
                                            Generate Registration Invoice
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* RECURRING PROFILE MODAL */}
                <AnimatePresence>
                    {isRecurringModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl p-6"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-5 h-5 text-teal-600" />
                                        <h3 className="font-bold text-slate-900 text-base">New Recurring Billing Profile</h3>
                                    </div>
                                    <button onClick={() => setIsRecurringModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleCreateProfileSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Profile Name *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Monthly Advance Tuition"
                                            value={profileForm.profile_name}
                                            onChange={e => setProfileForm({ ...profileForm, profile_name: e.target.value })}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Family</label>
                                            <select
                                                value={profileForm.family}
                                                onChange={e => {
                                                    const famId = e.target.value;
                                                    const fam = families.find(f => f.id === famId);
                                                    let stuId = profileForm.student;
                                                    if (fam && fam.children && fam.children.length === 1) {
                                                        stuId = fam.children[0].id;
                                                    }
                                                    setProfileForm({ ...profileForm, family: famId, student: stuId });
                                                }}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                            >
                                                <option value="">Select Family...</option>
                                                {families.map(f => (
                                                    <option key={f.id} value={f.id}>
                                                        {f.family_name || f.name || `Family #${f.id?.slice?.(0, 6)}`}{f.primary_contact ? ` (${f.primary_contact})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Student</label>
                                            <select
                                                value={profileForm.student}
                                                onChange={e => {
                                                    const stuId = e.target.value;
                                                    const stu = students.find(s => s.id === stuId);
                                                    setProfileForm({
                                                        ...profileForm,
                                                        student: stuId,
                                                        family: stu?.family_id || profileForm.family
                                                    });
                                                }}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                            >
                                                <option value="">Select Student...</option>
                                                {students.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.first_name || s.last_name ? `${s.first_name || ''} ${s.last_name || ''}`.trim() : (s.name || `Student #${s.id?.slice?.(0, 6)}`)}{s.family_name ? ` (${s.family_name})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Frequency</label>
                                            <select
                                                value={profileForm.frequency}
                                                onChange={e => setProfileForm({ ...profileForm, frequency: e.target.value })}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                            >
                                                <option value="MONTHLY">Monthly</option>
                                                <option value="WEEKLY">Weekly</option>
                                                <option value="BI_WEEKLY">Bi-Weekly</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Billing Basis</label>
                                            <select
                                                value={profileForm.billing_basis}
                                                onChange={e => setProfileForm({ ...profileForm, billing_basis: e.target.value })}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                            >
                                                <option value="CALENDAR_ADVANCE">Calendar Advance (Fixed Tuition)</option>
                                                <option value="ATTENDANCE_ACTUAL">Attendance Actual (Daily Attendance)</option>
                                                <option value="TIMESHEET_HOURLY">Timesheet Hourly (Checked-In Hours)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Next Billing Date *</label>
                                            <input
                                                type="date"
                                                required
                                                value={profileForm.next_billing_date}
                                                onChange={e => setProfileForm({ ...profileForm, next_billing_date: e.target.value })}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Advance Days</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="30"
                                                value={profileForm.advance_generation_days}
                                                onChange={e => setProfileForm({ ...profileForm, advance_generation_days: Number(e.target.value) })}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-3 pt-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsRecurringModalOpen(false)}
                                            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20"
                                        >
                                            Save Recurring Profile
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* ACTION CONFIRMATION MODAL */}
                <AnimatePresence>
                    {actionTargetInvoice && actionType && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-6"
                            >
                                <h3 className="text-base font-bold text-slate-900 mb-2">
                                    {actionType === 'VOID' && `Void Invoice #${actionTargetInvoice.invoice_number}`}
                                    {actionType === 'CANCEL' && `Cancel Invoice #${actionTargetInvoice.invoice_number}`}
                                    {actionType === 'CREDIT' && `Apply Family Credit to #${actionTargetInvoice.invoice_number}`}
                                    {actionType === 'LATE_FEE' && `Assess Late Fee on #${actionTargetInvoice.invoice_number}`}
                                </h3>

                                <p className="text-xs text-slate-500 mb-4">
                                    {actionType === 'VOID' && 'Voiding an invoice cancels all remaining balances and automatically restores any previously applied ledger credits or deposits.'}
                                    {actionType === 'CANCEL' && 'Cancelling an invoice marks it permanently inactive.'}
                                    {actionType === 'CREDIT' && 'Deduct credit from family available ledger balance towards this invoice balance.'}
                                    {actionType === 'LATE_FEE' && 'Calculates late fee rule and appends a late fee line item to this overdue invoice.'}
                                </p>

                                {(actionType === 'VOID' || actionType === 'CANCEL') && (
                                    <div className="mb-4">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Reason *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Reason for voiding / cancelling..."
                                            value={actionInput.reason || ''}
                                            onChange={e => setActionInput({ ...actionInput, reason: e.target.value })}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                        />
                                    </div>
                                )}

                                {actionType === 'CREDIT' && (
                                    <div className="mb-4">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Credit Amount to Apply ($) *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            max={actionTargetInvoice.balance_due}
                                            value={actionInput.amount || ''}
                                            onChange={e => setActionInput({ ...actionInput, amount: e.target.value })}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white font-mono"
                                        />
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-3">
                                    <button
                                        onClick={() => {
                                            setActionTargetInvoice(null);
                                            setActionType(null);
                                        }}
                                        className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleActionSubmit}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-md ${
                                            actionType === 'VOID' || actionType === 'CANCEL'
                                                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                                                : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'
                                        }`}
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </Layout>
    );
};

export default InvoicesListPage;
