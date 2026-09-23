import React, { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api';

const StudentOverview: React.FC = () => {
    const { student, setStudent } = useOutletContext<any>();
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    
    const [formData, setFormData] = useState({
        first_name: student.first_name || '',
        last_name: student.last_name || '',
        preferred_name: student.preferred_name || '',
        dob: student.dob || '',
        gender: student.gender || '',
        language: student.language || '',
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const payload: any = { ...formData };
            if (payload.dob === '') payload.dob = null;
            if (payload.preferred_name === '') payload.preferred_name = null;
            if (payload.gender === '') payload.gender = null;
            if (payload.language === '') payload.language = null;

            const response = await api.patch(`/students/${student.id}/`, payload);
            setStudent(response.data);
            setIsEditing(false);
        } catch (err: any) {
            const errorMsg = err.response?.data 
                ? JSON.stringify(err.response.data) 
                : err.message;
            setError(`Failed to update profile. ${errorMsg}`);
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        const file = e.target.files[0];
        const uploadData = new FormData();
        uploadData.append('photo', file);

        setUploadingPhoto(true);
        setError('');
        try {
            const response = await api.post(`/students/${student.id}/photo/`, uploadData);
            // Update student photo locally
            setStudent({ ...student, photo: response.data.photo });
        } catch (err: any) {
            const errorMsg = err.response?.data 
                ? JSON.stringify(err.response.data) 
                : err.message;
            console.error("Failed to upload photo", err);
            alert(`Failed to upload photo: ${errorMsg}`);
        } finally {
            setUploadingPhoto(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Basic Information</h3>
                    <div className="flex space-x-2">
                        <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            ref={fileInputRef} 
                            onChange={handlePhotoUpload} 
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingPhoto}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                        >
                            {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                        </button>
                        
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                            >
                                Edit Profile
                            </button>
                        ) : (
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setFormData({
                                            first_name: student.first_name || '',
                                            last_name: student.last_name || '',
                                            preferred_name: student.preferred_name || '',
                                            dob: student.dob || '',
                                            gender: student.gender || '',
                                            language: student.language || '',
                                        });
                                    }}
                                    className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                                >
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="border-t border-gray-200 py-5 sm:p-0">
                    {error && <div className="p-4 text-red-500 text-sm">{error}</div>}
                    <dl className="sm:divide-y sm:divide-gray-200">
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">First Name</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                {isEditing ? (
                                    <input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-1 border" />
                                ) : (
                                    student.first_name
                                )}
                            </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">Last Name</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                {isEditing ? (
                                    <input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-1 border" />
                                ) : (
                                    student.last_name
                                )}
                            </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">Preferred Name</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                {isEditing ? (
                                    <input type="text" name="preferred_name" value={formData.preferred_name} onChange={handleInputChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-1 border" />
                                ) : (
                                    student.preferred_name || 'N/A'
                                )}
                            </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                {isEditing ? (
                                    <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-1 border" />
                                ) : (
                                    student.dob || 'N/A'
                                )}
                            </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">Gender</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                {isEditing ? (
                                    <select name="gender" value={formData.gender} onChange={handleInputChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-1 border">
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                ) : (
                                    student.gender || 'N/A'
                                )}
                            </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">Language</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                {isEditing ? (
                                    <input type="text" name="language" value={formData.language} onChange={handleInputChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-1 border" />
                                ) : (
                                    student.language || 'N/A'
                                )}
                            </dd>
                        </div>
                    </dl>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Enrollment Card */}
                <div className="bg-white overflow-hidden shadow rounded-lg divide-y divide-gray-200">
                    <div className="px-4 py-5 sm:px-6 font-medium text-gray-900">
                        Enrollment
                    </div>
                    <div className="px-4 py-5 sm:p-6 space-y-4">
                        <div>
                            <p className="text-sm text-gray-500">Admission Number</p>
                            <p className="text-sm font-medium text-gray-900">{student.admission_number || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Admission Date</p>
                            <p className="text-sm font-medium text-gray-900">{student.admission_date || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Joining Date</p>
                            <p className="text-sm font-medium text-gray-900">{student.joining_date || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                {/* Classroom Card */}
                <div className="bg-white overflow-hidden shadow rounded-lg divide-y divide-gray-200">
                    <div className="px-4 py-5 sm:px-6 font-medium text-gray-900">
                        Current Classroom
                    </div>
                    <div className="px-4 py-5 sm:p-6 space-y-4">
                        {/* We will need to fetch classroom assignment, or assume it's part of student details later */}
                        <p className="text-sm text-gray-500 text-center py-4">No active classroom assignment</p>
                    </div>
                </div>

                {/* Medical Summary Card */}
                <div className="bg-white overflow-hidden shadow rounded-lg divide-y divide-gray-200">
                    <div className="px-4 py-5 sm:px-6 font-medium text-gray-900">
                        Medical Summary
                    </div>
                    <div className="px-4 py-5 sm:p-6 space-y-4">
                        <div>
                            <p className="text-sm text-gray-500">Allergies</p>
                            <p className="text-sm font-medium text-red-600">{student.allergies || 'None recorded'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Medical Conditions</p>
                            <p className="text-sm font-medium text-gray-900">{student.medical_conditions || 'None'}</p>
                        </div>
                        <div className="mt-2 text-center">
                            <a href={`/students/${student.id}/medical`} className="text-sm text-indigo-600 hover:text-indigo-900">View full medical profile &rarr;</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentOverview;
