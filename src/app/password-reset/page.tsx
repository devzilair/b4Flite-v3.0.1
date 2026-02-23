'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/services/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const EyeIcon = ({ visible, onClick }: { visible: boolean; onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
        tabIndex={-1}
    >
        {visible ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
        ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
        )}
    </button>
);

const PasswordResetPage: React.FC = () => {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(true);

    const { session: contextSession, authError } = useAuth();
    const [localSession, setLocalSession] = useState<any>(null);

    // Determines active session from either Context (auto-detected) or Manual recovery
    const activeSession = contextSession || localSession;

    // --- Validation Logic ---
    const requirements = useMemo(() => [
        { label: "At least 6 characters", valid: password.length >= 6 },
        { label: "Passwords match", valid: password.length > 0 && password === confirmPassword }
    ], [password, confirmPassword]);

    const isFormValid = requirements.every(r => r.valid);

    // --- Session Recovery Strategy ---
    useEffect(() => {
        // 1. If we have an explicit error from URL (e.g. link expired), show it immediately
        if (authError) {
            setVerifying(false);
            setError(authError.replace(/\+/g, ' '));
            return;
        }

        // 2. If Context already has a session, we are secure.
        if (contextSession) {
            setVerifying(false);
            return;
        }

        // 3. Manual Token Recovery (Backup for strict mode/race conditions)
        const hash = window.location.hash.substring(1); // Remove #
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken) {
            // Forcefully set the session using the token found in URL
            supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
            }).then(({ data, error }) => {
                if (error) {
                    console.error("Manual recovery failed:", error);
                    setError("This password reset link is invalid or has expired.");
                } else if (data.session) {
                    setLocalSession(data.session);
                }
                setVerifying(false);
            });
        } else {
            // Give Context a moment to load before declaring failure
            const timer = setTimeout(() => {
                if (!contextSession && !localSession) {
                    setVerifying(false);
                    setError("Invalid or expired password reset link. Please request a new one.");
                }
            }, 2500);
            return () => clearTimeout(timer);
        }
    }, [contextSession, authError, localSession]);

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!activeSession) {
            setError("Session lost. Please click the link in your email again.");
            return;
        }

        if (!isFormValid) return;

        setLoading(true);
        setError(null);

        try {
            // Cast to any to bypass strict type check for now
            const { error } = await (supabase.auth as any).updateUser({ password });

            if (error) throw error;

            setSuccess("Password updated successfully!");
            setTimeout(() => {
                // Navigate to home and clear hash
                router.push('/');
            }, 2000);
        } catch (err: any) {
            setError(err.message || "Failed to update password.");
        } finally {
            setLoading(false);
        }
    };

    const handleReturnToLogin = () => {
        router.push('/login');
    };

    if (verifying && !activeSession && !error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300 font-medium">Verifying security link...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
                <div>
                    <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        Reset Password
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                        Please verify your identity by setting a new secure password.
                    </p>
                </div>

                {success ? (
                    <div className="rounded-md bg-green-50 dark:bg-green-900/30 p-4 border border-green-200 dark:border-green-800 animate-fade-in">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">Success!</h3>
                                <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                                    <p>{success}</p>
                                    <p className="mt-2">Redirecting to portal...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handlePasswordReset}>
                        {error && (
                            <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4 border border-red-200 dark:border-red-800">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                                        <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                                            {error}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <button
                                        type="button"
                                        onClick={() => router.push('/login')}
                                        className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-500"
                                    >
                                        &larr; Return to Login
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="relative">
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        className="appearance-none block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-md placeholder-gray-400 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm dark:bg-gray-700 dark:text-white"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={!!error}
                                    />
                                    <EyeIcon visible={showPassword} onClick={() => setShowPassword(!showPassword)} />
                                </div>
                            </div>

                            <div className="relative">
                                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <input
                                        id="confirm-password"
                                        name="confirm-password"
                                        type={showConfirm ? 'text' : 'password'}
                                        required
                                        className="appearance-none block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-md placeholder-gray-400 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm dark:bg-gray-700 dark:text-white"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        disabled={!!error}
                                    />
                                    <EyeIcon visible={showConfirm} onClick={() => setShowConfirm(!showConfirm)} />
                                </div>
                            </div>

                            {/* Requirements Checklist */}
                            <div className="mt-4 space-y-2">
                                {requirements.map((req, idx) => (
                                    <div key={idx} className="flex items-center space-x-2 text-sm">
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${req.valid ? 'bg-green-100 border-green-500' : 'bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600'}`}>
                                            {req.valid && <svg className="w-3 h-3 text-green-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                        </div>
                                        <span className={req.valid ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>{req.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {!error && (
                            <button
                                type="submit"
                                disabled={loading || !isFormValid}
                                className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white transition-all ${isFormValid
                                    ? 'bg-brand-primary hover:bg-brand-secondary focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary shadow-lg'
                                    : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed opacity-70'
                                    }`}
                            >
                                {loading ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Updating...
                                    </span>
                                ) : (
                                    'Set New Password'
                                )}
                            </button>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
};

export default PasswordResetPage;
