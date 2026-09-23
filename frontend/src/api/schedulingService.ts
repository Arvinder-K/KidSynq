import api from '../api';

export type ShiftType = 'regular' | 'opening' | 'closing' | 'custom';
export type ScheduleStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
export type BreakType = 'meal' | 'rest' | 'other';

export interface ShiftBreak {
    id?: string;
    schedule?: string;
    break_start: string;
    break_end: string;
    break_type: BreakType;
    is_paid: boolean;
    duration_minutes?: number;
    notes?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface StaffSchedule {
    id: string;
    daycare: string;
    employee: string;
    employee_name: string;
    employee_job_title: string | null;
    employee_role: string;
    employee_photo: string | null;
    employee_number: string | null;
    date: string;
    shift_start: string;
    shift_end: string;
    shift_type: ShiftType;
    classroom: string | null;
    classroom_name: string | null;
    branch: string | null;
    branch_name: string | null;
    status: ScheduleStatus;
    duties?: string | null;
    notes: string | null;
    created_by: string | null;
    created_by_name: string | null;
    duration_hours: number;
    total_shift_hours?: number;
    unpaid_break_hours?: number;
    paid_break_hours?: number;
    net_working_hours?: number;
    breaks?: ShiftBreak[];
    created_at?: string;
    updated_at?: string;
}

export interface ScheduledEducatorSummary {
    employee_id: string;
    name: string;
    role: string;
    shift_type: ShiftType;
    shift_timing: string;
    duties: string;
}

export interface ClassroomCoverageSlot {
    time_slot: string;
    slot_start: string;
    slot_end: string;
    required_staff: number;
    scheduled_staff_count: number;
    scheduled_educators: ScheduledEducatorSummary[];
    coverage_status: 'OK' | 'SHORTAGE' | 'SURPLUS';
    shortage: number;
}

export interface ClassroomCoverageResponse {
    classroom_id: string;
    room_name: string;
    age_group: string;
    capacity: number;
    enrolled_students: number;
    effective_children_count: number;
    ratio_standard: string;
    required_staff_per_hour: number;
    date: string;
    overall_status: 'COMPLIANT' | 'SHORTAGE';
    total_slots: number;
    ok_slots: number;
    shortage_slots: number;
    surplus_slots: number;
    hourly_coverage: ClassroomCoverageSlot[];
}

export interface ClassroomScheduleResponse {
    classroom: {
        id: string;
        room_name: string;
        room_code: string | null;
        capacity: number;
        status: string;
        age_group: string | null;
        primary_teacher: string | null;
        assistants: string[];
    };
    shifts: StaffSchedule[];
    coverage: ClassroomCoverageResponse;
}

export interface ScheduleFilters {
    start_date?: string;
    end_date?: string;
    date?: string;
    employee?: string;
    classroom?: string;
    branch?: string;
    shift_type?: string;
    status?: string;
    search?: string;
}

export interface ScheduleCopyPayload {
    source_start_date: string;
    source_end_date: string;
    target_start_date: string;
    employee_ids?: string[];
    classroom_id?: string | null;
    overwrite_conflicts?: boolean;
}

export interface ScheduleCopyResult {
    copied_count: number;
    skipped_count: number;
    created_ids: string[];
    skipped_conflicts: Array<{
        employee: string;
        date: string;
        shift: string;
        reason: string;
    }>;
}

export const schedulingService = {
    getSchedules: async (params?: ScheduleFilters): Promise<StaffSchedule[]> => {
        const response = await api.get('/daycare/schedules/', { params });
        return response.data;
    },

    getScheduleDetail: async (id: string): Promise<StaffSchedule> => {
        const response = await api.get(`/daycare/schedules/${id}/`);
        return response.data;
    },

    createSchedule: async (data: Partial<StaffSchedule>): Promise<StaffSchedule> => {
        const response = await api.post('/daycare/schedules/', data);
        return response.data;
    },

    updateSchedule: async (id: string, data: Partial<StaffSchedule>): Promise<StaffSchedule> => {
        const response = await api.patch(`/daycare/schedules/${id}/`, data);
        return response.data;
    },

    deleteSchedule: async (id: string): Promise<void> => {
        await api.delete(`/daycare/schedules/${id}/`);
    },

    copySchedule: async (data: ScheduleCopyPayload): Promise<ScheduleCopyResult> => {
        const response = await api.post('/daycare/schedules/copy/', data);
        return response.data;
    },

    // Classroom Schedule & Ratio Coverage
    getClassroomSchedule: async (classroomId: string, params?: { start_date?: string; end_date?: string; date?: string }): Promise<ClassroomScheduleResponse> => {
        const response = await api.get(`/daycare/classrooms/${classroomId}/schedule/`, { params });
        return response.data;
    },

    getClassroomCoverage: async (classroomId: string, dateStr?: string): Promise<ClassroomCoverageResponse> => {
        const response = await api.get(`/daycare/classrooms/${classroomId}/coverage/`, { params: { date: dateStr } });
        return response.data;
    },

    // Breaks Management
    getShiftBreaks: async (scheduleId: string): Promise<ShiftBreak[]> => {
        const response = await api.get(`/daycare/schedules/${scheduleId}/breaks/`);
        return response.data;
    },

    createShiftBreak: async (scheduleId: string, data: Partial<ShiftBreak>): Promise<ShiftBreak> => {
        const response = await api.post(`/daycare/schedules/${scheduleId}/breaks/`, data);
        return response.data;
    },

    deleteShiftBreak: async (scheduleId: string, breakId: string): Promise<void> => {
        await api.delete(`/daycare/schedules/${scheduleId}/breaks/${breakId}/`);
    },

    // Overtime Management
    getOvertimeRecords: async (params?: { employee?: string; status?: string; start_date?: string; end_date?: string }): Promise<OvertimeRecord[]> => {
        const response = await api.get('/daycare/scheduling/overtime/', { params });
        return response.data?.results || response.data || [];
    },

    calculateOvertime: async (data: { date: string; employee_id?: string; regular_hours_threshold?: number }): Promise<OvertimeRecord[]> => {
        const response = await api.post('/daycare/scheduling/overtime/calculate/', data);
        return response.data;
    },

    approveOvertime: async (id: string, sendToTimeBank: boolean = false): Promise<OvertimeRecord> => {
        const response = await api.post(`/daycare/scheduling/overtime/${id}/approve/`, { send_to_time_bank: sendToTimeBank });
        return response.data;
    },

    rejectOvertime: async (id: string, notes?: string): Promise<OvertimeRecord> => {
        const response = await api.post(`/daycare/scheduling/overtime/${id}/reject/`, { notes });
        return response.data;
    },

    // Time Bank
    getTimeBankTransactions: async (params?: { employee?: string; transaction_type?: string }): Promise<TimeBankTransaction[]> => {
        const response = await api.get('/daycare/scheduling/time-bank/', { params });
        return response.data?.results || response.data || [];
    },

    getTimeBankSummary: async (): Promise<TimeBankSummaryResponse> => {
        const response = await api.get('/daycare/scheduling/time-bank/summary/');
        return response.data;
    },

    adjustTimeBank: async (data: { employee_id: string; transaction_type: string; hours: number; reason: string }): Promise<TimeBankTransaction> => {
        const response = await api.post('/daycare/scheduling/time-bank/adjust/', data);
        return response.data;
    },

    getTimeBankRules: async (): Promise<TimeBankRule> => {
        const response = await api.get('/daycare/scheduling/time-bank/rules/');
        return response.data;
    },

    updateTimeBankRules: async (data: Partial<TimeBankRule>): Promise<TimeBankRule> => {
        const response = await api.patch('/daycare/scheduling/time-bank/rules/', data);
        return response.data;
    },

    // Shift Swap
    getShiftSwaps: async (params?: { status?: string; requesting_employee?: string; target_employee?: string }): Promise<ShiftSwapRequest[]> => {
        const response = await api.get('/daycare/scheduling/swaps/', { params });
        return response.data?.results || response.data || [];
    },

    createShiftSwap: async (data: { requesting_employee?: string; target_employee: string; requesting_shift: string; target_shift?: string; reason?: string }): Promise<ShiftSwapRequest> => {
        const response = await api.post('/daycare/scheduling/swaps/', data);
        return response.data;
    },

    approveShiftSwap: async (id: string, adminNotes?: string): Promise<ShiftSwapRequest> => {
        const response = await api.post(`/daycare/scheduling/swaps/${id}/approve/`, { admin_notes: adminNotes });
        return response.data;
    },

    rejectShiftSwap: async (id: string, adminNotes?: string): Promise<ShiftSwapRequest> => {
        const response = await api.post(`/daycare/scheduling/swaps/${id}/reject/`, { admin_notes: adminNotes });
        return response.data;
    },

    cancelShiftSwap: async (id: string): Promise<ShiftSwapRequest> => {
        const response = await api.post(`/daycare/scheduling/swaps/${id}/cancel/`);
        return response.data;
    },

    // Staff Self-Service
    getMySchedule: async (params?: { start_date?: string; end_date?: string }): Promise<StaffMyScheduleResponse> => {
        const response = await api.get('/daycare/staff/my-schedule/', { params });
        return response.data;
    },

    getMySwaps: async (): Promise<StaffMySwapsResponse> => {
        const response = await api.get('/daycare/staff/my-swaps/');
        return response.data;
    },

    // Phase 4: Leave Management
    getLeaveTypes: async (): Promise<LeaveType[]> => {
        const response = await api.get('/daycare/leave/types/');
        return response.data?.results || response.data || [];
    },

    createLeaveType: async (data: Partial<LeaveType>): Promise<LeaveType> => {
        const response = await api.post('/daycare/leave/types/', data);
        return response.data;
    },

    updateLeaveType: async (id: string, data: Partial<LeaveType>): Promise<LeaveType> => {
        const response = await api.patch(`/daycare/leave/types/${id}/`, data);
        return response.data;
    },

    getLeaveRequests: async (params?: { employee?: string; status?: string; leave_type?: string; start_date?: string; end_date?: string }): Promise<LeaveRequest[]> => {
        const response = await api.get('/daycare/leave/requests/', { params });
        return response.data?.results || response.data || [];
    },

    createLeaveRequest: async (data: { employee?: string; leave_type: string; start_date: string; end_date: string; reason?: string; notes?: string }): Promise<LeaveRequest> => {
        const response = await api.post('/daycare/leave/requests/', data);
        return response.data;
    },

    approveLeaveRequest: async (id: string, notes?: string): Promise<LeaveRequest> => {
        const response = await api.post(`/daycare/leave/requests/${id}/approve/`, { notes });
        return response.data;
    },

    rejectLeaveRequest: async (id: string, rejectionReason: string): Promise<LeaveRequest> => {
        const response = await api.post(`/daycare/leave/requests/${id}/reject/`, { rejection_reason: rejectionReason });
        return response.data;
    },

    cancelLeaveRequest: async (id: string): Promise<LeaveRequest> => {
        const response = await api.post(`/daycare/leave/requests/${id}/cancel/`);
        return response.data;
    },

    getLeaveCalendar: async (params?: { start_date?: string; end_date?: string }): Promise<LeaveRequest[]> => {
        const response = await api.get('/daycare/leave/calendar/', { params });
        return response.data?.results || response.data || [];
    },

    // Phase 4: Shortages & Notifications
    getShortages: async (params?: { date?: string; status?: string; alert_level?: string; start_date?: string; end_date?: string }): Promise<StaffShortageAlert[]> => {
        const response = await api.get('/daycare/scheduling/shortages/', { params });
        return response.data?.results || response.data || [];
    },

    scanShortages: async (data: { start_date?: string; end_date?: string }): Promise<StaffShortageAlert[]> => {
        const response = await api.post('/daycare/scheduling/shortages/scan/', data);
        return response.data?.results || response.data || [];
    },

    resolveShortageAlert: async (id: string, newStatus: 'acknowledged' | 'resolved' | 'active'): Promise<StaffShortageAlert> => {
        const response = await api.post(`/daycare/scheduling/shortages/${id}/resolve/`, { status: newStatus });
        return response.data;
    },

    getMyLeave: async (): Promise<StaffMyLeaveResponse> => {
        const response = await api.get('/daycare/staff/leave/');
        return response.data;
    },

    submitMyLeave: async (data: { leave_type: string; start_date: string; end_date: string; reason?: string; notes?: string }): Promise<LeaveRequest> => {
        const response = await api.post('/daycare/staff/leave/', data);
        return response.data;
    },

    getNotifications: async (params?: { is_read?: boolean }): Promise<StaffNotification[]> => {
        const response = await api.get('/daycare/notifications/', { params });
        return response.data?.results || response.data || [];
    },

    markNotificationRead: async (id: string): Promise<StaffNotification> => {
        const response = await api.post(`/daycare/notifications/${id}/mark-read/`);
        return response.data;
    },

    markAllNotificationsRead: async (): Promise<{ marked_read_count: number }> => {
        const response = await api.post('/daycare/notifications/mark-all-read/');
        return response.data;
    }
};


export interface OvertimeRecord {
    id: string;
    daycare: string;
    employee: string;
    employee_name: string;
    employee_number: string | null;
    date: string;
    scheduled_hours: number;
    actual_hours: number | null;
    regular_hours: number;
    overtime_hours: number;
    status: 'pending' | 'approved' | 'rejected';
    approved_by: string | null;
    approved_by_name: string | null;
    approved_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface TimeBankRule {
    id: string;
    daycare: string;
    is_enabled: boolean;
    max_balance_hours: number;
    require_approval: boolean;
    expiry_months: number | null;
    created_at: string;
    updated_at: string;
}

export interface TimeBankTransaction {
    id: string;
    daycare: string;
    employee: string;
    employee_name: string;
    transaction_type: 'overtime_credit' | 'time_off_debit' | 'manual_adjustment' | 'correction';
    hours: number;
    date: string;
    reason: string;
    balance_after: number;
    approved_by_name: string | null;
    overtime_record: string | null;
    created_at: string;
}

export interface EmployeeTimeBankSummary {
    employee_id: string;
    employee_name: string;
    employee_number: string | null;
    job_title: string | null;
    status: string;
    balance_hours: number;
    total_credited_hours: number;
    total_debited_hours: number;
    transaction_count: number;
    max_limit_reached: boolean;
}

export interface TimeBankSummaryResponse {
    rules: TimeBankRule;
    employee_balances: EmployeeTimeBankSummary[];
}

export interface ShiftSwapRequest {
    id: string;
    daycare: string;
    requesting_employee: string;
    requesting_employee_name: string;
    target_employee: string;
    target_employee_name: string;
    requesting_shift: string;
    requesting_shift_details: {
        id: string;
        date: string;
        shift_start: string | null;
        shift_end: string | null;
        shift_type: ShiftType;
        classroom_name: string;
    };
    target_shift: string | null;
    target_shift_details: {
        id: string;
        date: string;
        shift_start: string | null;
        shift_end: string | null;
        shift_type: ShiftType;
        classroom_name: string;
    } | null;
    reason: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    requested_at: string;
    approved_by: string | null;
    approved_by_name: string | null;
    reviewed_at: string | null;
    admin_notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface StaffMyScheduleResponse {
    employee_id: string;
    employee_name: string;
    time_bank_balance: number;
    pending_swaps_count: number;
    shifts: StaffSchedule[];
}

export interface StaffMySwapsResponse {
    sent_requests: ShiftSwapRequest[];
    received_requests: ShiftSwapRequest[];
}

export interface LeaveType {
    id: string;
    daycare: string;
    name: string;
    code: string;
    is_paid: boolean;
    requires_approval: boolean;
    color_code: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface LeaveRequest {
    id: string;
    daycare: string;
    employee: string;
    employee_name: string;
    employee_number: string | null;
    leave_type: string;
    leave_type_name: string;
    leave_type_code: string;
    leave_type_color: string;
    start_date: string;
    end_date: string;
    reason: string | null;
    notes: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    requested_at: string;
    approved_by: string | null;
    approved_by_name: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
    affected_shifts_count: number;
    affected_shifts?: Array<{
        shift_id: string;
        date: string;
        shift_start: string;
        shift_end: string;
        shift_type: ShiftType;
        classroom_name: string;
        branch_name: string | null;
        duties: string;
    }>;
    created_at: string;
    updated_at: string;
}

export interface StaffShortageAlert {
    id: string;
    daycare: string;
    date: string;
    classroom: string | null;
    classroom_name: string;
    alert_level: 'warning' | 'critical';
    required_staff: number;
    scheduled_staff: number;
    shortage_count: number;
    reason: string;
    status: 'active' | 'acknowledged' | 'resolved';
    created_at: string;
    updated_at: string;
}

export interface StaffNotification {
    id: string;
    daycare: string;
    user: string | null;
    employee: string | null;
    notification_type: 'leave_requested' | 'leave_approved' | 'leave_rejected' | 'shift_affected' | 'staff_shortage';
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

export interface StaffMyLeaveResponse {
    employee_id: string;
    employee_name: string;
    leave_types: LeaveType[];
    leave_requests: LeaveRequest[];
}

export default schedulingService;



