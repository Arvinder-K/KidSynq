import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, CreditCard, FileText, UserCheck, Building, Calendar, AlertTriangle, RefreshCw, Clock, Users, School, Key, Copy, Eye, EyeOff, UserPlus, Shield, DollarSign } from 'lucide-react';
import api from '../api';
import MakePaymentModal from './MakePaymentModal';

interface DaycareFormModalProps {
    isOpen: boolean;
    daycare?: any; // If provided, it's an Edit action
    onClose: () => void;
    onSuccess: () => void;
    onDeleteRequest?: (daycare: any) => void;
}

export default function DaycareFormModal({ isOpen, daycare, onClose, onSuccess, onDeleteRequest }: DaycareFormModalProps) {
    const [activeTab, setActiveTab] = useState<'info' | 'subscription' | 'invoices' | 'stats'>('info');
    const [paymentModalInvoice, setPaymentModalInvoice] = useState<any>(null);
    const [formData, setFormData] = useState<any>({
        name: '',
        email: '',
        phone: '',
        license_number: '',
        capacity: '',
        opening_time: '',
        closing_time: '',
        address1: '',
        city: '',
        state: '',
        postal_code: '',
        logo: ''
    });
    
    const [daycareDetails, setDaycareDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Reset Password State
    const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSuccessMsg, setResetSuccessMsg] = useState('');

    // Create Admin State (when daycare has no admin account)
    const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
    const [createAdminData, setCreateAdminData] = useState({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        password: ''
    });
    const [createAdminLoading, setCreateAdminLoading] = useState(false);

    const generateRandomPassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
        let pass = '';
        for (let i = 0; i < 12; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return pass;
    };

    const fetchDaycareDetails = (daycareId: string) => {
        setLoadingDetails(true);
        api.get(`/super-admin/daycares/${daycareId}/`)
            .then(res => setDaycareDetails(res.data))
            .catch(() => setDaycareDetails(daycare))
            .finally(() => setLoadingDetails(false));
    };

    useEffect(() => {
        if (daycare && isOpen) {
            setFormData({
                name: daycare.name || '',
                email: daycare.email || '',
                phone: daycare.phone || '',
                license_number: daycare.license_number || '',
                capacity: daycare.capacity || '',
                opening_time: daycare.opening_time || '',
                closing_time: daycare.closing_time || '',
                address1: daycare.address1 || '',
                city: daycare.city || '',
                state: daycare.state || '',
                postal_code: daycare.postal_code || '',
                logo: daycare.logo || ''
            });

            // Pre-fill email for create admin if available
            setCreateAdminData({
                username: (daycare.name || 'admin').toLowerCase().replace(/[^a-z0-9]/g, '') + '_admin',
                email: daycare.email || '',
                first_name: daycare.name || '',
                last_name: 'Admin',
                password: generateRandomPassword()
            });

            fetchDaycareDetails(daycare.id);
        } else {
            setFormData({
                name: '', email: '', phone: '', license_number: '', capacity: '',
                opening_time: '', closing_time: '', address1: '', city: '', state: '', postal_code: '', logo: ''
            });
            setDaycareDetails(null);
        }
        setActiveTab('info');
        setError('');
        setIsResetPasswordOpen(false);
        setIsCreateAdminOpen(false);
        setNewPassword('');
        setResetSuccessMsg('');
    }, [daycare, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const payload = { ...formData };
            if (!payload.capacity) delete payload.capacity;
            if (!payload.opening_time) delete payload.opening_time;
            if (!payload.closing_time) delete payload.closing_time;

            if (daycare) {
                await api.patch(`/super-admin/daycares/${daycare.id}/`, payload);
            } else {
                await api.post(`/super-admin/daycares/`, payload);
            }
            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'An error occurred while saving the daycare.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPassword || !adminUser?.id) return;
        setResetLoading(true);
        setResetSuccessMsg('');
        setError('');

        try {
            await api.post(`/super-admin/daycare-admins/${adminUser.id}/reset_password/`, {
                password: newPassword
            });
            setResetSuccessMsg(`Password successfully updated to: ${newPassword}`);
            setIsResetPasswordOpen(false);
        } catch (err: any) {
            setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to reset password.');
        } finally {
            setResetLoading(false);
        }
    };

    const handleCreateAdminSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!daycare?.id) return;
        setCreateAdminLoading(true);
        setError('');

        try {
            await api.post(`/super-admin/daycare-admins/`, {
                ...createAdminData,
                daycare: daycare.id
            });
            setIsCreateAdminOpen(false);
            setResetSuccessMsg(`Admin account '${createAdminData.username}' created successfully! Password: ${createAdminData.password}`);
            fetchDaycareDetails(daycare.id);
        } catch (err: any) {
            const errData = err.response?.data;
            if (typeof errData === 'object' && errData !== null) {
                const msgs = Object.values(errData).map((v: any) => Array.isArray(v) ? v[0] : v);
                setError(msgs.join(', '));
            } else {
                setError('Failed to create admin account.');
            }
        } finally {
            setCreateAdminLoading(false);
        }
    };

    const handleMarkInvoicePaid = async (invoiceId: string) => {
        if (!daycare?.id) return;
        try {
            await api.patch(`/super-admin/invoices/${invoiceId}/`, {
                status: 'Paid',
                payment_date: new Date().toISOString().split('T')[0]
            });
            fetchDaycareDetails(daycare.id);
            if (onSuccess) onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || err.response?.data?.detail || 'Failed to mark invoice as paid.');
        }
    };

    const handleDeleteInvoice = async (invoiceId: string, invNumber: string) => {
        if (!confirm(`Are you sure you want to delete invoice #${invNumber}?`)) return;
        if (!daycare?.id) return;
        try {
            await api.delete(`/super-admin/invoices/${invoiceId}/`);
            fetchDaycareDetails(daycare.id);
            if (onSuccess) onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to delete invoice');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const targetData = daycareDetails || daycare;
    const sub = targetData?.subscription;
    const invoices = targetData?.invoices || [];
    const adminUser = targetData?.admin_user;
    const stats = targetData?.stats;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden my-6 border border-gray-100">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {daycare ? `Edit Daycare — ${daycare.name}` : 'Create New Daycare'}
                        </h2>
                        {daycare && (
                            <p className="text-xs text-gray-500 mt-0.5">ID: {daycare.id}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs Navigation (only when editing existing daycare) */}
                {daycare && (
                    <div className="px-6 border-b border-gray-100 bg-gray-50 flex gap-2 overflow-x-auto text-sm">
                        <button
                            type="button"
                            onClick={() => setActiveTab('info')}
                            className={`py-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                activeTab === 'info' 
                                    ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs rounded-t-lg' 
                                    : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Building className="w-4 h-4" /> Basic & Address Info
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('subscription')}
                            className={`py-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                activeTab === 'subscription' 
                                    ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs rounded-t-lg' 
                                    : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <CreditCard className="w-4 h-4" /> Subscription & Expiry
                            {sub?.is_expired && (
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('invoices')}
                            className={`py-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                activeTab === 'invoices' 
                                    ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs rounded-t-lg' 
                                    : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <FileText className="w-4 h-4" /> Invoices ({invoices.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('stats')}
                            className={`py-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                activeTab === 'stats' 
                                    ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs rounded-t-lg' 
                                    : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <UserCheck className="w-4 h-4" /> Admin & Account
                        </button>
                    </div>
                )}
                
                {/* Body Content */}
                <div className="p-6 max-h-[calc(80vh-140px)] overflow-y-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
                            {error}
                        </div>
                    )}

                    {resetSuccessMsg && (
                        <div className="mb-4 p-4 bg-emerald-50 text-emerald-800 text-xs font-mono rounded-xl border border-emerald-200 flex justify-between items-center">
                            <span>🔑 {resetSuccessMsg}</span>
                            <button
                                type="button"
                                onClick={() => { navigator.clipboard.writeText(resetSuccessMsg); alert('Copied to clipboard'); }}
                                className="ml-2 p-1 text-emerald-700 hover:bg-emerald-100 rounded"
                                title="Copy"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {loadingDetails && (
                        <div className="text-center py-6 text-sm text-gray-500 flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> Loading full details...
                        </div>
                    )}
                    
                    {activeTab === 'info' && (
                        <form id="daycareForm" onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-4 md:col-span-2">
                                    <h3 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-1.5">
                                        <Building className="w-4 h-4 text-indigo-600" /> Basic Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Daycare Name *</label>
                                            <input type="text" name="name" required value={formData.name} onChange={handleChange} className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white font-medium text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Official Email *</label>
                                            <input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white font-medium text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                                            <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white font-medium text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">License Number</label>
                                            <input type="text" name="license_number" value={formData.license_number} onChange={handleChange} className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white font-medium text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Total Student Capacity</label>
                                            <input type="number" name="capacity" value={formData.capacity} onChange={handleChange} className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white font-medium text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Opening Time</label>
                                            <input type="time" name="opening_time" value={formData.opening_time} onChange={handleChange} className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white font-medium text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Closing Time</label>
                                            <input type="time" name="closing_time" value={formData.closing_time} onChange={handleChange} className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white font-medium text-sm" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 md:col-span-2 pt-2">
                                    <h3 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-1.5">
                                        <Building className="w-4 h-4 text-indigo-600" /> Address Details
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Street Address</label>
                                            <input type="text" name="address1" value={formData.address1} onChange={handleChange} className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white font-medium text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                                            <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white font-medium text-sm" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">State/Province</label>
                                                <input type="text" name="state" value={formData.state} onChange={handleChange} className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white font-medium text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Postal Code</label>
                                                <input type="text" name="postal_code" value={formData.postal_code} onChange={handleChange} className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white font-medium text-sm" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    )}

                    {activeTab === 'subscription' && (
                        <div className="space-y-6">
                            {sub ? (
                                <>
                                    {/* Subscription Header Card */}
                                    <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl shadow-sm border border-slate-800">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Active Subscription Plan</span>
                                                <h3 className="text-2xl font-extrabold mt-1">{sub.plan_name}</h3>
                                                <p className="text-sm text-slate-300 mt-1">
                                                    ${sub.amount} / {sub.billing_cycle}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize ${
                                                    sub.is_expired || sub.subscription_status?.toLowerCase() === 'expired'
                                                        ? 'bg-rose-500 text-white'
                                                        : sub.subscription_status?.toLowerCase() === 'suspended'
                                                        ? 'bg-amber-500 text-white'
                                                        : sub.subscription_status?.toLowerCase() === 'trial'
                                                        ? 'bg-sky-500 text-white'
                                                        : 'bg-emerald-500 text-white'
                                                }`}>
                                                    {sub.subscription_status}
                                                </span>
                                                {sub.days_until_expiry !== null && sub.days_until_expiry !== undefined && (
                                                    <div className="mt-2 text-xs font-medium text-slate-300">
                                                        {sub.is_expired ? (
                                                            <span className="text-rose-400 font-bold flex items-center justify-end gap-1">
                                                                <AlertTriangle className="w-3.5 h-3.5" /> Expired {Math.abs(sub.days_until_expiry)}d ago
                                                            </span>
                                                        ) : (
                                                            <span>{sub.days_until_expiry} days remaining</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Quick Actions Control Bar */}
                                        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-xs text-slate-400 font-medium">Quick Subscription Actions:</span>
                                            <div className="flex flex-wrap gap-2">
                                                {['active', 'trial'].includes(sub.subscription_status?.toLowerCase()) ? (
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            if (!confirm('Are you sure you want to stop/suspend service for this daycare?')) return;
                                                            try {
                                                                await api.post(`/super-admin/subscriptions/assigned/${sub.id}/stop/`, {});
                                                                alert('Subscription stopped/suspended.');
                                                                fetchDaycareDetails(daycare.id);
                                                            } catch (err) { alert('Failed to stop subscription'); }
                                                        }}
                                                        className="px-3 py-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                                                    >
                                                        ⏸️ Stop Service
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            try {
                                                                await api.post(`/super-admin/subscriptions/assigned/${sub.id}/activate/`, {});
                                                                alert('Subscription activated.');
                                                                fetchDaycareDetails(daycare.id);
                                                            } catch (err) { alert('Failed to activate subscription'); }
                                                        }}
                                                        className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                                                    >
                                                        🟢 Activate Service
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await api.post(`/super-admin/subscriptions/assigned/${sub.id}/renew/`, {});
                                                            alert('Subscription renewed successfully!');
                                                            fetchDaycareDetails(daycare.id);
                                                        } catch (err) { alert('Failed to renew subscription'); }
                                                    }}
                                                    className="px-3 py-1.5 bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30 border border-indigo-500/40 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                                                >
                                                    🔄 Renew Plan
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        if (!confirm('Are you sure you want to cancel this subscription?')) return;
                                                        try {
                                                            await api.post(`/super-admin/subscriptions/assigned/${sub.id}/cancel/`, {});
                                                            alert('Subscription cancelled.');
                                                            fetchDaycareDetails(daycare.id);
                                                        } catch (err) { alert('Failed to cancel subscription'); }
                                                    }}
                                                    className="px-3 py-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                                                >
                                                    🚫 Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        if (!confirm('Are you sure you want to PERMANENTLY REMOVE and delete this subscription from the daycare?')) return;
                                                        try {
                                                            await api.delete(`/super-admin/subscriptions/assigned/${sub.id}/`);
                                                            alert('Subscription removed successfully.');
                                                            fetchDaycareDetails(daycare.id);
                                                            if (onSuccess) onSuccess();
                                                        } catch (err) { alert('Failed to remove subscription'); }
                                                    }}
                                                    className="px-3 py-1.5 bg-red-900/40 text-red-200 hover:bg-red-900/60 border border-red-500/40 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                                                    title="Permanently remove subscription"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" /> Remove Plan
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Subscription Dates & Expiry Grid with Editable Expiry */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                                            <span className="text-xs font-semibold text-gray-500 block">Start Date</span>
                                            <span className="text-base font-bold text-gray-900 mt-1 block">{sub.start_date || 'N/A'}</span>
                                        </div>
                                        <div className={`p-4 border rounded-xl ${sub.is_expired ? 'bg-rose-50 border-rose-200' : 'bg-gray-50 border-gray-200'}`}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-semibold text-gray-500">Expiration / End Date</span>
                                            </div>
                                            <input
                                                type="date"
                                                defaultValue={sub.expiry_date || ''}
                                                onChange={async (e) => {
                                                    const val = e.target.value;
                                                    if (!val) return;
                                                    try {
                                                        await api.patch(`/super-admin/subscriptions/assigned/${sub.id}/`, {
                                                            expiry_date: val,
                                                            renewal_date: val
                                                        });
                                                        setResetSuccessMsg(`Subscription expiry date updated to ${val}`);
                                                        fetchDaycareDetails(daycare.id);
                                                    } catch (err) { alert('Failed to update expiry date'); }
                                                }}
                                                className="w-full text-sm font-bold text-gray-900 bg-white border border-gray-300 rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500 outline-none mt-1"
                                            />
                                        </div>
                                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                                            <span className="text-xs font-semibold text-gray-500 block">Next Renewal Date</span>
                                            <span className="text-base font-bold text-gray-900 mt-1 block">{sub.renewal_date || sub.expiry_date || 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Feature Limits Breakdown */}
                                    {sub.plan_details && (
                                        <div className="p-5 border border-gray-200 rounded-2xl bg-white space-y-3">
                                            <h4 className="text-sm font-bold text-gray-900 border-b pb-2">Plan Limits & Capacity</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                                <div className="p-3 bg-indigo-50/50 rounded-xl">
                                                    <span className="text-xs text-gray-500 block">Max Students</span>
                                                    <span className="text-lg font-bold text-indigo-700">{sub.plan_details.max_students || 'Unlimited'}</span>
                                                </div>
                                                <div className="p-3 bg-indigo-50/50 rounded-xl">
                                                    <span className="text-xs text-gray-500 block">Max Staff</span>
                                                    <span className="text-lg font-bold text-indigo-700">{sub.plan_details.max_staff || 'Unlimited'}</span>
                                                </div>
                                                <div className="p-3 bg-indigo-50/50 rounded-xl">
                                                    <span className="text-xs text-gray-500 block">Max Classrooms</span>
                                                    <span className="text-lg font-bold text-indigo-700">{sub.plan_details.max_classrooms || 'Unlimited'}</span>
                                                </div>
                                                <div className="p-3 bg-indigo-50/50 rounded-xl">
                                                    <span className="text-xs text-gray-500 block">Storage</span>
                                                    <span className="text-lg font-bold text-indigo-700">{sub.plan_details.max_storage_mb ? `${sub.plan_details.max_storage_mb} MB` : 'Unlimited'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-300 rounded-2xl">
                                    <CreditCard className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                    <p className="text-sm font-semibold text-gray-700">No active subscription found for this daycare.</p>
                                    <p className="text-xs text-gray-500 mt-1">Assign a subscription plan from the Subscriptions management tab.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'invoices' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center justify-between">
                                <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-indigo-600" /> Daycare Invoices & Billing History</span>
                                <span className="text-xs text-gray-500 font-normal">{invoices.length} total records</span>
                            </h3>

                            {invoices.length > 0 ? (
                                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 uppercase">
                                            <tr>
                                                <th className="p-3">Invoice #</th>
                                                <th className="p-3">Amount</th>
                                                <th className="p-3">Issue Date</th>
                                                <th className="p-3">Due Date</th>
                                                <th className="p-3">Payment Date</th>
                                                <th className="p-3">Status</th>
                                                <th className="p-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 font-medium">
                                            {invoices.map((inv: any) => (
                                                <tr key={inv.id} className="hover:bg-gray-50">
                                                    <td className="p-3 font-bold text-gray-900">{inv.invoice_number}</td>
                                                    <td className="p-3 font-semibold text-gray-900">${inv.total || inv.amount}</td>
                                                    <td className="p-3 text-gray-600">{inv.issue_date || 'N/A'}</td>
                                                    <td className="p-3 text-gray-600">{inv.due_date || 'N/A'}</td>
                                                    <td className="p-3 text-gray-600">{inv.payment_date || '—'}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                            inv.status?.toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {inv.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {inv.status?.toLowerCase() !== 'paid' ? (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPaymentModalInvoice({
                                                                            id: inv.id,
                                                                            invoice_number: inv.invoice_number,
                                                                            amount: inv.total || inv.amount,
                                                                            total: inv.total || inv.amount,
                                                                            daycare_name: daycare?.name || targetData?.name,
                                                                            due_date: inv.due_date,
                                                                            issue_date: inv.issue_date
                                                                        })}
                                                                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1"
                                                                    >
                                                                        <CreditCard className="w-3.5 h-3.5" /> Make Payment
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleMarkInvoicePaid(inv.id)}
                                                                        className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                                                                        title="Instant 1-Click Paid"
                                                                    >
                                                                        Quick Paid
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                                                    ✓ Paid
                                                                </span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteInvoice(inv.id, inv.invoice_number)}
                                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                title="Delete Invoice"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-300 rounded-2xl">
                                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                    <p className="text-sm font-semibold text-gray-700">No invoice records found for this daycare.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'stats' && (
                        <div className="space-y-6">
                            {/* Primary Admin Details Card */}
                            <div className="p-5 border border-gray-200 rounded-2xl bg-white space-y-4">
                                <div className="flex justify-between items-center border-b pb-3">
                                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                        <Shield className="w-4 h-4 text-indigo-600" /> Primary Admin User Account
                                    </h3>
                                    {adminUser && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsResetPasswordOpen(!isResetPasswordOpen);
                                                setNewPassword(generateRandomPassword());
                                            }}
                                            className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            <Key className="w-3.5 h-3.5" />
                                            {isResetPasswordOpen ? 'Cancel Reset' : 'Reset Password'}
                                        </button>
                                    )}
                                </div>

                                {adminUser ? (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-xs font-semibold text-gray-500 block">Name</span>
                                                <span className="font-bold text-gray-900 block">
                                                    {adminUser.first_name || adminUser.last_name ? `${adminUser.first_name} ${adminUser.last_name}` : 'Daycare Administrator'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-xs font-semibold text-gray-500 block">Username</span>
                                                <span className="font-bold text-indigo-600 block">{adminUser.username}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs font-semibold text-gray-500 block">Email Address</span>
                                                <span className="font-bold text-gray-900 block">{adminUser.email}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs font-semibold text-gray-500 block">Account Status</span>
                                                <span className="inline-block mt-0.5 px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full">
                                                    {adminUser.status || 'Active'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Reset Password In-place Form */}
                                        {isResetPasswordOpen && (
                                            <form onSubmit={handleResetPasswordSubmit} className="mt-4 p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3">
                                                <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1">
                                                    <Key className="w-3.5 h-3.5 text-indigo-600" /> Reset Password for {adminUser.username}
                                                </h4>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <input
                                                            required
                                                            type={showPassword ? 'text' : 'password'}
                                                            placeholder="Enter new password"
                                                            value={newPassword}
                                                            onChange={(e) => setNewPassword(e.target.value)}
                                                            className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg text-sm bg-white font-mono"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                        >
                                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setNewPassword(generateRandomPassword())}
                                                        className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                                                        title="Auto-Generate Password"
                                                    >
                                                        🎲 Generate
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={resetLoading}
                                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap shadow-xs"
                                                    >
                                                        {resetLoading ? 'Updating...' : 'Save Password'}
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </>
                                ) : (
                                    <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-xs font-bold text-amber-900">No Admin User Account Assigned</p>
                                                <p className="text-xs text-amber-700 mt-0.5">This daycare does not have an active administrator user profile yet.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsCreateAdminOpen(!isCreateAdminOpen)}
                                                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                                            >
                                                <UserPlus className="w-3.5 h-3.5" />
                                                Add Admin Account
                                            </button>
                                        </div>

                                        {/* Inline Create Admin Form */}
                                        {isCreateAdminOpen && (
                                            <form onSubmit={handleCreateAdminSubmit} className="mt-4 pt-4 border-t border-amber-200/60 space-y-4">
                                                <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                                                    <UserPlus className="w-4 h-4 text-indigo-600" /> Create Administrator Credentials
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Username *</label>
                                                        <input
                                                            required
                                                            type="text"
                                                            value={createAdminData.username}
                                                            onChange={(e) => setCreateAdminData({ ...createAdminData, username: e.target.value })}
                                                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Email *</label>
                                                        <input
                                                            required
                                                            type="email"
                                                            value={createAdminData.email}
                                                            onChange={(e) => setCreateAdminData({ ...createAdminData, email: e.target.value })}
                                                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">First Name</label>
                                                        <input
                                                            type="text"
                                                            value={createAdminData.first_name}
                                                            onChange={(e) => setCreateAdminData({ ...createAdminData, first_name: e.target.value })}
                                                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Last Name</label>
                                                        <input
                                                            type="text"
                                                            value={createAdminData.last_name}
                                                            onChange={(e) => setCreateAdminData({ ...createAdminData, last_name: e.target.value })}
                                                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Password *</label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                required
                                                                type="text"
                                                                value={createAdminData.password}
                                                                onChange={(e) => setCreateAdminData({ ...createAdminData, password: e.target.value })}
                                                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-mono"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setCreateAdminData({ ...createAdminData, password: generateRandomPassword() })}
                                                                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                                                            >
                                                                🎲 Random
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="submit"
                                                    disabled={createAdminLoading}
                                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
                                                >
                                                    {createAdminLoading ? 'Creating Account...' : 'Create Admin Account'}
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Current Usage Metrics */}
                            {stats && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                        <Users className="w-4 h-4 text-indigo-600" /> Operational Usage Statistics
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-center">
                                            <Users className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                                            <span className="text-2xl font-black text-gray-900 block">{stats.students_count}</span>
                                            <span className="text-xs font-semibold text-gray-500 block">Students Registered</span>
                                        </div>
                                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-center">
                                            <UserCheck className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                                            <span className="text-2xl font-black text-gray-900 block">{stats.staff_count}</span>
                                            <span className="text-xs font-semibold text-gray-500 block">Staff Members</span>
                                        </div>
                                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-center">
                                            <School className="w-5 h-5 text-sky-600 mx-auto mb-1" />
                                            <span className="text-2xl font-black text-gray-900 block">{stats.classrooms_count}</span>
                                            <span className="text-xs font-semibold text-gray-500 block">Classrooms</span>
                                        </div>
                                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-center">
                                            <Building className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                                            <span className="text-2xl font-black text-gray-900 block">{stats.branches_count}</span>
                                            <span className="text-xs font-semibold text-gray-500 block">Branches</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Footer Buttons */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between rounded-b-2xl sticky bottom-0">
                    <div>
                        {daycare && onDeleteRequest && (
                            <button
                                type="button"
                                onClick={() => onDeleteRequest(daycare)}
                                className="px-3.5 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Daycare
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-gray-700 text-sm font-semibold hover:bg-gray-100 rounded-xl transition-colors">
                            Cancel
                        </button>
                        {activeTab === 'info' && (
                            <button type="submit" form="daycareForm" disabled={loading} className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm">
                                {loading ? 'Saving...' : (
                                    <><Check className="w-4 h-4" /> Save Daycare</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Interactive Multi-Method Payment Modal */}
            {paymentModalInvoice && (
                <MakePaymentModal
                    invoice={paymentModalInvoice}
                    onClose={() => setPaymentModalInvoice(null)}
                    onSuccess={() => {
                        setPaymentModalInvoice(null);
                        if (daycare?.id) {
                            fetchDaycareDetails(daycare.id);
                        }
                        if (onSuccess) onSuccess();
                    }}
                />
            )}
        </div>
    );
}
