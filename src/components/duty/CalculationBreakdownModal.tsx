
import React from 'react';
import type { MonthlyDayRecord } from '@/hooks/useDutyCalculations';
import { FTL_LIMITS, calculateDurationHours } from '@/services/ftlCalculations';
import { AircraftType } from '@/types';

interface BreakdownModalProps {
    data: MonthlyDayRecord;
    pilotName: string;
    onClose: () => void;
    aircraftTypes?: AircraftType[];
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0 py-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-50 dark:text-gray-400 mb-3">{title}</h3>
        <div className="space-y-2 text-sm">{children}</div>
    </div>
);

const Row: React.FC<{ label: string; value: string | number; isBold?: boolean }> = ({ label, value, isBold = false }) => (
    <div className="flex justify-between items-center">
        <span className="text-gray-600 dark:text-gray-300">{label}</span>
        <span className={`text-gray-900 dark:text-white ${isBold ? 'font-bold' : ''}`}>{value}</span>
    </div>
);

const collectViolations = (data: MonthlyDayRecord): string[] => {
    const violations: string[] = [];
    if (!data) return violations;

    // Daily FDP
    if (data.actualFdp > 0 && data.maxFdp > 0 && data.actualFdp > data.maxFdp) {
        violations.push(`Exceeded Max FDP of ${data.maxFdp.toFixed(2)}h (Actual: ${data.actualFdp.toFixed(2)}h).`);
    }

    if (data.rest.restViolation) violations.push(data.rest.restViolation);
    if (data.disruptive.disruptiveViolation) violations.push(data.disruptive.disruptiveViolation);
    if (data.daysOffValidation.violation) violations.push(data.daysOffValidation.violation);
    if (data.standby?.standbyViolation) violations.push(data.standby.standbyViolation);

    // Cumulative Totals
    if (data.metrics) {
        if (data.metrics.dutyTime7d > FTL_LIMITS.dutyTime7d) violations.push(`Exceeded ${FTL_LIMITS.dutyTime7d}h duty time in 7 days.`);
        if (data.metrics.dutyTime28d > FTL_LIMITS.dutyTime28d) violations.push(`Exceeded ${FTL_LIMITS.dutyTime28d}h duty time in 28 days.`);
    }

    return violations;
};


const CalculationBreakdownModal: React.FC<BreakdownModalProps> = ({ data, pilotName, onClose, aircraftTypes = [] }) => {
    if (!data) return null;

    const { dutyStart, dutyEnd, fdpStart, fdpEnd, breakStart, breakEnd, isSplitDuty, sectors, actualFdp, breakDuration, fdpExtension, maxFdp, metrics, standby, flightHoursByAircraft } = data;

    // Calculate actual duty duration explicitly from duty start/end
    const actualDuty = calculateDurationHours(dutyStart, dutyEnd);

    const effectiveRest = Math.max(0, breakDuration - 0.5);
    const baseFdp = maxFdp > 0 ? maxFdp - fdpExtension : 0;
    const violations = collectViolations(data);
    const hasFlightHours = flightHoursByAircraft && Object.keys(flightHoursByAircraft).length > 0;

    // Helper to resolve aircraft name from ID
    const getAircraftName = (id: string) => {
        const type = aircraftTypes.find(at => at.id === id);
        return type ? type.name : id;
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-6 sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold">Calculation Breakdown</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{pilotName} on {new Date(data.date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</p>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">&times;</button>
                    </div>
                </div>

                <div className="px-6 pb-6">
                    <Section title="1. User Inputs">
                        <Row label="Duty Period" value={`${dutyStart || '--'} - ${dutyEnd || '--'}`} />
                        <Row label="FDP Period" value={`${fdpStart || '--'} - ${fdpEnd || '--'}`} />
                        {isSplitDuty && <Row label="Break Period" value={`${breakStart || '--'} - ${breakEnd || '--'}`} />}
                        {data.standbyOn && <Row label="Standby Period" value={`${data.standbyOn} - ${data.standbyOff}`} />}
                        {hasFlightHours && (
                            <div className="pt-2 mt-2 border-t dark:border-gray-600">
                                <span className="text-gray-600 dark:text-gray-300">Flight Hours:</span>
                                {Object.entries(flightHoursByAircraft).map(([typeId, hours]) => (
                                    <Row key={typeId} label={`- ${getAircraftName(typeId)}`} value={`${(hours as number).toFixed(2)}h`} />
                                ))}
                            </div>
                        )}
                        <Row label="Sectors" value={sectors ?? 'N/A'} />
                    </Section>

                    <Section title="2. Daily Calculations">
                        <Row label="Total Day Duty" value={actualDuty > 0 ? `${actualDuty.toFixed(2)}` : '--'} />
                        <Row label="Total Flight Time" value={data.flightDuration > 0 ? `${data.flightDuration.toFixed(2)}` : '--'} />
                        {standby?.standbyDuration > 0 && <Row label="Total Standby" value={`${standby.standbyDuration.toFixed(2)}`} />}
                        <Row label="Total FDP" value={actualFdp > 0 ? `${actualFdp.toFixed(2)}` : '--'} />
                    </Section>

                    {isSplitDuty && (
                        <Section title="3. Split Duty Analysis">
                            <Row label="Break Duration" value={`${breakDuration.toFixed(2)} hours`} />
                            <Row label="Post-Break Buffer" value="-0.50 hours" />
                            <Row label="Effective Rest in Break" value={`${effectiveRest.toFixed(2)} hours`} />
                            <Row label="Extension Earned (50% of rest)" value={`${fdpExtension.toFixed(2)} hours`} />
                            <Row label="Base FDP Limit" value={`${baseFdp.toFixed(2)} hours`} />
                            <Row label="New FDP Limit (Base + Extension)" value={`${maxFdp.toFixed(2)} hours`} isBold />
                            {fdpExtension > 0 && (
                                <div className="mt-3 text-center">
                                    <span className="inline-block px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 text-xs font-bold rounded-full border border-green-200 dark:border-green-800">
                                        Valid Split Duty: Extension Criteria Met
                                    </span>
                                </div>
                            )}
                        </Section>
                    )}

                    <Section title="4. Cumulative Totals (as of this date)">
                        {metrics ? (
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                <Row label="7-Day Duty:" value={`${metrics.dutyTime7d.toFixed(2)}`} />
                                <Row label="28-Day Duty:" value={`${metrics.dutyTime28d.toFixed(2)}`} />
                                <Row label="7-Day Flight:" value={`${metrics.flightTime7d.toFixed(2)}`} />
                                <Row label="28-Day Flight:" value={`${metrics.flightTime28d.toFixed(2)}`} />
                                <Row label="14-Day FDP:" value={`${metrics.fdpTime14d.toFixed(2)}`} />
                            </div>
                        ) : <p className="text-gray-500">No data available.</p>}
                    </Section>

                    <Section title="5. Violations Found">
                        {violations.length > 0 ? (
                            <div className="space-y-2">
                                {violations.map((v, i) => (
                                    <div key={i} className="flex items-start p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
                                        <span className="text-red-500 mr-2 flex-shrink-0">⚠️</span>
                                        <p className="text-red-700 dark:text-red-200 text-sm">{v}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center p-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md">
                                <span className="text-green-500 mr-2">✔️</span>
                                <p className="text-green-700 dark:text-green-200 text-sm font-semibold">No violations found for this day.</p>
                            </div>
                        )}
                    </Section>
                </div>
            </div>
        </div>
    );
};

export default CalculationBreakdownModal;
