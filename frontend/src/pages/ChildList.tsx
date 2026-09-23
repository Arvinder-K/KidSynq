import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Search, Filter, Eye, Plus, ChevronLeft, ChevronRight, 
    GraduationCap, Users, ShieldCheck, UserCheck, Calendar
} from 'lucide-react';
import Layout from '../components/Layout';
import api, { BACKEND_URL } from '../api';
import { motion } from 'framer-motion';

interface Child {
    id: string;
    admission_number: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    dob: string | null;
    status: string;
    photo: string | null;
}

const ChildList: React.FC = () => {
    const navigate = useNavigate();
    const [children, setChildren] = useState<Child[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const getImageUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    useEffect(() => {
        fetchChildren();
    }, [search, statusFilter]);

    const fetchChildren = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (statusFilter) params.append('status', statusFilter);
            
            const response = await api.get(`/daycare/children/?${params.toString()}`);
            const data = response.data?.results || response.data || [];
            setChildren(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch children:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const s = (status || '').toLowerCase();
        if (s === 'active') {
            return <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">Active</span>;
        }
        if (s === 'withdrawn') {
            return <span className="px-2.5 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-full text-xs font-bold">Withdrawn</span>;
        }
        if (s === 'transferred') {
            return <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full text-xs font-bold">Transferred</span>;
        }
        if (s === 'archived') {
            return <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-bold">Archived</span>;
        }
        return <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-bold">{status}</span>;
    };

    const activeCount = children.filter(c => (c.status || '').toLowerCase() === 'active').length;

    return (
        <Layout>
            <div className="space-y-6 max-w-7xl mx-auto font-sans">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Children Roster</h1>
                            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
                                {children.length} Registered
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                            Active enrolled children, classroom placements, and emergency details.
                        </p>
                    </div>

                    <button 
                        onClick={() => navigate('/daycare/children/new')}
                        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all hover:scale-[1.02]"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add New Child</span>
                    </button>
                </div>

                {/* Table Container */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
                    
                    {/* Search & Filter Toolbar */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row gap-3 items-center justify-between">
                        <div className="relative flex-1 max-w-md w-full">
                            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search by child name or admission number..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-medium"
                            />
                        </div>
                        
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Filter className="text-slate-400 w-4 h-4" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-full sm:w-44 bg-white text-slate-700"
                            >
                                <option value="">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Withdrawn">Withdrawn</option>
                                <option value="Transferred">Transferred</option>
                                <option value="Archived">Archived</option>
                            </select>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 text-slate-400 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-100">
                                    <th className="p-4 pl-6">Admission No.</th>
                                    <th className="p-4">Child Name</th>
                                    <th className="p-4">Preferred Name</th>
                                    <th className="p-4">Date of Birth</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 pr-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-slate-400">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                                                <span className="font-bold">Loading children roster...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : children.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-slate-500">
                                            <p className="font-bold">No children found matching your search.</p>
                                            <p className="text-slate-400 text-[11px] mt-1">Try changing the search query or status filter.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    children.map((child) => {
                                        const initials = `${child.first_name?.[0] || ''}${child.last_name?.[0] || ''}`.toUpperCase();
                                        return (
                                            <tr 
                                                key={child.id} 
                                                className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                                onClick={() => navigate(`/daycare/children/${child.id}`)}
                                            >
                                                <td className="p-4 pl-6 font-mono font-bold text-emerald-800">
                                                    {child.admission_number || 'N/A'}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        {child.photo ? (
                                                            <img 
                                                                src={getImageUrl(child.photo)} 
                                                                alt={child.first_name} 
                                                                className="w-9 h-9 rounded-xl object-cover border border-slate-200" 
                                                            />
                                                        ) : (
                                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                                                {initials}
                                                            </div>
                                                        )}
                                                        <span className="font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                                                            {child.first_name} {child.last_name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-slate-600 font-medium">
                                                    {child.preferred_name ? `"${child.preferred_name}"` : '-'}
                                                </td>
                                                <td className="p-4 text-slate-600 font-medium">
                                                    {child.dob ? new Date(child.dob).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="p-4">
                                                    {getStatusBadge(child.status)}
                                                </td>
                                                <td className="p-4 pr-6 text-right">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/daycare/children/${child.id}`);
                                                        }}
                                                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 px-3 py-1.5 rounded-xl font-bold transition-all border border-transparent hover:border-emerald-200"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        <span>View Profile</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Footer */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500 font-medium">
                        <span>
                            Showing <strong className="text-slate-900">{children.length}</strong> children records
                        </span>
                        <div className="flex gap-2">
                            <button className="p-1.5 border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-100 disabled:opacity-40" disabled>
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-100 disabled:opacity-40" disabled>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default ChildList;
