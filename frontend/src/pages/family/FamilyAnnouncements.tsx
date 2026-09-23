import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../api';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, X, Filter } from 'lucide-react';

interface Announcement {
    id: string; title: string; content: string; type: string | null;
    published_at: string; is_read: boolean;
}

const typeColors: Record<string, string> = {
    'General': 'bg-blue-100 text-blue-700',
    'Event': 'bg-violet-100 text-violet-700',
    'Urgent': 'bg-red-100 text-red-700',
    'Policy': 'bg-amber-100 text-amber-700',
};

const FamilyAnnouncements: React.FC = () => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('');
    const [selected, setSelected] = useState<Announcement | null>(null);

    const fetchAnnouncements = () => {
        setLoading(true);
        const params = typeFilter ? `?type=${typeFilter}` : '';
        api.get(`/family/announcements/${params}`).then(res => setAnnouncements(res.data)).finally(() => setLoading(false));
    };

    useEffect(() => { fetchAnnouncements(); }, [typeFilter]);

    const open = async (ann: Announcement) => {
        setSelected(ann);
        if (!ann.is_read) {
            await api.post('/family/announcements/', { announcement_id: ann.id });
            setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, is_read: true } : a));
        }
    };

    const unreadCount = announcements.filter(a => !a.is_read).length;

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            Announcements {unreadCount > 0 && <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount} new</span>}
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5">Stay up to date with your daycare</p>
                    </div>
                </div>

                {/* Type Filter */}
                <div className="flex gap-2 flex-wrap items-center">
                    <Filter className="w-4 h-4 text-slate-400" />
                    {['', 'General', 'Event', 'Urgent', 'Policy'].map(type => (
                        <button key={type || 'all'} onClick={() => setTypeFilter(type)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${typeFilter === type ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                            {type || 'All'}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : announcements.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center">
                        <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">No announcements found.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {announcements.map((ann, i) => (
                            <motion.div key={ann.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                onClick={() => open(ann)} className={`bg-white border rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow ${!ann.is_read ? 'border-indigo-200' : 'border-slate-100'}`}>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {!ann.is_read && <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />}
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${typeColors[ann.type || 'General'] || typeColors['General']}`}>
                                            {ann.type || 'General'}
                                        </span>
                                        <p className={`text-sm truncate ${!ann.is_read ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}`}>{ann.title}</p>
                                    </div>
                                    <span className="text-xs text-slate-400 shrink-0">{new Date(ann.published_at).toLocaleDateString('en-CA')}</span>
                                </div>
                                {ann.content && (
                                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 pl-5">{ann.content}</p>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Detail Modal */}
                <AnimatePresence>
                    {selected && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
                                className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[selected.type || 'General'] || typeColors['General']}`}>
                                            {selected.type || 'General'}
                                        </span>
                                    </div>
                                    <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto px-6 py-5">
                                    <h2 className="font-bold text-slate-800 text-lg mb-1">{selected.title}</h2>
                                    <p className="text-xs text-slate-400 mb-4">{new Date(selected.published_at).toLocaleString('en-CA')}</p>
                                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{selected.content}</p>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Layout>
    );
};

export default FamilyAnnouncements;
