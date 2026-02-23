
import React from 'react';
import { useNotifications } from '../../contexts/NotificationsContext';
import { ToastMessage } from '../../types';

const Toast: React.FC<{ toast: ToastMessage; onClose: (id: string) => void }> = ({ toast, onClose }) => {
    const colors = {
        success: 'bg-green-100 border-green-500 text-green-800 dark:bg-green-900/90 dark:text-green-100',
        error: 'bg-red-100 border-red-500 text-red-800 dark:bg-red-900/90 dark:text-red-100',
        warning: 'bg-yellow-100 border-yellow-500 text-yellow-800 dark:bg-yellow-900/90 dark:text-yellow-100',
        info: 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/90 dark:text-blue-100',
    };

    const icons = {
        success: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
        error: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
        warning: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
        info: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    };

    return (
        <div className={`flex items-center w-full max-w-sm p-4 mb-4 border-l-4 rounded shadow-lg transform transition-all duration-300 ease-in-out animate-fade-in ${colors[toast.type]}`}>
            <div className="flex-shrink-0">
                {icons[toast.type]}
            </div>
            <div className="ml-3 text-sm font-medium pr-6">
                {toast.message}
            </div>
            <button 
                onClick={() => onClose(toast.id)} 
                className="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 hover:bg-black/10 inline-flex items-center justify-center h-8 w-8 focus:outline-none"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
    );
};

const ToastContainer: React.FC = () => {
    const { toasts, removeToast } = useNotifications();

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} onClose={removeToast} />
            ))}
        </div>
    );
};

export default ToastContainer;
