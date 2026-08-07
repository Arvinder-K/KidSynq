import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';
import { motion } from 'framer-motion';
import { Users, Activity, Utensils, AlertTriangle } from 'lucide-react';

interface DashboardStats {
    students_present: number;
    activities_logged: number;
    meals_recorded: number;
    incidents_reported: number;
}

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/dashboard/stats/');
                setStats(response.data);
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    return (
        <Layout>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">Overview</h1>
                <p className="text-slate-500 mt-1">Here is what's happening at your daycare today.</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
            ) : stats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Students Present', value: stats.students_present, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-100' },
                        { label: 'Activities Logged', value: stats.activities_logged, icon: Activity, color: 'text-green-600', bg: 'bg-green-100' },
                        { label: 'Meals Recorded', value: stats.meals_recorded, icon: Utensils, color: 'text-yellow-600', bg: 'bg-yellow-100' },
                        { label: 'Incidents Reported', value: stats.incidents_reported, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' }
                    ].map((stat, i) => (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            key={i} 
                            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4 hover:shadow-md transition-shadow"
                        >
                            <div className={`w-14 h-14 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                                <stat.icon className={`w-7 h-7 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center">
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    Failed to load statistics. Please try refreshing the page.
                </div>
            )}
        </Layout>
    );
};

export default Dashboard;
