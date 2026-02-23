
/**
 * Sanitizes a string by trimming whitespace.
 * A more robust implementation would also escape HTML to prevent XSS.
 * @param input The string to sanitize.
 * @returns The sanitized string, or an empty string if the input is falsy.
 */
export const sanitizeString = (input: unknown): string => {
    if (typeof input !== 'string' || !input) {
        return '';
    }
    return input.trim();
};

/**
 * Sanitizes an email by trimming whitespace and converting to lowercase.
 * @param email The email string to sanitize.
 * @returns The sanitized email string.
 */
export const sanitizeEmail = (email: unknown): string => {
    const sanitized = sanitizeString(email);
    return sanitized.toLowerCase();
};

/**
 * Validates if a string is a safe HTTP/HTTPS URL.
 * Prevents javascript: protocols and malformed URLs.
 * @param url The URL string to check.
 * @returns True if valid and safe, false otherwise.
 */
export const isValidUrl = (url: string | undefined | null): boolean => {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch (e) {
        return false;
    }
};

/**
 * Formats a staff name to "First Name + First Letter of Last Name".
 * @param name The full name of the staff member.
 * @returns The formatted name (e.g., "John D").
 */
export const formatStaffName = (name: string): string => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return name;
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    return `${firstName} ${lastName.charAt(0)}`;
};

/**
 * Safely extracts a human-readable message from an unknown error object.
 * Prevents [object Object] from appearing in alerts and UI elements.
 * @param error The error object or string.
 * @returns The error message string.
 */
export const getErrorMessage = (error: unknown): string => {
    if (!error) return 'An unknown error occurred';
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    
    if (typeof error === 'object' && error !== null) {
        const e = error as any;
        
        // 1. Check for 'message' property (Standard JS/Supabase)
        if (typeof e.message === 'string') return e.message;
        
        // 2. Check for Supabase Auth 'error_description'
        if (typeof e.error_description === 'string') return e.error_description;
        
        // 3. Check for 'error' property which might be a string (Supabase Edge Functions)
        if (typeof e.error === 'string') return e.error;
        
        // 4. Check for PostgREST nested error object: { error: { message: "..." } }
        if (e.error && typeof e.error.message === 'string') return e.error.message;
        
        // 5. Check for 'msg' or 'hint' common in Postgres
        if (typeof e.hint === 'string') return e.hint;
        
        // 6. Last resort: Stringify the object to see its content instead of [object Object]
        try {
            const stringified = JSON.stringify(error);
            // If it's just an empty object {}, return a fallback
            return stringified === '{}' ? 'Unknown error object' : stringified;
        } catch {
            return '[Unserializable Error Object]';
        }
    }
    
    return String(error);
};
