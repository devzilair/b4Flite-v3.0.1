
import React, { useState, useEffect, useMemo } from 'react';
import { Exam, Question } from '../../types';
import { sanitizeString } from '../../utils/sanitization';
import { usePermissions } from '../../hooks/usePermissions';
import { useStaff } from '../../hooks/useStaff';
import QuestionPickerModal from '../exam/QuestionPickerModal';
import useLocalStorage from '../../hooks/useLocalStorage';

interface ExamEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (exam: Exam) => void;
    existingExam: Exam | null;
    questions: Question[];
    addQuestion: (q: Question) => Promise<void>;
    updateQuestion: (q: Question) => Promise<void>;
}

const ExamEditorModal: React.FC<ExamEditorModalProps> = ({ isOpen, onClose, onSave, existingExam, questions, addQuestion, updateQuestion }) => {
    const [exam, setExam] = useLocalStorage<Partial<Exam>>('draft_exam_editor', {});
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [assignmentType, setAssignmentType] = useState<'all_in_department' | 'specific'>('all_in_department');
    const [selectionMode, setSelectionMode] = useState<'manual' | 'blueprint'>('manual');
    const [validationError, setValidationError] = useState<string | null>(null);

    const { currentUser, can } = usePermissions();
    const { departments, staff } = useStaff();
    const canManageGlobal = can('exams:manage');

    useEffect(() => {
        if (existingExam) {
            setExam(existingExam);
            if (Array.isArray(existingExam.assignedTo)) {
                setAssignmentType('specific');
            } else {
                setAssignmentType('all_in_department');
            }
            if (existingExam.categoryRules && Object.keys(existingExam.categoryRules).length > 0) {
                setSelectionMode('blueprint');
            } else {
                setSelectionMode('manual');
            }
        } else {
            if (exam.id || exam.title === undefined) {
                setExam({
                    title: '',
                    questionIds: [],
                    categoryRules: {},
                    timeLimitMinutes: 30,
                    passMarkPercentage: 80,
                    departmentId: canManageGlobal ? '' : currentUser?.departmentId,
                    randomizeQuestions: false,
                    questionsPerExam: 0,
                    validityMonths: 12,
                    showReview: true,
                    timeLimitPerQuestion: 0,
                    coolDownMinutes: 0,
                    referenceMaterialUrl: '',
                    assignedTo: 'all_in_department',
                    status: 'active',
                    dueDate: '',
                });
                setAssignmentType('all_in_department');
                setSelectionMode('manual');
            }
        }
        setValidationError(null);
    }, [existingExam, isOpen, canManageGlobal, currentUser]);

    const filteredStaff = useMemo(() => {
        let staffList = staff;
        if (exam.departmentId) {
            staffList = staff.filter(s => s.departmentId === exam.departmentId);
        }
        return staffList.filter(s => s.roleId !== 'role_admin' && s.roleId !== 'role_super_admin')
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [staff, exam.departmentId]);

    const availableCategories = useMemo(() => {
        const cats = new Set<string>();
        // Filter questions by department if selected
        const targetQuestions = exam.departmentId ? questions.filter(q => q.departmentId === exam.departmentId) : questions;
        targetQuestions.forEach(q => {
            if (q.category) cats.add(q.category);
            else cats.add('Uncategorized');
        });
        return Array.from(cats).sort();
    }, [questions, exam.departmentId]);

    const questionsByCategoryCount = useMemo(() => {
        const counts: Record<string, number> = {};
        // Filter questions by department if selected
        const targetQuestions = exam.departmentId ? questions.filter(q => q.departmentId === exam.departmentId) : questions;
        targetQuestions.forEach(q => {
            const cat = q.category || 'Uncategorized';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return counts;
    }, [questions, exam.departmentId]);

    if (!isOpen) return null;

    const applyTemplate = (type: 'safety' | 'deep' | 'standard') => {
        const base = { ...exam };
        if (type === 'safety') {
            base.title = "Monthly Safety Refresher";
            base.timeLimitMinutes = 15;
            base.passMarkPercentage = 80;
            base.randomizeQuestions = true;
            base.questionsPerExam = 10;
            setSelectionMode('blueprint');
            const deptCats: string[] = Array.from(new Set(questions.filter(q => q.departmentId === exam.departmentId).map(q => q.category || 'Uncategorized')));
            const rules: Record<string, number> = {};
            deptCats.forEach(c => rules[c] = 2);
            base.categoryRules = rules;
        } else if (type === 'deep') {
            base.title = "Comprehensive Proficiency Check";
            base.timeLimitMinutes = 60;
            base.passMarkPercentage = 90;
            base.randomizeQuestions = true;
            setSelectionMode('blueprint');
            const rules: Record<string, number> = {};
            availableCategories.forEach(c => rules[c] = 5);
            base.categoryRules = rules;
            base.questionsPerExam = Object.values(rules).reduce((a, b) => a + b, 0);
        } else {
            base.title = "General Knowledge Quiz";
            base.timeLimitMinutes = 30;
            base.passMarkPercentage = 75;
            setSelectionMode('manual');
            base.categoryRules = {};
        }
        setExam(base);
    };

    const handleRuleChange = (category: string, count: number) => {
        setExam(prev => {
            const rules = { ...(prev.categoryRules || {}) };
            if (count <= 0) delete rules[category];
            else rules[category] = count;

            const total = Object.values(rules).reduce((a, b) => a + b, 0);
            // Only auto-sync questionsPerExam if it was tracking the old total
            const prevTotal = Object.values(prev.categoryRules || {}).reduce((a, b) => a + b, 0);
            const shouldAutoUpdate = !prev.questionsPerExam || prev.questionsPerExam === prevTotal;
            return { ...prev, categoryRules: rules, questionsPerExam: shouldAutoUpdate ? total : prev.questionsPerExam, randomizeQuestions: total > 0 };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);

        if (!exam.title || exam.title.trim().length < 3) {
            setValidationError("Title is required (min 3 characters).");
            return;
        }

        if (selectionMode === 'manual') {
            if (!exam.questionIds || exam.questionIds.length === 0) {
                setValidationError("Manual Mode: You must select at least one question from the pool.");
                return;
            }
        } else if (selectionMode === 'blueprint') {
            if (!exam.categoryRules || Object.keys(exam.categoryRules).length === 0 || (exam.questionsPerExam || 0) <= 0) {
                setValidationError("Blueprint Mode: You must define category rules resulting in at least 1 question.");
                return;
            }
        }

        const examToSave: Exam = {
            id: existingExam?.id || `exam_${Date.now()}`,
            title: sanitizeString(exam.title) || 'Untitled Exam',
            questionIds: selectionMode === 'manual' ? (exam.questionIds || []) : [],
            categoryRules: selectionMode === 'blueprint' ? (exam.categoryRules || {}) : {},
            timeLimitMinutes: exam.timeLimitMinutes || 30,
            passMarkPercentage: exam.passMarkPercentage || 80,
            assignedAircraftType: exam.assignedAircraftType,
            departmentId: exam.departmentId === '' ? undefined : exam.departmentId,
            randomizeQuestions: exam.randomizeQuestions || false,
            questionsPerExam: exam.questionsPerExam || 0,
            validityMonths: exam.validityMonths || 12,
            showReview: exam.showReview !== false,
            timeLimitPerQuestion: exam.timeLimitPerQuestion || 0,
            coolDownMinutes: exam.coolDownMinutes || 0,
            referenceMaterialUrl: sanitizeString(exam.referenceMaterialUrl),
            assignedTo: assignmentType === 'all_in_department' ? 'all_in_department' : (exam.assignedTo as string[] || []),
            status: exam.status || 'active',
            dueDate: exam.dueDate || undefined,
        };

        onSave(examToSave);
        if (!existingExam) setExam({});
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let val: any = value;
        if (type === 'number') val = parseInt(value, 10) || 0;
        else if (type === 'checkbox') val = (e.target as HTMLInputElement).checked;
        setExam(prev => ({ ...prev, [name]: val }));
    };

    const handleStaffAssignmentChange = (staffId: string, isChecked: boolean) => {
        setExam(prev => {
            const currentAssigned = Array.isArray(prev.assignedTo) ? prev.assignedTo : [];
            return { ...prev, assignedTo: isChecked ? [...currentAssigned, staffId] : currentAssigned.filter(id => id !== staffId) };
        });
    };

    const handleQuestionSelectionSave = (selectedIds: string[]) => {
        setExam(prev => ({ ...prev, questionIds: selectedIds }));
        setIsPickerOpen(false);
    };

    const examQuestions = useMemo(() =>
        questions.filter(q => exam.questionIds?.includes(q.id)),
        [questions, exam.questionIds]
    );

    // Computed blueprint values
    const blueprintTotal = Object.values(exam.categoryRules || {}).reduce((a: number, b: number) => a + b, 0);
    const blueprintCap = exam.questionsPerExam || 0;

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center sm:p-4">
                <div className="bg-white dark:bg-gray-800 sm:rounded-lg shadow-2xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                        <div>
                            <h2 className="text-2xl font-bold">{existingExam ? 'Edit Exam' : 'Create New Exam'}</h2>
                            <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-1">Design Studio</p>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl">&times;</button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-6">

                        {validationError && (
                            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md shadow-sm">
                                <strong className="font-bold block mb-1">Validation Error</strong>
                                {validationError}
                            </div>
                        )}

                        {/* MAGIC TEMPLATES */}
                        {!existingExam && (
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Magic Templates</label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => applyTemplate('safety')} className="flex-1 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg text-left hover:shadow-md transition-all">
                                        <span className="block font-bold text-yellow-800 dark:text-yellow-200 text-sm">Refresher</span>
                                        <span className="text-[10px] text-yellow-600">10 random questions from my dept.</span>
                                    </button>
                                    <button type="button" onClick={() => applyTemplate('deep')} className="flex-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg text-left hover:shadow-md transition-all">
                                        <span className="block font-bold text-blue-800 dark:text-blue-200 text-sm">Deep Dive</span>
                                        <span className="text-[10px] text-blue-600">5 questions from EVERY category.</span>
                                    </button>
                                    <button type="button" onClick={() => applyTemplate('standard')} className="flex-1 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-3 rounded-lg text-left hover:shadow-md transition-all">
                                        <span className="block font-bold text-gray-800 dark:text-gray-200 text-sm">Standard</span>
                                        <span className="text-[10px] text-gray-500">Reset to default settings.</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Title</label>
                                <input type="text" name="title" value={exam.title || ''} onChange={handleInputChange} required className="mt-1 form-input" />
                            </div>
                            {canManageGlobal && (
                                <div>
                                    <label className="block text-sm font-medium">Department</label>
                                    <select name="departmentId" value={exam.departmentId || ''} onChange={handleInputChange} className="mt-1 form-input">
                                        <option value="">Global (All Departments)</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* SELECTION MODE TOGGLE */}
                        <div className="bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg flex items-center mb-4">
                            <button
                                type="button"
                                onClick={() => setSelectionMode('manual')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${selectionMode === 'manual' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500'}`}
                            >
                                Manual Question List
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectionMode('blueprint')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${selectionMode === 'blueprint' ? 'bg-brand-primary text-white shadow' : 'text-gray-500'}`}
                            >
                                Smart Category Blueprint
                            </button>
                        </div>

                        {selectionMode === 'blueprint' ? (
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800 space-y-4">
                                <div>
                                    <h3 className="font-bold text-sm text-blue-800 dark:text-blue-300 uppercase tracking-widest">Blueprint Rules</h3>
                                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Set how many questions to draw per category. Each session picks a fresh random subset.</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {availableCategories.map(cat => (
                                        <div key={cat} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2.5 rounded-lg border dark:border-gray-700 shadow-sm">
                                            <div className="flex flex-col pr-2 min-w-0">
                                                <span className="text-sm font-medium truncate">{cat}</span>
                                                <span className="text-[10px] text-gray-400">{questionsByCategoryCount[cat]} available</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={questionsByCategoryCount[cat]}
                                                    value={exam.categoryRules?.[cat] || ''}
                                                    onChange={e => handleRuleChange(cat, parseInt(e.target.value) || 0)}
                                                    className="w-14 p-1 border rounded text-center text-sm focus:ring-1 focus:ring-brand-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                    placeholder="0"
                                                />
                                                <span className="text-xs text-gray-400 w-8 text-right">/{questionsByCategoryCount[cat]}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Draw Count Summary Card */}
                                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-gray-700 shadow-sm">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                                        <div className="flex-1 w-full">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <label className="block text-xs font-black uppercase text-blue-700 dark:text-blue-300 tracking-widest">
                                                    Questions to Ask Per Session
                                                </label>
                                                <div className="group relative">
                                                    <svg className="w-3.5 h-3.5 text-blue-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" /></svg>
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-tight">
                                                        If set lower than the pool size, the system will randomly pick this many questions from your defined blueprint each time a staff member starts the exam.
                                                    </div>
                                                </div>
                                            </div>
                                            <input
                                                type="number"
                                                min="1"
                                                max={blueprintTotal || undefined}
                                                value={blueprintCap || ''}
                                                onChange={e => setExam(prev => ({ ...prev, questionsPerExam: parseInt(e.target.value) || 0 }))}
                                                className="w-full p-2.5 bg-blue-50/50 dark:bg-gray-900 border border-blue-100 dark:border-gray-600 rounded-lg text-sm focus:ring-1 focus:ring-brand-primary outline-none font-bold text-blue-800 dark:text-blue-300 transition-all focus:bg-white"
                                                placeholder={`${blueprintTotal} (Ask all)`}
                                            />

                                            {/* Blueprint Coverage Visualization */}
                                            {blueprintTotal > 0 && (
                                                <div className="mt-4">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Blueprint Distribution</span>
                                                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{blueprintTotal} Total Pool</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full flex overflow-hidden">
                                                        {Object.entries(exam.categoryRules || {}).map(([cat, count], idx) => {
                                                            const percent = (count / blueprintTotal) * 100;
                                                            const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500'];
                                                            return (
                                                                <div
                                                                    key={cat}
                                                                    className={`${colors[idx % colors.length]} h-full transition-all duration-500`}
                                                                    style={{ width: `${percent}%` }}
                                                                    title={`${cat}: ${count} questions`}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="mt-1.5 flex flex-wrap gap-2">
                                                        {Object.entries(exam.categoryRules || {}).map(([cat, count], idx) => (
                                                            <div key={cat} className="flex items-center gap-1">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${['bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500'][idx % 5]}`} />
                                                                <span className="text-[9px] text-gray-500 font-medium">{cat} ({count})</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1.5">
                                                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" /></svg>
                                                {blueprintCap > 0 && blueprintCap < blueprintTotal
                                                    ? `Session will draw ${blueprintCap} unique questions from the ${blueprintTotal} in current pool.`
                                                    : `Session will include all ${blueprintTotal} questions from the pool.`
                                                }
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-center justify-center p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl min-w-[100px] border border-blue-100 dark:border-blue-800/50 self-stretch">
                                            <span className="text-[9px] text-blue-600 dark:text-blue-400 uppercase font-black tracking-tighter mb-1">Total Pool</span>
                                            <span className={`text-3xl font-black leading-none ${blueprintTotal > 0 ? 'text-blue-600 dark:text-blue-300' : 'text-red-500'}`}>{blueprintTotal}</span>
                                            {blueprintCap > 0 && blueprintCap < blueprintTotal && (
                                                <div className="mt-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm">
                                                    🎲 Draw {blueprintCap}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="border dark:border-gray-600 rounded-lg p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold uppercase text-gray-400">Fixed Pool ({examQuestions.length})</h3>
                                    <button type="button" onClick={() => setIsPickerOpen(true)} className="text-xs font-bold text-brand-primary hover:underline">
                                        Select Questions Manually
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {examQuestions.map(q => (
                                        <div key={q.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs border dark:border-gray-600">
                                            <span className="truncate flex-1">{q.text}</span>
                                            {q.category && <span className="ml-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded-full text-[10px] uppercase font-bold text-gray-500">{q.category}</span>}
                                        </div>
                                    ))}
                                    {examQuestions.length === 0 && <p className="text-xs text-red-500 font-bold text-center py-4">No questions selected. Please add questions.</p>}
                                </div>
                            </div>
                        )}

                        {/* Assignment Logic */}
                        <div className="p-4 border dark:border-gray-600 rounded-lg">
                            <h3 className="text-sm font-bold mb-3 border-b dark:border-gray-600 pb-1">Assignment Scope</h3>
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 mb-2">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        name="assignmentType"
                                        value="all_in_department"
                                        checked={assignmentType === 'all_in_department'}
                                        onChange={() => { setAssignmentType('all_in_department'); setExam(prev => ({ ...prev, assignedTo: 'all_in_department' })); }}
                                        className="text-brand-primary focus:ring-brand-primary"
                                    />
                                    <span className="ml-2 text-sm">All in Department</span>
                                </label>
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        name="assignmentType"
                                        value="specific"
                                        checked={assignmentType === 'specific'}
                                        onChange={() => { setAssignmentType('specific'); setExam(prev => ({ ...prev, assignedTo: [] })); }}
                                        className="text-brand-primary focus:ring-brand-primary"
                                    />
                                    <span className="ml-2 text-sm">Specific Staff</span>
                                </label>
                            </div>
                            {assignmentType === 'specific' && (
                                <div className="p-3 border dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 max-h-48 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {filteredStaff.map(s => (
                                        <label key={s.id} className="flex items-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 p-1 rounded">
                                            <input
                                                type="checkbox"
                                                checked={Array.isArray(exam.assignedTo) && exam.assignedTo.includes(s.id)}
                                                onChange={(e) => handleStaffAssignmentChange(s.id, e.target.checked)}
                                                className="form-checkbox text-brand-primary rounded focus:ring-brand-primary"
                                            />
                                            <span className="ml-2 text-xs truncate">{s.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Standard Controls */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-3">
                                <h3 className="font-semibold text-sm mb-3 text-brand-primary border-b dark:border-gray-600 pb-1">Pass Criteria &amp; Timing</h3>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Time Limit (mins)</label>
                                <input type="number" name="timeLimitMinutes" value={exam.timeLimitMinutes || ''} onChange={handleInputChange} required className="w-full form-input" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Pass Mark (%)</label>
                                <input type="number" name="passMarkPercentage" value={exam.passMarkPercentage || ''} onChange={handleInputChange} required className="w-full form-input" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Validity (Months)</label>
                                <input type="number" name="validityMonths" value={exam.validityMonths || ''} onChange={handleInputChange} className="w-full form-input" />
                            </div>
                            {selectionMode === 'manual' && (
                                <div className="sm:col-span-1">
                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Max Question Draw</label>
                                    <input type="number" name="questionsPerExam" value={exam.questionsPerExam || ''} onChange={handleInputChange} className="w-full form-input" />
                                    <p className="text-[10px] text-gray-400 mt-1">How many to ask from pool.</p>
                                </div>
                            )}
                            <div className={selectionMode === 'manual' ? 'sm:col-span-2' : 'sm:col-span-3'}>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Status</label>
                                <select name="status" value={exam.status || 'active'} onChange={handleInputChange} className="form-input">
                                    <option value="active">Active (Visible)</option>
                                    <option value="draft">Draft (Hidden)</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        </div>

                    </form>

                    <style>{`
                        .form-input { display: block; width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; background-color: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 0.375rem; }
                        .dark .form-input { color: #D1D5DB; background-color: #374151; border-color: #4B5563; }
                        .form-checkbox { height: 1rem; width: 1rem; color: #0D47A1; border-radius: 0.25rem; border-color: #9CA3AF; }
                    `}</style>

                    <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 sm:rounded-b-lg flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 py-2 px-4 rounded-md">Cancel</button>
                        <button type="submit" onClick={handleSubmit} className="bg-brand-primary text-white py-2 px-8 rounded-md font-bold shadow-lg transform active:scale-95 transition-all">Save Exam</button>
                    </div>
                </div>
            </div>
            {isPickerOpen && (
                <QuestionPickerModal
                    onClose={() => setIsPickerOpen(false)}
                    onSave={handleQuestionSelectionSave}
                    allQuestions={questions}
                    initialSelectedIds={exam.questionIds || []}
                    departmentScopeId={exam.departmentId}
                />
            )}
        </>
    );
};

export default ExamEditorModal;
