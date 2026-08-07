import React, { useState, useEffect } from 'react';
import api from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { 
    LayoutDashboard, Users, Building2, CreditCard, 
    Plus, Edit2, CheckCircle2, ShieldCheck,
    LogOut, UserCircle, XCircle, TrendingUp
} from 'lucide-react';

export default function SuperAdminDashboard() {
    const { logout, user } = useAuth();
    const [activeTab, setActiveTab] = useState<'daycares' | 'users' | 'plans' | 'subscriptions'>('daycares');
    
    const [daycares, setDaycares] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [subscriptions, setSubscriptions] = useState<any[]>([]);

    const [isDaycareModalOpen, setIsDaycareModalOpen] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);

    const [formData, setFormData] = useState<any>({});

    const fetchData = () => {
        api.get('/admin/daycares/').then(res => setDaycares(res.data)).catch(console.error);
        api.get('/admin/users/').then(res => setUsers(res.data)).catch(console.error);
        api.get('/admin/subscriptions/plans/').then(res => setPlans(res.data)).catch(console.error);
        api.get('/admin/subscriptions/assigned/').then(res => setSubscriptions(res.data)).catch(console.error);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleCreateDaycare = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await api.patch(`/admin/daycares/${formData.id}/`, formData);
            } else {
                await api.post('/admin/daycares/', formData);
            }
            setIsDaycareModalOpen(false);
            setFormData({});
            fetchData();
        } catch (error) {
            console.error('Failed to save daycare', error);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = { ...formData };
            if (payload.is_superuser) {
                payload.daycare = null;
            } else {
                payload.is_staff = true;
            }

            if (formData.id) {
                await api.patch(`/admin/users/${formData.id}/`, payload);
            } else {
                await api.post('/admin/users/', payload);
            }
            setIsUserModalOpen(false);
            setFormData({});
            fetchData();
        } catch (error) {
            console.error('Failed to save user', error);
        }
    };

    const handleCreatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await api.patch(`/admin/subscriptions/plans/${formData.id}/`, formData);
            } else {
                await api.post('/admin/subscriptions/plans/', formData);
            }
            setIsPlanModalOpen(false);
            setFormData({});
            fetchData();
        } catch (error) {
            console.error('Failed to save plan', error);
        }
    };

    const handleCreateSub = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await api.patch(`/admin/subscriptions/assigned/${formData.id}/`, formData);
            } else {
                await api.post('/admin/subscriptions/assigned/', formData);
            }
            setIsSubModalOpen(false);
            setFormData({});
            fetchData();
        } catch (error) {
            console.error('Failed to save sub', error);
        }
    };

    const navItems = [
        { id: 'daycares', label: 'Daycares', icon: Building2 },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'plans', label: 'Plans', icon: LayoutDashboard },
        { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar Navigation */}
            <aside className="w-64 bg-slate-900 text-white flex-col hidden md:flex">
                <div className="h-16 flex items-center px-6 border-b border-slate-800">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-xl mr-3">K</div>
                    <span className="font-bold text-lg tracking-tight text-white">KidSynq Admin</span>
                </div>
                
                <nav className="flex-1 px-4 py-6 space-y-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Management</div>
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                                activeTab === item.id 
                                ? 'bg-indigo-600 text-white shadow-md' 
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                        >
                            <item.icon className={`w-5 h-5 mr-3 ${activeTab === item.id ? 'text-indigo-200' : 'text-slate-400'}`} />
                            <span className="font-medium text-sm">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className="flex items-center gap-3 px-2 py-3 bg-slate-800/50 rounded-lg mb-2">
                        <UserCircle className="w-8 h-8 text-indigo-400" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user?.first_name}</p>
                            <p className="text-xs text-slate-400 truncate">Platform Admin</p>
                        </div>
                    </div>
                    <button 
                        onClick={logout}
                        className="w-full flex items-center px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-10">
                    <h1 className="text-xl font-bold text-gray-800 capitalize">{activeTab}</h1>
                    <div className="flex items-center gap-4">
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold uppercase rounded-full tracking-wider flex items-center">
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            System Online
                        </span>
                    </div>
                </header>

                {/* Dashboard Area */}
                <div className="flex-1 overflow-auto p-8 relative">
                    {/* Top Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                        {[
                            { label: 'Monthly Revenue', value: (() => {
                                let mrr = 0;
                                subscriptions.forEach(sub => {
                                    if (sub.subscription_status === 'Active') {
                                        const plan = plans.find(p => p.id === sub.subscription_plan);
                                        if (plan && plan.price) {
                                            mrr += parseFloat(plan.price);
                                        }
                                    }
                                });
                                return mrr.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
                            })(), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100' },
                            { label: 'Total Daycares', value: daycares.length, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-100' },
                            { label: 'Platform Users', value: users.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-100' },
                            { label: 'Active Subs', value: subscriptions.filter(s => s.subscription_status==='Active').length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
                            { label: 'Available Plans', value: plans.length, icon: LayoutDashboard, color: 'text-purple-600', bg: 'bg-purple-100' }
                        ].map((stat, i) => (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                key={i} 
                                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4"
                            >
                                <div className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Main Table Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        
                        {/* Daycares Tab */}
                        {activeTab === 'daycares' && (
                            <div>
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h3 className="text-lg font-semibold text-gray-800">Manage Daycares</h3>
                                    <button onClick={() => { setFormData({}); setIsDaycareModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm flex items-center">
                                        <Plus className="w-4 h-4 mr-1" /> Add Daycare
                                    </button>
                                </div>
                                <ul className="divide-y divide-gray-100">
                                    {daycares.map((daycare) => (
                                        <li key={daycare.id} className="hover:bg-gray-50 transition-colors">
                                            <div className="px-6 py-4 flex justify-between items-center">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">{daycare.name}</p>
                                                    <p className="text-sm text-gray-500 mt-1">{daycare.email} • {daycare.phone}</p>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${daycare.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                        {daycare.status}
                                                    </span>
                                                    <button onClick={() => { setFormData(daycare); setIsDaycareModalOpen(true); }} className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                    {daycares.length === 0 && <li className="px-6 py-8 text-center text-gray-500">No daycares found.</li>}
                                </ul>
                            </div>
                        )}

                        {/* Users Tab */}
                        {activeTab === 'users' && (
                            <div>
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h3 className="text-lg font-semibold text-gray-800">Manage Users</h3>
                                    <button onClick={() => { setFormData({}); setIsUserModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm flex items-center">
                                        <Plus className="w-4 h-4 mr-1" /> Add User
                                    </button>
                                </div>
                                <ul className="divide-y divide-gray-100">
                                    {users.map((u) => (
                                        <li key={u.id} className="hover:bg-gray-50 transition-colors">
                                            <div className="px-6 py-4 flex justify-between items-center">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                                                        {u.first_name?.[0]}{u.last_name?.[0]}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900">{u.first_name} {u.last_name} <span className="font-normal text-gray-500">({u.username})</span></p>
                                                        <p className="text-xs text-gray-500 mt-1">{u.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    {u.is_superuser ? (
                                                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 flex items-center">
                                                            <ShieldCheck className="w-3 h-3 mr-1" /> Platform Admin
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                            Daycare: {daycares.find(d => d.id === u.daycare)?.name || 'Unknown'}
                                                        </span>
                                                    )}
                                                    <button onClick={() => { setFormData(u); setIsUserModalOpen(true); }} className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Plans Tab */}
                        {activeTab === 'plans' && (
                            <div>
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h3 className="text-lg font-semibold text-gray-800">Subscription Plans</h3>
                                    <button onClick={() => { setFormData({}); setIsPlanModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm flex items-center">
                                        <Plus className="w-4 h-4 mr-1" /> Add Plan
                                    </button>
                                </div>
                                <ul className="divide-y divide-gray-100">
                                    {plans.map((p) => (
                                        <li key={p.id} className="hover:bg-gray-50 transition-colors">
                                            <div className="px-6 py-4 flex justify-between items-center">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 text-lg">{p.name}</p>
                                                    <p className="text-sm font-medium text-indigo-600">${p.price} <span className="text-gray-500 font-normal">/ month</span></p>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="text-xs text-gray-500 space-y-1 text-right mr-4">
                                                        <div><span className="font-semibold text-gray-700">{p.max_students}</span> Students</div>
                                                        <div><span className="font-semibold text-gray-700">{p.max_staff}</span> Staff</div>
                                                    </div>
                                                    <button onClick={() => { setFormData(p); setIsPlanModalOpen(true); }} className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Subscriptions Tab */}
                        {activeTab === 'subscriptions' && (
                            <div>
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h3 className="text-lg font-semibold text-gray-800">Assigned Subscriptions</h3>
                                    <button onClick={() => { setFormData({}); setIsSubModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm flex items-center">
                                        <Plus className="w-4 h-4 mr-1" /> Assign Sub
                                    </button>
                                </div>
                                <ul className="divide-y divide-gray-100">
                                    {subscriptions.map((s) => {
                                        const daycare = daycares.find(d => d.id === s.daycare);
                                        const plan = plans.find(p => p.id === s.subscription_plan);
                                        return (
                                            <li key={s.id} className="hover:bg-gray-50 transition-colors">
                                            <div className="px-6 py-4 flex justify-between items-center">
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900">{daycare?.name || 'Unknown Daycare'}</p>
                                                        <p className="text-sm text-gray-500">Plan: <span className="font-medium">{plan?.name || 'Unknown Plan'}</span></p>
                                                    </div>
                                                    <div className="flex items-center gap-6 text-sm text-gray-500">
                                                        <div className="text-right">
                                                            <div className="mb-1">
                                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${s.subscription_status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                    {s.subscription_status}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs">Expires: {s.expiry_date}</div>
                                                        </div>
                                                        <button onClick={() => { setFormData(s); setIsSubModalOpen(true); }} className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors">
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Reusable Modal Form Background */}
            <AnimatePresence>
                {(isDaycareModalOpen || isUserModalOpen || isPlanModalOpen || isSubModalOpen) && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="text-lg font-bold text-gray-900">
                                    {isDaycareModalOpen && (formData.id ? 'Edit Daycare' : 'Add Daycare')}
                                    {isUserModalOpen && (formData.id ? 'Edit User' : 'Add User')}
                                    {isPlanModalOpen && (formData.id ? 'Edit Plan' : 'Add Plan')}
                                    {isSubModalOpen && (formData.id ? 'Edit Subscription' : 'Assign Subscription')}
                                </h3>
                                <button 
                                    onClick={() => {
                                        setIsDaycareModalOpen(false);
                                        setIsUserModalOpen(false);
                                        setIsPlanModalOpen(false);
                                        setIsSubModalOpen(false);
                                    }} 
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <XCircle className="w-6 h-6" />
                                </button>
                            </div>
                            
                            <div className="p-6">
                                {/* Form contents... */}
                                {isDaycareModalOpen && (
                                    <form onSubmit={handleCreateDaycare} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Daycare Name</label>
                                            <input required type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                                            <input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                                            <input type="text" name="phone" value={formData.phone || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                                        </div>
                                        <div className="pt-2">
                                            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold shadow hover:bg-indigo-700 transition-colors">Save Daycare</button>
                                        </div>
                                    </form>
                                )}

                                {isUserModalOpen && (
                                    <form onSubmit={handleCreateUser} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
                                            <input required type="text" name="username" value={formData.username || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                                        </div>
                                        {!formData.id && (
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
                                                <input required type="password" name="password" onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1">First Name</label>
                                                <input required type="text" name="first_name" value={formData.first_name || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1">Last Name</label>
                                                <input required type="text" name="last_name" value={formData.last_name || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                                            </div>
                                        </div>
                                        
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" name="is_superuser" checked={formData.is_superuser || false} onChange={handleInputChange} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300" />
                                                <span className="text-sm font-semibold text-gray-800">Platform Admin (Superuser)</span>
                                            </label>
                                        </div>

                                        {!formData.is_superuser && (
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1">Assign to Daycare</label>
                                                <select required name="daycare" value={formData.daycare || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none">
                                                    <option value="">Select a Daycare</option>
                                                    {daycares.map(d => (
                                                        <option key={d.id} value={d.id}>{d.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <div className="pt-2">
                                            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold shadow hover:bg-indigo-700 transition-colors">Save User</button>
                                        </div>
                                    </form>
                                )}

                                {isPlanModalOpen && (
                                    <form onSubmit={handleCreatePlan} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Plan Name</label>
                                            <input required type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Monthly Price ($)</label>
                                            <input required type="number" step="0.01" name="price" value={formData.price || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1">Max Students</label>
                                                <input required type="number" name="max_students" value={formData.max_students || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1">Max Staff</label>
                                                <input required type="number" name="max_staff" value={formData.max_staff || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                                            </div>
                                        </div>
                                        <div className="pt-2">
                                            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold shadow hover:bg-indigo-700 transition-colors">Save Plan</button>
                                        </div>
                                    </form>
                                )}

                                {isSubModalOpen && (
                                    <form onSubmit={handleCreateSub} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Target Daycare</label>
                                            <select required name="daycare" value={formData.daycare || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none">
                                                <option value="">Select a Daycare</option>
                                                {daycares.map(d => (
                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Subscription Plan</label>
                                            <select required name="subscription_plan" value={formData.subscription_plan || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none">
                                                <option value="">Select a Plan</option>
                                                {plans.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name} (${p.price}/mo)</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                                                <input required type="date" name="start_date" value={formData.start_date || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
                                                <input required type="date" name="expiry_date" value={formData.expiry_date || ''} onChange={handleInputChange} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                                            </div>
                                        </div>
                                        <div className="pt-2">
                                            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold shadow hover:bg-indigo-700 transition-colors">Assign Subscription</button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
