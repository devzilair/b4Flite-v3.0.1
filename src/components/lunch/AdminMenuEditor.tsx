
import React, { useState, useMemo, useEffect } from 'react';
import { LunchMenu, LunchOption, Staff } from '@/types';

const STANDARD_CONDIMENTS = ['Lentils', 'Chilli', 'Salad', 'Chutney'];

// Helper to show selected staff at top of list
const filteredFilteredStaff = (filtered: Staff[], selectedIds: string[]) => {
    // Create a map for fast lookup
    const selectedSet = new Set(selectedIds);
    // Separate
    const selectedStaff = filtered.filter(s => selectedSet.has(s.id));
    const unselectedStaff = filtered.filter(s => !selectedSet.has(s.id));
    return [...selectedStaff, ...unselectedStaff];
}

interface AdminMenuEditorProps {
    onClose: () => void;
    onSave: (menu: LunchMenu) => void;
    staffList: Staff[];
}

const AdminMenuEditor: React.FC<AdminMenuEditorProps> = ({ onClose, onSave, staffList }) => {
    const today = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState('');
    const [cutoffDate, setCutoffDate] = useState('');
    const [cutoffTime, setCutoffTime] = useState('12:00');

    const [options, setOptions] = useState<LunchOption[]>([
        { id: 'opt_1', name: '', description: '', availableCondiments: [] },
        { id: 'opt_2', name: '', description: '', availableCondiments: [] },
        { id: 'opt_3', name: '', description: '', availableCondiments: [] },
    ]);

    const [manualStaff, setManualStaff] = useState<string[]>([]);
    const [staffSearch, setStaffSearch] = useState('');

    const isPastDate = useMemo(() => {
        if (!date) return false;
        return date < today;
    }, [date, today]);

    const handleOptionChange = (index: number, field: keyof LunchOption, value: string) => {
        const newOptions = [...options];
        newOptions[index] = { ...newOptions[index], [field]: value };
        setOptions(newOptions);
    };

    const toggleAvailableCondiment = (index: number, condiment: string) => {
        const newOptions = [...options];
        const currentCondiments = newOptions[index].availableCondiments || [];
        if (currentCondiments.includes(condiment)) {
            newOptions[index].availableCondiments = currentCondiments.filter(c => c !== condiment);
        } else {
            newOptions[index].availableCondiments = [...currentCondiments, condiment];
        }
        setOptions(newOptions);
    };

    const addOption = () => {
        setOptions([...options, { id: `opt_${Date.now()}`, name: '', description: '', availableCondiments: [] }]);
    };

    const removeOption = (index: number) => {
        setOptions(options.filter((_, i) => i !== index));
    };

    const toggleManualStaff = (staffId: string) => {
        setManualStaff(prev =>
            prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
        );
    };

    const filteredStaff = useMemo(() => {
        return staffList.filter(s => s.name.toLowerCase().includes(staffSearch.toLowerCase()) && s.accountStatus === 'active');
    }, [staffList, staffSearch]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isPastDate) {
            alert("Cannot save changes to a menu in the past.");
            return;
        }
        if (!date) return alert("Date is required");

        const validOptions = options.filter(o => o.name.trim() !== '');
        if (validOptions.length === 0) return alert("At least one option is required");

        const cutoffDateTime = `${cutoffDate}T${cutoffTime}:00`;

        onSave({
            date,
            options: validOptions,
            cutoffTime: new Date(cutoffDateTime).toISOString(),
            manualEligibleStaff: manualStaff,
        });
    };

    // Auto-set cutoff to day before at noon when date changes
    useEffect(() => {
        if (date) {
            const d = new Date(date);
            d.setDate(d.getDate() - 1);
            setCutoffDate(d.toISOString().split('T')[0]);
        }
    }, [date]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">Create/Edit Lunch Menu</h2>

                {isPastDate && (
                    <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-md text-sm border-l-4 border-yellow-500">
                        <strong>Read Only:</strong> This menu is for a past date and cannot be edited.
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2 space-y-6">
                    {/* Date & Cutoff */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                        <div>
                            <label className="block text-sm font-medium mb-1">Lunch Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                required
                                disabled={isPastDate}
                                className="w-full form-input disabled:bg-gray-200 dark:disabled:bg-gray-600"
                            />
                            <p className="text-xs text-gray-500 mt-1">Sundays & Public Holidays are recommended.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Cutoff Time</label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={cutoffDate}
                                    onChange={e => setCutoffDate(e.target.value)}
                                    required
                                    disabled={isPastDate}
                                    className="w-full form-input disabled:bg-gray-200 dark:disabled:bg-gray-600"
                                />
                                <input
                                    type="time"
                                    value={cutoffTime}
                                    onChange={e => setCutoffTime(e.target.value)}
                                    required
                                    disabled={isPastDate}
                                    className="w-32 form-input disabled:bg-gray-200 dark:disabled:bg-gray-600"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Options */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Menu Options</label>
                        <div className="space-y-3">
                            {options.map((opt, idx) => (
                                <div key={opt.id} className="border dark:border-gray-700 p-3 rounded-md bg-white dark:bg-gray-800">
                                    <div className="flex gap-2 items-start mb-2">
                                        <div className="flex-grow space-y-2">
                                            <input
                                                type="text"
                                                placeholder={`Dish #${idx + 1} Name`}
                                                value={opt.name}
                                                onChange={e => handleOptionChange(idx, 'name', e.target.value)}
                                                className="w-full form-input disabled:bg-gray-200 dark:disabled:bg-gray-600"
                                                disabled={isPastDate}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Description (optional)"
                                                value={opt.description}
                                                onChange={e => handleOptionChange(idx, 'description', e.target.value)}
                                                className="w-full form-input text-xs disabled:bg-gray-200 dark:disabled:bg-gray-600"
                                                disabled={isPastDate}
                                            />
                                        </div>
                                        {options.length > 1 && !isPastDate && (
                                            <button type="button" onClick={() => removeOption(idx)} className="text-red-500 p-2 hover:bg-red-50 rounded">
                                                &times;
                                            </button>
                                        )}
                                    </div>

                                    {/* Condiments Selector */}
                                    <div className="bg-gray-50 dark:bg-gray-700/30 p-2 rounded text-xs">
                                        <span className="block font-bold text-gray-500 uppercase mb-1">Available Sides:</span>
                                        <div className="flex flex-wrap gap-3">
                                            {STANDARD_CONDIMENTS.map(c => (
                                                <label key={c} className="flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={opt.availableCondiments?.includes(c) || false}
                                                        onChange={() => !isPastDate && toggleAvailableCondiment(idx, c)}
                                                        disabled={isPastDate}
                                                        className="mr-1 rounded text-brand-primary"
                                                    />
                                                    <span className={opt.availableCondiments?.includes(c) ? 'text-brand-primary font-medium' : 'text-gray-500'}>{c}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {!isPastDate && (
                            <button type="button" onClick={addOption} className="mt-3 text-sm text-brand-primary hover:underline">+ Add Another Dish</button>
                        )}
                    </div>

                    {/* Manual Guest List */}
                    <div className="border-t dark:border-gray-600 pt-4">
                        <label className="block text-sm font-medium mb-2">Guest List (Extra Staff)</label>
                        <p className="text-xs text-gray-500 mb-2">Staff scheduled on the roster are automatically eligible. Select off-duty staff here to allow them to order.</p>

                        {!isPastDate && (
                            <input
                                type="text"
                                placeholder="Search staff..."
                                value={staffSearch}
                                onChange={e => setStaffSearch(e.target.value)}
                                className="w-full form-input mb-2"
                            />
                        )}

                        <div className={`max-h-32 overflow-y-auto border rounded p-2 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 grid grid-cols-2 gap-2 ${isPastDate ? 'opacity-70' : ''}`}>
                            {filteredFilteredStaff(filteredStaff, manualStaff).map(s => (
                                <label key={s.id} className={`flex items-center p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer ${manualStaff.includes(s.id) ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={manualStaff.includes(s.id)}
                                        onChange={() => toggleManualStaff(s.id)}
                                        className="mr-2"
                                        disabled={isPastDate}
                                    />
                                    <span className="text-xs truncate">{s.name}</span>
                                </label>
                            ))}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                            {manualStaff.length} guest(s) added.
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-600">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded text-sm hover:bg-gray-300">
                            {isPastDate ? 'Close' : 'Cancel'}
                        </button>
                        {!isPastDate && (
                            <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded text-sm hover:bg-brand-secondary">Save Menu</button>
                        )}
                    </div>
                </form>
                <style>{`
                    .form-input { display: block; width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; background-color: white; }
                    .dark .form-input { background-color: #374151; border-color: #4B5563; color: white; }
                `}</style>
            </div>
        </div>
    );
};

export default AdminMenuEditor;
