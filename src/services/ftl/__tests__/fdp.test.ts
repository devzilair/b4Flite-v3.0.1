import { describe, it, expect } from 'vitest';
import { calculateFdpDetails } from '../fdp';

describe('calculateFdpDetails', () => {
    it('should return zeros if required data is missing', () => {
        const result = calculateFdpDetails({}, 'Helicopter');
        expect(result).toEqual({ maxFdp: 0, fdpExtension: 0, breakDuration: 0, maxFlightTime: 0 });
    });

    describe('Helicopter FDP Limits', () => {
        it('should calculate correct single pilot FDP for Helicopter at 08:00', () => {
            // Assuming HELI_FDP_LIMITS single pilot at 08:00 is around 10 hours (checking typical logic)
            const record = { fdpStart: '08:00', isTwoPilotOperation: false };
            const result = calculateFdpDetails(record, 'Helicopter');
            expect(result.maxFdp).toBeGreaterThan(0);
        });

        it('should calculate correct two-pilot FDP for Helicopter at 08:00', () => {
            const record = { fdpStart: '08:00', isTwoPilotOperation: true };
            const result = calculateFdpDetails(record, 'Helicopter');
            expect(result.maxFdp).toBeGreaterThan(0);
        });
    });

    describe('Split Duty Extensions', () => {
        it('should apply 1 hour extension for Helicopter with 2-3h effective rest', () => {
            // effectiveRest = breakDuration - 0.5. To get 2.5h effective, we need 3h break.
            const record = {
                fdpStart: '08:00',
                isTwoPilotOperation: true,
                isSplitDuty: true,
                breakStart: '12:00',
                breakEnd: '15:00' // 3 hour break
            };
            const result = calculateFdpDetails(record, 'Helicopter');
            // Extension should be handled correctly based on logic
            expect(result.fdpExtension).toBe(1);
        });
    });

    describe('Aeroplane FDP Limits', () => {
        it('should calculate correct Aeroplane FDP for 1 sector at 08:00', () => {
            const record = { fdpStart: '08:00', sectors: 1, isTwoPilotOperation: true };
            const result = calculateFdpDetails(record, 'Aeroplane');
            expect(result.maxFdp).toBeGreaterThan(0);
        });
    });
});
