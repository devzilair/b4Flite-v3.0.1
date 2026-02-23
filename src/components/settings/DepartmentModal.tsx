
import React, { useState, useEffect, useMemo } from 'react';
import { Department, Staff, ValidationRuleSet } from '../../types';
import { sanitizeString } from '../../utils/sanitization';
import { useStaff } from '../../hooks/useStaff';
import { useSettings } from '../../hooks/useSettings';

interface DepartmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (department: Department) => void;
    existingDepartment: Department | null;
    staffList: Staff[];
    validationRuleSets: ValidationRuleSet[];
}

const DepartmentModal: React.FC<DepartmentModalProps> = ({ isOpen, onClose, onSave, existingDepartment, staffList, validationRuleSets }) => {
    const { rosterViewTemplates } = useSettings();
    
    const [department, setDepartment] = useState<Partial<Department>>({
        name: '',
        managerId: '',
        subDepartments: [],
        rosterViewTemplateId: '',
        validationRuleSetId: '',
    });

    useEffect(() => {
        if (existingDepartment) {
            setDepartment(existingDepartment);
        } else {
            setDepartment({ 
                name: '', 
                managerId: '', 
                subDepartments: [], 
                rosterViewTemplateId: rosterViewTemplates[0]?.id,
                validationRuleSetId: validationRuleSets[0]?.id,
            });
        }
    }, [existingDepartment, isOpen, validationRuleSets, rosterViewTemplates]);

    // Allow selecting ANY staff member as manager, sorted alphabetically
    const potentialManagers = useMemo(() => {
        return [...staffList].sort((a, b) => a.name.localeCompare(b.name));
    }, [staffList]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const departmentToSave: Department = {
            id: existingDepartment?.id || `dept_${Date.now()}`,
            name: sanitizeString(department.name) || 'Unnamed Department',
            managerId: department.managerId || undefined,
            subDepartments: department.subDepartments || [],
            rosterViewTemplateId: department.rosterViewTemplateId || undefined,
            validationRuleSetId: department.validationRuleSetId || undefined,
        };
        onSave(departmentToSave);
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setDepartment(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center" /* No onClick close */>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6">{existingDepartment ? 'Edit Department' : 'Add New Department'}</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium">Department Name</label>
                        <input
                            type="text"
                            name="name"
                            value={department.name}
                            onChange={handleInputChange}
                            required
                            className="mt-1 w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Assign Manager (Optional)</label>
                         <select
                            name="managerId"
                            value={department.managerId || ''}
                            onChange={handleInputChange}
                            className="mt-1 w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                        >
                            <option value="">No Manager</option>
                            {potentialManagers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Roster View Template</label>
                         <select
                            name="rosterViewTemplateId"
                            value={department.rosterViewTemplateId || ''}
                            onChange={handleInputChange}
                            className="mt-1 w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                        >
                            <option value="">-- Select Template --</option>
                            {rosterViewTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Validation Rule Set</label>
                         <select
                            name="validationRuleSetId"
                            value={department.validationRuleSetId || ''}
                            onChange={handleInputChange}
                            className="mt-1 w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                        >
                            <option value="">-- Select Rule Set --</option>
                            {validationRuleSets.map(rs => <option key={rs.id} value={rs.id}>{rs.name}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" className="bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-secondary transition-colors">
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DepartmentModal;
