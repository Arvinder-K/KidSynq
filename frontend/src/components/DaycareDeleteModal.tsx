import React, { useState } from 'react';
import { AlertTriangle, Trash2, Archive, X, AlertOctagon, Check } from 'lucide-react';

interface DaycareDeleteModalProps {
    isOpen: boolean;
    daycare: {
        id: string;
        name: string;
        status?: string;
    } | null;
    isHardDeleteOnly?: boolean;
    onClose: () => void;
    onConfirm: (daycareId: string, deleteType: 'soft_delete' | 'permanent_delete') => Promise<void>;
}

export default function DaycareDeleteModal({
    isOpen,
    daycare,
    isHardDeleteOnly = false,
    onClose,
    onConfirm
}: DaycareDeleteModalProps) {
    const [deleteType, setDeleteType] = useState<'soft_delete' | 'permanent_delete'>(
        isHardDeleteOnly || daycare?.status === 'Deleted' ? 'permanent_delete' : 'soft_delete'
    );
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    React.useEffect(() => {
        if (isOpen && daycare) {
            setDeleteType(isHardDeleteOnly || daycare.status === 'Deleted' ? 'permanent_delete' : 'soft_delete');
            setConfirmText('');
            setError('');
        }
    }, [isOpen, daycare, isHardDeleteOnly]);

    if (!isOpen || !daycare) return null;

    const isAlreadyDeleted = daycare.status === 'Deleted';
    const isPermanent = deleteType === 'permanent_delete' || isAlreadyDeleted || isHardDeleteOnly;

    const handleExecute = async () => {
        if (isPermanent && confirmText.trim().toLowerCase() !== daycare.name.trim().toLowerCase()) {
            setError(`Please type "${daycare.name}" to confirm permanent deletion.`);
            return;
        }

        setLoading(true);
        setError('');
        try {
            await onConfirm(daycare.id, deleteType);
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to execute deletion.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 transform transition-all animate-scaleUp">
                {/* Header */}
                <div className={`px-6 py-5 flex justify-between items-start ${isPermanent ? 'bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-100' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${isPermanent ? 'bg-red-600 text-white shadow-red-200' : 'bg-amber-500 text-white shadow-amber-200'}`}>
                            {isPermanent ? <AlertOctagon className="w-6 h-6" /> : <Archive className="w-6 h-6" />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">
                                {isPermanent ? 'Permanently Delete Daycare' : 'Delete / Archive Daycare'}
                            </h3>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">
                                Target: <span className="font-semibold text-gray-800">{daycare.name}</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-white/80 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                            {error}
                        </div>
                    )}

                    {!isAlreadyDeleted && !isHardDeleteOnly && (
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                                Choose Deletion Method:
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDeleteType('soft_delete')}
                                    className={`p-3.5 rounded-xl border text-left transition-all ${
                                        deleteType === 'soft_delete'
                                            ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-400/20'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 font-bold text-sm text-gray-900">
                                            <Archive className="w-4 h-4 text-amber-600" />
                                            Soft Delete
                                        </div>
                                        {deleteType === 'soft_delete' && <Check className="w-4 h-4 text-amber-600" />}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                                        Deactivates daycare and sets status to Deleted. Data remains safe and can be restored anytime.
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setDeleteType('permanent_delete')}
                                    className={`p-3.5 rounded-xl border text-left transition-all ${
                                        deleteType === 'permanent_delete'
                                            ? 'border-red-500 bg-red-50/60 ring-2 ring-red-400/20'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 font-bold text-sm text-red-700">
                                            <Trash2 className="w-4 h-4 text-red-600" />
                                            Permanent Purge
                                        </div>
                                        {deleteType === 'permanent_delete' && <Check className="w-4 h-4 text-red-600" />}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                                        Permanently erases daycare, students, staff accounts, classrooms, and billing history from MySQL.
                                    </p>
                                </button>
                            </div>
                        </div>
                    )}

                    {isPermanent ? (
                        <div className="space-y-3 bg-red-50/70 border border-red-200 rounded-xl p-4">
                            <div className="flex items-start gap-2.5">
                                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <div className="text-xs text-red-800 space-y-1">
                                    <p className="font-bold text-red-900">Irreversible Action Warning</p>
                                    <p>
                                        This will permanently wipe <strong>{daycare.name}</strong> and all associated child enrollments, staff accounts, schedules, attendance, invoices, and subscriptions.
                                    </p>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-red-200/60">
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                    Type <span className="font-bold text-gray-900 font-mono select-all bg-white px-1.5 py-0.5 rounded border border-gray-300">{daycare.name}</span> to confirm:
                                </label>
                                <input
                                    type="text"
                                    placeholder={daycare.name}
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-white border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-gray-300"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-2.5">
                            <Archive className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold mb-0.5">Archiving Daycare</p>
                                <p>
                                    This daycare will be hidden from active operations and logins will be disabled. You can restore it back to active anytime from the Super Admin table.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm text-gray-700 font-semibold hover:bg-gray-200/60 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleExecute}
                        disabled={loading || (isPermanent && confirmText.trim().toLowerCase() !== daycare.name.trim().toLowerCase())}
                        className={`inline-flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-xl text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isPermanent
                                ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                                : 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                        }`}
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : isPermanent ? (
                            <><Trash2 className="w-4 h-4" /> Permanently Delete</>
                        ) : (
                            <><Archive className="w-4 h-4" /> Soft Delete</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
