import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api';

const StudentNotes: React.FC = () => {
    const { student, setStudent } = useOutletContext<any>();
    const [childNotes, setChildNotes] = useState(student.child_notes || '');
    const [adminNotes, setAdminNotes] = useState(student.administrative_notes || '');
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const response = await api.patch(`/students/${student.id}/`, {
                child_notes: childNotes,
                administrative_notes: adminNotes
            });
            setStudent(response.data);
            setIsEditing(false);
        } catch (err) {
            setError('Failed to save notes.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Notes</h3>
                    {!isEditing ? (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                        >
                            Edit Notes
                        </button>
                    ) : (
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                            >
                                {saving ? 'Saving...' : 'Save Notes'}
                            </button>
                        </div>
                    )}
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6 space-y-6">
                    {error && <div className="text-red-500 text-sm">{error}</div>}
                    
                    <div>
                        <h4 className="text-md font-medium text-gray-900 mb-2">Child Notes</h4>
                        {isEditing ? (
                            <textarea
                                rows={4}
                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                value={childNotes}
                                onChange={(e) => setChildNotes(e.target.value)}
                                placeholder="General notes about the child's behavior, preferences, etc."
                            />
                        ) : (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{student.child_notes || 'No child notes added.'}</p>
                        )}
                    </div>
                    
                    <div className="border-t border-gray-200 pt-6">
                        <h4 className="text-md font-medium text-gray-900 mb-2">Administrative Notes</h4>
                        {isEditing ? (
                            <textarea
                                rows={4}
                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                placeholder="Internal administrative notes (not visible to parents if we ever add parent portal)."
                            />
                        ) : (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{student.administrative_notes || 'No administrative notes added.'}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentNotes;
