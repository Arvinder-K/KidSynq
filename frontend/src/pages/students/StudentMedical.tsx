import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api';

const StudentMedical: React.FC = () => {
    const { student, updateStudent } = useOutletContext<any>();
    const [medicalInfo, setMedicalInfo] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchMedical = async () => {
            try {
                const response = await api.get(`/students/${student.id}/medical/`);
                setMedicalInfo(response.data);
            } catch (err) {
                console.error("Failed to load medical info", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMedical();
    }, [student.id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name in student) {
            updateStudent({ ...student, [name]: value });
        } else {
            setMedicalInfo({ ...medicalInfo, [name]: value });
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Include both HealthProfile fields and Student medical fields in the payload
            const payload = {
                ...medicalInfo,
                allergies: student.allergies,
                medical_conditions: student.medical_conditions,
                medication: student.medication,
                special_needs: student.special_needs,
                dietary_restrictions: student.dietary_restrictions,
                doctor_name: student.doctor_name,
                doctor_phone: student.doctor_phone,
                hospital_name: student.hospital_name,
            };
            const response = await api.put(`/students/${student.id}/medical/`, payload);
            setMedicalInfo(response.data);
            alert("Medical information saved successfully!");
        } catch (err) {
            console.error("Failed to save", err);
            alert("Failed to save medical information.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading medical records...</div>;

    return (
        <form onSubmit={handleSave} className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Medical & Health Information</h3>
                
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-6">
                        <label className="block text-sm font-medium text-gray-700">Allergies</label>
                        <div className="mt-1">
                            <textarea name="allergies" rows={2} value={student.allergies || ''} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                        </div>
                    </div>
                    
                    <div className="sm:col-span-6">
                        <label className="block text-sm font-medium text-gray-700">Medical Conditions</label>
                        <div className="mt-1">
                            <textarea name="medical_conditions" rows={2} value={student.medical_conditions || ''} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                        </div>
                    </div>
                    
                    <div className="sm:col-span-6">
                        <label className="block text-sm font-medium text-gray-700">Medication</label>
                        <div className="mt-1">
                            <textarea name="medication" rows={2} value={student.medication || ''} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                        </div>
                    </div>

                    <div className="sm:col-span-6">
                        <label className="block text-sm font-medium text-gray-700">Special Needs</label>
                        <div className="mt-1">
                            <textarea name="special_needs" rows={2} value={student.special_needs || ''} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                        </div>
                    </div>

                    <div className="sm:col-span-6">
                        <label className="block text-sm font-medium text-gray-700">Dietary Restrictions</label>
                        <div className="mt-1">
                            <textarea name="dietary_restrictions" rows={2} value={student.dietary_restrictions || ''} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                        </div>
                    </div>

                    <div className="sm:col-span-3">
                        <label className="block text-sm font-medium text-gray-700">Doctor Name / Primary Physician</label>
                        <div className="mt-1">
                            <input type="text" name="doctor_name" value={student.doctor_name || ''} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                        </div>
                    </div>

                    <div className="sm:col-span-3">
                        <label className="block text-sm font-medium text-gray-700">Doctor Phone</label>
                        <div className="mt-1">
                            <input type="text" name="doctor_phone" value={student.doctor_phone || ''} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                        </div>
                    </div>

                    <div className="sm:col-span-3">
                        <label className="block text-sm font-medium text-gray-700">Preferred Hospital</label>
                        <div className="mt-1">
                            <input type="text" name="hospital_name" value={student.hospital_name || ''} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                        </div>
                    </div>

                    <div className="sm:col-span-3">
                        <label className="block text-sm font-medium text-gray-700">Blood Type</label>
                        <div className="mt-1">
                            <input type="text" name="blood_type" value={medicalInfo.blood_type || ''} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                        </div>
                    </div>
                </div>
            </div>
            <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 rounded-b-lg">
                <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    {saving ? 'Saving...' : 'Save Medical Info'}
                </button>
            </div>
        </form>
    );
};

export default StudentMedical;
