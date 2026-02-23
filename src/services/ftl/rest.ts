
import { FlightLogRecord } from '../../types';
import { parseTimeToMinutes, calculateDurationHours } from '../../utils/timeUtils';
import { RestPeriodDetails } from './types';

export const calculateRestPeriod = (
    currentRecord: Partial<FlightLogRecord>,
    previousRecordWithEnd: FlightLogRecord | undefined
): RestPeriodDetails => {
    if (!previousRecordWithEnd || !currentRecord.date || !previousRecordWithEnd.date) {
        return { restPeriod: 0, hasHistory: false };
    }

    const prevEndTimeStr = previousRecordWithEnd.dutyEnd || previousRecordWithEnd.standbyOff;
    const prevStartTimeStr = previousRecordWithEnd.dutyStart || previousRecordWithEnd.standbyOn;

    if (!prevEndTimeStr || !prevStartTimeStr) {
        return { restPeriod: 0, hasHistory: false };
    }

    const prevDutyDuration = calculateDurationHours(prevStartTimeStr, prevEndTimeStr);
    const requiredRest = Math.max(12, prevDutyDuration);

    const prevEndMins = parseTimeToMinutes(prevEndTimeStr);
    const prevStartMins = parseTimeToMinutes(prevStartTimeStr);

    const prevOffDate = new Date(`${previousRecordWithEnd.date}T${prevEndTimeStr}:00Z`);
    if (prevEndMins < prevStartMins) {
        prevOffDate.setUTCDate(prevOffDate.getUTCDate() + 1);
    }

    const effectiveStart = currentRecord.standbyOn || currentRecord.dutyStart || "00:00";
    const currentOnDate = new Date(`${currentRecord.date}T${effectiveStart}:00Z`);

    const restMillis = currentOnDate.getTime() - prevOffDate.getTime();
    const restHours = restMillis / (1000 * 60 * 60);

    if (restHours < 0 || isNaN(restHours)) return { restPeriod: 0, hasHistory: true };

    const isShiftStarting = !!(currentRecord.dutyStart || currentRecord.standbyOn);

    const violation = (isShiftStarting && restHours < requiredRest)
        ? `Rest period of ${restHours.toFixed(1)}h is less than the required ${requiredRest.toFixed(1)}h (Max of 12h or previous duty length).`
        : undefined;

    return {
        restPeriod: restHours,
        restViolation: violation,
        hasHistory: true,
    };
};
