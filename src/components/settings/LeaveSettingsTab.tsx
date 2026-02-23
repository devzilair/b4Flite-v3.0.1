
import React, { useState } from 'react';
import { LeaveType } from '../../types';
import LeaveTypeModal from './LeaveTypeModal';
import { useSettings } from '../../hooks/useSettings';

const LeaveSettingsTab: React.FC = () => {
    const { leaveTypes, upsertLeaveType, deleteLeaveType } = useSettings();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);

    const handleSave = async (leaveTypeToSave: LeaveType) => {
        try {
            // Assign a new ID if creating
            const finalLeaveType = {
                ...leaveTypeToSave,
                id: leaveTypeToSave.id || `lt_${Date.now()}`,
            };
            await upsertLeaveType(finalLeaveType);
            setIsModalOpen(false);
            setEditingLeaveType(null);
        } catch (error) {
            console.error("Failed to save leave type", error);
            alert("Failed to save leave type. Please try again.");
        }
    };

    const handleDelete = async (leaveTypeId: string) => {
        if (window.confirm('Are you sure you want to delete this leave type?')) {
            try {
                await deleteLeaveType(leaveTypeId);
            } catch (error) {
                console.error("Failed to delete leave type", error);
                alert("Failed to delete leave type.");
            }
        }
    };

    const openModalForEdit = (lt: LeaveType) => {
        setEditingLeaveType(lt);
        setIsModalOpen(true);
    };

    const openModalForNew = () => {
        setEditingLeaveType(null);
        setIsModalOpen(true);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Manage Global Leave Types</h2>
                <button onClick={openModalForNew} className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary transition-colors">
                    Add New Type
                </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Define leave types available to all staff across the organization (e.g., Annual Leave, Sick Leave).
            </p>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="p-3">Preview</th>
                            <th className="p-3">Name</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaveTypes.map(lt => (
                            <tr key={lt.id} className="border-b border-gray-200 dark:border-gray-600">
                                <td className="p-3">
                                    <div style={{ backgroundColor: lt.color }} className="w-8 h-5 rounded-md border border-black/20"></div>
                                </td>
                                <td className="p-3 font-medium">{lt.name}</td>
                                <td className="p-3 space-x-4">
                                    <button onClick={() => openModalForEdit(lt)} className="text-brand-primary hover:underline">Edit</button>
                                    <button onClick={() => handleDelete(lt.id)} className="text-status-danger hover:underline">Delete</button>
                                </td>
                            </tr>
                        ))}
                         {leaveTypes.length === 0 && (
                            <tr>
                                <td colSpan={3} className="text-center p-8 text-gray-500">
                                    No leave types defined.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {isModalOpen && (
                <LeaveTypeModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    existingLeaveType={editingLeaveType}
                />
            )}
        </div>
    );
};

export default LeaveSettingsTab;
