
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
// FIX: Removed types Session, User imports as they are not exported in some versions
import { supabase, isConfigured } from '../services/supabaseClient';

// Capture URL immediately when module loads to prevent race conditions
const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
const currentHash = typeof window !== 'undefined' ? window.location.hash : '';

// Helper to check if a string contains auth params
const containsAuthParams = (str: string) => {
    const decoded = decodeURIComponent(str);
    return (
        str.includes('type=recovery') || 
        str.includes('type=invite') ||
        decoded.includes('type=recovery') ||
        decoded.includes('type=invite') ||
        str.includes('access_token') // Generic check for magic links
    );
};

// Helper to check if the hash contains an error
const containsAuthError = (str: string) => {
    const decoded = decodeURIComponent(str);
    return (
        str.includes('error=') ||
        decoded.includes('error=')
    );
};

const hasInitialAuthParams = containsAuthParams(currentUrl) || containsAuthParams(currentHash);
const hasInitialAuthError = containsAuthError(currentUrl) || containsAuthError(currentHash);

interface AuthContextType {
    session: any | null;
    user: any | null;
    loading: boolean;
    authEvent: string | null;
    authError: string | null;
    signIn: (email: string, password: string) => Promise<{ error: any }>;
    signOut: () => Promise<void>;
    setupPortal: (name: string, email: string, password: string) => Promise<{ error: any }>;
    sendPasswordResetEmail: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<any | null>(null);
    const [session, setSession] = useState<any | null>(null);
    
    // CRITICAL FIX: If we detect auth params in the URL, force loading to TRUE initially.
    // We only set it to false once Supabase fires a SIGNED_IN or RECOVERY event, or a safety timeout hits.
    const [loading, setLoading] = useState(true);
    
    const [authError, setAuthError] = useState<string | null>(() => {
         if (hasInitialAuthError) {
             const params = new URLSearchParams(currentHash.substring(1));
             return params.get('error_description') || params.get('error') || 'Authentication Error';
         }
         return null;
    });
    
    const [authEvent, setAuthEvent] = useState<string | null>(() => {
        if (hasInitialAuthParams) return 'PASSWORD_RECOVERY';
        return null;
    });

    useEffect(() => {
        if (!isConfigured) {
            setLoading(false);
            return;
        }

        // 1. Setup Auth Listener
        const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((event: any, session: any) => {
            console.log('Auth State Change:', event, session?.user?.email);

            if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'TOKEN_REFRESHED') {
                setSession(session);
                setUser(session?.user ?? null);
                
                // If we were waiting for a recovery link, confirm it now
                if (hasInitialAuthParams) {
                    setAuthEvent('PASSWORD_RECOVERY');
                }
                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                setSession(null);
                setUser(null);
                setAuthEvent(null);
                setLoading(false);
            } else if (event === 'USER_UPDATED') {
                setSession(session);
                setUser(session?.user ?? null);
                // Don't necessarily stop loading here if we are in the middle of a recovery flow
            } else if (event === 'INITIAL_SESSION') {
                // Initial session load from local storage
                setSession(session);
                setUser(session?.user ?? null);
                
                // IMPORTANT: If we have URL params, we ignore the INITIAL_SESSION 'loading=false' signal
                // because we are waiting for the URL token to be processed (which happens slightly later).
                if (!hasInitialAuthParams) {
                    setLoading(false);
                }
            }
        });

        // 2. Safety Timeout
        // If Supabase fails to process the hash (e.g. invalid token) within 5 seconds, stop loading so we don't hang forever.
        // This will allow the UI to show "Link Expired" instead of a spinner.
        const safetyTimeout = setTimeout(() => {
            setLoading((prev) => {
                if (prev) {
                    console.warn('Auth check timed out. Forcing load completion.');
                    return false;
                }
                return prev;
            });
        }, 5000);

        return () => {
            subscription?.unsubscribe();
            clearTimeout(safetyTimeout);
        };
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        if (!isConfigured) return { error: { message: "App not configured." } };
        const { error } = await (supabase.auth as any).signInWithPassword({ email, password });
        return { error };
    }, []);

    const signOut = useCallback(async () => {
        if (!isConfigured) return;
        try {
            await (supabase.auth as any).signOut();
        } catch (error) {
            console.error("Error signing out:", error);
        } finally {
            setAuthEvent(null);
            setAuthError(null);
            setSession(null);
            setUser(null);
            // Ensure we clear the hash if we sign out, to prevent loop
            if (window.location.hash.includes('access_token')) {
                window.history.replaceState(null, '', window.location.pathname);
            }
        }
    }, []);
    
    const setupPortal = useCallback(async (name: string, email: string, password: string) => {
        if (!isConfigured) return { error: { message: "App not configured." } };
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { name: name } }
            });
            return { error };
        } catch (error: any) {
            return { error };
        }
    }, []);

    const sendPasswordResetEmail = useCallback(async (email: string) => {
        if (!isConfigured) return { error: { message: "App not configured." } };
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.href,
        });
        return { error };
    }, []);

    const value = useMemo(() => ({
        session,
        user,
        loading,
        authEvent,
        authError,
        signIn,
        signOut,
        setupPortal,
        sendPasswordResetEmail,
    }), [session, user, loading, authEvent, authError, signIn, signOut, setupPortal, sendPasswordResetEmail]);
    
    // We handle the loading spinner in the UI components, passing the state down
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
