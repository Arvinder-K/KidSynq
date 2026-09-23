import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Plus, Users, Calendar, AlertCircle, CheckCircle2, ArrowRightLeft, School, XCircle, RefreshCw } from 'lucide-react';
import api from '../../api';

interface Child {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    admission_number?: string;
    status: string;
}

interface Classroom {
    id: string;
    room_name: string;
    room_code?: string;
    capacity?: number;
    min_age_months?: number;
    max_age_months?: number;
    status?: string;
}

interface ClassroomAssignment {
    id: string;
    classroom_name: string;
    classroom: string;
    start_date: string;
    end_date: string | null;
    status: string;
}

export default function ChildClassroom() {
    const outletContext = useOutletContext<{ child: Child }>();
    const { id: routeId } = useParams<{ id: string }>();
    const child = outletContext?.child || { id: routeId || '' } as Child;
    const childId = child?.id || routeId || '';

    const [assignments, setAssignments] = useState<ClassroomAssignment[]>([]);
    const [availableClassrooms, setAvailableClassrooms] = useState<Classroom[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        classroom: '',
        start_date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        if (childId) {
            fetchData();
        }
    }, [childId]);

    const fetchData = async () => {
        if (!childId) return;
        setLoading(true);
        try {
            const [assignmentsRes, classroomsRes] = await Promise.all([
                api.get(`/daycare/children/${childId}/classrooms/`),
                api.get('/daycare/classrooms/')
            ]);
            
            const rawAssignments = assignmentsRes.data?.results || assignmentsRes.data || [];
            const rawClassrooms = classroomsRes.data?.results || classroomsRes.data || [];
            
            setAssignments(Array.isArray(rawAssignments) ? rawAssignments : []);
            setAvailableClassrooms(Array.isArray(rawClassrooms) ? rawClassrooms : []);
        } catch (error) {
            console.error("Failed to fetch classroom data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.classroom) {
            setErrorMessage("Please select a classroom.");
            return;
        }

        setSubmitting(true);
        setErrorMessage(null);
        try {
            await api.post(`/daycare/children/${childId}/classrooms/`, {
                classroom: formData.classroom,
                start_date: formData.start_date || new Date().toISOString().split('T')[0]
            });
            setIsModalOpen(false);
            setFormData({
                classroom: '',
                start_date: new Date().toISOString().split('T')[0]
            });
            setSuccessMessage("Classroom assigned successfully!");
            setTimeout(() => setSuccessMessage(null), 4000);
            fetchData();
        } catch (error: any) {
            console.error("Failed to assign classroom:", error);
            const detail = error.response?.data?.detail || 
                           (typeof error.response?.data === 'string' ? error.response.data : null) ||
                           (error.response?.data && Object.values(error.response.data).flat().join(', ')) ||
                           "Failed to assign classroom. Please check capacity and valid selection.";
            setErrorMessage(detail);
        } finally {
            setSubmitting(false);
        }
    };
    
    const endAssignment = async (id: string) => {
        if (!window.confirm('Are you sure you want to end this classroom assignment?')) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            await api.patch(`/daycare/classroom-assignments/${id}/`, {
                status: 'Ended',
                end_date: today
            });
            setSuccessMessage("Classroom assignment ended.");
            setTimeout(() => setSuccessMessage(null), 4000);
            fetchData();
        } catch (error: any) {
            console.error("Failed to end assignment:", error);
            alert(error.response?.data?.detail || "Failed to end assignment.");
        }
    };

    const currentAssignment = assignments.find(a => (a.status || '').toLowerCase() === 'active');
    const history = assignments.filter(a => (a.status || '').toLowerCase() !== 'active');

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Feedback Alerts */}
            {successMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm animate-in fade-in">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* Current Assignment Card */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/70 flex justify-between items-center">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-600" />
                        Current Classroom
                    </h3>
                    <button
                        onClick={() => {
                            setErrorMessage(null);
                            setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
                    >
                        {currentAssignment ? (
                            <>
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                Transfer Classroom
                            </>
                        ) : (
                            <>
                                <Plus className="w-3.5 h-3.5" />
                                Assign Classroom
                            </>
                        )}
                    </button>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="py-8 text-center text-sm text-gray-400">Loading classroom data...</div>
                    ) : currentAssignment ? (
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                                    <School className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-lg font-bold text-gray-900">
                                            {currentAssignment.classroom_name}
                                        </h4>
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-md">
                                            Active
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                        Assigned since <strong>{new Date(currentAssignment.start_date).toLocaleDateString()}</strong>
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => endAssignment(currentAssignment.id)}
                                className="text-xs text-rose-600 hover:text-rose-800 font-bold bg-white hover:bg-rose-50 px-3.5 py-2 rounded-xl border border-rose-200 transition-colors shadow-sm"
                            >
                                End Assignment
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-8 space-y-2">
                            <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <h4 className="text-sm font-bold text-gray-900">Not Assigned</h4>
                            <p className="text-xs text-gray-500 max-w-sm mx-auto">
                                This child is not currently assigned to any active classroom. Click <strong>"Assign Classroom"</strong> above to select a room.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Assignment History */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/70">
                    <h3 className="text-sm font-bold text-gray-900">Assignment History</h3>
                </div>
                {history.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                        {history.map(item => (
                            <div key={item.id} className="p-4 flex items-center justify-between text-xs">
                                <div>
                                    <h5 className="font-bold text-gray-900">{item.classroom_name}</h5>
                                    <p className="text-gray-500 mt-0.5">
                                        {new Date(item.start_date).toLocaleDateString()} – {item.end_date ? new Date(item.end_date).toLocaleDateString() : 'Ended'}
                                    </p>
                                </div>
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 font-semibold rounded">
                                    {item.status || 'Ended'}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-6 text-center text-xs text-gray-400">
                        No previous classroom assignments found.
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200 space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                <School className="w-5 h-5 text-indigo-600" />
                                {currentAssignment ? 'Transfer Classroom' : 'Assign Classroom'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        {errorMessage && (
                            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        {currentAssignment && (
                            <div className="p-3 bg-indigo-50 text-indigo-900 text-xs rounded-xl border border-indigo-100">
                                This will automatically end the current assignment to <strong>{currentAssignment.classroom_name}</strong>.
                            </div>
                        )}

                        <form onSubmit={handleAssign} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Select Classroom *
                                </label>
                                {availableClassrooms.length === 0 ? (
                                    <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs">
                                        No classrooms found in your daycare. Please create a classroom under <strong>Classrooms</strong> in the sidebar first.
                                    </div>
                                ) : (
                                    <select
                                        required
                                        value={formData.classroom}
                                        onChange={(e) => setFormData({ ...formData, classroom: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                                    >
                                        <option value="">Select a classroom...</option>
                                        {availableClassrooms.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.room_name} {c.capacity ? `(Capacity: ${c.capacity})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Assignment Start Date *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || availableClassrooms.length === 0}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Assigning...
                                        </>
                                    ) : (
                                        'Save Assignment'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
