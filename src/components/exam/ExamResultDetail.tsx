
import React, { useMemo, useState, useEffect } from 'react';
import { Exam, ExamAttempt, Question } from '../../types';
import { supabaseUrl } from '../../services/supabaseClient';
import { usePermissions } from '../../hooks/usePermissions';
import { useRouter } from 'next/navigation';

interface ExamResultDetailProps {
    exam: Exam;
    attempt: ExamAttempt;
    questions: Question[];
    staffName: string;
    onBack: () => void;
    backLabel?: string;
}

/**
 * Normalizes any date string (ISO or Date-only) to the last day of its month.
 */
const formatEndOfMonth = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    try {
        // Strip any time component to avoid parsing issues
        const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const d = new Date(cleanDateStr + 'T00:00:00Z');
        if (isNaN(d.getTime())) return dateStr;
        // Day 0 of the next month is the last day of the current month
        const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
        return lastDay.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
};

const ExamResultDetail: React.FC<ExamResultDetailProps> = ({
    exam,
    attempt,
    questions,
    staffName,
    onBack,
    backLabel = 'Back'
}) => {
    const { can, currentUser } = usePermissions();
    const router = useRouter();
    const isManager = can('exams:manage') || can('exams:manage:own_department');

    const [isDarkCertificate, setIsDarkCertificate] = useState(false);
    // Managers should see review by default
    const [showReview, setShowReview] = useState(isManager);
    const [printTarget, setPrintTarget] = useState<'slip' | 'certificate' | null>(null);

    const isPassed = attempt.status === 'passed';
    const isOwnResult = currentUser?.id === attempt.staffId;

    // Cooldown logic for retake button
    const cooldownRemaining = useMemo(() => {
        if (isPassed || !exam.coolDownMinutes) return 0;
        const now = new Date();
        const completed = new Date(attempt.completedAt);
        const diffMins = (now.getTime() - completed.getTime()) / (1000 * 60);
        return Math.max(0, Math.ceil(exam.coolDownMinutes - diffMins));
    }, [isPassed, exam.coolDownMinutes, attempt.completedAt]);

    const logoSrc = isDarkCertificate
        ? `${supabaseUrl}/storage/v1/object/public/portal-uploads/logo_black.png`
        : `${supabaseUrl}/storage/v1/object/public/portal-uploads/logo_white.png`;

    // Review Data Calculation
    const reviewData = useMemo(() => {
        // SECURITY: Strictly restrict review data to Managers only.
        if (!isManager) return null;

        // If manager toggled off review mode
        if (!showReview) return null;

        const answeredQuestionIds = Object.keys(attempt.answers);
        const relevantQuestions = questions.filter(q => answeredQuestionIds.includes(q.id));

        return relevantQuestions.map(q => ({
            question: q,
            userAnswer: attempt.answers[q.id],
            isCorrect: attempt.answers[q.id] === q.correctAnswer
        }));
    }, [showReview, attempt, questions, isManager]);

    // Handle printing
    useEffect(() => {
        if (printTarget) {
            const timer = setTimeout(() => {
                window.print();
                setPrintTarget(null);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [printTarget]);

    const handleRetake = () => {
        router.push(`/exams/${exam.id}`);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12 print:pb-0 print:w-full">
            <div className="print:hidden flex justify-between items-center">
                <button onClick={onBack} className="text-brand-primary hover:underline">&larr; {backLabel}</button>
                <div className="text-sm text-gray-500">
                    Result for: <span className="font-bold text-gray-800 dark:text-gray-200">{staffName}</span>
                </div>
            </div>

            <div id="exam-result-slip" className={printTarget === 'slip' ? 'printable-content' : ''}>
                <div className={`relative p-8 rounded-lg shadow-lg text-center border-t-8 ${isPassed ? 'bg-white dark:bg-gray-800 border-t-status-success' : 'bg-white dark:bg-gray-800 border-t-status-danger'} ${printTarget === 'slip' ? 'shadow-none border border-gray-300' : ''}`}>

                    <button
                        onClick={() => setPrintTarget('slip')}
                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors print:hidden"
                        title="Print Result Slip"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" /></svg>
                    </button>

                    <h1 className="text-3xl print:text-2xl font-bold mb-2">{exam.title}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 print:mb-4">Attempt completed on {new Date(attempt.completedAt).toLocaleDateString()}</p>

                    <div className="flex justify-center items-center gap-8 mb-8 print:mb-4">
                        <div>
                            <p className="text-sm uppercase text-gray-500 font-bold">Score</p>
                            <p className={`text-5xl print:text-3xl font-bold ${isPassed ? 'text-status-success' : 'text-status-danger'}`}>{attempt.score}%</p>
                        </div>
                        <div className="h-12 w-px bg-gray-300"></div>
                        <div>
                            <p className="text-sm uppercase text-gray-500 font-bold">Result</p>
                            <p className={`text-3xl print:text-xl font-bold uppercase ${isPassed ? 'text-status-success' : 'text-status-danger'}`}>{attempt.status}</p>
                        </div>
                    </div>

                    {/* Retake Button for Students */}
                    {!isPassed && isOwnResult && (
                        <div className="mb-6 print:hidden">
                            {cooldownRemaining > 0 ? (
                                <div className="inline-block px-4 py-2 bg-orange-100 text-orange-700 rounded-md font-bold text-sm">
                                    Retake available in {cooldownRemaining} minutes
                                </div>
                            ) : (
                                <button
                                    onClick={handleRetake}
                                    className="px-6 py-2 bg-brand-primary text-white rounded-md font-bold hover:bg-brand-secondary shadow-lg transform transition-transform hover:scale-105 active:scale-95"
                                >
                                    Retake Exam
                                </button>
                            )}
                        </div>
                    )}

                    {isPassed && attempt.expiryDate && (
                        <div className="mb-6 print:mb-4 inline-block bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-full border border-blue-100 dark:border-blue-800 print:bg-gray-100 print:border-gray-300">
                            <p className="text-blue-800 dark:text-blue-200 font-medium text-sm print:text-black">Valid Until: {formatEndOfMonth(attempt.expiryDate)}</p>
                        </div>
                    )}
                </div>

                {attempt.categoryScores && Object.keys(attempt.categoryScores).length > 0 && (
                    <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow print:shadow-none print:border print:border-gray-300 print:mt-4">
                        <h3 className="text-lg font-bold mb-4 border-b dark:border-gray-700 pb-2">Performance by Category</h3>
                        <div className="space-y-4">
                            {Object.entries(attempt.categoryScores).map(([cat, score]) => (
                                <div key={cat} className="print:break-inside-avoid">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium">{cat}</span>
                                        <span className="text-sm font-bold">{score}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 print:h-2 print:bg-gray-100 print:border print:border-gray-300">
                                        <div
                                            className={`h-2.5 print:h-2 rounded-full ${(score as number) >= 80 ? 'bg-status-success' : (score as number) >= 50 ? 'bg-status-warning' : 'bg-status-danger'}`}
                                            style={{ width: `${score}%`, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Review Section - Enhanced for Managers ONLY */}
                {isManager && (
                    <div className="mt-8">
                        <div className="mb-4 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-md border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200 text-xs font-bold uppercase tracking-wider text-center">
                            Manager View: All answers visible for review
                        </div>

                        <div className="print:hidden text-center mb-4">
                            <button
                                onClick={() => setShowReview(!showReview)}
                                className="text-brand-primary font-semibold hover:underline"
                            >
                                {showReview ? 'Hide Question Breakdown' : 'Review Individual Questions'}
                            </button>
                        </div>

                        {showReview && reviewData && (
                            <div className="space-y-4">
                                {reviewData.map((item, idx) => (
                                    <div key={idx} className={`p-4 border rounded-lg print:break-inside-avoid ${item.isCorrect ? 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800 print:bg-white print:border-gray-300' : 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 print:bg-white print:border-gray-300'}`}>
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 mt-1">
                                                {item.isCorrect ? <span className="text-green-600 font-bold">✔</span> : <span className="text-red-600 font-bold">✘</span>}
                                            </div>
                                            <div className="flex-grow">
                                                {item.question.imageUrl && (
                                                    <div className="mb-2">
                                                        <img src={item.question.imageUrl} alt="Reference Diagram" className="max-h-48 rounded border border-gray-300 dark:border-gray-600" />
                                                    </div>
                                                )}
                                                <p className="font-medium text-gray-800 dark:text-gray-200 mb-2">{item.question.text}</p>

                                                <div className="text-sm space-y-1">
                                                    <p>
                                                        <span className="font-semibold text-gray-500">Staff Answer: </span>
                                                        <span className={item.isCorrect ? 'text-green-700' : 'text-red-700'}>
                                                            {item.userAnswer || '(Skipped)'}
                                                        </span>
                                                    </p>
                                                    {!item.isCorrect && (
                                                        <p>
                                                            <span className="font-semibold text-gray-500">Correct Answer: </span>
                                                            <span className="text-green-700 font-bold">{item.question.correctAnswer}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isPassed && (
                <div className="mt-8">
                    <div className="print:hidden flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-3 rounded-md mb-4">
                        <span className="font-bold text-gray-700 dark:text-gray-200">Certificate Preview</span>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">Theme:</span>
                                <button
                                    onClick={() => setIsDarkCertificate(false)}
                                    className={`px-3 py-1 rounded text-sm border ${!isDarkCertificate ? 'bg-white text-black border-brand-primary ring-2 ring-brand-primary/20' : 'bg-gray-200 text-gray-600'}`}
                                >
                                    White
                                </button>
                                <button
                                    onClick={() => setIsDarkCertificate(true)}
                                    className={`px-3 py-1 rounded text-sm border ${isDarkCertificate ? 'bg-black text-white border-gray-600 ring-2 ring-gray-500/50' : 'bg-gray-300 text-gray-600'}`}
                                >
                                    Black
                                </button>
                            </div>
                            <button
                                onClick={() => setPrintTarget('certificate')}
                                className="flex items-center gap-2 bg-brand-primary text-white px-3 py-1.5 rounded text-sm hover:bg-brand-secondary transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                Print Certificate
                            </button>
                        </div>
                    </div>

                    <div
                        id="certificate-area"
                        className={`relative w-full aspect-[1.414] p-12 shadow-2xl flex flex-col justify-between border-[16px] ${isDarkCertificate ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-brand-primary'} ${printTarget === 'certificate' ? 'printable-content' : ''}`}
                    >
                        <div className="text-center space-y-2">
                            <div className="flex justify-center mb-6">
                                <img src={logoSrc} alt="Company Logo" className="h-24 object-contain" />
                            </div>
                            <h2 className={`text-5xl font-serif font-bold uppercase tracking-widest ${isDarkCertificate ? 'text-brand-accent' : 'text-brand-primary'}`}>Certificate</h2>
                            <h3 className="text-xl font-light tracking-[0.2em] uppercase">of Completion</h3>
                        </div>

                        <div className="text-center space-y-6 my-8">
                            <p className="text-lg italic opacity-80">This is to certify that</p>
                            <h1 className="text-4xl font-bold font-serif border-b-2 inline-block px-8 pb-2 border-current">{staffName}</h1>
                            <p className="text-lg italic opacity-80">has successfully completed and passed the examination for</p>
                            <h2 className="text-3xl font-bold">{exam.title}</h2>
                            <div className="flex justify-center gap-8 opacity-80 mt-2">
                                <span>Score: <span className="font-bold">{attempt.score}%</span></span>
                                {attempt.expiryDate && <span>Expires: <span className="font-bold">{formatEndOfMonth(attempt.expiryDate)}</span></span>}
                            </div>
                        </div>

                        <div className="flex justify-between items-end mt-12">
                            <div className="text-center">
                                <div className={`w-48 border-b ${isDarkCertificate ? 'border-gray-500' : 'border-black'} mb-2 h-8 flex items-end justify-center`}>
                                    <span className="font-medium text-lg pb-1">
                                        {new Date(attempt.completedAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-sm uppercase tracking-wider opacity-70">Date</p>
                            </div>
                            <div className="text-center">
                                <div className={`w-48 border-b ${isDarkCertificate ? 'border-gray-500' : 'border-black'} mb-2 h-8`}></div>
                                <p className="text-sm uppercase tracking-wider opacity-70">Authorized Signature</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @media print {
                    body {
                        margin: 0;
                        padding: 0;
                        background-color: white !important;
                    }
                    body * {
                        visibility: hidden;
                    }
                    nav, header, aside, footer, .print\\:hidden {
                        display: none !important;
                    }
                    .printable-content, 
                    .printable-content * {
                        visibility: visible;
                    }
                    #exam-result-slip.printable-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 20px;
                        background: white;
                        z-index: 9999;
                    }
                    #certificate-area.printable-content {
                        position: fixed;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        margin: 0;
                        padding: 15mm !important;
                        box-sizing: border-box;
                        background: white;
                        z-index: 9999;
                        display: flex !important;
                        flex-direction: column;
                        justify-content: space-between;
                        border-style: solid; 
                    }
                    @page {
                        margin: 0;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ExamResultDetail;
