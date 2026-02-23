
import React, { useMemo, useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { calculateDurationHours, decimalToTime } from '../../utils/timeUtils';
import { formatStaffName } from '../../utils/sanitization';
import { useFlightLog } from '../../hooks/useFlightLog';
import { useStaff } from '../../hooks/useStaff';

const CrewUtilizationReport: React.FC = () => {
    const { staff, loading: staffLoading } = useStaff();
    const { flightLogRecords, loading: flightLoading } = useFlightLog();
    const loading = staffLoading || flightLoading;

    const { currentUser, can } = usePermissions();
    
    // Input State
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

    // Report State
    const [isGenerated, setIsGenerated] = useState(false);
    const [activeFilters, setActiveFilters] = useState({ start: '', end: '' });

    // Permissions
    const hasGlobalView = can('roster:view:all') || can('admin:view_settings') || can('duty_log:view_all');

    const handleGenerate = () => {
        setActiveFilters({ start: startDate, end: endDate });
        setIsGenerated(true);
    };

    const reportData = useMemo(() => {
        if (!isGenerated) return [];

        // 1. Identify Pilots
        const pilots = staff.filter(s => {
            if (s.accountStatus === 'disabled') return false;
            const isPilot = s.pilotData && s.pilotData.aircraftCategory && s.pilotData.aircraftCategory.length > 0;
            if (!isPilot) return false;

            // Scope Check
            if (!hasGlobalView) {
                // If Manager, check Dept
                if (can('staff:view:own_department') && currentUser && s.departmentId === currentUser.departmentId) return true;
                // Else Self
                return s.id === currentUser?.id;
            }
            return true;
        });

        // 2. Aggregate
        return pilots.map(pilot => {
            let duty = 0;
            let flight = 0;
            let standby = 0;
            let sectors = 0;

            const logs = flightLogRecords.filter(r => 
                r.staffId === pilot.id && 
                r.date >= activeFilters.start && 
                r.date <= activeFilters.end
            );

            logs.forEach(log => {
                duty += calculateDurationHours(log.dutyStart, log.dutyEnd);
                standby += calculateDurationHours(log.standbyOn, log.standbyOff);
                
                let f = 0;
                if (log.flightHoursByAircraft) {
                    // Safe casting to avoid unknown[] error
                    f = (Object.values(log.flightHoursByAircraft) as number[]).reduce((sum, h) => sum + (Number(h)||0), 0);
                } else if (log.flightOn && log.flightOff) {
                    f = calculateDurationHours(log.flightOn, log.flightOff);
                }
                flight += f;
                if (log.sectors) sectors += log.sectors;
            });

            // Utilization: Flight Hours / Duty Hours (excluding Standby from Duty for this metric, or including? Usually Duty includes all work)
            // Pure Efficiency = Flight / (Duty + Standby)
            const totalWork = duty + standby;
            const utilization = totalWork > 0 ? (flight / totalWork) * 100 : 0;
            
            // Block Average
            const daysWorked = logs.filter(l => l.dutyStart || l.standbyOn).length;
            const blockAvg = daysWorked > 0 ? flight / daysWorked : 0;

            return {
                id: pilot.id,
                name: pilot.name,
                duty,
                flight,
                standby,
                sectors,
                utilization,
                blockAvg
            };
        }).sort((a, b) => b.utilization - a.utilization);

    }, [staff, flightLogRecords, isGenerated, activeFilters, hasGlobalView, currentUser, can]);

    if (loading) return <div>Loading...</div>;

    return (
        <div className="flex flex-col h-full space-y-6">
            
            {/* Criteria Panel */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 print:hidden">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                         <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Analysis Configuration
                    </h2>
                </div>

                <div className="flex flex-wrap items-end gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date Range</label>
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
                            Generate Analysis
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Area */}
            {isGenerated ? (
                <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-grow flex flex-col min-h-[500px] animate-fade-in">
                    <div className="p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center print:hidden">
                        <div className="flex gap-2 items-center">
                            <span className="text-xs text-gray-500 font-bold uppercase">Period:</span>
                            <span className="text-sm font-bold text-gray-800 dark:text-white">{activeFilters.start} to {activeFilters.end}</span>
                        </div>
                        <button 
                            onClick={() => window.print()}
                            className="text-xs bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-500 font-bold flex items-center gap-2 transition-colors shadow-sm"
                        >
                            🖨️ Print
                        </button>
                    </div>

                    <div className="overflow-auto flex-grow relative p-0 print:p-8">
                         <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 uppercase text-xs font-semibold sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 border-b dark:border-gray-600 sticky left-0 bg-gray-100 dark:bg-gray-700 z-20">Pilot</th>
                                    <th className="p-4 border-b dark:border-gray-600 text-center">Flight Hrs</th>
                                    <th className="p-4 border-b dark:border-gray-600 text-center">Duty Hrs</th>
                                    <th className="p-4 border-b dark:border-gray-600 text-center">Standby Hrs</th>
                                    <th className="p-4 border-b dark:border-gray-600 text-center">Sectors</th>
                                    <th className="p-4 border-b dark:border-gray-600 text-center w-32">Block Avg</th>
                                    <th className="p-4 border-b dark:border-gray-600 text-center w-32">Efficiency</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {reportData.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors print:break-inside-avoid">
                                        <td className="p-4 font-bold text-gray-900 dark:text-white border-r dark:border-gray-700 sticky left-0 bg-white dark:bg-gray-800 z-10">
                                            {formatStaffName(row.name)}
                                        </td>
                                        <td className="p-4 text-center font-mono font-bold text-blue-600 border-r dark:border-gray-700">
                                            {decimalToTime(row.flight)}
                                        </td>
                                        <td className="p-4 text-center font-mono border-r dark:border-gray-700">
                                            {decimalToTime(row.duty)}
                                        </td>
                                        <td className="p-4 text-center font-mono text-gray-500 border-r dark:border-gray-700">
                                            {decimalToTime(row.standby)}
                                        </td>
                                        <td className="p-4 text-center border-r dark:border-gray-700">
                                            {row.sectors}
                                        </td>
                                        <td className="p-4 text-center font-mono border-r dark:border-gray-700">
                                            {decimalToTime(row.blockAvg)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center gap-2 justify-end">
                                                <span className="font-bold text-xs">{row.utilization.toFixed(0)}%</span>
                                                <div className="w-16 bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                                                    <div 
                                                        className={`h-1.5 rounded-full ${row.utilization > 50 ? 'bg-green-500' : row.utilization > 30 ? 'bg-yellow-500' : 'bg-red-400'}`} 
                                                        style={{ width: `${Math.min(row.utilization, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {reportData.length === 0 && (
                                    <tr><td colSpan={7} className="p-8 text-center text-gray-500">No data found.</td></tr>
                                )}
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
                        Select a date range and click <span className="font-bold text-brand-primary">Generate Analysis</span> to view utilization metrics.
                     </p>
                </div>
            )}
        </div>
    );
};

export default CrewUtilizationReport;
