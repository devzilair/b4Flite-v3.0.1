
export type AccountStatus = 'active' | 'disabled' | 'archived';

export type Permission = string;

// Organized Permissions List for Clarity
export const ALL_PERMISSIONS: Permission[] = [
    // --- ROSTER ---
    'roster:view:own_department',  // View rosters for own dept
    'roster:view:all',             // View rosters for ALL depts
    'roster:edit',                 // Edit rosters (requires view rights)
    'roster:publish',              // Publish draft rosters
    'roster:lock',                 // Lock published rosters
    'roster:force_edit',           // Edit locked rosters (Admin override)

    // --- STAFF MANAGEMENT ---
    'staff:view',                  // View global staff directory
    'staff:view:own_department',   // View own department staff
    'staff:create',                // Add new staff
    'staff:edit',                  // Edit staff details
    'staff:edit_role',             // Change roles/permissions (High Security)
    'staff:manage_documents',      // Upload/Delete docs for anyone
    'staff:manage_documents:own_department', // Upload/Delete docs for own dept

    // --- LEAVE & TIME OFF ---
    'leave_planner:view:own_department',
    'leave_planner:view:all',
    'leave_planner:view_balances', // See how many days people have left
    'leave_planner:approve',       // Approve/Deny requests
    'leave_planner:sign_director', // Executive Director Signature
    'myleave:create',              // Standard user right to request leave

    // --- SAFETY & COMPLIANCE ---
    'fsi:view',                    // Read Notices
    'fsi:manage',                  // Create/Edit/Delete Notices Global
    'fsi:manage:own_department',   // Create Notices for Own Dept

    // --- TRAINING & EXAMS ---
    'exams:take',                  // Take assigned exams
    'exams:manage',                // Create Exams/Questions Global
    'exams:manage:own_department', // Create Exams for Own Dept
    'crew_records:view_own',       // View own expirations
    'crew_records:view_all',       // View all crew expirations (Matrix)
    'crew_records:manage_all',     // Edit qualifications for others

    // --- FLIGHT LOGS ---
    'duty_log:view_own',           // View own log
    'duty_log:view_all',           // View logs for others (Dept or Global based on scope)

    // --- LUNCH ---
    'lunch:view',                  // See menu and order
    'lunch:manage',                // Create menus/View kitchen reports

    // --- REPORTING ---
    'reports:view',                // Access Reports Page

    // --- ADMINISTRATION ---
    'admin:view_settings',         // Read-only access to settings
    'admin:edit_departments',      // Create/Delete Departments & Sub-Depts
    'admin:edit_work_codes',       // Manage Shift Codes
    'admin:edit_leave_types',      // Manage Leave Types
    'admin:edit_roster_settings',  // Manage Roster Rules/Layouts
    'admin:manage_roles',          // Create/Edit Roles
    'admin:edit_public_holidays',  // Manage Calendar
    'admin:edit_leave_policies',   // Manage Accrual Rules
    'admin:edit_custom_fields',    // Manage Profile Fields
    'admin:edit_hr_settings',      // Manage HR Templates/Checklists
    'admin:edit_performance_settings', // Manage Review Templates
    'admin:edit_qualifications',   // Manage Cert Types
    'admin:view_audit_logs',       // View Security Logs
    'admin:edit_aircraft_types',   // Manage Fleet
];

export interface Role {
    id: string;
    name: string;
    permissions: Permission[];
}

export type FontSize = 'text-xs' | 'text-sm' | 'text-base' | 'text-lg' | 'text-xl';
export const FONT_SIZES: FontSize[] = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl'];

export type SizeUnit = 'px' | 'rem' | 'ch';

export interface DigitalSignature {
    signedBy: string;
    signedAt: string; // ISO date
    signerId: string;
}

export interface Notification {
    id: string;
    userId: string;
    sourceId: string;
    message: string;
    type: 'leave_request' | 'fsi_document' | 'info';
    link: string;
    timestamp: string;
    isRead: boolean;
}

export interface ToastMessage {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    duration?: number;
}
