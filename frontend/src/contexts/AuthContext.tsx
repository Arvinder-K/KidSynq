import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

export interface DaycareLimits {
    max_students?: number;
    max_teachers?: number;
    max_staff?: number;
    max_classrooms?: number;
    max_branches?: number;
    max_storage_mb?: number;
}

export interface ActiveSubscriptionInfo {
    id: string;
    plan_name: string;
    status: string;
    expiry_date: string | null;
    billing_cycle: string;
    amount: number;
}

export interface User {
    id: number | string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    is_superuser: boolean;
    daycare?: { id?: number | string; name?: string } | string | null;
    daycare_limits?: DaycareLimits | null;
    subscription_features?: string[];
    active_subscription?: ActiveSubscriptionInfo | null;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (access: string, refresh: string) => Promise<User | null>;
    logout: () => void;
    hasFeature: (featureCode: string) => boolean;
    refetchUser: () => Promise<User | null>;
}

const defaultAuthContext: AuthContextType = {
    user: null,
    loading: true,
    login: async () => null,
    logout: () => {},
    hasFeature: () => false,
    refetchUser: async () => null,
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = async () => {
        try {
            const response = await api.get('/users/me/');
            setUser(response.data);
            return response.data;
        } catch (error) {
            console.error("Failed to fetch user", error);
            setUser(null);
            return null;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
            fetchUser();
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (access: string, refresh: string) => {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        return await fetchUser();
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
    };

    const hasFeature = (featureCode: string): boolean => {
        if (!user) return false;
        if (user.is_superuser) return true;
        if (!user.subscription_features || user.subscription_features.length === 0) return true; // Default to true if not restricted
        
        if (user.subscription_features.includes(featureCode)) return true;

        const aliases: Record<string, string[]> = {
            'staff_management': ['staff_management', 'staff'],
            'staff_scheduling': ['staff_scheduling', 'staff_management', 'staff'],
            'staff_training': ['staff_training', 'staff_management', 'staff'],
            'staff_attendance': ['staff_attendance', 'staff_scheduling', 'staff_management', 'attendance'],
            'timesheet_approvals': ['timesheet_approvals', 'timesheets', 'staff_scheduling'],
            'leave_management': ['leave_management', 'staff_scheduling'],
            'shift_swaps': ['shift_swaps', 'staff_scheduling'],
            'staff_shortages': ['staff_shortages', 'staff_scheduling', 'ratio_monitoring'],
            'overtime_timebank': ['overtime_timebank', 'staff_scheduling', 'billing_invoicing', 'billing'],
            'credential_compliance': ['credential_compliance', 'staff_management'],
            'students': ['students', 'student_management'],
            'family_management': ['family_management', 'students'],
            'admissions_waitlist': ['admissions_waitlist', 'admissions'],
            'waitlist': ['waitlist', 'admissions_waitlist'],
            'consent_forms': ['consent_forms'],
            'communication': ['communication', 'messaging'],
            'messaging': ['messaging', 'communication'],
            'sms': ['sms', 'communication', 'messaging'],
            'classrooms': ['classrooms', 'classroom_management'],
            'classroom_management': ['classroom_management', 'classrooms'],
            'age_groups': ['age_groups', 'classrooms', 'classroom_management'],
            'out_of_school': ['out_of_school', 'classrooms'],
            'branches': ['branches'],
            'attendance': ['attendance'],
            'attendance_command': ['attendance_command', 'attendance'],
            'safe_arrival': ['safe_arrival', 'attendance'],
            'pickup_verification': ['pickup_verification', 'safe_arrival'],
            'ratio_monitoring': ['ratio_monitoring'],
            'ratio_rules': ['ratio_rules', 'ratio_monitoring'],
            'emergency_info': ['emergency_info', 'health_safety'],
            'holidays_closures': ['holidays_closures', 'health_safety'],
            'health_safety': ['health_safety', 'emergency_info', 'holidays_closures'],
            'daily_reports': ['daily_reports'],
            'daily_reports_history': ['daily_reports_history', 'daily_reports'],
            'health_medication': ['health_medication', 'daily_reports', 'health_safety'],
            'incidents': ['incidents', 'daily_reports', 'health_safety'],
            'billing_invoicing': ['billing_invoicing', 'billing'],
            'billing': ['billing', 'billing_invoicing'],
            'payments': ['payments', 'payments_receipts', 'billing_invoicing', 'billing'],
            'payments_receipts': ['payments_receipts', 'payments', 'billing_invoicing', 'billing'],
            'subsidies_cwelcc': ['subsidies_cwelcc', 'subsidies_tax', 'billing'],
            'subsidies_tax': ['subsidies_tax', 'subsidies_cwelcc'],
            'tax_receipts': ['tax_receipts', 'subsidies_tax', 'billing'],
            'fee_structures': ['fee_structures', 'billing_invoicing', 'billing'],
            'discounts_credits': ['discounts_credits', 'billing_invoicing', 'billing'],
            'reports': ['reports', 'analytics', 'compliance_reports'],
            'analytics': ['analytics', 'reports'],
            'compliance_reports': ['compliance_reports', 'reports'],
            'gov_reporting': ['gov_reporting', 'compliance_reports', 'reports'],
            'attendance_reports': ['attendance_reports', 'attendance', 'reports'],
            'staff_reports': ['staff_reports', 'staff_scheduling', 'staff_management', 'reports'],
            'attendance_audit_trail': ['attendance_audit_trail', 'compliance_reports', 'attendance', 'reports'],
            'document_vault': ['document_vault', 'documents', 'document_manager'],
            'documents': ['documents', 'document_manager', 'document_vault'],
            'document_manager': ['document_manager', 'documents', 'document_vault']
        };

        const validCodes = aliases[featureCode] || [featureCode];
        return validCodes.some(code => user.subscription_features?.includes(code));
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, hasFeature, refetchUser: fetchUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    return context || defaultAuthContext;
};
