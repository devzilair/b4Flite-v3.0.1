
import { FlightLogRecord } from '../../types';
import { calculateDurationHours } from '../../utils/timeUtils';
import { StandbyDetails } from './types';
import { MAX_STANDBY_HOURS } from './constants';

export const calculateStandbyDetails = (
    record: Partial<FlightLogRecord>
): StandbyDetails => {
    const standbyDuration = calculateDurationHours(record.standbyOn, record.standbyOff);
    if (standbyDuration === 0) {
        return { standbyDuration: 0 };
    }

    const violation = standbyDuration > MAX_STANDBY_HOURS
        ? `Standby period of ${standbyDuration.toFixed(1)}h exceeds the maximum ${MAX_STANDBY_HOURS}h.`
        : undefined;

    return {
        standbyDuration,
        standbyViolation: violation,
    };
};
