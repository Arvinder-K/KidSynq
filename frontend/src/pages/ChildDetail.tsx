import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { ArrowLeft } from 'lucide-react';

const ChildDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    return (
        <Layout>
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                <button 
                    onClick={() => navigate('/daycare/children')}
                    className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Back to Children</span>
                </button>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <h2 className="text-2xl font-bold text-gray-900">Child Profile</h2>
                    <p className="text-gray-500 mt-2">ID: {id}</p>
                    <div className="mt-8 p-6 bg-indigo-50 text-indigo-800 rounded-lg max-w-lg mx-auto">
                        <p className="font-medium">Phase 19 Foundation</p>
                        <p className="text-sm mt-2 text-indigo-600">The detailed profile view is scheduled for a subsequent phase. Currently, this page serves as a placeholder for route validation.</p>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default ChildDetail;
