import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, ArrowLeft, Send, Ban, XCircle, DollarSign,
    CreditCard, Clock, CheckCircle2, AlertTriangle, Printer,
    Calendar, Users, Building, ShieldCheck, Sparkles, AlertCircle,
    Receipt, Tag, RefreshCw, Layers, Check, Download, User
} from 'lucide-react';
import Layout from '../../../components/Layout';
import api from '../../../api';
import {
    billingService,
    type Invoice,
    type DepositRecord
} from '../../../api/billingService';

export const InvoiceDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Modals
    const [actionType, setActionType] = useState<'VOID' | 'CANCEL' | 'CREDIT' | 'DEPOSIT' | 'LATE_FEE' | null>(null);
    const [actionInput, setActionInput] = useState<{ reason?: string; amount?: string; notes?: string; deposit_record_id?: string }>({});
    const [availableCredit, setAvailableCredit] = useState<string>('0.00');
    const [deposits, setDeposits] = useState<DepositRecord[]>([]);

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    const loadInvoice = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const data = await billingService.getInvoiceDetail(id);
            setInvoice(data);

            // If family exists, fetch available credits
            if (data.family) {
                try {
                    const cred = await billingService.getFamilyCreditBalance(data.family);
                    setAvailableCredit(cred.available_credit_balance || '0.00');
                } catch (e) {
                    console.error('Failed to fetch credit balance:', e);
                }
            }

            // If student exists, fetch available deposits
            if (data.student) {
                try {
                    const depList = await billingService.getDeposits({ student_id: data.student, status: 'HELD' });
                    setDeposits(depList || []);
                } catch (e) {
                    console.error('Failed to fetch deposits:', e);
                }
            }
        } catch (error) {
            console.error('Failed to load invoice details:', error);
            showToast('Failed to load invoice details.', 'error');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadInvoice();
    }, [loadInvoice]);

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

    const handleIssue = async () => {
        if (!invoice) return;
        try {
            const updated = await billingService.issueInvoice(invoice.id);
            setInvoice(updated);
            showToast(`Invoice #${updated.invoice_number} has been issued.`);
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Failed to issue invoice.', 'error');
        }
    };

    const handleActionSubmit = async () => {
        if (!invoice || !actionType) return;
        try {
            if (actionType === 'VOID') {
                const updated = await billingService.voidInvoice(invoice.id, actionInput.reason || 'Administrative Void');
                setInvoice(updated);
                showToast(`Invoice #${updated.invoice_number} has been voided.`);
            } else if (actionType === 'CANCEL') {
                const updated = await billingService.cancelInvoice(invoice.id, actionInput.reason || 'Administrative Cancellation');
                setInvoice(updated);
                showToast(`Invoice #${updated.invoice_number} has been cancelled.`);
            } else if (actionType === 'CREDIT') {
                if (!actionInput.amount || parseFloat(actionInput.amount) <= 0) {
                    showToast('Please enter a valid credit amount.', 'error');
                    return;
                }
                const updated = await billingService.applyCreditToInvoice(invoice.id, actionInput.amount, actionInput.notes);
                setInvoice(updated);
                showToast(`Applied ${formatCurrency(actionInput.amount)} credit towards this invoice.`);
            } else if (actionType === 'DEPOSIT') {
                if (!actionInput.deposit_record_id || !actionInput.amount || parseFloat(actionInput.amount) <= 0) {
                    showToast('Please select a deposit and enter an amount.', 'error');
                    return;
                }
                const updated = await billingService.applyDepositToInvoice(
                    invoice.id,
                    actionInput.deposit_record_id,
                    actionInput.amount,
                    actionInput.notes
                );
                setInvoice(updated);
                showToast(`Applied ${formatCurrency(actionInput.amount)} deposit towards this invoice.`);
            } else if (actionType === 'LATE_FEE') {
                const updated = await billingService.assessLateFee(invoice.id);
                setInvoice(updated);
                showToast(`Late fee assessed and added to invoice #${updated.invoice_number}.`);
            }
            setActionType(null);
            setActionInput({});
            loadInvoice();
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Action failed.', 'error');
        }
    };

    // Print Invoice Handler
    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <Layout>
                <div className="min-h-screen bg-slate-50/50 text-slate-900 p-8 flex items-center justify-center">
                    <div className="text-center">
                        <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 font-medium">Loading invoice details...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    if (!invoice) {
        return (
            <Layout>
                <div className="min-h-screen bg-slate-50/50 text-slate-900 p-8 flex items-center justify-center">
                    <div className="text-center bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-md">
                        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Invoice Not Found</h2>
                        <p className="text-sm text-slate-500 mb-4">The invoice you requested does not exist or you do not have permission to view it.</p>
                        <button
                            onClick={() => navigate('/daycare/billing/invoices')}
                            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs"
                        >
                            Return to Invoices
                        </button>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="min-h-screen bg-slate-50/50 text-slate-900 p-4 md:p-8 font-sans space-y-6 max-w-5xl mx-auto print:p-0 print:bg-white print:text-black">
                {/* Toast Notification */}
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

                {/* Top Action Header (Hidden when printing) */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                    <button
                        onClick={() => navigate('/daycare/billing/invoices')}
                        className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors w-fit bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to All Invoices</span>
                    </button>

                    {/* Action Toolbar */}
                    <div className="flex items-center flex-wrap gap-2.5">
                        <button
                            onClick={handlePrint}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all shadow-xs"
                        >
                            <Printer className="w-4 h-4 text-teal-600" />
                            <span>Print / Export PDF</span>
                        </button>

                        {invoice.status === 'DRAFT' && (
                            <button
                                onClick={handleIssue}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02]"
                            >
                                <Send className="w-4 h-4" />
                                <span>Issue Invoice</span>
                            </button>
                        )}

                        {invoice.status !== 'VOID' && invoice.status !== 'CANCELLED' && invoice.status !== 'PAID' && (
                            <>
                                {parseFloat(availableCredit) > 0 && parseFloat(invoice.balance_due) > 0 && (
                                    <button
                                        onClick={() => {
                                            setActionType('CREDIT');
                                            setActionInput({ amount: Math.min(parseFloat(availableCredit), parseFloat(invoice.balance_due)).toFixed(2) });
                                        }}
                                        className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold transition-all shadow-xs"
                                    >
                                        <Sparkles className="w-4 h-4 text-sky-600" />
                                        <span>Apply Credit ({formatCurrency(availableCredit, invoice.currency)})</span>
                                    </button>
                                )}

                                {deposits.length > 0 && parseFloat(invoice.balance_due) > 0 && (
                                    <button
                                        onClick={() => {
                                            setActionType('DEPOSIT');
                                            setActionInput({
                                                deposit_record_id: deposits[0]?.id,
                                                amount: Math.min(parseFloat(deposits[0]?.remaining_held || '0'), parseFloat(invoice.balance_due)).toFixed(2)
                                            });
                                        }}
                                        className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition-all shadow-xs"
                                    >
                                        <ShieldCheck className="w-4 h-4 text-purple-600" />
                                        <span>Apply Held Deposit</span>
                                    </button>
                                )}

                                {invoice.status === 'OVERDUE' && (
                                    <button
                                        onClick={() => setActionType('LATE_FEE')}
                                        className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-all shadow-xs"
                                    >
                                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                                        <span>Assess Late Fee</span>
                                    </button>
                                )}

                                {parseFloat(invoice.balance_due) > 0 && invoice.status !== 'DRAFT' && (
                                    <button
                                        onClick={() => navigate(`/daycare/billing/payments?invoice_id=${invoice.id}`)}
                                        className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all shadow-xs"
                                    >
                                        <DollarSign className="w-4 h-4 text-emerald-600" />
                                        <span>Record Payment</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => setActionType('VOID')}
                                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all shadow-xs"
                                >
                                    <Ban className="w-4 h-4" />
                                    <span>Void</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* INVOICE DOCUMENT CONTAINER (Paper Statement Look) */}
                <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-8 lg:p-12 print:shadow-none print:border-none print:p-0">
                    {/* Header Top: Daycare branding & Invoice Title */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-8 border-b border-slate-200 print:border-slate-300 mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-white">
                                    <Receipt className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight text-slate-900 print:text-black">
                                        {invoice.daycare_name || 'KidSynq Childcare Center'}
                                    </h2>
                                    <div className="text-xs text-slate-500 print:text-slate-600 font-medium">
                                        {invoice.branch_name ? `Branch: ${invoice.branch_name} • ` : ''}Childcare Billing & Tuition Statement
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="md:text-right">
                            <div className="text-2xl font-black font-mono tracking-tight text-teal-700 print:text-slate-900 mb-1">
                                {invoice.invoice_number}
                            </div>
                            <div className="inline-block mb-1.5">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                    invoice.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                    invoice.status === 'PARTIALLY_PAID' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                    invoice.status === 'ISSUED' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                                    invoice.status === 'OVERDUE' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                    invoice.status === 'VOID' ? 'bg-zinc-100 text-zinc-500 border border-zinc-200 line-through' :
                                    'bg-slate-100 text-slate-600 border border-slate-200'
                                } print:border print:border-black print:text-black`}>
                                    {invoice.status}
                                </span>
                            </div>
                            <div className="text-xs text-slate-500 print:text-slate-600">
                                Category: <span className="font-bold text-slate-800 print:text-black">{getInvoiceTypeLabel(invoice)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Metadata Columns: Bill To & Invoice Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-8 border-b border-slate-200 print:border-slate-300 mb-8 text-sm">
                        {/* Bill To */}
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                                Billed To
                            </span>
                            <div className="font-black text-lg text-slate-900 print:text-black mb-1 flex items-center gap-2">
                                {invoice.student_name ? (
                                    <>
                                        <User className="w-4 h-4 text-teal-600" />
                                        <span>{invoice.student_name}</span>
                                    </>
                                ) : (
                                    <>
                                        <Users className="w-4 h-4 text-indigo-600" />
                                        <span>{invoice.family_name || 'Individual Student'}</span>
                                    </>
                                )}
                            </div>
                            {invoice.family_name && !invoice.student_name && (
                                <div className="text-xs text-slate-600 print:text-slate-600 mb-1 font-medium">
                                    Family: <span className="text-slate-900 font-bold">{invoice.family_name}</span>
                                </div>
                            )}
                            <div className="text-xs text-slate-400 font-mono">
                                Account ID #{invoice.student || invoice.family || 'SYS-AUTO'}
                            </div>
                        </div>

                        {/* Invoice Key Dates */}
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-2">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                                Statement Details
                            </span>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Issue Date:</span>
                                <span className="font-bold text-slate-800">{invoice.issue_date}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Payment Due:</span>
                                <span className="font-bold text-teal-700">{invoice.due_date}</span>
                            </div>
                            {invoice.billing_period_start && invoice.billing_period_end && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Billing Period:</span>
                                    <span className="font-bold text-slate-800">{invoice.billing_period_start} to {invoice.billing_period_end}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* LINE ITEMS TABLE */}
                    <div className="mb-8">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50/80">
                                    <th className="py-3 px-3">Description / Fee Item</th>
                                    <th className="py-3 px-3 text-center">Qty / Units</th>
                                    <th className="py-3 px-3 text-right">Unit Rate</th>
                                    <th className="py-3 px-3 text-right">Discount</th>
                                    <th className="py-3 px-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {invoice.items && invoice.items.length > 0 ? (
                                    invoice.items.map((item, idx) => (
                                        <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-3.5 px-3">
                                                <div className="font-bold text-slate-900 text-sm">
                                                    {item.description}
                                                </div>
                                                {item.student_name && (
                                                    <div className="text-xs text-slate-500 mt-0.5">
                                                        Child: <span className="font-bold text-slate-700">{item.student_name}</span>
                                                    </div>
                                                )}
                                                {item.discount_description && (
                                                    <div className="text-xs text-emerald-600 font-bold mt-0.5">
                                                        Applied: {item.discount_description}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-3 text-center font-mono text-slate-600">
                                                {item.quantity}
                                            </td>
                                            <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                                                {formatCurrency(item.unit_price, invoice.currency)}
                                            </td>
                                            <td className="py-3.5 px-3 text-right font-mono text-emerald-600 font-bold">
                                                {parseFloat(item.discount_amount) > 0 ? `-${formatCurrency(item.discount_amount, invoice.currency)}` : '—'}
                                            </td>
                                            <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                                                {formatCurrency(item.subtotal, invoice.currency)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="py-6 text-center text-slate-400">
                                            No line items on this invoice.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* FINANCIAL BREAKDOWN SUMMARY */}
                    <div className="flex flex-col md:flex-row justify-between gap-8 pt-6 border-t border-slate-200 print:border-slate-300 mb-8">
                        {/* Notes & Terms */}
                        <div className="flex-1 space-y-4">
                            {invoice.notes && (
                                <div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                        Notes & Instructions
                                    </span>
                                    <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-100 font-medium">
                                        {invoice.notes}
                                    </p>
                                </div>
                            )}
                            {invoice.terms && (
                                <div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                        Payment Terms
                                    </span>
                                    <p className="text-xs text-slate-600 font-medium">
                                        {invoice.terms}
                                    </p>
                                </div>
                            )}
                            {invoice.void_reason && (
                                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                                    <span className="font-bold">Void Reason:</span> {invoice.void_reason}
                                </div>
                            )}
                        </div>

                        {/* Calculation Totals */}
                        <div className="w-full md:w-80 space-y-2 text-xs font-medium bg-slate-50 p-5 rounded-2xl border border-slate-100">
                            <div className="flex justify-between text-slate-600">
                                <span>Subtotal:</span>
                                <span className="font-mono font-bold text-slate-800">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                            </div>

                            {parseFloat(invoice.discount_total) > 0 && (
                                <div className="flex justify-between text-emerald-600 font-bold">
                                    <span>Total Discounts:</span>
                                    <span className="font-mono">-{formatCurrency(invoice.discount_total, invoice.currency)}</span>
                                </div>
                            )}

                            {parseFloat(invoice.tax_total) > 0 && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Taxes:</span>
                                    <span className="font-mono">+{formatCurrency(invoice.tax_total, invoice.currency)}</span>
                                </div>
                            )}

                            {parseFloat(invoice.late_fee_total) > 0 && (
                                <div className="flex justify-between text-rose-600 font-bold">
                                    <span>Late Fees:</span>
                                    <span className="font-mono">+{formatCurrency(invoice.late_fee_total, invoice.currency)}</span>
                                </div>
                            )}

                            {parseFloat(invoice.credit_total) > 0 && (
                                <div className="flex justify-between text-sky-600 font-bold">
                                    <span>Credits Applied:</span>
                                    <span className="font-mono">-{formatCurrency(invoice.credit_total, invoice.currency)}</span>
                                </div>
                            )}

                            {parseFloat(invoice.deposit_applied_total) > 0 && (
                                <div className="flex justify-between text-purple-600 font-bold">
                                    <span>Deposit Applied:</span>
                                    <span className="font-mono">-{formatCurrency(invoice.deposit_applied_total, invoice.currency)}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 border-t border-slate-200">
                                <span>Total Invoice:</span>
                                <span className="font-mono font-black">{formatCurrency(invoice.total, invoice.currency)}</span>
                            </div>

                            {parseFloat(invoice.amount_paid) > 0 && (
                                <div className="flex justify-between text-emerald-600 font-bold">
                                    <span>Amount Paid:</span>
                                    <span className="font-mono">{formatCurrency(invoice.amount_paid, invoice.currency)}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-base font-black pt-3 border-t-2 border-slate-300">
                                <span className="text-slate-900">Balance Due:</span>
                                <span className={`font-mono ${parseFloat(invoice.balance_due) > 0 ? (invoice.status === 'OVERDUE' ? 'text-rose-600' : 'text-teal-700') : 'text-emerald-600'}`}>
                                    {formatCurrency(invoice.balance_due, invoice.currency)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* MODAL FOR VOID, CREDIT, DEPOSIT, LATE FEE */}
                <AnimatePresence>
                    {actionType && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-6"
                            >
                                <h3 className="text-base font-bold text-slate-900 mb-2">
                                    {actionType === 'VOID' && 'Void Invoice'}
                                    {actionType === 'CANCEL' && 'Cancel Invoice'}
                                    {actionType === 'CREDIT' && 'Apply Family Ledger Credit'}
                                    {actionType === 'DEPOSIT' && 'Apply Held Deposit Funds'}
                                    {actionType === 'LATE_FEE' && 'Assess & Append Late Fee'}
                                </h3>

                                <p className="text-xs text-slate-500 mb-4">
                                    {actionType === 'VOID' && 'Voiding this invoice will permanently zero the balance and automatically restore any ledger credits or held deposit balances used.'}
                                    {actionType === 'CREDIT' && `Available family balance: ${formatCurrency(availableCredit, invoice.currency)}`}
                                    {actionType === 'DEPOSIT' && 'Select from held security deposit records.'}
                                    {actionType === 'LATE_FEE' && 'Calculate applicable late fee rule and append line item.'}
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
                                            max={parseFloat(invoice.balance_due)}
                                            value={actionInput.amount || ''}
                                            onChange={e => setActionInput({ ...actionInput, amount: e.target.value })}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white font-mono"
                                        />
                                    </div>
                                )}

                                {actionType === 'DEPOSIT' && (
                                    <div className="space-y-3 mb-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Select Held Deposit</label>
                                            <select
                                                value={actionInput.deposit_record_id}
                                                onChange={e => {
                                                    const sel = deposits.find(d => d.id === e.target.value);
                                                    setActionInput({
                                                        ...actionInput,
                                                        deposit_record_id: e.target.value,
                                                        amount: sel ? Math.min(parseFloat(sel.remaining_held), parseFloat(invoice.balance_due)).toFixed(2) : '0.00'
                                                    });
                                                }}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                                            >
                                                {deposits.map(d => (
                                                    <option key={d.id} value={d.id}>
                                                        {d.fee_structure_name || 'Deposit'} - Remaining: {formatCurrency(d.remaining_held, d.currency)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Amount to Apply ($) *</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                value={actionInput.amount || ''}
                                                onChange={e => setActionInput({ ...actionInput, amount: e.target.value })}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white font-mono"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-3">
                                    <button
                                        onClick={() => setActionType(null)}
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

export default InvoiceDetailPage;
