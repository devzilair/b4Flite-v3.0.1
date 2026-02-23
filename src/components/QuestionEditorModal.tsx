
import React, { useState, useEffect, useRef } from 'react';
import { Question } from '../types.ts';
import { sanitizeString, getErrorMessage } from '../utils/sanitization.ts';
import { useStaff } from '../hooks/useStaff.ts';
import { usePermissions } from '../hooks/usePermissions.ts';
import { uploadFile } from '../services/api.ts';
import { QuestionSchema } from '../schemas.ts';
import { improveQuestion, QuestionImprovement } from '../services/geminiService.ts';

interface QuestionEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (question: Question, keepOpen?: boolean) => void;
    existingQuestion: Question | null;
    existingCategories: string[];
}

const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({ isOpen, onClose, onSave, existingQuestion, existingCategories }) => {
    const { departments } = useStaff();
    const { can } = usePermissions();
    const canManageGlobal = can('exams:manage');

    const [question, setQuestion] = useState<Partial<Question>>({
        text: '',
        type: 'mcq',
        options: [],
        correctAnswer: '',
        category: '',
        departmentId: undefined,
        imageUrl: '',
    });
    
    const [optionsStr, setOptionsStr] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    
    // AI Improver State
    const [isImproving, setIsImproving] = useState(false);
    const [improvement, setImprovement] = useState<QuestionImprovement | null>(null);
    
    // File Input Ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (existingQuestion) {
            setQuestion(existingQuestion);
            setOptionsStr((existingQuestion.options || []).join(', '));
        } else {
            setQuestion({
                text: '',
                type: 'mcq',
                options: [],
                correctAnswer: '',
                category: '',
                departmentId: undefined,
                imageUrl: '',
            });
            setOptionsStr('');
        }
        setUploadError(null);
        setValidationErrors([]);
        setImprovement(null);
    }, [existingQuestion, isOpen]);

    // Reset correct answer when type changes to prevent invalid selection
    useEffect(() => {
        if (isOpen) {
             // Only reset if it's NOT the initial load of an existing question.
             // If the types match, we assume the existing answer is valid.
             if (existingQuestion && existingQuestion.type === question.type) {
                 return;
             }
             setQuestion(prev => ({
                 ...prev,
                 correctAnswer: '' // Reset answer on type change to force re-selection
             }));
        }
    }, [question.type, isOpen, existingQuestion]);

    const currentOptions = question.type === 'mcq' 
        ? optionsStr.split(',').map(s => s.trim()).filter(Boolean) 
        : [];

    const handleSubmit = (e: React.FormEvent, keepOpen: boolean = false) => {
        e.preventDefault();
        setValidationErrors([]);
        
        const payload = {
            ...question,
            id: existingQuestion?.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            text: sanitizeString(question.text),
            options: question.type === 'mcq' ? currentOptions : undefined,
            correctAnswer: sanitizeString(question.correctAnswer),
            category: sanitizeString(question.category),
        };

        const result = QuestionSchema.safeParse(payload);
        if (!result.success) {
            setValidationErrors(result.error.errors.map(err => err.message));
            return;
        }

        // The cast is now safe because the schema includes id and we ensured it was in the payload
        onSave(result.data as Question, keepOpen);
        
        if (keepOpen) {
            setQuestion(prev => ({
                ...prev,
                text: '',
                options: [],
                correctAnswer: '',
                imageUrl: '',
            }));
            setOptionsStr('');
            setUploadError(null);
            setImprovement(null);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setUploading(true);
            setUploadError(null);
            try {
                const publicUrl = await uploadFile(file);
                setQuestion(prev => ({ ...prev, imageUrl: publicUrl }));
            } catch (error: any) {
                setUploadError(getErrorMessage(error));
            } finally {
                setUploading(false);
                // Reset file input so user can re-upload if needed (e.g. they deleted and want to add again)
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        }
    };
    
    const handleRemoveImage = () => {
        setQuestion(prev => ({ ...prev, imageUrl: '' }));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleAnalyze = async () => {
        if (!question.text || !question.correctAnswer || currentOptions.length < 2) {
            alert("Please fill in the question text, options, and correct answer first.");
            return;
        }
        setIsImproving(true);
        setImprovement(null);
        try {
            const result = await improveQuestion(question.text || '', question.correctAnswer || '', currentOptions);
            setImprovement(result);
        } catch (e: any) {
            alert("AI Analysis failed: " + e.message);
        } finally {
            setIsImproving(false);
        }
    };

    const applyImprovement = () => {
        if (!improvement) return;
        setQuestion(prev => ({
            ...prev,
            text: improvement.improvedText,
        }));
        setOptionsStr(improvement.improvedOptions.join(', '));
        // Reset analysis after applying to avoid confusion
        setImprovement(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-xl font-bold">{existingQuestion ? 'Edit Question' : 'Add New Question'}</h2>
                    {question.type === 'mcq' && (
                        <button 
                            type="button" 
                            onClick={handleAnalyze} 
                            disabled={isImproving}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider shadow hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isImproving ? (
                                <>
                                    <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <span>✨</span> Audit with AI
                                </>
                            )}
                        </button>
                    )}
                </div>
                
                {validationErrors.length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs font-medium flex-shrink-0">
                        <ul className="list-disc pl-4">
                            {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                    </div>
                )}

                <form onSubmit={(e) => handleSubmit(e, false)} className="flex-grow flex flex-col overflow-hidden space-y-4">
                    <div className="flex-grow overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                        
                        {/* AI FEEDBACK PANEL */}
                        {improvement && (
                            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-4">
                                <h3 className="text-sm font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2 mb-2">
                                    <span>✨</span> AI Suggestions
                                </h3>
                                <div className="text-xs space-y-2 text-gray-700 dark:text-gray-300">
                                    <p><span className="font-bold">Critique:</span> {improvement.critique}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700">
                                        <div>
                                            <p className="font-bold text-gray-500 uppercase text-[10px] mb-1">Current Text</p>
                                            <p className="italic opacity-80">{question.text}</p>
                                        </div>
                                        <div>
                                            <p className="font-bold text-green-600 uppercase text-[10px] mb-1">Improved Text</p>
                                            <p className="font-medium text-green-700 dark:text-green-400">{improvement.improvedText}</p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 italic mt-1">Reasoning: {improvement.reasoning}</p>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={applyImprovement}
                                    className="mt-3 w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 rounded transition-colors"
                                >
                                    Apply Improvements
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Type</label>
                                <select 
                                    className="w-full form-input"
                                    value={question.type}
                                    onChange={e => setQuestion({...question, type: e.target.value as any})}
                                >
                                    <option value="mcq">Multiple Choice</option>
                                    <option value="true_false">True / False</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Category</label>
                                <input 
                                    type="text" 
                                    list="categories" 
                                    className="w-full form-input"
                                    value={question.category || ''}
                                    onChange={e => setQuestion({...question, category: e.target.value})}
                                    placeholder="e.g. Navigation"
                                />
                                <datalist id="categories">
                                    {existingCategories.map(c => <option key={c} value={c} />)}
                                </datalist>
                            </div>
                        </div>

                        {canManageGlobal && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Department Scope</label>
                                <select 
                                    className="w-full form-input"
                                    value={question.departmentId || ''}
                                    onChange={e => setQuestion({...question, departmentId: e.target.value || undefined})}
                                >
                                    <option value="">Global (All Departments)</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium mb-1">Question Text</label>
                            <textarea 
                                className="w-full form-input" 
                                rows={4} 
                                value={question.text} 
                                onChange={e => setQuestion({...question, text: e.target.value})} 
                                required
                            />
                        </div>
                        
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded border dark:border-gray-600">
                            <label className="block text-sm font-medium mb-2">Diagram / Image (Optional)</label>
                            <div className="flex flex-col sm:flex-row gap-4 items-start">
                                <div className="flex-grow w-full">
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-light file:text-brand-primary hover:file:bg-blue-100"
                                    />
                                    {uploading && <p className="text-xs text-blue-500 mt-1 animate-pulse">Uploading...</p>}
                                </div>
                                {question.imageUrl && (
                                    <div className="flex-shrink-0 relative group">
                                        <img src={question.imageUrl} alt="Diagram" className="h-16 w-16 object-cover rounded border" />
                                        <button 
                                            type="button" 
                                            onClick={handleRemoveImage}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {question.type === 'mcq' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Options (comma-separated)</label>
                                <textarea 
                                    rows={3}
                                    value={optionsStr} 
                                    onChange={e => setOptionsStr(e.target.value)} 
                                    className="w-full form-input" 
                                    placeholder="Option A, Option B, Option C..." 
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium mb-1">Correct Answer</label>
                            {question.type === 'true_false' ? (
                                <select 
                                    className="w-full form-input"
                                    value={question.correctAnswer}
                                    onChange={e => setQuestion({...question, correctAnswer: e.target.value})}
                                >
                                    <option value="">Select Answer</option>
                                    <option value="True">True</option>
                                    <option value="False">False</option>
                                </select>
                            ) : (
                                <select 
                                    className="w-full form-input" 
                                    value={question.correctAnswer} 
                                    onChange={e => setQuestion({...question, correctAnswer: e.target.value})} 
                                    disabled={currentOptions.length < 1}
                                >
                                    <option value="">Select the correct option...</option>
                                    {currentOptions.map((opt, idx) => (
                                        <option key={idx} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between pt-4 border-t dark:border-gray-700 mt-4 flex-shrink-0">
                        {!existingQuestion ? (
                            <button 
                                type="button" 
                                onClick={(e) => handleSubmit(e, true)} 
                                disabled={uploading}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm disabled:opacity-50"
                            >
                                Save & Add Another
                            </button>
                        ) : <div />}
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 px-4 py-2 rounded hover:bg-gray-300 text-sm">Cancel</button>
                            <button type="submit" disabled={uploading} className="bg-brand-primary text-white px-6 py-2 rounded hover:bg-brand-secondary text-sm">Save</button>
                        </div>
                    </div>
                </form>
                <style>{`
                    .form-input { display: block; width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; background-color: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 0.375rem; }
                    .dark .form-input { color: #D1D5DB; background-color: #374151; border-color: #4B5563; }
                `}</style>
            </div>
        </div>
    );
};

export default QuestionEditorModal;
