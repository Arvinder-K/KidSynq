import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api';
import { motion } from 'framer-motion';
import { Calendar, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface Holiday {
    id: string;
    name: string;
    holiday_date: string;
    end_date: string | null;
    description: string | null;
    status: string;
}

const DaycareHolidays: React.FC = () => {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(true);
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentHoliday, setCurrentHoliday] = useState<Partial<Holiday>>({});
    const [notification, setNotification] = useState<{type: 'success'|'error', message: string} | null>(null);

    useEffect(() => {
        fetchHolidays();
    }, [yearFilter]);

    const fetchHolidays = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/daycare/holidays/?year=${yearFilter}`);
            setHolidays(response.data);
        } catch (error) {
            console.error("Error fetching holidays", error);
            showNotification('error', 'Failed to load holidays.');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = { ...currentHoliday };
            if (payload.end_date === '') {
                payload.end_date = null;
            }
            if (payload.id) {
                await api.patch(`/daycare/holidays/${payload.id}/`, payload);
                showNotification('success', 'Holiday updated successfully.');
            } else {
                await api.post('/daycare/holidays/', payload);
                showNotification('success', 'Holiday added successfully.');
            }
            setIsModalOpen(false);
            fetchHolidays();
        } catch (error: any) {
            showNotification('error', error.response?.data?.detail || 'Failed to save holiday.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this holiday?")) return;
        try {
            await api.delete(`/daycare/holidays/${id}/`);
            showNotification('success', 'Holiday deleted successfully.');
            fetchHolidays();
        } catch (error) {
            showNotification('error', 'Failed to delete holiday.');
        }
    };

    const toggleStatus = async (holiday: Holiday) => {
        try {
            const newStatus = holiday.status === 'Active' ? 'Inactive' : 'Active';
            await api.patch(`/daycare/holidays/${holiday.id}/`, { status: newStatus });
            showNotification('success', `Holiday marked as ${newStatus}.`);
            fetchHolidays();
        } catch (error) {
            showNotification('error', 'Failed to update status.');
        }
    };

    return (
        <Layout>
            <div className="max-w-6xl mx-auto pb-12 relative">
                {notification && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 ${notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                        <span className="font-medium text-sm">{notification.message}</span>
                    </motion.div>
                )}

                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Holidays</h1>
                        <p className="text-slate-500 mt-1">Manage daycare closures and holidays.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <select 
                            value={yearFilter} 
                            onChange={(e) => setYearFilter(e.target.value)}
                            className="bg-white border border-slate-300 text-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                        >
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button 
                            onClick={() => { setCurrentHoliday({ status: 'Active' }); setIsModalOpen(true); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add Holiday
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Name</th>
                                    <th className="px-6 py-4 font-semibold">Date</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {holidays.map((h) => (
                                    <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">{h.name}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                {h.holiday_date} {h.end_date && ` to ${h.end_date}`}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${h.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                                {h.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => toggleStatus(h)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Toggle Status">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => { setCurrentHoliday(h); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(h.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {holidays.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">No holidays found for this year.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold text-slate-800">{currentHoliday.id ? 'Edit Holiday' : 'Add Holiday'}</h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={handleSave} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Holiday Name</label>
                                    <input type="text" required value={currentHoliday.name || ''} onChange={e => setCurrentHoliday({...currentHoliday, name: e.target.value})} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Start Date</label>
                                        <input type="date" required value={currentHoliday.holiday_date || ''} onChange={e => setCurrentHoliday({...currentHoliday, holiday_date: e.target.value})} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">End Date (Optional)</label>
                                        <input type="date" value={currentHoliday.end_date || ''} onChange={e => setCurrentHoliday({...currentHoliday, end_date: e.target.value})} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Description (Optional)</label>
                                    <textarea value={currentHoliday.description || ''} onChange={e => setCurrentHoliday({...currentHoliday, description: e.target.value})} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500" rows={3}></textarea>
                                </div>
                                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                                    <button type="submit" className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm">Save Holiday</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default DaycareHolidays;
