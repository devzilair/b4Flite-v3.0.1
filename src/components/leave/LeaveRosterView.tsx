import React, { useMemo } from 'react';
import { DepartmentalRosters, DepartmentSettings, Staff } from '../../types';
import RosterTable from '../RosterTable';

interface LeaveRosterViewProps {
    currentDate: Date;
    staff: Staff[];
    allRosters: DepartmentalRosters;
    departmentSettings: { [key: string]: DepartmentSettings };
    selectedDepartmentId: string;
}

const LeaveRosterView: React.FC<LeaveRosterViewProps> = ({
    currentDate,
    staff,
    allRosters,
    departmentSettings,
    selectedDepartmentId
}) => {
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    
    const { rosterData, settings, dutyCodes } = useMemo(() => {
        const effectiveDeptId = selectedDepartmentId === 'all' 
            ? staff[0]?.departmentId // If 'all', just pick first staff's dept to get some settings
            : selectedDepartmentId;

        if (!effectiveDeptId) {
            return { rosterData: {}, settings: null, dutyCodes: [] };
        }
        
        const currentDeptSettings = departmentSettings[effectiveDeptId];
        const dataForAllDeptsInMonth = allRosters[monthKey] || {};
        const data = dataForAllDeptsInMonth[selectedDepartmentId] || {};

        return {
            rosterData: data,
            settings: currentDeptSettings?.rosterSettings || null,
            dutyCodes: currentDeptSettings?.shiftCodes || [],
        };

    }, [monthKey, selectedDepartmentId, allRosters, departmentSettings, staff]);

    if (selectedDepartmentId === 'all') {
         return (
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg h-full min-h-[600px] flex items-center justify-center">
                <p className="text-gray-500 text-lg">Please select a specific department to view its roster.</p>
            </div>
        );
    }
    
    if (!settings || staff.length === 0) {
        return (
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg h-full min-h-[600px] flex items-center justify-center">
                <p className="text-gray-500 text-lg">Roster settings not available for this department, or no staff found.</p>
            </div>
        );
    }

    return (
        <RosterTable
            currentDate={currentDate}
            staff={staff}
            dutyCodes={dutyCodes}
            rosterData={rosterData}
            settings={settings}
            onCellUpdate={() => {}} // Read-only
            canEditRoster={false} // Read-only
        />
    );
};

export default LeaveRosterView;
