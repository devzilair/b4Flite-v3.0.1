
import React, { useState, useEffect } from 'react';
import { ShiftCodeDefinition, LeaveType } from '../../types';
import { sanitizeString } from '../../utils/sanitization';

interface ShiftCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (code: ShiftCodeDefinition) => void;
    existingCode: ShiftCodeDefinition | null;
    leaveTypes: LeaveType[];
}

const ShiftCodeModal: React.FC<ShiftCodeModalProps> = ({ isOpen, onClose, onSave, existingCode, leaveTypes }) => {
    const [code, setCode] = useState<Partial<ShiftCodeDefinition>>({
        code: '',
        description: '',
        color: '#2196F3',
        textColor: '#FFFFFF',
        isOffDuty: false,
        duration: undefined,
        leaveTypeId: '',
    });
    
    useEffect(() => {
        if (existingCode) {
            setCode(existingCode);
        } else {
            setCode({
                code: '',
                description: '',
                color: '#2196F3',
                textColor: '#FFFFFF',
                isOffDuty: false,
                duration: undefined,
                leaveTypeId: '',
            });
        }
    }, [existingCode, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const sanitizedCode = {
            ...code,
            code: sanitizeString(code.code).toUpperCase(),
            description: sanitizeString(code.description),
        };
        onSave(sanitizedCode as ShiftCodeDefinition);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setCode(prev => ({...prev, [name]: checked}));
        } else if (type === 'number') {
            // FIX: Use parseFloat to allow fractional durations (e.g. 7.5 hours)
            setCode(prev => ({...prev, [name]: value ? parseFloat(value) : undefined }));
        }
        else {
            setCode(prev => ({...prev, [name]: value}));
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center" /* No onClick close */>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6">{existingCode ? 'Edit Work Code' : 'Add New Work Code'}</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-1">
                             <label className="block text-sm font-medium">Code</label>
                             <input type="text" name="code" value={code.code} onChange={handleInputChange} required maxLength={8} className="mt-1 w-full form-input" />
                        </div>
                        <div className="md:col-span-2">
                             <label className="block text-sm font-medium">Description</label>
                             <input type="text" name="description" value={code.description} onChange={handleInputChange} required className="mt-1 w-full form-input" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        <div>
                            <label className="block text-sm font-medium">Background Color</label>
                            <input type="color" name="color" value={code.color} onChange={handleInputChange} className="mt-1 w-full h-10" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Text Color</label>
                            <input type="color" name="textColor" value={code.textColor} onChange={handleInputChange} className="mt-1 w-full h-10" />
                        </div>
                    </div>
                    
                    <div className="text-center bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
                        <p className="text-sm mb-2">Preview:</p>
                        <div style={{ backgroundColor: code.color, color: code.textColor }} className="font-bold text-center rounded-md px-3 py-2 inline-block">
                            {code.code || 'CODE'}
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium">Map to Leave Type (Optional)</label>
                        <select name="leaveTypeId" value={code.leaveTypeId || ''} onChange={handleInputChange} className="mt-1 w-full form-input">
                            <option value="">None</option>
                            {leaveTypes.map(lt => (
                                <option key={lt.id} value={lt.id}>{lt.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                             <label className="block text-sm font-medium">Duration (hours)</label>
                             <input type="number" step="0.1" name="duration" value={code.duration || ''} onChange={handleInputChange} placeholder="e.g., 8.5" className="mt-1 w-full form-input" />
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center">
                                <input type="checkbox" name="isOffDuty" checked={code.isOffDuty} onChange={handleInputChange} className="h-5 w-5 form-checkbox" />
                                <span className="ml-2">Is Off-Duty Code</span>
                            </label>
                        </div>
                    </div>

                     <style>{`
                        .form-input {
                            display: block;
                            width: 100%;
                            padding: 0.5rem 0.75rem;
                            font-size: 0.875rem;
                            line-height: 1.25rem;
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
                         .form-checkbox {
                            border-radius: 0.25rem;
                            color: #0D47A1;
                         }
                    `}</style>
                    
                    <div className="flex justify-end space-x-4 pt-4">
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

export default ShiftCodeModal;
