import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';

interface Announcement {
    id: string;
    title: string;
    content: string;
    type: string;
    status: string;
    published_at: string;
    sender_name: string;
}

const CommunicationDashboard: React.FC = () => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const fetchAnnouncements = async () => {
        setLoading(true);
        try {
            const res = await api.get('/communication/announcements/');
            setAnnouncements(res.data);
        } catch (error) {
            console.error("Failed to fetch announcements", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormLoading(true);
        const formData = new FormData(e.currentTarget);
        try {
            await api.post('/communication/announcements/', {
                title: formData.get('title'),
                content: formData.get('content'),
                type: formData.get('type')
            });
            setShowForm(false);
            fetchAnnouncements();
        } catch (error) {
            console.error("Failed to create announcement", error);
        } finally {
            setFormLoading(false);
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Emergency': return 'bg-red-100 text-red-800 border-red-200';
            case 'Reminder': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'Event': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-blue-100 text-blue-800 border-blue-200';
        }
    };

    return (
        <Layout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Communication Hub</h1>
                    <p className="mt-1 text-sm text-gray-500">Post announcements to staff and parents.</p>
                </div>
                <button 
                    onClick={() => setShowForm(!showForm)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                    {showForm ? 'Cancel' : 'New Announcement'}
                </button>
            </div>

            {showForm && (
                <div className="bg-white shadow sm:rounded-lg mb-6 overflow-hidden border-t-4 border-indigo-500">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Post New Announcement</h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Title</label>
                                    <input type="text" name="title" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Type</label>
                                    <select name="type" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                        <option value="General">General</option>
                                        <option value="Reminder">Reminder</option>
                                        <option value="Event">Event</option>
                                        <option value="Emergency">Emergency</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Message Content</label>
                                <textarea name="content" rows={4} required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                            </div>
                            <div className="flex justify-end">
                                <button type="submit" disabled={formLoading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:bg-indigo-400">
                                    {formLoading ? 'Posting...' : 'Publish Announcement'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading announcements...</div>
                ) : announcements.length === 0 ? (
                    <div className="bg-white shadow sm:rounded-lg py-16 text-center text-gray-500">
                        No announcements posted yet.
                    </div>
                ) : (
                    announcements.map((announcement) => (
                        <div key={announcement.id} className={`bg-white shadow sm:rounded-lg border-l-4 ${getTypeColor(announcement.type).split(' ')[0]} overflow-hidden`}>
                            <div className="px-4 py-5 sm:p-6">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-bold text-gray-900">{announcement.title}</h3>
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${getTypeColor(announcement.type)}`}>
                                            {announcement.type}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-500">{new Date(announcement.published_at).toLocaleString()}</span>
                                </div>
                                <p className="text-gray-700 whitespace-pre-wrap mt-4">{announcement.content}</p>
                                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center text-sm text-gray-500">
                                        <span className="font-medium mr-1">Posted by:</span> {announcement.sender_name}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Layout>
    );
};

export default CommunicationDashboard;
