import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, X, Check, UserPlus, AlertCircle, FileText } from 'lucide-react';

interface ConsentForm {
    id: string;
    title: string;
    description: string;
    form_type: string;
    content: string;
    requires_signature: boolean;
    status: string;
    created_at: string;
}

interface Signature {
    id: string;
    student_name: string;
    status: string;
    signed_by_name: string | null;
    signature_name: string | null;
    signed_at: string | null;
}

interface Student {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
}

const ConsentForms: React.FC = () => {
    const [forms, setForms] = useState<ConsentForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedForm, setSelectedForm] = useState<ConsentForm | null>(null);
    const [signatures, setSignatures] = useState<Signature[]>([]);
    const [loadingSignatures, setLoadingSignatures] = useState(false);

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newType, setNewType] = useState('General');
    const [submitting, setSubmitting] = useState(false);
    
    // Assign Modal State
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [assigning, setAssigning] = useState(false);
    const [assignSearch, setAssignSearch] = useState('');

    const fetchForms = () => {
        setLoading(true);
        api.get('/daycare/consent-forms/').then(res => setForms(res.data)).finally(() => setLoading(false));
    };

    const fetchStudents = () => {
        api.get('/students/').then(res => setStudents(res.data));
    };

    useEffect(() => {
        fetchForms();
        fetchStudents();
    }, []);

    const handleSelectForm = (form: ConsentForm) => {
        setSelectedForm(form);
        setLoadingSignatures(true);
        api.get(`/daycare/consent-forms/${form.id}/signatures/`)
            .then(res => setSignatures(res.data.assignments || []))
            .finally(() => setLoadingSignatures(false));
    };

    const handleCreateForm = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await api.post('/daycare/consent-forms/', {
                title: newTitle,
                description: newDescription,
                content: newContent,
                form_type: newType,
                requires_signature: true
            });
            setForms([res.data, ...forms]);
            setIsCreateModalOpen(false);
            setNewTitle('');
            setNewDescription('');
            setNewContent('');
            setNewType('General');
        } catch (error) {
            console.error(error);
            alert("Failed to create form");
        } finally {
            setSubmitting(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedForm || selectedStudentIds.length === 0) return;
        setAssigning(true);
        try {
            await api.post(`/daycare/consent-forms/${selectedForm.id}/assign/`, {
                student_ids: selectedStudentIds
            });
            setIsAssignModalOpen(false);
            setSelectedStudentIds([]);
            handleSelectForm(selectedForm); // Refresh signatures
        } catch (error) {
            console.error(error);
            alert("Failed to assign form");
        } finally {
            setAssigning(false);
        }
    };

    const filteredStudents = students.filter(s => 
        (s.first_name + ' ' + s.last_name).toLowerCase().includes(assignSearch.toLowerCase())
    );

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Consent Forms</h1>
                        <p className="text-gray-500 text-sm mt-1">Manage and assign parent consent forms</p>
                    </div>
                    <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs shadow-xs transition-colors">
                        <Plus className="w-4 h-4" />
                        Create Form
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Form List */}
                    <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[calc(100vh-140px)]">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="font-bold text-slate-800">All Forms</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {loading ? (
                                <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
                            ) : forms.length === 0 ? (
                                <div className="text-center p-8 text-slate-400">
                                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                    <p>No forms created yet.</p>
                                </div>
                            ) : forms.map(form => (
                                <div key={form.id} onClick={() => handleSelectForm(form)}
                                    className={`p-4 rounded-2xl cursor-pointer border transition-all ${selectedForm?.id === form.id ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
                                    <h3 className="font-semibold text-slate-800 mb-1">{form.title}</h3>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{form.form_type}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md">{form.status}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-2">{form.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Form Details & Signatures */}
                    <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[calc(100vh-140px)]">
                        {!selectedForm ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                                <FileText className="w-16 h-16 mb-4 opacity-50 text-slate-300" />
                                <h3 className="text-lg font-bold text-slate-600 mb-2">Select a Form</h3>
                                <p>Select a consent form from the list to view details, assign it to students, or track signatures.</p>
                            </div>
                        ) : (
                            <>
                                <div className="p-6 border-b border-slate-100">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-800 mb-1">{selectedForm.title}</h2>
                                            <p className="text-sm text-slate-500">{selectedForm.description}</p>
                                        </div>
                                        <button onClick={() => setIsAssignModalOpen(true)} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-xl font-semibold text-sm transition-colors">
                                            <UserPlus className="w-4 h-4" /> Assign to Students
                                        </button>
                                    </div>
                                    
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Agreement Content</h4>
                                        <p className="text-sm text-slate-700 font-serif whitespace-pre-wrap">{selectedForm.content}</p>
                                    </div>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <Check className="w-5 h-5 text-emerald-500" /> Signatures Tracker
                                    </h3>
                                    
                                    {loadingSignatures ? (
                                        <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
                                    ) : signatures.length === 0 ? (
                                        <div className="text-center p-8 text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                            <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-50 text-amber-500" />
                                            <p>This form hasn't been assigned to anyone yet.</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                        <th className="px-6 py-4">Student</th>
                                                        <th className="px-6 py-4">Status</th>
                                                        <th className="px-6 py-4">Signed By</th>
                                                        <th className="px-6 py-4">Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {signatures.map(sig => (
                                                        <tr key={sig.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-6 py-4 font-medium text-slate-800 text-sm">{sig.student_name}</td>
                                                            <td className="px-6 py-4">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                                    sig.status === 'Signed' ? 'bg-emerald-100 text-emerald-800' : 
                                                                    sig.status === 'Declined' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                                                }`}>
                                                                    {sig.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-slate-600">{sig.signature_name || '-'}</td>
                                                            <td className="px-6 py-4 text-sm text-slate-500">{sig.signed_at ? new Date(sig.signed_at).toLocaleString() : '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Create Form Modal */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCreateModalOpen(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <FileText className="w-6 h-6 text-indigo-500" />
                                    Create Consent Form
                                </h2>
                                <button onClick={() => setIsCreateModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <form onSubmit={handleCreateForm} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Form Title</label>
                                        <input type="text" required value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Field Trip Consent" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Form Type</label>
                                        <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm appearance-none">
                                            <option value="General">General</option>
                                            <option value="Medical">Medical</option>
                                            <option value="Trip">Trip/Activity</option>
                                            <option value="Photo">Photo/Media</option>
                                            <option value="Emergency">Emergency</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Short Description</label>
                                    <input type="text" required value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Brief summary for parents..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Agreement Content</label>
                                    <textarea required value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="The full text parents are agreeing to..." rows={6} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm resize-none font-serif"></textarea>
                                </div>
                                
                                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                                    <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-6 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                                    <button type="submit" disabled={submitting} className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
                                        {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Check className="w-4 h-4" />}
                                        Create Form
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Assign Form Modal */}
            <AnimatePresence>
                {isAssignModalOpen && selectedForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAssignModalOpen(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Assign Form</h2>
                                    <p className="text-sm text-slate-500 mt-1">{selectedForm.title}</p>
                                </div>
                                <button onClick={() => setIsAssignModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <div className="mb-4 shrink-0 relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" value={assignSearch} onChange={e => setAssignSearch(e.target.value)} placeholder="Search students..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                            </div>

                            <div className="flex-1 overflow-y-auto mb-6 border border-slate-200 rounded-xl p-2 space-y-1">
                                {filteredStudents.map(student => {
                                    const isSelected = selectedStudentIds.includes(student.id);
                                    return (
                                        <div key={student.id} onClick={() => setSelectedStudentIds(prev => isSelected ? prev.filter(id => id !== student.id) : [...prev, student.id])}
                                            className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                                                {isSelected && <Check className="w-3.5 h-3.5" />}
                                            </div>
                                            <span className="text-sm font-medium">{student.preferred_name || student.first_name} {student.last_name}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-4 flex justify-between items-center shrink-0 border-t border-slate-100">
                                <span className="text-sm font-medium text-slate-500">{selectedStudentIds.length} selected</span>
                                <div className="flex gap-3">
                                    <button onClick={() => setIsAssignModalOpen(false)} className="px-5 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                                    <button onClick={handleAssign} disabled={assigning || selectedStudentIds.length === 0} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50">
                                        {assigning ? 'Assigning...' : 'Assign Form'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </Layout>
    );
};

export default ConsentForms;
