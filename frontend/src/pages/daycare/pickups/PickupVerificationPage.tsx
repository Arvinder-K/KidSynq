import React, { useState, useEffect, useRef } from 'react';
import Layout from '../../../components/Layout';
import api, { BACKEND_URL } from '../../../api';
import { 
    ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Search,
    Clock, AlertTriangle, ArrowRight, RefreshCw, QrCode,
    KeyRound, PenTool, UserCheck, Check, Camera, Lock,
    RotateCcw, History, AlertCircle, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import QRCodeDisplay from '../../../components/QRCodeDisplay';


interface ChildOption {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    admission_number?: string;
    photo?: string;
    status: string;
    classroom_name?: string;
    is_checked_in?: boolean;
    is_checked_out?: boolean;
    check_in_time?: string | null;
    check_out_time?: string | null;
}

interface PickupOption {
    id: string;
    name: string;
    relationship: string;
    phone: string;
    email?: string;
    photo_url?: string;
    photo?: string;
    authorization_status: string;
    valid_from?: string;
    valid_until?: string;
    is_expired?: boolean;
    is_effective?: boolean;
    notes?: string;
}

interface VerificationEvent {
    id: string;
    child_name: string;
    pickup_person_name?: string;
    event_type: 'CHECK_IN' | 'CHECK_OUT' | 'VERIFICATION_FAILED';
    verification_method: 'MANUAL' | 'QR' | 'PIN' | 'DIGITAL_SIGNATURE';
    verification_status: 'SUCCESS' | 'FAILED';
    failure_reason?: string;
    timestamp: string;
    processed_by_name?: string;
    notes?: string;
    signature_data?: string;
}

interface QRScanResult {
    token_id: string;
    is_valid: boolean;
    pickup_person: PickupOption;
    children: ChildOption[];
}

const getImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const PickupVerificationPage: React.FC = () => {
    const { user } = useAuth();

    // Mode: 'QR' | 'PIN' | 'SIGNATURE' | 'MANUAL'
    const [activeTab, setActiveTab] = useState<'QR' | 'PIN' | 'SIGNATURE' | 'MANUAL'>('QR');

    // Data State
    const [children, setChildren] = useState<ChildOption[]>([]);
    const [loadingChildren, setLoadingChildren] = useState(true);
    const [childSearch, setChildSearch] = useState('');

    const [selectedChild, setSelectedChild] = useState<ChildOption | null>(null);
    const [pickups, setPickups] = useState<PickupOption[]>([]);
    const [loadingPickups, setLoadingPickups] = useState(false);
    const [selectedPickup, setSelectedPickup] = useState<PickupOption | null>(null);

    const [staffNotes, setStaffNotes] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; title: string; text: string } | null>(null);

    // --- QR Scanner State ---
    const [qrTokenInput, setQrTokenInput] = useState('');
    const [scannedQRData, setScannedQRData] = useState<QRScanResult | null>(null);
    const [scanningQR, setScanningQR] = useState(false);
    const [selectedQRChildId, setSelectedQRChildId] = useState<string>('');
    const [showQRPassModal, setShowQRPassModal] = useState(false);
    const [activePassPickup, setActivePassPickup] = useState<PickupOption | null>(null);

    // --- PIN Verification State ---
    const [pinInput, setPinInput] = useState('');
    const [pinMasked, setPinMasked] = useState(true);
    const [pinSelectedPickupId, setPinSelectedPickupId] = useState('');
    const [allPickups, setAllPickups] = useState<PickupOption[]>([]);
    const [loadingAllPickups, setLoadingAllPickups] = useState(false);

    // --- Signature Canvas State ---
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    // --- Events Feed State ---
    const [events, setEvents] = useState<VerificationEvent[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [eventFilterMethod, setEventFilterMethod] = useState('ALL');
    const [eventFilterStatus, setEventFilterStatus] = useState('ALL');

    useEffect(() => {
        fetchChildren();
        fetchEvents();
        fetchAllPickups();
    }, []);

    useEffect(() => {
        if (selectedChild) {
            fetchChildPickups(selectedChild.id);
            setSelectedPickup(null);
        } else {
            setPickups([]);
            setSelectedPickup(null);
        }
    }, [selectedChild]);

    const fetchChildren = async () => {
        setLoadingChildren(true);
        try {
            const response = await api.get('/daycare/children/');
            setChildren(response.data?.results || response.data || []);
        } catch (error) {
            console.error("Failed to fetch children list:", error);
        } finally {
            setLoadingChildren(false);
        }
    };

    const fetchAllPickups = async () => {
        setLoadingAllPickups(true);
        try {
            const response = await api.get('/daycare/authorized-pickups/');
            setAllPickups(response.data?.results || response.data || []);
        } catch (error) {
            console.error("Failed to fetch authorized pickups:", error);
        } finally {
            setLoadingAllPickups(false);
        }
    };

    const fetchChildPickups = async (childId: string) => {
        setLoadingPickups(true);
        try {
            const response = await api.get(`/daycare/children/${childId}/authorized-pickups/`);
            setPickups(response.data || []);
        } catch (error) {
            console.error("Failed to fetch child pickups:", error);
            setPickups([]);
        } finally {
            setLoadingPickups(false);
        }
    };

    const fetchEvents = async () => {
        setLoadingEvents(true);
        try {
            const response = await api.get('/daycare/pickups/events/');
            setEvents(response.data || []);
        } catch (error) {
            console.error("Failed to fetch events:", error);
        } finally {
            setLoadingEvents(false);
        }
    };

    // --- QR Actions ---
    const handleScanQR = async (tokenToScan?: string) => {
        const token = tokenToScan || qrTokenInput.trim();
        if (!token) return;

        setScanningQR(true);
        setActionMessage(null);
        try {
            const response = await api.post('/daycare/pickups/qr/scan/', { token });
            setScannedQRData(response.data);
            if (response.data.children?.length > 0) {
                setSelectedQRChildId(response.data.children[0].id);
            }
            setActionMessage({
                type: 'success',
                title: 'QR Code Verified',
                text: `Identified: ${response.data.pickup_person.name} (${response.data.pickup_person.relationship}) with ${response.data.children.length} authorized child(ren).`
            });
        } catch (error: any) {
            setScannedQRData(null);
            const err = error.response?.data?.error || error.response?.data?.detail || error.response?.data?.token?.[0] || "Invalid or unrecognized QR token.";
            setActionMessage({
                type: 'error',
                title: 'QR Verification Failed',
                text: err
            });
            fetchEvents();
        } finally {
            setScanningQR(false);
        }
    };

    const handleQRCheckIn = async () => {
        if (!scannedQRData || !selectedQRChildId) return;

        setActionLoading(true);
        try {
            const response = await api.post('/daycare/pickups/qr/check-in/', {
                token: qrTokenInput.trim(),
                child_id: selectedQRChildId,
                notes: staffNotes
            });

            setActionMessage({
                type: 'success',
                title: 'Arrival Recorded (Check-In)',
                text: `${response.data.child.name} checked in successfully at ${response.data.check_in_time} via QR.`
            });
            setStaffNotes('');
            fetchEvents();
            fetchChildren();
        } catch (error: any) {
            const err = error.response?.data?.error || error.response?.data?.detail || "Check-in failed.";
            setActionMessage({ type: 'error', title: 'Check-In Rejected', text: err });
            fetchEvents();
        } finally {
            setActionLoading(false);
        }
    };

    const handleQRCheckOut = async () => {
        if (!scannedQRData || !selectedQRChildId) return;

        setActionLoading(true);
        try {
            const response = await api.post('/daycare/pickups/qr/check-out/', {
                token: qrTokenInput.trim(),
                child_id: selectedQRChildId,
                notes: staffNotes
            });

            setActionMessage({
                type: 'success',
                title: 'Departure Recorded (Check-Out)',
                text: `${response.data.child.name} safely departed with ${response.data.pickup_person.name} at ${response.data.check_out_time} via QR.`
            });
            setStaffNotes('');
            fetchEvents();
            fetchChildren();
        } catch (error: any) {
            const err = error.response?.data?.error || error.response?.data?.detail || "Check-out failed.";
            setActionMessage({ type: 'error', title: 'Check-Out Rejected', text: err });
            fetchEvents();
        } finally {
            setActionLoading(false);
        }
    };

    // --- PIN Actions ---
    const handlePINCheckOut = async () => {
        if (!pinSelectedPickupId || !selectedChild || !pinInput) {
            setActionMessage({
                type: 'error',
                title: 'Incomplete Details',
                text: 'Please select a child, authorized pickup, and enter the security PIN.'
            });
            return;
        }

        setActionLoading(true);
        try {
            const response = await api.post('/daycare/pickups/pin/check-out/', {
                pickup_person_id: pinSelectedPickupId,
                pin: pinInput,
                child_id: selectedChild.id,
                notes: staffNotes
            });

            setActionMessage({
                type: 'success',
                title: 'PIN Departure Verified',
                text: `${response.data.child.name} departed safely with ${response.data.pickup_person.name} at ${response.data.check_out_time}.`
            });
            setPinInput('');
            setStaffNotes('');
            fetchEvents();
            fetchChildren();
        } catch (error: any) {
            const err = error.response?.data?.error || error.response?.data?.detail || error.response?.data?.non_field_errors?.[0] || error.response?.data?.[0] || "PIN Departure rejected.";
            setActionMessage({ type: 'error', title: 'PIN Verification Failed', text: err });
            fetchEvents();
        } finally {
            setActionLoading(false);
        }
    };

    // --- Digital Signature Canvas ---
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#1e293b';
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
        setHasSignature(true);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
    };

    const handleSignatureCheckOut = async () => {
        if (!selectedPickup || !selectedChild || !hasSignature) {
            setActionMessage({
                type: 'error',
                title: 'Missing Required Information',
                text: 'Please select child, pickup person, and ensure a signature has been drawn.'
            });
            return;
        }

        const canvas = canvasRef.current;
        const signatureData = canvas ? canvas.toDataURL('image/png') : '';

        setActionLoading(true);
        try {
            const response = await api.post('/daycare/pickups/signature/check-out/', {
                pickup_person_id: selectedPickup.id,
                child_id: selectedChild.id,
                signature_data: signatureData,
                notes: staffNotes
            });

            setActionMessage({
                type: 'success',
                title: 'Digital Signature Departure Recorded',
                text: `${response.data.child.name} departed safely with ${response.data.pickup_person.name} with signature verified.`
            });
            clearSignature();
            setStaffNotes('');
            fetchEvents();
            fetchChildren();
        } catch (error: any) {
            const err = error.response?.data?.error || error.response?.data?.detail || "Digital signature checkout rejected.";
            setActionMessage({ type: 'error', title: 'Signature Checkout Failed', text: err });
            fetchEvents();
        } finally {
            setActionLoading(false);
        }
    };

    // --- Manual Authority Verify ---
    const handleManualVerify = async () => {
        if (!selectedChild || !selectedPickup) return;

        setActionLoading(true);
        try {
            const response = await api.post('/daycare/pickups/verify/', {
                child_id: selectedChild.id,
                pickup_person_id: selectedPickup.id,
                notes: staffNotes
            });

            if (response.data.is_authorized) {
                setActionMessage({
                    type: 'success',
                    title: 'Authority Verified (COMPLIANT)',
                    text: response.data.reason
                });
            } else {
                setActionMessage({
                    type: 'error',
                    title: 'Unauthorized Pickup (REJECTED)',
                    text: response.data.reason
                });
            }
            fetchEvents();
        } catch (error: any) {
            const err = error.response?.data?.reason || error.response?.data?.detail || "Manual verification failed.";
            setActionMessage({ type: 'error', title: 'Verification Error', text: err });
            fetchEvents();
        } finally {
            setActionLoading(false);
        }
    };

    const filteredChildren = children.filter(c => {
        if (!childSearch.trim()) return true;
        const q = childSearch.toLowerCase();
        const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
        const adm = (c.admission_number || '').toLowerCase();
        return fullName.includes(q) || adm.includes(q);
    });

    const filteredEvents = events.filter(e => {
        if (eventFilterMethod !== 'ALL' && e.verification_method !== eventFilterMethod) return false;
        if (eventFilterStatus !== 'ALL' && e.verification_status !== eventFilterStatus) return false;
        return true;
    });

    return (
        <Layout>
            <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-200">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl text-white shadow-md shadow-indigo-100">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Safe Arrival & Departure Station</h1>
                                <p className="text-sm font-medium text-slate-500">
                                    Digital QR, PIN, and Signature Verification Hub for Authorized Child Check-In & Departure.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 md:mt-0 flex items-center gap-3">
                        <button 
                            onClick={() => { fetchChildren(); fetchEvents(); }} 
                            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
                        >
                            <RefreshCw className="w-4 h-4 text-slate-500" />
                            Refresh Live Feed
                        </button>
                    </div>
                </div>

                {/* Alert Notification */}
                {actionMessage && (
                    <div className={`p-4 rounded-xl border flex items-start gap-3.5 transition-all shadow-sm ${
                        actionMessage.type === 'success' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                            : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}>
                        {actionMessage.type === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                            <h4 className="font-semibold text-sm">{actionMessage.title}</h4>
                            <p className="text-xs mt-0.5 opacity-90">{actionMessage.text}</p>
                        </div>
                        <button 
                            onClick={() => setActionMessage(null)}
                            className="text-xs font-semibold hover:opacity-75"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* Verification Mode Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button
                        onClick={() => { setActiveTab('QR'); setActionMessage(null); }}
                        className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                            activeTab === 'QR'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 ring-2 ring-indigo-600/30'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                        }`}
                    >
                        <QrCode className="w-6 h-6" />
                        <span className="font-semibold text-sm">1. QR Express</span>
                        <span className={`text-[11px] font-medium ${activeTab === 'QR' ? 'text-indigo-100' : 'text-slate-400'}`}>Arrival & Departure</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('PIN'); setActionMessage(null); }}
                        className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                            activeTab === 'PIN'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 ring-2 ring-indigo-600/30'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                        }`}
                    >
                        <KeyRound className="w-6 h-6" />
                        <span className="font-semibold text-sm">2. Security PIN</span>
                        <span className={`text-[11px] font-medium ${activeTab === 'PIN' ? 'text-indigo-100' : 'text-slate-400'}`}>Numeric Keypad</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('SIGNATURE'); setActionMessage(null); }}
                        className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                            activeTab === 'SIGNATURE'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 ring-2 ring-indigo-600/30'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                        }`}
                    >
                        <PenTool className="w-6 h-6" />
                        <span className="font-semibold text-sm">3. Digital Signature</span>
                        <span className={`text-[11px] font-medium ${activeTab === 'SIGNATURE' ? 'text-indigo-100' : 'text-slate-400'}`}>Touch Canvas</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('MANUAL'); setActionMessage(null); }}
                        className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                            activeTab === 'MANUAL'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 ring-2 ring-indigo-600/30'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                        }`}
                    >
                        <UserCheck className="w-6 h-6" />
                        <span className="font-semibold text-sm">4. Photo Inspect</span>
                        <span className={`text-[11px] font-medium ${activeTab === 'MANUAL' ? 'text-indigo-100' : 'text-slate-400'}`}>Staff Authority</span>
                    </button>
                </div>

                {/* Main Work Area based on Active Mode */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    
                    {/* TAB 1: QR EXPRESS WORKFLOW */}
                    {activeTab === 'QR' && (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                
                                {/* Left: QR Token Scan Input */}
                                <div className="w-full md:w-1/2 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <QrCode className="w-5 h-5 text-indigo-600" />
                                        <h3 className="font-bold text-slate-900 text-base">Scan or Enter QR Token</h3>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Scan the parent's digital pass or enter their secure 32-character token reference.
                                    </p>

                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Paste or scan QR token string..."
                                            value={qrTokenInput}
                                            onChange={(e) => setQrTokenInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleScanQR(); }}
                                            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        />
                                        <button
                                            onClick={() => handleScanQR()}
                                            disabled={scanningQR || !qrTokenInput.trim()}
                                            className="px-5 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm flex items-center gap-2"
                                        >
                                            {scanningQR ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                            Lookup
                                        </button>
                                    </div>

                                    {/* Simulated Scanner Quick Actions */}
                                    <div className="pt-3 border-t border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                Quick Pickups (Testing / Demonstration)
                                            </span>
                                            {qrTokenInput && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowQRPassModal(true)}
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                                                >
                                                    <QrCode className="w-3.5 h-3.5" />
                                                    View Full Pass
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {allPickups.slice(0, 6).map((p) => (
                                                <button
                                                    key={p.id}
                                                    onClick={async () => {
                                                        try {
                                                            const genRes = await api.post('/daycare/pickups/qr/generate/', { pickup_person_id: p.id });
                                                            setQrTokenInput(genRes.data.token);
                                                            setActivePassPickup(p);
                                                            handleScanQR(genRes.data.token);
                                                        } catch (err) {
                                                            console.error("Failed to auto-gen QR token:", err);
                                                        }
                                                    }}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition"
                                                >
                                                    {p.name} ({p.relationship})
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Visual 2D QR Code Matrix Preview */}
                                    {qrTokenInput && (
                                        <div className="pt-3 border-t border-slate-100 flex flex-col items-center">
                                            <span className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                                                <QrCode className="w-4 h-4 text-indigo-600" />
                                                Live Scannable 2D QR Code Barcode:
                                            </span>
                                            <QRCodeDisplay
                                                value={qrTokenInput}
                                                size={150}
                                                title={scannedQRData?.pickup_person?.name || activePassPickup?.name || 'Guardian Pass'}
                                                subtitle="Scan with phone camera or 2D barcode reader"
                                                showControls={true}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Right: Scanned Context & Action Execution */}
                                <div className="w-full md:w-1/2 bg-slate-50 rounded-xl p-5 border border-slate-200">
                                    {scannedQRData ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                                                        {scannedQRData.pickup_person.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 text-sm">{scannedQRData.pickup_person.name}</h4>
                                                        <p className="text-xs text-slate-500">{scannedQRData.pickup_person.relationship} • {scannedQRData.pickup_person.phone}</p>
                                                    </div>
                                                </div>
                                                <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                                                    <Check className="w-3.5 h-3.5" />
                                                    Authorized
                                                </span>
                                            </div>

                                            {/* Child Selection */}
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-700 mb-2">
                                                    Select Child for Action ({scannedQRData.children.length} authorized):
                                                </label>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {scannedQRData.children.map((c) => (
                                                        <div
                                                            key={c.id}
                                                            onClick={() => setSelectedQRChildId(c.id)}
                                                            className={`p-3 rounded-xl border cursor-pointer transition ${
                                                                selectedQRChildId === c.id
                                                                    ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                                                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            <div className="font-semibold text-xs text-slate-900">{c.first_name} {c.last_name}</div>
                                                            <div className="text-[11px] text-slate-500 mt-0.5">
                                                                Status: {c.is_checked_in ? (
                                                                    <span className="text-emerald-600 font-medium">Checked In ({c.check_in_time})</span>
                                                                ) : c.is_checked_out ? (
                                                                    <span className="text-slate-500 font-medium">Checked Out ({c.check_out_time})</span>
                                                                ) : (
                                                                    <span className="text-amber-600 font-medium">Not Checked In</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Notes Input */}
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Staff Notes (Optional):</label>
                                                <input
                                                    type="text"
                                                    value={staffNotes}
                                                    onChange={(e) => setStaffNotes(e.target.value)}
                                                    placeholder="Optional remarks..."
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                                                />
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-3 pt-2">
                                                <button
                                                    onClick={handleQRCheckIn}
                                                    disabled={actionLoading || !selectedQRChildId}
                                                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                                                >
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    Confirm Arrival (Check-In)
                                                </button>
                                                <button
                                                    onClick={handleQRCheckOut}
                                                    disabled={actionLoading || !selectedQRChildId}
                                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                                                >
                                                    <ArrowRight className="w-4 h-4" />
                                                    Confirm Departure (Check-Out)
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                                            <QrCode className="w-10 h-10 stroke-[1.5] mb-2 text-slate-300" />
                                            <p className="text-sm font-medium text-slate-600">No QR Scanned Yet</p>
                                            <p className="text-xs text-slate-400 mt-1 max-w-xs">Scan a code or select a quick pickup from the left to start express verification.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: PIN VERIFICATION */}
                    {activeTab === 'PIN' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                
                                {/* 1. Child Selection */}
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        1. Select Child
                                    </label>
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                        <input
                                            type="text"
                                            placeholder="Search child by name..."
                                            value={childSearch}
                                            onChange={(e) => setChildSearch(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        />
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                                        {filteredChildren.map((c) => (
                                            <div
                                                key={c.id}
                                                onClick={() => { setSelectedChild(c); setPinSelectedPickupId(''); }}
                                                className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                                                    selectedChild?.id === c.id
                                                        ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-semibold'
                                                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                                }`}
                                            >
                                                <div className="text-xs">{c.first_name} {c.last_name}</div>
                                                <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 2. Pickup Person Selection */}
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        2. Authorized Pickup Person
                                    </label>
                                    {selectedChild ? (
                                        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                                            {pickups.length > 0 ? (
                                                pickups.map((p) => (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => setPinSelectedPickupId(p.id)}
                                                        className={`p-3 rounded-xl border cursor-pointer transition ${
                                                            pinSelectedPickupId === p.id
                                                                ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                                                                : 'bg-white border-slate-200 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <div className="font-semibold text-xs text-slate-900">{p.name}</div>
                                                        <div className="text-[11px] text-slate-500">{p.relationship} • {p.phone}</div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                                                    No authorized pickups found for this child.
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                                            Select a child first to view their authorized pickups.
                                        </div>
                                    )}
                                </div>

                                {/* 3. PIN Keypad & Confirmation */}
                                <div className="space-y-4 bg-slate-50 rounded-2xl p-5 border border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            3. Enter 4-6 Digit PIN
                                        </label>
                                        <button
                                            onClick={() => setPinMasked(!pinMasked)}
                                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                                        >
                                            {pinMasked ? 'Show PIN' : 'Hide PIN'}
                                        </button>
                                    </div>

                                    <input
                                        type={pinMasked ? "password" : "text"}
                                        maxLength={6}
                                        value={pinInput}
                                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                                        placeholder="••••"
                                        className="w-full text-center tracking-[0.5em] text-2xl font-bold py-3 bg-white border border-slate-300 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />

                                    {/* Numeric Keypad Buttons */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'].map((k) => (
                                            <button
                                                key={String(k)}
                                                onClick={() => {
                                                    if (k === 'C') setPinInput('');
                                                    else if (k === '⌫') setPinInput(pinInput.slice(0, -1));
                                                    else if (pinInput.length < 6) setPinInput(pinInput + String(k));
                                                }}
                                                className="py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition shadow-sm active:scale-95"
                                            >
                                                {k}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={handlePINCheckOut}
                                        disabled={actionLoading || !pinInput || !pinSelectedPickupId || !selectedChild}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Lock className="w-4 h-4" />
                                        Verify PIN & Execute Departure
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: DIGITAL SIGNATURE WORKFLOW */}
                    {activeTab === 'SIGNATURE' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                
                                {/* 1. Child Selection */}
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        1. Select Child
                                    </label>
                                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                                        {filteredChildren.map((c) => (
                                            <div
                                                key={c.id}
                                                onClick={() => setSelectedChild(c)}
                                                className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                                                    selectedChild?.id === c.id
                                                        ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-semibold'
                                                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                                }`}
                                            >
                                                <div className="text-xs">{c.first_name} {c.last_name}</div>
                                                <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 2. Pickup Selection */}
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        2. Authorized Pickup Person
                                    </label>
                                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                                        {selectedChild && pickups.map((p) => (
                                            <div
                                                key={p.id}
                                                onClick={() => setSelectedPickup(p)}
                                                className={`p-3 rounded-xl border cursor-pointer transition ${
                                                    selectedPickup?.id === p.id
                                                        ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                                                        : 'bg-white border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="font-semibold text-xs text-slate-900">{p.name}</div>
                                                <div className="text-[11px] text-slate-500">{p.relationship} • {p.phone}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 3. Digital Signature Canvas Pad */}
                                <div className="space-y-3 bg-slate-50 rounded-2xl p-5 border border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                            <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                                            3. Signature Pad
                                        </label>
                                        <button
                                            onClick={clearSignature}
                                            className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1"
                                        >
                                            <RotateCcw className="w-3 h-3" />
                                            Clear
                                        </button>
                                    </div>

                                    <div className="border border-slate-300 rounded-xl bg-white overflow-hidden shadow-inner relative">
                                        <canvas
                                            ref={canvasRef}
                                            width={320}
                                            height={140}
                                            onMouseDown={startDrawing}
                                            onMouseMove={draw}
                                            onMouseUp={stopDrawing}
                                            onMouseLeave={stopDrawing}
                                            onTouchStart={startDrawing}
                                            onTouchMove={draw}
                                            onTouchEnd={stopDrawing}
                                            className="w-full h-36 cursor-crosshair touch-none"
                                        />
                                        {!hasSignature && (
                                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 text-xs font-medium">
                                                Sign here with finger or stylus
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleSignatureCheckOut}
                                        disabled={actionLoading || !hasSignature || !selectedChild || !selectedPickup}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        Save Signature & Confirm Departure
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: MANUAL INSPECTION */}
                    {activeTab === 'MANUAL' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Child & Pickup selection */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                            Select Child
                                        </label>
                                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                            {filteredChildren.map((c) => (
                                                <div
                                                    key={c.id}
                                                    onClick={() => setSelectedChild(c)}
                                                    className={`p-2.5 rounded-xl border cursor-pointer text-xs transition ${
                                                        selectedChild?.id === c.id ? 'bg-indigo-50 border-indigo-500 font-semibold' : 'bg-white border-slate-200'
                                                    }`}
                                                >
                                                    {c.first_name} {c.last_name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                            Select Authorized Pickup Person
                                        </label>
                                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                            {selectedChild && pickups.map((p) => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => setSelectedPickup(p)}
                                                    className={`p-2.5 rounded-xl border cursor-pointer text-xs transition ${
                                                        selectedPickup?.id === p.id ? 'bg-indigo-50 border-indigo-500 font-semibold' : 'bg-white border-slate-200'
                                                    }`}
                                                >
                                                    {p.name} ({p.relationship})
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Detailed Photo and Authority Review */}
                                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                                    <h4 className="font-bold text-slate-900 text-sm">Authority & Identity Details</h4>
                                    {selectedPickup ? (
                                        <div className="space-y-3 text-xs">
                                            <div className="flex items-center gap-3">
                                                {selectedPickup.photo_url ? (
                                                    <img 
                                                        src={getImageUrl(selectedPickup.photo_url)} 
                                                        alt={selectedPickup.name} 
                                                        className="w-16 h-16 rounded-xl object-cover border border-slate-300"
                                                    />
                                                ) : (
                                                    <div className="w-16 h-16 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400">
                                                        <Camera className="w-6 h-6" />
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-bold text-sm text-slate-900">{selectedPickup.name}</div>
                                                    <div className="text-slate-500">{selectedPickup.relationship} • {selectedPickup.phone}</div>
                                                    <div className="mt-1">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                                            {selectedPickup.authorization_status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-slate-200 space-y-1 text-slate-600">
                                                <div><strong>Valid Until:</strong> {selectedPickup.valid_until || 'Indefinite'}</div>
                                                <div><strong>Notes:</strong> {selectedPickup.notes || 'None recorded'}</div>
                                            </div>

                                            <button
                                                onClick={handleManualVerify}
                                                disabled={actionLoading}
                                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow transition"
                                            >
                                                Run Full Authority Verification Check
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="h-40 flex items-center justify-center text-slate-400 text-xs text-center">
                                            Select both child and pickup person on the left to review details.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Real-time Live Events & Audit Feed */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <History className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-bold text-slate-900 text-base">Live Arrival & Departure Audit Stream</h3>
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-2">
                            <select
                                value={eventFilterMethod}
                                onChange={(e) => setEventFilterMethod(e.target.value)}
                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                            >
                                <option value="ALL">All Methods</option>
                                <option value="QR">QR Code</option>
                                <option value="PIN">Security PIN</option>
                                <option value="DIGITAL_SIGNATURE">Digital Signature</option>
                                <option value="MANUAL">Manual</option>
                            </select>

                            <select
                                value={eventFilterStatus}
                                onChange={(e) => setEventFilterStatus(e.target.value)}
                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="SUCCESS">Success Only</option>
                                <option value="FAILED">Failed Rejections Only</option>
                            </select>
                        </div>
                    </div>

                    {/* Events Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-3 px-4">Time</th>
                                    <th className="py-3 px-4">Child</th>
                                    <th className="py-3 px-4">Pickup / Context</th>
                                    <th className="py-3 px-4">Event Type</th>
                                    <th className="py-3 px-4">Method</th>
                                    <th className="py-3 px-4">Status & Details</th>
                                    <th className="py-3 px-4">Staff</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                {loadingEvents ? (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-slate-400">Loading audit events...</td>
                                    </tr>
                                ) : filteredEvents.length > 0 ? (
                                    filteredEvents.map((evt) => (
                                        <tr key={evt.id} className="hover:bg-slate-50 transition">
                                            <td className="py-3 px-4 font-mono text-slate-500">
                                                {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </td>
                                            <td className="py-3 px-4 font-semibold text-slate-900">{evt.child_name || 'N/A'}</td>
                                            <td className="py-3 px-4">{evt.pickup_person_name || 'Direct / Self'}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    evt.event_type === 'CHECK_IN'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : evt.event_type === 'CHECK_OUT'
                                                        ? 'bg-indigo-100 text-indigo-800'
                                                        : 'bg-rose-100 text-rose-800'
                                                }`}>
                                                    {evt.event_type}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-600">
                                                    {evt.verification_method}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                {evt.verification_status === 'SUCCESS' ? (
                                                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        Verified
                                                    </span>
                                                ) : (
                                                    <span className="text-rose-600 font-semibold flex items-center gap-1" title={evt.failure_reason}>
                                                        <XCircle className="w-3.5 h-3.5" />
                                                        {evt.failure_reason || 'Rejected'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-slate-500">{evt.processed_by_name || 'System'}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                                            No arrival/departure verification events recorded yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
            {/* Modal: Full Guardian QR Pass Card */}
            {showQRPassModal && qrTokenInput && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                                    <QrCode className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-slate-900 text-base">Guardian QR Digital Pass</h3>
                            </div>
                            <button 
                                onClick={() => setShowQRPassModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="py-5 flex flex-col items-center">
                            <QRCodeDisplay
                                value={qrTokenInput}
                                size={200}
                                title={scannedQRData?.pickup_person?.name || activePassPickup?.name || 'Guardian'}
                                subtitle="KidSynq Safe Arrival / Departure Pass"
                                showControls={true}
                            />
                            
                            <div className="mt-4 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-left">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Raw Token (Zero PII Embed)</span>
                                <p className="text-xs font-mono text-slate-700 break-all select-all font-semibold mt-0.5">
                                    {qrTokenInput}
                                </p>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setShowQRPassModal(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                            >
                                Close Pass
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default PickupVerificationPage;
