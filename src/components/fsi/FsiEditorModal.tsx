
import React, { useState, useEffect, useMemo } from 'react';
import { FsiDocument, Staff, Department, FsiPriority } from '../../types';
import { sanitizeString, getErrorMessage } from '../../utils/sanitization';
import { usePermissions } from '../../hooks/usePermissions';
import { uploadFile } from '../../services/api';
import useLocalStorage from '../../hooks/useLocalStorage';
import { useStaff } from '../../hooks/useStaff';

interface FsiEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (document: FsiDocument, resetAcknowledgments?: boolean) => void;
    existingDocument: FsiDocument | null;
}

const CATEGORIES = ['Safety', 'Operations', 'Training', 'HR', 'General', 'FSI', 'NOTAM'];

const FsiEditorModal: React.FC<FsiEditorModalProps> = ({ isOpen, onClose, onSave, existingDocument }) => {
    const { staff, departments } = useStaff();
    const { currentUser, can } = usePermissions();
    const canManageGlobal = can('fsi:manage');
    
    // Persist draft in local storage
    const [doc, setDoc] = useLocalStorage<Partial<FsiDocument>>('draft_fsi_doc', {});
    const [assignmentType, setAssignmentType] = useState<'all_in_department' | 'specific'>('all_in_department');
    const [uploading, setUploading] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);
    const [isMajorRevision, setIsMajorRevision] = useState(false);

    useEffect(() => {
        if (existingDocument) {
            setDoc(existingDocument);
            if (Array.isArray(existingDocument.assignedTo)) {
                setAssignmentType('specific');
            } else {
                setAssignmentType('all_in_department');
            }
            // Reset major revision toggle on open
            setIsMajorRevision(false);
        } else {
            // New Document Mode
            if (doc.id && !doc.title) {
                 // Defaults for new document if draft is empty or stale
                setDoc({
                    title: '',
                    documentNumber: '',
                    revision: 1,
                    issueDate: new Date().toISOString().split('T')[0],
                    content: '',
                    assignedTo: 'all_in_department',
                    status: 'draft',
                    departmentId: canManageGlobal ? '' : currentUser?.departmentId,
                    documentUrl: '',
                    priority: 'normal',
                    category: 'General'
                });
                setAssignmentType('all_in_department');
            } else if (!doc.issueDate) {
                 // Ensure basic structure exists
                 setDoc(prev => ({
                     ...prev,
                     issueDate: new Date().toISOString().split('T')[0],
                     revision: 1,
                     status: 'draft',
                     assignedTo: 'all_in_department',
                     departmentId: canManageGlobal ? '' : currentUser?.departmentId,
                     priority: 'normal',
                     category: 'General'
                 }));
            }
        }
        setFileError(null);
    }, [existingDocument, isOpen, canManageGlobal, currentUser]);

    // Check if content changed to auto-suggest major revision
    useEffect(() => {
        if (existingDocument) {
             const contentChanged = doc.content !== existingDocument.content || doc.documentUrl !== existingDocument.documentUrl;
             if (contentChanged && !isMajorRevision) {
                 setIsMajorRevision(true);
             }
        }
    }, [doc.content, doc.documentUrl, existingDocument]);

    if (!isOpen) return null;
    
    const staffInSelectedDept = useMemo(() => {
        if (!doc.departmentId) return [];
        // Filter staff by department AND exclude admins/super admins
        return staff.filter(s => s.departmentId === doc.departmentId && s.roleId !== 'role_admin' && s.roleId !== 'role_super_admin');
    }, [doc.departmentId, staff]);

    const showAssignmentOptions = !!doc.departmentId;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let nextRevision = doc.revision || 1;
        if (existingDocument && isMajorRevision) {
             nextRevision = (existingDocument.revision || 0) + 1;
        }

        const finalDoc: FsiDocument = {
            id: existingDocument?.id || `fsi_${Date.now()}`,
            title: sanitizeString(doc.title) || 'Untitled',
            documentNumber: sanitizeString(doc.documentNumber) || 'N/A',
            revision: nextRevision,
            issueDate: doc.issueDate || new Date().toISOString().split('T')[0],
            content: doc.content || '',
            status: doc.status || 'draft',
            assignedTo: showAssignmentOptions 
                ? (assignmentType === 'all_in_department' ? 'all_in_department' : (doc.assignedTo as string[] || []))
                : 'all_in_department', // For global docs, this is ignored, but needs a value
            departmentId: doc.departmentId === '' ? undefined : doc.departmentId,
            documentUrl: doc.documentUrl,
            priority: doc.priority || 'normal',
            category: doc.category || 'General'
        };

        const shouldReset = existingDocument && isMajorRevision && finalDoc.status === 'published';
        
        if (shouldReset && !window.confirm(`You have marked this as a Major Revision (Rev ${nextRevision}).\n\nThis will INVALIDATE all existing acknowledgments for this document, forcing staff to re-sign.\n\nProceed?`)) {
             return;
        }

        onSave(finalDoc, shouldReset || false);
        
        // Clear draft on successful save if it was a new doc
        if (!existingDocument) {
            setDoc({});
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        setDoc(prev => {
            const newDoc = { ...prev };
            switch(name) {
                case 'title':
                    newDoc.title = value;
                    break;
                case 'documentNumber':
                    newDoc.documentNumber = value;
                    break;
                case 'issueDate':
                    newDoc.issueDate = value;
                    break;
                case 'content':
                    newDoc.content = value;
                    break;
                case 'departmentId':
                    newDoc.departmentId = value;
                    // Reset assignment when department changes
                    newDoc.assignedTo = 'all_in_department';
                    setAssignmentType('all_in_department');
                    break;
                case 'revision':
                    newDoc.revision = parseInt(value, 10) || 0;
                    break;
                case 'status':
                    newDoc.status = value as FsiDocument['status'];
                    break;
                case 'priority':
                    newDoc.priority = value as FsiPriority;
                    break;
                case 'category':
                    newDoc.category = value;
                    break;
            }
            return newDoc;
        });
    };

    const handleStaffAssignmentChange = (staffId: string, isChecked: boolean) => {
        setDoc(prev => {
            const currentAssigned = (Array.isArray(prev.assignedTo) ? prev.assignedTo : []) as string[];
            if (isChecked) {
                return { ...prev, assignedTo: [...currentAssigned, staffId] };
            } else {
                return { ...prev, assignedTo: currentAssigned.filter(id => id !== staffId) };
            }
        });
    };
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setUploading(true);
            setFileError(null);
            try {
                const publicUrl = await uploadFile(file);
                setDoc(prev => ({ ...prev, documentUrl: publicUrl }));
            } catch (error: any) {
                console.error("File upload failed:", error);
                setFileError(getErrorMessage(error));
            } finally {
                setUploading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center sm:p-4" /* No onClick close */>
            <div className="bg-white dark:bg-gray-800 sm:rounded-lg shadow-2xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                    <h2 className="text-2xl font-bold">{existingDocument ? 'Edit Document' : 'Create New Document'}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl">&times;</button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-y-auto p-6 space-y-4">
                    {/* Form fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="md:col-span-2">
                            <label className="block text-sm font-medium">Title</label>
                            <input type="text" name="title" value={doc.title || ''} onChange={handleInputChange} required className="mt-1 form-input font-bold" />
                        </div>
                        {canManageGlobal && (
                            <div>
                                <label className="block text-sm font-medium">Department</label>
                                <select name="departmentId" value={doc.departmentId || ''} onChange={handleInputChange} className="mt-1 form-input">
                                    <option value="">Global (All Departments)</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                             <label className="block text-sm font-medium">Category</label>
                             <select name="category" value={doc.category || 'General'} onChange={handleInputChange} className="mt-1 form-input">
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                        </div>
                    </div>
                    
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Priority Level</label>
                            <select name="priority" value={doc.priority || 'normal'} onChange={handleInputChange} className="form-input">
                                <option value="low">Low</option>
                                <option value="normal">Normal</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Doc Number</label>
                            <input type="text" name="documentNumber" value={doc.documentNumber || ''} onChange={handleInputChange} className="form-input" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Revision</label>
                            <input type="number" name="revision" value={doc.revision || ''} onChange={handleInputChange} className="form-input bg-gray-100 dark:bg-gray-700" disabled={existingDocument && isMajorRevision} />
                        </div>
                         <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Issue Date</label>
                            <input type="date" name="issueDate" value={doc.issueDate || ''} onChange={handleInputChange} required className="form-input" />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium">Upload Attachment (PDF/Image)</label>
                         <input 
                            type="file" 
                            onChange={handleFileChange} 
                            className="mt-1 block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-md file:border-0
                                file:text-sm file:font-semibold
                                file:bg-brand-light file:text-brand-primary
                                hover:file:bg-blue-100 dark:file:bg-gray-700 dark:file:text-gray-300
                            "
                        />
                        {uploading && <p className="text-sm text-blue-500 mt-1">Uploading...</p>}
                        {fileError && <p className="text-sm text-red-500 mt-1">{fileError}</p>}
                        {doc.documentUrl && !uploading && (
                            <p className="text-xs text-green-600 mt-1 truncate">
                                Attached: <a href={doc.documentUrl} target="_blank" rel="noopener noreferrer" className="underline">View File</a>
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Content (Markdown supported)</label>
                        <textarea name="content" value={doc.content || ''} onChange={handleInputChange} rows={8} className="mt-1 form-input font-mono text-sm" />
                    </div>

                    {existingDocument && (
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md">
                            <label className="flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={isMajorRevision} 
                                    onChange={e => setIsMajorRevision(e.target.checked)} 
                                    className="h-5 w-5 text-orange-600 rounded border-orange-300 focus:ring-orange-500"
                                />
                                <div className="ml-3">
                                    <span className="block text-sm font-bold text-orange-800 dark:text-orange-200">Major Revision (Rev {existingDocument.revision ? existingDocument.revision + 1 : 2})</span>
                                    <span className="block text-xs text-orange-700 dark:text-orange-300">
                                        Check this if content has changed significantly. This will <strong>reset all signatures</strong> and require staff to acknowledge the new version.
                                    </span>
                                </div>
                            </label>
                        </div>
                    )}

                    {showAssignmentOptions && (
                         <div className="border-t dark:border-gray-600 mt-4 pt-4">
                             <h3 className="text-lg font-semibold mb-2">Assign To</h3>
                             <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 mb-2">
                                <label className="flex items-center">
                                    <input type="radio" name="assignmentType" value="all_in_department" checked={assignmentType === 'all_in_department'} onChange={() => { setAssignmentType('all_in_department'); setDoc(prev => ({...prev, assignedTo: 'all_in_department'})); }} />
                                    <span className="ml-2">All staff in department</span>
                                </label>
                                <label className="flex items-center">
                                    <input type="radio" name="assignmentType" value="specific" checked={assignmentType === 'specific'} onChange={() => { setAssignmentType('specific'); setDoc(prev => ({...prev, assignedTo: []})); }} />
                                    <span className="ml-2">Specific staff</span>
                                </label>
                             </div>
                             {assignmentType === 'specific' && (
                                <div className="p-3 border dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 max-h-48 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {staffInSelectedDept.map(s => (
                                        <label key={s.id} className="flex items-center">
                                            <input type="checkbox" checked={(doc.assignedTo as string[] || []).includes(s.id)} onChange={(e) => handleStaffAssignmentChange(s.id, e.target.checked)} className="form-checkbox"/>
                                            <span className="ml-2 text-sm">{s.name}</span>
                                        </label>
                                    ))}
                                </div>
                             )}
                         </div>
                    )}
                </form>
                
                <div className="p-6 border-t dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 sm:rounded-b-lg flex justify-between items-center">
                    <div className="w-1/2 pr-4">
                         <label className="block text-sm font-medium mb-1">Status</label>
                         <select name="status" value={doc.status || 'draft'} onChange={handleInputChange} className="w-full form-input">
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 py-2 px-4 rounded-md">Cancel</button>
                        <button type="button" onClick={handleSubmit} disabled={uploading} className="bg-brand-primary text-white py-2 px-6 rounded-md disabled:opacity-50">Save</button>
                    </div>
                </div>
                
                 <style>{`
                    .form-input { display: block; width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; background-color: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 0.375rem; }
                    .dark .form-input { color: #D1D5DB; background-color: #374151; border-color: #4B5563; }
                    .form-checkbox { height: 1rem; width: 1rem; color: #0D47A1; border-radius: 0.25rem; border-color: #9CA3AF; }
                `}</style>
            </div>
        </div>
    );
};

export default FsiEditorModal;
