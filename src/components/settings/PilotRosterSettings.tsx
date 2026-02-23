
import React, { useState, useMemo, useEffect } from 'react';
import { DepartmentSettings, PilotRosterSettings as PilotRosterSettingsType, SizeUnit, PilotRosterMainGroup, PilotRosterSubGroup, PilotRosterStatisticsColumn } from '../../types';
import { useSettings } from '../../hooks/useSettings';
import { useStaff } from '../../hooks/useStaff';

interface PilotRosterSettingsProps {
    selectedDepartmentId: string;
}

const LayoutEditor: React.FC<{ 
    layout: PilotRosterMainGroup[], 
    onChange: (layout: PilotRosterMainGroup[]) => void, 
    staff: any[] 
}> = ({ layout, onChange, staff }) => {
    
    // Main Group Ops
    const addMainGroup = () => {
        onChange([...layout, { id: `mg_${Date.now()}`, name: 'New Group', subGroups: [] }]);
    };
    
    const updateMainGroup = (index: number, name: string) => {
        const newLayout = [...layout];
        newLayout[index] = { ...newLayout[index], name };
        onChange(newLayout);
    };
    
    const deleteMainGroup = (index: number) => {
        if(!confirm('Delete Main Group?')) return;
        const newLayout = [...layout];
        newLayout.splice(index, 1);
        onChange(newLayout);
    };
    
    const moveMainGroup = (index: number, dir: 'up' | 'down') => {
        const newLayout = [...layout];
        const item = newLayout.splice(index, 1)[0];
        newLayout.splice(dir === 'up' ? index - 1 : index + 1, 0, item);
        onChange(newLayout);
    };

    // Sub Group Ops
    const addSubGroup = (mainIndex: number) => {
        const newLayout = [...layout];
        const newMain = { ...newLayout[mainIndex] };
        newMain.subGroups = [...newMain.subGroups, { id: `sg_${Date.now()}`, name: 'New Sub Group', staffIds: [] }];
        newLayout[mainIndex] = newMain;
        onChange(newLayout);
    };
    
    const updateSubGroup = (mainIndex: number, subIndex: number, field: 'name' | 'color', value: string) => {
        const newLayout = [...layout];
        const newMain = { ...newLayout[mainIndex] };
        const newSubGroups = [...newMain.subGroups];
        newSubGroups[subIndex] = { ...newSubGroups[subIndex], [field]: value };
        newMain.subGroups = newSubGroups;
        newLayout[mainIndex] = newMain;
        onChange(newLayout);
    };
    
    const deleteSubGroup = (mainIndex: number, subIndex: number) => {
        if(!confirm('Delete Sub Group?')) return;
        const newLayout = [...layout];
        const newMain = { ...newLayout[mainIndex] };
        const newSubGroups = [...newMain.subGroups];
        newSubGroups.splice(subIndex, 1);
        newMain.subGroups = newSubGroups;
        newLayout[mainIndex] = newMain;
        onChange(newLayout);
    };

    // Staff Ops - PERFORMANCE CRITICAL: Optimized to prevent database round-trip per click
    const handleStaffToggle = (mainIndex: number, subIndex: number, staffId: string) => {
        const newLayout = [...layout];
        const newMain = { ...newLayout[mainIndex] };
        const newSubGroups = [...newMain.subGroups];
        const newSubGroup = { ...newSubGroups[subIndex] };
        
        // Safeguard: Ensure staffIds array exists
        const currentIds = [...(newSubGroup.staffIds || [])];
        
        if (currentIds.includes(staffId)) {
            newSubGroup.staffIds = currentIds.filter(id => id !== staffId);
        } else {
            newSubGroup.staffIds = [...currentIds, staffId];
        }
        
        newSubGroups[subIndex] = newSubGroup;
        newMain.subGroups = newSubGroups;
        newLayout[mainIndex] = newMain;
        
        onChange(newLayout);
    };

    return (
        <div className="space-y-6">
            {layout.map((mg, mIndex) => (
                <div key={mg.id} className="border dark:border-gray-600 p-4 rounded-md bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                        <input 
                            className="font-bold text-lg bg-transparent border-b border-gray-400 focus:border-brand-primary focus:outline-none text-gray-800 dark:text-white"
                            value={mg.name}
                            onChange={e => updateMainGroup(mIndex, e.target.value)}
                        />
                         <div className="flex gap-1 ml-auto">
                             <button type="button" onClick={() => moveMainGroup(mIndex, 'up')} disabled={mIndex===0} className="px-2 text-gray-500 hover:text-brand-primary disabled:opacity-20">↑</button>
                             <button type="button" onClick={() => moveMainGroup(mIndex, 'down')} disabled={mIndex===layout.length-1} className="px-2 text-gray-500 hover:text-brand-primary disabled:opacity-20">↓</button>
                             <button type="button" onClick={() => deleteMainGroup(mIndex)} className="text-red-500 hover:text-red-700 ml-2 text-xs font-bold uppercase">Delete Group</button>
                         </div>
                    </div>

                    <div className="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                        {mg.subGroups.map((sg, sIndex) => (
                             <div key={sg.id} className="bg-white dark:bg-gray-700 p-3 rounded border dark:border-gray-600 shadow-sm">
                                 <div className="flex items-center gap-2 mb-2">
                                     <span className="text-xs font-bold text-gray-400 uppercase">Sub-Group:</span>
                                     <input 
                                        className="font-medium bg-transparent border-b border-gray-300 focus:border-brand-primary focus:outline-none text-sm w-48 text-gray-800 dark:text-white"
                                        value={sg.name}
                                        onChange={e => updateSubGroup(mIndex, sIndex, 'name', e.target.value)}
                                        placeholder="Name"
                                    />
                                    <div className="flex items-center gap-2 ml-2">
                                        <label className="text-[10px] text-gray-400 font-bold uppercase">Color:</label>
                                        <input 
                                            type="color"
                                            value={sg.color || '#fed7aa'} 
                                            onChange={e => updateSubGroup(mIndex, sIndex, 'color', e.target.value)}
                                            className="h-5 w-8 p-0 border-0 rounded cursor-pointer"
                                            title="Set cell background color"
                                        />
                                    </div>
                                    <button type="button" onClick={() => deleteSubGroup(mIndex, sIndex)} className="text-red-400 hover:text-red-600 text-[10px] font-bold uppercase ml-auto">Remove</button>
                                 </div>
                                 <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800/50 rounded border dark:border-gray-600">
                                     {staff.map(s => (
                                         <label key={s.id} className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 p-1 rounded transition-colors min-w-0">
                                             <input 
                                                type="checkbox" 
                                                checked={(sg.staffIds || []).includes(s.id)}
                                                onChange={() => handleStaffToggle(mIndex, sIndex, s.id)}
                                                className="rounded text-brand-primary focus:ring-brand-primary flex-shrink-0"
                                             />
                                             <span className="truncate text-gray-700 dark:text-gray-200 block w-full" title={s.name}>{s.name}</span>
                                         </label>
                                     ))}
                                 </div>
                                 <p className="text-[10px] text-gray-400 mt-1">{(sg.staffIds || []).length} pilot(s) selected.</p>
                             </div>
                        ))}
                        <button type="button" onClick={() => addSubGroup(mIndex)} className="text-xs font-bold text-brand-primary hover:underline">+ ADD SUB-GROUP</button>
                    </div>
                </div>
            ))}
            <button type="button" onClick={addMainGroup} className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-brand-primary hover:text-brand-primary transition-all font-bold">+ ADD NEW MAIN GROUP</button>
        </div>
    );
};

