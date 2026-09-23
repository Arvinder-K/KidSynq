import React, { useState, useEffect } from 'react';
import api from '../../../api';
import Layout from '../../../components/Layout';

interface DaycareSettings {
    timezone: string;
    date_format: string;
    time_format: string;
    currency: string;
    default_language: string;
    week_start_day: string;
    default_operating_start: string | null;
    default_operating_end: string | null;
    allow_parent_notifications: boolean;
    allow_staff_notifications: boolean;
}

const defaultSettings: DaycareSettings = {
    timezone: 'UTC',
    date_format: 'YYYY-MM-DD',
    time_format: '24h',
    currency: 'USD',
    default_language: 'en',
    week_start_day: 'Monday',
    default_operating_start: '',
    default_operating_end: '',
    allow_parent_notifications: true,
    allow_staff_notifications: true,
};

export default function DaycareSettings() {
    const [settings, setSettings] = useState<DaycareSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/daycare/settings/');
            setSettings({
                ...defaultSettings,
                ...response.data,
                default_operating_start: response.data.default_operating_start || '',
                default_operating_end: response.data.default_operating_end || '',
            });
        } catch (error) {
            console.error('Error fetching settings:', error);
            setMessage({ type: 'error', text: 'Failed to load settings.' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            const payload = { ...settings };
            if (!payload.default_operating_start) payload.default_operating_start = null;
            if (!payload.default_operating_end) payload.default_operating_end = null;
            
            await api.patch('/daycare/settings/', payload);
            setMessage({ type: 'success', text: 'Settings saved successfully.' });
        } catch (error: any) {
            console.error('Error saving settings:', error);
            const errorMsg = error.response?.data ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)) : 'Failed to save settings.';
            setMessage({ type: 'error', text: `Failed to save: ${errorMsg}` });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="p-6 text-slate-500">Loading settings...</div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="p-6 max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold text-slate-800 mb-6">Daycare Settings</h1>

            {message && (
                <div className={`p-4 rounded-md mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* General Settings */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                        <h2 className="text-lg font-semibold text-slate-800">General</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
                            <select name="timezone" value={settings.timezone} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                <option value="UTC">UTC</option>
                                <option value="America/New_York">Eastern Time (US & Canada)</option>
                                <option value="America/Chicago">Central Time (US & Canada)</option>
                                <option value="America/Denver">Mountain Time (US & Canada)</option>
                                <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                            <select name="currency" value={settings.currency} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="CAD">CAD ($)</option>
                                <option value="AUD">AUD ($)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Date Format</label>
                            <select name="date_format" value={settings.date_format} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Time Format</label>
                            <select name="time_format" value={settings.time_format} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                <option value="12h">12-hour (AM/PM)</option>
                                <option value="24h">24-hour</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                            <select name="default_language" value={settings.default_language} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Operations Settings */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                        <h2 className="text-lg font-semibold text-slate-800">Operations</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Week Start Day</label>
                            <select name="week_start_day" value={settings.week_start_day} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                <option value="Monday">Monday</option>
                                <option value="Sunday">Sunday</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Default Start Time</label>
                                <input type="time" name="default_operating_start" value={settings.default_operating_start || ''} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Default End Time</label>
                                <input type="time" name="default_operating_end" value={settings.default_operating_end || ''} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Features Settings */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                        <h2 className="text-lg font-semibold text-slate-800">Features & Notifications</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex items-start">
                            <div className="flex items-center h-5">
                                <input id="allow_parent_notifications" name="allow_parent_notifications" type="checkbox" checked={settings.allow_parent_notifications} onChange={handleChange} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                            </div>
                            <div className="ml-3 text-sm">
                                <label htmlFor="allow_parent_notifications" className="font-medium text-slate-700">Allow Parent Notifications</label>
                                <p className="text-slate-500">Enable automated emails and notifications to parents for activities, attendance, and billing.</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <div className="flex items-center h-5">
                                <input id="allow_staff_notifications" name="allow_staff_notifications" type="checkbox" checked={settings.allow_staff_notifications} onChange={handleChange} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                            </div>
                            <div className="ml-3 text-sm">
                                <label htmlFor="allow_staff_notifications" className="font-medium text-slate-700">Allow Staff Notifications</label>
                                <p className="text-slate-500">Enable automated emails and notifications to staff for schedules and assignments.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>

            </form>
            </div>
        </Layout>
    );
}
