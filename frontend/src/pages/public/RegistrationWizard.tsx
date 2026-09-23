import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, CheckCircle, AlertCircle, Upload, FileText, CheckSquare } from 'lucide-react';
import { BACKEND_URL } from '../../api';

interface ApplicationData {
    applicant?: any;
    family?: any;
    child?: any;
    preferences?: any;
    dynamicForms?: any;
    documents?: any[];
    consents?: any[];
}

const RegistrationWizard: React.FC = () => {
    const { daycareIdentifier } = useParams<{ daycareIdentifier: string }>();
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [appNumber, setAppNumber] = useState<string | null>(localStorage.getItem(`app_${daycareIdentifier}_number`));
    const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem(`app_${daycareIdentifier}_token`));
    const [daycareId, setDaycareId] = useState<string | null>(null);
    
    const [dynamicFormsSchema, setDynamicFormsSchema] = useState<any[]>([]);
    const [activeConsents, setActiveConsents] = useState<any[]>([]);
    const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
    const [signatureNames, setSignatureNames] = useState<{[key: string]: string}>({});

    const [appData, setAppData] = useState<ApplicationData>({
        applicant: { name: '', email: '', phone: '' },
        family: { familyName: '', address: '', contactPreferences: 'email' },
        child: { firstName: '', lastName: '', dob: '', gender: '', language: 'English' },
        preferences: { startDate: '', program: '', location: '', schedule: 'Full-time' },
        dynamicForms: {},
        documents: [],
        consents: []
    });

    useEffect(() => {
        const init = async () => {
            try {
                setLoading(true);
                // 1. Fetch Daycare
                const dcRes = await fetch(`${BACKEND_URL}/api/public/daycares/${daycareIdentifier}/registration/`);
                if (!dcRes.ok) throw new Error("Could not fetch daycare.");
                const dcData = await dcRes.json();
                setDaycareId(dcData.id);

                // 2. Fetch Dynamic Forms Schema
                const formsRes = await fetch(`${BACKEND_URL}/api/public/daycares/${daycareIdentifier}/enrollment-forms/`);
                if (formsRes.ok) {
                    setDynamicFormsSchema(await formsRes.json());
                }

                // 3. Load draft if exists
                if (appNumber && accessToken) {
                    const draftRes = await fetch(`${BACKEND_URL}/api/public/registrations/${appNumber}/?token=${accessToken}`, {
                        headers: { 'Accept': 'application/json' }
                    });
                    if (draftRes.ok) {
                        const draftData = await draftRes.json();
                        if (draftData.status === 'submitted') {
                            setStep(9); // Success
                        } else {
                            if (draftData.application_data) {
                                setAppData(prev => ({ ...prev, ...draftData.application_data }));
                            }
                            if (draftData.applicant_name) {
                                setAppData(prev => ({
                                    ...prev,
                                    applicant: {
                                        ...prev.applicant,
                                        name: draftData.applicant_name,
                                        email: draftData.applicant_email,
                                        phone: draftData.applicant_phone
                                    }
                                }));
                            }
                        }
                    } else {
                        setAppNumber(null);
                        setAccessToken(null);
                        localStorage.removeItem(`app_${daycareIdentifier}_number`);
                        localStorage.removeItem(`app_${daycareIdentifier}_token`);
                    }
                    
                    // Fetch docs and consents for draft
                    if (appNumber && accessToken) {
                        fetchDocs();
                        fetchConsents();
                    }
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [daycareIdentifier, appNumber, accessToken]);

    const fetchDocs = async (appNum?: string | null, token?: string | null) => {
        const targetAppNum = appNum || appNumber;
        const targetToken = token || accessToken;
        if (!targetAppNum || !targetToken) return;
        try {
            const res = await fetch(`${BACKEND_URL}/api/daycare/applications/${targetAppNum}/documents/?token=${targetToken}`);
            if (res.ok) setUploadedDocs(await res.json());
        } catch (e) {}
    };

    const fetchConsents = async (appNum?: string | null) => {
        const targetAppNum = appNum || appNumber;
        if (!targetAppNum) return;
        try {
            const res = await fetch(`${BACKEND_URL}/api/daycare/applications/${targetAppNum}/consent/`);
            if (res.ok) setActiveConsents(await res.json());
        } catch (e) {}
    };

    const handleSaveDraft = async (): Promise<{ appNumber: string; token: string } | null> => {
        try {
            const currentDaycareId = daycareId || daycareIdentifier;
            let currentAppNumber = appNumber;
            let currentToken = accessToken;

            if (!currentAppNumber || !currentToken) {
                if (!currentDaycareId) {
                    throw new Error("Daycare information is missing.");
                }

                const res = await fetch(`${BACKEND_URL}/api/public/registrations/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        daycare_id: currentDaycareId,
                        applicant_name: appData.applicant?.name || '',
                        applicant_email: appData.applicant?.email || '',
                        applicant_phone: appData.applicant?.phone || '',
                        application_data: appData
                    })
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.detail || "Failed to create draft application.");
                }

                const data = await res.json();
                const finalAppNumber: string = data.application_number;
                const finalToken: string = data.access_token;

                setAppNumber(finalAppNumber);
                setAccessToken(finalToken);
                if (daycareIdentifier) {
                    localStorage.setItem(`app_${daycareIdentifier}_number`, finalAppNumber);
                    localStorage.setItem(`app_${daycareIdentifier}_token`, finalToken);
                }

                // Now that we have appNumber, fetch consents
                const cRes = await fetch(`${BACKEND_URL}/api/daycare/applications/${finalAppNumber}/consent/`);
                if (cRes.ok) setActiveConsents(await cRes.json());

                return { appNumber: finalAppNumber, token: finalToken };
            } else {
                const res = await fetch(`${BACKEND_URL}/api/public/registrations/${currentAppNumber}/update/`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        applicant_name: appData.applicant?.name || '',
                        applicant_email: appData.applicant?.email || '',
                        applicant_phone: appData.applicant?.phone || '',
                        application_data: appData,
                        token: currentToken || ''
                    })
                });

                if (res.status === 404 || res.status === 403) {
                    if (daycareIdentifier) {
                        localStorage.removeItem(`app_${daycareIdentifier}_number`);
                        localStorage.removeItem(`app_${daycareIdentifier}_token`);
                    }
                    setAppNumber(null);
                    setAccessToken(null);

                    const retryRes = await fetch(`${BACKEND_URL}/api/public/registrations/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify({
                            daycare_id: currentDaycareId,
                            applicant_name: appData.applicant?.name || '',
                            applicant_email: appData.applicant?.email || '',
                            applicant_phone: appData.applicant?.phone || '',
                            application_data: appData
                        })
                    });

                    if (!retryRes.ok) {
                        const errData = await retryRes.json().catch(() => ({}));
                        throw new Error(errData.detail || "Failed to create draft.");
                    }

                    const retryData = await retryRes.json();
                    const retApp: string = retryData.application_number;
                    const retTok: string = retryData.access_token;
                    setAppNumber(retApp);
                    setAccessToken(retTok);
                    if (daycareIdentifier) {
                        localStorage.setItem(`app_${daycareIdentifier}_number`, retApp);
                        localStorage.setItem(`app_${daycareIdentifier}_token`, retTok);
                    }
                    return { appNumber: retApp, token: retTok };
                }

                return { appNumber: currentAppNumber, token: currentToken };
            }
        } catch (err: any) {
            console.error("Draft save error:", err);
            setError(err.message || "Failed to save application.");
            return null;
        }
    };

    const handleNext = async () => {
        setError(null);
        const saved = await handleSaveDraft();
        if (saved) {
            setStep(s => Math.min(s + 1, 9));
        }
    };

    const handleBack = () => {
        setError(null);
        setStep(s => Math.max(s - 1, 1));
    };

    const handleSubmit = async () => {
        try {
            setSubmitting(true);
            setError(null);
            
            const saved = await handleSaveDraft();
            if (!saved || !saved.appNumber) {
                throw new Error("Unable to save application draft before submission. Please try again.");
            }

            const res = await fetch(`${BACKEND_URL}/api/public/registrations/${saved.appNumber}/submit/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ token: saved.token || '' })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || "Submission failed.");
            }

            if (daycareIdentifier) {
                localStorage.removeItem(`app_${daycareIdentifier}_number`);
                localStorage.removeItem(`app_${daycareIdentifier}_token`);
            }
            setAppNumber(null);
            setAccessToken(null);
            setStep(9);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleChange = (section: keyof ApplicationData, field: string, value: any) => {
        setAppData(prev => ({
            ...prev,
            [section]: { ...prev[section], [field]: value }
        }));
    };
    
    const handleDynamicFieldChange = (formId: string, fieldName: string, value: any) => {
        setAppData(prev => ({
            ...prev,
            dynamicForms: {
                ...prev.dynamicForms,
                [formId]: {
                    ...((prev.dynamicForms as any)[formId] || {}),
                    [fieldName]: value
                }
            }
        }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        let currentAppNum = appNumber;
        let currentToken = accessToken;
        if (!currentAppNum || !currentToken) {
            const saved = await handleSaveDraft();
            if (saved) {
                currentAppNum = saved.appNumber;
                currentToken = saved.token;
            }
        }
        if (!currentAppNum || !currentToken) {
            setError("Please fill in applicant information before uploading documents.");
            return;
        }
        
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', docType);
        formData.append('token', currentToken);
        
        try {
            const res = await fetch(`${BACKEND_URL}/api/daycare/applications/${currentAppNum}/documents/`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                fetchDocs(currentAppNum, currentToken);
            } else {
                setError("Document upload failed.");
            }
        } catch (err) {
            setError("Document upload error.");
        }
    };

    const handleSignConsent = async (formId: string) => {
        let currentAppNum = appNumber;
        let currentToken = accessToken;
        if (!currentAppNum || !currentToken) {
            const saved = await handleSaveDraft();
            if (saved) {
                currentAppNum = saved.appNumber;
                currentToken = saved.token;
            }
        }
        if (!currentAppNum || !currentToken) {
            alert("Please complete applicant info before signing.");
            return;
        }

        const name = signatureNames[formId];
        if (!name) return alert("Please type your name to sign.");
        
        try {
            const res = await fetch(`${BACKEND_URL}/api/daycare/applications/${currentAppNum}/consent/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    token: currentToken,
                    form_id: formId,
                    signature_name: name
                })
            });
            if (res.ok) {
                // Refresh draft data to get updated consents
                const draftRes = await fetch(`${BACKEND_URL}/api/public/registrations/${currentAppNum}/?token=${currentToken}`, {
                    headers: { 'Accept': 'application/json' }
                });
                if (draftRes.ok) {
                    const draftData = await draftRes.json();
                    if (draftData.application_data) {
                        setAppData(prev => ({ ...prev, ...draftData.application_data }));
                    }
                }
                alert("Consent signed successfully!");
            }
        } catch (e) {
            setError("Failed to sign consent.");
        }
    };

    const getConsentSignature = (formId: string) => {
        return (appData.consents || []).find((c: any) => c.form_id === formId);
    };

    if (loading) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;
    }

    const steps = ["Applicant", "Family", "Child", "Preferences", "Forms", "Documents", "Consent", "Review"];

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {step < 9 && (
                    <div className="mb-8 overflow-x-auto pb-4">
                        <div className="flex justify-between items-center mb-6">
                            <h1 className="text-2xl font-bold text-slate-800">Registration Application</h1>
                            {appNumber && <span className="text-sm font-medium text-slate-500">Draft: {appNumber}</span>}
                        </div>
                        <div className="flex items-center gap-2 min-w-max">
                            {steps.map((s, i) => (
                                <React.Fragment key={s}>
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shrink-0 ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                        {step > i + 1 ? <CheckCircle className="w-5 h-5" /> : i + 1}
                                    </div>
                                    <span className={`text-sm font-medium whitespace-nowrap ${step >= i + 1 ? 'text-slate-800' : 'text-slate-400'}`}>{s}</span>
                                    {i < steps.length - 1 && <div className={`h-1 w-6 sm:w-10 rounded shrink-0 ${step > i + 1 ? 'bg-green-500' : 'bg-slate-200'}`} />}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                )}

                {error && step < 9 && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    {/* Step 1: Applicant */}
                    {step === 1 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <h2 className="text-xl font-bold text-slate-800 mb-6">Applicant Information</h2>
                            <div className="grid gap-4">
                                <div><label className="block text-sm font-medium mb-1">Full Name</label><input type="text" className="w-full border-slate-300 rounded-lg" value={appData.applicant.name} onChange={e => handleChange('applicant', 'name', e.target.value)} /></div>
                                <div><label className="block text-sm font-medium mb-1">Email Address</label><input type="email" className="w-full border-slate-300 rounded-lg" value={appData.applicant.email} onChange={e => handleChange('applicant', 'email', e.target.value)} /></div>
                                <div><label className="block text-sm font-medium mb-1">Phone Number</label><input type="tel" className="w-full border-slate-300 rounded-lg" value={appData.applicant.phone} onChange={e => handleChange('applicant', 'phone', e.target.value)} /></div>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2: Family */}
                    {step === 2 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <h2 className="text-xl font-bold text-slate-800 mb-6">Family Information</h2>
                            <div className="grid gap-4">
                                <div><label className="block text-sm font-medium mb-1">Family Last Name</label><input type="text" className="w-full border-slate-300 rounded-lg" value={appData.family.familyName} onChange={e => handleChange('family', 'familyName', e.target.value)} /></div>
                                <div><label className="block text-sm font-medium mb-1">Home Address</label><textarea className="w-full border-slate-300 rounded-lg" rows={3} value={appData.family.address} onChange={e => handleChange('family', 'address', e.target.value)} /></div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Communication Preference</label>
                                    <select className="w-full border-slate-300 rounded-lg" value={appData.family.contactPreferences} onChange={e => handleChange('family', 'contactPreferences', e.target.value)}>
                                        <option value="email">Email</option><option value="phone">Phone</option><option value="sms">SMS Text</option>
                                    </select>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 3: Child */}
                    {step === 3 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <h2 className="text-xl font-bold text-slate-800 mb-6">Child Information</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div><label className="block text-sm font-medium mb-1">First Name</label><input type="text" className="w-full border-slate-300 rounded-lg" value={appData.child.firstName} onChange={e => handleChange('child', 'firstName', e.target.value)} /></div>
                                <div><label className="block text-sm font-medium mb-1">Last Name</label><input type="text" className="w-full border-slate-300 rounded-lg" value={appData.child.lastName} onChange={e => handleChange('child', 'lastName', e.target.value)} /></div>
                                <div><label className="block text-sm font-medium mb-1">Date of Birth</label><input type="date" className="w-full border-slate-300 rounded-lg" value={appData.child.dob} onChange={e => handleChange('child', 'dob', e.target.value)} /></div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Gender</label>
                                    <select className="w-full border-slate-300 rounded-lg" value={appData.child.gender} onChange={e => handleChange('child', 'gender', e.target.value)}>
                                        <option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                                    </select>
                                </div>
                                <div><label className="block text-sm font-medium mb-1">Primary Language</label><input type="text" className="w-full border-slate-300 rounded-lg" value={appData.child.language} onChange={e => handleChange('child', 'language', e.target.value)} /></div>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 4: Preferences */}
                    {step === 4 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <h2 className="text-xl font-bold text-slate-800 mb-6">Enrollment Preferences</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div><label className="block text-sm font-medium mb-1">Preferred Start Date</label><input type="date" className="w-full border-slate-300 rounded-lg" value={appData.preferences.startDate} onChange={e => handleChange('preferences', 'startDate', e.target.value)} /></div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Schedule</label>
                                    <select className="w-full border-slate-300 rounded-lg" value={appData.preferences.schedule} onChange={e => handleChange('preferences', 'schedule', e.target.value)}>
                                        <option value="Full-time">Full-time (5 days)</option><option value="Part-time">Part-time</option><option value="Drop-in">Drop-in</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">Requested Program / Location Notes</label>
                                    <textarea className="w-full border-slate-300 rounded-lg" rows={3} value={appData.preferences.location} onChange={e => handleChange('preferences', 'location', e.target.value)} />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 5: Forms (Dynamic) */}
                    {step === 5 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <h2 className="text-xl font-bold text-slate-800 mb-6">Additional Information</h2>
                            {dynamicFormsSchema.length === 0 ? (
                                <p className="text-slate-500">No additional forms required.</p>
                            ) : (
                                <div className="space-y-8">
                                    {dynamicFormsSchema.map((form) => (
                                        <div key={form.id} className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                            <h3 className="font-bold text-lg text-slate-800 mb-1">{form.title}</h3>
                                            <p className="text-slate-600 mb-4">{form.description}</p>
                                            <div className="grid gap-4 md:grid-cols-2">
                                                {(form.fields_schema || []).map((field: any, idx: number) => (
                                                    <div key={idx} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                                            {field.label} {field.required && <span className="text-red-500">*</span>}
                                                        </label>
                                                        {field.type === 'textarea' ? (
                                                            <textarea 
                                                                className="w-full border-slate-300 rounded-lg" 
                                                                rows={3}
                                                                required={field.required}
                                                                value={(appData.dynamicForms?.[form.id]?.[field.name]) || ''}
                                                                onChange={(e) => handleDynamicFieldChange(form.id, field.name, e.target.value)}
                                                            />
                                                        ) : (
                                                            <input 
                                                                type={field.type || 'text'} 
                                                                className="w-full border-slate-300 rounded-lg"
                                                                required={field.required}
                                                                value={(appData.dynamicForms?.[form.id]?.[field.name]) || ''}
                                                                onChange={(e) => handleDynamicFieldChange(form.id, field.name, e.target.value)}
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Step 6: Documents */}
                    {step === 6 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <h2 className="text-xl font-bold text-slate-800 mb-6">Document Upload</h2>
                            <p className="text-slate-600 mb-6">Please upload the required documents for your application.</p>
                            
                            <div className="space-y-6">
                                {['Birth Certificate', 'Medical/Vaccination Record', 'Guardian ID'].map(docType => {
                                    const existing = uploadedDocs.find(d => d.document_type === docType);
                                    return (
                                        <div key={docType} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${existing ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-slate-800">{docType}</h3>
                                                    {existing && <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Uploaded on {new Date(existing.uploaded_date).toLocaleDateString()}</p>}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="cursor-pointer bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2">
                                                    <Upload className="w-4 h-4" /> {existing ? 'Update' : 'Upload'}
                                                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, docType)} />
                                                </label>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 7: Consent */}
                    {step === 7 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <h2 className="text-xl font-bold text-slate-800 mb-6">Consent & Agreements</h2>
                            {activeConsents.length === 0 ? (
                                <p className="text-slate-500">No consent forms require signature at this time.</p>
                            ) : (
                                <div className="space-y-6">
                                    {activeConsents.map(form => {
                                        const sig = getConsentSignature(form.id);
                                        return (
                                            <div key={form.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                                <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                                    <h3 className="font-bold text-slate-800">{form.title}</h3>
                                                    {sig && <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-medium flex items-center gap-1"><CheckSquare className="w-3 h-3"/> Signed</span>}
                                                </div>
                                                <div className="p-4 bg-white">
                                                    <div className="h-32 overflow-y-auto bg-slate-50 p-4 border border-slate-200 rounded-lg text-sm text-slate-600 mb-4">
                                                        {form.content || form.description || "I agree to the terms and conditions outlined by the daycare."}
                                                    </div>
                                                    
                                                    {sig ? (
                                                        <div className="text-sm text-slate-600">
                                                            Signed by <strong>{sig.signature_name}</strong> on {new Date(sig.signed_at).toLocaleString()}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                                                            <div className="flex-1">
                                                                <label className="block text-xs font-medium text-slate-500 mb-1">Type your full name to sign</label>
                                                                <input 
                                                                    type="text" 
                                                                    className="w-full border-slate-300 rounded-lg text-sm" 
                                                                    placeholder="Digital Signature"
                                                                    value={signatureNames[form.id] || ''}
                                                                    onChange={e => setSignatureNames(prev => ({...prev, [form.id]: e.target.value}))}
                                                                />
                                                            </div>
                                                            <button 
                                                                onClick={() => handleSignConsent(form.id)}
                                                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                                                            >
                                                                Sign Consent
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Step 8: Review */}
                    {step === 8 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <h2 className="text-xl font-bold text-slate-800 mb-6">Review Application</h2>
                            <div className="space-y-6 text-sm">
                                <div>
                                    <h3 className="font-bold text-slate-700 border-b pb-2 mb-2">Applicant</h3>
                                    <p><span className="text-slate-500">Name:</span> {appData.applicant.name}</p>
                                    <p><span className="text-slate-500">Email:</span> {appData.applicant.email}</p>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-700 border-b pb-2 mb-2">Family</h3>
                                    <p><span className="text-slate-500">Name:</span> {appData.family.familyName}</p>
                                    <p><span className="text-slate-500">Address:</span> {appData.family.address}</p>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-700 border-b pb-2 mb-2">Child</h3>
                                    <p><span className="text-slate-500">Name:</span> {appData.child.firstName} {appData.child.lastName}</p>
                                    <p><span className="text-slate-500">DOB:</span> {appData.child.dob}</p>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-700 border-b pb-2 mb-2">Documents & Consents</h3>
                                    <p><span className="text-slate-500">Uploaded Documents:</span> {uploadedDocs.length}</p>
                                    <p><span className="text-slate-500">Signed Consents:</span> {appData.consents?.length || 0}</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 9: Success */}
                    {step === 9 && (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle className="w-10 h-10 text-green-600" />
                            </div>
                            <h2 className="text-3xl font-bold text-slate-800 mb-4">Application Submitted!</h2>
                            <p className="text-lg text-slate-600 mb-8 max-w-lg mx-auto">
                                Thank you for applying. We have received your information and will be in touch shortly regarding your admission status.
                            </p>
                            <button onClick={() => navigate('/')} className="bg-slate-100 text-slate-700 px-6 py-2 rounded-lg font-medium hover:bg-slate-200">
                                Return Home
                            </button>
                        </motion.div>
                    )}

                    {/* Navigation Buttons */}
                    {step < 9 && (
                        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                            <button
                                onClick={handleBack}
                                disabled={step === 1 || submitting}
                                className={`flex items-center gap-2 px-4 py-2 font-medium rounded-lg ${step === 1 ? 'opacity-0' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                <ChevronLeft className="w-4 h-4" /> Back
                            </button>
                            
                            {step < 8 ? (
                                <button
                                    onClick={handleNext}
                                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow hover:bg-indigo-700 transition"
                                >
                                    Next Step <ChevronRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="flex items-center gap-2 px-8 py-2 bg-green-600 text-white font-medium rounded-lg shadow-md hover:bg-green-700 transition"
                                >
                                    {submitting ? 'Submitting...' : 'Submit Application'} <CheckCircle className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegistrationWizard;
