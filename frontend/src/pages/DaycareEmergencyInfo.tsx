import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api';
import { motion } from 'framer-motion';
import { ShieldAlert, Phone, Mail, MapPin, Edit2, X, Save, AlertCircle, CheckCircle2, ShieldPlus, Hospital, Siren } from 'lucide-react';

interface EmergencyInfo {
    contact_name: string;
    phone: string;
    alternate_phone: string;
    email: string;
    address: string;
    police_contact: string;
    fire_service_contact: string;
    hospital_contact: string;
    additional_instructions: string;
}

const DaycareEmergencyInfo: React.FC = () => {
    const [info, setInfo] = useState<EmergencyInfo | null>(null);
    const [formData, setFormData] = useState<EmergencyInfo | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{type: 'success'|'error', message: string} | null>(null);

    useEffect(() => {
        fetchInfo();
    }, []);

    const fetchInfo = async () => {
        try {
            const response = await api.get('/daycare/emergency-information/');
            setInfo(response.data);
            setFormData(response.data);
        } catch (error) {
            showNotification('error', 'Failed to load emergency info.');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!formData) return;
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const response = await api.patch('/daycare/emergency-information/', formData);
            setInfo(response.data);
            setFormData(response.data);
            setIsEditing(false);
            showNotification('success', 'Emergency information updated.');
        } catch (error: any) {
            showNotification('error', 'Failed to save information.');
        } finally {
            setSaving(false);
        }
    };

    const InputField = ({ label, name, value, icon: Icon, required = false }: any) => (
        <div className="space-y-1 relative">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                    type="text"
                    name={name}
                    value={value || ''}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    required={required}
                    className={`block w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm transition-all ${isEditing ? 'bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-transparent text-slate-700'}`}
                />
            </div>
        </div>
    );

    if (loading) return <Layout><div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div></Layout>;
    if (!formData) return null;

    return (
        <Layout>
            <div className="max-w-5xl mx-auto pb-12 relative">
                {notification && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 ${notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                        <span className="font-medium text-sm">{notification.message}</span>
                    </motion.div>
                )}

                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Emergency Information
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Manage daycare emergency contacts and protocols.</p>
                    </div>
                    {!isEditing ? (
                        <button onClick={() => setIsEditing(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-2"><Edit2 className="w-4 h-4" /> Edit Info</button>
                    ) : (
                        <div className="flex gap-3">
                            <button onClick={() => { setFormData(info); setIsEditing(false); }} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"><X className="w-4 h-4" /> Cancel</button>
                            <button onClick={handleSubmit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-2">
                                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />} Save
                            </button>
                        </div>
                    )}
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><ShieldAlert className="w-5 h-5" /></div>
                                <h2 className="text-lg font-bold text-slate-800">Primary Contact</h2>
                            </div>
                            <InputField label="Contact Name" name="contact_name" value={formData.contact_name} icon={ShieldAlert} required />
                            <InputField label="Primary Phone" name="phone" value={formData.phone} icon={Phone} required />
                            <InputField label="Alternate Phone" name="alternate_phone" value={formData.alternate_phone} icon={Phone} />
                            <InputField label="Email Address" name="email" value={formData.email} icon={Mail} />
                            <InputField label="Physical Address" name="address" value={formData.address} icon={MapPin} />
                        </div>

                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                                    <div className="p-2 bg-red-50 text-red-600 rounded-lg"><Siren className="w-5 h-5" /></div>
                                    <h2 className="text-lg font-bold text-slate-800">Emergency Services</h2>
                                </div>
                                <InputField label="Police Contact" name="police_contact" value={formData.police_contact} icon={ShieldPlus} />
                                <InputField label="Fire Service Contact" name="fire_service_contact" value={formData.fire_service_contact} icon={ShieldAlert} />
                                <InputField label="Hospital Contact" name="hospital_contact" value={formData.hospital_contact} icon={Hospital} />
                            </div>

                            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                                    <h2 className="text-lg font-bold text-slate-800">Additional Instructions</h2>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Protocol Notes</label>
                                    <textarea
                                        name="additional_instructions"
                                        value={formData.additional_instructions || ''}
                                        onChange={handleInputChange}
                                        disabled={!isEditing}
                                        rows={4}
                                        className={`block w-full p-3 border rounded-xl text-sm transition-all ${isEditing ? 'bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-transparent text-slate-700'}`}
                                        placeholder="Any specific emergency protocols..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </Layout>
    );
};

export default DaycareEmergencyInfo;
