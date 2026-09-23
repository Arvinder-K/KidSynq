import React, { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import api from '../../api';
import type { Child } from './ChildProfileLayout';
import { 
    Clock, Calendar, User, Info, CheckCircle, ArrowRightLeft, 
    FileText, Activity, AlertTriangle, ShieldCheck 
} from 'lucide-react';

interface ContextType {
    child: Child;
}

interface HistoryEvent {
    id: string;
    date: string;
    event: string;
    performed_by: string;
    details: string;
}

const ChildHistory: React.FC = () => {
    const context = useOutletContext<ContextType>();
    const { id: routeId } = useParams<{ id: string }>();
    const childId = context?.child?.id || routeId || '';

    const [events, setEvents] = useState<HistoryEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (childId) {
            fetchHistory();
        }
    }, [childId]);

    const fetchHistory = async () => {
        if (!childId) return;
        setLoading(true);
        setError('');
        try {
            const response = await api.get(`/daycare/children/${childId}/history/`);
            const raw = response.data?.results || response.data || [];
            setEvents(Array.isArray(raw) ? raw : []);
        } catch (err: any) {
            console.error("Failed to fetch history logs", err);
            const detail = err.response?.data?.detail || "Failed to load historical timeline.";
            setError(detail);
        } finally {
            setLoading(false);
        }
    };


    const getEventIcon = (event: string) => {
        const lowerEvent = event.toLowerCase();
        if (lowerEvent.includes('admission')) {
            return <CheckCircle className="w-5 h-5 text-emerald-600" />;
        }
        if (lowerEvent.includes('withdraw')) {
            return <AlertTriangle className="w-5 h-5 text-amber-600" />;
        }
        if (lowerEvent.includes('transfer')) {
            return <ArrowRightLeft className="w-5 h-5 text-blue-600" />;
        }
        if (lowerEvent.includes('document')) {
            return <FileText className="w-5 h-5 text-indigo-600" />;
        }
        if (lowerEvent.includes('medical') || lowerEvent.includes('vaccination')) {
            return <Activity className="w-5 h-5 text-red-600" />;
        }
        if (lowerEvent.includes('archived')) {
            return <Clock className="w-5 h-5 text-gray-600" />;
        }
        if (lowerEvent.includes('restore') || lowerEvent.includes('re-enroll')) {
            return <ShieldCheck className="w-5 h-5 text-emerald-600" />;
        }
        return <Info className="w-5 h-5 text-gray-500" />;
    };

    const getEventColor = (event: string) => {
        const lowerEvent = event.toLowerCase();
        if (lowerEvent.includes('admission')) return 'bg-emerald-50 border-emerald-200';
        if (lowerEvent.includes('withdraw')) return 'bg-amber-50 border-amber-200';
        if (lowerEvent.includes('transfer')) return 'bg-blue-50 border-blue-200';
        if (lowerEvent.includes('document')) return 'bg-indigo-50 border-indigo-200';
        if (lowerEvent.includes('medical') || lowerEvent.includes('vaccination')) return 'bg-red-50 border-red-200';
        if (lowerEvent.includes('archived')) return 'bg-gray-50 border-gray-200';
        return 'bg-gray-50 border-gray-100';
    };

    if (loading) {
        return (
            <div className="py-12 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 max-w-lg">
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 border-b border-gray-50 pb-3 flex items-center mb-6">
                    <Clock className="w-5 h-5 text-indigo-500 mr-2" />
                    Chronological Child Timeline
                </h3>

                {events.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 text-sm">
                        No historical event logs found for this child.
                    </div>
                ) : (
                    <div className="flow-root relative">
                        {/* Vertical timeline line */}
                        <div className="absolute left-6 top-5 bottom-5 w-0.5 bg-gray-100 z-0"></div>
                        
                        <ul className="-mb-8 space-y-6">
                            {events.map((event) => (
                                <li key={event.id}>
                                    <div className="relative flex space-x-4 items-start z-10">
                                        {/* Event Icon/Marker */}
                                        <div className={`flex items-center justify-center w-12 h-12 rounded-xl border shadow-sm ${getEventColor(event.event)}`}>
                                            {getEventIcon(event.event)}
                                        </div>
                                        
                                        {/* Event Detail Box */}
                                        <div className="flex-1 min-w-0 bg-white border border-gray-50 hover:border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start flex-wrap gap-2">
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-900">{event.event}</h4>
                                                    <p className="text-xs text-gray-400 font-semibold mt-0.5 flex items-center">
                                                        <User className="w-3.5 h-3.5 mr-1" />
                                                        By {event.performed_by}
                                                    </p>
                                                </div>
                                                <span className="text-[11px] text-gray-400 font-semibold flex items-center bg-gray-50 px-2 py-0.5 rounded-md">
                                                    <Calendar className="w-3 h-3 mr-1 text-gray-400" />
                                                    {new Date(event.date).toLocaleString()}
                                                </span>
                                            </div>
                                            
                                            <div className="mt-3 text-sm text-gray-600 bg-gray-50/50 p-2.5 rounded-xl border border-gray-50">
                                                {event.details}
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChildHistory;
