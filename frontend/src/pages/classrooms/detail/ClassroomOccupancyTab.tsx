import React, { useState, useEffect } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import axios from 'axios';
import { 
    PieChart, Users, AlertCircle, CheckCircle2, UserPlus, 
    ArrowUpRight, Sparkles 
} from 'lucide-react';


interface StudentAssignment {
    id: string;
    student: {
        id: string;
        first_name: string;
        last_name: string;
        date_of_birth?: string;
        status?: string;
        enrollment_date?: string;
        gender?: string;
    };
    status: string;
    start_date: string;
}

export const ClassroomOccupancyTab: React.FC = () => {
    const { id: classroomId } = useParams<{ id: string }>();
    const { classroom } = useOutletContext<any>() || {};

    const [students, setStudents] = useState<StudentAssignment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('access_token');
                const res = await axios.get(`http://localhost:8000/api/daycare/classrooms/${classroomId}/`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data?.students) {
                    setStudents(res.data.students);
                } else {
                    // Fallback to student list query if nested students array isn't populated
                    const studentsRes = await axios.get(`http://localhost:8000/api/daycare/children/`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const assigned = (studentsRes.data?.results || studentsRes.data || []).filter(
                        (s: any) => s.classroom === classroomId || s.classroom_id === classroomId
                    );
                    setStudents(assigned.map((s: any) => ({
                        id: s.id,
                        student: s,
                        status: s.status || 'Active',
                        start_date: s.created_at || new Date().toISOString()
                    })));
                }
            } catch (err) {
                console.error("Failed to load occupancy data", err);
            } finally {
                setLoading(false);
            }
        };

        if (classroomId) {
            fetchStudents();
        }
    }, [classroomId]);

    const capacity = classroom?.capacity || 20;
    const enrolledCount = students.length;
    const availableSeats = Math.max(0, capacity - enrolledCount);
    const occupancyPercent = capacity > 0 ? Math.min(100, Math.round((enrolledCount / capacity) * 100)) : 0;

    const isFull = enrolledCount >= capacity;
    const isNearFull = occupancyPercent >= 85 && !isFull;

    return (
        <div className="space-y-6">
            {/* Occupancy Stats Banner */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900">{enrolledCount}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Enrolled Students</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                        <PieChart className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900">{capacity}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Max Room Capacity</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${availableSeats > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {availableSeats > 0 ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900">{availableSeats}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seats Remaining</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${
                        isFull ? 'bg-red-50 text-red-600' : isNearFull ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                    }`}>
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900">{occupancyPercent}%</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Occupancy Rate</div>
                    </div>
                </div>
            </div>

            {/* Occupancy Progress Bar */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-800">Classroom Fill Progress</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                        isFull 
                            ? 'bg-red-100 text-red-800' 
                            : isNearFull 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-emerald-100 text-emerald-800'
                    }`}>
                        {isFull ? 'At Full Capacity' : isNearFull ? 'Near Capacity' : 'Available Seats Open'}
                    </span>
                </div>
                <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-500 rounded-full ${
                            isFull ? 'bg-red-500' : isNearFull ? 'bg-amber-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${occupancyPercent}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>0 Students</span>
                    <span>{capacity / 2} (50%)</span>
                    <span>{capacity} Max Capacity</span>
                </div>
            </div>

            {/* Enrolled Students Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Enrolled Students In Room</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Active children occupying room seats</p>
                    </div>
                    <Link
                        to="/daycare/children/new"
                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>Admit New Child</span>
                    </Link>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-slate-400 text-xs">Loading classroom occupancy...</div>
                ) : students.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                        No students currently assigned to this classroom.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-3.5">Student Name</th>
                                    <th className="p-3.5">Status</th>
                                    <th className="p-3.5">Date of Birth</th>
                                    <th className="p-3.5">Enrolled Since</th>
                                    <th className="p-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {students.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                                                {item.student.first_name?.[0] || 'S'}
                                            </div>
                                            <span>{item.student.first_name} {item.student.last_name}</span>
                                        </td>
                                        <td className="p-3.5">
                                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                                {item.status || 'Active'}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-slate-600 font-medium">
                                            {item.student.date_of_birth || '-'}
                                        </td>
                                        <td className="p-3.5 text-slate-500">
                                            {item.start_date ? new Date(item.start_date).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="p-3.5 text-right">
                                            <Link
                                                to={`/daycare/children/${item.student.id}`}
                                                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold"
                                            >
                                                <span>Profile</span>
                                                <ArrowUpRight className="w-3.5 h-3.5" />
                                            </Link>
                                        </td>
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

export default ClassroomOccupancyTab;
