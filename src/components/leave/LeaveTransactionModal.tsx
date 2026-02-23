
import React, { useState, useEffect } from 'react';
import { LeaveTransaction } from '../../types';
import { sanitizeString } from '../../utils/sanitization';

interface LeaveTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (transaction: Omit<LeaveTransaction, 'id' | 'staffId' | 'leaveTypeId'> | LeaveTransaction) => void;
    existingTransaction?: LeaveTransaction | null;
}

const LeaveTransactionModal: React.FC<LeaveTransactionModalProps> = ({ isOpen, onClose, onSave, existingTransaction }) => {
    const today = new Date().toISOString().split('T')[0];
    
    const [transaction, setTransaction] = useState({
        id: '',
        date: today,
        transactionType: 'adjustment' as 'adjustment' | 'accrual',
        amount: 0,
        notes: '',
    });

    useEffect(() => {
        if (existingTransaction) {
            setTransaction({
                id: existingTransaction.id,
                date: existingTransaction.date,
                transactionType: existingTransaction.transactionType as 'adjustment' | 'accrual',
                amount: existingTransaction.amount,
                notes: existingTransaction.notes || '',
            });
        } else {
            // Reset form when modal opens new
            setTransaction({
                 id: '',
                 date: today,
                 transactionType: 'adjustment',
                 amount: 0,
                 notes: '',
            });
        }
    }, [isOpen, existingTransaction, today]);
    
    if (!isOpen) return null;
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (transaction.amount === 0) {
            alert('Amount cannot be zero.');
            return;
        }
        if (!transaction.notes) {
            alert('Notes are required for manual transactions.');
            return;
        }
        
        const sanitizedTransaction = {
            ...transaction,
            notes: sanitizeString(transaction.notes),
        };
        
        // Remove empty ID so the parent generates one if needed, or keep it if updating
        if (!sanitizedTransaction.id) delete (sanitizedTransaction as any).id;

        onSave(sanitizedTransaction);
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'amount') {
            setTransaction(prev => ({ ...prev, amount: parseFloat(value) || 0 }));
        } else {
            setTransaction(prev => ({ ...prev, [name]: value as any }));
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center" /* No onClick close */>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6">{existingTransaction ? 'Edit Transaction' : 'Add Manual Transaction'}</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="transactionType" className="block text-sm font-medium">Transaction Type</label>
                            <select
                                name="transactionType"
                                id="transactionType"
                                value={transaction.transactionType}
                                onChange={handleInputChange}
                                required
                                className="mt-1 w-full form-input"
                            >
                                <option value="adjustment">Adjustment</option>
                                <option value="accrual">Accrual</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="date" className="block text-sm font-medium">Date</label>
                            <input
                                type="date"
                                name="date"
                                id="date"
                                value={transaction.date}
                                onChange={handleInputChange}
                                required
                                className="mt-1 w-full form-input"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label htmlFor="amount" className="block text-sm font-medium">Amount</label>
                        <input
                            type="number"
                            step="0.01"
                            name="amount"
                            id="amount"
                            value={transaction.amount}
                            onChange={handleInputChange}
                            required
                            className="mt-1 w-full form-input"
                            placeholder='e.g., 2 for adding, -1 for subtracting'
                        />
                        <p className="text-xs text-gray-500 mt-1">Use a positive value to add leave, a negative value to subtract.</p>
                    </div>

                    <div>
                        <label htmlFor="notes" className="block text-sm font-medium">Notes / Reason</label>
                        <textarea
                            name="notes"
                            id="notes"
                            rows={3}
                            value={transaction.notes}
                            onChange={handleInputChange}
                            required
                            className="mt-1 w-full form-input"
                            placeholder="A reason for this transaction is required."
                        ></textarea>
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
                    `}</style>

                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" className="bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-secondary transition-colors">
                            {existingTransaction ? 'Update Transaction' : 'Save Transaction'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LeaveTransactionModal;
