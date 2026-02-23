
import React, { useState, useMemo } from 'react';
import { Staff, DutySwap, ShiftCodeDefinition } from '../../types';
import { useRoster } from '../../hooks/useRoster';

interface DutySwapModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: string;
    currentUser: Staff;
    departmentStaff: Staff[];
    dutyCode: ShiftCodeDefinition | undefined;
}

const DutySwapModal: React.FC<DutySwapModalProps> = ({ 
    isOpen, 
    onClose, 
    date, 
    currentUser, 
    departmentStaff,
    dutyCode
}) => {
    const { upsertDutySwap } = useRoster();
    const [selectedTargetId, setSelectedTargetId] = useState('');
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const eligibleTargets = useMemo(() => {
        return departmentStaff
            .filter(s => s.id !== currentUser.id && s.accountStatus === 'active')
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [departmentStaff, currentUser.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTargetId) return;

        setIsSubmitting(true);
        try {
            const swapRequest: DutySwap = {
                id: `swap_${Date.now()}`,
                requesterStaffId: currentUser.id,
                targetStaffId: selectedTargetId,
                departmentId: currentUser.departmentId,
                date: date,
                status: 'pending_peer',
                createdAt: new Date().toISOString(),
                notes: note
            };

            await upsertDutySwap(swapRequest);
            onClose();
            alert('Swap request sent successfully.');
        } catch (error: any) {
            console.error(error);
            alert('Failed to send request: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Request Duty Swap</h2>
                
                <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                        <span className="font-bold">Your Shift:</span> {dutyCode?.code || 'None'} on {new Date(date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                        Select a colleague to swap with. They must accept before manager approval.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Swap With</label>
                        <select 
                            value={selectedTargetId} 
                            onChange={e => setSelectedTargetId(e.target.value)}
                            required
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        >
                            <option value="">-- Select Pilot --</option>
                            {eligibleTargets.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-1">Reason / Note (Optional)</label>
                        <textarea 
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            rows={3}
                            placeholder="Reason for swap..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded text-sm hover:bg-gray-300">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={isSubmitting || !selectedTargetId}
                            className="px-4 py-2 bg-brand-primary text-white rounded text-sm hover:bg-brand-secondary disabled:opacity-50"
                        >
                            {isSubmitting ? 'Sending...' : 'Send Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DutySwapModal;
