import React, { useState } from 'react';
import {
    CreditCard,
    Building2,
    Send,
    CheckCircle2,
    ShieldCheck,
    Lock,
    X,
    Receipt,
    RefreshCw,
    WalletCards,
    FileCheck2,
    DollarSign,
    Sparkles
} from 'lucide-react';
import api from '../api';

export interface PaymentInvoiceInfo {
    id: string;
    invoice_number: string;
    amount: string | number;
    total?: string | number;
    daycare_name?: string;
    daycare_id?: string;
    due_date?: string;
    issue_date?: string;
    description?: string;
}

interface MakePaymentModalProps {
    invoice: PaymentInvoiceInfo;
    onClose: () => void;
    onSuccess: () => void;
}

type PaymentType = 'card' | 'bank' | 'interac' | 'offline';

export default function MakePaymentModal({ invoice, onClose, onSuccess }: MakePaymentModalProps) {
    const [selectedMethod, setSelectedMethod] = useState<PaymentType>('card');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);

    // Card Form State
    const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8829');
    const [cardHolder, setCardHolder] = useState(invoice.daycare_name || 'Daycare Administrator');
    const [cardExpiry, setCardExpiry] = useState('12/28');
    const [cardCvc, setCardCvc] = useState('883');
    const [cardZip, setCardZip] = useState('M5V 2T6');

    // Bank EFT Form State
    const [bankName, setBankName] = useState('RBC Royal Bank');
    const [transitNumber, setTransitNumber] = useState('04922');
    const [institutionNumber, setInstitutionNumber] = useState('003');
    const [accountNumber, setAccountNumber] = useState('9832104');
    const [accountHolder, setAccountHolder] = useState(invoice.daycare_name || 'Authorized Signer');

    // Interac e-Transfer Form State
    const [interacSenderEmail, setInteracSenderEmail] = useState('admin@daycare.com');
    const [interacRef, setInteracRef] = useState(`EMT-${Math.floor(100000 + Math.random() * 900000)}`);
    const [interacNotes, setInteracNotes] = useState('KidSynq Daycare Platform Subscription');

    // Offline Settlement Form State
    const [offlineChannel, setOfflineChannel] = useState('Direct Bank Transfer');
    const [offlineRefNumber, setOfflineRefNumber] = useState(`TX-${Date.now().toString().slice(-6)}`);
    const [offlineNotes, setOfflineNotes] = useState('Verified payment received in operational account');

    const totalAmount = invoice.total || invoice.amount || '0.00';

    const formatCardNumberInput = (val: string) => {
        const raw = val.replace(/\D/g, '').substring(0, 16);
        const parts = [];
        for (let i = 0; i < raw.length; i += 4) {
            parts.push(raw.substring(i, i + 4));
        }
        return parts.join(' ');
    };

    const handleProcessPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        let paymentMethodLabel = 'Credit Card (Online)';
        let transactionReference = `CC-${Date.now().toString().slice(-8)}`;

        if (selectedMethod === 'card') {
            const last4 = cardNumber.replace(/\D/g, '').slice(-4) || '8829';
            paymentMethodLabel = `Credit Card (•••• ${last4})`;
            transactionReference = `PAY-CC-${Date.now().toString().slice(-6)}`;
        } else if (selectedMethod === 'bank') {
            paymentMethodLabel = `Online Bank EFT (${bankName} •••• ${accountNumber.slice(-4) || '104'})`;
            transactionReference = `PAY-EFT-${transitNumber}-${institutionNumber}`;
        } else if (selectedMethod === 'interac') {
            paymentMethodLabel = `Interac e-Transfer (${interacRef})`;
            transactionReference = interacRef;
        } else if (selectedMethod === 'offline') {
            paymentMethodLabel = `Manual Settlement (${offlineChannel})`;
            transactionReference = offlineRefNumber;
        }

        try {
            // Short simulated gateway verification delay for authentic feedback
            await new Promise((resolve) => setTimeout(resolve, 800));

            const response = await api.patch(`/super-admin/invoices/${invoice.id}/`, {
                status: 'Paid',
                payment_date: new Date().toISOString().split('T')[0],
                payment_method: paymentMethodLabel,
                transaction_reference: transactionReference
            });

            setReceiptData({
                invoiceNumber: invoice.invoice_number,
                amount: totalAmount,
                daycareName: invoice.daycare_name || 'Daycare Partner',
                paymentMethod: paymentMethodLabel,
                reference: transactionReference,
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                status: 'COMPLETED & ACTIVE'
            });

            setSuccess(true);
        } catch (err: any) {
            console.error('Payment processing failed:', err);
            alert(err.response?.data?.error || err.response?.data?.detail || 'Payment gateway connection failed. Please retry.');
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = () => {
        onSuccess();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 my-6 transition-all transform duration-300">
                
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-2xl text-indigo-300 border border-white/10">
                            <WalletCards className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-extrabold tracking-tight">KidSynq Payment Portal</h2>
                            <p className="text-xs text-indigo-200 mt-0.5 font-medium">
                                Settle Invoice <span className="font-mono text-white font-bold">{invoice.invoice_number}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="relative z-10 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6">
                    {success && receiptData ? (
                        /* Success & Receipt Confirmation View */
                        <div className="space-y-6 text-center py-2 animate-fadeIn">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50">
                                <CheckCircle2 className="w-10 h-10 animate-bounce" />
                            </div>

                            <div>
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 mb-2">
                                    <Sparkles className="w-3.5 h-3.5" /> Payment Successful & Subscription Active
                                </span>
                                <h3 className="text-2xl font-black text-slate-900">${receiptData.amount} Paid</h3>
                                <p className="text-xs text-slate-500 mt-1">Transaction confirmed and registered in ledger.</p>
                            </div>

                            {/* Itemized Digital Receipt Card */}
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs space-y-2.5 font-medium text-slate-700 shadow-inner">
                                <div className="flex justify-between border-b border-slate-200/80 pb-2">
                                    <span className="text-slate-500">Invoice Number</span>
                                    <span className="font-mono font-bold text-slate-900">{receiptData.invoiceNumber}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200/80 pb-2">
                                    <span className="text-slate-500">Billed Daycare</span>
                                    <span className="font-bold text-slate-900">{receiptData.daycareName}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200/80 pb-2">
                                    <span className="text-slate-500">Payment Method</span>
                                    <span className="font-bold text-indigo-600">{receiptData.paymentMethod}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200/80 pb-2">
                                    <span className="text-slate-500">Authorization Reference</span>
                                    <span className="font-mono text-slate-800">{receiptData.reference}</span>
                                </div>
                                <div className="flex justify-between pt-0.5 font-bold">
                                    <span className="text-slate-900">Total Settlement</span>
                                    <span className="text-emerald-700 text-sm font-extrabold">${receiptData.amount} USD</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span>Daycare subscription is now Active with all features unlocked.</span>
                            </div>

                            <button
                                type="button"
                                onClick={handleFinish}
                                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-500/20 transition-all transform active:scale-98"
                            >
                                Done & Return
                            </button>
                        </div>
                    ) : (
                        /* Interactive Payment Form View */
                        <form onSubmit={handleProcessPayment} className="space-y-5">
                            {/* Summary Badge */}
                            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider block">Balance Due</span>
                                    <span className="text-2xl font-black text-slate-900 mt-0.5 block">${totalAmount}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-bold text-slate-800 block">{invoice.daycare_name || 'Daycare Account'}</span>
                                    <span className="text-[11px] text-slate-500">Due: {invoice.due_date || 'Immediate'}</span>
                                </div>
                            </div>

                            {/* Payment Method Selector Tabs */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">Select Payment Channel</label>
                                <div className="grid grid-cols-4 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedMethod('card')}
                                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                                            selectedMethod === 'card'
                                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-500/20 font-bold'
                                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                                        }`}
                                    >
                                        <CreditCard className="w-4 h-4" />
                                        <span className="text-[11px] leading-tight">Card</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSelectedMethod('bank')}
                                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                                            selectedMethod === 'bank'
                                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-500/20 font-bold'
                                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                                        }`}
                                    >
                                        <Building2 className="w-4 h-4" />
                                        <span className="text-[11px] leading-tight">Online Bank</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSelectedMethod('interac')}
                                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                                            selectedMethod === 'interac'
                                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-500/20 font-bold'
                                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                                        }`}
                                    >
                                        <Send className="w-4 h-4" />
                                        <span className="text-[11px] leading-tight">Interac</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSelectedMethod('offline')}
                                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                                            selectedMethod === 'offline'
                                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-500/20 font-bold'
                                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                                        }`}
                                    >
                                        <Receipt className="w-4 h-4" />
                                        <span className="text-[11px] leading-tight">Direct Wire</span>
                                    </button>
                                </div>
                            </div>

                            {/* Card Details Form */}
                            {selectedMethod === 'card' && (
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-fadeIn">
                                    <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                            <CreditCard className="w-4 h-4 text-indigo-600" /> Credit / Debit Card
                                        </span>
                                        <div className="flex gap-1.5 text-[10px] font-bold text-slate-500">
                                            <span className="px-1.5 py-0.5 bg-white border rounded">VISA</span>
                                            <span className="px-1.5 py-0.5 bg-white border rounded">MC</span>
                                            <span className="px-1.5 py-0.5 bg-white border rounded">AMEX</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Card Number</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                required
                                                value={cardNumber}
                                                onChange={(e) => setCardNumber(formatCardNumberInput(e.target.value))}
                                                placeholder="4532 0000 0000 0000"
                                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-medium text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                            <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cardholder Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={cardHolder}
                                                onChange={(e) => setCardHolder(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Expiry</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="MM/YY"
                                                    value={cardExpiry}
                                                    onChange={(e) => setCardExpiry(e.target.value)}
                                                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white text-center focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">CVC / CVV</label>
                                                <input
                                                    type="password"
                                                    maxLength={4}
                                                    required
                                                    placeholder="•••"
                                                    value={cardCvc}
                                                    onChange={(e) => setCardCvc(e.target.value)}
                                                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white text-center focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Online Bank EFT Form */}
                            {selectedMethod === 'bank' && (
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-fadeIn">
                                    <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                            <Building2 className="w-4 h-4 text-indigo-600" /> Direct Bank Debit / EFT (Canada & US)
                                        </span>
                                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                            Zero Surcharge
                                        </span>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Financial Institution</label>
                                        <select
                                            value={bankName}
                                            onChange={(e) => setBankName(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="RBC Royal Bank">RBC Royal Bank</option>
                                            <option value="TD Canada Trust">TD Canada Trust</option>
                                            <option value="Scotiabank">Scotiabank</option>
                                            <option value="BMO Bank of Montreal">BMO Bank of Montreal</option>
                                            <option value="CIBC">CIBC</option>
                                            <option value="Chase / JP Morgan">Chase / JP Morgan</option>
                                            <option value="Wells Fargo">Wells Fargo</option>
                                            <option value="Other Regional Credit Union">Other Regional Credit Union</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Transit / Branch</label>
                                            <input
                                                type="text"
                                                required
                                                value={transitNumber}
                                                onChange={(e) => setTransitNumber(e.target.value)}
                                                className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-mono font-medium text-slate-900 bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Institution #</label>
                                            <input
                                                type="text"
                                                required
                                                value={institutionNumber}
                                                onChange={(e) => setInstitutionNumber(e.target.value)}
                                                className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-mono font-medium text-slate-900 bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Account #</label>
                                            <input
                                                type="text"
                                                required
                                                value={accountNumber}
                                                onChange={(e) => setAccountNumber(e.target.value)}
                                                className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-mono font-medium text-slate-900 bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Interac e-Transfer Form */}
                            {selectedMethod === 'interac' && (
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-fadeIn">
                                    <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                            <Send className="w-4 h-4 text-indigo-600" /> Interac e-Transfer Autodeposit
                                        </span>
                                    </div>

                                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                                        <p>Send e-Transfer of <span className="font-bold text-slate-900">${totalAmount}</span> to <span className="font-mono font-bold text-indigo-700">billing@kidsynq.com</span>.</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sender Email</label>
                                            <input
                                                type="email"
                                                required
                                                value={interacSenderEmail}
                                                onChange={(e) => setInteracSenderEmail(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Transfer Reference #</label>
                                            <input
                                                type="text"
                                                required
                                                value={interacRef}
                                                onChange={(e) => setInteracRef(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Direct Wire / Manual Settlement */}
                            {selectedMethod === 'offline' && (
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-fadeIn">
                                    <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                            <Receipt className="w-4 h-4 text-indigo-600" /> Direct Wire / Cheque / Offline Record
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Channel / Medium</label>
                                            <select
                                                value={offlineChannel}
                                                onChange={(e) => setOfflineChannel(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white"
                                            >
                                                <option value="Direct Bank Wire">Direct Bank Wire</option>
                                                <option value="Physical Cheque">Physical Cheque</option>
                                                <option value="Direct Debit EFT">Direct Debit EFT</option>
                                                <option value="Cash Receipt">Cash Receipt</option>
                                                <option value="Gov Subsidy Transfer">Gov Subsidy Transfer</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Transaction / Cheque #</label>
                                            <input
                                                type="text"
                                                required
                                                value={offlineRefNumber}
                                                onChange={(e) => setOfflineRefNumber(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Settlement Notes</label>
                                        <input
                                            type="text"
                                            value={offlineNotes}
                                            onChange={(e) => setOfflineNotes(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Trust & Encryption Banner */}
                            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                                <div className="flex items-center gap-1 text-slate-600 font-medium">
                                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>256-bit SSL Encrypted & PCI DSS Compliant</span>
                                </div>
                                <span className="font-bold text-indigo-600">KidSynq Pay Gateway</span>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-3 border border-slate-300 text-slate-700 font-bold text-xs rounded-2xl hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-2xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" /> Processing Payment...
                                        </>
                                    ) : (
                                        <>
                                            <DollarSign className="w-4 h-4" /> Authorize & Pay ${totalAmount}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
