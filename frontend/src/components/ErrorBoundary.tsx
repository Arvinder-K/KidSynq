import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = '/daycare/dashboard';
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                    <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-rose-100 p-8 text-center">
                        <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xs">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                            An unexpected issue occurred while rendering this page. You can try refreshing the page or returning to the dashboard.
                        </p>

                        {this.state.error && (
                            <div className="bg-slate-50 text-left p-3.5 rounded-xl border border-slate-200 mb-6 text-xs text-rose-700 font-mono overflow-auto max-h-36">
                                {this.state.error.toString()}
                            </div>
                        )}

                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={this.handleReload}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all"
                            >
                                <RefreshCw className="w-4 h-4" />
                                <span>Refresh Page</span>
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all"
                            >
                                <Home className="w-4 h-4" />
                                <span>Go to Dashboard</span>
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
