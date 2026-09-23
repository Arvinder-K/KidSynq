import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../api';
import { 
    Users, Mail, MapPin, Save, X, Edit2, AlertCircle, CheckCircle2, Info
} from 'lucide-react';

interface FamilyProfileData {
    id: string;
    family_name: string;
    status: string;
    primary_contact: string | null;
    primary_email: string | null;
    primary_phone: string | null;
    address: string | null;
    notes: string | null;
}

const FamilyProfile: React.FC = () => {
    const [profile, setProfile] = useState<FamilyProfileData | null>(null);
    const [formData, setFormData] = useState<FamilyProfileData | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    useEffect(() => {
        fetchFamilyProfile();
    }, []);

    const fetchFamilyProfile = async () => {
        try {
            const response = await api.get('/family/profile/');
            setProfile(response.data);
            setFormData(response.data);
        } catch (error) {
            console.error("Failed to fetch family profile", error);
            showNotification('error', 'Failed to load family profile.');
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
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData) return;
        setSaving(true);
        try {
            const response = await api.patch('/family/profile/', formData);
            setProfile(response.data);
            setFormData(response.data);
            setIsEditing(false);
            showNotification('success', 'Family profile updated successfully.');
        } catch (error: any) {
            console.error("Failed to update family profile", error);
            showNotification('error', error.response?.data?.detail || 'Failed to update profile. Please verify your inputs.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
            </Layout>
        );
    }

    if (!profile) {
        return (
            <Layout>
                <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 flex items-center gap-3">
                    <AlertCircle className="w-6 h-6" />
                    <p className="font-medium">Failed to load family configuration.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-4xl mx-auto space-y-6">
                
                {/* Notification Toast */}
                {notification && (
                    <div className={`p-4 rounded-xl border flex items-center gap-3 shadow-sm ${
                        notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                    }`}>
                        {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="text-sm font-medium">{notification.message}</span>
                    </div>
                )}

                {/* Hero Header */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-indigo-50/50 to-transparent pointer-events-none"></div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                <Users className="w-8 h-8" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-extrabold text-slate-800">{profile.family_name}</h1>
                                <p className="text-sm text-slate-500 font-medium">Family Account Details</p>
                            </div>
                        </div>
                        
                        {!isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors text-sm font-semibold border border-indigo-100"
                            >
                                <Edit2 className="w-4 h-4" />
                                Edit Family Profile
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <form onSubmit={handleSubmit} className="divide-y divide-slate-100">
                        
                        {/* Section 1: Basic Family Info */}
                        <div className="p-6 sm:p-8 space-y-6">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Info className="w-5 h-5 text-indigo-500" />
                                General Information
                            </h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Family Name</label>
                                    <input
                                        type="text"
                                        name="family_name"
                                        disabled={!isEditing}
                                        value={formData?.family_name || ''}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 transition-all font-medium"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
                                    <div className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-600 capitalize">
                                        {profile.status}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Contact Person */}
                        <div className="p-6 sm:p-8 space-y-6">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Mail className="w-5 h-5 text-indigo-500" />
                                Primary Contact Info
                            </h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Contact Name</label>
                                    <input
                                        type="text"
                                        name="primary_contact"
                                        disabled={!isEditing}
                                        value={formData?.primary_contact || ''}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 transition-all font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Email</label>
                                    <input
                                        type="email"
                                        name="primary_email"
                                        disabled={!isEditing}
                                        value={formData?.primary_email || ''}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 transition-all font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Phone</label>
                                    <input
                                        type="text"
                                        name="primary_phone"
                                        disabled={!isEditing}
                                        value={formData?.primary_phone || ''}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 transition-all font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Address & Notes */}
                        <div className="p-6 sm:p-8 space-y-6">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-indigo-500" />
                                Address & Additional Details
                            </h2>
                            
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Family Address</label>
                                    <textarea
                                        name="address"
                                        rows={3}
                                        disabled={!isEditing}
                                        value={formData?.address || ''}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 transition-all font-medium resize-none"
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Family Notes</label>
                                    <textarea
                                        name="notes"
                                        rows={3}
                                        disabled={!isEditing}
                                        value={formData?.notes || ''}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 transition-all font-medium resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Actions footer */}
                        {isEditing && (
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormData(profile);
                                        setIsEditing(false);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 text-sm font-semibold"
                                >
                                    <X className="w-4 h-4" />
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition-all border border-indigo-600 text-sm font-semibold shadow-md shadow-indigo-600/10 disabled:opacity-55"
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </Layout>
    );
};

export default FamilyProfile;
