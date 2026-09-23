import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api';
import type { Child } from './ChildProfileLayout';
import { FileText, Download, Trash2, Plus, Calendar, ShieldCheck, AlertCircle } from 'lucide-react';
import ConfirmationDialog from '../../components/ConfirmationDialog';

interface ContextType {
    child: Child;
    refreshChild: () => void;
}

interface Document {
    id: string;
    title: string;
    file_type: string;
    file_size: number;
    status: string;
    current_expiry_date: string | null;
}

const ChildDocuments: React.FC = () => {
    const { child } = useOutletContext<ContextType>();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    
    const [formData, setFormData] = useState({
        title: '',
        expiry_date: ''
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Delete Confirmation
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

    useEffect(() => {
        fetchDocuments();
    }, [child.id]);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/daycare/children/${child.id}/documents/`);
            setDocuments(response.data);
        } catch (error) {
            console.error("Failed to fetch documents:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const MAX_SIZE = 10 * 1024 * 1024; // 10MB
            
            if (file.size > MAX_SIZE) {
                setUploadError("File size exceeds 10MB limit.");
                setSelectedFile(null);
                return;
            }
            
            setUploadError(null);
            setSelectedFile(file);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) {
            setUploadError("Please select a file to upload.");
            return;
        }

        const data = new FormData();
        data.append('file_path', selectedFile);
        data.append('title', formData.title);
        data.append('file_type', selectedFile.type);
        data.append('file_size', selectedFile.size.toString());
        if (formData.expiry_date) {
            data.append('expiry_date', formData.expiry_date);
        }

        try {
            await api.post(`/daycare/children/${child.id}/documents/`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setIsUploadModalOpen(false);
            setFormData({ title: '', expiry_date: '' });
            setSelectedFile(null);
            fetchDocuments();
        } catch (error) {
            console.error("Failed to upload document:", error);
            setUploadError("Failed to upload document. Please try again.");
        }
    };

    const handleDownload = async (doc: Document) => {
        try {
            const response = await api.get(`/daycare/documents/${doc.id}/download/`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', doc.title);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (error) {
            console.error("Failed to download document:", error);
            alert("Failed to download document.");
        }
    };

    const confirmDelete = (doc: Document) => {
        setDocumentToDelete(doc);
        setDeleteConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (documentToDelete) {
            try {
                await api.delete(`/daycare/documents/${documentToDelete.id}/`);
                fetchDocuments();
            } catch (error) {
                console.error("Failed to delete document:", error);
            } finally {
                setDeleteConfirmOpen(false);
                setDocumentToDelete(null);
            }
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const isExpired = (dateString: string | null) => {
        if (!dateString) return false;
        return new Date(dateString) < new Date();
    };

    if (loading) {
        return (
            <div className="py-12 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                    <FileText className="w-6 h-6 text-indigo-500" />
                    <span>Documents & Forms</span>
                </h2>
                <button
                    onClick={() => {
                        setUploadError(null);
                        setSelectedFile(null);
                        setFormData({ title: '', expiry_date: '' });
                        setIsUploadModalOpen(true);
                    }}
                    className="inline-flex items-center space-x-2 px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>Upload Document</span>
                </button>
            </div>

            {documents.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <ShieldCheck className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No documents found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Upload secure documents for this child, such as medical records or IDs.
                    </p>
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Document Details
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Expiry Date
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Size
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {documents.map((doc) => {
                                const expired = isExpired(doc.current_expiry_date);
                                return (
                                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                                                    <FileText className="h-6 w-6" />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{doc.title}</div>
                                                    <div className="text-xs text-gray-500">{doc.file_type || 'Unknown Format'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {doc.current_expiry_date ? (
                                                <div className={`flex items-center text-sm ${expired ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                                                    {expired && <AlertCircle className="w-4 h-4 mr-1.5" />}
                                                    {doc.current_expiry_date}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-500">No expiry</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatBytes(doc.file_size || 0)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleDownload(doc)}
                                                className="text-indigo-600 hover:text-indigo-900 mx-2 p-1 rounded-md hover:bg-indigo-50 transition-colors"
                                                title="Secure Download"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => confirmDelete(doc)}
                                                className="text-red-600 hover:text-red-900 mx-2 p-1 rounded-md hover:bg-red-50 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsUploadModalOpen(false)}></div>

                        <div className="relative inline-block w-full max-w-md px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:p-6">
                            <div>
                                <h3 className="text-lg font-medium leading-6 text-gray-900 flex items-center">
                                    <ShieldCheck className="w-5 h-5 mr-2 text-indigo-500" />
                                    Secure Upload
                                </h3>
                                <form onSubmit={handleUpload} className="mt-4 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Document Title *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            placeholder="e.g. Birth Certificate"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Expiry Date (Optional)</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Calendar className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <input
                                                type="date"
                                                value={formData.expiry_date}
                                                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                                                className="block w-full pl-10 pr-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            />
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">Leave blank if the document never expires.</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">File * (Max 10MB)</label>
                                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:bg-gray-50 transition-colors">
                                            <div className="space-y-1 text-center">
                                                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                                                <div className="flex text-sm text-gray-600 justify-center">
                                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                                        <span>Upload a file</span>
                                                        <input
                                                            id="file-upload"
                                                            name="file-upload"
                                                            type="file"
                                                            className="sr-only"
                                                            ref={fileInputRef}
                                                            onChange={handleFileChange}
                                                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                        />
                                                    </label>
                                                </div>
                                                <p className="text-xs text-gray-500">PDF, PNG, JPG up to 10MB</p>
                                                {selectedFile && (
                                                    <p className="text-sm font-medium text-indigo-600 mt-2 truncate max-w-[200px] mx-auto">
                                                        Selected: {selectedFile.name}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {uploadError && (
                                        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md flex items-start">
                                            <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
                                            {uploadError}
                                        </div>
                                    )}

                                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                                        <button
                                            type="submit"
                                            disabled={!selectedFile || !formData.title}
                                            className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                                        >
                                            Upload
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsUploadModalOpen(false)}
                                            className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={deleteConfirmOpen}
                title="Delete Document"
                message={`Are you sure you want to permanently delete "${documentToDelete?.title}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirmOpen(false)}
            />
        </div>
    );
};

export default ChildDocuments;
