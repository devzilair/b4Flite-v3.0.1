
import React from 'react';
import { Staff, Role, Permission, ALL_PERMISSIONS } from '../../types';

interface StaffAccessTabProps {
    staff: Partial<Staff>;
    setStaff: (val: Partial<Staff> | ((prev: Partial<Staff>) => Partial<Staff>)) => void;
    setIsSaved: (val: boolean) => void;
    departments: any[];
    roles: Role[];
    can: (permission: string) => boolean;
    currentUser: Staff | null;
    permissionSearch: string;
    setPermissionSearch: (val: string) => void;
    PERMISSION_CATEGORIES: Record<string, { prefix: string; description: string }>;
    handlePermissionToggle: (permission: Permission) => void;
    handleCategoryToggle: (prefix: string, allSelected: boolean) => void;
    prefillFromRole: (roleId: string) => void;
    handleRosterPermissionChange: (deptId: string, level: 'none' | any) => void;
    handleManagedSubDeptToggle: (subDept: string) => void;
    handleDeleteStaff: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
    'Roster': '📅',
    'Staff': '👥',
    'Leave Planner': '🏖️',
    'My Leave': '📝',
    'Lunch Menu': '🍱',
    'FSI / Notices': '📢',
    'Exams': '🎓',
    'Crew Records': '📜',
    'Duty Log': '✈️',
    'Reporting': '📊',
    'Admin': '⚙️',
};

