
import React, { useState, useMemo } from 'react';
import { PerformanceReview, PerformanceTemplate } from '../../types';
import { useHR } from '../../hooks/useHR';
import { usePermissions } from '../../hooks/usePermissions';
import ReviewSessionModal from './ReviewSessionModal';
import { getErrorMessage } from '../../utils/sanitization';

interface ReviewListWidgetProps {
    staffId: string;
    staffName: string;
    canManage: boolean;
}

const ReviewListWidget: React.FC<ReviewListWidgetProps> = ({ staffId, staffName, canManage }) => {
    const { performanceReviews, performanceTemplates, upsertPerformanceReview, deletePerformanceReview } = useHR();
    const { currentUser } = usePermissions();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedReview, setSelectedReview] = useState<PerformanceReview | null>(null);
    const [isStartModalOpen, setIsStartModalOpen] = useState(false);

    const staffReviews = useMemo(() => 
        performanceReviews.filter(r => r.staffId === staffId).sort((a, b) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime()),
    [performanceReviews, staffId]);

    const handleOpenReview = (review: PerformanceReview) => {
        setSelectedReview(review);
        setIsModalOpen(true);
    };

    const handleSaveReview = async (updatedReview: PerformanceReview) => {
        try {
            await upsertPerformanceReview(updatedReview);
            setIsModalOpen(false);
            setSelectedReview(null);
        } catch (error: any) {
            alert(`Failed to save review: ${getErrorMessage(error)}`);
        }
    };

    const handleDeleteReview = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this performance review? This action cannot be undone.")) {
            try {
                await deletePerformanceReview(id);
            } catch (error: any) {
                alert(`Failed to delete review: ${getErrorMessage(error)}`);
            }
        }
    };

    // Determine mode for the modal
    const getMode = (review: PerformanceReview) => {
        if (review.status === 'completed') return 'view';
        if (review.status === 'self_evaluation' && currentUser?.id === staffId) return 'self';
        if (review.status === 'manager_review' && canManage) return 'manager';
        // If manager views during self-eval, or staff views during manager-eval, it's view only
        return 'view'; 
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            draft: 'bg-gray-200 text-gray-800',
            self_evaluation: 'bg-blue-100 text-blue-800',
            manager_review: 'bg-purple-100 text-purple-800',
            completed: 'bg-green-100 text-green-800',
        };
        return <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${styles[status as keyof typeof styles]}`}>{status.replace('_', ' ')}</span>;
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 mt-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Performance Reviews</h3>
                {canManage && (
                    <button 
                        type="button"
                        onClick={(e) => { e.preventDefault(); setIsStartModalOpen(true); }}
                        className="text-sm bg-brand-secondary text-white px-3 py-1 rounded hover:bg-brand-primary"
                    >
                        Start Review
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {staffReviews.map(review => (
                    <div key={review.id} className="flex justify-between items-center p-3 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:border-gray-600 transition-colors">
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">{review.templateName}</p>
                            <p className="text-xs text-gray-500">Period: {review.periodStart} - {review.periodEnd}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {getStatusBadge(review.status)}
                            <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); handleOpenReview(review); }}
                                className="text-sm text-brand-primary hover:underline font-medium"
                            >
                                {getMode(review) === 'view' ? 'View' : 'Open'}
                            </button>
                            {canManage && (
                                <>
                                    <span className="text-gray-300 dark:text-gray-600">|</span>
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); handleDeleteReview(review.id); }}
                                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                                        title="Delete Review"
                                    >
                                        Delete
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
                {staffReviews.length === 0 && <p className="text-gray-500 text-center py-4 text-sm">No review history.</p>}
            </div>

            {isModalOpen && selectedReview && (
                <ReviewSessionModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveReview}
                    review={selectedReview}
                    template={performanceTemplates.find(t => t.id === selectedReview.templateId) || { id: 'unknown', name: 'Unknown', sections: [] }}
                    mode={getMode(selectedReview)}
                    staffName={staffName}
                />
            )}

            {isStartModalOpen && (
                <StartReviewModal 
                    isOpen={isStartModalOpen} 
                    onClose={() => setIsStartModalOpen(false)}
                    staffId={staffId}
                    templates={performanceTemplates}
                    onStart={async (reviewData) => {
                        await upsertPerformanceReview(reviewData);
                        setIsStartModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

const StartReviewModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    staffId: string;
    templates: PerformanceTemplate[];
    onStart: (review: PerformanceReview) => Promise<void>;
}> = ({ isOpen, onClose, staffId, templates, onStart }) => {
    const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || '');
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [skipSelfEval, setSkipSelfEval] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreate = async (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault(); // Critical: Prevent any form submission bubbling
        e.stopPropagation();

        const template = templates.find(t => t.id === selectedTemplateId);
        if (!template) {
             setError("Please select a template.");
             return;
        }
        if (!periodStart || !periodEnd) {
            setError("Please select both start and end dates.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const newReview: PerformanceReview = {
            id: `pr_${Date.now()}`,
            staffId,
            templateId: template.id,
            templateName: template.name,
            status: skipSelfEval ? 'manager_review' : 'self_evaluation',
            periodStart,
            periodEnd,
            selfResponses: {},
            managerResponses: {},
        };

        try {
            await onStart(newReview);
        } catch (err: any) {
            console.error("Failed to start review:", err);
            const msg = getErrorMessage(err);
            if (msg.includes('relation "public.performance_reviews" does not exist')) {
                 setError("Database table missing. Please run the migration SQL from README.md.");
            } else {
                 setError(msg || "Failed to start review.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent Enter from triggering parent forms
            // Optionally trigger submit if all fields are valid
            if (periodStart && periodEnd) {
                handleCreate(e);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">Start New Review</h2>
                {templates.length === 0 ? (
                    <div className="text-center py-4">
                        <p className="text-gray-500 mb-4">No review templates available.</p>
                        <p className="text-sm text-gray-400">Go to <strong>Admin &gt; Settings &gt; Performance</strong> to create one.</p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded text-sm">Close</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium">Template</label>
                            <select 
                                value={selectedTemplateId} 
                                onChange={e => setSelectedTemplateId(e.target.value)} 
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                onKeyDown={handleKeyDown}
                            >
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Period Start</label>
                                <input 
                                    type="date" 
                                    value={periodStart} 
                                    onChange={e => setPeriodStart(e.target.value)} 
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                    onKeyDown={handleKeyDown}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Period End</label>
                                <input 
                                    type="date" 
                                    value={periodEnd} 
                                    onChange={e => setPeriodEnd(e.target.value)} 
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                    onKeyDown={handleKeyDown}
                                />
                            </div>
                        </div>

                        <div className="flex items-center pt-1">
                            <input 
                                type="checkbox" 
                                id="skipSelf" 
                                checked={skipSelfEval} 
                                onChange={e => setSkipSelfEval(e.target.checked)} 
                                className="h-4 w-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary cursor-pointer"
                            />
                            <label htmlFor="skipSelf" className="ml-2 block text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                                Skip Self Evaluation (Start as Manager Review)
                            </label>
                        </div>
                        
                        {error && <p className="text-sm text-red-500 bg-red-100 p-2 rounded border border-red-200">{error}</p>}

                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded text-sm hover:bg-gray-300">Cancel</button>
                            <button 
                                type="button" 
                                onClick={handleCreate}
                                disabled={isSubmitting} 
                                className="px-4 py-2 bg-brand-primary text-white rounded text-sm hover:bg-brand-secondary disabled:opacity-50"
                            >
                                {isSubmitting ? 'Creating...' : 'Create Review'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewListWidget;
