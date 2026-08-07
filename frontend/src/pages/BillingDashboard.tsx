import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';

interface InvoiceItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: string;
    total: string;
}

interface Payment {
    id: string;
    amount: string;
    payment_date: string;
    payment_method: string;
}

interface Invoice {
    id: string;
    invoice_number: string;
    student_name: string;
    issue_date: string;
    due_date: string;
    total_amount: string;
    amount_paid: string;
    status: string;
    items: InvoiceItem[];
    payments: Payment[];
}

interface SubscriptionPlan {
    id: string;
    name: string;
    price: string;
    max_teachers: number;
    max_staff: number;
    attendance: boolean;
    activities: boolean;
    fees: boolean;
    reports: boolean;
    documents: boolean;
    gallery: boolean;
    notifications: boolean;
}

interface CurrentSubscription {
    id: string;
    plan_name: string;
    subscription_status: string;
    start_date: string;
    expiry_date: string;
    renewal_date: string;
}

const BillingDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'invoices' | 'subscription'>('invoices');
    
    // Invoices State
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [invoicesLoading, setInvoicesLoading] = useState(true);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Credit Card');
    const [paymentLoading, setPaymentLoading] = useState(false);
    
    // Create Invoice State
    const [showCreateInvoice, setShowCreateInvoice] = useState(false);
    const [students, setStudents] = useState<any[]>([]);
    
    // Subscription State
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [currentSub, setCurrentSub] = useState<CurrentSubscription | null>(null);
    const [subLoading, setSubLoading] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'invoices') {
            fetchInvoices();
            fetchStudents();
        } else {
            fetchSubscriptions();
        }
    }, [activeTab]);

    const fetchInvoices = async () => {
        setInvoicesLoading(true);
        try {
            const res = await api.get('/billing/invoices/');
            setInvoices(res.data);
        } catch (error) {
            console.error("Failed to fetch invoices", error);
        } finally {
            setInvoicesLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const res = await api.get('/students/');
            setStudents(res.data);
        } catch (error) {
            console.error("Failed to fetch students", error);
        }
    };

    const fetchSubscriptions = async () => {
        setSubLoading(true);
        try {
            const res = await api.get('/billing/subscriptions/');
            setPlans(res.data.plans);
            setCurrentSub(res.data.current_subscription);
        } catch (error) {
            console.error("Failed to fetch subscriptions", error);
        } finally {
            setSubLoading(false);
        }
    };

    const handleCreateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        try {
            await api.post('/billing/invoices/', {
                student_id: formData.get('student_id'),
                issue_date: formData.get('issue_date'),
                due_date: formData.get('due_date'),
                amount: formData.get('amount'),
                description: formData.get('description'),
            });
            setShowCreateInvoice(false);
            fetchInvoices();
        } catch (error) {
            console.error("Failed to create invoice", error);
        }
    };

    const handleRecordPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedInvoice) return;
        setPaymentLoading(true);
        try {
            const res = await api.post(`/billing/invoices/${selectedInvoice.id}/`, {
                amount: paymentAmount,
                payment_method: paymentMethod
            });
            setSelectedInvoice(res.data); // Update modal with new payment
            fetchInvoices(); // Refresh list
            setPaymentAmount('');
        } catch (error) {
            console.error("Failed to record payment", error);
        } finally {
            setPaymentLoading(false);
        }
    };

    const handleSubscribe = async (planId: string) => {
        setCheckoutLoading(true);
        try {
            await api.post('/billing/subscriptions/checkout/', { plan_id: planId });
            fetchSubscriptions();
        } catch (error) {
            console.error("Subscription failed", error);
        } finally {
            setCheckoutLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Paid': return 'bg-green-100 text-green-800';
            case 'Partially Paid': return 'bg-yellow-100 text-yellow-800';
            case 'Unpaid': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Layout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Billing & Subscriptions</h1>
                    <p className="mt-1 text-sm text-gray-500">Manage parent invoices and your KidSynq software plan.</p>
                </div>
                {activeTab === 'invoices' && (
                    <button 
                        onClick={() => setShowCreateInvoice(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Create Invoice
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('invoices')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'invoices' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        Parent Invoices
                    </button>
                    <button
                        onClick={() => setActiveTab('subscription')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'subscription' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        My Subscription Plan
                    </button>
                </nav>
            </div>

            {/* Invoices Tab */}
            {activeTab === 'invoices' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Invoice List */}
                    <div className={`lg:col-span-1 bg-white shadow overflow-hidden sm:rounded-lg ${selectedInvoice ? 'hidden lg:block' : ''}`}>
                        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Invoices</h3>
                        </div>
                        {invoicesLoading ? (
                            <div className="p-4 text-center text-gray-500">Loading...</div>
                        ) : (
                            <ul className="divide-y divide-gray-200 h-[600px] overflow-y-auto">
                                {invoices.map((inv) => (
                                    <li key={inv.id}>
                                        <button 
                                            onClick={() => setSelectedInvoice(inv)}
                                            className={`w-full text-left px-4 py-4 hover:bg-gray-50 transition ${selectedInvoice?.id === inv.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-sm font-medium text-indigo-600">{inv.invoice_number}</span>
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(inv.status)}`}>{inv.status}</span>
                                            </div>
                                            <p className="text-sm font-semibold text-gray-900">{inv.student_name}</p>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="text-xs text-gray-500">Due: {inv.due_date}</span>
                                                <span className="text-sm font-bold text-gray-900">${inv.total_amount}</span>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                                {invoices.length === 0 && (
                                    <div className="p-4 text-center text-gray-500 text-sm">No invoices found.</div>
                                )}
                            </ul>
                        )}
                    </div>

                    {/* Invoice Detail */}
                    <div className={`lg:col-span-2 ${!selectedInvoice ? 'hidden lg:block' : ''}`}>
                        {!selectedInvoice ? (
                            <div className="bg-white shadow sm:rounded-lg py-16 text-center text-gray-500 h-[600px] flex items-center justify-center">
                                <p>Select an invoice to view details and record payments.</p>
                            </div>
                        ) : (
                            <div className="bg-white shadow sm:rounded-lg overflow-hidden flex flex-col h-[600px]">
                                {/* Header */}
                                <div className="bg-gray-50 px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center shrink-0">
                                    <div>
                                        <h3 className="text-lg leading-6 font-medium text-gray-900">Invoice {selectedInvoice.invoice_number}</h3>
                                        <p className="mt-1 max-w-2xl text-sm text-gray-500">For {selectedInvoice.student_name}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(selectedInvoice.status)}`}>{selectedInvoice.status}</span>
                                        <button className="lg:hidden text-gray-500 hover:text-gray-700 font-medium text-sm" onClick={() => setSelectedInvoice(null)}>Close</button>
                                    </div>
                                </div>
                                
                                {/* Content scrollable */}
                                <div className="px-4 py-5 sm:p-6 overflow-y-auto flex-1">
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div>
                                            <p className="text-sm text-gray-500">Issue Date</p>
                                            <p className="font-medium text-gray-900">{selectedInvoice.issue_date}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Due Date</p>
                                            <p className="font-medium text-gray-900">{selectedInvoice.due_date}</p>
                                        </div>
                                    </div>

                                    {/* Line Items */}
                                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b pb-2 mb-4">Line Items</h4>
                                    <table className="min-w-full divide-y divide-gray-200 mb-6">
                                        <thead>
                                            <tr>
                                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {selectedInvoice.items.map(item => (
                                                <tr key={item.id}>
                                                    <td className="px-2 py-3 text-sm text-gray-900">{item.description}</td>
                                                    <td className="px-2 py-3 text-sm text-gray-900 text-right">${item.total}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td className="px-2 py-3 text-sm font-bold text-gray-900 text-right">Total:</td>
                                                <td className="px-2 py-3 text-sm font-bold text-gray-900 text-right">${selectedInvoice.total_amount}</td>
                                            </tr>
                                            <tr>
                                                <td className="px-2 py-3 text-sm font-bold text-gray-900 text-right">Amount Paid:</td>
                                                <td className="px-2 py-3 text-sm font-bold text-green-600 text-right">-${selectedInvoice.amount_paid}</td>
                                            </tr>
                                            <tr className="bg-gray-50">
                                                <td className="px-2 py-3 text-sm font-bold text-gray-900 text-right">Balance Due:</td>
                                                <td className="px-2 py-3 text-sm font-bold text-red-600 text-right">${(parseFloat(selectedInvoice.total_amount) - parseFloat(selectedInvoice.amount_paid)).toFixed(2)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>

                                    {/* Payment History */}
                                    {selectedInvoice.payments.length > 0 && (
                                        <>
                                            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b pb-2 mb-4 mt-8">Payment History</h4>
                                            <ul className="space-y-3 mb-6">
                                                {selectedInvoice.payments.map(payment => (
                                                    <li key={payment.id} className="flex justify-between items-center text-sm bg-gray-50 p-3 rounded border border-gray-200">
                                                        <span>{payment.payment_date} via {payment.payment_method}</span>
                                                        <span className="font-bold text-green-600">${payment.amount}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </>
                                    )}

                                    {/* Record Payment Form */}
                                    {selectedInvoice.status !== 'Paid' && (
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mt-8">
                                            <h4 className="text-sm font-bold text-blue-900 mb-3">Record a Payment</h4>
                                            <form onSubmit={handleRecordPayment} className="flex flex-col sm:flex-row gap-3 items-end">
                                                <div className="flex-1 w-full">
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01"
                                                        max={(parseFloat(selectedInvoice.total_amount) - parseFloat(selectedInvoice.amount_paid)).toFixed(2)}
                                                        required 
                                                        value={paymentAmount}
                                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                                        className="block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                                                    />
                                                </div>
                                                <div className="flex-1 w-full">
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
                                                    <select 
                                                        value={paymentMethod}
                                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                                        className="block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                    >
                                                        <option value="Credit Card">Credit Card</option>
                                                        <option value="Cash">Cash</option>
                                                        <option value="Bank Transfer">Bank Transfer</option>
                                                        <option value="Check">Check</option>
                                                    </select>
                                                </div>
                                                <button 
                                                    type="submit" 
                                                    disabled={paymentLoading || !paymentAmount}
                                                    className="w-full sm:w-auto inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:bg-blue-300"
                                                >
                                                    {paymentLoading ? 'Saving...' : 'Record'}
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Subscriptions Tab */}
            {activeTab === 'subscription' && (
                <div className="space-y-8">
                    {/* Current Plan Overview */}
                    <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                        <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Current Subscription</h3>
                            {currentSub && (
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${currentSub.subscription_status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {currentSub.subscription_status}
                                </span>
                            )}
                        </div>
                        <div className="px-4 py-5 sm:p-6">
                            {subLoading ? (
                                <p className="text-gray-500 text-sm">Loading subscription info...</p>
                            ) : currentSub ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Plan</p>
                                        <p className="mt-1 text-2xl font-semibold text-gray-900">{currentSub.plan_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Renews On</p>
                                        <p className="mt-1 text-lg font-medium text-gray-900">{currentSub.renewal_date}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Status</p>
                                        <p className="mt-1 text-lg font-medium text-green-600">Active</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm text-center">No active subscription found. Please select a plan below.</p>
                            )}
                        </div>
                    </div>

                    {/* Available Plans */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Available Plans</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {plans.map(plan => {
                                const isCurrent = currentSub?.plan_name === plan.name;
                                return (
                                    <div key={plan.id} className={`bg-white rounded-lg shadow-lg overflow-hidden flex flex-col ${isCurrent ? 'ring-2 ring-indigo-500 transform scale-105 transition' : ''}`}>
                                        <div className="px-6 py-8 bg-gray-50 border-b border-gray-200 text-center">
                                            <h3 className="text-xl font-medium text-gray-900 mb-2">{plan.name}</h3>
                                            <div className="flex justify-center items-baseline text-4xl font-extrabold text-gray-900">
                                                ${plan.price}
                                                <span className="text-xl font-medium text-gray-500">/mo</span>
                                            </div>
                                        </div>
                                        <div className="px-6 py-6 flex-1">
                                            <ul className="space-y-4">
                                                <li className="flex items-start">
                                                    <span className="text-green-500 mr-2">✓</span>
                                                    <span className="text-sm text-gray-700">Up to {plan.max_staff} Staff Members</span>
                                                </li>
                                                <li className="flex items-start">
                                                    <span className={(plan as any).activities ? "text-green-500 mr-2" : "text-gray-300 mr-2"}>{(plan as any).activities ? "✓" : "✗"}</span>
                                                    <span className={`text-sm ${(plan as any).activities ? "text-gray-700" : "text-gray-400 line-through"}`}>Daily Activities Tracking</span>
                                                </li>
                                                <li className="flex items-start">
                                                    <span className={(plan as any).fees ? "text-green-500 mr-2" : "text-gray-300 mr-2"}>{(plan as any).fees ? "✓" : "✗"}</span>
                                                    <span className={`text-sm ${(plan as any).fees ? "text-gray-700" : "text-gray-400 line-through"}`}>Billing & Invoices</span>
                                                </li>
                                                <li className="flex items-start">
                                                    <span className={(plan as any).compliance ? "text-green-500 mr-2" : "text-gray-300 mr-2"}>{(plan as any).compliance ? "✓" : "✗"}</span>
                                                    <span className={`text-sm ${(plan as any).compliance ? "text-gray-700" : "text-gray-400 line-through"}`}>Compliance Dashboard</span>
                                                </li>
                                            </ul>
                                        </div>
                                        <div className="px-6 py-6 bg-gray-50 mt-auto">
                                            <button
                                                onClick={() => handleSubscribe(plan.id)}
                                                disabled={isCurrent || checkoutLoading}
                                                className={`w-full block text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium ${isCurrent ? 'bg-green-100 text-green-800 cursor-default' : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none'}`}
                                            >
                                                {isCurrent ? 'Current Plan' : checkoutLoading ? 'Processing...' : 'Subscribe'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Create Invoice Modal */}
            {showCreateInvoice && (
                <div className="fixed z-10 inset-0 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowCreateInvoice(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleCreateInvoice}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Create New Invoice</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Student</label>
                                            <select name="student_id" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                                <option value="">-- Select Student --</option>
                                                {students.map(s => (
                                                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Issue Date</label>
                                                <input type="date" name="issue_date" required defaultValue={new Date().toISOString().split('T')[0]} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Due Date</label>
                                                <input type="date" name="due_date" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Description (Item)</label>
                                            <input type="text" name="description" required defaultValue="Monthly Tuition" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Amount ($)</label>
                                            <input type="number" name="amount" step="0.01" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm">
                                        Create Invoice
                                    </button>
                                    <button type="button" onClick={() => setShowCreateInvoice(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default BillingDashboard;
