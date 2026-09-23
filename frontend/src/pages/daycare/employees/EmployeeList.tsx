import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import {
    Plus, Search, Mail, Phone, MoreVertical, Briefcase,
    BarChart3, LayoutDashboard, School
} from 'lucide-react';

import Layout from '../../../components/Layout';
import { employeeService, type Employee, type EmployeeType } from '../../../api/employeeService';

const EmployeeList: React.FC = () => {
    const navigate = useNavigate();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [typesList, setTypesList] = useState<EmployeeType[]>([]);

    useEffect(() => {
        const fetchTypes = async () => {
            try {
                const types = await employeeService.getEmployeeTypes();
                setTypesList(types);
            } catch (e) {
                console.error("Failed to load employee types", e);
            }
        };
        fetchTypes();
    }, []);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                setLoading(true);
                const data = await employeeService.getEmployees({
                    search: searchQuery || undefined,
                    status: statusFilter === 'all' ? undefined : statusFilter,
                    employee_type: typeFilter || undefined
                });
                setEmployees(data.results || data);
            } catch (error) {
                console.error("Failed to fetch employees", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEmployees();
    }, [searchQuery, statusFilter, typeFilter]);

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            inactive: 'bg-slate-100 text-slate-700 border-slate-200',
            on_leave: 'bg-amber-100 text-amber-700 border-amber-200',
            suspended: 'bg-orange-100 text-orange-700 border-orange-200',
            terminated: 'bg-red-100 text-red-700 border-red-200',
            archived: 'bg-gray-100 text-gray-700 border-gray-200',
        };
        const style = styles[status] || styles.inactive;
        
        return (
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${style}`}>
                {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
            </span>
        );
    };

    return (
        <Layout>
            <div className="space-y-6 max-w-7xl mx-auto font-sans">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Staff & Employees</h1>
                            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
                                {employees.length} Team Members
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">Manage your daycare team members, roles, classrooms, and credentials.</p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <Link
                            to="/daycare/employees/dashboard"
                            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs transition-all shadow-xs"
                        >
                            <LayoutDashboard className="w-3.5 h-3.5 text-slate-500" />
                            <span>Staff Dashboard</span>
                        </Link>
                        <Link
                            to="/daycare/employees/reports"
                            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs transition-all shadow-xs"
                        >
                            <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
                            <span>Staff Reports</span>
                        </Link>
                        <button
                            onClick={() => navigate('/daycare/employees/new')}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm shadow-emerald-600/20 hover:scale-[1.02]"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Employee</span>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name, employee number, job title, email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 rounded-xl text-sm transition-all outline-none"
                        />
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-50 border border-transparent focus:border-emerald-500 focus:bg-white rounded-xl text-sm py-2.5 px-3.5 outline-none transition-all font-medium text-slate-700"
                        >
                            <option value="all">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="on_leave">On Leave</option>
                            <option value="inactive">Inactive</option>
                            <option value="suspended">Suspended</option>
                            <option value="terminated">Terminated</option>
                        </select>

                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="bg-slate-50 border border-transparent focus:border-emerald-500 focus:bg-white rounded-xl text-sm py-2.5 px-3.5 outline-none transition-all font-medium text-slate-700"
                        >
                            <option value="">All Roles / Types</option>
                            {typesList.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Employee List */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role & Roles</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Classroom</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <AnimatePresence>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                                Loading employees...
                                            </td>
                                        </tr>
                                    ) : employees.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-16 text-center">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Briefcase className="w-8 h-8 text-slate-400" />
                                                </div>
                                                <h3 className="text-lg font-medium text-slate-900 mb-1">No employees found</h3>
                                                <p className="text-slate-500 max-w-sm mx-auto">Try adjusting your filters or click "Add Employee" to create a new profile.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        employees.map((emp) => (
                                            <motion.tr 
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                                key={emp.id} 
                                                className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                                onClick={() => navigate(`/daycare/employees/${emp.id}`)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 overflow-hidden border border-indigo-100 font-bold">
                                                            {emp.photo ? (
                                                                <img src={emp.photo} alt={emp.first_name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="font-semibold text-sm">
                                                                    {emp.first_name.charAt(0)}{emp.last_name.charAt(0)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                                {emp.preferred_name ? `${emp.preferred_name} (${emp.first_name}) ${emp.last_name}` : `${emp.first_name} ${emp.last_name}`}
                                                            </div>
                                                            <div className="text-xs text-slate-500 font-medium">
                                                                {emp.employee_number || 'No ID'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-semibold text-slate-900">{emp.job_title || emp.role || 'N/A'}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {emp.types_detail && emp.types_detail.length > 0 
                                                            ? emp.types_detail.map(t => t.name).join(', ')
                                                            : emp.employment_type || 'Staff Member'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {emp.current_classrooms && emp.current_classrooms.length > 0 ? (
                                                        <div className="flex flex-col gap-1">
                                                            {emp.current_classrooms.map(c => (
                                                                <span key={c.assignment_id} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                                                                    <School className="w-3 h-3" /> {c.classroom_name} ({c.assignment_type})
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Unassigned</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-0.5">
                                                        <Mail className="w-3 h-3 text-slate-400" />
                                                        {emp.email || 'N/A'}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                        <Phone className="w-3 h-3 text-slate-400" />
                                                        {emp.phone || 'N/A'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-medium">
                                                    {emp.start_date || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {getStatusBadge(emp.status)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/daycare/employees/${emp.id}`);
                                                        }}
                                                        className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </motion.tr>
                                        ))
                                    )}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default EmployeeList;
