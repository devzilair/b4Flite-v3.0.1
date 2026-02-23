/**
 * Parses a time string "HH:mm" into total minutes from midnight.
 * @param timeStr The time string to parse.
 * @returns Total minutes from midnight, or 0 if invalid.
 */
export const parseTimeToMinutes = (timeStr: string | undefined): number => {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours * 60 + minutes;
};

/**
 * Calculates the duration in hours between two "HH:mm" time strings, handling overnight periods.
 * @param start The start time string "HH:mm".
 * @param end The end time string "HH:mm".
 * @returns The duration in hours.
 */
export const calculateDurationHours = (start: string | undefined, end: string | undefined): number => {
    if (!start || !end) return 0;

    let startMinutes = parseTimeToMinutes(start);
    let endMinutes = parseTimeToMinutes(end);

    if (endMinutes < startMinutes) {
        // Handle overnight case
        endMinutes += 24 * 60;
    }

    const durationMinutes = endMinutes - startMinutes;
    return durationMinutes / 60;
};

/**
 * Converts a decimal hour value to "HH:mm" string format.
 * @param decimal The decimal hours (e.g., 1.5).
 * @param allowZero If true, returns "00:00" instead of empty string for 0.
 * @returns formatted string (e.g., "01:30").
 */
export const decimalToTime = (decimal: number | undefined | null, allowZero: boolean = false): string => {
    if (decimal === undefined || decimal === null || (!allowZero && decimal === 0)) return '';
    const totalMinutes = Math.round(decimal * 60);
    const hours = Math.floor(Math.abs(totalMinutes) / 60);
    const minutes = Math.abs(totalMinutes) % 60;
    const sign = totalMinutes < 0 ? '-' : '';
    return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Converts a "HH:mm" string or plain number string to decimal hours.
 * Supports "1:30" -> 1.5 and "1.5" -> 1.5
 * @param timeStr The time string.
 * @returns Decimal hours.
 */
export const timeToDecimal = (timeStr: string): number => {
    if (!timeStr) return 0;
    if (timeStr.includes(':')) {
        const [h, m] = timeStr.split(':').map(Number);
        return (h || 0) + (m || 0) / 60;
    }
    return parseFloat(timeStr) || 0;
};