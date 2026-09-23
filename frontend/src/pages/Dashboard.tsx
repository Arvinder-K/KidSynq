import React, { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout';
import api from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, BookOpen, Building2, Activity, Megaphone, Calendar, 
    Briefcase, CreditCard, UserPlus, ClipboardList, ShieldCheck, 
    AlertTriangle, Clock, ArrowRight, CheckCircle2, ChevronRight,
    Sparkles, ArrowUpRight, Check, X, ShieldAlert, HeartPulse,
    UserCheck, MapPin, Search, Filter, Layers, BellRing, School,
    DollarSign, FileText, Plus, RefreshCw, AlertCircle, FileSpreadsheet,
    PiggyBank, CheckSquare, Baby, Copy, ExternalLink, Globe, Share2,
    BarChart3, PieChart, TrendingUp, Download, Eye, FolderArchive, Scale,
    CalendarCheck, Shield, Award, Zap, Heart
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
);

interface DashboardTask {
    id: string;
    category: string;
    title: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low' | string;
    action_link: string;
    action_label: string;
    date: string;
}

interface RoomSummaryItem {
    id: string;
    name: string;
    capacity: number;
    checked_in: number;
    assigned: number;
    available: number;
    colorTheme?: string;
}

interface StaffOnDutyItem {
    id: string;
    name: string;
    role: string;
    check_in: string | null;
    status: string;
    avatarColor?: string;
}

interface DaycareDashboardData {
    daycare_id?: string;
    daycare_code?: string;
    registration_url?: string;
    registration_enabled?: boolean;
    daycare_name: string;
    logo: string | null;
    status: string;
    student_count: number;
    staff_count: number;
    classroom_count: number;
    active_branches: number;
    active_pickups_count?: number;
    subscription_status: string;
    subscription_expiry: string | null;
    capacity: number;
    occupancy: number;
    charges_this_month?: number;
    charges_last_month?: number;
    unpaid_invoices_count?: number;
    unpaid_invoices_total?: number;
    payments_this_month?: number;
    payments_last_month?: number;
    active_families_count?: number;
    inactive_families_count?: number;
    enrolment?: {
        total: number;
        full_time_count: number;
        full_time_pct: number;
        part_time_count: number;
        part_time_pct: number;
        drop_in_count: number;
        drop_in_pct: number;
    };
    staff_on_duty?: StaffOnDutyItem[];
    unconfirmed_attendance_count?: number;
    rooms_summary?: RoomSummaryItem[];
    grants?: {
        total: number;
        items: { program: string; amount: number }[];
    };
    daily_reports_summary?: {
        total_present: number;
        published: number;
        in_progress: number;
        pending: number;
        completion_pct: number;
    };
    expiring_subsidies?: {
        count: number;
        already_expired: number;
    };
    pending_notifications: any[];
    pending_requests?: {
        id: string;
        type: string;
        student_id: string;
        student_name: string;
        contact_name: string;
        status: string;
        changes?: any;
    }[];
    recent_announcements: { id: string; title: string; date: string }[];
    recent_activity: { id: string; action: string; date: string }[];
    credential_compliance?: {
        expiring_soon: number;
        expired: number;
        missing: number;
        pending_review: number;
        non_compliant_employees: number;
        compliant_employees: number;
    };
    tasks?: DashboardTask[];
    charts?: {
        financial?: {
            labels: string[];
            invoiced: number[];
            payments: number[];
        };
        attendance?: {
            labels: string[];
            present: number[];
            expected: number[];
        };
    };
}

