
import { useMemo } from 'react';
import { Permission } from '../types';
import { useStaff } from './useStaff';
import { useSettings } from './useSettings';
import { useAuth } from '../contexts/AuthContext';

export const usePermissions = () => {
    const { staff, roles, loading: staffLoading } = useStaff();
    const { departmentSettings, loading: settingsLoading } = useSettings();
    const { user: authUser } = useAuth();

    const loading = staffLoading || settingsLoading;

    const currentUser = useMemo(() => {
        if (!authUser || staffLoading) return null;

        // Find staff profile by matching the auth user's ID to the profile's authId
        return staff.find(s => s.authId === authUser.id) || null;

    }, [authUser, staff, staffLoading]);

    const userRole = useMemo(() => {
        if (!currentUser) return null;
        return roles.find(r => r.id === currentUser.roleId) || null;
    }, [currentUser, roles]);

    // Get settings for user's department to check sub-dept rules
    const currentDeptSettings = useMemo(() => {
        if (!currentUser || !departmentSettings) return null;
        return (departmentSettings as any)?.[currentUser.departmentId] || null;
    }, [currentUser, departmentSettings]);

    const can = useMemo(() => (permission: Permission): boolean => {
        if (!currentUser || !userRole) return false;

        // 1. Super Admin Bypass
        if (userRole.id === 'role_super_admin') return true;

        // 2. Role-Based Permissions
        const rolePermissions = userRole.permissions || [];
        if (rolePermissions.includes(permission)) return true;

        // 3. Individual Profile Overrides
        const individualPermissions = currentUser.individualPermissions || [];
        if (individualPermissions.includes(permission)) return true;

        // 4. Sub-Department Rules
        // If the user belongs to a sub-department that has been granted this permission
        if (currentDeptSettings && currentDeptSettings.subDepartmentRules && currentUser.subDepartments) {
            const userSubDepts = new Set(currentUser.subDepartments);

            // Find all rules that apply to this user
            const relevantRules = currentDeptSettings.subDepartmentRules.filter((rule: any) =>
                userSubDepts.has(rule.subDepartment)
            );

            // Check if any rule grants the permission
            if (relevantRules.some((rule: any) => rule.permissions.includes(permission))) {
                return true;
            }
        }

        return false;
    }, [currentUser, userRole, currentDeptSettings]);

    return { currentUser, userRole, can, loading };
};
