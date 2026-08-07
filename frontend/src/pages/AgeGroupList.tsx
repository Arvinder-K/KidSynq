import React, { useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Plus, Edit, Eye, Archive, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

const AgeGroupList: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Active');
    const [sortBy, setSortBy] = useState('display_order');
    
    const queryClient = useQueryClient();

    const { data: ageGroups, isLoading } = useQuery({
        queryKey: ['age-groups'],
        queryFn: async () => {
            const res = await api.get('/age-groups/');
            return res.data;
        }
    });

    const archiveMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await api.post(`/age-groups/${id}/archive/`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['age-groups'] });
        }
    });

    const restoreMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await api.post(`/age-groups/${id}/restore/`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['age-groups'] });
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

    let filtered = ageGroups || [];
    
    // Status Filter
    if (statusFilter !== 'All') {
        filtered = filtered.filter((c: any) => c.status === statusFilter);
    }
    
    // Search
    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        filtered = filtered.filter((c: any) => 
            c.name.toLowerCase().includes(lowerSearch)
        );
    }
    
    // Sorting
    filtered.sort((a: any, b: any) => {
        if (sortBy === 'min_age_months') return a.min_age_months - b.min_age_months;
        if (sortBy === 'max_age_months') return a.max_age_months - b.max_age_months;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return a.display_order - b.display_order;
    });

    return (
        <Layout>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Age Groups</h1>
                    <p className="text-slate-500 mt-1">Manage standard age classifications for classrooms and admissions.</p>
                </div>
                <Link to="/age-groups/new" className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Create Age Group</span>
                </Link>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
                    <div className="relative max-w-md w-full">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                        />
                    </div>
                    <div className="flex gap-3">
                        <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="display_order">Sort by Order</option>
                            <option value="name">Sort by Name</option>
                            <option value="min_age_months">Sort by Min Age</option>
                            <option value="max_age_months">Sort by Max Age</option>
                        </select>
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="All">All Status</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Archived">Archived</option>
                        </select>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Age Range (Months)</th>
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order</th>
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map((g: any) => (
                                <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-4 px-6 text-sm font-medium text-slate-900">{g.name}</td>
                                    <td className="py-4 px-6 text-sm text-slate-700">{g.min_age_months} - {g.max_age_months} months</td>
                                    <td className="py-4 px-6 text-sm text-slate-700">{g.display_order}</td>
                                    <td className="py-4 px-6">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                            g.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 
                                            g.status === 'Inactive' ? 'bg-amber-100 text-amber-700' :
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                            {g.status === 'Active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                            {g.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link to={`/age-groups/${g.id}`} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors" title="View Details">
                                                <Eye className="w-4 h-4" />
                                            </Link>
                                            <Link to={`/age-groups/${g.id}/edit`} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors" title="Edit">
                                                <Edit className="w-4 h-4" />
                                            </Link>
                                            {g.status !== 'Archived' ? (
                                                <button 
                                                    onClick={() => {
                                                        if(confirm('Are you sure you want to archive this age group?')) {
                                                            archiveMutation.mutate(g.id);
                                                        }
                                                    }}
                                                    className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors" 
                                                    title="Archive"
                                                >
                                                    <Archive className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => {
                                                        if(confirm('Are you sure you want to restore this age group?')) {
                                                            restoreMutation.mutate(g.id);
                                                        }
                                                    }}
                                                    className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors" 
                                                    title="Restore"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-500">
                                        No age groups found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default AgeGroupList;
