'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { decimalToTime } from '@/services/ftlCalculations';

export default function DutyPrintPage() {
    const router = useRouter();
    const [printData, setPrintData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('duty_print_data');
        if (stored) {
            try {
                setPrintData(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse print data", e);
            }
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (printData && !loading) {
            // Add a small delay for render to complete, then prompt print
            const timer = setTimeout(() => {
                window.print();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [printData, loading]);

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading print data...</div>;
    }

    if (!printData) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-red-600">Error: No Print Data Found</h1>
                <p className="mt-2 text-gray-600">Please return to the Duty Log page and click Print again.</p>
                <button
                    onClick={() => router.push('/duty')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Return to Duty Log
                </button>
            </div>
        );
    }

    const { monthlyData, pilot, date, monthlyTotals } = printData;
    const reportMonth = new Date(date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    return (
        <div className="bg-white min-h-screen p-[10mm] text-black font-sans print:p-0">
            <div className="print:hidden mb-6 flex justify-between items-center bg-gray-100 p-4 rounded-lg shadow">
                <p className="text-gray-600">Print Preview Mode</p>
                <div className="flex gap-4">
                    <button onClick={() => router.back()} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Back</button>
                    <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold">Print Document</button>
                </div>
            </div>

            <div className="max-w-[100%] mx-auto">
                <div className="text-center mb-6 border-b-2 border-black pb-4">
                    <h1 className="text-2xl font-bold uppercase mb-2">Flight and Duty Log</h1>
                    <div className="flex justify-between items-end">
                        <div className="text-left text-sm">
                            <p className="font-bold text-lg">{pilot?.name || 'Unknown Pilot'}</p>
                            <p>Department: {pilot?.departmentId || 'N/A'}</p>
                        </div>
                        <div className="text-right text-sm">
                            <p className="font-bold text-lg">{reportMonth}</p>
                            <p>Printed: {new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>

                <div className="mb-4 flex gap-8 justify-center text-sm font-bold bg-gray-100 p-2 border border-gray-300 print:bg-transparent print:border-black">
                    <p>Total Duty This Month: {decimalToTime(monthlyTotals?.duty || 0, true)}</p>
                    <p>Total Flight This Month: {decimalToTime(monthlyTotals?.flight || 0, true)}</p>
                </div>

                <table className="w-full text-left text-[10px] sm:text-xs border-collapse border border-black mb-8">
                    <thead className="bg-gray-200 print:bg-gray-200">
                        <tr>
                            <th className="border border-black p-1 text-center" rowSpan={2}>Date</th>
                            <th className="border border-black p-1 text-center" rowSpan={2}>Status</th>
                            <th className="border border-black p-1 text-center" colSpan={6}>Duty & FDP Period</th>
                            <th className="border border-black p-1 text-center" colSpan={2}>Flight</th>
                            <th className="border border-black p-1 text-center" rowSpan={2}>2 Pilot</th>
                            <th className="border border-black p-1 text-center" colSpan={2}>Standby</th>
                            <th className="border border-black p-1 text-center" colSpan={4}>Calculations</th>
                            <th className="border border-black p-1 text-center" colSpan={2}>Duty Acc</th>
                            <th className="border border-black p-1 text-center" colSpan={5}>Flight Acc</th>
                            <th className="border border-black p-1 text-center" rowSpan={2}>Remarks</th>
                        </tr>
                        <tr>
                            <th className="border border-black p-1 text-center border-l-2">Rest</th>
                            <th className="border border-black p-1 text-center">D. Start</th>
                            <th className="border border-black p-1 text-center">D. End</th>
                            <th className="border border-black p-1 text-center">FDP Start</th>
                            <th className="border border-black p-1 text-center">FDP End</th>
                            <th className="border border-black p-1 text-center border-r-2">Brk Start/End</th>

                            <th className="border border-black p-1 text-center">Hours</th>
                            <th className="border border-black p-1 text-center border-r-2">Scts</th>

                            <th className="border border-black p-1 text-center border-l-2">On</th>
                            <th className="border border-black p-1 text-center border-r-2">Off</th>

                            <th className="border border-black p-1 text-center">Act FDP</th>
                            <th className="border border-black p-1 text-center">Break</th>
                            <th className="border border-black p-1 text-center">Ext</th>
                            <th className="border border-black p-1 text-center border-r-2">Max FDP</th>

                            <th className="border border-black p-1 text-center">7d</th>
                            <th className="border border-black p-1 text-center border-r-2">28d</th>

                            <th className="border border-black p-1 text-center">3d</th>
                            <th className="border border-black p-1 text-center">7d</th>
                            <th className="border border-black p-1 text-center">28d</th>
                            <th className="border border-black p-1 text-center">90d</th>
                            <th className="border border-black p-1 text-center">365d</th>
                        </tr>
                    </thead>
                    <tbody>
                        {monthlyData && monthlyData.map((day: any) => {
                            const dParts = day.date.split('-');
                            const dayNum = dParts[2] || '';
                            const isWeekend = (() => {
                                const d = new Date(day.date);
                                return d.getDay() === 0 || d.getDay() === 6;
                            })();

                            let rowClass = "border-b border-black text-center";
                            if (day.isDayOff || day.remarks === 'DAY OFF') rowClass += " bg-gray-100 print:bg-gray-100";
                            else if (isWeekend) rowClass += " bg-gray-50 print:bg-gray-50";

                            // formatters
                            const fmtTime = (val: any) => val ? val : '-';
                            const fmtHr = (val: number) => val > 0 ? decimalToTime(val) : '-';
                            const fmtDec = (val: number | undefined) => (val !== undefined && val > 0) ? val.toFixed(1) : '-';

                            const hasViolation = day.daysOffValidation?.violation || day.rest?.restViolation || day.disruptive?.disruptiveViolation || day.standby?.standbyViolation || (day.actualFdp > 0 && day.maxFdp > 0 && day.actualFdp > day.maxFdp);

                            return (
                                <tr key={day.date} className={rowClass}>
                                    <td className={`border border-black p-0.5 font-bold ${hasViolation ? 'bg-red-100 print:bg-red-50' : ''}`}>{dayNum}</td>
                                    <td className="border border-black p-0.5 font-bold">{day.isDayOff ? 'OFF' : 'DUTY'}</td>

                                    <td className="border border-black p-0.5 border-l-2">{day.rest?.hasHistory ? decimalToTime(day.rest.restPeriod, true) : 'N/A'}</td>
                                    <td className="border border-black p-0.5">{fmtTime(day.dutyStart)}</td>
                                    <td className="border border-black p-0.5">{fmtTime(day.dutyEnd)}</td>
                                    <td className="border border-black p-0.5">{fmtTime(day.fdpStart)}</td>
                                    <td className="border border-black p-0.5">{fmtTime(day.fdpEnd)}</td>
                                    <td className="border border-black p-0.5 border-r-2">{day.isSplitDuty ? `${fmtTime(day.breakStart)} / ${fmtTime(day.breakEnd)}` : '-'}</td>

                                    <td className="border border-black p-0.5">{fmtHr(day.flightDuration)}</td>
                                    <td className="border border-black p-0.5 border-r-2">{day.sectors || '-'}</td>

                                    <td className="border border-black p-0.5 font-bold">{day.isTwoPilotOperation ? 'Y' : '-'}</td>

                                    <td className="border border-black p-0.5 border-l-2">{fmtTime(day.standbyOn)}</td>
                                    <td className="border border-black p-0.5 border-r-2">{fmtTime(day.standbyOff)}</td>

                                    <td className="border border-black p-0.5">{fmtHr(day.actualFdp)}</td>
                                    <td className="border border-black p-0.5">{fmtHr(day.breakDuration)}</td>
                                    <td className="border border-black p-0.5">{day.fdpExtension > 0 ? `+${fmtHr(day.fdpExtension)}` : '-'}</td>
                                    <td className="border border-black p-0.5 font-bold border-r-2">{fmtHr(day.maxFdp)}</td>

                                    <td className="border border-black p-0.5">{fmtDec(day.metrics?.dutyTime7d)}</td>
                                    <td className="border border-black p-0.5 border-r-2">{fmtDec(day.metrics?.dutyTime28d)}</td>

                                    <td className="border border-black p-0.5">{fmtDec(day.metrics?.flightTime3d)}</td>
                                    <td className="border border-black p-0.5">{fmtDec(day.metrics?.flightTime7d)}</td>
                                    <td className="border border-black p-0.5">{fmtDec(day.metrics?.flightTime28d)}</td>
                                    <td className="border border-black p-0.5">{fmtDec(day.metrics?.flightTime90d)}</td>
                                    <td className="border border-black p-0.5">{fmtDec(day.metrics?.flightTime365d)}</td>

                                    <td className="border border-black p-0.5 text-left text-[9px] max-w-[100px] truncate">{day.remarks}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <div className="flex justify-between items-end mt-12 text-sm max-w-4xl mx-auto">
                    <div className="w-64 text-center">
                        <div className="border-b-2 border-black mb-2 h-8"></div>
                        <p className="font-bold">Pilot Signature</p>
                    </div>
                    <div className="w-64 text-center">
                        <div className="border-b-2 border-black mb-2 h-8"></div>
                        <p className="font-bold">Manager Signature</p>
                    </div>
                </div>

            </div>

            <style>{`
                @media print {
                    @page { margin: 5mm; size: landscape; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>
        </div>
    );
}
