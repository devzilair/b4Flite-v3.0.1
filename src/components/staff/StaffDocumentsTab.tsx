
import React, { useState, useMemo } from 'react';
import { Staff, StaffDocument, Exam, ExamAttempt } from '../../types';
import StaffDocumentModal from './StaffDocumentModal';
import { usePermissions } from '../../hooks/usePermissions';
import DocumentViewerModal from '../common/DocumentViewerModal';
import ExamResultDetail from '../exam/ExamResultDetail';
import { useTraining } from '../../hooks/useTraining';

interface StaffDocumentsTabProps {
    staff: Partial<Staff>;
    setStaff: React.Dispatch<React.SetStateAction<Partial<Staff>>>;
}

const StaffDocumentsTab: React.FC<StaffDocumentsTabProps> = ({ staff, setStaff }) => {
    const { exams, examAttempts, questions } = useTraining();
    const { currentUser, can } = usePermissions();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDocument, setEditingDocument] = useState<StaffDocument | null>(null);
    const [viewingDoc, setViewingDoc] = useState<StaffDocument | null>(null);

    // State for viewing internal records (Exams)
    const [internalViewingResult, setInternalViewingResult] = useState<{ exam: Exam, attempt: ExamAttempt, staffName: string } | null>(null);

    const canManage = useMemo(() => {
        if (!currentUser || !staff.id) return false;
        // Global admin
        if (can('staff:manage_documents')) return true;
        // Manager or delegate for their own department
        if (can('staff:manage_documents:own_department') && staff.departmentId === currentUser.departmentId) {
            return true;
        }
        return false;
    }, [currentUser, staff, can]);

    const handleSave = (doc: StaffDocument) => {
        setStaff(prev => {
            const docs = prev.documents || [];
            if (editingDocument) {
                return { ...prev, documents: docs.map(d => d.id === doc.id ? doc : d) };
            } else {
                return { ...prev, documents: [...docs, doc] };
            }
        });
        setIsModalOpen(false);
        setEditingDocument(null);
    };

    const handleDelete = (docId: string) => {
        if (window.confirm('Are you sure you want to delete this document?')) {
            setStaff(prev => ({
                ...prev,
                documents: (prev.documents || []).filter(d => d.id !== docId)
            }));
        }
    };

    const isExpiringSoon = (expiryDate: string | null | undefined): boolean => {
        if (!expiryDate) return false;
        const now = new Date();
        const expiry = new Date(expiryDate + 'T00:00:00Z');
        const diffTime = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 90 && diffDays > 0;
    };

    const handleViewDocument = (doc: StaffDocument) => {
        // Detection for internal records (Exams/LPC/OPC Certificates)
        if (doc.documentUrl?.startsWith('#/exams/')) {
            // URL Format: #/exams/[examId]/result
            const parts = doc.documentUrl.split('/');
            const examId = parts[2];
            const examObj = exams.find(e => e.id === examId);

            // Get latest attempt for the staff member being viewed
            const attempt = examAttempts
                .filter(a => a.examId === examId && a.staffId === staff.id)
                .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];

            if (examObj && attempt) {
                setInternalViewingResult({
                    exam: examObj,
                    attempt,
                    staffName: staff.name || 'Staff Member'
                });
            } else {
                alert("Internal Record Error: The underlying exam data for this certificate could not be retrieved.");
            }
        } else {
            setViewingDoc(doc);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-md font-semibold text-gray-800 dark:text-gray-100">Manage Documents</h3>
                {canManage && (
                    <button type="button" onClick={() => { setEditingDocument(null); setIsModalOpen(true); }} className="bg-brand-secondary text-white text-sm py-1 px-3 rounded-md hover:bg-brand-primary">
                        + Add Document
                    </button>
                )}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 dark:bg-gray-700 text-xs uppercase">
                        <tr>
                            <th className="p-3">Document Name</th>
                            <th className="p-3">Issue Date</th>
                            <th className="p-3">Expiry Date</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(staff.documents || []).map(doc => {
                            const expiring = isExpiringSoon(doc.expiryDate);
                            return (
                                <tr key={doc.id} className={`border-b dark:border-gray-600 ${expiring ? 'bg-yellow-50 dark:bg-yellow-900/30' : ''}`}>
                                    <td className="p-3 font-medium">
                                        {doc.name}
                                        {doc.restrictions && (
                                            <span className="ml-2 text-[9px] bg-orange-100 text-orange-800 border border-orange-200 px-1.5 py-0.5 rounded font-bold" title="Limitation/Restriction applied">
                                                {doc.restrictions}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3">{new Date(doc.issueDate + 'T00:00:00Z').toLocaleDateString()}</td>
                                    <td className={`p-3 font-semibold ${expiring ? 'text-status-warning' : ''}`}>
                                        {doc.expiryDate ? new Date(doc.expiryDate + 'T00:00:00Z').toLocaleDateString() : 'Permanent'}
                                    </td>
                                    <td className="p-3 space-x-4">
                                        <button
                                            type="button"
                                            onClick={() => handleViewDocument(doc)}
                                            className="text-brand-primary hover:underline"
                                        >
                                            View
                                        </button>
                                        {canManage && (
                                            <>
                                                <button type="button" onClick={() => { setEditingDocument(doc); setIsModalOpen(true); }} className="text-brand-secondary hover:underline">Edit</button>
                                                <button type="button" onClick={() => handleDelete(doc.id)} className="text-status-danger hover:underline">Delete</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                        {(staff.documents || []).length === 0 && (
                            <tr><td colSpan={4} className="text-center p-8 text-gray-500">No documents uploaded for this staff member.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {isModalOpen && (
                <StaffDocumentModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    existingDocument={editingDocument}
                    staffDob={staff.hrData?.personal?.dob}
                />
            )}

            {viewingDoc && (
                <DocumentViewerModal
                    isOpen={!!viewingDoc}
                    onClose={() => setViewingDoc(null)}
                    documentUrl={viewingDoc.documentUrl}
                    documentName={viewingDoc.name}
                />
            )}

            {/* Internal Record Viewer Overlay */}
            {internalViewingResult && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 print:p-0 print:bg-white print:block">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 print:shadow-none print:w-full print:max-w-none print:max-h-none print:p-0 print:border-none print:rounded-none dark:print:bg-white dark:print:text-black">
                        <ExamResultDetail
                            exam={internalViewingResult.exam}
                            attempt={internalViewingResult.attempt}
                            questions={questions}
                            staffName={internalViewingResult.staffName}
                            onBack={() => setInternalViewingResult(null)}
                            backLabel="Close Record"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffDocumentsTab;
