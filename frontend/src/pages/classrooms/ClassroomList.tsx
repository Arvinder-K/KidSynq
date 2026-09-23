import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, Edit, Trash2, BookOpen } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api';
import { motion } from 'framer-motion';

interface Classroom {
    id: string;
    room_name: string;
    room_code: string;
    capacity: number;
    age_group_name: string;
    branch_name: string;
    status: string;
    location: string;
}

const ClassroomList: React.FC = () => {
    const navigate = useNavigate();
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
        fetchClassrooms();
    }, [search, statusFilter]);

    const fetchClassrooms = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (statusFilter) params.append('status', statusFilter);
            
            const response = await api.get(`/daycare/classrooms/?${params.toString()}`);
            setClassrooms(response.data.results || response.data);
        } catch (error) {
            console.error('Failed to fetch classrooms:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to deactivate this classroom?")) return;
        try {
            await api.delete(`/daycare/classrooms/${id}/`);
            fetchClassrooms();
        } catch (error) {
            console.error("Failed to delete classroom:", error);
            alert("Failed to delete classroom");
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case 'active':
                return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Active</span>;
            case 'inactive':
                return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">Inactive</span>;
            case 'closed':
                return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Closed</span>;
            default:
                return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">{status}</span>;
        }
    };

    return (
        <Layout>
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Classrooms</h1>
                        <p className="text-gray-500 mt-1">Manage and view all classrooms in your daycare.</p>
                    </div>
                    <button 
                        onClick={() => navigate('/daycare/classrooms/new')}
                        className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/30"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Add Classroom</span>
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="relative flex-1 max-w-md w-full">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search by name or code..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                            />
                        </div>
                        <div className="flex items-center space-x-2 w-full sm:w-auto">
                            <Filter className="text-gray-400 w-5 h-5" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full sm:w-48 bg-white"
                            >
                                <option value="">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                                <option value="Closed">Closed</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600 text-sm font-medium uppercase tracking-wider border-b border-gray-200">
                                    <th className="p-4">Name</th>
                                    <th className="p-4">Code</th>
                                    <th className="p-4">Age Group</th>
                                    <th className="p-4">Capacity</th>
                                    <th className="p-4">Branch</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-500">
                                            <div className="flex items-center justify-center space-x-2">
                                                <div className="w-5 h-5 border-t-2 border-b-2 border-indigo-600 rounded-full animate-spin"></div>
                                                <span>Loading classrooms...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : classrooms.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-500">
                                            No classrooms found matching your criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    classrooms.map((classroom) => (
                                        <motion.tr 
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            key={classroom.id} 
                                            className="hover:bg-gray-50 transition-colors group"
                                        >
                                            <td className="p-4 font-semibold text-gray-900">
                                                {classroom.room_name}
                                            </td>
                                            <td className="p-4 text-gray-600 font-medium">
                                                {classroom.room_code || '-'}
                                            </td>
                                            <td className="p-4 text-gray-600">
                                                {classroom.age_group_name || '-'}
                                            </td>
                                            <td className="p-4 text-gray-600">
                                                {classroom.capacity || 'Unlimited'}
                                            </td>
                                            <td className="p-4 text-gray-600">
                                                {classroom.branch_name || 'Main'}
                                            </td>
                                            <td className="p-4">
                                                {getStatusBadge(classroom.status)}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end space-x-2">
                                                    <button 
                                                        onClick={() => navigate(`/daycare/classrooms/${classroom.id}`)}
                                                        className="p-2 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <BookOpen className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => navigate(`/daycare/classrooms/${classroom.id}/edit`)}
                                                        className="p-2 text-gray-500 hover:bg-gray-100 hover:text-indigo-600 rounded-lg transition-colors"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(classroom.id)}
                                                        className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default ClassroomList;
