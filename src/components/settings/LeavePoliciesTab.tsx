
import React, { useState } from 'react';
import { LeaveAccrualPolicy, DepartmentSettings } from '../../types';
import LeavePolicyModal from './LeavePolicyModal';
import { useSettings } from '../../hooks/useSettings';
import { useStaff } from '../../hooks/useStaff';
import { useLeave } from '../../hooks/useLeave';

interface LeavePoliciesTabProps {
    selectedDepartmentId: string;
}

const LeavePoliciesTab: React.FC<LeavePoliciesTabProps> = ({ selectedDepartmentId }) => {
    const { departmentSettings, updateDepartmentSettings, leaveTypes, loading: settingsLoading } = useSettings();
    const { staff } = useStaff();
    const { runLeaveAccruals } = useLeave();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<LeaveAccrualPolicy | null>(null);
    
    const currentDeptSettings = departmentSettings[selectedDepartmentId];
    const currentPolicies = currentDeptSettings?.leaveAccrualPolicies || [];

    const handleInitialize = () => {
        if (!selectedDepartmentId) return;
        const defaultSettings: DepartmentSettings = {
            rosterSettings: { 
                columnWidth: { value: 50, unit: 'px' },
                rowHeight: { value: 3, unit: 'ch' },
                showSubDepartment: true,
                weekendHighlightColor: '#fffde7',
                rosterGroups: [],
                groupHeaderWidth: { value: 120, unit: 'px' },
                staffMemberColWidth: { value: 200, unit: 'px' },
            },
            shiftCodes: [],
            leaveAccrualPolicies: [],
            pilotRosterLayout: [],
            pilotRosterSettings: {
                 columnWidth: { value: 70, unit: 'px' },
                 rowHeight: { value: 3, unit: 'ch' },
                 statisticsColumns: [
                     { id: 'heli_pilots', label: 'Heli Pilots', visible: true },
                     { id: 'off', label: 'OFF', visible: true },
                     { id: 'ph', label: 'PH', visible: true },
                 ]
            }
        };
        updateDepartmentSettings(defaultSettings, selectedDepartmentId);
    };
    
    if (settingsLoading) {
        return <div className="text-center p-12 text-gray-500">Loading leave policies...</div>;
    }

    if (!currentDeptSettings) {
        return (
            <div className="text-center p-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Settings Not Initialized</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">You need to initialize settings for this department before managing leave policies.</p>
                <button 
                    onClick={handleInitialize}
                    className="bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-secondary transition-colors shadow-sm font-semibold"
                >
                    Initialize Settings
                </button>
            </div>
        );
    }

    const handleSave = (policy: LeaveAccrualPolicy) => {
        const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
        const policies = newSettings.leaveAccrualPolicies || [];
        if (editingPolicy) {
            const index = policies.findIndex((p: LeaveAccrualPolicy) => p.id === policy.id);
            if (index > -1) policies[index] = policy;
        } else {
            policies.push(policy);
        }
        newSettings.leaveAccrualPolicies = policies;
        updateDepartmentSettings(newSettings, selectedDepartmentId);
        setIsModalOpen(false);
        setEditingPolicy(null);
    };

    const handleDelete = (policyId: string) => {
        if (window.confirm("Are you sure you want to delete this policy?")) {
            const newSettings = JSON.parse(JSON.stringify(currentDeptSettings));
            newSettings.leaveAccrualPolicies = (newSettings.leaveAccrualPolicies || []).filter((p: LeaveAccrualPolicy) => p.id !== policyId);
            updateDepartmentSettings(newSettings, selectedDepartmentId);
        }
    };

    const handleRunAccruals = async () => {
        if (!window.confirm(`This will run all accrual policies for the current month for this department. This action cannot be undone. Continue?`)) return;

        try {
            const deptStaff = staff.filter(s => s.departmentId === selectedDepartmentId && s.accountStatus === 'active');
            const count = await runLeaveAccruals(selectedDepartmentId, deptStaff, currentDeptSettings);
            if (count > 0) {
                alert(`${count} new leave accrual transaction(s) have been created.`);
            } else {
                alert('No new accruals to process. They may have already been run for this period.');
            }
        } catch (e) {
            console.error("Failed to run accruals", e);
            alert(`Error running accruals: ${(e as Error).message}`);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Leave Accrual Policies</h2>
                <div className="flex gap-4">
                     <button onClick={handleRunAccruals} className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700">
                        Run Accruals Now
                    </button>
                    <button 
                        onClick={() => { setEditingPolicy(null); setIsModalOpen(true); }}
                        className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary transition-colors"
                    >
                        Add Policy
                    </button>
                </div>
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Define policies to automatically grant leave to staff over time. 
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                    No Carry Over Limit
                </span>
            </p>

             <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="p-3">Leave Type</th>
                            <th className="p-3">Amount</th>
                            <th className="p-3">Frequency</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentPolicies.map((policy: LeaveAccrualPolicy) => (
                            <tr key={policy.id} className="border-b border-gray-200 dark:border-gray-600">
                                <td className="p-3 font-medium">
                                    {leaveTypes.find(lt => lt.id === policy.leaveTypeId)?.name || 'Unknown Type'}
                                </td>
                                <td className="p-3">{policy.amount} days</td>
                                <td className="p-3 capitalize">{policy.frequency}</td>
                                <td className="p-3 space-x-3">
                                    <button onClick={() => { setEditingPolicy(policy); setIsModalOpen(true); }} className="text-brand-primary hover:underline">Edit</button>
                                    <button onClick={() => handleDelete(policy.id)} className="text-red-500 hover:underline">Delete</button>
                                </td>
                            </tr>
                        ))}
                         {currentPolicies.length === 0 && (
                            <tr>
                                <td colSpan={4} className="text-center p-8 text-gray-500">
                                    No accrual policies defined.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <LeavePolicyModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    existingPolicy={editingPolicy}
                    leaveTypes={leaveTypes}
                />
            )}
        </div>
    );
};

export default LeavePoliciesTab;
