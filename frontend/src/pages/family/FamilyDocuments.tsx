import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api, { BACKEND_URL } from '../../api';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Download, File, FileText, Image, Upload, X } from 'lucide-react';

interface Child { id: string; first_name: string; last_name: string; preferred_name: string | null; }
interface Document {
    id: string; name: string; document_type: string | null; file: string | null;
    file_size: number | null; description: string | null; created_at: string;
}

const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <Image className="w-5 h-5 text-emerald-600" />;
    if (['pdf'].includes(ext || '')) return <FileText className="w-5 h-5 text-red-500" />;
    return <File className="w-5 h-5 text-indigo-500" />;
};

const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
};

const FamilyDocuments: React.FC = () => {
    const [children, setChildren] = useState<Child[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/family/children/').then(res => {
            setChildren(res.data);
            if (res.data.length > 0) setSelectedChildId(res.data[0].id);
        });
    }, []);

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadName, setUploadName] = useState('');
    const [uploadDescription, setUploadDescription] = useState('');
    const [uploadType, setUploadType] = useState('Other');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    const fetchDocuments = () => {
        if (!selectedChildId) return;
        setLoading(true);
        api.get(`/family/children/${selectedChildId}/documents/`).then(res => setDocuments(res.data)).finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchDocuments();
    }, [selectedChildId]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedChildId || !uploadFile) return;

        setUploading(true);
        setUploadError('');

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('title', uploadName || uploadFile.name);
        formData.append('description', uploadDescription);
        formData.append('document_type', uploadType);

        try {
            await api.post(`/family/children/${selectedChildId}/documents/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setIsUploadModalOpen(false);
            setUploadFile(null);
            setUploadName('');
            setUploadDescription('');
            setUploadType('Other');
            fetchDocuments();
        } catch (err: any) {
            setUploadError(err.response?.data?.detail || 'Failed to upload document.');
        } finally {
            setUploading(false);
        }
    };

    const getUrl = (url: string | null) => {
        if (!url) return '#';
        if (url.startsWith('http')) return url;
        return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Documents</h1>
                        <p className="text-slate-500 text-sm mt-0.5">Documents for your child</p>
                    </div>
                    {selectedChildId && (
                        <button onClick={() => setIsUploadModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors w-fit">
                            <Upload className="w-4 h-4" />
                            Upload Document
                        </button>
                    )}
                </div>

                {/* Child Selector */}
                {children.length > 1 && (
                    <div className="flex gap-2 flex-wrap">
                        {children.map(child => (
                            <button key={child.id} onClick={() => setSelectedChildId(child.id)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${selectedChildId === child.id ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                                {child.preferred_name || `${child.first_name} ${child.last_name}`}
                            </button>
                        ))}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : documents.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center">
                        <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">No documents shared yet.</p>
                        <p className="text-slate-400 text-sm mt-1">Documents uploaded by your daycare will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {documents.map((doc, i) => (
                            <motion.div key={doc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                        {getFileIcon(doc.name)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-800 text-sm truncate">{doc.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {doc.document_type && <span className="text-xs text-slate-400">{doc.document_type}</span>}
                                            {doc.file_size && <span className="text-xs text-slate-400">{formatSize(doc.file_size)}</span>}
                                            <span className="text-xs text-slate-400">{new Date(doc.created_at).toLocaleDateString('en-CA')}</span>
                                        </div>
                                        {doc.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{doc.description}</p>}
                                    </div>
                                </div>
                                {doc.file && (
                                    <a href={getUrl(doc.file)} target="_blank" rel="noopener noreferrer" download
                                        className="ml-4 shrink-0 flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-2 rounded-xl text-xs font-medium transition-colors border border-indigo-200">
                                        <Download className="w-3.5 h-3.5" /> Download
                                    </a>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            <AnimatePresence>
                {isUploadModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsUploadModalOpen(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl overflow-hidden">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Upload className="w-5 h-5 text-indigo-500" />
                                    Upload Document
                                </h2>
                                <button onClick={() => setIsUploadModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {uploadError && (
                                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">
                                    {uploadError}
                                </div>
                            )}

                            <form onSubmit={handleUpload} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">File</label>
                                    <input type="file" required onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-slate-200 rounded-xl p-2 bg-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Document Name</label>
                                    <input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Leave blank to use file name" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Document Type</label>
                                    <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm appearance-none">
                                        <option value="Identification">Identification</option>
                                        <option value="Medical">Medical Form</option>
                                        <option value="Registration">Registration Form</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description (Optional)</label>
                                    <textarea value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} rows={2} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm resize-none"></textarea>
                                </div>
                                <div className="pt-4 flex justify-end gap-3">
                                    <button type="button" onClick={() => setIsUploadModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                                    <button type="submit" disabled={uploading || !uploadFile} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                        {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                                        {uploading ? 'Uploading...' : 'Upload'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </Layout>
    );
};

export default FamilyDocuments;
