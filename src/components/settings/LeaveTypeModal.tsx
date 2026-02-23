import React, { useState, useEffect } from 'react';
import { LeaveType } from '../../types';
import { sanitizeString } from '../../utils/sanitization';

interface LeaveTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (leaveType: LeaveType) => void;
    existingLeaveType: LeaveType | null;
}

const LeaveTypeModal: React.FC<LeaveTypeModalProps> = ({ isOpen, onClose, onSave, existingLeaveType }) => {
    const [leaveType, setLeaveType] = useState<Partial<LeaveType>>({
        name: '',
        color: '#2196F3',
    });

    useEffect(() => {
        if (existingLeaveType) {
            setLeaveType(existingLeaveType);
        } else {
            setLeaveType({ name: '', color: '#2196F3' });
        }
    }, [existingLeaveType, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const sanitizedLeaveType = {
            ...leaveType,
            name: sanitizeString(leaveType.name),
        };
        onSave(sanitizedLeaveType as LeaveType);
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setLeaveType(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6">{existingLeaveType ? 'Edit Leave Type' : 'Add New Leave Type'}</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium">Leave Type Name</label>
                        <input
                            type="text"
                            name="name"
                            value={leaveType.name}
                            onChange={handleInputChange}
                            required
                            className="mt-1 w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Display Color</label>
                        <input
                            type="color"
                            name="color"
                            value={leaveType.color}
                            onChange={handleInputChange}
                            className="mt-1 w-full h-10"
                        />
                    </div>
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

export default LeaveTypeModal;