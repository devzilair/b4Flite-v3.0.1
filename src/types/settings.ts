
import { Permission } from './base';
import { RosterSettings, PilotRosterMainGroup, PilotRosterSettings } from './roster';
import { LeaveAccrualPolicy } from './leave';

export interface EmailSettings {
    // Core Events
    onExamCompletion: boolean;
    onExamFail: boolean;
    onRosterPublish: boolean;
    onLeaveRequest: boolean;
    onLeaveApproval: boolean;
    onDocumentExpiry: boolean;
    onFsiPublish: boolean;
    // Per-event recipient overrides (custom email addresses, comma-separated)
    recipientOverrides?: Record<string, string[]>;
}

export interface SubDepartmentRule {
    subDepartment: string;
    permissions: Permission[];
}

export interface DepartmentSettings {
    rosterSettings: RosterSettings;
    shiftCodes: ShiftCodeDefinition[];
    maxConcurrentLeave?: number;
    leaveAccrualPolicies?: LeaveAccrualPolicy[];
    pilotRosterLayout?: PilotRosterMainGroup[];
    pilotRosterSettings?: PilotRosterSettings;
    subDepartmentRules?: SubDepartmentRule[]; // NEW: Granular Permissions
    emailSettings?: EmailSettings;
}

export interface ShiftCodeDefinition {
    id: string;
    code: string;
    description: string;
    color: string;
    textColor: string;
    isOffDuty: boolean;
    duration?: number;
    leaveTypeId?: string;
}

export interface Department {
    id: string;
    name: string;
    managerId?: string;
    subDepartments?: string[];
    rosterViewTemplateId?: string;
    validationRuleSetId?: string;
}

export interface CustomFieldDefinition {
    id: string;
    name: string;
    type: 'text' | 'number' | 'date';
}

export type ValidationRuleType = 'MAX_CONSECUTIVE_DUTY' | 'MIN_OFF_DAYS_IN_PERIOD' | 'MIN_CONSECUTIVE_OFF_DAYS_IN_PERIOD';

export const ALL_VALIDATION_RULE_TYPES: ValidationRuleType[] = ['MAX_CONSECUTIVE_DUTY', 'MIN_OFF_DAYS_IN_PERIOD', 'MIN_CONSECUTIVE_OFF_DAYS_IN_PERIOD'];

export interface ValidationRule {
    id: string;
    type: ValidationRuleType;
    params: { [key: string]: any };
    errorMessage: string;
}

export interface ValidationRuleSet {
    id: string;
    name: string;
    rules: ValidationRule[];
}

export const VALIDATION_RULE_DEFINITIONS: Record<ValidationRuleType, { params: { name: string; label: string; defaultValue: any }[] }> = {
    MAX_CONSECUTIVE_DUTY: {
        params: [{ name: 'days', label: 'Max Days', defaultValue: 7 }]
    },
    MIN_OFF_DAYS_IN_PERIOD: {
        params: [
            { name: 'days', label: 'Min Off Days', defaultValue: 1 },
            { name: 'period', label: 'Period (Days)', defaultValue: 7 }
        ]
    },
    MIN_CONSECUTIVE_OFF_DAYS_IN_PERIOD: {
        params: [
            { name: 'consecutiveDays', label: 'Min Consecutive Off', defaultValue: 2 },
            { name: 'period', label: 'Period (Days)', defaultValue: 14 }
        ]
    }
};
