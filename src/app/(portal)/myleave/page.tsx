'use client';

import React, { useState, useMemo } from 'react';
import LeaveRequestModal from '@/components/leave/LeaveRequestModal';
import { usePermissions } from '@/hooks/usePermissions';
import { LeaveRequest } from '@/types';
import LeavePrintModal from '@/components/leave/LeavePrintModal';
import { useLeave } from '@/hooks/useLeave';
import { useStaff } from '@/hooks/useStaff';
import { useSettings } from '@/hooks/useSettings';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full capitalize";
    const statusClasses = {
        pending: "bg-status-warning/20 text-status-warning",
        approved: "bg-status-success/20 text-status-success",
        denied: "bg-status-danger/20 text-status-danger",
    };
    return <span className={`${baseClasses} ${statusClasses[status as keyof typeof statusClasses]}`}>{status}</span>;
}

const MyLeavePage: React.FC = () => {
    const {
        staff,
        departments,
        loading: staffLoading
    } = useStaff();

    const { departmentSettings, leaveTypes, loading: settingsLoading } = useSettings();

    const {
        leaveRequests,
        addLeaveRequest,
        deleteLeaveRequest,
        leaveTransactions,
        loading: leaveLoading
    } = useLeave();

    const loading = staffLoading || leaveLoading || settingsLoading;
    const { currentUser } = usePermissions();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [printRequest, setPrintRequest] = useState<LeaveRequest | null>(null);

    const myRequests = useMemo(() => {
        if (!currentUser) return [];
        return leaveRequests
            .filter(req => req.staffId === currentUser.id)
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }, [leaveRequests, currentUser]);

    const leaveBalances = useMemo(() => {
        if (!currentUser) return new Map();
        const balances = new Map<string, number>();
        leaveTransactions
            .filter(t => t.staffId === currentUser.id)
            .forEach(t => {
                const currentBalance = balances.get(t.leaveTypeId) || 0;
                balances.set(t.leaveTypeId, currentBalance + t.amount);
            });
        return balances;
    }, [leaveTransactions, currentUser]);

    const handleSaveRequest = (newRequestData: Omit<LeaveRequest, 'id' | 'status' | 'staffId'>, forStaffId: string) => {
        const request: LeaveRequest = {
            ...newRequestData,
            id: `lr_${Date.now()}`,
            staffId: forStaffId,
            status: 'pending',
        };
        addLeaveRequest(request);
        setIsModalOpen(false);
    };

    const handleCancelRequest = async (requestId: string) => {
        if (window.confirm('Are you sure you want to cancel this leave request?')) {
            try {
                await deleteLeaveRequest(requestId);
            } catch (error: any) {
                alert(`Failed to cancel request: ${error.message}`);
            }
        }
    };

    if (loading || !currentUser) {
        return <div>Loading user data...</div>;
    }

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">My Leave</h1>

            {/* Leave Balances */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {leaveTypes.map(lt => (
                    <div key={lt.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">{lt.name}</h2>
                        <p className="text-4xl font-bold text-brand-primary">
                            {leaveBalances.get(lt.id)?.toFixed(2) || '0.00'}
                        </p>
                        <p className="text-sm text-gray-500">days remaining</p>
                    </div>
                ))}
            </div>

            {/* Leave Requests History */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Request History</h2>
                    <button onClick={() => setIsModalOpen(true)} className="bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-secondary transition-colors">
                        Request Leave
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="p-3">Leave Type</th>
                                <th className="p-3">Start Date</th>
                                <th className="p-3">End Date</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {myRequests.map(req => (
                                <tr key={req.id} className="border-b border-gray-200 dark:border-gray-600">
                                    <td className="p-3 font-medium">{leaveTypes.find(lt => lt.id === req.leaveTypeId)?.name || 'Unknown'}</td>
                                    <td className="p-3">{new Date(req.startDate + 'T00:00:00Z').toLocaleDateString()}</td>
                                    <td className="p-3">{new Date(req.endDate + 'T00:00:00Z').toLocaleDateString()}</td>
                                    <td className="p-3"><StatusBadge status={req.status} /></td>
                                    <td className="p-3 flex items-center gap-3">
                                        <button
                                            onClick={() => setPrintRequest(req)}
                                            className="text-gray-400 hover:text-brand-primary"
                                            title="Print Application Form"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" /></svg>
                                        </button>
                                        {req.status === 'pending' && (
                                            <button
                                                onClick={() => handleCancelRequest(req.id)}
                                                className="text-sm text-status-danger hover:underline"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {myRequests.length === 0 && (
                        <p className="text-center py-8 text-gray-500">You have not made any leave requests.</p>
                    )}
                </div>
            </div>

            {isModalOpen && currentUser && (
                <LeaveRequestModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveRequest}
                    currentUser={currentUser}
                    allStaff={staff}
                    allRequests={leaveRequests}
                    allTransactions={leaveTransactions}
                    allDeptSettings={departmentSettings}
                    allLeaveTypes={leaveTypes}
                />
            )}

            {printRequest && (
                <LeavePrintModal
                    isOpen={!!printRequest}
                    onClose={() => setPrintRequest(null)}
                    request={printRequest}
                    staffMember={currentUser}
                    department={departments.find(d => d.id === currentUser.departmentId)}
                    leaveType={leaveTypes.find(lt => lt.id === printRequest.leaveTypeId)}
                />
            )}
        </div>
    );
};

export default MyLeavePage;
