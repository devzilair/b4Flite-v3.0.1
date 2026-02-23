'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseUrl, isConfigured } from '@/services/supabaseClient';

const SignInComponent: React.FC<{ onForgotPassword: () => void }> = ({ onForgotPassword }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const router = useRouter();

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        const { error } = await signIn(email, password);
        setLoading(false);
        if (error) {
            setError(error.message || 'Invalid login credentials.');
        } else {
            router.replace('/');
        }
    };

    return (
        <form onSubmit={handleSignIn} className="space-y-6 animate-fade-in">
            <div>
                <label htmlFor="email-in" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                <input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 form-input" />
            </div>
            <div>
                <div className="flex justify-between items-center">
                    <label htmlFor="password-in" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                    <button
                        type="button"
                        onClick={onForgotPassword}
                        className="text-xs text-brand-primary hover:underline"
                    >
                        Forgot Password?
                    </button>
                </div>
                <input id="password-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 form-input" />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button type="submit" disabled={loading} className="w-full form-button">
                {loading ? 'Signing In...' : 'Sign In'}
            </button>
        </form>
    );
};

const ForgotPasswordComponent: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const { sendPasswordResetEmail } = useAuth();

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        const { error } = await sendPasswordResetEmail(email);
        setLoading(false);

        if (error) {
            setMessage({ type: 'error', text: error.message || 'Failed to send recovery email.' });
        } else {
            setMessage({ type: 'success', text: 'Password reset link sent! Check your inbox.' });
            setEmail('');
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="text-center">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Reset Password</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter your email to receive a recovery link.</p>
            </div>

            {message?.type === 'success' ? (
                <div className="p-4 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md text-sm text-center">
                    {message.text}
                </div>
            ) : (
                <form onSubmit={handleReset} className="space-y-4">
                    <div>
                        <label htmlFor="email-reset" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                        <input id="email-reset" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 form-input" />
                    </div>
                    {message?.type === 'error' && <p className="text-red-500 text-sm text-center">{message.text}</p>}
                    <button type="submit" disabled={loading} className="w-full form-button">
                        {loading ? 'Sending...' : 'Send Recovery Link'}
                    </button>
                </form>
            )}

            <button
                onClick={onBack}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
                Back to Sign In
            </button>
        </div>
    );
};

const ActivationComponent: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleActivation = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name,
                    },
                },
            });

            if (error) throw error;

            if (data.user) {
                if (data.session) {
                    onSuccess();
                } else {
                    setSuccessMsg("Account created! Please check your email to confirm your address before logging in.");
                }
            }
        } catch (err: any) {
            console.error("Activation failed:", err);
            if (err.message.includes("Unauthorized")) {
                setError("No staff profile found for this email. Please contact your manager.");
            } else {
                setError(err.message || "Failed to create account.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (successMsg) {
        return (
            <div className="text-center p-6 bg-green-50 dark:bg-green-900/30 rounded-lg animate-fade-in">
                <div className="text-4xl mb-4">📧</div>
                <h3 className="text-lg font-bold text-green-800 dark:text-green-200 mb-2">Check your inbox</h3>
                <p className="text-sm text-green-700 dark:text-green-300">{successMsg}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-6 text-sm text-brand-primary underline"
                >
                    Back to Sign In
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleActivation} className="space-y-4 animate-fade-in">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md text-xs text-blue-800 dark:text-blue-200 mb-4">
                Enter the email address used by your manager to create your profile. This will automatically link your login to your staff record.
            </div>
            <div>
                <label htmlFor="name-act" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                <input id="name-act" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 form-input" />
            </div>
            <div>
                <label htmlFor="email-act" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                <input id="email-act" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 form-input" />
            </div>
            <div>
                <label htmlFor="password-act" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Create Password</label>
                <input id="password-act" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 form-input" />
            </div>
            {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
            <button type="submit" disabled={loading} className="w-full form-button">
                {loading ? 'Activating...' : 'Activate Account'}
            </button>
        </form>
    );
};

const SetupComponent: React.FC = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const { setupPortal } = useAuth();

    const handleSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        const { error } = await setupPortal(name, email, password);
        setLoading(false);
        if (error) {
            setError(`Setup failed: ${error.message}`);
        } else {
            setSuccess("Portal setup successful! Please refresh the page to sign in with your new credentials.");
        }
    };

    if (success) {
        return (
            <div className="text-center p-4 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 rounded-md">
                <p className="font-bold">Setup Successful!</p>
                <p className="text-sm mt-2">{success}</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSetup} className="space-y-6 animate-fade-in">
            <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Portal Setup</h2>
                <p className="text-sm text-gray-500 mt-1">Create the first Super Administrator account.</p>
            </div>
            <div>
                <label htmlFor="name-up" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                <input id="name-up" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 form-input" />
            </div>
            <div>
                <label htmlFor="email-up" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                <input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 form-input" />
            </div>
            <div>
                <label htmlFor="password-up" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <input id="password-up" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 form-input" />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button type="submit" disabled={loading} className="w-full form-button">
                {loading ? 'Setting Up...' : 'Complete Setup'}
            </button>
        </form>
    );
};

