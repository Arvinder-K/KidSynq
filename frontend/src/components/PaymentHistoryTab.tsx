import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, Clock } from 'lucide-react';
import api from '../api';

export default function PaymentHistoryTab() {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/super-admin/payments/')
            .then(res => setPayments(res.data.results || res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="p-8">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900">Payment History</h3>
                <p className="text-sm text-gray-500 mt-1">View all processed subscription payments across the platform.</p>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading payments...</div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Daycare</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Reference</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Method</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {payments.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-gray-50">
                                        <td className="p-4 text-sm text-gray-900">{payment.payment_date}</td>
                                        <td className="p-4 text-sm font-medium text-gray-900">{payment.daycare_name || payment.daycare}</td>
                                        <td className="p-4 text-sm font-mono text-gray-500">{payment.transaction_reference || 'N/A'}</td>
                                        <td className="p-4 text-sm text-gray-600 flex items-center gap-2">
                                            <CreditCard className="w-4 h-4 text-gray-400" />
                                            {payment.payment_method}
                                        </td>
                                        <td className="p-4 text-sm font-medium text-gray-900">${payment.amount} {payment.currency}</td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${payment.payment_status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {payment.payment_status === 'completed' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                {payment.payment_status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {payments.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-gray-500">No payments found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
