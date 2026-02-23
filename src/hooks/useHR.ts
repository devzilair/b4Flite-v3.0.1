
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import * as api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ChecklistTemplate, EmployeeGoal, PerformanceTemplate, PerformanceReview } from '../types';

export const useHR = () => {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const enabled = !!session;

    // --- QUERIES ---
    const checklistsQuery = useQuery({
        queryKey: ['checklist_templates'],
        queryFn: api.getChecklistTemplates,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    const goalsQuery = useQuery({
        queryKey: ['employee_goals'],
        queryFn: api.getEmployeeGoals,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    const perfTemplatesQuery = useQuery({
        queryKey: ['performance_templates'],
        queryFn: api.getPerformanceTemplates,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    const reviewsQuery = useQuery({
        queryKey: ['performance_reviews'],
        queryFn: api.getPerformanceReviews,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    // --- MUTATIONS ---
    const upsertChecklistMutation = useMutation({
        mutationFn: api.upsertChecklistTemplate,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['checklist_templates'] })
    });

    const deleteChecklistMutation = useMutation({
        mutationFn: api.deleteChecklistTemplate,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['checklist_templates'] })
    });

    const upsertGoalMutation = useMutation({
        mutationFn: api.upsertEmployeeGoal,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employee_goals'] })
    });

    const deleteGoalMutation = useMutation({
        mutationFn: api.deleteEmployeeGoal,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employee_goals'] })
    });

    const upsertPerfTemplateMutation = useMutation({
        mutationFn: api.upsertPerformanceTemplate,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['performance_templates'] })
    });

    const deletePerfTemplateMutation = useMutation({
        mutationFn: api.deletePerformanceTemplate,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['performance_templates'] })
    });

    const upsertReviewMutation = useMutation({
        mutationFn: api.upsertPerformanceReview,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['performance_reviews'] })
    });

    const deleteReviewMutation = useMutation({
        mutationFn: api.deletePerformanceReview,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['performance_reviews'] })
    });

    // --- REAL-TIME SUBSCRIPTIONS ---
    useEffect(() => {
        if (!enabled) return;

        const channel = supabase.channel('realtime-hr')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_templates' }, () => {
                queryClient.invalidateQueries({ queryKey: ['checklist_templates'] });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_goals' }, () => {
                queryClient.invalidateQueries({ queryKey: ['employee_goals'] });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'performance_templates' }, () => {
                queryClient.invalidateQueries({ queryKey: ['performance_templates'] });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'performance_reviews' }, () => {
                queryClient.invalidateQueries({ queryKey: ['performance_reviews'] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, enabled]);

    return {
        checklistTemplates: checklistsQuery.data || [],
        employeeGoals: goalsQuery.data || [],
        performanceTemplates: perfTemplatesQuery.data || [],
        performanceReviews: reviewsQuery.data || [],
        
        loading: checklistsQuery.isLoading || goalsQuery.isLoading || perfTemplatesQuery.isLoading || reviewsQuery.isLoading,
        error: checklistsQuery.error || goalsQuery.error || perfTemplatesQuery.error || reviewsQuery.error,

        upsertChecklistTemplate: upsertChecklistMutation.mutateAsync,
        deleteChecklistTemplate: deleteChecklistMutation.mutateAsync,
        
        upsertEmployeeGoal: upsertGoalMutation.mutateAsync,
        deleteEmployeeGoal: deleteGoalMutation.mutateAsync,
        
        upsertPerformanceTemplate: upsertPerfTemplateMutation.mutateAsync,
        deletePerformanceTemplate: deletePerfTemplateMutation.mutateAsync,
        
        upsertPerformanceReview: upsertReviewMutation.mutateAsync,
        deletePerformanceReview: deleteReviewMutation.mutateAsync,
    };
};