const LoginPage: React.FC = () => {
    const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
    const [activeTab, setActiveTab] = useState<'login' | 'activate' | 'forgot_password'>('login');
    const router = useRouter();

    useEffect(() => {
        if (!isConfigured) {
            setNeedsSetup(false);
            return;
        }

        const checkSetup = async () => {
            try {
                // Use a dedicated RPC to check setup status.
                const { data, error } = await supabase.rpc('is_portal_setup');

                if (error) {
                    console.error("Error checking for setup:", error.message);
                    // On error (e.g. network failure), default to login screen rather than setup
                    // This prevents getting stuck if RPC fails but app is actually set up
                    setNeedsSetup(false);
                } else {
                    setNeedsSetup(data === false);
                }
            } catch (e) {
                console.error("Unexpected error during setup check:", e);
                setNeedsSetup(false);
            }
        };
        checkSetup();
    }, []);

    const renderContent = () => {
        if (needsSetup === null) {
            return <div className="text-center py-10 text-gray-500">Checking portal status...</div>;
        }

        if (needsSetup) {
            return <SetupComponent />;
        }

        return (
            <div>
                {activeTab !== 'forgot_password' && (
                    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                        <button
                            className={`flex-1 py-2 text-sm font-medium text-center transition-colors ${activeTab === 'login' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                            onClick={() => setActiveTab('login')}
                        >
                            Sign In
                        </button>
                        <button
                            className={`flex-1 py-2 text-sm font-medium text-center transition-colors ${activeTab === 'activate' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                            onClick={() => setActiveTab('activate')}
                        >
                            Activate Account
                        </button>
                    </div>
                )}

                {activeTab === 'login' && (
                    <SignInComponent onForgotPassword={() => setActiveTab('forgot_password')} />
                )}

                {activeTab === 'activate' && (
                    <ActivationComponent onSuccess={() => router.replace('/')} />
                )}

                {activeTab === 'forgot_password' && (
                    <ForgotPasswordComponent onBack={() => setActiveTab('login')} />
                )}
            </div>
        );
    };

    return (
        <div className="flex items-center justify-center min-h-dvh bg-gray-100 dark:bg-gray-900 bg-[url('https://images.unsplash.com/photo-1594156596782-fa263796f860?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat relative">
            <div className="absolute inset-0 bg-black/20 dark:bg-black/40"></div>

            <style>{`
                .form-input { display: block; width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #374151; background-color: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 0.375rem; }
                .dark .form-input { color: #D1D5DB; background-color: #374151; border-color: #4B5563; }
                .form-button { width: 100%; background-color: #0D47A1; color: white; padding: 0.75rem 1rem; border-radius: 0.375rem; transition: background-color 0.2s; font-weight: 600; }
                .form-button:hover { background-color: #1565C0; }
                .form-button:disabled { background-color: #BBDEFB; cursor: not-allowed; }
            `}</style>

            <div className="relative z-10 p-8 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-2xl w-full max-w-md border border-white/20 mx-4">
                <div className="text-center mb-6 mt-2 flex justify-center">
                    <img
                        src={`${supabaseUrl}/storage/v1/object/public/portal-uploads/logo_white.png`}
                        alt="Logo"
                        className="h-14 object-contain block dark:hidden"
                        onError={(e) => { e.currentTarget.src = "https://placehold.co/200x80?text=Logo"; }}
                    />
                    <img
                        src={`${supabaseUrl}/storage/v1/object/public/portal-uploads/logo_black.png`}
                        alt="Logo"
                        className="h-14 object-contain hidden dark:block"
                        onError={(e) => { e.currentTarget.src = "https://placehold.co/200x80/333/FFF?text=Logo"; }}
                    />
                </div>

                {renderContent()}

                <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-700 w-full text-center">
                    <p className="text-[10px] text-gray-400 font-medium">
                        JBVservices <span className="text-[8px] align-top">©</span> 2025
                    </p>
                    <p className="text-[9px] text-gray-500 mt-0.5">
                        v55.14.0
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;