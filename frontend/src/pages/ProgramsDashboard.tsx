import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';

interface Program {
    id: string;
    name: string;
    description: string;
    age_group: string;
    program_fee: number;
    status: string;
    color: string;
}

interface Classroom {
    id: string;
    room_name: string;
    program_name: string;
    primary_teacher_name: string;
    capacity: number;
    status: string;
}

const ProgramsDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'programs' | 'classrooms'>('programs');
    
    const [programs, setPrograms] = useState<Program[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [loading, setLoading] = useState(true);

    const [showProgramModal, setShowProgramModal] = useState(false);
    const [showClassroomModal, setShowClassroomModal] = useState(false);
    const [formError, setFormError] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [progRes, classRes] = await Promise.all([
                api.get('/programs/'),
                api.get('/classrooms/')
            ]);
            setPrograms(progRes.data);
            setClassrooms(classRes.data);
        } catch (error) {
            console.error("Failed to fetch programs and classrooms data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddProgram = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormError('');
        const formData = new FormData(e.currentTarget);
        try {
            await api.post('/programs/', {
                name: formData.get('name'),
                description: formData.get('description'),
                age_group: formData.get('age_group'),
                program_fee: parseFloat(formData.get('program_fee') as string) || 0,
            });
            setShowProgramModal(false);
            fetchData();
        } catch (err) {
            setFormError('Failed to create program.');
        }
    };

    const handleAddClassroom = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormError('');
        const formData = new FormData(e.currentTarget);
        try {
            await api.post('/classrooms/', {
                room_name: formData.get('room_name'),
                program_id: formData.get('program_id') || null,
                capacity: parseInt(formData.get('capacity') as string) || 0,
            });
            setShowClassroomModal(false);
            fetchData();
        } catch (err) {
            setFormError('Failed to create classroom.');
        }
    };

    return (
        <Layout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Programs & Classrooms</h1>
                    <p className="mt-1 text-sm text-gray-500">Manage your curriculum offerings and physical spaces.</p>
                </div>
                <div>
                    {activeTab === 'programs' ? (
                        <button onClick={() => setShowProgramModal(true)} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium shadow-sm">
                            New Program
                        </button>
                    ) : (
                        <button onClick={() => setShowClassroomModal(true)} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium shadow-sm">
                            New Classroom
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('programs')}
                        className={`${
                            activeTab === 'programs'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Programs
                    </button>
                    <button
                        onClick={() => setActiveTab('classrooms')}
                        className={`${
                            activeTab === 'classrooms'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Classrooms
                    </button>
                </nav>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading data...</div>
                ) : activeTab === 'programs' ? (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age Group</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {programs.map((prog) => (
                                <tr key={prog.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{prog.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{prog.age_group}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${prog.program_fee}/mo</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${prog.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {prog.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {programs.length === 0 && (
                                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No programs found.</td></tr>
                            )}
                        </tbody>
                    </table>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Primary Teacher</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {classrooms.map((room) => (
                                <tr key={room.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{room.room_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{room.program_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{room.capacity}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{room.primary_teacher_name}</td>
                                </tr>
                            ))}
                            {classrooms.length === 0 && (
                                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No classrooms found.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Program Modal */}
            {showProgramModal && (
                <div className="fixed z-10 inset-0 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowProgramModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleAddProgram}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Add New Program</h3>
                                    {formError && <div className="bg-red-50 p-2 mb-4 text-sm text-red-700">{formError}</div>}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Program Name</label>
                                            <input type="text" name="name" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Age Group (e.g. Toddlers)</label>
                                            <input type="text" name="age_group" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Monthly Fee</label>
                                            <input type="number" step="0.01" name="program_fee" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Description</label>
                                            <textarea name="description" rows={3} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm">Save Program</button>
                                    <button type="button" onClick={() => setShowProgramModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Classroom Modal */}
            {showClassroomModal && (
                <div className="fixed z-10 inset-0 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowClassroomModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleAddClassroom}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Add New Classroom</h3>
                                    {formError && <div className="bg-red-50 p-2 mb-4 text-sm text-red-700">{formError}</div>}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Room Name</label>
                                            <input type="text" name="room_name" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Program</label>
                                            <select name="program_id" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                                <option value="">-- Select Program --</option>
                                                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Capacity (Max Students)</label>
                                            <input type="number" name="capacity" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm">Save Classroom</button>
                                    <button type="button" onClick={() => setShowClassroomModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default ProgramsDashboard;
