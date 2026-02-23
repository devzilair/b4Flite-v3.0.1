'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Staff, AccountStatus } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useStaff } from '@/hooks/useStaff';
import useLocalStorage from '@/hooks/useLocalStorage';

const StaffCard: React.FC<{ staff: Staff; departmentName: string; roleName: string; onClick: () => void }> = ({ staff, departmentName, roleName, onClick }) => {
    const statusStyles = {
        active: 'bg-status-success/20 text-status-success',
        disabled: 'bg-status-danger/20 text-status-danger',
    };
    return (
        <div onClick={onClick} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex items-center space-x-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center text-brand-primary text-2xl font-bold">
                {staff.name.charAt(0)}
            </div>
            <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{staff.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{roleName}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    {departmentName}
                    {staff.subDepartments && staff.subDepartments.length > 0 && (
                        <span className="text-xs text-gray-500 ml-1">({staff.subDepartments[0]})</span>
                    )}
                </p>
            </div>
            <div className="text-right">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${statusStyles[staff.accountStatus]}`}>
                    {staff.accountStatus}
                </span>
            </div>
        </div>
    );
};


const StaffPage: React.FC = () => {
    const { staff, departments, roles, loading } = useStaff();

    // Use local storage to persist filters across navigation
    const [filters, setFilters] = useLocalStorage('staff_directory_filters_v2', {
        search: '',
        department: 'all',
        subDepartment: 'all',
        role: 'all',
        status: 'all'
    });

    const router = useRouter();
    const { currentUser, can } = usePermissions();

    const departmentMap = useMemo(() => new Map(departments.map(dept => [dept.id, dept.name])), [departments]);
    const roleMap = useMemo(() => new Map(roles.map(role => [role.id, role.name])), [roles]);

    const viewableStaff = useMemo(() => {
        if (can('staff:view')) {
            return staff; // Admins see everyone
        }
        if (can('staff:view:own_department')) {
            return staff.filter(s => s.departmentId === currentUser?.departmentId); // Managers see their own dept
        }
        return []; // No permission, see no one
    }, [staff, currentUser, can]);

    // Calculate available sub-departments based on the selected Department filter
    const availableSubDepts = useMemo(() => {
        if (filters.department === 'all') {
            // If 'All Departments', gather unique sub-depts from ALL departments
            const allSubs = new Set<string>();
            departments.forEach(d => {
                if (d.subDepartments) {
                    d.subDepartments.forEach(sd => allSubs.add(sd));
                }
            });
            return Array.from(allSubs).sort();
        } else {
            // If specific department, show only its sub-depts
            const dept = departments.find(d => d.id === filters.department);
            return dept?.subDepartments || [];
        }
    }, [departments, filters.department]);

    const filteredStaff = useMemo(() => {
        return viewableStaff.filter(staffMember => {
            const nameMatch = staffMember.name.toLowerCase().includes(filters.search.toLowerCase());
            const departmentMatch = filters.department === 'all' || staffMember.departmentId === filters.department;
            const roleMatch = filters.role === 'all' || staffMember.roleId === filters.role;
            const statusMatch = filters.status === 'all' || staffMember.accountStatus === filters.status;

            const subDeptMatch = filters.subDepartment === 'all' ||
                (staffMember.subDepartments && staffMember.subDepartments.includes(filters.subDepartment));

            return nameMatch && departmentMatch && roleMatch && statusMatch && subDeptMatch;
        });
    }, [viewableStaff, filters]);

    const handleFilterChange = (key: keyof typeof filters, value: string) => {
        setFilters(prev => {
            const next = { ...prev, [key]: value };
            // If department changes, reset sub-department to 'all' to avoid invalid combinations
            if (key === 'department') {
                next.subDepartment = 'all';
            }
            return next;
        });
    };

    if (loading) {
        return <div className="text-center p-8">Loading staff directory...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Staff Directory</h1>
                {can('staff:create') && (
                    <button
                        onClick={() => router.push('/staff/new')}
                        className="w-full md:w-auto bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary transition-colors"
                    >
                        + Add New Staff
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="lg:col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Search</label>
                        <input
                            type="text"
                            placeholder="Name..."
                            value={filters.search}
                            onChange={e => handleFilterChange('search', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Department</label>
                        <select
                            value={filters.department}
                            onChange={e => handleFilterChange('department', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                        >
                            <option value="all">All Departments</option>
                            {departments.map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sub-Department</label>
                        <select
                            value={filters.subDepartment || 'all'}
                            onChange={e => handleFilterChange('subDepartment', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                            disabled={availableSubDepts.length === 0}
                        >
                            <option value="all">All Sub-Depts</option>
                            {availableSubDepts.map(sd => (
                                <option key={sd} value={sd}>{sd}</option>
                            ))}
                        </select>
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role</label>
                        <select
                            value={filters.role}
                            onChange={e => handleFilterChange('role', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                        >
                            <option value="all">All Roles</option>
                            {roles.map(role => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={e => handleFilterChange('status', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                        >
                            <option value="all">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="disabled">Disabled</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStaff.map(staffMember => (
                    <StaffCard
                        key={staffMember.id}
                        staff={staffMember}
                        departmentName={departmentMap.get(staffMember.departmentId) || 'N/A'}
                        roleName={roleMap.get(staffMember.roleId) || 'N/A'}
                        onClick={() => router.push(`/staff/${staffMember.id}`)}
                    />
                ))}
            </div>
            {filteredStaff.length === 0 && (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow-md col-span-full">
                    <p className="text-gray-500 dark:text-gray-400">No staff members found matching your criteria.</p>
                </div>
            )}
        </div>
    );
};

export default StaffPage;
