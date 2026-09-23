import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api, { BACKEND_URL } from '../../api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Baby, Calendar, School, MapPin, BadgeCheck, Award
} from 'lucide-react';
import FamilyChildContacts from '../../components/FamilyChildContacts';

interface FamilyChild {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    dob: string;
    age: string;
    photo: string | null;
    current_classroom: string | null;
    enrollment_status: string;
    daycare_name: string;
    branch_name: string;
}

const FamilyChildren: React.FC = () => {
    const [childrenList, setChildrenList] = useState<FamilyChild[]>([]);
    const [selectedChild, setSelectedChild] = useState<FamilyChild | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchChildren = async () => {
        try {
            const response = await api.get('/family/children/');
            setChildrenList(response.data);
            if (response.data.length > 0) {
                setSelectedChild(response.data[0]);
            }
        } catch (error) {
            console.error("Failed to fetch family children:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChildren();
    }, []);

    const getImageUrl = (url: string | null) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    if (loading) {
        return (
            <Layout>
                <div className="py-12 flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
                
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <Baby className="w-8 h-8 text-teal-600 animate-pulse" />
                        <span>My Children</span>
                    </h1>
                    <p className="text-gray-500 text-sm">
                        View daycare records, classrooms, and statuses for your children.
                    </p>
                </div>

                {childrenList.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-150 p-12 text-center max-w-lg mx-auto shadow-sm">
                        <Baby className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-950">No Associated Children</h3>
                        <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
                            No children are currently linked to your family profile. Please contact the daycare administrator if this is an error.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* 1. Multiple Children Selector Tabs */}
                        {childrenList.length > 1 && (
                            <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-wrap gap-2">
                                {childrenList.map((child) => {
                                    const isSelected = selectedChild?.id === child.id;
                                    return (
                                        <button
                                            key={child.id}
                                            onClick={() => setSelectedChild(child)}
                                            className={`flex items-center gap-3 px-5 py-3 rounded-xl font-medium text-sm transition-all ${
                                                isSelected 
                                                    ? 'bg-teal-50 text-teal-800 border border-teal-200 shadow-sm'
                                                    : 'bg-slate-50 text-gray-600 border border-transparent hover:bg-slate-100'
                                            }`}
                                        >
                                            {child.photo ? (
                                                <img 
                                                    src={getImageUrl(child.photo)} 
                                                    alt={child.first_name} 
                                                    className="w-7 h-7 rounded-full object-cover shadow-inner"
                                                />
                                            ) : (
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                                    isSelected ? 'bg-teal-200 text-teal-800' : 'bg-slate-200 text-slate-700'
                                                }`}>
                                                    {child.first_name[0]}{child.last_name[0]}
                                                </div>
                                            )}
                                            <span>{child.first_name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* 2. Detailed Child Profile Dashboard */}
                        <AnimatePresence mode="wait">
                            {selectedChild && (
                                <motion.div
                                    key={selectedChild.id}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -15 }}
                                    transition={{ duration: 0.3 }}
                                    className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
                                >
                                    {/* Cover / Profile Header bar */}
                                    <div className="h-32 bg-gradient-to-r from-teal-500 via-emerald-600 to-indigo-700" />
                                    
                                    <div className="px-8 pb-8 relative">
                                        
                                        {/* Profile Photo absolute positioning overlay */}
                                        <div className="absolute -top-16 left-8">
                                            {selectedChild.photo ? (
                                                <img 
                                                    src={getImageUrl(selectedChild.photo)} 
                                                    alt={selectedChild.first_name} 
                                                    className="h-28 w-28 rounded-3xl object-cover border-4 border-white shadow-lg"
                                                />
                                            ) : (
                                                <div className="h-28 w-28 rounded-3xl bg-indigo-50 border-4 border-white shadow-lg flex items-center justify-center text-indigo-600 font-bold text-4xl">
                                                    {selectedChild.first_name[0]}{selectedChild.last_name[0]}
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-16 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div>
                                                <h2 className="text-3xl font-extrabold text-gray-950 flex items-center gap-3">
                                                    {selectedChild.first_name} {selectedChild.last_name}
                                                    {selectedChild.preferred_name && (
                                                        <span className="text-gray-400 font-normal text-lg">({selectedChild.preferred_name})</span>
                                                    )}
                                                </h2>
                                                <p className="text-teal-600 font-medium text-sm mt-1">{selectedChild.age}</p>
                                            </div>

                                            {/* Status Badge */}
                                            <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                selectedChild.enrollment_status === 'Active' 
                                                    ? 'bg-green-50 border border-green-200 text-green-700'
                                                    : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                                            }`}>
                                                Status: {selectedChild.enrollment_status}
                                            </div>
                                        </div>

                                        <div className="mt-8 border-t border-gray-100 pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                            
                                            {/* Left Card: Enrollment & Location details */}
                                            <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
                                                <h3 className="font-bold text-gray-900 text-base mb-2">School & Enrollment</h3>
                                                
                                                <div className="flex items-center gap-3 text-sm">
                                                    <School className="w-5 h-5 text-gray-400" />
                                                    <div>
                                                        <p className="text-gray-500 text-xs font-medium">Daycare Provider</p>
                                                        <p className="text-gray-900 font-semibold">{selectedChild.daycare_name}</p>
                                                    </div>
                                                </div>

                                                {selectedChild.branch_name && (
                                                    <div className="flex items-center gap-3 text-sm">
                                                        <MapPin className="w-5 h-5 text-gray-400" />
                                                        <div>
                                                            <p className="text-gray-500 text-xs font-medium">Branch Location</p>
                                                            <p className="text-gray-900 font-semibold">{selectedChild.branch_name}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-3 text-sm">
                                                    <Calendar className="w-5 h-5 text-gray-400" />
                                                    <div>
                                                        <p className="text-gray-500 text-xs font-medium">Date of Birth</p>
                                                        <p className="text-gray-900 font-semibold">{new Date(selectedChild.dob).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right Card: Class Details */}
                                            <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
                                                <h3 className="font-bold text-gray-900 text-base mb-2">Classroom Assignment</h3>
                                                
                                                <div className="flex items-center gap-3 text-sm">
                                                    <Award className="w-5 h-5 text-gray-400" />
                                                    <div>
                                                        <p className="text-gray-500 text-xs font-medium">Current Classroom</p>
                                                        <p className="text-gray-900 font-semibold">
                                                            {selectedChild.current_classroom || 'Unassigned / Home Care'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 text-sm">
                                                    <BadgeCheck className="w-5 h-5 text-gray-400" />
                                                    <div>
                                                        <p className="text-gray-500 text-xs font-medium">Age Group Bracket</p>
                                                        <p className="text-gray-900 font-semibold">Daycare Managed</p>
                                                    </div>
                                                </div>
                                            </div>

                                        </div>

                                        {/* Emergency Contacts & Pickups */}
                                        <div className="mt-8">
                                            <FamilyChildContacts childId={selectedChild.id} />
                                        </div>

                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default FamilyChildren;
