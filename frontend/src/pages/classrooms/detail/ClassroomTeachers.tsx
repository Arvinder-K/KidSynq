import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, UserMinus, History } from 'lucide-react';



const ClassroomTeachers = () => {
    const { id } = useParams();

    const queryClient = useQueryClient();
    const [showHistory, setShowHistory] = useState(false);
    
    // For assigning teachers
    const [isAssigning, setIsAssigning] = useState(false);
    const [assignRole, setAssignRole] = useState<'Primary' | 'Assistant'>('Primary');
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const { data: staff, isLoading: staffLoading, isError: staffError, error: staffErrObj } = useQuery({
        queryKey: ['classroom-staff', id],
        queryFn: async () => {
            const token = localStorage.getItem('access_token');
            const res = await axios.get(`http://localhost:8000/api/daycare/classrooms/${id}/staff/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        }
    });

    const { data: availableEmployees } = useQuery({
        queryKey: ['available-employees'],
        queryFn: async () => {
            const token = localStorage.getItem('access_token');
            // Assuming this endpoint exists from Phase 1 or similar
            const res = await axios.get(`http://localhost:8000/api/daycare/employees/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Filter out suspended/inactive? Handled on backend, but we can filter here too
            return res.data.filter((e: any) => e.status !== 'suspended' && e.status !== 'inactive');
        }
    });

    const assignMutation = useMutation({
        mutationFn: async ({ role, employee_id }: { role: string, employee_id: string }) => {
            const token = localStorage.getItem('access_token');
            const endpoint = role === 'Primary' 
                ? `/api/daycare/classrooms/${id}/primary-teacher/` 
                : `/api/daycare/classrooms/${id}/assistants/`;
                
            return axios.post(`http://localhost:8000${endpoint}`, { employee_id }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classroom-staff', id] });
            setIsAssigning(false);
            setSelectedEmployee('');
            setErrorMsg('');
        },
        onError: (err: any) => {
            setErrorMsg(err.response?.data?.detail || err.response?.data?.error || 'Failed to assign teacher');
        }
    });

    const removeMutation = useMutation({
        mutationFn: async (assignmentId: string) => {
            const token = localStorage.getItem('access_token');
            return axios.delete(`http://localhost:8000/api/daycare/classroom-staff/${assignmentId}/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classroom-staff', id] });
        }
    });

    if (staffLoading) return <div>Loading...</div>;
    if (staffError) return <div className="p-4 text-red-500">Failed to load staff assignments: {(staffErrObj as Error).message}</div>;

    const activePrimary = staff?.find((s: any) => s.assignment_type === 'Primary' && s.status === 'Active');
    const activeAssistants = staff?.filter((s: any) => s.assignment_type === 'Assistant' && s.status === 'Active') || [];
    const historicalStaff = staff?.filter((s: any) => s.status === 'Ended') || [];

    const renderComplianceBadge = (status?: string, reason?: string) => {
        if (!status || status === 'COMPLIANT') {
            return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">✓ Compliant</span>;
        }
        if (status === 'WARNING') {
            return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200" title={reason}>⚠ Expiring Soon</span>;
        }
        if (status === 'NON_COMPLIANT') {
            return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200" title={reason}>✗ Non-Compliant</span>;
        }
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">⧖ Pending Review</span>;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Teachers</h2>
                <div className="flex space-x-3">
                    <button 
                        onClick={() => setShowHistory(!showHistory)}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <History className="h-4 w-4 mr-2 text-gray-500" />
                        {showHistory ? 'Hide History' : 'View History'}
                    </button>
                    <button 
                        onClick={() => { setIsAssigning(true); setAssignRole('Assistant'); setErrorMsg(''); }}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Assistant
                    </button>
                </div>
            </div>

            {/* Assign Modal / Form */}
            {isAssigning && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <h3 className="text-sm font-bold text-indigo-900 mb-3">Assign {assignRole} Teacher</h3>
                    {errorMsg && (
                        <div className="mb-3 p-2 bg-red-100 border border-red-200 text-red-700 text-xs rounded">
                            {errorMsg}
                        </div>
                    )}
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Select Staff Member</label>
                            <select 
                                value={selectedEmployee}
                                onChange={(e) => setSelectedEmployee(e.target.value)}
                                className="block w-full border-gray-300 rounded-md shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">-- Choose Employee --</option>
                                {availableEmployees?.map((emp: any) => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.first_name} {emp.last_name} ({emp.role || 'Staff'})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => assignMutation.mutate({ role: assignRole, employee_id: selectedEmployee })}
                            disabled={!selectedEmployee || assignMutation.isPending}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                        </button>
                        <button
                            onClick={() => setIsAssigning(false)}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Primary Teacher Section */}
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-medium text-gray-900">Primary Teacher</h3>
                    <button 
                        onClick={() => { setIsAssigning(true); setAssignRole('Primary'); setErrorMsg(''); }}
                        className="text-sm text-indigo-600 hover:text-indigo-900 font-medium"
                    >
                        {activePrimary ? 'Replace' : 'Assign'}
                    </button>
                </div>
                <div className="p-6">
                    {activePrimary ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
                                    {activePrimary.teacher?.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || '??'}
                                </div>
                                <div className="ml-4 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-lg font-medium text-gray-900">
                                            {activePrimary.teacher?.name}
                                        </h4>
                                        {renderComplianceBadge(activePrimary.compliance_status || activePrimary.teacher?.compliance_status, activePrimary.compliance_reason || activePrimary.teacher?.compliance_reason)}
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        Assigned: {activePrimary.assigned_date}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => removeMutation.mutate(activePrimary.id)}
                                disabled={removeMutation.isPending}
                                className="text-red-600 hover:text-red-900"
                                title="Remove from classroom"
                            >
                                <UserMinus className="h-5 w-5" />
                            </button>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm italic">No primary teacher assigned.</p>
                    )}
                </div>
            </div>

            {/* Assistant Teachers Section */}
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-lg font-medium text-gray-900">Assistant Teachers</h3>
                </div>
                <div className="divide-y divide-gray-200">
                    {activeAssistants.length > 0 ? (
                        activeAssistants.map((assistant: any) => (
                            <div key={assistant.id} className="p-6 flex items-center justify-between">
                                <div className="flex items-center">
                                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
                                        {assistant.teacher?.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || '??'}
                                    </div>
                                    <div className="ml-4 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-md font-medium text-gray-900">
                                                {assistant.teacher?.name}
                                            </h4>
                                            {renderComplianceBadge(assistant.compliance_status || assistant.teacher?.compliance_status, assistant.compliance_reason || assistant.teacher?.compliance_reason)}
                                        </div>
                                        <p className="text-sm text-gray-500">
                                            Assigned: {assistant.assigned_date}
                                        </p>
                                    </div>

                                </div>
                                <button 
                                    onClick={() => removeMutation.mutate(assistant.id)}
                                    disabled={removeMutation.isPending}
                                    className="text-red-600 hover:text-red-900"
                                >
                                    <UserMinus className="h-5 w-5" />
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="p-6">
                            <p className="text-gray-500 text-sm italic">No assistant teachers assigned.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* History Section */}
            {showHistory && (
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden mt-8">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="text-lg font-medium text-gray-900 flex items-center">
                            <History className="h-5 w-5 mr-2 text-gray-500" />
                            Assignment History
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ended</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {historicalStaff.length > 0 ? (
                                    historicalStaff.map((record: any) => (
                                        <tr key={record.id}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {record.teacher?.name}
                                                </div>
                                                <div className="text-sm text-gray-500">{record.teacher?.employee_number}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                                    {record.assignment_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {record.assigned_date}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {record.end_date}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                                            No history found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassroomTeachers;