const PilotRosterSettings: React.FC<PilotRosterSettingsProps> = ({ selectedDepartmentId }) => {
    const { departmentSettings, updateDepartmentSettings } = useSettings();
    const { staff } = useStaff();
    const currentDeptSettings = departmentSettings[selectedDepartmentId];
    
    // Core state management for DRAFT pattern
    const [localLayout, setLocalLayout] = useState<PilotRosterMainGroup[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Sync local state when component mounts or department changes
    useEffect(() => {
        if (currentDeptSettings?.pilotRosterLayout) {
            setLocalLayout(JSON.parse(JSON.stringify(currentDeptSettings.pilotRosterLayout)));
            setIsDirty(false);
        }
    }, [currentDeptSettings?.pilotRosterLayout, selectedDepartmentId]);

    const currentSettings = currentDeptSettings?.pilotRosterSettings;

    if (!currentSettings) return <div>No pilot roster settings found for this department.</div>;
    
    // Ensure all supported columns are present in the settings editor
    const allSupportedColumns: PilotRosterStatisticsColumn[] = [
        { id: 'heli_pilots', label: 'Heli Pilots', visible: true },
        { id: 'fixed_wing', label: 'Fixed Wing', visible: true },
        { id: 'off', label: 'OFF', visible: true },
        { id: 'ph', label: 'PH', visible: true },
    ];

    const currentStatsColumns = useMemo(() => {
        const merged = [...currentSettings.statisticsColumns];
        allSupportedColumns.forEach(defaultCol => {
            if (!merged.find(c => c.id === defaultCol.id)) {
                merged.push(defaultCol);
            }
        });
        return merged;
    }, [currentSettings.statisticsColumns]);
    
    const departmentStaff = useMemo(() => staff.filter(s => s.departmentId === selectedDepartmentId), [staff, selectedDepartmentId]);
    const sizeUnits: SizeUnit[] = ['px', 'rem', 'ch'];

    const handleSizeSettingChange = (field: 'rowHeight' | 'columnWidth', subField: 'value' | 'unit', value: string | number) => {
         const numericValue = typeof value === 'string' ? (parseFloat(value) || 0) : value;
         const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
         if (newSettings?.pilotRosterSettings) {
            if (!(newSettings.pilotRosterSettings as any)[field]) {
                (newSettings.pilotRosterSettings as any)[field] = { value: 0, unit: 'px' };
            }
            (newSettings.pilotRosterSettings as any)[field][subField] = subField === 'value' ? numericValue : value;
            updateDepartmentSettings(newSettings, selectedDepartmentId);
        }
    };

    const handlePrintConfigChange = (field: string, value: string) => {
        const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
        if (newSettings?.pilotRosterSettings) {
            if (!newSettings.pilotRosterSettings.printConfig) {
                newSettings.pilotRosterSettings.printConfig = {};
            }
            newSettings.pilotRosterSettings.printConfig[field] = value;
            updateDepartmentSettings(newSettings, selectedDepartmentId);
        }
    };

    const handleStatColumnChange = (id: string, field: 'label' | 'visible', value: string | boolean) => {
         const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
         if (newSettings?.pilotRosterSettings) {
            let columns = newSettings.pilotRosterSettings.statisticsColumns;
            const colIndex = columns.findIndex((c: any) => c.id === id);
            
            if (colIndex > -1) {
                columns[colIndex][field] = value;
            } else {
                const defaultCol = allSupportedColumns.find(c => c.id === id);
                if (defaultCol) {
                    columns.push({ ...defaultCol, [field]: value });
                }
            }
            
            newSettings.pilotRosterSettings.statisticsColumns = columns;
            updateDepartmentSettings(newSettings, selectedDepartmentId);
        }
    };

    const handleLayoutDraftChange = (newLayout: PilotRosterMainGroup[]) => {
        setLocalLayout(newLayout);
        setIsDirty(true);
    };

    const applyLayoutChanges = async () => {
        setIsSaving(true);
        try {
            const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
            newSettings.pilotRosterLayout = localLayout;
            await updateDepartmentSettings(newSettings, selectedDepartmentId);
            setIsDirty(false);
        } catch (e) {
            alert("Failed to save layout changes.");
        } finally {
            setIsSaving(false);
        }
    };

    const discardLayoutChanges = () => {
        if (confirm("Discard all unsaved layout changes?")) {
            setLocalLayout(JSON.parse(JSON.stringify(currentDeptSettings.pilotRosterLayout)));
            setIsDirty(false);
        }
    };

    // Notes Handlers
    const addNote = () => {
        const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
        if (!newSettings.pilotRosterSettings.notes) newSettings.pilotRosterSettings.notes = [];
        newSettings.pilotRosterSettings.notes.push({ id: `note_${Date.now()}`, text: '' });
        updateDepartmentSettings(newSettings, selectedDepartmentId);
    };

    const deleteNote = (noteId: string) => {
        const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
        if (!newSettings.pilotRosterSettings.notes) return;
        newSettings.pilotRosterSettings.notes = newSettings.pilotRosterSettings.notes.filter((n: any) => n.id !== noteId);
        updateDepartmentSettings(newSettings, selectedDepartmentId);
    };


    return (
        <div className="space-y-8">
            {/* Layout Configuration Section */}
            <div className="p-6 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b dark:border-gray-700 pb-4">
                    <div>
                        <h2 className="text-xl font-bold">Roster Structure (Pilot View)</h2>
                        <p className="text-sm text-gray-500">Organize how pilots are grouped and sequenced on the PDF/FTL roster.</p>
                    </div>
                    {isDirty && (
                        <div className="flex items-center gap-3 animate-fade-in">
                            <span className="text-xs font-bold text-amber-600 uppercase">Unsaved Changes</span>
                            <button 
                                onClick={discardLayoutChanges}
                                disabled={isSaving}
                                className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            >
                                Discard
                            </button>
                            <button 
                                onClick={applyLayoutChanges}
                                disabled={isSaving}
                                className="px-4 py-1.5 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded shadow-md flex items-center gap-2 transition-all active:scale-95"
                            >
                                {isSaving ? (
                                    <>
                                        <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Apply Changes
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
                
                <LayoutEditor 
                    layout={localLayout} 
                    onChange={handleLayoutDraftChange} 
                    staff={departmentStaff} 
                />
            </div>

            {/* Appearance Section */}
            <div className="p-6 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                <h2 className="text-xl font-bold mb-4">Pilot Roster Screen Appearance</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duty Column Width</label>
                        <div className="flex">
                            <input
                                type="number"
                                value={currentSettings.columnWidth?.value ?? 70}
                                onChange={e => handleSizeSettingChange('columnWidth', 'value', e.target.value)}
                                className="w-full rounded-l-md px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                            />
                            <select
                                value={currentSettings.columnWidth?.unit ?? 'px'}
                                onChange={e => handleSizeSettingChange('columnWidth', 'unit', e.target.value)}
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
                </div>
            </div>

            {/* Footer Notes Config */}
            <div className="p-6 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/30">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Footer Notes</h2>
                    <button type="button" onClick={addNote} className="text-sm bg-brand-primary text-white px-3 py-1 rounded hover:bg-brand-secondary">+ Add Note</button>
                </div>
                <p className="text-sm text-gray-500 mb-3">Add placeholders for notes that will appear at the bottom of the roster. The actual text can be edited directly on the roster page.</p>
                
                <div className="space-y-2">
                    {(currentSettings.notes || []).map((note, idx) => (
                        <div key={note.id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded border dark:border-gray-600">
                            <span className="font-mono text-xs text-gray-400">Note {idx + 1}</span>
                            <span className="flex-grow text-sm italic text-gray-500">{note.text || '(Empty - Edit on Roster Page)'}</span>
                            <button type="button" onClick={() => deleteNote(note.id)} className="text-red-500 text-xs hover:underline">Remove</button>
                        </div>
                    ))}
                    {(currentSettings.notes || []).length === 0 && <p className="text-xs text-gray-400 italic">No notes configured.</p>}
                </div>
            </div>

            {/* Print Configuration */}
            <div className="p-6 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/30">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print Layout Configuration
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium mb-1">Font Size</label>
                        <input
                            type="text"
                            value={currentSettings.printConfig?.fontSize || '8px'}
                            onChange={e => handlePrintConfigChange('fontSize', e.target.value)}
                            placeholder="e.g. 8px"
                            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Row Height</label>
                        <input
                            type="text"
                            value={currentSettings.printConfig?.rowHeight || '12px'}
                            onChange={e => handlePrintConfigChange('rowHeight', e.target.value)}
                            placeholder="e.g. 12px"
                            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Page Margins</label>
                        <input
                            type="text"
                            value={currentSettings.printConfig?.margins || '3mm'}
                            onChange={e => handlePrintConfigChange('margins', e.target.value)}
                            placeholder="e.g. 3mm"
                            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Date Column Width</label>
                        <input
                            type="text"
                            value={currentSettings.printConfig?.dateColumnWidth || '5ch'}
                            onChange={e => handlePrintConfigChange('dateColumnWidth', e.target.value)}
                            placeholder="e.g. 5ch"
                            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Statistics Column Width</label>
                        <input
                            type="text"
                            value={currentSettings.printConfig?.statsColumnWidth || '7ch'}
                            onChange={e => handlePrintConfigChange('statsColumnWidth', e.target.value)}
                            placeholder="e.g. 7ch"
                            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                        />
                    </div>
                </div>
            </div>

            {/* Statistics Columns */}
             <div className="p-6 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Statistics Columns</h2>
                <div className="space-y-4">
                    {currentStatsColumns.map((col, index) => (
                        <div key={col.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                            <div className="md:col-span-1">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={col.visible}
                                        onChange={e => handleStatColumnChange(col.id, 'visible', e.target.checked)}
                                        className="h-4 w-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary"
                                    />
                                    <span className="ml-2 font-medium text-gray-800 dark:text-gray-200 capitalize">Show "{col.id.replace('_', ' ')}"</span>
                                </label>
                            </div>
                            <div className="md:col-span-2">
                                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Label</label>
                                 <input
                                    type="text"
                                    value={col.label}
                                    onChange={e => handleStatColumnChange(col.id, 'label', e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                                    disabled={!col.visible}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PilotRosterSettings;
