import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';

interface StudentSummary {
    id: string;
    first_name: string;
    last_name: string;
    allergy_count: number;
    medication_count: number;
}

interface Allergy {
    id: string;
    allergen: string;
    severity: string;
    symptoms: string;
    emergency_response: string;
}

interface MedicationAdministration {
    id: string;
    date: string;
    time: string;
    dosage_given: string;
    administered_by_name: string;
}

interface Medication {
    id: string;
    medication_name: string;
    dosage: string;
    frequency: string;
    special_instructions: string;
    administrations: MedicationAdministration[];
}

interface StudentDetail {
    id: string;
    first_name: string;
    last_name: string;
    health_profile: {
        blood_type: string;
        primary_physician: string;
        emergency_medical_consent: boolean;
        special_needs: string;
    } | null;
    allergies: Allergy[];
    active_medications: Medication[];
}

const HealthDashboard: React.FC = () => {
    const [students, setStudents] = useState<StudentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    
    // Modal states
    const [showMedModal, setShowMedModal] = useState(false);
    const [selectedMedId, setSelectedMedId] = useState<string>('');
    const [formLoading, setFormLoading] = useState(false);

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const res = await api.get('/health/dashboard/');
            setStudents(res.data);
        } catch (error) {
            console.error("Failed to fetch health dashboard", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchStudentDetail = async (id: string) => {
        setDetailLoading(true);
        try {
            const res = await api.get(`/health/student/${id}/`);
            setStudentDetail(res.data);
        } catch (error) {
            console.error("Failed to fetch student details", error);
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        if (selectedStudentId) {
            fetchStudentDetail(selectedStudentId);
        } else {
            setStudentDetail(null);
        }
    }, [selectedStudentId]);

    const handleLogDose = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormLoading(true);
        const formData = new FormData(e.currentTarget);
        try {
            await api.post('/health/medication/log/', {
                medication_id: selectedMedId,
                dosage_given: formData.get('dosage_given'),
                outcome: formData.get('outcome'),
                teacher_notes: formData.get('teacher_notes')
            });
            setShowMedModal(false);
            if (selectedStudentId) fetchStudentDetail(selectedStudentId);
        } catch (error) {
            console.error("Failed to log dose", error);
        } finally {
            setFormLoading(false);
        }
    };

    const openMedModal = (medId: string) => {
        setSelectedMedId(medId);
        setShowMedModal(true);
    };

    return (
        <Layout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Health & Medical</h1>
                    <p className="mt-1 text-sm text-gray-500">Track allergies, active medications, and log dosages.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Roster List */}
                <div className={`lg:col-span-1 bg-white shadow overflow-hidden sm:rounded-lg ${selectedStudentId ? 'hidden lg:block' : ''}`}>
                    <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Student Roster</h3>
                    </div>
                    {loading ? (
                        <div className="p-4 text-center text-gray-500">Loading...</div>
                    ) : (
                        <ul className="divide-y divide-gray-200 h-96 overflow-y-auto">
                            {students.map((student) => (
                                <li key={student.id}>
                                    <button 
                                        onClick={() => setSelectedStudentId(student.id)}
                                        className={`w-full text-left px-4 py-4 hover:bg-indigo-50 transition flex items-center justify-between ${selectedStudentId === student.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                                    >
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                                {student.first_name[0]}{student.last_name[0]}
                                            </div>
                                            <div className="ml-3">
                                                <p className="text-sm font-medium text-gray-900">{student.first_name} {student.last_name}</p>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            {student.allergy_count > 0 && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800" title={`${student.allergy_count} Allergies`}>
                                                    ⚠️ {student.allergy_count}
                                                </span>
                                            )}
                                            {student.medication_count > 0 && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" title={`${student.medication_count} Active Meds`}>
                                                    💊 {student.medication_count}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Detail View */}
                <div className={`lg:col-span-2 ${!selectedStudentId ? 'hidden lg:block' : ''}`}>
                    {!selectedStudentId ? (
                        <div className="bg-white shadow sm:rounded-lg py-16 text-center text-gray-500">
                            <p>Select a student to view their health profile.</p>
                        </div>
                    ) : detailLoading ? (
                        <div className="bg-white shadow sm:rounded-lg py-16 text-center text-gray-500">Loading details...</div>
                    ) : studentDetail ? (
                        <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                            <div className="bg-indigo-600 px-4 py-5 sm:px-6 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg leading-6 font-medium text-white">{studentDetail.first_name} {studentDetail.last_name}'s Health Profile</h3>
                                </div>
                                <button className="lg:hidden text-white hover:text-gray-200" onClick={() => setSelectedStudentId(null)}>Back to Roster</button>
                            </div>
                            
                            <div className="px-4 py-5 sm:p-6 space-y-6">
                                {/* Profile Info */}
                                <div>
                                    <h4 className="text-md font-medium text-gray-900 border-b pb-2">General Information</h4>
                                    <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                                        <div className="sm:col-span-1">
                                            <dt className="text-sm font-medium text-gray-500">Primary Physician</dt>
                                            <dd className="mt-1 text-sm text-gray-900">{studentDetail.health_profile?.primary_physician || 'Not provided'}</dd>
                                        </div>
                                        <div className="sm:col-span-1">
                                            <dt className="text-sm font-medium text-gray-500">Emergency Medical Consent</dt>
                                            <dd className="mt-1 text-sm text-gray-900">{studentDetail.health_profile?.emergency_medical_consent ? 'Yes' : 'No'}</dd>
                                        </div>
                                    </dl>
                                </div>

                                {/* Allergies */}
                                <div>
                                    <h4 className="text-md font-medium text-gray-900 border-b pb-2 flex items-center">
                                        <span className="mr-2">⚠️</span> Allergies ({studentDetail.allergies.length})
                                    </h4>
                                    {studentDetail.allergies.length === 0 ? (
                                        <p className="mt-3 text-sm text-gray-500">No known allergies.</p>
                                    ) : (
                                        <ul className="mt-3 space-y-3">
                                            {studentDetail.allergies.map(allergy => (
                                                <li key={allergy.id} className="bg-red-50 border border-red-200 rounded-md p-3">
                                                    <div className="flex justify-between">
                                                        <p className="text-sm font-medium text-red-800">{allergy.allergen}</p>
                                                        <span className={`px-2 py-1 text-xs rounded-full font-bold ${allergy.severity === 'Severe' ? 'bg-red-200 text-red-900' : 'bg-red-100 text-red-700'}`}>{allergy.severity}</span>
                                                    </div>
                                                    <p className="mt-1 text-xs text-red-700"><strong>Symptoms:</strong> {allergy.symptoms}</p>
                                                    <p className="mt-1 text-xs text-red-700"><strong>Emergency:</strong> {allergy.emergency_response}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {/* Medications */}
                                <div>
                                    <h4 className="text-md font-medium text-gray-900 border-b pb-2 flex items-center">
                                        <span className="mr-2">💊</span> Active Medications ({studentDetail.active_medications.length})
                                    </h4>
                                    {studentDetail.active_medications.length === 0 ? (
                                        <p className="mt-3 text-sm text-gray-500">No active medications.</p>
                                    ) : (
                                        <div className="mt-3 space-y-4">
                                            {studentDetail.active_medications.map(med => (
                                                <div key={med.id} className="bg-blue-50 border border-blue-200 rounded-md overflow-hidden">
                                                    <div className="p-4 flex justify-between items-start">
                                                        <div>
                                                            <h5 className="text-md font-medium text-blue-900">{med.medication_name}</h5>
                                                            <p className="text-sm text-blue-800 mt-1">Dosage: {med.dosage} ({med.frequency})</p>
                                                            <p className="text-xs text-blue-700 mt-1">Note: {med.special_instructions}</p>
                                                        </div>
                                                        <button 
                                                            onClick={() => openMedModal(med.id)}
                                                            className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded text-sm font-medium shadow-sm transition"
                                                        >
                                                            Log Dose
                                                        </button>
                                                    </div>
                                                    {med.administrations.length > 0 && (
                                                        <div className="bg-white border-t border-blue-100 p-3">
                                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Logs</p>
                                                            <ul className="space-y-1">
                                                                {med.administrations.slice(0, 3).map(admin => (
                                                                    <li key={admin.id} className="text-xs text-gray-700 flex justify-between">
                                                                        <span>{admin.date} {admin.time.substring(0,5)} by {admin.administered_by_name}</span>
                                                                        <span className="text-green-600 font-medium">{admin.dosage_given}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Log Dose Modal */}
            {showMedModal && (
                <div className="fixed z-10 inset-0 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowMedModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleLogDose}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Log Medication Dose</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Dosage Given</label>
                                            <input type="text" name="dosage_given" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g., 10ml, 1 tablet" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Outcome</label>
                                            <select name="outcome" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                                <option value="Successfully Administered">Successfully Administered</option>
                                                <option value="Refused">Refused</option>
                                                <option value="Spit Out">Spit Out</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Teacher Notes (Optional)</label>
                                            <textarea name="teacher_notes" rows={2} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button type="submit" disabled={formLoading} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-blue-400">
                                        {formLoading ? 'Saving...' : 'Save Log'}
                                    </button>
                                    <button type="button" onClick={() => setShowMedModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default HealthDashboard;
