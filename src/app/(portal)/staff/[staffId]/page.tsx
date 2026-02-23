'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { Staff, MajorType, ALL_PERMISSIONS, Permission, RosterPermissionLevel, NextOfKin } from '@/types';
import { sanitizeString, sanitizeEmail, getErrorMessage } from '@/utils/sanitization';
import StaffDocumentsTab from '@/components/staff/StaffDocumentsTab';
import StaffLifecycleTab from '@/components/staff/StaffLifecycleTab';
import StaffPerformanceTab from '@/components/staff/StaffPerformanceTab';
import StaffExamHistory from '@/components/staff/StaffExamHistory';
import StaffExperienceTab from '@/components/staff/StaffExperienceTab';
import StaffLeaveTab from '@/components/staff/StaffLeaveTab';
import StaffPersonalInfoTab from '@/components/staff/StaffPersonalInfoTab';
import StaffEmploymentTab from '@/components/staff/StaffEmploymentTab';
import StaffPilotDataTab from '@/components/staff/StaffPilotDataTab';
import StaffAccessTab from '@/components/staff/StaffAccessTab';
import useLocalStorage from '@/hooks/useLocalStorage';
import { StaffSchema } from '@/schemas';
import { useSettings } from '@/hooks/useSettings';
import { useStaff } from '@/hooks/useStaff';

const PERMISSION_CATEGORIES: Record<string, { prefix: string; description: string }> = {
    'Roster': { prefix: 'roster:', description: 'View and manage duty rosters' },
    'Staff': { prefix: 'staff:', description: 'View and edit staff profiles' },
    'Leave Planner': { prefix: 'leave_planner:', description: 'Approve and manage leave' },
    'My Leave': { prefix: 'myleave:', description: 'Personal leave requests' },
    'Lunch Menu': { prefix: 'lunch:', description: 'Canteen and orders' },
    'Safety (FSI)': { prefix: 'fsi:', description: 'Safety documents and memos' },
    'Exams': { prefix: 'exams:', description: 'Training exams and questions' },
    'Crew Records': { prefix: 'crew_records:', description: 'Qualifications and certifications' },
    'Duty Log': { prefix: 'duty_log:', description: 'Flight duty time records' },
    'Reporting': { prefix: 'reports:', description: 'Analytics and reports' },
    'Admin': { prefix: 'admin:', description: 'System settings and configuration' },
};

