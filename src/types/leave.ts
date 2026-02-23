
import { DigitalSignature } from './base';

export interface LeaveAccrualPolicy {
    id: string;
    leaveTypeId: string;
    amount: number;
    frequency: 'monthly' | 'quarterly' | 'annually';
}

export interface LeaveType {
    id: string;
    name: string;
    color: string;
}

export interface LeaveRequest {
    id: string;
    staffId: string;
    status: 'pending' | 'approved' | 'denied';

    // Core Fields
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    destination?: 'local' | 'overseas';
    contactNumber?: string;
    justification?: string;
    notes?: string;
    phDaysApplied?: number | null;
    phPosition?: 'start' | 'end'; // NEW: Track where PH days are applied

    // Signatures
    signatures?: {
        applicant?: DigitalSignature;
        manager?: DigitalSignature;
        executive?: DigitalSignature;
    };
}

export interface LeaveTransaction {
    id: string;
    staffId: string;
    leaveTypeId: string;
    transactionType: 'accrual' | 'leave_taken' | 'adjustment';
    date: string;
    amount: number;
    notes?: string;
    relatedLeaveRequestId?: string;
}
