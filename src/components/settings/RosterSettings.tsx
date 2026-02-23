
import React, { useState, useMemo } from 'react';
import { DepartmentSettings, FONT_SIZES, RosterGroup, SizeUnit } from '../../types';
import GroupModal from './GroupModal';
import PilotRosterSettings from './PilotRosterSettings';
import { useSettings } from '../../hooks/useSettings';
import { useStaff } from '../../hooks/useStaff';

interface RosterSettingsProps {
    selectedDepartmentId: string;
}

const RosterSettings: React.FC<RosterSettingsProps> = ({ selectedDepartmentId }) => {
    
    const { departmentSettings, updateDepartmentSettings, validationRuleSets, loading: settingsLoading } = useSettings();
    const { departments } = useStaff();
    
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<RosterGroup | null>(null);
    const [settingsMode, setSettingsMode] = useState<'standard' | 'pilot'>('standard');
    
    const selectedDepartment = useMemo(() => 
        departments.find(d => d.id === selectedDepartmentId), 
        [departments, selectedDepartmentId]
    );
    const availableSubDepartments = selectedDepartment?.subDepartments || [];
    const isPilotDepartment = selectedDepartment?.rosterViewTemplateId === 'tpl_pilot';

    const currentDeptSettings = departmentSettings[selectedDepartmentId];
    const currentSettings = currentDeptSettings?.rosterSettings;

    const handleInitialize = () => {
        const defaultSettings: DepartmentSettings = {
            rosterSettings: { 
                columnWidth: { value: 50, unit: 'px' },
                rowHeight: { value: 3, unit: 'ch' },
                showSubDepartment: true,
                weekendHighlightColor: '#fffde7',
                rosterGroups: [],
                groupHeaderWidth: { value: 120, unit: 'px' },
                staffMemberColWidth: { value: 200, unit: 'px' },
                validationRuleSetIds: [],
                includeWeekendsInLeave: false,
            },
            shiftCodes: [],
            leaveAccrualPolicies: [],
            pilotRosterLayout: [],
            pilotRosterSettings: {
                 columnWidth: { value: 70, unit: 'px' },
                 rowHeight: { value: 3, unit: 'ch' },
                 statisticsColumns: [
                     { id: 'heli_pilots', label: 'Heli Pilots', visible: true },
                     { id: 'fixed_wing', label: 'Fixed Wing', visible: true },
                     { id: 'off', label: 'OFF', visible: true },
                     { id: 'ph', label: 'PH', visible: true },
                 ]
            }
        };
        updateDepartmentSettings(defaultSettings, selectedDepartmentId);
    };

    if (settingsLoading) {
        return <div className="p-12 text-center text-gray-500">Loading settings...</div>;
    }

    if (!currentDeptSettings) {
        return (
            <div className="text-center p-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Roster Settings Found</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">This department has not been initialized with roster settings yet.</p>
                <button 
                    onClick={handleInitialize}
                    className="bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-secondary transition-colors shadow-sm font-semibold"
                >
                    Initialize Default Settings
                </button>
            </div>
        );
    }

    const handleSettingsChange = (field: string, value: any) => {
        const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
        (newSettings.rosterSettings as any)[field] = value;
        updateDepartmentSettings(newSettings, selectedDepartmentId);
    };

    const handleRuleSetToggle = (id: string, checked: boolean) => {
        const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
        let ids = newSettings.rosterSettings.validationRuleSetIds || [];
        if (checked) {
            if (!ids.includes(id)) ids.push(id);
        } else {
            ids = ids.filter((existId: string) => existId !== id);
        }
        newSettings.rosterSettings.validationRuleSetIds = ids;
        updateDepartmentSettings(newSettings, selectedDepartmentId);
    };

    const handleSizeSettingChange = (field: string, subField: 'value' | 'unit', value: string | number) => {
        // FIX: Use parseFloat to support fractional units (e.g. 2.5 ch)
        const numericValue = typeof value === 'string' ? (parseFloat(value) || 0) : value;
        const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
        
        // Ensure nested object exists
        if (!(newSettings.rosterSettings as any)[field]) {
            (newSettings.rosterSettings as any)[field] = { value: 0, unit: 'px' };
        }
        
        // FIX: Ensure it is an object if it was a number (legacy support)
        if (typeof (newSettings.rosterSettings as any)[field] === 'number') {
             (newSettings.rosterSettings as any)[field] = { value: (newSettings.rosterSettings as any)[field], unit: 'px' };
        }

        (newSettings.rosterSettings as any)[field][subField] = subField === 'value' ? numericValue : value;
        updateDepartmentSettings(newSettings, selectedDepartmentId);
    };

    const handlePrintConfigChange = (field: string, value: string) => {
        const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
        if (!newSettings.rosterSettings.printConfig) {
            newSettings.rosterSettings.printConfig = {};
        }
        newSettings.rosterSettings.printConfig[field] = value;
        updateDepartmentSettings(newSettings, selectedDepartmentId);
    };
    
    const handleGroupSave = (groupToSave: RosterGroup) => {
        const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
        const groups = newSettings.rosterSettings.rosterGroups || [];
        const existingIndex = groups.findIndex((g: RosterGroup) => g.id === groupToSave.id);
        if (existingIndex > -1) {
            groups[existingIndex] = groupToSave;
        } else {
            groups.push({ ...groupToSave, id: `rg_${Date.now()}` });
        }
        newSettings.rosterSettings.rosterGroups = groups;
        updateDepartmentSettings(newSettings, selectedDepartmentId);
        setIsGroupModalOpen(false);
        setEditingGroup(null);
    };

    const handleGroupDelete = (groupId: string) => {
        if (window.confirm('Are you sure you want to delete this roster group?')) {
            const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
            const groups = newSettings.rosterSettings.rosterGroups || [];
            newSettings.rosterSettings.rosterGroups = groups.filter((g: RosterGroup) => g.id !== groupId);
            updateDepartmentSettings(newSettings, selectedDepartmentId);
        }
    };
    
    const handleGroupMove = (index: number, direction: 'up' | 'down') => {
        const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
        const groups = newSettings.rosterSettings.rosterGroups || [];
        if (!groups) return;
        const item = groups[index];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= groups.length) return; // invalid move
        
        groups.splice(index, 1);
        groups.splice(newIndex, 0, item);
        newSettings.rosterSettings.rosterGroups = groups;
        updateDepartmentSettings(newSettings, selectedDepartmentId);
    };

    const renderStandardSettings = () => {
        if (!currentSettings) return <div>Settings structure missing. Please re-initialize.</div>;
        
        const rosterGroups = currentSettings.rosterGroups || [];
        const sizeUnits: SizeUnit[] = ['px', 'rem', 'ch'];
        const selectedRuleSetIds = currentSettings.validationRuleSetIds || [];

        return (
            <>
                {/* Validation Rules */}
                <div className="p-6 border dark:border-gray-600 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">Validation Rules</h2>
                    <p className="text-sm text-gray-500 mb-4">Select the rule sets to apply to this roster. Rules from all selected sets will be enforced.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {validationRuleSets.map(rs => (
                            <label key={rs.id} className={`flex items-start p-3 border rounded cursor-pointer transition-colors ${selectedRuleSetIds.includes(rs.id) ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:border-gray-600'}`}>
                                <input 
                                    type="checkbox" 
                                    checked={selectedRuleSetIds.includes(rs.id)} 
                                    onChange={(e) => handleRuleSetToggle(rs.id, e.target.checked)}
                                    className="mt-1 h-4 w-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary"
                                />
                                <div className="ml-3">
                                    <span className="block font-medium text-gray-900 dark:text-white">{rs.name}</span>
                                    <span className="block text-xs text-gray-500">{rs.rules.length} rules defined</span>
                                </div>
                            </label>
                        ))}
                        {validationRuleSets.length === 0 && <p className="text-sm text-gray-500 italic">No validation rule sets available. Create them in the Validation Rules tab.</p>}
                    </div>
                </div>

                {/* Appearance & Display */}
                <div className="p-6 border dark:border-gray-600 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">Appearance & Logic</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duty Column Width</label>
                            <div className="flex">
                                <input
                                    type="number"
                                    value={typeof currentSettings.columnWidth === 'number' ? currentSettings.columnWidth : currentSettings.columnWidth?.value ?? 50}
                                    onChange={e => handleSizeSettingChange('columnWidth', 'value', e.target.value)}
                                    className="w-full rounded-l-md px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                />
                                <select
                                    value={typeof currentSettings.columnWidth === 'number' ? 'px' : currentSettings.columnWidth?.unit ?? 'px'}
                                    onChange={e => handleSizeSettingChange('columnWidth', 'unit', e.target.value)}
                                    className="rounded-r-md border-l-0 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                >
                                    {sizeUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group Header Width</label>
                            <div className="flex">
                                <input
                                    type="number"
                                    value={currentSettings.groupHeaderWidth?.value || ''}
                                    onChange={e => handleSizeSettingChange('groupHeaderWidth', 'value', e.target.value)}
                                    className="w-full rounded-l-md px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                />
                                <select
                                    value={currentSettings.groupHeaderWidth?.unit || 'px'}
                                    onChange={e => handleSizeSettingChange('groupHeaderWidth', 'unit', e.target.value)}
                                    className="rounded-r-md border-l-0 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                >
                                    {sizeUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                                </select>
                            </div>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Staff Member Column Width</label>
                            <div className="flex">
                                <input
                                    type="number"
                                    value={currentSettings.staffMemberColWidth?.value || ''}
                                    onChange={e => handleSizeSettingChange('staffMemberColWidth', 'value', e.target.value)}
                                    className="w-full rounded-l-md px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                />
                                <select
                                    value={currentSettings.staffMemberColWidth?.unit || 'px'}
                                    onChange={e => handleSizeSettingChange('staffMemberColWidth', 'unit', e.target.value)}
                                    className="rounded-r-md border-l-0 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                >
                                    {sizeUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                                </select>
                            </div>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Row Height</label>
                            <div className="flex">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={currentSettings.rowHeight?.value || ''}
                                    onChange={e => handleSizeSettingChange('rowHeight', 'value', e.target.value)}
                                    className="w-full rounded-l-md px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                />
                                <select
                                    value={currentSettings.rowHeight?.unit || 'px'}
                                    onChange={e => handleSizeSettingChange('rowHeight', 'unit', e.target.value)}
                                    className="rounded-r-md border-l-0 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                >
                                    {sizeUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                                </select>
                            </div>
                        </div>
                         <div className="lg:col-span-2 flex flex-col gap-3 justify-center">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={currentSettings.showSubDepartment}
                                    onChange={e => handleSettingsChange('showSubDepartment', e.target.checked)}
                                    className="h-4 w-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary"
                                />
                                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Show sub-department on roster</span>
                            </label>
                            
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={currentSettings.includeWeekendsInLeave || false}
                                    onChange={e => handleSettingsChange('includeWeekendsInLeave', e.target.checked)}
                                    className="h-4 w-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary"
                                />
                                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 font-bold">Include Weekends in Leave Deductions</span>
                            </label>
                             <p className="text-xs text-gray-500 ml-6">
                                Enable for shift workers (e.g. Pilots) who work weekends. Disable for standard Mon-Fri staff.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Print Configuration */}
                <div className="p-6 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/30">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Print Layout Configuration
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-1">Font Size (Table)</label>
                            <input
                                type="text"
                                value={currentSettings.printConfig?.fontSize || '10px'}
                                onChange={e => handlePrintConfigChange('fontSize', e.target.value)}
                                placeholder="e.g. 10px"
                                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Row Height</label>
                            <input
                                type="text"
                                value={currentSettings.printConfig?.rowHeight || '14px'}
                                onChange={e => handlePrintConfigChange('rowHeight', e.target.value)}
                                placeholder="e.g. 14px"
                                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Page Margins</label>
                            <input
                                type="text"
                                value={currentSettings.printConfig?.margins || '5mm'}
                                onChange={e => handlePrintConfigChange('margins', e.target.value)}
                                placeholder="e.g. 5mm"
                                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Group Header Width</label>
                            <input
                                type="text"
                                value={currentSettings.printConfig?.groupColumnWidth || '25px'}
                                onChange={e => handlePrintConfigChange('groupColumnWidth', e.target.value)}
                                placeholder="e.g. 25px"
                                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Staff Column Width</label>
                            <input
                                type="text"
                                value={currentSettings.printConfig?.staffColumnWidth || '100px'}
                                onChange={e => handlePrintConfigChange('staffColumnWidth', e.target.value)}
                                placeholder="e.g. 100px"
                                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Footer Date Font</label>
                            <input
                                type="text"
                                value={currentSettings.printConfig?.footerFontSize || '24pt'}
                                onChange={e => handlePrintConfigChange('footerFontSize', e.target.value)}
                                placeholder="e.g. 24pt"
                                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Group Header Font</label>
                            <input
                                type="text"
                                value={currentSettings.printConfig?.groupHeaderFontSize || '14pt'}
                                onChange={e => handlePrintConfigChange('groupHeaderFontSize', e.target.value)}
                                placeholder="e.g. 14pt"
                                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                            />
                        </div>
                    </div>
                </div>

                {/* Staff Groups */}
                <div>
                     <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Staff Groups</h2>
                        <button onClick={() => { setEditingGroup(null); setIsGroupModalOpen(true); }} className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary">
                            Add Group
                        </button>
                    </div>
                    <div className="space-y-3 p-4 border dark:border-gray-600 rounded-lg min-h-[200px]">
                        {rosterGroups.map((group, index) => (
                            <div key={group.id} className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-100 dark:bg-gray-700 p-3 rounded-md gap-3">
                                <div className="flex-1">
                                    <p className="font-bold text-lg">{group.name}</p>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300 mt-1">
                                        <span><span className="font-semibold">Filters:</span> {(group.subDepartmentFilter || []).join(', ') || 'None'}</span>
                                        <span className="capitalize"><span className="font-semibold">Orientation:</span> {group.groupHeaderOrientation}</span>
                                        <span><span className="font-semibold">Min Rows:</span> {group.minRowsPerGroup}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <button onClick={() => handleGroupMove(index, 'up')} disabled={index === 0} className="text-gray-500 disabled:opacity-20">▲</button>
                                    <button onClick={() => handleGroupMove(index, 'down')} disabled={index === rosterGroups.length - 1} className="text-gray-500 disabled:opacity-20">▼</button>
                                    <button onClick={() => { setEditingGroup(group); setIsGroupModalOpen(true); }} className="text-sm text-brand-primary hover:underline">Edit</button>
                                    <button onClick={() => handleGroupDelete(group.id)} className="text-sm text-status-danger hover:underline">Delete</button>
                                </div>
                            </div>
                        ))}
                         {rosterGroups.length === 0 && <p className="text-gray-500 text-center py-8">No groups created. Add groups to build the roster layout.</p>}
                    </div>
                     <p className="text-xs text-gray-500 mt-2">Define groups to organize staff on the roster. The order here determines the display order.</p>
                </div>


                {isGroupModalOpen && (
                    <GroupModal 
                        isOpen={isGroupModalOpen}
                        onClose={() => setIsGroupModalOpen(false)}
                        onSave={handleGroupSave}
                        existingGroup={editingGroup}
                        availableSubDepartments={availableSubDepartments || []}
                    />
                )}
            </>
        );
    };

    return (
        <div className="space-y-8">
            {isPilotDepartment && (
                 <div className="flex justify-end">
                    <div className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 rounded-full p-1 text-sm">
                        <span className="font-semibold ml-2">Settings Mode:</span>
                        <button onClick={() => setSettingsMode('standard')} className={`px-3 py-1 rounded-full ${settingsMode === 'standard' ? 'bg-white dark:bg-gray-500 shadow' : 'hover:bg-gray-300/50'}`}>Standard Settings</button>
                        <button onClick={() => setSettingsMode('pilot')} className={`px-3 py-1 rounded-full ${settingsMode === 'pilot' ? 'bg-white dark:bg-gray-500 shadow' : 'hover:bg-gray-300/50'}`}>Pilot View Settings</button>
                    </div>
                </div>
            )}
            
            {isPilotDepartment && settingsMode === 'pilot' ? (
                <PilotRosterSettings
                    selectedDepartmentId={selectedDepartmentId}
                />
            ) : (
                renderStandardSettings()
            )}
        </div>
    );
};

export default RosterSettings;
