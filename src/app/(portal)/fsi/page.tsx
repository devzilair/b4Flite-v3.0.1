
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { FsiDocument, FsiPriority } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import FsiEditorModal from '@/components/fsi/FsiEditorModal';
import { useStaff } from '@/hooks/useStaff';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useFsi } from '@/hooks/useFsi';

const PriorityBadge: React.FC<{ priority: FsiPriority }> = ({ priority }) => {
    const styles = {
        low: 'bg-gray-100 text-gray-700 border-gray-200',
        normal: 'bg-blue-50 text-blue-700 border-blue-100',
        high: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        critical: 'bg-red-50 text-red-700 border-red-200 animate-pulse',
    };
    return (
        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${styles[priority] || styles.normal}`}>
            {priority}
        </span>
    );
};

const FsiPage: React.FC = () => {
    const { staff, departments, loading: appLoading } = useStaff();
    const { fsiDocuments, fsiAcks, addFsiDoc, updateFsiDoc, deleteFsiDoc, loading: fsiLoading } = useFsi();
    const loading = appLoading || fsiLoading;

    const { currentUser, can } = usePermissions();

    const [searchTerm, setSearchTerm] = useState('');
    const [ackFilter, setAckFilter] = useState<'all' | 'acknowledged' | 'pending'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [isManaging, setIsManaging] = useLocalStorage<boolean>('fsi_manage_mode', false);

    // Persist modal state
    const [isEditorOpen, setIsEditorOpen] = useLocalStorage<boolean>('fsi_editor_open', false);
    const [editingDocument, setEditingDocument] = useLocalStorage<FsiDocument | null>('fsi_editing_doc', null);

    const canManage = can('fsi:manage') || can('fsi:manage:own_department');
    const canManageGlobal = can('fsi:manage');

    const userAcknowledgments = useMemo(() => new Set(
        fsiAcks
            .filter(ack => ack.staffId === currentUser?.id)
            .map(ack => ack.documentId)
    ), [fsiAcks, currentUser]);

    const departmentMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);

    const availableCategories = useMemo(() => {
        const cats = new Set(fsiDocuments.map(d => d.category || 'General'));
        return Array.from(cats).sort();
    }, [fsiDocuments]);

    const documentsWithProgress = useMemo(() => {
        return fsiDocuments.map(doc => {
            let assignedStaffList: typeof staff;

            if (doc.departmentId) {
                if (doc.assignedTo === 'all_in_department') {
                    assignedStaffList = staff.filter(s => s.departmentId === doc.departmentId);
                } else if (Array.isArray(doc.assignedTo)) {
                    const assignedIds = new Set(doc.assignedTo);
                    assignedStaffList = staff.filter(s => assignedIds.has(s.id));
                } else {
                    assignedStaffList = [];
                }
            } else {
                assignedStaffList = staff;
            }

            // Filter out admins/super admins from the denominator for accurate operational progress
            assignedStaffList = assignedStaffList.filter(s => s.roleId !== 'role_admin' && s.roleId !== 'role_super_admin');

            const acknowledgedCount = assignedStaffList.filter(p =>
                fsiAcks.some(ack => ack.documentId === doc.id && ack.staffId === p.id)
            ).length;

            const progress = assignedStaffList.length > 0 ? (acknowledgedCount / assignedStaffList.length) * 100 : 100;
            return { ...doc, progress, assignedCount: assignedStaffList.length, acknowledgedCount };
        });
    }, [fsiDocuments, fsiAcks, staff]);

    const filteredDocuments = useMemo(() => {
        return documentsWithProgress.filter(doc => {
            if (isManaging) {
                if (!canManageGlobal && doc.departmentId && doc.departmentId !== currentUser?.departmentId) {
                    return false;
                }
            } else {
                if (doc.status !== 'published') return false;

                // --- VISIBILITY LOGIC START ---
                // 1. Global Document (No Department ID) -> Visible to All
                if (!doc.departmentId) {
                    // Logic allows global docs to flow through
                }
                // 2. Department Document -> Must match user's department
                else if (doc.departmentId === currentUser?.departmentId) {
                    // 2a. If specifically assigned to a subset, user MUST be in that subset
                    if (Array.isArray(doc.assignedTo)) {
                        if (!doc.assignedTo.includes(currentUser?.id || '')) return false;
                    }
                    // 2b. If assigned to 'all_in_department', it passes
                }
                // 3. Wrong Department -> Hidden
                else {
                    return false;
                }
                // --- VISIBILITY LOGIC END ---
            }

            const searchMatch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) || (doc.documentNumber || '').toLowerCase().includes(searchTerm.toLowerCase());

            const isAcknowledged = userAcknowledgments.has(doc.id);
            const ackMatch = ackFilter === 'all'
                || (ackFilter === 'acknowledged' && isAcknowledged)
                || (ackFilter === 'pending' && !isAcknowledged);

            const catMatch = categoryFilter === 'all' || (doc.category || 'General') === categoryFilter;

            return searchMatch && ackMatch && catMatch;
        }).sort((a, b) => {
            // Sort critical/high pending first for staff
            if (!isManaging) {
                const priorityWeight = { critical: 3, high: 2, normal: 1, low: 0 };
                const pA = priorityWeight[a.priority || 'normal'];
                const pB = priorityWeight[b.priority || 'normal'];
                if (pA !== pB) return pB - pA;
            }
            return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
        });
    }, [documentsWithProgress, searchTerm, ackFilter, categoryFilter, userAcknowledgments, isManaging, canManageGlobal, currentUser]);

    const handleSaveDocument = async (docToSave: FsiDocument, resetAcknowledgments?: boolean) => {
        try {
            await updateFsiDoc(docToSave, resetAcknowledgments);
            setIsEditorOpen(false);
            setEditingDocument(null);
        } catch (error: any) {
            console.error("Failed to save FSI document:", error);
            const msg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
            alert(`Failed to save document: ${msg}`);
        }
    };

    const handleDeleteDocument = async (docId: string) => {
        if (window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
            try {
                await deleteFsiDoc(docId);
            } catch (error: any) {
                console.error("Failed to delete FSI document:", error);
                const msg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
                alert(`Failed to delete document: ${msg}`);
            }
        }
    };

    if (loading) {
        return <div>Loading documents...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Notices & Memos</h1>
                {canManage && (
                    <div className="flex items-center gap-4">
                        <button onClick={() => { setEditingDocument(null); setIsEditorOpen(true); }} className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary">
                            + New Document
                        </button>
                        <label className="flex items-center cursor-pointer">
                            <span className="mr-3 text-sm font-medium">Manage Documents</span>
                            <div className="relative">
                                <input type="checkbox" checked={isManaging} onChange={e => setIsManaging(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-primary"></div>
                            </div>
                        </label>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input
                        type="text"
                        placeholder="Search by title or number..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                    />
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                    >
                        <option value="all">All Categories</option>
                        {(availableCategories as string[]).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <select
                        value={ackFilter}
                        onChange={e => setAckFilter(e.target.value as any)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                    >
                        <option value="all">All Statuses</option>
                        <option value="acknowledged">Acknowledged</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 text-xs uppercase text-gray-500 font-semibold">
                            <tr>
                                <th className="p-4">Document</th>
                                <th className="p-4">Reference & Date</th>
                                <th className="p-4">Category</th>
                                <th className="p-4">Status</th>
                                {isManaging && <th className="p-4 w-1/4">Acknowledgment Progress</th>}
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredDocuments.map(doc => {
                                const isAcknowledged = userAcknowledgments.has(doc.id);
                                const deptName = doc.departmentId ? departmentMap.get(doc.departmentId) : 'Global';
                                return (
                                    <tr key={doc.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group ${!isAcknowledged && !isManaging && doc.priority === 'critical' ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <PriorityBadge priority={doc.priority || 'normal'} />
                                                <Link href={`/fsi/${doc.id}`} className="font-bold text-base text-brand-primary hover:underline">
                                                    {doc.title}
                                                </Link>
                                            </div>
                                            {isManaging && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wide ${doc.departmentId ? 'bg-purple-100 text-purple-800' : 'bg-gray-200 text-gray-600'}`}>
                                                    {deptName}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                                            <div className="font-medium">{doc.documentNumber || 'N/A'}</div>
                                            <div className="text-xs text-gray-500">Rev. {doc.revision} • {new Date(doc.issueDate + 'T00:00:00Z').toLocaleDateString()}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                                {doc.category || 'General'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-2 items-start">
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${doc.status === 'published' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-800'
                                                    }`}>
                                                    {doc.status}
                                                </span>
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${isAcknowledged ? 'bg-status-success/20 text-status-success' : 'bg-status-warning/20 text-status-warning'
                                                    }`}>
                                                    {isAcknowledged ? 'Acknowledged' : 'Pending'}
                                                </span>
                                            </div>
                                        </td>
                                        {isManaging && (
                                            <td className="p-4">
                                                <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                                    <span>{Math.round(doc.progress)}%</span>
                                                    <span className="text-gray-400">{doc.acknowledgedCount} / {doc.assignedCount}</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                                                    <div className="bg-brand-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${doc.progress}%` }}></div>
                                                </div>
                                            </td>
                                        )}
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-4 opacity-70 group-hover:opacity-100 transition-opacity">
                                                <Link href={`/fsi/${doc.id}/print`} title="Print" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                                                    </svg>
                                                </Link>
                                                {isManaging && (
                                                    <>
                                                        <button onClick={() => { setEditingDocument(doc); setIsEditorOpen(true); }} className="text-sm font-medium text-brand-primary hover:underline">Edit</button>
                                                        <button onClick={() => handleDeleteDocument(doc.id)} className="text-sm font-medium text-status-danger hover:underline">Delete</button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {filteredDocuments.length === 0 && (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow-md col-span-full border dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400">No documents found matching your criteria.</p>
                </div>
            )}

            {isEditorOpen && (
                <FsiEditorModal
                    isOpen={isEditorOpen}
                    onClose={() => setIsEditorOpen(false)}
                    onSave={handleSaveDocument}
                    existingDocument={editingDocument}
                />
            )}
        </div>
    );
};

export default FsiPage;
