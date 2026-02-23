
import React, { useState } from 'react';
import { LeaveRequest, Staff, LeaveType, Department, LeaveTransaction } from '../../types';
import LeavePrintModal from './LeavePrintModal';
import LeaveRequestModal from './LeaveRequestModal';
import { calculateChargeableDays } from '../../utils/dateUtils';
import { useLeave } from '../../hooks/useLeave';
import { useStaff } from '../../hooks/useStaff';
import { useSettings } from '../../hooks/useSettings';

interface ManageLeaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: LeaveRequest;
    staffMember: Staff | undefined;
    department?: Department | undefined;
    leaveType: LeaveType | undefined;
    onUpdateStatus: (status: 'approved' | 'denied' | 'pending') => void;
    onDelete: () => void;
    isProcessing: boolean;
}

const ManageLeaveModal: React.FC<ManageLeaveModalProps> = ({ 
    isOpen, 
    onClose, 
    request, 
    staffMember, 
    department,
    leaveType, 
    onUpdateStatus, 
    onDelete,
    isProcessing
}) => {
    const { staff: staffList } = useStaff();
    const { departmentSettings, publicHolidays, leaveTypes } = useSettings();
    
    const {
        leaveRequests,
        leaveTransactions,
        updateLeaveRequest,
        addLeaveTransaction,
        deleteTransactionsByRequestId,
        cleanupManualTransactions
    } = useLeave();

    const [isPrintOpen, setIsPrintOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    if (!isOpen) return null;

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

    const getStatusBadge = (status: string) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            approved: 'bg-green-100 text-green-800 border-green-200',
            denied: 'bg-red-100 text-red-800 border-red-200'
        };
        return (
            <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${styles[status as keyof typeof styles] || 'bg-gray-100'}`}>
                {status}
            </span>
        );
    };

    const handleEditSave = async (updatedData: Omit<LeaveRequest, 'id' | 'status' | 'staffId'>, staffId: string) => {
        // Construct the full updated request object
        const updatedRequest: LeaveRequest = {
            ...request,
            ...updatedData,
            // ID and StaffID remain the same
        };

        try {
            // 1. Update the request itself
            await updateLeaveRequest(updatedRequest);

            // 2. If the request was APPROVED, we must regenerate the ledger transactions
            //    because dates or type might have changed.
            if (request.status === 'approved') {
                // A. Cleanup existing transactions
                // Use robust server-side deletion instead of client-side loop
                await deleteTransactionsByRequestId(request.id);

                // B. Cleanup manual roster entries to avoid double counting
                await cleanupManualTransactions(request.staffId, updatedRequest.startDate, updatedRequest.endDate);

                // C. Regenerate transactions based on new data
                // Get department settings to check weekend policy
                const staffDeptId = staffList.find(s => s.id === request.staffId)?.departmentId;
                const includeWeekends = staffDeptId ? (departmentSettings[staffDeptId]?.rosterSettings?.includeWeekendsInLeave || false) : false;

                const totalChargeable = calculateChargeableDays(updatedRequest.startDate, updatedRequest.endDate, publicHolidays, includeWeekends);
                
                // Determine if this is Sick Leave
                const typeObj = leaveTypes.find(lt => lt.id === updatedRequest.leaveTypeId);
                const isSick = typeObj?.name.toLowerCase().includes('sick') || typeObj?.name.toLowerCase().includes('medical');

                // If Sick Leave, ignore PH applied (treat as 0)
                const phDaysToDeduct = isSick ? 0 : (updatedRequest.phDaysApplied || 0);
                
                const actualPhDeduction = Math.min(phDaysToDeduct, totalChargeable);
                const annualDeduction = Math.max(0, totalChargeable - actualPhDeduction);

                if (actualPhDeduction > 0) {
                    const phType = leaveTypes.find(lt => lt.name.toLowerCase().includes('public holiday'));
                    if (phType) {
                         // Calculate PH Dates based on Position
                         let phDateRange = '';
                         const start = new Date(updatedRequest.startDate);
                         const end = new Date(updatedRequest.endDate);
                         
                         if (updatedRequest.phPosition === 'end') {
                             const phStart = new Date(end);
                             phStart.setUTCDate(phStart.getUTCDate() - (actualPhDeduction - 1));
                             phDateRange = `${phStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} to ${end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
                         } else {
                             // Default to Start
                             const phEnd = new Date(start);
                             phEnd.setUTCDate(phEnd.getUTCDate() + (actualPhDeduction - 1));
                             phDateRange = `${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} to ${phEnd.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
                         }

                        await addLeaveTransaction({
                            id: `ltx_ph_${updatedRequest.id}_${Date.now()}`,
                            staffId: updatedRequest.staffId,
                            leaveTypeId: phType.id,
                            transactionType: 'leave_taken',
                            date: updatedRequest.startDate,
                            amount: -actualPhDeduction,
                            notes: `Leave Taken (PH Portion): ${phDateRange}`,
                            relatedLeaveRequestId: updatedRequest.id
                        });
                    }
                }

                if (annualDeduction > 0) {
                    await addLeaveTransaction({
                        id: `ltx_al_${updatedRequest.id}_${Date.now()}`,
                        staffId: updatedRequest.staffId,
                        leaveTypeId: updatedRequest.leaveTypeId,
                        transactionType: 'leave_taken',
                        date: updatedRequest.startDate,
                        amount: -annualDeduction,
                        notes: `Leave Taken: ${updatedRequest.startDate} to ${updatedRequest.endDate}`,
                        relatedLeaveRequestId: updatedRequest.id
                    });
                }
            }

            setIsEditOpen(false);
            onClose(); // Close the manager modal to refresh/reflect changes in the parent view
        } catch (error: any) {
            console.error("Failed to update request:", error);
            alert("Failed to save changes: " + error.message);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Manage Leave Request</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">&times;</button>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border dark:border-gray-600">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Staff Member:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{staffMember?.name || 'Unknown'}</span>
                                
                                <span className="text-gray-500 dark:text-gray-400">Leave Type:</span>
                                <span className="font-semibold text-gray-900 dark:text-white" style={{ color: leaveType?.color }}>{leaveType?.name || 'Unknown'}</span>
                                
                                <span className="text-gray-500 dark:text-gray-400">Dates:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {formatDate(request.startDate)} - {formatDate(request.endDate)}
                                </span>

                                <span className="text-gray-500 dark:text-gray-400">Current Status:</span>
                                <div>{getStatusBadge(request.status)}</div>
                            </div>
                            {request.notes && (
                                <div className="mt-3 pt-2 border-t dark:border-gray-600">
                                    <span className="block text-xs text-gray-500 uppercase font-bold mb-1">Notes</span>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{request.notes}"</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setIsPrintOpen(true)}
                                className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 py-2 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 font-medium flex items-center justify-center gap-2 text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" /></svg>
                                Print Form
                            </button>
                            <button 
                                onClick={() => setIsEditOpen(true)}
                                className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 font-medium flex items-center justify-center gap-2 text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                Edit Details
                            </button>
                        </div>

                        <div className="flex gap-2">
                            {request.status !== 'approved' && (
                                <button 
                                    onClick={() => onUpdateStatus('approved')}
                                    disabled={isProcessing}
                                    className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50 font-medium"
                                >
                                    Approve
                                </button>
                            )}
                            {request.status !== 'denied' && (
                                <button 
                                    onClick={() => onUpdateStatus('denied')}
                                    disabled={isProcessing}
                                    className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50 font-medium"
                                >
                                    Deny
                                </button>
                            )}
                        </div>
                        
                        {request.status !== 'pending' && (
                            <button 
                                onClick={() => onUpdateStatus('pending')}
                                disabled={isProcessing}
                                className="w-full bg-yellow-500 text-white py-2 rounded hover:bg-yellow-600 disabled:opacity-50 font-medium"
                            >
                                Reset to Pending
                            </button>
                        )}

                        <hr className="border-gray-200 dark:border-gray-600 my-1" />

                        <button 
                            onClick={() => {
                                if(window.confirm('Are you sure you want to permanently delete this request? This cannot be undone.')) {
                                    onDelete();
                                }
                            }}
                            disabled={isProcessing}
                            className="w-full bg-gray-200 text-red-700 dark:bg-gray-700 dark:text-red-400 py-2 rounded hover:bg-red-100 dark:hover:bg-gray-600 disabled:opacity-50 text-sm font-semibold border border-transparent hover:border-red-200"
                        >
                            Delete Request
                        </button>
                    </div>
                </div>
            </div>
            
            <LeavePrintModal 
                isOpen={isPrintOpen} 
                onClose={() => setIsPrintOpen(false)} 
                request={request}
                staffMember={staffMember}
                department={department}
                leaveType={leaveType}
            />

            {isEditOpen && staffMember && (
                <LeaveRequestModal 
                    isOpen={isEditOpen} 
                    onClose={() => setIsEditOpen(false)} 
                    onSave={handleEditSave}
                    currentUser={staffMember} // Context user for modal logic
                    allStaff={staffList} // Correctly passed from context
                    allRequests={leaveRequests} // Correctly passing full request list for overlap check
                    allTransactions={leaveTransactions}
                    allDeptSettings={departmentSettings}
                    allLeaveTypes={leaveTypes}
                    managerMode={true} // Allow editing any staff
                    existingRequest={request} // Triggers Edit Mode
                />
            )}
        </>
    );
};

export default ManageLeaveModal;
