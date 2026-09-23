import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import { 
    LayoutDashboard, Users, GraduationCap, CalendarCheck, 
    Activity, HeartPulse, CreditCard, FileText, 
    ShieldCheck, MessageSquare, Menu, LogOut, X, UserCircle, School,
    Calendar, ShieldAlert, Settings, Baby, FileSpreadsheet, CalendarDays,
    Clock, PiggyBank, ArrowLeftRight, UserCheck, ChevronRight, ChevronDown, Sparkles,
    UserPlus, Layers, Building2, Briefcase, Scale, Search, DollarSign,
    FolderArchive, Home, CheckSquare, Shield, HelpCircle, Tag, Percent, Receipt,
    Bell, AlertTriangle, ArrowRight, Check, Globe, Copy, ExternalLink
} from 'lucide-react';

interface SubMenuItem {
    name: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    badgeColor?: string;
    description?: string;
}

interface NavMenuItem {
    id: string;
    name: string;
    path?: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    badgeColor?: string;
    tier: 'main' | 'accent';
    subItems?: SubMenuItem[];
}

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [showNotifications, setShowNotifications] = useState(false);
    const [showPortalPopover, setShowPortalPopover] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isLinkCopied, setIsLinkCopied] = useState(false);
    const [unreadCount, setUnreadCount] = useState(2);
    const [fetchedDaycareName, setFetchedDaycareName] = useState<string>(() => {
        return localStorage.getItem('kidsynq_cached_daycare_name') || '';
    });
    const notifRef = useRef<HTMLDivElement>(null);
    const portalRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    const daycareId = useMemo(() => {
        if (!user?.daycare) return '';
        if (typeof user.daycare === 'object' && user.daycare.id) return String(user.daycare.id);
        if (typeof user.daycare === 'string') return user.daycare;
        return '';
    }, [user]);

    const daycareName = useMemo(() => {
        if (user?.daycare && typeof user.daycare === 'object' && 'name' in user.daycare && user.daycare.name) {
            return String(user.daycare.name);
        }
        if (fetchedDaycareName) return fetchedDaycareName;
        return '';
    }, [user, fetchedDaycareName]);

    useEffect(() => {
        if (!daycareName && user) {
            api.get('/daycare/dashboard/').then(res => {
                if (res.data?.daycare_name) {
                    setFetchedDaycareName(res.data.daycare_name);
                    localStorage.setItem('kidsynq_cached_daycare_name', res.data.daycare_name);
                }
            }).catch(() => {});
        }
    }, [daycareName, user]);

    const registrationUrl = useMemo(() => {
        if (!daycareId) return `${window.location.origin}/register`;
        return `${window.location.origin}/register/${daycareId}`;
    }, [daycareId]);

    const handleCopyPortalLink = () => {
        navigator.clipboard.writeText(registrationUrl);
        setIsLinkCopied(true);
        setTimeout(() => setIsLinkCopied(false), 2500);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
            if (portalRef.current && !portalRef.current.contains(event.target as Node)) {
                setShowPortalPopover(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setShowProfileMenu(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
            }
        };
        if (showNotifications || showPortalPopover || showProfileMenu || isSearchFocused) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showNotifications, showPortalPopover, showProfileMenu, isSearchFocused]);

    // Define Daycare Admin / Staff navigation menu items with hierarchical submenus
    const daycareNavMenu: NavMenuItem[] = useMemo(() => [
        // === MAIN TIER (Dark/Slate Upper Section) ===
        {
            id: 'dashboard',
            name: 'Dashboard',
            path: '/daycare/dashboard',
            icon: LayoutDashboard,
            tier: 'main',
        },
        {
            id: 'staff',
            name: 'Staff',
            icon: Briefcase,
            tier: 'main',
            badge: 'Active',
            badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            subItems: [
                { name: 'Staff & Employees', path: '/daycare/employees', icon: Users, description: 'Educators & staff profiles' },
                { name: 'Staff Scheduling', path: '/daycare/scheduling', icon: CalendarDays, description: 'Shift builder & rosters' },
                { name: 'Staff Attendance', path: '/daycare/staff/attendance', icon: UserCheck, description: 'Clock in/out & punch logs' },
                { name: 'Timesheet Approvals', path: '/daycare/staff/timesheets/approvals', icon: Clock, description: 'Review & approve hours' },
                { name: 'Leave Management', path: '/daycare/leave', icon: Calendar, description: 'Time-off requests & balances' },
                { name: 'Shift Swaps', path: '/daycare/scheduling/swaps', icon: ArrowLeftRight, description: 'Staff peer swap requests' },
                { name: 'Shortage Alerts', path: '/daycare/scheduling/shortages', icon: ShieldAlert, description: 'Live ratio shortage planner' },
                { name: 'Overtime & Time Bank', path: '/daycare/scheduling/overtime', icon: PiggyBank, description: 'Banked hours & multipliers' },
                { name: 'Credential Compliance', path: '/daycare/credentials/dashboard', icon: ShieldCheck, description: 'ECE certifications & expiry' },
            ]
        },
        {
            id: 'families',
            name: 'Families',
            icon: Users,
            tier: 'main',
            subItems: [
                { name: 'Children Roster', path: '/daycare/children', icon: GraduationCap, description: 'Active children database' },
                { name: 'Admissions', path: '/daycare/admissions', icon: UserPlus, description: 'Enrollment applications' },
                { name: 'Waitlist', path: '/daycare/waitlist', icon: Users, description: 'Prospective family queue' },
                { name: 'Consent Forms', path: '/daycare/consent-forms', icon: FileText, description: 'Digital permissions & waivers' },
                { name: 'Communication', path: '/communication', icon: MessageSquare, description: 'Parent announcements & chats' },
            ]
        },
        {
            id: 'daycare',
            name: 'Daycare',
            icon: CheckSquare,
            tier: 'main',
            badge: 7,
            badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
            subItems: [
                { name: 'Classrooms & Rooms', path: '/daycare/classrooms', icon: School, description: 'Room capacity & educators' },
                { name: 'Programs & Age Groups', path: '/age-groups', icon: Layers, description: 'Infant, Toddler, Preschool' },
                { name: 'Child Attendance', path: '/daycare/attendance', icon: UserCheck, description: 'Daily room roll call' },
                { name: 'Attendance Command', path: '/daycare/attendance/dashboard', icon: CalendarCheck, description: 'Real-time check-in matrix' },
                { name: 'Safe Arrival Hub', path: '/daycare/safe-arrival', icon: ShieldCheck, description: 'Arrival confirmations & alerts' },
                { name: 'Pickup Verification', path: '/daycare/pickup-verification', icon: ShieldCheck, description: 'QR & PIN authorized release' },
                { name: 'Ratio Live Monitor', path: '/daycare/ratio-monitoring', icon: Scale, description: 'Provincial ratio tracker' },
            ]
        },
        {
            id: 'out_of_school',
            name: 'Out of School',
            icon: CheckSquare,
            tier: 'main',
            subItems: [
                { name: 'Before & After School', path: '/age-groups', icon: Layers, description: 'School-age care programs' },
                { name: 'Program Schedules', path: '/programs', icon: Calendar, description: 'Camps and extended care' },
            ]
        },
        {
            id: 'dayhomes',
            name: 'Dayhomes',
            icon: Home,
            path: '/branches',
            tier: 'main',
            subItems: [
                { name: 'Branch Locations', path: '/branches', icon: Building2, description: 'Multi-campus center overview' },
            ]
        },
        {
            id: 'reports',
            name: 'Reports',
            icon: FileSpreadsheet,
            tier: 'main',
            badge: 'Daily & Audit',
            badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
            subItems: [
                { name: 'Daily Reports', path: '/daycare/daily-reports', icon: Sparkles, description: 'Pad changes, meals, naps, potty & mood logs' },
                { name: 'Child Daily Attendance', path: '/daycare/reports/attendance/daily', icon: FileSpreadsheet, description: 'Daily attendance export' },
                { name: 'Child Monthly Attendance', path: '/daycare/reports/attendance/monthly', icon: FileSpreadsheet, description: 'Monthly registry & funding' },
                { name: 'Staff Attendance & Timesheet', path: '/daycare/reports/attendance/staff', icon: Clock, description: 'Staff payroll & worked hours' },
                { name: 'Ratio Compliance Reports', path: '/daycare/ratio-monitoring/reports', icon: Scale, description: 'Provincial audit inspection logs' },
                { name: 'Safe Arrival & Pickup Reports', path: '/daycare/safe-arrival/reports', icon: ShieldCheck, description: 'Custody & release timestamps' },
                { name: 'Staff & Credential Reports', path: '/daycare/credentials/reports', icon: Shield, description: 'Certification status matrix' },
                { name: 'Attendance Audit Trail', path: '/daycare/reports/attendance/audit', icon: FolderArchive, description: 'Immutable correction history' },
            ]
        },
        {
            id: 'admin',
            name: 'Admin',
            icon: Shield,
            tier: 'main',
            subItems: [
                { name: 'Provincial Ratio Rules', path: '/daycare/ratio-rules', icon: Scale, description: 'Configurable ratio rules engine' },
                { name: 'Emergency Protocols', path: '/daycare/emergency-information', icon: ShieldAlert, description: 'Evacuation & hospital contacts' },
                { name: 'Holidays & Closures', path: '/daycare/holidays', icon: Calendar, description: 'Center calendar & non-op days' },
                { name: 'Document Vault', path: '/documents', icon: FileText, description: 'Licensing & policy documents' },
            ]
        },

        // === ACCENT TIER (Light Fresh Operations Section) ===
        {
            id: 'agency',
            name: 'Agency',
            icon: Building2,
            tier: 'accent',
            subItems: [
                { name: 'Licensed Capacity', path: '/daycare/classrooms', icon: School, description: 'Branch licensing quotas' },
                { name: 'Provincial Standards', path: '/daycare/ratio-rules', icon: Scale, description: 'Regulatory guidelines' },
            ]
        },
        {
            id: 'finance',
            name: 'Finance',
            icon: DollarSign,
            tier: 'accent',
            subItems: [
                { name: 'Invoices & Invoicing', path: '/daycare/billing/invoices', icon: FileText, description: 'Invoice generator, statuses & recurring runs' },
                { name: 'Payments & Receipts', path: '/daycare/billing/payments', icon: Receipt, description: 'Recorded payments, receipts & refunds' },
                { name: 'Subsidies & CWELCC', path: '/daycare/billing/subsidies', icon: ShieldCheck, description: 'Government fee reductions & co-pay' },
                { name: 'Tax Receipts & Statements', path: '/daycare/billing/tax-receipts', icon: Layers, description: 'Annual CRA slips & account statements' },
                { name: 'Fee Structures & Plans', path: '/daycare/billing/fee-structures', icon: DollarSign, description: 'Childcare fees, versioning & deposits' },
                { name: 'Discounts & Credits', path: '/daycare/billing/discounts-credits', icon: Tag, description: 'Discounts, sibling policies, credits & late fees' },
                { name: 'Daycare Subscription', path: '/daycare/subscription', icon: CreditCard, description: 'Daycare platform plan & tier' },
                { name: 'Overtime & Banking', path: '/daycare/scheduling/overtime', icon: PiggyBank, description: 'Payroll liability ledger' },
            ]
        },
        {
            id: 'settings',
            name: 'Settings',
            icon: Settings,
            tier: 'accent',
            subItems: [
                { name: 'Daycare Settings', path: '/settings', icon: Settings, description: 'Center preferences & branding' },
                { name: 'My Profile', path: '/daycare/profile', icon: UserCircle, description: 'Account credentials & contact' },
            ]
        },
    ], []);

    // Define Guardian role navigation
    const guardianNavMenu: NavMenuItem[] = useMemo(() => [
        {
            id: 'guardian_dashboard',
            name: 'Dashboard',
            path: '/family/dashboard',
            icon: LayoutDashboard,
            tier: 'main',
        },
        {
            id: 'guardian_family',
            name: 'My Family',
            icon: Users,
            tier: 'main',
            subItems: [
                { name: 'My Children', path: '/family/children', icon: Baby, description: 'Enrolled child profiles' },
                { name: 'Family Profile', path: '/family/profile', icon: UserCircle, description: 'Household & contact info' },
                { name: 'Authorized Guardians', path: '/family/guardians', icon: Users, description: 'Pickup & emergency contacts' },
            ]
        },
        {
            id: 'guardian_daily',
            name: 'Daily Logs',
            icon: Sparkles,
            tier: 'main',
            subItems: [
                { name: 'Daily Reports', path: '/family/daily-reports', icon: Sparkles, description: '16-section daily activities' },
                { name: 'Report Archive', path: '/family/daily-reports/history', icon: Clock, description: 'Past reports & milestones' },
                { name: 'Attendance Record', path: '/family/attendance', icon: CalendarCheck, description: 'Check-in/out timestamps' },
            ]
        },
        {
            id: 'guardian_billing',
            name: 'Billing & Records',
            icon: CreditCard,
            tier: 'accent',
            subItems: [
                { name: 'Invoices & Payments', path: '/family/billing', icon: CreditCard, description: 'Tuition statements & receipts' },
                { name: 'Documents', path: '/family/documents', icon: FileText, description: 'Tax receipts & health forms' },
                { name: 'Consent Forms', path: '/family/consents', icon: CheckSquare, description: 'Digital permissions signed' },
            ]
        }
    ], []);

    // Define Platform Superadmin role navigation
    const adminNavMenu: NavMenuItem[] = useMemo(() => [
        {
            id: 'admin_overview',
            name: 'Platform Admin',
            path: '/admin',
            icon: LayoutDashboard,
            tier: 'main',
        }
    ], []);

    // Choose navigation based on role
    const activeNavMenu = useMemo(() => {
        if (user?.is_superuser) return adminNavMenu;
        if (user?.role === 'Guardian') return guardianNavMenu;
        return daycareNavMenu;
    }, [user, daycareNavMenu, guardianNavMenu, adminNavMenu]);

    // Flatten all sub-items to find current active route for breadcrumb and auto-expansion
    const allLinks = useMemo(() => {
        const list: { name: string; path: string; parentId: string; parentName: string }[] = [];
        activeNavMenu.forEach(menu => {
            if (menu.path) {
                list.push({ name: menu.name, path: menu.path, parentId: menu.id, parentName: menu.name });
            }
            if (menu.subItems) {
                menu.subItems.forEach(sub => {
                    list.push({ name: sub.name, path: sub.path, parentId: menu.id, parentName: menu.name });
                });
            }
        });
        return list;
    }, [activeNavMenu]);

    const currentRoute = useMemo(() => {
        return allLinks.find(link => 
            location.pathname === link.path || 
            (link.path !== '/daycare/dashboard' && link.path !== '/family/dashboard' && link.path !== '/admin' && location.pathname.startsWith(link.path))
        ) || allLinks[0];
    }, [allLinks, location.pathname]);

    // Automatically expand the menu containing the current active route
    useEffect(() => {
        if (currentRoute?.parentId) {
            setOpenMenus(prev => ({
                ...prev,
                [currentRoute.parentId]: true
            }));
        }
    }, [currentRoute?.parentId]);

    // Toggle menu open/close
    const toggleMenu = (menuId: string) => {
        setOpenMenus(prev => ({
            ...prev,
            [menuId]: !prev[menuId]
        }));
    };

    // Quick search results for top header omnibar
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        const results: { name: string; path: string; parentName: string; description?: string; icon: React.ComponentType<{ className?: string }> }[] = [];
        
        activeNavMenu.forEach(item => {
            if (item.subItems && item.subItems.length > 0) {
                item.subItems.forEach(sub => {
                    if (
                        sub.name.toLowerCase().includes(q) ||
                        (sub.description && sub.description.toLowerCase().includes(q)) ||
                        item.name.toLowerCase().includes(q)
                    ) {
                        results.push({
                            name: sub.name,
                            path: sub.path,
                            parentName: item.name,
                            description: sub.description,
                            icon: sub.icon
                        });
                    }
                });
            } else if (item.path && item.name.toLowerCase().includes(q)) {
                results.push({
                    name: item.name,
                    path: item.path,
                    parentName: 'Navigation',
                    icon: item.icon
                });
            }
        });
        return results;
    }, [activeNavMenu, searchQuery]);

    const mainTierItems = activeNavMenu.filter(item => item.tier === 'main');
    const accentTierItems = activeNavMenu.filter(item => item.tier === 'accent');

    const initials = (user?.first_name ? user.first_name[0] : (user?.username ? user.username[0] : 'U')).toUpperCase();
    const roleLabel = user?.role === 'Guardian' ? 'Family Guardian' : user?.is_superuser ? 'Platform Admin' : (user?.role || 'Daycare Admin');

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
                        className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm"
                    />
                )}
            </AnimatePresence>

            {/* Clean Light-Themed Sidebar Navigation */}
            <aside
                className={`fixed lg:static inset-y-0 left-0 w-[272px] bg-white border-r border-slate-200/90 z-50 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-sm ${
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                {/* 1. BRAND & DAYCARE HEADER (Light) */}
                <div className="bg-white px-4 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-emerald-400 flex items-center justify-center text-white font-black text-sm shadow-xs shrink-0">
                                {daycareName ? daycareName.charAt(0).toUpperCase() : 'K'}
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="font-extrabold text-sm text-slate-900 block leading-tight truncate" title={daycareName || 'KidSynq'}>
                                    {daycareName || 'KidSynq'}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                                    <span className="text-[10px] font-bold text-cyan-700 tracking-wider uppercase truncate">
                                        {daycareName ? 'Daycare Center' : 'Daycare SaaS'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsSidebarOpen(false)} 
                            className="lg:hidden text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 shrink-0"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 2. SCROLLABLE MENU CONTAINER */}
                <div className="flex-1 overflow-y-auto flex flex-col scrollbar-thin scrollbar-thumb-slate-200">
                    
                    {/* UPPER MAIN TIER (Light Fresh Section) */}
                    <div className="bg-white flex-1 py-2 px-2.5 space-y-1">
                        {mainTierItems.map((item) => {
                            const isMenuOpen = !!openMenus[item.id] || searchQuery.length > 0;
                            const hasSubItems = item.subItems && item.subItems.length > 0;
                            const isDirectActive = item.path && location.pathname === item.path;
                            const isSubActive = item.subItems?.some(s => location.pathname.startsWith(s.path) && (s.path !== '/daycare/dashboard' || location.pathname === '/daycare/dashboard'));
                            const isParentActive = isDirectActive || isSubActive;

                            return (
                                <div key={item.id} className="rounded-lg overflow-hidden">
                                    {/* Main Menu Button */}
                                    {hasSubItems ? (
                                        <div
                                            onClick={() => toggleMenu(item.id)}
                                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 select-none text-[13px] group ${
                                                isParentActive 
                                                    ? 'bg-cyan-50/80 text-cyan-950 font-bold border-l-4 border-cyan-600 shadow-2xs' 
                                                    : 'text-slate-700 hover:text-slate-950 hover:bg-slate-50/90 font-semibold'
                                            }`}
                                        >
                                            {/* Left: Icon and Name */}
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                                                    isParentActive ? 'text-cyan-600' : 'text-slate-500 group-hover:text-cyan-600'
                                                }`} />
                                                <span className="truncate">{item.name}</span>
                                            </div>

                                            {/* Right: Badge & Chevron */}
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {item.badge && (
                                                    <span className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-md border ${
                                                        item.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
                                                    }`}>
                                                        {item.badge}
                                                    </span>
                                                )}
                                                <motion.div
                                                    animate={{ rotate: isMenuOpen ? 90 : 0 }}
                                                    transition={{ duration: 0.15 }}
                                                >
                                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                                                </motion.div>
                                            </div>
                                        </div>
                                    ) : (
                                        <Link
                                            to={item.path || '/daycare/dashboard'}
                                            onClick={() => setIsSidebarOpen(false)}
                                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 select-none text-[13px] group ${
                                                isDirectActive 
                                                    ? 'bg-cyan-50/80 text-cyan-950 font-bold border-l-4 border-cyan-600 shadow-2xs' 
                                                    : 'text-slate-700 hover:text-slate-950 hover:bg-slate-50/90 font-semibold'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                                                    isDirectActive ? 'text-cyan-600' : 'text-slate-500 group-hover:text-cyan-600'
                                                }`} />
                                                <span className="truncate">{item.name}</span>
                                            </div>
                                            {item.badge && (
                                                <span className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-md border ${
                                                    item.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
                                                }`}>
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    )}

                                    {/* Sub-menu Dropdown List (Animated) */}
                                    <AnimatePresence initial={false}>
                                        {hasSubItems && isMenuOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                className="overflow-hidden bg-slate-50/90 rounded-lg ml-3 pl-2 border-l-2 border-slate-200/90 my-1 space-y-0.5 py-1"
                                            >
                                                {item.subItems!.map((sub) => {
                                                    const isSubItemActive = location.pathname.startsWith(sub.path) && (sub.path !== '/daycare/dashboard' || location.pathname === '/daycare/dashboard');
                                                    return (
                                                        <Link
                                                            key={sub.name}
                                                            to={sub.path}
                                                            onClick={() => setIsSidebarOpen(false)}
                                                            className={`flex items-center justify-between px-2.5 py-2 rounded-md transition-all text-xs group ${
                                                                isSubItemActive
                                                                    ? 'bg-white text-cyan-900 font-bold shadow-2xs border border-cyan-200/80 border-r-2 border-r-cyan-600'
                                                                    : 'text-slate-600 hover:text-slate-950 hover:bg-white font-medium'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <sub.icon className={`w-3.5 h-3.5 shrink-0 ${
                                                                    isSubItemActive ? 'text-cyan-600' : 'text-slate-400 group-hover:text-slate-600'
                                                                }`} />
                                                                <div className="truncate">
                                                                    <span className="block truncate leading-tight">{sub.name}</span>
                                                                    {sub.description && (
                                                                        <span className="block text-[9.5px] text-slate-600 group-hover:text-slate-700 truncate leading-tight mt-0.5">
                                                                            {sub.description}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {isSubItemActive && (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 shadow-xs shadow-cyan-600/40 shrink-0 ml-1.5" />
                                                            )}
                                                        </Link>
                                                    );
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>

                    {/* LOWER ACCENT TIER (Light Fresh Operations Section) */}
                    {accentTierItems.length > 0 && (
                        <div className="bg-gradient-to-b from-cyan-50/50 via-teal-50/40 to-slate-50/80 p-2.5 space-y-1 shrink-0 border-t border-slate-200/80 text-slate-800">
                            <div className="px-2 py-0.5 flex items-center justify-between">
                                <span className="text-[9.5px] font-black uppercase tracking-wider text-teal-800/90">
                                    Operations & Core
                                </span>
                            </div>

                            {accentTierItems.map((item) => {
                                const isMenuOpen = !!openMenus[item.id] || searchQuery.length > 0;
                                const hasSubItems = item.subItems && item.subItems.length > 0;
                                const isDirectActive = item.path && location.pathname === item.path;
                                const isSubActive = item.subItems?.some(s => location.pathname.startsWith(s.path));

                                return (
                                    <div key={item.id} className="rounded-lg overflow-hidden">
                                        {hasSubItems ? (
                                            <div
                                                onClick={() => toggleMenu(item.id)}
                                                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 select-none text-[13px] group ${
                                                    isSubActive 
                                                        ? 'bg-white text-teal-950 font-bold shadow-2xs border-l-4 border-teal-600 border border-teal-200/60' 
                                                        : 'text-teal-900 hover:text-teal-950 hover:bg-white/80 font-semibold'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <item.icon className={`w-4 h-4 shrink-0 ${
                                                        isSubActive ? 'text-teal-600' : 'text-teal-700 group-hover:text-teal-900'
                                                    }`} />
                                                    <span className="truncate">{item.name}</span>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {item.badge && (
                                                        <span className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-md border ${
                                                            item.badgeColor || 'bg-teal-50 text-teal-700 border-teal-200'
                                                        }`}>
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                    <motion.div
                                                        animate={{ rotate: isMenuOpen ? 90 : 0 }}
                                                        transition={{ duration: 0.15 }}
                                                    >
                                                        <ChevronRight className="w-3.5 h-3.5 text-teal-600 group-hover:text-teal-800" />
                                                    </motion.div>
                                                </div>
                                            </div>
                                        ) : (
                                            <Link
                                                to={item.path || '/daycare/dashboard'}
                                                onClick={() => setIsSidebarOpen(false)}
                                                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 select-none text-[13px] group ${
                                                    isDirectActive 
                                                        ? 'bg-white text-teal-950 font-bold shadow-2xs border-l-4 border-teal-600 border border-teal-200/60' 
                                                        : 'text-teal-900 hover:text-teal-950 hover:bg-white/80 font-semibold'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <item.icon className={`w-4 h-4 shrink-0 ${
                                                        isDirectActive ? 'text-teal-600' : 'text-teal-700 group-hover:text-teal-900'
                                                    }`} />
                                                    <span className="truncate">{item.name}</span>
                                                </div>
                                                {item.badge && (
                                                    <span className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-md border ${
                                                        item.badgeColor || 'bg-teal-50 text-teal-700 border-teal-200'
                                                    }`}>
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </Link>
                                        )}

                                        {/* Accent Submenu Dropdown */}
                                        <AnimatePresence initial={false}>
                                            {hasSubItems && isMenuOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                    className="overflow-hidden bg-white/90 rounded-lg ml-3 pl-2 border-l-2 border-teal-200/80 my-1 space-y-0.5 py-1 shadow-2xs"
                                                >
                                                    {item.subItems!.map((sub) => {
                                                        const isSubItemActive = location.pathname.startsWith(sub.path);
                                                        return (
                                                            <Link
                                                                key={sub.name}
                                                                to={sub.path}
                                                                onClick={() => setIsSidebarOpen(false)}
                                                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-xs group ${
                                                                    isSubItemActive
                                                                        ? 'bg-teal-100/80 text-teal-950 font-bold border-r-2 border-r-teal-600'
                                                                        : 'text-teal-800 hover:text-teal-950 hover:bg-teal-50/80 font-medium'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <sub.icon className={`w-3.5 h-3.5 shrink-0 ${
                                                                        isSubItemActive ? 'text-teal-700' : 'text-teal-600'
                                                                    }`} />
                                                                    <span className="truncate">{sub.name}</span>
                                                                </div>
                                                                {isSubItemActive && (
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shadow-xs shadow-teal-600/40 shrink-0 ml-1.5" />
                                                                )}
                                                            </Link>
                                                        );
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                
                {/* Header with Top Accent Glow */}
                <header className="relative h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-10 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                    <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400"></div>
                    
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        
                        {/* Breadcrumbs Navigation */}
                        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
                            <span className="font-bold text-slate-900">{currentRoute?.parentName || 'KidSynq'}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            <h1 className="text-sm font-semibold text-cyan-700 capitalize">
                                {currentRoute?.name}
                            </h1>
                        </div>
                    </div>

                    {/* Middle: Global Quick Search Omnibar in Top Bar */}
                    <div className="relative flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-2 sm:mx-4" ref={searchRef}>
                        <div className="relative flex items-center">
                            <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setIsSearchFocused(true);
                                }}
                                onFocus={() => setIsSearchFocused(true)}
                                placeholder="Quick search menu & pages..."
                                className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-9 pr-8 py-2 border border-slate-200/90 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-2xs"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setIsSearchFocused(false);
                                    }}
                                    className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 text-xs rounded-md hover:bg-slate-200/50"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Search Results Dropdown Overlay */}
                        <AnimatePresence>
                            {isSearchFocused && searchQuery.trim().length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                                    transition={{ duration: 0.12 }}
                                    className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden text-left max-h-80 overflow-y-auto"
                                >
                                    <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-bold">
                                        <span>Search Results ({searchResults.length})</span>
                                        <span className="text-[10px] text-cyan-600 uppercase font-black">KidSynq Quick Nav</span>
                                    </div>

                                    {searchResults.length > 0 ? (
                                        <div className="p-1.5 divide-y divide-slate-50">
                                            {searchResults.map((res, idx) => (
                                                <Link
                                                    key={`${res.path}-${idx}`}
                                                    to={res.path}
                                                    onClick={() => {
                                                        setIsSearchFocused(false);
                                                        setSearchQuery('');
                                                    }}
                                                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-cyan-50/70 transition-colors group text-left"
                                                >
                                                    <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-cyan-100/70 text-slate-600 group-hover:text-cyan-700 transition-colors shrink-0">
                                                        <res.icon className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-slate-900 group-hover:text-cyan-950 truncate">
                                                                {res.name}
                                                            </span>
                                                            <span className="text-[9.5px] font-extrabold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 group-hover:bg-cyan-100 group-hover:text-cyan-800">
                                                                {res.parentName}
                                                            </span>
                                                        </div>
                                                        {res.description && (
                                                            <p className="text-[10.5px] text-slate-400 group-hover:text-slate-600 truncate mt-0.5">
                                                                {res.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-cyan-600 shrink-0" />
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-6 text-center text-xs text-slate-500">
                                            <p className="font-semibold text-slate-700">No matching pages found</p>
                                            <p className="text-[11px] text-slate-400 mt-1">Try searching for children, billing, attendance, or reports.</p>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex items-center gap-2.5 sm:gap-3">
                        {/* Top-Right Notification Icon with Dropdown Drawer */}
                        <div className="relative" ref={notifRef}>
                            <button
                                type="button"
                                onClick={() => setShowNotifications(!showNotifications)}
                                className={`relative p-2 rounded-xl border transition-all ${
                                    showNotifications 
                                        ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm' 
                                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs'
                                }`}
                                title="Notifications & Alerts"
                            >
                                <Bell className="w-4 h-4 text-slate-700" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-white text-[10px] font-black items-center justify-center shadow-xs">
                                            {unreadCount}
                                        </span>
                                    </span>
                                )}
                            </button>

                            {/* Dropdown Notification Popup */}
                            <AnimatePresence>
                                {showNotifications && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden text-left"
                                    >
                                        <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950 text-white flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Bell className="w-4 h-4 text-teal-300" />
                                                <h3 className="text-xs font-black tracking-wide uppercase">Notifications & Alerts</h3>
                                            </div>
                                            {unreadCount > 0 && (
                                                <button
                                                    onClick={() => setUnreadCount(0)}
                                                    className="text-[10px] font-bold text-teal-300 hover:text-white transition-colors"
                                                >
                                                    Mark read
                                                </button>
                                            )}
                                        </div>

                                        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                                            {/* Item 1: Staff Attendance Alert */}
                                            <div className="p-3.5 bg-amber-50/50 hover:bg-amber-50/80 transition-all flex items-start gap-3">
                                                <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
                                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                </div>
                                                <div className="space-y-1 min-w-0 flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                                            Staff Notice
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium">Just now</span>
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-900 leading-snug">
                                                        You have 2 unconfirmed staff attendance records.
                                                    </p>
                                                    <div className="pt-1">
                                                        <Link
                                                            to="/daycare/attendance"
                                                            onClick={() => setShowNotifications(false)}
                                                            className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-900 hover:underline"
                                                        >
                                                            <span>Review Staff Attendance</span>
                                                            <ArrowRight className="w-3 h-3 text-amber-700" />
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Item 2: Public Registration Portal */}
                                            <div className="p-3.5 hover:bg-slate-50 transition-all flex items-start gap-3">
                                                <div className="p-1.5 bg-teal-100 text-teal-800 rounded-lg shrink-0 mt-0.5">
                                                    <Users className="w-4 h-4 text-teal-600" />
                                                </div>
                                                <div className="space-y-1 min-w-0 flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">
                                                            Public Portal
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium">Today</span>
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-900 leading-snug">
                                                        Online parent registration and enrollment URL is active.
                                                    </p>
                                                    <div className="pt-1">
                                                        <Link
                                                            to="/daycare/admissions"
                                                            onClick={() => setShowNotifications(false)}
                                                            className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline"
                                                        >
                                                            <span>Open Admissions</span>
                                                            <ArrowRight className="w-3 h-3 text-teal-600" />
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Item 3: Daily Reports Synced */}
                                            <div className="p-3.5 hover:bg-slate-50 transition-all flex items-start gap-3">
                                                <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg shrink-0 mt-0.5">
                                                    <Sparkles className="w-4 h-4 text-emerald-600" />
                                                </div>
                                                <div className="space-y-1 min-w-0 flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                                            Daily Care
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium">Today</span>
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-900 leading-snug">
                                                        16-domain daily child care logs are synced with family portals.
                                                    </p>
                                                    <div className="pt-1">
                                                        <Link
                                                            to="/daycare/daily-reports"
                                                            onClick={() => setShowNotifications(false)}
                                                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                                                        >
                                                            <span>Open Daily Reports Hub</span>
                                                            <ArrowRight className="w-3 h-3 text-emerald-600" />
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                                            <Link
                                                to="/daycare/dashboard"
                                                onClick={() => setShowNotifications(false)}
                                                className="text-xs font-bold text-slate-600 hover:text-slate-900"
                                            >
                                                Operations Command Center →
                                            </Link>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Parent Portal Registration Link Popover (Shifted near notification) */}
                        {daycareId && (
                            <div className="relative" ref={portalRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowPortalPopover(!showPortalPopover)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition-all shadow-2xs ${
                                        showPortalPopover
                                            ? 'bg-gradient-to-r from-cyan-50 to-teal-50 border-cyan-300 text-cyan-950 shadow-sm'
                                            : 'bg-white hover:bg-cyan-50/50 border-slate-200 hover:border-cyan-200 text-slate-700 hover:text-cyan-950'
                                    }`}
                                    title="Public Parent Online Registration Link"
                                >
                                    <Globe className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                                    <span className="hidden sm:inline">Parent Registration</span>
                                    <span className="sm:hidden">Register</span>
                                </button>

                                <AnimatePresence>
                                    {showPortalPopover && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-xl border border-slate-200/90 z-50 overflow-hidden text-left p-5 space-y-4"
                                        >
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="p-2 bg-gradient-to-tr from-cyan-500 to-teal-400 text-slate-950 rounded-xl shadow-xs">
                                                        <Globe className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                                            Parent Online Registration
                                                        </h3>
                                                        <p className="text-[11px] text-slate-500 font-medium">Public registration & enrollment intake link</p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200">
                                                    Public
                                                </span>
                                            </div>

                                            <div className="space-y-1.5">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Unique Registration Link</span>
                                                <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 text-xs font-mono text-cyan-900 break-all select-all shadow-inner">
                                                    {registrationUrl}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={handleCopyPortalLink}
                                                    className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition-all shadow-xs ${
                                                        isLinkCopied
                                                            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                                                            : 'bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950'
                                                    }`}
                                                >
                                                    {isLinkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                    <span>{isLinkCopied ? 'Copied Link!' : 'Copy Link'}</span>
                                                </button>

                                                <a
                                                    href={`/register/${daycareId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center justify-center gap-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                                                    title="Preview Parent Registration Form in New Tab"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                                                    <span>Preview</span>
                                                </a>

                                                <Link
                                                    to="/daycare/admissions"
                                                    onClick={() => setShowPortalPopover(false)}
                                                    className="inline-flex items-center justify-center py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all"
                                                >
                                                    <span>Admissions</span>
                                                </Link>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Top-Right Profile & Account Dropdown (with Logout) */}
                        <div className="relative" ref={profileRef}>
                            <button
                                type="button"
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                                className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border transition-all text-xs font-bold shadow-2xs ${
                                    showProfileMenu
                                        ? 'border-cyan-400 bg-cyan-50/80 text-cyan-950 ring-2 ring-cyan-500/20 shadow-sm'
                                        : 'border-slate-200 hover:border-cyan-300 bg-white hover:bg-slate-50 text-slate-800'
                                }`}
                                title="Account & Profile Menu"
                            >
                                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-600 via-teal-500 to-emerald-400 text-white flex items-center justify-center font-black text-[11px] shadow-xs shrink-0">
                                    {initials}
                                </div>
                                <span className="hidden sm:inline font-bold text-slate-800 truncate max-w-[120px]">
                                    {user?.first_name ? `${user.first_name}` : (user?.username || 'Profile')}
                                </span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${showProfileMenu ? 'rotate-180 text-cyan-700' : 'text-slate-400'}`} />
                            </button>

                            <AnimatePresence>
                                {showProfileMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 mt-2 w-64 sm:w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden text-left p-3 space-y-2"
                                    >
                                        {/* User Info Header */}
                                        <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/80 flex items-center gap-3">
                                            <div className="relative shrink-0">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-emerald-400 text-white flex items-center justify-center font-black text-sm shadow-xs">
                                                    {initials}
                                                </div>
                                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-black text-slate-900 truncate">
                                                    {user?.first_name ? `${user.first_name} ${user?.last_name || ''}`.trim() : (user?.username || 'User')}
                                                </p>
                                                <p className="text-[10px] font-bold text-cyan-700 truncate">
                                                    {roleLabel}
                                                </p>
                                                {daycareName && (
                                                    <p className="text-[10px] font-bold text-slate-600 truncate flex items-center gap-1 mt-0.5">
                                                        <School className="w-3 h-3 text-cyan-600 shrink-0" />
                                                        <span className="truncate">{daycareName}</span>
                                                    </p>
                                                )}
                                                {user?.email && (
                                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                        {user.email}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Menu Links */}
                                        <div className="space-y-1 pt-1">
                                            <Link
                                                to="/daycare/profile"
                                                onClick={() => setShowProfileMenu(false)}
                                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-cyan-950 hover:bg-cyan-50/60 transition-colors"
                                            >
                                                <UserCircle className="w-4 h-4 text-cyan-600 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <span>My Profile & Settings</span>
                                                </div>
                                            </Link>

                                            <Link
                                                to="/daycare/dashboard"
                                                onClick={() => setShowProfileMenu(false)}
                                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-cyan-950 hover:bg-cyan-50/60 transition-colors"
                                            >
                                                <LayoutDashboard className="w-4 h-4 text-slate-500 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <span>Operations Dashboard</span>
                                                </div>
                                            </Link>
                                        </div>

                                        {/* Divider */}
                                        <div className="border-t border-slate-100 my-1 pt-1">
                                            {/* Sign Out / Logout Action */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowProfileMenu(false);
                                                    logout();
                                                }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-black text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors group"
                                            >
                                                <div className="p-1 rounded-lg bg-rose-100/60 group-hover:bg-rose-100 text-rose-600 transition-colors">
                                                    <LogOut className="w-3.5 h-3.5" />
                                                </div>
                                                <div className="flex-1 text-left min-w-0">
                                                    <span>Sign Out / Logout</span>
                                                </div>
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto relative p-4 sm:p-5 lg:px-6 lg:py-5 bg-[#F8FAFC]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.12 }}
                            className="max-w-7xl mx-auto w-full"
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

