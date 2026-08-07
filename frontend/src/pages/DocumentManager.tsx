import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';

interface DocumentFolder {
    id: string;
    name: string;
    description: string;
}

interface DocumentItem {
    id: string;
    title: string;
    description: string;
    file_path: string;
    file_type: string;
    file_size: number;
    created_at: string;
}

const DocumentManager: React.FC = () => {
    const [folders, setFolders] = useState<DocumentFolder[]>([]);
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [currentFolder, setCurrentFolder] = useState<DocumentFolder | null>(null);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [formError, setFormError] = useState('');

    // Folder form
    const [folderName, setFolderName] = useState('');
    const [folderDesc, setFolderDesc] = useState('');

    // Upload form
    const [docTitle, setDocTitle] = useState('');
    const [docDesc, setDocDesc] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const fetchFolders = async () => {
        try {
            const res = await api.get('/documents/folders/');
            setFolders(res.data);
        } catch (err) {
            console.error("Failed to fetch folders", err);
        }
    };

    const fetchDocuments = async (folderId: string | null) => {
        setLoading(true);
        try {
            const res = await api.get('/documents/', { params: { folder_id: folderId } });
            setDocuments(res.data);
        } catch (err) {
            console.error("Failed to fetch documents", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFolders();
        fetchDocuments(null); // Root folder documents initially
    }, []);

    const handleFolderClick = (folder: DocumentFolder) => {
        setCurrentFolder(folder);
        fetchDocuments(folder.id);
    };

    const handleNavigateUp = () => {
        setCurrentFolder(null);
        fetchDocuments(null);
    };

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        try {
            await api.post('/documents/folders/', {
                name: folderName,
                description: folderDesc
            });
            setShowFolderModal(false);
            setFolderName('');
            setFolderDesc('');
            fetchFolders();
        } catch (err: any) {
            setFormError('Failed to create folder.');
        }
    };

    const handleUploadDocument = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        if (!selectedFile) {
            setFormError('Please select a file to upload.');
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('title', docTitle);
        formData.append('description', docDesc);
        formData.append('folder_id', currentFolder ? currentFolder.id : '');

        try {
            await api.post('/documents/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setShowUploadModal(false);
            setDocTitle('');
            setDocDesc('');
            setSelectedFile(null);
            fetchDocuments(currentFolder ? currentFolder.id : null);
        } catch (err: any) {
            setFormError('Failed to upload document.');
        }
    };

    return (
        <Layout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Document Management</h1>
                    <p className="mt-1 text-sm text-gray-500">Securely store and manage daycare records.</p>
                </div>
                <div className="flex space-x-3">
                    <button onClick={() => setShowFolderModal(true)} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-md text-sm font-medium shadow-sm">
                        New Folder
                    </button>
                    <button onClick={() => setShowUploadModal(true)} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium shadow-sm">
                        Upload File
                    </button>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6 min-h-[500px]">
                {/* Breadcrumbs */}
                <div className="flex items-center text-sm text-gray-500 mb-6 pb-4 border-b border-gray-200">
                    <button onClick={handleNavigateUp} className={`hover:text-indigo-600 ${!currentFolder ? 'font-semibold text-gray-900' : ''}`}>
                        My Documents
                    </button>
                    {currentFolder && (
                        <>
                            <span className="mx-2">/</span>
                            <span className="font-semibold text-gray-900">{currentFolder.name}</span>
                        </>
                    )}
                </div>

                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading files...</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        
                        {/* Render Folders (only at root) */}
                        {!currentFolder && folders.map((folder) => (
                            <div 
                                key={folder.id} 
                                onClick={() => handleFolderClick(folder)}
                                className="group flex flex-col items-center p-4 border border-transparent rounded-lg hover:bg-gray-50 hover:border-gray-200 cursor-pointer transition text-center"
                            >
                                <svg className="h-16 w-16 text-blue-400 group-hover:text-blue-500 transition mb-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-900 truncate w-full">{folder.name}</span>
                            </div>
                        ))}

                        {/* Render Documents */}
                        {documents.map((doc) => (
                            <a 
                                key={doc.id} 
                                href={doc.file_path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex flex-col items-center p-4 border border-transparent rounded-lg hover:bg-gray-50 hover:border-gray-200 cursor-pointer transition text-center"
                            >
                                <svg className="h-16 w-16 text-gray-400 group-hover:text-indigo-500 transition mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                                </svg>
                                <span className="text-sm font-medium text-gray-900 truncate w-full">{doc.title}</span>
                                <span className="text-xs text-gray-500 mt-1">{(doc.file_size / 1024).toFixed(1)} KB</span>
                            </a>
                        ))}

                        {!currentFolder && folders.length === 0 && documents.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-500">
                                This folder is empty. Create a folder or upload a document.
                            </div>
                        )}
                        {currentFolder && documents.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-500">
                                No documents in this folder yet.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create Folder Modal */}
            {showFolderModal && (
                <div className="fixed z-10 inset-0 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowFolderModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleCreateFolder}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Create New Folder</h3>
                                    {formError && <div className="bg-red-50 p-2 mb-4 text-sm text-red-700">{formError}</div>}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700">Folder Name</label>
                                        <input type="text" required value={folderName} onChange={e => setFolderName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700">Description (Optional)</label>
                                        <input type="text" value={folderDesc} onChange={e => setFolderDesc(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm">Create</button>
                                    <button type="button" onClick={() => setShowFolderModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Document Modal */}
            {showUploadModal && (
                <div className="fixed z-10 inset-0 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowUploadModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleUploadDocument}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Upload Document</h3>
                                    {formError && <div className="bg-red-50 p-2 mb-4 text-sm text-red-700">{formError}</div>}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700">Select File</label>
                                        <input type="file" required onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700">Document Title</label>
                                        <input type="text" required value={docTitle} onChange={e => setDocTitle(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700">Description (Optional)</label>
                                        <input type="text" value={docDesc} onChange={e => setDocDesc(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm">Upload</button>
                                    <button type="button" onClick={() => setShowUploadModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default DocumentManager;
