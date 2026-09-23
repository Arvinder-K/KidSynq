import React, { useEffect, useState } from 'react';
import { School, Calendar, ArrowRight, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { employeeService, type ClassroomAssignmentInfo } from '../../../api/employeeService';

interface Props {
    employeeId: string;
}

export const EmployeeClassroomsTab: React.FC<Props> = ({ employeeId }) => {
    const [currentClassrooms, setCurrentClassrooms] = useState<ClassroomAssignmentInfo[]>([]);
    const [history, setHistory] = useState<ClassroomAssignmentInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchClassrooms = async () => {
            try {
                setLoading(true);
                const data = await employeeService.getEmployeeClassrooms(employeeId);
                setCurrentClassrooms(data.current_classrooms || []);
                setHistory(data.history || []);
            } catch (err: any) {
                setError("Failed to load classroom assignments.");
            } finally {
                setLoading(false);
            }
        };
        fetchClassrooms();
    }, [employeeId]);

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            {/* Current Active Assignments */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Current Classroom Assignments</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Rooms where this employee is actively assigned as Primary or Assistant Teacher.</p>
                    </div>
                </div>

                {currentClassrooms.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200/60 p-8 text-center">
                        <School className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                        <h3 className="font-semibold text-slate-800">No Active Classroom Assignments</h3>
                        <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                            This staff member is not currently assigned to any classroom.
                        </p>
                        <Link
                            to="/classrooms"
                            className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                        >
                            Go to Classroom Management <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentClassrooms.map((item) => (
                            <div
                                key={item.id}
                                className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">
                                            <School className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg">{item.classroom_name}</h3>
                                            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                                                Code: {item.classroom_code || 'N/A'} • {item.branch_name || 'Main Branch'}
                                            </p>
                                        </div>
                                    </div>
                                    <span
                                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                            item.assignment_type === 'Primary'
                                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                                        }`}
                                    >
                                        {item.assignment_type} Teacher
                                    </span>
                                </div>

                                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        <span>Assigned: <strong className="text-slate-700">{item.assigned_date}</strong></span>
                                    </div>
                                    <Link
                                        to={`/classrooms/${item.classroom_id}/teachers`}
                                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                    >
                                        Manage Room <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Assignment History */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <History className="w-5 h-5 text-slate-500" />
                    <h2 className="text-xl font-bold text-slate-900">Assignment History</h2>
                </div>

                {history.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200/60 p-6 text-center text-slate-500 text-sm">
                        No previous classroom assignments recorded.
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-3.5">Classroom</th>
                                        <th className="px-6 py-3.5">Role</th>
                                        <th className="px-6 py-3.5">Start Date</th>
                                        <th className="px-6 py-3.5">End Date</th>
                                        <th className="px-6 py-3.5">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {history.map((record) => (
                                        <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900">
                                                {record.classroom_name}
                                                <span className="text-xs text-slate-400 block">{record.classroom_code}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                                    {record.assignment_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{record.assigned_date}</td>
                                            <td className="px-6 py-4 text-slate-600">{record.end_date || 'Ended'}</td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                                                    {record.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
