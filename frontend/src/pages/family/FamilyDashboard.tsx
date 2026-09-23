import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api, { BACKEND_URL } from '../../api';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Baby, CheckCircle2, Clock, AlertCircle, MessageSquare,
    FileText, CreditCard, Megaphone, ChevronRight, XCircle,
    Calendar, Sun, Shield, LogIn, LogOut, Sparkles
} from 'lucide-react';

interface SafeArrivalChild {
    child_id: string;
    child_name: string;
    preferred_name: string | null;
    photo: string | null;
    status: 'NOT_ARRIVED' | 'CHECKED_IN' | 'CURRENTLY_PRESENT' | 'CHECKED_OUT';
    status_display: string;
    check_in_time: string | null;
    check_out_time: string | null;
    expected_pickup_time: string | null;
    pickup_person_name: string | null;
    is_late_pickup: boolean;
    departure_type?: string | null;
    arrival_type?: string | null;
}

interface Announcement {
    id: string;
    title: string;
    type: string | null;
    published_at: string;
}

interface DashboardData {
    children: any[];
    unread_messages: number;
    pending_consents: number;
    outstanding_amount_due: number;
    recent_announcements: Announcement[];
    family_name: string;
}

const safeArrivalBadgeConfig: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    'CURRENTLY_PRESENT': {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />
    },
    'CHECKED_IN': {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: <LogIn className="w-4 h-4 text-emerald-600" />
    },
    'CHECKED_OUT': {
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        border: 'border-indigo-200',
        icon: <LogOut className="w-4 h-4 text-indigo-600" />
    },
    'NOT_ARRIVED': {
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
        icon: <Clock className="w-4 h-4 text-slate-400" />
    },
};

const announcementTypeColors: Record<string, string> = {
    'General': 'bg-blue-100 text-blue-700',
    'Event': 'bg-violet-100 text-violet-700',
    'Urgent': 'bg-red-100 text-red-700',
    'Policy': 'bg-amber-100 text-amber-700',
};

