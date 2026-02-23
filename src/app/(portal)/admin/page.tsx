'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import RosterSettings from '@/components/settings/RosterSettings';
import LeaveSettingsTab from '@/components/settings/LeaveSettingsTab';
import DepartmentsSettingsTab from '@/components/settings/DepartmentsSettingsTab';
import ValidationSettingsTab from '@/components/settings/ValidationSettingsTab';
import PublicHolidaysTab from '@/components/settings/PublicHolidaysTab';
import LeavePoliciesTab from '@/components/settings/LeavePoliciesTab';
import CustomFieldsTab from '@/components/settings/CustomFieldsTab';
import RolesSettingsTab from '@/components/settings/RolesSettingsTab';
import HRSettingsTab from '@/components/settings/HRSettingsTab';
import PerformanceSettingsTab from '@/components/settings/PerformanceSettingsTab';
import BackupTab from '@/components/settings/BackupTab';
import QualificationsSettingsTab from '@/components/settings/QualificationsSettingsTab';
import AircraftTypesTab from '@/components/settings/AircraftTypesTab';
import LicenseTypesTab from '@/components/settings/LicenseTypesTab';
import SpecialQualificationsTab from '@/components/settings/SpecialQualificationsTab';
import SystemUsageTab from '@/components/settings/SystemUsageTab';
import EmailSettingsTab from '@/components/settings/EmailSettingsTab';
import { usePermissions } from '@/hooks/usePermissions';
import ShiftCodeModal from '@/components/settings/ShiftCodeModal';
import { ShiftCodeDefinition, DepartmentSettings } from '@/types';
import { useSettings } from '@/hooks/useSettings';
import { useStaff } from '@/hooks/useStaff';

// --- Icons ---
const Icons = {
    Building: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    Users: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    List: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
    Briefcase: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    Calendar: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Shield: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    Academic: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.083 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.083 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>,
    Plane: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
    Database: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>,
    Sun: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Chart: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    Refresh: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
};

