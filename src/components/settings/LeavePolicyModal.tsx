import React, { useState, useEffect } from 'react';
import { LeaveAccrualPolicy, LeaveType } from '../../types';

interface LeavePolicyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (policy: LeaveAccrualPolicy) => void;
    existingPolicy: LeaveAccrualPolicy | null;
    leaveTypes: LeaveType[];
}

const LeavePolicyModal: React.FC<LeavePolicyModalProps> = ({ isOpen, onClose, onSave, existingPolicy, leaveTypes }) => {
    const [policy, setPolicy] = useState<Partial<LeaveAccrualPolicy>>({});

    useEffect(() => {
        if (existingPolicy) {
            setPolicy(existingPolicy);
        } else {
            setPolicy({
                leaveTypeId: leaveTypes[0]?.id || '',
                amount: 1.5,
                frequency: 'monthly',
            });
        }
    }, [existingPolicy, isOpen, leaveTypes]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!policy.leaveTypeId) {
            alert('Please select a leave type.');
            return;
        }
        const policyToSave: LeaveAccrualPolicy = {
            id: existingPolicy?.id || `lap_${Date.now()}`,
            leaveTypeId: policy.leaveTypeId,
            amount: policy.amount || 0,
            frequency: policy.frequency || 'monthly',
        };
        onSave(policyToSave);
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'amount') {
            setPolicy(prev => ({ ...prev, amount: parseFloat(value) || 0 }));
        } else {
            setPolicy(prev => ({ ...prev, [name]: value as any }));
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6">{existingPolicy ? 'Edit Policy' : 'Add New Policy'}</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium">Leave Type</label>
                        <select name="leaveTypeId" value={policy.leaveTypeId} onChange={handleInputChange} required className="mt-1 w-full form-input">
                            {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Amount (Days)</label>
                            <input type="number" step="0.01" name="amount" value={policy.amount || ''} onChange={handleInputChange} required className="mt-1 w-full form-input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Frequency</label>
                            <select name="frequency" value={policy.frequency} onChange={handleInputChange} className="mt-1 w-full form-input">
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="annually">Annually</option>
                            </select>
                        </div>
                    </div>
                    <style>{`
                        .form-input { display: block; width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; background-color: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 0.375rem; }
                        .dark .form-input { color: #D1D5DB; background-color: #374151; border-color: #4B5563; }
                    `}</style>
                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 py-2 px-4 rounded-md">Cancel</button>
                        <button type="submit" className="bg-brand-primary text-white py-2 px-6 rounded-md">Save Policy</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LeavePolicyModal;
