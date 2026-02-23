import React, { useState, useEffect } from 'react';
import { Role, Permission, ALL_PERMISSIONS } from '../../types';
import { sanitizeString } from '../../utils/sanitization';

interface RoleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (role: Role) => void;
    existingRole: Role | null;
}

const PERMISSION_CATEGORIES: Record<string, { prefix: string; description: string; icon: string }> = {
    'Roster': { prefix: 'roster:', description: 'View and manage duty rosters', icon: '📅' },
    'Staff': { prefix: 'staff:', description: 'View and edit staff profiles', icon: '👥' },
    'Leave Planner': { prefix: 'leave_planner:', description: 'Approve and manage leave', icon: '🏖️' },
    'My Leave': { prefix: 'myleave:', description: 'Personal leave requests', icon: '📝' },
    'Lunch Menu': { prefix: 'lunch:', description: 'Canteen and orders', icon: '🍱' },
    'FSI / Notices': { prefix: 'fsi:', description: 'Safety documents and memos', icon: '📢' },
    'Exams': { prefix: 'exams:', description: 'Training exams and questions', icon: '🎓' },
    'Crew Records': { prefix: 'crew_records:', description: 'Qualifications and certifications', icon: '📜' },
    'Duty Log': { prefix: 'duty_log:', description: 'Flight duty time records', icon: '✈️' },
    'Reporting': { prefix: 'reports:', description: 'Analytics and reports', icon: '📊' },
    'Admin': { prefix: 'admin:', description: 'System settings and configuration', icon: '⚙️' },
};

const QUICK_PRESETS = [
    {
        label: 'Read-Only Staff',
        description: 'View access to rosters, leave, exams, and FSI.',
        icon: '👁️',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-700 dark:text-blue-300',
        permissions: ['roster:view:own_department', 'staff:view:own_department', 'leave_planner:view:own_department', 'fsi:view', 'exams:take', 'duty_log:view_own', 'myleave:create', 'lunch:view'] as Permission[],
    },
    {
        label: 'Dept Manager',
        description: 'Manage roster, approve leave for own department.',
        icon: '🧑‍💼',
        bg: 'bg-indigo-50 dark:bg-indigo-900/20',
        text: 'text-indigo-700 dark:text-indigo-300',
        permissions: ['roster:view:own_department', 'roster:edit', 'roster:publish', 'staff:view', 'staff:edit', 'leave_planner:view:own_department', 'leave_planner:approve', 'leave_planner:view_balances', 'fsi:view', 'fsi:manage:own_department', 'exams:take', 'exams:manage:own_department', 'crew_records:view_all', 'duty_log:view_all', 'reports:view', 'myleave:create', 'lunch:view'] as Permission[],
    },
    {
        label: 'Training Officer',
        description: 'Full access to exams and crew records.',
        icon: '🎓',
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        text: 'text-purple-700 dark:text-purple-300',
        permissions: ['staff:view', 'fsi:view', 'fsi:manage', 'exams:take', 'exams:manage', 'crew_records:view_all', 'crew_records:manage_all', 'reports:view', 'myleave:create', 'lunch:view'] as Permission[],
    },
];

const formatPermissionLabel = (permission: string, prefix: string): string => {
    return permission.replace(prefix, '').replace(/_/g, ' ').replace(/:/g, ' › ');
};

