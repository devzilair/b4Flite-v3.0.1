'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Exam, ExamAttempt } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import ExamEditorModal from '@/components/layout/ExamEditorModal';
import { useStaff } from '@/hooks/useStaff';
import QuestionBank from '@/components/exam/QuestionBank';
import ExamResultsModal from '@/components/exam/ExamResultsModal';
import ExamAnalyticsModal from '@/components/exam/ExamAnalyticsModal';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useTraining } from '@/hooks/useTraining';

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <div className={`p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-4 transition-transform hover:-translate-y-1`}>
        <div className={`p-4 rounded-full ${color} text-white shadow-md`}>
            {icon}
        </div>
        <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-black text-gray-800 dark:text-white">{value}</p>
        </div>
    </div>
);

const ExamsPage: React.FC = () => {
    const { departments, staff: allStaff, loading: appLoading } = useStaff();

    const {
        exams,
        examAttempts,
        questions,
        addExam,
        updateExam,
        deleteExam,
        addQuestion,
        updateQuestion,
        loading: trainingLoading
    } = useTraining();

    const loading = appLoading || trainingLoading;

    const { currentUser, can } = usePermissions();

    const [isManaging, setIsManaging] = useLocalStorage<boolean>('exams_manage_mode', false);
    const [managementTab, setManagementTab] = useLocalStorage<'exams' | 'questions'>('exams_active_tab', 'exams');
    const [filterStatus, setFilterStatus] = useState<'active' | 'archived'>('active');

    // Persist modal state to survive reloads/app switching
    const [isEditorOpen, setIsEditorOpen] = useLocalStorage<boolean>('exams_editor_open', false);
    const [editingExam, setEditingExam] = useLocalStorage<Exam | null>('exams_editing_exam', null);

    const [viewingResultsForExam, setViewingResultsForExam] = useState<Exam | null>(null);
    const [viewingAnalyticsForExam, setViewingAnalyticsForExam] = useState<Exam | null>(null);

    // Force re-render every minute to update cooldown timers
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    const canManageGlobal = can('exams:manage');
    const canManageDepartment = can('exams:manage:own_department');
    const canManageAny = canManageGlobal || canManageDepartment;

    // SECURITY: Force management mode to false if the user lacks permissions.
    useEffect(() => {
        if (isManaging && !canManageAny && !loading) {
            setIsManaging(false);
        }
    }, [isManaging, canManageAny, loading, setIsManaging]);

    // --- Student View Logic ---
    const assignedExamsForTaking = useMemo(() => {
        if (!currentUser) return [];
        const ratedTypes = new Set(currentUser.pilotData?.aircraftTypes || []);

        return exams.filter(exam => {
            if (exam.status && exam.status !== 'active') return false;
            if (exam.departmentId && exam.departmentId !== currentUser.departmentId) return false;
            if (exam.assignedTo && Array.isArray(exam.assignedTo)) {
                return exam.assignedTo.includes(currentUser.id);
            }
            if (exam.assignedAircraftType) {
                return ratedTypes.has(exam.assignedAircraftType);
            }
            return true;
        });
    }, [exams, currentUser]);

    const userAttemptsMap = useMemo(() => {
        if (!currentUser) return new Map();
        const map = new Map<string, ExamAttempt>();

        // Sort attempts by date DESCENDING so the first one we encounter is the latest
        const sortedAttempts = [...examAttempts].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

        sortedAttempts.forEach(att => {
            if (att.staffId === currentUser.id && !map.has(att.examId)) {
                map.set(att.examId, att);
            }
        });
        return map;
    }, [examAttempts, currentUser]);

    const manageableExams = useMemo(() => {
        let list: Exam[] = [];
        if (canManageGlobal) {
            list = exams;
        } else if (canManageDepartment) {
            list = exams.filter(exam => exam.departmentId === currentUser?.departmentId);
        }

        return list.filter(e => {
            const status = e.status || 'active';
            if (filterStatus === 'active') return status !== 'archived';
            return status === 'archived';
        });
    }, [exams, canManageGlobal, canManageDepartment, currentUser, filterStatus]);

    const handleSaveExam = (examToSave: Exam) => {
        if (editingExam) {
            updateExam(examToSave);
        } else {
            addExam(examToSave);
        }
        setIsEditorOpen(false);
        setEditingExam(null);
    };

    const handleDeleteExam = (examId: string) => {
        if (window.confirm('Are you sure you want to delete this exam? This will also remove associated attempts.')) {
            deleteExam(examId);
        }
    };

    const getQuestionCount = (exam: Exam) => {
        let poolSize = 0;
        if (exam.questionIds && exam.questionIds.length > 0) {
            poolSize = questions.filter(q => exam.questionIds.includes(q.id)).length;
        } else if (exam.categoryRules && Object.keys(exam.categoryRules).length > 0) {
            Object.entries(exam.categoryRules).forEach(([cat, count]) => {
                const catPoolSize = questions.filter(q => (q.category || 'Uncategorized') === cat).length;
                poolSize += Math.min(catPoolSize, Number(count));
            });
        }

        if (exam.questionsPerExam && exam.questionsPerExam > 0 && exam.questionsPerExam < poolSize) {
            return exam.questionsPerExam;
        }
        return poolSize;
    };

    if (loading) {
        return <div>Loading exams...</div>;
    }

    const renderStudentView = () => {
        // Calculate pending count including Expired exams
        const pendingCount = assignedExamsForTaking.filter(e => {
            const attempt = userAttemptsMap.get(e.id);
            if (!attempt) return true; // Never taken
            if (attempt.status === 'failed') return true; // Failed
            if (attempt.status === 'passed' && attempt.expiryDate) {
                // Check expiry using strict local time comparison
                const expiryLimit = new Date(`${attempt.expiryDate}T23:59:59`);
                return new Date() > expiryLimit;
            }
            return false;
        }).length;

        const passedCount = assignedExamsForTaking.filter(e => userAttemptsMap.get(e.id)?.status === 'passed').length;
        const avgScore = assignedExamsForTaking.reduce((acc, e) => acc + (userAttemptsMap.get(e.id)?.score || 0), 0) / (passedCount || 1);

        return (
            <div className="space-y-8 animate-fade-in">
                {/* Hero Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard
                        title="Pending Exams"
                        value={pendingCount}
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        color="bg-gradient-to-br from-orange-400 to-pink-500"
                    />
                    <StatCard
                        title="Average Score"
                        value={passedCount > 0 ? `${Math.round(avgScore)}%` : '-'}
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                        color="bg-gradient-to-br from-blue-400 to-indigo-500"
                    />
                    <StatCard
                        title="Certificates"
                        value={passedCount}
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        color="bg-gradient-to-br from-green-400 to-emerald-500"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {assignedExamsForTaking.map(exam => {
                        const attempt = userAttemptsMap.get(exam.id);
                        const rawStatus = attempt ? attempt.status : 'pending';

                        // Check for Expiry
                        let uiStatus: 'pending' | 'passed' | 'failed' | 'expired' = rawStatus;
                        if (rawStatus === 'passed' && attempt?.expiryDate) {
                            // Ensure strict comparison against END of today in LOCAL time
                            // Parsing "YYYY-MM-DD" + "T23:59:59" creates a local date object
                            const expiryLimit = new Date(`${attempt.expiryDate}T23:59:59`);
                            if (new Date() > expiryLimit) {
                                uiStatus = 'expired';
                            }
                        }

                        // Deadline Logic
                        const isOverdue = exam.dueDate && new Date(exam.dueDate + 'T23:59:59') < new Date() && uiStatus === 'pending';

                        // Cooldown Logic for Failed Exams
                        let cooldownRemaining = 0;
                        if (uiStatus === 'failed' && attempt && (exam.coolDownMinutes || 0) > 0) {
                            const now = new Date();
                            const completed = new Date(attempt.completedAt);
                            const diffMins = (now.getTime() - completed.getTime()) / (1000 * 60);
                            cooldownRemaining = Math.max(0, Math.ceil((exam.coolDownMinutes || 0) - diffMins));
                        }

                        const statusColors = {
                            pending: 'border-l-4 border-l-gray-300',
                            passed: 'border-l-4 border-l-green-500',
                            failed: 'border-l-4 border-l-red-500',
                            expired: 'border-l-4 border-l-orange-500',
                        };

                        return (
                            <div key={exam.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col ${statusColors[uiStatus]} group`}>
                                <div className="p-6 flex-grow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-lg ${uiStatus === 'passed' ? 'bg-green-100 text-green-600' :
                                            uiStatus === 'failed' ? 'bg-red-100 text-red-600' :
                                                uiStatus === 'expired' ? 'bg-orange-100 text-orange-600' :
                                                    'bg-brand-light/20 text-brand-primary'
                                            }`}>
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                        </div>
                                        {uiStatus === 'passed' && <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full uppercase">Passed</span>}
                                        {uiStatus === 'failed' && <span className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full uppercase">Failed</span>}
                                        {uiStatus === 'expired' && <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full uppercase">Expired</span>}
                                    </div>

                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2 line-clamp-2 min-h-[3.5rem]">{exam.title}</h3>

                                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400 font-medium mb-4">
                                        <span className="flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {exam.timeLimitMinutes}m
                                        </span>
                                        <span className="flex items-center gap-1" title="Number of Questions">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {getQuestionCount(exam)} Qs
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Pass: {exam.passMarkPercentage}%
                                        </span>
                                    </div>

                                    {exam.dueDate && uiStatus === 'pending' && (
                                        <div className={`text-xs font-bold mb-4 flex items-center gap-1 ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                                            <span className="uppercase tracking-wide">Deadline:</span> {new Date(exam.dueDate).toLocaleDateString()}
                                            {isOverdue && <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px]">LATE</span>}
                                        </div>
                                    )}

                                    {attempt && (
                                        <div className="mb-4">
                                            <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                                                <span>Score</span>
                                                <span>{attempt.score}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                                                <div
                                                    className={`h-2 rounded-full ${attempt.score >= exam.passMarkPercentage ? 'bg-green-500' : 'bg-red-500'}`}
                                                    style={{ width: `${attempt.score}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-t dark:border-gray-700">
                                    {uiStatus === 'pending' ? (
                                        <Link href={`/exams/${exam.id}`} className="block w-full text-center bg-brand-primary text-white font-bold py-2.5 rounded-lg hover:bg-brand-secondary transition-all shadow-md active:scale-95">
                                            Start Exam
                                        </Link>
                                    ) : uiStatus === 'passed' ? (
                                        <Link href={`/exams/${exam.id}/result`} className="block w-full text-center text-brand-primary font-bold py-2.5 rounded-lg border-2 border-brand-primary hover:bg-brand-light/10 transition-colors">
                                            View Certificate
                                        </Link>
                                    ) : uiStatus === 'expired' ? (
                                        <div className="flex gap-2">
                                            <Link href={`/exams/${exam.id}/result`} className="flex-1 text-center bg-gray-200 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-300 transition-colors">
                                                History
                                            </Link>
                                            <Link href={`/exams/${exam.id}`} className="flex-1 text-center bg-orange-600 text-white font-bold py-2.5 rounded-lg hover:bg-orange-700 transition-colors shadow-md">
                                                Renew
                                            </Link>
                                        </div>
                                    ) : (
                                        cooldownRemaining > 0 ? (
                                            <button disabled className="block w-full text-center bg-gray-300 text-gray-500 font-bold py-2.5 rounded-lg cursor-not-allowed">
                                                Wait {cooldownRemaining}m
                                            </button>
                                        ) : (
                                            <div className="flex gap-2">
                                                <Link href={`/exams/${exam.id}/result`} className="flex-1 text-center bg-gray-200 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-300 transition-colors">
                                                    Review
                                                </Link>
                                                <Link href={`/exams/${exam.id}`} className="flex-1 text-center bg-brand-primary text-white font-bold py-2.5 rounded-lg hover:bg-brand-secondary transition-colors shadow-md">
                                                    Retake
                                                </Link>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {assignedExamsForTaking.length === 0 && (
                    <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                        <div className="text-6xl mb-4">🎓</div>
                        <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200">No Exams Assigned</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">You're all caught up! Check back later for new assignments.</p>
                    </div>
                )}
            </div>
        );
    };

    const renderManagementView = () => (
        <div>
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setManagementTab('exams')}
                        className={`${managementTab === 'exams' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Manage Exams
                    </button>
                    <button
                        onClick={() => setManagementTab('questions')}
                        className={`${managementTab === 'questions' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Question Bank
                    </button>
                </nav>
            </div>

            {managementTab === 'exams' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="flex justify-end mb-2">
                        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 text-sm">
                            <button
                                onClick={() => setFilterStatus('active')}
                                className={`px-3 py-1 rounded-md transition-all ${filterStatus === 'active' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary font-bold' : 'text-gray-500'}`}
                            >
                                Active
                            </button>
                            <button
                                onClick={() => setFilterStatus('archived')}
                                className={`px-3 py-1 rounded-md transition-all ${filterStatus === 'archived' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary font-bold' : 'text-gray-500'}`}
                            >
                                Archived
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500 font-bold border-b dark:border-gray-700">
                                <tr>
                                    <th className="p-4">Title</th>
                                    <th className="p-4">Due Date</th>
                                    <th className="p-4">Assignment</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {manageableExams.map(exam => {
                                    const isSpecific = Array.isArray(exam.assignedTo) && exam.assignedTo.length > 0;
                                    const assignLabel = isSpecific
                                        ? `${exam.assignedTo?.length || 0} Staff`
                                        : (exam.assignedAircraftType ? `All (${exam.assignedAircraftType})` : 'All Eligible');
                                    const status = exam.status || 'active';

                                    return (
                                        <tr key={exam.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-gray-900 dark:text-white">{exam.title}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">{departments.find(d => d.id === exam.departmentId)?.name || 'Global'}</div>
                                            </td>
                                            <td className="p-4 text-sm">
                                                {exam.dueDate ? (
                                                    <span className={`font-medium ${new Date(exam.dueDate) < new Date() ? 'text-red-600' : 'text-gray-600 dark:text-gray-300'}`}>
                                                        {new Date(exam.dueDate).toLocaleDateString()}
                                                    </span>
                                                ) : <span className="text-gray-400 italic">No Deadline</span>}
                                            </td>
                                            <td className="p-4 text-sm">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${isSpecific ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                    {assignLabel}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${status === 'active' ? 'bg-green-100 text-green-800' :
                                                    status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-gray-200 text-gray-600'
                                                    }`}>
                                                    {status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <button
                                                        onClick={() => setViewingAnalyticsForExam(exam)}
                                                        className="text-orange-600 hover:text-orange-700 bg-orange-50 p-2 rounded hover:bg-orange-100 transition-colors"
                                                        title="Knowledge Gap Analytics"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                                                    </button>
                                                    <button
                                                        onClick={() => setViewingResultsForExam(exam)}
                                                        className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 p-2 rounded hover:bg-indigo-100 transition-colors"
                                                        title="View Attempt Results"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                                    </button>
                                                    <span className="text-gray-300">|</span>
                                                    <button onClick={() => { setEditingExam(exam); setIsEditorOpen(true); }} className="text-brand-primary hover:underline text-sm font-bold">Edit</button>
                                                    <button onClick={() => handleDeleteExam(exam.id)} className="text-red-600 hover:text-red-700 hover:underline text-sm font-bold">Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        {manageableExams.length === 0 && <p className="text-center py-12 text-gray-500">No {filterStatus} exams found.</p>}
                    </div>
                </div>
            )}
            {managementTab === 'questions' && (
                <QuestionBank />
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                        {(isManaging && canManageAny) ? 'Exam Management' : 'Training Center'}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{(isManaging && canManageAny) ? 'Create and monitor assessments.' : 'Complete assigned training and view results.'}</p>
                </div>
                {canManageAny && (
                    <div className="flex items-center gap-4">
                        {isManaging && managementTab === 'exams' && (
                            <button onClick={() => { setEditingExam(null); setIsEditorOpen(true); }} className="bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-secondary font-bold shadow-lg transform active:scale-95 transition-all">
                                + New Exam
                            </button>
                        )}
                        <label className="flex items-center cursor-pointer bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border dark:border-gray-700">
                            <span className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${!isManaging ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500'}`}>Student</span>
                            <input type="checkbox" checked={isManaging} onChange={e => setIsManaging(e.target.checked)} className="sr-only" />
                            <span className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${isManaging ? 'bg-brand-primary text-white shadow' : 'text-gray-500'}`}>Manager</span>
                        </label>
                    </div>
                )}
            </div>

            {(isManaging && canManageAny) ? renderManagementView() : renderStudentView()}

            {isEditorOpen && (
                <ExamEditorModal
                    isOpen={isEditorOpen}
                    onClose={() => setIsEditorOpen(false)}
                    onSave={handleSaveExam}
                    existingExam={editingExam}
                    questions={questions}
                    addQuestion={addQuestion}
                    updateQuestion={updateQuestion}
                />
            )}

            {viewingResultsForExam && (
                <ExamResultsModal
                    isOpen={!!viewingResultsForExam}
                    onClose={() => setViewingResultsForExam(null)}
                    exam={viewingResultsForExam}
                    attempts={examAttempts.filter(a => a.examId === viewingResultsForExam.id)}
                    allStaff={allStaff}
                    currentUser={currentUser}
                    canManageGlobal={canManageGlobal}
                />
            )}

            {viewingAnalyticsForExam && (
                <ExamAnalyticsModal
                    isOpen={!!viewingAnalyticsForExam}
                    onClose={() => setViewingAnalyticsForExam(null)}
                    exam={viewingAnalyticsForExam}
                    attempts={examAttempts.filter(a => a.examId === viewingAnalyticsForExam.id)}
                    questions={questions}
                />
            )}
        </div>
    );
};

export default ExamsPage;
