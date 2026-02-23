
import React, { useState } from 'react';
import { generateExamQuestions, GeneratedQuestion } from '../../services/geminiService';
import { Question } from '../../types';

interface AiQuestionGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (questions: Question[]) => void;
    departmentId?: string;
}

const AiQuestionGeneratorModal: React.FC<AiQuestionGeneratorModalProps> = ({ isOpen, onClose, onImport, departmentId }) => {
    const [step, setStep] = useState<'input' | 'preview'>('input');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Inputs
    const [topic, setTopic] = useState('');
    const [count, setCount] = useState(5);
    const [difficulty, setDifficulty] = useState('Medium');

    // Results
    const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!topic.trim()) {
            setError("Please enter a topic or paste text content.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const results = await generateExamQuestions(topic, count, difficulty);
            setGeneratedQuestions(results);
            // Select all by default
            setSelectedIndices(new Set(results.map((_, i) => i)));
            setStep('preview');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = () => {
        const questionsToImport: Question[] = generatedQuestions
            .filter((_, idx) => selectedIndices.has(idx))
            .map((gq, idx) => ({
                id: `q_ai_${Date.now()}_${idx}`,
                text: gq.text,
                type: gq.type,
                options: gq.options,
                correctAnswer: gq.correctAnswer,
                category: gq.category,
                departmentId: departmentId,
                imageUrl: undefined
            }));
        
        onImport(questionsToImport);
        onClose();
        // Reset state after closing
        setTimeout(() => {
            setStep('input');
            setTopic('');
            setGeneratedQuestions([]);
        }, 500);
    };

    const toggleSelection = (idx: number) => {
        setSelectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const handleEditQuestion = (idx: number, field: keyof GeneratedQuestion, value: string) => {
        const updated = [...generatedQuestions];
        // @ts-ignore
        updated[idx][field] = value;
        setGeneratedQuestions(updated);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center sm:p-4">
            {/* Mobile: Full Screen. Desktop: Standard Modal */}
            <div className="bg-white dark:bg-gray-800 sm:rounded-xl shadow-2xl w-full h-full sm:h-[85vh] sm:max-w-2xl flex flex-col animate-fade-in border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                
                {/* Header with Safe Top Padding */}
                <div className="p-4 sm:p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-white dark:from-gray-800 dark:to-gray-800 sm:rounded-t-xl pt-safe-top">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">AI Question Generator</h2>
                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Powered by Gemini 1.5 Flash</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl">&times;</button>
                </div>

                <div className="flex-grow p-4 sm:p-6 overflow-y-auto">
                    {step === 'input' ? (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Topic or Source Text
                                </label>
                                <textarea
                                    value={topic}
                                    onChange={e => setTopic(e.target.value)}
                                    placeholder="e.g. 'Helicopter Aerodynamics', 'Dangerous Goods Regulations', or paste a paragraph from the Operations Manual..."
                                    className="w-full h-48 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-base"
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Quantity</label>
                                    <input 
                                        type="number" 
                                        min="1" max="10" 
                                        value={count}
                                        onChange={e => setCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Max 10 per batch.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Difficulty</label>
                                    <select 
                                        value={difficulty} 
                                        onChange={e => setDifficulty(e.target.value)}
                                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    >
                                        <option value="Easy">Easy</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Hard">Hard</option>
                                    </select>
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm border border-red-200 dark:border-red-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    {error}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-gray-700 dark:text-gray-200">Generated Drafts ({generatedQuestions.length})</h3>
                                <button 
                                    onClick={() => setStep('input')}
                                    className="text-xs text-indigo-600 hover:underline"
                                >
                                    &larr; Adjust Parameters
                                </button>
                            </div>
                            
                            {generatedQuestions.map((q, idx) => (
                                <div 
                                    key={idx} 
                                    className={`p-4 border rounded-lg transition-all ${
                                        selectedIndices.has(idx) 
                                            ? 'border-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/20 dark:border-indigo-700' 
                                            : 'border-gray-200 dark:border-gray-700 opacity-60'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <input 
                                            type="checkbox"
                                            checked={selectedIndices.has(idx)}
                                            onChange={() => toggleSelection(idx)}
                                            className="mt-1 h-6 w-6 text-indigo-600 rounded focus:ring-indigo-500"
                                        />
                                        <div className="flex-grow space-y-2">
                                            <input 
                                                value={q.text}
                                                onChange={(e) => handleEditQuestion(idx, 'text', e.target.value)}
                                                className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none font-medium text-gray-900 dark:text-white"
                                            />
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                                {q.options.map((opt, optIdx) => (
                                                    <div key={optIdx} className={`text-xs px-2 py-1 rounded flex items-center justify-between ${opt === q.correctAnswer ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 font-bold border border-green-200 dark:border-green-800' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                                        <span>{opt}</span>
                                                        {opt === q.correctAnswer && <span>✓</span>}
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <div className="flex gap-2 mt-2">
                                                <span className="text-[10px] uppercase font-bold bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                                                    {q.category}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 sm:rounded-b-xl flex justify-between items-center pb-safe-bottom">
                    {step === 'input' ? (
                        <>
                            <span className="text-xs text-gray-500 italic hidden sm:inline">Generates questions via Gemini API.</span>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <button onClick={onClose} className="flex-1 sm:flex-none px-5 py-3 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">Cancel</button>
                                <button 
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="flex-1 sm:flex-none px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-md disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            Thinking...
                                        </>
                                    ) : (
                                        <>
                                            <span>✨</span> Generate
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                             <div className="text-sm font-medium text-gray-600 dark:text-gray-300 hidden sm:block">
                                {selectedIndices.size} selected
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <button onClick={() => setStep('input')} className="flex-1 sm:flex-none px-5 py-3 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">Back</button>
                                <button 
                                    onClick={handleImport}
                                    disabled={selectedIndices.size === 0}
                                    className="flex-1 sm:flex-none px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold shadow-md disabled:opacity-50"
                                >
                                    Import ({selectedIndices.size})
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AiQuestionGeneratorModal;
