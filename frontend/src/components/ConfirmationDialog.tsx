import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmStyle?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmationDialog({
    isOpen, title, message, confirmText = 'Confirm', cancelText = 'Cancel', confirmStyle = 'danger', onConfirm, onCancel
}: ConfirmationDialogProps) {
    if (!isOpen) return null;

    const getConfirmButtonClasses = () => {
        switch (confirmStyle) {
            case 'danger': return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
            case 'warning': return 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-500';
            case 'primary': return 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500';
            default: return 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
                <div className="p-6">
                    <div className="flex items-start">
                        <div className={`flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full ${confirmStyle === 'danger' ? 'bg-red-100' : confirmStyle === 'warning' ? 'bg-orange-100' : 'bg-indigo-100'} sm:mx-0 sm:h-10 sm:w-10`}>
                            <AlertTriangle className={`h-6 w-6 ${confirmStyle === 'danger' ? 'text-red-600' : confirmStyle === 'warning' ? 'text-orange-600' : 'text-indigo-600'}`} aria-hidden="true" />
                        </div>
                        <div className="ml-4 mt-0.5 flex-1">
                            <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                {title}
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500">
                                    {message}
                                </p>
                            </div>
                        </div>
                        <button onClick={onCancel} className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-500">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-xl border-t border-gray-100">
                    <button
                        type="button"
                        className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${getConfirmButtonClasses()}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={onCancel}
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
}
