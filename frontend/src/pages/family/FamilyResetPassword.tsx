import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
    KeyRound, AlertCircle, CheckCircle2, ArrowRight, ArrowLeft
} from 'lucide-react';

const FamilyResetPassword: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!token) {
            setError('Reset token is missing from the URL.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setSubmitting(true);
        try {
            await axios.post('http://127.0.0.1:8000/api/family/reset-password/', {
                token,
                password
            });
            setSuccess(true);
            setTimeout(() => {
                navigate('/family/login');
            }, 3000);
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || 'Failed to reset password. The link may have expired.');
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
                        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">New Password</h2>
                        <p className="text-white/70 text-sm">Enter your new secure password</p>
                    </div>

                    {success ? (
                        <div className="space-y-6 text-center">
                            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-6 text-emerald-250">
                                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-350" />
                                <p className="font-semibold text-white">Password Updated</p>
                                <p className="text-sm text-emerald-100/90 mt-2">
                                    Your password has been reset successfully. Redirecting you to login portal...
                                </p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {!token && (
                                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-200 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-100">Recovery token is missing from URL.</p>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-200 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-100">{error}</p>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-white/80 pl-1">New Password</label>
                                <input
                                    type="password"
                                    required
                                    disabled={!token}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="block w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all font-medium text-sm disabled:opacity-55"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-white/80 pl-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    required
                                    disabled={!token}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="block w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all font-medium text-sm disabled:opacity-55"
                                    placeholder="••••••••"
                                />
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={submitting || !token}
                                className="w-full py-3.5 px-4 bg-white text-teal-800 hover:bg-slate-100 font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Resetting...' : 'Update Password'}
                                {!submitting && <ArrowRight className="w-4 h-4" />}
                            </motion.button>

                            <div className="text-center pt-2">
                                <Link 
                                    to="/family/login"
                                    className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-semibold"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Return to Sign In
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default FamilyResetPassword;
