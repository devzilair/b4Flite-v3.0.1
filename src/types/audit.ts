
export interface AuditLog {
    id: string;
    changedAt: string;
    changedBy: string;
    tableName: string;
    recordId: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    oldData?: any;
    newData?: any;
}
