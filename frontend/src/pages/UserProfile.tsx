import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

const UserProfile: React.FC = () => {
    const { } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Profile Update State
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ first_name: '', last_name: '', phone: '' });
    const [updateLoading, setUpdateLoading] = useState(false);
    
    // Password Update State
    const [passwordData, setPasswordData] = useState({ old_password: '', new_password: '', confirm_password: '' });
    const [passLoading, setPassLoading] = useState(false);
    const [passError, setPassError] = useState('');
    const [passSuccess, setPassSuccess] = useState('');

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const res = await api.get('/profile/');
            setProfile(res.data);
            setFormData({
                first_name: res.data.first_name || '',
                last_name: res.data.last_name || '',
                phone: res.data.phone || ''
            });
        } catch (error) {
            console.error("Failed to fetch profile", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setUpdateLoading(true);
        try {
            const res = await api.put('/profile/', formData);
            setProfile(res.data);
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update profile", error);
        } finally {
            setUpdateLoading(false);
        }
    };

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setPassError('');
        setPassSuccess('');
        
        if (passwordData.new_password !== passwordData.confirm_password) {
            setPassError("New passwords do not match.");
            return;
        }
        
        setPassLoading(true);
        try {
            await api.put('/profile/password/', {
                old_password: passwordData.old_password,
                new_password: passwordData.new_password
            });
            setPassSuccess("Password updated successfully.");
            setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
        } catch (error: any) {
            setPassError(error.response?.data?.detail || "Failed to update password.");
        } finally {
            setPassLoading(false);
        }
    };

    if (loading) {
        return <Layout><div className="text-center py-12 text-gray-500">Loading profile...</div></Layout>;
    }

    return (
        <Layout>
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">Account Settings</h1>
                <p className="mt-1 text-sm text-gray-500">Manage your profile and security settings.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Information */}
                <div className="lg:col-span-2">
                    <div className="bg-white shadow sm:rounded-lg mb-8">
                        <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Personal Information</h3>
                            {!isEditing && (
                                <button onClick={() => setIsEditing(true)} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                                    Edit Profile
                                </button>
                            )}
                        </div>
                        <div className="px-4 py-5 sm:p-6">
                            {isEditing ? (
                                <form onSubmit={handleProfileUpdate} className="space-y-4">
                                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">First Name</label>
                                            <input type="text" value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Last Name</label>
                                            <input type="text" value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Phone</label>
                                            <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Email (Cannot be changed)</label>
                                            <input type="email" disabled value={profile?.email} className="mt-1 block w-full border border-gray-300 bg-gray-100 rounded-md py-2 px-3 text-gray-500 sm:text-sm" />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3 mt-4">
                                        <button type="button" onClick={() => setIsEditing(false)} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                                        <button type="submit" disabled={updateLoading} className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400">
                                            {updateLoading ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                                    <div className="sm:col-span-1">
                                        <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{profile?.first_name} {profile?.last_name}</dd>
                                    </div>
                                    <div className="sm:col-span-1">
                                        <dt className="text-sm font-medium text-gray-500">Role</dt>
                                        <dd className="mt-1 text-sm text-gray-900 capitalize">{profile?.role}</dd>
                                    </div>
                                    <div className="sm:col-span-1">
                                        <dt className="text-sm font-medium text-gray-500">Email Address</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{profile?.email}</dd>
                                    </div>
                                    <div className="sm:col-span-1">
                                        <dt className="text-sm font-medium text-gray-500">Phone</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{profile?.phone || 'Not provided'}</dd>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <dt className="text-sm font-medium text-gray-500">Daycare Organization</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{profile?.daycare_name || 'N/A'}</dd>
                                    </div>
                                </dl>
                            )}
                        </div>
                    </div>

                    {/* Change Password */}
                    <div className="bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 border-b border-gray-200 sm:px-6 bg-gray-50">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Change Password</h3>
                        </div>
                        <div className="px-4 py-5 sm:p-6">
                            {passError && <div className="mb-4 bg-red-50 text-red-700 p-3 rounded text-sm">{passError}</div>}
                            {passSuccess && <div className="mb-4 bg-green-50 text-green-700 p-3 rounded text-sm">{passSuccess}</div>}
                            
                            <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Current Password</label>
                                    <input type="password" required value={passwordData.old_password} onChange={(e) => setPasswordData({...passwordData, old_password: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">New Password</label>
                                    <input type="password" required minLength={8} value={passwordData.new_password} onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                                    <input type="password" required minLength={8} value={passwordData.confirm_password} onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div>
                                    <button type="submit" disabled={passLoading} className="w-full bg-gray-800 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-gray-900 disabled:bg-gray-500">
                                        {passLoading ? 'Updating...' : 'Update Password'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Info Sidebar */}
                <div className="lg:col-span-1">
                    <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-100">
                        <div className="flex items-center justify-center h-20 w-20 rounded-full bg-indigo-200 text-indigo-700 mx-auto mb-4 text-2xl font-bold">
                            {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                        </div>
                        <h3 className="text-center text-lg font-medium text-gray-900">{profile?.first_name} {profile?.last_name}</h3>
                        <p className="text-center text-sm text-indigo-600 font-medium capitalize mt-1">{profile?.role}</p>
                        
                        <div className="mt-6 border-t border-indigo-200 pt-6">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Need Help?</h4>
                            <p className="text-xs text-gray-600 mb-4">If you need to change your email address or daycare organization, please contact KidSynq Support.</p>
                            <a href="#" className="text-sm text-indigo-600 font-medium hover:text-indigo-500">Contact Support &rarr;</a>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default UserProfile;
