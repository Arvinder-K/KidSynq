import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, XCircle } from 'lucide-react';
import api from '../../api';
import Layout from '../../components/Layout';

interface WaitlistEntry {
    id: string;
    position: number | null;
    child_first_name: string;
    child_last_name: string;
    child_dob: string;
    applicant_name: string;
    applicant_email: string;
    applicant_phone: string;
    requested_start_date: string;
    preferred_program: string;
    preferred_branch: string;
    priority: number;
    waitlist_date: string;
    status: 'active' | 'contacted' | 'offered' | 'accepted' | 'declined' | 'removed' | 'converted';
    notes: string;
    application: string | null;
}

const Waitlist: React.FC = () => {
    const [entries, setEntries] = useState<WaitlistEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [filterStatus, setFilterStatus] = useState<string>('active');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);

    // Form states for manual add
    const [formData, setFormData] = useState({
        child_first_name: '',
        child_last_name: '',
        child_dob: '',
        applicant_name: '',
        applicant_email: '',
        applicant_phone: '',
        requested_start_date: '',
        preferred_program: '',
        preferred_branch: '',
        priority: 0,
        notes: ''
    });

    const fetchWaitlist = async () => {
        try {
            setLoading(true);
            const res = await api.get('daycare/waitlist/', {
                params: { status: filterStatus === 'all' ? undefined : filterStatus }
            });
            const data = res.data.results || res.data;
            setEntries(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError("Failed to load waitlist.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWaitlist();
    }, [filterStatus]);

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('daycare/waitlist/', formData);
            setShowAddModal(false);
            setFormData({
                child_first_name: '', child_last_name: '', child_dob: '',
                applicant_name: '', applicant_email: '', applicant_phone: '',
                requested_start_date: '', preferred_program: '', preferred_branch: '',
                priority: 0, notes: ''
            });
            fetchWaitlist();
        } catch (err) {
            alert("Failed to add to waitlist.");
        }
    };

    const handleUpdatePriority = async (id: string, newPriority: number) => {
        try {
            await api.patch(`daycare/waitlist/${id}/`, { priority: newPriority });
            fetchWaitlist();
        } catch (err) {
            alert("Failed to update priority.");
        }
    };

    const handleAction = async (id: string, action: string) => {
        try {
            if (action === 'remove') {
                await api.patch(`daycare/waitlist/${id}/`, { status: 'removed' });
            } else {
                await api.post(`daycare/waitlist/${id}/${action}/`);
            }
            fetchWaitlist();
        } catch (err) {
            alert(`Failed to perform action: ${action}`);
        }
    };

    const filtered = entries.filter(e => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                e.child_first_name.toLowerCase().includes(query) ||
                e.child_last_name.toLowerCase().includes(query) ||
                e.applicant_name.toLowerCase().includes(query)
            );
        }
        return true;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'contacted': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'offered': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'converted': case 'accepted': return 'bg-teal-100 text-teal-800 border-teal-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    return (
        <Layout>
            <div className="space-y-6 max-w-7xl mx-auto font-sans">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Waitlist Management</h1>
                        <p className="text-gray-500 text-sm mt-1">Track, prioritize, and manage prospective enrollments.</p>
                    </div>
                    <button 
                        onClick={() => setShowAddModal(true)}
                        className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs hover:bg-indigo-700 transition flex items-center gap-2"
                    >
                        <UserPlus className="w-4 h-4" /> Add to Waitlist
                    </button>
                </div>

                {error && (
                    <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold">
                        {error}
                    </div>
                )}

                {/* Controls */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between bg-white p-4 rounded-3xl shadow-sm border border-slate-200/90">
                    <div className="flex gap-1.5 p-1 bg-slate-100/80 rounded-2xl overflow-x-auto">
                        {['all', 'active', 'contacted', 'offered', 'converted', 'removed'].map(s => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${filterStatus === s ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search waitlist..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:bg-white rounded-xl text-xs font-medium outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                                <tr>
                                    <th className="px-6 py-4 text-left">#</th>
                                    <th className="px-6 py-4 text-left">Child</th>
                                    <th className="px-6 py-4 text-left">Applicant</th>
                                    <th className="px-6 py-4 text-left">Start Date</th>
                                    <th className="px-6 py-4 text-left">Priority</th>
                                    <th className="px-6 py-4 text-left">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {loading ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">Loading...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-bold">No waitlist entries found.</td></tr>
                                ) : (
                                    filtered.map(entry => (
                                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-6 py-4">
                                                {entry.position ? (
                                                    <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">
                                                        {entry.position}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900">{entry.child_first_name} {entry.child_last_name}</div>
                                                {entry.child_dob && <div className="text-xs text-slate-500">DOB: {entry.child_dob}</div>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900">{entry.applicant_name}</div>
                                                <div className="text-xs text-slate-500">{entry.applicant_email}</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-medium">
                                                {entry.requested_start_date || 'Flexible'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1">
                                                    <select 
                                                        value={entry.priority}
                                                        onChange={(e) => handleUpdatePriority(entry.id, parseInt(e.target.value))}
                                                        className="text-xs border border-slate-200 rounded-lg bg-slate-50 px-2 py-1 font-bold text-slate-700"
                                                    >
                                                        {[0,1,2,3,4,5].map(p => <option key={p} value={p}>Lvl {p}</option>)}
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(entry.status)} capitalize`}>
                                                    {entry.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {entry.status === 'active' && (
                                                    <button onClick={() => handleAction(entry.id, 'contact')} className="text-xs font-bold text-emerald-700 hover:text-emerald-800 px-3 py-1 bg-emerald-50 rounded-lg mr-2 transition">
                                                        Contact
                                                    </button>
                                                )}
                                                {entry.status === 'contacted' && (
                                                    <button onClick={() => handleAction(entry.id, 'offer')} className="text-xs font-bold text-purple-700 hover:text-purple-800 px-3 py-1 bg-purple-50 rounded-lg mr-2 transition">
                                                        Offer
                                                    </button>
                                                )}
                                                {['active', 'contacted', 'offered'].includes(entry.status) && (
                                                    <button onClick={() => handleAction(entry.id, 'convert')} className="text-xs font-bold text-teal-700 hover:text-teal-800 px-3 py-1 bg-teal-50 rounded-lg mr-2 transition">
                                                        Convert
                                                    </button>
                                                )}
                                                {['active', 'contacted'].includes(entry.status) && (
                                                    <button onClick={() => handleAction(entry.id, 'remove')} className="text-xs font-bold text-rose-700 hover:text-rose-800 px-3 py-1 bg-rose-50 rounded-lg transition">
                                                        Remove
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Add Waitlist Modal */}
                <AnimatePresence>
                    {showAddModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden">
                                <form onSubmit={handleAddSubmit}>
                                    <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                                        <h3 className="text-lg font-bold text-slate-900">Manually Add to Waitlist</h3>
                                        <button type="button" onClick={() => setShowAddModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"><XCircle className="w-5 h-5"/></button>
                                    </div>
                                    <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4 text-xs">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-xs font-bold text-slate-700 mb-1">Child First Name*</label><input required type="text" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" value={formData.child_first_name} onChange={e => setFormData({...formData, child_first_name: e.target.value})}/></div>
                                            <div><label className="block text-xs font-bold text-slate-700 mb-1">Child Last Name*</label><input required type="text" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" value={formData.child_last_name} onChange={e => setFormData({...formData, child_last_name: e.target.value})}/></div>
                                            <div><label className="block text-xs font-bold text-slate-700 mb-1">Applicant Name*</label><input required type="text" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" value={formData.applicant_name} onChange={e => setFormData({...formData, applicant_name: e.target.value})}/></div>
                                            <div><label className="block text-xs font-bold text-slate-700 mb-1">Email*</label><input required type="email" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" value={formData.applicant_email} onChange={e => setFormData({...formData, applicant_email: e.target.value})}/></div>
                                            <div><label className="block text-xs font-bold text-slate-700 mb-1">Phone</label><input type="text" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" value={formData.applicant_phone} onChange={e => setFormData({...formData, applicant_phone: e.target.value})}/></div>
                                            <div><label className="block text-xs font-bold text-slate-700 mb-1">Requested Start Date</label><input type="date" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" value={formData.requested_start_date} onChange={e => setFormData({...formData, requested_start_date: e.target.value})}/></div>
                                            <div><label className="block text-xs font-bold text-slate-700 mb-1">Priority Level</label><select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold" value={formData.priority} onChange={e => setFormData({...formData, priority: parseInt(e.target.value)})}>
                                                <option value={0}>0 - Standard</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={5}>5 - Highest</option>
                                            </select></div>
                                        </div>
                                        <div><label className="block text-xs font-bold text-slate-700 mb-1">Internal Notes</label><textarea className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea></div>
                                    </div>
                                    <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                                        <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold">Cancel</button>
                                        <button type="submit" className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-emerald-700">Add Entry</button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </Layout>
    );
};

export default Waitlist;
