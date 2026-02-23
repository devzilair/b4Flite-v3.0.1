
import React, { useMemo, useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { formatStaffName } from '../../utils/sanitization';
import { useTraining } from '../../hooks/useTraining';
import { useStaff } from '../../hooks/useStaff';

const TrainingReport: React.FC = () => {
    const { staff, loading: staffLoading } = useStaff();
    const { exams, examAttempts, loading: trainingLoading } = useTraining();
    const loading = staffLoading || trainingLoading;

    const { currentUser, can } = usePermissions();

    const [viewMode, setViewMode] = useState<'exams' | 'staff'>('exams');

    // Permission Scope
    const hasGlobalView = can('exams:manage');
    const hasManagerAccess = hasGlobalView || can('exams:manage:own_department');

    const stats = useMemo(() => {
        // Filter attempts based on scope
        const accessibleAttempts = examAttempts.filter(att => {
            const person = staff.find(s => s.id === att.staffId);
            if (!person) return false;
            
            // Scope Check
            if (!hasManagerAccess) {
                // RESTRICT TO SELF if not a manager
                return person.id === currentUser?.id;
            } else {
                 // Manager View: Dept Only (unless Global)
                 if (!hasGlobalView && currentUser && person.departmentId !== currentUser.departmentId) return false;
            }
            
            return true;
        });

        // Mode 1: Stats by Exam
        const examStats = exams.map(exam => {
            const attempts = accessibleAttempts.filter(a => a.examId === exam.id);
            const total = attempts.length;
            if (total === 0) return null;

            const passed = attempts.filter(a => a.status === 'passed').length;
            const avgScore = attempts.reduce((acc, curr) => acc + curr.score, 0) / total;
            
            return {
                id: exam.id,
                title: exam.title,
                totalAttempts: total,
                passRate: (passed / total) * 100,
                avgScore: Math.round(avgScore)
            };
        }).filter(Boolean).sort((a, b) => (a?.passRate || 0) - (b?.passRate || 0)); // Lowest pass rate first

        // Mode 2: Stats by Staff
        const staffStats = staff.filter(s => {
             if (s.accountStatus === 'disabled') return false;
             
             // Scope Check for Staff List
             if (!hasManagerAccess) {
                if (s.id !== currentUser?.id) return false;
             } else {
                 if (!hasGlobalView && currentUser && s.departmentId !== currentUser.departmentId) return false;
             }

             // Only include staff who have taken at least one exam
             return accessibleAttempts.some(a => a.staffId === s.id);
        }).map(person => {
            const myAttempts = accessibleAttempts.filter(a => a.staffId === person.id);
            const total = myAttempts.length;
            const avgScore = total > 0 ? myAttempts.reduce((acc, curr) => acc + curr.score, 0) / total : 0;
            const passed = myAttempts.filter(a => a.status === 'passed').length;

            return {
                id: person.id,
                name: person.name,
                totalExams: total,
                avgScore: Math.round(avgScore),
                failCount: total - passed
            };
        }).sort((a, b) => b.failCount - a.failCount); // Most fails first

        return { examStats, staffStats };
    }, [exams, examAttempts, staff, hasGlobalView, hasManagerAccess, currentUser]);

    if (loading) return <div>Loading...</div>;

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 print:hidden">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Training Performance Matrix</h2>
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        <button onClick={() => setViewMode('exams')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'exams' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500'}`}>By Exam</button>
                        <button onClick={() => setViewMode('staff')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'staff' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500'}`}>By Crew</button>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-grow flex flex-col">
                <div className="overflow-auto flex-grow">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 uppercase text-xs font-semibold sticky top-0">
                            <tr>
                                <th className="p-4">{viewMode === 'exams' ? 'Exam Title' : 'Staff Member'}</th>
                                <th className="p-4 text-center">{viewMode === 'exams' ? 'Attempts' : 'Exams Taken'}</th>
                                <th className="p-4 text-center">Avg. Score</th>
                                <th className="p-4 text-center">{viewMode === 'exams' ? 'Pass Rate' : 'Failures'}</th>
                                <th className="p-4 w-1/3">Performance Indicator</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {viewMode === 'exams' ? (
                                stats.examStats.map((item: any) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td className="p-4 font-bold text-gray-800 dark:text-white">{item.title}</td>
                                        <td className="p-4 text-center">{item.totalAttempts}</td>
                                        <td className="p-4 text-center font-mono">{item.avgScore}%</td>
                                        <td className={`p-4 text-center font-bold ${item.passRate < 70 ? 'text-red-600' : 'text-green-600'}`}>
                                            {Math.round(item.passRate)}%
                                        </td>
                                        <td className="p-4">
                                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
                                                <div 
                                                    className={`h-2.5 rounded-full ${item.passRate < 70 ? 'bg-red-500' : item.passRate < 90 ? 'bg-yellow-400' : 'bg-green-500'}`} 
                                                    style={{ width: `${item.passRate}%` }}
                                                ></div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                stats.staffStats.map((item: any) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td className="p-4 font-bold text-gray-800 dark:text-white">{formatStaffName(item.name)}</td>
                                        <td className="p-4 text-center">{item.totalExams}</td>
                                        <td className="p-4 text-center font-mono">{item.avgScore}%</td>
                                        <td className={`p-4 text-center font-bold ${item.failCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                            {item.failCount}
                                        </td>
                                        <td className="p-4">
                                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
                                                <div 
                                                    className={`h-2.5 rounded-full ${item.avgScore < 70 ? 'bg-red-500' : item.avgScore < 85 ? 'bg-yellow-400' : 'bg-green-500'}`} 
                                                    style={{ width: `${item.avgScore}%` }}
                                                ></div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            {((viewMode === 'exams' && stats.examStats.length === 0) || (viewMode === 'staff' && stats.staffStats.length === 0)) && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500 italic">
                                        No training data available.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TrainingReport;
