import { useState, useEffect } from 'react';
import { Search, Filter, Edit2, Trash2, Power, RotateCcw, Plus, ChevronLeft, ChevronRight, Copy, Check, ExternalLink, Globe } from 'lucide-react';
import api from '../api';
import DaycareFormModal from './DaycareFormModal';
import DaycareOnboardingWizard from './DaycareOnboardingWizard';
import ConfirmationDialog from './ConfirmationDialog';

export default function DaycareManagementTab() {
    const [daycares, setDaycares] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedDaycare, setSelectedDaycare] = useState<any>(null);

    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmStyle: 'primary' as any,
        action: () => {}
    });

    const fetchDaycares = () => {
        setLoading(true);
        let url = `/super-admin/daycares/?page=${page}`;
        if (search) url += `&search=${search}`;
        if (statusFilter) url += `&status=${statusFilter}`;
        
        api.get(url)
            .then(res => {
                if (res.data && res.data.results !== undefined) {
                    setDaycares(res.data.results);
                    setTotalPages(Math.ceil(res.data.count / 10));
                } else {
                    setDaycares(res.data || []);
                    setTotalPages(1);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchDaycares();
        }, 300);
        return () => clearTimeout(timer);
    }, [page, search, statusFilter]);

    const handleAction = (daycareId: string, actionType: string) => {
        if (actionType === 'delete') {
            api.delete(`/super-admin/daycares/${daycareId}/`).then(fetchDaycares).catch(console.error);
        } else {
            api.post(`/super-admin/daycares/${daycareId}/${actionType}/`).then(fetchDaycares).catch(console.error);
        }
    };

    const confirmAction = (daycare: any, actionType: 'suspend' | 'activate' | 'delete' | 'restore') => {
        let title = '';
        let message = '';
        let style = 'primary';
        
        if (actionType === 'suspend') {
            title = 'Suspend Daycare';
            message = `Are you sure you want to suspend ${daycare.name}? They will lose access to the platform.`;
            style = 'warning';
        } else if (actionType === 'activate') {
            title = 'Activate Daycare';
            message = `Are you sure you want to activate ${daycare.name}?`;
            style = 'primary';
        } else if (actionType === 'delete') {
            title = 'Soft Delete Daycare';
            message = `Are you sure you want to delete ${daycare.name}? This will hide the daycare but preserve their data.`;
            style = 'danger';
        } else if (actionType === 'restore') {
            title = 'Restore Daycare';
            message = `Are you sure you want to restore ${daycare.name}?`;
            style = 'primary';
        }

        setConfirmDialog({
            isOpen: true,
            title,
            message,
            confirmStyle: style,
            action: () => {
                handleAction(daycare.id, actionType);
                setConfirmDialog({ ...confirmDialog, isOpen: false });
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

    return (
        <div className="space-y-6 p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Daycare Management</h2>
                    <p className="text-sm text-gray-500">Manage all registered daycares, public registration links, and operational status.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsWizardOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Onboard Daycare
                    </button>
                    <button 
                        onClick={() => { setSelectedDaycare(null); setIsFormOpen(true); }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg shadow-sm transition-all"
                    >
                        <Plus className="w-4 h-4 text-indigo-600" />
                        Quick Add
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                {/* Filters */}
                <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="w-full md:w-80 relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search by name, email or city..." 
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                    </div>
                    <div className="w-full md:w-48 relative">
                        <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select 
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm appearance-none bg-white"
                        >
                            <option value="">All Statuses</option>
                            <option value="Active">Active</option>
                            <option value="Suspended">Suspended</option>
                            <option value="Deleted">Deleted</option>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading daycares...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white border-b border-gray-200">
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Daycare</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Registration URL</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {daycares.map((daycare) => {
                                    const regPath = `/register/${daycare.id}`;
                                    const fullRegUrl = `${window.location.origin}${regPath}`;
                                    const isCopied = copiedId === daycare.id;

                                    return (
                                        <tr key={daycare.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 text-indigo-600 font-bold">
                                                        {daycare.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{daycare.name}</p>
                                                        <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {daycare.id}</p>
                                                        <p className="text-xs text-gray-500">{daycare.city || 'No city'}, {daycare.country || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 max-w-xs">
                                                    <div className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 group hover:border-indigo-300 transition-colors">
                                                        <span className="text-xs text-indigo-700 font-mono truncate font-medium" title={fullRegUrl}>
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
                                                                title="Open Public Registration Page in New Tab"
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-gray-900">{daycare.email || 'No email'}</p>
                                                <p className="text-xs text-gray-500">{daycare.phone || 'No phone'}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                    ${daycare.status === 'Active' ? 'bg-green-100 text-green-800' : 
                                                      daycare.status === 'Suspended' ? 'bg-orange-100 text-orange-800' : 
                                                      'bg-red-100 text-red-800'}`}>
                                                    {daycare.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <a
                                                        href={regPath}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded transition-colors"
                                                        title="Open Registration Page"
                                                    >
                                                        <Globe className="w-4 h-4" />
                                                    </a>

                                                    {daycare.status !== 'Deleted' && (
                                                        <button onClick={() => { setSelectedDaycare(daycare); setIsFormOpen(true); }} className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded transition-colors" title="Edit">
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    
                                                    {daycare.status === 'Active' && (
                                                        <button onClick={() => confirmAction(daycare, 'suspend')} className="text-slate-400 hover:text-orange-600 p-1.5 hover:bg-orange-50 rounded transition-colors" title="Suspend">
                                                            <Power className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    
                                                    {['Suspended', 'Inactive'].includes(daycare.status) && (
                                                        <button onClick={() => confirmAction(daycare, 'activate')} className="text-slate-400 hover:text-green-600 p-1.5 hover:bg-green-50 rounded transition-colors" title="Activate">
                                                            <Power className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    
                                                    {daycare.status === 'Deleted' ? (
                                                        <button onClick={() => confirmAction(daycare, 'restore')} className="text-slate-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded transition-colors" title="Restore">
                                                            <RotateCcw className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => confirmAction(daycare, 'delete')} className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition-colors" title="Soft Delete">
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
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                            No daycares found matching your criteria.
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
                        <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setPage(Math.max(1, page - 1))} 
                                disabled={page === 1}
                                className="p-2 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => setPage(Math.min(totalPages, page + 1))} 
                                disabled={page === totalPages}
                                className="p-2 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <DaycareFormModal 
                isOpen={isFormOpen} 
                daycare={selectedDaycare} 
                onClose={() => setIsFormOpen(false)} 
                onSuccess={() => { setIsFormOpen(false); fetchDaycares(); }} 
            />
            
            <DaycareOnboardingWizard 
                isOpen={isWizardOpen} 
                onClose={() => setIsWizardOpen(false)} 
                onSuccess={() => { setIsWizardOpen(false); fetchDaycares(); }} 
            />

            <ConfirmationDialog 
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmStyle={confirmDialog.confirmStyle}
                onConfirm={confirmDialog.action}
                onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
            />
        </div>
    );
}
