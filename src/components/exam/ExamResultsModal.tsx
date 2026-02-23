
import React, { useMemo, useState } from 'react';
import { Exam, ExamAttempt, Staff } from '../../types';
import { useTraining } from '../../hooks/useTraining';
import ExamResultDetail from './ExamResultDetail';

interface ExamResultsModalProps {
    isOpen: boolean;
    onClose: () => void;
    exam: Exam;
    attempts: ExamAttempt[];
    allStaff: Staff[];
    currentUser: Staff | null;
    canManageGlobal: boolean;
}

const ExamResultsModal: React.FC<ExamResultsModalProps> = ({ isOpen, onClose, exam, attempts, allStaff, currentUser, canManageGlobal }) => {
    const { questions } = useTraining();
    const [selectedAttempt, setSelectedAttempt] = useState<ExamAttempt | null>(null);

    if (!isOpen) return null;

    const filteredAttempts = useMemo(() => {
        return attempts
            .filter(attempt => {
                const staffMember = allStaff.find(s => s.id === attempt.staffId);
                if (!staffMember) return false;

                // Global managers see all
                if (canManageGlobal) return true;
                
                // Department managers see their department
                if (currentUser && staffMember.departmentId === currentUser.departmentId) return true;

                return false;
            })
            .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    }, [attempts, allStaff, canManageGlobal, currentUser]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-y-auto print:shadow-none print:w-full print:max-w-none print:max-h-none print:h-full print:p-0 print:border-none print:rounded-none dark:print:bg-white dark:print:text-black" onClick={e => e.stopPropagation()}>
                
                {selectedAttempt ? (
                    <ExamResultDetail 
                        exam={exam}
                        attempt={selectedAttempt}
                        questions={questions}
                        staffName={allStaff.find(s => s.id === selectedAttempt.staffId)?.name || 'Unknown'}
                        onBack={() => setSelectedAttempt(null)}
                        backLabel="Back to Results List"
                    />
                ) : (
                    <>
                        <div className="flex justify-between items-center mb-6 flex-shrink-0">
                            <h2 className="text-2xl font-bold">Results for "{exam.title}"</h2>
                            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl">&times;</button>
                        </div>
                        
                        <div className="flex-grow overflow-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                                    <tr>
                                        <th className="p-3">Staff Name</th>
                                        <th className="p-3">Department</th>
                                        <th className="p-3">Date (Attempted)</th>
                                        <th className="p-3">Score</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAttempts.map(attempt => {
                                        const staffMember = allStaff.find(s => s.id === attempt.staffId);
                                        return (
                                            <tr key={`${attempt.examId}-${attempt.staffId}-${attempt.completedAt}`} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="p-3 font-medium">{staffMember?.name || 'Unknown'}</td>
                                                <td className="p-3 text-gray-500">{staffMember?.departmentId}</td>
                                                <td className="p-3">{new Date(attempt.completedAt).toLocaleDateString()} {new Date(attempt.completedAt).toLocaleTimeString()}</td>
                                                <td className="p-3 font-bold">{attempt.score}%</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${
                                                        attempt.status === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {attempt.status}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <button 
                                                        onClick={() => setSelectedAttempt(attempt)}
                                                        className="text-brand-primary hover:underline text-xs font-medium bg-brand-light/20 px-2 py-1 rounded border border-brand-primary/20"
                                                    >
                                                        View Slip
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredAttempts.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-gray-500">No results found for your permission scope.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="mt-6 flex justify-end pt-4 border-t dark:border-gray-700 flex-shrink-0">
                            <button onClick={onClose} className="bg-gray-200 dark:bg-gray-600 px-4 py-2 rounded hover:bg-gray-300 transition-colors">Close</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ExamResultsModal;
