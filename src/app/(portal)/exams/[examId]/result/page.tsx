'use client';

import React, { useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import ExamResultDetail from '@/components/exam/ExamResultDetail';
import { useTraining } from '@/hooks/useTraining';
import { useStaff } from '@/hooks/useStaff';

const ExamResultPage = () => {
    const params = useParams();
    const examId = params.examId as string;
    const searchParams = useSearchParams();
    const router = useRouter();
    const { staff: allStaff, loading: appLoading } = useStaff();
    const { exams, examAttempts, questions, loading: trainingLoading } = useTraining();
    const loading = appLoading || trainingLoading;
    const { currentUser, can } = usePermissions();

    const staffIdParam = searchParams.get('staffId');
    const targetStaffId = staffIdParam || currentUser?.id;

    const exam = useMemo(() => exams.find(e => e.id === examId), [exams, examId]);

    const targetStaff = useMemo(() => allStaff.find(s => s.id === targetStaffId), [allStaff, targetStaffId]);

    // Permission check: Can the current user view the target staff's result?
    const canViewResult = useMemo(() => {
        if (!currentUser || !targetStaff) return false;

        // 1. Viewing own result
        if (currentUser.id === targetStaff.id) return true;

        // 2. Global Admin/Manager
        if (can('exams:manage')) return true;

        // 3. Department Manager (manage own department)
        if (can('exams:manage:own_department') && currentUser.departmentId === targetStaff.departmentId) {
            return true;
        }

        return false;
    }, [currentUser, targetStaff, can]);

    // Get the latest attempt for this exam by the TARGET user
    const attempt = useMemo(() => {
        if (!targetStaffId) return null;
        const myAttempts = examAttempts.filter(a => a.examId === examId && a.staffId === targetStaffId);
        // Sort by date descending to get latest
        return myAttempts.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];
    }, [examAttempts, examId, targetStaffId]);

    if (loading) return <div>Loading results...</div>;

    if (!canViewResult) {
        return (
            <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow-xl">
                <h2 className="text-xl font-bold text-status-danger">Access Denied</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">You do not have permission to view this exam result.</p>
                <button onClick={() => router.push('/exams')} className="mt-6 bg-brand-primary text-white px-4 py-2 rounded hover:bg-brand-secondary">Return to Exams</button>
            </div>
        );
    }

    if (!exam || !attempt) {
        return (
            <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow-xl">
                <h2 className="text-xl font-bold text-status-danger">Result not found</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">No attempt record found for this user.</p>
                <button onClick={() => router.push('/exams')} className="mt-6 bg-brand-primary text-white px-4 py-2 rounded hover:bg-brand-secondary">Return to Exams</button>
            </div>
        );
    }

    return (
        <ExamResultDetail
            exam={exam}
            attempt={attempt}
            questions={questions}
            staffName={targetStaff?.name || 'Unknown Staff'}
            onBack={() => router.push('/exams')}
            backLabel="Back to Exams"
        />
    );
};

export default ExamResultPage;
