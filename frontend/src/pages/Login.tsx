import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { LogIn, KeyRound, User, AlertCircle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface LoginProps {
    type?: 'daycare' | 'admin' | 'family';
}

const Login: React.FC<LoginProps> = ({ type = 'daycare' }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, user } = useAuth();
    const navigate = useNavigate();

    if (user) {
        if (user.is_superuser) {
            return <Navigate to="/admin" replace />;
        }
        if (user.role === 'Guardian') {
            return <Navigate to="/family/profile" replace />;
        }
        return <Navigate to="/dashboard" replace />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await axios.post('http://127.0.0.1:8000/api/token/', {
                username,
                password,
            });
            const loggedInUser = await login(response.data.access, response.data.refresh);
            
            if (loggedInUser) {
                if (type === 'admin') {
                    if (loggedInUser.is_superuser) {
                        navigate('/admin');
                    } else {
                        // Not a superadmin but tried to use admin login
                        setError('Unauthorized: You are not a Super Admin.');
                        setIsLoading(false);
                    }
                } else if (type === 'family') {
                    if (loggedInUser.role === 'Guardian') {
                        navigate('/family/profile');
                    } else {
                        setError('Unauthorized: This portal is only for Guardians.');
                        setIsLoading(false);
                    }
                } else {
                    if (!loggedInUser.is_superuser && loggedInUser.role !== 'Guardian') {
                        navigate('/dashboard');
                    } else {
                        setError('Unauthorized: Please use the appropriate login portal.');
                        setIsLoading(false);
                    }
                }
            } else {
                setError('Failed to fetch user profile.');
                setIsLoading(false);
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
            setIsLoading(false);
        }
    };

    const gradientClass = type === 'admin' 
        ? "from-slate-900 via-purple-900 to-slate-900" 
        : type === 'family'
            ? "from-teal-600 via-emerald-700 to-indigo-800"
            : "from-blue-600 via-indigo-700 to-purple-800";

    const title = type === 'admin' 
        ? 'Platform Administration' 
        : type === 'family'
            ? 'Guardian Portal'
            : 'Daycare Dashboard';
            
    const subtitle = type === 'admin' 
        ? 'Manage your KidSynq ecosystem' 
        : type === 'family'
            ? "Access your child's daycare records"
            : 'Welcome back to KidSynq';

    return (
        <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${gradientClass} p-4 sm:p-6 lg:p-8 relative overflow-hidden`}>
            
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
                    <div className="text-center mb-10">
                        <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
                            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md mb-6 shadow-inner border border-white/20"
                        >
                            <LogIn className="w-8 h-8 text-white" />
                        </motion.div>
                        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">{title}</h2>
                        <p className="text-white/70">{subtitle}</p>
                    </div>

                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-red-500/20 border border-red-500/50 backdrop-blur-sm rounded-xl p-4 mb-6 flex items-start gap-3"
                        >
                            <AlertCircle className="w-5 h-5 text-red-200 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-100">{error}</p>
                        </motion.div>
                    )}

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-white/80 pl-1">Username or Email</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-white text-white/40">
                                    <User className="h-5 w-5" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    className="block w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all shadow-inner"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between pl-1 pr-1">
                                <label className="block text-sm font-medium text-white/80">Password</label>
                                <a href="#" className="text-xs font-medium text-white/60 hover:text-white transition-colors">Forgot password?</a>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-white text-white/40">
                                    <KeyRound className="h-5 w-5" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="block w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all shadow-inner"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {type === 'family' && (
                            <div className="flex items-center justify-end text-xs">
                                <Link to="/family/forgot-password" style={{ color: 'rgba(255,255,255,0.7)' }} className="hover:text-white transition-colors">
                                    Forgot Password?
                                </Link>
                            </div>
                        )}

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={isLoading}
                            className={`w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] text-sm font-semibold text-gray-900 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-white transition-all disabled:opacity-70 disabled:cursor-not-allowed`}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="ml-2 w-4 h-4" />
                                </>
                            )}
                        </motion.button>
                    </form>
                </div>
                
                <div className="mt-8 text-center text-white/50 text-sm">
                    &copy; {new Date().getFullYear()} KidSynq Platform. All rights reserved.
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
