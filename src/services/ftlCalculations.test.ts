
import { describe, it, expect } from 'vitest';
import { 
    calculateRestPeriod, 
    calculateFdpDetails, 
    isDutyDisruptive 
} from './ftlCalculations';
import { FlightLogRecord } from '../types';

// Mock Data Helper
const createRecord = (overrides: Partial<FlightLogRecord>): FlightLogRecord => ({
    id: 'test',
    staffId: 'staff_1',
    date: '2025-01-01',
    dutyStart: '',
    dutyEnd: '',
    ...overrides
} as FlightLogRecord);

describe('FTL Calculations', () => {

    describe('Rest Period Calculation', () => {
        it('calculates rest correctly between two duties', () => {
            const prevRecord = createRecord({ 
                date: '2025-01-01', 
                dutyStart: '08:00', 
                dutyEnd: '18:00' // 10 hours duty
            });
            const currentRecord = createRecord({ 
                date: '2025-01-02', 
                dutyStart: '08:00' // 14 hours later
            });

            const result = calculateRestPeriod(currentRecord, prevRecord);
            
            expect(result.restPeriod).toBe(14);
            expect(result.restViolation).toBeUndefined();
        });

        it('detects rest violation when less than 12 hours', () => {
            const prevRecord = createRecord({ 
                date: '2025-01-01', 
                dutyStart: '08:00', 
                dutyEnd: '20:00' // Ends at 8 PM
            });
            const currentRecord = createRecord({ 
                date: '2025-01-02', 
                dutyStart: '06:00' // Starts at 6 AM (10 hours rest)
            });

            const result = calculateRestPeriod(currentRecord, prevRecord);
            
            expect(result.restPeriod).toBe(10);
            expect(result.restViolation).toBeDefined();
            expect(result.restViolation).toContain('less than the required 12.0h');
        });

        it('increases required rest if previous duty was long (>12h)', () => {
            // If pilot worked 14 hours, they need 14 hours rest
            const prevRecord = createRecord({ 
                date: '2025-01-01', 
                dutyStart: '06:00', 
                dutyEnd: '20:00' // 14 hours duty
            });
            const currentRecord = createRecord({ 
                date: '2025-01-02', 
                dutyStart: '09:00' // 13 hours rest (20:00 -> 09:00)
            });

            const result = calculateRestPeriod(currentRecord, prevRecord);
            
            // Should fail because 13h rest < 14h duty
            expect(result.restPeriod).toBe(13);
            expect(result.restViolation).toBeDefined(); 
        });
    });

    describe('FDP Limits (Helicopter)', () => {
        it('calculates standard FDP limits for early morning start', () => {
            const record = createRecord({ dutyStart: '06:30', isTwoPilotOperation: false });
            const result = calculateFdpDetails(record, 'Helicopter');
            
            // Table C Single Pilot: 06:00-06:59 -> 9 hours FDP
            expect(result.maxFdp).toBe(9);
            expect(result.maxFlightTime).toBe(6);
        });

        it('calculates standard FDP limits for optimal start time', () => {
            const record = createRecord({ dutyStart: '08:00', isTwoPilotOperation: false });
            const result = calculateFdpDetails(record, 'Helicopter');
            
            // Table C Single Pilot: 08:00-13:59 -> 10 hours FDP
            expect(result.maxFdp).toBe(10);
        });

        it('gives more hours for Two Pilot operations', () => {
            const record = createRecord({ dutyStart: '08:00', isTwoPilotOperation: true });
            const result = calculateFdpDetails(record, 'Helicopter');
            
            // Table C Two Pilot: 08:00-13:59 -> 12 hours FDP
            expect(result.maxFdp).toBe(12);
        });
    });

    describe('Disruptive Duties (WOCL)', () => {
        // WOCL is 01:00 to 06:59
        
        it('identifies duty starting in WOCL as disruptive', () => {
            const record = createRecord({ dutyStart: '05:00', dutyEnd: '14:00' });
            expect(isDutyDisruptive(record)).toBe(true);
        });

        it('identifies duty ending in WOCL as disruptive', () => {
            const record = createRecord({ dutyStart: '18:00', dutyEnd: '02:00' });
            expect(isDutyDisruptive(record)).toBe(true);
        });

        it('identifies normal day duty as NOT disruptive', () => {
            const record = createRecord({ dutyStart: '08:00', dutyEnd: '17:00' });
            expect(isDutyDisruptive(record)).toBe(false);
        });
    });
});
