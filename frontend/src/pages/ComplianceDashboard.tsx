import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';

interface Incident {
    id: string;
    student_name: string;
    incident_date: string;
    description: string;
    status: string;
}

interface Inspection {
    id: string;
    visit_date: string;
    agency: string;
    overall_result: string;
    inspector_name: string;
}

const ComplianceDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'incidents' | 'inspections'>('incidents');
    
    // Data State
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [inspections, setInspections] = useState<Inspection[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showIncidentModal, setShowIncidentModal] = useState(false);
    const [showInspectionModal, setShowInspectionModal] = useState(false);
    const [formError, setFormError] = useState('');

    // Fetch Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const [incidentsRes, inspectionsRes] = await Promise.all([
                api.get('/compliance/incidents/'),
                api.get('/compliance/inspections/')
            ]);
            setIncidents(incidentsRes.data);
            setInspections(inspectionsRes.data);
        } catch (error) {
            console.error("Failed to fetch compliance data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Form Submissions
    const handleAddIncident = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormError('');
        const formData = new FormData(e.currentTarget);
        try {
            await api.post('/compliance/incidents/', {
                student_id: formData.get('student_id'),
                incident_date: formData.get('incident_date'),
                description: formData.get('description'),
                location: formData.get('location'),
                action_taken: formData.get('action_taken')
            });
            setShowIncidentModal(false);
            fetchData();
        } catch (err) {
            setFormError('Failed to log incident.');
        }
    };

    const handleAddInspection = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormError('');
        const formData = new FormData(e.currentTarget);
        try {
            await api.post('/compliance/inspections/', {
                agency: formData.get('agency'),
                visit_date: formData.get('visit_date'),
                inspector_name: formData.get('inspector_name'),
                overall_result: formData.get('overall_result'),
                notes: formData.get('notes')
            });
            setShowInspectionModal(false);
            fetchData();
        } catch (err) {
            setFormError('Failed to log inspection.');
        }
    };

    return (
        <Layout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Compliance & Incidents</h1>
                    <p className="mt-1 text-sm text-gray-500">Track regulatory visits and student incidents.</p>
                </div>
                <div>
                    {activeTab === 'incidents' ? (
                        <button onClick={() => setShowIncidentModal(true)} className="bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-md text-sm font-medium shadow-sm">
                            Report Incident
                        </button>
                    ) : (
                        <button onClick={() => setShowInspectionModal(true)} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium shadow-sm">
                            Log Inspection
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('incidents')}
                        className={`${
                            activeTab === 'incidents'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Incident Reports
                    </button>
                    <button
                        onClick={() => setActiveTab('inspections')}
                        className={`${
                            activeTab === 'inspections'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Regulatory Inspections
                    </button>
                </nav>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading records...</div>
                ) : activeTab === 'incidents' ? (
                    /* Incidents Table */
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {incidents.map((incident) => (
                                <tr key={incident.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{incident.incident_date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{incident.student_name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{incident.description}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${incident.status === 'Open' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                            {incident.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {incidents.length === 0 && (
                                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No incidents reported.</td></tr>
                            )}
                        </tbody>
                    </table>
                ) : (
                    /* Inspections Table */
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agency</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inspector</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {inspections.map((inspection) => (
                                <tr key={inspection.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{inspection.visit_date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{inspection.agency}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{inspection.inspector_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${inspection.overall_result === 'Compliant' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {inspection.overall_result}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {inspections.length === 0 && (
                                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No inspections logged.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Incident Modal */}
            {showIncidentModal && (
                <div className="fixed z-10 inset-0 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowIncidentModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleAddIncident}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Report an Incident</h3>
                                    {formError && <div className="bg-red-50 p-2 mb-4 text-sm text-red-700">{formError}</div>}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Student ID (Internal)</label>
                                            <input type="text" name="student_id" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Date</label>
                                            <input type="date" name="incident_date" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Location</label>
                                            <input type="text" name="location" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Description</label>
                                            <textarea name="description" rows={3} required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Action Taken</label>
                                            <textarea name="action_taken" rows={2} required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:ml-3 sm:w-auto sm:text-sm">Submit Report</button>
                                    <button type="button" onClick={() => setShowIncidentModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Inspection Modal */}
            {showInspectionModal && (
                <div className="fixed z-10 inset-0 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowInspectionModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleAddInspection}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Log Regulatory Inspection</h3>
                                    {formError && <div className="bg-red-50 p-2 mb-4 text-sm text-red-700">{formError}</div>}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Agency Name</label>
                                            <input type="text" name="agency" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Inspector Name</label>
                                            <input type="text" name="inspector_name" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Date of Visit</label>
                                            <input type="date" name="visit_date" required className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Overall Result</label>
                                            <select name="overall_result" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                                <option>Compliant</option>
                                                <option>Non-Compliant</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Notes/Findings</label>
                                            <textarea name="notes" rows={3} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm">Log Inspection</button>
                                    <button type="button" onClick={() => setShowInspectionModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default ComplianceDashboard;
