import React, { useEffect, useState, useRef } from 'react';
import {
    Award, Plus, Trash2, Edit2, ShieldCheck, AlertCircle,
    FileCheck, CheckCircle2, Clock, XCircle, HeartPulse,
    ShieldAlert, BookOpen, Filter, RefreshCw,
    History, Upload, FileText, Check, X, AlertTriangle
} from 'lucide-react';

import {
    employeeService,
    type ECECredential,
    type Province,
    type CredentialType,
    type EmployeeComplianceProfile
} from '../../../api/employeeService';

interface Props {
    employeeId: string;
}

type CategoryKey = 'all' | 'ece' | 'certification' | 'background_check' | 'training';

export const EmployeeCredentialsTab: React.FC<Props> = ({ employeeId }) => {
    const [credentials, setCredentials] = useState<ECECredential[]>([]);
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [credentialTypes, setCredentialTypes] = useState<CredentialType[]>([]);
    const [complianceProfile, setComplianceProfile] = useState<EmployeeComplianceProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');
    const [showSuperseded, setShowSuperseded] = useState(false);


    // Modal state: Add/Edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCredential, setEditingCredential] = useState<ECECredential | null>(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Modal state: Reject
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [targetRejectId, setTargetRejectId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [rejecting, setRejecting] = useState(false);

    // Modal state: Renew
    const [renewModalOpen, setRenewModalOpen] = useState(false);
    const [targetRenewCred, setTargetRenewCred] = useState<ECECredential | null>(null);
    const [renewData, setRenewData] = useState({
        issue_date: '',
        expiry_date: '',
        renewal_date: '',
        certificate_number: '',
        issuing_organization: '',
        notes: ''
    });
    const [renewing, setRenewing] = useState(false);

    // Modal state: History
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyList, setHistoryList] = useState<ECECredential[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Document Upload state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // Form fields for Add/Edit
    const [formCategory, setFormCategory] = useState<string>('certification');
    const [formData, setFormData] = useState<Partial<ECECredential>>({
        credential_type: '',
        province: '',
        certificate_number: '',
        issuing_organization: '',
        request_date: '',
        completed_date: '',
        issue_date: '',
        expiry_date: '',
        renewal_date: '',
        document_reference: '',
        status: 'Active',
        verification_status: 'Unverified',
        notes: ''
    });

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [creds, provs, types, compProfile] = await Promise.all([
                employeeService.getEmployeeCredentials(employeeId),
                employeeService.getProvinces(),
                employeeService.getCredentialTypes(),
                employeeService.getEmployeeComplianceProfile(employeeId).catch(() => null)
            ]);
            setCredentials(creds);
            setProvinces(provs);
            setCredentialTypes(types);
            setComplianceProfile(compProfile);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to load staff credentials.");
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        loadData();
    }, [employeeId]);

    const handleOpenAdd = (category?: string) => {
        const initialCategory = category && category !== 'all' ? category : 'certification';
        setFormCategory(initialCategory);

        const matchingTypes = credentialTypes.filter(t => t.category === initialCategory);
        const defaultType = matchingTypes.length > 0 ? matchingTypes[0].id : (credentialTypes.length > 0 ? credentialTypes[0].id : '');

        setEditingCredential(null);
        setFormData({
            credential_type: defaultType,
            province: '',
            certificate_number: '',
            issuing_organization: '',
            request_date: '',
            completed_date: '',
            issue_date: new Date().toISOString().split('T')[0],
            expiry_date: '',
            renewal_date: '',
            document_reference: '',
            status: 'Active',
            verification_status: 'Unverified',
            notes: ''
        });
        setFormError(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (cred: ECECredential) => {
        const typeObj = credentialTypes.find(t => t.id === (typeof cred.credential_type === 'string' ? cred.credential_type : cred.credential_type_detail?.id));
        setFormCategory(typeObj?.category || cred.category || 'certification');
        setEditingCredential(cred);
        setFormData({
            credential_type: typeof cred.credential_type === 'string' ? cred.credential_type : cred.credential_type_detail?.id || '',
            province: typeof cred.province === 'string' ? cred.province : cred.province_detail?.id || '',
            certificate_number: cred.certificate_number || '',
            issuing_organization: cred.issuing_organization || '',
            request_date: cred.request_date || '',
            completed_date: cred.completed_date || '',
            issue_date: cred.issue_date || '',
            expiry_date: cred.expiry_date || '',
            renewal_date: cred.renewal_date || '',
            document_reference: cred.document_reference || '',
            status: cred.status || 'Active',
            verification_status: cred.verification_status || 'Unverified',
            notes: cred.notes || ''
        });
        setFormError(null);
        setIsModalOpen(true);
    };

    const handleCategoryChangeInModal = (cat: string) => {
        setFormCategory(cat);
        const matching = credentialTypes.filter(t => t.category === cat);
        if (matching.length > 0) {
            setFormData(prev => ({ ...prev, credential_type: matching[0].id }));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFormError(null);

        const effectiveIssueDate = formData.issue_date || formData.completed_date;
        if (!effectiveIssueDate) {
            setFormError("Issue or completion date is required.");
            setSaving(false);
            return;
        }

        if (formData.request_date && formData.completed_date && formData.completed_date < formData.request_date) {
            setFormError("Completion date cannot be before request date.");
            setSaving(false);
            return;
        }

        if (formData.expiry_date && effectiveIssueDate && formData.expiry_date < effectiveIssueDate) {
            setFormError("Expiry date cannot be before the issue/completion date.");
            setSaving(false);
            return;
        }

        if (formData.renewal_date && formData.expiry_date && formData.renewal_date > formData.expiry_date) {
            setFormError("Renewal date should not be after the expiry date.");
            setSaving(false);
            return;
        }

        const selectedType = credentialTypes.find(t => t.id === formData.credential_type);
        if (selectedType) {
            if (selectedType.requires_certificate_number && !formData.certificate_number?.trim()) {
                setFormError(`${selectedType.name} requires a certificate / reference number.`);
                setSaving(false);
                return;
            }
            if (selectedType.requires_expiry && !formData.expiry_date) {
                setFormError(`${selectedType.name} requires an expiry date.`);
                setSaving(false);
                return;
            }
        }

        try {
            const payload: any = {
                credential_type: formData.credential_type,
                province: formData.province || null,
                certificate_number: formData.certificate_number?.trim() || null,
                issuing_organization: formData.issuing_organization?.trim() || null,
                request_date: formData.request_date || null,
                completed_date: formData.completed_date || null,
                issue_date: effectiveIssueDate,
                expiry_date: formData.expiry_date || null,
                renewal_date: formData.renewal_date || null,
                document_reference: formData.document_reference?.trim() || null,
                status: formData.status,
                verification_status: formData.verification_status,
                notes: formData.notes?.trim() || null
            };

            if (editingCredential) {
                await employeeService.updateCredential(editingCredential.id, payload);
            } else {
                await employeeService.createEmployeeCredential(employeeId, payload);
            }

            setIsModalOpen(false);
            loadData();
        } catch (err: any) {
            const errData = err.response?.data;
            if (errData && typeof errData === 'object') {
                const firstKey = Object.keys(errData)[0];
                const msg = Array.isArray(errData[firstKey]) ? errData[firstKey][0] : errData[firstKey];
                setFormError(typeof msg === 'string' ? `${firstKey}: ${msg}` : "Validation failed.");
            } else {
                setFormError(err.response?.data?.detail || "Failed to save credential.");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this credential record?")) return;
        try {
            await employeeService.deleteCredential(id);
            setCredentials(prev => prev.filter(c => c.id !== id));
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to delete credential.");
        }
    };

    // Phase 3: Quick Verify
    const handleVerify = async (id: string) => {
        if (!window.confirm("Verify and approve this credential record?")) return;
        try {
            const updated = await employeeService.verifyCredential(id);
            setCredentials(prev => prev.map(c => c.id === id ? updated : c));
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to verify credential.");
        }
    };

    // Phase 3: Reject Modal
    const handleOpenReject = (id: string) => {
        setTargetRejectId(id);
        setRejectionReason('');
        setRejectModalOpen(true);
    };

    const handleConfirmReject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetRejectId || !rejectionReason.trim()) return;
        try {
            setRejecting(true);
            const updated = await employeeService.rejectCredential(targetRejectId, rejectionReason.trim());
            setCredentials(prev => prev.map(c => c.id === targetRejectId ? updated : c));
            setRejectModalOpen(false);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to reject credential.");
        } finally {
            setRejecting(false);
        }
    };

    // Phase 3: Renew Modal
    const handleOpenRenew = (cred: ECECredential) => {
        setTargetRenewCred(cred);
        const todayStr = new Date().toISOString().split('T')[0];
        setRenewData({
            issue_date: todayStr,
            expiry_date: '',
            renewal_date: '',
            certificate_number: cred.certificate_number || '',
            issuing_organization: cred.issuing_organization || '',
            notes: `Renewed version of previous credential ${cred.certificate_number || ''}`
        });
        setRenewModalOpen(true);
    };

    const handleConfirmRenew = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetRenewCred) return;
        try {
            setRenewing(true);
            await employeeService.renewCredential(targetRenewCred.id, {
                issue_date: renewData.issue_date,
                expiry_date: renewData.expiry_date || null,
                renewal_date: renewData.renewal_date || null,
                certificate_number: renewData.certificate_number || null,
                issuing_organization: renewData.issuing_organization || null,
                notes: renewData.notes || null
            });
            setRenewModalOpen(false);
            loadData();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to renew credential.");
        } finally {
            setRenewing(false);
        }
    };

    // Phase 3: Renewal History Modal
    const handleViewHistory = async (id: string) => {
        try {
            setLoadingHistory(true);
            setHistoryModalOpen(true);
            const history = await employeeService.getCredentialHistory(id);
            setHistoryList(history);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to load credential history.");
        } finally {
            setLoadingHistory(false);
        }
    };

    // Phase 3: File Upload
    const triggerFileUpload = (id: string) => {
        setUploadTargetId(id);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadTargetId) return;
        try {
            setUploading(true);
            const updated = await employeeService.uploadCredentialDocument(uploadTargetId, file);
            setCredentials(prev => prev.map(c => c.id === uploadTargetId ? updated : c));
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to upload document.");
        } finally {
            setUploading(false);
            setUploadTargetId(null);
        }
    };

    const filteredCredentials = credentials.filter(cred => {
        if (!showSuperseded && cred.status === 'Superseded') return false;
        if (activeCategory === 'all') return true;
        const cat = cred.category || cred.credential_type_detail?.category || 'ece';
        return cat === activeCategory;
    });

    const getCategoryBadge = (cat?: string) => {
        switch (cat) {
            case 'ece':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100"><Award className="w-3 h-3" /> ECE Credential</span>;
            case 'certification':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100"><HeartPulse className="w-3 h-3" /> Certification</span>;
            case 'background_check':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-100"><ShieldAlert className="w-3 h-3" /> Background Check</span>;
            case 'training':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100"><BookOpen className="w-3 h-3" /> Training</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700">Credential</span>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Active':
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Active</span>;
            case 'Expired':
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">Expired</span>;
            case 'Pending Renewal':
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Pending Renewal</span>;
            case 'Requires Review':
            case 'Pending Review':
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">{status}</span>;
            case 'Superseded':
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-600">Superseded</span>;
            case 'Suspended':
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">Suspended</span>;
            case 'Revoked':
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Revoked</span>;
            default:
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{status}</span>;
        }
    };

    const getVerificationBadge = (vStatus: string) => {
        switch (vStatus) {
            case 'Verified':
                return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md"><CheckCircle2 className="w-3 h-3" /> Verified</span>;
            case 'Pending Verification':
                return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md"><Clock className="w-3 h-3" /> Pending Review</span>;
            case 'Rejected':
                return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-md"><XCircle className="w-3 h-3" /> Rejected</span>;
            default:
                return <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">Unverified</span>;
        }
    };

    const categoryTabs: { key: CategoryKey; label: string; count: number }[] = [
        { key: 'all', label: 'All Credentials', count: credentials.filter(c => showSuperseded || c.status !== 'Superseded').length },
        { key: 'ece', label: 'ECE', count: credentials.filter(c => (showSuperseded || c.status !== 'Superseded') && (c.category || c.credential_type_detail?.category || 'ece') === 'ece').length },
        { key: 'certification', label: 'Certifications', count: credentials.filter(c => (showSuperseded || c.status !== 'Superseded') && (c.category || c.credential_type_detail?.category) === 'certification').length },
        { key: 'background_check', label: 'Background Checks', count: credentials.filter(c => (showSuperseded || c.status !== 'Superseded') && (c.category || c.credential_type_detail?.category) === 'background_check').length },
        { key: 'training', label: 'Required Training', count: credentials.filter(c => (showSuperseded || c.status !== 'Superseded') && (c.category || c.credential_type_detail?.category) === 'training').length },
    ];

    if (loading) {
        return (
            <div className="p-12 flex justify-center items-center">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Hidden file input for document upload */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            />

            {/* EMPLOYEE COMPLIANCE Profile Summary Card (Phase 5) */}
            {complianceProfile && (
                <div className="p-5 rounded-3xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                    EMPLOYEE COMPLIANCE PROFILE
                                </h4>
                                <p className="text-[11px] text-slate-500">
                                    {complianceProfile.compliance_reason || "Role-specific compliance requirements status"}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className={`px-3.5 py-1 rounded-full text-xs font-black tracking-wide uppercase border ${
                                complianceProfile.overall_status === 'COMPLIANT'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : complianceProfile.overall_status === 'WARNING'
                                    ? 'bg-amber-100 text-amber-900 border-amber-200'
                                    : complianceProfile.overall_status === 'PENDING_REVIEW'
                                    ? 'bg-indigo-100 text-indigo-900 border-indigo-200'
                                    : 'bg-red-100 text-red-800 border-red-200'
                            }`}>
                                {complianceProfile.overall_status}
                            </span>
                        </div>
                    </div>

                    {/* 6 Structured Requirement Checks */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                        {Object.entries(complianceProfile.checks).map(([key, check]) => {
                            const isSuccess = check.badge === 'success';
                            const isWarning = check.badge === 'warning';
                            const isDanger = check.badge === 'danger';

                            return (
                                <div key={key} className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                                        {check.name}
                                    </div>
                                    <div className="flex items-center gap-1.5 font-bold">
                                        {isSuccess && <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                                        {isWarning && <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                                        {isDanger && <X className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />}
                                        <span className={`text-xs ${
                                            isSuccess ? 'text-emerald-700' :
                                            isWarning ? 'text-amber-800' :
                                            isDanger ? 'text-red-700' : 'text-slate-500'
                                        }`}>
                                            {check.status}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate" title={check.detail}>
                                        {check.detail}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Tab Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Award className="w-5 h-5 text-indigo-600" /> Staff Credentials, Checks & Training
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Track First Aid, CPR, Vulnerable Sector & Criminal Checks, Food Safety, verification status, and renewals.
                    </p>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-auto">

                    <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showSuperseded}
                            onChange={(e) => setShowSuperseded(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                        Show Superseded History
                    </label>
                    <button
                        onClick={() => handleOpenAdd(activeCategory)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" /> Add Credential / Check
                    </button>
                </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
                {categoryTabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveCategory(tab.key)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                            activeCategory === tab.key
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                    >
                        <span>{tab.label}</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            activeCategory === tab.key ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
                </div>
            )}

            {/* Credential Cards */}
            {filteredCredentials.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-base font-semibold text-slate-800">
                        {activeCategory === 'all' ? 'No Credentials on File' : `No ${categoryTabs.find(t => t.key === activeCategory)?.label} Recorded`}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                        Ensure compliance by tracking all required provincial certifications, background checks, and annual training.
                    </p>
                    <button
                        onClick={() => handleOpenAdd(activeCategory)}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-xl shadow-sm"
                    >
                        + Add Credential
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredCredentials.map((cred) => {
                        const cat = cred.category || cred.credential_type_detail?.category || 'ece';
                        const isSuperseded = cred.status === 'Superseded';
                        return (
                            <div
                                key={cred.id}
                                className={`p-5 rounded-2xl border shadow-sm transition-shadow flex flex-col justify-between space-y-4 ${
                                    isSuperseded
                                        ? 'bg-slate-50/70 border-slate-200 opacity-75'
                                        : 'bg-white border-slate-200/80 hover:shadow-md'
                                }`}
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                {getCategoryBadge(cat)}
                                                {cred.province_detail && (
                                                    <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700">
                                                        {cred.province_detail.code}
                                                    </span>
                                                )}
                                                {cred.previous_credential && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                                                        <RefreshCw className="w-2.5 h-2.5" /> Renewed
                                                    </span>
                                                )}
                                            </div>
                                            <div className="font-bold text-slate-900 text-base leading-tight">
                                                {cred.credential_type_detail?.name || 'Staff Credential'}
                                            </div>
                                            {cred.issuing_organization && (
                                                <div className="text-xs text-slate-500 font-medium mt-0.5">
                                                    Issued by: {cred.issuing_organization}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {getStatusBadge(cred.status)}
                                            {getVerificationBadge(cred.verification_status)}
                                        </div>
                                    </div>

                                    {/* Verification details info / rejection reason banner */}
                                    {cred.verification_status === 'Verified' && cred.verified_by_name && (
                                        <div className="mb-2 p-2 bg-emerald-50/60 rounded-xl border border-emerald-100 text-[11px] text-emerald-800 flex items-center gap-1.5">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                            <span>Verified by <strong>{cred.verified_by_name}</strong> {cred.verified_at ? `on ${new Date(cred.verified_at).toLocaleDateString()}` : ''}</span>
                                        </div>
                                    )}

                                    {cred.verification_status === 'Rejected' && cred.rejection_reason && (
                                        <div className="mb-2 p-2.5 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800">
                                            <div className="font-bold flex items-center gap-1 text-red-700 mb-0.5">
                                                <AlertTriangle className="w-3.5 h-3.5" /> Rejection Reason:
                                            </div>
                                            <div className="text-red-600 pl-4">{cred.rejection_reason}</div>
                                        </div>
                                    )}

                                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                                        {cred.certificate_number && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Certificate / Ref Number:</span>
                                                <span className="font-semibold text-slate-800 font-mono">
                                                    {cred.certificate_number}
                                                </span>
                                            </div>
                                        )}
                                        {cred.request_date && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Requested Date:</span>
                                                <span className="font-medium text-slate-700">{cred.request_date}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">
                                                {cat === 'background_check' ? 'Completed / Issued Date:' : 'Issue Date:'}
                                            </span>
                                            <span className="font-medium text-slate-800">{cred.issue_date}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">
                                                {cat === 'background_check' ? 'Review / Expiry Date:' : 'Expiry Date:'}
                                            </span>
                                            <span className={`font-medium ${cred.is_expired ? 'text-red-600 font-bold' : 'text-slate-800'}`}>
                                                {cred.expiry_date || 'No Expiration'}
                                            </span>
                                        </div>
                                        {cred.renewal_date && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Target Renewal Date:</span>
                                                <span className="font-medium text-amber-700">{cred.renewal_date}</span>
                                            </div>
                                        )}

                                        {/* Document status and link */}
                                        <div className="flex justify-between items-center pt-1">
                                            <span className="text-slate-500">Document Evidence:</span>
                                            {cred.document_url || cred.document ? (
                                                <a
                                                    href={cred.document_url || `/api/daycare/credentials/${cred.id}/document/`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 underline font-medium"
                                                >
                                                    <FileText className="w-3.5 h-3.5" /> View File
                                                </a>
                                            ) : (
                                                <button
                                                    onClick={() => triggerFileUpload(cred.id)}
                                                    disabled={uploading}
                                                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-600 font-medium disabled:opacity-50"
                                                >
                                                    <Upload className="w-3 h-3" /> {uploading && uploadTargetId === cred.id ? 'Uploading...' : 'Upload File'}
                                                </button>
                                            )}
                                        </div>


                                        {cred.notes && (
                                            <div className="mt-2 p-2 bg-slate-50 rounded-lg text-slate-600 italic text-[11px]">
                                                "{cred.notes}"
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                                    {/* Verification & Renewal workflow buttons */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {!isSuperseded && cred.verification_status !== 'Verified' && (
                                            <>
                                                <button
                                                    onClick={() => handleVerify(cred.id)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                                                    title="Verify Credential"
                                                >
                                                    <Check className="w-3.5 h-3.5" /> Verify
                                                </button>
                                                <button
                                                    onClick={() => handleOpenReject(cred.id)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-semibold transition-colors"
                                                    title="Reject Credential"
                                                >
                                                    <X className="w-3.5 h-3.5" /> Reject
                                                </button>
                                            </>
                                        )}

                                        {!isSuperseded && (
                                            <button
                                                onClick={() => handleOpenRenew(cred)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors"
                                                title="Renew Credential"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" /> Renew
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleViewHistory(cred.id)}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-slate-600 hover:text-slate-900 text-xs font-medium"
                                            title="View Renewal History"
                                        >
                                            <History className="w-3.5 h-3.5" /> History
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => triggerFileUpload(cred.id)}
                                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Upload Supporting Document"
                                        >
                                            <Upload className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleOpenEdit(cred)}
                                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Edit Credential"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cred.id)}
                                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Credential"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal: Add / Edit Credential */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <FileCheck className="w-5 h-5 text-indigo-600" />
                                {editingCredential ? 'Edit Staff Credential' : 'Add Staff Credential / Check'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {formError && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {formError}
                                </div>
                            )}

                            {/* Category Selector */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Credential Category <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formCategory}
                                        onChange={e => handleCategoryChangeInModal(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        required
                                    >
                                        <option value="certification">Certification (First Aid, CPR, Food Safety)</option>
                                        <option value="background_check">Background Check (VSC, CRC, Declarations)</option>
                                        <option value="training">Required Training (Child Protection, WHMIS)</option>
                                        <option value="ece">ECE Professional Credential</option>
                                        <option value="other">Other Credential</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Specific Credential / Check <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.credential_type || ''}
                                        onChange={e => setFormData({ ...formData, credential_type: e.target.value })}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        required
                                    >
                                        <option value="">Select Credential Type</option>
                                        {credentialTypes
                                            .filter(t => t.category === formCategory)
                                            .map(t => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Issuing Organization
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Canadian Red Cross, St. John, Police"
                                        value={formData.issuing_organization || ''}
                                        onChange={e => setFormData({ ...formData, issuing_organization: e.target.value })}
                                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Province / Jurisdiction
                                    </label>
                                    <select
                                        value={formData.province || ''}
                                        onChange={e => setFormData({ ...formData, province: e.target.value })}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="">Nationwide / All Provinces</option>
                                        {provinces.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} ({p.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Certificate / Registration / Reference Number
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. FA-12345, VSC-89421"
                                    value={formData.certificate_number || ''}
                                    onChange={e => setFormData({ ...formData, certificate_number: e.target.value })}
                                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                />
                            </div>

                            {/* Dates section */}
                            {formCategory === 'background_check' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Request Date
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.request_date || ''}
                                            onChange={e => setFormData({ ...formData, request_date: e.target.value })}
                                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Completed Date
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.completed_date || ''}
                                            onChange={e => setFormData({ ...formData, completed_date: e.target.value, issue_date: e.target.value })}
                                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Issue Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.issue_date || ''}
                                        onChange={e => setFormData({ ...formData, issue_date: e.target.value })}
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Expiry / Review Date
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.expiry_date || ''}
                                        onChange={e => setFormData({ ...formData, expiry_date: e.target.value })}
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Target Renewal Date
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.renewal_date || ''}
                                        onChange={e => setFormData({ ...formData, renewal_date: e.target.value })}
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Status
                                    </label>
                                    <select
                                        value={formData.status || 'Active'}
                                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Pending Renewal">Pending Renewal</option>
                                        <option value="Requires Review">Requires Review</option>
                                        <option value="Pending Review">Pending Review</option>
                                        <option value="Expired">Expired</option>
                                        <option value="Suspended">Suspended</option>
                                        <option value="Revoked">Revoked</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Verification Status
                                    </label>
                                    <select
                                        value={formData.verification_status || 'Unverified'}
                                        onChange={e => setFormData({ ...formData, verification_status: e.target.value as any })}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="Unverified">Unverified</option>
                                        <option value="Pending Verification">Pending Verification</option>
                                        <option value="Verified">Verified</option>
                                        <option value="Rejected">Rejected</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Document Link / External Evidence URL
                                </label>
                                <input
                                    type="text"
                                    placeholder="https://... or document URL"
                                    value={formData.document_reference || ''}
                                    onChange={e => setFormData({ ...formData, document_reference: e.target.value })}
                                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Notes
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Add any verification notes, issuing agency references..."
                                    value={formData.notes || ''}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : editingCredential ? 'Update Credential' : 'Add Credential'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Reject Credential with Reason */}
            {rejectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-red-700 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-600" /> Reject Credential
                            </h3>
                            <button onClick={() => setRejectModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleConfirmReject} className="space-y-4">
                            <p className="text-xs text-slate-600">
                                Please provide a clear explanation for why this credential document or certificate is being rejected.
                            </p>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Rejection Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    required
                                    placeholder="e.g. Certificate expired, name on document doesn't match employee, blurry image..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setRejectModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={rejecting || !rejectionReason.trim()}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50"
                                >
                                    {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Renew Credential */}
            {renewModalOpen && targetRenewCred && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <RefreshCw className="w-5 h-5 text-indigo-600" /> Renew Credential
                            </h3>
                            <button onClick={() => setRenewModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleConfirmRenew} className="space-y-4">
                            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900">
                                <strong>Renewing:</strong> {targetRenewCred.credential_type_detail?.name}
                                <div className="text-indigo-700 mt-0.5">
                                    The previous record will be preserved as <strong>Superseded</strong> in history, and a new active version will be created.
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Certificate / Reference Number
                                    </label>
                                    <input
                                        type="text"
                                        value={renewData.certificate_number}
                                        onChange={(e) => setRenewData({ ...renewData, certificate_number: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Issuing Organization
                                    </label>
                                    <input
                                        type="text"
                                        value={renewData.issuing_organization}
                                        onChange={(e) => setRenewData({ ...renewData, issuing_organization: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        New Issue Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={renewData.issue_date}
                                        onChange={(e) => setRenewData({ ...renewData, issue_date: e.target.value })}
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        New Expiry Date
                                    </label>
                                    <input
                                        type="date"
                                        value={renewData.expiry_date}
                                        onChange={(e) => setRenewData({ ...renewData, expiry_date: e.target.value })}
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Target Renewal Date
                                    </label>
                                    <input
                                        type="date"
                                        value={renewData.renewal_date}
                                        onChange={(e) => setRenewData({ ...renewData, renewal_date: e.target.value })}
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Renewal Notes
                                </label>
                                <textarea
                                    rows={2}
                                    value={renewData.notes}
                                    onChange={(e) => setRenewData({ ...renewData, notes: e.target.value })}
                                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setRenewModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={renewing || !renewData.issue_date}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50"
                                >
                                    {renewing ? 'Renewing...' : 'Complete Renewal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Renewal History Timeline */}
            {historyModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <History className="w-5 h-5 text-indigo-600" /> Credential History & Renewal Lineage
                            </h3>
                            <button onClick={() => setHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                                &times;
                            </button>
                        </div>

                        {loadingHistory ? (
                            <div className="py-8 flex justify-center">
                                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : historyList.length === 0 ? (
                            <p className="text-xs text-slate-500 py-6 text-center">No historical renewal versions found.</p>
                        ) : (
                            <div className="relative border-l-2 border-indigo-200 ml-4 pl-4 space-y-6 py-2">
                                {historyList.map((item, idx) => (
                                    <div key={item.id} className="relative">
                                        <div className={`absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-white ${
                                            item.is_current ? 'border-indigo-600 bg-indigo-600' : 'border-slate-400'
                                        }`} />
                                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-slate-800">
                                                    Version {idx + 1} {item.is_current && <span className="text-indigo-600 font-semibold">(Current Active)</span>}
                                                </span>
                                                {getStatusBadge(item.status)}
                                            </div>
                                            <div className="text-slate-600">
                                                Cert #: <strong className="font-mono">{item.certificate_number || 'None'}</strong>
                                            </div>
                                            <div className="text-slate-500 text-[11px]">
                                                Issued: <strong>{item.issue_date}</strong> {item.expiry_date ? `— Expires: ${item.expiry_date}` : ''}
                                            </div>
                                            {item.verified_by_name && (
                                                <div className="text-emerald-700 text-[11px]">
                                                    Verified by: {item.verified_by_name}
                                                </div>
                                            )}
                                            {item.notes && (
                                                <div className="italic text-slate-500 text-[11px] pt-1">
                                                    "{item.notes}"
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
