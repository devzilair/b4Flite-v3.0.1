
import React, { useState, useMemo } from 'react';
import { Question } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import QuestionEditorModal from '../QuestionEditorModal';
import BulkQuestionModal from './BulkQuestionModal';
import AiQuestionGeneratorModal from './AiQuestionGeneratorModal';
import useLocalStorage from '../../hooks/useLocalStorage';
import { useTraining } from '../../hooks/useTraining';
import { useStaff } from '../../hooks/useStaff';

const QuestionBank: React.FC = () => {
    const { departments } = useStaff();
    const { questions, addQuestion, updateQuestion, deleteQuestion, addBulkQuestions } = useTraining();
    const { currentUser, can } = usePermissions();

    // Persist modal state and the question being edited so reloads don't lose context
    const [isModalOpen, setIsModalOpen] = useLocalStorage<boolean>('qbank_modal_open', false);
    const [editingQuestion, setEditingQuestion] = useLocalStorage<Question | null>('qbank_editing_question', null);
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [isAiOpen, setIsAiOpen] = useState(false);
    
    // Persist filter
    const [departmentFilter, setDepartmentFilter] = useLocalStorage<string>('qbank_dept_filter', 'all');
    
    const canManageGlobal = can('exams:manage');

    const filteredQuestions = useMemo(() => {
        return questions.filter(q => {
            if (canManageGlobal) {
                if (departmentFilter === 'all') return true;
                if (departmentFilter === 'global') return !q.departmentId;
                return q.departmentId === departmentFilter;
            }
            // For managers, show their department's questions and global questions
            return !q.departmentId || q.departmentId === currentUser?.departmentId;
        });
    }, [questions, canManageGlobal, departmentFilter, currentUser]);

    // Group questions by category
    const groupedQuestions = useMemo(() => {
        const groups: Record<string, Question[]> = {};
        filteredQuestions.forEach(q => {
            const category = q.category && q.category.trim() !== '' ? q.category : 'Uncategorized';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(q);
        });
        // Sort questions inside groups by text for consistency
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => a.text.localeCompare(b.text));
        });
        return groups;
    }, [filteredQuestions]);

    const sortedCategories = useMemo(() => {
        return Object.keys(groupedQuestions).sort((a, b) => {
            if (a === 'Uncategorized') return 1;
            if (b === 'Uncategorized') return -1;
            return a.localeCompare(b);
        });
    }, [groupedQuestions]);

    // Calculate dynamic categories from existing questions for the editor dropdown
    const existingCategories = useMemo(() => {
        const categories = new Set(
            questions
                .map(q => q.category)
                .filter(Boolean) as string[]
        );
        return Array.from(categories).sort();
    }, [questions]);

    const handleSaveQuestion = async (q: Question, keepOpen: boolean = false) => {
        // Assign departmentId if user is not a global manager
        const questionToSave = { ...q };
        
        // Critical Fix: Only assign current user's department if creating a NEW question or CLONE.
        // If editing an existing question, preserve its original ownership.
        const isNewEntry = !editingQuestion || editingQuestion.id.startsWith('clone_');
        
        if (isNewEntry) {
             if (!canManageGlobal && !questionToSave.departmentId) {
                questionToSave.departmentId = currentUser?.departmentId;
            }
        }

        if (editingQuestion && !editingQuestion.id.startsWith('clone_')) {
            await updateQuestion(questionToSave);
        } else {
            // If it's a clone or new, treat it as a new question. 
            // NOTE: Do not strip the ID, as the database expects a client-provided text ID.
            await addQuestion(questionToSave);
        }
        
        if (!keepOpen) {
            setIsModalOpen(false);
            setEditingQuestion(null);
        } else {
            setEditingQuestion(null); 
        }
    };

    const handleDuplicate = (q: Question) => {
        const clone = { 
            ...q, 
            id: `clone_${Date.now()}`,
            text: `(Copy) ${q.text}` 
        };
        setEditingQuestion(clone);
        setIsModalOpen(true);
    };

    const handleBulkImport = async (qs: Question[]) => {
        if (qs.length === 0) return;
        try {
            await addBulkQuestions(qs);
            alert(`Successfully imported ${qs.length} questions.`);
        } catch (e: any) {
            alert("Bulk import failed: " + e.message);
        }
    };

    const handleDeleteQuestion = (id: string) => {
        if (window.confirm('Are you sure you want to delete this question? It will be removed from all exams that use it.')) {
            deleteQuestion(id);
        }
    };
    
    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {canManageGlobal && (
                        <select
                            value={departmentFilter}
                            onChange={e => setDepartmentFilter(e.target.value)}
                            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                        >
                            <option value="all">All Banks</option>
                            <option value="global">Global Only</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    )}
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                     <button
                        onClick={() => setIsAiOpen(true)}
                        className="flex-1 md:flex-none bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 px-4 rounded-md hover:from-indigo-700 hover:to-purple-700 text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                        <span>✨</span>
                        Generate with AI
                    </button>
                    <button
                        onClick={() => setIsBulkOpen(true)}
                        className="flex-1 md:flex-none bg-gray-600 text-white py-2 px-6 rounded-md hover:bg-gray-700 text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Bulk Import
                    </button>
                    <button
                        onClick={() => { setEditingQuestion(null); setIsModalOpen(true); }}
                        className="flex-1 md:flex-none bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-secondary text-xs font-bold uppercase tracking-wider shadow-md transition-all active:scale-95"
                    >
                        + New Question
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 dark:bg-gray-700 text-xs uppercase sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-3">Question Text</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Department</th>
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedCategories.map(category => (
                            <React.Fragment key={category}>
                                {/* Category Header */}
                                <tr className="bg-gray-50 dark:bg-gray-800">
                                    <td colSpan={4} className="p-2 pl-4 border-b dark:border-gray-600">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-brand-primary dark:text-brand-light uppercase tracking-widest text-[10px]">{category}</span>
                                            <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full font-bold">
                                                {groupedQuestions[category].length}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                {/* Questions in Category */}
                                {groupedQuestions[category].map(q => {
                                    // Permission Logic: Can edit only if Global Admin OR (Dept Admin AND question belongs to Dept)
                                    const canEdit = canManageGlobal || (q.departmentId && q.departmentId === currentUser?.departmentId);

                                    return (
                                        <tr key={q.id} className="border-b dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="p-3 font-medium max-w-lg">
                                                <div className="flex items-center gap-2">
                                                    {q.imageUrl && <span title="Has diagram" className="text-lg">🖼️</span>}
                                                    <span className="truncate" title={q.text}>{q.text}</span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-sm uppercase">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${q.type === 'mcq' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                                    {q.type.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="p-3 text-sm">{departments.find(d => d.id === q.departmentId)?.name || 'Global'}</td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end items-center gap-4">
                                                    <button onClick={() => handleDuplicate(q)} className="text-gray-400 hover:text-brand-primary transition-colors" title="Duplicate / Variations">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                                    </button>
                                                    {canEdit ? (
                                                        <>
                                                            <button onClick={() => { setEditingQuestion(q); setIsModalOpen(true); }} className="text-brand-primary hover:text-brand-secondary transition-colors" title="Edit">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                            </button>
                                                            <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-400 hover:text-red-700 transition-colors" title="Delete">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">Locked</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
                {filteredQuestions.length === 0 && <p className="text-center py-12 text-gray-400 italic">No questions found in this scope.</p>}
            </div>

            {isModalOpen && (
                <QuestionEditorModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditingQuestion(null);
                    }}
                    onSave={handleSaveQuestion}
                    existingQuestion={editingQuestion}
                    existingCategories={existingCategories}
                />
            )}

            {isBulkOpen && (
                <BulkQuestionModal 
                    isOpen={isBulkOpen}
                    onClose={() => setIsBulkOpen(false)}
                    onImport={handleBulkImport}
                    departmentId={canManageGlobal ? undefined : currentUser?.departmentId}
                    existingCategories={existingCategories}
                />
            )}

            {isAiOpen && (
                <AiQuestionGeneratorModal
                    isOpen={isAiOpen}
                    onClose={() => setIsAiOpen(false)}
                    onImport={handleBulkImport}
                    departmentId={canManageGlobal ? undefined : currentUser?.departmentId}
                />
            )}
        </div>
    );
};

export default QuestionBank;
