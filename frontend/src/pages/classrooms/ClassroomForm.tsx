import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api';

interface Branch {
    id: string;
    name: string;
}

interface AgeGroup {
    id: string;
    name: string;
}

const ClassroomForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEditMode);
    
    const [branches, setBranches] = useState<Branch[]>([]);
    const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);

    const [formData, setFormData] = useState({
        room_name: '',
        room_code: '',
        age_group: '',
        capacity: '',
        branch: '',
        description: '',
        location: '',
        status: 'Active'
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [generalError, setGeneralError] = useState<string | null>(null);

    useEffect(() => {
        fetchDependencies();
        if (isEditMode) {
            fetchClassroom();
        }
    }, [id]);

    const fetchDependencies = async () => {
        try {
            const [branchesRes, ageGroupsRes] = await Promise.all([
                api.get('/daycare/branches/').catch(() => ({ data: [] })),
                api.get('/daycare/age-groups/').catch(() => api.get('/age-groups/')).catch(() => ({ data: [] }))
            ]);
            
            const bData = branchesRes.data?.results || (Array.isArray(branchesRes.data) ? branchesRes.data : []);
            const agData = ageGroupsRes.data?.results || (Array.isArray(ageGroupsRes.data) ? ageGroupsRes.data : []);
            
            setBranches(bData);
            setAgeGroups(agData);
        } catch (error) {
            console.error('Failed to fetch dependencies', error);
        }
    };

    const fetchClassroom = async () => {
        setFetching(true);
        try {
            const res = await api.get(`/daycare/classrooms/${id}/`);
            const data = res.data;
            setFormData({
                room_name: data.room_name || '',
                room_code: data.room_code || '',
                age_group: data.age_group || '',
                capacity: data.capacity !== null && data.capacity !== undefined ? String(data.capacity) : '',
                branch: data.branch || '',
                description: data.description || '',
                location: data.location || '',
                status: data.status || 'Active'
            });
        } catch (error) {
            console.error('Failed to fetch classroom', error);
            alert("Failed to load classroom data.");
            navigate('/daycare/classrooms');
        } finally {
            setFetching(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error when user types
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
        if (generalError) {
            setGeneralError(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrors({});
        setGeneralError(null);

        try {
            const payload: any = {
                room_name: formData.room_name.trim(),
                room_code: formData.room_code.trim() || '',
                capacity: formData.capacity ? parseInt(formData.capacity, 10) : null,
                branch: formData.branch || null,
                age_group: formData.age_group || null,
                location: formData.location.trim() || '',
                description: formData.description.trim() || '',
                status: formData.status || 'Active'
            };

            if (isEditMode) {
                await api.patch(`/daycare/classrooms/${id}/`, payload);
            } else {
                await api.post('/daycare/classrooms/', payload);
            }
            navigate('/daycare/classrooms');
        } catch (error: any) {
            console.error('Submission error:', error);
            if (error.response?.data) {
                const data = error.response.data;
                if (typeof data === 'string') {
                    setGeneralError(data);
                } else if (data.detail) {
                    setGeneralError(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail));
                } else if (data.non_field_errors) {
                    setGeneralError(Array.isArray(data.non_field_errors) ? data.non_field_errors.join(', ') : String(data.non_field_errors));
                } else {
                    const errMap: Record<string, string> = {};
                    const unhandledMessages: string[] = [];
                    for (const [key, val] of Object.entries(data)) {
                        const msg = Array.isArray(val) ? val.join(' ') : String(val);
                        errMap[key] = msg;
                        if (!['room_name', 'room_code', 'age_group', 'capacity', 'branch', 'location', 'status', 'description'].includes(key)) {
                            unhandledMessages.push(`${key}: ${msg}`);
                        }
                    }
                    setErrors(errMap);
                    if (unhandledMessages.length > 0) {
                        setGeneralError(unhandledMessages.join(' | '));
                    }
                }
            } else {
                setGeneralError('An unexpected error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-screen">
                    <div className="w-8 h-8 border-t-4 border-indigo-600 border-solid rounded-full animate-spin"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-3xl mx-auto p-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 bg-gray-50">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {isEditMode ? 'Edit Classroom' : 'Create New Classroom'}
                        </h2>
                        <p className="text-gray-500 mt-1">
                            {isEditMode ? 'Update the classroom information below.' : 'Fill in the details to add a new classroom.'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {generalError && (
                            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-sm font-medium">
                                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold">Unable to save classroom</p>
                                    <p className="text-xs text-rose-700 mt-0.5">{generalError}</p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Classroom Name *</label>
                                <input
                                    type="text"
                                    name="room_name"
                                    required
                                    value={formData.room_name}
                                    onChange={handleChange}
                                    className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${errors.room_name ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="e.g. Busy Bees"
                                />
                                {errors.room_name && <p className="text-red-500 text-xs mt-1">{errors.room_name}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Classroom Code</label>
                                <input
                                    type="text"
                                    name="room_code"
                                    value={formData.room_code}
                                    onChange={handleChange}
                                    className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${errors.room_code ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="e.g. BB-01"
                                />
                                {errors.room_code && <p className="text-red-500 text-xs mt-1">{errors.room_code}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Age Group</label>
                                <select
                                    name="age_group"
                                    value={formData.age_group}
                                    onChange={handleChange}
                                    className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white ${errors.age_group ? 'border-red-500' : 'border-gray-300'}`}
                                >
                                    <option value="">Select Age Group</option>
                                    {ageGroups.map(ag => (
                                        <option key={ag.id} value={ag.id}>{ag.name}</option>
                                    ))}
                                </select>
                                {errors.age_group && <p className="text-red-500 text-xs mt-1">{errors.age_group}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                                <input
                                    type="number"
                                    name="capacity"
                                    min="1"
                                    value={formData.capacity}
                                    onChange={handleChange}
                                    className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${errors.capacity ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="e.g. 20"
                                />
                                {errors.capacity && <p className="text-red-500 text-xs mt-1">{errors.capacity}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                                <select
                                    name="branch"
                                    value={formData.branch}
                                    onChange={handleChange}
                                    className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white ${errors.branch ? 'border-red-500' : 'border-gray-300'}`}
                                >
                                    <option value="">Main Branch</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                                {errors.branch && <p className="text-red-500 text-xs mt-1">{errors.branch}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Room / Location</label>
                                <input
                                    type="text"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="e.g. 1st Floor, Room 102"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                    <option value="Closed">Closed</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                name="description"
                                rows={3}
                                value={formData.description}
                                onChange={handleChange}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="Additional details about this classroom..."
                            ></textarea>
                        </div>

                        {errors.non_field_errors && (
                            <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
                                {errors.non_field_errors}
                            </div>
                        )}

                        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => navigate('/daycare/classrooms')}
                                className="px-5 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-5 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center shadow-sm shadow-indigo-600/30 disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : 'Save Classroom'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
};

export default ClassroomForm;
