import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CreditCard,
    Receipt,
    ChevronDown,
    ChevronUp,
    DollarSign,
    AlertCircle,
    CheckCircle2,
    Clock,
    FileText,
    Printer,
    Download,
    X,
    Calendar,
    Building2,
    ShieldCheck,
    RotateCcw,
    Sparkles,
    Check
} from 'lucide-react';
import {
    billingService,
    type PaymentReceiptData,
    type TaxReceipt,
    type TaxReceiptSlipData,
    type AccountStatement
} from '../../api/billingService';

interface InvoiceItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: string;
    total: string;
}

interface Invoice {
    id: string;
    invoice_number: string;
    student: string;
    student_name: string;
    issue_date: string;
    due_date: string;
    subtotal: string;
    tax: string;
    discount: string;
    total_amount: string;
    amount_paid: string;
    amount_due: number;
    status: string;
    notes: string | null;
    items: InvoiceItem[];
}

interface FamilyPayment {
    id: string;
    invoice_number: string;
    receipt_number?: string;
    student_name: string;
    amount: string;
    refunded_amount?: string;
    net_amount?: string;
    payment_date: string;
    payment_method: string;
    status?: string;
    transaction_reference: string | null;
    notes: string | null;
}

interface BillingSummary {
    total_outstanding: number;
    total_paid_this_month: number;
    unpaid_count: number;
    overdue_count: number;
}

