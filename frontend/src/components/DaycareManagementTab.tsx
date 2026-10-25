import React, { useState, useEffect } from 'react';
import { 
    Search, Filter, Edit2, Trash2, Power, RotateCcw, Plus, ChevronLeft, ChevronRight, 
    Copy, Check, ExternalLink, Globe, AlertTriangle, ShieldAlert, Sparkles, Building2,
    CheckSquare, Square, X, RefreshCw, Sliders
} from 'lucide-react';
import api from '../api';
import DaycareFormModal from './DaycareFormModal';
import DaycareOnboardingWizard from './DaycareOnboardingWizard';
import DaycareDeleteModal from './DaycareDeleteModal';
import ConfirmationDialog from './ConfirmationDialog';
import DaycareCareOptionsModal from './DaycareCareOptionsModal';
import ManageDaycareModal, { type ManageTab } from './ManageDaycareModal';

export default function DaycareManagementTab() {
    const [daycares, setDaycares] = useState<any[]>([]);
    const [counts, setCounts] = useState({ all: 0, active: 0, suspended: 0, deleted: 0 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Modals
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedDaycare, setSelectedDaycare] = useState<any>(null);

    // Manage Daycare Modal (11 Tabs: Overview, Profile, Subscription, Care Options, Usage, Admins, Staff, Children, Classrooms, Activity, Audit)
    const [manageModalState, setManageModalState] = useState<{
        isOpen: boolean;
        daycareId: string | null;
        daycareName: string;
        initialTab: ManageTab;
    }>({
        isOpen: false,
        daycareId: null,
        daycareName: '',
        initialTab: 'overview'
    });

    // Care Options & Overrides Modal
    const [careOptionsModalState, setCareOptionsModalState] = useState<{
        isOpen: boolean;
        daycareId: string | null;
        daycareName: string;
    }>({
        isOpen: false,
        daycareId: null,
        daycareName: ''
    });

    // Delete Modal
    const [deleteModalState, setDeleteModalState] = useState<{
        isOpen: boolean;
        daycare: any | null;
        isHardDeleteOnly?: boolean;
    }>({
        isOpen: false,
        daycare: null,
        isHardDeleteOnly: false
    });

    // Generic confirmation dialog
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmStyle: 'primary' as 'danger' | 'warning' | 'primary',
        confirmText: 'Confirm',
        action: () => {}
    });

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    const fetchDaycares = () => {
        setLoading(true);
        let url = `/super-admin/daycares/?page=${page}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (statusFilter) url += `&status=${statusFilter}`;
        
        api.get(url)
            .then(res => {
                if (res.data && res.data.results !== undefined) {
                    setDaycares(res.data.results);
                    setTotalPages(Math.max(1, Math.ceil(res.data.count / 10)));
                } else {
                    setDaycares(res.data || []);
                    setTotalPages(1);
                }
            })
            .catch(err => {
                console.error(err);
                showNotification('error', 'Failed to load daycares.');
            })
            .finally(() => setLoading(false));
    };

    // Fetch counts across all statuses
    const fetchCounts = () => {
        api.get('/super-admin/daycares/?page_size=1000')
            .then(res => {
                const list = (res.data?.results || res.data || []) as any[];
                setCounts({
                    all: list.length,
                    active: list.filter(d => d.status === 'Active').length,
                    suspended: list.filter(d => d.status === 'Suspended').length,
                    deleted: list.filter(d => d.status === 'Deleted').length
                });
            })
            .catch(() => {});
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchDaycares();
            fetchCounts();
        }, 250);
        return () => clearTimeout(timer);
    }, [page, search, statusFilter]);

    // Handle single actions
    const handleAction = (daycareId: string, actionType: string) => {
        setLoading(true);
        api.post(`/super-admin/daycares/${daycareId}/${actionType}/`)
            .then(res => {
                showNotification('success', res.data?.message || `Daycare ${actionType} action completed.`);
                fetchDaycares();
                fetchCounts();
            })
            .catch(err => {
                console.error(err);
                showNotification('error', err.response?.data?.error || `Failed to ${actionType} daycare.`);
            })
            .finally(() => setLoading(false));
    };

    const handleDeleteConfirm = async (daycareId: string, deleteType: 'soft_delete' | 'permanent_delete') => {
        const action = deleteType === 'permanent_delete' ? 'permanent_delete' : 'delete';
        const res = await api.post(`/super-admin/daycares/${daycareId}/${action}/`);
        showNotification('success', res.data?.message || 'Daycare deletion completed.');
        fetchDaycares();
        fetchCounts();
        setSelectedIds(prev => prev.filter(id => id !== daycareId));
    };

    const confirmAction = (daycare: any, actionType: 'suspend' | 'activate' | 'restore') => {
        let title = '';
        let message = '';
        let style: 'danger' | 'warning' | 'primary' = 'primary';
        let confirmText = 'Confirm';
        
        if (actionType === 'suspend') {
            title = 'Suspend Daycare Access';
            message = `Are you sure you want to suspend "${daycare.name}"? Staff, parents, and administrators will immediately lose portal access.`;
            style = 'warning';
            confirmText = 'Suspend Daycare';
        } else if (actionType === 'activate') {
            title = 'Activate Daycare';
            message = `Activate "${daycare.name}" and grant full operational portal access?`;
            style = 'primary';
            confirmText = 'Activate Daycare';
        } else if (actionType === 'restore') {
            title = 'Restore Daycare to Active';
            message = `Are you sure you want to restore "${daycare.name}"? The daycare status will return to Active with full data preserved.`;
            style = 'primary';
            confirmText = 'Restore to Active';
        }

        setConfirmDialog({
            isOpen: true,
            title,
            message,
            confirmStyle: style,
            confirmText,
            action: () => {
                handleAction(daycare.id, actionType);
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    // Bulk actions
    const handleBulkAction = (action: 'permanent_delete' | 'delete' | 'restore' | 'purge_all_deleted') => {
        if (action === 'purge_all_deleted') {
            setConfirmDialog({
                isOpen: true,
                title: 'Purge All Deleted Daycares',
                message: `Are you sure you want to permanently erase ALL deleted daycares and their related student/staff/billing data from the database? This cannot be undone.`,
                confirmStyle: 'danger',
                confirmText: 'Purge All Deleted',
                action: () => {
                    setLoading(true);
                    api.post('/super-admin/daycares/bulk-action/', { action: 'purge_all_deleted' })
                        .then(res => {
                            showNotification('success', res.data?.message || 'Purged deleted daycares.');
                            fetchDaycares();
                            fetchCounts();
                            setSelectedIds([]);
                        })
                        .catch(err => {
                            showNotification('error', err.response?.data?.error || 'Failed to purge deleted daycares.');
                        })
                        .finally(() => {
                            setLoading(false);
                            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                        });
                }
            });
            return;
        }

        if (selectedIds.length === 0) return;

        const actionTitles: Record<string, string> = {
            permanent_delete: 'Permanently Delete Selected',
            delete: 'Soft Delete Selected',
            restore: 'Restore Selected'
        };

        const actionMessages: Record<string, string> = {
            permanent_delete: `Are you sure you want to PERMANENTLY remove ${selectedIds.length} selected daycare(s) and all their associated data from the database? This action is irreversible!`,
            delete: `Soft delete ${selectedIds.length} selected daycare(s)? Their status will be set to Deleted.`,
            restore: `Restore ${selectedIds.length} selected daycare(s) back to Active status?`
        };

        setConfirmDialog({
            isOpen: true,
            title: actionTitles[action] || 'Bulk Action',
            message: actionMessages[action] || `Execute ${action} on selected daycares?`,
            confirmStyle: action === 'permanent_delete' ? 'danger' : action === 'delete' ? 'warning' : 'primary',
            confirmText: actionTitles[action] || 'Confirm',
            action: () => {
                setLoading(true);
                api.post('/super-admin/daycares/bulk-action/', { action, ids: selectedIds })
                    .then(res => {
                        showNotification('success', res.data?.message || `Bulk ${action} completed.`);
                        fetchDaycares();
                        fetchCounts();
                        setSelectedIds([]);
                    })
                    .catch(err => {
                        showNotification('error', err.response?.data?.error || 'Bulk action failed.');
                    })
                    .finally(() => {
                        setLoading(false);
                        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                    });
            }
        });
    };

    const handleCopyRegistrationUrl = (daycareId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const fullUrl = `${window.location.origin}/register/${daycareId}`;
        navigator.clipboard.writeText(fullUrl);
        setCopiedId(daycareId);
        setTimeout(() => setCopiedId(null), 2500);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === daycares.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(daycares.map(d => d.id));
        }
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    return (
        <div className="space-y-6 p-8">
            {/* Header Notification */}
            {notification && (
                <div className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm animate-fadeIn ${
                    notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                    <div className="flex items-center gap-2">
                        {notification.type === 'success' ? <Check className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
                        <span>{notification.message}</span>
                    </div>
                    <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Page Title & Onboarding CTA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
                        <Building2 className="w-7 h-7 text-indigo-600" />
                        Daycare Management
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Manage daycare centers, lifecycle statuses, parent registration portals, and data cleanup.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    {counts.deleted > 0 && (
                        <button 
                            onClick={() => handleBulkAction('purge_all_deleted')}
                            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl shadow-xs transition-all"
                            title="Permanently remove all daycares in 'Deleted' status"
                        >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            Purge All Deleted ({counts.deleted})
                        </button>
                    )}
                    <button 
                        onClick={() => setIsWizardOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-bold rounded-xl shadow-md shadow-indigo-100 transition-all hover:shadow-indigo-200"
                    >
                        <Sparkles className="w-4 h-4" />
                        Onboard Daycare
                    </button>
                    <button 
                        onClick={() => { setSelectedDaycare(null); setIsFormOpen(true); }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-xl shadow-xs transition-all"
                    >
                        <Plus className="w-4 h-4 text-indigo-600" />
                        Quick Add
                    </button>
                </div>
            </div>

            {/* Status Filter Cards / Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'All Daycares', value: '', count: counts.all, color: 'indigo' },
                    { label: 'Active', value: 'Active', count: counts.active, color: 'emerald' },
                    { label: 'Suspended', value: 'Suspended', count: counts.suspended, color: 'amber' },
                    { label: 'Deleted', value: 'Deleted', count: counts.deleted, color: 'rose' },
                ].map((tab) => {
                    const isSelected = statusFilter === tab.value;
                    return (
                        <button
                            key={tab.label}
                            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                            className={`p-3.5 rounded-xl border text-left transition-all ${
                                isSelected 
                                    ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm' 
                                    : 'bg-white/80 border-gray-200 hover:bg-white hover:border-gray-300'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-indigo-600' : 'text-gray-500'}`}>
                                    {tab.label}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                                    tab.color === 'emerald' ? 'bg-emerald-100 text-emerald-800' :
                                    tab.color === 'amber' ? 'bg-amber-100 text-amber-800' :
                                    tab.color === 'rose' ? 'bg-rose-100 text-rose-800' :
                                    'bg-indigo-100 text-indigo-800'
                                }`}>
                                    {tab.count}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Main Table Container */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                {/* Search & Filter Toolbar */}
                <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="w-full md:w-96 relative">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search by name, email, phone or city..." 
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={() => { fetchDaycares(); fetchCounts(); }}
                            className="p-2 border border-gray-200 rounded-xl hover:bg-white text-gray-600 transition-colors"
                            title="Refresh list"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="w-full md:w-48 relative">
                            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <select 
                                value={statusFilter}
                                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                            >
                                <option value="">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Suspended">Suspended</option>
                                <option value="Deleted">Deleted</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Bulk Actions Floating/Sticky Bar */}
                {selectedIds.length > 0 && (
                    <div className="p-3 bg-indigo-50/80 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
                        <div className="flex items-center gap-2 text-sm font-bold text-indigo-900">
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                            <span>{selectedIds.length} daycare{selectedIds.length > 1 ? 's' : ''} selected</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => handleBulkAction('restore')}
                                className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-all shadow-xs"
                            >
                                Restore Selected
                            </button>
                            <button
                                onClick={() => handleBulkAction('delete')}
                                className="px-3 py-1.5 bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-bold transition-all shadow-xs"
                            >
                                Soft Delete Selected
                            </button>
                            <button
                                onClick={() => handleBulkAction('permanent_delete')}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Permanently Delete ({selectedIds.length})
                            </button>
                            <button
                                onClick={() => setSelectedIds([])}
                                className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}

                {/* Daycares Table */}
                {loading && daycares.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-3 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                        <span className="text-sm font-medium">Loading registered daycares...</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-600">
                                    <th className="px-4 py-3.5 w-10">
                                        <button 
                                            onClick={toggleSelectAll} 
                                            className="text-gray-400 hover:text-indigo-600"
                                            title={selectedIds.length === daycares.length ? 'Deselect all' : 'Select all'}
                                        >
                                            {selectedIds.length > 0 && selectedIds.length === daycares.length ? (
                                                <CheckSquare className="w-4 h-4 text-indigo-600" />
                                            ) : (
                                                <Square className="w-4 h-4" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Daycare Details</th>
                                    <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Registration Link</th>
                                    <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Contact Info</th>
                                    <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {daycares.map((daycare) => {
                                    const regPath = `/register/${daycare.id}`;
                                    const fullRegUrl = `${window.location.origin}${regPath}`;
                                    const isCopied = copiedId === daycare.id;
                                    const isSelected = selectedIds.includes(daycare.id);
                                    const isDeleted = daycare.status === 'Deleted';

                                    return (
                                        <tr key={daycare.id} className={`hover:bg-gray-50/80 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''} ${isDeleted ? 'opacity-90' : ''}`}>
                                            <td className="px-4 py-4">
                                                <button 
                                                    onClick={() => toggleSelectOne(daycare.id)} 
                                                    className="text-gray-400 hover:text-indigo-600"
                                                >
                                                    {isSelected ? (
                                                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                                                    ) : (
                                                        <Square className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div 
                                                    onClick={() => setManageModalState({
                                                        isOpen: true,
                                                        daycareId: daycare.id,
                                                        daycareName: daycare.name,
                                                        initialTab: 'overview'
                                                    })}
                                                    className="flex items-center gap-3 cursor-pointer group/item"
                                                    title="Click to Manage Daycare"
                                                >
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm shadow-xs transition-transform group-hover/item:scale-105 ${
                                                        isDeleted ? 'bg-rose-100 text-rose-700' :
                                                        daycare.status === 'Suspended' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-200'
                                                    }`}>
                                                        {daycare.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className={`text-sm font-bold transition-colors group-hover/item:text-indigo-600 ${isDeleted ? 'text-gray-700 line-through' : 'text-gray-900'}`}>
                                                            {daycare.name}
                                                        </p>
                                                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                                            ID: {daycare.id}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {daycare.city || 'No city'}{daycare.country ? `, ${daycare.country}` : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2 max-w-xs">
                                                    <div className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 group hover:border-indigo-300 transition-colors">
                                                        <span className="text-xs text-indigo-700 font-mono truncate font-semibold" title={fullRegUrl}>
                                                            {regPath}
                                                        </span>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleCopyRegistrationUrl(daycare.id, e)}
                                                                className={`p-1 rounded text-xs transition-colors flex items-center gap-1 ${
                                                                    isCopied 
                                                                        ? 'bg-emerald-100 text-emerald-700 font-bold' 
                                                                        : 'text-slate-400 hover:text-indigo-600 hover:bg-white'
                                                                }`}
                                                                title="Copy Parent Registration Link"
                                                            >
                                                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                                {isCopied && <span className="text-[10px]">Copied!</span>}
                                                            </button>
                                                            <a
                                                                href={regPath}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition-colors"
                                                                title="Open Registration Page"
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="text-sm font-medium text-gray-800">{daycare.email || 'No email'}</p>
                                                <p className="text-xs text-gray-500">{daycare.phone || 'No phone'}</p>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold
                                                    ${daycare.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 
                                                      daycare.status === 'Suspended' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 
                                                      'bg-rose-100 text-rose-800 border border-rose-200'}`}>
                                                    {daycare.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Manage Daycare (Overview, Subscription, Care Options, Usage, Activity) */}
                                                    <button
                                                        onClick={() => setManageModalState({
                                                            isOpen: true,
                                                            daycareId: daycare.id,
                                                            daycareName: daycare.name,
                                                            initialTab: 'overview'
                                                        })}
                                                        className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 font-bold text-xs shadow-xs"
                                                        title="Manage Daycare (Overview, Subscription, Care Options, Usage, Activity)"
                                                    >
                                                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                                        <span>Manage</span>
                                                    </button>

                                                    {/* Public Portal Link */}
                                                    <a
                                                        href={regPath}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Open Registration Page"
                                                    >
                                                        <Globe className="w-4 h-4" />
                                                    </a>

                                                    {/* Care Options & Feature Override Button */}
                                                    {!isDeleted && (
                                                        <button
                                                            onClick={() => setManageModalState({
                                                                isOpen: true,
                                                                daycareId: daycare.id,
                                                                daycareName: daycare.name,
                                                                initialTab: 'care_options'
                                                            })}
                                                            className="text-slate-400 hover:text-cyan-700 p-1.5 hover:bg-cyan-50 rounded-lg transition-colors flex items-center gap-1"
                                                            title="Care Options (KidSynq Features & Overrides)"
                                                        >
                                                            <Sliders className="w-4 h-4 text-cyan-600" />
                                                        </button>
                                                    )}

                                                    {/* Edit button */}
                                                    {!isDeleted && (
                                                        <button 
                                                            onClick={() => { setSelectedDaycare(daycare); setIsFormOpen(true); }} 
                                                            className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-lg transition-colors" 
                                                            title="Edit Daycare Settings"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    
                                                    {/* Suspend / Activate toggle */}
                                                    {daycare.status === 'Active' && (
                                                        <button 
                                                            onClick={() => confirmAction(daycare, 'suspend')} 
                                                            className="text-slate-400 hover:text-amber-600 p-1.5 hover:bg-amber-50 rounded-lg transition-colors" 
                                                            title="Suspend Daycare Access"
                                                        >
                                                            <Power className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    
                                                    {['Suspended', 'Inactive'].includes(daycare.status) && (
                                                        <button 
                                                            onClick={() => confirmAction(daycare, 'activate')} 
                                                            className="text-slate-400 hover:text-emerald-600 p-1.5 hover:bg-emerald-50 rounded-lg transition-colors" 
                                                            title="Activate Daycare"
                                                        >
                                                            <Power className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    
                                                    {/* Restore button (for deleted daycares) */}
                                                    {isDeleted && (
                                                        <button 
                                                            onClick={() => confirmAction(daycare, 'restore')} 
                                                            className="text-indigo-600 hover:text-indigo-800 p-1.5 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 font-semibold text-xs" 
                                                            title="Restore to Active Status"
                                                        >
                                                            <RotateCcw className="w-4 h-4" />
                                                            <span className="hidden lg:inline text-[11px]">Restore</span>
                                                        </button>
                                                    )}

                                                    {/* Delete buttons */}
                                                    {isDeleted ? (
                                                        /* Permanent Delete button when already in Deleted status */
                                                        <button 
                                                            onClick={() => setDeleteModalState({
                                                                isOpen: true,
                                                                daycare,
                                                                isHardDeleteOnly: true
                                                            })} 
                                                            className="text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 font-semibold text-xs" 
                                                            title="Permanently Delete Daycare from Database"
                                                        >
                                                            <Trash2 className="w-4 h-4 text-rose-600" />
                                                            <span className="hidden lg:inline text-[11px]">Purge</span>
                                                        </button>
                                                    ) : (
                                                        /* Delete Option (opens modal offering Soft or Hard delete) */
                                                        <button 
                                                            onClick={() => setDeleteModalState({
                                                                isOpen: true,
                                                                daycare,
                                                                isHardDeleteOnly: false
                                                            })} 
                                                            className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors" 
                                                            title="Delete Daycare Options"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {daycares.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                            <p className="font-semibold text-gray-700">No daycares found</p>
                                            <p className="text-xs text-gray-400 mt-1">Try adjusting your search or status filter.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white">
                        <span className="text-xs font-semibold text-gray-500">
                            Page {page} of {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setPage(Math.max(1, page - 1))} 
                                disabled={page === 1}
                                className="p-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => setPage(Math.min(totalPages, page + 1))} 
                                disabled={page === totalPages}
                                className="p-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit / Quick Add Daycare Modal */}
            <DaycareFormModal 
                isOpen={isFormOpen} 
                daycare={selectedDaycare} 
                onClose={() => setIsFormOpen(false)} 
                onSuccess={() => { setIsFormOpen(false); fetchDaycares(); fetchCounts(); }} 
                onDeleteRequest={(dc) => {
                    setIsFormOpen(false);
                    setDeleteModalState({
                        isOpen: true,
                        daycare: dc,
                        isHardDeleteOnly: false
                    });
                }}
            />
            
            {/* Onboarding Wizard */}
            <DaycareOnboardingWizard 
                isOpen={isWizardOpen} 
                onClose={() => setIsWizardOpen(false)} 
                onSuccess={() => { setIsWizardOpen(false); fetchDaycares(); fetchCounts(); }} 
            />

            {/* Dedicated Delete Modal */}
            <DaycareDeleteModal 
                isOpen={deleteModalState.isOpen}
                daycare={deleteModalState.daycare}
                isHardDeleteOnly={deleteModalState.isHardDeleteOnly}
                onClose={() => setDeleteModalState({ isOpen: false, daycare: null, isHardDeleteOnly: false })}
                onConfirm={handleDeleteConfirm}
            />

            {/* Manage Daycare Modal (5 Tabs: Overview, Subscription, Care Options, Usage, Activity) */}
            <ManageDaycareModal
                isOpen={manageModalState.isOpen}
                daycareId={manageModalState.daycareId}
                daycareName={manageModalState.daycareName}
                initialTab={manageModalState.initialTab}
                onClose={() => setManageModalState(prev => ({ ...prev, isOpen: false }))}
                onUpdate={() => {
                    fetchDaycares();
                    fetchCounts();
                }}
            />

            {/* Care Options & Feature Override Modal */}
            <DaycareCareOptionsModal
                isOpen={careOptionsModalState.isOpen}
                daycareId={careOptionsModalState.daycareId}
                daycareName={careOptionsModalState.daycareName}
                onClose={() => setCareOptionsModalState({ isOpen: false, daycareId: null, daycareName: '' })}
                onSuccess={() => {
                    fetchDaycares();
                    showNotification('success', 'Daycare care options updated successfully.');
                }}
            />

            {/* General Confirmation Dialog (for restore, suspend, activate, bulk) */}
            <ConfirmationDialog 
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmStyle={confirmDialog.confirmStyle}
                confirmText={confirmDialog.confirmText}
                onConfirm={confirmDialog.action}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
