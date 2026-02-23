
import { SizeUnit, FontSize } from './base';

export interface RosterViewTemplate {
    id: string;
    name: string;
    type: 'standard' | 'pilot';
}

export interface RosterSettings {
    columnWidth: number | { value: number; unit: SizeUnit };
    rowHeight: { value: number; unit: SizeUnit };
    showSubDepartment: boolean;
    weekendHighlightColor: string;
    rosterGroups: RosterGroup[];
    groupHeaderWidth: { value: number; unit: SizeUnit };
    staffMemberColWidth: { value: number; unit: SizeUnit };
    validationRuleSetIds?: string[];
    includeWeekendsInLeave?: boolean;
    printConfig?: {
        fontSize?: string;
        rowHeight?: string;
        margins?: string;
        groupColumnWidth?: string;
        staffColumnWidth?: string;
        footerFontSize?: string;
        groupHeaderFontSize?: string;
    };
}

export interface RosterGroup {
    id: string;
    name: string;
    subDepartmentFilter: string[];
    groupHeaderOrientation: 'vertical' | 'horizontal';
    minRowsPerGroup: number;
    groupHeaderTextSize?: FontSize;
    color?: string; // used in pilot sub groups
}

export interface PilotRosterSettings {
    columnWidth: { value: number; unit: SizeUnit };
    rowHeight: { value: number; unit: SizeUnit };
    statisticsColumns: PilotRosterStatisticsColumn[];
    notes?: { id: string; text: string }[];
    printConfig?: {
        fontSize?: string;
        rowHeight?: string;
        margins?: string;
        dateColumnWidth?: string;
        statsColumnWidth?: string;
    };
}

export interface PilotRosterStatisticsColumn {
    id: string;
    label: string;
    visible: boolean;
}

export interface PilotRosterMainGroup {
    id: string;
    name: string;
    subGroups: PilotRosterSubGroup[];
}

export interface PilotRosterSubGroup {
    id: string;
    name: string;
    color?: string;
    staffIds: string[];
}

export type RosterStatus = 'draft' | 'published' | 'locked';

export interface RosterSnapshot {
    staffIds: string[];
    layout?: PilotRosterMainGroup[];
}

export interface RosterMetaData {
    status: RosterStatus;
    lastUpdated?: string;
    snapshot?: RosterSnapshot;
}

export type AllRosterMetaData = Record<string, RosterMetaData>; // Key: "{departmentId}_{monthKey}"

export interface RosterEntry {
    dutyCodeId?: string;
    note?: string;
    violation?: string;
    isUnderlined?: boolean;
    isLeaveOverlay?: boolean;
    customColor?: string; // Override background color for specific days
}

export type RosterData = Record<string, Record<string, RosterEntry>>; // Date -> StaffId -> Entry

export type DepartmentalRosters = Record<string, Record<string, RosterData>>; // MonthKey -> DeptId -> RosterData

export type SwapStatus = 'pending_peer' | 'pending_manager' | 'approved' | 'rejected';

export interface DutySwap {
    id: string;
    requesterStaffId: string;
    targetStaffId: string;
    date: string; // YYYY-MM-DD
    status: SwapStatus;
    createdAt: string;
    managerId?: string;
    notes?: string;
    departmentId: string;
}
