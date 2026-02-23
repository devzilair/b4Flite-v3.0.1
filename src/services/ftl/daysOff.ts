
import { FlightLogRecord, MajorType } from '../../types';
import { DaysOffValidationDetails } from './types';

export const isAnOffDay = (record: Partial<FlightLogRecord> | undefined): boolean => {
    if (!record) return true;
    if (record.remarks === 'DAY OFF') return true;
    if (!record.dutyStart && !record.standbyOn) return true;
    return false;
};

export const validateDaysOffRules = (
    allRecordsForPilot: FlightLogRecord[],
    targetDateStr: string,
    aircraftCategory: MajorType | undefined
): DaysOffValidationDetails => {
    if (!targetDateStr) return {};

    const recordsByDate = new Map<string, FlightLogRecord>();
    allRecordsForPilot.forEach(r => {
        if (r.date) recordsByDate.set(r.date, r)
    });
    const targetDate = new Date(targetDateStr + 'T00:00:00Z');

    const getRecord = (dateStr: string) => recordsByDate.get(dateStr);

    if (!isAnOffDay(getRecord(targetDateStr))) {
        let consecutiveDuty = 0;
        for (let i = 0; i < 8; i++) {
            const checkDate = new Date(targetDate);
            checkDate.setUTCDate(checkDate.getUTCDate() - i);
            const checkDateStr = checkDate.toISOString().split('T')[0];
            if (!isAnOffDay(getRecord(checkDateStr))) {
                consecutiveDuty++;
            } else {
                break;
            }
        }
        if (consecutiveDuty > 7) {
            return { violation: `Exceeds 7 consecutive duty days (Day ${consecutiveDuty}).` };
        }
    }

    if (isAnOffDay(getRecord(targetDateStr))) {
        let consecutiveDutyBefore = 0;
        for (let i = 1; i <= 7; i++) {
            const checkDate = new Date(targetDate);
            checkDate.setUTCDate(checkDate.getUTCDate() - i);
            const checkDateStr = checkDate.toISOString().split('T')[0];
            if (!isAnOffDay(getRecord(checkDateStr))) {
                consecutiveDutyBefore++;
            } else {
                break;
            }
        }
        if (consecutiveDutyBefore === 7) {
            const tomorrowDate = new Date(targetDate);
            tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
            const tomorrowDateStr = tomorrowDate.toISOString().split('T')[0];
            if (!isAnOffDay(getRecord(tomorrowDateStr))) {
                return { violation: `Requires 2 consecutive days off after 7 duty days.` };
            }
        }
    }

    let daysOffIn28 = 0;
    for (let i = 0; i < 28; i++) {
        const checkDate = new Date(targetDate);
        checkDate.setUTCDate(checkDate.getUTCDate() - i);
        const checkDateStr = checkDate.toISOString().split('T')[0];
        if (isAnOffDay(getRecord(checkDateStr))) {
            daysOffIn28++;
        }
    }
    if (daysOffIn28 < 7) {
        return { violation: `Fewer than 7 days off in last 28 days (has ${daysOffIn28}).` };
    }

    let hasTwoDayBlockInLast14 = false;
    for (let i = 0; i < 14; i++) {
        const d = new Date(targetDate);
        d.setUTCDate(d.getUTCDate() - i);
        const dStr = d.toISOString().split('T')[0];

        const dPrev = new Date(d);
        dPrev.setUTCDate(dPrev.getUTCDate() - 1);
        const dPrevStr = dPrev.toISOString().split('T')[0];

        if (isAnOffDay(getRecord(dStr)) && isAnOffDay(getRecord(dPrevStr))) {
            hasTwoDayBlockInLast14 = true;
            break;
        }
    }

    if (aircraftCategory === 'Helicopter') {
        let daysOffIn14 = 0;
        for (let i = 0; i < 14; i++) {
            const checkDate = new Date(targetDate);
            checkDate.setUTCDate(checkDate.getUTCDate() - i);
            const checkDateStr = checkDate.toISOString().split('T')[0];
            if (isAnOffDay(getRecord(checkDateStr))) {
                daysOffIn14++;
            }
        }
        if (daysOffIn14 < 3) {
            return { violation: `Fewer than 3 days off in last 14 days (has ${daysOffIn14}).` };
        }
        if (!hasTwoDayBlockInLast14) {
            return { violation: `No 2-day consecutive off block in last 14 days.` };
        }
    } else if (aircraftCategory === 'Fixed Wing') {
        if (!hasTwoDayBlockInLast14) {
            return { violation: `No 2-day consecutive off block in last 14 days.` };
        }
    }

    return {};
};
