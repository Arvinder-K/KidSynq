import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, User, Mail, Briefcase } from 'lucide-react';
import Layout from '../../../components/Layout';
import { employeeService, type Employee, type EmployeeType } from '../../../api/employeeService';
import { MultiSelectDropdown } from '../../../components/MultiSelectDropdown';

const EmployeeCreate: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [employeeTypes, setEmployeeTypes] = useState<EmployeeType[]>([]);

    const [formData, setFormData] = useState<Partial<Employee>>({
        first_name: '',
        last_name: '',
        preferred_name: '',
        email: '',
        phone: '',
        employee_number: `EMP-${Math.random().toString(16).substring(2, 8).toUpperCase()}`,
        job_title: '',
        role: '',
        employment_type: 'Full-time',
        date_of_birth: '',
        status: 'active',
        start_date: new Date().toISOString().split('T')[0],
        types: []
    });

    React.useEffect(() => {
        const fetchTypes = async () => {
            try {
                const types = await employeeService.getEmployeeTypes();
                setEmployeeTypes(types);
            } catch (err) {
                console.error("Failed to fetch employee types", err);
            }
        };
        fetchTypes();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'types') {
            const select = e.target as HTMLSelectElement;
            const selectedOptions = Array.from(select.selectedOptions).map(opt => opt.value);
            setFormData(prev => ({ ...prev, types: selectedOptions }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError(null);
            
            // Basic validation
            if (!formData.first_name || !formData.last_name || !formData.start_date) {
                throw new Error("Please fill in all required fields.");
            }

            await employeeService.createEmployee(formData);
            navigate('/daycare/employees');
        } catch (err: any) {
            const data = err.response?.data;
            if (data && typeof data === 'object' && Object.keys(data).length > 0 && !data.employee_number) {
                const firstErrorKey = Object.keys(data)[0];
                const firstErrorVal = data[firstErrorKey];
                const msg = Array.isArray(firstErrorVal) ? firstErrorVal[0] : firstErrorVal;
                setError(typeof msg === 'string' ? `${firstErrorKey}: ${msg}` : "Validation error");
            } else {
                setError(err.response?.data?.employee_number || err.response?.data?.detail || err.message || "Failed to create employee.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <form onSubmit={handleSubmit} className="p-4 sm:p-8 max-w-7xl mx-auto">
                <button 
                    type="button"
                    onClick={() => navigate('/daycare/employees')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors mb-4 font-medium text-sm"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Employees
                </button>

                <div className="mb-4">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Add New Employee</h1>
                    <p className="text-slate-500 mt-1 text-sm">Create a new profile for a daycare staff member.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        
                        {/* Left Column: Personal & Contact Info */}
                        <div className="lg:col-span-5 space-y-4">
                            
                            <div className="bg-white rounded-xl border-t-4 border-t-indigo-500 border-x border-b border-slate-200 shadow-sm p-4 sm:p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-900">Personal Information</h2>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1">First Name *</label>
                                        <input required type="text" name="first_name" value={formData.first_name || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1">Last Name *</label>
                                        <input required type="text" name="last_name" value={formData.last_name || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Name</label>
                                        <input type="text" name="preferred_name" value={formData.preferred_name || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-medium text-slate-700 mb-1">Date of Birth</label>
                                        <input type="date" name="date_of_birth" value={formData.date_of_birth || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border-t-4 border-t-emerald-500 border-x border-b border-slate-200 shadow-sm p-4 sm:p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                        <Mail className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-900">Contact Information</h2>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                                        <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                                        <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all" />
                                    </div>
                                </div>
                            </div>

                        </div>


                        {/* Right Column: Employment Info */}
                        <div className="lg:col-span-7 space-y-4">
                            
                            <div className="bg-white rounded-xl border-t-4 border-t-amber-500 border-x border-b border-slate-200 shadow-sm p-4 sm:p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                                        <Briefcase className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-900">Employment Information</h2>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1">Employee Number</label>
                                        <input type="text" name="employee_number" value={formData.employee_number || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all" placeholder="e.g. EMP-001 (Leave blank to auto-generate)" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                                        <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all">
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                            <option value="on_leave">On Leave</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1">Job Title</label>
                                        <input type="text" name="job_title" value={formData.job_title || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all" placeholder="e.g. Lead Teacher" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1">Employment Type</label>
                                        <select name="employment_type" value={formData.employment_type || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all">
                                            <option value="Full-time">Full-time</option>
                                            <option value="Part-time">Part-time</option>
                                            <option value="Contract">Contract</option>
                                            <option value="Substitute">Substitute</option>
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-medium text-slate-700 mb-1">Start Date *</label>
                                        <input required type="date" name="start_date" value={formData.start_date || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-medium text-slate-700 mb-1">Employee Types (Roles)</label>
                                        <MultiSelectDropdown
                                            options={employeeTypes}
                                            selected={formData.types || []}
                                            onChange={(selectedIds) => setFormData(prev => ({ ...prev, types: selectedIds }))}
                                            placeholder="Select roles..."
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-medium text-slate-700 mb-1">Role (System Permission)</label>
                                        <select name="role" value={formData.role || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all">
                                            <option value="">Select a system role...</option>
                                            <option value="Teacher">Teacher</option>
                                            <option value="Admin">Admin</option>
                                            <option value="Staff">Staff</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                    <button type="button" onClick={() => navigate('/daycare/employees')} className="px-5 py-2 text-sm rounded-lg font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" disabled={loading} className="px-5 py-2 text-sm rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 border border-transparent flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200">
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Save Employee
                    </button>
                </div>
            </form>
        </Layout>
    );
};

export default EmployeeCreate;
