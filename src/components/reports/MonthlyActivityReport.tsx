
import React, { useMemo, useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { calculateDurationHours, decimalToTime } from '../../utils/timeUtils';
import { useFlightLog } from '../../hooks/useFlightLog';
import { useStaff } from '../../hooks/useStaff';

const MonthlyActivityReport: React.FC = () => {
    const { staff, loading: staffLoading } = useStaff();
    const { flightLogRecords, loading: flightLoading } = useFlightLog();
    const loading = staffLoading || flightLoading;

    const { currentUser, can } = usePermissions();
    
    // Input State
    const [monthInput, setMonthInput] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Report State
    const [isGenerated, setIsGenerated] = useState(false);
    const [activeMonth, setActiveMonth] = useState<string>('');

    const [sortField, setSortField] = useState<'name' | 'duty' | 'flight' | 'fdp'>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const handleGenerate = () => {
        setActiveMonth(monthInput);
        setIsGenerated(true);
    };

    const reportData = useMemo(() => {
        if (!isGenerated || !activeMonth) return [];

        // Check for global access (Admin/Super Admin/Manager)
        const hasManagerAccess = can('roster:view:all') || can('admin:view_settings') || can('staff:view:own_department');

        // 1. Identify Pilots (Active staff with pilot data)
        const pilots = staff.filter(s => {
            // Safety Check for "Active" and "Is Pilot"
            const isActivePilot = s.accountStatus !== 'disabled' && 
                s.pilotData && 
                s.pilotData.aircraftCategory && 
                s.pilotData.aircraftCategory.length > 0;
            
            if (!isActivePilot) return false;

            // Security Scope:
            if (!hasManagerAccess) {
                // RESTRICT TO SELF if not a manager
                return s.id === currentUser?.id;
            } else {
                // If Manager/Admin: Check Department Scope
                // If user is Admin (can view all), they see all.
                // If user is Manager (view own dept), filter by dept.
                const canViewAll = can('roster:view:all') || can('admin:view_settings');
                if (!canViewAll && currentUser && s.departmentId !== currentUser.departmentId) {
                    return false;
                }
            }

            return true;
        });

        // 2. Aggregate Data
        const stats = pilots.map(pilot => {
            let totalDuty = 0;
            let totalFdp = 0;
            let totalFlight = 0;
            let daysWorked = 0;

            const myLogs = flightLogRecords.filter(r => 
                r.staffId === pilot.id && 
                r.date.startsWith(activeMonth)
            );

            myLogs.forEach(log => {
                const duty = calculateDurationHours(log.dutyStart, log.dutyEnd);
                const fdp = calculateDurationHours(log.fdpStart, log.fdpEnd);
                let flight = 0;

                // Robust flight time calculation
                if (log.flightHoursByAircraft && Object.keys(log.flightHoursByAircraft).length > 0) {
                    flight = (Object.values(log.flightHoursByAircraft) as number[]).reduce((sum, h) => sum + (Number(h) || 0), 0);
                } else if (log.flightOn && log.flightOff) {
                    flight = calculateDurationHours(log.flightOn, log.flightOff);
                }

                if (duty > 0 || fdp > 0 || flight > 0 || log.standbyOn) {
                    daysWorked++;
                }

                totalDuty += duty;
                totalFdp += fdp;
                totalFlight += flight;
            });

            return {
                id: pilot.id,
                name: pilot.name,
                daysWorked,
                totalDuty,
                totalFdp,
                totalFlight
            };
        });

        // 3. Sort
        return stats.sort((a, b) => {
            let valA: any = a[sortField === 'name' ? 'name' : sortField === 'duty' ? 'totalDuty' : sortField === 'flight' ? 'totalFlight' : 'totalFdp'];
            let valB: any = b[sortField === 'name' ? 'name' : sortField === 'duty' ? 'totalDuty' : sortField === 'flight' ? 'totalFlight' : 'totalFdp'];

            if (sortDir === 'asc') return valA > valB ? 1 : -1;
            return valA < valB ? 1 : -1;
        });

    }, [staff, flightLogRecords, activeMonth, isGenerated, sortField, sortDir, can, currentUser]);

    const metrics = useMemo(() => {
        return reportData.reduce((acc, curr) => ({
            totalDuty: acc.totalDuty + curr.totalDuty,
            totalFlight: acc.totalFlight + curr.totalFlight,
            totalDays: acc.totalDays + curr.daysWorked,
            count: acc.count + 1
        }), { totalDuty: 0, totalFlight: 0, totalDays: 0, count: 0 });
    }, [reportData]);

    const handleSort = (field: 'name' | 'duty' | 'flight' | 'fdp') => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc'); // Default to high-to-low for numbers usually
        }
    };
    
    const sanitizeForCsv = (field: string | number): string => {
        const str = String(field);
        if (/^[=+\-@]/.test(str)) {
            return "'" + str;
        }
        return str.replace(/"/g, '""'); 
    };

    const handleExportCSV = () => {
        const headers = ['Name', 'Days Worked', 'Total Duty', 'Total FDP', 'Total Flight'];
        const rows = reportData.map(r => [
            `"${sanitizeForCsv(r.name)}"`, 
            r.daysWorked,
            r.totalDuty.toFixed(2),
            r.totalFdp.toFixed(2),
            r.totalFlight.toFixed(2)
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `monthly_activity_${activeMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div>Loading...</div>;

    const monthDisplay = activeMonth ? new Date(activeMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' }) : '';

    return (
        <div className="flex flex-col h-full space-y-6">
            
            {/* Criteria Panel */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 print:hidden">
                 <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Report Configuration
                    </h2>
                    {isGenerated && (
                         <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded-full border border-green-200">
                             Report Generated
                         </span>
                    )}
                </div>

                <div className="flex flex-wrap items-end gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Month</label>
                        <input 
                            type="month"
                            value={monthInput}
                            onChange={(e) => setMonthInput(e.target.value)}
                            className="p-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary min-w-[200px]"
                        />
                    </div>
                    
                    <div className="w-full md:w-auto ml-auto">
                        <button 
                            onClick={handleGenerate}
                            className="w-full bg-brand-primary text-white px-8 py-2.5 rounded-md hover:bg-brand-secondary flex items-center justify-center gap-2 font-bold shadow-lg text-sm transition-all transform active:scale-95"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Generate Report
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Area */}
            {isGenerated ? (
                <div className="space-y-6 animate-fade-in">
                    
                    {/* Executive Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-blue-500">
                            <p className="text-xs font-bold text-gray-500 uppercase">Active Crew</p>
                            <p className="text-2xl font-black text-gray-800 dark:text-white">{metrics.count}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-brand-primary">
                            <p className="text-xs font-bold text-gray-500 uppercase">Total Flight Hrs</p>
                            <p className="text-2xl font-black text-brand-primary">{decimalToTime(metrics.totalFlight)}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-purple-500">
                            <p className="text-xs font-bold text-gray-500 uppercase">Total Duty Hrs</p>
                            <p className="text-2xl font-black text-purple-600">{decimalToTime(metrics.totalDuty)}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-gray-400">
                            <p className="text-xs font-bold text-gray-500 uppercase">Man Days</p>
                            <p className="text-2xl font-black text-gray-600 dark:text-gray-300">{metrics.totalDays}</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-grow flex flex-col min-h-[500px]">
                        <div className="p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center print:hidden">
                             <div className="flex gap-2 items-center">
                                <span className="text-xs text-gray-500 font-bold uppercase">Report Period:</span>
                                <span className="text-sm font-bold text-gray-800 dark:text-white">{monthDisplay}</span>
                             </div>
                             <div className="flex gap-2">
                                <button 
                                    onClick={handleExportCSV}
                                    className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded border border-green-200 font-bold flex items-center gap-2 transition-colors"
                                >
                                    Export CSV
                                </button>
                                <button 
                                    onClick={() => window.print()} 
                                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded border border-gray-300 font-bold flex items-center gap-2 transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" /></svg>
                                    Print View
                                </button>
                             </div>
                        </div>

                        {/* Print Header */}
                        <div className="hidden print:flex justify-between items-end p-8 border-b-2 border-black">
                            <div>
                                <h2 className="text-xl font-bold text-black uppercase tracking-wider">Pilot Activity Report</h2>
                                <p className="text-sm text-gray-600 font-bold uppercase">{monthDisplay}</p>
                            </div>
                            <div className="text-right text-[10px]">
                                Generated: {new Date().toLocaleDateString()}
                            </div>
                        </div>

                        <div className="overflow-auto flex-grow relative p-0 print:p-8">
                             <table className="w-full border-collapse border border-gray-200 dark:border-gray-700 print:border-black text-sm">
                                <thead className="bg-gray-100 dark:bg-gray-700 print:bg-gray-100">
                                    <tr>
                                        <th 
                                            className="border-b border-gray-300 dark:border-gray-600 print:border-black p-3 text-left uppercase text-xs font-bold cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                            onClick={() => handleSort('name')}
                                        >
                                            Pilot Name {sortField === 'name' && (sortDir === 'asc' ? '↓' : '↑')}
                                        </th>
                                        <th className="border-b border-gray-300 dark:border-gray-600 print:border-black p-3 text-center uppercase text-xs font-bold w-32">Days On Duty</th>
                                        <th 
                                            className="border-b border-gray-300 dark:border-gray-600 print:border-black p-3 text-center uppercase text-xs font-bold w-32 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                                            onClick={() => handleSort('duty')}
                                        >
                                            Duty Hours {sortField === 'duty' && (sortDir === 'desc' ? '↓' : '↑')}
                                        </th>
                                        <th 
                                            className="border-b border-gray-300 dark:border-gray-600 print:border-black p-3 text-center uppercase text-xs font-bold w-32 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                                            onClick={() => handleSort('fdp')}
                                        >
                                            FDP Hours {sortField === 'fdp' && (sortDir === 'desc' ? '↓' : '↑')}
                                        </th>
                                        <th 
                                            className="border-b border-gray-300 dark:border-gray-600 print:border-black p-3 text-center uppercase text-xs font-bold w-32 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                                            onClick={() => handleSort('flight')}
                                        >
                                            Flight Hours {sortField === 'flight' && (sortDir === 'desc' ? '↓' : '↑')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {reportData.map(row => (
                                        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 print:break-inside-avoid">
                                            <td className="p-3 border-r border-gray-200 dark:border-gray-700 print:border-black font-bold text-gray-900 dark:text-white">{row.name}</td>
                                            <td className="p-3 border-r border-gray-200 dark:border-gray-700 print:border-black text-center">{row.daysWorked}</td>
                                            <td className="p-3 border-r border-gray-200 dark:border-gray-700 print:border-black text-center font-mono">{decimalToTime(row.totalDuty)}</td>
                                            <td className="p-3 border-r border-gray-200 dark:border-gray-700 print:border-black text-center font-mono">{decimalToTime(row.totalFdp)}</td>
                                            <td className="p-3 border-gray-200 dark:border-gray-700 print:border-black text-center font-mono font-bold bg-gray-50 dark:bg-gray-800 print:bg-gray-50">{decimalToTime(row.totalFlight)}</td>
                                        </tr>
                                    ))}
                                    {reportData.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center italic text-gray-500">
                                                No records found for this period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-100 dark:bg-gray-700 print:bg-gray-100 font-bold border-t-2 border-gray-300 dark:border-gray-600 print:border-black">
                                    <tr>
                                        <td className="p-3 text-right border-r border-gray-300 dark:border-gray-600 print:border-black uppercase text-xs">Totals:</td>
                                        <td className="p-3 text-center border-r border-gray-300 dark:border-gray-600 print:border-black">
                                            {metrics.totalDays}
                                        </td>
                                        <td className="p-3 text-center font-mono border-r border-gray-300 dark:border-gray-600 print:border-black">
                                            {decimalToTime(metrics.totalDuty)}
                                        </td>
                                        <td className="p-3 text-center font-mono border-r border-gray-300 dark:border-gray-600 print:border-black">
                                            -
                                        </td>
                                        <td className="p-3 text-center font-mono">
                                            {decimalToTime(metrics.totalFlight)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>

                            <div className="mt-8 text-xs text-gray-500 print:block hidden">
                                <p>Duty = Total Duty Period (Report to Off Duty)</p>
                                <p>FDP = Flight Duty Period</p>
                                <p>Flight = Block Time (Off Blocks to On Blocks)</p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                 // Empty State / Prompt
                <div className="flex-grow flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 min-h-[400px]">
                     <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                     </div>
                     <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">Report Not Generated</h3>
                     <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                        Please select a month above and click <span className="font-bold text-brand-primary">Generate Report</span> to analyze activity data.
                     </p>
                </div>
            )}
             <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 15mm;
                    }
                    body {
                        background: white;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    /* Reset visibility for Portal content */
                    .bg-white.shadow-xl {
                         box-shadow: none !important;
                         border: none !important;
                    }
                    /* Hide everything else */
                    nav, header, aside, .print\\:hidden {
                        display: none !important;
                    }
                }
             `}</style>
        </div>
    );
};

export default MonthlyActivityReport;
