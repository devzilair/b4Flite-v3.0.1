
import React, { useState, useEffect } from 'react';
import { RosterGroup, FontSize, FONT_SIZES } from '../../types';
import { sanitizeString } from '../../utils/sanitization';

interface GroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (group: RosterGroup) => void;
    existingGroup: RosterGroup | null;
    availableSubDepartments: string[];
}

const GroupModal: React.FC<GroupModalProps> = ({ isOpen, onClose, onSave, existingGroup, availableSubDepartments }) => {
    
    const [group, setGroup] = useState<Partial<RosterGroup>>({
        name: '',
        subDepartmentFilter: [],
        groupHeaderOrientation: 'vertical',
        minRowsPerGroup: 1,
        groupHeaderTextSize: 'text-base',
    });

    useEffect(() => {
        if (existingGroup) {
            setGroup(existingGroup);
        } else {
            setGroup({ 
                name: '', 
                subDepartmentFilter: [], 
                groupHeaderOrientation: 'vertical',
                minRowsPerGroup: 1,
                groupHeaderTextSize: 'text-base',
            });
        }
    }, [existingGroup, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const groupToSave: RosterGroup = {
            id: existingGroup?.id || `rg_${Date.now()}`,
            name: sanitizeString(group.name) || 'Unnamed Group',
            subDepartmentFilter: group.subDepartmentFilter || [],
            groupHeaderOrientation: group.groupHeaderOrientation || 'vertical',
            minRowsPerGroup: group.minRowsPerGroup || 1,
            groupHeaderTextSize: group.groupHeaderTextSize || 'text-base',
        };
        onSave(groupToSave);
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let processedValue: string | number = value;
        if (type === 'number') {
            processedValue = parseInt(value) || 0;
        }

        setGroup(prev => ({ ...prev, [name]: processedValue }));
    };

    const handleSubDeptChange = (subDept: string, isChecked: boolean) => {
        setGroup(prev => {
            const currentFilter = prev.subDepartmentFilter || [];
            if (isChecked) {
                // Add to the end
                return { ...prev, subDepartmentFilter: [...currentFilter, subDept] };
            } else {
                // Remove
                return { ...prev, subDepartmentFilter: currentFilter.filter(sd => sd !== subDept) };
            }
        });
    };

    const moveSubDept = (index: number, direction: 'up' | 'down') => {
        setGroup(prev => {
            const list = [...(prev.subDepartmentFilter || [])];
            if (index < 0 || index >= list.length) return prev;
            
            const item = list.splice(index, 1)[0];
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            
            if (newIndex >= 0 && newIndex <= list.length) {
                list.splice(newIndex, 0, item);
            } else {
                // If out of bounds (should be prevented by UI but good for safety), put it back
                 list.splice(index, 0, item);
            }
            
            return { ...prev, subDepartmentFilter: list };
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6 flex-shrink-0">{existingGroup ? 'Edit Roster Group' : 'Add New Roster Group'}</h2>
                
                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2 space-y-6">
                    <div>
                        <label className="block text-sm font-medium">Group Name</label>
                        <input
                            type="text"
                            name="name"
                            value={group.name}
                            onChange={handleInputChange}
                            required
                            className="mt-1 w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Filter by Sub-Departments</label>
                        <div className="p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 max-h-48 overflow-y-auto">
                            {availableSubDepartments.length > 0 ? (
                                <div className="space-y-2">
                                {availableSubDepartments.map(subDept => (
                                    <label key={subDept} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={group.subDepartmentFilter?.includes(subDept) || false}
                                            onChange={e => handleSubDeptChange(subDept, e.target.checked)}
                                            className="h-4 w-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary"
                                        />
                                        <span className="ml-2 text-sm">{subDept}</span>
                                    </label>
                                ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic text-center">No sub-departments to filter by.</p>
                            )}
                        </div>
                    </div>
                    
                    {group.subDepartmentFilter && group.subDepartmentFilter.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium mb-2">Display Order (Top to Bottom)</label>
                            <p className="text-xs text-gray-500 mb-2">Staff on the roster will be sorted based on this order.</p>
                            <div className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-gray-50/50 dark:bg-gray-700/30">
                                {group.subDepartmentFilter.map((subDept, index) => (
                                    <div key={subDept} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-sm">
                                        <span className="text-sm font-medium">{subDept}</span>
                                        <div className="flex gap-1">
                                            <button 
                                                type="button" 
                                                onClick={() => moveSubDept(index, 'up')} 
                                                disabled={index === 0} 
                                                className="p-1 text-gray-500 hover:text-brand-primary disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => moveSubDept(index, 'down')} 
                                                disabled={index === group.subDepartmentFilter!.length - 1} 
                                                className="p-1 text-gray-500 hover:text-brand-primary disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="border-t dark:border-gray-600 pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 break-words">Header Orientation</label>
                            <select
                                name="groupHeaderOrientation"
                                value={group.groupHeaderOrientation || 'vertical'}
                                onChange={handleInputChange}
                                className="mt-1 w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                            >
                                <option value="vertical">Vertical</option>
                                <option value="horizontal">Horizontal</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 break-words">Header Text Size</label>
                            <select
                                name="groupHeaderTextSize"
                                value={group.groupHeaderTextSize || 'text-base'}
                                onChange={handleInputChange}
                                className="mt-1 w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                            >
                                {FONT_SIZES.map(size => <option key={size} value={size}>{size.replace('text-', '').toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 break-words">Minimum Rows</label>
                            <input
                                type="number"
                                name="minRowsPerGroup"
                                value={group.minRowsPerGroup || ''}
                                onChange={handleInputChange}
                                className="mt-1 w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end space-x-4 pt-4 mt-auto border-t dark:border-gray-600">
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

export default GroupModal;
