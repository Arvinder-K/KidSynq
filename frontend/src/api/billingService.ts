import api from '../api';

// =============================================================================
// INTERFACES & TYPES
// =============================================================================

// Phase 1: Fee Structures & Assignments
export interface FeeStructure {
    id: string;
    daycare: string;
    branch: string | null;
    branch_name?: string | null;
    program: string | null;
    program_name?: string | null;
    classroom: string | null;
    classroom_name?: string | null;
    name: string;
    description: string | null;
    fee_type: 'REGISTRATION' | 'MONTHLY' | 'WEEKLY' | 'DAILY' | 'HOURLY' | 'DEPOSIT' | 'OTHER';
    frequency: 'ONE_TIME' | 'MONTHLY' | 'WEEKLY' | 'DAILY' | 'HOURLY';
    amount: string;
    currency: string;
    effective_from: string;
    effective_until: string | null;
    is_active: boolean;
    applies_to: 'ALL' | 'PROGRAM' | 'BRANCH' | 'CLASSROOM' | 'INDIVIDUAL';
    version: number;
    parent_fee: string | null;
    created_by_name?: string | null;
    created_at?: string;
    updated_at?: string;
    versions_count?: number;
}

export interface ChildFeeAssignment {
    id: string;
    daycare: string;
    student: string;
    student_name?: string;
    enrollment: string | null;
    family: string | null;
    classroom_name?: string | null;
    fee_structure: string;
    fee_structure_name?: string;
    fee_type?: string;
    frequency?: string;
    custom_amount: string | null;
    discount_percentage: string;
    discount_reason: string | null;
    currency: string;
    effective_from: string;
    effective_until: string | null;
    is_active: boolean;
    notes: string | null;
    effective_rate?: string;
    created_at?: string;
    updated_at?: string;
}

export interface RegistrationFeeRecord {
    id: string;
    daycare: string;
    student: string;
    student_name?: string;
    enrollment: string | null;
    family: string | null;
    fee_structure: string;
    fee_structure_name?: string;
    amount: string;
    currency: string;
    status: 'PENDING' | 'INVOICED' | 'PAID' | 'WAIVED';
    waived_reason: string | null;
    waived_by_name?: string | null;
    waived_at: string | null;
    notes: string | null;
    created_at?: string;
}

export interface DepositRecord {
    id: string;
    daycare: string;
    student: string;
    student_name?: string;
    enrollment: string | null;
    family: string | null;
    fee_structure: string | null;
    fee_structure_name?: string | null;
    amount_charged: string;
    amount_held: string;
    amount_applied: string;
    amount_refunded: string;
    amount_forfeited: string;
    remaining_held: string;
    currency: string;
    status: 'CHARGED' | 'HELD' | 'PARTIALLY_APPLIED' | 'FULLY_APPLIED' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'FORFEITED';
    received_date: string | null;
    notes: string | null;
    created_at?: string;
    created_by_name?: string | null;
}

export interface BillingSummary {
    currency: string;
    total_fee_structures: number;
    active_fee_structures: number;
    monthly_childcare_fees: number;
    registration_fees: number;
    deposit_fees: number;
    active_child_assignments: number;
    total_deposits_held: string;
}

