
import React from 'react';
import { Staff, Department, Role, CustomFieldDefinition, MajorType, NextOfKin } from '@/types';

interface StaffPersonalInfoTabProps {
    staff: Partial<Staff>;
    setStaff: (val: Partial<Staff> | ((prev: Partial<Staff>) => Partial<Staff>)) => void;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    handleCustomFieldChange: (fieldId: string, value: string | number) => void;
    handlePilotDataChange: (field: string, value: any) => void;
    departments: Department[];
    assignableRoles: Role[];
    customFieldDefs: CustomFieldDefinition[];
    availableSubDepts: string[];
    can: (permission: string) => boolean;
    addNextOfKin: () => void;
    updateNextOfKin: (index: number, field: keyof NextOfKin, value: string) => void;
    removeNextOfKin: (index: number) => void;
}

const StaffPersonalInfoTab: React.FC<StaffPersonalInfoTabProps> = ({
    staff,
    setStaff,
    handleInputChange,
    handleCustomFieldChange,
    handlePilotDataChange,
    departments,
    assignableRoles,
    customFieldDefs,
    availableSubDepts,
    can,
    addNextOfKin,
    updateNextOfKin,
    removeNextOfKin
}) => {
    return (
        <div className="grid grid-cols-1 gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="font-bold text-lg border-b pb-2 mb-4 dark:border-gray-700">Personal Details</h3>
                    <div>
                        <label className="block text-sm font-medium mb-1">Full Name</label>
                        <input type="text" name="name" value={staff.name || ''} onChange={handleInputChange} className="w-full form-input" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Email Address</label>
                        <input type="email" name="email" value={staff.email || ''} onChange={handleInputChange} className="w-full form-input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Phone Number</label>
                        <input type="tel" name="phone" value={staff.phone || ''} onChange={handleInputChange} className="w-full form-input" placeholder="+248 ..." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div>
                            <label className="block text-sm font-medium mb-1">Department</label>
                            <select
                                name="departmentId"
                                value={staff.departmentId || ''}
                                onChange={handleInputChange}
                                className="w-full form-input"
                                disabled={!can('admin:edit_departments')}
                            >
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Role</label>
                            <select
                                name="roleId"
                                value={staff.roleId || ''}
                                onChange={handleInputChange}
                                className="w-full form-input"
                                disabled={!can('staff:edit_role')}
                            >
                                {assignableRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {availableSubDepts.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium mb-2">Sub-Department Assignment</label>
                            <div className="flex flex-wrap gap-2 p-2 border rounded bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
                                {availableSubDepts.map(sd => (
                                    <label key={sd} className="flex items-center space-x-2 cursor-pointer px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                                        <input
                                            type="checkbox"
                                            checked={(staff.subDepartments || []).includes(sd)}
                                            onChange={(e) => {
                                                const newSubs = e.target.checked ? [...(staff.subDepartments || []), sd] : (staff.subDepartments || []).filter(s => s !== sd);
                                                setStaff(prev => ({ ...prev, subDepartments: newSubs }));
                                            }}
                                            className="rounded text-brand-primary focus:ring-brand-primary"
                                        />
                                        <span className="text-sm">{sd}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Account Status</label>
                            <select name="accountStatus" value={staff.accountStatus} onChange={handleInputChange} className="w-full form-input">
                                <option value="active">Active</option>
                                <option value="disabled">Disabled</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Seniority Level</label>
                            <input type="number" value={staff.pilotData?.seniorityLevel || ''} onChange={(e) => handlePilotDataChange('seniorityLevel', parseInt(e.target.value))} className="w-full form-input" placeholder="1 = Highest" />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="font-bold text-lg border-b pb-2 mb-4 dark:border-gray-700">Emergency Contacts</h3>
                    <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-500">Contact information for next of kin.</p>
                        <button type="button" onClick={addNextOfKin} className="text-xs bg-brand-light text-brand-primary px-3 py-1 rounded hover:bg-brand-primary hover:text-white transition-colors">+ Add Contact</button>
                    </div>
                    <div className="space-y-3">
                        {(staff.nextOfKin || []).map((nok, index) => (
                            <div key={nok.id || index} className="p-3 border rounded-md bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 relative group">
                                <button type="button" onClick={() => removeNextOfKin(index)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" value={nok.name} onChange={(e) => updateNextOfKin(index, 'name', e.target.value)} className="w-full form-input text-xs" placeholder="Name" />
                                    <input type="text" value={nok.relationship} onChange={(e) => updateNextOfKin(index, 'relationship', e.target.value)} className="w-full form-input text-xs" placeholder="Rel." />
                                    <input type="tel" value={nok.phone} onChange={(e) => updateNextOfKin(index, 'phone', e.target.value)} className="w-full form-input text-xs col-span-2" placeholder="Phone" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {customFieldDefs.length > 0 && (
                <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-700/30 dark:border-gray-600">
                    <h3 className="font-bold text-lg border-b pb-2 mb-4 dark:border-gray-700">Additional Fields</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {customFieldDefs.map(def => (
                            <div key={def.id}>
                                <label className="block text-sm font-medium mb-1">{def.name}</label>
                                <input
                                    type={def.type === 'date' ? 'date' : def.type === 'number' ? 'number' : 'text'}
                                    value={staff.customFields?.[def.id] || ''}
                                    onChange={(e) => handleCustomFieldChange(def.id, def.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                                    className="w-full form-input"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffPersonalInfoTab;
