import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import api from '../../api';
import type { Child } from './ChildProfileLayout';
import { Phone, Mail, User, Plus, Edit2, Trash2, Shield, Heart, Users } from 'lucide-react';
import ConfirmationDialog from '../../components/ConfirmationDialog';

interface ContextType {
    child: Child;
    refreshChild: () => void;
}

interface EmergencyContact {
    id: string;
    name: string;
    relationship: string;
    mobile: string;
    email: string | null;
    is_primary: boolean;
    created_at: string;
    approval_status: string;
    pending_changes?: any;
}

interface GuardianDetails {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    email: string;
    phone: string;
    relationship: string;
    is_primary: boolean;
    communication_preferences: {
        email_alerts: boolean;
        sms_alerts: boolean;
        emergency_alerts_only: boolean;
    };
}

interface Invitation {
    id: string;
    email: string;
    relationship: string;
    status: string;
    invited_by_name: string;
    created_at: string;
    is_expired: boolean;
}

const ChildEmergency: React.FC = () => {
    const outletContext = useOutletContext<ContextType>();
    const { id: routeId } = useParams<{ id: string }>();
    const childId = outletContext?.child?.id || routeId || '';
    
    const [contacts, setContacts] = useState<EmergencyContact[]>([]);
    const [guardians, setGuardians] = useState<GuardianDetails[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        relationship: '',
        mobile: '',
        email: '',
        is_primary: false
    });
    
    // Add Guardian Modal State
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteForm, setInviteForm] = useState({ first_name: '', last_name: '', email: '', password: '', relationship: 'Mother' });
    const [inviting, setInviting] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);

    // Delete Confirmation State
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [contactToDelete, setContactToDelete] = useState<EmergencyContact | null>(null);

    const fetchData = async () => {
        if (!childId) return;
        try {
            const [contactsRes, guardiansRes, invitationsRes] = await Promise.allSettled([
                api.get(`/daycare/children/${childId}/emergency-contacts/`),
                api.get(`/daycare/children/${childId}/guardians/`),
                api.get(`/daycare/invitations/?student_id=${childId}`)
            ]);

            if (contactsRes.status === 'fulfilled') {
                setContacts(contactsRes.value.data || []);
            }
            if (guardiansRes.status === 'fulfilled') {
                setGuardians(guardiansRes.value.data || []);
            }
            if (invitationsRes.status === 'fulfilled') {
                setInvitations(invitationsRes.value.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch child emergency/guardian data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (childId) {
            fetchData();
        }
    }, [childId]);

    const handleOpenModal = (contact?: EmergencyContact) => {
        if (contact) {
            setEditingContact(contact);
            setFormData({
                name: contact.name,
                relationship: contact.relationship,
                mobile: contact.mobile,
                email: contact.email || '',
                is_primary: contact.is_primary
            });
        } else {
            setEditingContact(null);
            setFormData({
                name: '',
                relationship: '',
                mobile: '',
                email: '',
                is_primary: false
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingContact) {
                await api.patch(`/daycare/emergency-contacts/${editingContact.id}/`, formData);
            } else {
                await api.post(`/daycare/children/${childId}/emergency-contacts/`, formData);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error("Failed to save emergency contact:", error);
        }
    };

    const confirmDelete = (contact: EmergencyContact) => {
        setContactToDelete(contact);
        setDeleteConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (contactToDelete) {
            try {
                await api.delete(`/daycare/emergency-contacts/${contactToDelete.id}/`);
                fetchData();
            } catch (error) {
                console.error("Failed to delete emergency contact:", error);
            } finally {
                setDeleteConfirmOpen(false);
                setContactToDelete(null);
            }
        }
    };

    const handleApprove = async (contactId: string) => {
        try {
            await api.post(`/daycare/emergency-contacts/${contactId}/approve/`);
            fetchData();
        } catch (error) { console.error("Failed to approve contact changes:", error); }
    };

    const handleReject = async (contactId: string) => {
        try {
            await api.post(`/daycare/emergency-contacts/${contactId}/reject/`);
            fetchData();
        } catch (error) { console.error("Failed to reject contact changes:", error); }
    };

    const handleSetPrimary = async (contact: EmergencyContact) => {
        try {
            await api.patch(`/daycare/emergency-contacts/${contact.id}/`, { is_primary: true });
            fetchData();
        } catch (error) {
            console.error("Failed to set primary contact:", error);
        }
    };

    // Guardian invitation handlers
    const handleSendInvitation = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        setInviteError(null);
        try {
            await api.post(`/daycare/children/${childId}/add_guardian/`, inviteForm);
            setIsInviteModalOpen(false);
            setInviteForm({ first_name: '', last_name: '', email: '', password: '', relationship: 'Mother' });
            fetchData();
        } catch (err: any) {
            console.error("Error adding guardian:", err);
            const msg = err.response?.data?.detail || 
                        (typeof err.response?.data === 'string' ? err.response.data : null) ||
                        (err.response?.data && typeof err.response.data === 'object' ? Object.values(err.response.data).flat().join(', ') : null) ||
                        'Failed to add guardian.';
            setInviteError(msg);
        } finally {

            setInviting(false);
        }
    };

    const handleResendInvitation = async (id: string) => {
        try {
            await api.post(`/daycare/invitations/${id}/resend/`);
            alert('Invitation resent successfully.');
            fetchData();
        } catch (err) {
            console.error("Error resending invitation:", err);
        }
    };

    const handleCancelInvitation = async (id: string) => {
        if (!confirm('Are you sure you want to cancel this invitation?')) return;
        try {
            await api.post(`/daycare/invitations/${id}/cancel/`);
            fetchData();
        } catch (err) {
            console.error("Error cancelling invitation:", err);
        }
    };

    const handleRemoveGuardian = async (guardianId: string) => {
        if (!confirm('Are you sure you want to remove this guardian from the family?')) return;
        try {
            await api.post(`/daycare/children/${childId}/remove_guardian/`, { guardian_id: guardianId });
            fetchData();
        } catch (err) {
            console.error("Error removing guardian:", err);
            alert("Failed to remove guardian.");
        }
    };

    if (loading) {
        return (
            <div className="py-12 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            {/* 1. Linked Family Guardians Section */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                        <Users className="w-6 h-6 text-emerald-600" />
                        <span>Family Guardians (Parents)</span>
                    </h2>
                    <button
                        onClick={() => setIsInviteModalOpen(true)}
                        className="inline-flex items-center space-x-2 px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Guardian</span>
                    </button>
                </div>

                {guardians.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
                        No family guardians have been added yet. Use the Add Guardian button to link parents.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {guardians.map((g) => (
                            <div key={g.id} className={`bg-white p-5 rounded-xl border ${g.is_primary ? 'border-emerald-350 ring-1 ring-emerald-50 shadow-sm' : 'border-gray-200'} relative`}>
                                {g.is_primary && (
                                    <div className="absolute top-0 right-0 -mt-2 -mr-2 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold uppercase rounded-full shadow-sm flex items-center space-x-1">
                                        <Heart className="w-3 h-3" />
                                        <span>Primary Guardian</span>
                                    </div>
                                )}
                                <div className="flex items-start space-x-3">
                                    <div className={`p-2 rounded-full ${g.is_primary ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                                        <User className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="text-lg font-medium text-gray-900">{g.first_name} {g.last_name}</h3>
                                                <p className="text-sm text-gray-500">{g.relationship}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveGuardian(g.id)}
                                                title="Remove Guardian"
                                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="mt-3 space-y-1.5">
                                            <div className="flex items-center text-sm text-gray-600">
                                                <Phone className="w-4 h-4 mr-2 text-gray-400" />
                                                {g.phone}
                                            </div>
                                            <div className="flex items-center text-sm text-gray-600">
                                                <Mail className="w-4 h-4 mr-2 text-gray-400" />
                                                {g.email}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 2. Guardian Invitations Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                    <Mail className="w-6 h-6 text-purple-600" />
                    <span>Guardian Invitations</span>
                </h2>
                {invitations.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
                        No pending guardian invitations found.
                    </div>
                ) : (
                    <div className="bg-white shadow sm:rounded-lg overflow-hidden border border-gray-200">
                        <ul className="divide-y divide-gray-200">
                            {invitations.map((inv) => (
                                <li key={inv.id} className="px-5 py-4 flex justify-between items-center hover:bg-gray-50">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-gray-900">{inv.email}</p>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                                                inv.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                                inv.status === 'pending' && !inv.is_expired ? 'bg-yellow-100 text-yellow-800' :
                                                inv.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {inv.status === 'pending' && inv.is_expired ? 'expired' : inv.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Role: <strong>{inv.relationship}</strong> • Invited by {inv.invited_by_name} on {new Date(inv.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {inv.status === 'pending' && !inv.is_expired && (
                                            <>
                                                <button onClick={() => handleResendInvitation(inv.id)} className="text-indigo-600 hover:text-indigo-900 text-xs font-semibold">Resend</button>
                                                <button onClick={() => handleCancelInvitation(inv.id)} className="text-red-650 hover:text-red-900 text-xs font-semibold">Cancel</button>
                                            </>
                                        )}
                                        {inv.status === 'expired' && (
                                            <button onClick={() => handleResendInvitation(inv.id)} className="text-indigo-600 hover:text-indigo-900 text-xs font-semibold">Re-invite</button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* 3. Non-Parent Emergency Contacts Section */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                        <Shield className="w-6 h-6 text-red-500" />
                        <span>Emergency Contacts (Non-Parent)</span>
                    </h2>
                    <button
                        onClick={() => handleOpenModal()}
                        className="inline-flex items-center space-x-2 px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Contact</span>
                    </button>
                </div>

                {contacts.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
                        No additional emergency contacts listed.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {contacts.map((contact) => (
                            <div key={contact.id} className={`bg-white p-5 rounded-xl border ${contact.is_primary ? 'border-red-300 ring-1 ring-red-100 shadow-sm' : 'border-gray-200'} relative`}>
                                {contact.is_primary && (
                                    <div className="absolute top-0 right-0 -mt-2 -mr-2 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold uppercase rounded-full shadow-sm flex items-center space-x-1">
                                        <Heart className="w-3 h-3" />
                                        <span>Primary Contact</span>
                                    </div>
                                )}
                                
                                <div className="flex justify-between items-start">
                                    <div className="flex items-start space-x-3">
                                        <div className={`p-2 rounded-full ${contact.is_primary ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                            <User className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-medium text-gray-900">{contact.name}</h3>
                                            <p className="text-sm text-gray-500">{contact.relationship}</p>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        {!contact.is_primary && (
                                            <button
                                                onClick={() => handleSetPrimary(contact)}
                                                className="text-gray-400 hover:text-red-600 p-1"
                                                title="Set as Primary"
                                            >
                                                <Heart className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleOpenModal(contact)}
                                            className="text-gray-400 hover:text-indigo-600 p-1"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => confirmDelete(contact)}
                                            className="text-gray-400 hover:text-red-600 p-1"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Phone className="w-4 h-4 mr-2 text-gray-400" />
                                        {contact.mobile}
                                    </div>
                                    {contact.email && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <Mail className="w-4 h-4 mr-2 text-gray-400" />
                                            {contact.email}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                        contact.approval_status === 'Approved' ? 'bg-green-100 text-green-800' :
                                        contact.approval_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                        contact.approval_status === 'Pending_Removal' ? 'bg-orange-100 text-orange-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {contact.approval_status?.replace('_', ' ')}
                                    </span>
                                    
                                    {(contact.approval_status === 'Pending' || contact.approval_status === 'Pending_Removal') && (
                                        <div className="flex gap-2">
                                            <button onClick={() => handleApprove(contact.id)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 font-medium">Approve</button>
                                            <button onClick={() => handleReject(contact.id)} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100 font-medium">Reject</button>
                                        </div>
                                    )}
                                </div>
                                
                                {contact.pending_changes && Object.keys(contact.pending_changes).length > 0 && (
                                    <div className="mt-2 bg-yellow-50 p-2 rounded text-xs text-yellow-800">
                                        <strong>Pending Updates:</strong>
                                        <pre className="mt-1 font-mono">{JSON.stringify(contact.pending_changes, null, 2)}</pre>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal for Add/Edit Emergency Contact */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsModalOpen(false)}></div>

                        <div className="relative inline-block w-full max-w-md px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:p-6">
                            <div>
                                <h3 className="text-lg font-medium leading-6 text-gray-900">
                                    {editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
                                </h3>
                                <form onSubmit={handleSave} className="mt-4 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Full Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Relationship</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.relationship}
                                            onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                                            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.mobile}
                                            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                                            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Email Address (Optional)</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        />
                                    </div>
                                    
                                    {!editingContact?.is_primary && (
                                        <div className="flex items-center mt-4">
                                            <input
                                                id="is_primary"
                                                type="checkbox"
                                                checked={formData.is_primary}
                                                onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                            />
                                            <label htmlFor="is_primary" className="block ml-2 text-sm text-gray-900">
                                                Set as Primary Emergency Contact
                                            </label>
                                        </div>
                                    )}

                                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                                        <button
                                            type="submit"
                                            className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
                                        >
                                            Save
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Guardian Modal */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsInviteModalOpen(false)}></div>

                        <div className="relative inline-block w-full max-w-md px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:p-6">
                            <div>
                                <h3 className="text-lg font-medium leading-6 text-gray-900">
                                    Add Family Guardian
                                </h3>
                                {inviteError && (
                                    <div className="mt-2 text-sm text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                                        {inviteError}
                                    </div>
                                )}
                                <form onSubmit={handleSendInvitation} className="mt-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">First Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={inviteForm.first_name}
                                                onChange={(e) => setInviteForm({ ...inviteForm, first_name: e.target.value })}
                                                className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Last Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={inviteForm.last_name}
                                                onChange={(e) => setInviteForm({ ...inviteForm, last_name: e.target.value })}
                                                className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Guardian Email</label>
                                        <input
                                            type="email"
                                            required
                                            value={inviteForm.email}
                                            onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                                            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            placeholder="guardian@example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Temporary Password</label>
                                        <input
                                            type="password"
                                            required
                                            value={inviteForm.password}
                                            onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                                            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            placeholder="Enter password"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Relationship to Child</label>
                                        <select
                                            value={inviteForm.relationship}
                                            onChange={(e) => setInviteForm({ ...inviteForm, relationship: e.target.value })}
                                            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        >
                                            <option value="Mother">Mother</option>
                                            <option value="Father">Father</option>
                                            <option value="Parent">Parent</option>
                                            <option value="Guardian">Guardian</option>
                                            <option value="Grandparent">Grandparent</option>
                                            <option value="Foster parent">Foster parent</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>

                                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                                        <button
                                            type="submit"
                                            disabled={inviting}
                                            className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-emerald-600 border border-transparent rounded-md shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
                                        >
                                            {inviting ? 'Saving...' : 'Add Guardian'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsInviteModalOpen(false)}
                                            className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={deleteConfirmOpen}
                title="Delete Emergency Contact"
                message={`Are you sure you want to delete ${contactToDelete?.name} as an emergency contact? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirmOpen(false)}
            />
        </div>
    );
};

export default ChildEmergency;
