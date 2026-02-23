
import { supabase } from '../supabaseClient';
import { Exam, Question, ExamAttempt } from '../../types';
import { toCamelCase, toSnakeCase, safeFetch, logSupabaseError } from './shared';

export const getExams = () => safeFetch<Exam>('exams');
export const getQuestions = () => safeFetch<Question>('questions');

export const getExamAttempts = async (): Promise<ExamAttempt[]> => {
    const { data, error } = await supabase.from('exam_attempts').select('*');
    if (error) {
        logSupabaseError('exam_attempts', error);
        return [];
    }
    return (data || []).map((r: any) => ({
        ...toCamelCase(r),
        answers: r.answers,
        categoryScores: r.category_scores
    }));
};

export const upsertExam = async (exam: Partial<Exam>): Promise<void> => {
    const { error } = await supabase.from('exams').upsert(toSnakeCase(exam));
    if (error) throw error;
};

export const deleteExam = async (id: string): Promise<void> => {
    const { error } = await supabase.from('exams').delete().eq('id', id);
    if (error) throw error;
};

export const upsertQuestion = async (q: Partial<Question>): Promise<void> => {
    const { error } = await supabase.from('questions').upsert(toSnakeCase(q));
    if (error) throw error;
};

export const bulkInsertQuestions = async (questions: Partial<Question>[]): Promise<void> => {
    const snakeQuestions = questions.map(q => toSnakeCase(q));
    const { error } = await supabase.from('questions').insert(snakeQuestions);
    if (error) throw error;
};

export const deleteQuestion = async (id: string): Promise<void> => {
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) throw error;
};

export const insertExamAttempt = async (attempt: Partial<ExamAttempt>): Promise<void> => {
    const payload = toSnakeCase(attempt);
    console.log("API: Inserting exam attempt payload:", payload);
    const { error } = await supabase.from('exam_attempts').insert(payload);
    if (error) {
        console.error("API: Insert failed with error:", error);
        throw error;
    }
};
