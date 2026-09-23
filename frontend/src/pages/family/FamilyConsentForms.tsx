import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../api';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, CheckCircle2, Clock, X, PenLine, AlertTriangle } from 'lucide-react';

interface Signature {
    id: string; signed_by_name: string; signature_name: string;
    signed_at: string; agreement_text: string;
}
interface ConsentForm {
    id: string; consent_form: string; form_title: string; form_type: string;
    form_description: string | null; form_content: string; requires_signature: boolean;
    student: string; student_name: string; status: string;
    due_date: string | null; signature: Signature | null;
    created_at: string;
}

const formTypeColors: Record<string, string> = {
    'General': 'bg-blue-100 text-blue-700',
    'Medical': 'bg-rose-100 text-rose-700',
    'Trip': 'bg-violet-100 text-violet-700',
    'Photo': 'bg-emerald-100 text-emerald-700',
    'Emergency': 'bg-red-100 text-red-700',
    'Other': 'bg-slate-100 text-slate-600',
};

const FamilyConsentForms: React.FC = () => {
    const [forms, setForms] = useState<ConsentForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'' | 'Pending' | 'Signed' | 'Declined'>('');
    const [selectedForm, setSelectedForm] = useState<ConsentForm | null>(null);
    const [signatureName, setSignatureName] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchForms = () => {
        setLoading(true);
        const params = activeTab ? `?status=${activeTab}` : '';
        api.get(`/family/consent-forms/${params}`).then(res => setForms(res.data)).finally(() => setLoading(false));
    };

    useEffect(() => { fetchForms(); }, [activeTab]);

    const pendingCount = forms.filter(f => f.status === 'Pending').length;

    const openForm = (form: ConsentForm) => {
        setSelectedForm(form);
        setSignatureName('');
        setAgreed(false);
        setError('');
        setSuccess('');
    };

    const signForm = async (action: 'sign' | 'decline') => {
        if (!selectedForm) return;
        if (action === 'sign' && (!signatureName.trim() || !agreed)) {
            setError('Please type your name and check the agreement box.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            await api.post(`/family/consent-forms/${selectedForm.id}/sign/`, {
                action, signature_name: signatureName, agreed
            });
            setSuccess(action === 'sign' ? 'Form signed successfully!' : 'Form declined.');
            fetchForms();
            setTimeout(() => setSelectedForm(null), 1500);
        } catch (e: any) {
            setError(e?.response?.data?.detail || 'Failed to submit.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Layout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        Consent Forms {pendingCount > 0 && <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount} pending</span>}
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">Review and sign consent forms from your daycare</p>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1 w-fit">
                    {([['', 'All'], ['Pending', 'Pending'], ['Signed', 'Signed'], ['Declined', 'Declined']] as const).map(([val, label]) => (
                        <button key={val || 'all'} onClick={() => setActiveTab(val as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === val ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : forms.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center">
                        <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">No consent forms found.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {forms.map((form, i) => (
                            <motion.div key={form.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${form.status === 'Pending' ? 'border-amber-200' : 'border-slate-100'}`}
                                onClick={() => openForm(form)}>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${form.status === 'Signed' ? 'bg-emerald-50' : form.status === 'Pending' ? 'bg-amber-50' : 'bg-slate-50'}`}>
                                            {form.status === 'Signed' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <FileText className={`w-5 h-5 ${form.status === 'Pending' ? 'text-amber-600' : 'text-slate-400'}`} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm truncate">{form.form_title}</p>
                                            <p className="text-xs text-slate-500">For {form.student_name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${formTypeColors[form.form_type] || formTypeColors['Other']}`}>
                                            {form.form_type}
                                        </span>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${form.status === 'Signed' ? 'bg-emerald-100 text-emerald-700' : form.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {form.status}
                                        </span>
                                    </div>
                                </div>
                                {form.due_date && form.status === 'Pending' && (
                                    <p className="text-xs text-amber-600 mt-2 ml-13 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Due: {form.due_date}
                                    </p>
                                )}
                                {form.signature && (
                                    <p className="text-xs text-emerald-600 mt-2 ml-1 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Signed by {form.signature.signature_name} on {new Date(form.signature.signed_at).toLocaleDateString('en-CA')}
                                    </p>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Sign Modal */}
                <AnimatePresence>
                    {selectedForm && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
                                className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="font-semibold text-slate-800">{selectedForm.form_title}</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">For {selectedForm.student_name} · {selectedForm.form_type}</p>
                                    </div>
                                    <button onClick={() => setSelectedForm(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto px-6 py-5">
                                    {selectedForm.form_description && (
                                        <p className="text-sm text-slate-600 mb-4 italic">{selectedForm.form_description}</p>
                                    )}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                        {selectedForm.form_content}
                                    </div>

                                    {/* Already signed */}
                                    {selectedForm.status === 'Signed' && selectedForm.signature && (
                                        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                            <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Signed</p>
                                            <p className="text-xs text-emerald-700 mt-1">By {selectedForm.signature.signature_name}</p>
                                            <p className="text-xs text-emerald-600 mt-0.5">{new Date(selectedForm.signature.signed_at).toLocaleString('en-CA')}</p>
                                        </div>
                                    )}

                                    {/* Pending — signature area */}
                                    {selectedForm.status === 'Pending' && selectedForm.requires_signature && (
                                        <div className="mt-5 space-y-4">
                                            {error && <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">{error}</p>}
                                            {success && <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl">{success}</p>}

                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                                    <PenLine className="w-3.5 h-3.5 inline mr-1" /> Type your full name as your digital signature
                                                </label>
                                                <input value={signatureName} onChange={e => setSignatureName(e.target.value)}
                                                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium italic text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                    placeholder="Your Full Name" />
                                            </div>

                                            <label className="flex items-start gap-2 cursor-pointer">
                                                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 accent-indigo-600" />
                                                <span className="text-sm text-slate-700">
                                                    I have read and understand the above form, and I agree to its terms on behalf of {selectedForm.student_name}.
                                                </span>
                                            </label>

                                            <div className="flex gap-3 pt-1">
                                                <button onClick={() => signForm('decline')} disabled={submitting}
                                                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50">
                                                    <AlertTriangle className="w-3.5 h-3.5" /> Decline
                                                </button>
                                                <button onClick={() => signForm('sign')} disabled={submitting || !agreed || !signatureName.trim()}
                                                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                                    <PenLine className="w-4 h-4" /> {submitting ? 'Signing...' : 'Sign Form'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Layout>
    );
};

export default FamilyConsentForms;
