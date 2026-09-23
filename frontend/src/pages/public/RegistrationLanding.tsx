import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, Globe, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { BACKEND_URL } from '../../api';


// Public API does not require authentication
const fetchPublicDaycare = async (identifier: string) => {
    // using fetch instead of api so we don't send auth headers unnecessarily, 
    // but we can use api if it doesn't fail on 401. 
    // We'll just use standard fetch to be clean.
    const res = await fetch(`${BACKEND_URL}/api/public/daycares/${identifier}/registration/`);
    if (!res.ok) {
        if (res.status === 404) throw new Error("Daycare not found.");
        if (res.status === 403) throw new Error("Registration is not available for this daycare.");
        throw new Error("An error occurred while fetching daycare information.");
    }
    return res.json();
};

interface DaycarePublicData {
    id: string;
    name: string;
    logo: string | null;
    address: string;
    city: string;
    state: string;
    postal_code: string;
    email: string;
    phone: string;
    website: string;
    registration_enabled: boolean;
}

const RegistrationLanding: React.FC = () => {
    const { daycareIdentifier } = useParams<{ daycareIdentifier: string }>();
    const navigate = useNavigate();
    const [daycare, setDaycare] = useState<DaycarePublicData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!daycareIdentifier) return;
        
        fetchPublicDaycare(daycareIdentifier)
            .then(data => setDaycare(data))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [daycareIdentifier]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Registration Unavailable</h1>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <Link to="/" className="text-indigo-600 font-medium hover:text-indigo-700">
                        Return Home
                    </Link>
                </div>
            </div>
        );
    }

    if (!daycare) return null;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 py-4 px-6 sticky top-0 z-10 shadow-sm">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {daycare.logo ? (
                            <img src={`${BACKEND_URL}${daycare.logo.startsWith('/') ? '' : '/'}${daycare.logo}`} alt={daycare.name} className="h-10 w-10 object-contain rounded" />
                        ) : (
                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-bold text-xl">
                                {daycare.name.charAt(0)}
                            </div>
                        )}
                        <h1 className="text-xl font-bold text-slate-800">{daycare.name}</h1>
                    </div>
                    <div>
                        <Link to="/family/login" className="text-sm font-medium text-slate-600 hover:text-indigo-600">
                            Already enrolled? Log in
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow py-12 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-8">
                    
                    {/* Left Column: Intro & Form Placeholder */}
                    <div className="md:col-span-3 space-y-6">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                            
                            <div className="relative z-10">
                                <h2 className="text-3xl font-bold text-slate-800 mb-4">Welcome to {daycare.name} Enrollment</h2>
                                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                                    Thank you for your interest in our programs. Please start your application below. The process takes about 10-15 minutes to complete.
                                </p>
                                
                                {daycare.registration_enabled ? (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-center">
                                        <ShieldCheck className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
                                        <h3 className="text-xl font-semibold text-slate-800 mb-2">Begin Application</h3>
                                        <p className="text-slate-600 mb-6 text-sm">
                                            The full application form will be available in the next phase.
                                        </p>
                                        <button
                                            className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium shadow-md hover:bg-indigo-700 transition inline-flex items-center justify-center gap-2"
                                            onClick={() => navigate(`/register/${daycareIdentifier}/apply`)}
                                        >
                                            Start Application <ArrowRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-2xl text-center">
                                        Registration is currently closed for this daycare. Please contact us for more information.
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Column: Contact Info */}
                    <div className="md:col-span-2">
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 sticky top-24">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 pb-4 border-b border-slate-100">Contact Information</h3>
                            
                            <div className="space-y-4">
                                {(daycare.address || daycare.city) && (
                                    <div className="flex gap-3">
                                        <MapPin className="w-5 h-5 text-indigo-500 shrink-0" />
                                        <div className="text-slate-600 text-sm">
                                            <div>{daycare.address}</div>
                                            <div>{daycare.city}{daycare.state ? `, ${daycare.state}` : ''} {daycare.postal_code}</div>
                                        </div>
                                    </div>
                                )}
                                
                                {daycare.phone && (
                                    <div className="flex gap-3 items-center">
                                        <Phone className="w-5 h-5 text-indigo-500 shrink-0" />
                                        <a href={`tel:${daycare.phone}`} className="text-slate-600 text-sm hover:text-indigo-600">{daycare.phone}</a>
                                    </div>
                                )}
                                
                                {daycare.email && (
                                    <div className="flex gap-3 items-center">
                                        <Mail className="w-5 h-5 text-indigo-500 shrink-0" />
                                        <a href={`mailto:${daycare.email}`} className="text-slate-600 text-sm hover:text-indigo-600">{daycare.email}</a>
                                    </div>
                                )}
                                
                                {daycare.website && (
                                    <div className="flex gap-3 items-center">
                                        <Globe className="w-5 h-5 text-indigo-500 shrink-0" />
                                        <a href={daycare.website} target="_blank" rel="noreferrer" className="text-indigo-600 font-medium text-sm hover:underline">
                                            Visit Website
                                        </a>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default RegistrationLanding;
