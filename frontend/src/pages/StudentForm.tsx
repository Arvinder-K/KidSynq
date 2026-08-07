import React, { useState } from 'react';
import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const StudentForm: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState('');

    // Basic Info
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState('Male');
    const [admissionNumber, setAdmissionNumber] = useState('');
    const [admissionDate, setAdmissionDate] = useState('');
    const [status, setStatus] = useState('Active');

    // Medical Info
    const [allergies, setAllergies] = useState('');
    const [medicalConditions, setMedicalConditions] = useState('');
    const [medication, setMedication] = useState('');
    const [doctorName, setDoctorName] = useState('');
    const [doctorPhone, setDoctorPhone] = useState('');
    const [hospitalName, setHospitalName] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setFormError('');

        try {
            await api.post('/students/', {
                first_name: firstName,
                last_name: lastName,
                dob: dob || null,
                gender: gender,
                admission_number: admissionNumber,
                admission_date: admissionDate || null,
                status: status,
                allergies: allergies,
                medical_conditions: medicalConditions,
                medication: medication,
                doctor_name: doctorName,
                doctor_phone: doctorPhone,
                hospital_name: hospitalName
            });
            navigate('/students'); // Redirect to roster
        } catch (error: any) {
            setFormError(error.response?.data?.detail || 'Failed to create student record.');
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">New Enrollment</h1>
                <p className="mt-1 text-sm text-gray-500">Register a new student and record their medical details.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {formError && (
                    <div className="bg-red-50 p-4 mb-4 text-sm text-red-700 rounded-md border border-red-200">
                        {formError}
                    </div>
                )}

                {/* Basic Information Panel */}
                <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
                    <div className="md:grid md:grid-cols-3 md:gap-6">
                        <div className="md:col-span-1">
                            <h3 className="text-lg font-medium leading-6 text-gray-900">Basic Information</h3>
                            <p className="mt-1 text-sm text-gray-500">Name, age, and enrollment details.</p>
                        </div>
                        <div className="mt-5 md:mt-0 md:col-span-2">
                            <div className="grid grid-cols-6 gap-6">
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">First name</label>
                                    <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Last name</label>
                                    <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                                    <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Gender</label>
                                    <select value={gender} onChange={e => setGender(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                        <option>Male</option>
                                        <option>Female</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Admission No.</label>
                                    <input type="text" value={admissionNumber} onChange={e => setAdmissionNumber(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Admission Date</label>
                                    <input type="date" value={admissionDate} onChange={e => setAdmissionDate(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Status</label>
                                    <select value={status} onChange={e => setStatus(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                        <option>Active</option>
                                        <option>Inactive</option>
                                        <option>Graduated</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Medical Information Panel */}
                <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
                    <div className="md:grid md:grid-cols-3 md:gap-6">
                        <div className="md:col-span-1">
                            <h3 className="text-lg font-medium leading-6 text-gray-900">Medical Information</h3>
                            <p className="mt-1 text-sm text-gray-500">Allergies, conditions, and doctor contacts.</p>
                        </div>
                        <div className="mt-5 md:mt-0 md:col-span-2">
                            <div className="grid grid-cols-6 gap-6">
                                <div className="col-span-6">
                                    <label className="block text-sm font-medium text-gray-700">Allergies</label>
                                    <textarea rows={2} value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="E.g., Peanuts, Dairy, Penicillin" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                                </div>
                                <div className="col-span-6">
                                    <label className="block text-sm font-medium text-gray-700">Medical Conditions</label>
                                    <textarea rows={2} value={medicalConditions} onChange={e => setMedicalConditions(e.target.value)} placeholder="E.g., Asthma, Diabetes" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                                </div>
                                <div className="col-span-6">
                                    <label className="block text-sm font-medium text-gray-700">Current Medications</label>
                                    <textarea rows={2} value={medication} onChange={e => setMedication(e.target.value)} placeholder="E.g., Albuterol Inhaler as needed" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Doctor's Name</label>
                                    <input type="text" value={doctorName} onChange={e => setDoctorName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Doctor's Phone</label>
                                    <input type="text" value={doctorPhone} onChange={e => setDoctorPhone(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Preferred Hospital</label>
                                    <input type="text" value={hospitalName} onChange={e => setHospitalName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button type="button" onClick={() => navigate('/students')} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Cancel
                    </button>
                    <button type="submit" disabled={loading} className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        {loading ? 'Saving...' : 'Save Student Record'}
                    </button>
                </div>
            </form>
        </Layout>
    );
};

export default StudentForm;