// Phase 2: Discounts, Credits, Sibling Rules & Late Fees
export interface DiscountRule {
    id: string;
    daycare: string;
    branch: string | null;
    branch_name?: string | null;
    program: string | null;
    program_name?: string | null;
    classroom: string | null;
    classroom_name?: string | null;
    family: string | null;
    family_name?: string | null;
    student: string | null;
    student_name?: string | null;
    enrollment: string | null;
    name: string;
    description: string | null;
    discount_type: 'PERCENTAGE' | 'FIXED';
    value: string;
    currency: string;
    applies_to: 'ALL' | 'STUDENT' | 'FAMILY' | 'ENROLLMENT' | 'PROGRAM' | 'CLASSROOM' | 'BRANCH' | 'FEE_TYPE';
    target_fee_type: string | null;
    eligibility_criteria?: Record<string, any>;
    priority: number;
    effective_from: string;
    effective_until: string | null;
    is_active: boolean;
    version: number;
    parent_rule: string | null;
    created_by_name?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface SiblingDiscountRule {
    id: string;
    daycare: string;
    name: string;
    description: string | null;
    discount_type: 'PERCENTAGE' | 'FIXED';
    value: string;
    currency: string;
    applies_to_target: 'SECOND_CHILD' | 'SUBSEQUENT_CHILDREN' | 'ALL_SIBLINGS';
    target_fee_selection: 'LOWEST_FEE' | 'HIGHEST_FEE' | 'EQUAL_APPLY';
    ordering_criteria: 'AGE_DESCENDING' | 'FEE_DESCENDING' | 'ENROLLMENT_DATE';
    min_enrolled_siblings: number;
    effective_from: string;
    effective_until: string | null;
    is_active: boolean;
    version: number;
    parent_rule: string | null;
    created_by_name?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface CreditTransaction {
    id: string;
    daycare: string;
    family: string;
    family_name?: string;
    student: string | null;
    student_name?: string | null;
    enrollment: string | null;
    amount: string;
    currency: string;
    transaction_type: 'CREDIT' | 'CREDIT_APPLIED' | 'CREDIT_ADJUSTMENT' | 'CREDIT_REVERSAL';
    reason: string;
    reference: string | null;
    notes: string | null;
    status: 'ACTIVE' | 'REVERSED' | 'VOID';
    reversed_transaction: string | null;
    created_by_name?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface LateFeeRule {
    id: string;
    daycare: string;
    name: string;
    description: string | null;
    fee_type: 'FIXED' | 'PERCENTAGE';
    amount: string;
    currency: string;
    grace_period_days: number;
    frequency: 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    max_amount: string | null;
    effective_from: string;
    effective_until: string | null;
    is_active: boolean;
    version: number;
    parent_rule: string | null;
    created_by_name?: string | null;
    created_at?: string;
    updated_at?: string;
}

// Phase 3: Invoices & Recurring Billing
export interface InvoiceItem {
    id: string;
    fee_structure: string | null;
    fee_structure_name?: string | null;
    student: string | null;
    student_name?: string | null;
    fee_type_code: string;
    description: string;
    quantity: string;
    unit_price: string;
    discount_amount: string;
    discount_description: string;
    tax_amount: string;
    subtotal: string;
    attendance_basis_meta?: Record<string, any>;
    rate_snapshot?: Record<string, any>;
}

export interface Invoice {
    id: string;
    daycare: string;
    daycare_name?: string;
    branch: string | null;
    branch_name?: string | null;
    family: string | null;
    family_name?: string | null;
    student: string | null;
    student_name?: string | null;
    enrollment: string | null;
    invoice_number: string;
    invoice_type: 'MONTHLY' | 'WEEKLY' | 'BI_WEEKLY' | 'DAILY' | 'HOURLY' | 'REGISTRATION' | 'DEPOSIT' | 'CUSTOM' | 'FAMILY';
    issue_date: string;
    due_date: string;
    billing_period_start: string | null;
    billing_period_end: string | null;
    subtotal: string;
    discount_total: string;
    tax_total: string;
    late_fee_total: string;
    credit_total: string;
    deposit_applied_total: string;
    total: string;
    amount_paid: string;
    balance_due: string;
    currency: string;
    status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID' | 'CANCELLED';
    notes: string;
    terms: string;
    void_reason?: string;
    cancelled_reason?: string;
    created_by_name?: string | null;
    created_at?: string;
    updated_at?: string;
    items?: InvoiceItem[];
    payments?: any[];
}

export interface RecurringBillingProfile {
    id: string;
    daycare: string;
    branch: string | null;
    branch_name?: string | null;
    family: string | null;
    family_name?: string | null;
    student: string | null;
    student_name?: string | null;
    fee_structure: string | null;
    fee_structure_name?: string | null;
    profile_name: string;
    frequency: 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY' | 'CUSTOM';
    billing_basis: 'CALENDAR_ADVANCE' | 'ATTENDANCE_ACTUAL' | 'TIMESHEET_HOURLY';
    auto_apply_credit: boolean;
    auto_apply_deposit: boolean;
    advance_generation_days: number;
    next_billing_date: string;
    start_date: string;
    end_date: string | null;
    is_active: boolean;
    notes: string;
    created_by_name?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface InvoiceStats {
    currency: string;
    total_invoiced_ytd: string;
    total_collected_ytd: string;
    total_outstanding: string;
    total_overdue: string;
    counts: {
        draft: number;
        issued: number;
        partially_paid: number;
        paid: number;
        overdue: number;
        void: number;
        cancelled: number;
        total: number;
    };
}

export interface InvoiceBatchPayload {
    billing_period_start: string;
    billing_period_end: string;
    issue_date?: string;
    due_date?: string;
    branch_id?: string;
    invoice_type?: 'FAMILY' | 'STUDENT';
    apply_available_credits?: boolean;
    apply_available_deposits?: boolean;
    notes?: string;
}

export interface InvoiceCreatePayload {
    family?: string;
    student?: string;
    branch?: string;
    issue_date?: string;
    due_date?: string;
    billing_period_start?: string;
    billing_period_end?: string;
    currency?: string;
    items?: Array<{
        fee_structure?: string;
        student?: string;
        fee_type_code?: string;
        description: string;
        quantity: string | number;
        unit_price: string | number;
        discount_amount?: string | number;
        discount_description?: string;
        tax_amount?: string | number;
        subtotal?: string | number;
    }>;
    apply_available_credits?: boolean;
    apply_available_deposits?: boolean;
    notes?: string;
    terms?: string;
}

// Phase 4: Payments, Subsidies, Tax Receipts & Statements
export interface Payment {
    id: string;
    daycare: string;
    daycare_name?: string;
    invoice: string;
    invoice_number: string;
    family: string | null;
    family_name?: string | null;
    student: string | null;
    student_name?: string | null;
    receipt_number: string | null;
    amount: string;
    currency: string;
    net_amount: string;
    payment_date: string;
    payment_method: 'CASH' | 'ETRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CHEQUE' | 'BANK_TRANSFER' | 'SUBSIDY_DIRECT' | 'OTHER';
    payment_method_display: string;
    status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'BOUNCED';
    status_display: string;
    transaction_reference: string | null;
    payer_name: string | null;
    payer_email: string | null;
    refunded_amount: string;
    refund_reason: string | null;
    refunded_at: string | null;
    notes: string | null;
    created_by?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface PaymentSummary {
    total_payments_count: number;
    total_collected: string;
    total_refunded: string;
    net_collected: string;
    currency: string;
    methods_breakdown: Record<string, number>;
}

export interface PaymentReceiptData {
    receipt_number: string;
    payment_date: string;
    amount: string;
    refunded_amount: string;
    net_amount: string;
    currency: string;
    payment_method: string;
    status: string;
    transaction_reference: string;
    payer_name: string;
    payer_email: string;
    notes: string;
    daycare: {
        name: string;
        address: string;
        phone: string;
        email: string;
        license_number: string;
    };
    invoice: {
        id: string;
        invoice_number: string;
        invoice_type: string;
        total_amount: string;
        balance_due: string;
        status: string;
    };
    student_name: string;
}

export interface ChildSubsidyProfile {
    id: string;
    daycare: string;
    student: string;
    student_name?: string;
    family: string | null;
    family_name?: string | null;
    program_name: string;
    subsidy_type: 'PERCENTAGE' | 'FIXED_MONTHLY' | 'FIXED_DAILY' | 'CUSTOM_RATE';
    subsidy_type_display: string;
    subsidy_rate: string;
    currency: string;
    government_case_number: string | null;
    parent_co_pay_amount: string | null;
    approved_days_per_week: number;
    effective_from: string;
    effective_until: string | null;
    is_active: boolean;
    notes: string | null;
    created_by_name?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface SubsidyClaimsSummary {
    active_subsidized_children: number;
    cwelcc_profiles_count: number;
    provincial_direct_subsidy_count: number;
    currency: string;
}

export interface TaxReceipt {
    id: string;
    daycare: string;
    family: string;
    family_name?: string | null;
    student: string | null;
    student_name?: string | null;
    tax_year: number;
    receipt_number: string;
    recipient_name: string;
    recipient_address: string | null;
    daycare_legal_name: string;
    daycare_business_number: string | null;
    daycare_address: string | null;
    total_eligible_fees_paid: string;
    total_subsidies_deducted: string;
    net_claimable_amount: string;
    currency: string;
    service_period_start: string;
    service_period_end: string;
    issued_date: string;
    status: 'DRAFT' | 'ISSUED' | 'VOID';
    status_display: string;
    void_reason: string | null;
    notes: string | null;
    created_by_name?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface TaxReceiptSlipData {
    receipt_number: string;
    tax_year: number;
    issued_date: string;
    service_period_start: string;
    service_period_end: string;
    daycare: {
        legal_name: string;
        business_number: string;
        address: string;
    };
    payer: {
        name: string;
        address: string;
        family_name: string;
    };
    student_name: string;
    financials: {
        total_eligible_fees_paid: string;
        total_subsidies_deducted: string;
        net_claimable_amount: string;
        currency: string;
    };
    status: string;
    notes: string;
}

export interface StatementEntry {
    date: string;
    type: 'INVOICE' | 'PAYMENT' | 'CREDIT' | 'REFUND';
    reference: string;
    description: string;
    debit: string;
    credit: string;
    running_balance: string;
    status: string;
}

export interface AccountStatement {
    family_id: string;
    family_name: string;
    statement_period_start: string;
    statement_period_end: string;
    currency: string;
    total_invoiced: string;
    total_paid: string;
    total_credits: string;
    closing_balance: string;
    entries: StatementEntry[];
}

// =============================================================================
// UNIFIED BILLING SERVICE OBJECT
// =============================================================================

export const billingService = {
    // -------------------------------------------------------------------------
    // Phase 1: Fee Structures & Summaries
    // -------------------------------------------------------------------------
    getSummary: async (): Promise<BillingSummary> => {
        const response = await api.get('daycare/billing/fee-structures/summary/');
        return response.data;
    },

    getFeeStructures: async (params?: Record<string, any>): Promise<FeeStructure[]> => {
        const response = await api.get('daycare/billing/fee-structures/', { params });
        return response.data.results || response.data;
    },

    getFeeStructure: async (id: string): Promise<FeeStructure> => {
        const response = await api.get(`daycare/billing/fee-structures/${id}/`);
        return response.data;
    },

    createFeeStructure: async (data: Partial<FeeStructure>): Promise<FeeStructure> => {
        const response = await api.post('daycare/billing/fee-structures/', data);
        return response.data;
    },

    updateFeeStructure: async (id: string, data: Partial<FeeStructure>): Promise<FeeStructure> => {
        const response = await api.patch(`daycare/billing/fee-structures/${id}/`, data);
        return response.data;
    },

    deleteFeeStructure: async (id: string): Promise<void> => {
        await api.delete(`daycare/billing/fee-structures/${id}/`);
    },

    activateFeeStructure: async (id: string): Promise<FeeStructure> => {
        const response = await api.post(`daycare/billing/fee-structures/${id}/activate/`);
        return response.data.fee || response.data;
    },

    deactivateFeeStructure: async (id: string): Promise<FeeStructure> => {
        const response = await api.post(`daycare/billing/fee-structures/${id}/deactivate/`);
        return response.data.fee || response.data;
    },

    createFeeVersion: async (id: string, data: { amount: string | number; effective_from: string; notes?: string }): Promise<FeeStructure> => {
        const response = await api.post(`daycare/billing/fee-structures/${id}/create_version/`, data);
        return response.data;
    },

    getFeeHistory: async (id: string): Promise<FeeStructure[]> => {
        const response = await api.get(`daycare/billing/fee-structures/${id}/history/`);
        return response.data;
    },

    // -------------------------------------------------------------------------
    // Phase 1: Child Fee Assignments
    // -------------------------------------------------------------------------
    getChildAssignments: async (params?: Record<string, any>): Promise<ChildFeeAssignment[]> => {
        const response = await api.get('daycare/billing/fee-assignments/', { params });
        return response.data.results || response.data;
    },

    getFeeAssignments: async (params?: Record<string, any>): Promise<ChildFeeAssignment[]> => {
        const response = await api.get('daycare/billing/fee-assignments/', { params });
        return response.data.results || response.data;
    },

    createChildAssignment: async (data: Partial<ChildFeeAssignment>): Promise<ChildFeeAssignment> => {
        const response = await api.post('daycare/billing/fee-assignments/', data);
        return response.data;
    },

    createFeeAssignment: async (data: Partial<ChildFeeAssignment>): Promise<ChildFeeAssignment> => {
        const response = await api.post('daycare/billing/fee-assignments/', data);
        return response.data;
    },

    updateChildAssignment: async (id: string, data: Partial<ChildFeeAssignment>): Promise<ChildFeeAssignment> => {
        const response = await api.patch(`daycare/billing/fee-assignments/${id}/`, data);
        return response.data;
    },

    updateFeeAssignment: async (id: string, data: Partial<ChildFeeAssignment>): Promise<ChildFeeAssignment> => {
        const response = await api.patch(`daycare/billing/fee-assignments/${id}/`, data);
        return response.data;
    },

    deleteChildAssignment: async (id: string): Promise<void> => {
        await api.delete(`daycare/billing/fee-assignments/${id}/`);
    },

    deleteFeeAssignment: async (id: string): Promise<void> => {
        await api.delete(`daycare/billing/fee-assignments/${id}/`);
    },

    resolveChildFee: async (studentId: string, dateStr?: string, feeType?: string): Promise<any> => {
        const response = await api.get('daycare/billing/fee-assignments/resolve-for-child/', {
            params: { student_id: studentId, date: dateStr, fee_type: feeType }
        });
        return response.data;
    },

    // -------------------------------------------------------------------------
    // Phase 1: Registration Fees
    // -------------------------------------------------------------------------
    getRegistrationFees: async (params?: Record<string, any>): Promise<RegistrationFeeRecord[]> => {
        const response = await api.get('daycare/billing/registration-fees/', { params });
        return response.data.results || response.data;
    },

    getRegistrationRecords: async (params?: Record<string, any>): Promise<RegistrationFeeRecord[]> => {
        const response = await api.get('daycare/billing/registration-fees/', { params });
        return response.data.results || response.data;
    },

    createRegistrationFee: async (data: { student: string; fee_structure: string; notes?: string }): Promise<any> => {
        const response = await api.post('daycare/billing/registration-fees/', data);
        return response.data;
    },

    createRegistrationRecord: async (data: Partial<RegistrationFeeRecord>): Promise<RegistrationFeeRecord> => {
        const response = await api.post('daycare/billing/registration-fees/', data);
        return response.data;
    },

    waiveRegistrationFee: async (id: string, reason: string): Promise<RegistrationFeeRecord> => {
        const response = await api.post(`daycare/billing/registration-fees/${id}/waive/`, { reason });
        return response.data.record || response.data;
    },

    // -------------------------------------------------------------------------
    // Phase 1: Deposits
    // -------------------------------------------------------------------------
    getDeposits: async (params?: Record<string, any>): Promise<DepositRecord[]> => {
        const response = await api.get('daycare/billing/deposits/', { params });
        return response.data.results || response.data;
    },

    getDepositRecords: async (params?: Record<string, any>): Promise<DepositRecord[]> => {
        const response = await api.get('daycare/billing/deposits/', { params });
        return response.data.results || response.data;
    },

    createDeposit: async (data: Partial<DepositRecord>): Promise<DepositRecord> => {
        const response = await api.post('daycare/billing/deposits/', data);
        return response.data;
    },

    createDepositRecord: async (data: Partial<DepositRecord>): Promise<DepositRecord> => {
        const response = await api.post('daycare/billing/deposits/', data);
        return response.data;
    },

    updateDepositRecord: async (id: string, data: Partial<DepositRecord>): Promise<DepositRecord> => {
        const response = await api.patch(`daycare/billing/deposits/${id}/`, data);
        return response.data;
    },

    processDepositAction: async (id: string, data: { action_type: string; amount: string | number; notes?: string }): Promise<any> => {
        const response = await api.post(`daycare/billing/deposits/${id}/process-action/`, data);
        return response.data;
    },

    // -------------------------------------------------------------------------
    // Phase 2: Discounts & Rules
    // -------------------------------------------------------------------------
    getDiscounts: async (params?: Record<string, any>): Promise<DiscountRule[]> => {
        const response = await api.get('daycare/billing/discounts/', { params });
        return response.data.results || response.data;
    },

    getDiscount: async (id: string): Promise<DiscountRule> => {
        const response = await api.get(`daycare/billing/discounts/${id}/`);
        return response.data;
    },

    createDiscount: async (data: Partial<DiscountRule>): Promise<DiscountRule> => {
        const response = await api.post('daycare/billing/discounts/', data);
        return response.data;
    },

    updateDiscount: async (id: string, data: Partial<DiscountRule>): Promise<DiscountRule> => {
        const response = await api.patch(`daycare/billing/discounts/${id}/`, data);
        return response.data;
    },

    deleteDiscount: async (id: string): Promise<void> => {
        await api.delete(`daycare/billing/discounts/${id}/`);
    },

    activateDiscount: async (id: string): Promise<any> => {
        const response = await api.post(`daycare/billing/discounts/${id}/activate/`);
        return response.data;
    },

    deactivateDiscount: async (id: string): Promise<any> => {
        const response = await api.post(`daycare/billing/discounts/${id}/deactivate/`);
        return response.data;
    },

    createDiscountVersion: async (id: string, data: { value: string | number; effective_from: string; notes?: string }): Promise<DiscountRule> => {
        const response = await api.post(`daycare/billing/discounts/${id}/create_version/`, data);
        return response.data;
    },

    getDiscountHistory: async (id: string): Promise<DiscountRule[]> => {
        const response = await api.get(`daycare/billing/discounts/${id}/history/`);
        return response.data;
    },

    getApplicableDiscounts: async (studentId: string, params?: { date?: string; base_amount?: string | number; fee_type?: string }): Promise<any> => {
        const response = await api.get('daycare/billing/discounts/applicable/', {
            params: { student_id: studentId, ...params }
        });
        return response.data;
    },

    // Phase 2: Sibling Discounts
    getSiblingDiscounts: async (params?: Record<string, any>): Promise<SiblingDiscountRule[]> => {
        const response = await api.get('daycare/billing/sibling-discounts/', { params });
        return response.data.results || response.data;
    },

    createSiblingDiscount: async (data: Partial<SiblingDiscountRule>): Promise<SiblingDiscountRule> => {
        const response = await api.post('daycare/billing/sibling-discounts/', data);
        return response.data;
    },

    updateSiblingDiscount: async (id: string, data: Partial<SiblingDiscountRule>): Promise<SiblingDiscountRule> => {
        const response = await api.patch(`daycare/billing/sibling-discounts/${id}/`, data);
        return response.data;
    },

    deleteSiblingDiscount: async (id: string): Promise<void> => {
        await api.delete(`daycare/billing/sibling-discounts/${id}/`);
    },

    activateSiblingDiscount: async (id: string): Promise<any> => {
        const response = await api.post(`daycare/billing/sibling-discounts/${id}/activate/`);
        return response.data;
    },

    deactivateSiblingDiscount: async (id: string): Promise<any> => {
        const response = await api.post(`daycare/billing/sibling-discounts/${id}/deactivate/`);
        return response.data;
    },

    createSiblingDiscountVersion: async (id: string, data: { value: string | number; effective_from: string; notes?: string }): Promise<SiblingDiscountRule> => {
        const response = await api.post(`daycare/billing/sibling-discounts/${id}/create_version/`, data);
        return response.data;
    },

    previewFamilySiblingDiscount: async (familyId: string, targetDate?: string, studentFeeMap?: Record<string, string | number>): Promise<any> => {
        const response = await api.post('daycare/billing/sibling-discounts/preview-family/', {
            family_id: familyId,
            target_date: targetDate,
            student_fee_map: studentFeeMap
        });
        return response.data;
    },

    // Phase 2: Credit Ledger
    getCredits: async (params?: Record<string, any>): Promise<CreditTransaction[]> => {
        const response = await api.get('daycare/billing/credits/', { params });
        return response.data.results || response.data;
    },

    getFamilyCreditBalance: async (familyId: string): Promise<{ family_id: string; family_name: string; available_credit_balance: string; currency: string }> => {
        const response = await api.get('daycare/billing/credits/balance/', { params: { family_id: familyId } });
        return response.data;
    },

    grantCredit: async (data: {
        family: string;
        amount: string | number;
        reason: string;
        transaction_type?: string;
        student?: string;
        reference?: string;
        notes?: string;
    }): Promise<CreditTransaction> => {
        const response = await api.post('daycare/billing/credits/grant/', data);
        return response.data.transaction || response.data;
    },

    applyCredit: async (data: {
        family: string;
        amount: string | number;
        reference: string;
        student?: string;
        notes?: string;
    }): Promise<CreditTransaction> => {
        const response = await api.post('daycare/billing/credits/apply/', data);
        return response.data.transaction || response.data;
    },

    reverseCredit: async (id: string, reason: string): Promise<CreditTransaction> => {
        const response = await api.post(`daycare/billing/credits/${id}/reverse/`, { reason });
        return response.data.reversal_transaction || response.data;
    },

    // Phase 2: Late Fees
    getLateFees: async (params?: Record<string, any>): Promise<LateFeeRule[]> => {
        const response = await api.get('daycare/billing/late-fees/', { params });
        return response.data.results || response.data;
    },

    createLateFee: async (data: Partial<LateFeeRule>): Promise<LateFeeRule> => {
        const response = await api.post('daycare/billing/late-fees/', data);
        return response.data;
    },

    updateLateFee: async (id: string, data: Partial<LateFeeRule>): Promise<LateFeeRule> => {
        const response = await api.patch(`daycare/billing/late-fees/${id}/`, data);
        return response.data;
    },

    deleteLateFee: async (id: string): Promise<void> => {
        await api.delete(`daycare/billing/late-fees/${id}/`);
    },

    activateLateFee: async (id: string): Promise<any> => {
        const response = await api.post(`daycare/billing/late-fees/${id}/activate/`);
        return response.data;
    },

    deactivateLateFee: async (id: string): Promise<any> => {
        const response = await api.post(`daycare/billing/late-fees/${id}/deactivate/`);
        return response.data;
    },

    createLateFeeVersion: async (id: string, data: { amount: string | number; effective_from: string; notes?: string }): Promise<LateFeeRule> => {
        const response = await api.post(`daycare/billing/late-fees/${id}/create_version/`, data);
        return response.data;
    },

    evaluateLateFee: async (data: { due_date: string; overdue_balance: string | number; evaluation_date?: string; rule_id?: string }): Promise<any> => {
        const response = await api.post('daycare/billing/late-fees/evaluate/', data);
        return response.data;
    },

    // Phase 2: Deterministic Breakdown Calculators
    calculateChildBreakdown: async (data: {
        student_id: string;
        target_date?: string;
        base_amount?: string | number;
        fee_type?: string;
        due_date?: string;
        overdue_balance?: string | number;
        evaluation_date?: string;
    }): Promise<any> => {
        const response = await api.post('daycare/billing/calculator/child-breakdown/', data);
        return response.data;
    },

    calculateFamilyBreakdown: async (data: {
        family_id: string;
        target_date?: string;
        apply_available_credits?: boolean;
        due_date?: string;
        evaluation_date?: string;
    }): Promise<any> => {
        const response = await api.post('daycare/billing/calculator/family-breakdown/', data);
        return response.data;
    },

    calculateProration: async (monthlyAmount: string | number, startDate: string, endDate?: string): Promise<any> => {
        const response = await api.post('daycare/billing/calculator/proration/', {
            monthly_amount: monthlyAmount,
            start_date: startDate,
            end_date: endDate
        });
        return response.data;
    },

    calculateSiblingDiscount: async (baseAmount: string | number, siblingCount: number, discountPercentage?: string | number): Promise<any> => {
        const response = await api.post('daycare/billing/calculator/sibling-discount/', {
            base_amount: baseAmount,
            sibling_count: siblingCount,
            discount_percentage: discountPercentage
        });
        return response.data;
    },

    // -------------------------------------------------------------------------
    // Phase 3: Invoices & Recurring Billing
    // -------------------------------------------------------------------------
    getInvoiceStats: async (): Promise<InvoiceStats> => {
        const response = await api.get('daycare/billing/invoices/stats/');
        return response.data;
    },

    getInvoices: async (params?: Record<string, any>): Promise<Invoice[]> => {
        const response = await api.get('daycare/billing/invoices/', { params });
        return response.data.results || response.data;
    },

    getInvoiceDetail: async (id: string): Promise<Invoice> => {
        const response = await api.get(`daycare/billing/invoices/${id}/`);
        return response.data;
    },

    getBillingFamilies: async (): Promise<any[]> => {
        try {
            const response = await api.get('daycare/billing/invoices/families/');
            if (Array.isArray(response.data) && response.data.length > 0) return response.data;
            if (Array.isArray(response.data?.results) && response.data.results.length > 0) return response.data.results;
        } catch (_) {}
        try {
            const fallback = await api.get('daycare/families/');
            if (Array.isArray(fallback.data?.results)) return fallback.data.results;
            if (Array.isArray(fallback.data)) return fallback.data;
        } catch (_) {}
        return [];
    },

    getFamilies: async (): Promise<any[]> => {
        return billingService.getBillingFamilies();
    },

    getBillingStudents: async (): Promise<any[]> => {
        try {
            const res = await api.get('daycare/billing/invoices/students/');
            if (Array.isArray(res.data) && res.data.length > 0) return res.data;
            if (Array.isArray(res.data?.results) && res.data.results.length > 0) return res.data.results;
        } catch (_) {}
        try {
            const fallback = await api.get('daycare/children/');
            if (Array.isArray(fallback.data?.results) && fallback.data.results.length > 0) {
                return fallback.data.results.map((c: any) => ({
                    id: c.id,
                    name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name || `Student #${c.id.slice(0, 6)}`,
                    first_name: c.first_name || '',
                    last_name: c.last_name || '',
                    family_id: c.family_id || null,
                    family_name: c.family_name || null
                }));
            }
            if (Array.isArray(fallback.data) && fallback.data.length > 0) {
                return fallback.data.map((c: any) => ({
                    id: c.id,
                    name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name || `Student #${c.id.slice(0, 6)}`,
                    first_name: c.first_name || '',
                    last_name: c.last_name || '',
                    family_id: c.family_id || null,
                    family_name: c.family_name || null
                }));
            }
        } catch (_) {}
        return [];
    },

    getStudents: async (): Promise<any[]> => {
        return billingService.getBillingStudents();
    },

    createInvoice: async (data: InvoiceCreatePayload): Promise<Invoice> => {
        const response = await api.post('daycare/billing/invoices/', data);
        return response.data;
    },

    issueInvoice: async (id: string): Promise<Invoice> => {
        const response = await api.post(`daycare/billing/invoices/${id}/issue/`);
        return response.data;
    },

    voidInvoice: async (id: string, reason?: string): Promise<Invoice> => {
        const response = await api.post(`daycare/billing/invoices/${id}/void/`, { reason });
        return response.data;
    },

    cancelInvoice: async (id: string, reason?: string): Promise<Invoice> => {
        const response = await api.post(`daycare/billing/invoices/${id}/cancel/`, { reason });
        return response.data;
    },

    applyCreditToInvoice: async (id: string, amount: string | number, notes?: string): Promise<Invoice> => {
        const response = await api.post(`daycare/billing/invoices/${id}/apply-credit/`, { amount, notes });
        return response.data;
    },

    applyDepositToInvoice: async (id: string, depositRecordId: string, amount: string | number, notes?: string): Promise<Invoice> => {
        const response = await api.post(`daycare/billing/invoices/${id}/apply-deposit/`, {
            deposit_record_id: depositRecordId,
            amount,
            notes
        });
        return response.data;
    },

    assessLateFee: async (id: string, evaluationDate?: string): Promise<Invoice> => {
        const response = await api.post(`daycare/billing/invoices/${id}/assess-late-fee/`, {
            evaluation_date: evaluationDate
        });
        return response.data;
    },

    assessLateFeeOnInvoice: async (id: string, amount?: string | number, lateFeeRuleId?: string): Promise<Invoice> => {
        const res = await api.post(`/daycare/billing/invoices/${id}/assess-late-fee/`, { amount, late_fee_rule_id: lateFeeRuleId });
        return res.data;
    },

    generateRegistrationInvoice: async (dataOrId: any): Promise<Invoice> => {
        const payload = typeof dataOrId === 'string' ? { registration_fee_id: dataOrId } : dataOrId;
        const response = await api.post('daycare/billing/invoices/generate-registration-invoice/', payload);
        return response.data;
    },

    generateBatchInvoices: async (data: InvoiceBatchPayload): Promise<{
        total_generated: number;
        total_skipped: number;
        generated_invoices: Invoice[];
        skipped: Array<{ family?: string; student?: string; reason: string }>;
    }> => {
        const response = await api.post('daycare/billing/invoices/generate-batch/', data);
        return response.data;
    },

    // Recurring Profiles
    getRecurringProfiles: async (params?: Record<string, any>): Promise<RecurringBillingProfile[]> => {
        const response = await api.get('daycare/billing/recurring-profiles/', { params });
        return response.data.results || response.data;
    },

    getRecurringProfile: async (id: string): Promise<RecurringBillingProfile> => {
        const response = await api.get(`daycare/billing/recurring-profiles/${id}/`);
        return response.data;
    },

    createRecurringProfile: async (data: Partial<RecurringBillingProfile>): Promise<RecurringBillingProfile> => {
        const response = await api.post('daycare/billing/recurring-profiles/', data);
        return response.data;
    },

    updateRecurringProfile: async (id: string, data: Partial<RecurringBillingProfile>): Promise<RecurringBillingProfile> => {
        const response = await api.patch(`daycare/billing/recurring-profiles/${id}/`, data);
        return response.data;
    },

    deleteRecurringProfile: async (id: string): Promise<void> => {
        await api.delete(`daycare/billing/recurring-profiles/${id}/`);
    },

    triggerRecurringProfileRun: async (id: string, targetDate?: string): Promise<any> => {
        const response = await api.post(`daycare/billing/recurring-profiles/${id}/trigger-run/`, {
            target_date: targetDate
        });
        return response.data;
    },

    triggerAllRecurringProfilesRun: async (targetDate?: string): Promise<any> => {
        const response = await api.post('daycare/billing/recurring-profiles/trigger-all/', {
            target_date: targetDate
        });
        return response.data;
    },

    triggerAllRecurringRuns: async (targetDate?: string): Promise<any> => {
        const response = await api.post('daycare/billing/recurring-profiles/trigger-all/', {
            target_date: targetDate
        });
        return response.data;
    },

    activateRecurringProfile: async (id: string): Promise<any> => {
        const response = await api.post(`daycare/billing/recurring-profiles/${id}/activate/`);
        return response.data;
    },

    deactivateRecurringProfile: async (id: string): Promise<any> => {
        const response = await api.post(`daycare/billing/recurring-profiles/${id}/deactivate/`);
        return response.data;
    },

    // -------------------------------------------------------------------------
    // Phase 4: Payments, Official Receipts & Refunds
    // -------------------------------------------------------------------------
    getPayments: async (params?: Record<string, any>): Promise<Payment[]> => {
        const res = await api.get('/daycare/billing/payments/', { params });
        return res.data.results || res.data;
    },

    getPaymentSummary: async (): Promise<PaymentSummary> => {
        const res = await api.get('/daycare/billing/payments/summary/');
        return res.data;
    },

    recordPayment: async (data: {
        invoice_id: string;
        amount: string | number;
        payment_method?: string;
        payment_date?: string;
        transaction_reference?: string;
        payer_name?: string;
        payer_email?: string;
        notes?: string;
    }): Promise<Payment> => {
        const res = await api.post('/daycare/billing/payments/', data);
        return res.data;
    },

    refundPayment: async (id: string, refundAmount: string | number, reason?: string): Promise<Payment> => {
        const res = await api.post(`/daycare/billing/payments/${id}/refund/`, {
            refund_amount: refundAmount,
            reason
        });
        return res.data;
    },

    getPaymentReceipt: async (id: string): Promise<PaymentReceiptData> => {
        const res = await api.get(`/daycare/billing/payments/${id}/receipt/`);
        return res.data;
    },

    // -------------------------------------------------------------------------
    // Phase 4: Government Subsidies & CWELCC
    // -------------------------------------------------------------------------
    getSubsidies: async (params?: Record<string, any>): Promise<ChildSubsidyProfile[]> => {
        const res = await api.get('/daycare/billing/subsidies/', { params });
        return res.data.results || res.data;
    },

    getSubsidyClaimsSummary: async (): Promise<SubsidyClaimsSummary> => {
        const res = await api.get('/daycare/billing/subsidies/claims-summary/');
        return res.data;
    },

    createSubsidy: async (data: Partial<ChildSubsidyProfile>): Promise<ChildSubsidyProfile> => {
        const res = await api.post('/daycare/billing/subsidies/', data);
        return res.data;
    },

    updateSubsidy: async (id: string, data: Partial<ChildSubsidyProfile>): Promise<ChildSubsidyProfile> => {
        const res = await api.patch(`/daycare/billing/subsidies/${id}/`, data);
        return res.data;
    },

    deleteSubsidy: async (id: string): Promise<void> => {
        await api.delete(`/daycare/billing/subsidies/${id}/`);
    },

    // -------------------------------------------------------------------------
    // Phase 4: Annual Tax Receipts (CRA / T2202)
    // -------------------------------------------------------------------------
    getTaxReceipts: async (params?: Record<string, any>): Promise<TaxReceipt[]> => {
        const res = await api.get('/daycare/billing/tax-receipts/', { params });
        return res.data.results || res.data;
    },

    generateTaxReceipt: async (data: { family_id: string; tax_year: number; student_id?: string }): Promise<TaxReceipt> => {
        const res = await api.post('/daycare/billing/tax-receipts/generate/', data);
        return res.data;
    },

    generateBatchTaxReceipts: async (taxYear: number): Promise<{ tax_year: number; generated_count: number; receipt_ids: string[] }> => {
        const res = await api.post('/daycare/billing/tax-receipts/generate-batch/', { tax_year: taxYear });
        return res.data;
    },

    voidTaxReceipt: async (id: string, reason?: string): Promise<TaxReceipt> => {
        const res = await api.post(`/daycare/billing/tax-receipts/${id}/void/`, { reason });
        return res.data;
    },

    getTaxReceiptSlip: async (id: string): Promise<TaxReceiptSlipData> => {
        const res = await api.get(`/daycare/billing/tax-receipts/${id}/print_slip/`);
        return res.data;
    },

    // -------------------------------------------------------------------------
    // Phase 4: Statements of Account
    // -------------------------------------------------------------------------
    getAccountStatement: async (familyId: string, startDate?: string, endDate?: string): Promise<AccountStatement> => {
        const res = await api.get('/daycare/billing/statements/', {
            params: { family_id: familyId, start_date: startDate, end_date: endDate }
        });
        return res.data;
    },

    // -------------------------------------------------------------------------
    // Phase 4: Family Portal Endpoints
    // -------------------------------------------------------------------------
    getFamilyPayments: async (): Promise<Payment[]> => {
        const res = await api.get('/family/billing/payments/');
        return res.data;
    },

    getFamilyPaymentReceipt: async (id: string): Promise<PaymentReceiptData> => {
        const res = await api.get(`/family/billing/payments/${id}/receipt/`);
        return res.data;
    },

    getFamilyTaxReceipts: async (taxYear?: number): Promise<TaxReceipt[]> => {
        const res = await api.get('/family/billing/tax-receipts/', { params: { tax_year: taxYear } });
        return res.data;
    },

    getFamilyTaxReceiptSlip: async (id: string): Promise<TaxReceiptSlipData> => {
        const res = await api.get(`/family/billing/tax-receipts/${id}/print/`);
        return res.data;
    },

    getFamilyStatement: async (startDate?: string, endDate?: string): Promise<AccountStatement> => {
        const res = await api.get('/family/billing/statement/', {
            params: { start_date: startDate, end_date: endDate }
        });
        return res.data;
    }
};

export default billingService;
