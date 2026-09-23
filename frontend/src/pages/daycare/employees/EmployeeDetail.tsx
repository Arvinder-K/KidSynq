import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Briefcase, Hash } from 'lucide-react';
import Layout from '../../../components/Layout';
import { employeeService, type Employee, type EmployeeType } from '../../../api/employeeService';
import { EmployeeQualifications } from './EmployeeQualifications';
import { EmployeeCertifications } from './EmployeeCertifications';
import { EmploymentHistoryTab } from './EmploymentHistoryTab';
import { EmployeeCompensationTab } from './EmployeeCompensationTab';
import { EmployeeDocumentsTab } from './EmployeeDocumentsTab';
import { EmployeeEmergencyContactsTab } from './EmployeeEmergencyContactsTab';
import { EmployeeAvailabilityTab } from './EmployeeAvailabilityTab';
import { EmployeeClassroomsTab } from './EmployeeClassroomsTab';
import { EmployeeCredentialsTab } from './EmployeeCredentialsTab';
import { EmployeeCredentialHistory } from './EmployeeCredentialHistory';
import { MultiSelectDropdown } from '../../../components/MultiSelectDropdown';


const EmployeeDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [employeeTypes, setEmployeeTypes] = useState<EmployeeType[]>([]);

    const [formData, setFormData] = useState<Partial<Employee>>({});
    const [activeTab, setActiveTab] = useState('profile');

    useEffect(() => {
        const fetchEmployee = async () => {
            if (!id) return;
            try {
                setLoading(true);
                const data = await employeeService.getEmployee(id);
                setEmployee(data);
                setFormData(data);
            } catch (err) {
                setError("Failed to load employee details.");
            } finally {
                setLoading(false);
            }
        };
        const fetchTypes = async () => {
            try {
                const types = await employeeService.getEmployeeTypes();
                setEmployeeTypes(types);
            } catch (err) {
                console.error("Failed to fetch employee types", err);
            }
        };
        fetchEmployee();
        fetchTypes();
    }, [id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        try {
            setSaving(true);
            setError(null);
            
            await employeeService.updateEmployee(id, formData);
            const updated = await employeeService.getEmployee(id);
            setEmployee(updated);
            setFormData(updated);
        } catch (err: any) {
            setError(err.response?.data?.status || err.message || "Failed to update employee.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </Layout>
        );
    }

    if (!employee) {
        return (
            <Layout>
                <div className="p-8 text-center max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold text-slate-800">Employee not found</h2>
                    <button onClick={() => navigate('/daycare/employees')} className="text-indigo-600 mt-4 underline">Back to Employees</button>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="p-8 max-w-5xl mx-auto">
                <button 
                    onClick={() => navigate('/daycare/employees')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors mb-6 font-medium text-sm"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Employees
                </button>

                <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 overflow-hidden border-2 border-indigo-100 shadow-sm">
                            {employee.photo ? (
                                <img src={employee.photo} alt={employee.first_name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-3xl font-bold">
                                    {employee.first_name.charAt(0)}{employee.last_name.charAt(0)}
                                </span>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                                    {employee.preferred_name ? `${employee.preferred_name} (${employee.first_name}) ${employee.last_name}` : `${employee.first_name} ${employee.last_name}`}
                                </h1>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                                    employee.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                    employee.status === 'on_leave' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-700'
                                }`}>
                                    {employee.status}
                                </span>
                            </div>
                            <div className="text-slate-500 mt-1 flex items-center gap-2">
                                <Briefcase className="w-4 h-4" /> {employee.job_title || employee.role || 'Staff Member'}
                                <span className="mx-2">•</span>
                                <Hash className="w-4 h-4" /> {employee.employee_number || 'No ID'}
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                        {error}
                    </div>
                )}

                <div className="flex border-b border-slate-200 mb-6 overflow-x-auto gap-1">
                    {[
                        { id: 'profile', label: 'Profile' },
                        { id: 'credentials', label: 'Credentials & Checks' },
                        { id: 'credential-history', label: 'Credential History' },
                        { id: 'classrooms', label: 'Classrooms' },

                        { id: 'emergency', label: 'Emergency Contacts' },
                        { id: 'availability', label: 'Availability' },
                        { id: 'qualifications', label: 'Qualifications' },
                        { id: 'certifications', label: 'Certifications' },
                        { id: 'documents', label: 'Documents' },
                        { id: 'compensation', label: 'Compensation' },
                        { id: 'history', label: 'Employment History' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-3 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
                                activeTab === tab.id
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'profile' && (
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-slate-900">Personal Information</h2>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">First Name</label>
                                    <input type="text" name="first_name" value={formData.first_name || ''} onChange={handleChange} required className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Last Name</label>
                                    <input type="text" name="last_name" value={formData.last_name || ''} onChange={handleChange} required className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Preferred Name</label>
                                    <input type="text" name="preferred_name" value={formData.preferred_name || ''} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Date of Birth</label>
                                    <input type="date" name="date_of_birth" value={formData.date_of_birth || ''} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                                    <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                                    <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8">
                            <h2 className="text-xl font-bold text-slate-900 mb-6">Employment Details</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Primary Role / Base Category</label>
                                    <input type="text" name="role" value={formData.role || ''} onChange={handleChange} required className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Job Title (Optional)</label>
                                    <input type="text" name="job_title" value={formData.job_title || ''} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Employment Type</label>
                                    <select name="employment_type" value={formData.employment_type || ''} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all">
                                        <option value="">Select Type</option>
                                        <option value="Full-time">Full-time</option>
                                        <option value="Part-time">Part-time</option>
                                        <option value="Contract">Contract</option>
                                        <option value="Temporary">Temporary</option>
                                        <option value="Substitute">Substitute</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Employee Types / Tags</label>
                                    <MultiSelectDropdown
                                        options={employeeTypes.map(t => ({ id: t.id, name: t.name }))}
                                        selected={Array.isArray(formData.types) ? formData.types.map(String) : []}
                                        onChange={(newIds) => setFormData(prev => ({ ...prev, types: newIds }))}
                                        placeholder="Select employee types..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                                    <select name="status" value={formData.status || 'active'} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all">
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="on_leave">On Leave</option>
                                        <option value="suspended">Suspended</option>
                                        <option value="terminated">Terminated</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                                    <input type="date" name="start_date" value={formData.start_date || ''} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">End Date (Optional)</label>
                                    <input type="date" name="end_date" value={formData.end_date || ''} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 pb-12">
                            <button type="button" onClick={() => navigate('/daycare/employees')} className="px-6 py-2.5 rounded-xl font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 border border-transparent flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200">
                                {saving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-5 h-5" />
                                )}
                                Save Changes
                            </button>
                        </div>
                    </form>
                )}

                {activeTab === 'credentials' && id && <EmployeeCredentialsTab employeeId={id} />}
                {activeTab === 'credential-history' && id && <EmployeeCredentialHistory employeeIdProp={id} />}
                {activeTab === 'classrooms' && id && <EmployeeClassroomsTab employeeId={id} />}

                {activeTab === 'emergency' && id && <EmployeeEmergencyContactsTab employeeId={id} />}
                {activeTab === 'availability' && id && <EmployeeAvailabilityTab employeeId={id} />}
                {activeTab === 'qualifications' && id && <EmployeeQualifications employeeId={id} />}
                {activeTab === 'certifications' && id && <EmployeeCertifications employeeId={id} />}
                {activeTab === 'documents' && id && <EmployeeDocumentsTab employeeId={id} />}
                {activeTab === 'compensation' && id && <EmployeeCompensationTab employeeId={id} />}
                {activeTab === 'history' && id && <EmploymentHistoryTab employeeId={id} />}
            </div>
        </Layout>
    );
};

export default EmployeeDetail;
