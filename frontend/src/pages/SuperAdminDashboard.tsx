import React, { useState, useEffect } from 'react';
import api from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { 
    LayoutDashboard, Users, Building2, CreditCard, 
    Plus, Edit2, CheckCircle2, ShieldCheck,
    LogOut, UserCircle, XCircle, TrendingUp, Shield,
    FileText, MessageSquare, FileSpreadsheet, AlertCircle, Loader2
} from 'lucide-react';
import DaycareOnboardingModal from '../components/DaycareOnboardingModal';
import DaycareManagementTab from '../components/DaycareManagementTab';
import DaycareAdminManagementTab from '../components/DaycareAdminManagementTab';
import PlanManagementTab from '../components/PlanManagementTab';
import SubscriptionManagementTab from '../components/SubscriptionManagementTab';
import PaymentHistoryTab from '../components/PaymentHistoryTab';
import InvoiceListTab from '../components/InvoiceListTab';
import SaaSAnalyticsTab from '../components/SaaSAnalyticsTab';
import AuditLogTab from '../components/AuditLogTab';
import SystemAnnouncementTab from '../components/SystemAnnouncementTab';
import SupportTicketTab from '../components/SupportTicketTab';
import RatioRulesManagementTab from '../components/RatioRulesManagementTab';
import { Scale } from 'lucide-react';

import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend
);


