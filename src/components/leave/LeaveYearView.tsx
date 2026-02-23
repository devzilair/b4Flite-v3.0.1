
import React, { useMemo } from 'react';
import { Staff, LeaveRequest, LeaveType } from '../../types';
import { formatStaffName } from '../../utils/sanitization';

interface LeaveYearViewProps {
  currentDate: Date;
  staff: Staff[];
  leaveRequests: LeaveRequest[];
  leaveTypes: LeaveType[];
}

const LeaveYearView: React.FC<LeaveYearViewProps> = ({ currentDate, staff, leaveRequests, leaveTypes }) => {
    const year = currentDate.getFullYear();

    const sortedStaff = useMemo(() => {
        return [...staff].sort((a, b) => {
             const seniorityA = a.pilotData?.seniorityLevel ?? 999;
             const seniorityB = b.pilotData?.seniorityLevel ?? 999;
             if (seniorityA < seniorityB) return -1;
             if (seniorityA > seniorityB) return 1;
             return a.name.localeCompare(b.name);
        });
    }, [staff]);

    const getLeaveForDay = (staffId: string, date: Date) => {
        const dateString = date.toISOString().split('T')[0];
        return leaveRequests.find(req => 
            req.staffId === staffId &&
            dateString >= req.startDate &&
            dateString <= req.endDate &&
            (req.status === 'approved' || req.status === 'pending')
        );
    };

    const renderMonth = (month: number) => {
        const monthDate = new Date(Date.UTC(year, month, 1));
        const monthName = monthDate.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        return (
            <div key={month} className="mb-8 last:mb-0 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-2">{monthName} {year}</h3>
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 print:border-black print:overflow-visible">
                    <table className="w-full border-collapse text-sm print:text-[10px]">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="sticky left-0 bg-gray-50 dark:bg-gray-700/50 p-2 border-b border-r dark:border-gray-600 text-left min-w-[150px] font-semibold print:static print:bg-transparent print:border-black">Staff</th>
                                {days.map(day => {
                                    const date = new Date(Date.UTC(year, month, day));
                                    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
                                    return (
                                        <th key={day} className={`p-2 border-b dark:border-gray-600 min-w-[32px] text-center font-normal print:p-0.5 print:border-black print:min-w-0 ${isWeekend ? 'bg-gray-200 dark:bg-gray-600 font-bold' : ''}`}>
                                            {day}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedStaff.map(person => (
                                <tr key={person.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50">
                                    <td className="sticky left-0 bg-white dark:bg-gray-800 p-2 border-b border-r dark:border-gray-600 font-medium whitespace-nowrap truncate print:static print:bg-transparent print:border-black print:p-1" title={person.name}>{formatStaffName(person.name)}</td>
                                    {days.map(day => {
                                        const cellDate = new Date(Date.UTC(year, month, day));
                                        const isWeekend = cellDate.getUTCDay() === 0 || cellDate.getUTCDay() === 6;
                                        const leave = getLeaveForDay(person.id, cellDate);
                                        
                                        // Standard screen classes
                                        let cellClass = 'border-b border-r dark:border-gray-700 w-8 h-8';
                                        // Print override classes
                                        cellClass += ' print:border-black print:w-auto print:h-auto';

                                        if (leave) {
                                            if (leave.status === 'approved') {
                                                cellClass += ' bg-status-success/50 print:bg-gray-300'; // Use gray for print contrast if color printing is off
                                            } else if (leave.status === 'pending') {
                                                cellClass += ' bg-status-danger/50 print:bg-gray-200';
                                            }
                                        } else if (isWeekend) {
                                            cellClass += ' bg-gray-100 dark:bg-gray-800';
                                        }

                                        return <td key={day} className={cellClass}></td>;
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {sortedStaff.length === 0 && <p className="text-center py-4 text-gray-500">No staff found for this department.</p>}
                </div>
            </div>
        );
    };

    return (
        <div className="print:block">
            {Array.from({ length: 12 }).map((_, i) => renderMonth(i))}
        </div>
    );
};

export default LeaveYearView;
