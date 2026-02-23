
import { supabase } from '../supabaseClient';
import { ChecklistTemplate, EmployeeGoal, PerformanceTemplate, PerformanceReview } from '../../types';
import { toCamelCase, toSnakeCase, safeFetch } from './shared';

export const getChecklistTemplates = () => safeFetch<ChecklistTemplate>('checklist_templates');
export const getEmployeeGoals = () => safeFetch<EmployeeGoal>('employee_goals');
export const getPerformanceTemplates = () => safeFetch<PerformanceTemplate>('performance_templates');
export const getPerformanceReviews = () => safeFetch<PerformanceReview>('performance_reviews');

export const upsertChecklistTemplate = async (template: Partial<ChecklistTemplate>): Promise<void> => {
    const { error } = await supabase.from('checklist_templates').upsert(toSnakeCase(template));
    if (error) throw error;
};

export const deleteChecklistTemplate = async (id: string): Promise<void> => {
    const { error } = await supabase.from('checklist_templates').delete().eq('id', id);
    if (error) throw error;
};

export const upsertEmployeeGoal = async (goal: Partial<EmployeeGoal>): Promise<void> => {
    const { error } = await supabase.from('employee_goals').upsert(toSnakeCase(goal));
    if (error) throw error;
};

export const deleteEmployeeGoal = async (id: string): Promise<void> => {
    const { error } = await supabase.from('employee_goals').delete().eq('id', id);
    if (error) throw error;
};

export const upsertPerformanceTemplate = async (template: Partial<PerformanceTemplate>): Promise<void> => {
    const { error } = await supabase.from('performance_templates').upsert(toSnakeCase(template));
    if (error) throw error;
};

export const deletePerformanceTemplate = async (id: string): Promise<void> => {
    const { error } = await supabase.from('performance_templates').delete().eq('id', id);
    if (error) throw error;
};

export const upsertPerformanceReview = async (review: Partial<PerformanceReview>): Promise<void> => {
    const { error } = await supabase.from('performance_reviews').upsert(toSnakeCase(review));
    if (error) throw error;
};

export const deletePerformanceReview = async (id: string): Promise<void> => {
    const { error } = await supabase.from('performance_reviews').delete().eq('id', id);
    if (error) throw error;
};
