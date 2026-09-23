import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import api from '../../api';

const StudentEnrollment: React.FC = () => {
    const { student, updateStudent } = useOutletContext<any>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const handleAction = async (action: 'withdraw' | 'transfer' | 'archive') => {
        const confirmMsg = {
            withdraw: 'Are you sure you want to withdraw this student?',
            transfer: 'Are you sure you want to mark this student as transferred?',
            archive: 'Are you sure you want to archive this student record?'
        };

        if (!confirm(confirmMsg[action])) return;

        setLoading(true);
        try {
            await api.post(`/students/${student.id}/${action}/`);
            const statusMap = { withdraw: 'Withdrawn', transfer: 'Transferred', archive: 'Archived' };
            updateStudent({ ...student, status: statusMap[action] });
            alert(`Student successfully ${action}ed.`);
            if (action === 'archive') {
                navigate('/students'); // Go back to list if archived
            }
        } catch (err) {
            console.error(`Failed to ${action} student`, err);
            alert(`Failed to perform action.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Enrollment & Lifecycle</h3>
                <p className="mt-1 text-sm text-gray-500">Manage student enrollment status.</p>
            </div>
            
            <div className="px-4 py-5 sm:p-6 space-y-6">
                <div>
                    <h4 className="text-sm font-medium text-gray-900">Current Status: <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{student.status}</span></h4>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-4">Lifecycle Actions</h4>
                    
                    <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
                        <button 
                            onClick={() => handleAction('withdraw')}
                            disabled={loading || student.status === 'Withdrawn' || student.status === 'Archived'}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                        >
                            Withdraw Student
                        </button>
                        
                        <button 
                            onClick={() => handleAction('transfer')}
                            disabled={loading || student.status === 'Transferred' || student.status === 'Archived'}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                        >
                            Mark as Transferred
                        </button>

                        <button 
                            onClick={() => handleAction('archive')}
                            disabled={loading || student.status === 'Archived'}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 disabled:opacity-50"
                        >
                            Archive Record
                        </button>
                    </div>
                    <p className="mt-4 text-xs text-gray-500">
                        Warning: Archiving a record will hide it from the active student roster.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StudentEnrollment;
