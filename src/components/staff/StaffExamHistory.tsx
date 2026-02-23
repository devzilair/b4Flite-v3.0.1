
import React, { useMemo, useState } from 'react';
import { Staff, ExamAttempt, Exam } from '../../types';
import ExamResultDetail from '../exam/ExamResultDetail';
import { useTraining } from '../../hooks/useTraining';

interface StaffExamHistoryProps {
    staff: Staff;
}

/**
 * Normalizes any date string (ISO or Date-only) to the last day of its month for display.
 */
const formatEndOfMonth = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    try {
        // Strip any time component to avoid parsing issues
        const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const d = new Date(cleanDateStr + 'T00:00:00Z');
        if (isNaN(d.getTime())) return dateStr;
        const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
        return lastDay.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
};

const StaffExamHistory: React.FC<StaffExamHistoryProps> = ({ staff }) => {
    const { exams, examAttempts, questions } = useTraining();
    const [viewingResult, setViewingResult] = useState<{ exam: Exam, attempt: ExamAttempt } | null>(null);

    // Group attempts by examId to analyze trends
    const transcriptData = useMemo(() => {
        const staffAttempts = examAttempts
            .filter(a => a.staffId === staff.id)
            .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

        const attemptsByExam: Record<string, ExamAttempt[]> = {};
        staffAttempts.forEach(att => {
            if (!attemptsByExam[att.examId]) attemptsByExam[att.examId] = [];
            attemptsByExam[att.examId].push(att);
        });

        const rows = Object.keys(attemptsByExam).map(examId => {
            const exam = exams.find(e => e.id === examId);
            const history = attemptsByExam[examId];
            const latest = history[0];
            
            // Calculate trend compared to previous ATTEMPT (regardless of pass/fail)
            const previous = history[1];
            let trend: 'up' | 'down' | 'same' | null = null;
            if (previous) {
                if (latest.score > previous.score) trend = 'up';
                else if (latest.score < previous.score) trend = 'down';
                else trend = 'same';
            }

            // Calculate Expiry Status
            let expiryStatus: 'valid' | 'expiring' | 'expired' | 'n/a' = 'n/a';
            if (latest.status === 'passed' && latest.expiryDate) {
                const now = new Date();
                const cleanExpiryStr = latest.expiryDate.includes('T') ? latest.expiryDate.split('T')[0] : latest.expiryDate;
                const expiry = new Date(cleanExpiryStr + 'T00:00:00Z');
                const diffTime = expiry.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) expiryStatus = 'expired';
                else if (diffDays <= 30) expiryStatus = 'expiring';
                else expiryStatus = 'valid';
            }

            return {
                exam,
                latest,
                history, // Full history for expanded view (future)
                trend,
                expiryStatus
            };
        });

        // Sort by expiry urgency (Expired -> Expiring -> Valid), then by date
        return rows.sort((a, b) => {
            const statusPriority = { expired: 0, expiring: 1, valid: 2, 'n/a': 3 };
            if (statusPriority[a.expiryStatus] !== statusPriority[b.expiryStatus]) {
                return statusPriority[a.expiryStatus] - statusPriority[b.expiryStatus];
            }
            return new Date(b.latest.completedAt).getTime() - new Date(a.latest.completedAt).getTime();
        });

    }, [exams, examAttempts, staff.id]);

    const stats = useMemo(() => {
        return {
            total: transcriptData.length,
            passed: transcriptData.filter(d => d.latest.status === 'passed').length,
            expiring: transcriptData.filter(d => d.expiryStatus === 'expiring').length,
            expired: transcriptData.filter(d => d.expiryStatus === 'expired').length,
        };
    }, [transcriptData]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-blue-500">
                    <p className="text-xs font-bold text-gray-500 uppercase">Total Exams</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.total}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-green-500">
                    <p className="text-xs font-bold text-gray-500 uppercase">Current Valid</p>
                    <p className="text-2xl font-bold text-green-600">{stats.passed - stats.expired}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-yellow-500">
                    <p className="text-xs font-bold text-gray-500 uppercase">Expiring (30d)</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.expiring}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-red-500">
                    <p className="text-xs font-bold text-gray-500 uppercase">Expired/Failed</p>
                    <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
                <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 dark:text-white">Exam Transcript</h3>
                    <span className="text-xs text-gray-500">Showing latest attempt per exam</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="p-3">Exam Title</th>
                                <th className="p-3">Completion Date</th>
                                <th className="p-3">Score</th>
                                <th className="p-3">Result</th>
                                <th className="p-3">Validity</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {transcriptData.map(({ exam, latest, trend, expiryStatus }) => (
                                <tr key={latest.examId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="p-3 font-medium text-gray-900 dark:text-white">
                                        {exam?.title || 'Unknown Exam'}
                                        {exam?.assignedAircraftType && <span className="ml-2 text-xs text-gray-500">({exam.assignedAircraftType})</span>}
                                    </td>
                                    <td className="p-3 text-gray-600 dark:text-gray-300">
                                        {new Date(latest.completedAt).toLocaleDateString()}
                                        <div className="text-xs text-gray-400">{new Date(latest.completedAt).toLocaleTimeString()}</div>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{latest.score}%</span>
                                            {trend === 'up' && <span className="text-green-500 text-xs" title="Improved">▲</span>}
                                            {trend === 'down' && <span className="text-red-500 text-xs" title="Declined">▼</span>}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${latest.status === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {latest.status}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        {expiryStatus === 'n/a' ? (
                                            <span className="text-gray-400">-</span>
                                        ) : (
                                            <div className="flex flex-col">
                                                <span className={`text-xs font-bold uppercase ${
                                                    expiryStatus === 'valid' ? 'text-green-600' : 
                                                    expiryStatus === 'expiring' ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                    {expiryStatus}
                                                </span>
                                                {latest.expiryDate && <span className="text-xs text-gray-500">{formatEndOfMonth(latest.expiryDate)}</span>}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 text-right">
                                        {exam && (
                                            <button 
                                                onClick={() => setViewingResult({ exam, attempt: latest })}
                                                className="text-brand-primary hover:underline text-xs font-medium bg-brand-light/20 px-2 py-1 rounded border border-brand-primary/20"
                                            >
                                                View Slip
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {transcriptData.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">No exam history found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for viewing exam result */}
            {viewingResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 print:p-0 print:bg-white print:block">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 print:shadow-none print:w-full print:max-w-none print:max-h-none print:p-0 print:border-none print:rounded-none dark:print:bg-white dark:print:text-black">
                        <ExamResultDetail 
                            exam={viewingResult.exam}
                            attempt={viewingResult.attempt}
                            questions={questions}
                            staffName={staff.name}
                            onBack={() => setViewingResult(null)}
                            backLabel="Close"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffExamHistory;