const StaffProfilePage: React.FC = () => {
    const params = useParams();
    const staffId = params?.staffId as string;
    const router = useRouter();

    // Core Identity Hook
    const {
        staff: staffList,
        departments,
        roles,
        addStaff,
        updateStaff,
        deleteStaff,
        loading: staffLoading
    } = useStaff();

    // Settings Hook
    const {
        aircraftTypes,
        licenseTypes,
        specialQualifications,
        customFieldDefs,
        qualificationTypes,
        loading: settingsLoading
    } = useSettings();

    const loading = staffLoading || settingsLoading;
    const { currentUser, can } = usePermissions();

    const [staff, setStaff] = useLocalStorage<Partial<Staff>>(`staff_profile_draft_${staffId}`, {});

    // Retrieve filters from local storage to respect Staff Directory state
    // FIX: Updated key to match StaffPage.tsx ('staff_directory_filters_v2') to ensure navigation consistency
    const [filters] = useLocalStorage('staff_directory_filters_v2', {
        search: '',
        department: 'all',
        subDepartment: 'all',
        role: 'all',
        status: 'all'
    });

    const [activeTab, setActiveTab] = useState('profile');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [isSaved, setIsSaved] = useState(false);
    const [permissionSearch, setPermissionSearch] = useState('');

    const isNew = staffId === 'new';
    const isOwnProfile = currentUser?.id === staffId;
    const canEdit = can('staff:edit') || (can('staff:edit_role') && isOwnProfile);
    const canManageHR = can('admin:edit_hr_settings') || (can('staff:view') && currentUser?.hasHrRights);
    const canViewAccessTab = currentUser?.roleId === 'role_super_admin' || can('admin:manage_roles');
    const canViewLeave = isOwnProfile || can('leave_planner:view:own_department') || can('leave_planner:view_all');

    const assignableRoles = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.roleId === 'role_super_admin') return roles;
        if (currentUser.roleId === 'role_admin') return roles.filter(r => r.id !== 'role_super_admin');
        if (currentUser.roleId === 'role_manager') return roles.filter(r => r.id !== 'role_super_admin' && r.id !== 'role_admin');
        return roles.filter(r => r.id !== 'role_super_admin' && r.id !== 'role_admin' && r.id !== 'role_manager');
    }, [roles, currentUser]);

    // Calculate viewable staff based on permissions (Replicated logic from StaffPage)
    // This ensures Managers cannot deep-link to view profiles outside their department
    const viewableStaff = useMemo(() => {
        if (!currentUser) return [];
        if (can('staff:view')) {
            return staffList; // Admins see everyone
        }
        if (can('staff:view:own_department')) {
            return staffList.filter(s => s.departmentId === currentUser?.departmentId); // Managers see their own dept
        }
        return []; // No permission, see no one
    }, [staffList, currentUser, can]);

    // Apply filters to viewable staff to determine navigation order
    const filteredStaffList = useMemo(() => {
        return (viewableStaff || []).filter(staffMember => {
            const nameMatch = staffMember.name.toLowerCase().includes(filters.search.toLowerCase());
            const departmentMatch = filters.department === 'all' || staffMember.departmentId === filters.department;
            const roleMatch = filters.role === 'all' || staffMember.roleId === filters.role;
            const statusMatch = filters.status === 'all' || staffMember.accountStatus === filters.status;

            // Added subDepartment filter logic to match StaffPage
            const subDeptMatch = (filters.subDepartment === 'all' || !filters.subDepartment) ||
                (staffMember.subDepartments && staffMember.subDepartments.includes(filters.subDepartment));

            return nameMatch && departmentMatch && roleMatch && statusMatch && subDeptMatch;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [viewableStaff, filters]);

    const sortedStaffIds = useMemo(() => filteredStaffList.map(s => s.id), [filteredStaffList]);

    const navigation = useMemo(() => {
        if (!staffId || isNew) return { prev: null, next: null };
        const currentIndex = sortedStaffIds.indexOf(staffId);
        if (currentIndex === -1) return { prev: null, next: null };
        return {
            prev: currentIndex > 0 ? sortedStaffIds[currentIndex - 1] : null,
            next: currentIndex < sortedStaffIds.length - 1 ? sortedStaffIds[currentIndex + 1] : null
        };
    }, [staffId, sortedStaffIds, isNew]);

    // SECURITY CHECK: Ensure user is allowed to view this profile
    const hasAccess = useMemo(() => {
        if (loading) return true; // Wait for load
        if (isNew) return can('staff:create'); // Must have create permission for new
        if (isOwnProfile) return true; // Can always see self
        return viewableStaff.some(s => s.id === staffId);
    }, [loading, isNew, isOwnProfile, viewableStaff, staffId, can]);

    useEffect(() => {
        if (loading) return;
        if (isNew) {
            // Only reset if we are freshly entering new mode and don't have a record of it yet
            // If the draft doesn't have a name and isn't marked as draft, initialize
            if (staff.id || !staff.name) {
                setStaff({
                    name: '', email: '', phone: '', roleId: 'role_staff', departmentId: departments[0]?.id || '',
                    accountStatus: 'active', subDepartments: [], customFields: {}, documents: [],
                    individualPermissions: [], managedSubDepartments: [], rosterPermissions: [], nextOfKin: [], hasHrRights: false,
                    pilotData: { aircraftCategory: [], aircraftTypes: [], specialQualifications: [] },
                    hrData: { personal: {}, contract: { type: 'full_time', startDate: '', jobTitle: '' }, immigration: {}, banking: {} }
                });
            }
        } else if (staffId && staffList.length > 0) {
            // Load if current draft doesn't match ID
            if (staff.id !== staffId) {
                const existingStaff = staffList.find(s => s.id === staffId);
                if (existingStaff) {
                    setStaff(JSON.parse(JSON.stringify({
                        ...existingStaff,
                        phone: existingStaff.phone || '',
                        nextOfKin: existingStaff.nextOfKin || [],
                        individualPermissions: existingStaff.individualPermissions || [],
                        managedSubDepartments: existingStaff.managedSubDepartments || [],
                        rosterPermissions: existingStaff.rosterPermissions || [],
                        pilotData: {
                            aircraftCategory: [], aircraftTypes: [], specialQualifications: [],
                            ...(existingStaff.pilotData || {})
                        },
                        hrData: {
                            personal: {},
                            contract: { type: 'full_time', startDate: '', jobTitle: '' },
                            immigration: {},
                            banking: {},
                            ...(existingStaff.hrData || {})
                        },
                        customFields: existingStaff.customFields || {}
                    })));
                }
            }
        }
    }, [staffId, staffList, loading, isNew, departments, setStaff, staff.id]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setStaff(prev => ({ ...prev, [name]: value }));
        setIsSaved(false);
        setValidationErrors([]);
    };

    const handleCustomFieldChange = (fieldId: string, value: string | number) => {
        setStaff(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [fieldId]: value } }));
        setIsSaved(false);
    };

    const handlePilotDataChange = (field: string, value: any) => {
        setStaff(prev => ({ ...prev, pilotData: { ...prev.pilotData, [field]: value } }));
    };

    const handleAircraftTypeToggle = (typeId: string) => {
        setStaff(prev => {
            const currentTypes = prev.pilotData?.aircraftTypes || [];
            const newTypes = currentTypes.includes(typeId) ? currentTypes.filter(t => t !== typeId) : [...currentTypes, typeId];
            return { ...prev, pilotData: { ...prev.pilotData, aircraftTypes: newTypes } };
        });
    };

    const handleSpecialQualToggle = (qualId: string) => {
        setStaff(prev => {
            const currentQuals = prev.pilotData?.specialQualifications || [];
            const newQuals = currentQuals.includes(qualId) ? currentQuals.filter(q => q !== qualId) : [...currentQuals, qualId];
            return { ...prev, pilotData: { ...prev.pilotData, specialQualifications: newQuals } };
        });
    };

    const handleAircraftCategoryToggle = (cat: MajorType) => {
        setStaff(prev => {
            const currentCats = prev.pilotData?.aircraftCategory || [];
            const newCats = currentCats.includes(cat) ? currentCats.filter(c => c !== cat) : [...currentCats, cat];
            return { ...prev, pilotData: { ...prev.pilotData, aircraftCategory: newCats } };
        });
    };

    const handleHRChange = (section: 'personal' | 'contract' | 'immigration' | 'banking', field: string, value: any) => {
        setStaff(prev => ({ ...prev, hrData: { ...prev.hrData, [section]: { ...prev.hrData?.[section], [field]: value } } }));
    };

    const handlePermissionToggle = (permission: Permission) => {
        setStaff(prev => {
            const currentPerms = prev.individualPermissions || [];
            const newPerms = currentPerms.includes(permission) ? currentPerms.filter(p => p !== permission) : [...currentPerms, permission];
            return { ...prev, individualPermissions: newPerms };
        });
        setIsSaved(false);
    };

    const handleCategoryToggle = (prefix: string, allSelected: boolean) => {
        const categoryPerms = ALL_PERMISSIONS.filter(p => p.startsWith(prefix));
        setStaff(prev => {
            const currentPerms = prev.individualPermissions || [];
            if (allSelected) {
                return { ...prev, individualPermissions: currentPerms.filter(p => !p.startsWith(prefix)) };
            } else {
                const newPerms = [...currentPerms];
                categoryPerms.forEach(p => { if (!newPerms.includes(p)) newPerms.push(p); });
                return { ...prev, individualPermissions: newPerms };
            }
        });
        setIsSaved(false);
    };

    const prefillFromRole = (roleId: string) => {
        const selectedRole = roles.find(r => r.id === roleId);
        if (selectedRole && window.confirm(`Replace all current overrides with permissions from the "${selectedRole.name}" role?`)) {
            const permsToApply = roleId === 'role_super_admin' ? ALL_PERMISSIONS : selectedRole.permissions;
            setStaff(prev => ({ ...prev, individualPermissions: [...permsToApply] }));
            setIsSaved(false);
        }
    };

    const handleRosterPermissionChange = (deptId: string, level: 'none' | RosterPermissionLevel) => {
        setStaff(prev => {
            const currentRosterPerms = prev.rosterPermissions || [];
            let newRosterPerms = currentRosterPerms.filter(rp => rp.departmentId !== deptId);
            if (level !== 'none') newRosterPerms.push({ departmentId: deptId, level });
            return { ...prev, rosterPermissions: newRosterPerms };
        });
        setIsSaved(false);
    };

    const handleManagedSubDeptToggle = (subDept: string) => {
        setStaff(prev => {
            const current = prev.managedSubDepartments || [];
            const updated = current.includes(subDept) ? current.filter(s => s !== subDept) : [...current, subDept];
            return { ...prev, managedSubDepartments: updated };
        });
        setIsSaved(false);
    };

    const addNextOfKin = () => setStaff(prev => ({ ...prev, nextOfKin: [...(prev.nextOfKin || []), { id: `nok_${Date.now()}`, name: '', relationship: '', phone: '', email: '' }] }));

    const updateNextOfKin = (index: number, field: keyof NextOfKin, value: string) => {
        setStaff(prev => {
            const updatedNok = [...(prev.nextOfKin || [])];
            updatedNok[index] = { ...updatedNok[index], [field]: value };
            return { ...prev, nextOfKin: updatedNok };
        });
    };

    const removeNextOfKin = (index: number) => setStaff(prev => ({ ...prev, nextOfKin: (prev.nextOfKin || []).filter((_, i) => i !== index) }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationErrors([]);
        setSaveError(null);
        setIsSaved(false);

        const result = StaffSchema.safeParse(staff);
        if (!result.success) {
            const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
            setValidationErrors(errors);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setIsSaving(true);

        const sanitizedStaff = {
            ...staff,
            name: sanitizeString(staff.name),
            email: staff.email && staff.email.trim() !== '' ? sanitizeEmail(staff.email) : null,
            phone: sanitizeString(staff.phone),
            nextOfKin: (staff.nextOfKin || []).map(nok => ({
                id: nok.id || `nok_${Date.now()}_${Math.random()}`,
                name: sanitizeString(nok.name),
                relationship: sanitizeString(nok.relationship),
                phone: sanitizeString(nok.phone),
                email: sanitizeEmail(nok.email)
            })).filter(nok => nok.name),
            pilotData: staff.pilotData ? {
                ...staff.pilotData,
                fireFightingHours: staff.pilotData.fireFightingHours || 0,
                slungCargoHours: staff.pilotData.slungCargoHours || 0,
            } : undefined,
            hrData: staff.hrData ? {
                personal: { ...(staff.hrData.personal || {}) },
                contract: { type: 'full_time' as const, startDate: '', jobTitle: '', ...(staff.hrData.contract || {}) },
                immigration: { ...(staff.hrData.immigration || {}) },
                banking: { ...(staff.hrData.banking || {}) }
            } : undefined,
            individualPermissions: staff.individualPermissions || [],
            managedSubDepartments: staff.managedSubDepartments || [],
            rosterPermissions: staff.rosterPermissions || [],
            customFields: staff.customFields || {},
        };

        try {
            if (isNew) {
                const newStaff = await addStaff(sanitizedStaff);
                if (newStaff) {
                    setStaff(newStaff);
                    router.replace(`/staff/${newStaff.id}`);
                }
            } else {
                await updateStaff(sanitizedStaff as Staff);
                setIsSaved(true);
            }
        } catch (error: any) {
            setSaveError(getErrorMessage(error));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteStaff = async () => {
        if (!staff.id) return;
        if (currentUser?.roleId !== 'role_super_admin') { alert("Only Super Admins can permanently delete staff."); return; }
        if (window.confirm(`DANGER ZONE: Permanent delete ${staff.name}?`)) {
            if (window.confirm(`Final confirmation: Delete ${staff.name}?`)) {
                try { await deleteStaff(staff.id); router.push('/staff'); }
                catch (error: any) { alert("Failed to delete: " + getErrorMessage(error)); }
            }
        }
    };

    if (loading) return <div className="p-8 text-center">Loading profile...</div>;

    if (!hasAccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg">
                    <h2 className="text-3xl font-bold text-red-600 mb-4">Access Denied</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">You do not have permission to view this staff profile. This incident may be logged.</p>
                    <button onClick={() => router.push('/staff')} className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-gray-700 transition-colors">Return to Directory</button>
                </div>
            </div>
        );
    }

    const selectedDept = departments.find(d => d.id === staff.departmentId);
    const availableSubDepts = selectedDept?.subDepartments || [];
    const isPilotDept = selectedDept?.name.toLowerCase().includes('pilot') || selectedDept?.name.toLowerCase().includes('flight');

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{isNew ? 'New Staff Member' : staff.name}</h1>
            </div>

            {validationErrors.length > 0 && (
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded animate-fade-in shadow-md">
                    <h3 className="font-bold mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Validation Required
                    </h3>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                        {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                </div>
            )}

            {saveError && <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">Error: {saveError}</div>}
            {isSaved && <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded">Profile saved successfully.</div>}

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden min-h-[500px]">
                <div className="flex border-b dark:border-gray-700 overflow-x-auto">
                    {['profile', 'hr', 'pilot', 'leave', 'documents', 'performance', 'exams', 'experience', 'lifecycle', 'access'].map(tab => {
                        if (tab === 'hr' && !canManageHR && !isOwnProfile) return null;
                        if (tab === 'pilot' && !isPilotDept) return null;
                        if (tab === 'experience' && !isPilotDept) return null;
                        if (tab === 'leave' && !canViewLeave) return null;
                        if (['documents', 'performance', 'exams', 'experience', 'lifecycle', 'access', 'leave'].includes(tab) && isNew) return null;
                        if (tab === 'access' && !canViewAccessTab) return null;

                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-brand-primary text-brand-primary bg-brand-light/10' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                            >
                                {tab === 'hr' ? 'Employment / HR' : tab === 'pilot' ? 'Pilot Data' : tab === 'exams' ? 'Training & Exams' : tab === 'experience' ? 'Flight Experience' : tab === 'leave' ? 'Leave History' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        );
                    })}
                </div>

                <div className="p-6">
                    {activeTab === 'profile' && (
                        <StaffPersonalInfoTab
                            staff={staff}
                            setStaff={setStaff}
                            handleInputChange={handleInputChange}
                            handleCustomFieldChange={handleCustomFieldChange}
                            handlePilotDataChange={handlePilotDataChange}
                            departments={departments}
                            assignableRoles={assignableRoles}
                            customFieldDefs={customFieldDefs}
                            availableSubDepts={availableSubDepts}
                            can={can}
                            addNextOfKin={addNextOfKin}
                            updateNextOfKin={updateNextOfKin}
                            removeNextOfKin={removeNextOfKin}
                        />
                    )}

                    {activeTab === 'hr' && (
                        <StaffEmploymentTab
                            staff={staff}
                            handleHRChange={handleHRChange}
                        />
                    )}

                    {activeTab === 'pilot' && (
                        <StaffPilotDataTab
                            staff={staff}
                            isNew={isNew}
                            aircraftTypes={aircraftTypes}
                            licenseTypes={licenseTypes}
                            specialQualifications={specialQualifications}
                            qualificationTypes={qualificationTypes}
                            handlePilotDataChange={handlePilotDataChange}
                            handleAircraftCategoryToggle={handleAircraftCategoryToggle}
                            handleSpecialQualToggle={handleSpecialQualToggle}
                            handleAircraftTypeToggle={handleAircraftTypeToggle}
                        />
                    )}

                    {activeTab === 'documents' && <StaffDocumentsTab staff={staff} setStaff={setStaff} />}
                    {activeTab === 'performance' && <StaffPerformanceTab staff={staff as Staff} />}
                    {activeTab === 'exams' && <StaffExamHistory staff={staff as Staff} />}
                    {activeTab === 'experience' && <StaffExperienceTab staff={staff} setStaff={setStaff} />}
                    {activeTab === 'lifecycle' && <StaffLifecycleTab staff={staff} setStaff={setStaff} />}
                    {activeTab === 'leave' && <StaffLeaveTab staff={staff as Staff} />}

                    {activeTab === 'access' && (
                        <StaffAccessTab
                            staff={staff}
                            setStaff={setStaff}
                            setIsSaved={setIsSaved}
                            departments={departments}
                            roles={roles}
                            can={can}
                            currentUser={currentUser}
                            permissionSearch={permissionSearch}
                            setPermissionSearch={setPermissionSearch}
                            PERMISSION_CATEGORIES={PERMISSION_CATEGORIES}
                            handlePermissionToggle={handlePermissionToggle}
                            handleCategoryToggle={handleCategoryToggle}
                            prefillFromRole={prefillFromRole}
                            handleRosterPermissionChange={handleRosterPermissionChange}
                            handleManagedSubDeptToggle={handleManagedSubDeptToggle}
                            handleDeleteStaff={handleDeleteStaff}
                        />
                    )}
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-lg z-40">
                <div className="container mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex gap-3">
                        <button onClick={() => navigation.prev && router.push(`/staff/${navigation.prev}`)} disabled={!navigation.prev} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50">← Prev</button>
                        <button onClick={() => navigation.next && router.push(`/staff/${navigation.next}`)} disabled={!navigation.next} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50">Next →</button>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => router.push('/staff')} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 rounded">Back</button>
                        {canEdit && <button onClick={handleSubmit} disabled={isSaving} className="px-8 py-2 bg-brand-primary text-white rounded hover:bg-brand-secondary font-bold disabled:opacity-50 shadow-md transition-all active:scale-95 uppercase tracking-wide text-sm">Save Profile</button>}
                    </div>
                </div>
            </div>

            <style>{`
                .form-input { display: block; width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; border-radius: 0.375rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #F9FAFB; transition: border-color 0.2s; }
                .form-input:focus { border-color: #0D47A1; outline: none; box-shadow: 0 0 0 2px rgba(13, 71, 161, 0.1); }
                .dark .form-input { background-color: #374151; border-color: #4B5563; color: white; }
                .form-checkbox { color: #0D47A1; border-color: #D1D5DB; border-radius: 0.25rem; }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default StaffProfilePage;