const FamilyDashboard: React.FC = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [safeArrivalChildren, setSafeArrivalChildren] = useState<SafeArrivalChild[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [dashRes, safeRes] = await Promise.all([
                    api.get('/family/dashboard/'),
                    api.get('/family/safe-arrival/status/').catch(() => ({ data: { children: [] } }))
                ]);
                setData(dashRes.data);
                if (safeRes?.data?.children) {
                    setSafeArrivalChildren(safeRes.data.children);
                }
            } catch (e) {
                console.error("Failed loading family dashboard", e);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const today = new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const getPhotoUrl = (url: string | null) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </Layout>
        );
    }

    const stats = [
        {
            label: 'Unread Messages',
            value: data?.unread_messages ?? 0,
            icon: <MessageSquare className="w-5 h-5" />,
            color: 'from-indigo-500 to-indigo-600',
            href: '/family/messages',
            urgent: (data?.unread_messages ?? 0) > 0,
        },
        {
            label: 'Pending Consents',
            value: data?.pending_consents ?? 0,
            icon: <FileText className="w-5 h-5" />,
            color: 'from-amber-500 to-orange-500',
            href: '/family/consent-forms',
            urgent: (data?.pending_consents ?? 0) > 0,
        },
        {
            label: 'Outstanding Balance',
            value: `$${(data?.outstanding_amount_due ?? 0).toFixed(2)}`,
            icon: <CreditCard className="w-5 h-5" />,
            color: 'from-rose-500 to-pink-600',
            href: '/family/billing',
            urgent: (data?.outstanding_amount_due ?? 0) > 0,
        },
    ];

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                            <Sun className="w-4 h-4 text-amber-500" />
                            <span>{today}</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            Welcome back, <span className="text-indigo-600">{data?.family_name || 'Family'}</span>
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5">Here's a snapshot of your children's safe arrival & daily care.</p>
                    </div>
                </motion.div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {stats.map((stat, i) => (
                        <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                            <Link to={stat.href} className={`block rounded-2xl p-4 bg-gradient-to-br ${stat.color} text-white shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5`}>
                                <div className="flex items-center justify-between">
                                    <div className="bg-white/20 rounded-xl p-2">{stat.icon}</div>
                                    {stat.urgent && stat.value !== 0 && stat.value !== '$0.00' && (
                                        <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full">Action needed</span>
                                    )}
                                </div>
                                <div className="mt-3">
                                    <div className="text-2xl font-bold">{stat.value}</div>
                                    <div className="text-white/80 text-sm">{stat.label}</div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {/* Real-time Safe Arrival & Departure Status Cards */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-indigo-600" /> Real-Time Safe Arrival & Departure
                        </h2>
                        <Link to="/family/children" className="text-xs text-indigo-600 hover:underline font-medium flex items-center gap-1">
                            Manage Pickups <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>

                    {safeArrivalChildren.length === 0 ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
                            No children found for your family. Contact your daycare administrator for assistance.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {safeArrivalChildren.map((child, i) => {
                                const badge = safeArrivalBadgeConfig[child.status] || safeArrivalBadgeConfig['NOT_ARRIVED'];

                                return (
                                    <motion.div 
                                        key={child.child_id} 
                                        initial={{ opacity: 0, scale: 0.97 }} 
                                        animate={{ opacity: 1, scale: 1 }} 
                                        transition={{ delay: 0.1 + i * 0.07 }}
                                        className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <div className="flex items-center gap-3">
                                                    {getPhotoUrl(child.photo) ? (
                                                        <img src={getPhotoUrl(child.photo)} alt={child.child_name} className="w-12 h-12 rounded-2xl object-cover border-2 border-indigo-100" />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                                            {child.child_name.charAt(0)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-base">{child.preferred_name || child.child_name}</p>
                                                        {child.preferred_name && <p className="text-xs text-slate-400">{child.child_name}</p>}
                                                    </div>
                                                </div>

                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${badge.bg} ${badge.text} ${badge.border}`}>
                                                    {badge.icon} {child.status_display}
                                                </div>
                                            </div>

                                            {/* Timestamps & Info */}
                                            <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/80 rounded-xl p-3 border border-slate-100">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-400">Arrival Check-In:</span>
                                                    <span className="font-medium text-slate-800">
                                                        {child.check_in_time ? `${child.check_in_time}` : 'Not checked in'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-400">Departure Check-Out:</span>
                                                    <span className="font-medium text-slate-800">
                                                        {child.check_out_time ? `${child.check_out_time}` : 'Present in care'}
                                                    </span>
                                                </div>
                                                {child.expected_pickup_time && (
                                                    <div className="flex items-center justify-between border-t border-slate-200/50 pt-1.5">
                                                        <span className="text-slate-400">Expected Pickup:</span>
                                                        <span className="font-semibold text-indigo-700">{child.expected_pickup_time}</span>
                                                    </div>
                                                )}
                                                {child.pickup_person_name && (
                                                    <div className="flex items-center justify-between border-t border-slate-200/50 pt-1.5">
                                                        <span className="text-slate-400">Picked Up By:</span>
                                                        <span className="font-semibold text-slate-800 truncate max-w-[150px]">{child.pickup_person_name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                                            <Link 
                                                to={`/family/children`}
                                                className="flex-1 text-center text-xs py-2 rounded-xl font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                                            >
                                                Authorized Pickups
                                            </Link>
                                            <Link 
                                                to={`/family/attendance?child=${child.child_id}`}
                                                className="flex-1 text-center text-xs py-2 rounded-xl font-semibold bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
                                            >
                                                <Calendar className="w-3.5 h-3.5 inline mr-1" /> Attendance
                                            </Link>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Recent Announcements */}
                {data?.recent_announcements && data.recent_announcements.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-semibold text-slate-700 flex items-center gap-2">
                                <Megaphone className="w-4 h-4 text-violet-500" /> Recent Announcements
                            </h2>
                            <Link to="/family/announcements" className="text-xs text-indigo-600 hover:underline font-medium flex items-center gap-1">
                                See all <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {data.recent_announcements.map((ann, i) => (
                                <motion.div key={ann.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
                                    className="bg-white border border-slate-100 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${announcementTypeColors[ann.type || 'General'] || announcementTypeColors['General']}`}>
                                            {ann.type || 'General'}
                                        </span>
                                        <p className="text-sm font-medium text-slate-700">{ann.title}</p>
                                    </div>
                                    <span className="text-xs text-slate-400 shrink-0 ml-4">
                                        {new Date(ann.published_at).toLocaleDateString('en-CA')}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default FamilyDashboard;
