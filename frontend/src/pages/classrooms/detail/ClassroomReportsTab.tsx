import React, { useState, useEffect } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { FileText, Printer, CheckCircle2, AlertTriangle } from 'lucide-react';


export const ClassroomReportsTab: React.FC = () => {
    const { id: classroomId } = useParams<{ id: string }>();
    const { classroom } = useOutletContext<any>() || {};

    const [scheduleData, setScheduleData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReportData = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('access_token');
                const todayStr = new Date().toISOString().split('T')[0];
                const res = await axios.get(`http://localhost:8000/api/daycare/classrooms/${classroomId}/schedule/?date=${todayStr}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setScheduleData(res.data);
            } catch (err) {
                console.error("Failed to load report data", err);
            } finally {
                setLoading(false);
            }
        };

        if (classroomId) {
            fetchReportData();
        }
    }, [classroomId]);

    const handlePrint = () => {
        window.print();
    };

    const shifts = scheduleData?.shifts || [];
    const coverage = scheduleData?.coverage;

    return (
        <div className="space-y-6">
            {/* Header & Actions */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Classroom Compliance & Coverage Report</h2>
                        <p className="text-xs text-slate-500">Live operational summary for {classroom?.room_name || 'Classroom'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Print Report</span>
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Standard Ratio</div>
                    <div className="text-2xl font-black text-slate-900">{coverage?.standard_ratio || '1:5'}</div>
                    <p className="text-xs text-slate-500 mt-1">{coverage?.age_group_name || 'Age Group'} compliance rule</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Required Educators</div>
                    <div className="text-2xl font-black text-indigo-600">{coverage?.required_educators || 1} Staff</div>
                    <p className="text-xs text-slate-500 mt-1">Based on room capacity and active roster</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Overall Compliance</div>
                    <div className="flex items-center gap-2 mt-1">
                        {coverage?.compliance_status === 'COMPLIANT' ? (
                            <span className="flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black uppercase">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Ratio Compliant</span>
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-black uppercase">
                                <AlertTriangle className="w-4 h-4" />
                                <span>Coverage Shortage</span>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Shift Breakdown Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-900">Scheduled Shifts Breakdown ({shifts.length})</h3>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-slate-400 text-xs">Loading report...</div>
                ) : shifts.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">No shifts scheduled for report generation.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-3.5">Staff Member</th>
                                    <th className="p-3.5">Date</th>
                                    <th className="p-3.5">Shift Hours</th>
                                    <th className="p-3.5">Shift Type</th>
                                    <th className="p-3.5">Breaks</th>
                                    <th className="p-3.5 text-right">Net Working Hours</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {shifts.map((s: any) => (
                                    <tr key={s.id} className="hover:bg-slate-50/60">
                                        <td className="p-3.5 font-bold text-slate-900">{s.employee_name}</td>
                                        <td className="p-3.5 text-slate-600">{s.date}</td>
                                        <td className="p-3.5 font-semibold text-slate-700">{s.shift_start?.substring(0, 5)} – {s.shift_end?.substring(0, 5)}</td>
                                        <td className="p-3.5">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-700">
                                                {s.shift_type}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-slate-600">{s.breaks?.length || 0} breaks</td>
                                        <td className="p-3.5 text-right font-black text-slate-900">{s.net_working_hours ?? s.total_shift_hours ?? '-'}h</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClassroomReportsTab;
