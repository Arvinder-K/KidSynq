import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';

const AgeGroupForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isEditing = Boolean(id);

    const [formData, setFormData] = useState({
        name: '',
        min_age_months: 0,
        max_age_months: 12,
        description: '',
        display_order: 0,
        status: 'Active'
    });
    const [error, setError] = useState('');

    const { data: ageGroup, isLoading: isLoadingAgeGroup } = useQuery({
        queryKey: ['age-group', id],
        queryFn: async () => {
            const res = await api.get(`/age-groups/${id}/`);
            return res.data;
        },
        enabled: isEditing
    });

    useEffect(() => {
        if (ageGroup && isEditing) {
            setFormData({
                name: ageGroup.name || '',
                min_age_months: ageGroup.min_age_months || 0,
                max_age_months: ageGroup.max_age_months || 12,
                description: ageGroup.description || '',
                display_order: ageGroup.display_order || 0,
                status: ageGroup.status || 'Active'
            });
        }
    }, [ageGroup, isEditing]);

    const mutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            if (isEditing) {
                const response = await api.put(`/age-groups/${id}/`, data);
                return response.data;
            } else {
                const response = await api.post('/age-groups/', data);
                return response.data;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['age-groups'] });
            navigate('/age-groups');
        },
        onError: (err: any) => {
            let errorMsg = 'An error occurred while saving the age group.';
            if (err.response?.data) {
                if (typeof err.response.data === 'string') {
                    errorMsg = err.response.data;
                } else if (err.response.data.non_field_errors) {
                    errorMsg = err.response.data.non_field_errors[0];
                } else {
                    // Try to get first field error
                    const firstKey = Object.keys(err.response.data)[0];
                    if (firstKey && Array.isArray(err.response.data[firstKey])) {
                        errorMsg = err.response.data[firstKey][0];
                    }
                }
            }
            setError(errorMsg);
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (formData.max_age_months <= formData.min_age_months) {
            setError("Maximum age must be greater than minimum age.");
            return;
        }
        
        mutation.mutate(formData);
    };

    if (isEditing && isLoadingAgeGroup) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link to="/age-groups" className="p-2 bg-white rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            {isEditing ? 'Edit Age Group' : 'Create New Age Group'}
                        </h1>
                        <p className="text-slate-500 mt-1">
                            {isEditing ? 'Update the age range below.' : 'Define a new age classification.'}
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <form onSubmit={handleSubmit} className="p-8">
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Age Group Name <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                    placeholder="e.g. Toddler"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Minimum Age (Months) <span className="text-red-500">*</span></label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        required
                                        value={formData.min_age_months}
                                        onChange={(e) => setFormData({...formData, min_age_months: parseInt(e.target.value) || 0})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Maximum Age (Months) <span className="text-red-500">*</span></label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        required
                                        value={formData.max_age_months}
                                        onChange={(e) => setFormData({...formData, max_age_months: parseInt(e.target.value) || 0})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                                <textarea 
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors resize-none"
                                    placeholder="Enter details about this age group..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Display Order</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={formData.display_order}
                                        onChange={(e) => setFormData({...formData, display_order: parseInt(e.target.value) || 0})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Status <span className="text-red-500">*</span></label>
                                    <select 
                                        value={formData.status}
                                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                        <option value="Archived">Archived</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end gap-4">
                            <Link 
                                to="/age-groups"
                                className="px-6 py-2.5 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
                            >
                                Cancel
                            </Link>
                            <button 
                                type="submit" 
                                disabled={mutation.isPending}
                                className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-70 flex items-center gap-2 shadow-sm shadow-indigo-200"
                            >
                                <Save className="w-4 h-4" />
                                {mutation.isPending ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Age Group')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
};

export default AgeGroupForm;
