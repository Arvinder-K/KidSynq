import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import api from '../../api';
import type { Child } from './ChildProfileLayout';
import { Syringe, Plus, Edit2, Trash2, Calendar, ShieldAlert, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import ConfirmationDialog from '../../components/ConfirmationDialog';

interface ContextType {
    child: Child;
    refreshChild?: () => void;
}

interface VaccinationRecord {
    id: string;
    vaccine_name: string;
    dose: string;
    vaccination_date: string;
    provider: string | null;
    expiry_date: string | null;
    status: string;
    notes: string | null;
}

const ChildVaccinations: React.FC = () => {
    const context = useOutletContext<ContextType>();
    const { id: routeId } = useParams<{ id: string }>();
    const childId = context?.child?.id || routeId || '';

    const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<VaccinationRecord | null>(null);
    const [modalError, setModalError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    const [formData, setFormData] = useState({
        vaccine_name: '',
        dose: '',
        vaccination_date: '',
        provider: '',
        expiry_date: '',
        status: 'Active',
        notes: ''
    });

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<VaccinationRecord | null>(null);

    useEffect(() => {
        if (childId) {
            fetchVaccinations();
        }
    }, [childId]);

    const fetchVaccinations = async () => {
        if (!childId) return;
        setLoading(true);
        try {
            const response = await api.get(`/daycare/children/${childId}/vaccinations/`);
            const raw = response.data?.results || response.data || [];
            setVaccinations(Array.isArray(raw) ? raw : []);
        } catch (error) {
            console.error("Failed to fetch vaccinations:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (record?: VaccinationRecord) => {
        setModalError(null);
        if (record) {
            setEditingRecord(record);
            setFormData({
                vaccine_name: record.vaccine_name,
                dose: record.dose,
                vaccination_date: record.vaccination_date,
                provider: record.provider || '',
                expiry_date: record.expiry_date || '',
                status: record.status || 'Active',
                notes: record.notes || ''
            });
        } else {
            setEditingRecord(null);
            setFormData({
                vaccine_name: '',
                dose: '',
                vaccination_date: new Date().toISOString().split('T')[0],
                provider: '',
                expiry_date: '',
                status: 'Active',
                notes: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setModalError(null);
        try {
            const payload = {
                vaccine_name: formData.vaccine_name,
                dose: formData.dose,
                vaccination_date: formData.vaccination_date,
                provider: formData.provider || null,
                expiry_date: formData.expiry_date || null,
                status: formData.status || 'Active',
                notes: formData.notes || null
            };

            if (editingRecord) {
                await api.patch(`/daycare/vaccinations/${editingRecord.id}/`, payload);
                setSuccessMessage("Vaccination record updated successfully.");
            } else {
                await api.post(`/daycare/children/${childId}/vaccinations/`, payload);
                setSuccessMessage("Vaccination record added successfully.");
            }
            setIsModalOpen(false);
            setTimeout(() => setSuccessMessage(null), 4000);
            fetchVaccinations();
        } catch (error: any) {
            console.error("Failed to save vaccination record:", error);
            const detail = error.response?.data?.detail || 
                           (typeof error.response?.data === 'string' ? error.response.data : null) ||
                           (error.response?.data && typeof error.response.data === 'object' ? Object.values(error.response.data).flat().join(', ') : null) ||
                           "Failed to save vaccination record. Please verify fields.";
            setModalError(detail);
        } finally {
            setSubmitting(false);
        }
    };

    const confirmDelete = (record: VaccinationRecord) => {
        setRecordToDelete(record);
        setDeleteConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (recordToDelete) {
            try {
                await api.delete(`/daycare/vaccinations/${recordToDelete.id}/`);
                setSuccessMessage("Vaccination record deleted.");
                setTimeout(() => setSuccessMessage(null), 4000);
                fetchVaccinations();
            } catch (error) {
                console.error("Failed to delete vaccination record:", error);
            } finally {
                setDeleteConfirmOpen(false);
                setRecordToDelete(null);
            }
        }
    };

    const isExpired = (dateString: string | null) => {
        if (!dateString) return false;
        return new Date(dateString) < new Date();
    };

    if (loading) {
        return (
            <div className="py-12 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl">
            {successMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm animate-in fade-in">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Vaccination Records</h2>
                    <p className="text-xs text-gray-500 mt-1">Manage child immunization history and validity tracking.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add Vaccination Record
                </button>
            </div>

            {vaccinations.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center">
                    <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Syringe className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">No vaccination records</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                        Keep track of this child's immunization history by clicking "Add Vaccination Record" above.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {vaccinations.map((record) => {
                        const expired = isExpired(record.expiry_date);
                        return (
                            <div key={record.id} className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm hover:shadow-md transition-shadow relative">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                                            <Syringe className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-base font-bold text-gray-900">{record.vaccine_name}</h4>
                                            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                                {record.dose}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleOpenModal(record)}
                                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => confirmDelete(record)}
                                            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-100 space-y-2 text-xs text-gray-600">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400 flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" /> Administered:
                                        </span>
                                        <span className="font-semibold text-gray-800">{new Date(record.vaccination_date).toLocaleDateString()}</span>
                                    </div>
                                    {record.expiry_date && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400 flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" /> Valid Until:
                                            </span>
                                            <span className={`font-semibold ${expired ? 'text-rose-600 flex items-center gap-1' : 'text-gray-800'}`}>
                                                {expired && <ShieldAlert className="w-3.5 h-3.5" />}
                                                {new Date(record.expiry_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                    {record.provider && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">Provider:</span>
                                            <span className="font-semibold text-gray-800">{record.provider}</span>
                                        </div>
                                    )}
                                    {record.notes && (
                                        <div className="mt-2 p-2.5 bg-gray-50 rounded-xl text-gray-600 text-[11px]">
                                            {record.notes}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200 space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                <Syringe className="w-5 h-5 text-teal-600" />
                                {editingRecord ? 'Edit Vaccination Record' : 'Add Vaccination Record'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {modalError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                                <span>{modalError}</span>
                            </div>
                        )}

                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Vaccine Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.vaccine_name}
                                        onChange={(e) => setFormData({ ...formData, vaccine_name: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        placeholder="e.g. MMR, DTaP"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Dose *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.dose}
                                        onChange={(e) => setFormData({ ...formData, dose: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        placeholder="e.g. Dose 1, Booster"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Date Administered *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.vaccination_date}
                                        onChange={(e) => setFormData({ ...formData, vaccination_date: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Valid Until / Expiry</label>
                                    <input
                                        type="date"
                                        value={formData.expiry_date}
                                        onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Healthcare Provider</label>
                                <input
                                    type="text"
                                    value={formData.provider}
                                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                    placeholder="Clinic or Doctor's Name"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Additional Notes</label>
                                <textarea
                                    rows={2}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                    placeholder="Any reactions or special instructions..."
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        'Save Record'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={deleteConfirmOpen}
                title="Delete Vaccination Record"
                message={`Are you sure you want to remove the record for ${recordToDelete?.vaccine_name}? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirmOpen(false)}
            />
        </div>
    );
};

export default ChildVaccinations;
