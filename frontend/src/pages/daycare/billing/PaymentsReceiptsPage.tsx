import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../../../components/Layout';
import {
    CreditCard,
    DollarSign,
    RefreshCw,
    Search,
    Filter,
    PlusCircle,
    Receipt,
    RotateCcw,
    Printer,
    Download,
    CheckCircle2,
    AlertCircle,
    Building2,
    Calendar,
    FileText,
    Eye,
    X,
    ArrowUpRight,
    ArrowDownRight,
    ShieldCheck,
    Clock,
    UserCheck
} from 'lucide-react';
import {
    billingService,
    type Payment,
    type PaymentSummary,
    type PaymentReceiptData,
    type Invoice
} from '../../../api/billingService';

export const PaymentsReceiptsPage: React.FC = () => {
    const location = useLocation();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [summary, setSummary] = useState<PaymentSummary | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successNotice, setSuccessNotice] = useState<string | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [methodFilter, setMethodFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Modal States
    const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
    const [isRefundModalOpen, setIsRefundModalOpen] = useState<boolean>(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [receiptData, setReceiptData] = useState<PaymentReceiptData | null>(null);
    const [loadingReceipt, setLoadingReceipt] = useState<boolean>(false);

    // Record Payment Form
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('ETRANSFER');
    const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [transactionRef, setTransactionRef] = useState<string>('');
    const [payerName, setPayerName] = useState<string>('');
    const [payerEmail, setPayerEmail] = useState<string>('');
    const [paymentNotes, setPaymentNotes] = useState<string>('');
    const [submittingPayment, setSubmittingPayment] = useState<boolean>(false);

    // Refund Form
    const [refundAmount, setRefundAmount] = useState<string>('');
    const [refundReason, setRefundReason] = useState<string>('');
    const [submittingRefund, setSubmittingRefund] = useState<boolean>(false);

    const fetchData = async () => {
        try {
            setRefreshing(true);
            const [paymentsRes, summaryRes, invoicesRes] = await Promise.all([
                billingService.getPayments(),
                billingService.getPaymentSummary(),
                billingService.getInvoices()
            ]);
            setPayments(paymentsRes);
            setSummary(summaryRes);
            // Filter invoices that can be paid (ISSUED, PARTIALLY_PAID, OVERDUE)
            setInvoices(invoicesRes.filter(inv => ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(inv.status)));
        } catch (err: any) {
            console.error('Failed to fetch payment data:', err);
            setError('Failed to load payment transactions. Please refresh.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        const searchParams = new URLSearchParams(location.search);
        const invId = searchParams.get('invoice_id');
        if (invId) {
            setSelectedInvoiceId(invId);
            setIsRecordModalOpen(true);
        }
    }, [location.search]);

    // Filtered Payments
    const filteredPayments = useMemo(() => {
        return payments.filter(p => {
            const matchesSearch =
                (p.receipt_number && p.receipt_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (p.invoice_number && p.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (p.payer_name && p.payer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (p.student_name && p.student_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (p.transaction_reference && p.transaction_reference.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesMethod = methodFilter === 'ALL' || p.payment_method === methodFilter;
            const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

            let matchesDate = true;
            if (startDate) matchesDate = matchesDate && p.payment_date >= startDate;
            if (endDate) matchesDate = matchesDate && p.payment_date <= endDate;

            return matchesSearch && matchesMethod && matchesStatus && matchesDate;
        });
    }, [payments, searchQuery, methodFilter, statusFilter, startDate, endDate]);

    // Handle Selected Invoice Change in Modal
    const handleInvoiceChange = (invId: string) => {
        setSelectedInvoiceId(invId);
        const inv = invoices.find(i => i.id === invId);
        if (inv) {
            setPaymentAmount(inv.balance_due || inv.total || '');
            setPayerName(inv.family_name || inv.student_name || '');
        }
    };

    // Record Payment Submit
    const handleRecordPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedInvoiceId || !paymentAmount) {
            alert('Please select an invoice and enter an amount.');
            return;
        }

        try {
            setSubmittingPayment(true);
            const res = await billingService.recordPayment({
                invoice_id: selectedInvoiceId,
                amount: paymentAmount,
                payment_method: paymentMethod,
                payment_date: paymentDate,
                transaction_reference: transactionRef,
                payer_name: payerName,
                payer_email: payerEmail,
                notes: paymentNotes
            });

            setSuccessNotice(`Payment recorded successfully! Receipt: ${res.receipt_number}`);
            setIsRecordModalOpen(false);
            resetRecordForm();
            fetchData();
            setTimeout(() => setSuccessNotice(null), 5000);
        } catch (err: any) {
            console.error('Payment record failed:', err);
            alert(err.response?.data?.error || err.response?.data?.detail || 'Failed to record payment.');
        } finally {
            setSubmittingPayment(false);
        }
    };

    const resetRecordForm = () => {
        setSelectedInvoiceId('');
        setPaymentAmount('');
        setPaymentMethod('ETRANSFER');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setTransactionRef('');
        setPayerName('');
        setPayerEmail('');
        setPaymentNotes('');
    };

    // Open Refund Modal
    const handleOpenRefund = (payment: Payment) => {
        setSelectedPayment(payment);
        const maxRefund = Number(payment.amount) - Number(payment.refunded_amount || 0);
        setRefundAmount(maxRefund.toFixed(2));
        setRefundReason('');
        setIsRefundModalOpen(true);
    };

    // Refund Submit
    const handleProcessRefund = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPayment || !refundAmount) return;

        try {
            setSubmittingRefund(true);
            await billingService.refundPayment(selectedPayment.id, refundAmount, refundReason);
            setSuccessNotice(`Refund of $${refundAmount} processed successfully.`);
            setIsRefundModalOpen(false);
            fetchData();
            setTimeout(() => setSuccessNotice(null), 5000);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to process refund.');
        } finally {
            setSubmittingRefund(false);
        }
    };

    // View & Print Receipt
    const handleViewReceipt = async (payment: Payment) => {
        setSelectedPayment(payment);
        setLoadingReceipt(true);
        setIsReceiptModalOpen(true);
        try {
            const data = await billingService.getPaymentReceipt(payment.id);
            setReceiptData(data);
        } catch (err: any) {
            console.error('Failed to load receipt:', err);
            alert('Failed to load receipt details.');
        } finally {
            setLoadingReceipt(false);
        }
    };

    const handlePrintReceipt = () => {
        window.print();
    };

    const currency = summary?.currency || 'CAD';

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-300">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Payments & Official Receipts
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Record guardian payments, manage payment methods, process refunds, and issue printable official tax receipts.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={fetchData}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 shadow-xs transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
                            <span>Refresh</span>
                        </button>

                        <button
                            onClick={() => setIsRecordModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                        >
                            <PlusCircle className="w-4 h-4" />
                            <span>Record Payment</span>
                        </button>
                    </div>
                </div>

                {/* Notifications */}
                {successNotice && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{successNotice}</span>
                    </div>
                )}
                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* KPI Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider block">Total Collected</span>
                            <span className="text-2xl font-black text-slate-900 mt-1 block">
                                ${summary?.total_collected || '0.00'} <span className="text-xs font-bold text-slate-400">{currency}</span>
                            </span>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                            <DollarSign className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider block">Total Refunded</span>
                            <span className="text-2xl font-black text-rose-600 mt-1 block">
                                ${summary?.total_refunded || '0.00'} <span className="text-xs font-bold text-slate-400">{currency}</span>
                            </span>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                            <RotateCcw className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider block">Net Revenue</span>
                            <span className="text-2xl font-black text-indigo-600 mt-1 block">
                                ${summary?.net_collected || '0.00'} <span className="text-xs font-bold text-slate-400">{currency}</span>
                            </span>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider block">Transactions</span>
                            <span className="text-2xl font-black text-slate-900 mt-1 block">
                                {summary?.total_payments_count || 0}
                            </span>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                            <Receipt className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search receipt #, invoice #, payer, student, reference..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={methodFilter}
                            onChange={(e) => setMethodFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="ALL">All Methods</option>
                            <option value="ETRANSFER">Interac e-Transfer</option>
                            <option value="CREDIT_CARD">Credit Card</option>
                            <option value="DEBIT_CARD">Debit / POS</option>
                            <option value="CASH">Cash</option>
                            <option value="CHEQUE">Cheque</option>
                            <option value="BANK_TRANSFER">Bank Transfer / EFT</option>
                            <option value="SUBSIDY_DIRECT">Subsidy Remittance</option>
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
                            <option value="REFUNDED">Fully Refunded</option>
                        </select>

                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                            placeholder="From date"
                        />

                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                            placeholder="To date"
                        />
                    </div>
                </div>

                {/* Payments Table */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Receipt # / Date</th>
                                    <th className="py-3.5 px-4">Invoice #</th>
                                    <th className="py-3.5 px-4">Payer / Student</th>
                                    <th className="py-3.5 px-4">Method & Ref</th>
                                    <th className="py-3.5 px-4 text-right">Amount</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                                            Loading payments...
                                        </td>
                                    </tr>
                                ) : filteredPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                                            No payment records found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPayments.map(p => {
                                        const isRefunded = p.status === 'REFUNDED';
                                        const isPartialRefund = p.status === 'PARTIALLY_REFUNDED';

                                        return (
                                            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3.5 px-4">
                                                    <div className="font-extrabold text-indigo-900">{p.receipt_number || 'N/A'}</div>
                                                    <div className="text-[11px] text-slate-400 mt-0.5">{p.payment_date}</div>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="font-bold text-slate-800">{p.invoice_number}</div>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="font-bold text-slate-900">{p.payer_name || p.family_name || 'Guardian'}</div>
                                                    {p.student_name && (
                                                        <div className="text-[11px] text-indigo-600 font-semibold">{p.student_name}</div>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="font-semibold text-slate-800">{p.payment_method_display || p.payment_method}</div>
                                                    {p.transaction_reference && (
                                                        <div className="text-[10px] text-slate-400 font-mono">Ref: {p.transaction_reference}</div>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4 text-right">
                                                    <div className="font-extrabold text-slate-900 text-sm">
                                                        ${p.amount} {p.currency}
                                                    </div>
                                                    {Number(p.refunded_amount || 0) > 0 && (
                                                        <div className="text-[11px] text-rose-500 font-bold">
                                                            -${p.refunded_amount} ref.
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                                        isRefunded ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                        isPartialRefund ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                        'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    }`}>
                                                        {p.status_display || p.status}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 text-right space-x-1">
                                                    <button
                                                        onClick={() => handleViewReceipt(p)}
                                                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                                                        title="Print Official Receipt"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                        <span>Receipt</span>
                                                    </button>
                                                    {!isRefunded && (
                                                        <button
                                                            onClick={() => handleOpenRefund(p)}
                                                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                                                            title="Process Refund"
                                                        >
                                                            <RotateCcw className="w-3.5 h-3.5" />
                                                            <span>Refund</span>
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* RECORD PAYMENT MODAL */}
            {isRecordModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Record Offline Payment</h3>
                                <p className="text-xs text-slate-500">Record payment received via e-Transfer, Cash, POS, or Cheque.</p>
                            </div>
                            <button
                                onClick={() => setIsRecordModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Select Invoice to Apply Payment *</label>
                                <select
                                    value={selectedInvoiceId}
                                    onChange={(e) => handleInvoiceChange(e.target.value)}
                                    required
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">-- Choose Outstanding Invoice --</option>
                                    {invoices.map(inv => (
                                        <option key={inv.id} value={inv.id}>
                                            #{inv.invoice_number} - {inv.family_name || inv.student_name || 'Family'} - Balance: ${inv.balance_due} {inv.currency} ({inv.status})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Payment Amount ($) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Payment Date *</label>
                                    <input
                                        type="date"
                                        value={paymentDate}
                                        onChange={(e) => setPaymentDate(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Payment Method *</label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="ETRANSFER">Interac e-Transfer</option>
                                    <option value="CREDIT_CARD">Credit Card</option>
                                    <option value="DEBIT_CARD">Debit / POS</option>
                                    <option value="CASH">Cash</option>
                                    <option value="CHEQUE">Cheque</option>
                                    <option value="BANK_TRANSFER">Direct Bank Transfer / ACH / EFT</option>
                                    <option value="SUBSIDY_DIRECT">Direct Government Subsidy Remittance</option>
                                    <option value="OTHER">Other / Manual Adjustment</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Payer Name</label>
                                    <input
                                        type="text"
                                        value={payerName}
                                        onChange={(e) => setPayerName(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                                        placeholder="Jane Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Transaction Ref / Cheque #</label>
                                    <input
                                        type="text"
                                        value={transactionRef}
                                        onChange={(e) => setTransactionRef(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                                        placeholder="e.g. REF-10928"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Internal Notes</label>
                                <textarea
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    rows={2}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                                    placeholder="Optional notes or memos..."
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsRecordModalOpen(false)}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingPayment}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
                                >
                                    {submittingPayment && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    <span>Confirm Payment</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* REFUND MODAL */}
            {isRefundModalOpen && selectedPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Process Refund</h3>
                                <p className="text-xs text-slate-500">Receipt #{selectedPayment.receipt_number}</p>
                            </div>
                            <button onClick={() => setIsRefundModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleProcessRefund} className="space-y-4 text-xs">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">Original Payment:</span>
                                    <span className="font-bold text-slate-900">${selectedPayment.amount}</span>
                                </div>
                                <div className="flex justify-between mt-1">
                                    <span className="text-slate-500 font-medium">Already Refunded:</span>
                                    <span className="font-bold text-rose-600">${selectedPayment.refunded_amount || '0.00'}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Refund Amount ($) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={refundAmount}
                                    onChange={(e) => setRefundAmount(e.target.value)}
                                    required
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Reason for Refund *</label>
                                <textarea
                                    value={refundReason}
                                    onChange={(e) => setRefundReason(e.target.value)}
                                    required
                                    rows={2}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                                    placeholder="Enter administrative reason for audit record..."
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsRefundModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingRefund}
                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                                >
                                    {submittingRefund && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    <span>Process Refund</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* PRINTABLE OFFICIAL PAYMENT RECEIPT MODAL */}
            {isReceiptModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto print:p-0 print:border-none print:shadow-none">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4 print:hidden">
                            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Official Payment Receipt</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrintReceipt}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span>Print Receipt</span>
                                </button>
                                <button
                                    onClick={() => setIsReceiptModalOpen(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {loadingReceipt || !receiptData ? (
                            <div className="py-16 text-center text-slate-400 font-medium">Loading receipt document...</div>
                        ) : (
                            <div className="space-y-6 text-slate-800 text-xs">
                                {/* Header */}
                                <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{receiptData.daycare.name}</h2>
                                        <p className="text-slate-500 mt-1">{receiptData.daycare.address}</p>
                                        {receiptData.daycare.license_number && (
                                            <p className="text-slate-400 text-[11px]">License / BN: {receiptData.daycare.license_number}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="inline-block px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold text-[11px] rounded-full uppercase tracking-wider mb-1">
                                            {receiptData.status}
                                        </span>
                                        <div className="font-mono font-extrabold text-sm text-indigo-900">{receiptData.receipt_number}</div>
                                        <div className="text-slate-500 text-[11px]">Date: {receiptData.payment_date}</div>
                                    </div>
                                </div>

                                {/* Bill To & Payment Info */}
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                                    <div>
                                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Received From:</span>
                                        <span className="font-extrabold text-slate-900 text-sm block mt-0.5">{receiptData.payer_name}</span>
                                        {receiptData.payer_email && <span className="text-slate-500 block">{receiptData.payer_email}</span>}
                                        <span className="text-indigo-600 font-bold block mt-1">Student: {receiptData.student_name}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Payment Details:</span>
                                        <div className="mt-1 space-y-0.5">
                                            <div>Method: <strong className="text-slate-900">{receiptData.payment_method}</strong></div>
                                            <div>Invoice #: <strong className="text-slate-900">{receiptData.invoice.invoice_number}</strong></div>
                                            <div>Reference: <strong className="text-slate-900 font-mono">{receiptData.transaction_reference}</strong></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Itemized Amount Breakdown */}
                                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-100 text-slate-600 font-bold text-[11px] uppercase">
                                            <tr>
                                                <th className="py-2.5 px-4">Description</th>
                                                <th className="py-2.5 px-4 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            <tr>
                                                <td className="py-3 px-4 font-medium">Payment towards Invoice #{receiptData.invoice.invoice_number}</td>
                                                <td className="py-3 px-4 text-right font-bold text-slate-900">${receiptData.amount} {receiptData.currency}</td>
                                            </tr>
                                            {Number(receiptData.refunded_amount || 0) > 0 && (
                                                <tr className="bg-rose-50/50">
                                                    <td className="py-2.5 px-4 text-rose-700 font-bold">Less Refunded Amount</td>
                                                    <td className="py-2.5 px-4 text-right font-bold text-rose-700">-${receiptData.refunded_amount} {receiptData.currency}</td>
                                                </tr>
                                            )}
                                            <tr className="bg-slate-50 font-extrabold text-sm text-slate-900">
                                                <td className="py-3 px-4">Net Payment Received</td>
                                                <td className="py-3 px-4 text-right text-indigo-700">${receiptData.net_amount} {receiptData.currency}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Footer & Signoff */}
                                <div className="text-center pt-4 border-t border-slate-200 text-slate-400 text-[11px] space-y-1">
                                    <p>Thank you for your payment! Please retain this receipt for your records.</p>
                                    <p className="text-[10px]">Generated electronically by KidSynq Daycare Management System.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default PaymentsReceiptsPage;
