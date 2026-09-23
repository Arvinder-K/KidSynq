import React, { useState, useEffect } from 'react';
import api from '../api';
import { Megaphone, Plus, Edit, Trash2, X, Send, Clock, CheckCircle } from 'lucide-react';

interface SystemAnnouncement {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  publish_date: string | null;
  created_by: number | null;
  target_daycares: string[]; // Daycare IDs
  created_at: string;
}

interface Daycare {
  id: string;
  name: string;
}

const SystemAnnouncementTab: React.FC = () => {
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [daycares, setDaycares] = useState<Daycare[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [targetDaycares, setTargetDaycares] = useState<string[]>([]);

  useEffect(() => {
    fetchAnnouncements();
    fetchDaycares();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await api.get('http://localhost:8000/api/super-admin/announcements/');
      setAnnouncements(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDaycares = async () => {
    try {
      const response = await api.get('http://localhost:8000/api/super-admin/daycares/');
      setDaycares(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching daycares:', error);
    }
  };

  const openModal = (announcement?: SystemAnnouncement) => {
    if (announcement) {
      setEditingId(announcement.id);
      setTitle(announcement.title);
      setContent(announcement.content);
      setStatus(announcement.status);
      setTargetDaycares(announcement.target_daycares || []);
    } else {
      setEditingId(null);
      setTitle('');
      setContent('');
      setStatus('draft');
      setTargetDaycares([]);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title,
        content,
        status,
        target_daycares: targetDaycares
      };

      if (editingId) {
        await api.put(`http://localhost:8000/api/super-admin/announcements/${editingId}/`, payload);
      } else {
        await api.post('http://localhost:8000/api/super-admin/announcements/', payload);
      }
      
      setShowModal(false);
      fetchAnnouncements();
    } catch (error) {
      console.error('Error saving announcement:', error);
      alert('Error saving announcement. Please check console for details.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      try {
        await api.delete(`http://localhost:8000/api/super-admin/announcements/${id}/`);
        fetchAnnouncements();
      } catch (error) {
        console.error('Error deleting announcement:', error);
      }
    }
  };

  const toggleDaycare = (id: string) => {
    setTargetDaycares(prev => 
      prev.includes(id) ? prev.filter(dId => dId !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Announcements</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Broadcast messages and updates to daycares.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          <span>New Announcement</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-12 text-center">
            <Megaphone size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No announcements yet</h3>
            <p className="text-gray-500 dark:text-gray-400">Create your first announcement to notify daycares.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{announcement.title}</h3>
                      {announcement.status === 'published' ? (
                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                          <CheckCircle size={12} /> Published
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                          <Clock size={12} /> Draft
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-600 dark:text-gray-300 text-sm whitespace-pre-wrap">{announcement.content}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        {new Date(announcement.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Send size={14} />
                        {announcement.target_daycares?.length > 0 
                          ? `${announcement.target_daycares.length} selected daycares`
                          : 'All Daycares (Global)'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => openModal(announcement)}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(announcement.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingId ? 'Edit Announcement' : 'Create System Announcement'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="announcement-form" onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="E.g., System Maintenance Scheduled"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message Content</label>
                  <textarea
                    required
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-y"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your announcement here..."
                  ></textarea>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Status</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value="draft"
                        checked={status === 'draft'}
                        onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Draft</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value="published"
                        checked={status === 'published'}
                        onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Published</span>
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Published announcements are immediately visible to target daycares.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Target Daycares (Optional)
                  </label>
                  <p className="text-xs text-gray-500 mb-3">Leave all unchecked to broadcast to ALL daycares globally.</p>
                  
                  <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-800 space-y-1">
                    {daycares.map(daycare => (
                      <label key={daycare.id} className="flex items-center p-2 hover:bg-white dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
                        <input 
                          type="checkbox"
                          className="rounded text-indigo-600 focus:ring-indigo-500 mr-3"
                          checked={targetDaycares.includes(daycare.id)}
                          onChange={() => toggleDaycare(daycare.id)}
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{daycare.name}</span>
                      </label>
                    ))}
                    {daycares.length === 0 && (
                      <div className="p-4 text-center text-sm text-gray-500">No daycares available.</div>
                    )}
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                form="announcement-form"
                type="submit"
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm"
              >
                {editingId ? 'Save Changes' : 'Create Announcement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemAnnouncementTab;
