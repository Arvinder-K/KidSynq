import { useParams, Outlet, Link, useLocation } from 'react-router-dom';
import Layout from '../../../components/Layout';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    BookOpen, Users, Calendar, 
    PieChart, FileText, 
    History, Activity
} from 'lucide-react';


const ClassroomDetailLayout = () => {
    const { id } = useParams();
    const location = useLocation();

    const { data: classroom, isLoading, isError, error } = useQuery({
        queryKey: ['classroom', id],
        queryFn: async () => {
            const token = localStorage.getItem('access_token');
            const response = await axios.get(`http://localhost:8000/api/daycare/classrooms/${id}/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        }
    });

    const tabs = [
        { name: 'Overview', path: `/daycare/classrooms/${id}`, icon: BookOpen },
        { name: 'Teachers', path: `/daycare/classrooms/${id}/teachers`, icon: Users },
        { name: 'Students', path: `/daycare/classrooms/${id}/students`, icon: Users },
        { name: 'Schedule', path: `/daycare/classrooms/${id}/schedule`, icon: Calendar },
        { name: 'Occupancy', path: `/daycare/classrooms/${id}/occupancy`, icon: PieChart },
        { name: 'Ratio', path: `/daycare/classrooms/${id}/ratio`, icon: Activity },
        { name: 'History', path: `/daycare/classrooms/${id}/history`, icon: History },
        { name: 'Reports', path: `/daycare/classrooms/${id}/reports`, icon: FileText },
    ];

    if (isLoading) return <Layout><div className="p-6">Loading classroom details...</div></Layout>;
    if (isError) return <Layout><div className="p-6 text-red-500">Error loading classroom: {(error as Error).message}</div></Layout>;
    if (!classroom) return <Layout><div className="p-6">Classroom not found.</div></Layout>;

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="bg-white rounded-t-xl border border-gray-200 p-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{classroom.room_name}</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {classroom.program_name} • {classroom.age_group_name} • Capacity: {classroom.capacity}
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white border-b border-x border-gray-200">
                    <nav className="flex overflow-x-auto" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = location.pathname === tab.path || (tab.name === 'Overview' && location.pathname === `/daycare/classrooms/${id}/`);
                            return (
                                <Link
                                    key={tab.name}
                                    to={tab.path}
                                    className={`
                                        group inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm whitespace-nowrap
                                        ${isActive
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                                    `}
                                >
                                    <Icon
                                        className={`
                                            -ml-0.5 mr-2 h-5 w-5
                                            ${isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'}
                                        `}
                                    />
                                    {tab.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Content Area */}
                <div className="mt-6">
                    <Outlet context={{ classroom }} />
                </div>
            </div>
        </Layout>
    );
};

export default ClassroomDetailLayout;
