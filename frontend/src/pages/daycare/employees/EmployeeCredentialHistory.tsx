import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    History, ArrowLeft, AlertTriangle,
    CheckCircle2, XCircle, User, RefreshCw
} from 'lucide-react';


import Layout from '../../../components/Layout';
import { employeeService, type EmployeeCredentialHistoryEvent } from '../../../api/employeeService';

export const EmployeeCredentialHistory: React.FC<{ employeeIdProp?: string }> = ({ employeeIdProp }) => {
    const params = useParams();
    const navigate = useNavigate();
    const employeeId = employeeIdProp || params.id;

    const [events, setEvents] = useState<EmployeeCredentialHistoryEvent[]>([]);
    const [employeeName, setEmployeeName] = useState('');
    const [employeeNumber, setEmployeeNumber] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadHistory = async () => {
        if (!employeeId) return;
        try {
            setLoading(true);
            setError(null);
            const res = await employeeService.getEmployeeCredentialHistory(employeeId);
            setEvents(res.history || []);
            setEmployeeName(res.employee_name || 'Employee');
            setEmployeeNumber(res.employee_number || '');
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to load credential history.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, [employeeId]);

    const getActionBadge = (action: string) => {
        if (action.includes('Verified')) {
            return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> {action}</span>;
        }
        if (action.includes('Rejected')) {
            return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200"><XCircle className="w-3 h-3 text-red-600" /> {action}</span>;
        }
        if (action.includes('Renewed') || action.includes('Superseded')) {
            return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200"><RefreshCw className="w-3 h-3 text-indigo-600" /> {action}</span>;
        }
        if (action.includes('Alert')) {
            return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200"><AlertTriangle className="w-3 h-3 text-amber-600" /> {action}</span>;
        }
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{action}</span>;
    };

    const content = (
        <div className="space-y-6 pb-12">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
                <div>
                    <button
                        onClick={() => navigate(`/daycare/employees/${employeeId}`)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Employee Profile
                    </button>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                        <History className="w-7 h-7 text-indigo-600" />
                        CREDENTIAL AUDIT & LIFECYCLE HISTORY
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Historical timeline of verification actions, renewals, document uploads, and compliance alerts for <strong className="text-slate-700">{employeeName}</strong> {employeeNumber ? `(#${employeeNumber})` : ''}.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={loadHistory}
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
            )}

            {/* Timeline List */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6">
                {loading ? (
                    <div className="py-16 flex justify-center items-center">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : events.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                        No credential history or audit events recorded for this employee.
                    </div>
                ) : (
                    <div className="relative border-l-2 border-slate-100 ml-4 pl-6 space-y-6">
                        {events.map((evt, idx) => (
                            <div key={evt.id || idx} className="relative group">
                                {/* Dot indicator */}
                                <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-white border-2 border-indigo-600 group-hover:scale-125 transition-transform" />

                                <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/70 hover:bg-slate-50 transition-colors">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            {getActionBadge(evt.action)}
                                            <span className="text-xs font-bold text-slate-900">{evt.credential_name}</span>
                                            {evt.certificate_number && (
                                                <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                    #{evt.certificate_number}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[11px] font-medium text-slate-400">
                                            {evt.date}
                                        </span>
                                    </div>

                                    {(evt.old_status || evt.new_status) && (
                                        <div className="mt-2 text-xs text-slate-600 flex items-center gap-2">
                                            <span className="text-slate-400 text-[11px]">Status Transition:</span>
                                            <span className="font-semibold text-slate-700">{evt.old_status || 'New'}</span>
                                            <span className="text-slate-400">→</span>
                                            <span className="font-bold text-indigo-700">{evt.new_status || 'Updated'}</span>
                                        </div>
                                    )}

                                    {evt.details && (
                                        <div className="mt-2 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80">
                                            {evt.details}
                                        </div>
                                    )}

                                    <div className="mt-2.5 text-[11px] text-slate-400 flex items-center gap-1.5">
                                        <User className="w-3 h-3 text-slate-400" /> Performed by: <strong className="text-slate-600">{evt.performed_by}</strong>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    // If rendered as a standalone page, wrap in Layout; if rendered in tab, return content directly
    if (employeeIdProp) {
        return content;
    }

    return <Layout>{content}</Layout>;
};

export default EmployeeCredentialHistory;
