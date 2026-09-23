import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { employeeService, type EmploymentHistory } from '../../../api/employeeService';

interface Props {
    employeeId: string;
}

export const EmploymentHistoryTab: React.FC<Props> = ({ employeeId }) => {
    const [history, setHistory] = useState<EmploymentHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<EmploymentHistory>>({});
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const data = await employeeService.getEmploymentHistory();
            // Filter by employee ID
            setHistory(data.filter((h: EmploymentHistory) => h.employee === employeeId));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [employeeId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setError(null);
            if (editingId) {
                await employeeService.updateEmploymentHistory(editingId, formData);
            } else {
                await employeeService.createEmploymentHistory({ ...formData, employee: employeeId });
            }
            setIsAdding(false);
            setEditingId(null);
            setFormData({});
            fetchHistory();
        } catch (err: any) {
            setError(err.response?.data?.status || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this record?")) return;
        try {
            await employeeService.deleteEmploymentHistory(id);
            fetchHistory();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8 mt-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900">Employment History</h2>
                {!isAdding && !editingId && (
                    <button
                        onClick={() => { setIsAdding(true); setFormData({}); }}
                        className="text-sm px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-medium flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Add Record
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
                    <h3 className="font-semibold text-slate-800 mb-4">{editingId ? 'Edit Record' : 'Add Record'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Employment Type *</label>
                            <select required name="employment_type" value={formData.employment_type || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
                                <option value="">Select Type</option>
                                <option value="Full-time">Full-time</option>
                                <option value="Part-time">Part-time</option>
                                <option value="Contract">Contract</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Job Title *</label>
                            <input required type="text" name="job_title" value={formData.job_title || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                            <input type="text" name="department" value={formData.department || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                            <input type="text" name="status" value={formData.status || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                            <input required type="date" name="start_date" value={formData.start_date || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                            <input type="date" name="end_date" value={formData.end_date || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Change</label>
                            <input type="text" name="reason_for_change" value={formData.reason_for_change || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => { setIsAdding(false); setEditingId(null); }} className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save</button>
                    </div>
                </form>
            )}

            <div className="space-y-4">
                {history.length === 0 ? (
                    <p className="text-slate-500 text-sm italic">No employment history records found.</p>
                ) : (
                    history.map(item => (
                        <div key={item.id} className="p-4 border border-slate-200 rounded-xl hover:shadow-sm transition flex justify-between items-start">
                            <div>
                                <h4 className="font-semibold text-slate-900">{item.job_title} <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full ml-2">{item.employment_type}</span></h4>
                                <p className="text-sm text-slate-600 mt-1">{item.department && `Dept: ${item.department} | `}Status: {item.status}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {new Date(item.start_date).toLocaleDateString()} - {item.end_date ? new Date(item.end_date).toLocaleDateString() : 'Present'}
                                </p>
                                {item.reason_for_change && <p className="text-xs text-slate-500 mt-1">Reason: {item.reason_for_change}</p>}
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
