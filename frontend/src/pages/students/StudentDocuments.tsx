import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api';

const StudentDocuments: React.FC = () => {
    const { student } = useOutletContext<any>();
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');

    const fetchDocuments = async () => {
        try {
            const response = await api.get(`/students/${student.id}/documents/`);
            setDocuments(response.data);
        } catch (err) {
            console.error("Failed to fetch documents", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [student.id]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !title) return;
        setUploading(true);
        
        const formData = new FormData();
        formData.append('file_path', file);
        formData.append('title', title);
        
        try {
            await api.post(`/students/${student.id}/documents/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setFile(null);
            setTitle('');
            fetchDocuments();
        } catch (err) {
            console.error("Failed to upload document", err);
            alert("Upload failed.");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this document permanently?')) return;
        try {
            await api.delete(`/students/${student.id}/documents/${id}/`);
            fetchDocuments();
        } catch (err) {
            console.error("Error deleting document", err);
        }
    };

    if (loading) return <div>Loading documents...</div>;

    return (
        <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Student Documents</h3>
                <p className="mt-1 text-sm text-gray-500">Upload birth certificates, vaccination records, etc.</p>
            </div>
            
            <div className="px-4 py-5 sm:p-6">
                <form onSubmit={handleUpload} className="mb-8 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                    <h4 className="text-sm font-medium text-gray-900 mb-4">Upload New Document</h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-end">
                        <div className="sm:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Document Title</label>
                            <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Birth Certificate" className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                        </div>
                        <div className="sm:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">File</label>
                            <input type="file" required onChange={e => e.target.files && setFile(e.target.files[0])} className="mt-1 block w-full text-sm text-gray-500" />
                        </div>
                        <div className="sm:col-span-1">
                            <button type="submit" disabled={uploading || !file || !title} className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                                {uploading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </form>

                <ul className="divide-y divide-gray-200 border-t border-gray-200">
                    {documents.map((doc) => (
                        <li key={doc.id} className="py-4 flex items-center justify-between">
                            <div className="flex items-center">
                                <svg className="h-8 w-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                </svg>
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                                    <p className="text-xs text-gray-500">Uploaded on {new Date(doc.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex space-x-4">
                                <a href={doc.file_path} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900 text-sm">View</a>
                                <button onClick={() => handleDelete(doc.id)} className="text-red-600 hover:text-red-900 text-sm">Delete</button>
                            </div>
                        </li>
                    ))}
                    {documents.length === 0 && <p className="py-6 text-sm text-gray-500 text-center">No documents found.</p>}
                </ul>
            </div>
        </div>
    );
};

export default StudentDocuments;
