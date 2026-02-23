'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * AuthGuard protects routes that require authentication.
 * It redirects unauthenticated users to the /login page.
 * It also ensures that the staff profile is loaded before showing children.
 */
export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading: authLoading } = useAuth();
    const { currentUser, loading: permissionsLoading } = usePermissions();
    const router = useRouter();
    const pathname = usePathname();
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
        // If auth is strictly finished and we have no user, redirect
        if (!authLoading && !user && !isRedirecting) {
            console.log('[AuthGuard] No session found. Redirecting to login.');
            setIsRedirecting(true);
            router.replace('/login');
            return;
        }

        // If we have a user but permissions loading is finished and we have no staff profile,
        // it means the account is unlinked. We allow them in for now but they will have restricted access.
        // Future improvement: Redirect to an "Unlinked Account" or "Contact Admin" page.
        if (!authLoading && user && !permissionsLoading && !currentUser) {
            console.warn('[AuthGuard] Authenticated user has no matching staff record.');
        }

    }, [user, authLoading, permissionsLoading, currentUser, router, isRedirecting]);

    // Show loading state while checking authentication
    if (authLoading || (user && permissionsLoading)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400 animate-pulse font-medium">Verifying Account Access...</p>
            </div>
        );
    }

    // Don't render children if we are in the middle of a redirect or have no user
    if (!user || isRedirecting) {
        return null;
    }

    return <>{children}</>;
};

export default AuthGuard;
