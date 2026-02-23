
'use client';

import React, { useMemo, useState, use } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { useStaff } from '@/hooks/useStaff';
import { useAuth } from '@/contexts/AuthContext';
import { useFsi } from '@/hooks/useFsi';

interface PageProps {
    params: Promise<{ documentId: string }>;
}

const FsiDocumentPage = ({ params }: PageProps) => {
    const resolvedParams = use(params);
    const documentId = resolvedParams.documentId;
    const router = useRouter();

    const { loading: appLoading } = useStaff();
    const { fsiDocuments, fsiAcks, addFsiAck, loading: fsiLoading } = useFsi();
    const loading = appLoading || fsiLoading;

    const { currentUser } = usePermissions();
    const { signIn } = useAuth();

    const [isReAuthOpen, setIsReAuthOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const document = useMemo(() => fsiDocuments.find(d => d.id === documentId), [fsiDocuments, documentId]);

    const isAcknowledged = useMemo(() => {
        if (!currentUser) return false;
        return fsiAcks.some(ack => ack.documentId === documentId && ack.staffId === currentUser.id);
    }, [fsiAcks, documentId, currentUser]);

    // Estimate Read Time (approx 200 words/min)
    const readTime = useMemo(() => {
        if (!document?.content) return 1;
        const words = document.content.split(/\s+/).length;
        return Math.max(1, Math.ceil(words / 200));
    }, [document?.content]);

    if (loading) {
        return <div>Loading document...</div>;
    }

    if (!document) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl">
                <h1 className="text-2xl font-bold">Document Not Found</h1>
                <p className="text-gray-600 dark:text-gray-300">The document you are looking for does not exist or has been moved.</p>
                <button onClick={() => router.push('/fsi')} className="mt-6 bg-brand-primary text-white py-2 px-4 rounded-md">
                    Back to All Documents
                </button>
            </div>
        );
    }

    const initiateAcknowledge = () => {
        if (!currentUser || isAcknowledged || !document) return;
        setAuthError(null);
        setPassword('');
        setIsReAuthOpen(true);
    };

    const handleConfirmSign = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.email) {
            setAuthError("User email not found. Cannot verify identity.");
            return;
        }

        setIsVerifying(true);
        setAuthError(null);

        try {
            // Verify Identity by attempting to sign in
            const { error } = await signIn(currentUser.email, password);

            if (error) {
                setAuthError("Incorrect password. Electronic signature failed.");
                setIsVerifying(false);
                return;
            }

            // Identity Verified - Proceed with Acknowledgment
            await addFsiAck({
                documentId: document.id,
                staffId: currentUser.id,
                acknowledgedAt: new Date().toISOString(),
            });

            setIsReAuthOpen(false);
        } catch (err) {
            console.error(err);
            setAuthError("An unexpected error occurred.");
        } finally {
            setIsVerifying(false);
        }
    };

    const renderContent = (content: string) => {
        return content.split('\n').map((line, index) => {
            if (line.startsWith('## ')) return <h2 key={index} className="text-xl font-bold mt-4 mb-2">{line.substring(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={index} className="text-lg font-semibold mt-3 mb-1">{line.substring(4)}</h3>;
            if (line.startsWith('- ')) return <li key={index} className="ml-6">{line.substring(2)}</li>;
            if (line.trim() === '') return <br key={index} />;
            return <p key={index} className="mb-2">{line}</p>;
        });
    }

    const priorityColor = {
        low: 'bg-gray-100 text-gray-800',
        normal: 'bg-blue-50 text-blue-800',
        high: 'bg-yellow-50 text-yellow-800 border-l-4 border-yellow-500',
        critical: 'bg-red-50 text-red-800 border-l-4 border-red-600'
    }[document.priority || 'normal'];

    return (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-4xl mx-auto relative">

            {/* Priority Banner (High/Critical Only) */}
            {(document.priority === 'high' || document.priority === 'critical') && (
                <div className={`-mx-8 -mt-8 mb-8 p-4 flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-sm ${priorityColor}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    {document.priority} Priority Notice
                </div>
            )}

            <header className="mb-8 pb-4 border-b dark:border-gray-600">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-200 text-gray-700 uppercase tracking-wide">
                                {document.category || 'General'}
                            </span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                ~{readTime} min read
                            </span>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">{document.title}</h1>
                        <p className="text-md text-gray-500 dark:text-gray-400">
                            {document.documentNumber} (Rev. {document.revision}) - Issued: {new Date(document.issueDate + 'T00:00:00Z').toLocaleDateString()}
                        </p>
                    </div>
                    {document.documentUrl && (
                        <a
                            href={document.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-brand-primary font-semibold py-2 px-4 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            View Attachment
                        </a>
                    )}
                </div>
            </header>
            <main className="prose dark:prose-invert max-w-none">
                {renderContent(document.content)}
            </main>
            <footer className="mt-12 pt-8 border-t dark:border-gray-600 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <Link href="/fsi" className="text-brand-primary hover:underline">&larr; Back to all documents</Link>
                </div>
                <button
                    onClick={initiateAcknowledge}
                    disabled={isAcknowledged}
                    className="w-full sm:w-auto bg-brand-primary text-white font-bold py-3 px-8 rounded-md hover:bg-brand-secondary transition-colors disabled:bg-green-600 disabled:opacity-100 disabled:cursor-default"
                >
                    {isAcknowledged ? '✔ Acknowledged' : 'Acknowledge Reading'}
                </button>
            </footer>

            {/* Re-Authentication Modal */}
            {isReAuthOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsReAuthOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Confirm Acknowledgment</h2>
                        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded mb-6 text-sm text-blue-800 dark:text-blue-200">
                            <p className="font-semibold mb-1">Electronic Signature Required</p>
                            <p>Please enter your password to confirm you have read and understood this document.</p>
                        </div>

                        <form onSubmit={handleConfirmSign}>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-brand-primary outline-none transition-shadow"
                                    autoFocus
                                    required
                                    placeholder="Enter your login password"
                                />
                                {authError && (
                                    <div className="mt-2 text-red-600 text-sm flex items-center animate-fade-in">
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {authError}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-2 border-t dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setIsReAuthOpen(false)}
                                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isVerifying || !password}
                                    className="px-6 py-2 text-sm bg-brand-primary text-white rounded hover:bg-brand-secondary disabled:opacity-50 font-bold shadow-sm transition-all"
                                >
                                    {isVerifying ? 'Verifying...' : 'Sign & Acknowledge'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FsiDocumentPage;
