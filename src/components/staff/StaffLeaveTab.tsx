
import React, { useState, useMemo } from 'react';
import { Staff, LeaveRequest, LeaveType } from '../../types';
import { useSettings } from '../../hooks/useSettings';
import { useStaff } from '../../hooks/useStaff';
import LeavePrintModal from '../leave/LeavePrintModal';
import { useLeave } from '../../hooks/useLeave';

interface StaffLeaveTabProps {
    staff: Staff;
}

const StaffLeaveTab: React.FC<StaffLeaveTabProps> = ({ staff }) => {
    const { leaveTypes } = useSettings();
    const { departments } = useStaff();
    const { leaveRequests } = useLeave();
    const [printRequest, setPrintRequest] = useState<LeaveRequest | null>(null);

    // Get all requests for this staff member, sorted by newest first
    const staffRequests = useMemo(() => {
        return (leaveRequests || [])
            .filter(r => r.staffId === staff.id)
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }, [leaveRequests, staff.id]);

    const getStatusBadge = (status: string) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            approved: 'bg-green-100 text-green-800 border-green-200',
            denied: 'bg-red-100 text-red-800 border-red-200'
        };
        return (
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${styles[status as keyof typeof styles] || 'bg-gray-100'}`}>
                {status}
            </span>
        );
    };

    if (staffRequests.length === 0) {
        return (
            <div className="p-8 text-center bg-gray-50 dark:bg-gray-700/30 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <p className="text-gray-500 dark:text-gray-400">No leave history found for this staff member.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Leave History</h3>
                <span className="text-sm text-gray-500">Total Records: {staffRequests.length}</span>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700 text-xs uppercase text-gray-500 font-semibold">
                            <tr>
                                <th className="p-3">Type</th>
                                <th className="p-3">Dates</th>
                                <th className="p-3 text-center">Duration</th>
                                <th className="p-3">Status</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {staffRequests.map(req => {
                                const lType = leaveTypes.find(lt => lt.id === req.leaveTypeId);
                                const start = new Date(req.startDate);
                                const end = new Date(req.endDate);
                                const days = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                const isPast = end < new Date();

                                return (
                                    <tr key={req.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${isPast ? 'opacity-75' : ''}`}>
                                        <td className="p-3">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded border" style={{ color: lType?.color, borderColor: `${lType?.color}40`, backgroundColor: `${lType?.color}10` }}>
                                                {lType?.name}
                                            </span>
                                        </td>
                                        <td className="p-3 text-gray-700 dark:text-gray-200">
                                            {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} 
                                            {' - '} 
                                            {end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td className="p-3 text-center font-mono text-xs">
                                            {days} Days
                                        </td>
                                        <td className="p-3">
                                            {getStatusBadge(req.status)}
                                        </td>
                                        <td className="p-3 text-right">
                                            <button 
                                                onClick={() => setPrintRequest(req)}
                                                className="bg-gray-100 hover:bg-brand-primary hover:text-white text-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-brand-primary px-3 py-1 rounded text-xs font-bold transition-colors flex items-center gap-1 ml-auto"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                                Print Form
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {printRequest && (
                <LeavePrintModal 
                    isOpen={!!printRequest} 
                    onClose={() => setPrintRequest(null)} 
                    request={printRequest}
                    staffMember={staff}
                    department={departments.find(d => d.id === staff.departmentId)}
                    leaveType={leaveTypes.find(lt => lt.id === printRequest.leaveTypeId)}
                />
            )}
        </div>
    );
};

export default StaffLeaveTab;
