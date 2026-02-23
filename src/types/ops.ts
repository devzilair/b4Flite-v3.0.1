
import { MajorType } from './staff';

export interface FlightLogRecord {
    id?: string;
    staffId: string;

    // Core Fields
    date: string;
    dutyStart?: string | null;
    dutyEnd?: string | null;
    fdpStart?: string | null;
    fdpEnd?: string | null;
    breakStart?: string | null;
    breakEnd?: string | null;
    standbyOn?: string | null;
    standbyOff?: string | null;
    remarks?: string | null;
    sectors?: number | null;
    isTwoPilotOperation?: boolean;
    isSplitDuty?: boolean;
    aircraftType?: string | null;
    flightHoursByAircraft?: Record<string, number> | null;

    // Additional fields
    flightOn?: string; // Legacy support or direct mapping from form
    flightOff?: string;
}

export interface QualificationType {
    id: string;
    name: string;
    code: string;
    departmentId?: string; // if null, applies to all
    validityMonths: number;
    warningDays: number;
}

export interface AircraftType {
    id: string;
    name: string;
    category: MajorType;
    isTurbine: boolean;
    isMultiEngine: boolean;
}

export interface LicenseType {
    id: string;
    name: string;
}

export interface SpecialQualification {
    id: string;
    name: string;
    description?: string;
}

export interface FlightHoursAdjustment {
    id: string;
    staffId: string;
    date: string;
    hours: number;
    description: string;
    category: MajorType;
    aircraftTypeId?: string;
    isTurbine: boolean;
    isMultiEngine: boolean;
}
