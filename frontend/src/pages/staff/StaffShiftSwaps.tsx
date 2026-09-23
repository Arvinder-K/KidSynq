import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { 
    ArrowLeftRight, CheckCircle2, AlertCircle, 
    User, MessageSquare, Send, Inbox,
    Ban
} from 'lucide-react';
import { 
    schedulingService, 
    type StaffMySwapsResponse 
} from '../../api/schedulingService';


export const StaffShiftSwaps: React.FC = () => {
    const [data, setData] = useState<StaffMySwapsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successNotice, setSuccessNotice] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'sent' | 'received'>('all');
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await schedulingService.getMySwaps();
            setData(res);
        } catch (err: any) {
            console.error("Failed to load shift swaps", err);
            setError("Could not load your shift swaps.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCancel = async (swapId: string) => {
        try {
            setCancellingId(swapId);
            await schedulingService.cancelShiftSwap(swapId);
            setSuccessNotice("Swap request cancelled.");
            fetchData();
            setTimeout(() => setSuccessNotice(null), 3000);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to cancel swap.");
        } finally {
            setCancellingId(null);
        }
    };

    const sentRequests = data?.sent_requests || [];
    const receivedRequests = data?.received_requests || [];
    const displayList = activeTab === 'sent' 
        ? sentRequests 
        : activeTab === 'received' 
            ? receivedRequests 
            : [...sentRequests, ...receivedRequests];

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                            <ArrowLeftRight className="w-7 h-7 text-indigo-600" />
                            <span>My Shift Swaps</span>
                        </h1>
                        <p className="text-xs text-slate-500 mt-1">
                            Track shift exchange requests sent to teammates and requests received.
                        </p>
                    </div>
                </div>

                {successNotice && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{successNotice}</span>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                            activeTab === 'all'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        All Requests ({sentRequests.length + receivedRequests.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('sent')}
                        className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                            activeTab === 'sent'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <Send className="w-3.5 h-3.5" />
                        <span>Sent by Me ({sentRequests.length})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('received')}
                        className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                            activeTab === 'received'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <Inbox className="w-3.5 h-3.5" />
                        <span>Received ({receivedRequests.length})</span>
                    </button>
                </div>

                {/* Swaps List */}
                {loading ? (
                    <div className="py-12 text-center text-slate-400 text-xs font-medium">Loading swap requests...</div>
                ) : displayList.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                        No shift swap requests found in this view.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {displayList.map((s) => (
                            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-slate-300 transition-colors">
                                <div className="flex items-center justify-between">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                        s.status === 'approved' 
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : s.status === 'rejected'
                                                ? 'bg-rose-100 text-rose-800'
                                                : s.status === 'cancelled'
                                                    ? 'bg-slate-100 text-slate-600'
                                                    : 'bg-amber-100 text-amber-800'
                                    }`}>
                                        {s.status}
                                    </span>

                                    {s.status === 'pending' && (
                                        <button
                                            onClick={() => handleCancel(s.id)}
                                            disabled={cancellingId === s.id}
                                            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50 flex items-center gap-1 transition-colors"
                                        >
                                            <Ban className="w-3.5 h-3.5" />
                                            <span>Cancel Request</span>
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested By</div>
                                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1">
                                            <User className="w-3.5 h-3.5 text-indigo-600" />
                                            <span>{s.requesting_employee_name}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-600 font-semibold pt-1">
                                            {s.requesting_shift_details.date}
                                        </div>
                                        <div className="text-[11px] text-indigo-600 font-bold">
                                            {s.requesting_shift_details.shift_start}–{s.requesting_shift_details.shift_end}
                                        </div>
                                    </div>

                                    <div className="space-y-1 border-l border-slate-200 pl-3">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Staff</div>
                                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1">
                                            <User className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>{s.target_employee_name}</span>
                                        </div>
                                        {s.target_shift_details ? (
                                            <>
                                                <div className="text-[11px] text-slate-600 font-semibold pt-1">
                                                    {s.target_shift_details.date}
                                                </div>
                                                <div className="text-[11px] text-emerald-600 font-bold">
                                                    {s.target_shift_details.shift_start}–{s.target_shift_details.shift_end}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-[11px] text-slate-400 italic pt-1">
                                                (Direct coverage)
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {s.reason && (
                                    <div className="text-xs text-slate-600 bg-slate-100/50 p-2.5 rounded-lg flex items-start gap-2">
                                        <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                        <span>"{s.reason}"</span>
                                    </div>
                                )}

                                {s.admin_notes && (
                                    <div className="text-xs text-indigo-700 bg-indigo-50 p-2.5 rounded-lg">
                                        <span className="font-bold">Supervisor Note: </span>
                                        <span>{s.admin_notes}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default StaffShiftSwaps;
