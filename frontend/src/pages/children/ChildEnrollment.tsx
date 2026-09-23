import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Calendar, UserMinus, RefreshCcw, Archive, Play, AlertCircle, MapPin } from 'lucide-react';
import api from '../../api';
import type { Child } from './ChildProfileLayout';

interface ContextType {
    child: Child;
    setChild: React.Dispatch<React.SetStateAction<Child | null>>;
    fetchChild: () => Promise<void>;
}

interface Enrollment {
    id: string;
    application_date: string | null;
    enrollment_date: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
    withdrawal_reason: string | null;
    notes: string | null;
}

interface Branch {
    id: string;
    name: string;
}

export default function ChildEnrollment() {
    const { child, setChild } = useOutletContext<ContextType>();
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal states
    const [modalAction, setModalAction] = useState<'withdraw' | 'transfer' | 'archive' | 'reenroll' | null>(null);
    const [formData, setFormData] = useState<any>({});
    const [error, setError] = useState('');

    useEffect(() => {
        fetchData();
    }, [child.id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [enrollmentsRes, branchesRes] = await Promise.all([
                api.get(`/daycare/children/${child.id}/enrollments/`),
                api.get(`/daycare/branches/`)
            ]);
            setEnrollments(enrollmentsRes.data);
            setBranches(branchesRes.data);
        } catch (error) {
            console.error("Failed to fetch enrollment data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (e: React.FormEvent | React.MouseEvent) => {
        if (e && 'preventDefault' in e) e.preventDefault();
        setError('');
        try {
            let endpoint = '';
            switch (modalAction) {
                case 'withdraw': endpoint = 'withdraw'; break;
                case 'transfer': endpoint = 'transfer'; break;
                case 'archive': endpoint = 'archive'; break;
                case 'reenroll': endpoint = 're-enroll'; break;
            }
            
            await api.post(`/daycare/children/${child.id}/${endpoint}/`, formData);
            setModalAction(null);
            setFormData({});
            
            // Refetch child to update top level status
            const childRes = await api.get(`/daycare/children/${child.id}/`);
            setChild(childRes.data);
            fetchData();
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || "An error occurred");
        }
    };

    const openModal = (action: 'withdraw' | 'transfer' | 'archive' | 'reenroll') => {
        setModalAction(action);
        setFormData({});
        setError('');
        if (action === 'withdraw') {
            setFormData({ withdrawal_date: new Date().toISOString().split('T')[0] });
        } else if (action === 'transfer') {
            setFormData({ transfer_date: new Date().toISOString().split('T')[0], branch_id: '' });
        } else if (action === 'reenroll') {
            setFormData({ start_date: new Date().toISOString().split('T')[0] });
        }
    };

    const activeEnrollment = enrollments.find(e => e.status === 'Active');

    if (loading) return <div className="p-4">Loading...</div>;

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Action Bar */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-wrap gap-3">
                {child.status === 'Active' && (
                    <>
                        <button onClick={() => openModal('transfer')} className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            <MapPin className="w-4 h-4 mr-2 text-blue-500" />
                            Transfer Branch
                        </button>
                        <button onClick={() => openModal('withdraw')} className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            <UserMinus className="w-4 h-4 mr-2 text-orange-500" />
                            Withdraw Student
                        </button>
                    </>
                )}
                {['Withdrawn', 'Transferred'].includes(child.status) && (
                    <button onClick={() => openModal('archive')} className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <Archive className="w-4 h-4 mr-2 text-gray-500" />
                        Archive Student
                    </button>
                )}
                {['Withdrawn', 'Archived'].includes(child.status) && (
                    <button onClick={() => openModal('reenroll')} className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <Play className="w-4 h-4 mr-2" />
                        Re-enroll Student
                    </button>
                )}
            </div>

            {/* Current Status Card */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center">
                        <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
                        Current Enrollment Status
                    </h3>
                </div>
                <div className="p-6">
                    {child.status === 'Active' && activeEnrollment ? (
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                            <div>
                                <h4 className="text-xl font-bold text-green-600">Active</h4>
                                <p className="text-sm text-gray-500 mt-1">
                                    Enrolled since {activeEnrollment.start_date ? new Date(activeEnrollment.start_date).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                            <h4 className="text-lg font-medium text-gray-900">Student is {child.status}</h4>
                            <p className="text-sm text-gray-500 mt-1">This student does not have an active enrollment.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Enrollment History */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center">
                        <RefreshCcw className="w-5 h-5 mr-2 text-indigo-600" />
                        Enrollment History
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason/Notes</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {enrollments.map((env) => (
                                <tr key={env.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {env.start_date ? new Date(env.start_date).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {env.end_date ? new Date(env.end_date).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${env.status === 'Active' ? 'bg-green-100 text-green-800' : 
                                              env.status === 'Withdrawn' ? 'bg-orange-100 text-orange-800' : 
                                              env.status === 'Transferred' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {env.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                        {env.withdrawal_reason || env.notes || '-'}
                                    </td>
                                </tr>
                            ))}
                            {enrollments.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                                        No enrollment records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {modalAction && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setModalAction(null)}></div>
                        <div className="relative inline-block w-full max-w-md px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:p-6">
                            
                            <h3 className="text-lg font-medium leading-6 text-gray-900 capitalize mb-4">
                                {modalAction === 'reenroll' ? 'Re-enroll Student' : `${modalAction} Student`}
                            </h3>
                            
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
                                    {error}
                                </div>
                            )}

                            {modalAction === 'archive' ? (
                                <div>
                                    <div className="mb-4 text-sm text-gray-600">
                                        Are you sure you want to archive this student? Archiving preserves all historical data but hides the student from active lists.
                                    </div>
                                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                                        <button onClick={handleAction} className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none sm:col-start-2 sm:text-sm">
                                            Confirm Archive
                                        </button>
                                        <button type="button" onClick={() => setModalAction(null)} className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none sm:mt-0 sm:col-start-1 sm:text-sm">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <form id="action-form" onSubmit={handleAction} className="space-y-4">
                                    
                                    {modalAction === 'withdraw' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Withdrawal Date</label>
                                                <input type="date" required value={formData.withdrawal_date || ''} onChange={(e) => setFormData({...formData, withdrawal_date: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Reason</label>
                                                <input type="text" required value={formData.reason || ''} onChange={(e) => setFormData({...formData, reason: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" placeholder="e.g. Moving away" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
                                                <textarea value={formData.notes || ''} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"></textarea>
                                            </div>
                                        </>
                                    )}

                                    {modalAction === 'transfer' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Target Branch</label>
                                                <select required value={formData.branch_id || ''} onChange={(e) => setFormData({...formData, branch_id: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border">
                                                    <option value="">Select branch...</option>
                                                    {branches.map(b => (
                                                        <option key={b.id} value={b.id}>{b.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Transfer Date</label>
                                                <input type="date" required value={formData.transfer_date || ''} onChange={(e) => setFormData({...formData, transfer_date: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
                                            </div>
                                        </>
                                    )}

                                    {modalAction === 'reenroll' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Start Date</label>
                                            <input type="date" required value={formData.start_date || ''} onChange={(e) => setFormData({...formData, start_date: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
                                        </div>
                                    )}
                                    
                                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                                        <button type="submit" form="action-form" className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none sm:col-start-2 sm:text-sm">
                                            Submit
                                        </button>
                                        <button type="button" onClick={() => setModalAction(null)} className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none sm:mt-0 sm:col-start-1 sm:text-sm">
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