const Dashboard: React.FC = () => {
    const [data, setData] = useState<DaycareDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [taskFilter, setTaskFilter] = useState<'all' | 'approvals' | 'compliance' | 'operations'>('all');
    const [reportFilter, setReportFilter] = useState<'all' | 'attendance' | 'compliance' | 'finance' | 'care'>('all');
    const [chartTimeframe, setChartTimeframe] = useState<'6m' | '3m'>('6m');
    const [isRegCopied, setIsRegCopied] = useState(false);
    const navigate = useNavigate();

    const handleCopyRegistrationUrl = () => {
        if (!data) return;
        const regPath = data.registration_url || (data.daycare_id ? `/register/${data.daycare_id}` : '/register');
        const fullUrl = `${window.location.origin}${regPath}`;
        navigator.clipboard.writeText(fullUrl);
        setIsRegCopied(true);
        setTimeout(() => setIsRegCopied(false), 2500);
    };

    const fetchDashboardData = async () => {
        try {
            const response = await api.get('/daycare/dashboard/');
            setData(response.data);
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    if (loading) {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4 font-sans">
                    <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                    <p className="text-xs font-black bg-gradient-to-r from-teal-600 to-indigo-600 bg-clip-text text-transparent uppercase tracking-wider">
                        Loading Vibrant Center Operations & Intelligence...
                    </p>
                </div>
            </Layout>
        );
    }

    if (!data) {
        return (
            <Layout>
                <div className="bg-rose-50 text-rose-700 p-6 rounded-3xl border border-rose-200 flex items-center gap-3 font-sans shadow-sm">
                    <AlertTriangle className="w-6 h-6 text-rose-500" />
                    <p className="font-semibold text-sm">Failed to load dashboard data. Please refresh and try again.</p>
                </div>
            </Layout>
        );
    }

    const allTasks: DashboardTask[] = data.tasks || [];

    const filteredTasks = allTasks.filter(t => {
        if (taskFilter === 'approvals') return t.category.includes('Leave') || t.category.includes('Timesheet') || t.category.includes('Swap');
        if (taskFilter === 'compliance') return t.category.includes('Compliance') || t.category.includes('Medical');
        if (taskFilter === 'operations') return t.category.includes('Safe') || t.category.includes('Classroom') || t.category.includes('Arrival');
        return true;
    });

    const formatCurrency = (val?: number) => {
        if (val === undefined || val === null) return '$ 0.00';
        return `$ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const chargesThisMonth = data.charges_this_month ?? 0;
    const chargesLastMonth = data.charges_last_month ?? 0;
    const unpaidCount = data.unpaid_invoices_count ?? 0;
    const unpaidTotal = data.unpaid_invoices_total ?? 0;
    const activeFamilies = data.active_families_count ?? 0;
    const inactiveFamilies = data.inactive_families_count ?? 0;
    const paymentsThisMonth = data.payments_this_month ?? 0;
    const paymentsLastMonth = data.payments_last_month ?? 0;
    const enrolment = data.enrolment || { 
        total: data.student_count || 0, 
        full_time_count: data.student_count || 0, 
        full_time_pct: 100, 
        part_time_count: 0, 
        part_time_pct: 0, 
        drop_in_count: 0, 
        drop_in_pct: 0 
    };
    
    const avatarColors = [
        'bg-gradient-to-tr from-teal-500 to-emerald-400 text-white',
        'bg-gradient-to-tr from-indigo-500 to-purple-400 text-white',
        'bg-gradient-to-tr from-pink-500 to-rose-400 text-white',
        'bg-gradient-to-tr from-amber-500 to-orange-400 text-white',
        'bg-gradient-to-tr from-cyan-500 to-blue-400 text-white',
    ];

    const staffOnDuty = (data.staff_on_duty || []).map((s, idx) => ({
        ...s,
        avatarColor: avatarColors[idx % avatarColors.length]
    }));

    const roomThemes = [
        { border: 'border-emerald-200 hover:border-emerald-400', bg: 'bg-emerald-50/50', bar: 'bg-gradient-to-r from-emerald-500 to-teal-400', text: 'text-emerald-800' },
        { border: 'border-cyan-200 hover:border-cyan-400', bg: 'bg-cyan-50/50', bar: 'bg-gradient-to-r from-cyan-500 to-blue-400', text: 'text-cyan-800' },
        { border: 'border-purple-200 hover:border-purple-400', bg: 'bg-purple-50/50', bar: 'bg-gradient-to-r from-purple-500 to-indigo-400', text: 'text-purple-800' },
        { border: 'border-amber-200 hover:border-amber-400', bg: 'bg-amber-50/50', bar: 'bg-gradient-to-r from-amber-500 to-orange-400', text: 'text-amber-800' },
    ];

    const rooms = (data.rooms_summary || []).map((r, idx) => ({
        ...r,
        theme: roomThemes[idx % roomThemes.length]
    }));

    const grants = data.grants || {
        total: 0,
        items: []
    };

    const dailyReports = data.daily_reports_summary || {
        total_present: data.student_count || 0,
        published: 0,
        in_progress: 0,
        pending: data.student_count || 0,
        completion_pct: 0.0
    };

    const occupancyPercentage = data.capacity > 0 
        ? Math.round((data.occupancy / data.capacity) * 100) 
        : (data.student_count > 0 ? 100 : 0);
    const expiringSubsidies = data.expiring_subsidies || { count: 0, already_expired: 0 };

    // --- CHART DATA CONFIGURATION ---
    const financialLabels = data.charts?.financial?.labels || ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    const invoicedData = data.charts?.financial?.invoiced || [0, 0, 0, 0, 0, 0];
    const paymentsData = data.charts?.financial?.payments || [0, 0, 0, 0, 0, 0];

    const financialChartData = {
        labels: chartTimeframe === '3m' ? financialLabels.slice(-3) : financialLabels,
        datasets: [
            {
                label: 'Invoiced Charges ($)',
                data: chartTimeframe === '3m' ? invoicedData.slice(-3) : invoicedData,
                backgroundColor: 'rgba(6, 182, 212, 0.85)',
                borderColor: '#0891b2',
                borderWidth: 2,
                borderRadius: 10,
                barPercentage: 0.6,
            },
            {
                label: 'Payments Collected ($)',
                data: chartTimeframe === '3m' ? paymentsData.slice(-3) : paymentsData,
                backgroundColor: 'rgba(16, 185, 129, 0.85)',
                borderColor: '#059669',
                borderWidth: 2,
                borderRadius: 10,
                barPercentage: 0.6,
            }
        ]
    };

    const financialChartOptions: any = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    boxWidth: 12,
                    font: { size: 11, weight: 'bold' },
                    color: '#334155'
                }
            },
            tooltip: {
                backgroundColor: '#0f172a',
                padding: 12,
                cornerRadius: 12,
                titleFont: { size: 12, weight: 'bold' },
                bodyFont: { size: 11 },
                callbacks: {
                    label: (context: any) => ` ${context.dataset.label}: $${Number(context.raw).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { font: { size: 11, weight: 'bold' }, color: '#64748b' }
            },
            y: {
                grid: { color: '#f1f5f9' },
                ticks: {
                    font: { size: 10, weight: 'bold' },
                    color: '#64748b',
                    callback: (value: any) => `$${(value / 1000).toFixed(0)}k`
                }
            }
        }
    };

    // Attendance chart
    const attendanceLabels = data.charts?.attendance?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const attendancePresent = data.charts?.attendance?.present || [17, 18, 19, 18, 20];
    const attendanceExpected = data.charts?.attendance?.expected || [20, 20, 20, 20, 20];

    const weeklyAttendanceChartData = {
        labels: attendanceLabels,
        datasets: [
            {
                type: 'bar' as const,
                label: 'Present Students',
                data: attendancePresent,
                backgroundColor: 'rgba(20, 184, 166, 0.85)',
                borderRadius: 8,
                barPercentage: 0.5,
            },
            {
                type: 'line' as const,
                label: 'Expected Enrolment',
                data: attendanceExpected,
                borderColor: '#8b5cf6',
                borderWidth: 2.5,
                borderDash: [5, 5],
                pointBackgroundColor: '#8b5cf6',
                pointRadius: 4,
                fill: false,
            }
        ]
    };

    const attendanceChartOptions: any = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    boxWidth: 10,
                    font: { size: 11, weight: 'bold' },
                    color: '#334155'
                }
            },
            tooltip: {
                backgroundColor: '#0f172a',
                padding: 10,
                cornerRadius: 10,
                titleFont: { size: 12, weight: 'bold' }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { font: { size: 11, weight: 'bold' }, color: '#64748b' }
            },
            y: {
                beginAtZero: true,
                max: Math.max(...attendanceExpected) + 5,
                grid: { color: '#f1f5f9' },
                ticks: { font: { size: 10, weight: 'bold' }, color: '#64748b', stepSize: 5 }
            }
        }
    };

    // Enrolment Doughnut Chart
    const enrolmentDonutData = {
        labels: ['Full-Time (FT)', 'Part-Time (PT)', 'Drop-In'],
        datasets: [
            {
                data: [enrolment.full_time_count, enrolment.part_time_count, enrolment.drop_in_count],
                backgroundColor: ['#10b981', '#06b6d4', '#f59e0b'],
                borderColor: ['#ffffff', '#ffffff', '#ffffff'],
                borderWidth: 3,
                hoverOffset: 6
            }
        ]
    };

    const enrolmentDonutOptions: any = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    boxWidth: 10,
                    font: { size: 10, weight: 'bold' },
                    color: '#475569',
                    padding: 12
                }
            },
            tooltip: {
                backgroundColor: '#0f172a',
                padding: 10,
                cornerRadius: 10,
                callbacks: {
                    label: (context: any) => ` ${context.label}: ${context.raw} children`
                }
            }
        },
        cutout: '70%'
    };

    // --- ALL 11 DAYCARE REPORTS DIRECTORY (COLORFUL THEMED) ---
    const allDaycareReports = [
        {
            id: 'rep-daily-child',
            name: 'Daily Child Care Reports',
            category: 'care',
            categoryName: 'Daily Care',
            description: '16-domain real-time logs (meals, naps, diaper/potty, moods, photos, learning activities) synced with parents.',
            path: '/daycare/daily-reports',
            dashboardPath: '/daycare/daily-reports/dashboard',
            badge: `${dailyReports.published}/${dailyReports.total_present} Published`,
            badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
            cardBg: 'from-emerald-950/40 to-teal-950/30 border-emerald-500/30 hover:border-emerald-400',
            iconBg: 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-emerald-500/20',
            btnBg: 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:from-emerald-400 hover:to-teal-300',
            icon: Sparkles,
            highlights: ['Parent Mobile Feed', '16 Activity Domains', 'Live Classroom Entry']
        },
        {
            id: 'rep-att-daily',
            name: 'Child Daily Attendance Report',
            category: 'attendance',
            categoryName: 'Attendance',
            description: 'Classroom daily roll call, check-in/out timestamps, guardian sign-offs, absent reasons, and headcount export.',
            path: '/daycare/reports/attendance/daily',
            badge: 'Daily Roll Call',
            badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
            cardBg: 'from-cyan-950/40 to-blue-950/30 border-cyan-500/30 hover:border-cyan-400',
            iconBg: 'bg-gradient-to-tr from-cyan-500 to-blue-400 text-slate-950 shadow-cyan-500/20',
            btnBg: 'bg-gradient-to-r from-cyan-500 to-blue-400 text-slate-950 hover:from-cyan-400 hover:to-blue-300',
            icon: FileSpreadsheet,
            highlights: ['Classroom Grouping', 'Timestamp Log', 'CSV & PDF Export']
        },
        {
            id: 'rep-att-monthly',
            name: 'Child Monthly Attendance Registry',
            category: 'attendance',
            categoryName: 'Attendance',
            description: 'Monthly attendance registry for provincial operating funding, CWELCC subsidy reconciliation, and child enrollment proof.',
            path: '/daycare/reports/attendance/monthly',
            badge: 'Provincial Funding',
            badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40',
            cardBg: 'from-indigo-950/40 to-purple-950/30 border-indigo-500/30 hover:border-indigo-400',
            iconBg: 'bg-gradient-to-tr from-indigo-500 to-purple-400 text-white shadow-indigo-500/20',
            btnBg: 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-400 hover:to-purple-400',
            icon: CalendarCheck,
            highlights: ['Monthly Registry Grid', 'Operating Grant Validation', 'Attendance Days']
        },
        {
            id: 'rep-staff-att',
            name: 'Staff Attendance & Timesheets',
            category: 'attendance',
            categoryName: 'Attendance',
            description: 'Staff payroll hours, educator punch records, supervisor approvals, overtime banking, and worked time breakdown.',
            path: '/daycare/reports/attendance/staff',
            badge: 'Staff Payroll',
            badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
            cardBg: 'from-amber-950/40 to-orange-950/30 border-amber-500/30 hover:border-amber-400',
            iconBg: 'bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 shadow-amber-500/20',
            btnBg: 'bg-gradient-to-r from-amber-500 to-orange-400 text-slate-950 hover:from-amber-400 hover:to-orange-300',
            icon: Clock,
            highlights: ['Overtime Ledger', 'Clock In/Out Punches', 'Supervisor Sign-off']
        },
        {
            id: 'rep-ratio-comp',
            name: 'Ratio Compliance & Audit Inspection',
            category: 'compliance',
            categoryName: 'Compliance',
            description: 'Provincial educator-to-child ratio compliance tracker, room capacity inspections, and licensing historical compliance logs.',
            path: '/daycare/ratio-monitoring/reports',
            badge: 'Audit Inspection',
            badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
            cardBg: 'from-purple-950/40 to-fuchsia-950/30 border-purple-500/30 hover:border-purple-400',
            iconBg: 'bg-gradient-to-tr from-purple-500 to-fuchsia-400 text-white shadow-purple-500/20',
            btnBg: 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white hover:from-purple-400 hover:to-fuchsia-400',
            icon: Scale,
            highlights: ['Provincial Standards', 'Room Distribution', 'Inspector Export']
        },
        {
            id: 'rep-safe-arrival',
            name: 'Safe Arrival & Pickup Reports',
            category: 'compliance',
            categoryName: 'Compliance',
            description: 'Authorized guardian release records, QR & PIN verification timestamps, unauthorized pickup alerts, and custody audit.',
            path: '/daycare/safe-arrival/reports',
            badge: 'Release Security',
            badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
            cardBg: 'from-sky-950/40 to-indigo-950/30 border-sky-500/30 hover:border-sky-400',
            iconBg: 'bg-gradient-to-tr from-sky-500 to-cyan-400 text-slate-950 shadow-sky-500/20',
            btnBg: 'bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 hover:from-sky-400 hover:to-cyan-300',
            icon: ShieldCheck,
            highlights: ['QR & PIN Verification', 'Authorized Collector Log', 'Custody Safety Audit']
        },
        {
            id: 'rep-credentials',
            name: 'Staff Credential & ECE Compliance',
            category: 'compliance',
            categoryName: 'Compliance',
            description: 'Certification expiry matrix, ECE licenses, CPR/First Aid, Vulnerable Sector Police Checks, and staff qualification registry.',
            path: '/daycare/credentials/reports',
            badge: 'Licensing Readiness',
            badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-400/40',
            cardBg: 'from-rose-950/40 to-pink-950/30 border-rose-500/30 hover:border-rose-400',
            iconBg: 'bg-gradient-to-tr from-rose-500 to-pink-400 text-white shadow-rose-500/20',
            btnBg: 'bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:from-rose-400 hover:to-pink-400',
            icon: Shield,
            highlights: ['30-Day Expiry Alerts', 'Police Checks', 'ECE License Matrix']
        },
        {
            id: 'rep-att-audit',
            name: 'Attendance Audit Trail',
            category: 'attendance',
            categoryName: 'Attendance',
            description: 'Immutable correction history, supervisor timestamp modifications, rationale logs, and licensing-grade audit trail.',
            path: '/daycare/reports/attendance/audit',
            badge: 'Immutable Trail',
            badgeColor: 'bg-slate-400/20 text-slate-300 border-slate-400/40',
            cardBg: 'from-slate-900/60 to-slate-800/40 border-slate-600/30 hover:border-slate-400',
            iconBg: 'bg-gradient-to-tr from-slate-600 to-slate-400 text-white shadow-slate-500/20',
            btnBg: 'bg-gradient-to-r from-slate-700 to-slate-600 text-white hover:from-slate-600 hover:to-slate-500',
            icon: FolderArchive,
            highlights: ['Manual Edit Records', 'Admin Override History', 'Tamper-Proof Logs']
        },
        {
            id: 'rep-billing-invoices',
            name: 'Invoices & Aging Receivables Report',
            category: 'finance',
            categoryName: 'Finance',
            description: 'Automated recurring tuition billing, invoice status tracking, aging open balances, and parent payment ledger.',
            path: '/daycare/billing/invoices',
            badge: `${unpaidCount} Open Invoices`,
            badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-400/40',
            cardBg: 'from-teal-950/40 to-emerald-950/30 border-teal-500/30 hover:border-teal-400',
            iconBg: 'bg-gradient-to-tr from-teal-500 to-cyan-400 text-slate-950 shadow-teal-500/20',
            btnBg: 'bg-gradient-to-r from-teal-500 to-cyan-400 text-slate-950 hover:from-teal-400 hover:to-cyan-300',
            icon: FileText,
            highlights: ['Aging Receivables', 'Payment Reconciliation', 'Online Invoicing']
        },
        {
            id: 'rep-billing-subsidies',
            name: 'Subsidies & CWELCC Reconciliation',
            category: 'finance',
            categoryName: 'Finance',
            description: 'Government fee reductions, municipal subsidy co-pay allocation, parent contribution splits, and grant claims.',
            path: '/daycare/billing/subsidies',
            badge: 'CWELCC & Grants',
            badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
            cardBg: 'from-emerald-950/40 to-amber-950/30 border-emerald-500/30 hover:border-emerald-400',
            iconBg: 'bg-gradient-to-tr from-emerald-500 to-amber-400 text-slate-950 shadow-emerald-500/20',
            btnBg: 'bg-gradient-to-r from-emerald-500 to-amber-400 text-slate-950 hover:from-emerald-400 hover:to-amber-300',
            icon: PiggyBank,
            highlights: ['Parent Portion Split', 'Municipal Subsidy Ledger', 'CWELCC Fee Reduction']
        },
        {
            id: 'rep-billing-tax',
            name: 'Tax Receipts & Annual Statements',
            category: 'finance',
            categoryName: 'Finance',
            description: 'Annual CRA childcare tax receipts, official year-end statement generator, and family payment certificate slips.',
            path: '/daycare/billing/tax-receipts',
            badge: 'Annual CRA Slips',
            badgeColor: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/40',
            cardBg: 'from-fuchsia-950/40 to-pink-950/30 border-fuchsia-500/30 hover:border-fuchsia-400',
            iconBg: 'bg-gradient-to-tr from-fuchsia-500 to-pink-400 text-white shadow-fuchsia-500/20',
            btnBg: 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white hover:from-fuchsia-400 hover:to-pink-400',
            icon: Layers,
            highlights: ['CRA Tax Compliance', 'Batch Statement PDF', 'Annual Summary Slips']
        }
    ];

    const filteredReports = allDaycareReports.filter(r => {
        if (reportFilter === 'all') return true;
        return r.category === reportFilter;
    });

    return (
        <Layout>
            <div className="space-y-5 max-w-7xl mx-auto pb-16 font-sans">
                
                {/* ========================================================================= */}
                {/* TIER 1: 🌈 EXECUTIVE KPI OVERVIEW (4 KEY BUSINESS & ENROLMENT METRICS)     */}
                {/* ========================================================================= */}
                <section className="space-y-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Executive Snapshot & Key Metrics</h2>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">Live Sync</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        
                        {/* Card 1: Charges this Month (Emerald-Teal Theme) */}
                        <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white p-3.5 rounded-2xl border border-emerald-200/90 shadow-2xs flex flex-col justify-between hover:border-emerald-400 hover:shadow-xs transition-all group">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10.5px] font-black text-emerald-900 uppercase tracking-wider">Charges this Month</span>
                                    <div className="p-1.5 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-xl shadow-2xs group-hover:scale-105 transition-transform">
                                        <DollarSign className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                                <div className="text-lg sm:text-xl font-black text-emerald-950 tracking-tight">
                                    {formatCurrency(chargesThisMonth)}
                                </div>
                                <p className="text-[10.5px] text-emerald-800 font-medium mt-0.5">
                                    Last Month: <span className="font-bold text-emerald-950">{formatCurrency(chargesLastMonth)}</span>
                                </p>
                            </div>
                            <div className="pt-2 border-t border-emerald-100 mt-2">
                                <Link 
                                    to="/daycare/billing/invoices" 
                                    className="inline-flex items-center gap-1 text-[10.5px] font-black text-emerald-700 hover:text-emerald-900 group-hover:translate-x-0.5 transition-transform"
                                >
                                    <span>Invoicing Details</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>

                        {/* Card 2: Unpaid Invoices (Amber-Orange Theme) */}
                        <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-white p-3.5 rounded-2xl border border-amber-200/90 shadow-2xs flex flex-col justify-between hover:border-amber-400 hover:shadow-xs transition-all group">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10.5px] font-black text-amber-900 uppercase tracking-wider">Unpaid Invoices</span>
                                    <div className="p-1.5 bg-gradient-to-tr from-amber-500 to-orange-500 text-white rounded-xl shadow-2xs group-hover:scale-105 transition-transform">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    <div className="text-lg sm:text-xl font-black text-amber-950 tracking-tight">
                                        {unpaidCount}
                                    </div>
                                    <span className="text-[10.5px] font-black text-amber-700">Invoices</span>
                                </div>
                                <p className="text-[10.5px] text-amber-900 font-semibold mt-0.5">
                                    Total Due: <span className="font-black text-orange-700">{formatCurrency(unpaidTotal)}</span>
                                </p>
                            </div>
                            <div className="pt-2 border-t border-amber-100 mt-2">
                                <Link 
                                    to="/daycare/billing/invoices" 
                                    className="inline-flex items-center gap-1 text-[10.5px] font-black text-amber-800 hover:text-amber-950 group-hover:translate-x-0.5 transition-transform"
                                >
                                    <span>Open Receivables</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>

                        {/* Card 3: Active Families (Purple-Violet Theme) */}
                        <div className="bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-white p-3.5 rounded-2xl border border-purple-200/90 shadow-2xs flex flex-col justify-between hover:border-purple-400 hover:shadow-xs transition-all group">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10.5px] font-black text-purple-900 uppercase tracking-wider">Active Families</span>
                                    <div className="p-1.5 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-xl shadow-2xs group-hover:scale-105 transition-transform">
                                        <Users className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    <div className="text-lg sm:text-xl font-black text-purple-950 tracking-tight">
                                        {activeFamilies}
                                    </div>
                                    <span className="text-[10.5px] font-black text-purple-700">Active</span>
                                </div>
                                <p className="text-[10.5px] text-purple-800 font-medium mt-0.5">
                                    <span className="font-bold text-purple-950">{inactiveFamilies}</span> Inactive Families
                                </p>
                            </div>
                            <div className="pt-2 border-t border-purple-100 mt-2">
                                <Link 
                                    to="/daycare/children" 
                                    className="inline-flex items-center gap-1 text-[10.5px] font-black text-purple-700 hover:text-purple-900 group-hover:translate-x-0.5 transition-transform"
                                >
                                    <Users className="w-3 h-3" />
                                    <span>View Families</span>
                                </Link>
                            </div>
                        </div>

                        {/* Card 4: Current Enrolment (Cyan-Blue Theme) */}
                        <div className="bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-white p-3.5 rounded-2xl border border-cyan-200/90 shadow-2xs flex flex-col justify-between hover:border-cyan-400 hover:shadow-xs transition-all group">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10.5px] font-black text-cyan-900 uppercase tracking-wider">Current Enrolment</span>
                                    <div className="p-1.5 bg-gradient-to-tr from-cyan-500 to-blue-500 text-white rounded-xl shadow-2xs group-hover:scale-105 transition-transform">
                                        <School className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    <div className="text-lg sm:text-xl font-black text-cyan-950 tracking-tight">
                                        {enrolment.total}
                                    </div>
                                    <span className="text-[10.5px] font-black text-cyan-700">Enrolled Children</span>
                                </div>
                                
                                {/* Breakdown percentages */}
                                <div className="mt-1 text-[9.5px] font-bold text-slate-600 flex items-center justify-between">
                                    <span className="text-emerald-700">FT: {enrolment.full_time_pct}%</span>
                                    <span className="text-cyan-700">PT: {enrolment.part_time_pct}%</span>
                                    <span className="text-amber-700">Drop: {enrolment.drop_in_pct}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex mt-1 shadow-inner">
                                    <div style={{ width: `${enrolment.full_time_pct}%` }} className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full"></div>
                                    <div style={{ width: `${enrolment.part_time_pct}%` }} className="bg-gradient-to-r from-cyan-400 to-blue-400 h-full"></div>
                                    <div style={{ width: `${enrolment.drop_in_pct}%` }} className="bg-gradient-to-r from-amber-400 to-orange-400 h-full"></div>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-cyan-100 mt-2">
                                <Link 
                                    to="/daycare/children" 
                                    className="inline-flex items-center gap-1 text-[10.5px] font-black text-cyan-700 hover:text-cyan-900 group-hover:translate-x-0.5 transition-transform"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Children Roster</span>
                                </Link>
                            </div>
                        </div>

                    </div>
                </section>

                {/* ========================================================================= */}
                {/* TIER 2: 📊 CORE ANALYTICS & REVENUE/ATTENDANCE TRENDS                     */}
                {/* ========================================================================= */}
                <section className="space-y-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-cyan-600" />
                            <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Financial & Attendance Analytics</h2>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        
                        {/* CHART 1: Monthly Financial Revenue & Cash Trends */}
                        <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between hover:border-cyan-300 transition-all">
                            <div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3 mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 bg-gradient-to-tr from-cyan-500 to-teal-400 text-slate-950 rounded-xl shadow-2xs">
                                            <TrendingUp className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <h3 className="text-xs sm:text-sm font-black text-slate-900">Financial Revenue & Cash Collection Trends</h3>
                                            <p className="text-[10.5px] text-slate-500 font-medium">Monthly invoiced tuition charges vs recorded payment receipts</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl self-start sm:self-auto border border-slate-200/80">
                                        <button
                                            type="button"
                                            onClick={() => setChartTimeframe('6m')}
                                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all ${
                                                chartTimeframe === '6m' 
                                                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 shadow-2xs' 
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            Past 6 Months
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setChartTimeframe('3m')}
                                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all ${
                                                chartTimeframe === '3m' 
                                                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 shadow-2xs' 
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            Last 3 Months
                                        </button>
                                    </div>
                                </div>

                                {/* Chart Canvas */}
                                <div className="h-48 sm:h-52 w-full pt-1">
                                    <Bar data={financialChartData} options={financialChartOptions} />
                                </div>
                            </div>

                            <div className="pt-2.5 border-t border-slate-100 mt-2.5 flex flex-wrap items-center justify-between gap-2.5">
                                <div className="flex items-center gap-4 text-[11px]">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-md bg-cyan-500 inline-block shadow-2xs"></span>
                                        <span className="font-bold text-slate-700">Invoiced: <b className="text-slate-950">{formatCurrency(invoicedData.reduce((a, b) => a + b, 0))}</b></span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-md bg-emerald-500 inline-block shadow-2xs"></span>
                                        <span className="font-bold text-slate-700">Collected: <b className="text-slate-950">{formatCurrency(paymentsData.reduce((a, b) => a + b, 0))}</b></span>
                                    </div>
                                </div>
                                <Link
                                    to="/daycare/billing/payments"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg text-[10.5px] font-black border border-cyan-200 shadow-2xs transition-all"
                                >
                                    <span>Reconcile</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>

                        {/* CHART 2: Enrolment & Attendance Dynamics (Doughnut + Mini Bar) */}
                        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between hover:border-purple-300 transition-all">
                            <div>
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-gradient-to-tr from-purple-500 to-indigo-500 text-white rounded-xl shadow-2xs">
                                            <PieChart className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <h3 className="text-xs sm:text-sm font-black text-slate-900">Enrolment & Attendance</h3>
                                            <p className="text-[10px] text-slate-500 font-medium">Weekly roll-call & tier split</p>
                                        </div>
                                    </div>
                                    <span className="text-[9.5px] font-black px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
                                        {enrolment.total} Children
                                    </span>
                                </div>

                                {/* Enrolment Donut Chart */}
                                <div className="h-32 w-full relative flex items-center justify-center">
                                    <Doughnut data={enrolmentDonutData} options={enrolmentDonutOptions} />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-3">
                                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Occupancy</span>
                                        <span className="text-base font-black bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">{occupancyPercentage}%</span>
                                    </div>
                                </div>

                                {/* Weekly Attendance Mini Bar Chart */}
                                <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10.5px] font-black text-slate-800 uppercase tracking-wider">Weekly Attendance Flow</span>
                                        <span className="text-[9px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">5 Weekdays</span>
                                    </div>
                                    <div className="h-20 w-full">
                                        <Bar data={weeklyAttendanceChartData as any} options={attendanceChartOptions} />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 mt-2 flex items-center justify-between text-[10.5px] font-black">
                                <Link
                                    to="/daycare/reports/attendance/daily"
                                    className="text-teal-700 hover:text-teal-900 hover:underline inline-flex items-center gap-1"
                                >
                                    <span>Daily Attendance</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                </Link>
                                <Link
                                    to="/daycare/reports/attendance/monthly"
                                    className="text-indigo-600 hover:text-indigo-800 hover:underline"
                                >
                                    <span>Monthly Registry →</span>
                                </Link>
                            </div>
                        </div>

                    </div>
                </section>

                {/* ========================================================================= */}
                {/* TIER 3: 🏢 LIVE FLOOR OPERATIONS & DAYCARE ACTIONS CENTER (2-COLUMN SPLIT) */}
                {/* ========================================================================= */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <div className="flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5 text-teal-600" />
                            <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Live Daycare Operations, Rooms & Staff Floor</h2>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">Real-Time Activity</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        
                        {/* LEFT COLUMN (2 Cols): Classrooms, Action Tasks, Daily Care Cockpit */}
                        <div className="lg:col-span-2 space-y-4">
                            
                            {/* A. ROOM LIVE CHECK-IN MATRIX CARD */}
                            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3 hover:border-emerald-200 transition-all">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-gradient-to-tr from-emerald-500 to-teal-500 text-white rounded-xl shadow-2xs">
                                            <Building2 className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <h3 className="text-xs sm:text-sm font-black text-slate-900">Room Live Check-In Matrix</h3>
                                            <p className="text-[10.5px] text-slate-500 font-medium">Classroom capacity, check-in, and assigned distribution</p>
                                        </div>
                                    </div>
                                    <Link
                                        to="/daycare/classrooms"
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[10.5px] font-black rounded-lg border border-emerald-200 shadow-2xs transition-all"
                                    >
                                        <School className="w-3 h-3 text-emerald-700" />
                                        <span>Classrooms</span>
                                    </Link>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    {rooms.map((room) => (
                                        <div 
                                            key={room.id} 
                                            className={`p-3 rounded-xl border ${room.theme?.border} ${room.theme?.bg} hover:shadow-2xs transition-all space-y-1.5`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-black text-xs text-slate-900 truncate">{room.name}</h4>
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 shadow-2xs">
                                                    Cap: {room.capacity}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] font-medium text-slate-600">
                                                <span>In: <b className="text-emerald-700 font-black">{room.checked_in}</b></span>
                                                <span>Set: <b className="text-slate-900 font-bold">{room.assigned}</b></span>
                                                <span>Avail: <b className="text-teal-700 font-black">{room.available}</b></span>
                                            </div>
                                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden shadow-inner">
                                                <div 
                                                    style={{ width: `${room.capacity > 0 ? (room.checked_in / room.capacity) * 100 : 0}%` }} 
                                                    className={`${room.theme?.bar} h-full rounded-full`}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* B. TODAY'S TASKS & ACTION COMMAND CENTER */}
                            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3.5 hover:border-indigo-200 transition-all">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-xl shadow-2xs">
                                            <BellRing className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <h3 className="text-xs sm:text-sm font-black text-slate-900">Today's Tasks & Actions</h3>
                                            <p className="text-[10.5px] text-slate-500 font-medium">Pending approvals, daily checks, and action items</p>
                                        </div>
                                    </div>

                                    {/* Task Filter Tabs */}
                                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl self-start sm:self-auto overflow-x-auto border border-slate-200/80">
                                        {[
                                            { key: 'all', label: 'All Tasks' },
                                            { key: 'approvals', label: 'Approvals' },
                                            { key: 'compliance', label: 'Compliance' },
                                            { key: 'operations', label: 'Safe Arrival' },
                                        ].map((f) => (
                                            <button
                                                key={f.key}
                                                onClick={() => setTaskFilter(f.key as any)}
                                                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all whitespace-nowrap ${
                                                    taskFilter === f.key
                                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-2xs'
                                                        : 'text-slate-600 hover:text-slate-900'
                                                }`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Task List Items */}
                                <div className="space-y-2">
                                    {filteredTasks.length > 0 ? (
                                        filteredTasks.map((task) => {
                                            const isHigh = task.priority === 'High';
                                            const isMed = task.priority === 'Medium';
                                            return (
                                                <div 
                                                    key={task.id} 
                                                    className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                                                        isHigh 
                                                            ? 'bg-gradient-to-r from-rose-50/70 to-white border-rose-200 hover:border-rose-300 shadow-2xs' 
                                                            : isMed 
                                                            ? 'bg-gradient-to-r from-amber-50/70 to-white border-amber-200 hover:border-amber-300 shadow-2xs' 
                                                            : 'bg-gradient-to-r from-emerald-50/70 to-white border-emerald-200 hover:border-emerald-300 shadow-2xs'
                                                    }`}
                                                >
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`px-2 py-0.2 rounded text-[9.5px] font-black uppercase tracking-wider ${
                                                                isHigh 
                                                                    ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                                                                    : isMed 
                                                                    ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                            }`}>
                                                                {task.category}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-400">• {task.priority} Priority</span>
                                                        </div>
                                                        <h4 className="text-xs font-black text-slate-900">{task.title}</h4>
                                                        <p className="text-[11px] text-slate-600 leading-snug">{task.description}</p>
                                                    </div>

                                                    <Link
                                                        to={task.action_link}
                                                        className={`shrink-0 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[10.5px] font-black transition-all shadow-2xs ${
                                                            isHigh 
                                                                ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white' 
                                                                : isMed 
                                                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white' 
                                                                : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white'
                                                        }`}
                                                    >
                                                        <span>{task.action_label}</span>
                                                        <ChevronRight className="w-3 h-3" />
                                                    </Link>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                                            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                                            <h4 className="text-xs font-black text-slate-800">All Operations Clear!</h4>
                                            <p className="text-[11px] text-slate-500">No pending approvals or alerts in this category.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* C. DAILY CHILD CARE REPORTS COCKPIT (PASTEL GRADIENT) */}
                            <div className="bg-gradient-to-r from-teal-100/70 via-emerald-100/50 to-cyan-100/60 rounded-2xl p-4 sm:p-5 border border-teal-200/90 shadow-2xs space-y-3">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-gradient-to-tr from-teal-600 to-emerald-600 text-white rounded-lg shadow-2xs">
                                                <FileText className="w-3.5 h-3.5" />
                                            </div>
                                            <h3 className="text-xs sm:text-sm font-black text-slate-900">
                                                Daily Child Care Reports Cockpit
                                            </h3>
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-teal-200/70 text-teal-900 rounded border border-teal-300">
                                                Live Reports
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-700 font-medium">
                                            16-domain care reporting (Meals, Naps, Diapers, Moods, Incidents, Learning, Photos) synced with the Family Portal.
                                        </p>
                                    </div>

                                    {/* Direct Action Hub Links */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Link
                                            to="/daycare/daily-reports"
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-[10.5px] font-black rounded-lg shadow-2xs transition-all"
                                        >
                                            <ClipboardList className="w-3 h-3" />
                                            <span>Reports Hub</span>
                                        </Link>
                                        <Link
                                            to="/daycare/daily-reports/dashboard"
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-teal-50 text-teal-900 text-[10.5px] font-black rounded-lg border border-teal-300 shadow-2xs transition-all"
                                        >
                                            <Activity className="w-3 h-3 text-teal-600" />
                                            <span>Status Matrix</span>
                                        </Link>
                                    </div>
                                </div>

                                {/* Report Status Metrics Bar */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                                    <div className="bg-white/90 p-2.5 rounded-xl border border-teal-200/80 shadow-2xs">
                                        <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider">Present Today</span>
                                        <div className="text-base sm:text-lg font-black text-slate-900 mt-0.5">{dailyReports.total_present} Children</div>
                                    </div>
                                    <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-200/80 shadow-2xs">
                                        <span className="text-[9.5px] font-black text-emerald-700 uppercase tracking-wider">Published</span>
                                        <div className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">{dailyReports.published} Reports</div>
                                    </div>
                                    <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200/80 shadow-2xs">
                                        <span className="text-[9.5px] font-black text-amber-700 uppercase tracking-wider">In Progress</span>
                                        <div className="text-base sm:text-lg font-black text-amber-700 mt-0.5">{dailyReports.in_progress} Reports</div>
                                    </div>
                                    <div className="bg-white/90 p-2.5 rounded-xl border border-purple-200/80 shadow-2xs">
                                        <span className="text-[9.5px] font-black text-purple-700 uppercase tracking-wider">Pending</span>
                                        <div className="text-base sm:text-lg font-black text-purple-800 mt-0.5">{dailyReports.pending} Reports</div>
                                    </div>
                                    <div className="bg-white/90 p-2.5 rounded-xl border border-teal-200/80 col-span-2 sm:col-span-1 shadow-2xs">
                                        <span className="text-[9.5px] font-black text-teal-800 uppercase tracking-wider">Completion</span>
                                        <div className="text-base sm:text-lg font-black text-teal-900 mt-0.5">{dailyReports.completion_pct}%</div>
                                        <div className="w-full bg-teal-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                                            <div style={{ width: `${dailyReports.completion_pct}%` }} className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* RIGHT COLUMN (1 Col): Staff, Capacity, Compliance, Grants, Activity */}
                        <div className="space-y-4">
                            
                            {/* 1. FACILITY CAPACITY & OCCUPANCY GAUGE */}
                            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5 hover:border-teal-200 transition-all">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <School className="w-3.5 h-3.5 text-teal-600" />
                                        <span>Center Capacity</span>
                                    </h3>
                                    <span className="text-[9.5px] font-black bg-gradient-to-r from-teal-50 to-emerald-50 text-teal-800 border border-teal-300 px-2 py-0.5 rounded shadow-2xs">
                                        {occupancyPercentage}% OCCUPIED
                                    </span>
                                </div>

                                <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        style={{ width: `${Math.min(occupancyPercentage, 100)}%` }}
                                        className={`h-full rounded-full transition-all duration-700 ${
                                            occupancyPercentage > 90 
                                                ? 'bg-gradient-to-r from-rose-500 to-pink-500' 
                                                : occupancyPercentage > 75 
                                                ? 'bg-gradient-to-r from-amber-500 to-emerald-500' 
                                                : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                                        }`}
                                    />
                                </div>

                                <div className="flex justify-between text-[10.5px] font-black text-slate-600 pt-0.5">
                                    <span className="text-slate-900">{data.occupancy} Enrolled</span>
                                    <span className="text-teal-700">{data.capacity > 0 ? `${data.capacity - data.occupancy} Seats Available` : 'Unlimited'}</span>
                                </div>
                            </div>

                            {/* 2. VOLUNTEERS & STAFF ON DUTY CARD */}
                            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5 hover:border-teal-200 transition-all">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <div className="flex items-center gap-1.5">
                                        <div className="p-1.5 bg-gradient-to-tr from-teal-500 to-cyan-500 text-white rounded-lg shadow-2xs">
                                            <Briefcase className="w-3.5 h-3.5" />
                                        </div>
                                        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
                                            Staff on Duty
                                        </h3>
                                    </div>
                                    <Link
                                        to="/daycare/employees"
                                        className="text-[10px] font-black text-teal-700 hover:underline"
                                    >
                                        Roster →
                                    </Link>
                                </div>

                                <div className="space-y-1.5">
                                    {staffOnDuty.map((staff) => (
                                        <div 
                                            key={staff.id} 
                                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80 border border-slate-200/70 hover:border-teal-300 transition-all"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`w-6 h-6 rounded-md ${staff.avatarColor} font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs`}>
                                                    {staff.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-[11px] text-slate-900 truncate">{staff.name}</h4>
                                                    <p className="text-[9.5px] text-slate-500 truncate">{staff.role}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="text-[9.5px] text-slate-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                                    {staff.check_in || '08:00'}
                                                </span>
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                                                    {staff.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 3. CREDENTIAL & ECE COMPLIANCE CARD */}
                            {data.credential_compliance && (
                                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5 hover:border-purple-200 transition-all">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <div className="flex items-center gap-1.5">
                                            <div className="p-1.5 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-lg shadow-2xs">
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                            </div>
                                            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
                                                ECE Compliance
                                            </h3>
                                        </div>
                                        <Link
                                            to="/daycare/credentials/reports"
                                            className="text-[10px] font-black text-purple-700 hover:underline"
                                        >
                                            Report →
                                        </Link>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <Link
                                            to="/daycare/credentials/expiring?days=30"
                                            className="p-2.5 bg-gradient-to-br from-amber-50 to-white hover:from-amber-100/70 border border-amber-200 rounded-xl transition-all group shadow-2xs"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black text-amber-900 uppercase">Expiring 30d</span>
                                                <Clock className="w-2.5 h-2.5 text-amber-700" />
                                            </div>
                                            <div className="text-base font-black text-amber-900 mt-0.5">
                                                {data.credential_compliance.expiring_soon}
                                            </div>
                                        </Link>

                                        <Link
                                            to="/daycare/credentials/dashboard?expiry_period=expired"
                                            className="p-2.5 bg-gradient-to-br from-rose-50 to-white hover:from-rose-100/70 border border-rose-200 rounded-xl transition-all group shadow-2xs"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black text-rose-900 uppercase">Expired</span>
                                                <AlertTriangle className="w-2.5 h-2.5 text-rose-700" />
                                            </div>
                                            <div className="text-base font-black text-rose-900 mt-0.5">
                                                {data.credential_compliance.expired}
                                            </div>
                                        </Link>

                                        <Link
                                            to="/daycare/credentials/dashboard"
                                            className="p-2.5 bg-gradient-to-br from-purple-50 to-white hover:from-purple-100/70 border border-purple-200 rounded-xl transition-all group shadow-2xs"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black text-purple-900 uppercase">Missing</span>
                                                <ShieldCheck className="w-2.5 h-2.5 text-purple-700" />
                                            </div>
                                            <div className="text-base font-black text-purple-900 mt-0.5">
                                                {data.credential_compliance.missing}
                                            </div>
                                        </Link>

                                        <Link
                                            to="/daycare/credentials/dashboard"
                                            className="p-2.5 bg-gradient-to-br from-teal-50 to-white hover:from-teal-100/70 border border-teal-200 rounded-xl transition-all group shadow-2xs"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black text-teal-900 uppercase">Pending</span>
                                                <Clock className="w-2.5 h-2.5 text-teal-700" />
                                            </div>
                                            <div className="text-base font-black text-teal-900 mt-0.5">
                                                {data.credential_compliance.pending_review}
                                            </div>
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* 4. GRANTS & SUBSIDY LEDGER */}
                            <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white rounded-2xl p-4 border border-emerald-200/90 shadow-2xs space-y-2.5 hover:border-emerald-300 transition-all">
                                <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                                    <div className="flex items-center gap-1.5">
                                        <div className="p-1.5 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-lg shadow-2xs">
                                            <PiggyBank className="w-3.5 h-3.5" />
                                        </div>
                                        <h3 className="text-[11px] font-black text-emerald-950 uppercase tracking-wider">
                                            Grants this Month
                                        </h3>
                                    </div>
                                    <span className="text-[11px] font-black text-emerald-700">
                                        {formatCurrency(grants.total)}
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    {grants.items.map((grant, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-[10.5px] py-0.5">
                                            <span className="text-slate-700 font-semibold truncate max-w-[150px]">{grant.program}</span>
                                            <span className="font-black text-emerald-900">{formatCurrency(grant.amount)}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-1.5 border-t border-emerald-100">
                                    <Link
                                        to="/daycare/billing/subsidies"
                                        className="inline-flex items-center gap-1 text-[10.5px] font-black text-emerald-700 hover:text-emerald-900 hover:underline"
                                    >
                                        <span>Subsidies & CWELCC</span>
                                        <ArrowUpRight className="w-3 h-3" />
                                    </Link>
                                </div>
                            </div>

                            {/* 5. RECENT ACTIVITY STREAM */}
                            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5 hover:border-cyan-200 transition-all">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Activity className="w-3.5 h-3.5 text-cyan-600" />
                                        <span>Recent Activity</span>
                                    </h3>
                                </div>

                                <div className="space-y-2">
                                    {data.recent_activity.length > 0 ? (
                                        data.recent_activity.slice(0, 4).map((act) => (
                                            <div key={act.id} className="flex items-start gap-2 text-[11px]">
                                                <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-cyan-500 to-teal-400 mt-1 shrink-0 shadow-2xs" />
                                                <div className="min-w-0">
                                                    <p className="font-bold text-slate-800 leading-snug truncate">{act.action}</p>
                                                    <p className="text-[9px] font-medium text-slate-400 mt-0.2">
                                                        {new Date(act.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[11px] text-slate-400 italic text-center py-1">No recent activity</p>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </section>

                {/* ========================================================================= */}
                {/* TIER 4: 🗂️ DAYCARE REPORTS & INTELLIGENCE SUITE (ALL 11 REPORTS DIRECTORY) */}
                {/* ========================================================================= */}
                <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-6 shadow-xl border border-indigo-900/50 relative overflow-hidden space-y-4">
                    <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-fuchsia-500/15 rounded-full blur-3xl pointer-events-none"></div>

                    {/* Directory Header */}
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-gradient-to-tr from-cyan-400 to-teal-400 text-slate-950 rounded-xl font-black shadow-md shadow-cyan-400/20">
                                    <FileSpreadsheet className="w-4 h-4" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                                        Daycare Reports & Intelligence Central
                                    </h2>
                                    <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed max-w-2xl mt-0.5">
                                        Complete operational, financial, provincial compliance, daily care, and licensing audit reports.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Category Filter Tabs */}
                        <div className="flex flex-wrap items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80 self-start md:self-auto shadow-inner">
                            {[
                                { key: 'all', label: 'All Reports (11)' },
                                { key: 'attendance', label: 'Attendance & Time (4)' },
                                { key: 'compliance', label: 'Compliance & Safety (2)' },
                                { key: 'finance', label: 'Finance & Subsidy (3)' },
                                { key: 'care', label: 'Daily Care (1)' },
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setReportFilter(tab.key as any)}
                                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all ${
                                        reportFilter === tab.key
                                            ? 'bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 shadow-2xs'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Report Cards Grid */}
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {filteredReports.map((report) => {
                            const IconComponent = report.icon;
                            return (
                                <div
                                    key={report.id}
                                    className={`bg-gradient-to-br ${report.cardBg} border rounded-2xl p-4 transition-all flex flex-col justify-between group shadow-md hover:shadow-lg hover:scale-[1.01]`}
                                >
                                    <div className="space-y-2.5">
                                        <div className="flex items-start justify-between gap-2.5">
                                            <div className={`p-2 rounded-xl ${report.iconBg} shadow-2xs group-hover:scale-105 transition-transform`}>
                                                <IconComponent className="w-4 h-4" />
                                            </div>
                                            <span className={`text-[9.5px] font-black px-2 py-0.5 rounded border ${report.badgeColor}`}>
                                                {report.badge}
                                            </span>
                                        </div>

                                        <div>
                                            <h3 className="text-xs sm:text-sm font-black text-white group-hover:text-cyan-300 transition-colors">
                                                {report.name}
                                            </h3>
                                            <p className="text-[11px] text-slate-300 leading-snug mt-1 line-clamp-2">
                                                {report.description}
                                            </p>
                                        </div>

                                        {/* Key Feature Highlights */}
                                        <div className="flex flex-wrap gap-1 pt-0.5">
                                            {report.highlights.map((h, i) => (
                                                <span key={i} className="text-[9px] font-bold bg-slate-900/80 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700/60">
                                                    • {h}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Links */}
                                    <div className="pt-2.5 border-t border-slate-700/50 mt-2.5 flex items-center justify-between gap-1.5">
                                        <Link
                                            to={report.path}
                                            className={`inline-flex items-center gap-1 px-3 py-1.5 ${report.btnBg} text-[10.5px] font-black rounded-lg shadow-2xs transition-all flex-1 justify-center hover:scale-[1.01]`}
                                        >
                                            <Eye className="w-3 h-3" />
                                            <span>Open Report</span>
                                        </Link>
                                        {report.dashboardPath && (
                                            <Link
                                                to={report.dashboardPath}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-[10.5px] font-bold rounded-lg border border-slate-700 transition-all"
                                                title="View Live Status Matrix"
                                            >
                                                <Activity className="w-3 h-3 text-cyan-300" />
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

            </div>
        </Layout>
    );
};

export default Dashboard;
