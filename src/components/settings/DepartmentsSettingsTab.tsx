
import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Department, Staff, ValidationRuleSet, DepartmentSettings, SubDepartmentRule } from '../../types';
import DepartmentModal from './DepartmentModal';
import SubDeptRulesModal from './SubDeptRulesModal';
import { useStaff } from '../../hooks/useStaff';
import { useSettings } from '../../hooks/useSettings';

const SubDepartmentEditor: React.FC<{
    subDepts: string[];
    onUpdate: (newSubDepts: string[]) => void;
}> = ({ subDepts, onUpdate }) => {
    const [newSubDept, setNewSubDept] = useState('');

    const handleAdd = () => {
        if (newSubDept.trim() && !subDepts.includes(newSubDept.trim())) {
            onUpdate([...subDepts, newSubDept.trim()]);
            setNewSubDept('');
        }
    };

    const handleRemove = (subDeptToRemove: string) => {
        onUpdate(subDepts.filter(sd => sd !== subDeptToRemove));
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        const newSubDepts = [...subDepts];
        const item = newSubDepts.splice(index, 1)[0];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex >= 0 && newIndex <= newSubDepts.length) {
            newSubDepts.splice(newIndex, 0, item);
            onUpdate(newSubDepts);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            {(subDepts || []).map((sd, index) => (
                <div key={sd} className="group flex items-center bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 pl-3 pr-1 py-1 rounded-xl transition-all hover:border-brand-primary/30 shadow-sm">
                    <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">{sd}</span>
                    <div className="flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-0.5 text-gray-400 hover:text-brand-primary disabled:opacity-30">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button onClick={() => handleMove(index, 'down')} disabled={index === subDepts.length - 1} className="p-0.5 text-gray-400 hover:text-brand-primary disabled:opacity-30">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                    </div>
                    <button onClick={() => handleRemove(sd)} className="ml-1 p-1 text-gray-400 hover:text-red-500 transition-colors">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            ))}
            <div className="flex items-center h-8">
                <input
                    type="text"
                    value={newSubDept}
                    onChange={e => setNewSubDept(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
                    placeholder="New Sub-Dept..."
                    className="w-32 px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[11px] font-bold outline-none focus:ring-1 focus:ring-brand-primary transition-all h-full"
                />
                <button
                    onClick={handleAdd}
                    className="ml-2 w-8 h-8 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center hover:bg-brand-primary hover:text-white transition-all shadow-sm active:scale-95"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                </button>
            </div>
        </div>
    );
};

const DepartmentsSettingsTab: React.FC = () => {
    const { rosterViewTemplates, validationRuleSets, departmentSettings, updateDepartmentSettings } = useSettings();
    const { departments, staff: staffList, addDepartment, updateDepartment, deleteDepartment, updateStaff } = useStaff();

    const [searchParams, setSearchParams] = useSearchParams();

    // Modal State
    const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

    const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
    const [rulesTargetDept, setRulesTargetDept] = useState<Department | null>(null);

    const [searchQuery, setSearchQuery] = useState('');

    const staffMap = useMemo(() => {
        const map = new Map<string, Staff>();
        staffList.forEach(s => map.set(s.id, s));
        return map;
    }, [staffList]);

    const templateMap = useMemo(() => new Map(rosterViewTemplates.map(t => [t.id, t.name])), [rosterViewTemplates]);

    const filteredDepartments = useMemo(() => {
        return departments.filter(d =>
            d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (d.subDepartments || []).some(sd => sd.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [departments, searchQuery]);

    const handleSaveDept = async (deptToSave: Department) => {
        try {
            if (departments.some(d => d.id === deptToSave.id)) {
                await updateDepartment(deptToSave);
            } else {
                await addDepartment(deptToSave);
            }
            setIsDeptModalOpen(false);
            setEditingDepartment(null);
        } catch (e: any) {
            console.error("Failed to save department", e);
            alert(`Failed to save department: ${e.message}`);
        }
    };

    const handleSaveRules = async (deptId: string, rules: SubDepartmentRule[], staffUpdates: { staffId: string, managedSubDepartments: string[] }[]) => {
        try {
            const currentSettings = departmentSettings[deptId] || {
                rosterSettings: { columnWidth: 50, rowHeight: { value: 3, unit: 'ch' }, showSubDepartment: true, weekendHighlightColor: '#fffde7', rosterGroups: [], groupHeaderWidth: { value: 120, unit: 'px' }, staffMemberColWidth: { value: 200, unit: 'px' } },
                shiftCodes: []
            };

            const newSettings = { ...currentSettings, subDepartmentRules: rules };
            await updateDepartmentSettings(newSettings, deptId);

            if (staffUpdates && staffUpdates.length > 0) {
                for (const update of staffUpdates) {
                    const staff = staffList.find(s => s.id === update.staffId);
                    if (staff) {
                        await updateStaff({ ...staff, managedSubDepartments: update.managedSubDepartments });
                    }
                }
            }

            setIsRulesModalOpen(false);
            setRulesTargetDept(null);
        } catch (err) {
            console.error("Failed to save sub-department rules:", err);
            throw err;
        }
    };

    const handleDelete = async (deptId: string) => {
        const hasStaff = staffList.some(s => s.departmentId === deptId);
        if (hasStaff) {
            alert('Cannot delete department: There are active staff members assigned to this department. Please reassign them first.');
            return;
        }

        if (window.confirm('Are you sure you want to delete this department? This will also remove its settings.')) {
            try {
                await deleteDepartment(deptId);
            } catch (e: any) {
                console.error("Failed to delete department", e);
                alert(`Error: ${e.message}`);
            }
        }
    };

    const handleSubDepartmentsUpdate = (deptId: string, newSubDepts: string[]) => {
        const dept = departments.find(d => d.id === deptId);
        if (dept) {
            updateDepartment({ ...dept, subDepartments: newSubDepts });
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 border dark:border-gray-700 rounded-2xl shadow-sm">
                <div className="flex-1 w-full">
                    <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                        <span className="p-1.5 bg-brand-primary/10 text-brand-primary rounded-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </span>
                        Enterprise Departments
                    </h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Manage organizational hierarchy and access rules</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search departments..."
                            className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold w-full sm:w-64 focus:ring-1 focus:ring-brand-primary outline-none transition-all focus:bg-white"
                        />
                    </div>
                    <button
                        onClick={() => { setEditingDepartment(null); setIsDeptModalOpen(true); }}
                        className="bg-brand-primary text-white py-2 px-6 rounded-xl hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                        New Department
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDepartments.map(dept => {
                    const settings = departmentSettings[dept.id];
                    const ruleCount = settings?.subDepartmentRules?.length || 0;
                    const manager = dept.managerId ? staffMap.get(dept.managerId) : null;
                    const templateName = templateMap.get(dept.rosterViewTemplateId || '');

                    return (
                        <div key={dept.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col">
                            <div className="p-5 border-b dark:border-gray-700 flex items-start justify-between">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-gray-800 dark:text-white uppercase tracking-tight text-lg leading-tight group-hover:text-brand-primary transition-colors">{dept.name}</h3>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{manager?.name || 'No Manager'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingDepartment(dept); setIsDeptModalOpen(true); }} className="p-2 text-gray-400 hover:text-brand-primary bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors" title="Edit Department">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                    <button onClick={() => handleDelete(dept.id)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors" title="Delete Department">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="p-5 space-y-5 flex-1">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1 px-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-100 dark:border-indigo-800 flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 00-2-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                            <span className="text-[10px] font-black uppercase tracking-widest">{templateName || 'Base View'}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setRulesTargetDept(dept); setIsRulesModalOpen(true); }}
                                        className="text-[10px] font-black uppercase tracking-widest text-brand-primary hover:bg-brand-primary hover:text-white border border-brand-primary/20 hover:border-brand-primary px-3 py-1.5 rounded-lg transition-all active:scale-95 flex items-center gap-1.5"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                                        {ruleCount > 0 ? `${ruleCount} Access Rules` : 'Set Access'}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sub-Departments</h4>
                                    <SubDepartmentEditor
                                        subDepts={dept.subDepartments || []}
                                        onUpdate={(newSubDepts) => handleSubDepartmentsUpdate(dept.id, newSubDepts)}
                                    />
                                    {(dept.subDepartments || []).length === 0 && (
                                        <p className="text-[10px] italic text-gray-400">No sub-departments defined.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {isDeptModalOpen && (
                <DepartmentModal
                    isOpen={isDeptModalOpen}
                    onClose={() => setIsDeptModalOpen(false)}
                    onSave={handleSaveDept}
                    existingDepartment={editingDepartment}
                    staffList={staffList}
                    validationRuleSets={validationRuleSets}
                />
            )}

            {isRulesModalOpen && rulesTargetDept && (
                <SubDeptRulesModal
                    isOpen={isRulesModalOpen}
                    onClose={() => setIsRulesModalOpen(false)}
                    department={rulesTargetDept}
                    existingRules={departmentSettings[rulesTargetDept.id]?.subDepartmentRules || []}
                    staffList={staffList}
                    onSave={(rules, staffUpdates) => handleSaveRules(rulesTargetDept.id, rules, staffUpdates)}
                />
            )}
        </div>
    )
};

export default DepartmentsSettingsTab;
