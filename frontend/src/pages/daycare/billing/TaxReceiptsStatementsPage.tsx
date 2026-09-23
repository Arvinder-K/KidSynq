import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../../../components/Layout';
import {
    Receipt,
    FileText,
    Printer,
    Download,
    Search,
    Filter,
    Calendar,
    Building2,
    CheckCircle2,
    AlertCircle,
    RotateCcw,
    X,
    Eye,
    PlusCircle,
    RefreshCw,
    ShieldCheck,
    DollarSign,
    Users,
    Layers,
    Clock,
    Ban,
    Sparkles,
    Check
} from 'lucide-react';
import {
    billingService,
    type TaxReceipt,
    type TaxReceiptSlipData,
    type AccountStatement,
    type StatementEntry
} from '../../../api/billingService';

export const TaxReceiptsStatementsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'TAX_RECEIPTS' | 'STATEMENTS'>('TAX_RECEIPTS');

    // Tax Receipts State
    const [taxReceipts, setTaxReceipts] = useState<TaxReceipt[]>([]);
    const [selectedTaxYear, setSelectedTaxYear] = useState<number>(new Date().getFullYear());
    const [taxReceiptSearch, setTaxReceiptSearch] = useState<string>('');
    const [taxReceiptStatusFilter, setTaxReceiptStatusFilter] = useState<string>('ALL');
    const [loadingReceipts, setLoadingReceipts] = useState<boolean>(true);

    // Statements State
    const [families, setFamilies] = useState<any[]>([]);
    const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
    const [statementStartDate, setStatementStartDate] = useState<string>('');
    const [statementEndDate, setStatementEndDate] = useState<string>('');
    const [statementData, setStatementData] = useState<AccountStatement | null>(null);
    const [loadingStatement, setLoadingStatement] = useState<boolean>(false);

    // Modals
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
    const [isVoidModalOpen, setIsVoidModalOpen] = useState<boolean>(false);
    const [isPrintStatementModalOpen, setIsPrintStatementModalOpen] = useState<boolean>(false);

    // Selected items for modal
    const [selectedReceipt, setSelectedReceipt] = useState<TaxReceipt | null>(null);
    const [slipData, setSlipData] = useState<TaxReceiptSlipData | null>(null);
    const [loadingSlip, setLoadingSlip] = useState<boolean>(false);
    const [voidReason, setVoidReason] = useState<string>('');

    // Single Generate Form
    const [genFamilyId, setGenFamilyId] = useState<string>('');
    const [genTaxYear, setGenTaxYear] = useState<number>(new Date().getFullYear());
    const [genStudentId, setGenStudentId] = useState<string>('');

    // Batch Generate Form
    const [batchTaxYear, setBatchTaxYear] = useState<number>(new Date().getFullYear());

    // General state
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successNotice, setSuccessNotice] = useState<string | null>(null);

    // Fetch Receipts
    const fetchTaxReceipts = async () => {
        try {
            setRefreshing(true);
            const res = await billingService.getTaxReceipts({ tax_year: selectedTaxYear });
            setTaxReceipts(res);
        } catch (err: any) {
            console.error('Failed to fetch tax receipts:', err);
            setError('Failed to load annual tax receipts.');
        } finally {
            setLoadingReceipts(false);
            setRefreshing(false);
        }
    };

    // Fetch Families
    const fetchFamiliesList = async () => {
        try {
            const fams = await billingService.getBillingFamilies();
            setFamilies(fams);
            if (fams.length > 0 && !selectedFamilyId) {
                setSelectedFamilyId(fams[0].id);
            }
        } catch (err: any) {
            console.error('Failed to fetch families list:', err);
        }
    };

    // Fetch Account Statement
    const fetchStatement = async (famId: string) => {
        if (!famId) return;
        try {
            setLoadingStatement(true);
            setError(null);
            const data = await billingService.getAccountStatement(
                famId,
                statementStartDate || undefined,
                statementEndDate || undefined
            );
            setStatementData(data);
        } catch (err: any) {
            console.error('Failed to fetch account statement:', err);
            setError('Failed to retrieve statement of account for selected family.');
            setStatementData(null);
        } finally {
            setLoadingStatement(false);
        }
    };

    useEffect(() => {
        fetchTaxReceipts();
        fetchFamiliesList();
    }, [selectedTaxYear]);

    useEffect(() => {
        if (activeTab === 'STATEMENTS' && selectedFamilyId) {
            fetchStatement(selectedFamilyId);
        }
    }, [activeTab, selectedFamilyId]);

    // Filtered tax receipts
    const filteredReceipts = useMemo(() => {
        return taxReceipts.filter((r) => {
            const matchesSearch =
                (r.receipt_number && r.receipt_number.toLowerCase().includes(taxReceiptSearch.toLowerCase())) ||
                (r.recipient_name && r.recipient_name.toLowerCase().includes(taxReceiptSearch.toLowerCase())) ||
                (r.family_name && r.family_name.toLowerCase().includes(taxReceiptSearch.toLowerCase())) ||
                (r.student_name && r.student_name.toLowerCase().includes(taxReceiptSearch.toLowerCase()));

            const matchesStatus =
                taxReceiptStatusFilter === 'ALL' || r.status === taxReceiptStatusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [taxReceipts, taxReceiptSearch, taxReceiptStatusFilter]);

    // Metrics for tax receipts
    const receiptMetrics = useMemo(() => {
        const issued = taxReceipts.filter((r) => r.status === 'ISSUED');
        const totalClaimable = issued.reduce(
            (sum, r) => sum + (parseFloat(r.net_claimable_amount) || 0),
            0
        );
        const totalSubsidies = issued.reduce(
            (sum, r) => sum + (parseFloat(r.total_subsidies_deducted) || 0),
            0
        );

        return {
            totalIssued: issued.length,
            totalClaimable: totalClaimable.toFixed(2),
            totalSubsidies: totalSubsidies.toFixed(2),
            voidCount: taxReceipts.filter((r) => r.status === 'VOID').length
        };
    }, [taxReceipts]);

    // Handlers
    const handleGenerateSingle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!genFamilyId) {
            setError('Please select a family to issue tax receipt.');
            return;
        }
        try {
            setSubmitting(true);
            setError(null);
            await billingService.generateTaxReceipt({
                family_id: genFamilyId,
                tax_year: genTaxYear,
                student_id: genStudentId || undefined
            });
            setSuccessNotice(`Tax receipt generated successfully for tax year ${genTaxYear}.`);
            setIsGenerateModalOpen(false);
            fetchTaxReceipts();
            setTimeout(() => setSuccessNotice(null), 4000);
        } catch (err: any) {
            console.error('Failed to generate tax receipt:', err);
            setError(err.response?.data?.detail || 'Failed to generate tax receipt.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleGenerateBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            setError(null);
            const res = await billingService.generateBatchTaxReceipts(batchTaxYear);
            setSuccessNotice(
                `Batch generation complete! Generated ${res.generated_count} tax receipts for year ${res.tax_year}.`
            );
            setIsBatchModalOpen(false);
            fetchTaxReceipts();
            setTimeout(() => setSuccessNotice(null), 5000);
        } catch (err: any) {
            console.error('Failed batch generation:', err);
            setError(err.response?.data?.detail || 'Batch generation failed.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenPrintModal = async (receipt: TaxReceipt) => {
        setSelectedReceipt(receipt);
        setIsPrintModalOpen(true);
        setLoadingSlip(true);
        try {
            const data = await billingService.getTaxReceiptSlip(receipt.id);
            setSlipData(data);
        } catch (err: any) {
            console.error('Failed to load tax slip data:', err);
            setError('Failed to load official tax slip data.');
        } finally {
            setLoadingSlip(false);
        }
    };

    const handleOpenVoidModal = (receipt: TaxReceipt) => {
        setSelectedReceipt(receipt);
        setVoidReason('');
        setIsVoidModalOpen(true);
    };

    const handleConfirmVoid = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReceipt) return;
        try {
            setSubmitting(true);
            setError(null);
            await billingService.voidTaxReceipt(selectedReceipt.id, voidReason);
            setSuccessNotice(`Tax receipt ${selectedReceipt.receipt_number} voided.`);
            setIsVoidModalOpen(false);
            setSelectedReceipt(null);
            fetchTaxReceipts();
            setTimeout(() => setSuccessNotice(null), 4000);
        } catch (err: any) {
            console.error('Failed to void tax receipt:', err);
            setError(err.response?.data?.detail || 'Failed to void tax receipt.');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePrintSlip = () => {
        window.print();
    };

    return (
        <Layout>
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                {/* Modern Light Page Header */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                <Receipt className="w-6 h-6" />
                            </span>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                                Tax Receipts & Statements
                            </h1>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Generate official annual childcare tax receipts (CRA / T2202 format) and view itemized running account statements for families.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (activeTab === 'TAX_RECEIPTS') fetchTaxReceipts();
                                else fetchStatement(selectedFamilyId);
                            }}
                            disabled={refreshing}
                            className="p-2 text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        {activeTab === 'TAX_RECEIPTS' ? (
                            <>
                                <button
                                    onClick={() => {
                                        setGenFamilyId(families.length > 0 ? families[0].id : '');
                                        setGenTaxYear(selectedTaxYear);
                                        setIsGenerateModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors shadow-sm"
                                >
                                    <PlusCircle className="w-4 h-4 text-indigo-600" />
                                    Generate Single
                                </button>
                                <button
                                    onClick={() => {
                                        setBatchTaxYear(selectedTaxYear);
                                        setIsBatchModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                                >
                                    <Layers className="w-4 h-4" />
                                    Batch Generate ({selectedTaxYear})
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsPrintStatementModalOpen(true)}
                                disabled={!statementData}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                            >
                                <Printer className="w-4 h-4" />
                                Print Account Statement
                            </button>
                        )}
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

                {/* Tabs Navigation */}
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8">
                        <button
                            onClick={() => setActiveTab('TAX_RECEIPTS')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                                activeTab === 'TAX_RECEIPTS'
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <Receipt className="w-4 h-4" />
                            Annual Tax Receipts (CRA / T2202)
                        </button>
                        <button
                            onClick={() => setActiveTab('STATEMENTS')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                                activeTab === 'STATEMENTS'
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <FileText className="w-4 h-4" />
                            Family Statements of Account
                        </button>
                    </nav>
                </div>

                {/* ========================================================================= */}
                {/* TAB 1: ANNUAL TAX RECEIPTS */}
                {/* ========================================================================= */}
                {activeTab === 'TAX_RECEIPTS' && (
                    <div className="space-y-6">
                        {/* KPI Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Tax Receipts Issued ({selectedTaxYear})
                                </p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                                    {receiptMetrics.totalIssued}
                                </h3>
                                <span className="text-xs text-indigo-600 font-medium">
                                    Official CRA format slips
                                </span>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Total Claimable Amount
                                </p>
                                <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                                    ${receiptMetrics.totalClaimable} CAD
                                </h3>
                                <span className="text-xs text-emerald-600 font-medium">
                                    Eligible child care expenses
                                </span>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Subsidies Deducted
                                </p>
                                <h3 className="text-2xl font-bold text-indigo-600 mt-1">
                                    ${receiptMetrics.totalSubsidies} CAD
                                </h3>
                                <span className="text-xs text-indigo-600 font-medium">
                                    CWELCC / Gov grants applied
                                </span>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Voided Receipts
                                </p>
                                <h3 className="text-2xl font-bold text-gray-500 mt-1">
                                    {receiptMetrics.voidCount}
                                </h3>
                                <span className="text-xs text-gray-400 font-medium">
                                    Cancelled or re-issued
                                </span>
                            </div>
                        </div>

                        {/* Filter Bar */}
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="relative w-full md:w-80">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by receipt #, recipient, student..."
                                    value={taxReceiptSearch}
                                    onChange={(e) => setTaxReceiptSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <select
                                        value={selectedTaxYear}
                                        onChange={(e) => setSelectedTaxYear(parseInt(e.target.value))}
                                        className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white font-semibold focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {[2026, 2025, 2024, 2023].map((y) => (
                                            <option key={y} value={y}>
                                                Tax Year {y}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <select
                                    value={taxReceiptStatusFilter}
                                    onChange={(e) => setTaxReceiptStatusFilter(e.target.value)}
                                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="ISSUED">Issued Only</option>
                                    <option value="VOID">Voided Only</option>
                                    <option value="DRAFT">Draft Only</option>
                                </select>
                            </div>
                        </div>

                        {/* Tax Receipts Table */}
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                            {loadingReceipts ? (
                                <div className="p-12 text-center text-gray-500">
                                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                                    <p>Loading tax receipts for year {selectedTaxYear}...</p>
                                </div>
                            ) : filteredReceipts.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        No Tax Receipts for {selectedTaxYear}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                                        No receipts have been generated for calendar year {selectedTaxYear} yet. You can batch generate for all enrolled families in one click.
                                    </p>
                                    <button
                                        onClick={() => {
                                            setBatchTaxYear(selectedTaxYear);
                                            setIsBatchModalOpen(true);
                                        }}
                                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                                    >
                                        <Layers className="w-4 h-4" />
                                        Batch Generate {selectedTaxYear} Receipts
                                    </button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-gray-600">
                                        <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-700 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-4">Receipt Number</th>
                                                <th className="px-6 py-4">Recipient / Family</th>
                                                <th className="px-6 py-4">Student</th>
                                                <th className="px-6 py-4">Eligible Fees Paid</th>
                                                <th className="px-6 py-4">Subsidies</th>
                                                <th className="px-6 py-4">Net Claimable</th>
                                                <th className="px-6 py-4">Issued Date</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 font-medium">
                                            {filteredReceipts.map((r) => (
                                                <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="font-mono text-xs font-bold px-2 py-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">
                                                            {r.receipt_number}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-semibold text-gray-900">{r.recipient_name}</div>
                                                        <div className="text-xs text-gray-500">{r.family_name || 'Family'}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-800">
                                                        {r.student_name || 'All Enrolled'}
                                                    </td>
                                                    <td className="px-6 py-4 font-semibold text-gray-900">
                                                        ${parseFloat(r.total_eligible_fees_paid).toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-indigo-600 font-medium">
                                                        -${parseFloat(r.total_subsidies_deducted).toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-emerald-700">
                                                        ${parseFloat(r.net_claimable_amount).toFixed(2)} {r.currency || 'CAD'}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-gray-600">
                                                        {r.issued_date}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {r.status === 'ISSUED' ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <Check className="w-3 h-3" /> Issued
                                                            </span>
                                                        ) : r.status === 'VOID' ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                                                <Ban className="w-3 h-3" /> Void
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                                                                {r.status_display || r.status}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleOpenPrintModal(r)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                                                                title="View / Print Tax Slip"
                                                            >
                                                                <Printer className="w-3.5 h-3.5" />
                                                                View Slip
                                                            </button>
                                                            {r.status === 'ISSUED' && (
                                                                <button
                                                                    onClick={() => handleOpenVoidModal(r)}
                                                                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                    title="Void Tax Receipt"
                                                                >
                                                                    <Ban className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* TAB 2: FAMILY STATEMENTS OF ACCOUNT */}
                {/* ========================================================================= */}
                {activeTab === 'STATEMENTS' && (
                    <div className="space-y-6">
                        {/* Selector & Date Filter */}
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="w-full md:w-96">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Select Family Account *
                                </label>
                                <select
                                    value={selectedFamilyId}
                                    onChange={(e) => setSelectedFamilyId(e.target.value)}
                                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">-- Choose Family --</option>
                                    {families.map((f) => (
                                        <option key={f.id} value={f.id}>
                                            {f.name} {f.parent_names ? `(${f.parent_names})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">From Date</label>
                                    <input
                                        type="date"
                                        value={statementStartDate}
                                        onChange={(e) => setStatementStartDate(e.target.value)}
                                        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">To Date</label>
                                    <input
                                        type="date"
                                        value={statementEndDate}
                                        onChange={(e) => setStatementEndDate(e.target.value)}
                                        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                                    />
                                </div>
                                <div className="pt-5">
                                    <button
                                        onClick={() => fetchStatement(selectedFamilyId)}
                                        disabled={!selectedFamilyId || loadingStatement}
                                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        Filter
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Statement Details */}
                        {loadingStatement ? (
                            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
                                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                                <p>Generating itemized statement of account...</p>
                            </div>
                        ) : !statementData ? (
                            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <h3 className="text-lg font-semibold text-gray-900">Select a Family to View Statement</h3>
                                <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                                    Select an enrolled family above to display an itemized audit ledger of invoices, recorded payments, refunds, and running balances.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Statement Summary Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Total Invoiced
                                        </p>
                                        <h3 className="text-2xl font-bold text-gray-900 mt-1">
                                            ${parseFloat(statementData.total_invoiced).toFixed(2)}
                                        </h3>
                                        <span className="text-xs text-gray-500">Total fees charged</span>
                                    </div>

                                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Total Paid
                                        </p>
                                        <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                                            ${parseFloat(statementData.total_paid).toFixed(2)}
                                        </h3>
                                        <span className="text-xs text-emerald-600 font-medium">
                                            Recorded payments & credits
                                        </span>
                                    </div>

                                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Credits & Adjustments
                                        </p>
                                        <h3 className="text-2xl font-bold text-indigo-600 mt-1">
                                            ${parseFloat(statementData.total_credits).toFixed(2)}
                                        </h3>
                                        <span className="text-xs text-indigo-600">Family credit ledger</span>
                                    </div>

                                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Closing Outstanding Due
                                        </p>
                                        <h3
                                            className={`text-2xl font-bold mt-1 ${
                                                parseFloat(statementData.closing_balance) > 0
                                                    ? 'text-rose-600'
                                                    : 'text-emerald-600'
                                            }`}
                                        >
                                            ${parseFloat(statementData.closing_balance).toFixed(2)} {statementData.currency}
                                        </h3>
                                        <span className="text-xs text-gray-500">
                                            {parseFloat(statementData.closing_balance) > 0
                                                ? 'Balance remaining'
                                                : 'Account clear'}
                                        </span>
                                    </div>
                                </div>

                                {/* Itemized Ledger Table */}
                                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                    <div className="p-4 border-b border-gray-200 bg-gray-50/70 flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-gray-900">
                                            Itemized Transaction Ledger ({statementData.family_name})
                                        </h3>
                                        <span className="text-xs text-gray-500">
                                            Period: {statementData.statement_period_start || 'All Time'} to{' '}
                                            {statementData.statement_period_end || 'Present'}
                                        </span>
                                    </div>

                                    {statementData.entries.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500 text-sm">
                                            No transaction records found for this family in the selected date range.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm text-gray-600">
                                                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-700 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-6 py-3">Date</th>
                                                        <th className="px-6 py-3">Type</th>
                                                        <th className="px-6 py-3">Reference</th>
                                                        <th className="px-6 py-3">Description</th>
                                                        <th className="px-6 py-3 text-right">Debit (+)</th>
                                                        <th className="px-6 py-3 text-right">Credit (-)</th>
                                                        <th className="px-6 py-3 text-right">Balance</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 font-medium">
                                                    {statementData.entries.map((entry, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                                                            <td className="px-6 py-3 text-xs text-gray-700">
                                                                {entry.date}
                                                            </td>
                                                            <td className="px-6 py-3">
                                                                <span
                                                                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                                        entry.type === 'INVOICE'
                                                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                            : entry.type === 'PAYMENT'
                                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                            : entry.type === 'REFUND'
                                                                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                                    }`}
                                                                >
                                                                    {entry.type}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-3 font-mono text-xs text-gray-900 font-semibold">
                                                                {entry.reference}
                                                            </td>
                                                            <td className="px-6 py-3 text-gray-800">
                                                                {entry.description}
                                                            </td>
                                                            <td className="px-6 py-3 text-right font-semibold text-gray-900">
                                                                {parseFloat(entry.debit) > 0 ? `$${entry.debit}` : '—'}
                                                            </td>
                                                            <td className="px-6 py-3 text-right font-semibold text-emerald-600">
                                                                {parseFloat(entry.credit) > 0 ? `-$${entry.credit}` : '—'}
                                                            </td>
                                                            <td className="px-6 py-3 text-right font-bold text-gray-900">
                                                                ${entry.running_balance}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================================= */}
                {/* MODAL 1: GENERATE SINGLE TAX RECEIPT */}
                {/* ========================================================================= */}
                {isGenerateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
                            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                        <Receipt className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">Generate Annual Tax Receipt</h3>
                                        <p className="text-xs text-gray-500">
                                            Calculates eligible fees paid and government subsidies for Canada CRA claims.
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setIsGenerateModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleGenerateSingle} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Select Family *</label>
                                    <select
                                        value={genFamilyId}
                                        onChange={(e) => setGenFamilyId(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                                        required
                                    >
                                        <option value="">-- Choose Family --</option>
                                        {families.map((f) => (
                                            <option key={f.id} value={f.id}>
                                                {f.name} {f.parent_names ? `(${f.parent_names})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tax Year *</label>
                                    <select
                                        value={genTaxYear}
                                        onChange={(e) => setGenTaxYear(parseInt(e.target.value))}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white font-semibold"
                                    >
                                        {[2026, 2025, 2024, 2023].map((y) => (
                                            <option key={y} value={y}>
                                                Calendar Year {y}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs text-indigo-900 space-y-1">
                                    <p className="font-semibold flex items-center gap-1.5">
                                        <Sparkles className="w-4 h-4 text-indigo-600" /> Auto-Aggregation Engine:
                                    </p>
                                    <p>
                                        Aggregates all recorded completed payments between Jan 1 and Dec 31 of {genTaxYear},
                                        deducts CWELCC and third-party subsidy grants, and assigns a unique official receipt serial number.
                                    </p>
                                </div>

                                <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 -mx-6 -mb-6 bg-gray-50 rounded-b-2xl mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsGenerateModalOpen(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {submitting ? 'Generating...' : 'Issue Official Tax Receipt'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* MODAL 2: BATCH GENERATE TAX RECEIPTS */}
                {/* ========================================================================= */}
                {isBatchModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
                            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                        <Layers className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">Batch Generate Tax Receipts</h3>
                                        <p className="text-xs text-gray-500">
                                            Mass issue annual childcare tax receipts for all enrolled families.
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setIsBatchModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleGenerateBatch} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Select Calendar Tax Year *
                                    </label>
                                    <select
                                        value={batchTaxYear}
                                        onChange={(e) => setBatchTaxYear(parseInt(e.target.value))}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white font-semibold"
                                    >
                                        {[2026, 2025, 2024, 2023].map((y) => (
                                            <option key={y} value={y}>
                                                Tax Year {y} (Jan 1, {y} – Dec 31, {y})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                                    <p className="font-semibold flex items-center gap-1.5">
                                        <ShieldCheck className="w-4 h-4 text-emerald-600" /> Batch Processing Guarantee:
                                    </p>
                                    <p>
                                        Each family with eligible payments will receive their official tax slip. Existing active receipts for the same year will be automatically updated with latest payments without duplicate serial creation.
                                    </p>
                                </div>

                                <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 -mx-6 -mb-6 bg-gray-50 rounded-b-2xl mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsBatchModalOpen(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {submitting ? 'Generating Slips...' : `Run Batch for Year ${batchTaxYear}`}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* MODAL 3: OFFICIAL PRINTABLE TAX SLIP (CRA / T2202 FORMAT) */}
                {/* ========================================================================= */}
                {isPrintModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
                            {/* Modal Header */}
                            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                                <div className="flex items-center gap-2">
                                    <Receipt className="w-5 h-5 text-indigo-600" />
                                    <span className="font-bold text-gray-900 text-sm">
                                        Official Child Care Expense Receipt (CRA Section 63)
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handlePrintSlip}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                                    >
                                        <Printer className="w-3.5 h-3.5" /> Print Tax Slip
                                    </button>
                                    <button
                                        onClick={() => setIsPrintModalOpen(false)}
                                        className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Slip Content */}
                            <div className="p-8 overflow-y-auto space-y-6 text-gray-900 print:p-0">
                                {loadingSlip || !slipData ? (
                                    <div className="py-12 text-center text-gray-500">
                                        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                                        <p>Loading tax receipt slip details...</p>
                                    </div>
                                ) : (
                                    <div className="border border-gray-300 rounded-xl p-6 bg-white space-y-6 shadow-sm">
                                        {/* Daycare Header */}
                                        <div className="flex justify-between items-start border-b border-gray-300 pb-4">
                                            <div>
                                                <h2 className="text-xl font-black text-gray-900 tracking-tight">
                                                    {slipData.daycare.legal_name || 'DAYCARE CENTER'}
                                                </h2>
                                                <p className="text-xs text-gray-600 mt-0.5">
                                                    {slipData.daycare.address || 'Daycare Campus'}
                                                </p>
                                                {slipData.daycare.business_number && (
                                                    <p className="text-xs font-mono text-gray-700 mt-1">
                                                        CRA Business Number (BN): <span className="font-bold">{slipData.daycare.business_number}</span>
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className="inline-block bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg text-right">
                                                    <p className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider">
                                                        Official Tax Slip
                                                    </p>
                                                    <p className="font-mono text-sm font-bold text-gray-900">
                                                        {slipData.receipt_number}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">Tax Year: <span className="font-bold text-gray-900">{slipData.tax_year}</span></p>
                                                <p className="text-xs text-gray-500">Issued: {slipData.issued_date}</p>
                                            </div>
                                        </div>

                                        {/* Payer & Child Details */}
                                        <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border border-gray-200 text-xs">
                                            <div>
                                                <p className="font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                                                    Received From (Payer):
                                                </p>
                                                <p className="text-sm font-bold text-gray-900">{slipData.payer.name}</p>
                                                <p className="text-gray-600">{slipData.payer.family_name}</p>
                                                <p className="text-gray-500 mt-0.5">{slipData.payer.address || 'Address on file'}</p>
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                                                    Child / Beneficiary:
                                                </p>
                                                <p className="text-sm font-bold text-gray-900">{slipData.student_name}</p>
                                                <p className="text-gray-600 mt-1">
                                                    Service Period: <span className="font-medium text-gray-800">{slipData.service_period_start} to {slipData.service_period_end}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Financial Breakdown Table */}
                                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-gray-100 font-bold text-gray-700">
                                                    <tr>
                                                        <th className="px-4 py-2.5">Child Care Expense Description</th>
                                                        <th className="px-4 py-2.5 text-right">Amount ({slipData.financials.currency})</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    <tr>
                                                        <td className="px-4 py-2.5 text-gray-800">
                                                            Total Gross Child Care Fees Paid in {slipData.tax_year}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                                                            ${parseFloat(slipData.financials.total_eligible_fees_paid).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td className="px-4 py-2.5 text-indigo-700">
                                                            Less: Government Subsidies / CWELCC Reductions Applied
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-semibold text-indigo-700">
                                                            -${parseFloat(slipData.financials.total_subsidies_deducted).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                    <tr className="bg-emerald-50/70 font-bold">
                                                        <td className="px-4 py-3 text-sm text-emerald-950">
                                                            Net Eligible Child Care Expense Amount Claimable
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-base text-emerald-700 font-black">
                                                            ${parseFloat(slipData.financials.net_claimable_amount).toFixed(2)} {slipData.financials.currency}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* CRA Notice & Legal Sign-off */}
                                        <div className="text-[11px] text-gray-500 leading-relaxed border-t border-gray-200 pt-3">
                                            <p>
                                                This document is an official childcare expense tax receipt issued for personal income tax deduction purposes under Section 63 of the Income Tax Act (Canada). Please retain this document with your tax records.
                                            </p>
                                        </div>

                                        {/* Signature Line */}
                                        <div className="flex justify-between items-end pt-6 border-t border-gray-200">
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-gray-400">Daycare Authorization</p>
                                                <p className="text-xs font-semibold text-gray-800 mt-1">Authorized Administrator</p>
                                                <p className="text-[10px] text-gray-500">KidSynq Child Care Management Platform</p>
                                            </div>
                                            <div className="text-center">
                                                <div className="w-40 border-b border-gray-400 mb-1" />
                                                <p className="text-[10px] text-gray-400">Authorized Signature / Stamp</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* MODAL 4: VOID TAX RECEIPT */}
                {/* ========================================================================= */}
                {isVoidModalOpen && selectedReceipt && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
                            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                                        <Ban className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">Void Tax Receipt</h3>
                                        <p className="text-xs text-gray-500">Receipt: {selectedReceipt.receipt_number}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsVoidModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleConfirmVoid} className="p-6 space-y-4">
                                <p className="text-sm text-gray-600">
                                    Are you sure you want to void receipt <span className="font-bold text-gray-900">{selectedReceipt.receipt_number}</span> for <span className="font-semibold">{selectedReceipt.recipient_name}</span>?
                                </p>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Reason for Voiding *
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={voidReason}
                                        onChange={(e) => setVoidReason(e.target.value)}
                                        placeholder="e.g. Payment correction or duplicate receipt re-issued..."
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                                        required
                                    />
                                </div>

                                <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 -mx-6 -mb-6 bg-gray-50 rounded-b-2xl mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsVoidModalOpen(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {submitting ? 'Voiding...' : 'Confirm Void'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* MODAL 5: PRINT STATEMENT OF ACCOUNT */}
                {/* ========================================================================= */}
                {isPrintStatementModalOpen && statementData && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-600" />
                                    <span className="font-bold text-gray-900 text-sm">
                                        Statement of Account — {statementData.family_name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => window.print()}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                                    >
                                        <Printer className="w-3.5 h-3.5" /> Print Statement
                                    </button>
                                    <button
                                        onClick={() => setIsPrintStatementModalOpen(false)}
                                        className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-8 overflow-y-auto space-y-6 text-gray-900 print:p-0">
                                <div className="border border-gray-300 rounded-xl p-6 bg-white space-y-6 shadow-sm">
                                    <div className="flex justify-between items-start border-b border-gray-300 pb-4">
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">STATEMENT OF ACCOUNT</h2>
                                            <p className="text-xs text-gray-600 mt-1">
                                                Family: <span className="font-semibold text-gray-900">{statementData.family_name}</span>
                                            </p>
                                        </div>
                                        <div className="text-right text-xs text-gray-600">
                                            <p>Date Generated: {new Date().toLocaleDateString()}</p>
                                            <p>Currency: {statementData.currency}</p>
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div className="grid grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg text-center text-xs">
                                        <div>
                                            <p className="text-gray-500 font-semibold">Total Invoiced</p>
                                            <p className="text-base font-bold text-gray-900 mt-1">${statementData.total_invoiced}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 font-semibold">Total Payments</p>
                                            <p className="text-base font-bold text-emerald-600 mt-1">${statementData.total_paid}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 font-semibold">Credits Applied</p>
                                            <p className="text-base font-bold text-indigo-600 mt-1">${statementData.total_credits}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 font-semibold">Closing Balance</p>
                                            <p className="text-base font-bold text-rose-600 mt-1">${statementData.closing_balance}</p>
                                        </div>
                                    </div>

                                    {/* Ledger */}
                                    <table className="w-full text-left text-xs border border-gray-200 rounded-lg overflow-hidden">
                                        <thead className="bg-gray-100 font-bold text-gray-700">
                                            <tr>
                                                <th className="px-4 py-2">Date</th>
                                                <th className="px-4 py-2">Type</th>
                                                <th className="px-4 py-2">Reference</th>
                                                <th className="px-4 py-2">Description</th>
                                                <th className="px-4 py-2 text-right">Debit</th>
                                                <th className="px-4 py-2 text-right">Credit</th>
                                                <th className="px-4 py-2 text-right">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {statementData.entries.map((e, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-2">{e.date}</td>
                                                    <td className="px-4 py-2 font-semibold">{e.type}</td>
                                                    <td className="px-4 py-2 font-mono">{e.reference}</td>
                                                    <td className="px-4 py-2">{e.description}</td>
                                                    <td className="px-4 py-2 text-right">{parseFloat(e.debit) > 0 ? `$${e.debit}` : '—'}</td>
                                                    <td className="px-4 py-2 text-right text-emerald-600">{parseFloat(e.credit) > 0 ? `-$${e.credit}` : '—'}</td>
                                                    <td className="px-4 py-2 text-right font-bold">${e.running_balance}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default TaxReceiptsStatementsPage;
