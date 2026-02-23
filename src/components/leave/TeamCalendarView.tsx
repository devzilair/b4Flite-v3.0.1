import React, { useMemo } from 'react';
import { Staff, LeaveRequest, LeaveType } from '../../types';

interface TeamCalendarViewProps {
  currentDate: Date;
  staff: Staff[];
  leaveRequests: LeaveRequest[];
  leaveTypes: LeaveType[];
}

const TeamCalendarView: React.FC<TeamCalendarViewProps> = ({ currentDate, staff, leaveRequests, leaveTypes }) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const staffMap = useMemo(() => new Map(staff.map(s => [s.id, s])), [staff]);
    const leaveTypeMap = useMemo(() => new Map(leaveTypes.map(lt => [lt.id, lt])), [leaveTypes]);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    const approvedLeave = useMemo(() => leaveRequests.filter(r => r.status === 'approved'), [leaveRequests]);

    const dailyLeave = useMemo(() => {
        const map = new Map<number, { request: LeaveRequest, staff: Staff | undefined }[]>();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const leavesForDay = approvedLeave
                .filter(req => dateStr >= req.startDate && dateStr <= req.endDate)
                .map(req => ({ request: req, staff: staffMap.get(req.staffId) }))
                .filter(item => !!item.staff);

            if (leavesForDay.length > 0) {
                map.set(day, leavesForDay);
            }
        }
        return map;
    }, [year, month, daysInMonth, approvedLeave, staffMap]);

    const calendarCells = useMemo(() => {
        const cells = [];
        for (let i = 0; i < firstDayOfMonth; i++) {
            cells.push(<div key={`empty-start-${i}`} className="border-r border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"></div>);
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const leaves = dailyLeave.get(day) || [];
            cells.push(
                <div key={day} className="border-r border-b dark:border-gray-700 p-2 min-h-[120px] relative">
                    <div className="font-semibold text-right text-gray-700 dark:text-gray-300">{day}</div>
                    <div className="mt-1 space-y-1 overflow-y-auto max-h-24">
                        {leaves.map(({ request, staff }) => {
                            const leaveType = leaveTypeMap.get(request.leaveTypeId);
                            return (
                                <div 
                                    key={`${request.id}-${staff?.id}`} 
                                    title={`${staff?.name}: ${leaveType?.name}`} 
                                    className="text-xs p-1 rounded-md text-white truncate" 
                                    style={{ backgroundColor: leaveType?.color || '#777' }}
                                >
                                    {staff?.name}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        
        const totalCells = cells.length;
        const remainingCells = (7 - (totalCells % 7)) % 7;
        for (let i = 0; i < remainingCells; i++) {
            cells.push(<div key={`empty-end-${i}`} className="border-r border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"></div>);
        }
        return cells;
    }, [firstDayOfMonth, daysInMonth, dailyLeave, leaveTypeMap]);

    return (
        <div className="border-t border-l dark:border-gray-700">
            <div className="grid grid-cols-7 text-center font-bold">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-2 border-r border-b dark:border-gray-700 bg-gray-100 dark:bg-gray-700/50">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-5">
                {calendarCells}
            </div>
        </div>
    );
};

export default TeamCalendarView;
