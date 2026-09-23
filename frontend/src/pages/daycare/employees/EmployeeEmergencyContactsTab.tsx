import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Phone, Mail, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { employeeService, type EmployeeEmergencyContact } from '../../../api/employeeService';

interface Props {
    employeeId: string;
}

export const EmployeeEmergencyContactsTab: React.FC<Props> = ({ employeeId }) => {
    const [contacts, setContacts] = useState<EmployeeEmergencyContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<EmployeeEmergencyContact | null>(null);
    const [formData, setFormData] = useState<Partial<EmployeeEmergencyContact>>({
        name: '',
        relationship: '',
        phone: '',
        email: '',
        is_primary: false,
        notes: ''
    });

    const fetchContacts = async () => {
        try {
            setLoading(true);
            const data = await employeeService.getEmergencyContacts(employeeId);
            setContacts(data);
        } catch (err: any) {
            setError("Failed to load emergency contacts.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, [employeeId]);

    const handleOpenModal = (contact?: EmployeeEmergencyContact) => {
        if (contact) {
            setEditingContact(contact);
            setFormData({
                name: contact.name,
                relationship: contact.relationship,
                phone: contact.phone,
                email: contact.email || '',
                is_primary: contact.is_primary,
                notes: contact.notes || ''
            });
        } else {
            setEditingContact(null);
            setFormData({
                name: '',
                relationship: '',
                phone: '',
                email: '',
                is_primary: contacts.length === 0,
                notes: ''
            });
        }
        setIsModalOpen(true);
        setError(null);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingContact(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            setError(null);
            if (editingContact) {
                await employeeService.updateEmergencyContact(editingContact.id, formData);
            } else {
                await employeeService.createEmergencyContact(employeeId, formData);
            }
            await fetchContacts();
            handleCloseModal();
        } catch (err: any) {
            setError(err.response?.data?.detail || err.message || "Failed to save emergency contact.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (contactId: string) => {
        if (!window.confirm("Are you sure you want to delete this emergency contact?")) return;
        try {
            await employeeService.deleteEmergencyContact(contactId);
            await fetchContacts();
        } catch (err: any) {
            setError("Failed to delete emergency contact.");
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Emergency Contacts</h2>
                    <p className="text-sm text-slate-500 mt-1">Designated contacts to notify in case of workplace emergencies.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" /> Add Emergency Contact
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            {contacts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center">
                    <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-slate-900">No Emergency Contacts Added</h3>
                    <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                        It is recommended to add at least one primary emergency contact for every staff member.
                    </p>
                    <button
                        onClick={() => handleOpenModal()}
                        className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium rounded-xl text-sm transition-colors"
                    >
                        Add Primary Contact
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contacts.map((contact) => (
                        <div
                            key={contact.id}
                            className={`bg-white rounded-2xl border p-6 shadow-sm transition-all ${
                                contact.is_primary ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-slate-200/80'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-slate-900 text-lg">{contact.name}</h3>
                                        {contact.is_primary && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                                                <CheckCircle2 className="w-3 h-3" /> Primary
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm font-medium text-slate-500">{contact.relationship}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleOpenModal(contact)}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Edit Contact"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(contact.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Contact"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 text-sm text-slate-600">
                                <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-slate-400" />
                                    <a href={`tel:${contact.phone}`} className="hover:text-indigo-600 transition-colors font-medium">
                                        {contact.phone}
                                    </a>
                                </div>
                                {contact.email && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                        <a href={`mailto:${contact.email}`} className="hover:text-indigo-600 transition-colors">
                                            {contact.email}
                                        </a>
                                    </div>
                                )}
                                {contact.notes && (
                                    <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-2">
                                        {contact.notes}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">
                            {editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder="e.g. Jane Doe"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Relationship *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.relationship || ''}
                                        onChange={e => setFormData({ ...formData, relationship: e.target.value })}
                                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        placeholder="e.g. Spouse, Parent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number *</label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone || ''}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        placeholder="e.g. 555-123-4567"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder="e.g. contact@example.com"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="is_primary"
                                    checked={formData.is_primary || false}
                                    onChange={e => setFormData({ ...formData, is_primary: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                />
                                <label htmlFor="is_primary" className="text-sm font-medium text-slate-700">
                                    Set as Primary Emergency Contact
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Notes / Instructions</label>
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    rows={2}
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                                    placeholder="Any specific medical or contact instructions..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : 'Save Contact'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
