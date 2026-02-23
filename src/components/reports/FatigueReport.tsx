
import React, { useMemo, useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { calculateFdpDetails, calculateRestPeriod, calculateDurationHours, decimalToTime } from '../../services/ftlCalculations';
import { formatStaffName } from '../../utils/sanitization';
import { useFlightLog } from '../../hooks/useFlightLog';
import { useStaff } from '../../hooks/useStaff';

const FatigueReport: React.FC = () => {
    const { staff, loading: staffLoading } = useStaff();
    const { flightLogRecords, loading: flightLoading } = useFlightLog();
    const loading = staffLoading || flightLoading;

    const { currentUser, can } = usePermissions();

    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => {
        return new Date().toISOString().split('T')[0];
    });

    const [isGenerated, setIsGenerated] = useState(false);
    const hasGlobalAccess = can('roster:view:all') || can('duty_log:view_all');

    const handleGenerate = () => setIsGenerated(true);

    const { violationsData, discretionData } = useMemo(() => {
        if (!isGenerated) return { violationsData: [], discretionData: [] };

        const relevantRecords = flightLogRecords.filter(r => 
            r.date >= startDate && 
            r.date <= endDate
        ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const violations: any[] = [];
        const discretion: any[] = [];

        const recordsByPilot: Record<string, typeof relevantRecords> = {};
        
        relevantRecords.forEach(r => {
            if (!recordsByPilot[r.staffId]) recordsByPilot[r.staffId] = [];
            recordsByPilot[r.staffId].push(r);
        });

        Object.keys(recordsByPilot).forEach(pilotId => {
            const pilot = staff.find(s => s.id === pilotId);
            if (!hasGlobalAccess && currentUser && pilot?.departmentId !== currentUser.departmentId) return;
            if (!pilot || pilot.accountStatus === 'disabled') return;

            const pilotLog = recordsByPilot[pilotId];
            
            pilotLog.forEach((record) => {
                const issues: string[] = [];
                const discretionDetails: string[] = [];
                const aircraftCat = pilot.pilotData?.aircraftCategory?.[0] || 'Helicopter'; 

                // 1. FDP Analysis
                if (record.fdpStart && record.fdpEnd) {
                    const actualFdp = calculateDurationHours(record.fdpStart, record.fdpEnd);
                    const fdpDetails = calculateFdpDetails(record, aircraftCat);
                    
                    // BASE FDP (Without Extension)
                    const baseFdp = fdpDetails.maxFdp - fdpDetails.fdpExtension;

                    // Hard Violation: Actual > Max (With Ext)
                    if (fdpDetails.maxFdp > 0 && actualFdp > fdpDetails.maxFdp) {
                        issues.push(`FDP Violation: ${decimalToTime(actualFdp)} > ${decimalToTime(fdpDetails.maxFdp)} (Max)`);
                    }
                    
                    // Discretion: Actual > Base (but < Max) OR Valid Split Duty
                    // In EASA, any extension is a form of discretion/modification that should be tracked.
                    // Or, if actual exceeds maxFdp, it MIGHT be commander's discretion used in flight.
                    if (actualFdp > baseFdp && actualFdp <= fdpDetails.maxFdp) {
                        discretionDetails.push(`Split Duty Extension Used: +${decimalToTime(fdpDetails.fdpExtension)}h`);
                    }
                    
                    // Note: If Actual > MaxFdp, this is technically a VIOLATION unless Captain filed discretion.
                    // We flag it as violation primarily, but also note it here for review.
                }

                // 2. Rest
                const prevRecord = flightLogRecords.find(r => r.staffId === pilotId && r.date < record.date && (r.dutyEnd || r.standbyOff));
                if (prevRecord) {
                   const restCalc = calculateRestPeriod(record, prevRecord);
                   if (restCalc.restViolation) {
                       issues.push(restCalc.restViolation);
                   }
                }

                if (issues.length > 0) {
                    violations.push({
                        id: record.id,
                        date: record.date,
                        pilotName: pilot.name,
                        issues
                    });
                }

                if (discretionDetails.length > 0) {
                    discretion.push({
                        id: record.id,
                        date: record.date,
                        pilotName: pilot.name,
                        details: discretionDetails
                    });
                }
            });
        });

        return { 
            violationsData: violations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            discretionData: discretion.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        };

    }, [isGenerated, startDate, endDate, flightLogRecords, staff, hasGlobalAccess, currentUser]);

    if (loading) return <div>Loading...</div>;

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 print:hidden">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Fatigue & FDP Analysis</h2>
                </div>
                <div className="flex items-end gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Search Period</label>
                        <div className="flex items-center gap-2">
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm" />
                            <span className="text-gray-400">to</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm" />
                        </div>
                    </div>
                    <button onClick={handleGenerate} className="bg-brand-primary text-white px-6 py-2 rounded-md hover:bg-brand-secondary text-sm font-bold shadow-md">
                        Scan Logs
                    </button>
                </div>
            </div>

            {isGenerated && (
                <div className="space-y-6">
                    {/* Violations Section */}
                    <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="p-4 bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900 flex justify-between items-center">
                            <div className="flex gap-2 items-center text-red-800 dark:text-red-200">
                                <span className="font-bold uppercase tracking-wide text-xs">ORO.FTL Violation Events</span>
                                <span className="bg-red-200 text-red-800 px-2 py-0.5 rounded-full text-xs font-bold">{violationsData.length}</span>
                            </div>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-100 dark:bg-gray-700 text-xs font-semibold">
                                    <tr>
                                        <th className="p-3 w-32">Date</th>
                                        <th className="p-3 w-48">Pilot</th>
                                        <th className="p-3">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {violationsData.map((v) => (
                                        <tr key={v.id} className="hover:bg-red-50 dark:hover:bg-red-900/20">
                                            <td className="p-3 font-mono text-gray-600 dark:text-gray-400">{v.date}</td>
                                            <td className="p-3 font-bold">{formatStaffName(v.pilotName)}</td>
                                            <td className="p-3 text-red-600 text-xs">{v.issues.join(', ')}</td>
                                        </tr>
                                    ))}
                                    {violationsData.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-green-600 text-sm">No violations found.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Discretion / Extended Duty Section */}
                    <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900 flex justify-between items-center">
                            <div className="flex gap-2 items-center text-blue-800 dark:text-blue-200">
                                <span className="font-bold uppercase tracking-wide text-xs">Duty Extensions (ORO.FTL.205)</span>
                                <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full text-xs font-bold">{discretionData.length}</span>
                            </div>
                            <p className="text-[10px] text-blue-600 hidden sm:block">Records where FDP was extended via Split Duty or Commander Discretion.</p>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-100 dark:bg-gray-700 text-xs font-semibold">
                                    <tr>
                                        <th className="p-3 w-32">Date</th>
                                        <th className="p-3 w-48">Pilot</th>
                                        <th className="p-3">Extension Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {discretionData.map((d) => (
                                        <tr key={d.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                            <td className="p-3 font-mono text-gray-600 dark:text-gray-400">{d.date}</td>
                                            <td className="p-3 font-bold">{formatStaffName(d.pilotName)}</td>
                                            <td className="p-3 text-blue-700 text-xs">{d.details.join(', ')}</td>
                                        </tr>
                                    ))}
                                    {discretionData.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-gray-500 text-sm">No extended duties found.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FatigueReport;
