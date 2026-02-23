
import { FlightLogRecord, MajorType } from '../../types';
import { parseTimeToMinutes, calculateDurationHours } from '../../utils/timeUtils';
import { FdpDetails } from './types';
import { HELI_FDP_LIMITS, AERO_FDP_LIMITS } from './constants';

export const calculateFdpDetails = (
    record: Partial<FlightLogRecord>,
    aircraftCategory: MajorType | undefined,
): FdpDetails => {
    const defaultResult = { maxFdp: 0, fdpExtension: 0, breakDuration: 0, maxFlightTime: 0 };
    const fdpReferenceStart = record.standbyOn || record.fdpStart || record.dutyStart;

    if (!fdpReferenceStart || fdpReferenceStart.length < 4 || !aircraftCategory) return defaultResult;

    const startMinutes = parseTimeToMinutes(fdpReferenceStart);
    if (isNaN(startMinutes)) return defaultResult;

    const dutyStartHour = startMinutes / 60;
    let baseFdp = 0;
    let maxFlightTime = 0;

    if (aircraftCategory === 'Helicopter') {
        const limits = record.isTwoPilotOperation ? HELI_FDP_LIMITS.twoPilot : HELI_FDP_LIMITS.singlePilot;
        const rule = limits.find(r => dutyStartHour >= r.start && dutyStartHour <= r.end);
        baseFdp = rule ? rule.fdp : 0;
        maxFlightTime = rule ? rule.flight : 0;
    } else {
        const sectors = record.sectors || 1;
        if (record.isTwoPilotOperation) {
            const sectorIndex = Math.min(Math.max(sectors, 1) - 1, 7);
            const startHourKey = String(Math.floor(dutyStartHour));
            const limitsRow = AERO_FDP_LIMITS.twoPilot[startHourKey as keyof typeof AERO_FDP_LIMITS.twoPilot] || AERO_FDP_LIMITS.twoPilot.default;
            baseFdp = limitsRow[sectorIndex];
        } else {
            let sectorIndex;
            if (sectors <= 4) sectorIndex = 0;
            else if (sectors === 5) sectorIndex = 1;
            else if (sectors === 6) sectorIndex = 2;
            else if (sectors === 7) sectorIndex = 3;
            else sectorIndex = 4;

            const startHourKey = String(Math.floor(dutyStartHour));
            const limitsRow = AERO_FDP_LIMITS.singlePilot[startHourKey as keyof typeof AERO_FDP_LIMITS.singlePilot] || AERO_FDP_LIMITS.singlePilot.default;
            baseFdp = limitsRow[sectorIndex];
        }
        maxFlightTime = 99;
    }

    let fdpExtension = 0;
    const breakDuration = calculateDurationHours(record.breakStart, record.breakEnd);

    if (record.isSplitDuty && breakDuration > 0) {
        const effectiveRest = Math.max(0, breakDuration - 0.5);

        if (aircraftCategory === 'Helicopter') {
            if (effectiveRest >= 2 && effectiveRest <= 3) {
                fdpExtension = 1;
            } else if (effectiveRest > 3) {
                fdpExtension = effectiveRest / 2;
            }
        } else {
            if (effectiveRest >= 3) {
                fdpExtension = effectiveRest / 2;
            }
        }
    }

    const maxFdp = baseFdp + fdpExtension;

    return { maxFdp, fdpExtension, breakDuration, maxFlightTime };
};
