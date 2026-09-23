import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
    Mail, AlertCircle, CheckCircle2, ArrowLeft, KeyRound
} from 'lucide-react';

const FamilyForgotPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            await axios.post('http://127.0.0.1:8000/api/family/forgot-password/', { email });
            setSuccess(true);
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || 'Failed to request password reset. Please try again.');
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
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl p-8 sm:p-10">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 border border-white/20 mb-6 shadow-inner text-white">
                            <KeyRound className="w-8 h-8" />
                        </div>
                        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Reset Password</h2>
                        <p className="text-white/70 text-sm">We'll send you recovery instructions</p>
                    </div>

                    {success ? (
                        <div className="space-y-6 text-center">
                            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-6 text-emerald-200">
                                <CheckCircle2 className="w-10 h-10 mx-auto mb-3" />
                                <p className="font-semibold text-white">Reset Link Request Sent</p>
                                <p className="text-sm text-emerald-100/90 mt-2">
                                    If the email address <strong>{email}</strong> is associated with a guardian account, a reset link has been dispatched.
                                </p>
                            </div>
                            <Link 
                                to="/family/login"
                                className="inline-flex items-center gap-2 text-white hover:text-white/80 transition-colors text-sm font-semibold"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Sign In
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-200 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-100">{error}</p>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-white/80 pl-1">Email Address</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40 group-focus-within:text-white transition-colors">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="block w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all font-medium text-sm"
                                        placeholder="parent@example.com"
                                    />
                                </div>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3.5 px-4 bg-white text-teal-800 hover:bg-slate-100 font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-75"
                            >
                                {submitting ? 'Sending...' : 'Send Reset Link'}
                            </motion.button>

                            <div className="text-center pt-2">
                                <Link 
                                    to="/family/login"
                                    className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-semibold"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Cancel & Return
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default FamilyForgotPassword;