class ErrorBoundary extends React.Component<any, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-500 font-mono whitespace-pre-wrap bg-red-50 border border-red-200 rounded">
          <h2>Something went wrong.</h2>
          <p>{this.state.error?.toString()}</p>
          <p>{this.state.error?.stack}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SuperAdminDashboard() {
    const { logout, user } = useAuth();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'daycares' | 'daycare-admins' | 'users' | 'plans' | 'subscriptions' | 'logs' | 'tickets' | 'invoices' | 'payments' | 'announcements' | 'ratio-rules'>('dashboard');
    
    const [daycares, setDaycares] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
    const [dashboardError, setDashboardError] = useState<string | null>(null);

    const [isDaycareModalOpen, setIsDaycareModalOpen] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);

    const [formData, setFormData] = useState<any>({});

    const fetchData = () => {
        api.get('/super-admin/daycares/').then(res => {
            setDaycares(res.data.results || res.data || []);
        }).catch(console.error);
        api.get('/super-admin/users/').then(res => setUsers(res.data.results || res.data || [])).catch(console.error);
        api.get('/super-admin/subscription-plans/').then(res => setPlans(res.data.results || res.data || [])).catch(console.error);
        api.get('/super-admin/subscriptions/assigned/').then(res => setSubscriptions(res.data.results || res.data || [])).catch(console.error);
        setIsLoadingDashboard(true);
        api.get('/super-admin/dashboard/')
           .then(res => { setDashboardData(res.data); setDashboardError(null); })
           .catch(() => setDashboardError('Failed to load dashboard data.'))
           .finally(() => setIsLoadingDashboard(false));
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
                await api.patch(`/super-admin/daycares/${formData.id}/`, formData);
            } else {
                await api.post('/super-admin/daycares/', formData);
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
                await api.patch(`/super-admin/users/${formData.id}/`, payload);
            } else {
                await api.post('/super-admin/users/', payload);
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
                await api.patch(`/super-admin/subscription-plans/${formData.id}/`, formData);
            } else {
                await api.post('/super-admin/subscription-plans/', formData);
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
                await api.patch(`/super-admin/subscriptions/assigned/${formData.id}/`, formData);
            } else {
                await api.post('/super-admin/subscriptions/assigned/', formData);
            }
            setIsSubModalOpen(false);
            setFormData({});
            fetchData();
        } catch (error) {
            console.error('Failed to save sub', error);
        }
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'analytics', label: 'Analytics', icon: TrendingUp },
        { id: 'daycares', label: 'Daycares', icon: Building2 },
        { id: 'daycare-admins', label: 'Daycare Admins', icon: Shield },
        { id: 'users', label: 'Platform Users', icon: Users },
        { id: 'plans', label: 'Plans', icon: LayoutDashboard },
        { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
        { id: 'ratio-rules', label: 'Provincial Ratio Rules', icon: Scale },
        { id: 'invoices', label: 'Invoices', icon: FileSpreadsheet },
        { id: 'tickets', label: 'Support Tickets', icon: MessageSquare },
        { id: 'announcements', label: 'Announcements', icon: FileText },
        { id: 'logs', label: 'Audit Logs', icon: FileText },
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
                    {activeTab === 'dashboard' && (
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                        {[
                            { label: 'Monthly Revenue', value: (() => {
                                let mrr = 0;
                                (subscriptions || []).forEach(sub => {
                                    if (sub.subscription_status?.toLowerCase() === 'active') {
                                        const planId = typeof sub.subscription_plan === 'object' ? sub.subscription_plan?.id : sub.subscription_plan;
                                        const plan = plans.find(p => p.id === planId);
                                        if (plan && (plan.monthly_price || plan.price)) {
                                            mrr += parseFloat(plan.monthly_price || plan.price);
                                        }
                                    }
                                });
                                return mrr.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
                            })(), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100' },
                            { label: 'Total Daycares', value: daycares.length, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-100' },
                            { label: 'Platform Users', value: users.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-100' },
                            { label: 'Active Subs', value: (subscriptions || []).filter(s => s.subscription_status?.toLowerCase() === 'active').length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
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
                    )}

                    {/* Standalone Tabs */}
                    {activeTab === 'plans' && <PlanManagementTab />}
                    {activeTab === 'subscriptions' && <SubscriptionManagementTab />}
                    {activeTab === 'invoices' && <InvoiceListTab />}
                    {activeTab === 'payments' && <PaymentHistoryTab />}
                    {activeTab === 'analytics' && <SaaSAnalyticsTab />}
                    {activeTab === 'ratio-rules' && <ErrorBoundary><RatioRulesManagementTab /></ErrorBoundary>}

                    {/* Main Table Card (For older tabs) */}
                    {['daycares', 'daycare-admins', 'users', 'dashboard', 'logs', 'tickets', 'announcements'].includes(activeTab) && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            
                            {/* Daycares Tab */}
                        {activeTab === 'daycares' && <DaycareManagementTab />}

                        {/* Daycare Admins Tab */}
                        {activeTab === 'daycare-admins' && <DaycareAdminManagementTab />}

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
                                    {users.filter((u: any) => u.is_superuser).map((u) => (
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


                        {/* Dashboard Tab */}
                        {activeTab === 'dashboard' && (
                            <div className="p-8">
                                <h3 className="text-xl font-bold text-gray-900 mb-6">Super Admin Dashboard</h3>
                                
                                {isLoadingDashboard ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
                                        <p className="text-gray-500">Loading metrics...</p>
                                    </div>
                                ) : dashboardError ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-red-500">
                                        <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                                        <p>{dashboardError}</p>
                                    </div>
                                ) : !dashboardData ? (
                                    <div className="text-center py-20 text-gray-500">No data available</div>
                                ) : (
                                    <div className="space-y-8">
                                        {/* Metrics Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                                <p className="text-sm font-semibold text-gray-500 mb-1">Total Daycares</p>
                                                <p className="text-3xl font-bold text-gray-900">{dashboardData.metrics.total_daycares}</p>
                                                <div className="mt-2 flex gap-2 text-xs">
                                                    <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded">{dashboardData.metrics.active_daycares} Active</span>
                                                    <span className="text-orange-600 bg-orange-50 px-2 py-0.5 rounded">{dashboardData.metrics.suspended_daycares} Suspended</span>
                                                </div>
                                            </div>
                                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                                <p className="text-sm font-semibold text-gray-500 mb-1">Total Revenue</p>
                                                <p className="text-3xl font-bold text-gray-900">${dashboardData.metrics.monthly_revenue.toFixed(2)}</p>
                                            </div>
                                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                                <p className="text-sm font-semibold text-gray-500 mb-1">Active Subscriptions</p>
                                                <p className="text-3xl font-bold text-gray-900">{dashboardData.metrics.active_subscriptions}</p>
                                                <div className="mt-2 flex gap-2 text-xs">
                                                    <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{dashboardData.metrics.trial_daycares} Trials</span>
                                                </div>
                                            </div>
                                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                                <p className="text-sm font-semibold text-gray-500 mb-1">Total Students</p>
                                                <p className="text-3xl font-bold text-gray-900">{dashboardData.metrics.total_students}</p>
                                                <div className="mt-2 flex gap-2 text-xs text-gray-500">
                                                    Across {dashboardData.metrics.total_classrooms} Classrooms
                                                </div>
                                            </div>
                                        </div>

                                        {/* Charts Grid */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                                <h4 className="text-sm font-bold text-gray-700 mb-4">Daycare Growth</h4>
                                                <div className="h-64">
                                                    <Line 
                                                        data={{
                                                            labels: dashboardData.charts.daycare_growth.map((d: any) => d.month),
                                                            datasets: [{
                                                                label: 'New Daycares',
                                                                data: dashboardData.charts.daycare_growth.map((d: any) => d.count),
                                                                borderColor: 'rgb(79, 70, 229)',
                                                                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                                                                fill: true,
                                                                tension: 0.4
                                                            }]
                                                        }}
                                                        options={{ responsive: true, maintainAspectRatio: false }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                                <h4 className="text-sm font-bold text-gray-700 mb-4">Revenue History</h4>
                                                <div className="h-64">
                                                    <Bar 
                                                        data={{
                                                            labels: dashboardData.charts.revenue_history.map((d: any) => d.month),
                                                            datasets: [{
                                                                label: 'Revenue ($)',
                                                                data: dashboardData.charts.revenue_history.map((d: any) => d.total),
                                                                backgroundColor: 'rgb(34, 197, 94)',
                                                            }]
                                                        }}
                                                        options={{ responsive: true, maintainAspectRatio: false }}
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-2">
                                                <h4 className="text-sm font-bold text-gray-700 mb-4">Platform Overview</h4>
                                                <div className="grid grid-cols-3 gap-6 text-center">
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-gray-500 text-sm">Total Staff</p>
                                                        <p className="text-2xl font-bold text-gray-900">{dashboardData.metrics.total_staff}</p>
                                                    </div>
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-gray-500 text-sm">Pending Tickets</p>
                                                        <p className="text-2xl font-bold text-orange-600">{dashboardData.metrics.pending_tickets}</p>
                                                    </div>
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-gray-500 text-sm">Expired Subscriptions</p>
                                                        <p className="text-2xl font-bold text-red-600">{dashboardData.metrics.expired_subscriptions}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Logs Tab */}
                        {activeTab === 'logs' && <ErrorBoundary><AuditLogTab /></ErrorBoundary>}

                        {/* Announcements Tab */}
                        {activeTab === 'announcements' && <ErrorBoundary><SystemAnnouncementTab /></ErrorBoundary>}

                        {/* Tickets Tab */}
                        {activeTab === 'tickets' && <ErrorBoundary><SupportTicketTab /></ErrorBoundary>}

                    </div>
                )}
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

            {/* Onboarding Modal */}
            <DaycareOnboardingModal 
                isOpen={isOnboardingModalOpen}
                onClose={() => setIsOnboardingModalOpen(false)}
                onComplete={() => { setIsOnboardingModalOpen(false); fetchData(); }}
            />
        </div>
    );
}
