
import { FlightLogRecord } from '../../types';
import { calculateDurationHours } from '../../utils/timeUtils';
import { FTLMetrics } from './types';

const sumHoursForPeriod = (
    records: FlightLogRecord[],
    endDate: Date,
    days: number,
    type: 'flight' | 'duty'
): number => {
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

    const relevantRecords = records.filter(r => {
        if (!r || !r.date) return false;
        const recordDate = new Date(r.date + 'T00:00:00Z');
        return recordDate >= startDate && recordDate <= endDate;
    });

    return relevantRecords.reduce((total, record) => {
        let duration = 0;
        if (type === 'flight') {
            if (record.flightHoursByAircraft) {
                duration = Object.values(record.flightHoursByAircraft).reduce((sum, h) => sum + (h || 0), 0);
            } else {
                duration = calculateDurationHours(record.flightOn, record.flightOff);
            }
        } else {
            const dutyDuration = calculateDurationHours(record.dutyStart, record.dutyEnd);
            const standbyDuration = calculateDurationHours(record.standbyOn, record.standbyOff);
            duration = dutyDuration + (standbyDuration * 0.5);
        }
        return total + duration;
    }, 0);
};

export const calculateAllRollingTotals = (
    allRecordsForPilot: FlightLogRecord[],
    targetDateStr: string
): FTLMetrics => {
    if (!targetDateStr) return { flightTime3d: 0, dutyTime3d: 0, flightTime7d: 0, dutyTime7d: 0, flightTime28d: 0, dutyTime28d: 0, flightTime90d: 0, dutyTime90d: 0, flightTime365d: 0, dutyTime365d: 0, fdpTime14d: 0 };

    const targetDate = new Date(targetDateStr + 'T00:00:00Z');
    const sortedRecords = [...allRecordsForPilot].filter(r => !!r.date).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
        flightTime3d: sumHoursForPeriod(sortedRecords, targetDate, 3, 'flight'),
        dutyTime3d: sumHoursForPeriod(sortedRecords, targetDate, 3, 'duty'),
        flightTime7d: sumHoursForPeriod(sortedRecords, targetDate, 7, 'flight'),
        dutyTime7d: sumHoursForPeriod(sortedRecords, targetDate, 7, 'duty'),
        flightTime28d: sumHoursForPeriod(sortedRecords, targetDate, 28, 'flight'),
        dutyTime28d: sumHoursForPeriod(sortedRecords, targetDate, 28, 'duty'),
        flightTime90d: sumHoursForPeriod(sortedRecords, targetDate, 90, 'flight'),
        dutyTime90d: sumHoursForPeriod(sortedRecords, targetDate, 90, 'duty'),
        flightTime365d: sumHoursForPeriod(sortedRecords, targetDate, 365, 'flight'),
        dutyTime365d: sumHoursForPeriod(sortedRecords, targetDate, 365, 'duty'),
        fdpTime14d: sumHoursForPeriod(sortedRecords, targetDate, 14, 'duty'),
    };
};
