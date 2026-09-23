import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import api from '../api';

interface DaycareAdminFormModalProps {
    isOpen: boolean;
    admin?: any; // If provided, it's an Edit action
    daycares: any[]; // List of active daycares for the dropdown
    onClose: () => void;
    onSuccess: () => void;
}

export default function DaycareAdminFormModal({ isOpen, admin, daycares, onClose, onSuccess }: DaycareAdminFormModalProps) {
    const [formData, setFormData] = useState<any>({
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        mobile: '',
        daycare: ''
    });
    
    // Only used for create
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (admin && isOpen) {
            setFormData({
                username: admin.username || '',
                first_name: admin.first_name || '',
                last_name: admin.last_name || '',
                email: admin.email || '',
                mobile: admin.mobile || '',
                daycare: admin.daycare || ''
            });
            setPassword('');
        } else {
            setFormData({ username: '', first_name: '', last_name: '', email: '', mobile: '', daycare: '' });
            setPassword('');
        }
        setError('');
    }, [admin, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const payload = { ...formData };
            if (!admin && password) {
                payload.password = password;
            }

            if (admin) {
                await api.patch(`/super-admin/daycare-admins/${admin.id}/`, payload);
            } else {
                await api.post(`/super-admin/daycare-admins/`, payload);
            }
            onSuccess();
        } catch (err: any) {
            const errData = err.response?.data;
            if (typeof errData === 'object' && errData !== null) {
                const msgs = Object.values(errData).map((v: any) => Array.isArray(v) ? v[0] : v);
                setError(msgs.join(', '));
            } else {
                setError('An error occurred while saving the daycare admin.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden my-8">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-900">
                        {admin ? 'Edit Daycare Admin' : 'Create Daycare Admin'}
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
                    <form id="adminForm" onSubmit={handleSubmit} className="space-y-5">
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Daycare *</label>
                            <select 
                                required 
                                name="daycare" 
                                value={formData.daycare} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                <option value="">Select a Daycare</option>
                                {daycares.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                                <input required type="text" name="username" value={formData.username} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                            
                            {!admin && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                                    <input required type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                                <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                        </div>
                    </form>
                </div>
                
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 rounded-b-xl">
                    <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="adminForm" disabled={loading} className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                        {loading ? 'Saving...' : <><Check className="w-4 h-4" /> Save Admin</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
