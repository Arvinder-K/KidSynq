import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { employeeService, type EmployeeQualification } from '../../../api/employeeService';

export const EmployeeQualifications: React.FC<{ employeeId: string }> = ({ employeeId }) => {
    const [qualifications, setQualifications] = useState<EmployeeQualification[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState<Partial<EmployeeQualification>>({});

    useEffect(() => {
        fetchData();
    }, [employeeId]);

    const fetchData = async () => {
        try {
            const data = await employeeService.getQualifications(employeeId);
            setQualifications(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await employeeService.updateQualification(formData.id, formData);
            } else {
                await employeeService.createQualification(employeeId, formData as EmployeeQualification);
            }
            setShowModal(false);
            setFormData({});
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this qualification?')) return;
        try {
            await employeeService.deleteQualification(id);
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8 mt-8">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">Qualifications</h2>
                <button type="button" onClick={() => { setFormData({}); setShowModal(true); }} className="flex items-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
                    <Plus className="w-4 h-4" /> Add Qualification
                </button>
            </div>

            {loading ? (
                <div className="text-center py-4 text-slate-500">Loading...</div>
            ) : qualifications.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No qualifications added yet.
                </div>
            ) : (
                <div className="space-y-4">
                    {qualifications.map(q => (
                        <div key={q.id} className="flex justify-between items-center p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                            <div>
                                <h3 className="font-semibold text-slate-800">{q.qualification_name}</h3>
                                <p className="text-sm text-slate-500">{q.institution} • {q.qualification_type}</p>
                                {q.expiry_date && <p className="text-xs text-slate-400 mt-1">Expires: {new Date(q.expiry_date).toLocaleDateString()}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded-md ${q.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                                    {q.status}
                                </span>
                                <button type="button" onClick={() => { setFormData(q); setShowModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={() => handleDelete(q.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                        <h3 className="text-xl font-bold text-slate-900 mb-6">{formData.id ? 'Edit' : 'Add'} Qualification</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Qualification Name</label>
                                <input required type="text" value={formData.qualification_name || ''} onChange={e => setFormData({...formData, qualification_name: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Institution</label>
                                <input required type="text" value={formData.institution || ''} onChange={e => setFormData({...formData, institution: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Type (e.g. Degree, Diploma)</label>
                                <input required type="text" value={formData.qualification_type || ''} onChange={e => setFormData({...formData, qualification_type: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Issue Date</label>
                                    <input type="date" value={formData.issue_date || ''} onChange={e => setFormData({...formData, issue_date: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                                    <input type="date" value={formData.expiry_date || ''} onChange={e => setFormData({...formData, expiry_date: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