const RoleModal: React.FC<RoleModalProps> = ({ isOpen, onClose, onSave, existingRole }) => {
    const [role, setRole] = useState<Partial<Role>>({ name: '', permissions: [] });
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (existingRole) {
            setRole(existingRole);
        } else {
            setRole({ name: '', permissions: [] });
        }
        setSearchQuery('');
    }, [existingRole, isOpen]);

    if (!isOpen) return null;

    const isEditingSuperAdmin = role.id === 'role_super_admin';
    const currentPermissions = role.permissions || [];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEditingSuperAdmin && role.name !== 'Super Admin') {
            alert("The Super Admin role name cannot be changed.");
            return;
        }
        const roleToSave: Role = {
            id: existingRole?.id || `role_${Date.now()}`,
            name: sanitizeString(role.name) || 'Unnamed Role',
            permissions: role.id === 'role_super_admin' ? [] : currentPermissions,
        };
        onSave(roleToSave);
    };

    const togglePermission = (permission: Permission) => {
        setRole(prev => {
            const perms = prev.permissions || [];
            return {
                ...prev,
                permissions: perms.includes(permission)
                    ? perms.filter(p => p !== permission)
                    : [...perms, permission],
            };
        });
    };

    const toggleCategory = (prefix: string, allSelected: boolean) => {
        const categoryPerms = ALL_PERMISSIONS.filter(p => p.startsWith(prefix));
        setRole(prev => {
            const perms = prev.permissions || [];
            if (allSelected) {
                return { ...prev, permissions: perms.filter(p => !p.startsWith(prefix)) };
            } else {
                const newPerms = [...perms];
                categoryPerms.forEach(p => { if (!newPerms.includes(p)) newPerms.push(p); });
                return { ...prev, permissions: newPerms };
            }
        });
    };

    const applyPreset = (presetPermissions: Permission[]) => {
        setRole(prev => ({ ...prev, permissions: [...presetPermissions] }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center px-8 py-5 border-b dark:border-gray-700 flex-shrink-0 bg-gray-50/50 dark:bg-gray-800/50">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">
                            {existingRole ? 'Configure Access Role' : 'Create New Access Role'}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-primary text-white uppercase tracking-widest">{currentPermissions.length} Active Rights</span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Global Scope</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white leading-none">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-grow flex flex-col overflow-hidden">
                    <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
                        <div className="px-8 pt-6 flex-shrink-0">
                            {/* Role Name */}
                            <div className="mb-6">
                                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1.5 ml-1">Identity Label</label>
                                <input
                                    type="text"
                                    value={role.name || ''}
                                    onChange={e => setRole(prev => ({ ...prev, name: e.target.value }))}
                                    required
                                    disabled={isEditingSuperAdmin}
                                    placeholder="e.g. Flight Operations Lead"
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all focus:bg-white dark:focus:bg-gray-800 disabled:opacity-60"
                                />
                            </div>
                        </div>

                        {isEditingSuperAdmin ? (
                            <div className="px-8 pb-8 flex-grow">
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl flex gap-3">
                                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                    <p className="text-sm text-amber-700 dark:text-amber-400 font-medium italic">The Super Admin role has all permissions by default and cannot be modified.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Quick Presets */}
                                <div className="px-8 pb-6 flex-shrink-0">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-3 ml-1">Speed Templates</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {QUICK_PRESETS.map(preset => (
                                            <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() => applyPreset(preset.permissions)}
                                                className={`flex flex-col items-start p-3 ${preset.bg} border border-transparent hover:border-brand-primary/30 rounded-xl transition-all active:scale-95 text-left group`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xl">{preset.icon}</span>
                                                    <span className={`text-xs font-black ${preset.text}`}>{preset.label}</span>
                                                </div>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight opacity-70 group-hover:opacity-100">{preset.description}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Search */}
                                <div className="px-8 pb-4 flex-shrink-0">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="Search specific rights (e.g. 'publish' or 'roster')..."
                                            className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-brand-primary outline-none transition-all dark:text-white"
                                        />
                                        <svg className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                </div>

                                {/* Permissions Scoped Cards */}
                                <div className="flex-grow overflow-y-auto px-8 pb-8 space-y-4">
                                    {Object.entries(PERMISSION_CATEGORIES).map(([catName, { prefix, description, icon }]) => {
                                        const catPerms = ALL_PERMISSIONS.filter(p => p.startsWith(prefix));
                                        const filteredCatPerms = searchQuery
                                            ? catPerms.filter(p => p.toLowerCase().includes(searchQuery.toLowerCase()))
                                            : catPerms;

                                        if (filteredCatPerms.length === 0) return null;

                                        const selectedInCat = catPerms.filter(p => (role.permissions || []).includes(p));
                                        const allSelected = selectedInCat.length === catPerms.length && catPerms.length > 0;

                                        return (
                                            <div key={catName} className="bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden group/card shadow-sm hover:shadow-md transition-shadow">
                                                <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-700/20 flex justify-between items-center border-b dark:border-gray-700">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xl flex items-center justify-center p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">{icon}</span>
                                                        <div>
                                                            <h4 className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-widest leading-none">{catName}</h4>
                                                            <p className="text-[10px] text-gray-400 font-bold tracking-tight mt-1">{description}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCategory(prefix, allSelected)}
                                                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${allSelected
                                                            ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                                                            : 'bg-brand-primary text-white border-brand-primary hover:bg-brand-secondary'
                                                            }`}
                                                    >
                                                        {allSelected ? 'Drop All' : 'Grab All'}
                                                    </button>
                                                </div>
                                                <div className="p-4 flex flex-wrap gap-2">
                                                    {filteredCatPerms.map(permission => {
                                                        const isChecked = currentPermissions.includes(permission);
                                                        return (
                                                            <button
                                                                key={permission}
                                                                type="button"
                                                                onClick={() => togglePermission(permission)}
                                                                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${isChecked
                                                                    ? 'bg-brand-primary border-brand-primary text-white shadow-xl shadow-brand-primary/10'
                                                                    : 'bg-white dark:bg-gray-800/80 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-brand-primary/40 hover:text-brand-primary'
                                                                    }`}
                                                            >
                                                                {formatPermissionLabel(permission, prefix)}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                        <div className="flex justify-end gap-3 px-8 py-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
                            <button type="button" onClick={onClose} className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors">
                                Cancel
                            </button>
                            <button type="submit" className="px-10 py-2.5 text-sm font-black uppercase tracking-widest bg-brand-primary text-white rounded-xl hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20 active:scale-95">
                                Save Access Role
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RoleModal;
