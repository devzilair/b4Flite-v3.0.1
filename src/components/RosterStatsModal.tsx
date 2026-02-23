
import React, { useMemo } from 'react';
import { Staff, ShiftCodeDefinition, RosterData } from '../types.ts';
import { formatStaffName } from '../utils/sanitization.ts';

interface RosterStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentDate: Date;
    staff: Staff[];
    rosterData: RosterData;
    dutyCodes: ShiftCodeDefinition[];
    departmentName: string;
}

const RosterStatsModal: React.FC<RosterStatsModalProps> = ({ 
    isOpen, 
    onClose, 
    currentDate, 
    staff, 
    rosterData, 
    dutyCodes,
    departmentName
}) => {
    if (!isOpen) return null;

    const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0)).getUTCDate();
    const dates = Array.from({ length: daysInMonth }, (_, i) => {
        const d = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), i + 1));
        return d.toISOString().split('T')[0];
    });

    const dutyCodeMap = useMemo(() => {
        const map = new Map<string, ShiftCodeDefinition>();
        dutyCodes.forEach(dc => map.set(dc.id, dc));
        return map;
    }, [dutyCodes]);

    const stats = useMemo(() => {
        return staff.map(person => {
            let totalHours = 0;
            let daysWorked = 0;
            let daysOff = 0;
            let leaveDays = 0;

            dates.forEach(date => {
                const entry = rosterData[date]?.[person.id];
                if (entry && entry.dutyCodeId) {
                    const code = dutyCodeMap.get(entry.dutyCodeId);
                    if (code) {
                        // Add Duration
                        if (code.duration) {
                            totalHours += code.duration;
                        }

                        // Count Types
                        if (code.isOffDuty) {
                            // Check if it's leave (usually marked via leaveTypeId map or specific code convention)
                            // Ideally we check code.leaveTypeId, but for general stats:
                            if (code.code === 'L' || code.leaveTypeId) {
                                leaveDays++;
                            } else {
                                daysOff++;
                            }
                        } else {
                            daysWorked++;
                        }
                    }
                } else {
                    // Empty cell = usually implied Off or N/A
                    // We won't count it towards hours
                }
            });

            return {
                id: person.id,
                name: person.name,
                totalHours,
                daysWorked,
                daysOff,
                leaveDays
            };
        }).sort((a, b) => b.totalHours - a.totalHours); // Sort by hours descending
    }, [staff, dates, rosterData, dutyCodeMap]);

    const totalDepartmentHours = stats.reduce((sum, s) => sum + s.totalHours, 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Roster Hours Report</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{departmentName} - {monthName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl">&times;</button>
                </div>

                <div className="flex-grow overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 text-center">
                            <h3 className="text-xs uppercase font-bold text-blue-800 dark:text-blue-300">Total Man-Hours</h3>
                            <p className="text-2xl font-bold text-blue-900 dark:text-white">{totalDepartmentHours.toLocaleString()} hrs</p>
                        </div>
                         <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
                            <h3 className="text-xs uppercase font-bold text-gray-600 dark:text-gray-300">Staff Count</h3>
                            <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.length}</p>
                        </div>
                         <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
                            <h3 className="text-xs uppercase font-bold text-gray-600 dark:text-gray-300">Avg Hours / Staff</h3>
                            <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.length > 0 ? (totalDepartmentHours / stats.length).toFixed(1) : 0}</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-700 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">
                                <tr>
                                    <th className="p-3">Staff Name</th>
                                    <th className="p-3 text-right">Worked Days</th>
                                    <th className="p-3 text-right">Off Days</th>
                                    <th className="p-3 text-right">Leave Days</th>
                                    <th className="p-3 text-right bg-gray-200 dark:bg-gray-600 font-bold">Total Hours</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {stats.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="p-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
                                        <td className="p-3 text-right">{s.daysWorked}</td>
                                        <td className="p-3 text-right">{s.daysOff}</td>
                                        <td className="p-3 text-right">{s.leaveDays}</td>
                                        <td className="p-3 text-right font-bold bg-gray-50 dark:bg-gray-800 text-brand-primary">{s.totalHours}</td>
                                    </tr>
                                ))}
                                {stats.length === 0 && (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">No data found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="p-6 border-t dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 transition-colors">
                        Close
                    </button>
                    <button onClick={() => window.print()} className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-secondary transition-colors flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Print Report
                    </button>
                </div>

                <style>{`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        .fixed.inset-0, .fixed.inset-0 * {
                            visibility: visible;
                        }
                        .fixed.inset-0 {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            height: auto;
                            background: white;
                            padding: 0;
                        }
                        /* Hide close/print buttons during print */
                        button {
                            display: none !important;
                        }
                        /* Expand container */
                        .max-w-4xl {
                            max-width: none !important;
                            box-shadow: none !important;
                        }
                        .max-h-\[90vh\] {
                            max-height: none !important;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
};

export default RosterStatsModal;
