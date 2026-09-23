import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';
import { motion } from 'framer-motion';
import { 
    Building2, Mail, Phone, MapPin, Clock, Users, ShieldCheck, Save, X, Edit2, AlertCircle, CheckCircle2
} from 'lucide-react';

interface DaycareLicense {
    license_number: string;
    license_type: string;
    issuing_authority: string;
    issue_date: string | null;
    expiry_date: string | null;
    document_path: string;
    notes: string;
}

interface DaycareProfile {
    id: string;
    name: string;
    logo: string | null;
    email: string;
    phone: string;
    address1: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
    website: string;
    status: string;
    created_at: string;
    opening_time: string | null;
    closing_time: string | null;
    capacity: number | null;
    license?: DaycareLicense;
}

const UserProfile: React.FC = () => {
    const [profile, setProfile] = useState<DaycareProfile | null>(null);
    const [formData, setFormData] = useState<DaycareProfile | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await api.get('/daycare/profile/');
            setProfile(response.data);
            setFormData(response.data);
        } catch (error) {
            console.error("Failed to load profile", error);
            showNotification('error', 'Failed to load profile data.');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!formData) return;
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleLicenseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!formData) return;
        const { name, value } = e.target;
        setFormData({ 
            ...formData, 
            license: { 
                ...(formData.license || {} as DaycareLicense), 
                [name]: value 
            } 
        });
    };

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Sanitize payload to replace empty strings with null for non-text fields
            const payload: any = { ...formData };
            if (payload.opening_time === '') payload.opening_time = null;
            if (payload.closing_time === '') payload.closing_time = null;
            if (payload.capacity === '' || (payload.capacity as any) === '' || payload.capacity === undefined) payload.capacity = null;
            
            if (payload.license) {
                const licensePayload: any = { ...payload.license };
                if (licensePayload.issue_date === '') licensePayload.issue_date = null;
                if (licensePayload.expiry_date === '') licensePayload.expiry_date = null;
                payload.license = licensePayload;
            }

            const response = await api.patch('/daycare/profile/', payload);
            setProfile(response.data);
            setFormData(response.data);
            setIsEditing(false);
            showNotification('success', 'Profile updated successfully.');
        } catch (error: any) {
            console.error("Failed to update profile", error);
            showNotification('error', error.response?.data?.detail || JSON.stringify(error.response?.data) || 'Failed to update profile. Please check the inputs.');
        } finally {
            setSaving(false);
        }
    };

    const cancelEditing = () => {
        setFormData(profile);
        setIsEditing(false);
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-full min-h-[500px]">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
            </Layout>
        );
    }

    if (!profile || !formData) return null;

    const InputField = ({ label, name, value, onChange, icon: Icon, type = "text", required = false, isLicense = false }: any) => (
        <div className="space-y-1 relative">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                    type={type}
                    name={name}
                    value={value || ''}
                    onChange={isLicense ? handleLicenseChange : onChange}
                    disabled={!isEditing}
                    required={required}
                    className={`block w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm transition-all
                        ${isEditing 
                            ? 'bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 shadow-sm' 
                            : 'bg-slate-50 border-transparent text-slate-700 cursor-not-allowed'
                        }`}
                />
            </div>
        </div>
    );

    return (
        <Layout>
            <div className="max-w-5xl mx-auto pb-12 relative">
                
                {/* Notification Toast */}
                {notification && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 ${notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}
                    >
                        {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                        <span className="font-medium text-sm">{notification.message}</span>
                    </motion.div>
                )}

                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Daycare Profile</h1>
                        <p className="text-slate-500 mt-1">Manage your daycare's public and licensing information.</p>
                    </div>
                    {!isEditing ? (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                        >
                            <Edit2 className="w-4 h-4" />
                            Edit Profile
                        </button>
                    ) : (
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={cancelEditing}
                                disabled={saving}
                                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <X className="w-4 h-4" />
                                Cancel
                            </button>
                            <button 
                                onClick={handleSubmit}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Save Changes
                            </button>
                        </div>
                    )}
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                    
                    {/* Basic Info & Contact */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-800">Basic Information</h2>
                            </div>
                            
                            <InputField label="Daycare Name" name="name" value={formData.name} onChange={handleInputChange} icon={Building2} required />
                            <InputField label="Logo URL" name="logo" value={formData.logo} onChange={handleInputChange} icon={Building2} />
                            
                            <div className="pt-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">System Status</label>
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium border border-slate-200 cursor-not-allowed">
                                    <ShieldCheck className="w-4 h-4" />
                                    {profile.status} (Managed by Super Admin)
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Phone className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-800">Contact Information</h2>
                            </div>
                            
                            <InputField label="Email Address" name="email" value={formData.email} onChange={handleInputChange} icon={Mail} type="email" required />
                            <InputField label="Phone Number" name="phone" value={formData.phone} onChange={handleInputChange} icon={Phone} required />
                        </div>
                    </div>

                    {/* Address & Operations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                    <MapPin className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-800">Address</h2>
                            </div>
                            
                            <InputField label="Address Line 1" name="address1" value={formData.address1} onChange={handleInputChange} icon={MapPin} />
                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="City" name="city" value={formData.city} onChange={handleInputChange} icon={MapPin} />
                                <InputField label="State / Province" name="state" value={formData.state} onChange={handleInputChange} icon={MapPin} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Postal Code" name="postal_code" value={formData.postal_code} onChange={handleInputChange} icon={MapPin} />
                                <InputField label="Country" name="country" value={formData.country} onChange={handleInputChange} icon={MapPin} />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-800">Operations & Capacity</h2>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Opening Time" name="opening_time" value={formData.opening_time} onChange={handleInputChange} icon={Clock} type="time" />
                                <InputField label="Closing Time" name="closing_time" value={formData.closing_time} onChange={handleInputChange} icon={Clock} type="time" />
                            </div>
                            
                            <InputField label="Maximum Capacity (Students)" name="capacity" value={formData.capacity} onChange={handleInputChange} icon={Users} type="number" />
                        </div>
                    </div>

                    {/* Licensing Information */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800">Licensing Information</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField label="License Number" name="license_number" value={formData.license?.license_number} onChange={handleInputChange} icon={ShieldCheck} isLicense />
                            <InputField label="License Type" name="license_type" value={formData.license?.license_type} onChange={handleInputChange} icon={ShieldCheck} isLicense />
                            <InputField label="Issuing Authority" name="issuing_authority" value={formData.license?.issuing_authority} onChange={handleInputChange} icon={Building2} isLicense />
                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Issue Date" name="issue_date" value={formData.license?.issue_date} onChange={handleInputChange} icon={Clock} type="date" isLicense />
                                <InputField label="Expiry Date" name="expiry_date" value={formData.license?.expiry_date} onChange={handleInputChange} icon={Clock} type="date" isLicense />
                            </div>
                        </div>
                    </div>
                    
                </form>
            </div>
        </Layout>
    );
};

export default UserProfile;
