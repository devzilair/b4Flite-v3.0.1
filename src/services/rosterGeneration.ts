import { RosterData, Department } from '../types';

export const generateAllDepartmentRosters = (year: number, month: number, departments: Department[]): { [departmentId: string]: RosterData } => {
    const rosters: { [departmentId: string]: RosterData } = {};
    const daysInMonth = new Date(year, month, 0).getDate();

    departments.forEach(dept => {
        const rosterData: RosterData = {};
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(Date.UTC(year, month - 1, day));
            const dateString = date.toISOString().split('T')[0];
            rosterData[dateString] = {};
        }
        rosters[dept.id] = rosterData;
    });

    return rosters;
};
