import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import api from '../../api';
import type { Child } from './ChildProfileLayout';
import { 
    User, Phone, AlertTriangle, Edit2, Plus, MapPin, 
    UserMinus, Archive, Play, Activity, CheckCircle, ShieldAlert,
    Calendar, HeartPulse, FileText, Sparkles, ShieldCheck, Mail, CreditCard
} from 'lucide-react';

interface ContextType {
    child: Child & {
        current_classroom?: string | null;
        enrollment_status?: string;
        medical_alerts?: string[];
        primary_emergency_contact?: string | null;
        allergies?: string;
        medical_conditions?: string;
        dietary_restrictions?: string;
        doctor_name?: string;
        doctor_phone?: string;
        branch_name?: string;
    };
    setChild: React.Dispatch<React.SetStateAction<Child | null>>;
    fetchChild: () => Promise<void>;
    isAuthorized: boolean;
}

interface Classroom {
    id: string;
    room_name: string;
    room_code: string;
}

interface Branch {
    id: string;
    name: string;
}

const ChildOverview: React.FC = () => {
    const { child, fetchChild, isAuthorized } = useOutletContext<ContextType>();
    const navigate = useNavigate();
    
    // Modal states
    const [modalAction, setModalAction] = useState<'withdraw' | 'transfer' | 'archive' | 'reenroll' | 'unarchive' | null>(null);
    const [formData, setFormData] = useState<any>({});
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    
    // Dropdowns data
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);

    useEffect(() => {
        if (isAuthorized) {
            fetchDropdownData();
        }
    }, [isAuthorized]);

    const fetchDropdownData = async () => {
        try {
            const [classroomsRes, branchesRes] = await Promise.all([
                api.get('/daycare/classrooms/'),
                api.get('/daycare/branches/')
            ]);
            setClassrooms(classroomsRes.data || []);
            setBranches(branchesRes.data || []);
        } catch (err) {
            console.error("Failed to fetch classrooms/branches:", err);
        }
    };

    const calculateAge = (dobString: string) => {
        if (!dobString) return 'Unknown age';
        const dob = new Date(dobString);
        const diffMs = Date.now() - dob.getTime();
        const ageDt = new Date(diffMs);
        const years = Math.abs(ageDt.getUTCFullYear() - 1970);
        if (years === 0) {
            const today = new Date();
            const months = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth());
            return `${months} month${months !== 1 ? 's' : ''} old`;
        }
        return `${years} year${years !== 1 ? 's' : ''} old`;
    };

    const openModal = (action: 'withdraw' | 'transfer' | 'archive' | 'reenroll' | 'unarchive') => {
        setError('');
        setModalAction(action);
        if (action === 'withdraw') {
            setFormData({ withdrawal_date: new Date().toISOString().split('T')[0], reason: '', notes: '' });
        } else if (action === 'transfer') {
            setFormData({ transfer_date: new Date().toISOString().split('T')[0], branch_id: '', classroom_id: '' });
        } else if (action === 'reenroll') {
            setFormData({ start_date: new Date().toISOString().split('T')[0] });
        } else {
            setFormData({});
        }
    };

    const handleActionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            let endpoint = '';
            let payload = { ...formData };
            
            if (modalAction === 'withdraw') {
                endpoint = 'withdraw';
            } else if (modalAction === 'transfer') {
                endpoint = 'transfer';
                if (!formData.branch_id && !formData.classroom_id) {
                    setError("Please select either a branch or a classroom to transfer.");
                    setSaving(false);
                    return;
                }
            } else if (modalAction === 'archive') {
                endpoint = 'archive';
            } else if (modalAction === 'unarchive') {
                endpoint = 'unarchive';
            } else if (modalAction === 'reenroll') {
                endpoint = 're-enroll';
            }

            await api.post(`/daycare/children/${child.id}/${endpoint}/`, payload);
            setModalAction(null);
            setFormData({});
            await fetchChild();
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || "An error occurred. Check input values.");
        } finally {
            setSaving(false);
        }
    };

    const getStatusColor = (status: string) => {
        const s = (status || '').toLowerCase();
        if (s === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (s === 'withdrawn') return 'bg-amber-50 text-amber-800 border-amber-200';
        if (s === 'transferred') return 'bg-blue-50 text-blue-800 border-blue-200';
        if (s === 'archived') return 'bg-slate-100 text-slate-800 border-slate-200';
        return 'bg-slate-100 text-slate-800 border-slate-200';
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info Columns (2 Columns on Large Screens) */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Critical Medical Alert Banner */}
                {child.medical_alerts && child.medical_alerts.length > 0 && (
                    <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
                        <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-rose-900 font-bold text-sm">Critical Medical Alert</h4>
                            <div className="mt-1 text-rose-700 text-xs space-y-0.5 font-medium">
                                {child.medical_alerts.map((alert, i) => (
                                    <p key={i}>• {alert}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Primary Child Details Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                            <User className="w-4 h-4 text-emerald-600" />
                            <span>Complete Child Information</span>
                        </h3>
                        {isAuthorized && (
                            <button
                                onClick={() => navigate(`/daycare/children/${child.id}/personal`)}
                                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline"
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                            </button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                        <div className="space-y-1">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Full Legal Name</p>
                            <p className="text-sm font-bold text-slate-900">{child.first_name} {child.last_name}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Preferred Name</p>
                            <p className="text-sm font-semibold text-slate-800">{child.preferred_name || <span className="text-slate-400 italic">None</span>}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Admission ID</p>
                            <p className="text-sm font-mono font-bold text-emerald-800">{child.admission_number || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Date of Birth</p>
                            <p className="text-sm font-semibold text-slate-800">
                                {child.dob ? new Date(child.dob).toLocaleDateString() : 'N/A'}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Current Age</p>
                            <p className="text-sm font-semibold text-slate-800">{calculateAge(child.dob)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Gender</p>
                            <p className="text-sm font-semibold text-slate-800 capitalize">{child.gender || 'Not specified'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Primary Language</p>
                            <p className="text-sm font-semibold text-slate-800">{child.language || 'English'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Admission Date</p>
                            <p className="text-sm font-semibold text-slate-800">
                                {child.admission_date ? new Date(child.admission_date).toLocaleDateString() : 'N/A'}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Joining Date</p>
                            <p className="text-sm font-semibold text-slate-800">
                                {child.joining_date ? new Date(child.joining_date).toLocaleDateString() : 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Classroom & Emergency Contact Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Classroom Assignment Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Classroom Assignment</span>
                            </h3>
                            <Link to={`/daycare/children/${child.id}/classroom`} className="text-[11px] font-bold text-emerald-700 hover:underline">
                                View
                            </Link>
                        </div>
                        
                        <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
                            {child.current_classroom ? (
                                <div>
                                    <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Active Classroom</p>
                                    <p className="text-base font-extrabold text-slate-900 mt-0.5">{child.current_classroom}</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-xs font-semibold text-slate-600">No active classroom assignment.</p>
                                    {isAuthorized && (
                                        <Link 
                                            to={`/daycare/children/${child.id}/classroom`} 
                                            className="inline-block mt-2 px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm"
                                        >
                                            Assign Classroom Now
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Primary Emergency Contact Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Primary Emergency Contact</span>
                            </h3>
                            <Link to={`/daycare/children/${child.id}/emergency`} className="text-[11px] font-bold text-emerald-700 hover:underline">
                                View
                            </Link>
                        </div>
                        
                        <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
                            {child.primary_emergency_contact ? (
                                <div>
                                    <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Contact</p>
                                    <p className="text-sm font-extrabold text-slate-900 mt-0.5">{child.primary_emergency_contact}</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-xs font-semibold text-slate-600">No primary emergency contact set.</p>
                                    {isAuthorized && (
                                        <Link 
                                            to={`/daycare/children/${child.id}/emergency`} 
                                            className="inline-block mt-2 px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm"
                                        >
                                            Add Emergency Contact
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Billing & Invoices Snapshot Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                            <span>Billing & Invoices (Bill To: {child.first_name} {child.last_name})</span>
                        </h3>
                        <Link 
                            to={`/daycare/billing/invoices?search=${encodeURIComponent(child.first_name || '')}`} 
                            className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                        >
                            <span>Open Invoicing Dashboard</span>
                            <span>&rarr;</span>
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3.5 rounded-xl bg-sky-50/50 border border-sky-100">
                            <p className="text-[10px] text-sky-700 font-bold uppercase tracking-wider">Billed To (Recipient)</p>
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5">{child.first_name} {child.last_name}</p>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Account ID: #{child.admission_number || 'ADM-001'}</p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Billing Actions</p>
                                <p className="text-xs text-slate-600 mt-0.5">Generate or review statements for this student.</p>
                            </div>
                            <div className="pt-2 flex items-center gap-2">
                                <Link
                                    to={`/daycare/billing/invoices?search=${encodeURIComponent(child.first_name || '')}`}
                                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                                >
                                    <span>View Invoices</span>
                                </Link>
                                <Link
                                    to="/daycare/billing/invoices"
                                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                                >
                                    <span>+ New Invoice</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Medical & Allergies Snapshot Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <HeartPulse className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Medical & Health Snapshot</span>
                        </h3>
                        <Link to={`/daycare/children/${child.id}/medical`} className="text-[11px] font-bold text-emerald-700 hover:underline">
                            Full Medical Record
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Allergies</p>
                            <p className="text-xs font-bold text-slate-800 mt-1">{child.allergies || 'No known allergies'}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dietary Restrictions</p>
                            <p className="text-xs font-bold text-slate-800 mt-1">{child.dietary_restrictions || 'Standard Diet'}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pediatrician / Doctor</p>
                            <p className="text-xs font-bold text-slate-800 mt-1">{child.doctor_name ? `${child.doctor_name} (${child.doctor_phone || 'No phone'})` : 'Not provided'}</p>
                        </div>
                    </div>
                </div>

                {/* Notes & Administrative Info */}
                {(child.child_notes || child.administrative_notes) && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-4">
                        <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Notes & Remarks</span>
                        </h3>
                        <div className="space-y-3">
                            {child.child_notes && (
                                <div className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-100/60">
                                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Child Notes</p>
                                    <p className="text-xs text-slate-700 leading-relaxed">{child.child_notes}</p>
                                </div>
                            )}
                            {child.administrative_notes && (
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Administrative Notes</p>
                                    <p className="text-xs text-slate-700 leading-relaxed">{child.administrative_notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Actions Panel (Right Column) */}
            <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-5">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>Quick Actions</span>
                    </h3>
                    
                    {/* Status Card */}
                    <div className="p-3.5 rounded-xl border flex items-center justify-between bg-slate-50 border-slate-200/70">
                        <span className="text-xs font-bold text-slate-500">Daycare Status</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-extrabold border uppercase tracking-wider ${getStatusColor(child.status)}`}>
                            {child.status}
                        </span>
                    </div>

                    <div className="space-y-2">
                        {isAuthorized ? (
                            <>
                                <button 
                                    onClick={() => navigate(`/daycare/children/${child.id}/personal`)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold rounded-xl text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-all shadow-sm"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Edit2 className="w-3.5 h-3.5 text-emerald-700" />
                                        <span>Edit Profile Details</span>
                                    </div>
                                    <span className="text-emerald-600 font-bold">&rarr;</span>
                                </button>

                                <button 
                                    onClick={() => navigate(`/daycare/billing/invoices?search=${encodeURIComponent(child.first_name || '')}`)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold rounded-xl text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 transition-all shadow-sm"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                                        <span>Invoices & Billing</span>
                                    </div>
                                    <span className="text-sky-600 font-bold">&rarr;</span>
                                </button>
                                
                                <button 
                                    onClick={() => navigate(`/daycare/children/${child.id}/pickup-authorizations`)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 transition-all shadow-sm"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Authorized Pickups</span>
                                    </div>
                                    <Plus className="w-3.5 h-3.5 text-slate-400" />
                                </button>

                                <button 
                                    onClick={() => navigate(`/daycare/children/${child.id}/emergency`)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 transition-all shadow-sm"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Emergency Contacts</span>
                                    </div>
                                    <Plus className="w-3.5 h-3.5 text-slate-400" />
                                </button>

                                <button 
                                    onClick={() => navigate(`/daycare/children/${child.id}/classroom`)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 transition-all shadow-sm"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Classroom Assignment</span>
                                    </div>
                                    <Plus className="w-3.5 h-3.5 text-slate-400" />
                                </button>

                                <button 
                                    onClick={() => navigate(`/daycare/children/${child.id}/medical`)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 transition-all shadow-sm"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <HeartPulse className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Update Medical Record</span>
                                    </div>
                                    <Plus className="w-3.5 h-3.5 text-slate-400" />
                                </button>

                                <button 
                                    onClick={() => navigate(`/daycare/children/${child.id}/documents`)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 transition-all shadow-sm"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Upload Documents</span>
                                    </div>
                                    <Plus className="w-3.5 h-3.5 text-slate-400" />
                                </button>

                                {/* Lifecycle Management Group */}
                                <div className="border-t border-slate-100 my-3 pt-3 space-y-2">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Lifecycle Actions</p>
                                    
                                    {(child.status || '').toLowerCase() === 'active' && (
                                        <>
                                            <button 
                                                onClick={() => openModal('transfer')}
                                                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-all"
                                            >
                                                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                                                <span>Transfer Classroom / Branch</span>
                                            </button>
                                            <button 
                                                onClick={() => openModal('withdraw')}
                                                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-100 transition-all"
                                            >
                                                <UserMinus className="w-3.5 h-3.5 text-amber-600" />
                                                <span>Withdraw Student</span>
                                            </button>
                                        </>
                                    )}
                                    
                                    {['withdrawn', 'transferred'].includes((child.status || '').toLowerCase()) && (
                                        <button 
                                            onClick={() => openModal('archive')}
                                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all"
                                        >
                                            <Archive className="w-3.5 h-3.5 text-slate-600" />
                                            <span>Archive Record</span>
                                        </button>
                                    )}

                                    {(child.status || '').toLowerCase() === 'archived' && (
                                        <button 
                                            onClick={() => openModal('unarchive')}
                                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all"
                                        >
                                            <Play className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Restore (Unarchive)</span>
                                        </button>
                                    )}

                                    {['withdrawn', 'archived'].includes((child.status || '').toLowerCase()) && (
                                        <button 
                                            onClick={() => openModal('reenroll')}
                                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 border border-transparent shadow-sm transition-all"
                                        >
                                            <Play className="w-3.5 h-3.5 text-white" />
                                            <span>Re-enroll Student</span>
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : (
                            <p className="text-xs text-slate-500 italic text-center py-4 bg-slate-50 rounded-xl">
                                Read-only mode.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Lifecycle Action Modals */}
            {modalAction && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                        <div className="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-sm" onClick={() => setModalAction(null)}></div>
                        <div className="relative inline-block w-full max-w-md px-6 py-6 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-2xl shadow-xl sm:my-8 sm:align-middle border border-slate-100">
                            
                            <h3 className="text-lg font-black text-slate-900 capitalize border-b border-slate-100 pb-3 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-emerald-600" />
                                <span>
                                    {modalAction === 'reenroll' ? 'Re-enroll Student' : 
                                     modalAction === 'unarchive' ? 'Restore Student' : 
                                     `${modalAction} Student`}
                                </span>
                            </h3>
                            
                            {error && (
                                <div className="mt-4 p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-100 flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handleActionSubmit} className="space-y-4 mt-4 text-xs">
                                {modalAction === 'archive' && (
                                    <p className="text-slate-600">
                                        Are you sure you want to archive <strong>{child.first_name} {child.last_name}</strong>? This action is reversible.
                                    </p>
                                )}

                                {modalAction === 'unarchive' && (
                                    <p className="text-slate-600">
                                        Are you sure you want to restore <strong>{child.first_name} {child.last_name}</strong> from archive?
                                    </p>
                                )}

                                {modalAction === 'withdraw' && (
                                    <>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Withdrawal Date</label>
                                            <input 
                                                type="date" 
                                                required 
                                                value={formData.withdrawal_date || ''} 
                                                onChange={(e) => setFormData({...formData, withdrawal_date: e.target.value})} 
                                                className="w-full rounded-xl border-slate-200 shadow-sm focus:border-emerald-600 focus:ring-emerald-600 text-xs px-3 py-2 border outline-none font-medium" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reason</label>
                                            <input 
                                                type="text" 
                                                required 
                                                value={formData.reason || ''} 
                                                onChange={(e) => setFormData({...formData, reason: e.target.value})} 
                                                className="w-full rounded-xl border-slate-200 shadow-sm focus:border-emerald-600 focus:ring-emerald-600 text-xs px-3 py-2 border outline-none font-medium" 
                                                placeholder="e.g. Relocating, Graduated" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Notes (Optional)</label>
                                            <textarea 
                                                value={formData.notes || ''} 
                                                onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                                                className="w-full rounded-xl border-slate-200 shadow-sm focus:border-emerald-600 focus:ring-emerald-600 text-xs px-3 py-2 border outline-none font-medium" 
                                                rows={3}
                                            />
                                        </div>
                                    </>
                                )}

                                {modalAction === 'transfer' && (
                                    <>
                                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-800 font-medium">
                                            Select a target branch OR classroom to transfer the student.
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Target Branch (Optional)</label>
                                            <select 
                                                value={formData.branch_id || ''} 
                                                onChange={(e) => setFormData({...formData, branch_id: e.target.value})} 
                                                className="w-full rounded-xl border-slate-200 shadow-sm focus:border-emerald-600 focus:ring-emerald-600 text-xs px-3 py-2 border outline-none font-medium"
                                            >
                                                <option value="">No branch change</option>
                                                {branches.map(b => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Target Classroom (Optional)</label>
                                            <select 
                                                value={formData.classroom_id || ''} 
                                                onChange={(e) => setFormData({...formData, classroom_id: e.target.value})} 
                                                className="w-full rounded-xl border-slate-200 shadow-sm focus:border-emerald-600 focus:ring-emerald-600 text-xs px-3 py-2 border outline-none font-medium"
                                            >
                                                <option value="">No classroom change</option>
                                                {classrooms.map(c => (
                                                    <option key={c.id} value={c.id}>{c.room_name} ({c.room_code || 'No Code'})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Transfer Date</label>
                                            <input 
                                                type="date" 
                                                required 
                                                value={formData.transfer_date || ''} 
                                                onChange={(e) => setFormData({...formData, transfer_date: e.target.value})} 
                                                className="w-full rounded-xl border-slate-200 shadow-sm focus:border-emerald-600 focus:ring-emerald-600 text-xs px-3 py-2 border outline-none font-medium" 
                                            />
                                        </div>
                                    </>
                                )}

                                {modalAction === 'reenroll' && (
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
                                        <input 
                                            type="date" 
                                            required 
                                            value={formData.start_date || ''} 
                                            onChange={(e) => setFormData({...formData, start_date: e.target.value})} 
                                            className="w-full rounded-xl border-slate-200 shadow-sm focus:border-emerald-600 focus:ring-emerald-600 text-xs px-3 py-2 border outline-none font-medium" 
                                        />
                                    </div>
                                )}
                                
                                <div className="mt-6 flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                    <button 
                                        type="button" 
                                        onClick={() => setModalAction(null)} 
                                        className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={saving}
                                        className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                                    >
                                        {saving ? 'Processing...' : 'Confirm'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChildOverview;
