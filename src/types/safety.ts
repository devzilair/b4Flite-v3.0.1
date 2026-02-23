
export type FsiPriority = 'low' | 'normal' | 'high' | 'critical';

export interface FsiDocument {
    id: string;
    title: string;
    documentNumber?: string;
    revision?: number;
    issueDate: string;
    content: string;
    status: 'draft' | 'published' | 'archived';
    assignedTo: 'all_in_department' | string[]; // string[] contains staffIds
    departmentId?: string;
    documentUrl?: string;
    priority?: FsiPriority;
    category?: string;
}

export interface FsiAcknowledgment {
    id?: string;
    documentId: string;
    staffId: string;
    acknowledgedAt: string;
}
