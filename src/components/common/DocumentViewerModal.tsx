
import React, { useState } from 'react';
import { isValidUrl } from '../../utils/sanitization.ts';

interface DocumentViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    documentUrl: string;
    documentName: string;
}

const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({ isOpen, onClose, documentUrl, documentName }) => {
    const [hasError, setHasError] = useState(false);

    if (!isOpen) return null;

    // Robust check for URL existence and SAFETY
    const hasUrl = typeof documentUrl === 'string' && documentUrl.trim().length > 0 && documentUrl !== 'null' && documentUrl !== 'undefined';
    const isSafeUrl = hasUrl && isValidUrl(documentUrl);

    // Simple heuristic for file types based on extension
    const isImage = isSafeUrl ? /\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i.test(documentUrl) : false;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-[100] flex items-center justify-center p-4 print:hidden" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-lg">
                    <div className="flex flex-col min-w-0 pr-4">
                        <h3 className="font-bold text-lg truncate text-gray-800 dark:text-white">{documentName}</h3>
                        {isSafeUrl && !isImage && <p className="text-[10px] text-gray-500 truncate">{documentUrl}</p>}
                    </div>
                    <div className="flex gap-3 items-center flex-shrink-0">
                        {isSafeUrl && (
                            <a 
                                href={documentUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                Open in New Tab
                            </a>
                        )}
                        <button 
                            onClick={onClose} 
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                            aria-label="Close"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
                <div className="flex-grow bg-gray-100 dark:bg-black overflow-hidden relative flex items-center justify-center">
                    {!isSafeUrl ? (
                         <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
                            <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                                {hasUrl ? "Invalid or Unsafe URL" : "No File Attached"}
                            </p>
                            <p className="text-sm">
                                {hasUrl ? "The document link format is not supported for security reasons." : "This record exists, but no document file has been uploaded."}
                            </p>
                        </div>
                    ) : hasError ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <div className="text-6xl mb-4">📎</div>
                            <p className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Preview Unavailable</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">This file type cannot be displayed directly in the portal or the link is restricted.</p>
                            <a 
                                href={documentUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="px-6 py-3 bg-brand-primary text-white rounded-md font-bold hover:bg-brand-secondary transition-all"
                            >
                                Download or Open Original File
                            </a>
                        </div>
                    ) : isImage ? (
                        <img 
                            src={documentUrl} 
                            alt={documentName} 
                            className="max-w-full max-h-full object-contain p-4" 
                            onError={() => setHasError(true)}
                        />
                    ) : (
                        <iframe 
                            src={documentUrl} 
                            className="w-full h-full border-none bg-white" 
                            title={documentName}
                            // SECURITY: Removed 'allow-same-origin' to prevent access to parent context.
                            // 'allow-scripts' is required for many PDF viewers but without 'allow-same-origin', risks are mitigated.
                            sandbox="allow-scripts"
                            onError={() => setHasError(true)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocumentViewerModal;
