
import { describe, it, expect } from 'vitest';
import { calculateDurationHours, decimalToTime, timeToDecimal, parseTimeToMinutes } from './timeUtils';

describe('Time Utilities', () => {
    
    describe('calculateDurationHours', () => {
        it('calculates duration within the same day', () => {
            expect(calculateDurationHours('10:00', '14:00')).toBe(4);
            expect(calculateDurationHours('08:30', '10:00')).toBe(1.5);
        });

        it('calculates duration crossing midnight', () => {
            expect(calculateDurationHours('23:00', '01:00')).toBe(2);
            expect(calculateDurationHours('22:00', '06:00')).toBe(8);
        });

        it('returns 0 for invalid inputs', () => {
            expect(calculateDurationHours('', '14:00')).toBe(0);
            expect(calculateDurationHours(undefined, undefined)).toBe(0);
        });
    });

    describe('decimalToTime', () => {
        it('converts decimal hours to HH:mm string', () => {
            expect(decimalToTime(1.5)).toBe('01:30');
            expect(decimalToTime(4.75)).toBe('04:45');
            expect(decimalToTime(0.5)).toBe('00:30');
        });

        it('handles zero correctly based on flags', () => {
            expect(decimalToTime(0)).toBe('');
            expect(decimalToTime(0, true)).toBe('00:00');
        });

        it('handles negative values', () => {
            expect(decimalToTime(-1.5)).toBe('-01:30');
        });
    });

    describe('timeToDecimal', () => {
        it('converts HH:mm to decimal', () => {
            expect(timeToDecimal('01:30')).toBe(1.5);
            expect(timeToDecimal('04:45')).toBe(4.75);
        });

        it('handles plain numbers as strings', () => {
            expect(timeToDecimal('1.5')).toBe(1.5);
        });
    });
    
    describe('parseTimeToMinutes', () => {
        it('converts HH:mm to total minutes', () => {
            expect(parseTimeToMinutes('01:00')).toBe(60);
            expect(parseTimeToMinutes('00:30')).toBe(30);
        });
    });
});
