
import React, { useMemo, useState } from 'react';
import { LeaveRequest, Staff, LeaveType, Department } from '../../types';
import { formatStaffName } from '../../utils/sanitization';
import LeavePrintModal from './LeavePrintModal';

interface LeaveRequestQueueProps {
    requests: LeaveRequest[];
    staff: Staff[];
    leaveTypes: LeaveType[];
    departments?: Department[];
    onManage: (request: LeaveRequest) => void;
    title?: string;
}

const LeaveRequestQueue: React.FC<LeaveRequestQueueProps> = ({ 
    requests, 
    staff, 
    leaveTypes, 
    departments = [], 
    onManage, 
    title = "Leave Overview" 
}) => {
    const [printRequest, setPrintRequest] = useState<LeaveRequest | null>(null);

    const pendingRequests = useMemo(() => {
        return requests
            .filter(r => r.status === 'pending')
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }, [requests]);

    const approvedRequests = useMemo(() => {
        return requests
            .filter(r => r.status === 'approved')
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }, [requests]);

    if (pendingRequests.length === 0 && approvedRequests.length === 0) return null;

    return (
        <div className="mb-8 space-y-6">
            {/* 1. ACTION REQUIRED: Table View */}
            {pendingRequests.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/10 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <span className="w-2 h-6 bg-yellow-400 rounded-full"></span>
                            Pending Approvals
                        </h3>
                        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full border border-yellow-200 font-bold">
                            {pendingRequests.length} Request{pendingRequests.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500 font-semibold">
                                <tr>
                                    <th className="p-4">Staff Member</th>
                                    <th className="p-4">Leave Type</th>
                                    <th className="p-4">Dates</th>
                                    <th className="p-4">Duration</th>
                                    <th className="p-4 max-w-xs">Justification</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {pendingRequests.map(req => {
                                    const person = staff.find(s => s.id === req.staffId);
                                    const lType = leaveTypes.find(lt => lt.id === req.leaveTypeId);
                                    const deptName = person ? departments.find(d => d.id === person.departmentId)?.name : '';
                                    const start = new Date(req.startDate);
                                    const end = new Date(req.endDate);
                                    const days = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                                    return (
                                        <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                                        {person?.name.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 dark:text-white">{formatStaffName(person?.name || 'Unknown')}</div>
                                                        <div className="text-xs text-gray-500">{deptName}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-xs font-bold px-2 py-1 rounded border" style={{ color: lType?.color, borderColor: `${lType?.color}40`, backgroundColor: `${lType?.color}10` }}>
                                                    {lType?.name}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                                                 {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} 
                                                 {' - '} 
                                                 {end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </td>
                                            <td className="p-4 font-mono text-sm font-semibold">
                                                {days} Days
                                            </td>
                                            <td className="p-4 text-sm text-gray-500 italic max-w-xs truncate" title={req.justification}>
                                                {req.justification || '-'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                     <button 
                                                        onClick={() => setPrintRequest(req)}
                                                        className="text-gray-400 hover:text-brand-primary p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                                        title="Print Form"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                                    </button>
                                                    <button 
                                                        onClick={() => onManage(req)}
                                                        className="bg-brand-primary text-white text-xs font-bold px-4 py-2 rounded shadow-sm hover:bg-brand-secondary transition-colors"
                                                    >
                                                        Review
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 2. UPCOMING / APPROVED: Collapsible List */}
            {approvedRequests.length > 0 && (
                <details className="group bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden" open={pendingRequests.length === 0}>
                    <summary className="flex justify-between items-center p-4 cursor-pointer bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors list-none">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-500 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            <h3 className="font-bold text-gray-700 dark:text-gray-200">Upcoming Approved Leave</h3>
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full border border-green-200">
                                {approvedRequests.length}
                            </span>
                        </div>
                        <span className="text-xs text-gray-400 group-open:hidden">Click to expand</span>
                    </summary>
                    
                    <div className="overflow-x-auto border-t dark:border-gray-700">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white dark:bg-gray-800 text-xs uppercase text-gray-500 font-semibold">
                                <tr>
                                    <th className="p-3">Staff</th>
                                    <th className="p-3">Type</th>
                                    <th className="p-3">Dates</th>
                                    <th className="p-3 text-center">Days</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {approvedRequests.map(req => {
                                    const person = staff.find(s => s.id === req.staffId);
                                    const lType = leaveTypes.find(lt => lt.id === req.leaveTypeId);
                                    const start = new Date(req.startDate);
                                    const end = new Date(req.endDate);
                                    const days = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                                    return (
                                        <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="p-3 font-medium text-gray-900 dark:text-white">
                                                {formatStaffName(person?.name || 'Unknown')}
                                            </td>
                                            <td className="p-3">
                                                <span className="text-xs font-bold px-2 py-0.5 rounded border" style={{ color: lType?.color, borderColor: `${lType?.color}40`, backgroundColor: `${lType?.color}10` }}>
                                                    {lType?.name}
                                                </span>
                                            </td>
                                            <td className="p-3 text-gray-600 dark:text-gray-300 text-xs">
                                                {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} 
                                                {' - '} 
                                                {end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </td>
                                            <td className="p-3 text-center font-mono text-xs">{days}</td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button 
                                                        onClick={() => setPrintRequest(req)}
                                                        className="text-gray-400 hover:text-brand-primary p-1"
                                                        title="Print Form"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                                    </button>
                                                    <button 
                                                        onClick={() => onManage(req)}
                                                        className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-white underline"
                                                    >
                                                        Details
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </details>
            )}

            {printRequest && (
                <LeavePrintModal 
                    isOpen={!!printRequest} 
                    onClose={() => setPrintRequest(null)} 
                    request={printRequest}
                    staffMember={staff.find(s => s.id === printRequest.staffId)}
                    department={departments.find(d => d.id === staff.find(s => s.id === printRequest.staffId)?.departmentId)}
                    leaveType={leaveTypes.find(lt => lt.id === printRequest.leaveTypeId)}
                />
            )}
        </div>
    );
};

export default LeaveRequestQueue;
