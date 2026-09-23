import React, { useEffect, useState } from 'react';
import api from '../../api';

interface StaffAttendance {
    id: string;
    employee_name: string;
    date: string;
    status: string;
    check_in_time: string | null;
    check_out_time: string | null;
}

const StaffAttendanceTab: React.FC = () => {
    const [attendance, setAttendance] = useState<StaffAttendance[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAttendance = async () => {
        try {
            const response = await api.get('/staff/attendance/');
            setAttendance(response.data);
        } catch (error) {
            console.error("Failed to fetch staff attendance", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendance();
    }, []);

    return (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading attendance...</div>
            ) : (
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check In</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check Out</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {attendance.map(record => (
                            <tr key={record.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.employee_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.date}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${record.status === 'Present' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {record.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.check_in_time || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.check_out_time || '-'}</td>
                            </tr>
                        ))}
                        {attendance.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No attendance records found.</td></tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default StaffAttendanceTab;
