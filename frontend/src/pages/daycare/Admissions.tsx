import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search,  CheckCircle, XCircle, FileText, X, AlertCircle, Download, CheckSquare } from 'lucide-react';
import api, { BACKEND_URL } from '../../api';
import Layout from '../../components/Layout';

interface RegistrationApplication {
    id: string;
    application_number: string;
    applicant_name: string;
    applicant_email: string;
    applicant_phone: string;
    status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'waitlisted';
    submitted_at: string | null;
    created_at: string;
    application_data: any;
}

const Admissions: React.FC = () => {
    const [applications, setApplications] = useState<RegistrationApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterStatus, setStatus] = useState<string>('submitted');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedApp, setSelectedApp] = useState<RegistrationApplication | null>(null);
    const [processing, setProcessing] = useState(false);
    
    // For storing docs of selected app
    const [selectedAppDocs, setSelectedAppDocs] = useState<any[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);

    const fetchApplications = async () => {
        try {
            setLoading(true);
            const res = await api.get('daycare/applications/');
            const data = res.data;
            const applicationsData = data.results ? data.results : data;
            setApplications(Array.isArray(applicationsData) ? applicationsData : []);
        } catch (err: any) {
            setError(err.response?.data?.detail || err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications();
    }, []);
    
    useEffect(() => {
        if (selectedApp) {
            fetchDocsForApp(selectedApp.application_number);
        }
    }, [selectedApp]);

    const fetchDocsForApp = async (appNumber: string) => {
        try {
            setLoadingDocs(true);
            const res = await api.get(`daycare/applications/${appNumber}/documents/`);
            setSelectedAppDocs(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingDocs(false);
        }
    };

    const handleApprove = async (id: string, ignoreDuplicate = false) => {
        try {
            setProcessing(true);
            await api.post(`daycare/applications/${id}/approve/`, { ignore_duplicate: ignoreDuplicate });
            setSelectedApp(null);
            fetchApplications();
        } catch (err: any) {
            if (err.response?.status === 409 && err.response?.data?.duplicate_child_id) {
                if (window.confirm(err.response.data.detail + "\n\nDo you want to proceed and link this application to the existing child profile?")) {
                    handleApprove(id, true);
                    return;
                }
            } else {
                alert(err.response?.data?.detail || err.message);
            }
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async (id: string) => {
        try {
            setProcessing(true);
            await api.post(`daycare/applications/${id}/reject/`);
            setSelectedApp(null);
            fetchApplications();
        } catch (err: any) {
            alert(err.response?.data?.detail || err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleWaitlist = async (id: string) => {
        try {
            setProcessing(true);
            await api.post(`daycare/applications/${id}/waitlist/`);
            setSelectedApp(null);
            fetchApplications();
        } catch (err: any) {
            alert(err.response?.data?.detail || err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleDownloadDoc = (docId: string) => {
        const token = localStorage.getItem('access_token');
        // This is a naive way to download securely; using fetch and Blob is better to attach Authorization header
        fetch(`${BACKEND_URL}/api/daycare/documents/${docId}/download/`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            const filename = response.headers.get('content-disposition')?.split('filename=')[1] || `document-${docId}`;
            return response.blob().then(blob => ({blob, filename}));
        })
        .then(({blob, filename}) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        })
        .catch(() => alert("Error downloading document"));

    };

    const filtered = applications.filter(app => {
        if (filterStatus !== 'all' && app.status !== filterStatus) return false;
        if (searchQuery && !app.applicant_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    return (
        <Layout>
            <div className="space-y-6 max-w-7xl mx-auto font-sans">
                {error && (
                    <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl border border-rose-200 flex items-center gap-2 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                        {error}
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Admissions</h1>
                        <p className="text-gray-500 text-sm mt-1">Manage incoming enrollment applications and approvals.</p>
                    </div>
                </div>

                {/* Filter & Search Toolbar */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between bg-white p-4 rounded-3xl shadow-sm border border-slate-200/90">
                    <div className="flex gap-1.5 p-1 bg-slate-100/80 rounded-2xl overflow-x-auto">
                        {['all', 'submitted', 'approved', 'waitlisted', 'rejected'].map(s => (
                            <button
                                key={s}
                                onClick={() => setStatus(s)}
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
                            placeholder="Search applications..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50/80 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:bg-white rounded-xl text-xs font-medium outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            <tr>
                                <th className="px-6 py-4 text-left">Application</th>
                                <th className="px-6 py-4 text-left">Applicant</th>
                                <th className="px-6 py-4 text-left">Child</th>
                                <th className="px-6 py-4 text-left">Date Submitted</th>
                                <th className="px-6 py-4 text-left">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold">Loading applications...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-bold">No applications found.</td></tr>
                            ) : (
                                filtered.map((app) => (
                                    <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-mono text-xs font-bold text-emerald-800">{app.application_number}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900">{app.applicant_name}</div>
                                            <div className="text-xs text-slate-500">{app.applicant_email}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {app.application_data?.child?.firstName} {app.application_data?.child?.lastName}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                app.status === 'submitted' ? 'bg-amber-100 text-amber-800' :
                                                app.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                app.status === 'waitlisted' ? 'bg-purple-100 text-purple-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>
                                                {app.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => setSelectedApp(app)}
                                                className="text-indigo-600 hover:text-indigo-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                                            >
                                                Review
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AnimatePresence>
                {selectedApp && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                            onClick={() => !processing && setSelectedApp(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Review Application</h3>
                                    <p className="text-sm text-slate-500 mt-1">{selectedApp.application_number}</p>
                                </div>
                                <button 
                                    onClick={() => setSelectedApp(null)}
                                    disabled={processing}
                                    className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                {/* Details rendering */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-8">
                                        <section>
                                            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Applicant & Family</h4>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div><span className="text-slate-500 block mb-1">Applicant</span><span className="font-medium text-slate-900">{selectedApp.applicant_name}</span></div>
                                                <div><span className="text-slate-500 block mb-1">Email</span><span className="font-medium text-slate-900">{selectedApp.applicant_email}</span></div>
                                                <div><span className="text-slate-500 block mb-1">Phone</span><span className="font-medium text-slate-900">{selectedApp.applicant_phone}</span></div>
                                                <div><span className="text-slate-500 block mb-1">Family Name</span><span className="font-medium text-slate-900">{selectedApp.application_data?.family?.familyName}</span></div>
                                            </div>
                                        </section>
                                        <section>
                                            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Child</h4>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div><span className="text-slate-500 block mb-1">Name</span><span className="font-medium text-slate-900">{selectedApp.application_data?.child?.firstName} {selectedApp.application_data?.child?.lastName}</span></div>
                                                <div><span className="text-slate-500 block mb-1">DOB</span><span className="font-medium text-slate-900">{selectedApp.application_data?.child?.dob}</span></div>
                                                <div><span className="text-slate-500 block mb-1">Gender</span><span className="font-medium text-slate-900">{selectedApp.application_data?.child?.gender}</span></div>
                                                <div><span className="text-slate-500 block mb-1">Language</span><span className="font-medium text-slate-900">{selectedApp.application_data?.child?.language}</span></div>
                                            </div>
                                        </section>
                                        <section>
                                            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Additional Form Data</h4>
                                            {selectedApp.application_data?.dynamicForms && Object.keys(selectedApp.application_data.dynamicForms).length > 0 ? (
                                                <div className="text-sm space-y-4">
                                                    {Object.entries(selectedApp.application_data.dynamicForms).map(([formId, data]: [string, any]) => (
                                                        <div key={formId} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                            <div className="font-medium text-slate-700 mb-2">Form Data</div>
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                                {Object.entries(data).map(([field, value]: [string, any]) => (
                                                                    <div key={field}>
                                                                        <span className="text-slate-500 block text-xs">{field}</span>
                                                                        <span className="font-medium text-slate-900">{value}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <p className="text-sm text-slate-500">No additional form data provided.</p>}
                                        </section>
                                    </div>
                                    <div className="space-y-8">
                                        <section>
                                            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex justify-between items-center">
                                                Consents
                                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">{selectedApp.application_data?.consents?.length || 0} Signed</span>
                                            </h4>
                                            {selectedApp.application_data?.consents?.length > 0 ? (
                                                <div className="space-y-3">
                                                    {selectedApp.application_data.consents.map((c: any, i: number) => (
                                                        <div key={i} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
                                                            <div className="mt-0.5 text-green-500"><CheckSquare className="w-5 h-5"/></div>
                                                            <div>
                                                                <div className="font-medium text-slate-800 text-sm">{c.title} (v{c.version})</div>
                                                                <div className="text-xs text-slate-500 mt-1">Signed by {c.signature_name} on {new Date(c.signed_at).toLocaleString()}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <p className="text-sm text-slate-500">No consents signed.</p>}
                                        </section>
                                        
                                        <section>
                                            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex justify-between items-center">
                                                Documents
                                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">{selectedAppDocs.length} Uploaded</span>
                                            </h4>
                                            {loadingDocs ? (
                                                <p className="text-sm text-slate-500">Loading documents...</p>
                                            ) : selectedAppDocs.length > 0 ? (
                                                <div className="space-y-3">
                                                    {selectedAppDocs.map((doc: any, i: number) => (
                                                        <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><FileText className="w-4 h-4"/></div>
                                                                <div>
                                                                    <div className="font-medium text-slate-800 text-sm">{doc.document_type}</div>
                                                                    <div className="text-xs text-slate-500">{new Date(doc.uploaded_date).toLocaleDateString()}</div>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => handleDownloadDoc(doc.id)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                                <Download className="w-4 h-4"/>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <p className="text-sm text-slate-500">No documents uploaded.</p>}
                                        </section>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3 justify-end">
                                {selectedApp.status !== 'draft' && (
                                    <>
                                        <button
                                            onClick={() => handleReject(selectedApp.id)}
                                            disabled={processing}
                                            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 hover:text-red-600 transition-all flex items-center gap-2"
                                        >
                                            <XCircle className="w-4 h-4" /> Reject
                                        </button>
                                        <button
                                            onClick={() => handleWaitlist(selectedApp.id)}
                                            disabled={processing}
                                            className="px-4 py-2 bg-purple-50 text-purple-700 rounded-xl font-medium hover:bg-purple-100 transition-all flex items-center gap-2"
                                        >
                                            Add to Waitlist
                                        </button>
                                        <button
                                            onClick={() => handleApprove(selectedApp.id)}
                                            disabled={processing}
                                            className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-all flex items-center gap-2"
                                        >
                                            <CheckCircle className="w-4 h-4" /> Approve & Admit
                                        </button>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </Layout>
    );
};

export default Admissions;
