import React, { useState } from 'react';
import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const StudentForm: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState('');

    // Step 1: Child Information
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [preferredName, setPreferredName] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState('Male');
    const [language, setLanguage] = useState('');

    // Step 2: Enrollment Information
    const [admissionNumber, setAdmissionNumber] = useState('');
    const [admissionDate, setAdmissionDate] = useState('');
    const [joiningDate, setJoiningDate] = useState('');
    const [status, setStatus] = useState('Active');

    // Step 3: Emergency Information
    const [contactName, setContactName] = useState('');
    const [contactRelationship, setContactRelationship] = useState('');
    const [contactMobile, setContactMobile] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [doctorName, setDoctorName] = useState('');
    const [hospitalName, setHospitalName] = useState('');

    // Helpers
    const calculateAge = (dobString: string) => {
        if (!dobString) return 'N/A';
        const today = new Date();
        const birthDate = new Date(dobString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const validateStep1 = () => firstName.trim() !== '' && lastName.trim() !== '' && dob.trim() !== '';
    const validateStep2 = () => admissionNumber.trim() !== '' && admissionDate.trim() !== '';
    const validateStep3 = () => contactName.trim() !== '' && contactRelationship.trim() !== '' && contactMobile.trim() !== '';

    const handleNext = () => {
        setFormError('');
        if (step === 1 && !validateStep1()) {
            setFormError('Please fill out all required fields (First Name, Last Name, Date of Birth).');
            return;
        }
        if (step === 2 && !validateStep2()) {
            setFormError('Please fill out all required fields (Admission Number, Enrollment Date).');
            return;
        }
        if (step === 3 && !validateStep3()) {
            setFormError('Please fill out all required primary emergency contact fields.');
            return;
        }
        setStep(step + 1);
    };

    const handlePrev = () => {
        setFormError('');
        setStep(step - 1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setFormError('');

        try {
            await api.post('/students/', {
                first_name: firstName,
                last_name: lastName,
                preferred_name: preferredName,
                dob: dob || null,
                gender: gender,
                language: language,
                admission_number: admissionNumber,
                admission_date: admissionDate || null,
                joining_date: joiningDate || null,
                status: status,
                doctor_name: doctorName,
                hospital_name: hospitalName,
                emergency_contact: {
                    name: contactName,
                    relationship: contactRelationship,
                    mobile: contactMobile,
                    email: contactEmail
                }
            });
            navigate('/students');
        } catch (error: any) {
            setFormError(error.response?.data?.detail || 'Failed to create student record.');
            setLoading(false);
            setStep(4); // Keep them on the review step if it fails
        }
    };

    return (
        <Layout>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Child Admission</h1>
                    <p className="mt-1 text-sm text-gray-500">Register a new child and complete their enrollment profile.</p>
                </div>
                <div className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                    Step {step} of 4
                </div>
            </div>

            {formError && (
                <div className="bg-red-50 p-4 mb-4 text-sm text-red-700 rounded-md border border-red-200">
                    {formError}
                </div>
            )}

            <div className="bg-white shadow sm:rounded-lg mb-6">
                <div className="px-4 py-5 sm:p-6">
                    {step === 1 && (
                        <div>
                            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Step 1: Child Information</h3>
                            <div className="grid grid-cols-6 gap-6">
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">First Name *</label>
                                    <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                                    <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Preferred Name</label>
                                    <input type="text" value={preferredName} onChange={e => setPreferredName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Date of Birth *</label>
                                    <input type="date" required value={dob} onChange={e => setDob(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Gender</label>
                                    <select value={gender} onChange={e => setGender(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                        <option>Male</option>
                                        <option>Female</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Primary Language</label>
                                    <input type="text" value={language} onChange={e => setLanguage(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div>
                            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Step 2: Enrollment Information</h3>
                            <div className="grid grid-cols-6 gap-6">
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Admission Number *</label>
                                    <input type="text" required value={admissionNumber} onChange={e => setAdmissionNumber(e.target.value)} placeholder="e.g. ADM-001" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Enrollment Date *</label>
                                    <input type="date" required value={admissionDate} onChange={e => setAdmissionDate(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Start Date (Joining Date)</label>
                                    <input type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Initial Status</label>
                                    <select value={status} onChange={e => setStatus(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                        <option>Active</option>
                                        <option>Waitlist</option>
                                        <option>Inactive</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div>
                            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Step 3: Emergency Information</h3>
                            <div className="grid grid-cols-6 gap-6">
                                <div className="col-span-6"><h4 className="font-medium text-gray-700 text-sm border-b pb-2">Primary Emergency Contact</h4></div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Contact Name *</label>
                                    <input type="text" required value={contactName} onChange={e => setContactName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Relationship *</label>
                                    <input type="text" required value={contactRelationship} onChange={e => setContactRelationship(e.target.value)} placeholder="e.g. Mother, Father" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Mobile Phone *</label>
                                    <input type="text" required value={contactMobile} onChange={e => setContactMobile(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Email Address</label>
                                    <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>

                                <div className="col-span-6 mt-4"><h4 className="font-medium text-gray-700 text-sm border-b pb-2">Medical Contacts</h4></div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Doctor Name</label>
                                    <input type="text" value={doctorName} onChange={e => setDoctorName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">Preferred Hospital</label>
                                    <input type="text" value={hospitalName} onChange={e => setHospitalName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div>
                            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Step 4: Review Admission</h3>
                            <div className="border-t border-gray-200">
                                <dl className="divide-y divide-gray-200">
                                    <div className="py-3 grid grid-cols-3 gap-4">
                                        <dt className="text-sm font-medium text-gray-500">Child Name</dt>
                                        <dd className="text-sm text-gray-900 col-span-2">{firstName} {lastName} {preferredName && `(${preferredName})`}</dd>
                                    </div>
                                    <div className="py-3 grid grid-cols-3 gap-4">
                                        <dt className="text-sm font-medium text-gray-500">Date of Birth & Age</dt>
                                        <dd className="text-sm text-gray-900 col-span-2">{dob} ({calculateAge(dob)} years old)</dd>
                                    </div>
                                    <div className="py-3 grid grid-cols-3 gap-4">
                                        <dt className="text-sm font-medium text-gray-500">Admission No.</dt>
                                        <dd className="text-sm text-gray-900 col-span-2">{admissionNumber}</dd>
                                    </div>
                                    <div className="py-3 grid grid-cols-3 gap-4">
                                        <dt className="text-sm font-medium text-gray-500">Emergency Contact</dt>
                                        <dd className="text-sm text-gray-900 col-span-2">{contactName} ({contactRelationship}) - {contactMobile}</dd>
                                    </div>
                                </dl>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 sm:px-6 flex justify-between items-center rounded-b-lg">
                    {step > 1 ? (
                        <button type="button" onClick={handlePrev} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                            Back
                        </button>
                    ) : (
                        <button type="button" onClick={() => navigate('/students')} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                            Cancel
                        </button>
                    )}

                    {step < 4 ? (
                        <button type="button" onClick={handleNext} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                            Next Step
                        </button>
                    ) : (
                        <button type="button" onClick={handleSubmit} disabled={loading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
                            {loading ? 'Submitting...' : 'Submit Admission'}
                        </button>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default StudentForm;
