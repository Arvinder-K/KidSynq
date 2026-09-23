import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';

interface Branch {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    capacity: number | null;
    status: string;
    created_at: string;
}

interface LimitCheck {
    current_count: number;
    max_branches: number;
    is_allowed: boolean;
    is_enabled: boolean;
}

const Branches: React.FC = () => {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editBranch, setEditBranch] = useState<Branch | null>(null);
    const [limit, setLimit] = useState<LimitCheck | null>(null);
    
    // Form fields
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [capacity, setCapacity] = useState('');
    const [status, setStatus] = useState('Active');
    
    // Error handling
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const [branchesRes, limitRes] = await Promise.all([
                api.get('/daycare/branches/'),
                api.get('/daycare/branches/check-limit/')
            ]);
            setBranches(branchesRes.data);
            setLimit(limitRes.data);
        } catch (error) {
            console.error("Failed to fetch branch data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenModal = (branch: Branch | null = null) => {
        setError(null);
        if (branch) {
            setEditBranch(branch);
            setName(branch.name);
            setAddress(branch.address || '');
            setPhone(branch.phone || '');
            setCapacity(branch.capacity ? branch.capacity.toString() : '');
            setStatus(branch.status);
        } else {
            setEditBranch(null);
            setName('');
            setAddress('');
            setPhone('');
            setCapacity('');
            setStatus('Active');
        }
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        const payload = { 
            name,
            address: address || null,
            phone: phone || null,
            capacity: capacity ? parseInt(capacity) : null,
            status
        };

        try {
            if (editBranch) {
                await api.patch(`/daycare/branches/${editBranch.id}/`, payload);
            } else {
                await api.post('/daycare/branches/', payload);
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            console.error("Failed to save branch", err);
            setError(err.response?.data?.detail || "An error occurred while saving.");
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this branch?")) {
            try {
                await api.delete(`/daycare/branches/${id}/`);
                fetchData();
            } catch (error) {
                console.error("Failed to delete branch", error);
                alert("Failed to delete branch.");
            }
        }
    };

    const handleToggleStatus = async (branch: Branch) => {
        const newStatus = branch.status === 'Active' ? 'Suspended' : 'Active';
        if (window.confirm(`Are you sure you want to change the status to ${newStatus}?`)) {
            try {
                await api.patch(`/daycare/branches/${branch.id}/`, { status: newStatus });
                fetchData();
            } catch (error) {
                console.error("Failed to update status", error);
                alert("Failed to update status.");
            }
        }
    };

    return (
        <Layout>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Branches</h1>
                    <p className="mt-1 text-sm text-gray-500">Manage multiple daycare locations.</p>
                </div>
                {limit && limit.is_allowed && (
                    <button 
                        onClick={() => handleOpenModal()}
                        className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-xs"
                    >
                        Add Branch
                    </button>
                )}
            </div>

            {/* Subscription Restriction Banner */}
            {limit && !limit.is_allowed && (
                <div className="mb-6 rounded-md bg-yellow-50 p-4 border border-yellow-200">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">
                                {!limit.is_enabled 
                                    ? "Branch Management is Disabled" 
                                    : "Branch Limit Reached"}
                            </h3>
                            <div className="mt-2 text-sm text-yellow-700">
                                <p>
                                    {!limit.is_enabled 
                                        ? "Your current subscription plan does not support multiple locations. Please upgrade your plan to manage branches."
                                        : `You have reached the maximum number of branches (${limit.max_branches}) allowed by your current subscription plan. Please upgrade to add more.`}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading branches...</div>
                ) : branches.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No branches found.</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name & Contact</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {branches.map(branch => (
                                <tr key={branch.id} className={branch.status === 'Suspended' ? 'opacity-75 bg-gray-50' : ''}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{branch.name}</div>
                                        <div className="text-sm text-gray-500">{branch.phone || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {branch.address || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {branch.capacity || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            branch.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {branch.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleOpenModal(branch)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                                        <button onClick={() => handleToggleStatus(branch)} className="text-gray-600 hover:text-gray-900 mr-4">
                                            {branch.status === 'Active' ? 'Suspend' : 'Activate'}
                                        </button>
                                        <button onClick={() => handleDelete(branch.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">{editBranch ? 'Edit Branch' : 'Add Branch'}</h3>
                        
                        {error && (
                            <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSave}>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                    <textarea
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        rows={2}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                                        <input
                                            type="number"
                                            value={capacity}
                                            onChange={(e) => setCapacity(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            min="1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                        <select
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        >
                                            <option value="Active">Active</option>
                                            <option value="Suspended">Suspended</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end space-x-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-md">Cancel</button>
                                <button type="submit" className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-md">Save Branch</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Branches;
