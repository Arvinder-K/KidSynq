import React, { useState } from 'react';
import { useNavigate, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BACKEND_URL, API_BASE_URL } from '../api';
import axios from 'axios';
import { 
    Lock, 
    User, 
    AlertCircle, 
    ArrowRight, 
    Eye, 
    EyeOff, 
    ShieldCheck, 
    Sparkles, 
    Building2, 
    HeartHandshake, 
    Cpu, 
    CheckCircle2, 
    Clock, 
    DollarSign, 
    HelpCircle,
    Star,
    Heart,
    GraduationCap,
    Calendar,
    Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export { BACKEND_URL };

interface LoginProps {
    type?: 'daycare' | 'staff' | 'admin' | 'family';
}

const Login: React.FC<LoginProps> = ({ type = 'daycare' }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [showDemoLogins, setShowDemoLogins] = useState(false);

    const { login, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Determine current active portal
    const currentType: 'daycare' | 'staff' | 'family' | 'admin' = type || (
        location.pathname.includes('/admin') 
            ? 'admin' 
            : location.pathname.includes('/staff') 
                ? 'staff' 
                : location.pathname.includes('/family') 
                    ? 'family' 
                    : 'daycare'
    );

    if (user) {
        if (user.is_superuser) {
            return <Navigate to="/admin" replace />;
        }
        if (user.role === 'Guardian') {
            return <Navigate to="/family/dashboard" replace />;
        }
        return <Navigate to="/dashboard" replace />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await axios.post(`${API_BASE_URL}token/`, {
                username,
                password,
            });
            const loggedInUser = await login(response.data.access, response.data.refresh);
            
            if (loggedInUser) {
                if (loggedInUser.is_superuser) {
                    navigate('/admin');
                } else if (loggedInUser.role === 'Guardian') {
                    navigate('/family/dashboard');
                } else {
                    navigate('/dashboard');
                }
            } else {
                setError('Failed to load user profile. Please try again.');
                setIsLoading(false);
            }
        } catch (err: any) {
            let errorMsg = 'Invalid username or password. Please verify your credentials.';
            if (err.response?.data?.detail) {
                errorMsg = err.response.data.detail;
            } else if (err.response?.data?.message) {
                errorMsg = err.response.data.message;
            } else if (!err.response) {
                errorMsg = `Connection failed (${err.message || 'Network Error'}). Unable to reach API server. Please ensure the backend is running.`;
            }
            setError(errorMsg);
            setIsLoading(false);
        }
    };

    const handleFillDemo = (demoUser: string, demoPass: string) => {
        setUsername(demoUser);
        setPassword(demoPass);
        setError('');
    };

    // Portal styling configuration for vibrant light theme
    const portalConfig = {
        daycare: {
            title: 'Daycare Management',
            badge: 'Admin & Director Portal',
            badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 ring-4 ring-teal-50',
            subtitle: 'Manage classrooms, real-time ratios, staff scheduling, and billing.',
            icon: Building2,
            iconBg: 'bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-teal-200',
            btnGradient: 'bg-gradient-to-r from-teal-600 via-cyan-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 shadow-teal-500/25',
            glowColor: 'bg-teal-200/40',
            accentLine: 'from-teal-400 via-cyan-500 to-indigo-500',
        },
        staff: {
            title: 'Staff & Educator Portal',
            badge: 'ECE Teachers & Staff',
            badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 ring-4 ring-sky-50',
            subtitle: 'Access your shift schedules, timesheets, daily activity logs, and classroom rosters.',
            icon: GraduationCap,
            iconBg: 'bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 text-white shadow-sky-200',
            btnGradient: 'bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 shadow-sky-500/25',
            glowColor: 'bg-sky-200/40',
            accentLine: 'from-sky-400 via-blue-500 to-indigo-500',
        },
        family: {
            title: 'Guardian & Family Portal',
            badge: 'Parents & Families',
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 ring-4 ring-rose-50',
            subtitle: "Stay connected with your child's daily photos, safe pickup passes, and invoices.",
            icon: HeartHandshake,
            iconBg: 'bg-gradient-to-br from-rose-500 via-pink-500 to-amber-500 text-white shadow-rose-200',
            btnGradient: 'bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 hover:from-rose-600 hover:to-purple-700 shadow-rose-500/25',
            glowColor: 'bg-rose-200/40',
            accentLine: 'from-rose-400 via-pink-500 to-amber-400',
        },
        admin: {
            title: 'Platform Super Admin',
            badge: 'System Control',
            badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 ring-4 ring-purple-50',
            subtitle: 'Multi-tenant daycare provisioning, subscription tiers, and global metrics.',
            icon: Cpu,
            iconBg: 'bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600 text-white shadow-purple-200',
            btnGradient: 'bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/25',
            glowColor: 'bg-purple-200/40',
            accentLine: 'from-purple-400 via-violet-500 to-indigo-500',
        },
    };

    const currentPortal = portalConfig[currentType];
    const PortalIcon = currentPortal.icon;

    return (
        <div className="min-h-screen w-full bg-[#f8fafc] text-slate-800 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-teal-500 selection:text-white">
            
            {/* Colorful Light Ambient Blobs & Gradient Mesh */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[15%] -left-[10%] w-[600px] h-[600px] rounded-full blur-[130px] bg-gradient-to-br from-teal-200/60 via-cyan-100/50 to-transparent" />
                <div className="absolute -top-[10%] -right-[5%] w-[550px] h-[550px] rounded-full blur-[140px] bg-gradient-to-br from-pink-200/60 via-rose-100/50 to-amber-100/40" />
                <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-[160px] ${currentPortal.glowColor} transition-all duration-700`} />
                <div className="absolute -bottom-[20%] -left-[5%] w-[650px] h-[650px] rounded-full blur-[140px] bg-gradient-to-tr from-indigo-200/50 via-purple-100/40 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
            </div>

            {/* Top Navigation Header */}
            <header className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-600 p-0.5 shadow-lg shadow-rose-200 flex items-center justify-center">
                        <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-indigo-600" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-extrabold tracking-tight font-display text-slate-900">
                                Kid<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-rose-500 to-amber-500">Synq</span>
                            </span>
                            <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-teal-500/10 to-indigo-500/10 text-indigo-700 border border-indigo-200/50 rounded-full">
                                Early Learning OS
                            </span>
                        </div>
                    </div>
                </div>

                {/* 4-Portal Role Switcher Pills */}
                <div className="flex items-center bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-full p-1 shadow-md shadow-slate-200/50 overflow-x-auto max-w-full">
                    <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                            currentType === 'daycare'
                                ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-500/25 scale-[1.02]'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                        }`}
                    >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Daycare Admin</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/staff/login')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                            currentType === 'staff'
                                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/25 scale-[1.02]'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                        }`}
                    >
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>Staff & Teachers</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/family/login')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                            currentType === 'family'
                                ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/25 scale-[1.02]'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                        }`}
                    >
                        <HeartHandshake className="w-3.5 h-3.5" />
                        <span>Parents</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/admin/login')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                            currentType === 'admin'
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 scale-[1.02]'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                        }`}
                    >
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Admin</span>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center flex-1">
                
                {/* Left Side: Rich Colorful Product Value Props */}
                <motion.div 
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="lg:col-span-6 xl:col-span-7 flex flex-col justify-center space-y-6 lg:pr-4"
                >
                    {/* Live System Badge */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-teal-200 text-xs font-bold text-teal-800 shadow-sm shadow-teal-100/60 self-start">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Staff Scheduling & Shift Management Active</span>
                        <span className="bg-sky-100 text-sky-800 text-[10px] px-1.5 py-0.5 rounded-full">Educator Ready</span>
                    </div>

                    {/* Headline */}
                    <div className="space-y-3">
                        <h1 className="text-3xl sm:text-4xl xl:text-5xl font-black tracking-tight text-slate-900 leading-[1.15] font-display">
                            Empowering Educators,{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-indigo-600 to-pink-500">
                                Simplifying Childcare.
                            </span>
                        </h1>
                        <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl font-medium">
                            Whether you are a daycare director, classroom teacher, or early childhood assistant, KidSynq keeps your shifts, student attendance, ratio compliance, and daily logs in perfect sync.
                        </p>
                    </div>

                    {/* 4 Colorful Feature Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        
                        {/* Card 1: Staff Shifts & Timesheets */}
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-50/80 to-blue-50/50 border border-sky-200/80 shadow-sm hover:shadow-md hover:border-sky-300 transition-all group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-200 group-hover:scale-105 transition-transform">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                                    Shifts & Swaps
                                </span>
                            </div>
                            <h2 className="text-sm font-bold text-slate-900">Educator Schedules</h2>
                            <p className="text-xs text-slate-600 mt-1 leading-snug">
                                View published work shifts, request peer shift swaps, and submit digital time-off requests.
                            </p>
                        </div>

                        {/* Card 2: Live Ratio & Classroom Compliance */}
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50/80 to-emerald-50/50 border border-teal-200/80 shadow-sm hover:shadow-md hover:border-teal-300 transition-all group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-200 group-hover:scale-105 transition-transform">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                                    Live Ratios
                                </span>
                            </div>
                            <h2 className="text-sm font-bold text-slate-900">Classroom Compliance</h2>
                            <p className="text-xs text-slate-600 mt-1 leading-snug">
                                Real-time provincial staff-to-child calculation with instant shortage notifications.
                            </p>
                        </div>

                        {/* Card 3: Daily Activity & Milestones */}
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/80 to-pink-50/50 border border-rose-200/80 shadow-sm hover:shadow-md hover:border-rose-300 transition-all group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center shadow-md shadow-rose-200 group-hover:scale-105 transition-transform">
                                    <Heart className="w-5 h-5" />
                                </div>
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                    Daily Logs
                                </span>
                            </div>
                            <h2 className="text-sm font-bold text-slate-900">Child Activities & Care</h2>
                            <p className="text-xs text-slate-600 mt-1 leading-snug">
                                Quick one-tap logging for meals, naps, bathroom visits, medications, and photos.
                            </p>
                        </div>

                        {/* Card 4: Credentials & Certifications */}
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/80 to-indigo-50/50 border border-purple-200/80 shadow-sm hover:shadow-md hover:border-purple-300 transition-all group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-200 group-hover:scale-105 transition-transform">
                                    <Award className="w-5 h-5" />
                                </div>
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                    ECE Credentials
                                </span>
                            </div>
                            <h2 className="text-sm font-bold text-slate-900">ECE Certifications</h2>
                            <p className="text-xs text-slate-600 mt-1 leading-snug">
                                Track First Aid/CPR, RECE registrations, background checks, and automated expiry alerts.
                            </p>
                        </div>
                    </div>

                    {/* Trust Chips */}
                    <div className="pt-2 flex flex-wrap items-center gap-5 text-xs font-semibold text-slate-600 border-t border-slate-200">
                        <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Staff Clock-in Geofencing</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                            <span>PIPEDA & Privacy Compliant</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            <span>99.9% Uptime Cloud</span>
                        </div>
                    </div>
                </motion.div>

                {/* Right Side: Form Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 30, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="lg:col-span-6 xl:col-span-5 w-full max-w-md mx-auto"
                >
                    <div className="relative rounded-3xl bg-white/95 border border-slate-200/90 shadow-2xl shadow-indigo-100/80 backdrop-blur-xl p-6 sm:p-8 overflow-hidden">
                        
                        {/* Top Vibrant Color Gradient Bar */}
                        <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${currentPortal.accentLine}`} />

                        {/* Header of Form */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${currentPortal.iconBg}`}>
                                    <PortalIcon className="w-6 h-6" />
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${currentPortal.badgeClass}`}>
                                    {currentPortal.badge}
                                </span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight font-display">
                                {currentPortal.title}
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                {currentPortal.subtitle}
                            </p>
                        </div>

                        {/* Error Alert */}
                        <AnimatePresence>
                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -10, height: 0 }}
                                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                                    exit={{ opacity: 0, y: -10, height: 0 }}
                                    className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 mb-5 flex items-start gap-3"
                                >
                                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                    <p className="text-xs text-rose-700 leading-relaxed font-semibold">{error}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Form */}
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            
                            {/* Username or Email */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700">
                                    {currentType === 'admin' 
                                        ? 'Platform Super Admin Username or Email' 
                                        : currentType === 'family' 
                                            ? 'Guardian Email or Username' 
                                            : currentType === 'staff' 
                                                ? 'Educator Username or Email' 
                                                : 'Daycare Admin Username or Email'}
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-sky-600 transition-colors">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        autoComplete="username"
                                        className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition-all shadow-xs"
                                        placeholder={
                                            currentType === 'admin' 
                                                ? "admin or superadmin" 
                                                : currentType === 'staff' 
                                                    ? "staff or teacher@daycare.com" 
                                                    : currentType === 'family'
                                                        ? "guardian or parent@example.com"
                                                        : "admin or director@daycare.com"
                                        }
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold text-slate-700">
                                        Password
                                    </label>
                                    {currentType === 'family' ? (
                                        <Link 
                                            to="/family/forgot-password" 
                                            className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors"
                                        >
                                            Forgot password?
                                        </Link>
                                    ) : (
                                        <span className="text-xs text-slate-400">
                                            Case sensitive
                                        </span>
                                    )}
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-sky-600 transition-colors">
                                        <Lock className="h-4 w-4" />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        autoComplete="current-password"
                                        className="block w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition-all shadow-xs"
                                        placeholder="••••••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                        tabIndex={-1}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Remember & Quick Demo Logins Toggle */}
                            <div className="flex items-center justify-between pt-1">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded bg-white border-slate-300 text-sky-600 focus:ring-sky-400 cursor-pointer"
                                    />
                                    <span className="text-xs font-medium text-slate-600">Remember me</span>
                                </label>

                                <button
                                    type="button"
                                    onClick={() => setShowDemoLogins(!showDemoLogins)}
                                    className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1 transition-colors"
                                >
                                    <HelpCircle className="w-3.5 h-3.5" />
                                    <span>Demo Logins</span>
                                </button>
                            </div>

                            {/* Demo Accounts Panel */}
                            <AnimatePresence>
                                {showDemoLogins && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="bg-gradient-to-br from-slate-50 to-indigo-50/50 border border-slate-200 rounded-2xl p-3 space-y-2 text-xs shadow-inner"
                                    >
                                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                                            <span>Quick Test Accounts</span>
                                            <span className="text-[10px] text-sky-600 font-bold">1-Click Fill</span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-1.5">
                                            {[
                                                {
                                                    key: 'admin',
                                                    forPortal: 'admin',
                                                    user: 'superadmin',
                                                    pass: 'superadmin123',
                                                    icon: '⚡',
                                                    name: 'superadmin',
                                                    badge: 'Platform Admin',
                                                    activeRing: currentType === 'admin' ? 'ring-2 ring-purple-400 bg-purple-50/70' : 'bg-white',
                                                    borderColor: 'border-purple-200 hover:border-purple-300',
                                                },
                                                {
                                                    key: 'daycare',
                                                    forPortal: 'daycare',
                                                    user: 'admin',
                                                    pass: 'admin123',
                                                    icon: '🏢',
                                                    name: 'admin',
                                                    badge: 'Daycare Admin',
                                                    activeRing: currentType === 'daycare' ? 'ring-2 ring-teal-400 bg-teal-50/70' : 'bg-white',
                                                    borderColor: 'border-teal-200 hover:border-teal-300',
                                                },
                                                {
                                                    key: 'staff',
                                                    forPortal: 'staff',
                                                    user: 'staff',
                                                    pass: 'admin123',
                                                    icon: '👩‍🏫',
                                                    name: 'staff / teacher',
                                                    badge: 'Educator',
                                                    activeRing: currentType === 'staff' ? 'ring-2 ring-sky-400 bg-sky-50/70' : 'bg-white',
                                                    borderColor: 'border-sky-200 hover:border-sky-300',
                                                },
                                                {
                                                    key: 'family',
                                                    forPortal: 'family',
                                                    user: 'guardian',
                                                    pass: 'guardian123',
                                                    icon: '👨‍👩‍👧',
                                                    name: 'guardian',
                                                    badge: 'Family Portal',
                                                    activeRing: currentType === 'family' ? 'ring-2 ring-rose-400 bg-rose-50/70' : 'bg-white',
                                                    borderColor: 'border-rose-200 hover:border-rose-300',
                                                },
                                            ]
                                                .sort((a, b) => (a.forPortal === currentType ? -1 : b.forPortal === currentType ? 1 : 0))
                                                .map((item) => (
                                                    <button
                                                        key={item.key}
                                                        type="button"
                                                        onClick={() => handleFillDemo(item.user, item.pass)}
                                                        className={`w-full text-left px-3 py-2 rounded-xl border ${item.borderColor} ${item.activeRing} text-slate-800 flex items-center justify-between shadow-xs transition-all hover:shadow-sm`}
                                                    >
                                                        <span>{item.icon} <strong>{item.name}</strong> ({item.badge})</span>
                                                        <span className="font-mono text-slate-500 text-[10px]">{item.pass}</span>
                                                    </button>
                                                ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Vibrant Submit Button */}
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                type="submit"
                                disabled={isLoading}
                                className={`w-full flex justify-center items-center py-3.5 px-4 rounded-xl text-sm font-extrabold text-white ${currentPortal.btnGradient} shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>Sign in to {currentPortal.badge}</span>
                                        <ArrowRight className="ml-2 w-4 h-4" />
                                    </>
                                )}
                            </motion.button>
                        </form>

                        {/* Bottom Link for Registration & Activation */}
                        <div className="mt-6 pt-5 border-t border-slate-100 text-center space-y-2">
                            {currentType === 'family' ? (
                                <p className="text-xs text-slate-600 font-medium">
                                    Received an invite token?{' '}
                                    <Link to="/family/activate" className="font-bold text-rose-600 hover:text-rose-700 transition-colors">
                                        Activate Guardian Account &rarr;
                                    </Link>
                                </p>
                            ) : currentType === 'staff' ? (
                                <p className="text-xs text-slate-600 font-medium">
                                    Need help with your educator account?{' '}
                                    <span className="font-bold text-sky-600 hover:text-sky-700 transition-colors cursor-pointer">
                                        Contact Daycare Administrator
                                    </span>
                                </p>
                            ) : (
                                <p className="text-xs text-slate-600 font-medium">
                                    New parent looking to enroll?{' '}
                                    <Link to="/register/main-branch" className="font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                                        Public Child Registration &rarr;
                                    </Link>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Privacy Guarantee Note */}
                    <div className="mt-4 text-center text-xs font-medium text-slate-500 flex items-center justify-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-teal-600" />
                        <span>Protected by enterprise-grade TLS encryption & educator role privacy</span>
                    </div>
                </motion.div>

            </main>

            {/* Bottom Footer */}
            <footer className="relative z-20 w-full max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 border-t border-slate-200">
                <div className="font-medium">
                    &copy; {new Date().getFullYear()} KidSynq Platform Inc. All rights reserved.
                </div>
                <div className="flex items-center gap-4 mt-2 sm:mt-0 font-medium">
                    <span className="hover:text-slate-800 transition-colors cursor-pointer">Privacy Policy</span>
                    <span>&bull;</span>
                    <span className="hover:text-slate-800 transition-colors cursor-pointer">Staff Guidelines</span>
                    <span>&bull;</span>
                    <span className="hover:text-slate-800 transition-colors cursor-pointer">Security Compliance</span>
                </div>
            </footer>
        </div>
    );
};

export default Login;
