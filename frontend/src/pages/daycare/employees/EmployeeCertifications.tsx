import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { employeeService, type EmployeeCertification } from '../../../api/employeeService';

export const EmployeeCertifications: React.FC<{ employeeId: string }> = ({ employeeId }) => {
    const [certifications, setCertifications] = useState<EmployeeCertification[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState<Partial<EmployeeCertification>>({});

    useEffect(() => {
        fetchData();
    }, [employeeId]);

    const fetchData = async () => {
        try {
            const data = await employeeService.getCertifications(employeeId);
            setCertifications(data);
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
                await employeeService.updateCertification(formData.id, formData);
            } else {
                await employeeService.createCertification(employeeId, formData as EmployeeCertification);
            }
            setShowModal(false);
            setFormData({});
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this certification?')) return;
        try {
            await employeeService.deleteCertification(id);
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8 mt-8">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">Certifications</h2>
                <button type="button" onClick={() => { setFormData({}); setShowModal(true); }} className="flex items-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
                    <Plus className="w-4 h-4" /> Add Certification
                </button>
            </div>

            {loading ? (
                <div className="text-center py-4 text-slate-500">Loading...</div>
            ) : certifications.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No certifications added yet.
                </div>
            ) : (
                <div className="space-y-4">
                    {certifications.map(c => (
                        <div key={c.id} className="flex justify-between items-center p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                            <div>
                                <h3 className="font-semibold text-slate-800">{c.certification_name} {c.certification_number ? `(#${c.certification_number})` : ''}</h3>
                                <p className="text-sm text-slate-500">{c.issuing_organization}</p>
                                {c.expiry_date && (
                                    <p className={`text-xs mt-1 ${c.status === 'Expired' ? 'text-red-500 font-semibold' : c.status === 'Expiring Soon' ? 'text-orange-500 font-semibold' : 'text-slate-400'}`}>
                                        Expires: {new Date(c.expiry_date).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded-md ${
                                    c.status === 'Active' ? 'bg-green-100 text-green-700' : 
                                    c.status === 'Expired' ? 'bg-red-100 text-red-700' :
                                    c.status === 'Expiring Soon' ? 'bg-orange-100 text-orange-700' :
                                    'bg-slate-100 text-slate-700'
                                }`}>
                                    {c.status}
                                </span>
                                <button type="button" onClick={() => { setFormData(c); setShowModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={() => handleDelete(c.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
                        <h3 className="text-xl font-bold text-slate-900 mb-6">{formData.id ? 'Edit' : 'Add'} Certification</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Certification Name</label>
                                <input required type="text" value={formData.certification_name || ''} onChange={e => setFormData({...formData, certification_name: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Certification Number (Optional)</label>
                                <input type="text" value={formData.certification_number || ''} onChange={e => setFormData({...formData, certification_number: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Issuing Organization</label>
                                <input required type="text" value={formData.issuing_organization || ''} onChange={e => setFormData({...formData, issuing_organization: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
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
