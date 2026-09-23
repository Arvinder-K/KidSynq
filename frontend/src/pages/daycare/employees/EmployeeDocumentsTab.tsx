import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { employeeService, type EmployeeDocument } from '../../../api/employeeService';

interface Props {
    employeeId: string;
}

export const EmployeeDocumentsTab: React.FC<Props> = ({ employeeId }) => {
    const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<EmployeeDocument>>({});
    const [error, setError] = useState<string | null>(null);

    const fetchDocuments = async () => {
        try {
            setLoading(true);
            const data = await employeeService.getEmployeeDocuments();
            // Filter by employee ID
            setDocuments(data.filter((d: EmployeeDocument) => d.employee === employeeId));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [employeeId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setError(null);
            if (editingId) {
                await employeeService.updateEmployeeDocument(editingId, formData);
            } else {
                await employeeService.createEmployeeDocument({ ...formData, employee: employeeId });
            }
            setIsAdding(false);
            setEditingId(null);
            setFormData({});
            fetchDocuments();
        } catch (err: any) {
            setError(err.response?.data?.status || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this document record?")) return;
        try {
            await employeeService.deleteEmployeeDocument(id);
            fetchDocuments();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8 mt-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900">Employee Documents</h2>
                {!isAdding && !editingId && (
                    <button
                        onClick={() => { setIsAdding(true); setFormData({}); }}
                        className="text-sm px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-medium flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Add Document
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                    {error}
                </div>
            )}

            {(isAdding || editingId) && (
                <form onSubmit={handleSubmit} className="mb-8 p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <h3 className="font-semibold text-slate-800 mb-4">{editingId ? 'Edit Document' : 'Add Document'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Document Type *</label>
                            <select required name="document_type" value={formData.document_type || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
                                <option value="">Select Type</option>
                                <option value="Resume">Resume / CV</option>
                                <option value="Contract">Contract</option>
                                <option value="ID">ID Proof</option>
                                <option value="PoliceCheck">Police Check</option>
                                <option value="Tax">Tax Form</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Document Name *</label>
                            <input required type="text" name="document_name" value={formData.document_name || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Document URL (S3 / Cloud Link) *</label>
                            <input required type="url" name="document_url" value={formData.document_url || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" placeholder="https://..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                            <input type="date" name="expiry_date" value={formData.expiry_date || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                            <select name="status" value={formData.status || 'Active'} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
                                <option value="Active">Active</option>
                                <option value="Expired">Expired</option>
                                <option value="Archived">Archived</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                            <input type="text" name="notes" value={formData.notes || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => { setIsAdding(false); setEditingId(null); }} className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save</button>
                    </div>
                </form>
            )}

            <div className="space-y-4">
                {documents.length === 0 ? (
                    <p className="text-slate-500 text-sm italic">No document records found.</p>
                ) : (
                    documents.map(item => (
                        <div key={item.id} className="p-4 border border-slate-200 rounded-xl hover:shadow-sm transition flex justify-between items-start">
                            <div>
                                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                    {item.document_name} 
                                    <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{item.document_type}</span>
                                </h4>
                                <p className="text-sm text-slate-600 mt-1">Status: {item.status}</p>
                                {item.expiry_date && <p className="text-xs text-slate-500 mt-1">Expires: {new Date(item.expiry_date).toLocaleDateString()}</p>}
                                <a href={item.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline mt-2 flex items-center gap-1">
                                    <ExternalLink className="w-3 h-3" /> View Document
                                </a>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => { setEditingId(item.id); setFormData(item); setIsAdding(false); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
