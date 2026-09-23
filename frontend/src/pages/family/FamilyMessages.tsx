import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../api';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, Plus, ChevronRight, Inbox } from 'lucide-react';

interface Message {
    id: string; subject: string; body: string; message_type: string;
    is_read: boolean; read_at: string | null; sender_name: string; sender_role: string;
    reply_count: number; parent_message: string | null; created_at: string;
}
interface ThreadDetail { message: Message; replies: Message[]; }

const FamilyMessages: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'inbox' | 'sent'>('all');
    const [selectedThread, setSelectedThread] = useState<ThreadDetail | null>(null);
    const [composing, setComposing] = useState(false);
    const [newSubject, setNewSubject] = useState('');
    const [newBody, setNewBody] = useState('');
    const [replyBody, setReplyBody] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    const fetchMessages = () => {
        setLoading(true);
        api.get(`/family/messages/?type=${activeTab}`).then(res => setMessages(res.data)).finally(() => setLoading(false));
    };

    useEffect(() => { fetchMessages(); }, [activeTab]);

    const openThread = async (msg: Message) => {
        const res = await api.get(`/family/messages/${msg.id}/`);
        setSelectedThread(res.data);
        // Refresh list to update read status
        fetchMessages();
    };

    const sendMessage = async () => {
        if (!newSubject.trim() || !newBody.trim()) { setError('Subject and message are required.'); return; }
        setSending(true);
        setError('');
        try {
            await api.post('/family/messages/', { subject: newSubject, body: newBody });
            setComposing(false);
            setNewSubject(''); setNewBody('');
            fetchMessages();
        } catch { setError('Failed to send message.'); } finally { setSending(false); }
    };

    const sendReply = async () => {
        if (!selectedThread || !replyBody.trim()) return;
        setSending(true);
        try {
            await api.post('/family/messages/', {
                subject: `Re: ${selectedThread.message.subject}`,
                body: replyBody,
                parent_message: selectedThread.message.id,
            });
            setReplyBody('');
            const res = await api.get(`/family/messages/${selectedThread.message.id}/`);
            setSelectedThread(res.data);
        } finally { setSending(false); }
    };

    const unreadCount = messages.filter(m => !m.is_read && m.message_type === 'staff_to_guardian').length;

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            Messages {unreadCount > 0 && <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>}
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5">Communicate directly with your daycare</p>
                    </div>
                    <button onClick={() => setComposing(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-md">
                        <Plus className="w-4 h-4" /> New Message
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1 w-fit">
                    {([['all', 'All'], ['inbox', 'Inbox'], ['sent', 'Sent']] as const).map(([val, label]) => (
                        <button key={val} onClick={() => setActiveTab(val)}
                            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === val ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* Message List */}
                {loading ? (
                    <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : messages.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center">
                        <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">No messages yet.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {messages.map((msg, i) => (
                            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                onClick={() => openThread(msg)}
                                className={`bg-white border rounded-2xl px-4 py-3 cursor-pointer flex items-center justify-between hover:shadow-md transition-shadow ${!msg.is_read && msg.message_type === 'staff_to_guardian' ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100'}`}>
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${msg.message_type === 'guardian_to_staff' ? 'bg-indigo-100' : 'bg-violet-100'}`}>
                                        {msg.message_type === 'guardian_to_staff' ? <Send className="w-4 h-4 text-indigo-600" /> : <Inbox className="w-4 h-4 text-violet-600" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-sm truncate ${!msg.is_read && msg.message_type === 'staff_to_guardian' ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}`}>
                                            {msg.subject}
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">
                                            {msg.sender_role === 'Guardian' ? 'You' : msg.sender_name} · {msg.reply_count > 0 ? `${msg.reply_count} repl${msg.reply_count === 1 ? 'y' : 'ies'}` : 'No replies'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                    <span className="text-xs text-slate-400">{new Date(msg.created_at).toLocaleDateString('en-CA')}</span>
                                    {!msg.is_read && msg.message_type === 'staff_to_guardian' && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                                    <ChevronRight className="w-4 h-4 text-slate-300" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Thread Modal */}
                <AnimatePresence>
                    {selectedThread && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
                                className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="font-semibold text-slate-800">{selectedThread.message.subject}</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">from {selectedThread.message.sender_name} · {new Date(selectedThread.message.created_at).toLocaleDateString('en-CA')}</p>
                                    </div>
                                    <button onClick={() => setSelectedThread(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {[selectedThread.message, ...selectedThread.replies].map(msg => (
                                        <div key={msg.id} className={`flex ${msg.sender_role === 'Guardian' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.sender_role === 'Guardian' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                                                <p className="text-xs font-medium mb-1 opacity-70">{msg.sender_name}</p>
                                                <p className="text-sm">{msg.body}</p>
                                                <p className={`text-xs mt-1 opacity-60`}>{new Date(msg.created_at).toLocaleString('en-CA')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Reply Box */}
                                <div className="px-6 py-4 border-t border-slate-100">
                                    <div className="flex gap-2">
                                        <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} rows={2}
                                            placeholder="Write a reply..."
                                            className="flex-1 resize-none border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                        <button onClick={sendReply} disabled={sending || !replyBody.trim()}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-xl font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-1">
                                            <Send className="w-4 h-4" /> Reply
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Compose Modal */}
                <AnimatePresence>
                    {composing && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
                                className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                                    <h3 className="font-semibold text-slate-800">New Message</h3>
                                    <button onClick={() => setComposing(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
                                </div>
                                <div className="p-6 space-y-4">
                                    {error && <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">{error}</p>}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Subject</label>
                                        <input value={newSubject} onChange={e => setNewSubject(e.target.value)}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                            placeholder="What is this about?" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Message</label>
                                        <textarea value={newBody} onChange={e => setNewBody(e.target.value)} rows={5}
                                            className="w-full resize-none border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                            placeholder="Write your message..." />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={() => setComposing(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
                                        <button onClick={sendMessage} disabled={sending}
                                            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                            <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Send'}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Layout>
    );
};

export default FamilyMessages;
