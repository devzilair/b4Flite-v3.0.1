
export interface Exam {
    id: string;
    title: string;
    questionIds: string[];
    timeLimitMinutes: number;
    passMarkPercentage: number;
    assignedAircraftType?: string;
    departmentId?: string;
    randomizeQuestions?: boolean;
    questionsPerExam?: number;
    validityMonths?: number;
    showReview?: boolean;
    timeLimitPerQuestion?: number;
    coolDownMinutes?: number;
    referenceMaterialUrl?: string;
    assignedTo?: 'all_in_department' | string[];
    status?: 'active' | 'draft' | 'archived';
    dueDate?: string;
    categoryRules?: Record<string, number>; // Maps category name to number of questions to pick
}

export interface Question {
    id: string;
    text: string;
    type: 'mcq' | 'true_false';
    options?: string[];
    correctAnswer: string;
    category?: string;
    departmentId?: string;
    imageUrl?: string;
}

export interface ExamAttempt {
    id?: string; // Optional because it might be created client-side before insert
    examId: string;
    staffId: string;
    status: 'passed' | 'failed' | 'pending';
    score: number;
    categoryScores?: Record<string, number>;
    completedAt: string;
    expiryDate?: string;
    answers: Record<string, string>;
}
