import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Sparkles, CreditCard, Sliders, Activity, BarChart2, ShieldCheck, 
    CheckCircle2, XCircle, AlertCircle, Clock, Calendar, Users, DollarSign, 
    School, Layers, Search, RotateCcw, Save, Edit2, Copy, Check, ExternalLink, 
    Power, ChevronRight, Eye, RefreshCw, ShieldAlert, ArrowUpRight, ArrowLeftRight, 
    FileText, CheckSquare, Square, Lock, Unlock, Phone, Mail, MapPin, Globe, 
    Award, Database, TrendingUp, AlertTriangle, ChevronDown, CheckCheck,
    UserCheck, UserX, UserPlus, KeyRound, Baby, Briefcase, DoorOpen,
    FileCheck, HeartHandshake, Shield, History, Info, Filter, Plus, Trash2
} from 'lucide-react';
import api from '../api';

export type ManageTab = 
    | 'overview' 
    | 'profile' 
    | 'subscription' 
    | 'care_options' 
    | 'usage' 
    | 'admins' 
    | 'staff' 
    | 'children' 
    | 'classrooms' 
    | 'activity' 
    | 'audit';

export interface ManageDaycareModalProps {
    isOpen: boolean;
    daycareId: string | null;
    daycareName?: string;
    initialTab?: ManageTab;
    onClose: () => void;
    onUpdate?: () => void;
}

interface FeatureItem {
    id: string;
    code: string;
    name: string;
    description: string;
    category: string;
    order: number;
    is_in_plan: boolean;
    override_status: 'inherited' | 'force_enabled' | 'force_disabled';
    is_effective: boolean;
}

interface ManageData {
    overview: {
        id: string;
        name: string;
        daycare_code: string;
        status: string;
        license_number: string;
        registration_number: string;
        owner_name: string;
        director_name: string;
        contact_person: string;
        email: string;
        phone: string;
        website: string;
        address1: string;
        address2: string;
        address: string;
        city: string;
        state: string;
        province: string;
        province_code: string;
        postal_code: string;
        country: string;
        capacity: number;
        opening_time: string;
        closing_time: string;
        working_days: string;
        created_at: string | null;
        updated_at: string | null;
        admins: Array<{
            id: string;
            username: string;
            email: string;
            first_name: string;
            last_name: string;
            full_name: string;
            phone: string;
            mobile: string;
            status: string;
            is_active: boolean;
            is_superuser: boolean;
            last_login: string | null;
            date_joined: string | null;
        }>;
        stats: {
            total_students: number;
            active_students: number;
            total_classrooms: number;
            active_classrooms: number;
            total_employees: number;
            active_employees: number;
            total_teachers: number;
            total_branches: number;
            active_branches: number;
        };
    };
    profile: {
        id: string;
        name: string;
        daycare_code: string;
        logo: string;
        status: string;
        contact_person: string;
        owner_name: string;
        director_name: string;
        email: string;
        phone: string;
        website: string;
        address1: string;
        address2: string;
        city: string;
        state: string;
        province_id: string | null;
        province_code: string;
        province_name: string;
        country: string;
        postal_code: string;
        opening_time: string;
        closing_time: string;
        working_days: string;
        capacity: number;
        license: {
            license_number: string;
            registration_number: string;
            license_type: string;
            issuing_authority: string;
            issue_date: string | null;
            expiry_date: string | null;
            status: string;
            document_path: string;
            notes: string;
        };
        emergency: {
            contact_name: string;
            phone: string;
            alternate_phone: string;
            email: string;
            address: string;
            police_contact: string;
            fire_service_contact: string;
            hospital_contact: string;
            additional_instructions: string;
        };
        provinces: Array<{ id: string; code: string; name: string }>;
    };
    subscription: {
        active_subscription: {
            id: string;
            plan_id: string | null;
            plan_name: string;
            plan_description: string;
            status: string;
            billing_cycle: string;
            amount: number;
            start_date: string | null;
            expiry_date: string | null;
            renewal_date: string | null;
            trial_end_date: string | null;
            days_until_expiry: number | null;
            is_expiring_soon: boolean;
            is_expired: boolean;
            is_trial: boolean;
            features_count: number;
        } | null;
        all_subscriptions: any[];
        available_plans: Array<{
            id: string;
            name: string;
            description: string;
            monthly_price: number;
            quarterly_price: number | null;
            annual_price: number | null;
            trial_days: number;
            max_students: number;
            max_teachers: number;
            max_staff: number;
            max_classrooms: number;
            max_branches: number;
            max_storage_mb: number;
            features_count: number;
        }>;
        invoices: any[];
        payments: any[];
    };
    care_options: {
        active_plan_name: string;
        active_plan_id: string | null;
        plan_features_count: number;
        overrides: {
            enabled: string[];
            disabled: string[];
        };
        categories: string[];
        features: FeatureItem[];
        total_features: number;
        effective_count: number;
    };
    usage: {
        quotas: {
            students: { current: number; max: number | string; percent: number; is_unlimited: boolean };
            teachers: { current: number; max: number | string; percent: number; is_unlimited: boolean };
            staff: { current: number; max: number | string; percent: number; is_unlimited: boolean };
            classrooms: { current: number; max: number | string; percent: number; is_unlimited: boolean };
            branches: { current: number; max: number | string; percent: number; is_unlimited: boolean };
            storage: { current: number; max: number | string; percent: number; is_unlimited: boolean };
        };
        operations: {
            daily_reports_count: number;
            attendance_records_count: number;
            tuition_invoices_count: number;
            tuition_payments_count: number;
            guardians_count: number;
            documents_count: number;
        };
    };
    admins: Array<{
        id: string;
        username: string;
        email: string;
        first_name: string;
        last_name: string;
        full_name: string;
        phone: string;
        mobile: string;
        status: string;
        is_active: boolean;
        is_superuser: boolean;
        last_login: string | null;
        date_joined: string | null;
    }>;
    staff: Array<{
        id: string;
        first_name: string;
        last_name: string;
        full_name: string;
        employee_number: string;
        role: string;
        job_title: string;
        employment_type: string;
        email: string;
        phone: string;
        status: string;
        start_date: string | null;
        date_of_birth: string | null;
        photo: string;
        assigned_classrooms: string[];
    }>;
    children: Array<{
        id: string;
        first_name: string;
        last_name: string;
        full_name: string;
        admission_number: string;
        dob: string | null;
        age: string;
        gender: string;
        status: string;
        admission_date: string | null;
        classroom_name: string;
        contact_name: string;
        contact_phone: string;
        allergies: string;
        photo: string;
    }>;
    classrooms: Array<{
        id: string;
        room_name: string;
        room_code: string;
        age_group_name: string;
        capacity: number;
        student_count: number;
        primary_teacher_name: string;
        status: string;
        floor: string;
        building: string;
        color: string;
    }>;
    activity: Array<{
        id: string;
        type: string;
        title: string;
        description: string;
        timestamp: string;
        badge_color: string;
    }>;
    audit: Array<{
        id: string;
        timestamp: string;
        created_at: string;
        user_name: string;
        user_email: string;
        user_type: string;
        action: string;
        module: string;
        entity_type: string;
        entity_id: string;
        ip_address: string;
        old_values: any;
        new_values: any;
    }>;
}

