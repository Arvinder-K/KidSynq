import { useState, useEffect } from 'react';
import { FileText, Download, CheckCircle, Clock, AlertCircle, Eye, X } from 'lucide-react';
import api from '../api';
import html2pdf from 'html2pdf.js';

export default function InvoiceListTab() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        api.get('/super-admin/invoices/')
            .then(res => setInvoices(res.data.results || res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const getStatusIcon = (status: string) => {
        switch (status.toLowerCase()) {
            case 'paid': return <CheckCircle className="w-3 h-3 text-green-600" />;
            case 'unpaid': return <Clock className="w-3 h-3 text-yellow-600" />;
            case 'overdue': return <AlertCircle className="w-3 h-3 text-red-600" />;
            default: return null;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'paid': return 'bg-green-100 text-green-800';
            case 'unpaid': return 'bg-yellow-100 text-yellow-800';
            case 'overdue': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const handleDownload = (invoice: any) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `
            <div style="padding: 50px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 30px; margin-bottom: 40px;">
                    <div>
                        <h1 style="font-size: 36px; font-weight: 800; color: #4f46e5; margin: 0; letter-spacing: -1px;">KidSynq</h1>
                        <p style="color: #6b7280; font-size: 14px; margin-top: 5px;">Modern Daycare Management</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="font-size: 28px; font-weight: 300; color: #111827; margin: 0; text-transform: uppercase; letter-spacing: 2px;">Invoice</h2>
                        <p style="font-size: 16px; font-weight: 600; color: #4b5563; margin-top: 5px;">#${invoice.invoice_number}</p>
                    </div>
                </div>

                <!-- Addresses -->
                <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
                    <div style="flex: 1;">
                        <p style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin-bottom: 10px;">Billed To</p>
                        <p style="font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 5px 0;">${invoice.daycare_name || invoice.daycare}</p>
                        <p style="font-size: 14px; color: #6b7280; margin: 0; line-height: 1.5;">Subscription Services<br/>Daycare Account</p>
                    </div>
                    <div style="flex: 1; text-align: right;">
                        <p style="font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin-bottom: 10px;">From</p>
                        <p style="font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 5px 0;">KidSynq Inc.</p>
                        <p style="font-size: 14px; color: #6b7280; margin: 0; line-height: 1.5;">123 Software Ave, Suite 400<br/>San Francisco, CA 94107</p>
                    </div>
                </div>

                <!-- Invoice Details Bar -->
                <div style="background: #f8fafc; border-radius: 8px; padding: 20px; display: flex; justify-content: space-between; margin-bottom: 40px; border: 1px solid #e2e8f0;">
                    <div>
                        <p style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Issue Date</p>
                        <p style="font-size: 15px; font-weight: 600; color: #0f172a; margin: 0;">${invoice.issue_date}</p>
                    </div>
                    <div>
                        <p style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Due Date</p>
                        <p style="font-size: 15px; font-weight: 600; color: #0f172a; margin: 0;">${invoice.due_date}</p>
                    </div>
                    <div>
                        <p style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Status</p>
                        <p style="font-size: 15px; font-weight: 700; color: ${invoice.status.toLowerCase() === 'paid' ? '#10b981' : '#ef4444'}; margin: 0; text-transform: uppercase;">${invoice.status}</p>
                    </div>
                </div>

                <!-- Line Items -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="border-bottom: 2px solid #e2e8f0;">
                            <th style="text-align: left; padding: 12px 0; font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: 700;">Description</th>
                            <th style="text-align: right; padding: 12px 0; font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: 700;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 20px 0; font-size: 15px; color: #1e293b; font-weight: 500;">Platform Subscription Fee<br><span style="font-size: 13px; color: #64748b; font-weight: 400;">Billing Period: ${invoice.issue_date}</span></td>
                            <td style="padding: 20px 0; text-align: right; font-size: 16px; color: #1e293b; font-weight: 600;">$${invoice.total}</td>
                        </tr>
                    </tbody>
                </table>

                <!-- Totals -->
                <div style="display: flex; justify-content: flex-end; margin-bottom: 60px;">
                    <div style="width: 300px;">
                        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            <span style="color: #64748b; font-size: 14px;">Subtotal</span>
                            <span style="color: #1e293b; font-weight: 600; font-size: 14px;">$${invoice.total}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            <span style="color: #64748b; font-size: 14px;">Tax (0%)</span>
                            <span style="color: #1e293b; font-weight: 600; font-size: 14px;">$0.00</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 20px 0; border-bottom: 2px solid #1e293b;">
                            <span style="color: #0f172a; font-size: 18px; font-weight: 700;">Total Due</span>
                            <span style="color: #4f46e5; font-size: 24px; font-weight: 800;">$${invoice.total}</span>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="text-align: center; color: #94a3b8; font-size: 13px; border-top: 1px solid #e2e8f0; padding-top: 30px;">
                    <p style="margin: 0 0 5px 0;">Thank you for your business!</p>
                    <p style="margin: 0;">If you have any questions concerning this invoice, contact support@kidsynq.com</p>
                </div>
            </div>
        `;
        
        const opt = {
            margin:       15,
            filename:     `Invoice_${invoice.invoice_number}.pdf`,
            image:        { type: 'jpeg' as const, quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
        };
        html2pdf().from(tempDiv).set(opt).save();
    };

    return (
        <div className="p-8">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Invoices</h3>
                    <p className="text-sm text-gray-500 mt-1">Manage and track billing invoices across all daycares.</p>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading invoices...</div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Invoice #</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Daycare</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Issue Date</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {invoices.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-gray-50">
                                        <td className="p-4 text-sm font-mono font-medium text-gray-900 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-gray-400" />
                                            {invoice.invoice_number}
                                        </td>
                                        <td className="p-4 text-sm font-medium text-gray-900">{invoice.daycare_name || invoice.daycare}</td>
                                        <td className="p-4 text-sm text-gray-600">{invoice.issue_date}</td>
                                        <td className="p-4 text-sm text-gray-600">{invoice.due_date}</td>
                                        <td className="p-4 text-sm font-medium text-gray-900">${invoice.total}</td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(invoice.status)}`}>
                                                {getStatusIcon(invoice.status)}
                                                {invoice.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => { setSelectedInvoice(invoice); setIsModalOpen(true); }} className="text-gray-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded transition-colors" title="View Details">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDownload(invoice)} className="text-gray-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded transition-colors" title="Download PDF">
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {invoices.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-500">No invoices found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isModalOpen && selectedInvoice && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                        <div className="flex justify-between items-center mb-4 border-b pb-4">
                            <h3 className="text-lg font-bold">Invoice Details</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-100">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Invoice Number</p>
                                    <p className="font-mono text-gray-900 font-medium flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-gray-400" />
                                        {selectedInvoice.invoice_number}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold capitalize ${getStatusColor(selectedInvoice.status)}`}>
                                        {getStatusIcon(selectedInvoice.status)}
                                        {selectedInvoice.status}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Daycare</p>
                                    <p className="text-sm font-medium text-gray-900">{selectedInvoice.daycare_name || selectedInvoice.daycare}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Amount Due</p>
                                    <p className="text-sm font-bold text-gray-900">${selectedInvoice.total}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Issue Date</p>
                                    <p className="text-sm text-gray-900">{selectedInvoice.issue_date}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Due Date</p>
                                    <p className="text-sm text-gray-900">{selectedInvoice.due_date}</p>
                                </div>
                            </div>

                            {selectedInvoice.payment_date && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <p className="text-sm font-medium text-gray-500 mb-1">Payment Date</p>
                                    <p className="text-sm text-gray-900">{selectedInvoice.payment_date}</p>
                                </div>
                            )}
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 font-medium text-sm">Close</button>
                            <button onClick={() => handleDownload(selectedInvoice)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center gap-2">
                                <Download className="w-4 h-4" /> Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
