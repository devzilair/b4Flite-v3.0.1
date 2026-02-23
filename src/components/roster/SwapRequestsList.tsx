
import React, { useMemo, useState } from 'react';
import { DutySwap, Staff, ShiftCodeDefinition, RosterData } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { useRoster } from '../../hooks/useRoster';
import { useStaff } from '../../hooks/useStaff';

interface SwapRequestsListProps {
    isOpen: boolean;
    onClose: () => void;
    currentMonthKey: string;
    rosterData: RosterData;
    dutyCodes: ShiftCodeDefinition[];
    departmentId: string;
}

const SwapRequestsList: React.FC<SwapRequestsListProps> = ({ 
    isOpen, 
    onClose,
    currentMonthKey,
    rosterData,
    dutyCodes,
    departmentId
}) => {
    const { staff } = useStaff();
    const { dutySwaps, upsertDutySwap, deleteDutySwap, upsertRosterData } = useRoster();
    const { currentUser, can } = usePermissions();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const isManager = can('roster:edit') || can('roster:force_edit');

    const relevantSwaps = useMemo(() => {
        if (!currentUser) return [];
        return dutySwaps.filter(swap => {
            // Filter by month (approximate based on string match YYYY-MM)
            if (!swap.date.startsWith(currentMonthKey)) return false;

            // 1. Is the user directly involved? (Requester or Target) -> ALWAYS SHOW
            if (swap.requesterStaffId === currentUser.id || swap.targetStaffId === currentUser.id) {
                return true;
            }

            // 2. Is the user a Manager?
            if (isManager && swap.departmentId === departmentId) {
                // HIDE 'pending_peer' from managers. 
                // Managers should only see swaps once the peer has accepted (pending_manager) 
                // or if it is a historical record (approved/rejected).
                return swap.status !== 'pending_peer';
            }
            
            return false;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [dutySwaps, currentUser, isManager, currentMonthKey, departmentId]);

    const handleAction = async (swap: DutySwap, action: 'accept' | 'reject' | 'approve' | 'delete') => {
        if (!currentUser) return;
        setProcessingId(swap.id);
        
        try {
            if (action === 'delete') {
                if (window.confirm('Cancel this swap request?')) {
                    await deleteDutySwap(swap.id);
                }
            } else if (action === 'reject') {
                await upsertDutySwap({ ...swap, status: 'rejected' });
            } else if (action === 'accept') {
                await upsertDutySwap({ ...swap, status: 'pending_manager' });
            } else if (action === 'approve') {
                // EXECUTE SWAP LOGIC
                const date = swap.date;
                const reqId = swap.requesterStaffId;
                const tgtId = swap.targetStaffId;

                // Clone roster data to modify
                const newData = JSON.parse(JSON.stringify(rosterData));
                
                // Ensure date object exists
                if (!newData[date]) newData[date] = {};
                
                // Get current values (or empty if null)
                const reqEntry = newData[date][reqId] || { dutyCodeId: '' };
                const tgtEntry = newData[date][tgtId] || { dutyCodeId: '' };
                
                // Swap
                newData[date][reqId] = tgtEntry;
                newData[date][tgtId] = reqEntry;
                
                // Save Roster
                await upsertRosterData(currentMonthKey, departmentId, newData);
                
                // Update Swap Status
                await upsertDutySwap({ 
                    ...swap, 
                    status: 'approved', 
                    managerId: currentUser.id 
                });
                
                alert('Swap approved and roster updated.');
                onClose();
            }
        } catch (e: any) {
            alert('Action failed: ' + e.message);
        } finally {
            setProcessingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-4xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Duty Swap Requests</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2">
                    {relevantSwaps.length === 0 ? (
                        <p className="text-center text-gray-500 py-10">No active swap requests found for this month.</p>
                    ) : (
                        <div className="space-y-4">
                            {relevantSwaps.map(swap => {
                                const requester = staff.find(s => s.id === swap.requesterStaffId);
                                const target = staff.find(s => s.id === swap.targetStaffId);
                                const statusColors = {
                                    pending_peer: 'bg-yellow-100 text-yellow-800',
                                    pending_manager: 'bg-blue-100 text-blue-800',
                                    approved: 'bg-green-100 text-green-800',
                                    rejected: 'bg-red-100 text-red-800'
                                };
                                const isMyRequest = currentUser?.id === swap.requesterStaffId;
                                const isTargetMe = currentUser?.id === swap.targetStaffId;
                                
                                // Lookup codes from roster data for context
                                const reqCodeId = rosterData[swap.date]?.[swap.requesterStaffId]?.dutyCodeId;
                                const tgtCodeId = rosterData[swap.date]?.[swap.targetStaffId]?.dutyCodeId;
                                const reqCode = dutyCodes.find(c => c.id === reqCodeId)?.code || '-';
                                const tgtCode = dutyCodes.find(c => c.id === tgtCodeId)?.code || '-';

                                return (
                                    <div key={swap.id} className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/30">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${statusColors[swap.status]}`}>
                                                    {swap.status.replace('_', ' ')}
                                                </span>
                                                <span className="ml-3 text-sm font-bold text-gray-700 dark:text-gray-300">
                                                    {new Date(swap.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(swap.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 my-3 text-sm">
                                            <div className="flex-1 p-2 bg-white dark:bg-gray-800 rounded border dark:border-gray-600 text-center">
                                                <p className="font-bold text-brand-primary">{requester?.name}</p>
                                                <p className="text-xs text-gray-500">Current: {reqCode}</p>
                                            </div>
                                            <div className="text-gray-400">⇄</div>
                                            <div className="flex-1 p-2 bg-white dark:bg-gray-800 rounded border dark:border-gray-600 text-center">
                                                <p className="font-bold text-brand-primary">{target?.name}</p>
                                                <p className="text-xs text-gray-500">Current: {tgtCode}</p>
                                            </div>
                                        </div>
                                        
                                        {swap.notes && (
                                            <p className="text-xs text-gray-600 dark:text-gray-400 italic mb-3">
                                                "{swap.notes}"
                                            </p>
                                        )}

                                        <div className="flex justify-end gap-2 pt-2 border-t dark:border-gray-600">
                                            {/* Cancel Logic */}
                                            {isMyRequest && swap.status !== 'approved' && swap.status !== 'rejected' && (
                                                 <button 
                                                    onClick={() => handleAction(swap, 'delete')} 
                                                    disabled={!!processingId}
                                                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-bold hover:bg-red-200"
                                                >
                                                    Cancel Request
                                                </button>
                                            )}
                                            
                                            {/* Peer Accept Logic */}
                                            {isTargetMe && swap.status === 'pending_peer' && (
                                                <>
                                                    <button 
                                                        onClick={() => handleAction(swap, 'reject')} 
                                                        disabled={!!processingId}
                                                        className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-bold hover:bg-red-200"
                                                    >
                                                        Decline
                                                    </button>
                                                    <button 
                                                        onClick={() => handleAction(swap, 'accept')} 
                                                        disabled={!!processingId}
                                                        className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-bold hover:bg-green-200"
                                                    >
                                                        Accept & Forward to Manager
                                                    </button>
                                                </>
                                            )}
                                            
                                            {/* Manager Approve Logic */}
                                            {isManager && swap.status === 'pending_manager' && (
                                                <>
                                                     <button 
                                                        onClick={() => handleAction(swap, 'reject')} 
                                                        disabled={!!processingId}
                                                        className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700"
                                                    >
                                                        Reject
                                                    </button>
                                                    <button 
                                                        onClick={() => handleAction(swap, 'approve')} 
                                                        disabled={!!processingId}
                                                        className="px-3 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 shadow-sm"
                                                    >
                                                        Approve Swap
                                                    </button>
                                                </>
                                            )}
                                            
                                            {/* Status Only */}
                                            {swap.status === 'approved' && <span className="text-xs text-green-600 font-bold">Swap Completed</span>}
                                            {swap.status === 'rejected' && <span className="text-xs text-red-600 font-bold">Request Rejected</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SwapRequestsList;
