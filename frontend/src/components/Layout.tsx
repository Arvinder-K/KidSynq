import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    LayoutDashboard, Users, GraduationCap, CalendarCheck, 
    Activity, HeartPulse, CreditCard, FileText, 
    ShieldCheck, MessageSquare, Menu, LogOut, X, UserCircle, School
} from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    let navLinks = [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Age Groups', path: '/age-groups', icon: Users },
        { name: 'Classrooms', path: '/classrooms', icon: School },
        { name: 'Communication', path: '/communication', icon: MessageSquare },
        { name: 'Staff', path: '/staff', icon: Users },
        { name: 'Students', path: '/students', icon: GraduationCap },
        { name: 'Attendance', path: '/attendance', icon: CalendarCheck },
        { name: 'Activities', path: '/activities', icon: Activity },
        { name: 'Health', path: '/health', icon: HeartPulse },
        { name: 'Billing', path: '/billing', icon: CreditCard },
        { name: 'Programs', path: '/programs', icon: FileText },
        { name: 'Documents', path: '/documents', icon: FileText },
        { name: 'Compliance', path: '/compliance', icon: ShieldCheck },
    ];

    if (user?.is_superuser) {
        navLinks = [
            { name: 'Platform Admin', path: '/admin', icon: LayoutDashboard }
        ];
    }

    const currentRoute = navLinks.find(link => 
        location.pathname.startsWith(link.path) && (link.path !== '/dashboard' || location.pathname === '/dashboard')
    ) || navLinks[0];

    return (
        <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden">
            
            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <aside
                className={`fixed lg:static inset-y-0 left-0 w-[260px] bg-[#0F172A] z-50 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                {/* Logo Area */}
                <div className="h-16 flex items-center px-6 bg-[#0B1121] border-b border-slate-800 shrink-0 justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/30">
                            K
                        </div>
                        <span className="text-white font-bold text-xl tracking-tight">KidSynq</span>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Nav Links */}
                <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 scrollbar-hide">
                    <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Daycare Management</p>
                    {navLinks.map((link) => {
                        const isActive = location.pathname.startsWith(link.path) && (link.path !== '/dashboard' || location.pathname === '/dashboard');
                        return (
                            <Link
                                key={link.name}
                                to={link.path}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group ${
                                    isActive 
                                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' 
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                }`}
                            >
                                <link.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'}`} />
                                <span className="font-medium text-sm">{link.name}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* User Area */}
                <div className="p-4 border-t border-slate-800 bg-[#0B1121]">
                    <div className="flex items-center gap-3 px-2 py-2 mb-2">
                        <UserCircle className="w-8 h-8 text-indigo-400" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user?.first_name || 'Admin'}</p>
                            <p className="text-xs text-slate-400 truncate">Daycare Admin</p>
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

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                
                {/* Header */}
                <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden text-slate-500 hover:text-slate-800 p-1"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="hidden sm:block">
                            <h1 className="text-xl font-bold text-slate-800 capitalize flex items-center gap-2">
                                {currentRoute?.name}
                            </h1>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <Link 
                            to="/profile" 
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium"
                        >
                            <UserCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">Profile</span>
                        </Link>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto relative p-4 sm:p-8">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="max-w-7xl mx-auto h-full"
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};

export default Layout;
