import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, Users, Activity, CheckCircle2, XCircle, RotateCcw, Archive, Settings } from 'lucide-react';

const AgeGroupDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: ageGroup, isLoading } = useQuery({
        queryKey: ['age-group', id],
        queryFn: async () => {
            const res = await api.get(`/age-groups/${id}/`);
            return res.data;
        }
    });

    const archiveMutation = useMutation({
        mutationFn: async () => {
            await api.post(`/age-groups/${id}/archive/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['age-groups'] });
            navigate('/age-groups');
        }
    });
    
    const restoreMutation = useMutation({
        mutationFn: async () => {
            await api.post(`/age-groups/${id}/restore/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['age-groups'] });
            navigate('/age-groups');
        }
    });

    if (isLoading) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            </Layout>
        );
    }

    if (!ageGroup) {
        return (
            <Layout>
                <div className="text-center py-12">
                    <h2 className="text-xl font-medium text-slate-600">Age Group not found</h2>
                    <Link to="/age-groups" className="text-indigo-600 hover:underline mt-4 inline-block">Return to list</Link>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link to="/age-groups" className="p-2 bg-white rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-slate-800">{ageGroup.name}</h1>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                    ageGroup.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 
                                    ageGroup.status === 'Inactive' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-600'
                                }`}>
                                    {ageGroup.status === 'Active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                    {ageGroup.status}
                                </span>
                            </div>
                            <p className="text-slate-500 mt-1">Age Range: {ageGroup.min_age_months} - {ageGroup.max_age_months} months</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link to={`/age-groups/${id}/edit`} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                            <Edit className="w-4 h-4" />
                            <span className="text-sm font-medium">Edit</span>
                        </Link>
                        {ageGroup.status !== 'Archived' ? (
                            <button 
                                onClick={() => {
                                    if(confirm('Archive this age group?')) {
                                        archiveMutation.mutate();
                                    }
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors shadow-sm"
                            >
                                <Archive className="w-4 h-4" />
                                <span className="text-sm font-medium">Archive</span>
                            </button>
                        ) : (
                            <button 
                                onClick={() => {
                                    if(confirm('Restore this age group?')) {
                                        restoreMutation.mutate();
                                    }
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-emerald-200 text-emerald-600 rounded-xl hover:bg-emerald-50 transition-colors shadow-sm"
                            >
                                <RotateCcw className="w-4 h-4" />
                                <span className="text-sm font-medium">Restore</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* General Information */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-indigo-600" />
                                <h3 className="font-semibold text-slate-800">Age Group Details</h3>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                    <div>
                                        <p className="text-sm text-slate-500 mb-1">Minimum Age</p>
                                        <p className="font-medium text-slate-800">{ageGroup.min_age_months} months</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 mb-1">Maximum Age</p>
                                        <p className="font-medium text-slate-800">{ageGroup.max_age_months} months</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-sm text-slate-500 mb-1">Description</p>
                                        <p className="font-medium text-slate-800">{ageGroup.description || 'No description provided.'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 mb-1">Display Order</p>
                                        <p className="font-medium text-slate-800">{ageGroup.display_order}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 mb-1">Created At</p>
                                        <p className="font-medium text-slate-800">{new Date(ageGroup.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Placeholders for Future Modules */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center justify-center text-center min-h-[200px] border-dashed border-2">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                                    <Users className="w-6 h-6" />
                                </div>
                                <h4 className="font-medium text-slate-800 mb-1">Students in Group</h4>
                                <p className="text-sm text-slate-500">Student enrollment linking will be implemented in a future module.</p>
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center justify-center text-center min-h-[200px] border-dashed border-2">
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                    <Activity className="w-6 h-6" />
                                </div>
                                <h4 className="font-medium text-slate-800 mb-1">Classrooms</h4>
                                <p className="text-sm text-slate-500">Classroom assignment will be implemented in a future module.</p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats Side Panel */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl shadow-md p-6 text-white">
                            <h3 className="font-medium text-indigo-100 mb-4">Age Span</h3>
                            <div className="text-4xl font-bold mb-1">{ageGroup.max_age_months - ageGroup.min_age_months}</div>
                            <p className="text-indigo-100 text-sm mb-4">Months total duration</p>
                            
                            <div className="mt-6 pt-6 border-t border-indigo-400/30">
                                <p className="text-xs text-indigo-200">
                                    This range represents children roughly between {Math.floor(ageGroup.min_age_months / 12)} and {Math.floor(ageGroup.max_age_months / 12)} years old.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default AgeGroupDetails;
