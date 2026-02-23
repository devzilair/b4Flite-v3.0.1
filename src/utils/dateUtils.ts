
import { PublicHoliday } from '../types';

// This utility helps in standardizing date formats across the application.
// We are setting a specific timezone to simulate the system being in UTC+4.
const TIMEZONE = 'UTC';

/**
 * Formats a Date object into a "Month Year" string.
 * @param date The date to format.
 * @param machineReadable If true, returns "YYYY-MM" format.
 * @returns A formatted string, e.g., "October 2025" or "2025-10".
 */
export const formatMonthYear = (date: Date, machineReadable: boolean = false): string => {
  if (machineReadable) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
  return date.toLocaleString('default', { 
    month: 'long', 
    year: 'numeric',
    timeZone: TIMEZONE,
  });
};

/**
 * Formats a date string (YYYY-MM-DD) into a locale-specific short date.
 * @param dateStr The date string to format.
 * @returns A formatted string, e.g., "10/25/2025".
 */
export const formatShortDate = (dateStr: string): string => {
    // Add time component and 'Z' to ensure it's parsed as UTC
    const date = new Date(dateStr + 'T00:00:00Z');
    return date.toLocaleDateString('default', {
        timeZone: TIMEZONE,
    });
};

/**
 * Checks if a given date is a public holiday, considering the Sunday carry-over rule.
 * Rule: If a holiday falls on a Sunday, the following Monday is also a holiday.
 */
export const isDatePublicHoliday = (date: Date, publicHolidays: PublicHoliday[]): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    const md = dateStr.substring(5);
    
    // Check if today is a holiday
    const isTodayHoliday = publicHolidays.some(ph => 
        (ph.isRecurring && ph.date.substring(5) === md) ||
        (!ph.isRecurring && ph.date === dateStr)
    );
    
    if (isTodayHoliday) return true;

    // Check Sunday Carry-over Rule: If today is Monday, was yesterday (Sunday) a holiday?
    // Using getUTCDay() for consistency with ISO string generation.
    if (date.getUTCDay() === 1) { // 1 is Monday
        const yesterday = new Date(date);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const yDateStr = yesterday.toISOString().split('T')[0];
        const yMd = yDateStr.substring(5);
        
        const wasYesterdayHoliday = publicHolidays.some(ph => 
            (ph.isRecurring && ph.date.substring(5) === yMd) ||
            (!ph.isRecurring && ph.date === yDateStr)
        );
        
        // Since yesterday is Sunday (as today is Monday), if it was a holiday, today (Monday) is also a holiday.
        if (wasYesterdayHoliday) return true;
    }

    return false;
};

/**
 * Calculates the number of chargeable leave days between two dates.
 * 
 * Logic:
 * 1. Iterates through every day in the range [start, end].
 * 2. Checks if the day is a Public Holiday (always excluded).
 * 3. Checks if the day is a Weekend (Sat/Sun).
 *    - If includeWeekends is FALSE (default for office), weekends are excluded.
 *    - If includeWeekends is TRUE (default for pilots), weekends are CHARGED.
 * 
 * @param startDateStr YYYY-MM-DD
 * @param endDateStr YYYY-MM-DD
 * @param publicHolidays Array of public holidays
 * @param includeWeekends Boolean, if true, weekends count as leave days.
 * @returns Number of days to deduct from balance.
 */
export const calculateChargeableDays = (
    startDateStr: string, 
    endDateStr: string, 
    publicHolidays: PublicHoliday[], 
    includeWeekends: boolean = false
): number => {
    const start = new Date(startDateStr + 'T00:00:00Z');
    const end = new Date(endDateStr + 'T00:00:00Z');
    let days = 0;
    const loop = new Date(start);

    // Safety brake for infinite loops if dates are wild
    let iterations = 0;

    while (loop <= end && iterations < 366) {
        iterations++;
        const dayOfWeek = loop.getUTCDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0=Sun, 6=Sat
        const isPH = isDatePublicHoliday(loop, publicHolidays);
        
        // If it's a public holiday, it's free (not chargeable), regardless of weekend status
        if (!isPH) {
            if (includeWeekends) {
                // If we include weekends, we charge for it unless it was a PH
                days++;
            } else {
                // If we exclude weekends (standard office), we only charge if it's NOT a weekend
                if (!isWeekend) {
                    days++;
                }
            }
        }
        
        loop.setUTCDate(loop.getUTCDate() + 1);
    }
    return days;
};

/**
 * Returns an array of ISO date strings (YYYY-MM-DD) for every day in the range inclusive.
 */
export const getDatesInRange = (startDateStr: string, endDateStr: string): string[] => {
    const dates: string[] = [];
    const start = new Date(startDateStr + 'T00:00:00Z');
    const end = new Date(endDateStr + 'T00:00:00Z');
    
    // Safety check
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
        return [];
    }

    const loop = new Date(start);
    // Limit to 366 days to prevent infinite loops on bad data
    let iterations = 0;
    while (loop <= end && iterations < 366) {
        dates.push(loop.toISOString().split('T')[0]);
        loop.setUTCDate(loop.getUTCDate() + 1);
        iterations++;
    }
    return dates;
};

/**
 * Returns the current date as a local YYYY-MM-DD string.
 * This avoids the "Yesterday" bug when using new Date().toISOString() in UTC-negative timezones.
 */
export const getLocalTodayDateString = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
