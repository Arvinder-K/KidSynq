import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { History, Users, Clock } from 'lucide-react';


export const ClassroomHistoryTab: React.FC = () => {
    const { id: classroomId } = useParams<{ id: string }>();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('access_token');
                // Fetch shifts for this room as activity history
                const res = await axios.get(`http://localhost:8000/api/daycare/classrooms/${classroomId}/schedule/`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const shifts = res.data?.shifts || [];
                setEvents(shifts);
            } catch (err) {
                console.error("Failed to load classroom history", err);
            } finally {
                setLoading(false);
            }
        };

        if (classroomId) {
            fetchHistory();
        }
    }, [classroomId]);

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <History className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Classroom Schedule & Activity Timeline</h2>
                        <p className="text-xs text-slate-500">Chronological history of shifts and assigned educators</p>
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-slate-400 text-xs">Loading activity history...</div>
                ) : events.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                        No recent activity recorded for this classroom.
                    </div>
                ) : (
                    <div className="relative pl-6 border-l-2 border-indigo-100 space-y-6">
                        {events.map((evt, idx) => (
                            <div key={idx} className="relative">
                                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white shadow-xs" />
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-800 flex items-center gap-2">
                                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                                            <span>{evt.employee_name}</span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-indigo-100 text-indigo-700">
                                                {evt.shift_type}
                                            </span>
                                        </span>
                                        <span className="text-slate-400 font-medium">{evt.date}</span>
                                    </div>
                                    <div className="text-xs text-slate-600 flex items-center gap-3">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{evt.shift_start?.substring(0, 5)} – {evt.shift_end?.substring(0, 5)}</span>
                                        </span>
                                        {evt.net_working_hours !== undefined && (
                                            <span className="text-slate-400">({evt.net_working_hours}h net)</span>
                                        )}
                                    </div>
                                    {evt.duties && (
                                        <p className="text-xs text-slate-500 italic bg-white p-2 rounded-xl border border-slate-100">
                                            "{evt.duties}"
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClassroomHistoryTab;
