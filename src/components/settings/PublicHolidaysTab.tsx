
import React, { useState } from 'react';
import { PublicHoliday } from '../../types';
import PublicHolidayModal from './PublicHolidayModal';
import { useSettings } from '../../hooks/useSettings';

const PublicHolidaysTab: React.FC = () => {
    // Use the mutators exposed from useSettings
    const { publicHolidays, upsertPublicHoliday, deletePublicHoliday } = useSettings();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null);

    const handleSave = async (holiday: PublicHoliday) => {
        try {
            await upsertPublicHoliday(holiday);
            setIsModalOpen(false);
            setEditingHoliday(null);
        } catch (error) {
            console.error("Failed to save public holiday", error);
            alert("Failed to save public holiday. Please try again.");
        }
    };

    const handleDelete = async (holidayDate: string) => {
        if (window.confirm('Are you sure you want to delete this public holiday?')) {
            try {
                await deletePublicHoliday(holidayDate);
            } catch (error) {
                console.error("Failed to delete public holiday", error);
                alert("Failed to delete public holiday.");
            }
        }
    };

    const openModalForNew = () => {
        setEditingHoliday(null);
        setIsModalOpen(true);
    };

    const openModalForEdit = (holiday: PublicHoliday) => {
        setEditingHoliday(holiday);
        setIsModalOpen(true);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Manage Public Holidays</h2>
                <button onClick={openModalForNew} className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary transition-colors">
                    + Add Holiday
                </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Define global public holidays. Staff working on these days may receive special entitlements based on roster rules.
            </p>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Holiday Name</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {publicHolidays.map(holiday => (
                            <tr key={holiday.date} className="border-b border-gray-200 dark:border-gray-600">
                                <td className="p-3 font-medium">
                                    {holiday.isRecurring 
                                        ? new Date(holiday.date + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'long', day: 'numeric', timeZone: 'UTC' })
                                        : new Date(holiday.date + 'T00:00:00Z').toLocaleDateString()
                                    }
                                </td>
                                <td className="p-3">{holiday.name}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${holiday.isRecurring ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-800'}`}>
                                        {holiday.isRecurring ? 'Yearly' : 'One-time'}
                                    </span>
                                </td>
                                <td className="p-3 space-x-4">
                                    <button onClick={() => openModalForEdit(holiday)} className="text-brand-primary hover:underline">Edit</button>
                                    <button onClick={() => handleDelete(holiday.date)} className="text-status-danger hover:underline">Delete</button>
                                </td>
                            </tr>
                        ))}
                         {publicHolidays.length === 0 && (
                            <tr>
                                <td colSpan={4} className="text-center p-8 text-gray-500">
                                    No public holidays have been defined.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {isModalOpen && (
                <PublicHolidayModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    existingHoliday={editingHoliday}
                />
            )}
        </div>
    );
};

export default PublicHolidaysTab;
