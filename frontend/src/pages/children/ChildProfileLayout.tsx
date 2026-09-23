import React, { useEffect, useState } from 'react';
import { useParams, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api, { BACKEND_URL } from '../../api';
import { 
    ArrowLeft, Camera, User, Calendar, MapPin, 
    ShieldCheck, HeartPulse, Phone, FileText, Activity, Clock, Syringe, Sparkles, CreditCard,
    Globe, Hash
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export interface Child {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string;
    status: string;
    admission_number: string;
    dob: string;
    photo: string;
    gender: string;
    language: string;
    admission_date: string;
    joining_date: string;
    child_notes: string;
    administrative_notes: string;
}

const ChildProfileLayout: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAuthorized = user?.role === 'Daycare Admin' || user?.is_superuser;
    const [child, setChild] = useState<Child | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const getImageUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const fetchChild = async () => {
        try {
            const response = await api.get(`/daycare/children/${id}/`);
            setChild(response.data);
        } catch (error) {
            console.error("Failed to fetch child details", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChild();
    }, [id]);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('photo', file);

        try {
            await api.post(`/daycare/children/${id}/photo/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            await fetchChild();
        } catch (error) {
            console.error("Failed to upload photo", error);
            alert("Failed to upload photo");
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="py-16 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
                </div>
            </Layout>
        );
    }

    if (!child) {
        return (
            <Layout>
                <div className="py-16 text-center space-y-3">
                    <p className="text-rose-600 font-bold text-base">Child record not found.</p>
                    <button 
                        onClick={() => navigate('/daycare/children')} 
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm"
                    >
                        Return to Children List
                    </button>
                </div>
            </Layout>
        );
    }

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

    const tabs = [
        { name: 'Overview', href: `/daycare/children/${id}`, icon: User },
        { name: 'Attendance', href: `/daycare/children/${id}/attendance`, icon: Clock },
        { name: 'Billing & Invoices', href: `/daycare/billing/invoices?search=${encodeURIComponent(child.first_name || '')}`, icon: CreditCard },
        { name: 'Personal Info', href: `/daycare/children/${id}/personal`, icon: FileText },
        { name: 'Enrollment', href: `/daycare/children/${id}/enrollment`, icon: ShieldCheck },
        { name: 'Classroom', href: `/daycare/children/${id}/classroom`, icon: MapPin },
        { name: 'Medical', href: `/daycare/children/${id}/medical`, icon: HeartPulse },
        { name: 'Emergency', href: `/daycare/children/${id}/emergency`, icon: Phone },
        { name: 'Pickups', href: `/daycare/children/${id}/pickup-authorizations`, icon: ShieldCheck },
        { name: 'Pickup History', href: `/daycare/children/${id}/pickup-history`, icon: Clock },
        { name: 'Documents', href: `/daycare/children/${id}/documents`, icon: FileText },
        { name: 'Vaccinations', href: `/daycare/children/${id}/vaccinations`, icon: Syringe },
        { name: 'Notes', href: `/daycare/children/${id}/notes`, icon: Activity },
        { name: 'History', href: `/daycare/children/${id}/history`, icon: Clock },
    ];

    const initials = `${child.first_name?.[0] || ''}${child.last_name?.[0] || ''}`.toUpperCase();

    return (
        <Layout>
            <div className="space-y-6 max-w-7xl mx-auto">
                
                {/* Back Button */}
                <div>
                    <button 
                        onClick={() => navigate('/daycare/children')}
                        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-emerald-700 transition-colors bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Children Roster</span>
                    </button>
                </div>

                {/* Modern Ultra-Sleek Child Profile Header */}
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/80 p-6 sm:p-7 relative overflow-hidden shadow-xl shadow-slate-100/70">
                    {/* Ambient Glow Elements */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"></div>
                    <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-teal-400/10 rounded-full blur-2xl pointer-events-none"></div>

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
                            {/* Avatar with Ring & Status Beacon */}
                            <div className="relative shrink-0 group">
                                {child.photo ? (
                                    <img 
                                        src={getImageUrl(child.photo)} 
                                        alt={child.first_name} 
                                        className="h-20 w-20 sm:h-22 sm:w-22 rounded-2xl object-cover ring-4 ring-emerald-50 shadow-md transition-transform group-hover:scale-102 duration-300" 
                                    />
                                ) : (
                                    <div className="h-20 w-20 sm:h-22 sm:w-22 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 ring-4 ring-emerald-50 shadow-md flex items-center justify-center text-white font-black text-2xl tracking-wider transition-transform group-hover:scale-102 duration-300">
                                        {initials}
                                    </div>
                                )}

                                {/* Status Beacon Dot */}
                                {(child.status || '').toLowerCase() === 'active' && (
                                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 ring-2 ring-white"></span>
                                    </span>
                                )}

                                {isAuthorized && (
                                    <label 
                                        className="absolute -bottom-1.5 -right-1.5 bg-slate-900/90 hover:bg-slate-900 text-white p-2 rounded-xl cursor-pointer shadow-lg transition-all hover:scale-110 active:scale-95 border border-slate-700"
                                        title="Update Child Photo"
                                    >
                                        <Camera className="w-3.5 h-3.5" />
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept="image/*"
                                            onChange={handlePhotoUpload}
                                            disabled={uploading}
                                        />
                                    </label>
                                )}

                                {uploading && (
                                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs rounded-2xl flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                                    </div>
                                )}
                            </div>

                            {/* Name, Nickname & Badges */}
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                        {child.first_name} {child.last_name}
                                    </h1>
                                    {child.preferred_name && (
                                        <span className="px-2.5 py-0.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200/80 font-semibold text-xs shadow-xs">
                                            "{child.preferred_name}"
                                        </span>
                                    )}
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${
                                        (child.status || '').toLowerCase() === 'active' 
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/90' 
                                            : 'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                            (child.status || '').toLowerCase() === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                                        }`}></span>
                                        {child.status}
                                    </span>
                                </div>

                                {/* Metadata Pill Chips */}
                                <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-medium border border-slate-200/70">
                                        <Hash className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="font-mono font-bold text-slate-900">{child.admission_number || 'ADM-001'}</span>
                                    </div>
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-medium border border-slate-200/70">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{calculateAge(child.dob)}</span>
                                    </div>
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-medium border border-slate-200/70 capitalize">
                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{child.gender || 'Unspecified'}</span>
                                    </div>
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-medium border border-slate-200/70">
                                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{child.language || 'English'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Header Quick Actions */}
                        <div className="flex items-center gap-2.5 shrink-0 pt-2 lg:pt-0">
                            <Link
                                to={`/daycare/billing/invoices?search=${encodeURIComponent(child.first_name || '')}`}
                                className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold transition-all shadow-xs hover:shadow-sm flex items-center gap-1.5"
                            >
                                <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                                <span>Invoices & Billing</span>
                            </Link>
                            <Link
                                to={`/daycare/children/${id}/personal`}
                                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 hover:scale-102 active:scale-98"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                                <span>Edit Info</span>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Modern Pill Navigation Tabs (Clean, Grouped & 100% On-Screen) */}
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 p-2">
                    <nav className="flex flex-wrap items-center gap-1.5" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const isActive = location.pathname === tab.href || 
                                             (location.pathname === tab.href + '/') ||
                                             (tab.href.includes('pickup-authorizations') && location.pathname.includes('/pickup'));
                            const TabIcon = tab.icon;
                            return (
                                <Link
                                    key={tab.name}
                                    to={tab.href}
                                    className={`
                                        flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap
                                        ${isActive
                                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90'
                                        }
                                    `}
                                >
                                    <TabIcon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                    <span>{tab.name}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Sub-page Content */}
                <div className="pb-12">
                    <Outlet context={{ child, setChild, fetchChild, isAuthorized }} />
                </div>
            </div>
        </Layout>
    );
};

export default ChildProfileLayout;
