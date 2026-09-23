import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
    AlertCircle, CheckCircle2, ArrowRight, School, UserCheck
} from 'lucide-react';

interface InvitationDetails {
    email: string;
    relationship: string;
    student_name: string;
    daycare_name: string;
}

const FamilyActivate: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [invitation, setInvitation] = useState<InvitationDetails | null>(null);

    // Form fields
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token) {
            setError('Invitation token is missing from the URL.');
            setLoading(false);
            return;
        }
        validateToken();
    }, [token]);

    const validateToken = async () => {
        try {
            const response = await axios.get(`http://127.0.0.1:8000/api/family/activate/?token=${token}`);
            setInvitation(response.data);
            setFirstName('');
            setLastName('');
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || 'Invalid or expired invitation token.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setSubmitting(true);
        try {
            await axios.post('http://127.0.0.1:8000/api/family/activate/', {
                token,
                password,
                first_name: firstName,
                last_name: lastName,
                phone
            });
            setSuccess(true);
            setTimeout(() => {
                navigate('/family/login');
            }, 3000);
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || 'Failed to activate account. Please check the inputs.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-600 via-emerald-700 to-indigo-800 p-4 sm:p-6 lg:p-8 relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-white/10 blur-[120px]"></div>
                <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[60%] rounded-full bg-white/5 blur-[100px]"></div>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-lg relative z-10"
            >
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl p-8 sm:p-10">
                    
                    {loading ? (
                        <div className="text-center py-10 space-y-4">
                            <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto"></div>
                            <p className="text-white/80 font-medium">Validating invitation token...</p>
                        </div>
                    ) : error && !invitation ? (
                        <div className="text-center py-6 space-y-6">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-200">
                                <AlertCircle className="w-8 h-8" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-white">Activation Failed</h3>
                                <p className="text-white/70 text-sm">{error}</p>
                            </div>
                            <Link 
                                to="/family/login"
                                className="inline-flex items-center justify-center px-6 py-2.5 bg-white text-teal-800 font-semibold rounded-xl hover:bg-slate-100 transition-colors text-sm"
                            >
                                Back to Sign In
                            </Link>
                        </div>
                    ) : success ? (
                        <div className="text-center py-8 space-y-6">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 animate-bounce">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-white">Account Activated!</h3>
                                <p className="text-white/80 text-sm">Your guardian profile has been linked to your child.</p>
                                <p className="text-white/60 text-xs mt-2">Redirecting to login portal...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 border border-white/20 mb-6 shadow-inner text-white">
                                    <UserCheck className="w-8 h-8" />
                                </div>
                                <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Activate Guardian Account</h2>
                                <p className="text-white/70 text-sm">Complete your profile to access KidSynq</p>
                            </div>

                            {/* Invitation Banner Details */}
                            {invitation && (
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 text-sm">
                                    <div className="flex items-center gap-2 text-white/90">
                                        <School className="w-4 h-4 text-emerald-300" />
                                        <span className="font-semibold">{invitation.daycare_name}</span>
                                    </div>
                                    <div className="h-px bg-white/10" />
                                    <div className="text-white/80 space-y-1">
                                        <p>You have been invited as <strong>{invitation.relationship}</strong> to:</p>
                                        <p className="text-white font-bold text-base mt-1">{invitation.student_name}</p>
                                    </div>
                                    <div className="text-xs text-white/50">
                                        Invitation Email: {invitation.email}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-200 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-100">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-white/80 pl-1">First Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={firstName}
                                            onChange={e => setFirstName(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/50 text-sm font-medium"
                                            placeholder="John"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-white/80 pl-1">Last Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={lastName}
                                            onChange={e => setLastName(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/50 text-sm font-medium"
                                            placeholder="Doe"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-white/80 pl-1">Phone Number</label>
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/50 text-sm font-medium"
                                        placeholder="555-0199"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-white/80 pl-1">Choose Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/50 text-sm font-medium"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-white/80 pl-1">Confirm Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/50 text-sm font-medium"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-3 px-4 mt-6 bg-white text-teal-800 hover:bg-slate-100 font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
                                >
                                    {submitting ? 'Activating...' : 'Activate My Account'}
                                    {!submitting && <ArrowRight className="w-4 h-4" />}
                                </motion.button>
                            </form>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default FamilyActivate;
