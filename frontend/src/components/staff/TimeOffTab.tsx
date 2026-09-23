import React, { useEffect, useState } from 'react';
import api from '../../api';

interface TimeOffRequest {
    id: string;
    employee_name: string;
    start_date: string;
    end_date: string;
    leave_type: string;
    reason: string;
    status: string;
}

const TimeOffTab: React.FC = () => {
    const [requests, setRequests] = useState<TimeOffRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = async () => {
        try {
            const response = await api.get('/staff/time-off/');
            setRequests(response.data);
        } catch (error) {
            console.error("Failed to fetch time off requests", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const updateStatus = async (id: string, status: string) => {
        try {
            await api.patch(`/staff/time-off/${id}/`, { status });
            fetchRequests();
        } catch (error) {
            console.error("Failed to update status", error);
        }
    };

    return (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading requests...</div>
            ) : (
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {requests.map(req => (
                            <tr key={req.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{req.employee_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{req.start_date} to {req.end_date}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{req.leave_type}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${req.status === 'Approved' ? 'bg-green-100 text-green-800' : req.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {req.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                    {req.status === 'Pending' && (
                                        <>
                                            <button onClick={() => updateStatus(req.id, 'Approved')} className="text-indigo-600 hover:text-indigo-900">Approve</button>
                                            <button onClick={() => updateStatus(req.id, 'Rejected')} className="text-red-600 hover:text-red-900">Reject</button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {requests.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No time off requests found.</td></tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default TimeOffTab;
