
import React, { useMemo, useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { isDatePublicHoliday } from '../../utils/dateUtils';
import { formatStaffName } from '../../utils/sanitization';
import { useFlightLog } from '../../hooks/useFlightLog';
import { useStaff } from '../../hooks/useStaff';
import { useSettings } from '../../hooks/useSettings';

const RosterFairnessReport: React.FC = () => {
    const { staff, loading: staffLoading } = useStaff();
    const { publicHolidays, loading: settingsLoading } = useSettings();
    const { flightLogRecords, loading: flightLoading } = useFlightLog();
    
    const loading = staffLoading || settingsLoading || flightLoading;
    const { currentUser, can } = usePermissions();

    // Input State
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 3); // Last 3 months
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

    // Report State
    const [isGenerated, setIsGenerated] = useState(false);
    const [activeFilters, setActiveFilters] = useState({ start: '', end: '' });

    const hasGlobalView = can('roster:view:all') || can('admin:view_settings');

    const handleGenerate = () => {
        setActiveFilters({ start: startDate, end: endDate });
        setIsGenerated(true);
    };

    const reportData = useMemo(() => {
        if (!isGenerated) return [];

        // Filter Staff (Pilots only for fairness usually)
        const pilots = staff.filter(s => {
            if (s.accountStatus === 'disabled') return false;
            // Must have pilot data
            if (!s.pilotData?.aircraftCategory || s.pilotData.aircraftCategory.length === 0) return false;
            
            if (!hasGlobalView) {
                // If Manager, check Dept
                if (can('roster:view:own_department') && currentUser && s.departmentId === currentUser.departmentId) return true;
                return s.id === currentUser?.id;
            }
            return true;
        });

        return pilots.map(pilot => {
            let weekendDays = 0;
            let phDays = 0;
            let earlyStarts = 0; // < 06:00
            let lateFinishes = 0; // > 22:00
            let totalDuties = 0;

            const myLogs = flightLogRecords.filter(r => 
                r.staffId === pilot.id && 
                r.date >= activeFilters.start && 
                r.date <= activeFilters.end
            );

            myLogs.forEach(log => {
                // Must be a duty day
                if (log.dutyStart || log.standbyOn) {
                    totalDuties++;
                    const dateObj = new Date(log.date);
                    
                    // Weekend Check
                    const day = dateObj.getDay();
                    if (day === 0 || day === 6) weekendDays++;

                    // PH Check
                    if (isDatePublicHoliday(dateObj, publicHolidays)) phDays++;

                    // Early/Late Check
                    if (log.dutyStart) {
                        const startH = parseInt(log.dutyStart.split(':')[0]);
                        if (startH < 6) earlyStarts++;
                    }
                    if (log.dutyEnd) {
                        const endH = parseInt(log.dutyEnd.split(':')[0]);
                        if (endH >= 22 || (endH < 6 && log.dutyEnd < (log.dutyStart || ''))) lateFinishes++; // Late if > 22 or overnight
                    }
                }
            });

            // Hardship Score = simple weighted sum
            const hardshipScore = (weekendDays * 1) + (phDays * 2) + (earlyStarts * 1.5) + (lateFinishes * 1.5);

            return {
                id: pilot.id,
                name: pilot.name,
                totalDuties,
                weekendDays,
                phDays,
                earlyStarts,
                lateFinishes,
                hardshipScore
            };
        }).sort((a, b) => b.hardshipScore - a.hardshipScore); // Highest burden first

    }, [staff, flightLogRecords, publicHolidays, isGenerated, activeFilters, hasGlobalView, currentUser, can]);

    if (loading) return <div>Loading...</div>;

    return (
        <div className="flex flex-col h-full space-y-6">
            
            {/* Criteria Panel */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 print:hidden">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                         <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                        Fairness Audit Criteria
                    </h2>
                </div>

                <div className="flex flex-wrap items-end gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Period</label>
                        <div className="flex items-center gap-2">
                             <input 
                                type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                className="p-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-sm"
                            />
                            <span className="text-gray-400">to</span>
                            <input 
                                type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                className="p-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-sm"
                            />
                        </div>
                    </div>

                    <div className="ml-auto">
                        <button 
                            onClick={handleGenerate}
                            className="bg-brand-primary text-white px-8 py-2.5 rounded-md hover:bg-brand-secondary flex items-center justify-center gap-2 font-bold shadow-lg text-sm transition-all active:scale-95"
                        >
                            Audit Roster
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Area */}
            {isGenerated ? (
                <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-grow flex flex-col min-h-[500px] animate-fade-in">
                    <div className="overflow-auto flex-grow relative">
                         <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 uppercase text-xs font-semibold sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 border-b dark:border-gray-600">Pilot</th>
                                    <th className="p-4 border-b dark:border-gray-600 text-center">Total Duties</th>
                                    <th className="p-4 border-b dark:border-gray-600 text-center bg-orange-50 dark:bg-orange-900/10">Weekends</th>
                                    <th className="p-4 border-b dark:border-gray-600 text-center bg-purple-50 dark:bg-purple-900/10">Public Holidays</th>
                                    <th className="p-4 border-b dark:border-gray-600 text-center">Early Starts (&lt;0600)</th>
                                    <th className="p-4 border-b dark:border-gray-600 text-center">Late Finishes (&gt;2200)</th>
                                    <th className="p-4 border-b dark:border-gray-600 text-center w-24">Load Index</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {reportData.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="p-4 font-bold text-gray-900 dark:text-white border-r dark:border-gray-700">
                                            {formatStaffName(row.name)}
                                        </td>
                                        <td className="p-4 text-center border-r dark:border-gray-700">{row.totalDuties}</td>
                                        <td className="p-4 text-center font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/5 border-r dark:border-gray-700">
                                            {row.weekendDays}
                                        </td>
                                        <td className="p-4 text-center font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/5 border-r dark:border-gray-700">
                                            {row.phDays}
                                        </td>
                                        <td className="p-4 text-center border-r dark:border-gray-700">{row.earlyStarts}</td>
                                        <td className="p-4 text-center border-r dark:border-gray-700">{row.lateFinishes}</td>
                                        <td className="p-4 text-center">
                                            <div className="inline-block px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700 font-mono font-bold text-xs">
                                                {row.hardshipScore.toFixed(1)}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    </div>
                </div>
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 min-h-[400px]">
                     <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                     </div>
                     <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">Report Not Generated</h3>
                     <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                        Select a date range and click <span className="font-bold text-brand-primary">Audit Roster</span> to view hardship metrics.
                     </p>
                </div>
            )}
        </div>
    );
};

export default RosterFairnessReport;