export default function ManageDaycareModal({
    isOpen,
    daycareId,
    daycareName,
    initialTab = 'overview',
    onClose,
    onUpdate
}: ManageDaycareModalProps) {
    const [activeTab, setActiveTab] = useState<ManageTab>(initialTab);
    const [data, setData] = useState<ManageData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [copiedLink, setCopiedLink] = useState(false);

    // Profile Edit State
    const [profileForm, setProfileForm] = useState<any>(null);
    const [profileDirty, setProfileDirty] = useState(false);

    // Care Options State
    const [localOverrides, setLocalOverrides] = useState<{ enabled: string[]; disabled: string[] }>({ enabled: [], disabled: [] });
    const [careSearch, setCareSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Subscription Assign/Change Modal State
    const [isAssignPlanOpen, setIsAssignPlanOpen] = useState(false);
    const [assignPlanForm, setAssignPlanForm] = useState({
        plan_id: '',
        billing_cycle: 'Monthly',
        amount: '',
        start_date: new Date().toISOString().split('T')[0],
        status: 'Active'
    });

    // Admin Management Modals State
    const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
    const [createAdminForm, setCreateAdminForm] = useState({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        password: ''
    });

    const [isEditAdminOpen, setIsEditAdminOpen] = useState(false);
    const [editAdminForm, setEditAdminForm] = useState<any>(null);

    const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
    const [resetAdminTarget, setResetAdminTarget] = useState<any>(null);
    const [newPasswordValue, setNewPasswordValue] = useState('');
    const [copiedNewPassword, setCopiedNewPassword] = useState(false);

    // Filter states for lists
    const [staffSearch, setStaffSearch] = useState('');
    const [childrenSearch, setChildrenSearch] = useState('');
    const [classroomSearch, setClassroomSearch] = useState('');
    const [auditSearch, setAuditSearch] = useState('');
    const [auditModuleFilter, setAuditModuleFilter] = useState('all');
    const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    const fetchManageData = async () => {
        if (!daycareId) return;
        setLoading(true);
        try {
            const res = await api.get(`/super-admin/daycares/${daycareId}/manage-details/`);
            setData(res.data);
            if (res.data?.care_options?.overrides) {
                setLocalOverrides(res.data.care_options.overrides);
            }
            if (res.data?.profile) {
                setProfileForm(JSON.parse(JSON.stringify(res.data.profile)));
                setProfileDirty(false);
            }
        } catch (err: any) {
            console.error('Failed to load daycare management details', err);
            showNotification('error', err.response?.data?.error || 'Failed to load daycare details.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && daycareId) {
            fetchManageData();
        }
    }, [isOpen, daycareId]);

    if (!isOpen || !daycareId) return null;

    const fullRegUrl = `${window.location.origin}/register/${daycareId}`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(fullRegUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
    };

    // ==========================================
    // Profile Actions
    // ==========================================
    const handleProfileChange = (field: string, value: any) => {
        setProfileForm((prev: any) => ({
            ...prev,
            [field]: value
        }));
        setProfileDirty(true);
    };

    const handleLicenseChange = (field: string, value: any) => {
        setProfileForm((prev: any) => ({
            ...prev,
            license: {
                ...(prev?.license || {}),
                [field]: value
            }
        }));
        setProfileDirty(true);
    };

    const handleEmergencyChange = (field: string, value: any) => {
        setProfileForm((prev: any) => ({
            ...prev,
            emergency: {
                ...(prev?.emergency || {}),
                [field]: value
            }
        }));
        setProfileDirty(true);
    };

    const handleSaveProfile = async () => {
        if (!daycareId || !profileForm) return;
        setSaving(true);
        try {
            await api.patch(`/super-admin/daycares/${daycareId}/profile/`, profileForm);
            showNotification('success', 'Daycare Profile updated successfully.');
            setProfileDirty(false);
            fetchManageData();
            if (onUpdate) onUpdate();
        } catch (err: any) {
            console.error('Profile update failed', err);
            showNotification('error', err.response?.data?.error || 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    // ==========================================
    // Subscription Actions
    // ==========================================
    const handleSubscriptionAction = async (subId: string, actionType: 'renew' | 'suspend' | 'activate' | 'cancel') => {
        if (!confirm(`Are you sure you want to ${actionType} this subscription?`)) return;
        setSaving(true);
        try {
            const res = await api.post(`/super-admin/subscriptions/assigned/${subId}/${actionType}/`);
            showNotification('success', res.data?.message || `Subscription ${actionType} action successful.`);
            fetchManageData();
            if (onUpdate) onUpdate();
        } catch (err: any) {
            console.error(`Subscription ${actionType} failed`, err);
            showNotification('error', err.response?.data?.error || `Failed to ${actionType} subscription.`);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSubscription = async (subId: string) => {
        if (!confirm('Are you sure you want to PERMANENTLY REMOVE and delete this active subscription from the daycare?')) return;
        setSaving(true);
        try {
            await api.delete(`/super-admin/subscriptions/assigned/${subId}/`);
            showNotification('success', 'Subscription permanently removed.');
            fetchManageData();
            if (onUpdate) onUpdate();
        } catch (err: any) {
            console.error('Failed to delete subscription', err);
            showNotification('error', err.response?.data?.error || 'Failed to remove subscription.');
        } finally {
            setSaving(false);
        }
    };

    const handleAssignPlanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!daycareId || !assignPlanForm.plan_id) {
            showNotification('error', 'Please select a subscription plan.');
            return;
        }
        setSaving(true);
        try {
            const res = await api.post(`/super-admin/daycares/${daycareId}/assign-plan/`, assignPlanForm);
            showNotification('success', res.data?.message || 'Plan assigned successfully.');
            setIsAssignPlanOpen(false);
            fetchManageData();
            if (onUpdate) onUpdate();
        } catch (err: any) {
            console.error('Failed to assign plan', err);
            showNotification('error', err.response?.data?.error || 'Failed to assign plan.');
        } finally {
            setSaving(false);
        }
    };

    // ==========================================
    // Care Options Feature Toggle Actions
    // ==========================================
    const setFeatureOverride = (code: string, targetStatus: 'inherited' | 'force_enabled' | 'force_disabled') => {
        let newEnabled = [...localOverrides.enabled];
        let newDisabled = [...localOverrides.disabled];

        newEnabled = newEnabled.filter(c => c !== code);
        newDisabled = newDisabled.filter(c => c !== code);

        if (targetStatus === 'force_enabled') {
            newEnabled.push(code);
        } else if (targetStatus === 'force_disabled') {
            newDisabled.push(code);
        }

        setLocalOverrides({
            enabled: Array.from(new Set(newEnabled)),
            disabled: Array.from(new Set(newDisabled))
        });
    };

    const handleSaveCareOptions = async () => {
        if (!daycareId) return;
        setSaving(true);
        try {
            await api.post(`/super-admin/daycares/${daycareId}/care-options/`, localOverrides);
            showNotification('success', 'Care Options & Feature Overrides saved successfully.');
            fetchManageData();
            if (onUpdate) onUpdate();
        } catch (err: any) {
            console.error('Failed to save care options', err);
            showNotification('error', err.response?.data?.error || 'Failed to save care options.');
        } finally {
            setSaving(false);
        }
    };

    const handleResetAllToDefault = () => {
        setLocalOverrides({ enabled: [], disabled: [] });
    };

    // ==========================================
    // Daycare Admin Management Actions
    // ==========================================
    const handleCreateAdminSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!daycareId) return;
        setSaving(true);
        try {
            const res = await api.post(`/super-admin/daycares/${daycareId}/admins/`, createAdminForm);
            showNotification('success', res.data?.message || 'Daycare Admin created successfully.');
            setIsCreateAdminOpen(false);
            setCreateAdminForm({ username: '', email: '', first_name: '', last_name: '', phone: '', password: '' });
            fetchManageData();
            if (onUpdate) onUpdate();
        } catch (err: any) {
            console.error('Failed to create admin', err);
            showNotification('error', err.response?.data?.error || 'Failed to create admin.');
        } finally {
            setSaving(false);
        }
    };

    const handleEditAdminSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editAdminForm?.id) return;
        setSaving(true);
        try {
            await api.patch(`/super-admin/daycare-admins/${editAdminForm.id}/`, {
                first_name: editAdminForm.first_name,
                last_name: editAdminForm.last_name,
                email: editAdminForm.email,
                mobile: editAdminForm.phone || editAdminForm.mobile,
                status: editAdminForm.status,
            });
            showNotification('success', 'Daycare Admin updated successfully.');
            setIsEditAdminOpen(false);
            fetchManageData();
            if (onUpdate) onUpdate();
        } catch (err: any) {
            console.error('Failed to edit admin', err);
            showNotification('error', err.response?.data?.error || 'Failed to update admin.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleAdminStatus = async (admin: any) => {
        const action = admin.status === 'Active' ? 'suspend' : 'activate';
        if (!confirm(`Are you sure you want to ${action} admin '${admin.username}'?`)) return;
        setSaving(true);
        try {
            const res = await api.post(`/super-admin/daycare-admins/${admin.id}/${action}/`);
            showNotification('success', res.data?.message || `Admin ${action} completed.`);
            fetchManageData();
            if (onUpdate) onUpdate();
        } catch (err: any) {
            console.error('Failed to toggle admin status', err);
            showNotification('error', err.response?.data?.error || 'Failed to change admin status.');
        } finally {
            setSaving(false);
        }
    };

    const handleResetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetAdminTarget?.id || !newPasswordValue) return;
        setSaving(true);
        try {
            const res = await api.post(`/super-admin/daycare-admins/${resetAdminTarget.id}/reset_password/`, {
                password: newPasswordValue
            });
            showNotification('success', res.data?.message || 'Password reset successfully.');
            setIsResetPasswordOpen(false);
            setNewPasswordValue('');
            fetchManageData();
        } catch (err: any) {
            console.error('Password reset failed', err);
            showNotification('error', err.response?.data?.error || 'Failed to reset password.');
        } finally {
            setSaving(false);
        }
    };

    const generateRandomPassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
        let pw = '';
        for (let i = 0; i < 12; i++) {
            pw += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setNewPasswordValue(pw);
    };

    // Filtered lists
    const filteredStaff = useMemo(() => {
        if (!data?.staff) return [];
        if (!staffSearch.trim()) return data.staff;
        const q = staffSearch.toLowerCase();
        return data.staff.filter(s => 
            s.full_name?.toLowerCase().includes(q) ||
            s.role?.toLowerCase().includes(q) ||
            s.email?.toLowerCase().includes(q) ||
            s.employee_number?.toLowerCase().includes(q) ||
            s.assigned_classrooms?.some(c => c.toLowerCase().includes(q))
        );
    }, [data?.staff, staffSearch]);

    const filteredChildren = useMemo(() => {
        if (!data?.children) return [];
        if (!childrenSearch.trim()) return data.children;
        const q = childrenSearch.toLowerCase();
        return data.children.filter(c => 
            c.full_name?.toLowerCase().includes(q) ||
            c.admission_number?.toLowerCase().includes(q) ||
            c.classroom_name?.toLowerCase().includes(q) ||
            c.contact_name?.toLowerCase().includes(q)
        );
    }, [data?.children, childrenSearch]);

    const filteredClassrooms = useMemo(() => {
        if (!data?.classrooms) return [];
        if (!classroomSearch.trim()) return data.classrooms;
        const q = classroomSearch.toLowerCase();
        return data.classrooms.filter(r => 
            r.room_name?.toLowerCase().includes(q) ||
            r.room_code?.toLowerCase().includes(q) ||
            r.age_group_name?.toLowerCase().includes(q) ||
            r.primary_teacher_name?.toLowerCase().includes(q)
        );
    }, [data?.classrooms, classroomSearch]);

    const filteredAudit = useMemo(() => {
        if (!data?.audit) return [];
        return data.audit.filter(a => {
            const matchesSearch = !auditSearch.trim() || 
                a.action?.toLowerCase().includes(auditSearch.toLowerCase()) ||
                a.user_name?.toLowerCase().includes(auditSearch.toLowerCase()) ||
                a.module?.toLowerCase().includes(auditSearch.toLowerCase());
            const matchesModule = auditModuleFilter === 'all' || a.module?.toLowerCase() === auditModuleFilter.toLowerCase();
            return matchesSearch && matchesModule;
        });
    }, [data?.audit, auditSearch, auditModuleFilter]);

    // Care options features categorized
    const categorizedFeatures = useMemo(() => {
        if (!data?.care_options?.features) return {};
        const q = careSearch.toLowerCase().trim();
        const map: { [category: string]: FeatureItem[] } = {};

        data.care_options.features.forEach(f => {
            const overrideStatus: 'inherited' | 'force_enabled' | 'force_disabled' = 
                localOverrides.enabled.includes(f.code) ? 'force_enabled' :
                localOverrides.disabled.includes(f.code) ? 'force_disabled' : 'inherited';
            
            const isEffective = (f.is_in_plan && overrideStatus !== 'force_disabled') || (overrideStatus === 'force_enabled');

            const item: FeatureItem = {
                ...f,
                override_status: overrideStatus,
                is_effective: isEffective
            };

            if (selectedCategory !== 'all' && item.category !== selectedCategory) return;
            if (q && !item.name.toLowerCase().includes(q) && !item.code.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) return;

            if (!map[item.category]) {
                map[item.category] = [];
            }
            map[item.category].push(item);
        });

        return map;
    }, [data?.care_options?.features, localOverrides, careSearch, selectedCategory]);

    const tabsList: Array<{ id: ManageTab; label: string; icon: any; count?: number | string }> = [
        { id: 'overview', label: 'Overview', icon: Sparkles },
        { id: 'profile', label: 'Profile', icon: School },
        { id: 'subscription', label: 'Subscription', icon: CreditCard, count: data?.subscription?.active_subscription?.plan_name },
        { id: 'care_options', label: 'Care Options', icon: Sliders, count: data?.care_options ? `${data.care_options.effective_count}/${data.care_options.total_features}` : undefined },
        { id: 'usage', label: 'Usage', icon: BarChart2 },
        { id: 'admins', label: 'Admins', icon: ShieldCheck, count: data?.admins?.length },
        { id: 'staff', label: 'Staff', icon: Briefcase, count: data?.staff?.length },
        { id: 'children', label: 'Children', icon: Baby, count: data?.children?.length },
        { id: 'classrooms', label: 'Classrooms', icon: DoorOpen, count: data?.classrooms?.length },
        { id: 'activity', label: 'Activity', icon: Activity, count: data?.activity?.length },
        { id: 'audit', label: 'Audit', icon: History, count: data?.audit?.length },
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden border border-slate-100">
                
                {/* Notification Toast */}
                {notification && (
                    <div className={`px-6 py-3.5 flex items-center justify-between text-sm font-semibold transition-all shrink-0 ${
                        notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}>
                        <div className="flex items-center gap-2.5">
                            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                            <span>{notification.message}</span>
                        </div>
                        <button onClick={() => setNotification(null)} className="text-white/80 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-sm border-b border-slate-800">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-black text-xl shadow-md shadow-indigo-500/30 flex-shrink-0">
                            {data?.overview?.name?.charAt(0).toUpperCase() || daycareName?.charAt(0).toUpperCase() || 'K'}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white truncate">
                                    {data?.overview?.name || daycareName || 'Manage Daycare'}
                                </h2>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                    data?.overview?.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' :
                                    data?.overview?.status === 'Suspended' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' :
                                    'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                                }`}>
                                    {data?.overview?.status || 'Loading...'}
                                </span>
                                {data?.subscription?.active_subscription && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                                        <Award className="w-3 h-3" />
                                        {data.subscription.active_subscription.plan_name}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 truncate">
                                <span className="font-mono text-slate-300 font-semibold">{data?.overview?.daycare_code || 'ID: ' + daycareId}</span>
                                {data?.overview?.city && <span>• {data.overview.city}, {data.overview.province}</span>}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Copy Parent Registration Link */}
                        <button
                            onClick={handleCopyLink}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                                copiedLink 
                                    ? 'bg-emerald-500 text-white shadow-md' 
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                            }`}
                            title="Copy Public Registration Link"
                        >
                            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{copiedLink ? 'Copied Link!' : 'Parent Portal'}</span>
                        </button>

                        {/* Open Registration Portal */}
                        <a
                            href={fullRegUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors border border-slate-700"
                            title="Open Parent Registration Portal"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </a>

                        {/* Reload Data */}
                        <button
                            onClick={fetchManageData}
                            disabled={loading}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors border border-slate-700"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>

                        {/* Close Modal */}
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 11-Tab Navigation Bar */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 shrink-0">
                    {tabsList.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3.5 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                                    isActive
                                        ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs rounded-t-xl'
                                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                                }`}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                                <span>{tab.label}</span>
                                {tab.count !== undefined && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                        isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/50">
                    {loading && !data ? (
                        <div className="h-full flex flex-col items-center justify-center py-20 text-slate-400">
                            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
                            <p className="font-bold text-slate-700">Loading daycare management workspace...</p>
                            <p className="text-xs text-slate-400">Fetching profiles, subscriptions, usage limits, and care options.</p>
                        </div>
                    ) : !data ? (
                        <div className="h-full flex flex-col items-center justify-center py-20 text-slate-400">
                            <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
                            <p className="font-bold text-slate-700">Unable to load daycare data</p>
                            <button onClick={fetchManageData} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow">
                                Retry
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* ========================================================= */}
                            {/* TAB 1: OVERVIEW */}
                            {/* ========================================================= */}
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    {/* Top Stat Cards Banner */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Plan Tier</p>
                                            <p className="text-lg font-black text-indigo-700 mt-1 truncate">
                                                {data.subscription.active_subscription?.plan_name || 'No Active Plan'}
                                            </p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                {data.subscription.active_subscription?.billing_cycle || 'Inactive'}
                                            </p>
                                        </div>

                                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Children</p>
                                            <p className="text-lg font-black text-slate-900 mt-1">
                                                {data.overview.stats.active_students} <span className="text-xs font-semibold text-slate-400">/ {data.overview.capacity || '—'}</span>
                                            </p>
                                            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                                                {data.overview.capacity ? `${Math.round((data.overview.stats.active_students / data.overview.capacity) * 100)}% Capacity` : 'Active Students'}
                                            </p>
                                        </div>

                                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Staff & ECEs</p>
                                            <p className="text-lg font-black text-slate-900 mt-1">
                                                {data.overview.stats.active_employees} <span className="text-xs font-semibold text-slate-400">active</span>
                                            </p>
                                            <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">
                                                {data.overview.stats.total_teachers} Teachers
                                            </p>
                                        </div>

                                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Classrooms</p>
                                            <p className="text-lg font-black text-slate-900 mt-1">
                                                {data.overview.stats.active_classrooms}
                                            </p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                {data.overview.stats.total_branches} Branches
                                            </p>
                                        </div>

                                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Care Features</p>
                                            <p className="text-lg font-black text-emerald-600 mt-1">
                                                {data.care_options.effective_count} <span className="text-xs font-semibold text-slate-400">/ {data.care_options.total_features}</span>
                                            </p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Active Modules</p>
                                        </div>

                                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subscription Status</p>
                                            <p className="text-lg font-black text-slate-900 mt-1 capitalize">
                                                {data.subscription.active_subscription?.status || 'None'}
                                            </p>
                                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                                Exp: {data.subscription.active_subscription?.expiry_date || 'N/A'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Quick Actions & Facility Summary */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        
                                        {/* Facility Details Card */}
                                        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
                                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                                    <School className="w-5 h-5 text-indigo-600" />
                                                    Facility Information & Licensing
                                                </h3>
                                                <button
                                                    onClick={() => setActiveTab('profile')}
                                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                    Edit Profile
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                                <div>
                                                    <p className="text-slate-400 font-semibold">Contact Person</p>
                                                    <p className="text-slate-800 font-bold text-sm mt-0.5">{data.overview.contact_person || 'Not provided'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 font-semibold">License Number</p>
                                                    <p className="text-slate-800 font-bold text-sm mt-0.5 font-mono">{data.overview.license_number || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 font-semibold">Official Email</p>
                                                    <p className="text-slate-800 font-bold text-sm mt-0.5">{data.overview.email || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 font-semibold">Phone Number</p>
                                                    <p className="text-slate-800 font-bold text-sm mt-0.5">{data.overview.phone || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 font-semibold">Operating Hours</p>
                                                    <p className="text-slate-800 font-bold text-sm mt-0.5">
                                                        {data.overview.opening_time} - {data.overview.closing_time} ({data.overview.working_days})
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 font-semibold">Full Address</p>
                                                    <p className="text-slate-800 font-bold text-sm mt-0.5">
                                                        {data.overview.address || `${data.overview.city}, ${data.overview.province} ${data.overview.postal_code}`}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Quick Nav Shortcut Buttons */}
                                            <div className="pt-4 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                                                <button
                                                    onClick={() => { setActiveTab('subscription'); setIsAssignPlanOpen(true); }}
                                                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                                                >
                                                    <CreditCard className="w-3.5 h-3.5" />
                                                    Change Plan
                                                </button>
                                                <button
                                                    onClick={() => setActiveTab('care_options')}
                                                    className="px-3.5 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                                                >
                                                    <Sliders className="w-3.5 h-3.5" />
                                                    Care Options
                                                </button>
                                                <button
                                                    onClick={() => { setActiveTab('admins'); setIsCreateAdminOpen(true); }}
                                                    className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                                                >
                                                    <UserPlus className="w-3.5 h-3.5" />
                                                    Add Daycare Admin
                                                </button>
                                                <button
                                                    onClick={() => setActiveTab('children')}
                                                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                                                >
                                                    <Baby className="w-3.5 h-3.5" />
                                                    Children Roster ({data.children?.length})
                                                </button>
                                            </div>
                                        </div>

                                        {/* Assigned Admins Summary Card */}
                                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                                                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                                                        Daycare Admins
                                                    </h3>
                                                    <button
                                                        onClick={() => { setActiveTab('admins'); setIsCreateAdminOpen(true); }}
                                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                        New
                                                    </button>
                                                </div>

                                                <div className="space-y-3">
                                                    {data.admins.slice(0, 3).map(admin => (
                                                        <div key={admin.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-slate-900 truncate">
                                                                    {admin.full_name || admin.username}
                                                                </p>
                                                                <p className="text-[11px] text-slate-500 truncate">{admin.email}</p>
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                                                admin.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                            }`}>
                                                                {admin.is_active ? 'Active' : 'Disabled'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {data.admins.length === 0 && (
                                                        <p className="text-xs text-slate-400 py-4 text-center">No daycare admins assigned yet.</p>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => setActiveTab('admins')}
                                                className="mt-4 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors text-center"
                                            >
                                                Manage All Admins ({data.admins.length}) →
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 2: PROFILE (Comprehensive Daycare Profile Editor) */}
                            {/* ========================================================= */}
                            {activeTab === 'profile' && profileForm && (
                                <div className="space-y-6">
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                                        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                                    <School className="w-5 h-5 text-indigo-600" />
                                                    Daycare Profile & Operations
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Update official facility credentials, contacts, licensing details, and emergency plans.
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {profileDirty && (
                                                    <span className="text-xs text-amber-600 font-bold flex items-center gap-1">
                                                        <AlertCircle className="w-4 h-4" />
                                                        Unsaved changes
                                                    </span>
                                                )}
                                                <button
                                                    onClick={handleSaveProfile}
                                                    disabled={saving || !profileDirty}
                                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            {/* Section 1: Basic Identity */}
                                            <div>
                                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                                    <Award className="w-4 h-4 text-indigo-500" />
                                                    1. Facility Identity & Status
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Daycare Name *</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.name || ''}
                                                            onChange={(e) => handleProfileChange('name', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="e.g. Bright Horizon Academy"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Daycare Code / Slug</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.daycare_code || ''}
                                                            onChange={(e) => handleProfileChange('daycare_code', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="e.g. BRIGHT-01"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                                                        <select
                                                            value={profileForm.status || 'Active'}
                                                            onChange={(e) => handleProfileChange('status', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                        >
                                                            <option value="Active">Active</option>
                                                            <option value="Suspended">Suspended</option>
                                                            <option value="Inactive">Inactive</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Maximum Capacity (Children)</label>
                                                        <input
                                                            type="number"
                                                            value={profileForm.capacity || ''}
                                                            onChange={(e) => handleProfileChange('capacity', parseInt(e.target.value) || 0)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="e.g. 80"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-2">
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Logo URL / Image Reference</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.logo || ''}
                                                            onChange={(e) => handleProfileChange('logo', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="https://... or /media/daycare_logos/..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Section 2: Contact & Personnel */}
                                            <div className="pt-4 border-t border-slate-100">
                                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                                    <Users className="w-4 h-4 text-purple-500" />
                                                    2. Key Personnel & Contact
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Primary Contact Person</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.contact_person || ''}
                                                            onChange={(e) => handleProfileChange('contact_person', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="e.g. Sarah Connor"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Owner Name</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.owner_name || ''}
                                                            onChange={(e) => handleProfileChange('owner_name', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="e.g. John Smith"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Director / Supervisor</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.director_name || ''}
                                                            onChange={(e) => handleProfileChange('director_name', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="e.g. Elena Rostova, RECE"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Official Email</label>
                                                        <input
                                                            type="email"
                                                            value={profileForm.email || ''}
                                                            onChange={(e) => handleProfileChange('email', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="admin@daycare.com"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.phone || ''}
                                                            onChange={(e) => handleProfileChange('phone', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="+1 (416) 555-0199"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Website URL</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.website || ''}
                                                            onChange={(e) => handleProfileChange('website', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="https://www.daycare.com"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Section 3: Location & Operating Hours */}
                                            <div className="pt-4 border-t border-slate-100">
                                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                                    <MapPin className="w-4 h-4 text-emerald-500" />
                                                    3. Address & Operating Hours
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <div className="sm:col-span-2">
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Address Line 1</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.address1 || ''}
                                                            onChange={(e) => handleProfileChange('address1', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="123 King Street West"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Address Line 2 (Unit / Suite)</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.address2 || ''}
                                                            onChange={(e) => handleProfileChange('address2', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="Suite 400"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.city || ''}
                                                            onChange={(e) => handleProfileChange('city', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="Toronto"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Province / State</label>
                                                        <select
                                                            value={profileForm.province_id || ''}
                                                            onChange={(e) => handleProfileChange('province_id', e.target.value || null)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                        >
                                                            <option value="">-- Select Province --</option>
                                                            {profileForm.provinces?.map((p: any) => (
                                                                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Postal / Zip Code</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.postal_code || ''}
                                                            onChange={(e) => handleProfileChange('postal_code', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden font-mono uppercase"
                                                            placeholder="M5H 1J9"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Opening Time</label>
                                                        <input
                                                            type="time"
                                                            value={profileForm.opening_time || '07:00'}
                                                            onChange={(e) => handleProfileChange('opening_time', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Closing Time</label>
                                                        <input
                                                            type="time"
                                                            value={profileForm.closing_time || '18:00'}
                                                            onChange={(e) => handleProfileChange('closing_time', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Operating Days</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.working_days || 'Monday - Friday'}
                                                            onChange={(e) => handleProfileChange('working_days', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="e.g. Monday - Friday"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Section 4: Licensing Information */}
                                            <div className="pt-4 border-t border-slate-100">
                                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                                    <FileCheck className="w-4 h-4 text-cyan-500" />
                                                    4. Government Licensing & Compliance
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">License Number</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.license?.license_number || ''}
                                                            onChange={(e) => handleLicenseChange('license_number', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="e.g. ON-LIC-98431"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Registration Number</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.license?.registration_number || ''}
                                                            onChange={(e) => handleLicenseChange('registration_number', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="e.g. REG-8823"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">License Type</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.license?.license_type || ''}
                                                            onChange={(e) => handleLicenseChange('license_type', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="e.g. Infant & Toddler Center"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Issuing Authority</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.license?.issuing_authority || ''}
                                                            onChange={(e) => handleLicenseChange('issuing_authority', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="e.g. Ministry of Education"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Issue Date</label>
                                                        <input
                                                            type="date"
                                                            value={profileForm.license?.issue_date || ''}
                                                            onChange={(e) => handleLicenseChange('issue_date', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date</label>
                                                        <input
                                                            type="date"
                                                            value={profileForm.license?.expiry_date || ''}
                                                            onChange={(e) => handleLicenseChange('expiry_date', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Section 5: Emergency Information */}
                                            <div className="pt-4 border-t border-slate-100">
                                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                                                    5. Emergency Contacts & Response Protocols
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Contact Person</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.emergency?.contact_name || ''}
                                                            onChange={(e) => handleEmergencyChange('contact_name', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="Safety Officer / Supervisor"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Hotline</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.emergency?.phone || ''}
                                                            onChange={(e) => handleEmergencyChange('phone', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="Direct emergency number"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Designated Hospital</label>
                                                        <input
                                                            type="text"
                                                            value={profileForm.emergency?.hospital_contact || ''}
                                                            onChange={(e) => handleEmergencyChange('hospital_contact', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="Nearest Pediatric Emergency"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-3">
                                                        <label className="block text-xs font-bold text-slate-700 mb-1">Evacuation & Emergency Action Notes</label>
                                                        <textarea
                                                            rows={2}
                                                            value={profileForm.emergency?.additional_instructions || ''}
                                                            onChange={(e) => handleEmergencyChange('additional_instructions', e.target.value)}
                                                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                            placeholder="Evacuation assembly point, emergency utility shut-offs, and critical responder directives..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 3: SUBSCRIPTION */}
                            {/* ========================================================= */}
                            {activeTab === 'subscription' && (
                                <div className="space-y-6">
                                    {/* Active Subscription Hero Card */}
                                    <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-800">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                                            <div>
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-300 border border-indigo-400/40">
                                                        Active Subscription Plan
                                                    </span>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                        data.subscription.active_subscription?.status === 'Active' ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40' :
                                                        data.subscription.active_subscription?.status === 'suspended' ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40' :
                                                        'bg-rose-500/30 text-rose-300 border border-rose-400/40'
                                                    }`}>
                                                        {data.subscription.active_subscription?.status || 'No Active Plan'}
                                                    </span>
                                                </div>

                                                <h2 className="text-2xl sm:text-4xl font-black text-white mt-3">
                                                    {data.subscription.active_subscription?.plan_name || 'Standard Community Plan'}
                                                </h2>
                                                <p className="text-xs text-indigo-200 max-w-xl mt-1">
                                                    {data.subscription.active_subscription?.plan_description || 'Provides dynamic daycare modules and multi-branch care management facilities.'}
                                                </p>

                                                <div className="flex items-center gap-6 mt-4 text-xs">
                                                    <div>
                                                        <span className="text-indigo-300 font-semibold">Billing Rate:</span>
                                                        <span className="text-white font-bold ml-1.5 text-sm font-mono">
                                                            ${data.subscription.active_subscription?.amount?.toFixed(2) || '0.00'} / {data.subscription.active_subscription?.billing_cycle || 'Monthly'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-indigo-300 font-semibold">Renewal Date:</span>
                                                        <span className="text-white font-bold ml-1.5 font-mono">
                                                            {data.subscription.active_subscription?.expiry_date || 'N/A'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons Toolbar */}
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                                                <button
                                                    onClick={() => setIsAssignPlanOpen(true)}
                                                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
                                                >
                                                    <ArrowLeftRight className="w-4 h-4" />
                                                    Change Plan
                                                </button>

                                                {data.subscription.active_subscription && (
                                                    <>
                                                        <button
                                                            onClick={() => handleSubscriptionAction(data.subscription.active_subscription!.id, 'renew')}
                                                            disabled={saving}
                                                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                                        >
                                                            <RotateCcw className="w-4 h-4" />
                                                            Renew
                                                        </button>

                                                        {data.subscription.active_subscription.status === 'Active' ? (
                                                            <button
                                                                onClick={() => handleSubscriptionAction(data.subscription.active_subscription!.id, 'suspend')}
                                                                disabled={saving}
                                                                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                                            >
                                                                <Power className="w-4 h-4" />
                                                                Suspend
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleSubscriptionAction(data.subscription.active_subscription!.id, 'activate')}
                                                                disabled={saving}
                                                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                                            >
                                                                <Power className="w-4 h-4" />
                                                                Reactivate
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => handleSubscriptionAction(data.subscription.active_subscription!.id, 'cancel')}
                                                            disabled={saving}
                                                            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                            Cancel
                                                        </button>

                                                        <button
                                                            onClick={() => handleDeleteSubscription(data.subscription.active_subscription!.id)}
                                                            disabled={saving}
                                                            className="px-4 py-2.5 bg-rose-950 hover:bg-rose-900 border border-rose-700/60 text-rose-200 text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                                            title="Permanently remove this subscription from the daycare"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Remove Plan
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Invoices & Transaction History */}
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-4">
                                            <FileText className="w-5 h-5 text-indigo-600" />
                                            Subscription Invoices & Payment Ledger
                                        </h3>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                                                        <th className="py-2.5">Invoice #</th>
                                                        <th className="py-2.5">Issue Date</th>
                                                        <th className="py-2.5">Due Date</th>
                                                        <th className="py-2.5">Amount</th>
                                                        <th className="py-2.5">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-800">
                                                    {data.subscription.invoices.map((inv: any) => (
                                                        <tr key={inv.id} className="hover:bg-slate-50">
                                                            <td className="py-3 font-mono font-bold text-indigo-700">{inv.invoice_number}</td>
                                                            <td className="py-3 text-slate-500">{inv.issue_date}</td>
                                                            <td className="py-3 text-slate-500">{inv.due_date}</td>
                                                            <td className="py-3 font-mono font-bold">${inv.total?.toFixed(2) || inv.amount?.toFixed(2)}</td>
                                                            <td className="py-3">
                                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                                    inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                                }`}>
                                                                    {inv.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {data.subscription.invoices.length === 0 && (
                                                        <tr>
                                                            <td colSpan={5} className="py-6 text-center text-slate-400">
                                                                No subscription invoices on record.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 4: CARE OPTIONS (Database-Driven Features) */}
                            {/* ========================================================= */}
                            {activeTab === 'care_options' && (
                                <div className="space-y-6">
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                                    <Sliders className="w-5 h-5 text-indigo-600" />
                                                    Care Options & Individual Feature Controls
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Configure features per daycare. Toggle between <b>Plan Default</b>, <b>Force ON</b>, or <b>Force OFF</b>.
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2.5">
                                                <button
                                                    onClick={handleResetAllToDefault}
                                                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                                                    title="Reset all overrides to Plan Defaults"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                    Use All Plan Defaults
                                                </button>

                                                <button
                                                    onClick={handleSaveCareOptions}
                                                    disabled={saving}
                                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    <span>{saving ? 'Saving...' : 'Save Care Options'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Filter and Search */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
                                            <div className="sm:col-span-2 relative">
                                                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={careSearch}
                                                    onChange={(e) => setCareSearch(e.target.value)}
                                                    placeholder="Search features by name or code (e.g. Attendance, Billing, Medication)..."
                                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                />
                                            </div>
                                            <div>
                                                <select
                                                    value={selectedCategory}
                                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                >
                                                    <option value="all">All Categories ({data.care_options.categories.length})</option>
                                                    {data.care_options.categories.map(cat => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Category Feature Cards */}
                                        <div className="space-y-6">
                                            {Object.entries(categorizedFeatures).map(([category, features]) => {
                                                const activeCount = features.filter(f => f.is_effective).length;
                                                return (
                                                    <div key={category} className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200">
                                                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="text-sm font-black text-slate-900">{category}</h4>
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                                                                    {activeCount} of {features.length} Enabled
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {features.map(feat => {
                                                                return (
                                                                    <div 
                                                                        key={feat.code}
                                                                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                                                            feat.is_effective
                                                                                ? 'bg-white border-slate-200 shadow-xs'
                                                                                : 'bg-slate-100/60 border-slate-200 opacity-75'
                                                                        }`}
                                                                    >
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <p className="text-xs font-bold text-slate-900 truncate">{feat.name}</p>
                                                                                <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                                                                                    feat.is_effective ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                                                                }`}>
                                                                                    {feat.is_effective ? 'ON' : 'OFF'}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{feat.code}</p>
                                                                        </div>

                                                                        {/* 3-State Radio Switch */}
                                                                        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 shrink-0">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setFeatureOverride(feat.code, 'inherited')}
                                                                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                                                                                    feat.override_status === 'inherited'
                                                                                        ? 'bg-white text-indigo-700 shadow-xs'
                                                                                        : 'text-slate-500 hover:text-slate-900'
                                                                                }`}
                                                                                title="Inherit from Plan"
                                                                            >
                                                                                Plan Default
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setFeatureOverride(feat.code, 'force_enabled')}
                                                                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                                                                                    feat.override_status === 'force_enabled'
                                                                                        ? 'bg-emerald-600 text-white shadow-xs'
                                                                                        : 'text-slate-500 hover:text-emerald-700'
                                                                                }`}
                                                                                title="Force Enable (Addon)"
                                                                            >
                                                                                Force ON
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setFeatureOverride(feat.code, 'force_disabled')}
                                                                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                                                                                    feat.override_status === 'force_disabled'
                                                                                        ? 'bg-rose-600 text-white shadow-xs'
                                                                                        : 'text-slate-500 hover:text-rose-700'
                                                                                }`}
                                                                                title="Force Disable"
                                                                            >
                                                                                Force OFF
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 5: USAGE */}
                            {/* ========================================================= */}
                            {activeTab === 'usage' && (
                                <div className="space-y-6">
                                    {/* Quotas vs Subscription Limits */}
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-1">
                                            <BarChart2 className="w-5 h-5 text-indigo-600" />
                                            Subscription Limit Utilization
                                        </h3>
                                        <p className="text-xs text-slate-500 mb-6">
                                            Live capacity meters tracked against active plan quotas.
                                        </p>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {/* Children Limit */}
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                                <div className="flex items-center justify-between text-xs font-bold mb-2">
                                                    <span className="text-slate-700 flex items-center gap-1.5">
                                                        <Baby className="w-4 h-4 text-indigo-600" />
                                                        Children (Students)
                                                    </span>
                                                    <span className="font-mono text-slate-900">
                                                        {data.usage.quotas.students.current} / {data.usage.quotas.students.max}
                                                    </span>
                                                </div>
                                                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full transition-all rounded-full ${
                                                            data.usage.quotas.students.percent > 90 ? 'bg-rose-500' :
                                                            data.usage.quotas.students.percent > 75 ? 'bg-amber-500' : 'bg-indigo-600'
                                                        }`}
                                                        style={{ width: `${Math.min(100, data.usage.quotas.students.percent)}%` }}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-2 text-right font-semibold">
                                                    {data.usage.quotas.students.is_unlimited ? 'Unlimited Tier' : `${data.usage.quotas.students.percent}% used`}
                                                </p>
                                            </div>

                                            {/* Staff Limit */}
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                                <div className="flex items-center justify-between text-xs font-bold mb-2">
                                                    <span className="text-slate-700 flex items-center gap-1.5">
                                                        <Briefcase className="w-4 h-4 text-purple-600" />
                                                        Staff Members
                                                    </span>
                                                    <span className="font-mono text-slate-900">
                                                        {data.usage.quotas.staff.current} / {data.usage.quotas.staff.max}
                                                    </span>
                                                </div>
                                                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-purple-600 rounded-full transition-all"
                                                        style={{ width: `${Math.min(100, data.usage.quotas.staff.percent)}%` }}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-2 text-right font-semibold">
                                                    {data.usage.quotas.staff.is_unlimited ? 'Unlimited Tier' : `${data.usage.quotas.staff.percent}% used`}
                                                </p>
                                            </div>

                                            {/* Teachers Limit */}
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                                <div className="flex items-center justify-between text-xs font-bold mb-2">
                                                    <span className="text-slate-700 flex items-center gap-1.5">
                                                        <School className="w-4 h-4 text-emerald-600" />
                                                        Teachers / Educators
                                                    </span>
                                                    <span className="font-mono text-slate-900">
                                                        {data.usage.quotas.teachers.current} / {data.usage.quotas.teachers.max}
                                                    </span>
                                                </div>
                                                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-emerald-600 rounded-full transition-all"
                                                        style={{ width: `${Math.min(100, data.usage.quotas.teachers.percent)}%` }}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-2 text-right font-semibold">
                                                    {data.usage.quotas.teachers.is_unlimited ? 'Unlimited Tier' : `${data.usage.quotas.teachers.percent}% used`}
                                                </p>
                                            </div>

                                            {/* Classrooms Limit */}
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                                <div className="flex items-center justify-between text-xs font-bold mb-2">
                                                    <span className="text-slate-700 flex items-center gap-1.5">
                                                        <DoorOpen className="w-4 h-4 text-cyan-600" />
                                                        Classrooms
                                                    </span>
                                                    <span className="font-mono text-slate-900">
                                                        {data.usage.quotas.classrooms.current} / {data.usage.quotas.classrooms.max}
                                                    </span>
                                                </div>
                                                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-cyan-600 rounded-full transition-all"
                                                        style={{ width: `${Math.min(100, data.usage.quotas.classrooms.percent)}%` }}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-2 text-right font-semibold">
                                                    {data.usage.quotas.classrooms.is_unlimited ? 'Unlimited Tier' : `${data.usage.quotas.classrooms.percent}% used`}
                                                </p>
                                            </div>

                                            {/* Branches Limit */}
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                                <div className="flex items-center justify-between text-xs font-bold mb-2">
                                                    <span className="text-slate-700 flex items-center gap-1.5">
                                                        <Layers className="w-4 h-4 text-amber-600" />
                                                        Multi-Branch Locations
                                                    </span>
                                                    <span className="font-mono text-slate-900">
                                                        {data.usage.quotas.branches.current} / {data.usage.quotas.branches.max}
                                                    </span>
                                                </div>
                                                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-amber-600 rounded-full transition-all"
                                                        style={{ width: `${Math.min(100, data.usage.quotas.branches.percent)}%` }}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-2 text-right font-semibold">
                                                    {data.usage.quotas.branches.is_unlimited ? 'Unlimited Tier' : `${data.usage.quotas.branches.percent}% used`}
                                                </p>
                                            </div>

                                            {/* Storage Limit */}
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                                <div className="flex items-center justify-between text-xs font-bold mb-2">
                                                    <span className="text-slate-700 flex items-center gap-1.5">
                                                        <Database className="w-4 h-4 text-blue-600" />
                                                        Document & Photo Storage (MB)
                                                    </span>
                                                    <span className="font-mono text-slate-900">
                                                        {data.usage.quotas.storage.current} / {data.usage.quotas.storage.max} MB
                                                    </span>
                                                </div>
                                                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-blue-600 rounded-full transition-all"
                                                        style={{ width: `${Math.min(100, data.usage.quotas.storage.percent)}%` }}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-2 text-right font-semibold">
                                                    {data.usage.quotas.storage.percent}% used
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Operational Resource Counters */}
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-4">
                                            <Activity className="w-5 h-5 text-indigo-600" />
                                            Operational Activity Counts
                                        </h3>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                                <p className="text-xl font-black text-slate-900">{data.usage.operations.daily_reports_count}</p>
                                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Daily Reports</p>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                                <p className="text-xl font-black text-slate-900">{data.usage.operations.attendance_records_count}</p>
                                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Attendance Logs</p>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                                <p className="text-xl font-black text-slate-900">{data.usage.operations.tuition_invoices_count}</p>
                                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Tuition Invoices</p>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                                <p className="text-xl font-black text-slate-900">{data.usage.operations.tuition_payments_count}</p>
                                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Payments Logged</p>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                                <p className="text-xl font-black text-slate-900">{data.usage.operations.guardians_count}</p>
                                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Guardians</p>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                                <p className="text-xl font-black text-slate-900">{data.usage.operations.documents_count}</p>
                                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Files & Docs</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 6: ADMINS (ADMIN MANAGEMENT) */}
                            {/* ========================================================= */}
                            {activeTab === 'admins' && (
                                <div className="space-y-6">
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                                                    Daycare Admin Accounts
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Manage administrative staff credentials, activation status, and security access.
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => setIsCreateAdminOpen(true)}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
                                            >
                                                <UserPlus className="w-4 h-4" />
                                                Create Daycare Admin
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {data.admins.map(admin => (
                                                <div key={admin.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                                                                {(admin.first_name || admin.username).charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-bold text-slate-900 truncate">
                                                                    {admin.full_name || admin.username}
                                                                </p>
                                                                <p className="text-xs text-slate-400 font-mono">@{admin.username}</p>
                                                            </div>
                                                        </div>

                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                            admin.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                        }`}>
                                                            {admin.is_active ? 'Active' : 'Disabled'}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-1 text-xs text-slate-600">
                                                        <p className="flex items-center gap-2">
                                                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                            <span className="truncate">{admin.email || 'No email'}</span>
                                                        </p>
                                                        <p className="flex items-center gap-2">
                                                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>{admin.phone || admin.mobile || 'No phone'}</span>
                                                        </p>
                                                        <p className="flex items-center gap-2 text-[11px] text-slate-400">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            <span>Last login: {admin.last_login ? new Date(admin.last_login).toLocaleDateString() : 'Never'}</span>
                                                        </p>
                                                    </div>

                                                    {/* Admin Actions Bar */}
                                                    <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditAdminForm(admin);
                                                                setIsEditAdminOpen(true);
                                                            }}
                                                            className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                            Edit
                                                        </button>

                                                        <button
                                                            onClick={() => {
                                                                setResetAdminTarget(admin);
                                                                generateRandomPassword();
                                                                setIsResetPasswordOpen(true);
                                                            }}
                                                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                                                        >
                                                            <KeyRound className="w-3.5 h-3.5" />
                                                            Reset Password
                                                        </button>

                                                        <button
                                                            onClick={() => handleToggleAdminStatus(admin)}
                                                            className={`p-1.5 rounded-lg transition-colors ${
                                                                admin.is_active 
                                                                    ? 'text-rose-600 hover:bg-rose-50' 
                                                                    : 'text-emerald-600 hover:bg-emerald-50'
                                                            }`}
                                                            title={admin.is_active ? 'Deactivate Access' : 'Activate Access'}
                                                        >
                                                            <Power className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 7: STAFF */}
                            {/* ========================================================= */}
                            {activeTab === 'staff' && (
                                <div className="space-y-6">
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                                    <Briefcase className="w-5 h-5 text-indigo-600" />
                                                    Staff & Employees Directory
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    View all educators, supervisors, and support staff assigned to this facility.
                                                </p>
                                            </div>

                                            <div className="relative w-full sm:w-72">
                                                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={staffSearch}
                                                    onChange={(e) => setStaffSearch(e.target.value)}
                                                    placeholder="Search staff by name or role..."
                                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                />
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto mt-4">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                                                        <th className="py-3">Staff Member</th>
                                                        <th className="py-3">Role / Designation</th>
                                                        <th className="py-3">Assigned Classroom(s)</th>
                                                        <th className="py-3">Contact</th>
                                                        <th className="py-3">Start Date</th>
                                                        <th className="py-3">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-800">
                                                    {filteredStaff.map(emp => (
                                                        <tr key={emp.id} className="hover:bg-slate-50">
                                                            <td className="py-3.5">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                                                                        {emp.first_name?.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-slate-900">{emp.full_name}</p>
                                                                        <p className="text-[11px] text-slate-400 font-mono">{emp.employee_number}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="py-3.5">
                                                                <p className="font-bold text-slate-800">{emp.job_title || emp.role}</p>
                                                                <p className="text-[11px] text-slate-400 capitalize">{emp.employment_type}</p>
                                                            </td>
                                                            <td className="py-3.5">
                                                                {emp.assigned_classrooms?.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {emp.assigned_classrooms.map((c, i) => (
                                                                            <span key={i} className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                                                                                {c}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400 text-xs">Unassigned</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3.5">
                                                                <p className="text-slate-700">{emp.email || '—'}</p>
                                                                <p className="text-slate-400 text-[11px]">{emp.phone}</p>
                                                            </td>
                                                            <td className="py-3.5 text-slate-500 font-mono">{emp.start_date || '—'}</td>
                                                            <td className="py-3.5">
                                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                                    emp.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                                                }`}>
                                                                    {emp.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {filteredStaff.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="py-8 text-center text-slate-400">
                                                                No staff records found for this daycare.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 8: CHILDREN */}
                            {/* ========================================================= */}
                            {activeTab === 'children' && (
                                <div className="space-y-6">
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                                    <Baby className="w-5 h-5 text-indigo-600" />
                                                    Enrolled Children (Students)
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Roster of all enrolled children, age groups, assigned classrooms, and emergency guardians.
                                                </p>
                                            </div>

                                            <div className="relative w-full sm:w-72">
                                                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={childrenSearch}
                                                    onChange={(e) => setChildrenSearch(e.target.value)}
                                                    placeholder="Search children by name or ID..."
                                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                />
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto mt-4">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                                                        <th className="py-3">Child Name</th>
                                                        <th className="py-3">Age / DOB</th>
                                                        <th className="py-3">Classroom</th>
                                                        <th className="py-3">Primary Guardian</th>
                                                        <th className="py-3">Admission Date</th>
                                                        <th className="py-3">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-800">
                                                    {filteredChildren.map(st => (
                                                        <tr key={st.id} className="hover:bg-slate-50">
                                                            <td className="py-3.5">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                                                        {st.first_name?.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-slate-900">{st.full_name}</p>
                                                                        <p className="text-[11px] text-slate-400 font-mono">{st.admission_number || 'ID: ' + st.id.slice(0, 8)}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="py-3.5">
                                                                <p className="font-bold text-slate-800">{st.age || '—'}</p>
                                                                <p className="text-[11px] text-slate-400 font-mono">{st.dob || 'DOB N/A'}</p>
                                                            </td>
                                                            <td className="py-3.5">
                                                                <span className="px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-800 font-bold text-xs">
                                                                    {st.classroom_name}
                                                                </span>
                                                            </td>
                                                            <td className="py-3.5">
                                                                <p className="text-slate-800 font-bold">{st.contact_name || 'Guardian'}</p>
                                                                <p className="text-slate-400 text-[11px]">{st.contact_phone || '—'}</p>
                                                            </td>
                                                            <td className="py-3.5 text-slate-500 font-mono">{st.admission_date || '—'}</td>
                                                            <td className="py-3.5">
                                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                                    st.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                                                }`}>
                                                                    {st.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {filteredChildren.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="py-8 text-center text-slate-400">
                                                                No enrolled children found for this daycare.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 9: CLASSROOMS */}
                            {/* ========================================================= */}
                            {activeTab === 'classrooms' && (
                                <div className="space-y-6">
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                                    <DoorOpen className="w-5 h-5 text-indigo-600" />
                                                    Classrooms & Rooms
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Capacity, age groups, and assigned educators across all classrooms.
                                                </p>
                                            </div>

                                            <div className="relative w-full sm:w-72">
                                                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={classroomSearch}
                                                    onChange={(e) => setClassroomSearch(e.target.value)}
                                                    placeholder="Search rooms by name..."
                                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-hidden"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {filteredClassrooms.map(rm => (
                                                <div key={rm.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                                                    <div>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <div 
                                                                    className="w-3.5 h-3.5 rounded-full shrink-0" 
                                                                    style={{ backgroundColor: rm.color || '#6366F1' }} 
                                                                />
                                                                <h4 className="text-sm font-black text-slate-900">{rm.room_name}</h4>
                                                            </div>
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                                                                {rm.age_group_name}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 font-mono mt-0.5">Code: {rm.room_code || 'N/A'}</p>
                                                    </div>

                                                    <div className="space-y-2 text-xs">
                                                        <div className="flex items-center justify-between text-slate-600">
                                                            <span>Enrolled Children:</span>
                                                            <span className="font-bold font-mono text-slate-900">{rm.student_count} / {rm.capacity || '—'}</span>
                                                        </div>
                                                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-indigo-600 rounded-full transition-all"
                                                                style={{ width: `${rm.capacity ? Math.min(100, (rm.student_count / rm.capacity) * 100) : 0}%` }}
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-between text-slate-600 pt-2 border-t border-slate-200">
                                                            <span>Lead Teacher:</span>
                                                            <span className="font-bold text-slate-800">{rm.primary_teacher_name}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {filteredClassrooms.length === 0 && (
                                                <div className="col-span-full py-8 text-center text-slate-400">
                                                    No classrooms on record for this daycare.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 10: ACTIVITY (Operational Events Timeline) */}
                            {/* ========================================================= */}
                            {activeTab === 'activity' && (
                                <div className="space-y-6">
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-1">
                                            <Activity className="w-5 h-5 text-indigo-600" />
                                            Operational Activity Timeline
                                        </h3>
                                        <p className="text-xs text-slate-500 mb-6">
                                            Chronological history of attendance, daily reports, announcements, and tuition activity.
                                        </p>

                                        <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                                            {data.activity.map(evt => (
                                                <div key={evt.id} className="relative flex items-start gap-4">
                                                    <div className={`w-5 h-5 rounded-full absolute -left-6 top-1 border-2 border-white shadow-xs flex items-center justify-center shrink-0 ${
                                                        evt.badge_color === 'emerald' ? 'bg-emerald-500' :
                                                        evt.badge_color === 'indigo' ? 'bg-indigo-600' : 'bg-blue-500'
                                                    }`} />
                                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="text-xs font-bold text-slate-900">{evt.title}</p>
                                                            <span className="text-[11px] text-slate-400 font-mono">{evt.timestamp}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 mt-1">{evt.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {data.activity.length === 0 && (
                                                <p className="text-xs text-slate-400 py-6 text-center">No recent activity events recorded.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 11: AUDIT (System & Security Logs) */}
                            {/* ========================================================= */}
                            {activeTab === 'audit' && (
                                <div className="space-y-6">
                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                                    <History className="w-5 h-5 text-indigo-600" />
                                                    Security & Audit Trail Log
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Tamper-evident audit trail with actor details, timestamps, IP addresses, and state diffs.
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        value={auditSearch}
                                                        onChange={(e) => setAuditSearch(e.target.value)}
                                                        placeholder="Search audit trail..."
                                                        className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white outline-hidden"
                                                    />
                                                </div>

                                                <select
                                                    value={auditModuleFilter}
                                                    onChange={(e) => setAuditModuleFilter(e.target.value)}
                                                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-hidden"
                                                >
                                                    <option value="all">All Modules</option>
                                                    <option value="Daycares">Daycares</option>
                                                    <option value="Subscriptions">Subscriptions</option>
                                                    <option value="Users">Users</option>
                                                    <option value="Announcements">Announcements</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto mt-4">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                                                        <th className="py-3">Timestamp</th>
                                                        <th className="py-3">Action</th>
                                                        <th className="py-3">Module</th>
                                                        <th className="py-3">Actor / User</th>
                                                        <th className="py-3">IP Address</th>
                                                        <th className="py-3 text-right">Details</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-800">
                                                    {filteredAudit.map(log => (
                                                        <tr key={log.id} className="hover:bg-slate-50">
                                                            <td className="py-3 text-slate-500 font-mono text-[11px]">
                                                                {log.timestamp ? new Date(log.timestamp).toLocaleString() : log.created_at}
                                                            </td>
                                                            <td className="py-3 font-bold text-slate-900">{log.action}</td>
                                                            <td className="py-3">
                                                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                                                    {log.module}
                                                                </span>
                                                            </td>
                                                            <td className="py-3">
                                                                <p className="font-bold text-slate-800">{log.user_name}</p>
                                                                <p className="text-[10px] text-slate-400">{log.user_email || log.user_type}</p>
                                                            </td>
                                                            <td className="py-3 font-mono text-slate-400 text-[11px]">{log.ip_address}</td>
                                                            <td className="py-3 text-right">
                                                                <button
                                                                    onClick={() => setSelectedAuditLog(log)}
                                                                    className="px-2 py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                >
                                                                    View Diff
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {filteredAudit.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="py-8 text-center text-slate-400">
                                                                No audit logs found matching criteria.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ========================================================= */}
            {/* SUB-MODAL: Assign / Change Plan */}
            {/* ========================================================= */}
            {isAssignPlanOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-60">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-indigo-600" />
                                Assign or Change Subscription Plan
                            </h3>
                            <button onClick={() => setIsAssignPlanOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAssignPlanSubmit} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Select Subscription Plan *</label>
                                <select
                                    value={assignPlanForm.plan_id}
                                    onChange={(e) => setAssignPlanForm(prev => ({ ...prev, plan_id: e.target.value }))}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                    required
                                >
                                    <option value="">-- Choose Plan --</option>
                                    {data?.subscription?.available_plans?.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} - ${p.monthly_price}/mo ({p.features_count} features)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Billing Cycle</label>
                                    <select
                                        value={assignPlanForm.billing_cycle}
                                        onChange={(e) => setAssignPlanForm(prev => ({ ...prev, billing_cycle: e.target.value }))}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                    >
                                        <option value="Monthly">Monthly</option>
                                        <option value="Quarterly">Quarterly</option>
                                        <option value="Annual">Annual</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Custom Amount ($ CAD)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={assignPlanForm.amount}
                                        onChange={(e) => setAssignPlanForm(prev => ({ ...prev, amount: e.target.value }))}
                                        placeholder="Leave blank for plan price"
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Effective Start Date</label>
                                    <input
                                        type="date"
                                        value={assignPlanForm.start_date}
                                        onChange={(e) => setAssignPlanForm(prev => ({ ...prev, start_date: e.target.value }))}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Status</label>
                                    <select
                                        value={assignPlanForm.status}
                                        onChange={(e) => setAssignPlanForm(prev => ({ ...prev, status: e.target.value }))}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Trial">Trial</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAssignPlanOpen(false)}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow"
                                >
                                    {saving ? 'Assigning...' : 'Assign Plan & Activate'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* SUB-MODAL: Create Daycare Admin */}
            {/* ========================================================= */}
            {isCreateAdminOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-60">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-indigo-600" />
                                Create Daycare Admin
                            </h3>
                            <button onClick={() => setIsCreateAdminOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateAdminSubmit} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">First Name *</label>
                                    <input
                                        type="text"
                                        value={createAdminForm.first_name}
                                        onChange={(e) => setCreateAdminForm(prev => ({ ...prev, first_name: e.target.value }))}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Last Name *</label>
                                    <input
                                        type="text"
                                        value={createAdminForm.last_name}
                                        onChange={(e) => setCreateAdminForm(prev => ({ ...prev, last_name: e.target.value }))}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Username *</label>
                                <input
                                    type="text"
                                    value={createAdminForm.username}
                                    onChange={(e) => setCreateAdminForm(prev => ({ ...prev, username: e.target.value }))}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
                                    <input
                                        type="email"
                                        value={createAdminForm.email}
                                        onChange={(e) => setCreateAdminForm(prev => ({ ...prev, email: e.target.value }))}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                                    <input
                                        type="text"
                                        value={createAdminForm.phone}
                                        onChange={(e) => setCreateAdminForm(prev => ({ ...prev, phone: e.target.value }))}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="font-bold text-slate-700">Initial Password *</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
                                            let pw = '';
                                            for (let i = 0; i < 10; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
                                            setCreateAdminForm(prev => ({ ...prev, password: pw }));
                                        }}
                                        className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold"
                                    >
                                        Auto-Generate
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={createAdminForm.password}
                                    onChange={(e) => setCreateAdminForm(prev => ({ ...prev, password: e.target.value }))}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 outline-hidden font-bold"
                                    required
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateAdminOpen(false)}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow"
                                >
                                    {saving ? 'Creating...' : 'Create Admin'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* SUB-MODAL: Edit Daycare Admin */}
            {/* ========================================================= */}
            {isEditAdminOpen && editAdminForm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-60">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <Edit2 className="w-5 h-5 text-indigo-600" />
                                Edit Admin: @{editAdminForm.username}
                            </h3>
                            <button onClick={() => setIsEditAdminOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleEditAdminSubmit} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">First Name</label>
                                    <input
                                        type="text"
                                        value={editAdminForm.first_name || ''}
                                        onChange={(e) => setEditAdminForm((prev: any) => ({ ...prev, first_name: e.target.value }))}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Last Name</label>
                                    <input
                                        type="text"
                                        value={editAdminForm.last_name || ''}
                                        onChange={(e) => setEditAdminForm((prev: any) => ({ ...prev, last_name: e.target.value }))}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={editAdminForm.email || ''}
                                    onChange={(e) => setEditAdminForm((prev: any) => ({ ...prev, email: e.target.value }))}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Phone / Mobile</label>
                                    <input
                                        type="text"
                                        value={editAdminForm.phone || editAdminForm.mobile || ''}
                                        onChange={(e) => setEditAdminForm((prev: any) => ({ ...prev, phone: e.target.value }))}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Status</label>
                                    <select
                                        value={editAdminForm.status || (editAdminForm.is_active ? 'Active' : 'Inactive')}
                                        onChange={(e) => setEditAdminForm((prev: any) => ({ ...prev, status: e.target.value }))}
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-hidden"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Suspended">Suspended</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditAdminOpen(false)}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow"
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* SUB-MODAL: Reset Password */}
            {/* ========================================================= */}
            {isResetPasswordOpen && resetAdminTarget && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-60">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <KeyRound className="w-5 h-5 text-indigo-600" />
                                Reset Access: @{resetAdminTarget.username}
                            </h3>
                            <button onClick={() => setIsResetPasswordOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="font-bold text-slate-700">New Password</label>
                                    <button
                                        type="button"
                                        onClick={generateRandomPassword}
                                        className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold"
                                    >
                                        Re-Generate
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={newPasswordValue}
                                        onChange={(e) => setNewPasswordValue(e.target.value)}
                                        className="w-full pr-10 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-indigo-700 outline-hidden"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(newPasswordValue);
                                            setCopiedNewPassword(true);
                                            setTimeout(() => setCopiedNewPassword(false), 2000);
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                                        title="Copy Password"
                                    >
                                        {copiedNewPassword ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                                {copiedNewPassword && <p className="text-[10px] text-emerald-600 font-bold mt-1">Copied to clipboard!</p>}
                            </div>

                            <p className="text-[11px] text-slate-500 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                                Make sure to copy and send this temporary password to the Daycare Admin.
                            </p>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsResetPasswordOpen(false)}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow"
                                >
                                    {saving ? 'Resetting...' : 'Set New Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* SUB-MODAL: Audit Log Diff Viewer */}
            {/* ========================================================= */}
            {selectedAuditLog && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-60">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xl w-full border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <History className="w-5 h-5 text-indigo-600" />
                                    Audit Entry: {selectedAuditLog.action}
                                </h3>
                                <p className="text-[11px] text-slate-400 font-mono mt-0.5">{selectedAuditLog.timestamp}</p>
                            </div>
                            <button onClick={() => setSelectedAuditLog(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="font-bold text-slate-700">Actor: <span className="font-normal">{selectedAuditLog.user_name} ({selectedAuditLog.user_email || selectedAuditLog.user_type})</span></p>
                                <p className="font-bold text-slate-700 mt-1">IP Address: <span className="font-mono font-normal">{selectedAuditLog.ip_address}</span></p>
                                <p className="font-bold text-slate-700 mt-1">Module: <span className="font-normal">{selectedAuditLog.module}</span></p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="font-bold text-slate-600 mb-1">Previous Values</p>
                                    <pre className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-800 overflow-x-auto max-h-48">
                                        {JSON.stringify(selectedAuditLog.old_values || {}, null, 2)}
                                    </pre>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-600 mb-1">New Values</p>
                                    <pre className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-xl text-[11px] font-mono text-indigo-900 overflow-x-auto max-h-48">
                                        {JSON.stringify(selectedAuditLog.new_values || {}, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setSelectedAuditLog(null)}
                                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
