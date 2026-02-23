
import React, { useState, useEffect } from 'react';
import { Department, SubDepartmentRule, ALL_PERMISSIONS, Staff } from '../../types';

interface SubDeptRulesModalProps {
    isOpen: boolean;
    onClose: () => void;
    department: Department;
    existingRules: SubDepartmentRule[];
    staffList: Staff[];
    onSave: (rules: SubDepartmentRule[], staffUpdates: { staffId: string, managedSubDepartments: string[] }[]) => Promise<void>;
}

const SubDeptRulesModal: React.FC<SubDeptRulesModalProps> = ({ isOpen, onClose, department, existingRules, staffList, onSave }) => {
    const [rules, setRules] = useState<SubDepartmentRule[]>([]);
    const [staffManagers, setStaffManagers] = useState<Record<string, string[]>>({});
    const [isSaving, setIsSaving] = useState(false);

    const potentialManagers = React.useMemo(() => {
        return staffList.filter(s => s.departmentId === department.id && (s.roleId === 'role_manager' || s.individualPermissions?.includes('staff:edit')));
    }, [staffList, department.id]);

    // Group permissions for better UI
    const permissionGroups = React.useMemo<Record<string, string[]>>(() => {
        const groups: Record<string, string[]> = {};
        ALL_PERMISSIONS.forEach(p => {
            const prefix = p.split(':')[0];
            const key = prefix.replace('_', ' ').toUpperCase();
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });
        return groups;
    }, []);

    useEffect(() => {
        if (isOpen) {
            // Ensure we have a rule entry for every sub-department in the department
            const deptSubDepts = department.subDepartments || [];
            const mergedRules = deptSubDepts.map(sd => {
                const existing = existingRules.find(r => r.subDepartment === sd);
                return existing || { subDepartment: sd, permissions: [] };
            });
            setRules(mergedRules);

            // Init staff managers mapping
            const initialManagers: Record<string, string[]> = {};
            deptSubDepts.forEach(sd => {
                initialManagers[sd] = staffList
                    .filter(s => s.managedSubDepartments?.includes(sd))
                    .map(s => s.id);
            });
            setStaffManagers(initialManagers);
        }
    }, [isOpen, department, existingRules, staffList]);

    const handleTogglePermission = (subDept: string, permission: string) => {
        setRules(prev => prev.map(r => {
            if (r.subDepartment !== subDept) return r;
            const hasPerm = r.permissions.includes(permission);
            return {
                ...r,
                permissions: hasPerm
                    ? r.permissions.filter(p => p !== permission)
                    : [...r.permissions, permission]
            };
        }));
    };

    const handleToggleManager = (subDept: string, staffId: string) => {
        setStaffManagers(prev => {
            const managers = prev[subDept] || [];
            return {
                ...prev,
                [subDept]: managers.includes(staffId)
                    ? managers.filter(id => id !== staffId)
                    : [...managers, staffId]
            };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Only save rules that actually have permissions
            const cleanRules = rules.filter(r => r.permissions.length > 0);

            // Calculate staff updates for managedSubDepartments
            const staffUpdates: { staffId: string, managedSubDepartments: string[] }[] = [];
            staffList.forEach(staff => {
                if (staff.departmentId !== department.id) return;
                const currentManaged = staff.managedSubDepartments || [];
                const newManaged = [...currentManaged];
                let changed = false;

                (department.subDepartments || []).forEach(sd => {
                    const shouldBeManager = staffManagers[sd]?.includes(staff.id);
                    const isManager = newManaged.includes(sd);

                    if (shouldBeManager && !isManager) {
                        newManaged.push(sd);
                        changed = true;
                    } else if (!shouldBeManager && isManager) {
                        const index = newManaged.indexOf(sd);
                        if (index > -1) {
                            newManaged.splice(index, 1);
                            changed = true;
                        }
                    }
                });

                if (changed) {
                    staffUpdates.push({ staffId: staff.id, managedSubDepartments: newManaged });
                }
            });

            await onSave(cleanRules, staffUpdates);
        } catch (err) {
            console.error(err);
            alert("Failed to save rules. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Sub-Department Access Rules</h2>
                        <p className="text-sm text-gray-500">Configure what staff in <span className="font-bold">{department.name}</span> can do based on their sub-department.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                <div className="flex-grow overflow-y-auto p-6">
                    {rules.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                            <p>No sub-departments defined for this department.</p>
                            <p className="text-xs mt-1">Add sub-departments in the department list first.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {rules.map((rule) => (
                                <div key={rule.subDepartment} className="border dark:border-gray-700 rounded-lg overflow-hidden">
                                    <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 border-b dark:border-gray-600 flex justify-between items-center">
                                        <h3 className="font-bold text-gray-800 dark:text-white">{rule.subDepartment}</h3>
                                        <span className="text-xs bg-white dark:bg-gray-600 px-2 py-0.5 rounded border dark:border-gray-500">
                                            {rule.permissions.length} Permissions
                                        </span>
                                    </div>
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {(Object.entries(permissionGroups) as [string, string[]][]).map(([groupName, perms]) => (
                                            <div key={groupName} className="space-y-2">
                                                <h4 className="text-xs font-bold text-brand-primary uppercase tracking-wider border-b dark:border-gray-700 pb-1 mb-2">{groupName}</h4>
                                                {perms.map(perm => (
                                                    <label key={perm} className="flex items-start cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={rule.permissions.includes(perm)}
                                                            onChange={() => handleTogglePermission(rule.subDepartment, perm)}
                                                            className="mt-0.5 h-4 w-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary"
                                                        />
                                                        <span className="ml-2 text-xs text-gray-700 dark:text-gray-300 break-words">
                                                            {perm.split(':')[1]?.replace(/_/g, ' ') || perm}
                                                            {perm.split(':')[2] ? ` (${perm.split(':')[2].replace(/_/g, ' ')})` : ''}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800/80 p-4 border-t dark:border-gray-700">
                                        <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3">Sub-Department Managers</h4>
                                        <p className="text-xs text-gray-500 mb-3">Assign staff members (who have manager roles or edit permissions) to manage staff in this sub-department.</p>
                                        {potentialManagers.length === 0 ? (
                                            <p className="text-xs italic text-gray-400">No managers found in this department.</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-4">
                                                {potentialManagers.map(m => (
                                                    <label key={m.id} className="flex items-center cursor-pointer hover:bg-white dark:hover:bg-gray-700 p-1.5 rounded border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={(staffManagers[rule.subDepartment] || []).includes(m.id)}
                                                            onChange={() => handleToggleManager(rule.subDepartment, m.id)}
                                                            className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                        />
                                                        <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                            {m.name}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
                    <button onClick={onClose} disabled={isSaving} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 disabled:opacity-50">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-brand-primary text-white font-bold rounded hover:bg-brand-secondary shadow-sm disabled:opacity-50 flex items-center gap-2">
                        {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                        {isSaving ? 'Saving...' : 'Save Rules'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubDeptRulesModal;
