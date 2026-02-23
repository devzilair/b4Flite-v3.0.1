
import React, { useState, useMemo } from 'react';
import { Question } from '../../types';

interface QuestionPickerModalProps {
    onClose: () => void;
    onSave: (selectedIds: string[]) => void;
    allQuestions: Question[];
    initialSelectedIds: string[];
    departmentScopeId?: string;
}

const QuestionPickerModal: React.FC<QuestionPickerModalProps> = ({ onClose, onSave, allQuestions, initialSelectedIds, departmentScopeId }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
    const [searchTerm, setSearchTerm] = useState('');

    const availableQuestions = useMemo(() => {
        return allQuestions.filter(q => {
            // Include global questions and questions from the same department as the exam
            const departmentMatch = !q.departmentId || q.departmentId === departmentScopeId;
            const searchMatch = q.text.toLowerCase().includes(searchTerm.toLowerCase());
            return departmentMatch && searchMatch;
        });
    }, [allQuestions, departmentScopeId, searchTerm]);

    // Group questions by category
    const groupedQuestions = useMemo(() => {
        const groups: Record<string, Question[]> = {};
        availableQuestions.forEach(q => {
            const category = q.category && q.category.trim() !== '' ? q.category : 'Uncategorized';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(q);
        });
        return groups;
    }, [availableQuestions]);

    // Sort categories (Uncategorized last)
    const sortedCategories = useMemo(() => {
        return Object.keys(groupedQuestions).sort((a, b) => {
            if (a === 'Uncategorized') return 1;
            if (b === 'Uncategorized') return -1;
            return a.localeCompare(b);
        });
    }, [groupedQuestions]);

    const handleToggle = (questionId: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(questionId)) {
                newSet.delete(questionId);
            } else {
                newSet.add(questionId);
            }
            return newSet;
        });
    };

    const handleSave = () => {
        onSave(Array.from(selectedIds));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-2xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4 flex-shrink-0">Select Questions from Bank</h2>
                
                <div className="mb-4 flex-shrink-0">
                    <input
                        type="text"
                        placeholder="Search questions..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                    />
                </div>
                
                <div className="flex-grow overflow-y-auto border-y dark:border-gray-600 -mx-6 px-6 py-2">
                    {sortedCategories.map(category => (
                        <div key={category} className="mb-4">
                            <h3 className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold px-3 py-1.5 rounded text-sm mb-2 shadow-sm flex justify-between items-center border border-gray-200 dark:border-gray-600">
                                <span>{category}</span>
                                <span className="text-xs font-normal bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300">{groupedQuestions[category].length}</span>
                            </h3>
                            <div className="space-y-1 pl-2">
                                {groupedQuestions[category].map(q => (
                                    <label key={q.id} className="flex items-start p-2 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(q.id)}
                                            onChange={() => handleToggle(q.id)}
                                            className="mt-1 h-4 w-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary flex-shrink-0"
                                        />
                                        <span className="ml-3 text-sm text-gray-700 dark:text-gray-300 leading-snug">{q.text}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}

                    {availableQuestions.length === 0 && (
                        <p className="text-center text-gray-500 py-8">No questions available match your criteria.</p>
                    )}
                </div>

                <div className="flex justify-between items-center pt-4 mt-4 flex-shrink-0">
                     <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{selectedIds.size} question(s) selected.</p>
                     <div className="space-x-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white">Cancel</button>
                        <button type="button" onClick={handleSave} className="bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-secondary shadow-sm">Save Selection</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuestionPickerModal;
