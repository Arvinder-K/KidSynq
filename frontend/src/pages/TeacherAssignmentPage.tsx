import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, User, Search, AlertTriangle, UserMinus, Plus, ShieldCheck } from 'lucide-react';

const TeacherAssignmentPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [assignmentType, setAssignmentType] = useState<'Primary' | 'Assistant'>('Assistant');
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');

    // Fetch Classroom Data (you may need a specific endpoint if ClassroomStats doesn't have it, but let's assume we can fetch it)
    const { data: classroom, isLoading: isClassroomLoading } = useQuery({
        queryKey: ['classroom', id],
        queryFn: async () => {
            // Ideally an endpoint like /api/classrooms/{id}/ exists from earlier modules.
            // Let's use the dashboard stats endpoint logic or just a general classroom fetch if available.
            // If not, we will just fetch the dashboard stats and find it.
            const res = await api.get('/classrooms/');
            const found = res.data.find((c: any) => c.id === id);
            return found;
        }
    });

    const { data: assignments = [], isLoading: isAssignmentsLoading } = useQuery({
        queryKey: ['classroom-teachers', id],
        queryFn: async () => {
            const res = await api.get(`/classrooms/${id}/teachers/`);
            return res.data;
        }
    });

    const { data: availableTeachers = [], isLoading: isTeachersLoading } = useQuery({
        queryKey: ['available-teachers', searchTerm],
        queryFn: async () => {
            const res = await api.get(`/teachers/available/?search=${searchTerm}`);
            return res.data;
        }
    });

    const assignMutation = useMutation({
        mutationFn: async (employeeId: string) => {
            const res = await api.post('/classroom-teachers/', {
                classroom: id,
                employee: employeeId,
                assignment_type: assignmentType
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classroom-teachers', id] });
            queryClient.invalidateQueries({ queryKey: ['available-teachers'] });
            setIsModalOpen(false);
            setError('');
        },
        onError: (err: any) => {
            setError(err.response?.data?.detail || 'Failed to assign teacher.');
        }
    });

    const removeMutation = useMutation({
        mutationFn: async (assignmentId: string) => {
            await api.delete(`/classroom-teachers/${assignmentId}/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classroom-teachers', id] });
            queryClient.invalidateQueries({ queryKey: ['available-teachers'] });
        }
    });

    if (isClassroomLoading || isAssignmentsLoading) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            </Layout>
        );
    }

    if (!classroom) {
        return (
            <Layout>
                <div className="text-center py-12">
                    <h2 className="text-xl font-medium text-slate-600">Classroom not found</h2>
                    <Link to="/classrooms" className="text-indigo-600 hover:underline mt-4 inline-block">Return to Classrooms</Link>
                </div>
            </Layout>
        );
    }

    const primaryTeacher = assignments.find((a: any) => a.assignment_type === 'Primary');
    const assistantTeachers = assignments.filter((a: any) => a.assignment_type === 'Assistant');

    return (
        <Layout>
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link to="/daycare/classrooms" className="p-2 bg-white rounded-xl border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 transition-colors shadow-xs">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Teacher Assignments: {classroom.room_name}</h1>
                        <p className="mt-1 text-sm text-gray-500">Manage primary and assistant teachers for this classroom.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* Primary Teacher */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                                    <h3 className="font-semibold text-slate-800">Primary Teacher</h3>
                                </div>
                                <button 
                                    onClick={() => {
                                        setAssignmentType('Primary');
                                        setIsModalOpen(true);
                                    }}
                                    className="text-sm text-indigo-600 font-medium hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    {primaryTeacher ? 'Change Primary' : 'Assign Primary'}
                                </button>
                            </div>
                            <div className="p-6">
                                {primaryTeacher ? (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                                                {primaryTeacher.teacher.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-slate-900">{primaryTeacher.teacher.name}</h4>
                                                <p className="text-sm text-slate-500">{primaryTeacher.teacher.email}</p>
                                                <p className="text-xs text-slate-400 mt-1">Assigned on {new Date(primaryTeacher.assigned_date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                if(confirm('Remove primary teacher?')) {
                                                    removeMutation.mutate(primaryTeacher.id);
                                                }
                                            }}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Remove Teacher"
                                        >
                                            <UserMinus className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <User className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <p className="text-slate-500 font-medium">No Primary Teacher Assigned</p>
                                        <p className="text-sm text-slate-400 mt-1">Every classroom should have one primary teacher.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Assistant Teachers */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <User className="w-5 h-5 text-emerald-600" />
                                    <h3 className="font-semibold text-slate-800">Assistant Teachers</h3>
                                </div>
                                <button 
                                    onClick={() => {
                                        setAssignmentType('Assistant');
                                        setIsModalOpen(true);
                                    }}
                                    className="text-sm text-emerald-600 font-medium hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <Plus className="w-4 h-4" /> Add Assistant
                                </button>
                            </div>
                            
                            {assistantTeachers.length > 0 ? (
                                <div className="divide-y divide-slate-100">
                                    {assistantTeachers.map((a: any) => (
                                        <div key={a.id} className="p-4 px-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                                                    {a.teacher.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-slate-900 text-sm">{a.teacher.name}</h4>
                                                    <p className="text-xs text-slate-500">{a.teacher.employee_number || 'No ID'}</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    if(confirm('Remove assistant teacher?')) {
                                                        removeMutation.mutate(a.id);
                                                    }
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <UserMinus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center">
                                    <p className="text-slate-500">No assistant teachers assigned.</p>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Classroom Info Panel */}
                    <div className="space-y-6">
                        <div className="bg-slate-800 rounded-2xl shadow-md p-6 text-white">
                            <h3 className="font-medium text-slate-300 mb-4">Classroom Info</h3>
                            <div className="text-2xl font-bold mb-2">{classroom.room_name}</div>
                            <div className="flex justify-between items-center text-sm text-slate-300 py-2 border-b border-slate-700">
                                <span>Code</span>
                                <span className="font-medium text-white">{classroom.room_code || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-slate-300 py-2 border-b border-slate-700">
                                <span>Capacity</span>
                                <span className="font-medium text-white">{classroom.capacity || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-slate-300 py-2 border-b border-slate-700">
                                <span>Program</span>
                                <span className="font-medium text-white">{classroom.program_name || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-slate-300 py-2">
                                <span>Total Teachers</span>
                                <span className="font-medium text-white">{assignments.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Assignment Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-lg font-bold text-slate-800">Assign {assignmentType} Teacher</h2>
                            <button onClick={() => {setIsModalOpen(false); setError('');}} className="text-slate-400 hover:text-slate-600">
                                <span className="text-2xl leading-none">&times;</span>
                            </button>
                        </div>
                        
                        <div className="p-6 border-b border-slate-100">
                            <div className="relative">
                                <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search available teachers by name or ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                />
                            </div>
                            {error && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm font-medium flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}
                        </div>

                        <div className="overflow-y-auto p-2">
                            {isTeachersLoading ? (
                                <div className="p-8 text-center text-slate-500">Loading teachers...</div>
                            ) : availableTeachers.length > 0 ? (
                                <div className="space-y-1 p-4">
                                    {availableTeachers.map((teacher: any) => (
                                        <div key={teacher.id} className="flex items-center justify-between p-4 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                                    {teacher.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-slate-900">{teacher.name}</h4>
                                                    <div className="flex gap-3 text-xs mt-1">
                                                        <span className="text-slate-500">{teacher.employee_number || 'No ID'}</span>
                                                        <span className="text-slate-400">•</span>
                                                        <span className={`${teacher.workload?.total_classrooms > 2 ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                                                            {teacher.workload?.total_classrooms || 0} Classrooms ({teacher.workload?.primary_classrooms} Primary)
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => assignMutation.mutate(teacher.id)}
                                                disabled={assignMutation.isPending}
                                                className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                            >
                                                {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-slate-500">
                                    No available teachers found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default TeacherAssignmentPage;
