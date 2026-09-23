import React, { useState } from 'react';
import { XCircle, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import api from '../api';

export default function DaycareOnboardingModal({ isOpen, onClose, onComplete }: { isOpen: boolean, onClose: () => void, onComplete: () => void }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState<any>({
        daycare: {
            name: '',
            email: '',
            phone: '',
            license_number: ''
        },
        admin: {
            username: '',
            password: '',
            first_name: '',
            last_name: ''
        }
    });

    if (!isOpen) return null;

    const handleInputChange = (section: string, e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [section]: { ...formData[section], [e.target.name]: e.target.value }
        });
    };

    const nextStep = () => {
        setError('');
        if (step === 1 && !formData.daycare.name) return setError('Daycare Name is required');
        if (step === 2 && (!formData.admin.username || !formData.admin.password)) return setError('Admin Username and Password are required');
        setStep(step + 1);
    };

    const submit = async () => {
        setLoading(true);
        setError('');
        try {
            await api.post('/super-admin/onboarding/', formData);
            setLoading(false);
            setStep(5); // Success step
        } catch (err: any) {
            setLoading(false);
            setError(err.response?.data?.detail || err.response?.data?.admin?.username?.[0] || 'An error occurred during onboarding. Transaction rolled back.');
        }
    };

    const resetAndClose = () => {
        setStep(1);
        setFormData({ daycare: {}, admin: {} });
        onClose();
        if (step === 5) onComplete();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col h-[550px]">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                    <h3 className="text-lg font-bold text-gray-900">Daycare Onboarding</h3>
                    <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-auto p-6">
                    {/* Stepper */}
                    <div className="flex items-center justify-between mb-8">
                        {['Daycare', 'Admin', 'Review', 'Confirm', 'Done'].map((s, i) => (
                            <div key={i} className={`flex flex-col items-center flex-1 ${i !== 0 ? 'border-t-2' : ''} ${step >= i + 1 ? 'border-indigo-600 text-indigo-600' : 'border-gray-200 text-gray-400'}`}>
                                <div className="text-xs font-semibold uppercase tracking-wider mt-2">
                                    {s}
                                </div>
                            </div>
                        ))}
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> {error}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-4">
                            <h4 className="font-bold text-gray-800 border-b pb-2">Step 1: Daycare Information</h4>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Daycare Name *</label>
                                <input required name="name" value={formData.daycare.name} onChange={(e) => handleInputChange('daycare', e)} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                <input type="email" name="email" value={formData.daycare.email} onChange={(e) => handleInputChange('daycare', e)} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                <input name="phone" value={formData.daycare.phone} onChange={(e) => handleInputChange('daycare', e)} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                                <input name="license_number" value={formData.daycare.license_number} onChange={(e) => handleInputChange('daycare', e)} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        </div>
                    )}
                    
                    {step === 2 && (
                        <div className="space-y-4">
                            <h4 className="font-bold text-gray-800 border-b pb-2">Step 2: Daycare Admin Setup</h4>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Username *</label>
                                <input required name="username" value={formData.admin.username} onChange={(e) => handleInputChange('admin', e)} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                                <input type="password" required name="password" value={formData.admin.password} onChange={(e) => handleInputChange('admin', e)} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                <input name="first_name" value={formData.admin.first_name} onChange={(e) => handleInputChange('admin', e)} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                <input name="last_name" value={formData.admin.last_name} onChange={(e) => handleInputChange('admin', e)} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <h4 className="font-bold text-gray-800 border-b pb-2">Step 3: Review Details</h4>
                            <div className="bg-gray-50 p-4 rounded-lg space-y-3 text-sm">
                                <div>
                                    <h5 className="font-bold text-gray-700">Daycare Profile</h5>
                                    <p className="text-gray-600">Name: <span className="font-medium text-gray-900">{formData.daycare.name}</span></p>
                                    <p className="text-gray-600">Email: {formData.daycare.email || 'N/A'}</p>
                                </div>
                                <div>
                                    <h5 className="font-bold text-gray-700">Admin Account</h5>
                                    <p className="text-gray-600">Username: <span className="font-medium text-gray-900">{formData.admin.username}</span></p>
                                    <p className="text-gray-600">Name: {formData.admin.first_name} {formData.admin.last_name}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-4 text-center py-8">
                            <h4 className="font-bold text-gray-800 text-xl">Confirm Onboarding</h4>
                            <p className="text-gray-500 mb-6">
                                You are about to create the Daycare <strong>{formData.daycare.name}</strong> 
                                and its initial Admin account <strong>{formData.admin.username}</strong>. 
                            </p>
                            <p className="text-sm text-gray-400">
                                This will execute as a single database transaction.
                            </p>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="space-y-4 text-center py-8">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-green-600" />
                            </div>
                            <h4 className="font-bold text-gray-900 text-xl">Daycare Successfully Created!</h4>
                            <p className="text-gray-500">
                                The daycare and admin account have been provisioned successfully. 
                                The Daycare Admin can now log into the portal.
                            </p>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between shrink-0">
                    {step < 5 ? (
                        <>
                            <button onClick={step === 1 ? resetAndClose : () => setStep(step - 1)} disabled={loading} className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50">
                                {step === 1 ? 'Cancel' : 'Back'}
                            </button>
                            {step < 4 ? (
                                <button onClick={nextStep} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium">
                                    Next Step <ChevronRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button onClick={submit} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium shadow-sm disabled:opacity-50">
                                    {loading ? 'Processing...' : <><Check className="w-4 h-4" /> Finalize Creation</>}
                                </button>
                            )}
                        </>
                    ) : (
                        <button onClick={resetAndClose} className="ml-auto px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
