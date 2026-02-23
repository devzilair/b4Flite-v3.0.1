
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import * as api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Exam, Question, ExamAttempt } from '../types';

export const useTraining = () => {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const enabled = !!session;

    // --- QUERIES ---
    const examsQuery = useQuery({
        queryKey: ['exams'],
        queryFn: api.getExams,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    const questionsQuery = useQuery({
        queryKey: ['questions'],
        queryFn: api.getQuestions,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    const attemptsQuery = useQuery({
        queryKey: ['exam_attempts'],
        queryFn: api.getExamAttempts,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    // --- MUTATIONS ---
    const upsertExamMutation = useMutation({
        mutationFn: api.upsertExam,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exams'] })
    });

    const deleteExamMutation = useMutation({
        mutationFn: api.deleteExam,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exams'] });
            queryClient.invalidateQueries({ queryKey: ['exam_attempts'] });
        }
    });

    const upsertQuestionMutation = useMutation({
        mutationFn: api.upsertQuestion,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] })
    });

    const bulkQuestionsMutation = useMutation({
        mutationFn: api.bulkInsertQuestions,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] })
    });

    const deleteQuestionMutation = useMutation({
        mutationFn: api.deleteQuestion,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] })
    });

    const addAttemptMutation = useMutation({
        mutationFn: api.insertExamAttempt,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exam_attempts'] })
    });

    // --- REAL-TIME SUBSCRIPTIONS ---
    useEffect(() => {
        if (!enabled) return;

        const channel = supabase.channel('realtime-training')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, () => {
                queryClient.invalidateQueries({ queryKey: ['exams'] });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => {
                queryClient.invalidateQueries({ queryKey: ['questions'] });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_attempts' }, () => {
                queryClient.invalidateQueries({ queryKey: ['exam_attempts'] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, enabled]);

    return {
        exams: examsQuery.data || [],
        questions: questionsQuery.data || [],
        examAttempts: attemptsQuery.data || [],
        loading: examsQuery.isLoading || questionsQuery.isLoading || attemptsQuery.isLoading,
        error: examsQuery.error || questionsQuery.error || attemptsQuery.error,

        addExam: upsertExamMutation.mutateAsync,
        updateExam: upsertExamMutation.mutateAsync,
        deleteExam: deleteExamMutation.mutateAsync,

        addQuestion: upsertQuestionMutation.mutateAsync,
        updateQuestion: upsertQuestionMutation.mutateAsync,
        deleteQuestion: deleteQuestionMutation.mutateAsync,
        addBulkQuestions: bulkQuestionsMutation.mutateAsync,

        addExamAttempt: addAttemptMutation.mutateAsync,
    };
};
