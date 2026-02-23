
import React, { useState, useMemo } from 'react';
import { PerformanceReview, PerformanceTemplate, ReviewSection, ReviewItemResponse } from '../../types';
import { sanitizeString } from '../../utils/sanitization';

interface ReviewSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (review: PerformanceReview) => void;
    review: PerformanceReview;
    template: PerformanceTemplate;
    mode: 'self' | 'manager' | 'view';
    staffName: string;
}

const StarRating: React.FC<{ value: number; onChange?: (val: number) => void; readOnly?: boolean }> = ({ value, onChange, readOnly }) => {
    return (
        <div className="flex">
            {[1, 2, 3, 4, 5].map(star => (
                <button
                    key={star}
                    type="button"
                    onClick={() => !readOnly && onChange && onChange(star)}
                    className={`text-2xl cursor-pointer focus:outline-none transition-transform ${!readOnly ? 'hover:scale-110' : 'cursor-default'}`}
                    disabled={readOnly}
                >
                    <svg 
                        className={`w-8 h-8 ${star <= value ? 'text-yellow-400' : 'text-gray-300'}`} 
                        fill="currentColor" 
                        viewBox="0 0 20 20" 
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                </button>
            ))}
        </div>
    );
};

const ReviewSessionModal: React.FC<ReviewSessionModalProps> = ({ isOpen, onClose, onSave, review, template, mode, staffName }) => {
    const [localReview, setLocalReview] = useState<PerformanceReview>(JSON.parse(JSON.stringify(review)));
    const [activeSectionId, setActiveSectionId] = useState(template.sections[0]?.id || '');

    // Ensure responses objects exist
    if (!localReview.selfResponses) localReview.selfResponses = {};
    if (!localReview.managerResponses) localReview.managerResponses = {};

    const handleResponseChange = (itemId: string, field: 'rating' | 'comment', value: any) => {
        const targetResponses = mode === 'self' ? 'selfResponses' : 'managerResponses';
        
        setLocalReview(prev => {
            const newResponses = { ...prev[targetResponses] };
            if (!newResponses[itemId]) newResponses[itemId] = { itemId };
            (newResponses[itemId] as any)[field] = value;
            
            // Auto-calculate overall rating if manager is rating
            let newOverallRating = prev.overallRating;
            if (mode === 'manager' && field === 'rating') {
                // Simple average of all manager ratings provided so far
                const allRatings = Object.values(newResponses).map(r => (r as ReviewItemResponse).rating).filter(r => r !== undefined && r > 0) as number[];
                if (allRatings.length > 0) {
                    const sum = allRatings.reduce((a, b) => a + b, 0);
                    newOverallRating = Math.round((sum / allRatings.length) * 10) / 10;
                }
            }

            return { ...prev, [targetResponses]: newResponses, overallRating: newOverallRating };
        });
    };

    const handleSubmit = () => {
        // Logic to advance status
        let nextStatus = localReview.status;
        if (mode === 'self') nextStatus = 'manager_review';
        if (mode === 'manager') nextStatus = 'completed';

        onSave({
            ...localReview,
            finalComments: sanitizeString(localReview.finalComments),
            status: nextStatus,
            completedAt: nextStatus === 'completed' ? new Date().toISOString() : undefined,
        });
    };

    if (!isOpen) return null;

    const activeSection = template.sections.find(s => s.id === activeSectionId);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center sm:p-4" /* No onClick close */>
            <div className="bg-white dark:bg-gray-800 sm:rounded-lg shadow-2xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 dark:bg-gray-700/30 gap-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">{template.name}</h2>
                        <p className="text-sm text-gray-500">For: <span className="font-semibold">{staffName}</span> | {localReview.periodStart} to {localReview.periodEnd}</p>
                    </div>
                    <div className="text-right self-end sm:self-auto">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold uppercase tracking-wide">
                            {mode === 'self' ? 'Self Evaluation' : mode === 'manager' ? 'Manager Review' : 'View Only'}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row flex-grow overflow-hidden">
                    {/* Sidebar Navigation */}
                    <div className="w-full md:w-64 bg-gray-50 dark:bg-gray-900/50 border-b md:border-b-0 md:border-r dark:border-gray-700 overflow-x-auto md:overflow-y-auto p-2 md:p-4 flex flex-row md:flex-col gap-2 flex-shrink-0">
                        {template.sections.map(section => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSectionId(section.id)}
                                className={`flex-shrink-0 md:w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeSectionId === section.id ? 'bg-brand-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                            >
                                {section.title}
                            </button>
                        ))}
                        <button
                            onClick={() => setActiveSectionId('summary')}
                            className={`flex-shrink-0 md:w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeSectionId === 'summary' ? 'bg-brand-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                        >
                            Summary & Sign-off
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-grow overflow-y-auto p-6">
                        {activeSection ? (
                            <div className="space-y-8">
                                <h3 className="text-xl font-bold border-b pb-2 mb-4 dark:border-gray-700">{activeSection.title}</h3>
                                {activeSection.items.map(item => {
                                    const selfResp: Partial<ReviewItemResponse> = localReview.selfResponses[item.id] || {};
                                    const mgrResp: Partial<ReviewItemResponse> = localReview.managerResponses[item.id] || {};

                                    return (
                                        <div key={item.id} className="p-4 border rounded-lg dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                                            <h4 className="font-semibold text-lg mb-1">{item.label}</h4>
                                            {item.description && <p className="text-sm text-gray-500 mb-4">{item.description}</p>}

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                {/* Self Evaluation Column */}
                                                <div className={`p-3 rounded ${mode === 'self' ? 'bg-white dark:bg-gray-700 shadow-sm border border-blue-200 dark:border-blue-800' : 'opacity-70'}`}>
                                                    <p className="text-xs font-bold uppercase text-gray-400 mb-2">Self Rating</p>
                                                    {item.type === 'rating' && (
                                                        <StarRating 
                                                            value={selfResp.rating || 0} 
                                                            onChange={val => handleResponseChange(item.id, 'rating', val)} 
                                                            readOnly={mode !== 'self'} 
                                                        />
                                                    )}
                                                    <textarea
                                                        className="w-full mt-2 p-2 text-sm border rounded bg-transparent dark:border-gray-600"
                                                        placeholder="Employee comments..."
                                                        rows={2}
                                                        value={selfResp.comment || ''}
                                                        onChange={e => handleResponseChange(item.id, 'comment', e.target.value)}
                                                        disabled={mode !== 'self'}
                                                    />
                                                </div>

                                                {/* Manager Evaluation Column */}
                                                {(mode === 'manager' || mode === 'view' || localReview.status !== 'self_evaluation') && (
                                                    <div className={`p-3 rounded ${mode === 'manager' ? 'bg-white dark:bg-gray-700 shadow-sm border border-purple-200 dark:border-purple-800' : 'opacity-70'}`}>
                                                        <p className="text-xs font-bold uppercase text-gray-400 mb-2">Manager Rating</p>
                                                        {item.type === 'rating' && (
                                                            <StarRating 
                                                                value={mgrResp.rating || 0} 
                                                                onChange={val => handleResponseChange(item.id, 'rating', val)} 
                                                                readOnly={mode !== 'manager'} 
                                                            />
                                                        )}
                                                        <textarea
                                                            className="w-full mt-2 p-2 text-sm border rounded bg-transparent dark:border-gray-600"
                                                            placeholder="Manager comments..."
                                                            rows={2}
                                                            value={mgrResp.comment || ''}
                                                            onChange={e => handleResponseChange(item.id, 'comment', e.target.value)}
                                                            disabled={mode !== 'manager'}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <h3 className="text-xl font-bold border-b pb-2 mb-4 dark:border-gray-700">Summary & Sign-off</h3>
                                <div className="p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                                    <label className="block font-semibold mb-2">Overall Rating</label>
                                    <div className="text-4xl font-bold text-brand-primary">{localReview.overallRating || '-'}/5</div>
                                    <p className="text-xs text-gray-500 mt-1">Calculated average of manager ratings.</p>
                                </div>
                                
                                <div>
                                    <label className="block font-semibold mb-2">Final Comments</label>
                                    <textarea 
                                        className="w-full p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        rows={4}
                                        placeholder="Overall summary of performance..."
                                        value={localReview.finalComments || ''}
                                        onChange={e => setLocalReview({...localReview, finalComments: e.target.value})}
                                        disabled={mode !== 'manager'}
                                    />
                                </div>

                                {mode !== 'view' && (
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded border border-yellow-200 dark:border-yellow-800">
                                        <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                                            By clicking submit below, you are finalizing your portion of this performance review.
                                        </p>
                                        <button 
                                            onClick={handleSubmit}
                                            className="bg-brand-primary text-white py-2 px-6 rounded font-bold hover:bg-brand-secondary w-full md:w-auto"
                                        >
                                            {mode === 'self' ? 'Submit Self-Evaluation' : 'Finalize & Sign Review'}
                                        </button>
                                    </div>
                                )}
                                {mode === 'view' && review.completedAt && (
                                    <div className="text-center p-4 text-green-600 font-semibold border border-green-200 bg-green-50 rounded">
                                        ✓ Review Completed on {new Date(review.completedAt).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t dark:border-gray-700 flex justify-end bg-gray-50 dark:bg-gray-700/30 sm:rounded-b-lg">
                     <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white">Close</button>
                </div>
            </div>
        </div>
    );
};

export default ReviewSessionModal;
