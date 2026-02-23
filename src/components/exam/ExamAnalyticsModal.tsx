
import React, { useMemo } from 'react';
import { Exam, ExamAttempt, Question } from '../../types';

interface ExamAnalyticsModalProps {
    isOpen: boolean;
    onClose: () => void;
    exam: Exam;
    attempts: ExamAttempt[];
    questions: Question[];
}

interface QuestionStat {
    questionId: string;
    text: string;
    category: string;
    totalAttempts: number;
    correctCount: number;
    incorrectCount: number;
    successRate: number;
}

const ExamAnalyticsModal: React.FC<ExamAnalyticsModalProps> = ({ isOpen, onClose, exam, attempts, questions }) => {
    if (!isOpen) return null;

    const stats = useMemo(() => {
        const questionMap: Record<string, QuestionStat> = {};

        // Initialize map for all questions in the exam
        const examQuestions = questions.filter(q => exam.questionIds.includes(q.id));
        examQuestions.forEach(q => {
            questionMap[q.id] = {
                questionId: q.id,
                text: q.text,
                category: q.category || 'General',
                totalAttempts: 0,
                correctCount: 0,
                incorrectCount: 0,
                successRate: 0
            };
        });

        // Aggregate data from all attempts
        attempts.forEach(attempt => {
            Object.entries(attempt.answers).forEach(([qId, answer]) => {
                if (questionMap[qId]) {
                    const q = examQuestions.find(eq => eq.id === qId);
                    if (!q) return;

                    questionMap[qId].totalAttempts++;
                    if (answer === q.correctAnswer) {
                        questionMap[qId].correctCount++;
                    } else {
                        questionMap[qId].incorrectCount++;
                    }
                }
            });
        });

        // Calculate rates and sort
        return Object.values(questionMap)
            .map(s => ({
                ...s,
                successRate: s.totalAttempts > 0 ? (s.correctCount / s.totalAttempts) * 100 : 0
            }))
            .sort((a, b) => a.successRate - b.successRate); // Hardest questions (lowest success rate) first

    }, [exam, attempts, questions]);

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 rounded-t-lg">
                    <div>
                        <h2 className="text-xl font-bold">Exam Performance Analytics</h2>
                        <p className="text-sm text-gray-500">Aggregated from {attempts.length} total attempts</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                <div className="flex-grow overflow-y-auto p-6">
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                        <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-1">Knowledge Gap Indicator</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-200">
                            Questions are ranked below from **lowest to highest success rate**. High failure rates (Red) may indicate poorly worded questions or a need for targeted training on that specific topic.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {stats.map((s, idx) => (
                            <div key={s.questionId} className="p-4 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center">
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-400">
                                    #{idx + 1}
                                </div>
                                
                                <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                                            {s.category}
                                        </span>
                                        {s.successRate < 50 && s.totalAttempts > 2 && (
                                            <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-red-600 animate-pulse">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                Critical Gap
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-medium text-gray-800 dark:text-gray-100 truncate" title={s.text}>{s.text}</h4>
                                </div>

                                <div className="flex-shrink-0 w-full md:w-48">
                                    <div className="flex justify-between text-xs mb-1 font-semibold">
                                        <span className={s.successRate < 60 ? 'text-red-600' : 'text-green-600'}>
                                            {Math.round(s.successRate)}% Success
                                        </span>
                                        <span className="text-gray-400">{s.correctCount}/{s.totalAttempts}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${s.successRate < 50 ? 'bg-red-500' : s.successRate < 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                            style={{ width: `${s.successRate}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

                        {stats.length === 0 && (
                            <div className="text-center py-12 text-gray-500 italic">
                                No questions have been answered for this exam yet.
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t dark:border-gray-700 flex justify-end bg-gray-50 dark:bg-gray-700/30 rounded-b-lg">
                    <button onClick={onClose} className="px-6 py-2 bg-brand-primary text-white rounded font-bold hover:bg-brand-secondary transition-colors">Close Report</button>
                </div>
            </div>
        </div>
    );
};

export default ExamAnalyticsModal;
