
import React, { useState } from 'react';
import { generatePerformanceTemplate, GeneratedTemplateData } from '../../services/geminiService';

interface AiPerformanceGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (data: GeneratedTemplateData) => void;
}

const AiPerformanceGeneratorModal: React.FC<AiPerformanceGeneratorModalProps> = ({ isOpen, onClose, onGenerate }) => {
    const [role, setRole] = useState('');
    const [focus, setFocus] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!role.trim()) {
            setError("Job Role is required.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await generatePerformanceTemplate(role, focus);
            onGenerate(result);
            onClose();
        } catch (err: any) {
            setError(err.message || "Generation failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 border-b dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300 rounded-lg">
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">AI HR Architect</h2>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 ml-11">
                        Design comprehensive performance review templates in seconds.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Job Role / Title</label>
                        <input 
                            type="text"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm font-medium"
                            placeholder="e.g. Senior Captain, Ground Operations Manager, Line Pilot"
                            autoFocus
                            disabled={loading}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Focus Areas / Specific Competencies</label>
                        <textarea 
                            value={focus}
                            onChange={(e) => setFocus(e.target.value)}
                            className="w-full h-32 p-3 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-sm leading-relaxed"
                            placeholder="Optional. e.g. Focus on Safety Management Systems (SMS), CRM, and adherence to SOPs."
                            disabled={loading}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {error}
                        </div>
                    )}
                    
                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                         <button 
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700 rounded-md text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-bold shadow-lg flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait transition-all active:scale-95"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Designing...
                                </>
                            ) : (
                                <>
                                    <span>✨</span> Create Template
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AiPerformanceGeneratorModal;
