import React, { useState, useEffect } from 'react';
import { PublicHoliday } from '../../types';
import { sanitizeString } from '../../utils/sanitization';

interface PublicHolidayModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (holiday: PublicHoliday) => void;
    existingHoliday: PublicHoliday | null;
}

const PublicHolidayModal: React.FC<PublicHolidayModalProps> = ({ isOpen, onClose, onSave, existingHoliday }) => {
    const today = new Date().toISOString().split('T')[0];
    const [holiday, setHoliday] = useState<Partial<PublicHoliday>>({
        date: today,
        name: '',
        isRecurring: false,
    });

     useEffect(() => {
        if (existingHoliday) {
            setHoliday(existingHoliday);
        } else {
            setHoliday({
                date: today,
                name: '',
                isRecurring: true,
            });
        }
    }, [existingHoliday, isOpen, today]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const sanitizedHoliday = {
            ...holiday,
            name: sanitizeString(holiday.name),
        };
        onSave(sanitizedHoliday as PublicHoliday);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        if (type === 'checkbox') {
            setHoliday(prev => ({ ...prev, [name]: checked }));
        } else {
            setHoliday(prev => ({ ...prev, [name]: value }));
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6">{existingHoliday ? 'Edit Public Holiday' : 'Add Public Holiday'}</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="date" className="block text-sm font-medium">Date</label>
                        <input
                            type="date"
                            name="date"
                            id="date"
                            value={holiday.date}
                            onChange={handleInputChange}
                            required
                            disabled={!!existingHoliday}
                            className="mt-1 w-full form-input disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                        />
                    </div>
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium">Holiday Name</label>
                        <input
                            type="text"
                            name="name"
                            id="name"
                            value={holiday.name}
                            onChange={handleInputChange}
                            required
                            className="mt-1 w-full form-input"
                            placeholder="e.g., Christmas Day"
                        />
                    </div>
                    <div>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                name="isRecurring"
                                checked={holiday.isRecurring || false}
                                onChange={handleInputChange}
                                className="h-4 w-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary"
                            />
                            <span className="ml-2 text-sm">Recurring yearly</span>
                        </label>
                    </div>
                     <style>{`
                        .form-input { display: block; width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; background-color: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 0.375rem; }
                        .dark .form-input { color: #D1D5DB; background-color: #374151; border-color: #4B5563; }
                        .dark .form-input::-webkit-calendar-picker-indicator { filter: invert(1); }
                    `}</style>
                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" className="bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-secondary">Save Holiday</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PublicHolidayModal;