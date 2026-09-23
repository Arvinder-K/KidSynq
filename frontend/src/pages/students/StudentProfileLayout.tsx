import React, { useEffect, useState } from 'react';
import { useParams, Outlet, Link, useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import api, { BACKEND_URL } from '../../api';

interface Student {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string;
    status: string;
    admission_number: string;
    dob: string;
    photo: string;
}

const StudentProfileLayout: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);

    // Helper function to format image URL
    const getImageUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    useEffect(() => {
        const fetchStudent = async () => {
            try {
                const response = await api.get(`/students/${id}/`);
                setStudent(response.data);
            } catch (error) {
                console.error("Failed to fetch student details", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStudent();
    }, [id]);

    if (loading) {
        return (
            <Layout>
                <div className="py-12 text-center text-gray-500">Loading profile...</div>
            </Layout>
        );
    }

    if (!student) {
        return (
            <Layout>
                <div className="py-12 text-center text-red-500">Student not found.</div>
            </Layout>
        );
    }

    const calculateAge = (dobString: string) => {
        if (!dobString) return 'Unknown age';
        const dob = new Date(dobString);
        const diffMs = Date.now() - dob.getTime();
        const ageDt = new Date(diffMs);
        return Math.abs(ageDt.getUTCFullYear() - 1970) + ' years old';
    };

    const tabs = [
        { name: 'Overview', href: `/students/${id}` },
        { name: 'Medical Info', href: `/students/${id}/medical` },
        { name: 'Contacts', href: `/students/${id}/contacts` },
        { name: 'Documents', href: `/students/${id}/documents` },
        { name: 'Enrollment', href: `/students/${id}/enrollment` },
        { name: 'Notes', href: `/students/${id}/notes` },
    ];

    return (
        <Layout>
            <div className="mb-6">
                <div className="flex items-center space-x-4">
                    {student.photo ? (
                        <img src={getImageUrl(student.photo)} alt={`${student.first_name}`} className="h-20 w-20 rounded-full object-cover" />
                    ) : (
                        <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-3xl">
                            {student.first_name[0]}{student.last_name[0]}
                        </div>
                    )}
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {student.first_name} {student.last_name}
                            {student.preferred_name && <span className="text-gray-500 text-xl font-normal ml-2">({student.preferred_name})</span>}
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">
                            Admission No: {student.admission_number || 'N/A'} &bull; Status: {student.status} &bull; Age: {calculateAge(student.dob)}
                        </p>
                    </div>
                </div>
            </div>

            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {tabs.map((tab) => {
                        const isActive = location.pathname === tab.href;
                        return (
                            <Link
                                key={tab.name}
                                to={tab.href}
                                className={`
                                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                                    ${isActive
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                                `}
                            >
                                {tab.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <Outlet context={{ student, setStudent }} />
        </Layout>
    );
};

export default StudentProfileLayout;
