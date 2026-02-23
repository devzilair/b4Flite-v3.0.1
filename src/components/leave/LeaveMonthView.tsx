
import React, { useMemo } from 'react';
import { Staff, LeaveRequest, Department, LeaveType, LeaveTransaction, DepartmentSettings, PublicHoliday } from '../../types';
import { formatStaffName } from '../../utils/sanitization';
import { isDatePublicHoliday } from '../../utils/dateUtils';

interface LeaveMonthViewProps {
  currentDate: Date;
  staff: Staff[];
  leaveRequests: LeaveRequest[];
  departments: Department[];
  leaveTypes: LeaveType[];
  leaveTransactions: LeaveTransaction[];
  departmentSettings: { [key: string]: DepartmentSettings };
  selectedDepartmentId: string;
  canViewBalances: boolean;
  publicHolidays: PublicHoliday[];
  onLeaveClick?: (request: LeaveRequest) => void; 
}

const LeaveMonthView: React.FC<LeaveMonthViewProps> = ({ 
    currentDate, 
    staff, 
    leaveRequests, 
    departments, 
    leaveTypes, 
    leaveTransactions,
    departmentSettings,
    selectedDepartmentId,
    canViewBalances,
    publicHolidays,
    onLeaveClick,
}) => {
    
  const departmentMap = useMemo(() => {
    const map = new Map<string, Department>();
    departments.forEach(d => map.set(d.id, d));
    return map;
  }, [departments]);

  const leaveTypeMap = useMemo(() => {
      const map = new Map<string, LeaveType>();
      leaveTypes.forEach(lt => map.set(lt.id, lt));
      return map;
  }, [leaveTypes]);
    
  const sortedStaff = useMemo(() => {
    const newStaff = [...staff];
    return newStaff.sort((a, b) => {
      const deptA = departmentMap.get(a.departmentId)?.name ?? 'ZZZ';
      const deptB = departmentMap.get(b.departmentId)?.name ?? 'ZZZ';
      if (deptA < deptB) return -1;
      if (deptA > deptB) return 1;

      const subDeptA = (a.subDepartments || [])[0] ?? 'ZZZ';
      const subDeptB = (b.subDepartments || [])[0] ?? 'ZZZ';
      if (subDeptA < subDeptB) return -1;
      if (subDeptA > subDeptB) return 1;

      const seniorityA = a.pilotData?.seniorityLevel ?? 999;
      const seniorityB = b.pilotData?.seniorityLevel ?? 999;
      if (seniorityA < seniorityB) return -1;
      if (seniorityA > seniorityB) return 1;
      
      return a.name.localeCompare(b.name);
    });
  }, [staff, departmentMap]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getUTCFullYear();
    const month = currentDate.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const date = new Date(Date.UTC(year, month, day));
      return {
        day,
        dateObj: date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
        isWeekend: [0, 6].includes(date.getUTCDay()),
      };
    });
  }, [currentDate]);

  const leaveMap = useMemo(() => {
    const map = new Map<string, LeaveRequest>();
    leaveRequests.forEach(req => {
        let current = new Date(req.startDate + 'T00:00:00Z');
        const end = new Date(req.endDate + 'T00:00:00Z');
        while(current <= end) {
            const key = `${req.staffId}-${current.toISOString().split('T')[0]}`;
            map.set(key, req);
            current.setDate(current.getDate() + 1);
        }
    });
    return map;
  }, [leaveRequests]);
  
  const leaveBalances = useMemo(() => {
    const balances = new Map<string, number | 'N/A'>();
    staff.forEach(person => {
        const primaryLeaveType = leaveTypes.find(lt => lt.name.toLowerCase().includes('annual'));
        if (!primaryLeaveType) {
            balances.set(person.id, 'N/A');
            return;
        }
        const balance = leaveTransactions
            .filter(t => t.staffId === person.id && t.leaveTypeId === primaryLeaveType.id)
            .reduce((acc, t) => acc + t.amount, 0);
        balances.set(person.id, balance);
    });
    return balances;
  }, [staff, leaveTransactions, leaveTypes]);

  const dailyLeaveCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (selectedDepartmentId === 'all') return counts;

    const deptStaffIds = new Set(staff.map(s => s.id));
    calendarDays.forEach(day => {
        let count = 0;
        const dateStr = day.dateObj.toISOString().split('T')[0];
        for (const req of leaveRequests) {
            if (deptStaffIds.has(req.staffId)) {
                if (dateStr >= req.startDate && dateStr <= req.endDate) {
                    count++;
                }
            }
        }
        counts.set(dateStr, count);
    });
    return counts;
  }, [calendarDays, leaveRequests, staff, selectedDepartmentId]);

  const maxLeaveForDept = departmentSettings[selectedDepartmentId]?.maxConcurrentLeave;
  let lastDeptId: string | null = null;
  let lastSubDept: string | null = null;
  
  const colSpan = calendarDays.length + (canViewBalances ? 2 : 1);

  return (
    <div className="w-full overflow-x-auto pb-4">
      {/* 
        This wrapper handles HORIZONTAL scrolling of the wide table.
        Vertical scrolling is now handled by the page container (LeavePlannerPage).
        Sticky headers won't stick to the page top because of overflow-x: auto, 
        but this tradeoff is acceptable to allow the header to scroll away and maximize space.
      */}
      <style>{`
        @media print {
          @page {
             size: A4 landscape;
             margin: 3mm;
          }
          table {
            font-size: 8px !important;
            width: 100%;
            table-layout: fixed;
          }
          th, td {
             padding: 1px !important;
             height: auto !important;
             border: 1px solid #ccc !important;
          }
          th:nth-child(1), td:nth-child(1) {
              width: 100px !important;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
          }
          th:nth-child(2), td:nth-child(2) {
              width: 30px !important;
          }
        }
      `}</style>
      <table className="w-full border-collapse text-xs sm:text-sm min-w-max">
        <thead className="bg-gray-100 dark:bg-gray-700">
          <tr>
            <th className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-700 p-1 sm:p-2 border-b-2 border-r border-gray-300 dark:border-gray-600 text-left min-w-[120px] sm:min-w-[180px] print:min-w-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Staff</th>
            {canViewBalances && <th className="bg-gray-100 dark:bg-gray-700 p-1 sm:p-2 border-b-2 border-r border-gray-300 dark:border-gray-600 text-center min-w-[50px] sm:min-w-[70px] print:min-w-0">Bal</th>}
            {calendarDays.map(({ day, dayName, isWeekend, dateObj }) => {
                const dateString = dateObj.toISOString().split('T')[0];
                const leaveCount = dailyLeaveCounts.get(dateString) || 0;
                const exceedsQuota = maxLeaveForDept !== undefined && leaveCount >= maxLeaveForDept;
                const quotaTooltip = exceedsQuota ? `Leave quota met: ${leaveCount}/${maxLeaveForDept}` : '';

                const isPublicHoliday = isDatePublicHoliday(dateObj, publicHolidays);
                
                const headerClasses = [
                    'p-1 sm:p-2 border-b-2 border-r border-gray-300 dark:border-gray-600 text-center font-medium min-w-[32px] sm:min-w-[40px]',
                    isWeekend && 'text-brand-accent bg-orange-50 dark:bg-orange-900/10',
                    exceedsQuota && 'bg-status-warning/30',
                    isPublicHoliday && 'bg-blue-200 dark:bg-blue-900/40 text-blue-800 dark:text-blue-100'
                ].filter(Boolean).join(' ');

                return (
                  <th key={day} title={`${quotaTooltip} ${isPublicHoliday ? 'Public Holiday' : ''}`.trim()} className={headerClasses}>
                    <div className="print:hidden text-[10px] sm:text-xs opacity-70">{dayName.substring(0,3)}</div>
                    <div className="hidden print:block text-[7px]">{dayName.substring(0,1)}</div>
                    <div>{day}</div>
                  </th>
                );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedStaff.map((person) => {
            const showDeptHeader = person.departmentId !== lastDeptId;
            const currentFirstSubDept = (person.subDepartments || [])[0] ?? null;
            const showSubDeptHeader = showDeptHeader || (currentFirstSubDept && currentFirstSubDept !== lastSubDept);
            
            lastDeptId = person.departmentId;
            lastSubDept = currentFirstSubDept;
            
            const deptName = departmentMap.get(person.departmentId)?.name;

            return (
              <React.Fragment key={person.id}>
                {showDeptHeader && (
                  <tr>
                    <td colSpan={colSpan} className="bg-brand-primary text-white font-bold p-1 sm:p-2 sticky left-0 print:bg-gray-300 print:text-black print:py-1 z-0">
                      {deptName}
                    </td>
                  </tr>
                )}
                 {showSubDeptHeader && (
                   <tr>
                    <td colSpan={colSpan} className="bg-brand-secondary text-white font-semibold p-1 pl-4 sticky left-0 print:bg-gray-200 print:text-black print:py-1 z-0 text-xs">
                      {(person.subDepartments || []).join(' / ')}
                    </td>
                  </tr>
                )}
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 print:break-inside-avoid">
                  <td className="sticky left-0 bg-white dark:bg-gray-800 p-1 sm:p-2 border-b border-r border-gray-200 dark:border-gray-600 font-medium whitespace-nowrap truncate z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" title={person.name}>
                    {formatStaffName(person.name)}
                  </td>
                  {canViewBalances &&
                    <td className="p-1 sm:p-2 border-b border-r border-gray-200 dark:border-gray-600 text-center font-semibold text-xs sm:text-sm">
                      {leaveBalances.get(person.id)}
                    </td>
                  }
                  {calendarDays.map(({ dateObj, isWeekend }) => {
                    const dateString = dateObj.toISOString().split('T')[0];
                    const leaveRequest = leaveMap.get(`${person.id}-${dateString}`);
                    const leaveColor = leaveRequest ? leaveTypeMap.get(leaveRequest.leaveTypeId)?.color : undefined;
                    
                    return (
                        <td 
                            key={`${person.id}-${dateString}`} 
                            className={`p-0 border-b border-r border-gray-200 dark:border-gray-600 text-center h-8 sm:h-10 print:h-auto relative ${leaveRequest ? 'cursor-pointer hover:opacity-80' : ''}`}
                            onClick={() => leaveRequest && onLeaveClick && onLeaveClick(leaveRequest)}
                        >
                           <div className={`w-full h-full print-color-adjust-exact ${isWeekend && !leaveColor ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`} style={{ backgroundColor: leaveColor, opacity: leaveColor ? 0.4 : 1 }}>
                           </div>
                           {leaveRequest && (
                                <div title={`${leaveRequest.status === 'approved' ? 'Approved' : 'Pending'} - Click to manage`} className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shadow-sm border border-white/50 ${leaveRequest.status === 'approved' ? 'bg-status-success' : 'bg-status-danger'}`}></div>
                           )}
                        </td>
                    );
                  })}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default LeaveMonthView;
    