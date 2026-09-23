import React, { useEffect, useState } from 'react';
import api from '../api';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

interface AnalyticsData {
    revenue: {
        total: number;
        monthly: number;
        outstanding: number;
        chart: {
            labels: string[];
            data: number[];
        };
    };
    subscriptions: {
        total: number;
        active: number;
        trial: number;
        cancelled: number;
        chart: {
            labels: string[];
            data: number[];
        };
    };
    usage: {
        total_daycares: number;
        total_students: number;
        total_staff: number;
        total_classrooms: number;
        total_storage_mb: number;
        daycares: {
            id: string;
            name: string;
            plan: string;
            students: number;
            max_students: number;
            staff: number;
            max_staff: number;
            classrooms: number;
            max_classrooms: number;
            storage_mb: number;
            max_storage_mb: number;
            usage_pct: number;
        }[];
    };
}

const SaaSAnalyticsTab: React.FC = () => {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const res = await api.get('/super-admin/analytics/');
            setData(res.data);
        } catch (error) {
            console.error("Failed to fetch analytics", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !data) {
        return (
            <div className="flex justify-center items-center h-64">
                <p className="text-gray-500">Loading analytics...</p>
            </div>
        );
    }

    const revenueChartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' as const },
            title: { display: true, text: 'Revenue by Plan' },
        },
    };

    const revenueChartData = {
        labels: data.revenue.chart.labels,
        datasets: [
            {
                label: 'Revenue ($)',
                data: data.revenue.chart.data,
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
            },
        ],
    };

    const subChartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'right' as const },
            title: { display: true, text: 'Subscription Status' },
        },
    };

    const subChartData = {
        labels: data.subscriptions.chart.labels,
        datasets: [
            {
                data: data.subscriptions.chart.data,
                backgroundColor: [
                    'rgba(34, 197, 94, 0.6)', // Active
                    'rgba(59, 130, 246, 0.6)', // Trial
                    'rgba(239, 68, 68, 0.6)', // Cancelled
                    'rgba(156, 163, 175, 0.6)', // Expired
                    'rgba(234, 179, 8, 0.6)', // Suspended
                ],
            },
        ],
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">SaaS Analytics</h1>
                <p className="mt-1 text-sm text-gray-500">System-wide revenue, subscriptions, and usage metrics.</p>
            </div>
            {/* The rest of the content remains the same */}
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                {/* Revenue */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                        <dd className="mt-1 text-3xl font-semibold text-indigo-600">${data.revenue.total.toFixed(2)}</dd>
                        <p className="mt-2 text-xs text-gray-400">MRR: ${data.revenue.monthly.toFixed(2)}</p>
                    </div>
                </div>
                {/* Subscriptions */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <dt className="text-sm font-medium text-gray-500 truncate">Active Subscriptions</dt>
                        <dd className="mt-1 text-3xl font-semibold text-green-600">{data.subscriptions.active}</dd>
                        <p className="mt-2 text-xs text-gray-400">Trials: {data.subscriptions.trial}</p>
                    </div>
                </div>
                {/* Daycares */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Daycares</dt>
                        <dd className="mt-1 text-3xl font-semibold text-blue-600">{data.usage.total_daycares}</dd>
                    </div>
                </div>
                {/* Users */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Students</dt>
                        <dd className="mt-1 text-3xl font-semibold text-purple-600">{data.usage.total_students}</dd>
                        <p className="mt-2 text-xs text-gray-400">Staff: {data.usage.total_staff}</p>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-white shadow rounded-lg p-6">
                    <Bar options={revenueChartOptions} data={revenueChartData} />
                </div>
                <div className="bg-white shadow rounded-lg p-6 flex justify-center items-center">
                    <div className="w-2/3">
                        <Doughnut options={subChartOptions} data={subChartData} />
                    </div>
                </div>
            </div>

            {/* Usage Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Daycare Resource Usage</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Daycare</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Classrooms</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Storage (MB)</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Max Usage %</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {data.usage.daycares.map((daycare) => (
                                <tr key={daycare.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{daycare.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                            {daycare.plan}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                                        {daycare.students} / {daycare.max_students || '∞'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                                        {daycare.staff} / {daycare.max_staff || '∞'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                                        {daycare.classrooms} / {daycare.max_classrooms || '∞'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                                        {daycare.storage_mb} / {daycare.max_storage_mb || '∞'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                        <span className={`px-2 py-1 text-xs font-bold rounded ${daycare.usage_pct >= 90 ? 'bg-red-100 text-red-800' : daycare.usage_pct >= 75 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                            {daycare.usage_pct}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SaaSAnalyticsTab;
