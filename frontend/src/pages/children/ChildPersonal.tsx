import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api';
import type { Child } from './ChildProfileLayout';
import { User, Edit2, Save, X, AlertCircle } from 'lucide-react';

interface ContextType {
    child: Child;
    setChild: React.Dispatch<React.SetStateAction<Child | null>>;
    fetchChild: () => Promise<void>;
    isAuthorized: boolean;
}

const ChildPersonal: React.FC = () => {
    const { child, setChild, isAuthorized } = useOutletContext<ContextType>();
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    
    const [formData, setFormData] = useState({
        first_name: child.first_name || '',
        last_name: child.last_name || '',
        preferred_name: child.preferred_name || '',
        dob: child.dob || '',
        gender: child.gender || '',
        language: child.language || '',
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload: any = { ...formData };
            if (payload.dob === '') payload.dob = null;
            if (payload.preferred_name === '') payload.preferred_name = null;
            if (payload.gender === '') payload.gender = null;
            if (payload.language === '') payload.language = null;

            const response = await api.patch(`/daycare/children/${child.id}/`, payload);
            setChild(response.data);
            setIsEditing(false);
        } catch (err: any) {
            const errorMsg = err.response?.data 
                ? JSON.stringify(err.response.data) 
                : err.message;
            setError(`Failed to update profile. ${errorMsg}`);
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="bg-white shadow-sm border border-gray-100 overflow-hidden sm:rounded-2xl">
                <div className="px-6 py-5 flex justify-between items-center bg-gray-50 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <User className="w-5 h-5 text-emerald-600 mr-2" />
                        Personal Information
                    </h3>
                    {isAuthorized && (
                        <div>
                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-xl shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all focus:outline-none"
                                >
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    Edit Info
                                </button>
                            ) : (
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => {
                                            setIsEditing(false);
                                            setFormData({
                                                first_name: child.first_name || '',
                                                last_name: child.last_name || '',
                                                preferred_name: child.preferred_name || '',
                                                dob: child.dob || '',
                                                gender: child.gender || '',
                                                language: child.language || '',
                                            });
                                        }}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors focus:outline-none"
                                    >
                                        <X className="w-4 h-4 mr-2 text-gray-500" />
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        form="personal-form"
                                        disabled={saving}
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-xl shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-colors focus:outline-none disabled:opacity-50"
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="p-6">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start">
                            <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    
                    <form id="personal-form" onSubmit={handleSave} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">First Name</label>
                                {isEditing ? (
                                    <input 
                                        type="text" 
                                        name="first_name" 
                                        required 
                                        value={formData.first_name} 
                                        onChange={handleInputChange} 
                                        className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-600 focus:ring-emerald-600 sm:text-sm px-3 py-2 border outline-none" 
                                    />
                                ) : (
                                    <p className="mt-1 text-sm font-medium text-gray-800">{child.first_name}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Name</label>
                                {isEditing ? (
                                    <input 
                                        type="text" 
                                        name="last_name" 
                                        required 
                                        value={formData.last_name} 
                                        onChange={handleInputChange} 
                                        className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-600 focus:ring-emerald-600 sm:text-sm px-3 py-2 border outline-none" 
                                    />
                                ) : (
                                    <p className="mt-1 text-sm font-medium text-gray-800">{child.last_name}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Preferred Name</label>
                                {isEditing ? (
                                    <input 
                                        type="text" 
                                        name="preferred_name" 
                                        value={formData.preferred_name} 
                                        onChange={handleInputChange} 
                                        className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-600 focus:ring-emerald-600 sm:text-sm px-3 py-2 border outline-none" 
                                        placeholder="e.g. Johnny"
                                    />
                                ) : (
                                    <p className="mt-1 text-sm font-medium text-gray-800">{child.preferred_name || <span className="text-gray-400 italic">Not specified</span>}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Date of Birth</label>
                                {isEditing ? (
                                    <input 
                                        type="date" 
                                        name="dob" 
                                        value={formData.dob} 
                                        onChange={handleInputChange} 
                                        className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-600 focus:ring-emerald-600 sm:text-sm px-3 py-2 border outline-none" 
                                    />
                                ) : (
                                    <p className="mt-1 text-sm font-medium text-gray-800">{child.dob || <span className="text-gray-400 italic">Not specified</span>}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Gender</label>
                                {isEditing ? (
                                    <select 
                                        name="gender" 
                                        value={formData.gender} 
                                        onChange={handleInputChange} 
                                        className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-600 focus:ring-emerald-600 sm:text-sm px-3 py-2 border outline-none"
                                    >
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                ) : (
                                    <p className="mt-1 text-sm font-medium text-gray-800">{child.gender || <span className="text-gray-400 italic">Not specified</span>}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Language</label>
                                {isEditing ? (
                                    <input 
                                        type="text" 
                                        name="language" 
                                        value={formData.language} 
                                        onChange={handleInputChange} 
                                        className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-600 focus:ring-emerald-600 sm:text-sm px-3 py-2 border outline-none" 
                                        placeholder="e.g. English, French"
                                    />
                                ) : (
                                    <p className="mt-1 text-sm font-medium text-gray-800">{child.language || <span className="text-gray-400 italic">Not specified</span>}</p>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChildPersonal;
