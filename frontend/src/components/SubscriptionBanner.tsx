import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, X, Clock, RefreshCw, ShieldAlert } from 'lucide-react';

const SubscriptionBanner: React.FC = () => {
    const { user } = useAuth();
    const [dismissed, setDismissed] = useState(false);

    if (!user || (user as any).is_superuser || !user.daycare) return null;

    const sub = (user as any).active_subscription;
    if (!sub) return null;

    const { is_expired, is_expiring_soon, days_until_expiry, is_trial, plan_name, expiry_date, renewal_date } = sub;

    const shouldShow =
        is_expired ||
        is_expiring_soon ||
        (is_trial && typeof days_until_expiry === 'number' && days_until_expiry <= 14);

    if (!shouldShow || dismissed) return null;

    let bg = '', border = '', icon: React.ReactNode = null, title = '', message = '';

    if (is_expired) {
        bg = 'bg-red-600'; border = 'border-red-700';
        icon = <ShieldAlert className="w-5 h-5 text-white shrink-0" />;
        title = 'Subscription Expired';
        message = `Your ${plan_name} subscription has expired. Some features may be unavailable. Contact your platform administrator to renew.`;
    } else if (is_expiring_soon || (is_trial && typeof days_until_expiry === 'number' && days_until_expiry <= 7)) {
        const d = days_until_expiry as number;
        const urgency = d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;
        bg = d <= 3 ? 'bg-orange-500' : 'bg-amber-400';
        border = d <= 3 ? 'border-orange-600' : 'border-amber-500';
        icon = <AlertTriangle className="w-5 h-5 text-white shrink-0" />;
        const cap = urgency.charAt(0).toUpperCase() + urgency.slice(1);
        title = is_trial ? `Trial Ending ${cap}` : `Subscription Expiring ${cap}`;
        message = is_trial
            ? `Your ${plan_name} trial ends ${urgency} on ${expiry_date}. Contact your administrator to activate a paid subscription.`
            : `Your ${plan_name} subscription expires ${urgency} on ${expiry_date}. Contact your administrator to renew.`;
    } else {
        bg = 'bg-blue-500'; border = 'border-blue-600';
        icon = <Clock className="w-5 h-5 text-white shrink-0" />;
        title = `Trial Active — ${days_until_expiry} days remaining`;
        message = `You are on the ${plan_name} trial ending on ${expiry_date}. Reach out to your administrator to upgrade before it expires.`;
    }

    return (
        <div className={`w-full ${bg} border-b ${border} px-4 py-2.5 text-white`}>
            <div className="max-w-7xl mx-auto flex items-center gap-3">
                {icon}
                <div className="flex-1 min-w-0">
                    <span className="font-bold text-sm mr-2">{title}.</span>
                    <span className="text-sm opacity-90">{message}</span>
                    {renewal_date && !is_expired && !is_trial && (
                        <span className="text-sm opacity-75 ml-1">Renewal date: {renewal_date}.</span>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <a
                        href="mailto:support@kidsynq.com?subject=Subscription%20Renewal%20Request"
                        className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg border border-white/30 transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Request Renewal
                    </a>
                    <button onClick={() => setDismissed(true)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title="Dismiss">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionBanner;
