
import { supabase } from '../supabaseClient';
import { getErrorMessage } from '../../utils/sanitization';

// Keys that contain user-defined dictionary data (IDs as keys) or specific structures
// that MUST NOT be converted to snake_case or camelCase during API transit.
export const PROTECTED_KEYS = [
    'flightHoursByAircraft',
    'customFields',
    'answers',
    'categoryScores',
    'selfResponses',
    'managerResponses',
    'rosterData',
    'managedSubDepartments',
    'categoryRules',
    'snapshot' // Added snapshot to protected keys to prevent messing with nested JSON structure
];

export const toCamelCase = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(v => toCamelCase(v));
    }
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            // If the key is protected, preserve its value structure exactly
            if (PROTECTED_KEYS.includes(camelKey)) {
                newObj[camelKey] = obj[key];
            } else {
                newObj[camelKey] = toCamelCase(obj[key]);
            }
        }
    }
    return newObj;
};

export const toSnakeCase = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(v => toSnakeCase(v));
    }
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            // If the key is protected, preserve its value structure exactly
            if (PROTECTED_KEYS.includes(key)) {
                newObj[snakeKey] = obj[key];
            } else {
                newObj[snakeKey] = toSnakeCase(obj[key]);
            }
        }
    }
    return newObj;
};

export const logSupabaseError = (context: string, error: any) => {
    console.error(`Supabase Error [${context}]:`, error);
};

export const safeFetch = async <T>(table: string): Promise<T[]> => {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
        logSupabaseError(table, error);
        return [];
    }
    return (toCamelCase(data) || []) as T[];
};

// Security Config for File Uploads
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
];

export const uploadFile = async (file: File): Promise<string> => {
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds the limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error(`Invalid file type: ${file.type}. Only Images and PDFs are allowed.`);
    }

    const fileExt = file.name.split('.').pop();
    const safeExt = fileExt?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${safeExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('portal-uploads')
        .upload(filePath, file);

    if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage
        .from('portal-uploads')
        .getPublicUrl(filePath);

    return data.publicUrl;
};
