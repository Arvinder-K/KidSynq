import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';

interface StudentRosterItem {
    id: string;
    first_name: string;
    last_name: string;
    attendance_status: string; // 'Present', 'Absent', 'Unmarked'
}

const AttendanceTracker: React.FC = () => {
    const [students, setStudents] = useState<StudentRosterItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const fetchAttendance = async (dateStr: string) => {
        setLoading(true);
        try {
            const res = await api.get('/attendance/', { params: { date: dateStr } });
            setStudents(res.data);
        } catch (error) {
            console.error("Failed to fetch attendance", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendance(currentDate);
    }, [currentDate]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentDate(e.target.value);
    };

    const handleStatusUpdate = async (studentId: string, newStatus: string) => {
        setUpdatingId(studentId);
        try {
            await api.post('/attendance/', {
                student_id: studentId,
                date: currentDate,
                status: newStatus
            });
            // Optimistically update local state
            setStudents(students.map(s => s.id === studentId ? { ...s, attendance_status: newStatus } : s));
        } catch (error) {
            console.error("Failed to update attendance", error);
            // Optionally could revert state or show a toast notification here
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <Layout>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Daily Attendance</h1>
                    <p className="mt-1 text-sm text-gray-500">Record check-ins and absences quickly.</p>
                </div>
                <div className="flex items-center">
                    <label htmlFor="datePicker" className="mr-3 text-sm font-medium text-gray-700">Date:</label>
                    <input 
                        type="date" 
                        id="datePicker"
                        value={currentDate} 
                        onChange={handleDateChange}
                        className="border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm" 
                    />
                </div>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading roster...</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quick Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {students.map((student) => (
                                <tr key={student.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                                    {student.first_name[0]}{student.last_name[0]}
                                                </div>
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{student.first_name} {student.last_name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        {student.attendance_status === 'Present' && (
                                            <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                Present
                                            </span>
                                        )}
                                        {student.attendance_status === 'Absent' && (
                                            <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                Absent
                                            </span>
                                        )}
                                        {student.attendance_status === 'Unmarked' && (
                                            <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-gray-100 text-gray-500">
                                                Unmarked
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button 
                                            disabled={updatingId === student.id}
                                            onClick={() => handleStatusUpdate(student.id, 'Present')}
                                            className={`mr-3 ${student.attendance_status === 'Present' ? 'text-gray-300 cursor-not-allowed' : 'text-green-600 hover:text-green-900'} transition-colors`}
                                        >
                                            Mark Present
                                        </button>
                                        <button 
                                            disabled={updatingId === student.id}
                                            onClick={() => handleStatusUpdate(student.id, 'Absent')}
                                            className={`${student.attendance_status === 'Absent' ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:text-red-900'} transition-colors`}
                                        >
                                            Mark Absent
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {students.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-sm text-gray-500">
                                        No active students found in the roster.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </Layout>
    );
};

export default AttendanceTracker;
