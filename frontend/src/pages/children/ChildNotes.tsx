import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api';
import type { Child } from './ChildProfileLayout';

interface ContextType {
    child: Child;
    setChild: React.Dispatch<React.SetStateAction<Child | null>>;
    fetchChild: () => Promise<void>;
}

const ChildNotes: React.FC = () => {
    const { child, setChild } = useOutletContext<ContextType>();
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    
    const [formData, setFormData] = useState({
        child_notes: child.child_notes || '',
        administrative_notes: child.administrative_notes || '',
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const payload: any = { ...formData };
            const response = await api.patch(`/daycare/children/${child.id}/`, payload);
            setChild(response.data);
            setIsEditing(false);
        } catch (err: any) {
            const errorMsg = err.response?.data 
                ? JSON.stringify(err.response.data) 
                : err.message;
            setError(`Failed to update notes. ${errorMsg}`);
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white shadow-sm border border-gray-100 overflow-hidden sm:rounded-xl">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center bg-gray-50 border-b border-gray-100">
                    <h3 className="text-lg leading-6 font-semibold text-gray-900">Notes</h3>
                    <div className="flex space-x-2">
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors focus:outline-none"
                            >
                                Edit Notes
                            </button>
                        ) : (
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setFormData({
                                            child_notes: child.child_notes || '',
                                            administrative_notes: child.administrative_notes || '',
                                        });
                                    }}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors focus:outline-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors focus:outline-none disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="p-6 space-y-6">
                    {error && <div className="p-4 bg-red-50 text-red-700 text-sm border border-red-100 rounded-lg">{error}</div>}
                    
                    <div>
                        <h4 className="text-md font-medium text-gray-900 mb-2">Child Notes</h4>
                        <p className="text-sm text-gray-500 mb-3">General notes about the child, behavioral observations, or special instructions.</p>
                        {isEditing ? (
                            <textarea
                                name="child_notes"
                                rows={4}
                                value={formData.child_notes}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-3 border outline-none"
                                placeholder="Enter child notes here..."
                            />
                        ) : (
                            <div className="bg-gray-50 p-4 rounded-lg text-gray-700 whitespace-pre-wrap text-sm border border-gray-100 min-h-[100px]">
                                {child.child_notes || <span className="text-gray-400 italic">No child notes added yet.</span>}
                            </div>
                        )}
                    </div>

                    <div>
                        <h4 className="text-md font-medium text-gray-900 mb-2">Administrative Notes</h4>
                        <p className="text-sm text-gray-500 mb-3">Internal notes for daycare staff regarding this child's enrollment or family.</p>
                        {isEditing ? (
                            <textarea
                                name="administrative_notes"
                                rows={4}
                                value={formData.administrative_notes}
                                onChange={handleInputChange}
                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-3 border outline-none"
                                placeholder="Enter administrative notes here..."
                            />
                        ) : (
                            <div className="bg-gray-50 p-4 rounded-lg text-gray-700 whitespace-pre-wrap text-sm border border-gray-100 min-h-[100px]">
                                {child.administrative_notes || <span className="text-gray-400 italic">No administrative notes added yet.</span>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChildNotes;
