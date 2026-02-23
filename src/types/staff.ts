
import { AccountStatus, DigitalSignature } from './base';

export type MajorType = 'Helicopter' | 'Fixed Wing';

export interface NextOfKin {
    id: string;
    name: string;
    relationship: string;
    phone: string;
    email: string;
}

export type RosterPermissionLevel = 'none' | 'view' | 'edit';

export interface Staff {
    id: string;
    authId?: string;

    // Core Fields
    name: string;
    email?: string | null;
    phone?: string;
    roleId: string;
    departmentId: string;
    accountStatus: AccountStatus;
    subDepartments: string[];
    individualPermissions: string[];
    managedSubDepartments?: string[]; // Scopes for management (view/edit staff)
    hasHrRights: boolean;

    // Additional fields
    rosterPermissions?: { departmentId: string; level: RosterPermissionLevel }[];
    nextOfKin?: NextOfKin[];
    customFields?: Record<string, any>;
    pilotData?: {
        aircraftCategory?: MajorType[];
        aircraftTypes?: string[]; // IDs
        specialQualifications?: string[]; // IDs
        licenseType?: string; // ID
        seniorityLevel?: number;
        fireFightingHours?: number;
        slungCargoHours?: number;
    };
    hrData?: {
        personal?: {
            dob?: string;
        };
        contract?: {
            type?: string;
            startDate?: string;
            endDate?: string;
            jobTitle?: string;
        };
        immigration?: {
            passportNumber?: string;
            passportExpiry?: string;
            visaNumber?: string;
            visaExpiry?: string;
            banking?: any;
        };
        banking?: any;
    };
    documents?: StaffDocument[];
    lifecycleData?: {
        onboarding?: LifecycleProcess;
        offboarding?: LifecycleProcess;
    };
}

export interface StaffDocument {
    id: string;
    name: string;
    documentUrl: string;
    issueDate: string;
    expiryDate?: string | null;
    qualificationTypeId?: string;
    restrictions?: string; // E.g., "OML", "TML", "VDSL"
}

// Lifecycle types (simplified circular dependency if any)
import { LifecycleProcess } from './hr';
