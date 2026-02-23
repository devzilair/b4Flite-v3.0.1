
import React, { useState } from 'react';
import { Role } from '../../types';
import RoleModal from './RoleModal';
import { useStaff } from '../../hooks/useStaff';

const RolesSettingsTab: React.FC = () => {
    const { roles, staff, upsertRole, deleteRole, loading } = useStaff();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);

    const handleSave = async (roleToSave: Role) => {
        try {
            await upsertRole(roleToSave);
            setIsModalOpen(false);
            setEditingRole(null);
        } catch (error) {
            console.error("Failed to save role", error);
            alert("Failed to save role. Please try again.");
        }
    };

    const handleDelete = async (roleId: string) => {
        // Safety Check: Are users assigned?
        const assignedCount = staff.filter(s => s.roleId === roleId && s.accountStatus !== 'archived').length;
        if (assignedCount > 0) {
            alert(`Cannot delete role: There are ${assignedCount} staff member(s) currently assigned to this role.\n\nPlease reassign them to a different role before deleting.`);
            return;
        }

        if (window.confirm('Are you sure you want to delete this role?')) {
            try {
                await deleteRole(roleId);
            } catch (error) {
                console.error("Failed to delete role", error);
                alert("Failed to delete role.");
            }
        }
    };

    const openModalForEdit = (role: Role) => {
        setEditingRole(role);
        setIsModalOpen(true);
    };

    const openModalForNew = () => {
        setEditingRole(null);
        setIsModalOpen(true);
    };

    if (loading) {
        return <div className="p-12 text-center text-gray-500 animate-pulse font-medium">Loading roles & permissions...</div>;
    }

    const getRoleIcon = (roleId: string, roleName: string) => {
        const name = roleName.toLowerCase();
        if (roleId === 'role_super_admin' || name.includes('admin')) return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
        if (name.includes('manager') || name.includes('lead') || name.includes('chief')) return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
        if (name.includes('trainer') || name.includes('officer') || name.includes('instructor')) return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.083 0 01.665-6.479L12 14z" /></svg>;
        if (name.includes('crew') || name.includes('pilot') || name.includes('staff')) return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
        return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Roles & Global Permissions</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Define access levels that can be assigned to multiple staff members.</p>
                </div>
                <button
                    onClick={openModalForNew}
                    className="flex items-center gap-2 bg-brand-primary text-white py-2.5 px-5 rounded-xl hover:bg-brand-secondary transition-all font-bold shadow-lg shadow-brand-primary/20 active:scale-95"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    New Custom Role
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map(role => {
                    const assignedCount = staff.filter(s => s.roleId === role.id && s.accountStatus !== 'archived').length;
                    const isSuperAdmin = role.id === 'role_super_admin';
                    const permCount = isSuperAdmin ? 'Full Access' : (role.permissions || []).length;

                    return (
                        <div
                            key={role.id}
                            className={`group relative bg-white dark:bg-gray-800 rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden ${isSuperAdmin
                                    ? 'border-amber-200 dark:border-amber-900/50 shadow-amber-100/50 dark:shadow-none bg-gradient-to-br from-white to-amber-50/30 dark:from-gray-800 dark:to-amber-900/5'
                                    : 'border-gray-100 dark:border-gray-700'
                                }`}
                        >
                            {/* Decorative Top Accent */}
                            <div className={`h-1.5 w-full ${isSuperAdmin ? 'bg-amber-400' : 'bg-brand-primary/20 group-hover:bg-brand-primary transition-colors'}`} />

                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl ${isSuperAdmin ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-gray-50 text-brand-primary dark:bg-gray-700/50 dark:text-brand-light'}`}>
                                        {getRoleIcon(role.id, role.name)}
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isSuperAdmin
                                                ? 'bg-amber-500 text-white'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                                            }`}>
                                            {isSuperAdmin ? 'System Root' : 'Custom'}
                                        </span>
                                        <div className="mt-2 flex -space-x-2 overflow-hidden">
                                            {[...Array(Math.min(assignedCount, 3))].map((_, i) => (
                                                <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[8px] font-bold">
                                                    {i === 2 && assignedCount > 3 ? `+${assignedCount - 2}` : ''}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{role.name}</h3>

                                <div className="flex items-center gap-4 mt-4 mb-6">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-400 font-bold uppercase tracking-tighter">Permissions</span>
                                        <span className="text-sm font-black text-gray-700 dark:text-gray-300">{permCount}</span>
                                    </div>
                                    <div className="w-px h-8 bg-gray-100 dark:bg-gray-700" />
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-400 font-bold uppercase tracking-tighter">Assigned</span>
                                        <span className="text-sm font-black text-gray-700 dark:text-gray-300">{assignedCount} users</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-4 border-t border-gray-50 dark:border-gray-700/50">
                                    <button
                                        onClick={() => openModalForEdit(role)}
                                        className="flex-1 py-2 text-xs font-black uppercase tracking-widest bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-brand-primary hover:text-white transition-all shadow-sm active:scale-95"
                                    >
                                        Manage
                                    </button>
                                    {!isSuperAdmin && (
                                        <button
                                            onClick={() => handleDelete(role.id)}
                                            className="p-2 text-gray-400 hover:text-status-danger transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-90"
                                            title="Delete Role"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {isModalOpen && (
                <RoleModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    existingRole={editingRole}
                />
            )}
        </div>
    );
};

export default RolesSettingsTab;
