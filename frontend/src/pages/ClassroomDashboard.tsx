import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    School, Users, UserCheck, Armchair, 
    Search, Plus, UserPlus, FileText, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface ClassroomStats {
    total_classrooms: number;
    active_classrooms: number;
    students_assigned: number;
    teachers_assigned: number;
    available_seats: number;
    occupancy_percentage: number;
    occupancy_chart: { name: string; occupied: number; available: number }[];
    student_distribution: { name: string; students: number }[];
    recent_classrooms: {
        id: string;
        name: string;
        age_group: string;
        capacity: number;
        status: string;
        created_at: string;
        assigned: number;
    }[];
}

const fetchDashboardStats = async (): Promise<ClassroomStats> => {
    const response = await api.get('/dashboard/classrooms/');
    return response.data;
};

const ClassroomDashboard: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newClassroom, setNewClassroom] = useState({ room_name: '', capacity: 20, status: 'Active' });
    const [addError, setAddError] = useState('');

    const [assignStudentModal, setAssignStudentModal] = useState<string | null>(null);
    const [selectedStudent, setSelectedStudent] = useState('');
    const [assignError, setAssignError] = useState('');

    const queryClient = useQueryClient();

    const { data: stats, isLoading, isError } = useQuery({
        queryKey: ['classroomStats'],
        queryFn: fetchDashboardStats
    });



    const { data: studentList } = useQuery({
        queryKey: ['studentList'],
        queryFn: async () => { const res = await api.get('/students/'); return res.data; }
    });

    const addClassroomMutation = useMutation({
        mutationFn: async (data: typeof newClassroom) => {
            const response = await api.post('/classrooms/', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classroomStats'] });
            setIsAddModalOpen(false);
            setNewClassroom({ room_name: '', capacity: 20, status: 'Active' });
            setAddError('');
        },
        onError: (error: any) => {
            setAddError(error.response?.data?.detail || 'Failed to add classroom');
        }
    });

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addClassroomMutation.mutate(newClassroom);
    };



    const assignStudentMutation = useMutation({
        mutationFn: async (data: { classroomId: string, studentId: string }) => {
            const response = await api.post(`/classrooms/${data.classroomId}/assign-student/`, { 
                student_id: data.studentId 
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classroomStats'] });
            setAssignStudentModal(null);
            setSelectedStudent('');
            setAssignError('');
        },
        onError: (error: any) => {
            setAssignError(error.response?.data?.detail || 'Failed to assign student');
        }
    });

    if (isLoading) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
            </Layout>
        );
    }

    if (isError || !stats) {
        return (
            <Layout>
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Failed to load classroom dashboard statistics.
                </div>
            </Layout>
        );
    }

    // Prepare Chart Data
    const occupancyChartData = {
        labels: stats.occupancy_chart.map(c => c.name),
        datasets: [
            {
                label: 'Occupied',
                data: stats.occupancy_chart.map(c => c.occupied),
                backgroundColor: 'rgba(99, 102, 241, 0.8)', // indigo-500
            },
            {
                label: 'Available',
                data: stats.occupancy_chart.map(c => c.available),
                backgroundColor: 'rgba(226, 232, 240, 0.8)', // slate-200
            }
        ],
    };

    const studentDistData = {
        labels: stats.student_distribution.map(c => c.name),
        datasets: [
            {
                data: stats.student_distribution.map(c => c.students),
                backgroundColor: [
                    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', 
                    '#f97316', '#eab308', '#22c55e', '#14b8a6'
                ],
                borderWidth: 0,
            }
        ]
    };

    // Filter recent classrooms
    const filteredClassrooms = stats.recent_classrooms.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <Layout>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Classroom Dashboard</h1>
                    <p className="text-slate-500 mt-1">Overview of all classrooms and occupancy.</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm font-medium">Report</span>
                    </button>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">Add Classroom</span>
                    </button>
                </div>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                {[
                    { label: 'Total Classrooms', value: stats.total_classrooms, icon: School, color: 'text-blue-600', bg: 'bg-blue-100' },
                    { label: 'Active Classrooms', value: stats.active_classrooms, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
                    { label: 'Students Assigned', value: stats.students_assigned, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-100' },
                    { label: 'Teachers Assigned', value: stats.teachers_assigned, icon: UserCheck, color: 'text-purple-600', bg: 'bg-purple-100' },
                    { label: 'Available Seats', value: stats.available_seats, icon: Armchair, color: 'text-orange-600', bg: 'bg-orange-100' },
                ].map((stat, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
                    >
                        <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                            <stat.icon className={`w-6 h-6 ${stat.color}`} />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{stat.label}</p>
                            <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                
                {/* Occupancy Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-slate-800">Classroom Occupancy</h2>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                                <span className="text-sm text-slate-600">Occupied</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-slate-200"></span>
                                <span className="text-sm text-slate-600">Available</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <Bar 
                            data={occupancyChartData} 
                            options={{ 
                                responsive: true, 
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: { 
                                    x: { stacked: true, grid: { display: false } }, 
                                    y: { stacked: true, border: { display: false } } 
                                }
                            }} 
                        />
                    </div>
                </div>

                {/* Overall Occupancy & Distribution */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                    <h2 className="text-lg font-bold text-slate-800 mb-6">Overall Occupancy</h2>
                    
                    {/* Progress Bar */}
                    <div className="mb-8">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-3xl font-bold text-slate-800">{stats.occupancy_percentage}%</span>
                            <span className="text-sm text-slate-500 mb-1">Total Capacity Filled</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3">
                            <div 
                                className={`h-3 rounded-full ${stats.occupancy_percentage > 90 ? 'bg-red-500' : stats.occupancy_percentage > 75 ? 'bg-orange-500' : 'bg-emerald-500'}`} 
                                style={{ width: `${stats.occupancy_percentage}%` }}
                            ></div>
                        </div>
                    </div>

                    <h2 className="text-lg font-bold text-slate-800 mb-4">Student Distribution</h2>
                    <div className="flex-1 min-h-[200px] relative">
                        {stats.student_distribution.length > 0 ? (
                            <Doughnut 
                                data={studentDistData} 
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    cutout: '70%',
                                    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } } }
                                }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                                No students assigned yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Classrooms Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-lg font-bold text-slate-800">Recent Classrooms</h2>
                    <div className="flex gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search classrooms..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full sm:w-64 bg-slate-50"
                            />
                        </div>
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                        >
                            <option value="All">All Status</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Classroom Name</th>
                                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Age Group</th>
                                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Occupancy</th>
                                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Status</th>
                                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredClassrooms.map((c) => (
                                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-4 px-6">
                                        <p className="font-semibold text-slate-800">{c.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Created {new Date(c.created_at).toLocaleDateString()}</p>
                                    </td>
                                    <td className="py-4 px-6 text-sm text-slate-600">
                                        <span className="px-2.5 py-1 bg-slate-100 rounded-lg">{c.age_group}</span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-sm font-medium text-slate-700">{c.assigned}</span>
                                            <span className="text-xs text-slate-400">/ {c.capacity}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                            c.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {c.status === 'Active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link 
                                                to={`/classrooms/${c.id}/teachers`}
                                                className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors inline-block" 
                                                title="Manage Teachers"
                                            >
                                                <UserCheck className="w-4 h-4" />
                                            </Link>
                                            <button 
                                                onClick={() => setAssignStudentModal(c.id)}
                                                className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors" 
                                                title="Assign Students"
                                            >
                                                <UserPlus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredClassrooms.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-500">
                                        No classrooms found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Classroom Modal */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                            onClick={() => setIsAddModalOpen(false)}
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="text-lg font-bold text-slate-800">Add New Classroom</h3>
                                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <form onSubmit={handleAddSubmit} className="p-6">
                                {addError && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                                        {addError}
                                    </div>
                                )}
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Classroom Name <span className="text-red-500">*</span></label>
                                        <input 
                                            type="text" 
                                            required
                                            value={newClassroom.room_name}
                                            onChange={(e) => setNewClassroom({...newClassroom, room_name: e.target.value})}
                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
                                            placeholder="e.g. Pre-K Blue"
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Capacity <span className="text-red-500">*</span></label>
                                            <input 
                                                type="number" 
                                                min="1"
                                                required
                                                value={newClassroom.capacity}
                                                onChange={(e) => setNewClassroom({...newClassroom, capacity: parseInt(e.target.value) || 0})}
                                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                            <select 
                                                value={newClassroom.status}
                                                onChange={(e) => setNewClassroom({...newClassroom, status: e.target.value})}
                                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
                                            >
                                                <option value="Active">Active</option>
                                                <option value="Inactive">Inactive</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="mt-8 flex justify-end gap-3">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsAddModalOpen(false)}
                                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={addClassroomMutation.isPending}
                                        className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
                                    >
                                        {addClassroomMutation.isPending ? 'Saving...' : 'Save Classroom'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}


                {/* Assign Student Modal */}
                {assignStudentModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                            onClick={() => setAssignStudentModal(null)}
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6"
                        >
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Assign Student</h3>
                            {assignError && <div className="mb-4 text-red-500 text-sm bg-red-50 p-2 rounded">{assignError}</div>}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Select Student</label>
                                    <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className="w-full p-2 border rounded-xl">
                                        <option value="">-- Choose Student --</option>
                                        {studentList?.map((student: any) => (
                                            <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2 mt-6">
                                    <button onClick={() => setAssignStudentModal(null)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl">Cancel</button>
                                    <button 
                                        onClick={() => assignStudentMutation.mutate({ classroomId: assignStudentModal, studentId: selectedStudent })}
                                        disabled={!selectedStudent || assignStudentMutation.isPending}
                                        className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-xl disabled:opacity-50"
                                    >
                                        Assign
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </Layout>
    );
};

export default ClassroomDashboard;
