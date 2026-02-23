
import { FlightLogRecord } from '../../types';
import { parseTimeToMinutes } from '../../utils/timeUtils';
import { WOCL_START_MINS, WOCL_END_MINS } from './constants';

export const isDutyDisruptive = (record: Partial<FlightLogRecord>): boolean => {
    if (!record.dutyStart || !record.dutyEnd) return false;

    const dutyOnMins = parseTimeToMinutes(record.dutyStart);
    const dutyOffMins = parseTimeToMinutes(record.dutyEnd);

    if (isNaN(dutyOnMins) || isNaN(dutyOffMins)) return false;

    if (dutyOffMins < dutyOnMins) {
        return dutyOffMins >= WOCL_START_MINS;
    }

    const startsInWOCL = dutyOnMins >= WOCL_START_MINS && dutyOnMins <= WOCL_END_MINS;
    const endsInWOCL = dutyOffMins >= WOCL_START_MINS && dutyOffMins <= WOCL_END_MINS;
    const spansOverWOCL = dutyOnMins < WOCL_START_MINS && dutyOffMins > WOCL_END_MINS;

    return startsInWOCL || endsInWOCL || spansOverWOCL;
};

export const validateDisruptiveDuties = (
    allRecordsForPilot: FlightLogRecord[],
    targetDateStr: string
): string | undefined => {
    if (!targetDateStr) return undefined;

    const sortedRecords = [...allRecordsForPilot].filter(r => !!r.date).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const recordsByDate = new Map<string, FlightLogRecord>();
    sortedRecords.forEach(r => recordsByDate.set(r.date, r));

    const targetRecord = recordsByDate.get(targetDateStr);

    if (!targetRecord || !isDutyDisruptive(targetRecord)) {
        return undefined;
    }

    const disruptiveDuties = sortedRecords.filter(r => isDutyDisruptive(r) && new Date(r.date) <= new Date(targetDateStr));
    let currentDisruptive = disruptiveDuties[disruptiveDuties.length - 1];

    let consecutiveCount = 0;
    if (currentDisruptive && currentDisruptive.date === targetDateStr) {
        consecutiveCount = 1;
        let currentIndex = disruptiveDuties.length - 1;

        while (currentIndex > 0) {
            const previousDisruptive = disruptiveDuties[currentIndex - 1];

            if (!previousDisruptive.dutyEnd || !currentDisruptive.dutyStart) break;

            const prevDutyOffDate = new Date(`${previousDisruptive.date}T${previousDisruptive.dutyEnd}:00Z`);
            const currentDutyOnDate = new Date(`${currentDisruptive.date}T${currentDisruptive.dutyStart}:00Z`);

            const prevDutyOnMins = parseTimeToMinutes(previousDisruptive.dutyStart);
            const prevDutyOffMins = parseTimeToMinutes(previousDisruptive.dutyEnd);
            if (prevDutyOffMins < prevDutyOnMins) {
                prevDutyOffDate.setUTCDate(prevDutyOffDate.getUTCDate() + 1);
            }

            const restMillis = currentDutyOnDate.getTime() - prevDutyOffDate.getTime();
            const restHours = restMillis / (1000 * 60 * 60);

            if (restHours < 34) {
                consecutiveCount++;
            } else {
                break;
            }

            currentDisruptive = previousDisruptive;
            currentIndex--;
        }
    }

    if (consecutiveCount > 3) {
        return `Exceeds 3 consecutive disruptive duties (Day ${consecutiveCount}).`;
    }

    const targetDate = new Date(targetDateStr + 'T00:00:00Z');
    let sevenDayCount = 0;
    for (let i = 0; i < 7; i++) {
        const checkDate = new Date(targetDate);
        checkDate.setUTCDate(checkDate.getUTCDate() - i);
        const checkDateStr = checkDate.toISOString().split('T')[0];
        const recordOnDate = recordsByDate.get(checkDateStr);
        if (recordOnDate && isDutyDisruptive(recordOnDate)) {
            sevenDayCount++;
        }
    }
    if (sevenDayCount > 4) {
        return `Exceeds 4 disruptive duties in 7 days (has ${sevenDayCount}).`;
    }

    return undefined;
};
