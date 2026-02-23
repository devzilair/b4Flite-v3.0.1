
import React, { useState, useEffect } from 'react';
import { decimalToTime, timeToDecimal } from '@/utils/timeUtils';
import { AircraftType } from '@/types';

interface AircraftHoursModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (hours: { [key: string]: number }) => void;
    initialHours: { [key: string]: number } | undefined;
    availableAircraft: AircraftType[];
}

type HourEntry = { id: number; typeId: string; hours: string };

const AircraftHoursModal: React.FC<AircraftHoursModalProps> = ({ isOpen, onClose, onSave, initialHours, availableAircraft }) => {
    const [entries, setEntries] = useState<HourEntry[]>([]);

    useEffect(() => {
        if (initialHours) {
            setEntries(
                Object.entries(initialHours).map(([typeId, hours], i) => ({
                    id: i,
                    typeId,
                    hours: decimalToTime(hours as number)
                }))
            );
        } else {
            setEntries([]);
        }
    }, [initialHours, isOpen]);

    if (!isOpen) return null;

    const handleAddEntry = () => {
        setEntries([...entries, { id: Date.now(), typeId: availableAircraft[0]?.id || '', hours: '' }]);
    };

    const handleRemoveEntry = (id: number) => {
        setEntries(entries.filter(e => e.id !== id));
    };

    const handleEntryChange = (id: number, field: 'typeId' | 'hours', value: string) => {
        setEntries(entries.map(e => (e.id === id ? { ...e, [field]: value } : e)));
    };

    // Auto-format on blur (e.g., user types "1", format to "01:00", or "1:30" -> "01:30")
    const handleBlur = (id: number) => {
        setEntries(entries.map(e => {
            if (e.id === id && e.hours) {
                // If it looks like a decimal (contains dot but not colon), convert decimal to time
                if (e.hours.includes('.') && !e.hours.includes(':')) {
                    return { ...e, hours: decimalToTime(parseFloat(e.hours)) };
                }
                // If it is a number without colon (e.g. "2"), treat as hours
                if (!isNaN(Number(e.hours)) && !e.hours.includes(':')) {
                    return { ...e, hours: `${e.hours.padStart(2, '0')}:00` };
                }
                // Standardize HH:mm
                const parts = e.hours.split(':');
                if (parts.length === 2) {
                    return { ...e, hours: `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}` };
                }
            }
            return e;
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalHours: { [key: string]: number } = {};
        for (const entry of entries) {
            const decimalHours = timeToDecimal(entry.hours);
            if (entry.typeId && decimalHours > 0) {
                finalHours[entry.typeId] = (finalHours[entry.typeId] || 0) + decimalHours;
            }
        }
        onSave(finalHours);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" /* No onClick close */>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <h2 className="text-2xl font-bold mb-4">Log Flight Hours</h2>

                    {availableAircraft.length === 0 && (
                        <div className="p-3 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 rounded-md text-sm mb-4 border-l-4 border-yellow-500">
                            <p className="font-bold">No Aircraft Types Found</p>
                            <p>Please update this pilot's profile to include Aircraft Type Ratings (e.g., EC120B) so they can be selected here.</p>
                        </div>
                    )}

                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                        {entries.map(entry => (
                            <div key={entry.id} className="grid grid-cols-3 gap-3 items-center">
                                <select
                                    value={entry.typeId}
                                    onChange={e => handleEntryChange(entry.id, 'typeId', e.target.value)}
                                    className="col-span-1 form-input"
                                >
                                    {availableAircraft.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    {/* Fallback for legacy data: show raw ID if not in list */}
                                    {!availableAircraft.find(a => a.id === entry.typeId) && entry.typeId && (
                                        <option value={entry.typeId}>{entry.typeId}</option>
                                    )}
                                </select>
                                <input
                                    type="text"
                                    value={entry.hours}
                                    onChange={e => handleEntryChange(entry.id, 'hours', e.target.value)}
                                    onBlur={() => handleBlur(entry.id)}
                                    placeholder="HH:MM"
                                    className="col-span-1 form-input"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveEntry(entry.id)}
                                    className="col-span-1 bg-red-100 text-red-700 py-2 px-3 rounded-md hover:bg-red-200"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                    {entries.length === 0 && <p className="text-gray-500 text-center py-4">No flight hours logged for this day.</p>}

                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={handleAddEntry}
                            disabled={availableAircraft.length === 0}
                            className="w-full bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 py-2 px-4 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            + Add Aircraft
                        </button>
                    </div>

                    <div className="flex justify-end space-x-4 pt-6 border-t dark:border-gray-600 mt-6">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" className="bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-secondary transition-colors">
                            Save Hours
                        </button>
                    </div>
                </form>
                <style>{`
                    .form-input {
                        display: block;
                        width: 100%;
                        padding: 0.5rem 0.75rem;
                        font-size: 0.875rem;
                        color: #374151;
                        background-color: #F9FAFB;
                        border: 1px solid #D1D5DB;
                        border-radius: 0.375rem;
                    }
                    .dark .form-input {
                        color: #D1D5DB;
                        background-color: #374151;
                        border-color: #4B5563;
                    }
                `}</style>
            </div>
        </div>
    );
};

export default AircraftHoursModal;
