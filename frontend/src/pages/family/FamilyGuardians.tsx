import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../api';
import { 
    Plus, Mail, Phone, Edit, AlertCircle, 
    CheckCircle2, X, ShieldAlert, Star
} from 'lucide-react';

interface CommunicationPreferences {
    email_alerts: boolean;
    sms_alerts: boolean;
    emergency_alerts_only: boolean;
}

interface GuardianData {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    email: string | null;
    phone: string | null;
    relationship: string;
    is_primary: boolean;
    status: string;
    communication_preferences: CommunicationPreferences;
}

const relationshipsList = [
    'Mother', 'Father', 'Parent', 'Guardian', 'Grandparent', 'Foster parent', 'Other'
];

const FamilyGuardians: React.FC = () => {
    const [guardians, setGuardians] = useState<GuardianData[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGuardian, setEditingGuardian] = useState<GuardianData | null>(null);
    const [deactivatingGuardian, setDeactivatingGuardian] = useState<GuardianData | null>(null);
    const [formData, setFormData] = useState<Partial<GuardianData>>({
        first_name: '',
        last_name: '',
        preferred_name: '',
        email: '',
        phone: '',
        relationship: 'Mother',
        is_primary: false,
        communication_preferences: {
            email_alerts: true,
            sms_alerts: false,
            emergency_alerts_only: false
        }
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchGuardians();
    }, []);

    const fetchGuardians = async () => {
        try {
            const response = await api.get('/family/guardians/');
            setGuardians(response.data);
        } catch (error) {
            console.error("Failed to fetch family guardians", error);
            showNotification('error', 'Failed to load family guardians.');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    const handleOpenAddModal = () => {
        setEditingGuardian(null);
        setFormData({
            first_name: '',
            last_name: '',
            preferred_name: '',
            email: '',
            phone: '',
            relationship: 'Mother',
            is_primary: false,
            communication_preferences: {
                email_alerts: true,
                sms_alerts: false,
                emergency_alerts_only: false
            }
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (guardian: GuardianData) => {
        setEditingGuardian(guardian);
        setFormData({
            first_name: guardian.first_name,
            last_name: guardian.last_name,
            preferred_name: guardian.preferred_name || '',
            email: guardian.email || '',
            phone: guardian.phone || '',
            relationship: guardian.relationship,
            is_primary: guardian.is_primary,
            communication_preferences: {
                ...guardian.communication_preferences
            }
        });
        setIsModalOpen(true);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingGuardian) {
                // PATCH update
                const response = await api.patch(`/family/guardians/${editingGuardian.id}/`, formData);
                setGuardians(guardians.map(g => g.id === editingGuardian.id ? response.data : g));
                showNotification('success', 'Guardian details updated successfully.');
            } else {
                // POST create
                const response = await api.post('/family/guardians/', formData);
                setGuardians([...guardians, response.data]);
                showNotification('success', 'Guardian added successfully. A temporary password was created if an email was provided.');
            }
            setIsModalOpen(false);
        } catch (error: any) {
            console.error("Failed to save guardian", error);
            showNotification('error', error.response?.data?.detail || 'Failed to save guardian. Please verify inputs.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async () => {
        if (!deactivatingGuardian) return;
        setSaving(true);
        try {
            await api.delete(`/family/guardians/${deactivatingGuardian.id}/`);
            setGuardians(guardians.map(g => g.id === deactivatingGuardian.id ? { ...g, status: 'Inactive' } : g));
            showNotification('success', 'Guardian deactivated successfully.');
            setDeactivatingGuardian(null);
        } catch (error: any) {
            console.error("Failed to deactivate guardian", error);
            showNotification('error', error.response?.data?.detail || 'Failed to deactivate guardian.');
        } finally {
            setSaving(false);
        }
    };

    const handlePrefChange = (pref: keyof CommunicationPreferences) => {
        const currentPrefs = formData.communication_preferences || {
            email_alerts: true,
            sms_alerts: false,
            emergency_alerts_only: false
        };
        setFormData({
            ...formData,
            communication_preferences: {
                ...currentPrefs,
                [pref]: !currentPrefs[pref]
            }
        });
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

    return (
        <Layout>
            <div className="space-y-6">
                
                {/* Notification */}
                {notification && (
                    <div className={`p-4 rounded-xl border flex items-center gap-3 shadow-sm ${
                        notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                    }`}>
                        {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="text-sm font-medium">{notification.message}</span>
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-800">Family Guardians</h1>
                        <p className="text-sm text-slate-500 font-medium">Manage family contacts, pickup authorizations, and notification alerts.</p>
                    </div>
                    <button
                        onClick={handleOpenAddModal}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Add Guardian
                    </button>
                </div>

                {/* Guardians Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {guardians.map((g) => (
                        <div key={g.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
                            {g.is_primary && (
                                <div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-1 rounded-bl-xl flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                                    <Star className="w-3 h-3 fill-current" />
                                    Primary Contact
                                </div>
                            )}
                            
                            <div className="space-y-5">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                                            {g.first_name[0]}{g.last_name[0]}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-base">{g.first_name} {g.last_name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs bg-slate-100 border border-slate-200 text-slate-600 font-semibold px-2 py-0.5 rounded-md">{g.relationship}</span>
                                                <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-600 font-semibold px-2 py-0.5 rounded-md capitalize">{g.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                        <span>{g.email || 'No email provided'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-slate-400" />
                                        <span>{g.phone || 'No phone number'}</span>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-4 space-y-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Communication Preferences</span>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                                            g.communication_preferences.email_alerts ? 'bg-indigo-50/50 text-indigo-700 border-indigo-150' : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                                        }`}>
                                            Email Alerts
                                        </span>
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                                            g.communication_preferences.sms_alerts ? 'bg-indigo-50/50 text-indigo-700 border-indigo-150' : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                                        }`}>
                                            SMS Alerts
                                        </span>
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                                            g.communication_preferences.emergency_alerts_only ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'
                                        }`}>
                                            {g.communication_preferences.emergency_alerts_only ? 'Emergency Only' : 'All Alerts'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                                <button
                                    onClick={() => setDeactivatingGuardian(g)}
                                    disabled={g.status === 'Inactive'}
                                    className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <X className="w-4 h-4" />
                                    Deactivate
                                </button>
                                <button
                                    onClick={() => handleOpenEditModal(g)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                    <Edit className="w-3.5 h-3.5" />
                                    Edit Details
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add/Edit Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
                            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                                <div>
                                    <h3 className="font-extrabold text-lg">{editingGuardian ? 'Edit Guardian Details' : 'Add Family Guardian'}</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Define contact information and relationship type.</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <form onSubmit={handleFormSubmit}>
                                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">First Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.first_name || ''}
                                                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Last Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.last_name || ''}
                                                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-sm"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preferred Name</label>
                                        <input
                                            type="text"
                                            value={formData.preferred_name || ''}
                                            onChange={e => setFormData({ ...formData, preferred_name: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-sm"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                                        <input
                                            type="email"
                                            required={!editingGuardian}
                                            disabled={!!editingGuardian}
                                            value={formData.email || ''}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 font-medium text-sm"
                                        />
                                        {!editingGuardian && <p className="text-[10px] text-slate-400">Creating a guardian will automatically configure a login user with password: <strong>TempPass123!</strong></p>}
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                                        <input
                                            type="text"
                                            value={formData.phone || ''}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-sm"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Relationship to Child</label>
                                            <select
                                                value={formData.relationship || 'Mother'}
                                                onChange={e => setFormData({ ...formData, relationship: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-sm"
                                            >
                                                {relationshipsList.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Guardian</label>
                                            <div className="flex items-center gap-2 h-[38px]">
                                                <input
                                                    type="checkbox"
                                                    id="is_primary"
                                                    checked={formData.is_primary || false}
                                                    onChange={e => setFormData({ ...formData, is_primary: e.target.checked })}
                                                    className="w-4 h-4 border border-slate-300 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <label htmlFor="is_primary" className="text-sm font-semibold text-slate-700 select-none">Set Primary Contact</label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-100 pt-4 space-y-3">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alert Preferences</label>
                                        
                                        <div className="flex flex-col gap-2.5">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="email_alerts"
                                                    checked={formData.communication_preferences?.email_alerts ?? true}
                                                    onChange={() => handlePrefChange('email_alerts')}
                                                    className="w-4 h-4 border border-slate-300 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <label htmlFor="email_alerts" className="text-sm font-medium text-slate-600 flex items-center gap-1.5 select-none">
                                                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                    Enable Email Notifications
                                                </label>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="sms_alerts"
                                                    checked={formData.communication_preferences?.sms_alerts ?? false}
                                                    onChange={() => handlePrefChange('sms_alerts')}
                                                    className="w-4 h-4 border border-slate-300 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <label htmlFor="sms_alerts" className="text-sm font-medium text-slate-600 flex items-center gap-1.5 select-none">
                                                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                    Enable SMS Alerts
                                                </label>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="emergency_alerts_only"
                                                    checked={formData.communication_preferences?.emergency_alerts_only ?? false}
                                                    onChange={() => handlePrefChange('emergency_alerts_only')}
                                                    className="w-4 h-4 border border-slate-300 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <label htmlFor="emergency_alerts_only" className="text-sm font-medium text-slate-600 flex items-center gap-1.5 select-none">
                                                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                                                    Send Emergency Alerts Only
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 text-sm font-semibold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition-all border border-indigo-600 text-sm font-semibold shadow-md shadow-indigo-600/10 disabled:opacity-55"
                                    >
                                        {saving ? 'Saving...' : 'Save Guardian'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Deactivate Modal */}
                {deactivatingGuardian && (
                    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full overflow-hidden p-6">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                                    <ShieldAlert className="w-8 h-8 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-lg text-slate-800">Deactivate Guardian?</h3>
                                    <p className="text-sm text-slate-500 mt-2">
                                        Are you sure you want to deactivate {deactivatingGuardian.first_name}? This action may require daycare approval.
                                    </p>
                                </div>
                                <div className="flex w-full gap-3 pt-4">
                                    <button
                                        onClick={() => setDeactivatingGuardian(null)}
                                        className="flex-1 px-4 py-2 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 text-sm font-semibold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDeactivate}
                                        disabled={saving}
                                        className="flex-1 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-xl transition-all border border-red-600 text-sm font-semibold shadow-md disabled:opacity-55"
                                    >
                                        {saving ? 'Processing...' : 'Deactivate'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </Layout>
    );
};

export default FamilyGuardians;
