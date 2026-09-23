import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../../../components/Layout';
import {
    ShieldCheck,
    DollarSign,
    RefreshCw,
    Search,
    Filter,
    PlusCircle,
    Building2,
    Calendar,
    FileText,
    Eye,
    X,
    CheckCircle2,
    AlertCircle,
    UserCheck,
    Percent,
    Calculator,
    Edit2,
    Trash2,
    Sparkles,
    Check
} from 'lucide-react';
import {
    billingService,
    type ChildSubsidyProfile,
    type SubsidyClaimsSummary
} from '../../../api/billingService';

export const SubsidiesPage: React.FC = () => {
    const [subsidies, setSubsidies] = useState<ChildSubsidyProfile[]>([]);
    const [summary, setSummary] = useState<SubsidyClaimsSummary | null>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successNotice, setSuccessNotice] = useState<string | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
    const [isCalcModalOpen, setIsCalcModalOpen] = useState<boolean>(false);
    const [selectedSubsidy, setSelectedSubsidy] = useState<ChildSubsidyProfile | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        student: '',
        program_name: 'CWELCC 52.75% Fee Reduction',
        subsidy_type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_MONTHLY' | 'FIXED_DAILY' | 'CUSTOM_RATE',
        subsidy_rate: '52.75',
        currency: 'CAD',
        government_case_number: '',
        parent_co_pay_amount: '',
        approved_days_per_week: 5,
        effective_from: new Date().toISOString().split('T')[0],
        effective_until: '',
        is_active: true,
        notes: ''
    });
    const [submitting, setSubmitting] = useState<boolean>(false);

    // Simulation / Calculator state
    const [simBaseAmount, setSimBaseAmount] = useState<string>('1200.00');
    const [simSubsidyType, setSimSubsidyType] = useState<string>('PERCENTAGE');
    const [simRate, setSimRate] = useState<string>('52.75');
    const [simParentCoPay, setSimParentCoPay] = useState<string>('');

    const fetchData = async () => {
        try {
            setRefreshing(true);
            const [subsidiesRes, summaryRes, studentsRes] = await Promise.all([
                billingService.getSubsidies(),
                billingService.getSubsidyClaimsSummary(),
                billingService.getBillingStudents().catch(() => [])
            ]);
            setSubsidies(subsidiesRes);
            setSummary(summaryRes);
            setStudents(studentsRes);
        } catch (err: any) {
            console.error('Failed to fetch subsidies:', err);
            setError('Failed to load subsidies and CWELCC profiles. Please refresh.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredSubsidies = useMemo(() => {
        return subsidies.filter(sub => {
            const matchesSearch =
                (sub.student_name && sub.student_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (sub.family_name && sub.family_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (sub.program_name && sub.program_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (sub.government_case_number && sub.government_case_number.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesType = typeFilter === 'ALL' || sub.subsidy_type === typeFilter;
            const matchesStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'ACTIVE' && sub.is_active) ||
                (statusFilter === 'INACTIVE' && !sub.is_active);

            return matchesSearch && matchesType && matchesStatus;
        });
    }, [subsidies, searchQuery, typeFilter, statusFilter]);

    const handleOpenCreateModal = () => {
        setFormData({
            student: students.length > 0 ? students[0].id : '',
            program_name: 'CWELCC 52.75% Fee Reduction',
            subsidy_type: 'PERCENTAGE',
            subsidy_rate: '52.75',
            currency: 'CAD',
            government_case_number: '',
            parent_co_pay_amount: '',
            approved_days_per_week: 5,
            effective_from: new Date().toISOString().split('T')[0],
            effective_until: '',
            is_active: true,
            notes: ''
        });
        setIsCreateModalOpen(true);
    };

    const handleOpenEditModal = (sub: ChildSubsidyProfile) => {
        setSelectedSubsidy(sub);
        setFormData({
            student: sub.student,
            program_name: sub.program_name,
            subsidy_type: sub.subsidy_type,
            subsidy_rate: sub.subsidy_rate,
            currency: sub.currency || 'CAD',
            government_case_number: sub.government_case_number || '',
            parent_co_pay_amount: sub.parent_co_pay_amount || '',
            approved_days_per_week: sub.approved_days_per_week || 5,
            effective_from: sub.effective_from,
            effective_until: sub.effective_until || '',
            is_active: sub.is_active,
            notes: sub.notes || ''
        });
        setIsEditModalOpen(true);
    };

    const handleCreateSubsidy = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.student) {
            setError('Please select a student for this subsidy profile.');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);
            await billingService.createSubsidy({
                ...formData,
                parent_co_pay_amount: formData.parent_co_pay_amount || null,
                effective_until: formData.effective_until || null
            });
            setSuccessNotice('Child subsidy profile registered successfully.');
            setIsCreateModalOpen(false);
            fetchData();
            setTimeout(() => setSuccessNotice(null), 4000);
        } catch (err: any) {
            console.error('Failed to create subsidy:', err);
            setError(err.response?.data?.detail || 'Failed to create subsidy profile. Please verify data.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateSubsidy = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubsidy) return;

        try {
            setSubmitting(true);
            setError(null);
            await billingService.updateSubsidy(selectedSubsidy.id, {
                ...formData,
                parent_co_pay_amount: formData.parent_co_pay_amount || null,
                effective_until: formData.effective_until || null
            });
            setSuccessNotice('Subsidy profile updated successfully.');
            setIsEditModalOpen(false);
            setSelectedSubsidy(null);
            fetchData();
            setTimeout(() => setSuccessNotice(null), 4000);
        } catch (err: any) {
            console.error('Failed to update subsidy:', err);
            setError(err.response?.data?.detail || 'Failed to update subsidy profile.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteSubsidy = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to remove the subsidy profile for "${name}"?`)) {
            return;
        }
        try {
            await billingService.deleteSubsidy(id);
            setSuccessNotice('Subsidy profile deleted.');
            fetchData();
            setTimeout(() => setSuccessNotice(null), 4000);
        } catch (err: any) {
            console.error('Failed to delete subsidy:', err);
            setError('Failed to delete subsidy profile.');
        }
    };

    const applyPreset = (preset: 'CWELCC' | 'PROVINCIAL_FIXED' | 'DAILY_DIRECT') => {
        if (preset === 'CWELCC') {
            setFormData(prev => ({
                ...prev,
                program_name: 'CWELCC 52.75% Fee Reduction',
                subsidy_type: 'PERCENTAGE',
                subsidy_rate: '52.75',
                parent_co_pay_amount: ''
            }));
        } else if (preset === 'PROVINCIAL_FIXED') {
            setFormData(prev => ({
                ...prev,
                program_name: 'Provincial Childcare Subsidy',
                subsidy_type: 'FIXED_MONTHLY',
                subsidy_rate: '450.00',
                parent_co_pay_amount: '150.00'
            }));
        } else if (preset === 'DAILY_DIRECT') {
            setFormData(prev => ({
                ...prev,
                program_name: 'Municipal Daily Subsidy',
                subsidy_type: 'FIXED_DAILY',
                subsidy_rate: '22.50',
                parent_co_pay_amount: '5.00'
            }));
        }
    };

    // Calculate simulation breakdown
    const simBreakdown = useMemo(() => {
        const base = parseFloat(simBaseAmount) || 0;
        let subsidyAmt = 0;
        const rate = parseFloat(simRate) || 0;

        if (simSubsidyType === 'PERCENTAGE') {
            subsidyAmt = (base * rate) / 100;
        } else if (simSubsidyType === 'FIXED_MONTHLY') {
            subsidyAmt = rate;
        } else if (simSubsidyType === 'FIXED_DAILY') {
            subsidyAmt = rate * 20; // 20 day approximation
        }

        if (subsidyAmt > base) subsidyAmt = base;
        let parentPays = base - subsidyAmt;
        if (simParentCoPay) {
            const coPay = parseFloat(simParentCoPay) || 0;
            parentPays = coPay;
            subsidyAmt = Math.max(0, base - parentPays);
        }

        return {
            baseAmount: base.toFixed(2),
            subsidyAmount: subsidyAmt.toFixed(2),
            parentPays: parentPays.toFixed(2),
            percentageCovered: base > 0 ? ((subsidyAmt / base) * 100).toFixed(1) : '0'
        };
    }, [simBaseAmount, simSubsidyType, simRate, simParentCoPay]);

    return (
        <Layout>
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                {/* Modern Light Page Header */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                <ShieldCheck className="w-6 h-6" />
                            </span>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Subsidies & CWELCC</h1>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage Canada-Wide Early Learning and Child Care (CWELCC) fee reductions, municipal/provincial subsidies, and parent co-pay calculations.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsCalcModalOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors shadow-sm"
                        >
                            <Calculator className="w-4 h-4 text-emerald-600" />
                            Subsidy Simulator
                        </button>
                        <button
                            onClick={fetchData}
                            disabled={refreshing}
                            className="p-2 text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                            title="Refresh Subsidies"
                        >
                            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={handleOpenCreateModal}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                        >
                            <PlusCircle className="w-4 h-4" />
                            Add Subsidy Profile
                        </button>
                    </div>
                </div>

                {/* Notifications */}
                {successNotice && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm font-medium animate-fadeIn">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <span>{successNotice}</span>
                    </div>
                )}
                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-red-800 text-sm font-medium">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                        <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* KPI Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Subsidized Children</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">
                                {summary?.active_subsidized_children || 0}
                            </h3>
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium mt-1">
                                <UserCheck className="w-3.5 h-3.5" /> Enrolled with active profile
                            </span>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <UserCheck className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CWELCC Program Profiles</p>
                            <h3 className="text-2xl font-bold text-indigo-600 mt-1">
                                {summary?.cwelcc_profiles_count || 0}
                            </h3>
                            <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium mt-1">
                                <Percent className="w-3.5 h-3.5" /> 52.75% standard reduction
                            </span>
                        </div>
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Percent className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Direct Provincial / Municipal</p>
                            <h3 className="text-2xl font-bold text-amber-600 mt-1">
                                {summary?.provincial_direct_subsidy_count || 0}
                            </h3>
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium mt-1">
                                <Building2 className="w-3.5 h-3.5" /> Fixed / daily co-pay claims
                            </span>
                        </div>
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <Building2 className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by student, family, program, case #..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                                <option value="ALL">All Subsidy Types</option>
                                <option value="PERCENTAGE">Percentage / CWELCC</option>
                                <option value="FIXED_MONTHLY">Fixed Monthly</option>
                                <option value="FIXED_DAILY">Fixed Daily</option>
                                <option value="CUSTOM_RATE">Custom Rate</option>
                            </select>
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="ACTIVE">Active Only</option>
                            <option value="INACTIVE">Inactive Only</option>
                        </select>
                    </div>
                </div>

                {/* Subsidies List Table */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-gray-500">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                            <p>Loading subsidy profiles...</p>
                        </div>
                    ) : filteredSubsidies.length === 0 ? (
                        <div className="p-12 text-center">
                            <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <h3 className="text-lg font-semibold text-gray-900">No Subsidy Profiles Found</h3>
                            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                                No children currently match the search criteria. Click "Add Subsidy Profile" to link a student to CWELCC or government subsidies.
                            </p>
                            <button
                                onClick={handleOpenCreateModal}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                            >
                                <PlusCircle className="w-4 h-4" />
                                Add First Profile
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-700 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4">Student & Family</th>
                                        <th className="px-6 py-4">Program Name</th>
                                        <th className="px-6 py-4">Subsidy Type & Rate</th>
                                        <th className="px-6 py-4">Parent Co-Pay</th>
                                        <th className="px-6 py-4">Case #</th>
                                        <th className="px-6 py-4">Effective Dates</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 font-medium">
                                    {filteredSubsidies.map((sub) => (
                                        <tr key={sub.id} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-gray-900">{sub.student_name || 'Student'}</div>
                                                <div className="text-xs text-gray-500">{sub.family_name || 'Family'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-gray-900 font-medium flex items-center gap-1.5">
                                                    {sub.program_name.toLowerCase().includes('cwelcc') && (
                                                        <span className="p-1 bg-indigo-50 text-indigo-600 rounded">
                                                            <Sparkles className="w-3.5 h-3.5" />
                                                        </span>
                                                    )}
                                                    {sub.program_name}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {sub.approved_days_per_week} days/week approved
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">
                                                    {sub.subsidy_type === 'PERCENTAGE'
                                                        ? `${sub.subsidy_rate}%`
                                                        : `$${parseFloat(sub.subsidy_rate).toFixed(2)} ${sub.currency || 'CAD'}`}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {sub.subsidy_type_display || sub.subsidy_type}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {sub.parent_co_pay_amount ? (
                                                    <span className="font-semibold text-gray-900">
                                                        ${parseFloat(sub.parent_co_pay_amount).toFixed(2)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">Auto-calculated</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {sub.government_case_number ? (
                                                    <span className="font-mono text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200">
                                                        {sub.government_case_number}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-gray-600">
                                                <div>From: {sub.effective_from}</div>
                                                <div>Until: {sub.effective_until || 'Ongoing'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {sub.is_active ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <Check className="w-3 h-3" /> Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenEditModal(sub)}
                                                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Edit Profile"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSubsidy(sub.id, sub.student_name || 'Profile')}
                                                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete Profile"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Create / Edit Modal */}
                {(isCreateModalOpen || isEditModalOpen) && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                        <ShieldCheck className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">
                                            {isCreateModalOpen ? 'Add Child Subsidy Profile' : 'Edit Subsidy Profile'}
                                        </h3>
                                        <p className="text-xs text-gray-500">
                                            Configure government support, CWELCC percentage, or direct daily subsidies.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsCreateModalOpen(false);
                                        setIsEditModalOpen(false);
                                        setSelectedSubsidy(null);
                                    }}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={isCreateModalOpen ? handleCreateSubsidy : handleUpdateSubsidy} className="p-6 space-y-4">
                                {/* Presets Bar */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                        Quick Setup Presets
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => applyPreset('CWELCC')}
                                            className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            <Sparkles className="w-3.5 h-3.5" /> CWELCC (52.75%)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyPreset('PROVINCIAL_FIXED')}
                                            className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            <Building2 className="w-3.5 h-3.5" /> Provincial Fixed ($450)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyPreset('DAILY_DIRECT')}
                                            className="px-3 py-1.5 text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            <DollarSign className="w-3.5 h-3.5" /> Municipal Daily ($22.50)
                                        </button>
                                    </div>
                                </div>

                                {/* Student Selection */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Select Child / Student *
                                    </label>
                                    <select
                                        value={formData.student}
                                        onChange={(e) => setFormData({ ...formData, student: e.target.value })}
                                        disabled={isEditModalOpen}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white disabled:bg-gray-100"
                                        required
                                    >
                                        <option value="">-- Choose Student --</option>
                                        {students.map((st) => (
                                            <option key={st.id} value={st.id}>
                                                {st.name} {st.family_name ? `(${st.family_name})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Program Name */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Program / Subsidy Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.program_name}
                                        onChange={(e) => setFormData({ ...formData, program_name: e.target.value })}
                                        placeholder="e.g. CWELCC 52.75% Fee Reduction"
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Subsidy Type *
                                        </label>
                                        <select
                                            value={formData.subsidy_type}
                                            onChange={(e: any) => setFormData({ ...formData, subsidy_type: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                        >
                                            <option value="PERCENTAGE">Percentage Reduction (%)</option>
                                            <option value="FIXED_MONTHLY">Fixed Monthly Amount ($)</option>
                                            <option value="FIXED_DAILY">Fixed Daily Amount ($)</option>
                                            <option value="CUSTOM_RATE">Custom Rate</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            {formData.subsidy_type === 'PERCENTAGE' ? 'Subsidy Percentage (%) *' : 'Subsidy Amount ($) *'}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.subsidy_rate}
                                            onChange={(e) => setFormData({ ...formData, subsidy_rate: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-semibold"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Government Case Number (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.government_case_number}
                                            onChange={(e) => setFormData({ ...formData, government_case_number: e.target.value })}
                                            placeholder="e.g. SUB-2026-9921"
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Parent Co-Pay Amount ($) (Optional)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.parent_co_pay_amount}
                                            onChange={(e) => setFormData({ ...formData, parent_co_pay_amount: e.target.value })}
                                            placeholder="Leave blank for auto-calc"
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Approved Days/Wk
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="7"
                                            value={formData.approved_days_per_week}
                                            onChange={(e) => setFormData({ ...formData, approved_days_per_week: parseInt(e.target.value) || 5 })}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Effective From *
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.effective_from}
                                            onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Effective Until
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.effective_until}
                                            onChange={(e) => setFormData({ ...formData, effective_until: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="sub_is_active"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <label htmlFor="sub_is_active" className="text-sm text-gray-700 font-medium">
                                        Subsidy profile is active and eligible for invoice deductions
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Notes / Documentation
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="Add approval reference notes or provincial approval notes..."
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>

                                <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 -mx-6 -mb-6 bg-gray-50 rounded-b-2xl mt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsCreateModalOpen(false);
                                            setIsEditModalOpen(false);
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {submitting ? 'Saving...' : isCreateModalOpen ? 'Save Subsidy Profile' : 'Update Profile'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Subsidy Simulator Modal */}
                {isCalcModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
                            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                        <Calculator className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">CWELCC & Subsidy Simulator</h3>
                                        <p className="text-xs text-gray-500">Test parent co-pay and government reimbursement calculations.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsCalcModalOpen(false)}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Base Monthly Fee ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={simBaseAmount}
                                        onChange={(e) => setSimBaseAmount(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-semibold"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Subsidy Type</label>
                                        <select
                                            value={simSubsidyType}
                                            onChange={(e) => setSimSubsidyType(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                                        >
                                            <option value="PERCENTAGE">CWELCC Percentage (%)</option>
                                            <option value="FIXED_MONTHLY">Fixed Monthly ($)</option>
                                            <option value="FIXED_DAILY">Fixed Daily ($)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Rate Value</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={simRate}
                                            onChange={(e) => setSimRate(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-semibold"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Fixed Parent Co-Pay Override ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={simParentCoPay}
                                        onChange={(e) => setSimParentCoPay(e.target.value)}
                                        placeholder="Optional override"
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                                    />
                                </div>

                                {/* Results Box */}
                                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2 mt-4">
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Original Fee:</span>
                                        <span className="font-semibold text-gray-900">${simBreakdown.baseAmount}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-emerald-700 font-medium">
                                        <span>Subsidy / CWELCC Covered ({simBreakdown.percentageCovered}%):</span>
                                        <span>-${simBreakdown.subsidyAmount}</span>
                                    </div>
                                    <div className="border-t border-emerald-200 pt-2 flex justify-between text-base font-bold text-gray-900">
                                        <span>Parent Co-Pay Due:</span>
                                        <span className="text-emerald-700">${simBreakdown.parentPays}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-200 flex justify-end bg-gray-50 rounded-b-2xl">
                                <button
                                    onClick={() => setIsCalcModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                                >
                                    Close Simulator
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default SubsidiesPage;
