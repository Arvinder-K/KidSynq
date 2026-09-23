import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import api from '../api';

interface DaycareFormModalProps {
    isOpen: boolean;
    daycare?: any; // If provided, it's an Edit action
    onClose: () => void;
    onSuccess: () => void;
}

export default function DaycareFormModal({ isOpen, daycare, onClose, onSuccess }: DaycareFormModalProps) {
    const [formData, setFormData] = useState<any>({
        name: '',
        email: '',
        phone: '',
        license_number: '',
        capacity: '',
        opening_time: '',
        closing_time: '',
        address1: '',
        city: '',
        state: '',
        postal_code: '',
        logo: ''
    });
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (daycare && isOpen) {
            setFormData({
                name: daycare.name || '',
                email: daycare.email || '',
                phone: daycare.phone || '',
                license_number: daycare.license_number || '',
                capacity: daycare.capacity || '',
                opening_time: daycare.opening_time || '',
                closing_time: daycare.closing_time || '',
                address1: daycare.address1 || '',
                city: daycare.city || '',
                state: daycare.state || '',
                postal_code: daycare.postal_code || '',
                logo: daycare.logo || ''
            });
        } else {
            setFormData({
                name: '', email: '', phone: '', license_number: '', capacity: '',
                opening_time: '', closing_time: '', address1: '', city: '', state: '', postal_code: '', logo: ''
            });
        }
        setError('');
    }, [daycare, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const payload = { ...formData };
            if (!payload.capacity) delete payload.capacity;
            if (!payload.opening_time) delete payload.opening_time;
            if (!payload.closing_time) delete payload.closing_time;

            if (daycare) {
                // Edit
                await api.patch(`/super-admin/daycares/${daycare.id}/`, payload);
            } else {
                // Create (Note: using regular create if admin/plan isn't required for basic CRUD)
                // If it needs an admin, we might need to prompt for it, but the prompt says 
                // "Do not implement subscriptions in this phase. Implement: Create daycare..."
                await api.post(`/super-admin/daycares/`, payload);
            }
            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'An error occurred while saving the daycare.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden my-8">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-gray-900">
                        {daycare ? 'Edit Daycare' : 'Create Daycare'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 text-sm">
                            {error}
                        </div>
                    )}
                    <form id="daycareForm" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Basic Information</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Daycare Name *</label>
                                    <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                                    <input type="url" name="logo" value={formData.logo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                            </div>

                            {/* Operational & Address Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Operational Information</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                                    <input type="text" name="license_number" value={formData.license_number} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                                    <input type="number" name="capacity" value={formData.capacity} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Opening Time</label>
                                        <input type="time" name="opening_time" value={formData.opening_time} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Closing Time</label>
                                        <input type="time" name="closing_time" value={formData.closing_time} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 md:col-span-2">
                                <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Address</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                                        <input type="text" name="address1" value={formData.address1} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                        <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">State/Province</label>
                                            <input type="text" name="state" value={formData.state} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                                            <input type="text" name="postal_code" value={formData.postal_code} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 rounded-b-xl sticky bottom-0">
                    <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="daycareForm" disabled={loading} className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                        {loading ? 'Saving...' : (
                            <><Check className="w-4 h-4" /> Save Daycare</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
