import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check, User, Calendar, ShieldAlert, FileText } from 'lucide-react';

const steps = [
    { id: 1, name: 'Child Info', icon: User },
    { id: 2, name: 'Admission', icon: Calendar },
    { id: 3, name: 'Emergency', icon: ShieldAlert },
    { id: 4, name: 'Review', icon: FileText }
];

const ChildAdmission: React.FC = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        preferred_name: '',
        dob: '',
        gender: '',
        language: '',
        photo: null as File | null,
        
        admission_number: '',
        enrollment_date: '',
        start_date: '',
        
        emergency_name: '',
        emergency_relationship: '',
        emergency_mobile: '',
        emergency_email: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError(null);
    };

    const calculateAge = (dob: string) => {
        if (!dob) return '';
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 0 ? `${age} years old` : 'Invalid date';
    };

    const validateStep = () => {
        if (currentStep === 1) {
            if (!formData.first_name || !formData.last_name || !formData.dob) {
                setError("First name, last name, and date of birth are required.");
                return false;
            }
        }
        if (currentStep === 2) {
            if (!formData.admission_number || !formData.enrollment_date || !formData.start_date) {
                setError("Admission number, enrollment date, and start date are required.");
                return false;
            }
        }
        if (currentStep === 3) {
            if (!formData.emergency_name || !formData.emergency_mobile) {
                setError("Emergency contact name and mobile are required.");
                return false;
            }
        }
        return true;
    };

    const handleNext = () => {
        if (validateStep()) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        setCurrentStep(prev => prev - 1);
        setError(null);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const dataToSubmit = {
                first_name: formData.first_name,
                last_name: formData.last_name,
                preferred_name: formData.preferred_name,
                dob: formData.dob,
                gender: formData.gender,
                language: formData.language,
                admission_number: formData.admission_number,
                admission_date: formData.enrollment_date,
                joining_date: formData.start_date,
                status: 'Active',
                emergency_contact: {
                    name: formData.emergency_name,
                    relationship: formData.emergency_relationship,
                    mobile: formData.emergency_mobile,
                    email: formData.emergency_email
                }
            };
            
            // First submit data
            const res = await api.post('/daycare/children/', dataToSubmit);
            console.log("Admission response:", res.data);
            navigate('/daycare/children');
        } catch (err: any) {
            console.error("Admission error:", err);
            if (err.response?.data) {
                if (typeof err.response.data === 'string') {
                    setError(err.response.data);
                } else if (err.response.data.detail) {
                    setError(err.response.data.detail);
                } else {
                    // Extract first validation error from object
                    const firstKey = Object.keys(err.response.data)[0];
                    if (firstKey) {
                        const errorMsg = Array.isArray(err.response.data[firstKey]) ? err.response.data[firstKey][0] : err.response.data[firstKey];
                        setError(`Error in ${firstKey}: ${errorMsg}`);
                    } else {
                        setError('Failed to submit admission. Please try again.');
                    }
                }
            } else {
                setError(err.message || 'Failed to submit admission. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Layout>
            <div className="max-w-4xl mx-auto p-6 space-y-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Child Admission</h1>
                    <p className="mt-1 text-sm text-gray-500">Enroll a new child into the daycare.</p>
                </div>

                {/* Progress Tracker */}
                <div className="relative">
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 rounded-full overflow-hidden">
                        <motion.div 
                            className="h-full bg-indigo-500"
                            initial={{ width: '0%' }}
                            animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                    <div className="relative flex justify-between">
                        {steps.map((step) => {
                            const isCompleted = step.id < currentStep;
                            const isCurrent = step.id === currentStep;
                            
                            return (
                                <div key={step.id} className="flex flex-col items-center">
                                    <div 
                                        className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-white shadow-sm z-10 transition-colors duration-300 ${
                                            isCompleted ? 'bg-indigo-500 text-white' : 
                                            isCurrent ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30' : 
                                            'bg-gray-100 text-gray-400'
                                        }`}
                                    >
                                        {isCompleted ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                                    </div>
                                    <span className={`mt-2 text-sm font-medium ${isCurrent ? 'text-indigo-600' : isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                                        {step.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Form Container */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px] flex flex-col">
                    <div className="p-8 flex-1">
                        
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center">
                                <ShieldAlert className="w-5 h-5 mr-2 flex-shrink-0" />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}

                        <AnimatePresence mode="wait">
                            {currentStep === 1 && (
                                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                    <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                                        <User className="w-5 h-5 mr-2 text-indigo-500" /> Child Information
                                    </h2>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                                            <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                                            <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Name</label>
                                            <input type="text" name="preferred_name" value={formData.preferred_name} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                                            <div className="flex gap-2 items-center">
                                                <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                {formData.dob && <span className="text-sm text-gray-500 whitespace-nowrap">{calculateAge(formData.dob)}</span>}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                            <select name="gender" value={formData.gender} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                                <option value="">Select Gender</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                                            <input type="text" name="language" value={formData.language} onChange={handleChange} placeholder="e.g. English, French" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 2 && (
                                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                    <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                                        <Calendar className="w-5 h-5 mr-2 text-indigo-500" /> Admission Information
                                    </h2>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Admission Number *</label>
                                            <input type="text" name="admission_number" value={formData.admission_number} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                            <p className="text-xs text-gray-500 mt-1">Must be unique within the daycare</p>
                                        </div>
                                        <div className="md:col-span-2 border-t border-gray-100 my-2"></div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Date *</label>
                                            <input type="date" name="enrollment_date" value={formData.enrollment_date} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                                            <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 3 && (
                                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                    <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                                        <ShieldAlert className="w-5 h-5 mr-2 text-indigo-500" /> Emergency Information
                                    </h2>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Contact Name *</label>
                                            <input type="text" name="emergency_name" value={formData.emergency_name} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                                            <input type="text" name="emergency_relationship" value={formData.emergency_relationship} onChange={handleChange} placeholder="e.g. Mother, Father" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
                                            <input type="tel" name="emergency_mobile" value={formData.emergency_mobile} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                            <input type="email" name="emergency_email" value={formData.emergency_email} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 4 && (
                                <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                    <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                                        <FileText className="w-5 h-5 mr-2 text-indigo-500" /> Review & Confirmation
                                    </h2>
                                    
                                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                                            <div>
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 border-b border-gray-200 pb-2">Child Summary</h3>
                                                <div className="space-y-2">
                                                    <p className="text-sm"><span className="text-gray-500 w-24 inline-block">Name:</span> <span className="font-medium text-gray-900">{formData.first_name} {formData.last_name}</span></p>
                                                    <p className="text-sm"><span className="text-gray-500 w-24 inline-block">DOB:</span> <span className="font-medium text-gray-900">{formData.dob} ({calculateAge(formData.dob)})</span></p>
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 border-b border-gray-200 pb-2">Admission Summary</h3>
                                                <div className="space-y-2">
                                                    <p className="text-sm"><span className="text-gray-500 w-32 inline-block">Admission No:</span> <span className="font-medium text-gray-900">{formData.admission_number}</span></p>
                                                    <p className="text-sm"><span className="text-gray-500 w-32 inline-block">Start Date:</span> <span className="font-medium text-gray-900">{formData.start_date}</span></p>
                                                </div>
                                            </div>
                                            <div className="md:col-span-2">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 border-b border-gray-200 pb-2">Emergency Contact</h3>
                                                <div className="space-y-2 flex gap-8">
                                                    <p className="text-sm"><span className="text-gray-500 mr-2">Name:</span> <span className="font-medium text-gray-900">{formData.emergency_name}</span></p>
                                                    <p className="text-sm"><span className="text-gray-500 mr-2">Mobile:</span> <span className="font-medium text-gray-900">{formData.emergency_mobile}</span></p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-6 text-center">Please verify that all information is correct before submitting. This will create a permanent admission record.</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                    </div>
                    
                    {/* Footer Actions */}
                    <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                        {currentStep > 1 ? (
                            <button onClick={handleBack} disabled={submitting} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50">
                                Back
                            </button>
                        ) : (
                            <button onClick={() => navigate('/daycare/children')} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors">
                                Cancel
                            </button>
                        )}

                        {currentStep < steps.length ? (
                            <button onClick={handleNext} className="flex items-center px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/30">
                                Continue <ChevronRight className="w-4 h-4 ml-1" />
                            </button>
                        ) : (
                            <button 
                                onClick={handleSubmit} 
                                disabled={submitting}
                                className="flex items-center px-8 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-sm shadow-green-600/30 disabled:opacity-70"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 mr-2" /> Complete Admission
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default ChildAdmission;
