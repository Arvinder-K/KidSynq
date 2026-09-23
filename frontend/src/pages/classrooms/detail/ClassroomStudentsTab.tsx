import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
    UserPlus, Search, ArrowUpRight, 
    CheckCircle2, AlertCircle, X 
} from 'lucide-react';


export const ClassroomStudentsTab: React.FC = () => {
    const { id: classroomId } = useParams<{ id: string }>();

    const [students, setStudents] = useState<any[]>([]);
    const [allDaycareStudents, setAllDaycareStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [assigning, setAssigning] = useState(false);
    const [assignError, setAssignError] = useState<string | null>(null);
    const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('access_token');
            
            // Fetch classroom details / students
            const classRes = await axios.get(`http://localhost:8000/api/daycare/classrooms/${classroomId}/`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Fetch all students for assignment modal
            const allRes = await axios.get(`http://localhost:8000/api/daycare/children/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const allList = allRes.data?.results || allRes.data || [];
            setAllDaycareStudents(allList);

            if (classRes.data?.students && classRes.data.students.length > 0) {
                setStudents(classRes.data.students.map((s: any) => s.student || s));
            } else {
                const roomAssigned = allList.filter((s: any) => s.classroom === classroomId || s.classroom_id === classroomId);
                setStudents(roomAssigned);
            }
        } catch (err) {
            console.error("Failed to load classroom students", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (classroomId) {
            fetchData();
        }
    }, [classroomId]);

    const handleAssignStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudentId) return;

        try {
            setAssigning(true);
            setAssignError(null);
            const token = localStorage.getItem('access_token');
            await axios.post(
                `http://localhost:8000/api/daycare/classrooms/${classroomId}/assign-student/`,
                { student_id: selectedStudentId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setAssignSuccess("Student assigned successfully to classroom!");
            setIsAssignModalOpen(false);
            setSelectedStudentId('');
            fetchData();
            setTimeout(() => setAssignSuccess(null), 3000);
        } catch (err: any) {
            setAssignError(err.response?.data?.detail || "Failed to assign student to classroom.");
        } finally {
            setAssigning(false);
        }
    };

    const filtered = students.filter(s => {
        const full = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
        return full.includes(searchTerm.toLowerCase());
    });

    const unassignedStudents = allDaycareStudents.filter(
        s => !students.some(assigned => assigned.id === s.id)
    );

    return (
        <div className="space-y-6">
            {assignSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{assignSuccess}</span>
                </div>
            )}

            {/* Header & Search Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative flex-1 w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search student by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <button
                    onClick={() => {
                        setAssignError(null);
                        setSelectedStudentId(unassignedStudents[0]?.id || '');
                        setIsAssignModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
                >
                    <UserPlus className="w-4 h-4" />
                    <span>Assign Student</span>
                </button>
            </div>

            {/* Students List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Classroom Roster ({filtered.length})</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Assigned children and active enrollments</p>
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-slate-400 text-xs">Loading roster...</div>
                ) : filtered.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                        No students found matching your search.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-3.5">Student Name</th>
                                    <th className="p-3.5">Status</th>
                                    <th className="p-3.5">Date of Birth</th>
                                    <th className="p-3.5">Guardian</th>
                                    <th className="p-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map((s) => (
                                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                                                {s.first_name?.[0] || 'S'}
                                            </div>
                                            <div>
                                                <div>{s.first_name} {s.last_name}</div>
                                                <div className="text-[10px] text-slate-400 font-normal">{s.student_id || s.id.substring(0, 8)}</div>
                                            </div>
                                        </td>
                                        <td className="p-3.5">
                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                                {s.status || 'Active'}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-slate-600 font-medium">
                                            {s.date_of_birth || '-'}
                                        </td>
                                        <td className="p-3.5 text-slate-600">
                                            {s.primary_guardian_name || s.guardian_name || 'Primary Guardian'}
                                        </td>
                                        <td className="p-3.5 text-right">
                                            <Link
                                                to={`/daycare/children/${s.id}`}
                                                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold"
                                            >
                                                <span>View Child Profile</span>
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

            {/* Assign Student Modal */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-bold text-slate-900">Assign Student to Classroom</h3>
                            <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {assignError && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{assignError}</span>
                            </div>
                        )}

                        <form onSubmit={handleAssignStudent} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Select Student to Assign
                                </label>
                                {unassignedStudents.length === 0 ? (
                                    <p className="text-xs text-slate-400">All registered children are already assigned.</p>
                                ) : (
                                    <select
                                        value={selectedStudentId}
                                        onChange={(e) => setSelectedStudentId(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    >
                                        {unassignedStudents.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.first_name} {s.last_name} ({s.date_of_birth || 'No DOB'})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAssignModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={assigning || unassignedStudents.length === 0}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                                >
                                    {assigning ? 'Assigning...' : 'Assign Student'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassroomStudentsTab;
