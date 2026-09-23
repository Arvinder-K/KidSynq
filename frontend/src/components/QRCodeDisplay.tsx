import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Copy, Check, ShieldCheck, Sparkles } from 'lucide-react';

interface QRCodeDisplayProps {
    value: string;
    size?: number;
    title?: string;
    subtitle?: string;
    showControls?: boolean;
    className?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
    value,
    size = 200,
    title,
    subtitle,
    showControls = true,
    className = ''
}) => {
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!value) {
            setQrDataUrl('');
            setLoading(false);
            return;
        }

        setLoading(true);
        QRCode.toDataURL(value, {
            width: size * 2, // 2x for retina crispness
            margin: 2,
            color: {
                dark: '#1e1b4b', // deep indigo/slate
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        })
            .then(url => {
                setQrDataUrl(url);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to generate QR Code:", err);
                setLoading(false);
            });
    }, [value, size]);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleDownload = () => {
        if (!qrDataUrl) return;
        const link = document.createElement('a');
        link.download = `pickup-pass-${title ? title.toLowerCase().replace(/\s+/g, '-') : 'token'}.png`;
        link.href = qrDataUrl;
        link.click();
    };

    return (
        <div className={`flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
            {title && (
                <div className="text-center mb-3">
                    <h4 className="font-bold text-slate-900 text-sm">{title}</h4>
                    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
            )}

            <div 
                className="relative bg-white p-3 rounded-2xl border-2 border-indigo-100 shadow-inner flex items-center justify-center"
                style={{ width: size + 24, height: size + 24 }}
            >
                {loading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                ) : qrDataUrl ? (
                    <img 
                        src={qrDataUrl} 
                        alt="QR Code Pass" 
                        className="rounded-lg object-contain w-full h-full shadow-sm"
                    />
                ) : (
                    <span className="text-xs text-slate-400">No token available</span>
                )}
            </div>

            {showControls && value && (
                <div className="flex items-center gap-2 mt-4 w-full justify-center">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                        title="Copy raw token string"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied Token' : 'Copy Token'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={!qrDataUrl}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                        title="Download QR code image for parent"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Save Pass</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default QRCodeDisplay;
