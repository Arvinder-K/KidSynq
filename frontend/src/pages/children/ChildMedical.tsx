import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api';
import type { Child } from './ChildProfileLayout';
import { AlertTriangle, Edit2, Save, X, Activity, User, FileText } from 'lucide-react';

interface ContextType {
    child: Child;
    refreshChild: () => void;
}

interface MedicalData {
    // HealthProfile fields
    blood_type: string;
    ohip_number: string;
    primary_physician: string;
    clinic: string;
    dentist: string;
    hospital_preference: string;
    emergency_medical_consent: boolean;
    health_notes: string;
    // Student fields
    allergies: string;
    medical_conditions: string;
    medication: string;
    special_needs: string;
    dietary_restrictions: string;
    doctor_name: string;
    doctor_phone: string;
    hospital_name: string;
}

const ChildMedical: React.FC = () => {
    const { child } = useOutletContext<ContextType>();
    const [medicalData, setMedicalData] = useState<MedicalData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<MedicalData>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchMedicalData();
    }, [child.id]);

    const fetchMedicalData = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/daycare/children/${child.id}/medical/`);
            setMedicalData(response.data);
            setFormData(response.data);
        } catch (err: any) {
            console.error('Failed to fetch medical data', err);
            setError('Failed to load medical information.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const response = await api.patch(`/daycare/children/${child.id}/medical/`, formData);
            setMedicalData(response.data);
            setIsEditing(false);
        } catch (err: any) {
            console.error('Failed to save medical data', err);
            if (err.response?.status === 403) {
                setError('You do not have permission to edit medical information.');
            } else {
                setError('Failed to save changes. Please try again.');
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="py-12 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    if (!medicalData) {
        return <div className="text-red-500">Failed to load data.</div>;
    }

    const hasAllergies = medicalData.allergies && medicalData.allergies.trim().length > 0;
    const hasMedicalConditions = medicalData.medical_conditions && medicalData.medical_conditions.trim().length > 0;
    const showMedicalAlert = hasAllergies || hasMedicalConditions;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                    <Activity className="w-6 h-6 text-emerald-600" />
                    <span>Medical & Health Information</span>
                </h2>
                {!isEditing ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                        <Edit2 className="w-4 h-4" />
                        <span>Edit Info</span>
                    </button>
                ) : (
                    <div className="flex space-x-3">
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setFormData(medicalData);
                                setError('');
                            }}
                            className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                            disabled={saving}
                        >
                            <X className="w-4 h-4" />
                            <span>Cancel</span>
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center space-x-2 px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
                        >
                            <Save className="w-4 h-4" />
                            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {showMedicalAlert && !isEditing && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
                    <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-red-800 font-bold uppercase tracking-wide text-sm">Medical Alert</h3>
                        <div className="mt-2 space-y-2 text-sm text-red-700">
                            {hasAllergies && (
                                <p><span className="font-semibold">Allergies:</span> {medicalData.allergies}</p>
                            )}
                            {hasMedicalConditions && (
                                <p><span className="font-semibold">Conditions:</span> {medicalData.medical_conditions}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Critical Health Information */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2 flex items-center space-x-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <span>Critical Health Info</span>
                    </h3>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                        {isEditing ? (
                            <textarea
                                value={formData.allergies || ''}
                                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                rows={2}
                                placeholder="List any allergies..."
                            />
                        ) : (
                            <p className="text-gray-900 whitespace-pre-wrap">{medicalData.allergies || 'None recorded'}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Medical Conditions</label>
                        {isEditing ? (
                            <textarea
                                value={formData.medical_conditions || ''}
                                onChange={(e) => setFormData({ ...formData, medical_conditions: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                rows={2}
                                placeholder="List any medical conditions..."
                            />
                        ) : (
                            <p className="text-gray-900 whitespace-pre-wrap">{medicalData.medical_conditions || 'None recorded'}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dietary Restrictions</label>
                        {isEditing ? (
                            <textarea
                                value={formData.dietary_restrictions || ''}
                                onChange={(e) => setFormData({ ...formData, dietary_restrictions: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                rows={2}
                                placeholder="e.g. Vegetarian, Halal, Gluten-free..."
                            />
                        ) : (
                            <p className="text-gray-900 whitespace-pre-wrap">{medicalData.dietary_restrictions || 'None recorded'}</p>
                        )}
                    </div>
                </div>

                {/* Primary Care Provider */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2 flex items-center space-x-2">
                        <User className="w-5 h-5 text-indigo-500" />
                        <span>Primary Care & Insurance</span>
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Name</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={formData.doctor_name || ''}
                                    onChange={(e) => setFormData({ ...formData, doctor_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            ) : (
                                <p className="text-gray-900">{medicalData.doctor_name || 'Not provided'}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Phone</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={formData.doctor_phone || ''}
                                    onChange={(e) => setFormData({ ...formData, doctor_phone: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            ) : (
                                <p className="text-gray-900">{medicalData.doctor_phone || 'Not provided'}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Preference</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={formData.hospital_name || formData.hospital_preference || ''}
                                    onChange={(e) => setFormData({ ...formData, hospital_name: e.target.value, hospital_preference: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            ) : (
                                <p className="text-gray-900">{medicalData.hospital_name || medicalData.hospital_preference || 'Not provided'}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Health Card (OHIP)</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={formData.ohip_number || ''}
                                    onChange={(e) => setFormData({ ...formData, ohip_number: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            ) : (
                                <p className="text-gray-900 font-mono">{medicalData.ohip_number || 'Not provided'}</p>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center space-x-3">
                        {isEditing ? (
                            <input
                                type="checkbox"
                                id="emergency_consent"
                                checked={formData.emergency_medical_consent || false}
                                onChange={(e) => setFormData({ ...formData, emergency_medical_consent: e.target.checked })}
                                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        ) : (
                            <div className={`w-5 h-5 flex items-center justify-center rounded border ${medicalData.emergency_medical_consent ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-100 border-gray-300'}`}>
                                {medicalData.emergency_medical_consent && (
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                        )}
                        <label htmlFor="emergency_consent" className="text-sm font-medium text-gray-700">
                            Emergency Medical Consent on File
                        </label>
                    </div>
                </div>

                {/* Additional Information */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 md:col-span-2">
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2 flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-gray-500" />
                        <span>Additional Notes</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Medication Information</label>
                            {isEditing ? (
                                <textarea
                                    value={formData.medication || ''}
                                    onChange={(e) => setFormData({ ...formData, medication: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    rows={3}
                                    placeholder="Current medications..."
                                />
                            ) : (
                                <p className="text-gray-900 whitespace-pre-wrap">{medicalData.medication || 'None recorded'}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Special Needs</label>
                            {isEditing ? (
                                <textarea
                                    value={formData.special_needs || ''}
                                    onChange={(e) => setFormData({ ...formData, special_needs: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    rows={3}
                                    placeholder="Any special needs or accommodations..."
                                />
                            ) : (
                                <p className="text-gray-900 whitespace-pre-wrap">{medicalData.special_needs || 'None recorded'}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChildMedical;
