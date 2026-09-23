import { useState, useEffect } from 'react';
import { Search, Edit2, Power, Plus, Shield, Key } from 'lucide-react';
import api from '../api';
import DaycareAdminFormModal from './DaycareAdminFormModal';
import ConfirmationDialog from './ConfirmationDialog';

export default function DaycareAdminManagementTab() {
    const [admins, setAdmins] = useState<any[]>([]);
    const [daycares, setDaycares] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<any>(null);

    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmStyle: 'primary' as any,
        action: () => {}
    });

    const fetchAdmins = () => {
        setLoading(true);
        api.get(`/super-admin/daycare-admins/`)
            .then(res => setAdmins(res.data.results || res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    const fetchDaycares = () => {
        api.get('/super-admin/daycares/?page_size=1000') // fetch enough for the dropdown
            .then(res => setDaycares(res.data.results || res.data))
            .catch(console.error);
    };

    useEffect(() => {
        fetchAdmins();
        fetchDaycares();
    }, []);

    const filteredAdmins = admins.filter(admin => 
        admin.username.toLowerCase().includes(search.toLowerCase()) || 
        (admin.email && admin.email.toLowerCase().includes(search.toLowerCase())) ||
        (admin.first_name && admin.first_name.toLowerCase().includes(search.toLowerCase()))
    );

    const handleAction = (adminId: string, actionType: string, extraData?: any) => {
        api.post(`/super-admin/daycare-admins/${adminId}/${actionType}/`, extraData)
            .then(fetchAdmins)
            .catch(err => alert(err.response?.data?.error || 'Action failed'));
    };

    const confirmAction = (admin: any, actionType: 'suspend' | 'activate' | 'reset_password') => {
        if (actionType === 'reset_password') {
            const newPassword = prompt(`Enter new password for ${admin.username}:`);
            if (newPassword) {
                handleAction(admin.id, 'reset_password', { password: newPassword });
            }
            return;
        }

        const title = actionType === 'suspend' ? 'Suspend Admin' : 'Activate Admin';
        const message = actionType === 'suspend' 
            ? `Are you sure you want to suspend ${admin.username}? They will no longer be able to log in.`
            : `Are you sure you want to activate ${admin.username}?`;
        const style = actionType === 'suspend' ? 'warning' : 'primary';

        setConfirmDialog({
            isOpen: true,
            title,
            message,
            confirmStyle: style,
            action: () => {
                handleAction(admin.id, actionType);
                setConfirmDialog({ ...confirmDialog, isOpen: false });
            }
        });
    };

    const getDaycareName = (daycareId: string) => {
        const d = daycares.find(d => d.id === daycareId);
        return d ? d.name : 'Unknown Daycare';
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Manage Daycare Admins</h3>
                <button 
                    onClick={() => { setSelectedAdmin(null); setIsFormOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm"
                >
                    <Plus className="w-4 h-4" /> Add Admin
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <div className="relative max-w-md">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search by username, name or email..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading admins...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white border-b border-gray-200">
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin User</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned Daycare</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Daycare ID</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {filteredAdmins.map((admin) => (
                                    <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
                                                    <Shield className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{admin.username}</p>
                                                    <p className="text-xs text-gray-500">{admin.first_name} {admin.last_name}</p>
                                                    <p className="text-xs text-gray-400">{admin.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-md">
                                                {getDaycareName(admin.daycare)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                                                {admin.daycare}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                ${admin.status === 'Active' || admin.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {admin.status === 'Suspended' || !admin.is_active ? 'Suspended' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => confirmAction(admin, 'reset_password')} className="text-slate-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded transition-colors" title="Reset Password">
                                                    <Key className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => { setSelectedAdmin(admin); setIsFormOpen(true); }} className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded transition-colors" title="Edit">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                
                                                {(admin.status === 'Active' || admin.is_active) ? (
                                                    <button onClick={() => confirmAction(admin, 'suspend')} className="text-slate-400 hover:text-orange-600 p-1.5 hover:bg-orange-50 rounded transition-colors" title="Suspend">
                                                        <Power className="w-4 h-4" />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => confirmAction(admin, 'activate')} className="text-slate-400 hover:text-green-600 p-1.5 hover:bg-green-50 rounded transition-colors" title="Activate">
                                                        <Power className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredAdmins.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                            No daycare admins found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <DaycareAdminFormModal 
                isOpen={isFormOpen} 
                admin={selectedAdmin} 
                daycares={daycares}
                onClose={() => setIsFormOpen(false)} 
                onSuccess={() => { setIsFormOpen(false); fetchAdmins(); }} 
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
