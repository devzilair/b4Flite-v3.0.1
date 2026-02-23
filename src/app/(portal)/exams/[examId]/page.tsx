'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { useTraining } from '@/hooks/useTraining';
import { ExamAttempt, Question } from '@/types';

const ExamTakingPage = () => {
    const params = useParams();
    const examId = params.examId as string;
    const router = useRouter();
    const { currentUser } = usePermissions();
    const { exams, questions, addExamAttempt, loading: trainingLoading } = useTraining();

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const exam = useMemo(() => exams.find(e => e.id === examId), [exams, examId]);
    // Filter and prepare questions based on exam configuration
    // We use a state to hold questions to ensure they don't re-shuffle on every render/background fetch
    const [finalQuestions, setFinalQuestions] = useState<Question[]>([]);

    // Helper: Fisher-Yates Shuffle for true randomness
    const shuffle = <T extends unknown>(array: T[]): T[] => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };

    useEffect(() => {
        if (!exam || questions.length === 0 || finalQuestions.length > 0) return;

        let selectedQuestions: Question[] = [];

        // 1. Manual Mode: Use specific question IDs
        if (exam.questionIds && exam.questionIds.length > 0) {
            selectedQuestions = questions.filter(q => exam.questionIds.includes(q.id));
        }
        // 2. Blueprint Mode: Generate based on rules
        else if (exam.categoryRules && Object.keys(exam.categoryRules).length > 0) {
            const blueprintPool: Question[] = [];
            Object.entries(exam.categoryRules).forEach(([cat, count]) => {
                const catQuestions = questions.filter(q => (q.category || 'Uncategorized') === cat);
                // Use Fisher-Yates for fair selection within the category
                const shuffled = shuffle(catQuestions);
                blueprintPool.push(...shuffled.slice(0, Number(count)));
            });
            selectedQuestions = blueprintPool;
        }

        // 3. APPLY OVERALL CAP (if defined)
        // This ensures that even if blueprint rules total 50, but questionsPerExam is 20, we only ask 20.
        if (exam.questionsPerExam && exam.questionsPerExam > 0 && exam.questionsPerExam < selectedQuestions.length) {
            // Shuffle the results to pick random candidates from the rule-matching pool
            selectedQuestions = shuffle(selectedQuestions).slice(0, exam.questionsPerExam);
        }

        // 4. Randomize order if enabled (Final presentation shuffle)
        if (exam.randomizeQuestions) {
            selectedQuestions = shuffle(selectedQuestions);
        }

        setFinalQuestions(selectedQuestions);

    }, [exam, questions, finalQuestions.length]); // Only run when exam/questions load, but block re-runs via finalQuestions check

    // Initialize timer
    useEffect(() => {
        if (exam && timeLeft === null) {
            setTimeLeft(exam.timeLimitMinutes * 60);
        }
    }, [exam, timeLeft]);

    // Timer countdown
    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev === null || prev <= 0) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    // Auto-submit on time out
    useEffect(() => {
        if (timeLeft === 0 && !isSubmitting) {
            handleSubmit();
        }
    }, [timeLeft, isSubmitting]);

    const handleAnswerSelect = (questionId: string, answer: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const handleSubmit = async () => {
        if (!exam || !currentUser || isSubmitting) return;
        setIsSubmitting(true);

        let score = 0;
        const categoryScores: Record<string, { total: number, correct: number }> = {};

        finalQuestions.forEach(q => {
            const isCorrect = answers[q.id] === q.correctAnswer;
            if (isCorrect) score++;

            const cat = q.category || 'General';
            if (!categoryScores[cat]) categoryScores[cat] = { total: 0, correct: 0 };
            categoryScores[cat].total++;
            if (isCorrect) categoryScores[cat].correct++;
        });

        const finalScore = finalQuestions.length > 0 ? Math.round((score / finalQuestions.length) * 100) : 0;
        const passed = finalScore >= exam.passMarkPercentage;

        const catScoreMap: Record<string, number> = {};
        Object.entries(categoryScores).forEach(([cat, stats]) => {
            catScoreMap[cat] = Math.round((stats.correct / stats.total) * 100);
        });

        // Determine expiry
        let expiryDate: string | undefined = undefined;
        if (passed) {
            const d = new Date();
            // Default to 12 if validityMonths is undefined to prevent NaN errors
            d.setMonth(d.getMonth() + (exam.validityMonths || 12));
            d.setDate(d.getDate() - 1); // Valid until day before

            // Format as LOCAL YYYY-MM-DD to avoid timezone shifting
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            expiryDate = `${year}-${month}-${day}`;
        }

        // Do not generate client-side ID for exam_attempts, let DB generate UUID
        const attempt: ExamAttempt = {
            examId: exam.id,
            staffId: currentUser.id,
            status: passed ? 'passed' : 'failed',
            score: finalScore,
            categoryScores: catScoreMap,
            completedAt: new Date().toISOString(),
            expiryDate,
            answers
        };

        console.log("Submitting exam attempt:", attempt);
        console.log("Current User in Submission:", currentUser);

        try {
            await addExamAttempt(attempt);
            router.push(`/exams/${exam.id}/result?staffId=${currentUser.id}`); // Navigate to result page
        } catch (error: any) {
            console.error("Failed to submit exam. Full error details:", error);

            // Extract the most helpful error message
            const message = error?.message || error?.details || "Unknown error";
            const code = error?.code || "";

            alert(`Failed to submit exam: ${message}${code ? ` (${code})` : ''}. Please try again.`);
            setIsSubmitting(false);
        }
    };

    if (trainingLoading || !exam) return <div className="p-8 text-center">Loading exam...</div>;

    if (finalQuestions.length === 0) {
        // Wait a moment for generation
        if (questions.length > 0) {
            return <div className="p-8 text-center">Generating questions...</div>;
        }

        return (
            <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow-xl m-4">
                <h2 className="text-xl font-bold text-red-600">Configuration Error</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">No questions found for this exam.</p>
                <p className="text-sm text-gray-500 mt-1">This might be because the question bank is empty or the exam blueprint settings don't match any available questions.</p>
                <button onClick={() => router.push('/exams')} className="mt-6 bg-brand-primary text-white px-4 py-2 rounded">Back to Dashboard</button>
            </div>
        );
    }

    const currentQuestion = finalQuestions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / finalQuestions.length) * 100;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-lg font-bold text-gray-800 dark:text-white">{exam.title}</h1>
                        <p className="text-xs text-gray-500">Question {currentQuestionIndex + 1} of {finalQuestions.length}</p>
                    </div>
                    {timeLeft !== null && (
                        <div className={`text-xl font-mono font-bold ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-gray-700 dark:text-gray-300'}`}>
                            {formatTime(timeLeft)}
                        </div>
                    )}
                </div>
                <div className="h-1 bg-gray-200 dark:bg-gray-700 w-full">
                    <div className="h-full bg-brand-primary transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-grow flex flex-col items-center justify-start pt-8 px-4 pb-32">
                <div className="max-w-3xl w-full space-y-8">

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        {currentQuestion.category && (
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2 block">
                                {currentQuestion.category}
                            </span>
                        )}
                        <h2 className="text-xl md:text-2xl font-medium text-gray-900 dark:text-white leading-relaxed">
                            {currentQuestion.text}
                        </h2>
                        {currentQuestion.imageUrl && (
                            <img src={currentQuestion.imageUrl} alt="Question Diagram" className="mt-4 max-h-64 rounded-lg border border-gray-200 dark:border-gray-700" />
                        )}
                    </div>

                    <div className="space-y-4 w-full">
                        {(currentQuestion.type === 'true_false' ? ['True', 'False'] : (currentQuestion.options || [])).map(opt => (
                            <button
                                key={opt}
                                onClick={() => handleAnswerSelect(currentQuestion.id, opt)}
                                className={`w-full text-left p-5 rounded-xl border-2 transition-all duration-200 flex items-center justify-between group ${answers[currentQuestion.id] === opt
                                    ? 'border-brand-primary bg-brand-light/10 shadow-md transform scale-[1.01]'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-brand-primary/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${answers[currentQuestion.id] === opt ? 'border-brand-primary bg-brand-primary' : 'border-gray-300 dark:border-gray-600 group-hover:border-brand-primary/50'}`}>
                                        {answers[currentQuestion.id] === opt && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                                    </div>
                                    <span className={`text-lg font-medium ${answers[currentQuestion.id] === opt ? 'text-brand-primary' : 'text-gray-700 dark:text-gray-300'}`}>{opt}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-4 z-20">
                <div className="max-w-3xl mx-auto flex justify-between items-center">
                    <button
                        onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentQuestionIndex === 0}
                        className="px-6 py-2 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                    >
                        &larr; Previous
                    </button>

                    {currentQuestionIndex < finalQuestions.length - 1 ? (
                        <button
                            onClick={() => setCurrentQuestionIndex(prev => Math.min(finalQuestions.length - 1, prev + 1))}
                            className="px-8 py-2 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-secondary shadow-lg transition-transform active:scale-95"
                        >
                            Next &rarr;
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-8 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-lg transition-transform active:scale-95 disabled:opacity-70 disabled:cursor-wait"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Exam'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExamTakingPage;