const SettingsPageContent: React.FC = () => {
    const { departments } = useStaff();
    const { departmentSettings, updateDepartmentSettings, leaveTypes, loading: settingsLoading } = useSettings();

    const { can, currentUser } = usePermissions();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');

    // Read active tab from URL or default to 'departments'
    const activeTab = searchParams.get('tab') || 'departments';
    const handleTabChange = (tabId: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tabId);
        router.push(`${pathname}?${params.toString()}`);
    };

    // Modal State Logic from URL
    const modalType = searchParams.get('modal');
    const modalItemId = searchParams.get('itemId');
    const isShiftCodeModalOpen = modalType === 'shift_code';

    const hasHrAccess = can('admin:edit_hr_settings') || currentUser?.hasHrRights;

    useEffect(() => {
        if (departments.length > 0 && !selectedDepartmentId) {
            setSelectedDepartmentId(departments[0].id);
        }
    }, [departments, selectedDepartmentId]);

    const GROUPS = [
        { id: 'organization', title: 'Organization', icon: Icons.Building },
        { id: 'operations', title: 'Operations & Roster', icon: Icons.Briefcase },
        { id: 'personnel', title: 'Personnel & Training', icon: Icons.Academic },
        { id: 'leave', title: 'Leave Management', icon: Icons.Sun },
        { id: 'system', title: 'System & Data', icon: Icons.Database },
    ];

    const TABS = useMemo(() => [
        // Organization
        { id: 'departments', group: 'organization', name: 'Departments', permission: 'admin:edit_departments', icon: Icons.Building },
        { id: 'roles', group: 'organization', name: 'Roles & Permissions', permission: 'admin:manage_roles', icon: Icons.Shield },
        { id: 'custom-fields', group: 'organization', name: 'Custom Fields', permission: 'admin:edit_custom_fields', icon: Icons.List },

        // Operations
        { id: 'work-codes', group: 'operations', name: 'Work Codes', permission: 'admin:edit_work_codes', icon: Icons.Clock },
        { id: 'roster', group: 'operations', name: 'Roster Layout', permission: 'admin:edit_roster_settings', icon: Icons.List },
        { id: 'validation', group: 'operations', name: 'Validation Rules', permission: 'admin:edit_roster_settings', icon: Icons.Shield },
        { id: 'public-holidays', group: 'operations', name: 'Public Holidays', permission: 'admin:edit_public_holidays', icon: Icons.Calendar },
        { id: 'aircraft-types', group: 'operations', name: 'Aircraft Types', permission: 'admin:edit_departments', icon: Icons.Plane },

        // Personnel
        { id: 'hr-settings', group: 'personnel', name: 'HR Settings', permission: 'admin:edit_hr_settings', visible: hasHrAccess, icon: Icons.Users },
        { id: 'performance-settings', group: 'personnel', name: 'Performance', permission: 'admin:edit_performance_settings', icon: Icons.Chart },
        { id: 'qualifications', group: 'personnel', name: 'Training Types', permission: 'admin:edit_qualifications', icon: Icons.Academic },
        { id: 'license-types', group: 'personnel', name: 'Licences', permission: 'admin:edit_departments', icon: Icons.Briefcase },
        { id: 'special-quals', group: 'personnel', name: 'Pilot Ratings', permission: 'admin:edit_departments', icon: Icons.Shield },

        // Leave
        { id: 'leave', group: 'leave', name: 'Leave Types', permission: 'admin:edit_leave_types', icon: Icons.Sun },
        { id: 'leave-policies', group: 'leave', name: 'Leave Policies', permission: 'admin:edit_leave_policies', icon: Icons.List },

        // System
        { id: 'backup', group: 'system', name: 'Backup & Restore', permission: 'admin:view_settings', icon: Icons.Database },
        { id: 'email-settings', group: 'system', name: 'Email Alerts', permission: 'admin:view_settings', icon: Icons.Sun },
        { id: 'usage', group: 'system', name: 'System Usage', permission: 'admin:view_settings', icon: Icons.Chart },
    ].filter(tab => {
        if (tab.visible === false) return false;
        return can(tab.permission as any);
    }), [can, hasHrAccess]);

    const currentSettings = useMemo(() => {
        if (!selectedDepartmentId || !departmentSettings[selectedDepartmentId]) {
            return null;
        }
        return departmentSettings[selectedDepartmentId];
    }, [departmentSettings, selectedDepartmentId]);

    const editingCode = useMemo(() => {
        if (!isShiftCodeModalOpen || !modalItemId || modalItemId === 'new' || !currentSettings) return null;
        return (currentSettings.shiftCodes || []).find((c: ShiftCodeDefinition) => c.id === modalItemId) || null;
    }, [isShiftCodeModalOpen, modalItemId, currentSettings]);

    const closeModal = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('modal');
        params.delete('itemId');
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleShiftCodeSave = (codeToSave: ShiftCodeDefinition) => {
        if (!currentSettings) return;
        const newSettings = JSON.parse(JSON.stringify(currentSettings));
        const codes = newSettings.shiftCodes || [];
        const existingIndex = codes.findIndex((c: ShiftCodeDefinition) => c.id === codeToSave.id);

        if (existingIndex > -1) {
            codes[existingIndex] = codeToSave;
        } else {
            codes.push({ ...codeToSave, id: `dc_${selectedDepartmentId}_${Date.now()}` });
        }
        newSettings.shiftCodes = codes;
        updateDepartmentSettings(newSettings, selectedDepartmentId);
        closeModal();
    };

    const handleShiftCodeDelete = (codeId: string) => {
        if (window.confirm('Are you sure you want to delete this work code? This action cannot be undone.')) {
            if (!currentSettings) return;
            const newSettings = JSON.parse(JSON.stringify(currentSettings));
            const codes = newSettings.shiftCodes || [];
            newSettings.shiftCodes = codes.filter((c: ShiftCodeDefinition) => c.id !== codeId);
            updateDepartmentSettings(newSettings, selectedDepartmentId);
        }
    };

    const openModalForEdit = (code: ShiftCodeDefinition) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('modal', 'shift_code');
        params.set('itemId', code.id);
        router.push(`${pathname}?${params.toString()}`);
    }

    const openModalForNew = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('modal', 'shift_code');
        params.set('itemId', 'new');
        router.push(`${pathname}?${params.toString()}`);
    }

    const handleInitializeSettings = () => {
        const defaultSettings: DepartmentSettings = {
            rosterSettings: {
                columnWidth: { value: 50, unit: 'px' },
                rowHeight: { value: 3, unit: 'ch' },
                showSubDepartment: true,
                weekendHighlightColor: '#fffde7',
                rosterGroups: [],
                groupHeaderWidth: { value: 120, unit: 'px' },
                staffMemberColWidth: { value: 200, unit: 'px' },
            },
            shiftCodes: [],
            leaveAccrualPolicies: [],
            pilotRosterLayout: [],
            pilotRosterSettings: {
                columnWidth: { value: 70, unit: 'px' },
                rowHeight: { value: 3, unit: 'ch' },
                statisticsColumns: [
                    { id: 'heli_pilots', label: 'Heli Pilots', visible: true },
                    { id: 'off', label: 'OFF', visible: true },
                    { id: 'ph', label: 'PH', visible: true },
                ]
            }
        };
        updateDepartmentSettings(defaultSettings, selectedDepartmentId);
    };

    if (!can('admin:view_settings')) {
        return (
            <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg">
                <h1 className="text-2xl font-bold text-status-danger">Access Denied</h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">You do not have permission to view this page.</p>
            </div>
        );
    }

    const showDeptSelector = ['work-codes', 'roster', 'leave-policies', 'email-settings'].includes(activeTab);

    return (
        <div className="flex flex-col md:flex-row gap-6 h-full min-h-[calc(100vh-8rem)]">
            {/* SIDEBAR NAVIGATION */}
            <div className="w-full md:w-64 flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Icons.Briefcase />
                        Settings
                    </h2>
                </div>

                {/* Mobile Scrollable Nav */}
                <div className="md:hidden flex overflow-x-auto p-2 gap-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-2 transition-all ${activeTab === tab.id
                                ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                                }`}
                        >
                            <span className="opacity-70"><tab.icon /></span>
                            {tab.name}
                        </button>
                    ))}
                </div>

                {/* Desktop Vertical Nav */}
                <div className="hidden md:block flex-1 overflow-y-auto p-3 space-y-6">
                    {GROUPS.map(group => {
                        const groupTabs = TABS.filter(t => t.group === group.id);
                        if (groupTabs.length === 0) return null;

                        return (
                            <div key={group.id}>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
                                    {group.title}
                                </h3>
                                <div className="space-y-1">
                                    {groupTabs.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => handleTabChange(tab.id)}
                                            className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-3 transition-all ${activeTab === tab.id
                                                ? 'bg-brand-light/20 text-brand-primary font-bold shadow-sm ring-1 ring-brand-light/50'
                                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            <tab.icon />
                                            {tab.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">

                {/* Dynamic Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/30 dark:bg-gray-700/10">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {TABS.find(t => t.id === activeTab)?.name || 'Settings'}
                        </h1>
                    </div>
                    {showDeptSelector && (
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Scope</label>
                            <select
                                value={selectedDepartmentId}
                                onChange={e => setSelectedDepartmentId(e.target.value)}
                                className="appearance-none w-full md:w-64 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-2 px-3 pr-8 rounded-md leading-tight focus:outline-none focus:ring-1 focus:ring-brand-primary text-sm shadow-sm"
                            >
                                {activeTab === 'email-settings' && <option value="all">All Departments (Global)</option>}
                                {departments.map(dept => (
                                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 pt-4 text-gray-500">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {activeTab === 'departments' && <DepartmentsSettingsTab />}
                    {activeTab === 'roles' && <RolesSettingsTab />}
                    {activeTab === 'hr-settings' && <HRSettingsTab />}
                    {activeTab === 'performance-settings' && <PerformanceSettingsTab />}
                    {activeTab === 'qualifications' && <QualificationsSettingsTab />}
                    {activeTab === 'aircraft-types' && <AircraftTypesTab />}
                    {activeTab === 'license-types' && <LicenseTypesTab />}
                    {activeTab === 'special-quals' && <SpecialQualificationsTab />}
                    {activeTab === 'validation' && <ValidationSettingsTab />}
                    {activeTab === 'custom-fields' && <CustomFieldsTab />}
                    {activeTab === 'public-holidays' && <PublicHolidaysTab />}
                    {activeTab === 'leave-policies' && <LeavePoliciesTab selectedDepartmentId={selectedDepartmentId} />}

                    {activeTab === 'work-codes' && (
                        settingsLoading ? (
                            <div className="text-center p-12 text-gray-500">Loading settings...</div>
                        ) : !currentSettings ? (
                            <div className="text-center p-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Settings Found</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">Work codes configuration is missing for this department.</p>
                                <button onClick={handleInitializeSettings} className="bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-secondary transition-colors shadow-sm font-semibold">
                                    Initialize Default Settings
                                </button>
                            </div>
                        ) : (
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-semibold">Manage Work Codes</h2>
                                    <button onClick={openModalForNew} className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary transition-colors text-sm font-bold shadow-sm">
                                        + New Code
                                    </button>
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 font-semibold">
                                            <tr>
                                                <th className="p-3">Preview</th>
                                                <th className="p-3">Code</th>
                                                <th className="p-3">Description</th>
                                                <th className="p-3">Type</th>
                                                <th className="p-3">Duration (hrs)</th>
                                                <th className="p-3">Leave Mapping</th>
                                                <th className="p-3">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(currentSettings.shiftCodes || []).map(code => (
                                                <tr key={code.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                    <td className="p-3">
                                                        <div style={{ backgroundColor: code.color, color: code.textColor }} className="font-bold text-center rounded-md px-2 py-1 shadow-sm text-xs inline-block min-w-[3rem]">
                                                            {code.code}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-bold">{code.code}</td>
                                                    <td className="p-3 text-gray-600 dark:text-gray-300">{code.description}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${code.isOffDuty ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                                            {code.isOffDuty ? 'Off-Duty' : 'On-Duty'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 font-mono">{code.duration || '-'}</td>
                                                    <td className="p-3 text-gray-500">{leaveTypes.find(lt => lt.id === code.leaveTypeId)?.name || '-'}</td>
                                                    <td className="p-3 space-x-3 whitespace-nowrap">
                                                        <button onClick={() => openModalForEdit(code)} className="text-brand-primary hover:underline font-medium">Edit</button>
                                                        <button onClick={() => handleShiftCodeDelete(code.id)} className="text-red-500 hover:underline font-medium">Delete</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    )}
                    {activeTab === 'leave' && <LeaveSettingsTab />}
                    {activeTab === 'roster' && <RosterSettings selectedDepartmentId={selectedDepartmentId} />}
                    {activeTab === 'email-settings' && <EmailSettingsTab selectedDepartmentId={selectedDepartmentId} />}
                    {activeTab === 'backup' && <BackupTab />}
                    {activeTab === 'usage' && <SystemUsageTab />}
                </div>
            </div>

            {isShiftCodeModalOpen && currentSettings && (
                <ShiftCodeModal
                    isOpen={isShiftCodeModalOpen}
                    onClose={closeModal}
                    onSave={handleShiftCodeSave}
                    existingCode={editingCode}
                    leaveTypes={leaveTypes}
                />
            )}
        </div>
    );
};

const SettingsPage: React.FC = () => (
    <Suspense fallback={<div className="p-8 text-center">Loading settings...</div>}>
        <SettingsPageContent />
    </Suspense>
);

export default SettingsPage;