const statusMeta: Record<string, { color: string; icon: React.ReactNode }> = {
    'Unpaid': { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock className="w-3 h-3" /> },
    'Paid': { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
    'Overdue': { color: 'bg-red-100 text-red-700 border-red-200', icon: <AlertCircle className="w-3 h-3" /> },
    'Partially Paid': { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <DollarSign className="w-3 h-3" /> },
    'Draft': { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: <Clock className="w-3 h-3" /> },
};

export const FamilyBilling: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'invoices' | 'payments' | 'tax_receipts' | 'statement'>('invoices');

    // Invoices State
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [summary, setSummary] = useState<BillingSummary | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    // Payments & Receipts State
    const [payments, setPayments] = useState<FamilyPayment[]>([]);
    const [receiptModalOpen, setReceiptModalOpen] = useState(false);
    const [receiptData, setReceiptData] = useState<PaymentReceiptData | null>(null);
    const [loadingReceipt, setLoadingReceipt] = useState(false);

    // Tax Receipts State
    const [taxReceipts, setTaxReceipts] = useState<TaxReceipt[]>([]);
    const [taxYearFilter, setTaxYearFilter] = useState<number>(new Date().getFullYear());
    const [taxSlipModalOpen, setTaxSlipModalOpen] = useState(false);
    const [taxSlipData, setTaxSlipData] = useState<TaxReceiptSlipData | null>(null);
    const [loadingTaxSlip, setLoadingTaxSlip] = useState(false);

    // Statement State
    const [statementStartDate, setStatementStartDate] = useState('');
    const [statementEndDate, setStatementEndDate] = useState('');
    const [statementData, setStatementData] = useState<AccountStatement | null>(null);
    const [loadingStatement, setLoadingStatement] = useState(false);

    const [loading, setLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        const params = statusFilter ? `?status=${statusFilter}` : '';
        Promise.all([
            api.get(`/family/billing/invoices/${params}`).catch(() => ({ data: { invoices: [], summary: null } })),
            billingService.getFamilyPayments().catch(() => []),
            billingService.getFamilyTaxReceipts(taxYearFilter).catch(() => []),
            billingService.getFamilyStatement().catch(() => null)
        ]).then(([invRes, payRes, taxRes, stmtRes]) => {
            setInvoices(invRes.data?.invoices || []);
            setSummary(invRes.data?.summary || null);
            setPayments(payRes as any);
            setTaxReceipts(taxRes);
            setStatementData(stmtRes);
        }).finally(() => setLoading(false));
    }, [statusFilter]);

    // Load Tax Receipts when year changes
    const loadTaxReceipts = async (year: number) => {
        try {
            const data = await billingService.getFamilyTaxReceipts(year);
            setTaxReceipts(data);
        } catch (err) {
            console.error('Failed to load tax receipts:', err);
        }
    };

    // Load Statement with custom date range
    const handleFilterStatement = async () => {
        try {
            setLoadingStatement(true);
            const data = await billingService.getFamilyStatement(
                statementStartDate || undefined,
                statementEndDate || undefined
            );
            setStatementData(data);
        } catch (err) {
            console.error('Failed to load statement:', err);
        } finally {
            setLoadingStatement(false);
        }
    };

    // Open Payment Receipt Modal
    const handleViewReceipt = async (paymentId: string) => {
        setReceiptModalOpen(true);
        setLoadingReceipt(true);
        try {
            const data = await billingService.getFamilyPaymentReceipt(paymentId);
            setReceiptData(data);
        } catch (err) {
            console.error('Failed to load payment receipt:', err);
        } finally {
            setLoadingReceipt(false);
        }
    };

    // Open Tax Slip Modal
    const handleViewTaxSlip = async (taxReceiptId: string) => {
        setTaxSlipModalOpen(true);
        setLoadingTaxSlip(true);
        try {
            const data = await billingService.getFamilyTaxReceiptSlip(taxReceiptId);
            setTaxSlipData(data);
        } catch (err) {
            console.error('Failed to load tax slip:', err);
        } finally {
            setLoadingTaxSlip(false);
        }
    };

    return (
        <Layout>
            <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
                {/* Modern Light Page Header */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                <CreditCard className="w-6 h-6" />
                            </span>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Family Billing & Payments</h1>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Review your invoices, download payment receipts, access annual CRA tax slips, and view your account statement.
                        </p>
                    </div>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Outstanding Balance', value: `$${summary.total_outstanding.toFixed(2)}`, color: 'bg-rose-50 border-rose-200 text-rose-800' },
                            { label: 'Paid This Month', value: `$${summary.total_paid_this_month.toFixed(2)}`, color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                            { label: 'Pending Invoices', value: `${summary.unpaid_count}`, color: 'bg-amber-50 border-amber-200 text-amber-800' },
                            { label: 'Overdue Invoices', value: `${summary.overdue_count}`, color: 'bg-red-50 border-red-200 text-red-800' },
                        ].map((card, i) => (
                            <div key={card.label} className={`border rounded-xl p-4 shadow-sm ${card.color}`}>
                                <div className="text-2xl font-bold">{card.value}</div>
                                <div className="text-xs font-semibold uppercase tracking-wider mt-1 opacity-80">{card.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Navigation Tabs */}
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-6">
                        <button
                            onClick={() => setActiveTab('invoices')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                                activeTab === 'invoices'
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <CreditCard className="w-4 h-4" />
                            Invoices
                        </button>
                        <button
                            onClick={() => setActiveTab('payments')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                                activeTab === 'payments'
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Receipt className="w-4 h-4" />
                            Payments & Receipts
                        </button>
                        <button
                            onClick={() => setActiveTab('tax_receipts')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                                activeTab === 'tax_receipts'
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Sparkles className="w-4 h-4" />
                            Annual Tax Receipts (CRA)
                        </button>
                        <button
                            onClick={() => setActiveTab('statement')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                                activeTab === 'statement'
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <FileText className="w-4 h-4" />
                            Statement of Account
                        </button>
                    </nav>
                </div>

                {/* ========================================================================= */}
                {/* TAB 1: INVOICES */}
                {/* ========================================================================= */}
                {activeTab === 'invoices' && (
                    <div className="space-y-4">
                        {/* Status Filter */}
                        <div className="flex gap-2 flex-wrap items-center">
                            {['', 'Unpaid', 'Paid', 'Overdue', 'Partially Paid'].map(s => (
                                <button
                                    key={s || 'All'}
                                    onClick={() => setStatusFilter(s)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                        statusFilter === s
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                                    }`}
                                >
                                    {s || 'All Invoices'}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-16">
                                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : invoices.length === 0 ? (
                            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
                                <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                <p className="font-semibold text-gray-700">No invoices found</p>
                                <p className="text-xs text-gray-400 mt-0.5">You are up to date on all daycare invoices.</p>
                            </div>
                        ) : (
                            invoices.map((inv, i) => {
                                const meta = statusMeta[inv.status] || statusMeta['Draft'];
                                return (
                                    <div
                                        key={inv.id}
                                        className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                        onClick={() => setSelectedInvoice(selectedInvoice?.id === inv.id ? null : inv)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                    <CreditCard className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 text-sm">{inv.invoice_number}</p>
                                                    <p className="text-xs text-gray-500">{inv.student_name} · Due: {inv.due_date}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="font-bold text-gray-900">${parseFloat(inv.total_amount).toFixed(2)}</p>
                                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
                                                        {meta.icon} {inv.status}
                                                    </span>
                                                </div>
                                                {selectedInvoice?.id === inv.id ? (
                                                    <ChevronUp className="w-4 h-4 text-gray-400" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                                )}
                                            </div>
                                        </div>

                                        <AnimatePresence>
                                            {selectedInvoice?.id === inv.id && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="mt-4 pt-4 border-t border-gray-100 overflow-hidden"
                                                >
                                                    <div className="space-y-2">
                                                        {inv.items.map(item => (
                                                            <div key={item.id} className="flex justify-between text-xs text-gray-700">
                                                                <span>{item.description} × {item.quantity}</span>
                                                                <span className="font-semibold text-gray-900">${parseFloat(item.total).toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                        <div className="border-t border-gray-100 pt-2 mt-2 space-y-1 text-xs">
                                                            <div className="flex justify-between text-gray-500">
                                                                <span>Subtotal</span>
                                                                <span>${parseFloat(inv.subtotal).toFixed(2)}</span>
                                                            </div>
                                                            {parseFloat(inv.discount) > 0 && (
                                                                <div className="flex justify-between text-emerald-600 font-medium">
                                                                    <span>Discount / Subsidy</span>
                                                                    <span>-${parseFloat(inv.discount).toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
                                                                <span>Invoice Total</span>
                                                                <span>${parseFloat(inv.total_amount).toFixed(2)}</span>
                                                            </div>
                                                            {parseFloat(inv.amount_paid) > 0 && (
                                                                <div className="flex justify-between text-emerald-600 font-medium">
                                                                    <span>Paid to Date</span>
                                                                    <span>-${parseFloat(inv.amount_paid).toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                            {inv.amount_due > 0 && (
                                                                <div className="flex justify-between font-bold text-rose-600 text-sm pt-1">
                                                                    <span>Remaining Balance Due</span>
                                                                    <span>${inv.amount_due.toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* ========================================================================= */}
                {/* TAB 2: PAYMENTS & RECEIPTS */}
                {/* ========================================================================= */}
                {activeTab === 'payments' && (
                    <div className="space-y-4">
                        {payments.length === 0 ? (
                            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
                                <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                <p className="font-semibold text-gray-700">No payment records found</p>
                                <p className="text-xs text-gray-400 mt-0.5">Recorded payments and official receipts will appear here.</p>
                            </div>
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-gray-600">
                                        <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-700 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-4">Receipt / Invoice #</th>
                                                <th className="px-6 py-4">Student</th>
                                                <th className="px-6 py-4">Payment Method</th>
                                                <th className="px-6 py-4">Payment Date</th>
                                                <th className="px-6 py-4">Amount</th>
                                                <th className="px-6 py-4 text-right">Official Receipt</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 font-medium">
                                            {payments.map((p) => (
                                                <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-gray-900 font-mono text-xs">
                                                            {p.receipt_number || p.invoice_number}
                                                        </div>
                                                        <div className="text-xs text-gray-500">Inv: {p.invoice_number}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-900">{p.student_name}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                                            {p.payment_method}
                                                        </span>
                                                        {p.transaction_reference && (
                                                            <div className="text-xs text-gray-400 mt-0.5 font-mono">
                                                                Ref: {p.transaction_reference}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-gray-700">{p.payment_date}</td>
                                                    <td className="px-6 py-4 font-bold text-emerald-600">
                                                        ${parseFloat(p.amount).toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleViewReceipt(p.id)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" /> View Receipt
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================================= */}
                {/* TAB 3: ANNUAL TAX RECEIPTS (CRA) */}
                {/* ========================================================================= */}
                {activeTab === 'tax_receipts' && (
                    <div className="space-y-4">
                        {/* Year Filter */}
                        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span>Select Tax Year:</span>
                                <select
                                    value={taxYearFilter}
                                    onChange={(e) => {
                                        const year = parseInt(e.target.value);
                                        setTaxYearFilter(year);
                                        loadTaxReceipts(year);
                                    }}
                                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white font-semibold focus:ring-2 focus:ring-indigo-500"
                                >
                                    {[2026, 2025, 2024, 2023].map((y) => (
                                        <option key={y} value={y}>
                                            Calendar Year {y}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <span className="text-xs text-indigo-600 font-medium">
                                Canadian Income Tax Act (Section 63)
                            </span>
                        </div>

                        {taxReceipts.length === 0 ? (
                            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
                                <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                <p className="font-semibold text-gray-700">No tax receipts for year {taxYearFilter}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Annual childcare expense tax slips are issued by daycare administration at the end of each tax year.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-gray-600">
                                        <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-700 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-4">Receipt Number</th>
                                                <th className="px-6 py-4">Child / Student</th>
                                                <th className="px-6 py-4">Total Eligible Fees</th>
                                                <th className="px-6 py-4">Subsidies Deducted</th>
                                                <th className="px-6 py-4">Net Claimable Amount</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4 text-right">Official Slip</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 font-medium">
                                            {taxReceipts.map((r) => (
                                                <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                                                    <td className="px-6 py-4 font-mono text-xs font-bold text-gray-900">
                                                        {r.receipt_number}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-900">{r.student_name || 'Enrolled Child'}</td>
                                                    <td className="px-6 py-4 font-semibold text-gray-900">
                                                        ${parseFloat(r.total_eligible_fees_paid).toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-indigo-600 font-medium">
                                                        -${parseFloat(r.total_subsidies_deducted).toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-emerald-600">
                                                        ${parseFloat(r.net_claimable_amount).toFixed(2)} {r.currency || 'CAD'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <Check className="w-3 h-3" /> Issued
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleViewTaxSlip(r.id)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" /> View Tax Slip
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================================= */}
                {/* TAB 4: STATEMENT OF ACCOUNT */}
                {/* ========================================================================= */}
                {activeTab === 'statement' && (
                    <div className="space-y-4">
                        {/* Date Filter & Print */}
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="flex flex-wrap items-center gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-0.5">Start Date</label>
                                    <input
                                        type="date"
                                        value={statementStartDate}
                                        onChange={(e) => setStatementStartDate(e.target.value)}
                                        className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-0.5">End Date</label>
                                    <input
                                        type="date"
                                        value={statementEndDate}
                                        onChange={(e) => setStatementEndDate(e.target.value)}
                                        className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5"
                                    />
                                </div>
                                <div className="pt-4">
                                    <button
                                        onClick={handleFilterStatement}
                                        disabled={loadingStatement}
                                        className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                                    >
                                        Filter
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => window.print()}
                                disabled={!statementData}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                            >
                                <Printer className="w-4 h-4" /> Print Account Statement
                            </button>
                        </div>

                        {/* Statement Summary Cards */}
                        {statementData && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                    <p className="text-xs font-semibold text-gray-500 uppercase">Total Invoiced</p>
                                    <p className="text-xl font-bold text-gray-900 mt-1">${statementData.total_invoiced}</p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                    <p className="text-xs font-semibold text-gray-500 uppercase">Total Paid</p>
                                    <p className="text-xl font-bold text-emerald-600 mt-1">${statementData.total_paid}</p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                    <p className="text-xs font-semibold text-gray-500 uppercase">Credits Applied</p>
                                    <p className="text-xl font-bold text-indigo-600 mt-1">${statementData.total_credits}</p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                    <p className="text-xs font-semibold text-gray-500 uppercase">Closing Balance</p>
                                    <p className="text-xl font-bold text-rose-600 mt-1">${statementData.closing_balance}</p>
                                </div>
                            </div>
                        )}

                        {/* Ledger */}
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                            {!statementData || statementData.entries.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 text-sm">
                                    No transaction entries found for this family.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-gray-600">
                                        <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-700 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-3">Date</th>
                                                <th className="px-6 py-3">Type</th>
                                                <th className="px-6 py-3">Reference</th>
                                                <th className="px-6 py-3">Description</th>
                                                <th className="px-6 py-3 text-right">Debit</th>
                                                <th className="px-6 py-3 text-right">Credit</th>
                                                <th className="px-6 py-3 text-right">Running Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 font-medium">
                                            {statementData.entries.map((e, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                                                    <td className="px-6 py-3 text-xs text-gray-700">{e.date}</td>
                                                    <td className="px-6 py-3 font-semibold text-xs text-gray-900">{e.type}</td>
                                                    <td className="px-6 py-3 font-mono text-xs text-gray-700">{e.reference}</td>
                                                    <td className="px-6 py-3 text-gray-800 text-xs">{e.description}</td>
                                                    <td className="px-6 py-3 text-right text-xs font-semibold text-gray-900">
                                                        {parseFloat(e.debit) > 0 ? `$${e.debit}` : '—'}
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-xs font-semibold text-emerald-600">
                                                        {parseFloat(e.credit) > 0 ? `-$${e.credit}` : '—'}
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-xs font-bold text-gray-900">
                                                        ${e.running_balance}
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

                {/* ========================================================================= */}
                {/* MODAL: PAYMENT RECEIPT PRINT */}
                {/* ========================================================================= */}
                {receiptModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                                <span className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                    <Receipt className="w-4 h-4 text-indigo-600" /> Payment Receipt
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => window.print()}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                                    >
                                        <Printer className="w-3.5 h-3.5" /> Print
                                    </button>
                                    <button onClick={() => setReceiptModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto space-y-4 text-xs">
                                {loadingReceipt || !receiptData ? (
                                    <div className="py-12 text-center text-gray-500">Loading receipt...</div>
                                ) : (
                                    <div className="border border-gray-200 rounded-xl p-5 space-y-4">
                                        <div className="flex justify-between border-b pb-3">
                                            <div>
                                                <h3 className="font-bold text-sm text-gray-900">{receiptData.daycare.name}</h3>
                                                <p className="text-gray-500">{receiptData.daycare.address}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono font-bold text-indigo-600">{receiptData.receipt_number}</p>
                                                <p className="text-gray-500">{receiptData.payment_date}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg">
                                            <div>
                                                <p className="text-gray-400 font-semibold text-[10px]">PAYER</p>
                                                <p className="font-bold text-gray-900">{receiptData.payer_name}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400 font-semibold text-[10px]">STUDENT</p>
                                                <p className="font-bold text-gray-900">{receiptData.student_name}</p>
                                            </div>
                                        </div>
                                        <div className="border-t border-b py-3 flex justify-between font-bold text-sm text-gray-900">
                                            <span>Amount Paid ({receiptData.currency}):</span>
                                            <span className="text-emerald-600">${receiptData.amount}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 text-center">
                                            Thank you for your payment. This is an official payment confirmation.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* MODAL: CRA TAX SLIP PRINT */}
                {/* ========================================================================= */}
                {taxSlipModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                                <span className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-indigo-600" /> Child Care Expense Tax Receipt (CRA Section 63)
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => window.print()}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                                    >
                                        <Printer className="w-3.5 h-3.5" /> Print Tax Slip
                                    </button>
                                    <button onClick={() => setTaxSlipModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto space-y-4 text-xs">
                                {loadingTaxSlip || !taxSlipData ? (
                                    <div className="py-12 text-center text-gray-500">Loading tax slip...</div>
                                ) : (
                                    <div className="border border-gray-300 rounded-xl p-5 space-y-4">
                                        <div className="flex justify-between border-b pb-3">
                                            <div>
                                                <h3 className="font-bold text-base text-gray-900">{taxSlipData.daycare.legal_name}</h3>
                                                <p className="text-gray-500">{taxSlipData.daycare.address}</p>
                                                {taxSlipData.daycare.business_number && (
                                                    <p className="font-mono text-gray-700 mt-1">BN: {taxSlipData.daycare.business_number}</p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono font-bold text-indigo-600 text-sm">{taxSlipData.receipt_number}</p>
                                                <p className="font-bold text-gray-900">Tax Year: {taxSlipData.tax_year}</p>
                                                <p className="text-gray-500">Issued: {taxSlipData.issued_date}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg">
                                            <div>
                                                <p className="text-gray-400 font-semibold text-[10px]">PAYER</p>
                                                <p className="font-bold text-gray-900">{taxSlipData.payer.name}</p>
                                                <p className="text-gray-500">{taxSlipData.payer.family_name}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400 font-semibold text-[10px]">CHILD / BENEFICIARY</p>
                                                <p className="font-bold text-gray-900">{taxSlipData.student_name}</p>
                                                <p className="text-gray-500">{taxSlipData.service_period_start} to {taxSlipData.service_period_end}</p>
                                            </div>
                                        </div>
                                        <div className="border rounded-lg overflow-hidden">
                                            <div className="flex justify-between p-2.5 bg-gray-50">
                                                <span>Total Gross Fees Paid in {taxSlipData.tax_year}:</span>
                                                <span className="font-bold">${taxSlipData.financials.total_eligible_fees_paid}</span>
                                            </div>
                                            <div className="flex justify-between p-2.5 border-t text-indigo-700">
                                                <span>Less: Government Subsidies / Grants:</span>
                                                <span className="font-bold">-${taxSlipData.financials.total_subsidies_deducted}</span>
                                            </div>
                                            <div className="flex justify-between p-3 border-t bg-emerald-50 text-emerald-900 font-black text-sm">
                                                <span>Net Claimable Amount:</span>
                                                <span>${taxSlipData.financials.net_claimable_amount} {taxSlipData.financials.currency}</span>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-gray-400 text-center">
                                            Issued under Section 63 of the Income Tax Act (Canada). Retain with tax records.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default FamilyBilling;
