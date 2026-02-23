
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { StaffDocument, QualificationType, Staff, Department, Exam, ExamAttempt } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import StaffDocumentModal from '@/components/staff/StaffDocumentModal';
import { useStaff } from '@/hooks/useStaff';
import useLocalStorage from '@/hooks/useLocalStorage';
import DocumentViewerModal from '@/components/common/DocumentViewerModal';
import ExamResultDetail from '@/components/exam/ExamResultDetail';
import { useTraining } from '@/hooks/useTraining';
import { useSettings } from '@/hooks/useSettings';

/**
 * Helper to determine if a document is valid, expiring, or expired based on current date.
 */
const getExpiryStatus = (expiryDate: string | null | undefined) => {
    if (!expiryDate) return 'permanent';
    const now = new Date();
    // Normalize date string for consistent comparison
    const cleanDateStr = expiryDate.includes('T') ? expiryDate.split('T')[0] : expiryDate;
    const expiry = new Date(cleanDateStr + 'T00:00:00Z');

    if (isNaN(expiry.getTime())) return 'permanent';

    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'expired';
    if (diffDays <= 90) return 'expiring';
    return 'valid';
};

const DocumentCard: React.FC<{ doc: StaffDocument; canManage: boolean; onEdit: () => void; onDelete: () => void; onView: () => void; typeName?: string }> = ({ doc, canManage, onEdit, onDelete, onView, typeName }) => {
    const status = getExpiryStatus(doc.expiryDate);
    const isInternalRecord = doc.documentUrl?.startsWith('#/');

    const statusColors = {
        valid: 'bg-green-100 text-green-800 border-green-200',
        expiring: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        expired: 'bg-red-100 text-red-800 border-red-200',
        permanent: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    const statusLabels = {
        valid: 'Valid',
        expiring: 'Expiring Soon',
        expired: 'Expired',
        permanent: 'Permanent',
    };

    // Stricter check for file existence
    const hasFile = typeof doc.documentUrl === 'string' && doc.documentUrl.trim().length > 0 && doc.documentUrl !== 'null' && doc.documentUrl !== 'undefined';

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4 flex flex-col h-full hover:shadow-lg transition-shadow group relative">
            {/* Limitation Badge */}
            {doc.restrictions && (
                <div className="absolute top-2 right-2 z-10 bg-orange-100 text-orange-800 text-[9px] font-bold px-2 py-0.5 rounded border border-orange-200 shadow-sm" title={doc.restrictions}>
                    {doc.restrictions}
                </div>
            )}

            <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${isInternalRecord ? 'bg-purple-50 dark:bg-purple-900/30' : 'bg-blue-50 dark:bg-blue-900/30'}`}>
                    {isInternalRecord ? (
                        <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" /></svg>
                    ) : (
                        <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.414a6 6 0 108.486 8.486L19 14.5" /></svg>
                    )}
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${statusColors[status]}`}>
                    {statusLabels[status]}
                </span>
            </div>

            <h3 className="font-bold text-base text-gray-900 dark:text-white mb-1 truncate pr-8" title={doc.name}>{doc.name}</h3>
            {typeName && <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 mb-2 inline-block font-bold">{typeName}</span>}

            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 flex-grow mt-2">
                <p className="text-xs">Issued: {new Date(doc.issueDate + 'T00:00:00Z').toLocaleDateString('en-GB')}</p>
                <p className={`text-xs ${status === 'expired' || status === 'expiring' ? 'font-semibold text-red-600 dark:text-red-400' : ''}`}>
                    Expires: {doc.expiryDate ? new Date(doc.expiryDate + 'T00:00:00Z').toLocaleDateString('en-GB') : 'Permanent'}
                </p>
                {doc.restrictions && <p className="text-[10px] text-orange-600 font-bold mt-1">Limitation: {doc.restrictions}</p>}
            </div>

            <div className="mt-4 pt-3 border-t dark:border-gray-600 flex justify-between items-center">
                {hasFile ? (
                    <button
                        onClick={onView}
                        className={`text-xs font-bold px-3 py-1 rounded border transition-colors flex items-center gap-1.5 ${isInternalRecord ? 'text-purple-600 border-purple-200 hover:bg-purple-50' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}
                    >
                        {isInternalRecord ? 'View Record' : 'View File'}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </button>
                ) : (
                    <span className="text-xs text-gray-400 italic cursor-default select-none">No attachment</span>
                )}

                {canManage && (
                    <div className="flex gap-2">
                        <button onClick={onEdit} className="text-gray-400 hover:text-brand-primary" title="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={onDelete} className="text-gray-400 hover:text-red-500" title="Delete">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const TrainingMatrix: React.FC<{
    staff: Staff[],
    departments: Department[],
    qualificationTypes: QualificationType[],
    onCellClick: (staffId: string, qualTypeId: string, existingDoc?: StaffDocument) => void
}> = ({ staff, departments, qualificationTypes, onCellClick }) => {

    const groupedStaff = useMemo(() => {
        const groups: Record<string, Record<string, Staff[]>> = {};
        staff.forEach(s => {
            const dept = departments.find(d => d.id === s.departmentId);
            const deptName = dept?.name || 'Unassigned';
            const subDeptName = (s.subDepartments && s.subDepartments.length > 0) ? s.subDepartments[0] : 'General';

            if (!groups[deptName]) groups[deptName] = {};
            if (!groups[deptName][subDeptName]) groups[deptName][subDeptName] = [];
            groups[deptName][subDeptName].push(s);
        });
        return groups;
    }, [staff, departments]);

    const sortedDeptNames = Object.keys(groupedStaff).sort();

    const renderCell = (person: Staff, qt: QualificationType) => {
        // N/A Logic: If qual is dept-specific and person isn't in that dept
        if (qt.departmentId && qt.departmentId !== person.departmentId) {
            return (
                <div
                    className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-300 dark:text-gray-700 text-[10px] cursor-default border-r border-b dark:border-gray-600"
                    title="Not applicable for this department"
                >
                    N/A
                </div>
            );
        }

        const doc = person.documents?.find(d => d.qualificationTypeId === qt.id);

        if (!doc) {
            return (
                <div
                    onClick={() => onCellClick(person.id, qt.id)}
                    className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800 text-transparent hover:text-gray-400 text-xs cursor-pointer hover:border-2 hover:border-dashed hover:border-gray-400 transition-all"
                    title="Click to add"
                >
                    +
                </div>
            );
        }

        const status = getExpiryStatus(doc.expiryDate);

        const statusClass = {
            valid: 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300',
            expiring: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300',
            expired: 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300',
            permanent: 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300',
        }[status];

        return (
            <div
                onClick={() => onCellClick(person.id, qt.id, doc)}
                className={`w-full h-full flex flex-col justify-center items-center p-1 text-xs ${statusClass} border-r border-b dark:border-gray-600 cursor-pointer relative`}
                title={`${doc.name} - Expires: ${doc.expiryDate || 'Permanent'} ${doc.restrictions ? `(${doc.restrictions})` : ''}`}
            >
                <span className="font-bold">{doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) : 'PERM'}</span>
                {doc.restrictions && <div className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-bl-sm" title={doc.restrictions}></div>}
            </div>
        );
    };

    return (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow max-h-[80vh]">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20">
                    <tr>
                        <th className="sticky left-0 z-30 bg-gray-100 dark:bg-gray-700 p-2 border-b border-r border-gray-300 dark:border-gray-600 text-left min-w-[200px] shadow-sm">Staff Member</th>
                        {qualificationTypes.map(qt => (
                            <th key={qt.id} className="bg-gray-100 dark:bg-gray-700 p-2 border-b border-r border-gray-300 dark:border-gray-600 text-center min-w-[100px] text-xs font-bold" title={qt.name}>
                                {qt.code}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sortedDeptNames.map(deptName => (
                        <React.Fragment key={deptName}>
                            <tr className="bg-brand-primary/10 dark:bg-brand-primary/20">
                                <td
                                    colSpan={qualificationTypes.length + 1}
                                    className="p-2 font-bold text-brand-primary border-b border-gray-300 dark:border-gray-600 sticky left-0 z-10"
                                >
                                    {deptName}
                                </td>
                            </tr>
                            {Object.keys(groupedStaff[deptName]).sort().map(subDeptName => (
                                <React.Fragment key={subDeptName}>
                                    <tr className="bg-gray-50 dark:bg-gray-800">
                                        <td
                                            colSpan={qualificationTypes.length + 1}
                                            className="p-1 pl-6 text-sm font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800"
                                        >
                                            {subDeptName}
                                        </td>
                                    </tr>
                                    {groupedStaff[deptName][subDeptName]
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map(person => (
                                            <tr key={person.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 bg-white dark:bg-gray-900">
                                                <td className="sticky left-0 bg-white dark:bg-gray-900 p-2 border-b border-r border-gray-200 dark:border-gray-700 text-sm font-medium whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                    {person.name}
                                                </td>
                                                {qualificationTypes.map(qt => (
                                                    <td key={qt.id} className="p-0 h-10 border-b border-r border-gray-200 dark:border-gray-700 relative">
                                                        {renderCell(person, qt)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    }
                                </React.Fragment>
                            ))}
                        </React.Fragment>
                    ))}
                    {sortedDeptNames.length === 0 && (
                        <tr>
                            <td colSpan={qualificationTypes.length + 1} className="p-8 text-center text-gray-500">
                                No staff records found for your view scope.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

const CrewRecordsPage: React.FC = () => {
    const { staff, updateStaff, loading: appLoading, departments } = useStaff();
    const { qualificationTypes, loading: settingsLoading } = useSettings();
    const { examAttempts, exams, questions, loading: trainingLoading } = useTraining();

    const loading = appLoading || trainingLoading || settingsLoading;
    const { currentUser, can } = usePermissions();

    // Persist modal state
    const [isModalOpen, setIsModalOpen] = useLocalStorage<boolean>('crew_doc_modal_open', false);
    const [targetStaffId, setTargetStaffId] = useLocalStorage<string | null>('crew_target_staff_id', null);
    const [editingDocument, setEditingDocument] = useLocalStorage<StaffDocument | null>('crew_editing_doc', null);

    // View state persistence
    const [viewMode, setViewMode] = useLocalStorage<'grid' | 'list' | 'matrix'>('crew_view_mode', 'matrix');
    const [searchTerm, setSearchTerm] = useLocalStorage('crew_search', '');
    const [filterStatus, setFilterStatus] = useLocalStorage('crew_filter_status', 'all');

    // Persist context for the modal so we know which cell was clicked even after reload
    const [initialQualTypeId, setInitialQualTypeId] = useLocalStorage<string | null>('crew_initial_qual_type', null);

    const [selectedStaffId, setSelectedStaffId] = useLocalStorage<string>('crew_selected_staff_id', currentUser?.id || '');
    const [selectedDeptId, setSelectedDeptId] = useLocalStorage<string>('crew_selected_dept_id', 'all');

    // Viewers
    const [viewingDoc, setViewingDoc] = useState<StaffDocument | null>(null);
    const [internalViewingResult, setInternalViewingResult] = useState<{ exam: Exam, attempt: ExamAttempt, staffName: string } | null>(null);

    const canManageAll = can('staff:view');
    const canManageDept = can('staff:view:own_department');
    const canViewAll = canManageAll || canManageDept;

    const viewableStaff = useMemo(() => {
        if (!currentUser) return [];
        let list = [];
        if (canManageAll) list = staff.filter(s => s.roleId !== 'role_super_admin');
        else if (canManageDept) {
            list = staff.filter(s =>
                s.departmentId === currentUser.departmentId &&
                s.roleId !== 'role_admin' &&
                s.roleId !== 'role_super_admin'
            );
        } else {
            return staff.filter(s => s.id === currentUser.id);
        }
        return list.filter(s => s.accountStatus !== 'disabled');
    }, [staff, currentUser, canManageAll, canManageDept]);

    const filteredStaff = useMemo(() => {
        if (selectedDeptId === 'all') return viewableStaff;
        return viewableStaff.filter(s => s.departmentId === selectedDeptId);
    }, [viewableStaff, selectedDeptId]);

    // Sync selectedStaffId with permissions and filters
    useEffect(() => {
        if (filteredStaff.length > 0) {
            if (!selectedStaffId || !filteredStaff.some(s => s.id === selectedStaffId)) {
                setSelectedStaffId(filteredStaff[0].id);
            }
        }
    }, [filteredStaff, selectedStaffId, setSelectedStaffId]);

    const activeStaffForView = useMemo(() => {
        return staff.find(s => s.id === selectedStaffId) || currentUser;
    }, [staff, selectedStaffId, currentUser]);

    const myDocuments = useMemo(() => {
        if (!activeStaffForView) return [];
        let docs = (activeStaffForView.documents || []).sort((a, b) => {
            if (!a.expiryDate) return 1;
            if (!b.expiryDate) return -1;
            return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        });
        if (searchTerm) docs = docs.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (filterStatus !== 'all') docs = docs.filter(d => getExpiryStatus(d.expiryDate) === filterStatus);
        return docs;
    }, [activeStaffForView, searchTerm, filterStatus]);

    const stats = useMemo(() => {
        const docs = activeStaffForView?.documents || [];
        return {
            total: docs.length,
            expiring: docs.filter(d => getExpiryStatus(d.expiryDate) === 'expiring').length,
            expired: docs.filter(d => getExpiryStatus(d.expiryDate) === 'expired').length,
        }
    }, [activeStaffForView]);

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingDocument(null);
        setTargetStaffId(null);
        setInitialQualTypeId(null);
    };

    const handleSave = async (doc: StaffDocument) => {
        const sId = targetStaffId || selectedStaffId;
        if (!sId) return;

        const staffMember = staff.find(s => s.id === sId);
        if (!staffMember) return;

        const docs = [...(staffMember.documents || [])];
        const existingIndex = docs.findIndex(d => d.id === doc.id);

        if (existingIndex > -1) {
            docs[existingIndex] = doc;
        } else {
            docs.push(doc);
        }

        try {
            await updateStaff({ ...staffMember, documents: docs });
            handleCloseModal();
        } catch (err) {
            console.error("Save failed:", err);
            alert("Failed to save changes. Please try again.");
        }
    };

    const handleDelete = (docId: string) => {
        const sId = targetStaffId || selectedStaffId;
        if (!sId) return;
        const staffMember = staff.find(s => s.id === sId);
        if (!staffMember) return;
        if (!window.confirm('Are you sure you want to delete this document?')) return;

        const updatedDocs = (staffMember.documents || []).filter(d => d.id !== docId);
        updateStaff({ ...staffMember, documents: updatedDocs });
        handleCloseModal();
    };

    const handleMatrixCellClick = (sId: string, qId: string, existingDoc?: StaffDocument) => {
        if (currentUser?.id !== sId && !canManageAll && !(canManageDept && staff.find(s => s.id === sId)?.departmentId === currentUser?.departmentId)) {
            alert("You do not have permission to edit this staff member's records.");
            return;
        }
        setTargetStaffId(sId);
        if (existingDoc) {
            setEditingDocument(existingDoc);
            setInitialQualTypeId(null);
        } else {
            setEditingDocument(null);
            setInitialQualTypeId(qId);
        }
        setIsModalOpen(true);
    };

    const handleViewDocument = (doc: StaffDocument) => {
        // Detection for internal records (Exams/LPC/OPC Certificates)
        if (doc.documentUrl?.startsWith('#/exams/')) {
            // URL Format: #/exams/[examId]/result
            const parts = doc.documentUrl.split('/');
            const examId = parts[2];
            const exam = exams.find(e => e.id === examId);

            // Get attempt for the staff member this document belongs to
            const sId = selectedStaffId || currentUser?.id;
            const staffName = staff.find(s => s.id === sId)?.name || 'Unknown';
            const attempt = examAttempts
                .filter(a => a.examId === examId && a.staffId === sId)
                .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];

            if (exam && attempt) {
                setInternalViewingResult({ exam, attempt, staffName });
            } else {
                alert("System Record Error: The underlying exam data for this certificate could not be retrieved.");
            }
        } else {
            setViewingDoc(doc);
        }
    };

    React.useEffect(() => {
        if (!canViewAll && viewMode === 'matrix') setViewMode('grid');
    }, [canViewAll, viewMode, setViewMode]);

    if (loading) return <div className="p-8 text-center">Loading records...</div>;

    // Get target staff for modal context (e.g. DOB for EASA calc)
    const modalTargetStaff = staff.find(s => s.id === (targetStaffId || selectedStaffId));

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Training & Records</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage staff qualifications and compliance documents.</p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                    {canManageAll && (
                        <select
                            value={selectedDeptId}
                            onChange={(e) => setSelectedDeptId(e.target.value)}
                            className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded-md focus:ring-brand-primary focus:border-brand-primary p-2"
                        >
                            <option value="all">All Departments</option>
                            {departments.map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                        </select>
                    )}
                    {canViewAll && (
                        <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex text-sm">
                            <button onClick={() => setViewMode('matrix')} className={`px-4 py-1.5 rounded-md font-medium transition-all ${viewMode === 'matrix' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500 hover:text-gray-700'}`}>Training Matrix</button>
                            <button onClick={() => setViewMode('grid')} className={`px-4 py-1.5 rounded-md font-medium transition-all ${viewMode !== 'matrix' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500 hover:text-gray-700'}`}>Documents</button>
                        </div>
                    )}
                    <button
                        onClick={() => {
                            setTargetStaffId(selectedStaffId);
                            setEditingDocument(null);
                            setInitialQualTypeId(null);
                            setIsModalOpen(true);
                        }}
                        className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary transition-colors shadow-md flex items-center gap-2 text-sm font-bold"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Upload Doc
                    </button>
                </div>
            </div>

            {viewMode === 'matrix' && canViewAll ? (
                <TrainingMatrix staff={filteredStaff} departments={departments} qualificationTypes={qualificationTypes} onCellClick={handleMatrixCellClick} />
            ) : (
                <>
                    {/* Document Dashboard for Selected Staff */}
                    {activeStaffForView && activeStaffForView.id !== currentUser?.id && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-100 dark:border-blue-800 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span className="text-sm text-blue-800 dark:text-blue-200">
                                Viewing documents for: <strong>{activeStaffForView.name}</strong>
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-blue-500">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Total Documents</p>
                            <p className="text-3xl font-bold text-gray-800 dark:text-white">{stats.total}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-yellow-500">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Expiring Soon</p>
                            <p className="text-3xl font-bold text-yellow-600">{stats.expiring}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-red-500">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Expired</p>
                            <p className="text-3xl font-bold text-red-600">{stats.expired}</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl min-h-[500px]">
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b dark:border-gray-700 pb-4">
                            <div className="flex items-center gap-4">
                                <h2 className="text-lg font-bold">Documents</h2>
                                {canViewAll && (
                                    <select
                                        value={selectedStaffId}
                                        onChange={(e) => setSelectedStaffId(e.target.value)}
                                        className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-sm focus:ring-brand-primary focus:border-brand-primary max-w-[200px]"
                                    >
                                        {filteredStaff.sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <input type="text" placeholder="Search documents..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-64 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-brand-primary focus:border-brand-primary" />
                                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-brand-primary focus:border-brand-primary">
                                    <option value="all">All Statuses</option>
                                    <option value="valid">Valid</option>
                                    <option value="expiring">Expiring Soon</option>
                                    <option value="expired">Expired</option>
                                    <option value="permanent">Permanent</option>
                                </select>
                                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-md">
                                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500 hover:text-gray-700'}`} title="Grid View">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    </button>
                                    <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500 hover:text-gray-700'}`} title="List View">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {myDocuments.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="inline-block p-4 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400">No documents found matching your filters.</p>
                            </div>
                        ) : (
                            <>
                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {myDocuments.map(doc => (
                                            <DocumentCard
                                                key={doc.id}
                                                doc={doc}
                                                canManage={true}
                                                onEdit={() => { setTargetStaffId(selectedStaffId); setEditingDocument(doc); setIsModalOpen(true); }}
                                                onDelete={() => handleDelete(doc.id)}
                                                onView={() => handleViewDocument(doc)}
                                                typeName={qualificationTypes.find(q => q.id === doc.qualificationTypeId)?.name}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-600 text-xs uppercase font-bold text-gray-500">
                                                <tr>
                                                    <th className="p-3">Type</th>
                                                    <th className="p-3">Document Name</th>
                                                    <th className="p-3">Status</th>
                                                    <th className="p-3">Issue Date</th>
                                                    <th className="p-3">Expiry Date</th>
                                                    <th className="p-3">Restrictions</th>
                                                    <th className="p-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {myDocuments.map(doc => {
                                                    const status = getExpiryStatus(doc.expiryDate);
                                                    const typeName = qualificationTypes.find(q => q.id === doc.qualificationTypeId)?.code || '-';
                                                    const statusStyles = {
                                                        valid: 'bg-green-100 text-green-800',
                                                        expiring: 'bg-yellow-100 text-yellow-800',
                                                        expired: 'bg-red-100 text-red-800',
                                                        permanent: 'bg-blue-100 text-blue-800',
                                                    };
                                                    // Re-check file existence for list view too
                                                    const hasFile = typeof doc.documentUrl === 'string' && doc.documentUrl.trim().length > 0 && doc.documentUrl !== 'null' && doc.documentUrl !== 'undefined';

                                                    return (
                                                        <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                            <td className="p-3 text-xs font-bold text-gray-500">{typeName}</td>
                                                            <td className="p-3 font-medium">{doc.name}</td>
                                                            <td className="p-3"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusStyles[status]}`}>{status.replace('_', ' ')}</span></td>
                                                            <td className="p-3 text-xs">{new Date(doc.issueDate + 'T00:00:00Z').toLocaleDateString('en-GB')}</td>
                                                            <td className="p-3 text-xs">
                                                                {doc.expiryDate ? new Date(doc.expiryDate + 'T00:00:00Z').toLocaleDateString('en-GB') : 'Permanent'}
                                                            </td>
                                                            <td className="p-3 text-xs text-orange-600 font-bold">
                                                                {doc.restrictions || '-'}
                                                            </td>
                                                            <td className="p-3 text-right space-x-3">
                                                                {hasFile ? (
                                                                    <button
                                                                        onClick={() => handleViewDocument(doc)}
                                                                        className="text-blue-600 hover:underline text-xs font-bold"
                                                                    >
                                                                        View
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-gray-400 text-[10px] italic">No file</span>
                                                                )}
                                                                <button onClick={() => { setTargetStaffId(selectedStaffId); setEditingDocument(doc); setIsModalOpen(true); }} className="text-brand-primary hover:underline text-xs font-bold">Edit</button>
                                                                <button onClick={() => handleDelete(doc.id)} className="text-red-500 hover:underline text-xs font-bold">Delete</button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}

            {isModalOpen && (
                <StaffDocumentModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    existingDocument={editingDocument}
                    initialQualificationTypeId={initialQualTypeId || undefined}
                    staffDob={modalTargetStaff?.hrData?.personal?.dob}
                />
            )}

            {/* Document Viewer Modal (For external files) */}
            {viewingDoc && (
                <DocumentViewerModal
                    isOpen={!!viewingDoc}
                    onClose={() => setViewingDoc(null)}
                    documentUrl={viewingDoc.documentUrl}
                    documentName={viewingDoc.name}
                />
            )}

            {/* Internal Record Viewer (For Exam/LPC/OPC certificates) */}
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

export default CrewRecordsPage;
