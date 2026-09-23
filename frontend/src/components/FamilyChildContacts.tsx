import React, { useState, useEffect } from 'react';
import api, { BACKEND_URL } from '../api';
import { 
    Phone, Shield, Plus, Edit2, Trash2, Clock, CheckCircle, 
    XCircle, AlertCircle, QrCode, KeyRound, Copy, Check, 
    Calendar, User, Mail, Info, Upload
} from 'lucide-react';

interface Contact {
    id: string;
    name: string;
    relationship: string;
    mobile?: string;
    phone?: string;
    email?: string;
    is_primary?: boolean;
    status?: string;
    approval_status: string;
    authorization_status?: string;
    id_proof_status?: string;
    valid_from?: string | null;
    valid_until?: string | null;
    notes?: string | null;
    photo_url?: string | null;
    is_expired?: boolean;
    is_effective?: boolean;
    pending_changes?: any;
}

interface Props {
    childId: string;
}

const FamilyChildContacts: React.FC<Props> = ({ childId }) => {
    const [emergencyContacts, setEmergencyContacts] = useState<Contact[]>([]);
    const [pickups, setPickups] = useState<Contact[]>([]);
    
    const [isEditingEmergency, setIsEditingEmergency] = useState(false);
    const [isEditingPickup, setIsEditingPickup] = useState(false);
    const [currentContact, setCurrentContact] = useState<Partial<Contact> | null>(null);

    // Photo file for add pickup
    const [pickupPhotoFile, setPickupPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    // QR Pass Modal state
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [activeQrData, setActiveQrData] = useState<any>(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [copiedToken, setCopiedToken] = useState(false);

    // PIN Modal state
    const [pinModalOpen, setPinModalOpen] = useState(false);
    const [activePinData, setActivePinData] = useState<any>(null);
    const [inputPin, setInputPin] = useState('');
    const [pinLoading, setPinLoading] = useState(false);
    const [pinSuccessMsg, setPinSuccessMsg] = useState('');
    const [pinErrorMsg, setPinErrorMsg] = useState('');

    useEffect(() => {
        if (childId) {
            fetchContacts();
            fetchPickups();
        }
    }, [childId]);

    const fetchContacts = async () => {
        try {
            const res = await api.get(`/family/children/${childId}/emergency-contacts/`);
            setEmergencyContacts(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchPickups = async () => {
        try {
            const res = await api.get(`/family/children/${childId}/authorized-pickups/`);
            setPickups(res.data);
        } catch (e) { console.error(e); }
    };

    const handleSaveEmergency = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (currentContact?.id) {
                await api.patch(`/family/emergency-contacts/${currentContact.id}/`, currentContact);
            } else {
                await api.post(`/family/children/${childId}/emergency-contacts/`, currentContact);
            }
            setIsEditingEmergency(false);
            setCurrentContact(null);
            fetchContacts();
        } catch (err) { console.error(err); }
    };

    const handleDeleteEmergency = async (id: string) => {
        if (!confirm('Are you sure you want to request removal of this contact?')) return;
        try {
            await api.delete(`/family/emergency-contacts/${id}/`);
            fetchContacts();
        } catch (err) { console.error(err); }
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPickupPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSavePickup = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (currentContact?.id) {
                await api.patch(`/family/authorized-pickups/${currentContact.id}/`, currentContact);
            } else {
                const formData = new FormData();
                if (currentContact?.name) formData.append('name', currentContact.name);
                if (currentContact?.relationship) formData.append('relationship', currentContact.relationship);
                if (currentContact?.phone) formData.append('phone', currentContact.phone);
                if (currentContact?.email) formData.append('email', currentContact.email);
                if (currentContact?.valid_from) formData.append('valid_from', currentContact.valid_from);
                if (currentContact?.valid_until) formData.append('valid_until', currentContact.valid_until);
                if (currentContact?.notes) formData.append('notes', currentContact.notes);
                if (pickupPhotoFile) formData.append('photo', pickupPhotoFile);

                await api.post(`/family/children/${childId}/authorized-pickups/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            setIsEditingPickup(false);
            setCurrentContact(null);
            setPickupPhotoFile(null);
            setPhotoPreview(null);
            fetchPickups();
        } catch (err) { console.error(err); }
    };

    const handleDeletePickup = async (id: string) => {
        if (!confirm('Are you sure you want to request removal of this authorized pickup?')) return;
        try {
            await api.delete(`/family/authorized-pickups/${id}/`);
            fetchPickups();
        } catch (err) { console.error(err); }
    };

    // QR Pass Handler
    const handleOpenQrPass = async (pickup: Contact) => {
        setQrLoading(true);
        setQrModalOpen(true);
        setActiveQrData({ pickup });
        try {
            const res = await api.get(`/family/authorized-pickups/${pickup.id}/qr-pass/`);
            setActiveQrData(res.data);
        } catch (err: any) {
            setActiveQrData({ error: err.response?.data?.detail || 'Unable to load QR Pass' });
        } finally {
            setQrLoading(false);
        }
    };

    const handleCopyToken = (token: string) => {
        navigator.clipboard.writeText(token);
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
    };

    // PIN Setup Handler
    const handleOpenPinModal = async (pickup: Contact) => {
        setPinLoading(true);
        setPinModalOpen(true);
        setInputPin('');
        setPinSuccessMsg('');
        setPinErrorMsg('');
        setActivePinData({ pickup });
        try {
            const res = await api.get(`/family/authorized-pickups/${pickup.id}/pin/`);
            setActivePinData({ ...res.data, pickup });
        } catch (err: any) {
            setActivePinData({ pickup, error: err.response?.data?.detail || 'Unable to load PIN status' });
        } finally {
            setPinLoading(false);
        }
    };

    const handleSavePin = async (e: React.FormEvent) => {
        e.preventDefault();
        setPinErrorMsg('');
        setPinSuccessMsg('');
        if (!inputPin || inputPin.length < 4 || inputPin.length > 6 || !/^\d+$/.test(inputPin)) {
            setPinErrorMsg('PIN must be 4 to 6 numeric digits.');
            return;
        }
        try {
            await api.post(`/family/authorized-pickups/${activePinData.pickup.id}/pin/`, { pin: inputPin });
            setPinSuccessMsg('Security PIN configured successfully.');
            setInputPin('');
            setActivePinData((prev: any) => ({ ...prev, has_pin: true }));
        } catch (err: any) {
            setPinErrorMsg(err.response?.data?.detail || 'Failed to save PIN.');
        }
    };

    const renderStatusBadge = (pickup: Contact) => {
        if (pickup.is_expired) {
            return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 flex items-center gap-1"><AlertCircle size={12}/> Expired</span>;
        }
        const appStatus = pickup.approval_status;
        const authStatus = pickup.authorization_status;

        if (appStatus === 'Approved' || authStatus === 'ACTIVE') {
            return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1"><CheckCircle size={12}/> Approved / Active</span>;
        }
        if (appStatus === 'Pending' || authStatus === 'PENDING_VERIFICATION' || authStatus === 'PENDING_APPROVAL') {
            return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 flex items-center gap-1"><Clock size={12}/> Pending Approval</span>;
        }
        if (appStatus === 'Pending_Removal') {
            return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 flex items-center gap-1"><AlertCircle size={12}/> Pending Removal</span>;
        }
        if (appStatus === 'Rejected' || authStatus === 'REJECTED') {
            return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 flex items-center gap-1"><XCircle size={12}/> Rejected</span>;
        }
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800">{appStatus || authStatus}</span>;
    };

    const getFullPhotoUrl = (url: string | null | undefined) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    return (
        <div className="space-y-8 mt-8">
            {/* Emergency Contacts Section */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                            <Phone className="w-5 h-5 text-rose-500" />
                            Emergency Contacts
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Individuals to reach immediately during urgent child care situations.</p>
                    </div>
                    <button 
                        onClick={() => { setCurrentContact({}); setIsEditingEmergency(true); }}
                        className="text-sm bg-rose-50 text-rose-600 px-3.5 py-2 rounded-xl font-medium hover:bg-rose-100 flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                        <Plus size={16} /> Add Contact
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {emergencyContacts.map(contact => (
                        <div key={contact.id} className="border border-slate-100 rounded-2xl p-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100/70 transition-colors">
                            <div className="space-y-1">
                                <div className="font-semibold text-slate-900 flex items-center gap-2">
                                    {contact.name} 
                                    {contact.is_primary && <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Primary</span>}
                                </div>
                                <div className="text-xs text-slate-500 font-medium">{contact.relationship}</div>
                                <div className="text-sm text-slate-700 flex items-center gap-1.5">
                                    <Phone size={13} className="text-slate-400" />
                                    {contact.mobile || contact.phone}
                                </div>
                                {contact.pending_changes && Object.keys(contact.pending_changes).length > 0 && (
                                    <div className="text-[11px] text-orange-600 flex items-center gap-1 font-medium mt-1">
                                        <Clock size={12} /> Edits pending admin approval
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                    contact.approval_status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                    {contact.approval_status}
                                </span>
                                <div className="flex gap-2 mt-2">
                                    <button onClick={() => { setCurrentContact(contact); setIsEditingEmergency(true); }} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-white rounded-lg transition-colors"><Edit2 size={15} /></button>
                                    <button onClick={() => handleDeleteEmergency(contact.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"><Trash2 size={15} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {emergencyContacts.length === 0 && (
                        <p className="text-sm text-slate-500 col-span-2 py-4 text-center">No emergency contacts registered for this child.</p>
                    )}
                </div>
            </div>

            {/* Authorized Pickups Section */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                            <Shield className="w-5 h-5 text-indigo-600" />
                            Authorized Pickup Persons
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Approved individuals authorized to safely check out your child from daycare.
                        </p>
                    </div>
                    <button 
                        onClick={() => { 
                            setCurrentContact({}); 
                            setPickupPhotoFile(null);
                            setPhotoPreview(null);
                            setIsEditingPickup(true); 
                        }}
                        className="text-sm bg-indigo-50 text-indigo-600 px-3.5 py-2 rounded-xl font-medium hover:bg-indigo-100 flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                        <Plus size={16} /> Add Pickup Person
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pickups.map(pickup => {
                        const isApproved = pickup.approval_status === 'Approved' && (pickup.authorization_status === 'ACTIVE' || !pickup.authorization_status);
                        const photoUrl = getFullPhotoUrl(pickup.photo_url);

                        return (
                            <div key={pickup.id} className="border border-slate-100 rounded-2xl p-5 bg-slate-50/80 hover:bg-slate-50 transition-all flex flex-col justify-between gap-4">
                                <div className="flex items-start gap-3.5">
                                    {/* Photo Thumbnail */}
                                    <div className="shrink-0">
                                        {photoUrl ? (
                                            <img 
                                                src={photoUrl} 
                                                alt={pickup.name} 
                                                className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-100 shadow-inner" 
                                            />
                                        ) : (
                                            <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg border border-indigo-200">
                                                {pickup.name.charAt(0)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Pickup Person Info */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="font-bold text-slate-900 truncate">{pickup.name}</h4>
                                            {renderStatusBadge(pickup)}
                                        </div>
                                        <div className="text-xs font-semibold text-indigo-600">{pickup.relationship}</div>
                                        
                                        <div className="text-xs text-slate-600 flex items-center gap-1 pt-1">
                                            <Phone size={12} className="text-slate-400" /> {pickup.phone}
                                        </div>
                                        {pickup.email && (
                                            <div className="text-xs text-slate-500 flex items-center gap-1 truncate">
                                                <Mail size={12} className="text-slate-400 shrink-0" /> {pickup.email}
                                            </div>
                                        )}

                                        {/* Validity dates */}
                                        <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-1">
                                            <Calendar size={12} className="text-slate-400" />
                                            {pickup.valid_from || pickup.valid_until ? (
                                                <span>Validity: {pickup.valid_from || 'Any'} &rarr; {pickup.valid_until || 'Ongoing'}</span>
                                            ) : (
                                                <span className="text-emerald-600 font-medium">Ongoing Authorization</span>
                                            )}
                                        </div>

                                        {pickup.pending_changes && Object.keys(pickup.pending_changes).length > 0 && (
                                            <div className="text-[11px] text-orange-600 flex items-center gap-1 font-medium mt-1">
                                                <Clock size={12} /> Edits pending admin approval
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons: QR Pass, PIN & Edit/Remove */}
                                <div className="pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        {isApproved ? (
                                            <>
                                                <button
                                                    onClick={() => handleOpenQrPass(pickup)}
                                                    className="inline-flex items-center gap-1 text-xs bg-indigo-100/70 hover:bg-indigo-100 text-indigo-800 font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                                                >
                                                    <QrCode size={13} /> QR Pass
                                                </button>
                                                <button
                                                    onClick={() => handleOpenPinModal(pickup)}
                                                    className="inline-flex items-center gap-1 text-xs bg-slate-200/70 hover:bg-slate-200 text-slate-800 font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                                                >
                                                    <KeyRound size={13} /> PIN
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 font-medium">
                                                Awaiting Daycare Approval
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => { setCurrentContact(pickup); setIsEditingPickup(true); }} 
                                            title="Edit details"
                                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-white rounded-lg transition-colors"
                                        >
                                            <Edit2 size={15} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeletePickup(pickup.id)} 
                                            title="Request Removal"
                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {pickups.length === 0 && (
                        <p className="text-sm text-slate-500 col-span-2 py-6 text-center">
                            No authorized pickup persons configured. Click "Add Pickup Person" above to submit an authorization.
                        </p>
                    )}
                </div>
            </div>

            {/* Modal: Add / Edit Emergency Contact */}
            {isEditingEmergency && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <h2 className="text-xl font-bold text-slate-900">{currentContact?.id ? 'Edit Emergency Contact' : 'Add Emergency Contact'}</h2>
                        <form onSubmit={handleSaveEmergency} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Name</label>
                                <input required type="text" value={currentContact?.name || ''} onChange={e => setCurrentContact({...currentContact, name: e.target.value})} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm" placeholder="Full name" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Relationship</label>
                                <input required type="text" value={currentContact?.relationship || ''} onChange={e => setCurrentContact({...currentContact, relationship: e.target.value})} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm" placeholder="e.g. Aunt, Grandparent, Neighbor" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Mobile Phone</label>
                                <input required type="text" value={currentContact?.mobile || currentContact?.phone || ''} onChange={e => setCurrentContact({...currentContact, mobile: e.target.value, phone: e.target.value})} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm" placeholder="Phone number" />
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <input type="checkbox" id="em_primary" checked={currentContact?.is_primary || false} onChange={e => setCurrentContact({...currentContact, is_primary: e.target.checked})} className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4" />
                                <label htmlFor="em_primary" className="text-sm font-medium text-slate-700">Designate as Primary Emergency Contact</label>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setIsEditingEmergency(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium">Cancel</button>
                                <button type="submit" className="px-5 py-2 text-sm bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 shadow-sm">Save Contact</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Add / Edit Authorized Pickup Person */}
            {isEditingPickup && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{currentContact?.id ? 'Edit Pickup Authorization' : 'Add Authorized Pickup Person'}</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Submit pickup authorization for child safety verification.</p>
                        </div>

                        {!currentContact?.id && (
                            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3.5 flex gap-2.5 text-xs text-indigo-900">
                                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold">Daycare Approval Required:</span> Submitted authorizations will be verified and approved by daycare staff before activation.
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSavePickup} className="space-y-4">
                            {/* Photo Upload */}
                            {!currentContact?.id && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Pickup Person Photo (Optional)</label>
                                    <div className="flex items-center gap-4">
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="Preview" className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-300" />
                                        ) : (
                                            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                                                <Upload size={20} />
                                            </div>
                                        )}
                                        <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Full Legal Name</label>
                                <input required type="text" value={currentContact?.name || ''} onChange={e => setCurrentContact({...currentContact, name: e.target.value})} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm" placeholder="e.g. Grandma Mary Watson" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Relationship</label>
                                    <input required type="text" value={currentContact?.relationship || ''} onChange={e => setCurrentContact({...currentContact, relationship: e.target.value})} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm" placeholder="e.g. Grandmother, Uncle" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Phone Number</label>
                                    <input required type="text" value={currentContact?.phone || ''} onChange={e => setCurrentContact({...currentContact, phone: e.target.value})} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm" placeholder="e.g. 555-0199" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Email Address (Optional)</label>
                                <input type="email" value={currentContact?.email || ''} onChange={e => setCurrentContact({...currentContact, email: e.target.value})} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm" placeholder="name@example.com" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Valid From (Optional)</label>
                                    <input type="date" value={currentContact?.valid_from || ''} onChange={e => setCurrentContact({...currentContact, valid_from: e.target.value})} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Valid Until (Optional)</label>
                                    <input type="date" value={currentContact?.valid_until || ''} onChange={e => setCurrentContact({...currentContact, valid_until: e.target.value})} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Notes / Special Instructions</label>
                                <textarea rows={2} value={currentContact?.notes || ''} onChange={e => setCurrentContact({...currentContact, notes: e.target.value})} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm" placeholder="Any additional identification notes..." />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setIsEditingPickup(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium">Cancel</button>
                                <button type="submit" className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-sm">
                                    {currentContact?.id ? 'Submit Edit Request' : 'Submit Authorization'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: QR Pickup Pass */}
            {qrModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                            <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                                <QrCode className="w-5 h-5 text-indigo-600" /> Digital Pickup Pass
                            </h3>
                            <button onClick={() => setQrModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">&times;</button>
                        </div>

                        {qrLoading ? (
                            <div className="py-8 flex justify-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
                        ) : activeQrData?.error ? (
                            <div className="py-6 text-rose-600 text-xs font-medium">{activeQrData.error}</div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 inline-block shadow-inner">
                                    <div className="w-40 h-40 bg-white border border-slate-200 rounded-xl p-2 mx-auto flex flex-col items-center justify-center">
                                        <QrCode className="w-28 h-28 text-slate-800" />
                                        <span className="text-[9px] font-mono text-slate-400 tracking-wider">KIDSYNQ EXPRESS PASS</span>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-slate-900 text-base">{activeQrData?.name}</h4>
                                    <p className="text-xs text-indigo-600 font-semibold">{activeQrData?.relationship} &bull; {activeQrData?.child_name}</p>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs">
                                    <span className="font-mono text-slate-600 truncate max-w-[190px]">{activeQrData?.qr_token}</span>
                                    <button 
                                        onClick={() => handleCopyToken(activeQrData?.qr_token)}
                                        className="text-indigo-600 font-semibold hover:text-indigo-800 flex items-center gap-1 ml-2"
                                    >
                                        {copiedToken ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                        <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                                    </button>
                                </div>

                                <p className="text-[11px] text-slate-400">Present this QR code or token to daycare staff at arrival or departure.</p>
                            </div>
                        )}

                        <button onClick={() => setQrModalOpen(false)} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors">
                            Close Pass
                        </button>
                    </div>
                </div>
            )}

            {/* Modal: Security PIN Setup */}
            {pinModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                            <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                                <KeyRound className="w-5 h-5 text-indigo-600" /> Security PIN Setup
                            </h3>
                            <button onClick={() => setPinModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">&times;</button>
                        </div>

                        {pinLoading ? (
                            <div className="py-8 flex justify-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
                        ) : (
                            <form onSubmit={handleSavePin} className="space-y-4">
                                <div>
                                    <h4 className="font-bold text-slate-900 text-sm">{activePinData?.pickup?.name}</h4>
                                    <p className="text-xs text-slate-500">Configure a 4 to 6 digit numeric PIN for departure verification.</p>
                                </div>

                                {activePinData?.has_pin && (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-800 flex items-center gap-1.5 font-medium">
                                        <CheckCircle size={14} /> PIN currently active on file. You can enter a new PIN below to update it.
                                    </div>
                                )}

                                {pinSuccessMsg && (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-800 font-medium">
                                        {pinSuccessMsg}
                                    </div>
                                )}

                                {pinErrorMsg && (
                                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-800 font-medium">
                                        {pinErrorMsg}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">New 4-6 Digit PIN</label>
                                    <input 
                                        type="password" 
                                        maxLength={6}
                                        value={inputPin} 
                                        onChange={e => setInputPin(e.target.value)} 
                                        className="w-full text-center tracking-widest font-mono text-xl px-3.5 py-2.5 border border-slate-200 rounded-xl" 
                                        placeholder="••••" 
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setPinModalOpen(false)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl">
                                        Cancel
                                    </button>
                                    <button type="submit" className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm">
                                        Save PIN
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FamilyChildContacts;
