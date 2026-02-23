
import React, { useState } from 'react';
import { Question } from '../../types';
import { sanitizeString } from '../../utils/sanitization';

interface BulkQuestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (questions: Question[]) => void;
    departmentId?: string;
    existingCategories: string[];
}

const BulkQuestionModal: React.FC<BulkQuestionModalProps> = ({ isOpen, onClose, onImport, departmentId, existingCategories }) => {
    const [mode, setMode] = useState<'csv' | 'paste'>('paste');
    const [pasteData, setPasteData] = useState('');
    const [delimiter, setDelimiter] = useState('|');
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handlePasteSubmit = () => {
        setError(null);
        const lines = pasteData.split('\n').filter(l => l.trim() !== '');
        const imported: Question[] = [];

        try {
            lines.forEach((line, idx) => {
                const parts = line.split(delimiter).map(p => p.trim());
                if (parts.length < 3) throw new Error(`Line ${idx + 1} has insufficient data.`);

                const [text, optionsRaw, correct, category] = parts;
                
                // SANITIZATION: Apply to all raw inputs
                const sanitizedText = sanitizeString(text);
                const sanitizedCorrect = sanitizeString(correct);
                const sanitizedCategory = sanitizeString(category) || 'General';
                
                const options = optionsRaw.split(',').map(o => sanitizeString(o.trim())).filter(Boolean);

                imported.push({
                    id: `q_bulk_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
                    text: sanitizedText,
                    type: options.length > 1 ? 'mcq' : 'true_false',
                    options: options.length > 1 ? options : undefined,
                    correctAnswer: sanitizedCorrect,
                    category: sanitizedCategory,
                    departmentId: departmentId
                });
            });

            if (imported.length === 0) throw new Error("No valid questions found.");
            
            onImport(imported);
            setPasteData('');
            onClose();
        } catch (e: any) {
            setError(e.message);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setPasteData(content);
            setMode('paste'); // Transition to paste mode so they can review/edit before confirming
        };
        reader.readAsText(file);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">Bulk Ingestor</h2>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-1">High Speed Entry</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl">&times;</button>
                </div>

                <div className="flex-grow p-6 overflow-y-auto space-y-6">
                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-md mb-4">
                        <button onClick={() => setMode('csv')} className={`flex-1 py-2 text-sm font-bold rounded transition-all ${mode === 'csv' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500'}`}>CSV Upload</button>
                        <button onClick={() => setMode('paste')} className={`flex-1 py-2 text-sm font-bold rounded transition-all ${mode === 'paste' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500'}`}>Scratchpad / Paste</button>
                    </div>

                    {mode === 'csv' ? (
                        <div className="space-y-4">
                            <div className="p-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center hover:border-brand-primary transition-colors bg-gray-50 dark:bg-gray-900/20">
                                <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" id="bulk-file" />
                                <label htmlFor="bulk-file" className="cursor-pointer block">
                                    <div className="text-5xl mb-4 opacity-50">📄</div>
                                    <p className="font-bold text-gray-700 dark:text-gray-200">Drag & Drop or Click to browse</p>
                                    <p className="text-xs text-gray-400 mt-2">Supports UTF-8 CSV and TXT files</p>
                                </label>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                                <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-2">Required Format Guide</h4>
                                <p className="text-[10px] text-blue-700 dark:text-blue-400 leading-relaxed font-mono">
                                    Question Text | Option 1, Option 2, Option 3 | Correct Answer | Category
                                </p>
                                <p className="text-[10px] text-blue-600 dark:text-blue-500 mt-2 italic">
                                    * Correct Answer must exactly match one of the options.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 flex flex-col h-full">
                            <div className="flex justify-between items-center">
                                <label className="block text-sm font-bold text-gray-600 dark:text-gray-300">Workspace</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase">Column Splitter:</span>
                                    <input 
                                        value={delimiter} 
                                        onChange={e => setDelimiter(e.target.value)} 
                                        className="w-10 text-center border rounded dark:bg-gray-700 dark:border-gray-600 font-bold text-brand-primary" 
                                        maxLength={1} 
                                    />
                                </div>
                            </div>
                            <textarea 
                                value={pasteData}
                                onChange={e => setPasteData(e.target.value)}
                                className="flex-grow w-full p-4 font-mono text-xs border rounded bg-gray-50 dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-brand-primary outline-none"
                                placeholder={`Paste your list here...\n\nExample:\nWhat is the VNE? | 120, 140, 150 | 140 | Technical\nIs GPS primary? | True, False | True | Navigation`}
                            />
                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md animate-fade-in shadow-sm">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-xs font-bold">{error}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
                    <button onClick={onClose} className="px-5 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                    {mode === 'paste' && (
                        <button 
                            onClick={handlePasteSubmit}
                            disabled={!pasteData.trim()}
                            className="px-8 py-2 bg-brand-primary text-white rounded text-sm font-bold disabled:opacity-50 shadow-lg transform active:scale-95 transition-all"
                        >
                            Validate & Import
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkQuestionModal;
