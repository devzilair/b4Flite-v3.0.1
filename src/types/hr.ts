
export interface ChecklistTemplate {
    id: string;
    name: string;
    type: 'onboarding' | 'offboarding';
    items: ChecklistItemDefinition[];
}

export interface ChecklistItemDefinition {
    id: string;
    label: string;
}

export interface LifecycleProcess {
    templateId: string;
    templateName: string;
    startDate: string;
    completedDate?: string;
    items: {
        id: string;
        label: string;
        completed: boolean;
        completedBy?: string;
        completedAt?: string;
    }[];
}

export type GoalStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface EmployeeGoal {
    id: string;
    staffId: string;
    title: string;
    description?: string;
    status: GoalStatus;
    progress: number;
    dueDate?: string;
}

export interface PerformanceTemplate {
    id: string;
    name: string;
    sections: ReviewSection[];
}

export interface ReviewSection {
    id: string;
    title: string;
    items: {
        id: string;
        label: string;
        type: 'rating' | 'text';
        description?: string;
    }[];
}

export interface PerformanceReview {
    id: string;
    staffId: string;
    templateId: string;
    templateName: string;
    status: 'draft' | 'self_evaluation' | 'manager_review' | 'completed';
    periodStart: string;
    periodEnd: string;
    selfResponses: Record<string, ReviewItemResponse>;
    managerResponses: Record<string, ReviewItemResponse>;
    overallRating?: number;
    finalComments?: string;
    completedAt?: string;
}

export interface ReviewItemResponse {
    itemId: string;
    rating?: number;
    comment?: string;
}
