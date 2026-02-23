'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import LeaveMonthView from '@/components/leave/LeaveMonthView';
import LeaveYearView from '@/components/leave/LeaveYearView';
import LeaveCalendarView from '@/components/leave/LeaveCalendarView';
import TeamCalendarView from '@/components/leave/TeamCalendarView';
import LeaveRosterView from '@/components/leave/LeaveRosterView';
import { LeaveRequest, LeaveTransaction } from '@/types';
import LeaveRequestModal from '@/components/leave/LeaveRequestModal';
import ManageLeaveModal from '@/components/leave/ManageLeaveModal';
import LeaveRequestQueue from '@/components/leave/LeaveRequestQueue';
import { calculateChargeableDays } from '@/utils/dateUtils';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useRoster } from '@/hooks/useRoster';
import { useLeave } from '@/hooks/useLeave';
import { useSettings } from '@/hooks/useSettings';
import { useStaff } from '@/hooks/useStaff';

const LeavePlannerPage: React.FC = () => {
    const {
        staff,
        departments,
        loading: staffLoading
    } = useStaff();

    const {
        departmentSettings,
        leaveTypes,
        publicHolidays,
        loading: settingsLoading
    } = useSettings();

    const {
        leaveRequests,
        leaveTransactions,
        loading: leaveLoading,
        updateLeaveRequest,
        addLeaveRequest,
        deleteLeaveRequest,
        addLeaveTransaction,
        deleteTransactionsByRequestId,
        cleanupManualTransactions
    } = useLeave();

    const { rosters } = useRoster();
    const { currentUser, can } = usePermissions();

    const loading = staffLoading || leaveLoading || settingsLoading;

    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useLocalStorage<'month' | 'year' | 'calendar' | 'team' | 'roster'>('leave_planner_view', 'month');
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');

    // Modal state for creating requests (Manager action)
    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

    // Modal state for managing existing requests
    const [managingRequest, setManagingRequest] = useState<LeaveRequest | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (currentUser && selectedDepartmentId === 'all') {
            // Default to user's department if they aren't global admin
            if (!can('leave_planner:view_all')) {
                setSelectedDepartmentId(currentUser.departmentId);
            }
        }
    }, [currentUser, can, selectedDepartmentId]);

    const viewableDepartments = useMemo(() => {
        if (can('leave_planner:view_all')) return departments;
        if (can('leave_planner:view:own_department')) {
            return departments.filter(d => d.id === currentUser?.departmentId);
        }
        return [];
    }, [departments, can, currentUser]);

    const filteredStaff = useMemo(() => {
        let list = staff;
        if (selectedDepartmentId === 'all') {
            // If viewing all, filter based on permissions
            if (!can('leave_planner:view_all')) {
                list = staff.filter(s => s.departmentId === currentUser?.departmentId);
            }
        } else {
            list = staff.filter(s => s.departmentId === selectedDepartmentId);
        }
        return list.filter(s => s.accountStatus !== 'disabled');
    }, [staff, selectedDepartmentId, can, currentUser]);

    const filteredRequests = useMemo(() => {
        const staffIds = new Set(filteredStaff.map(s => s.id));
        return leaveRequests.filter(r => staffIds.has(r.staffId));
    }, [leaveRequests, filteredStaff]);

    // Dashboard Queue: Pending (Action Required) OR Upcoming Approved (Overview)
    const dashboardRequests = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return filteredRequests.filter(r =>
            r.status === 'pending' ||
            (r.status === 'approved' && r.endDate >= today)
        );
    }, [filteredRequests]);

    const handleMonthChange = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };

    const handleManagerCreateRequest = (requestData: Omit<LeaveRequest, 'id' | 'status' | 'staffId'>, forStaffId: string) => {
        const newRequest: LeaveRequest = {
            ...requestData,
            id: `lr_${Date.now()}`,
            staffId: forStaffId,
            status: 'pending',
        };

        addLeaveRequest(newRequest).then(() => {
            setIsManagerModalOpen(false);
        }).catch(err => alert("Failed to create request: " + err.message));
    };

    const handleRequestClick = (request: LeaveRequest) => {
        if (can('leave_planner:approve')) {
            setManagingRequest(request);
        }
    };

    const handleStatusUpdate = async (status: 'approved' | 'denied' | 'pending') => {
        if (!managingRequest) return;
        setIsProcessing(true);
        try {
            // 1. Update the Request Status
            await updateLeaveRequest({ ...managingRequest, status });

            // 2. Manage Ledger Transactions
            // Completely clear old transactions linked to this request to ensure consistency
            await deleteTransactionsByRequestId(managingRequest.id);

            // If Approved, create new deduction transactions
            if (status === 'approved') {
                await cleanupManualTransactions(managingRequest.staffId, managingRequest.startDate, managingRequest.endDate);

                const staffDeptId = staff.find(s => s.id === managingRequest.staffId)?.departmentId;
                const includeWeekends = staffDeptId ? (departmentSettings[staffDeptId]?.rosterSettings?.includeWeekendsInLeave || false) : false;

                const totalChargeable = calculateChargeableDays(managingRequest.startDate, managingRequest.endDate, publicHolidays, includeWeekends);

                const typeObj = leaveTypes.find(lt => lt.id === managingRequest.leaveTypeId);
                const isSick = typeObj?.name.toLowerCase().includes('sick') || typeObj?.name.toLowerCase().includes('medical');

                const phDaysToDeduct = isSick ? 0 : (managingRequest.phDaysApplied || 0);

                const actualPhDeduction = Math.min(phDaysToDeduct, totalChargeable);
                const annualDeduction = Math.max(0, totalChargeable - actualPhDeduction);

                if (actualPhDeduction > 0) {
                    const phType = leaveTypes.find(lt => lt.name.toLowerCase().includes('public holiday'));
                    if (phType) {
                        // Calculate PH Dates based on Position
                        let phDateRange = '';
                        const start = new Date(managingRequest.startDate);
                        const end = new Date(managingRequest.endDate);

                        if (managingRequest.phPosition === 'end') {
                            const phStart = new Date(end);
                            phStart.setUTCDate(phStart.getUTCDate() - (actualPhDeduction - 1));
                            phDateRange = `${phStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} to ${end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
                        } else {
                            // Default to Start
                            const phEnd = new Date(start);
                            phEnd.setUTCDate(phEnd.getUTCDate() + (actualPhDeduction - 1));
                            phDateRange = `${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} to ${phEnd.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
                        }

                        const phTrans: LeaveTransaction = {
                            id: `ltx_ph_${managingRequest.id}_${Date.now()}`,
                            staffId: managingRequest.staffId,
                            leaveTypeId: phType.id,
                            transactionType: 'leave_taken',
                            date: managingRequest.startDate,
                            amount: -actualPhDeduction,
                            notes: `Leave Taken (PH Portion): ${phDateRange}`,
                            relatedLeaveRequestId: managingRequest.id
                        };
                        await addLeaveTransaction(phTrans);
                    }
                }

                if (annualDeduction > 0) {
                    const annualTrans: LeaveTransaction = {
                        id: `ltx_al_${managingRequest.id}_${Date.now()}`,
                        staffId: managingRequest.staffId,
                        leaveTypeId: managingRequest.leaveTypeId,
                        transactionType: 'leave_taken',
                        date: managingRequest.startDate,
                        amount: -annualDeduction,
                        notes: `Leave Taken: ${managingRequest.startDate} to ${managingRequest.endDate}`,
                        relatedLeaveRequestId: managingRequest.id
                    };
                    await addLeaveTransaction(annualTrans);
                }
            }

            setManagingRequest(null);
        } catch (error: any) {
            console.error(error);
            alert("Failed to update status: " + (error.message || JSON.stringify(error)));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteRequest = async () => {
        if (!managingRequest) return;
        setIsProcessing(true);
        try {
            await deleteTransactionsByRequestId(managingRequest.id);
            await deleteLeaveRequest(managingRequest.id);
            setManagingRequest(null);
        } catch (error) {
            console.error(error);
            alert("Failed to delete request");
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) return <div>Loading planner...</div>;

    const monthName = currentDate.toLocaleString('default', { month: 'short', year: 'numeric' });
    const currentYear = currentDate.getFullYear();

    return (
        <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 pb-safe-bottom">
            {/* 
                PAGE LAYOUT: Vertical Scroll Container
                Header is now part of the scroll flow, meaning it can scroll off-screen 
                to give maximum space to the data grid.
            */}

            <div className="p-2 sm:p-4 space-y-4">

                {/* 1. HEADER & CONTROLS */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    {/* Title & Date */}
                    <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white truncate">Leave Planner</h1>

                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 shadow-inner">
                            <button onClick={() => handleMonthChange(-1)} className="w-10 h-8 flex items-center justify-center hover:bg-white dark:hover:bg-gray-600 rounded text-lg font-bold">‹</button>
                            <span className="font-bold min-w-[90px] text-center text-sm">{viewMode === 'year' ? currentYear : monthName}</span>
                            <button onClick={() => handleMonthChange(1)} className="w-10 h-8 flex items-center justify-center hover:bg-white dark:hover:bg-gray-600 rounded text-lg font-bold">›</button>
                        </div>
                    </div>

                    {/* Filters & Actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 flex gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                            <select
                                value={viewMode}
                                onChange={(e) => setViewMode(e.target.value as any)}
                                className="p-2 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600 font-medium shadow-sm focus:ring-2 focus:ring-brand-primary min-w-[120px]"
                            >
                                <option value="month">Month Matrix</option>
                                <option value="calendar">Calendar</option>
                                <option value="team">Team View</option>
                                <option value="year">Year View</option>
                                <option value="roster">Roster Overlay</option>
                            </select>

                            <select
                                value={selectedDepartmentId}
                                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                                className="p-2 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600 font-medium shadow-sm focus:ring-2 focus:ring-brand-primary flex-grow sm:flex-grow-0 sm:w-48"
                            >
                                {can('leave_planner:view_all') && <option value="all">All Departments</option>}
                                {viewableDepartments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        {can('leave_planner:approve') && (
                            <button
                                onClick={() => setIsManagerModalOpen(true)}
                                className="bg-brand-primary text-white text-sm font-bold px-4 py-2 rounded hover:bg-brand-secondary shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                <span>+</span> New Request
                            </button>
                        )}
                    </div>

                    {/* Dashboard Summary */}
                    {can('leave_planner:approve') && dashboardRequests.length > 0 && (
                        <div className="mt-4 pt-4 border-t dark:border-gray-700">
                            <LeaveRequestQueue
                                requests={dashboardRequests}
                                staff={filteredStaff}
                                leaveTypes={leaveTypes}
                                departments={departments}
                                onManage={setManagingRequest}
                                title="Pending"
                            />
                        </div>
                    )}
                </div>

                {/* 2. DATA VIEW AREA */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[500px]">
                    {viewMode === 'month' ? (
                        <LeaveMonthView
                            currentDate={currentDate}
                            staff={filteredStaff}
                            leaveRequests={filteredRequests}
                            departments={departments}
                            leaveTypes={leaveTypes}
                            leaveTransactions={leaveTransactions}
                            departmentSettings={departmentSettings}
                            selectedDepartmentId={selectedDepartmentId}
                            canViewBalances={can('leave_planner:view_balances')}
                            publicHolidays={publicHolidays}
                            onLeaveClick={handleRequestClick}
                        />
                    ) : (
                        <div className="p-2 sm:p-4">
                            {viewMode === 'year' && (
                                <LeaveYearView
                                    currentDate={currentDate}
                                    staff={filteredStaff}
                                    leaveRequests={filteredRequests}
                                    leaveTypes={leaveTypes}
                                />
                            )}
                            {viewMode === 'calendar' && (
                                <LeaveCalendarView
                                    currentDate={currentDate}
                                    staff={filteredStaff}
                                    leaveRequests={filteredRequests}
                                    leaveTypes={leaveTypes}
                                />
                            )}
                            {viewMode === 'team' && (
                                <TeamCalendarView
                                    currentDate={currentDate}
                                    staff={filteredStaff}
                                    leaveRequests={filteredRequests}
                                    leaveTypes={leaveTypes}
                                />
                            )}
                            {viewMode === 'roster' && (
                                <LeaveRosterView
                                    currentDate={currentDate}
                                    staff={filteredStaff}
                                    allRosters={rosters}
                                    departmentSettings={departmentSettings}
                                    selectedDepartmentId={selectedDepartmentId}
                                />
                            )}
                        </div>
                    )}
                </div>

            </div>

            {/* MODALS */}
            {isManagerModalOpen && currentUser && (
                <LeaveRequestModal
                    isOpen={isManagerModalOpen}
                    onClose={() => setIsManagerModalOpen(false)}
                    onSave={handleManagerCreateRequest}
                    currentUser={currentUser}
                    allStaff={filteredStaff}
                    allRequests={leaveRequests}
                    allTransactions={leaveTransactions}
                    allDeptSettings={departmentSettings}
                    allLeaveTypes={leaveTypes}
                    managerMode={true}
                />
            )}

            {managingRequest && (
                <ManageLeaveModal
                    isOpen={!!managingRequest}
                    onClose={() => setManagingRequest(null)}
                    request={managingRequest}
                    staffMember={staff.find(s => s.id === managingRequest.staffId)}
                    department={departments.find(d => d.id === staff.find(s => s.id === managingRequest.staffId)?.departmentId)}
                    leaveType={leaveTypes.find(lt => lt.id === managingRequest.leaveTypeId)}
                    onUpdateStatus={handleStatusUpdate}
                    onDelete={handleDeleteRequest}
                    isProcessing={isProcessing}
                />
            )}
        </div>
    );
};

export default LeavePlannerPage;
