import React, { useState, useEffect } from 'react';
import { 
    X, Check, ChevronRight, ChevronLeft, Building2, UserCircle, 
    CreditCard, ClipboardCheck, Copy, Eye, EyeOff, PartyPopper,
    KeyRound, LogIn, ShieldCheck, ExternalLink
} from 'lucide-react';
import api from '../api';

interface DaycareOnboardingWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface CreatedCredentials {
    full_name: string;
    username: string;
    email: string;
    password: string;
}

export default function DaycareOnboardingWizard({ isOpen, onClose, onSuccess }: DaycareOnboardingWizardProps) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [plans, setPlans] = useState<any[]>([]);

    // Success state
    const [successData, setSuccessData] = useState<{
        daycareName: string;
        credentials: CreatedCredentials;
        subscription?: {
            plan_name: string; billing_cycle: string; amount: number;
            status: string; is_trial: boolean; trial_days: number;
            start_date?: string; trial_end_date?: string;
        };
        invoice?: {
            invoice_number: string; amount: number; total: number;
            issue_date: string; due_date: string; status: string;
        };
    } | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Step 1: Daycare Details
    const [daycareData, setDaycareData] = useState({
        name: '', email: '', phone: '', license_number: '', capacity: '',
        opening_time: '', closing_time: '', address1: '', city: '', state: '', postal_code: ''
    });

    // Step 2: Admin Profile
    const [adminData, setAdminData] = useState({
        first_name: '', last_name: '', username: '', email: '', password: ''
    });

    // Step 3: Subscription & Billing
    const [subscriptionData, setSubscriptionData] = useState({
        plan_id: '', billing_cycle: 'Monthly'
    });

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSuccessData(null);
            setCopiedField(null);
            setShowPassword(false);
            setDaycareData({
                name: '', email: '', phone: '', license_number: '', capacity: '',
                opening_time: '', closing_time: '', address1: '', city: '', state: '', postal_code: ''
            });
            setAdminData({ first_name: '', last_name: '', username: '', email: '', password: '' });
            setSubscriptionData({ plan_id: '', billing_cycle: 'Monthly' });
            setError('');
            api.get('/super-admin/subscription-plans/')
                .then(res => {
                    const availablePlans = res.data.results || res.data;
                    setPlans(availablePlans);
                    if (availablePlans.length > 0) {
                        setSubscriptionData(prev => ({ ...prev, plan_id: availablePlans[0].id }));
                    }
                })
                .catch(console.error);
        }
    }, [isOpen]);

    const copyToClipboard = (value: string, field: string) => {
        navigator.clipboard.writeText(value).then(() => {
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        });
    };

    if (!isOpen) return null;

    const handleNext = () => setStep(prev => Math.min(prev + 1, 4));
    const handlePrev = () => setStep(prev => Math.max(prev - 1, 1));

    const handleSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            const daycarePayload = { ...daycareData };
            if (!daycarePayload.capacity) delete (daycarePayload as any).capacity;
            if (!daycarePayload.opening_time) delete (daycarePayload as any).opening_time;
            if (!daycarePayload.closing_time) delete (daycarePayload as any).closing_time;
            const payload = { daycare: daycarePayload, admin: adminData, subscription: subscriptionData };
            const res = await api.post(`/super-admin/onboarding/`, payload);
            setSuccessData({
                daycareName: res.data.daycare_name || daycareData.name,
                credentials: res.data.admin_credentials || {
                    full_name: `${adminData.first_name} ${adminData.last_name}`.trim(),
                    username: adminData.username,
                    email: adminData.email,
                    password: adminData.password,
                },
                subscription: res.data.subscription || undefined,
                invoice: res.data.invoice || undefined,
            });
            setStep(5);
            onSuccess();
        } catch (err: any) {
            setError(
                err.response?.data?.detail ||
                err.response?.data?.message ||
                (typeof err.response?.data === 'object' ? JSON.stringify(err.response.data) : null) ||
                'An error occurred during onboarding.'
            );
        } finally {
            setLoading(false);
        }
    };

    const isStep1Valid = daycareData.name && daycareData.email && daycareData.phone;
    const isStep2Valid = adminData.first_name && adminData.last_name && adminData.username && adminData.email && adminData.password;
    const isStep3Valid = subscriptionData.plan_id;

    const steps = [
        { num: 1, title: 'Daycare Details', icon: Building2 },
        { num: 2, title: 'Administrator', icon: UserCircle },
        { num: 3, title: 'Subscription', icon: CreditCard },
        { num: 4, title: 'Review', icon: ClipboardCheck },
    ];

    const getSelectedPlanDetails = () => {
        return plans.find(p => p.id === subscriptionData.plan_id);
    };

    // ── SUCCESS SCREEN ──────────────────────────────────────────────────────
    if (step === 5 && successData) {
        const loginUrl = `${window.location.origin}/login`;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-8">
                    {/* Green success header */}
                    <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-8 text-white text-center">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <PartyPopper className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-black tracking-tight mb-1">Onboarding Complete!</h2>
                        <p className="text-emerald-100 text-sm font-medium">
                            <strong className="text-white">{successData.daycareName}</strong> is live and ready to use.
                        </p>
                    </div>

                    {/* Credentials */}
                    <div className="p-6 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-base font-bold text-slate-900">Admin Login Credentials</h3>
                        </div>

                        {/* Login URL */}
                        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                <LogIn className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5">Login URL</p>
                                <p className="text-sm font-mono font-bold text-indigo-900 truncate">{loginUrl}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <a href={loginUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <button onClick={() => copyToClipboard(loginUrl, 'url')} className={`p-1.5 rounded-lg transition-all ${copiedField === 'url' ? 'text-emerald-600 bg-emerald-50' : 'text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100'}`}>
                                    {copiedField === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </div>

                        {/* Username */}
                        <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                                <UserCircle className="w-4 h-4 text-violet-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-0.5">Username</p>
                                <p className="text-sm font-mono font-bold text-violet-900">{successData.credentials.username}</p>
                            </div>
                            <button onClick={() => copyToClipboard(successData.credentials.username, 'username')} className={`p-1.5 rounded-lg transition-all ${copiedField === 'username' ? 'text-emerald-600 bg-emerald-50' : 'text-violet-400 hover:text-violet-700 hover:bg-violet-100'}`}>
                                {copiedField === 'username' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                        </div>

                        {/* Email */}
                        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                <span className="text-sm font-black text-blue-500">@</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">Email</p>
                                <p className="text-sm font-mono font-bold text-blue-900">{successData.credentials.email}</p>
                            </div>
                            <button onClick={() => copyToClipboard(successData.credentials.email, 'email')} className={`p-1.5 rounded-lg transition-all ${copiedField === 'email' ? 'text-emerald-600 bg-emerald-50' : 'text-blue-400 hover:text-blue-700 hover:bg-blue-100'}`}>
                                {copiedField === 'email' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                        </div>

                        {/* Password */}
                        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                            <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                                <KeyRound className="w-4 h-4 text-rose-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-0.5">Password</p>
                                <p className="text-sm font-mono font-bold text-rose-900">
                                    {showPassword ? successData.credentials.password : '••••••••••••'}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => setShowPassword(v => !v)} className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-colors">
                                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => copyToClipboard(successData.credentials.password, 'password')} className={`p-1.5 rounded-lg transition-all ${copiedField === 'password' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-400 hover:text-rose-700 hover:bg-rose-100'}`}>
                                    {copiedField === 'password' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </div>

                        {/* Subscription & Invoice */}
                        {successData.subscription && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 space-y-2">
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <CreditCard className="w-3.5 h-3.5" /> Subscription
                                </p>
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div>
                                        <p className="text-sm font-bold text-emerald-900">{successData.subscription.plan_name}</p>
                                        <p className="text-xs text-emerald-700">Billed {successData.subscription.billing_cycle}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-emerald-800">${successData.subscription.amount.toFixed(2)}</p>
                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                            successData.subscription.is_trial
                                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        }`}>
                                            {successData.subscription.is_trial
                                                ? `Trial — ${successData.subscription.trial_days} days`
                                                : 'Active'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {successData.invoice && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Invoice Generated</p>
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div>
                                        <p className="text-sm font-bold text-amber-900 font-mono">{successData.invoice.invoice_number}</p>
                                        <p className="text-xs text-amber-700">Due: {successData.invoice.due_date}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-amber-800">${successData.invoice.total.toFixed(2)}</p>
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 uppercase">
                                            {successData.invoice.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Copy All */}
                        <button
                            onClick={() => copyToClipboard(
                                [
                                    `Daycare: ${successData.daycareName}`,
                                    `Login URL: ${loginUrl}`,
                                    `Username: ${successData.credentials.username}`,
                                    `Email: ${successData.credentials.email}`,
                                    `Password: ${successData.credentials.password}`,
                                    successData.invoice ? `Invoice: ${successData.invoice.invoice_number} — $${successData.invoice.total.toFixed(2)} (${successData.invoice.status})` : '',
                                ].filter(Boolean).join('\n'),
                                'all'
                            )}
                            className={`w-full py-2.5 text-sm font-bold rounded-xl border transition-all flex items-center justify-center gap-2 ${
                                copiedField === 'all' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            {copiedField === 'all' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copiedField === 'all' ? 'Copied to clipboard!' : 'Copy All Credentials'}
                        </button>

                        <p className="text-xs text-center text-slate-400 font-medium">
                            ⚠️ Save these credentials now — the password will not be shown again.
                        </p>
                    </div>

                    <div className="px-6 pb-6">
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md flex items-center justify-center gap-2"
                        >
                            <Check className="w-5 h-5" /> Done
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    // ────────────────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden my-8 flex flex-col min-h-[600px]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Daycare Onboarding</h2>
                        <p className="text-sm text-gray-500">Setup a new daycare facility, admin account, and billing in one go.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Stepper Progress */}
                <div className="bg-white px-8 py-6 border-b border-gray-100">
                    <div className="flex items-center justify-between relative">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-100 rounded-full z-0"></div>
                        <div 
                            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 rounded-full z-0 transition-all duration-300 ease-in-out" 
                            style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
                        ></div>
                        
                        {steps.map((s) => {
                            const Icon = s.icon;
                            const isActive = step === s.num;
                            const isCompleted = step > s.num;
                            
                            return (
                                <div key={s.num} className="relative z-10 flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                                        isActive ? 'border-indigo-600 bg-white text-indigo-600' : 
                                        isCompleted ? 'border-indigo-600 bg-indigo-600 text-white' : 
                                        'border-gray-200 bg-white text-gray-400'
                                    }`}>
                                        {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                                    </div>
                                    <span className={`mt-2 text-xs font-semibold ${isActive || isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                                        {s.title}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Form Content */}
                <div className="flex-1 p-8 bg-gray-50 overflow-y-auto">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm flex items-start gap-3">
                            <X className="w-5 h-5 text-red-500 mt-0.5" />
                            <div>
                                <h4 className="font-semibold">Onboarding Failed</h4>
                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Facility Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Daycare Name *</label>
                                    <input required type="text" value={daycareData.name} onChange={e => setDaycareData({...daycareData, name: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Happy Kids Academy" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                                    <input required type="email" value={daycareData.email} onChange={e => setDaycareData({...daycareData, email: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="contact@happykids.com" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                                    <input required type="text" value={daycareData.phone} onChange={e => setDaycareData({...daycareData, phone: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="(555) 123-4567" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                                    <input type="text" value={daycareData.license_number} onChange={e => setDaycareData({...daycareData, license_number: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="col-span-full">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                                    <input type="text" value={daycareData.address1} onChange={e => setDaycareData({...daycareData, address1: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                    <input type="text" value={daycareData.city} onChange={e => setDaycareData({...daycareData, city: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">State / Postal Code</label>
                                    <div className="flex gap-2">
                                        <input type="text" value={daycareData.state} onChange={e => setDaycareData({...daycareData, state: e.target.value})} className="w-1/2 border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="State" />
                                        <input type="text" value={daycareData.postal_code} onChange={e => setDaycareData({...daycareData, postal_code: e.target.value})} className="w-1/2 border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Zip" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Administrator Profile</h3>
                            <p className="text-sm text-gray-500 mb-4">This user will have full administrative access to the daycare portal.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                                    <input required type="text" value={adminData.first_name} onChange={e => setAdminData({...adminData, first_name: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                                    <input required type="text" value={adminData.last_name} onChange={e => setAdminData({...adminData, last_name: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="col-span-full">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                                    <input required type="text" value={adminData.username} onChange={e => setAdminData({...adminData, username: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                                    <input required type="email" value={adminData.email} onChange={e => setAdminData({...adminData, email: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                                    <input required type="password" value={adminData.password} onChange={e => setAdminData({...adminData, password: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Select Subscription</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {plans.map(plan => (
                                    <div 
                                        key={plan.id} 
                                        onClick={() => setSubscriptionData({...subscriptionData, plan_id: plan.id})}
                                        className={`cursor-pointer border-2 rounded-xl p-5 transition-all ${subscriptionData.plan_id === plan.id ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-gray-900">{plan.name}</h4>
                                            {subscriptionData.plan_id === plan.id && <CheckCircleIcon className="w-5 h-5 text-indigo-600" />}
                                        </div>
                                        <p className="text-sm text-gray-500 mb-4 h-10">{plan.description}</p>
                                        <div className="text-2xl font-black text-gray-900 mb-1">
                                            ${subscriptionData.billing_cycle === 'Monthly' ? plan.monthly_price : subscriptionData.billing_cycle === 'Quarterly' ? plan.quarterly_price : plan.annual_price}
                                            <span className="text-sm font-medium text-gray-500">/{subscriptionData.billing_cycle === 'Annual' ? 'yr' : subscriptionData.billing_cycle === 'Quarterly' ? 'qtr' : 'mo'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8">
                                <label className="block text-sm font-medium text-gray-700 mb-3">Billing Cycle</label>
                                <div className="flex p-1 bg-gray-200 rounded-lg max-w-md">
                                    {['Monthly', 'Quarterly', 'Annual'].map(cycle => (
                                        <button
                                            key={cycle}
                                            onClick={() => setSubscriptionData({...subscriptionData, billing_cycle: cycle})}
                                            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${subscriptionData.billing_cycle === cycle ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                        >
                                            {cycle}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Review & Finalize</h3>
                            
                            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    
                                    <div>
                                        <h4 className="text-sm uppercase tracking-wider font-bold text-gray-500 mb-4 flex items-center gap-2"><Building2 className="w-4 h-4"/> Daycare Info</h4>
                                        <div className="space-y-2 text-sm">
                                            <p><span className="text-gray-500 w-24 inline-block">Name:</span> <span className="font-semibold text-gray-900">{daycareData.name}</span></p>
                                            <p><span className="text-gray-500 w-24 inline-block">Email:</span> <span className="font-medium text-gray-900">{daycareData.email}</span></p>
                                            <p><span className="text-gray-500 w-24 inline-block">Phone:</span> <span className="font-medium text-gray-900">{daycareData.phone}</span></p>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm uppercase tracking-wider font-bold text-gray-500 mb-4 flex items-center gap-2"><UserCircle className="w-4 h-4"/> Administrator</h4>
                                        <div className="space-y-2 text-sm">
                                            <p><span className="text-gray-500 w-24 inline-block">Name:</span> <span className="font-semibold text-gray-900">{adminData.first_name} {adminData.last_name}</span></p>
                                            <p><span className="text-gray-500 w-24 inline-block">Username:</span> <span className="font-medium text-gray-900">{adminData.username}</span></p>
                                            <p><span className="text-gray-500 w-24 inline-block">Email:</span> <span className="font-medium text-gray-900">{adminData.email}</span></p>
                                        </div>
                                    </div>
                                    
                                    <div className="col-span-full pt-4 border-t border-gray-100">
                                        <h4 className="text-sm uppercase tracking-wider font-bold text-gray-500 mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4"/> Subscription & Billing</h4>
                                        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-indigo-900 text-lg">{getSelectedPlanDetails()?.name || 'No Plan Selected'}</p>
                                                <p className="text-indigo-700 text-sm">Billed {subscriptionData.billing_cycle}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-black text-indigo-700">
                                                    ${subscriptionData.billing_cycle === 'Monthly' ? getSelectedPlanDetails()?.monthly_price : 
                                                      subscriptionData.billing_cycle === 'Quarterly' ? getSelectedPlanDetails()?.quarterly_price : 
                                                      getSelectedPlanDetails()?.annual_price}
                                                </p>
                                                <p className="text-indigo-600/80 text-xs font-medium">Initial invoice will be generated automatically</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-8 py-4 border-t border-gray-100 bg-white flex justify-between items-center rounded-b-2xl">
                    <button 
                        type="button"
                        onClick={step === 1 ? onClose : handlePrev}
                        className="px-5 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                        {step === 1 ? 'Cancel' : <><ChevronLeft className="w-4 h-4" /> Back</>}
                    </button>
                    
                    {step < 4 ? (
                        <button 
                            type="button"
                            onClick={handleNext}
                            disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid) || (step === 3 && !isStep3Valid)}
                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            Continue <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button 
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm shadow-green-600/20 disabled:opacity-60"
                        >
                            {loading ? (
                                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Processing...</>
                            ) : (
                                <><Check className="w-5 h-5" /> Complete Onboarding</>
                            )}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}

const CheckCircleIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 11.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
    </svg>
);
