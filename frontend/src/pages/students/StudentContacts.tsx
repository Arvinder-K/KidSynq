import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api';

const StudentContacts: React.FC = () => {
    const { student } = useOutletContext<any>();
    const [contacts, setContacts] = useState<any[]>([]);
    const [pickups, setPickups] = useState<any[]>([]);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [showContactModal, setShowContactModal] = useState(false);
    const [contactForm, setContactForm] = useState({ name: '', relationship: '', mobile: '', email: '', is_primary: false });

    const [showPickupModal, setShowPickupModal] = useState(false);
    const [pickupForm, setPickupForm] = useState({ name: '', relationship: '', phone: '', status: 'Active' });

    // Add Guardian Modal State
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteForm, setInviteForm] = useState({ first_name: '', last_name: '', email: '', password: '', relationship: 'Mother' });
    const [inviting, setInviting] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const [contactsRes, pickupsRes, invitationsRes] = await Promise.all([
                api.get(`/students/${student.id}/contacts/`),
                api.get(`/students/${student.id}/pickups/`),
                api.get(`/daycare/invitations/?student_id=${student.id}`)
            ]);
            setContacts(contactsRes.data);
            setPickups(pickupsRes.data);
            setInvitations(invitationsRes.data);
        } catch (err) {
            console.error("Failed to fetch contacts/invitations", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [student.id]);

    const handleSaveContact = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post(`/students/${student.id}/contacts/`, contactForm);
            setShowContactModal(false);
            setContactForm({ name: '', relationship: '', mobile: '', email: '', is_primary: false });
            fetchData();
        } catch (err) {
            console.error("Error saving contact", err);
        }
    };

    const handleSavePickup = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post(`/students/${student.id}/pickups/`, pickupForm);
            setShowPickupModal(false);
            setPickupForm({ name: '', relationship: '', phone: '', status: 'Active' });
            fetchData();
        } catch (err) {
            console.error("Error saving pickup", err);
        }
    };

    const handleSendInvitation = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        setInviteError(null);
        try {
            await api.post(`/daycare/children/${student.id}/add_guardian/`, inviteForm);
            setShowInviteModal(false);
            setInviteForm({ first_name: '', last_name: '', email: '', password: '', relationship: 'Mother' });
            fetchData();
        } catch (err: any) {
            console.error("Error adding guardian", err);
            setInviteError(err.response?.data?.detail || 'Failed to add guardian. Please verify inputs.');
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
            console.error("Error resending invitation", err);
        }
    };

    const handleCancelInvitation = async (id: string) => {
        if (!confirm('Are you sure you want to cancel this invitation?')) return;
        try {
            await api.post(`/daycare/invitations/${id}/cancel/`);
            fetchData();
        } catch (err) {
            console.error("Error cancelling invitation", err);
        }
    };

    const handleDeleteContact = async (id: string) => {
        if (!confirm('Are you sure you want to delete this emergency contact?')) return;
        try {
            await api.delete(`/students/${student.id}/contacts/${id}/`);
            fetchData();
        } catch (err) {
            console.error("Error deleting contact", err);
        }
    };

    const handleDeletePickup = async (id: string) => {
        if (!confirm('Are you sure you want to delete this authorized pickup?')) return;
        try {
            await api.delete(`/students/${student.id}/pickups/${id}/`);
            fetchData();
        } catch (err) {
            console.error("Error deleting pickup", err);
        }
    };

    const handleApproveContact = async (contactId: string) => {
        try {
            await api.post(`/students/${student.id}/contacts/${contactId}/approve/`);
            fetchData();
        } catch (error) { console.error("Failed to approve contact changes:", error); }
    };

    const handleRejectContact = async (contactId: string) => {
        try {
            await api.post(`/students/${student.id}/contacts/${contactId}/reject/`);
            fetchData();
        } catch (error) { console.error("Failed to reject contact changes:", error); }
    };

    const handleApprovePickup = async (pickupId: string) => {
        try {
            await api.post(`/students/${student.id}/pickups/${pickupId}/approve/`);
            fetchData();
        } catch (error) { console.error("Failed to approve pickup changes:", error); }
    };

    const handleRejectPickup = async (pickupId: string) => {
        try {
            await api.post(`/students/${student.id}/pickups/${pickupId}/reject/`);
            fetchData();
        } catch (error) { console.error("Failed to reject pickup changes:", error); }
    };

    if (loading) return <div>Loading contacts...</div>;

    return (
        <div className="space-y-6">
            
            {/* Emergency Contacts */}
            <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Emergency Contacts</h3>
                    <button onClick={() => setShowContactModal(true)} className="bg-indigo-600 text-white px-3 py-1 text-sm rounded hover:bg-indigo-700">Add Contact</button>
                </div>
                <ul className="divide-y divide-gray-200">
                    {contacts.map((contact) => (
                        <li key={contact.id} className="px-4 py-4 sm:px-6 flex flex-col hover:bg-gray-50">
                            <div className="flex justify-between items-center w-full">
                                <div>
                                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                        {contact.name} 
                                        {contact.is_primary && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Primary</span>}
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            contact.approval_status === 'Approved' ? 'bg-green-100 text-green-800' :
                                            contact.approval_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                            contact.approval_status === 'Pending_Removal' ? 'bg-orange-100 text-orange-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {contact.approval_status?.replace('_', ' ') || 'Approved'}
                                        </span>
                                    </p>
                                    <p className="text-sm text-gray-500">{contact.relationship} • {contact.mobile}</p>
                                </div>
                                <div className="flex gap-2">
                                    {(contact.approval_status === 'Pending' || contact.approval_status === 'Pending_Removal') && (
                                        <>
                                            <button onClick={() => handleApproveContact(contact.id)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 font-medium">Approve</button>
                                            <button onClick={() => handleRejectContact(contact.id)} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100 font-medium">Reject</button>
                                        </>
                                    )}
                                    <button onClick={() => handleDeleteContact(contact.id)} className="text-red-600 hover:text-red-900 text-sm">Remove</button>
                                </div>
                            </div>
                            {contact.pending_changes && Object.keys(contact.pending_changes).length > 0 && (
                                <div className="mt-2 bg-yellow-50 p-2 rounded text-xs text-yellow-800">
                                    <strong>Pending Updates:</strong>
                                    <pre className="mt-1 font-mono">{JSON.stringify(contact.pending_changes, null, 2)}</pre>
                                </div>
                            )}
                        </li>
                    ))}
                    {contacts.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">No emergency contacts listed.</li>}
                </ul>
            </div>

            {/* Authorized Pickups */}
            <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Authorized Pickups</h3>
                    <button onClick={() => setShowPickupModal(true)} className="bg-green-600 text-white px-3 py-1 text-sm rounded hover:bg-green-700">Add Pickup</button>
                </div>
                <ul className="divide-y divide-gray-200">
                    {pickups.map((pickup) => (
                        <li key={pickup.id} className="px-4 py-4 sm:px-6 flex flex-col hover:bg-gray-50">
                            <div className="flex justify-between items-center w-full">
                                <div>
                                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                        {pickup.name}
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            pickup.approval_status === 'Approved' ? 'bg-green-100 text-green-800' :
                                            pickup.approval_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                            pickup.approval_status === 'Pending_Removal' ? 'bg-orange-100 text-orange-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {pickup.approval_status?.replace('_', ' ') || 'Approved'}
                                        </span>
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            pickup.id_proof_status === 'Verified' ? 'bg-indigo-100 text-indigo-800' :
                                            pickup.id_proof_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            ID: {pickup.id_proof_status || 'Pending'}
                                        </span>
                                    </p>
                                    <p className="text-sm text-gray-500">{pickup.relationship} • {pickup.phone}</p>
                                </div>
                                <div className="flex gap-2">
                                    {(pickup.approval_status === 'Pending' || pickup.approval_status === 'Pending_Removal') && (
                                        <>
                                            <button onClick={() => handleApprovePickup(pickup.id)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 font-medium">Approve</button>
                                            <button onClick={() => handleRejectPickup(pickup.id)} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100 font-medium">Reject</button>
                                        </>
                                    )}
                                    <button onClick={() => handleDeletePickup(pickup.id)} className="text-red-600 hover:text-red-900 text-sm">Remove</button>
                                </div>
                            </div>
                            {pickup.pending_changes && Object.keys(pickup.pending_changes).length > 0 && (
                                <div className="mt-2 bg-yellow-50 p-2 rounded text-xs text-yellow-800">
                                    <strong>Pending Updates:</strong>
                                    <pre className="mt-1 font-mono">{JSON.stringify(pickup.pending_changes, null, 2)}</pre>
                                </div>
                            )}
                        </li>
                    ))}
                    {pickups.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">No authorized pickups listed.</li>}
                </ul>
            </div>

            {/* Guardian Invitations */}
            <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Guardian Invitations</h3>
                    <button onClick={() => setShowInviteModal(true)} className="bg-purple-600 text-white px-3 py-1 text-sm rounded hover:bg-purple-700">Add Guardian</button>
                </div>
                <ul className="divide-y divide-gray-200">
                    {invitations.map((inv) => (
                        <li key={inv.id} className="px-4 py-4 sm:px-6 flex justify-between items-center hover:bg-gray-50">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-gray-900">{inv.email}</p>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                                        inv.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                        inv.status === 'pending' && !inv.is_expired ? 'bg-yellow-100 text-yellow-800' :
                                        inv.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        {inv.status === 'pending' && inv.is_expired ? 'expired' : inv.status}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Relationship: <strong>{inv.relationship}</strong> • Invited by {inv.invited_by_name} on {new Date(inv.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                {inv.status === 'pending' && !inv.is_expired && (
                                    <>
                                        <button onClick={() => handleResendInvitation(inv.id)} className="text-indigo-600 hover:text-indigo-900 text-sm font-semibold">Resend</button>
                                        <button onClick={() => handleCancelInvitation(inv.id)} className="text-red-650 hover:text-red-900 text-sm font-semibold">Cancel</button>
                                    </>
                                )}
                                {inv.status === 'expired' && (
                                    <button onClick={() => handleResendInvitation(inv.id)} className="text-indigo-600 hover:text-indigo-900 text-sm font-semibold">Re-invite</button>
                                )}
                            </div>
                        </li>
                    ))}
                    {invitations.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">No guardian invitations sent.</li>}
                </ul>
            </div>

            {/* Contact Modal */}
            {showContactModal && (
                <div className="fixed z-10 inset-0 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true"><div className="absolute inset-0 bg-gray-500 opacity-75"></div></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleSaveContact}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Add Emergency Contact</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Name</label>
                                            <input type="text" required value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} className="mt-1 block w-full shadow-sm sm:text-sm border-gray-350 rounded-md" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Relationship</label>
                                            <input type="text" required value={contactForm.relationship} onChange={e => setContactForm({...contactForm, relationship: e.target.value})} className="mt-1 block w-full shadow-sm sm:text-sm border-gray-350 rounded-md" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Mobile Phone</label>
                                            <input type="text" required value={contactForm.mobile} onChange={e => setContactForm({...contactForm, mobile: e.target.value})} className="mt-1 block w-full shadow-sm sm:text-sm border-gray-350 rounded-md" />
                                        </div>
                                        <div className="flex items-center">
                                            <input type="checkbox" checked={contactForm.is_primary} onChange={e => setContactForm({...contactForm, is_primary: e.target.checked})} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                                            <label className="ml-2 block text-sm text-gray-900">Mark as primary emergency contact</label>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">Save</button>
                                    <button type="button" onClick={() => setShowContactModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-55 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Pickup Modal */}
            {showPickupModal && (
                <div className="fixed z-10 inset-0 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true"><div className="absolute inset-0 bg-gray-500 opacity-75"></div></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleSavePickup}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Add Authorized Pickup</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Name</label>
                                            <input type="text" required value={pickupForm.name} onChange={e => setPickupForm({...pickupForm, name: e.target.value})} className="mt-1 block w-full shadow-sm sm:text-sm border-gray-350 rounded-md" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Relationship</label>
                                            <input type="text" required value={pickupForm.relationship} onChange={e => setPickupForm({...pickupForm, relationship: e.target.value})} className="mt-1 block w-full shadow-sm sm:text-sm border-gray-350 rounded-md" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Phone</label>
                                            <input type="text" required value={pickupForm.phone} onChange={e => setPickupForm({...pickupForm, phone: e.target.value})} className="mt-1 block w-full shadow-sm sm:text-sm border-gray-350 rounded-md" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">Save</button>
                                    <button type="button" onClick={() => setShowPickupModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-55 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed z-10 inset-0 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true"><div className="absolute inset-0 bg-gray-500 opacity-75"></div></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleSendInvitation}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Add Family Guardian</h3>
                                    
                                    {inviteError && (
                                        <div className="mb-4 text-sm text-red-650 bg-red-50 p-2.5 rounded-lg border border-red-200">
                                            {inviteError}
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">First Name</label>
                                                <input 
                                                    type="text" 
                                                    required 
                                                    value={inviteForm.first_name} 
                                                    onChange={e => setInviteForm({...inviteForm, first_name: e.target.value})} 
                                                    className="mt-1 block w-full shadow-sm sm:text-sm border-gray-350 rounded-md" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                                                <input 
                                                    type="text" 
                                                    required 
                                                    value={inviteForm.last_name} 
                                                    onChange={e => setInviteForm({...inviteForm, last_name: e.target.value})} 
                                                    className="mt-1 block w-full shadow-sm sm:text-sm border-gray-350 rounded-md" 
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Guardian Email</label>
                                            <input 
                                                type="email" 
                                                required 
                                                value={inviteForm.email} 

                                                onChange={e => setInviteForm({...inviteForm, email: e.target.value})} 
                                                className="mt-1 block w-full shadow-sm sm:text-sm border-gray-350 rounded-md" 
                                                placeholder="guardian@example.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Temporary Password</label>
                                            <input 
                                                type="password" 
                                                required 
                                                value={inviteForm.password} 
                                                onChange={e => setInviteForm({...inviteForm, password: e.target.value})} 
                                                className="mt-1 block w-full shadow-sm sm:text-sm border-gray-350 rounded-md" 
                                                placeholder="Enter password"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Relationship to Child</label>
                                            <select 
                                                value={inviteForm.relationship} 
                                                onChange={e => setInviteForm({...inviteForm, relationship: e.target.value})} 
                                                className="mt-1 block w-full shadow-sm sm:text-sm border-gray-350 rounded-md"
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
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button 
                                        type="submit" 
                                        disabled={inviting}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                                    >
                                        {inviting ? 'Saving...' : 'Add Guardian'}
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowInviteModal(false)} 
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-55 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentContacts;
