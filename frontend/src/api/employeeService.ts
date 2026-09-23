import api from '../api';

export interface EmploymentHistory {
    id: string;
    employee: string;
    employment_type: string;
    job_title: string;
    department: string | null;
    start_date: string;
    end_date: string | null;
    status: string;
    reason_for_change: string | null;
    notes: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface EmployeeCompensation {
    id: string;
    employee: string;
    pay_type?: string;
    compensation_type?: string;
    salary_amount?: string | null;
    hourly_rate?: string | null;
    amount?: string;
    currency?: string;
    frequency?: string;
    effective_from?: string | null;
    effective_to?: string | null;
    effective_date?: string;
    end_date?: string | null;
    reason_for_change?: string | null;
    status?: string;
    notes?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface EmployeeDocument {
    id: string;
    employee: string;
    document_type: string;
    document_name?: string;
    document_url?: string;
    file?: string;
    issue_date?: string | null;
    expiry_date?: string | null;
    status?: string;
    notes?: string | null;
    upload_date?: string;
    uploaded_date?: string;
    created_at?: string;
    updated_at?: string;
}


export interface EmployeeEmergencyContact {
    id: string;
    employee: string;
    name: string;
    relationship: string;
    phone: string;
    email: string | null;
    is_primary: boolean;
    notes: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface Province {
    id: string;
    code: string;
    name: string;
    status: string;
    created_at?: string;
    updated_at?: string;
}

export interface CredentialType {
    id: string;
    name: string;
    category: 'ece' | 'certification' | 'background_check' | 'training' | 'other';
    description: string | null;
    province: string | null;
    province_code?: string | null;
    province_name?: string | null;
    status: string;
    requires_expiry: boolean;
    requires_certificate_number: boolean;
    default_validity_months?: number | null;
    created_at?: string;
    updated_at?: string;
}

export interface ECECredential {
    id: string;
    employee: string;
    employee_name?: string;
    daycare?: string;
    credential_type: string;
    credential_type_detail?: CredentialType;
    category?: 'ece' | 'certification' | 'background_check' | 'training' | 'other';
    certificate_number: string | null;
    issuing_organization?: string | null;
    province: string | null;
    province_detail?: Province;
    request_date?: string | null;
    completed_date?: string | null;
    issue_date: string;
    expiry_date: string | null;
    renewal_date: string | null;
    document?: string | null;
    document_url?: string | null;
    document_reference?: string | null;
    document_status?: 'uploaded' | 'pending_review' | 'verified' | 'rejected' | 'expired';
    status: 'Active' | 'Expired' | 'Pending Renewal' | 'Suspended' | 'Revoked' | 'Inactive' | 'Pending Review' | 'Requires Review' | 'Superseded';
    verification_status: 'Unverified' | 'Pending Verification' | 'Verified' | 'Rejected';
    verified_by?: string | null;
    verified_by_name?: string | null;
    verified_at?: string | null;
    rejection_reason?: string | null;
    previous_credential?: string | null;
    is_current?: boolean;
    notes: string | null;
    is_expired?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface ExpiringCredentialItem {

    id: string;
    employee_id: string;
    employee_name: string;
    employee_number?: string;
    credential_name: string;
    category: string;
    category_display: string;
    certificate_number: string | null;
    province: string;
    province_code: string;
    issue_date: string;
    expiry_date: string | null;
    days_remaining: number | null;
    status: string;
    status_label: string;
    verification_status: string;
    document_url?: string | null;
}

export interface EmployeeComplianceItem {
    employee_id: string;
    employee_name: string;
    employee_number?: string;
    job_title: string;
    compliance_status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT' | 'PENDING_REVIEW';
    compliance_reason: string;
    has_ece: boolean;
    has_first_aid: boolean;
    has_background_check: boolean;
    missing_required: string[];
    expiring_credentials: string[];
    expired_credentials: string[];
    pending_credentials: string[];
}

export interface ComplianceStats {
    total_credentials: number;
    active_credentials: number;
    expiring_30_days: number;
    expiring_60_days: number;
    expired_credentials: number;
    pending_verification: number;
    missing_required_credentials: number;
    non_compliant_employees: number;
    total_employees: number;
    compliant_employees: number;
    warning_employees: number;
    pending_review_employees: number;
    expiring_list: ExpiringCredentialItem[];
    employee_compliance_summary: EmployeeComplianceItem[];
}

export interface CredentialReportData {

    title: string;
    columns: string[];
    rows: (string | number)[][];
    total: number;
}

export interface EmployeeCredentialHistoryEvent {
    id: string;
    date: string;
    credential_name: string;
    certificate_number: string;
    action: string;
    old_status?: string | null;
    new_status?: string | null;
    performed_by: string;
    details: string;
}

export interface ComplianceCheckItem {
    name: string;
    status: string;
    badge: 'success' | 'warning' | 'danger' | 'neutral';
    detail: string;
}

export interface EmployeeComplianceProfile {
    employee_id: string;
    employee_name: string;
    employee_number?: string;
    job_title: string;
    overall_status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT' | 'PENDING_REVIEW';
    overall_badge: string;
    compliance_reason: string;
    is_educator: boolean;
    checks: {
        ece: ComplianceCheckItem;
        first_aid: ComplianceCheckItem;
        cpr: ComplianceCheckItem;
        criminal_record: ComplianceCheckItem;
        vulnerable_sector: ComplianceCheckItem;
        food_safety: ComplianceCheckItem;
    };
    missing_required: string[];
    expiring_credentials: string[];
    expired_credentials: string[];
    pending_credentials: string[];
}

export interface EmployeeAvailability {
    id?: string;
    employee?: string;
    day_of_week: string;
    start_time: string | null;
    end_time: string | null;
    available_from?: string | null;
    available_to?: string | null;
    is_available: boolean;
    status?: 'Available' | 'Unavailable' | 'Custom hours';
    notes?: string | null;
    created_at?: string;
    updated_at?: string;
}


export interface EmployeeType {
    id: string;
    name: string;
    daycare?: number;
    is_eligible_for_classroom?: boolean;
    created_at?: string;
}


export interface EmployeeQualification {
    id: string;
    employee: string;
    qualification_name: string;
    institution: string;
    qualification_type: string;
    issue_date: string | null;
    completion_date: string | null;
    expiry_date: string | null;
    document_reference: string | null;
    status: string;
    notes: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface EmployeeCertification {
    id: string;
    employee: string;
    certification_name: string;
    certification_number: string | null;
    issuing_organization: string;
    issue_date: string | null;
    expiry_date: string | null;
    document_reference: string | null;
    status?: string;
    notes: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface ClassroomAssignmentInfo {
    id: string;
    classroom_id: string;
    classroom_name: string;
    classroom_code: string;
    branch_name?: string;
    assignment_type: 'Primary' | 'Assistant';
    status: 'Active' | 'Inactive';
    assigned_date: string;
    end_date: string | null;
    created_at?: string;
}

export interface Employee {
    id: string;
    daycare: number;
    user: any;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    email: string | null;
    phone: string | null;
    employee_number: string | null;
    role: string;
    job_title: string | null;
    employment_type: string | null;
    date_of_birth: string | null;
    start_date: string | null;
    end_date: string | null;
    status: 'active' | 'inactive' | 'on_leave' | 'suspended' | 'terminated' | 'archived';
    photo: string | null;
    sin: string | null;
    types?: string[];
    types_detail?: EmployeeType[];
    is_eligible_for_classroom?: boolean;
    current_classrooms?: Array<{
        assignment_id: string;
        classroom_id: string;
        classroom_name: string;
        classroom_code: string;
        assignment_type: string;
        assigned_date: string;
    }>;
    created_at: string;
    updated_at: string;
}

export interface StaffDashboardAlert {
    id: string;
    type: string;
    severity: 'danger' | 'warning' | 'info';
    title: string;
    description: string;
    employee_id?: string;
    employee_name?: string;
    classroom_id?: string;
    classroom_name?: string;
    date?: string;
}

export interface StaffDashboardData {
    metrics: {
        total_employees: number;
        active_employees: number;
        on_leave_employees: number;
        suspended_employees: number;
        terminated_employees: number;
        teachers: number;
        eces: number;
        assistants: number;
        certifications_expiring: number;
        documents_expiring: number;
        unassigned_teaching_staff_count: number;
    };
    unassigned_teaching_staff: Array<{
        id: string;
        name: string;
        employee_number: string;
        role: string;
        start_date: string;
    }>;
    staff_by_type: Array<{ name: string; count: number }>;
    staff_by_status: Array<{ status: string; count: number; color: string }>;
    alerts: StaffDashboardAlert[];
}

export interface StaffReportData {
    report_type: string;
    title: string;
    total_records: number;
    headers: string[];
    rows: string[][];
}

export const employeeService = {
    getEmployees: async (params?: any) => {
        const response = await api.get('/daycare/employees/', { params });
        return response.data;
    },
    
    getEmployee: async (id: string) => {
        const response = await api.get(`/daycare/employees/${id}/`);
        return response.data;
    },
    
    createEmployee: async (data: Partial<Employee>) => {
        const response = await api.post('/daycare/employees/', data);
        return response.data;
    },
    
    updateEmployee: async (id: string, data: Partial<Employee>) => {
        const response = await api.patch(`/daycare/employees/${id}/`, data);
        return response.data;
    },
    
    deleteEmployee: async (id: string) => {
        const response = await api.delete(`/daycare/employees/${id}/`);
        return response.data;
    },
    
    // Qualifications
    getQualifications: async (employeeId: string) => {
        const response = await api.get(`/daycare/employees/${employeeId}/qualifications/`);
        return response.data;
    },
    createQualification: async (employeeId: string, data: Partial<EmployeeQualification>) => {
        const response = await api.post(`/daycare/employees/${employeeId}/qualifications/`, data);
        return response.data;
    },
    updateQualification: async (id: string, data: Partial<EmployeeQualification>) => {
        const response = await api.patch(`/daycare/qualifications/${id}/`, data);
        return response.data;
    },
    deleteQualification: async (id: string) => {
        const response = await api.delete(`/daycare/qualifications/${id}/`);
        return response.data;
    },
    
    // Certifications
    getCertifications: async (employeeId: string) => {
        const response = await api.get(`/daycare/employees/${employeeId}/certifications/`);
        return response.data;
    },
    createCertification: async (employeeId: string, data: Partial<EmployeeCertification>) => {
        const response = await api.post(`/daycare/employees/${employeeId}/certifications/`, data);
        return response.data;
    },
    updateCertification: async (id: string, data: Partial<EmployeeCertification>) => {
        const response = await api.patch(`/daycare/certifications/${id}/`, data);
        return response.data;
    },
    deleteCertification: async (id: string) => {
        const response = await api.delete(`/daycare/certifications/${id}/`);
        return response.data;
    },

    // Emergency Contacts
    getEmergencyContacts: async (employeeId: string): Promise<EmployeeEmergencyContact[]> => {
        const response = await api.get(`/daycare/employees/${employeeId}/emergency-contacts/`);
        return response.data;
    },
    createEmergencyContact: async (employeeId: string, data: Partial<EmployeeEmergencyContact>): Promise<EmployeeEmergencyContact> => {
        const response = await api.post(`/daycare/employees/${employeeId}/emergency-contacts/`, data);
        return response.data;
    },
    updateEmergencyContact: async (id: string, data: Partial<EmployeeEmergencyContact>): Promise<EmployeeEmergencyContact> => {
        const response = await api.patch(`/daycare/employee-emergency-contacts/${id}/`, data);
        return response.data;
    },
    deleteEmergencyContact: async (id: string): Promise<void> => {
        await api.delete(`/daycare/employee-emergency-contacts/${id}/`);
    },

    // Availability
    getAvailability: async (employeeId: string): Promise<EmployeeAvailability[]> => {
        const response = await api.get(`/daycare/employees/${employeeId}/availability/`);
        return response.data;
    },
    updateAvailability: async (employeeId: string, data: EmployeeAvailability[] | Partial<EmployeeAvailability>): Promise<EmployeeAvailability[]> => {
        const response = await api.post(`/daycare/employees/${employeeId}/availability/`, data);
        return response.data;
    },

    // Classrooms
    getEmployeeClassrooms: async (employeeId: string): Promise<{ current_classrooms: ClassroomAssignmentInfo[]; history: ClassroomAssignmentInfo[] }> => {
        const response = await api.get(`/daycare/employees/${employeeId}/classrooms/`);
        return response.data;
    },

    // History (Employment + Audit Log)
    getEmployeeHistory: async (employeeId: string): Promise<{ employment_history: EmploymentHistory[]; audit_logs: any[] }> => {
        const response = await api.get(`/daycare/employees/${employeeId}/history/`);
        return response.data;
    },

    // Employment History
    getEmploymentHistory: async (params?: any) => {
        const response = await api.get('/daycare/employment-history/', { params });
        return response.data;
    },
    createEmploymentHistory: async (data: Partial<EmploymentHistory>) => {
        const response = await api.post('/daycare/employment-history/', data);
        return response.data;
    },
    updateEmploymentHistory: async (id: string, data: Partial<EmploymentHistory>) => {
        const response = await api.patch(`/daycare/employment-history/${id}/`, data);
        return response.data;
    },
    deleteEmploymentHistory: async (id: string) => {
        const response = await api.delete(`/daycare/employment-history/${id}/`);
        return response.data;
    },

    // Employee Compensation
    getEmployeeCompensation: async (params?: any) => {
        const response = await api.get('/daycare/employee-compensation/', { params });
        return response.data;
    },
    createEmployeeCompensation: async (data: Partial<EmployeeCompensation>) => {
        const response = await api.post('/daycare/employee-compensation/', data);
        return response.data;
    },
    updateEmployeeCompensation: async (id: string, data: Partial<EmployeeCompensation>) => {
        const response = await api.patch(`/daycare/employee-compensation/${id}/`, data);
        return response.data;
    },
    deleteEmployeeCompensation: async (id: string) => {
        const response = await api.delete(`/daycare/employee-compensation/${id}/`);
        return response.data;
    },

    // Employee Documents
    getEmployeeDocuments: async (params?: any) => {
        const response = await api.get('/daycare/employee-documents/', { params });
        return response.data;
    },
    createEmployeeDocument: async (data: Partial<EmployeeDocument>) => {
        const response = await api.post('/daycare/employee-documents/', data);
        return response.data;
    },
    updateEmployeeDocument: async (id: string, data: Partial<EmployeeDocument>) => {
        const response = await api.patch(`/daycare/employee-documents/${id}/`, data);
        return response.data;
    },
    deleteEmployeeDocument: async (id: string) => {
        const response = await api.delete(`/daycare/employee-documents/${id}/`);
        return response.data;
    },

    // Types
    getEmployeeTypes: async (): Promise<EmployeeType[]> => {
        const response = await api.get('/daycare/employeetypes/');
        return response.data;
    },

    createEmployeeType: async (data: Partial<EmployeeType>): Promise<EmployeeType> => {
        const response = await api.post('/daycare/employeetypes/', data);
        return response.data;
    },

    // Staff Dashboard
    getStaffDashboard: async (): Promise<StaffDashboardData> => {
        const response = await api.get('/daycare/employees/dashboard/');
        return response.data;
    },

    // Staff Reports
    getStaffReports: async (params: any): Promise<StaffReportData> => {
        const response = await api.get('/daycare/employees/reports/', { params });
        return response.data;
    },

    exportStaffReportsCsv: async (params: any): Promise<void> => {
        const response = await api.get('/daycare/employees/reports/', {
            params: { ...params, format: 'csv' },
            responseType: 'blob'
        });
        
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `${params.report_type || 'staff'}_report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // Canadian Staff Credentials, Reference Data & Checks
    getProvinces: async (): Promise<Province[]> => {
        const response = await api.get('/daycare/provinces/');
        return response.data;
    },

    getCredentialTypes: async (params?: { category?: string; province?: string }): Promise<CredentialType[]> => {
        const response = await api.get('/daycare/credential-types/', { params });
        return response.data;
    },

    getEmployeeCredentials: async (employeeId: string, params?: { category?: string; status?: string; province?: string; expiry_date?: string }): Promise<ECECredential[]> => {
        const response = await api.get(`/daycare/employees/${employeeId}/credentials/`, { params });
        return response.data;
    },

    createEmployeeCredential: async (employeeId: string, data: Partial<ECECredential>): Promise<ECECredential> => {
        const response = await api.post(`/daycare/employees/${employeeId}/credentials/`, data);
        return response.data;
    },

    getCredentialDetail: async (id: string): Promise<ECECredential> => {
        const response = await api.get(`/daycare/credentials/${id}/`);
        return response.data;
    },

    updateCredential: async (id: string, data: Partial<ECECredential>): Promise<ECECredential> => {
        const response = await api.patch(`/daycare/credentials/${id}/`, data);
        return response.data;
    },

    deleteCredential: async (id: string): Promise<void> => {
        await api.delete(`/daycare/credentials/${id}/`);
    },

    verifyCredential: async (id: string): Promise<ECECredential> => {
        const response = await api.post(`/daycare/credentials/${id}/verify/`);
        return response.data;
    },

    rejectCredential: async (id: string, rejection_reason: string): Promise<ECECredential> => {
        const response = await api.post(`/daycare/credentials/${id}/reject/`, { rejection_reason });
        return response.data;
    },

    renewCredential: async (id: string, data: any): Promise<ECECredential> => {
        const response = await api.post(`/daycare/credentials/${id}/renew/`, data);
        return response.data;
    },

    getCredentialHistory: async (id: string): Promise<ECECredential[]> => {
        const response = await api.get(`/daycare/credentials/${id}/history/`);
        return response.data;
    },

    uploadCredentialDocument: async (id: string, file: File): Promise<ECECredential> => {
        const formData = new FormData();
        formData.append('document', file);
        const response = await api.post(`/daycare/credentials/${id}/upload-document/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    getExpiringCredentials: async (params?: { days?: number; category?: string }): Promise<{ threshold_days: number; count: number; results: ECECredential[] }> => {
        const response = await api.get('/daycare/credentials/expiring/', { params });
        return response.data;
    },

    getComplianceDashboard: async (filters?: any): Promise<ComplianceStats> => {
        const response = await api.get('/daycare/credentials/dashboard/', { params: filters });
        return response.data;
    },

    sendComplianceAlerts: async (): Promise<{ alerts_sent: number; details: string[]; timestamp: string }> => {
        const response = await api.post('/daycare/credentials/send-alerts/');
        return response.data;
    },

    getCredentialReports: async (params: any): Promise<CredentialReportData> => {
        const response = await api.get('/daycare/credentials/reports/', { params });
        return response.data;
    },

    exportCredentialReportsCsv: async (params: any): Promise<void> => {
        const response = await api.get('/daycare/credentials/reports/', {
            params: { ...params, export_format: 'csv' },
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const filename = `credential_${params.report_type || 'report'}_${new Date().toISOString().slice(0, 10)}.csv`;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
    },

    getEmployeeCredentialHistory: async (employeeId: string): Promise<{ employee_id: string; employee_name: string; employee_number?: string; count: number; history: EmployeeCredentialHistoryEvent[] }> => {
        const response = await api.get(`/daycare/employees/${employeeId}/credential-history/`);
        return response.data;
    },


    getEmployeeComplianceProfile: async (employeeId: string): Promise<EmployeeComplianceProfile> => {
        const response = await api.get(`/daycare/employees/${employeeId}/compliance-profile/`);
        return response.data;
    }
};





