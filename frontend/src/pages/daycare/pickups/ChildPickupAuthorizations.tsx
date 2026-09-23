import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import api, { BACKEND_URL } from '../../../api';
import type { Child } from '../../children/ChildProfileLayout';
import { 
    Phone, Mail, Plus, Edit2, Trash2, ShieldCheck,
    Clock, AlertTriangle, CheckCircle2, XCircle, Camera, Calendar,
    History, Ban, Search, QrCode, KeyRound, Copy, Check, RefreshCw
} from 'lucide-react';

import ConfirmationDialog from '../../../components/ConfirmationDialog';
import QRCodeDisplay from '../../../components/QRCodeDisplay';

interface ContextType {
    child: Child;
    refreshChild?: () => void;
}

export interface AuthorizedPickup {
    id: string;
    student?: string;
    child_name?: string;
    name: string;
    person_name?: string;
    relationship: string;
    relationship_to_child?: string;
    phone: string;
    email?: string;
    photo?: string;
    photo_url?: string;
    authorization_status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'REVOKED' | 'PENDING_VERIFICATION' | string;
    valid_from?: string | null;
    valid_until?: string | null;
    notes?: string;
    status?: string;
    approval_status?: string;
    id_proof_status?: string;
    is_expired?: boolean;
    is_effective?: boolean;
    created_at?: string;
    updated_at?: string;
}

interface AuditHistoryItem {
    id: string;
    action: string;
    actor: string;
    details: any;
    timestamp: string;
}

const getImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const ChildPickupAuthorizations: React.FC = () => {
    const outletContext = useOutletContext<ContextType>();
    const { id: routeId } = useParams<{ id: string }>();
    const child = outletContext?.child || { id: routeId || '' } as Child;


    const [pickups, setPickups] = useState<AuthorizedPickup[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    // Modals
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [editingPickup, setEditingPickup] = useState<AuthorizedPickup | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        relationship: '',
        phone: '',
        email: '',
        authorization_status: 'ACTIVE',
        valid_from: '',
        valid_until: '',
        notes: ''
    });

    // Revoke Modal
    const [revokeModalOpen, setRevokeModalOpen] = useState(false);
    const [pickupToRevoke, setPickupToRevoke] = useState<AuthorizedPickup | null>(null);
    const [revokeReason, setRevokeReason] = useState('');

    // Expiry Modal
    const [expiryModalOpen, setExpiryModalOpen] = useState(false);
    const [pickupToExpiry, setPickupToExpiry] = useState<AuthorizedPickup | null>(null);
    const [newExpiryDate, setNewExpiryDate] = useState('');

    // History Modal
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyPickup, setHistoryPickup] = useState<AuthorizedPickup | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditHistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Delete Confirmation
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [pickupToDelete, setPickupToDelete] = useState<AuthorizedPickup | null>(null);

    // QR Modal State
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrPickup, setQrPickup] = useState<AuthorizedPickup | null>(null);
    const [qrTokenData, setQrTokenData] = useState<{ token: string; expires_at: string | null; is_active: boolean } | null>(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [copiedToken, setCopiedToken] = useState(false);

    // PIN Modal State
    const [pinModalOpen, setPinModalOpen] = useState(false);
    const [pinPickup, setPinPickup] = useState<AuthorizedPickup | null>(null);
    const [pinValue, setPinValue] = useState('');
    const [pinLoading, setPinLoading] = useState(false);
    const [pinFeedback, setPinFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Modal Photo Upload State
    const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

    // Photo Upload (Card avatar)
    const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);

    useEffect(() => {
        if (child?.id) {
            fetchPickups();
        }
    }, [child?.id]);

    const fetchPickups = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/daycare/children/${child.id}/authorized-pickups/`);
            setPickups(response.data);
        } catch (error) {
            console.error("Failed to fetch authorized pickups:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setEditingPickup(null);
        setSelectedPhotoFile(null);
        setPhotoPreviewUrl(null);
        setFormData({
            name: '',
            relationship: '',
            phone: '',
            email: '',
            authorization_status: 'ACTIVE',
            valid_from: new Date().toISOString().split('T')[0],
            valid_until: '',
            notes: ''
        });
        setIsAddEditModalOpen(true);
    };

    const handleOpenEditModal = (pickup: AuthorizedPickup) => {
        setEditingPickup(pickup);
        setSelectedPhotoFile(null);
        setPhotoPreviewUrl(pickup.photo_url || pickup.photo ? `${BACKEND_URL}/api/daycare/authorized-pickups/${pickup.id}/photo/` : null);
        setFormData({
            name: pickup.name || '',
            relationship: pickup.relationship || '',
            phone: pickup.phone || '',
            email: pickup.email || '',
            authorization_status: (pickup.authorization_status || 'ACTIVE').toUpperCase(),
            valid_from: pickup.valid_from ? pickup.valid_from.split('T')[0] : '',
            valid_until: pickup.valid_until ? pickup.valid_until.split('T')[0] : '',
            notes: pickup.notes || ''
        });
        setIsAddEditModalOpen(true);
    };

    const handleModalPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedPhotoFile(file);
            setPhotoPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                valid_from: formData.valid_from || null,
                valid_until: formData.valid_until || null,
            };

            let savedId = editingPickup?.id;
            if (editingPickup) {
                await api.patch(`/daycare/authorized-pickups/${editingPickup.id}/`, payload);
            } else {
                const res = await api.post(`/daycare/children/${child.id}/authorized-pickups/`, payload);
                savedId = res.data?.id;
            }

            if (selectedPhotoFile && savedId) {
                const photoData = new FormData();
                photoData.append('photo', selectedPhotoFile);
                await api.post(`/daycare/authorized-pickups/${savedId}/photo/`, photoData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            setIsAddEditModalOpen(false);
            setSelectedPhotoFile(null);
            setPhotoPreviewUrl(null);
            fetchPickups();
        } catch (error) {
            console.error("Failed to save authorized pickup:", error);
            alert("Error saving pickup authorization. Please verify the entered fields.");
        }
    };


    const handleRevoke = async () => {
        if (!pickupToRevoke) return;
        try {
            await api.post(`/daycare/authorized-pickups/${pickupToRevoke.id}/revoke/`, {
                reason: revokeReason || 'Revoked by authorized daycare staff'
            });
            setRevokeModalOpen(false);
            setPickupToRevoke(null);
            setRevokeReason('');
            fetchPickups();
        } catch (error) {
            console.error("Failed to revoke pickup:", error);
            alert("Error revoking pickup authorization.");
        }
    };

    const handleSetExpiry = async () => {
        if (!pickupToExpiry) return;
        try {
            await api.post(`/daycare/authorized-pickups/${pickupToExpiry.id}/set-expiry/`, {
                valid_until: newExpiryDate || null
            });
            setExpiryModalOpen(false);
            setPickupToExpiry(null);
            setNewExpiryDate('');
            fetchPickups();
        } catch (error) {
            console.error("Failed to update expiry date:", error);
            alert("Error updating expiry date.");
        }
    };

    const handleToggleStatus = async (pickup: AuthorizedPickup) => {
        try {
            const isCurrentlyActive = (pickup.authorization_status || '').toUpperCase() === 'ACTIVE';
            const action = isCurrentlyActive ? 'deactivate' : 'activate';
            await api.post(`/daycare/authorized-pickups/${pickup.id}/${action}/`);
            fetchPickups();
        } catch (error) {
            console.error("Failed to toggle status:", error);
        }
    };

    const handleDelete = async () => {
        if (!pickupToDelete) return;
        try {
            await api.delete(`/daycare/authorized-pickups/${pickupToDelete.id}/`);
            setDeleteConfirmOpen(false);
            setPickupToDelete(null);
            fetchPickups();
        } catch (error) {
            console.error("Failed to delete pickup:", error);
        }
    };

    const handlePhotoUpload = async (pickupId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingPhotoId(pickupId);
        const form = new FormData();
        form.append('photo', file);

        try {
            await api.post(`/daycare/authorized-pickups/${pickupId}/photo/`, form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            fetchPickups();
        } catch (error) {
            console.error("Failed to upload photo:", error);
            alert("Failed to upload photo.");
        } finally {
            setUploadingPhotoId(null);
        }
    };

    const handleViewHistory = async (pickup: AuthorizedPickup) => {
        setHistoryPickup(pickup);
        setHistoryLoading(true);
        setHistoryModalOpen(true);
        try {
            const response = await api.get(`/daycare/authorized-pickups/${pickup.id}/history/`);
            setAuditLogs(response.data);
        } catch (error) {
            console.error("Failed to fetch history:", error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const getStatusBadge = (statusStr: string, isExpired?: boolean) => {
        const normalized = (statusStr || 'ACTIVE').toUpperCase();
        if (normalized === 'REVOKED') {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                    <Ban className="w-3 h-3 mr-1 text-red-600" />
                    Revoked
                </span>
            );
        }
        if (normalized === 'EXPIRED' || isExpired) {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    <Clock className="w-3 h-3 mr-1 text-amber-600" />
                    Expired
                </span>
            );
        }
        if (normalized === 'PENDING_VERIFICATION' || normalized === 'PENDING') {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                    <AlertTriangle className="w-3 h-3 mr-1 text-blue-600" />
                    Pending Verification
                </span>
            );
        }
        if (normalized === 'INACTIVE' || normalized === 'BLOCKED') {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                    <XCircle className="w-3 h-3 mr-1 text-gray-500" />
                    Inactive
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                Active & Authorized
            </span>
        );
    };

    const filteredPickups = pickups.filter(p => {
        const normStatus = (p.authorization_status || 'ACTIVE').toUpperCase();
        if (statusFilter === 'ACTIVE' && normStatus !== 'ACTIVE') return false;
        if (statusFilter === 'EXPIRED' && normStatus !== 'EXPIRED' && !p.is_expired) return false;
        if (statusFilter === 'REVOKED' && normStatus !== 'REVOKED') return false;
        if (statusFilter === 'PENDING' && !normStatus.includes('PENDING')) return false;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const nameMatch = (p.name || '').toLowerCase().includes(q);
            const relMatch = (p.relationship || '').toLowerCase().includes(q);
            const phoneMatch = (p.phone || '').toLowerCase().includes(q);
            const emailMatch = (p.email || '').toLowerCase().includes(q);
            return nameMatch || relMatch || phoneMatch || emailMatch;
        }
        return true;
    });

    return (
        <div className="space-y-6">
            {/* Header & Stats Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-6 h-6 text-indigo-600" />
                            <h2 className="text-xl font-bold text-gray-900">Authorized Pickup Persons</h2>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage designated individuals authorized to safely collect this child. Strict security verification is enforced at pickup.
                        </p>
                    </div>
                    <button
                        onClick={handleOpenAddModal}
                        className="inline-flex items-center px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Authorized Person
                    </button>
                </div>

                {/* Quick Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-100">
                    <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                        <span className="text-xs font-medium text-slate-500">Total Listed</span>
                        <p className="text-lg font-bold text-slate-800">{pickups.length}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                        <span className="text-xs font-medium text-emerald-600">Active & Authorized</span>
                        <p className="text-lg font-bold text-emerald-700">
                            {pickups.filter(p => (p.authorization_status || '').toUpperCase() === 'ACTIVE' && !p.is_expired).length}
                        </p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                        <span className="text-xs font-medium text-amber-600">Expired</span>
                        <p className="text-lg font-bold text-amber-700">
                            {pickups.filter(p => (p.authorization_status || '').toUpperCase() === 'EXPIRED' || p.is_expired).length}
                        </p>
                    </div>
                    <div className="bg-rose-50 rounded-xl p-3 text-center border border-rose-100">
                        <span className="text-xs font-medium text-rose-600">Revoked</span>
                        <p className="text-lg font-bold text-rose-700">
                            {pickups.filter(p => (p.authorization_status || '').toUpperCase() === 'REVOKED').length}
                        </p>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                        type="text"
                        placeholder="Search by name, relationship, phone, or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                    {[
                        { id: 'ALL', label: 'All' },
                        { id: 'ACTIVE', label: 'Active' },
                        { id: 'PENDING', label: 'Pending' },
                        { id: 'EXPIRED', label: 'Expired' },
                        { id: 'REVOKED', label: 'Revoked' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setStatusFilter(tab.id)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                                statusFilter === tab.id
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* List / Cards */}
            {loading ? (
                <div className="py-16 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
            ) : filteredPickups.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">No Authorized Pickup Persons Found</h3>
                    <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">
                        {searchQuery || statusFilter !== 'ALL'
                            ? "No pickup persons match your current search or filter criteria."
                            : "There are no authorized pickup persons on record for this child yet."}
                    </p>
                    <button
                        onClick={handleOpenAddModal}
                        className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add First Pickup Person
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredPickups.map((pickup) => {
                        const isRevoked = (pickup.authorization_status || '').toUpperCase() === 'REVOKED';
                        const isExpired = (pickup.authorization_status || '').toUpperCase() === 'EXPIRED' || pickup.is_expired;
                        const isActive = (pickup.authorization_status || '').toUpperCase() === 'ACTIVE' && !isExpired;

                        return (
                            <div
                                key={pickup.id}
                                className={`bg-white rounded-2xl border shadow-sm transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden ${
                                    isRevoked
                                        ? 'border-rose-200 bg-rose-50/20'
                                        : isExpired
                                        ? 'border-amber-200 bg-amber-50/20'
                                        : 'border-gray-200'
                                }`}
                            >
                                <div className="p-5 space-y-4">
                                    {/* Top Row: Photo, Info, Status */}
                                    <div className="flex items-start gap-4">
                                        <div className="relative group flex-shrink-0">
                                            {pickup.photo || pickup.photo_url ? (
                                                <img
                                                    src={getImageUrl(pickup.photo || pickup.photo_url)}
                                                    alt={pickup.name}
                                                    className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm bg-gray-100"
                                                    onError={(e) => {
                                                        (e.target as HTMLElement).style.display = 'none';
                                                        const next = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                                                        if (next) next.style.display = 'flex';
                                                    }}
                                                />
                                            ) : null}
                                            <div
                                                className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-lg flex items-center justify-center border-2 border-white shadow-sm ${
                                                    pickup.photo || pickup.photo_url ? 'hidden' : 'flex'
                                                }`}
                                            >
                                                {pickup.name ? pickup.name.charAt(0).toUpperCase() : 'P'}
                                            </div>


                                            {/* Photo upload trigger overlay */}
                                            <label
                                                className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow border border-gray-200 cursor-pointer hover:bg-gray-50 text-gray-600 hover:text-indigo-600"
                                                title="Upload/change photo"
                                            >
                                                <Camera className="w-3.5 h-3.5" />
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handlePhotoUpload(pickup.id, e)}
                                                    disabled={uploadingPhotoId === pickup.id}
                                                />
                                            </label>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-1">
                                                <h4 className="text-base font-bold text-gray-900 truncate">
                                                    {pickup.name}
                                                </h4>
                                            </div>
                                            <span className="inline-block mt-0.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md">
                                                {pickup.relationship}
                                            </span>
                                            <div className="mt-2">
                                                {getStatusBadge(pickup.authorization_status, pickup.is_expired)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contact Details */}
                                    <div className="space-y-1.5 pt-2 border-t border-gray-100 text-xs text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                                            <a href={`tel:${pickup.phone}`} className="font-medium text-gray-800 hover:text-indigo-600">
                                                {pickup.phone || 'No phone'}
                                            </a>
                                        </div>
                                        {pickup.email && (
                                            <div className="flex items-center gap-2">
                                                <Mail className="w-3.5 h-3.5 text-gray-400" />
                                                <a href={`mailto:${pickup.email}`} className="text-gray-700 hover:text-indigo-600 truncate">
                                                    {pickup.email}
                                                </a>
                                            </div>
                                        )}
                                        {pickup.valid_until && (
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                <span>
                                                    Valid until: <strong className={isExpired ? 'text-amber-600' : 'text-gray-800'}>{pickup.valid_until}</strong>
                                                </span>
                                            </div>
                                        )}
                                        {pickup.notes && (
                                            <p className="text-gray-500 italic bg-gray-50 p-2 rounded-lg mt-2 border border-gray-100 line-clamp-2">
                                                "{pickup.notes}"
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="bg-gray-50/80 px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleOpenEditModal(pickup)}
                                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                                            title="Edit details"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setPickupToExpiry(pickup);
                                                setNewExpiryDate(pickup.valid_until ? pickup.valid_until.split('T')[0] : '');
                                                setExpiryModalOpen(true);
                                            }}
                                            className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-white rounded-lg transition-colors"
                                            title="Set Expiration Date"
                                        >
                                            <Clock className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleViewHistory(pickup)}
                                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"
                                            title="View Audit History"
                                        >
                                            <History className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={async () => {
                                                setQrPickup(pickup);
                                                setQrModalOpen(true);
                                                setQrLoading(true);
                                                setCopiedToken(false);
                                                try {
                                                    const res = await api.post('/daycare/pickups/qr/generate/', { pickup_person_id: pickup.id });
                                                    setQrTokenData(res.data);
                                                } catch (err) {
                                                    console.error("Failed to generate QR:", err);
                                                } finally {
                                                    setQrLoading(false);
                                                }
                                            }}
                                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                                            title="Manage QR Pass"
                                        >
                                            <QrCode className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setPinPickup(pickup);
                                                setPinValue('');
                                                setPinFeedback(null);
                                                setPinModalOpen(true);
                                            }}
                                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                                            title="Security PIN"
                                        >
                                            <KeyRound className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {!isRevoked ? (
                                            <button
                                                onClick={() => {
                                                    setPickupToRevoke(pickup);
                                                    setRevokeReason('');
                                                    setRevokeModalOpen(true);
                                                }}
                                                className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                                            >
                                                Revoke
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleToggleStatus(pickup)}
                                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                                            >
                                                Re-activate
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                setPickupToDelete(pickup);
                                                setDeleteConfirmOpen(true);
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                                            title="Delete authorization"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add / Edit Modal */}
            {isAddEditModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingPickup ? 'Edit Authorized Pickup Person' : 'Add Authorized Pickup Person'}
                            </h3>
                            <button
                                onClick={() => setIsAddEditModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4 mt-4">
                            {/* Photo Upload Row */}
                            <div className="flex items-center gap-4 p-3 bg-gray-50/80 rounded-2xl border border-gray-100">
                                <div className="relative flex-shrink-0">
                                    {photoPreviewUrl ? (
                                        <img
                                            src={photoPreviewUrl}
                                            alt="Preview"
                                            className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-200 shadow-sm bg-white"
                                            onError={(e) => {
                                                (e.target as HTMLElement).style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border-2 border-dashed border-indigo-200 text-indigo-400 flex flex-col items-center justify-center text-xs">
                                            <Camera className="w-5 h-5 text-indigo-400 mb-0.5" />
                                            <span>Photo</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <label className="block text-xs font-bold text-gray-800">
                                        Collector Photo (ID Verification)
                                    </label>
                                    <p className="text-[11px] text-gray-500 mb-2">
                                        Securely stored and used during gate checkout verification.
                                    </p>
                                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:border-indigo-400 text-indigo-600 text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-colors">
                                        <Camera className="w-3.5 h-3.5" />
                                        <span>{photoPreviewUrl ? 'Change Photo' : 'Choose Photo...'}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleModalPhotoSelect}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Full Legal Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Mary Jane Watson"
                                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>


                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Relationship to Child *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.relationship}
                                        onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                                        placeholder="e.g. Grandmother, Uncle, Neighbor"
                                        className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Phone Number *
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="e.g. 555-0199"
                                        className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Email Address (Optional)
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="e.g. mary@example.com"
                                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Valid From
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.valid_from}
                                        onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                                        className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Valid Until (Expiry Date)
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.valid_until}
                                        onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                                        className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Authorization Status
                                </label>
                                <select
                                    value={formData.authorization_status}
                                    onChange={(e) => setFormData({ ...formData, authorization_status: e.target.value })}
                                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                                >
                                    <option value="ACTIVE">ACTIVE (Authorized to pick up)</option>
                                    <option value="INACTIVE">INACTIVE (Temporarily paused)</option>
                                    <option value="PENDING_VERIFICATION">PENDING_VERIFICATION (Under review)</option>
                                    <option value="EXPIRED">EXPIRED (Authorization lapsed)</option>
                                    <option value="REVOKED">REVOKED (Strictly blocked)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Notes & Instructions
                                </label>
                                <textarea
                                    rows={2}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="e.g. Only authorized on Tuesdays and Thursdays after 3 PM."
                                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsAddEditModalOpen(false)}
                                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm transition-colors"
                                >
                                    {editingPickup ? 'Save Changes' : 'Create Authorization'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Revoke Modal */}
            {revokeModalOpen && pickupToRevoke && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-100">
                        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
                            <Ban className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Revoke Pickup Authorization</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Are you sure you want to revoke pickup authorization for <strong>{pickupToRevoke.name}</strong>? They will be immediately blocked from collecting this child.
                        </p>

                        <div className="mt-4">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                Reason for Revocation (Required) *
                            </label>
                            <textarea
                                required
                                rows={3}
                                value={revokeReason}
                                onChange={(e) => setRevokeReason(e.target.value)}
                                placeholder="e.g. Guardian requested immediate removal / Custody restriction update"
                                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setRevokeModalOpen(false)}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRevoke}
                                disabled={!revokeReason.trim()}
                                className="px-5 py-2 text-sm font-semibold bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50"
                            >
                                Confirm Revocation
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Set Expiry Modal */}
            {expiryModalOpen && pickupToExpiry && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Set Expiration Date</h3>
                                <p className="text-xs text-gray-500">For {pickupToExpiry.name}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Valid Until Date
                                </label>
                                <input
                                    type="date"
                                    value={newExpiryDate}
                                    onChange={(e) => setNewExpiryDate(e.target.value)}
                                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                                <span className="text-xs text-gray-400 mt-1 block">
                                    Leave blank if authorization should not expire.
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setExpiryModalOpen(false)}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSetExpiry}
                                className="px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
                            >
                                Save Expiry
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Audit Modal */}
            {historyModalOpen && historyPickup && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 max-h-[85vh] flex flex-col">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Audit & Verification History</h3>
                                <p className="text-xs text-gray-500">Authorized Person: {historyPickup.name}</p>
                            </div>
                            <button
                                onClick={() => setHistoryModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto py-4 space-y-3">
                            {historyLoading ? (
                                <div className="py-8 text-center text-gray-400">Loading audit trail...</div>
                            ) : auditLogs.length === 0 ? (
                                <div className="py-8 text-center text-gray-400 text-sm">
                                    No audit history recorded yet for this pickup person.
                                </div>
                            ) : (
                                auditLogs.map(log => (
                                    <div key={log.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-gray-900">{log.action}</span>
                                            <span className="text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                                        </div>
                                        <p className="text-gray-600 mt-1">Performed by: <strong className="text-indigo-600">{log.actor}</strong></p>
                                        {log.details && (
                                            <pre className="mt-2 p-2 bg-white rounded border border-gray-100 text-[11px] text-gray-700 overflow-x-auto">
                                                {JSON.stringify(log.details, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-3 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setHistoryModalOpen(false)}
                                className="px-4 py-2 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Modal */}
            {qrModalOpen && qrPickup && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <QrCode className="w-5 h-5 text-indigo-600" />
                                <h3 className="text-base font-bold text-gray-900">QR Arrival & Departure Pass</h3>
                            </div>
                            <button onClick={() => setQrModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="py-4 space-y-4 text-center">
                            <p className="text-xs text-gray-500">
                                Authorized Pass for <strong className="text-gray-900">{qrPickup.name}</strong> ({qrPickup.relationship})
                            </p>

                            {qrLoading ? (
                                <div className="py-12 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                                    Generating secure token...
                                </div>
                            ) : qrTokenData ? (
                                <div className="space-y-4">
                                    <QRCodeDisplay
                                        value={qrTokenData.token}
                                        size={160}
                                        title={`${qrPickup.name} (${qrPickup.relationship})`}
                                        subtitle="Digital Child Pickup & Arrival Pass"
                                        showControls={true}
                                    />

                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left">
                                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Secure Token Reference</div>
                                        <div className="text-xs font-mono font-semibold text-slate-800 break-all px-2 py-1 bg-white rounded border border-slate-200 mt-1 select-all">
                                            {qrTokenData.token}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                                        <span>Status: <strong className="text-emerald-600">Active</strong></span>
                                        <span>Expires: <strong className="text-gray-700">{qrTokenData.expires_at ? new Date(qrTokenData.expires_at).toLocaleDateString() : 'Indefinite'}</strong></span>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                setQrLoading(true);
                                                try {
                                                    const res = await api.post('/daycare/pickups/qr/generate/', { pickup_person_id: qrPickup.id });
                                                    setQrTokenData(res.data);
                                                } catch (err) {
                                                    console.error("Failed to regenerate QR:", err);
                                                } finally {
                                                    setQrLoading(false);
                                                }
                                            }}
                                            className="px-3 py-2 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl flex items-center gap-1 transition"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            Regenerate
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* PIN Setup Modal */}
            {pinModalOpen && pinPickup && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <KeyRound className="w-5 h-5 text-indigo-600" />
                                <h3 className="text-base font-bold text-gray-900">Security PIN Configuration</h3>
                            </div>
                            <button onClick={() => setPinModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="py-4 space-y-4">
                            <p className="text-xs text-gray-500">
                                Configure a 4-6 digit numeric PIN for <strong className="text-gray-900">{pinPickup.name}</strong>.
                            </p>

                            {pinFeedback && (
                                <div className={`p-3 rounded-xl text-xs font-medium ${
                                    pinFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}>
                                    {pinFeedback.text}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Enter New PIN (4-6 digits):</label>
                                <input
                                    type="password"
                                    maxLength={6}
                                    placeholder="••••"
                                    value={pinValue}
                                    onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                                    className="w-full text-center tracking-[0.4em] text-xl font-bold py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            <button
                                onClick={async () => {
                                    if (pinValue.length < 4 || pinValue.length > 6) {
                                        setPinFeedback({ type: 'error', text: 'PIN must be between 4 and 6 numeric digits.' });
                                        return;
                                    }
                                    setPinLoading(true);
                                    setPinFeedback(null);
                                    try {
                                        await api.post('/daycare/pickups/pin/set/', {
                                            pickup_person_id: pinPickup.id,
                                            pin: pinValue
                                        });
                                        setPinFeedback({ type: 'success', text: 'Security PIN configured successfully.' });
                                        setPinValue('');
                                    } catch (err: any) {
                                        const msg = err.response?.data?.error || err.response?.data?.pin?.[0] || 'Failed to configure PIN.';
                                        setPinFeedback({ type: 'error', text: msg });
                                    } finally {
                                        setPinLoading(false);
                                    }
                                }}
                                disabled={pinLoading || pinValue.length < 4}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
                            >
                                {pinLoading ? 'Saving...' : 'Save & Enable PIN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmationDialog
                isOpen={deleteConfirmOpen}
                title="Delete Pickup Authorization"
                message={`Are you sure you want to permanently delete authorization for "${pickupToDelete?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                confirmStyle="danger"
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirmOpen(false)}
            />
        </div>
    );
};

export default ChildPickupAuthorizations;
