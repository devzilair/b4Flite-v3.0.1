
import { createClient } from '@supabase/supabase-js';

// Next.js automatically injects NEXT_PUBLIC_ variables into the browser bundle.
const NEXT_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const NEXT_SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabaseUrl = NEXT_SUPABASE_URL;
export const supabaseKey = NEXT_SUPABASE_KEY;

export const isConfigured = !!(supabaseUrl && supabaseKey);

if (typeof window !== 'undefined') {
    console.log(`[b4Flite] Initialized.`);
    console.log(`[b4Flite] Connected to: ${supabaseUrl.substring(0, 15)}...`);
}

// Create client
// If configuration is missing, create a dummy client to prevent crash on load, 
// but isConfigured will be false so the app should handle it.
export const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : createClient('https://placeholder.supabase.co', 'placeholder');