const StaffAccessTab: React.FC<StaffAccessTabProps> = ({
    staff,
    setStaff,
    setIsSaved,
    departments,
    roles,
    can,
    currentUser,
    permissionSearch,
    setPermissionSearch,
    PERMISSION_CATEGORIES,
    handlePermissionToggle,
    handleCategoryToggle,
    prefillFromRole,
    handleRosterPermissionChange,
    handleManagedSubDeptToggle,
    handleDeleteStaff
}) => {
    const staffRole = roles.find(r => r.id === staff.roleId);

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Permissions Override Section */}
            {can('admin:manage_roles') && (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 border dark:border-gray-700 rounded-2xl shadow-sm">
                        <div className="flex-1 w-full">
                            <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                                <span className="p-1.5 bg-brand-primary/10 text-brand-primary rounded-lg">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                </span>
                                Personal Overrides
                            </h3>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Granted in addition to their base role: {staffRole?.name || 'No Role'}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </span>
                                <input
                                    type="text"
                                    value={permissionSearch}
                                    onChange={e => setPermissionSearch(e.target.value)}
                                    placeholder="Search rights..."
                                    className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold w-full sm:w-64 focus:ring-1 focus:ring-brand-primary outline-none transition-all focus:bg-white dark:focus:bg-gray-800"
                                />
                            </div>
                            <select
                                onChange={e => {
                                    if (e.target.value) prefillFromRole(e.target.value);
                                }}
                                className="py-2 px-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-black uppercase tracking-widest focus:ring-1 focus:ring-brand-primary outline-none cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                value=""
                            >
                                <option value="" disabled>Clone from Role...</option>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(PERMISSION_CATEGORIES).map(([catName, { prefix, description }]) => {
                            const catPerms = ALL_PERMISSIONS.filter(p => p.startsWith(prefix));
                            const filteredPerms = permissionSearch
                                ? catPerms.filter(p => p.toLowerCase().includes(permissionSearch.toLowerCase()))
                                : catPerms;

                            if (filteredPerms.length === 0) return null;

                            const currentOverrides = staff.individualPermissions || [];
                            const selectedInCat = catPerms.filter(p => currentOverrides.includes(p));
                            const allSelected = selectedInCat.length === catPerms.length && catPerms.length > 0;
                            const catIcon = CATEGORY_ICONS[catName] || '🛡️';

                            return (
                                <div key={catName} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group/card">
                                    <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-700/20 flex justify-between items-center border-b dark:border-gray-700">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">{catIcon}</span>
                                            <div>
                                                <h4 className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-widest leading-none">{catName}</h4>
                                                <p className="text-[10px] text-gray-400 font-bold tracking-tight mt-1">{description}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleCategoryToggle(prefix, allSelected)}
                                            className={`p-1.5 rounded-lg transition-colors ${allSelected
                                                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                : 'text-brand-primary hover:bg-brand-primary/10'
                                                }`}
                                            title={allSelected ? 'Clear Category' : 'Select All'}
                                        >
                                            {allSelected
                                                ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                            }
                                        </button>
                                    </div>
                                    <div className="p-4 space-y-2">
                                        {filteredPerms.map(perm => {
                                            const isOverride = currentOverrides.includes(perm);
                                            const inherited = staffRole?.permissions.includes(perm);
                                            const label = perm.replace(prefix, '').replace(/_/g, ' ').replace(/:/g, ' › ');

                                            return (
                                                <label
                                                    key={perm}
                                                    className={`group flex items-start gap-3 p-2 rounded-xl border transition-all cursor-pointer ${isOverride
                                                        ? 'bg-brand-primary/5 border-brand-primary/20 shadow-sm shadow-brand-primary/5'
                                                        : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                                        }`}
                                                >
                                                    <div className="pt-0.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!isOverride}
                                                            onChange={() => handlePermissionToggle(perm)}
                                                            className="w-4 h-4 rounded-md border-gray-300 text-brand-primary focus:ring-brand-primary transition-all cursor-pointer"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0 pr-2">
                                                        <span className={`block text-[11px] font-bold truncate transition-colors ${isOverride ? 'text-brand-primary' : 'text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white'
                                                            }`}>
                                                            {label}
                                                        </span>
                                                        {inherited && (
                                                            <div className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded">
                                                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                                                <span className="text-[9px] text-green-700 dark:text-green-400 font-black uppercase tracking-tighter">
                                                                    Included in {staffRole?.name}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Hierarchical Scopes Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Roster Scopes */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                    <div>
                        <h4 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                            <span className="text-xl">📅</span>
                            Roster Oversight
                        </h4>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Departments where this user can manage schedules</p>
                    </div>
                    <div className="space-y-2">
                        {departments.map(dept => {
                            const perm = (staff?.rosterPermissions || [])?.find(p => p.departmentId === dept.id);
                            return (
                                <div key={dept.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-gray-50 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/50 rounded-xl transition-all hover:bg-white dark:hover:bg-gray-900 shadow-sm">
                                    <span className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-tighter">{dept.name}</span>
                                    <div className="flex items-center gap-4">
                                        {['none', 'view', 'edit'].map(lvl => (
                                            <label key={lvl} className="flex items-center cursor-pointer group">
                                                <input
                                                    type="radio"
                                                    name={`rp_${dept.id}`}
                                                    checked={(perm?.level || 'none') === lvl}
                                                    onChange={() => handleRosterPermissionChange(dept.id, lvl as any)}
                                                    className="w-3.5 h-3.5 text-brand-primary border-gray-300 focus:ring-brand-primary"
                                                />
                                                <span className={`ml-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${(perm?.level || 'none') === lvl ? 'text-brand-primary' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                                                    }`}>
                                                    {lvl}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sub-Department Management Scopes */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                    <div>
                        <h4 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                            <span className="text-xl">🌳</span>
                            Departmental Scopes
                        </h4>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Hierarchical control rights for sub-departments</p>
                    </div>

                    <div className="bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl divide-y dark:divide-gray-700 overflow-hidden">
                        {departments.map(dept => {
                            if (!dept.subDepartments || dept.subDepartments.length === 0) return null;
                            return (
                                <div key={dept.id} className="p-4 bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                    <h5 className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-3 mb-1">{dept.name}</h5>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {(dept.subDepartments || []).map((sd: string) => {
                                            const isSelected = (staff?.managedSubDepartments || []).includes(sd);
                                            return (
                                                <button
                                                    key={sd}
                                                    type="button"
                                                    onClick={() => handleManagedSubDeptToggle(sd)}
                                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${isSelected
                                                        ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                                        : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-400'
                                                        }`}
                                                >
                                                    {isSelected && <span className="mr-1">✓</span>}
                                                    {sd}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* HR Rights Section */}
            {can('admin:manage_roles') && (
                <div className="p-6 border border-emerald-100 dark:border-emerald-900/30 rounded-2x bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-6">
                    <div className="flex-1">
                        <h3 className="text-sm font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="text-xl">🏢</span>
                            High-Level Administrative Access
                        </h3>
                        <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/60 font-bold uppercase tracking-widest mt-1">Grants global visibility to HR Dashboard and contract management</p>
                    </div>

                    <label className="flex items-center gap-4 cursor-pointer group">
                        <div className="relative">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={!!staff.hasHrRights}
                                onChange={(e) => { setStaff(prev => ({ ...prev, hasHrRights: e.target.checked })); setIsSaved(false); }}
                            />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </div>
                        <span className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">Enabled Access</span>
                    </label>
                </div>
            )}

            {/* Danger Zone */}
            {currentUser?.roleId === 'role_super_admin' && (
                <div className="pt-8 border-t border-red-100 dark:border-red-900/30">
                    <div className="bg-red-50/50 dark:bg-red-950/10 p-6 rounded-2xl border border-red-100 dark:border-red-800/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div>
                            <h4 className="text-sm font-black text-red-700 dark:text-red-400 uppercase tracking-widest">Termination Root Access</h4>
                            <p className="text-[10px] text-red-600/60 font-bold uppercase tracking-widest mt-1">Permanently remove this staff member and all associated audit logs.</p>
                        </div>
                        <button
                            onClick={handleDeleteStaff}
                            className="bg-red-600 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 active:scale-95"
                        >
                            Purge Record
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffAccessTab;
