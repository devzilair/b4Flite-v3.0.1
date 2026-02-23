
import React, { useState, useEffect, useMemo } from 'react';
import { StaffDocument } from '@/types';
import { sanitizeString, getErrorMessage } from '@/utils/sanitization';
import { uploadFile } from '@/services/api';
import { useSettings } from '@/hooks/useSettings';
import useLocalStorage from '@/hooks/useLocalStorage';
import { StaffDocumentSchema } from '@/schemas';

interface StaffDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (document: StaffDocument) => void;
    onDelete?: (docId: string) => void;
    existingDocument: StaffDocument | null;
    initialQualificationTypeId?: string;
    staffDob?: string; // Needed for EASA calculations
}

// Common EASA Medical Limitations
const MEDICAL_LIMITATIONS = [
    { code: 'TML', label: 'Time Limitation (Reduced Validity)' },
    { code: 'VDL', label: 'Corrective Lenses (Distant)' },
    { code: 'VML', label: 'Corrective Lenses (Multifocal)' },
    { code: 'VNL', label: 'Corrective Lenses (Near)' },
    { code: 'VDSL', label: 'Corrective Lenses (All Distances)' },
    { code: 'OML', label: 'Operational Multi-pilot Limitation' },
    { code: 'OCL', label: 'Operational Co-pilot Limitation' },
    { code: 'OSL', label: 'Operational Safety Pilot Limitation' },
    { code: 'SSL', label: 'Special Restriction' }
];

const StaffDocumentModal: React.FC<StaffDocumentModalProps> = ({ isOpen, onClose, onSave, onDelete, existingDocument, initialQualificationTypeId, staffDob }) => {
    const today = new Date().toISOString().split('T')[0];
    const [doc, setDoc] = useLocalStorage<Partial<StaffDocument>>('staff_doc_draft', {});
    const [uploading, setUploading] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [neverExpires, setNeverExpires] = useState(false);

    // Preview State
    const [localPreview, setLocalPreview] = useState<string | null>(null);
    const [previewType, setPreviewType] = useState<'image' | 'pdf' | 'none'>('none');

    // EASA Calc State
    const [isSinglePilotCat, setIsSinglePilotCat] = useState(false);

    const { qualificationTypes } = useSettings();

    const getNewDocDefaults = () => {
        const initialType = initialQualificationTypeId || '';
        let initialName = '';
        let initialExpiry = today;

        if (initialType) {
            const qt = qualificationTypes.find(q => q.id === initialType);
            if (qt) {
                initialName = qt.name;
                // Default logic (simple months addition), superseded by EASA logic if applicable
                const expiry = new Date(today);
                expiry.setMonth(expiry.getMonth() + qt.validityMonths);
                expiry.setDate(expiry.getDate() - 1);
                initialExpiry = expiry.toISOString().split('T')[0];
            }
        }

        return {
            name: initialName,
            documentUrl: '',
            issueDate: today,
            expiryDate: initialExpiry,
            qualificationTypeId: initialType,
            restrictions: '',
        };
    };

    // Robust synchronization: Always update internal state when modal opens
    useEffect(() => {
        if (!isOpen) {
            // Cleanup local object URL to avoid memory leaks
            if (localPreview) {
                URL.revokeObjectURL(localPreview);
                setLocalPreview(null);
            }
            return;
        }

        if (existingDocument) {
            setDoc(existingDocument);
            setNeverExpires(!existingDocument.expiryDate);
        } else {
            const defaults = getNewDocDefaults();
            // Only overwrite if currently editing an old doc or if draft is completely empty
            if (doc.id || (!doc.name && !doc.issueDate) || (initialQualificationTypeId && doc.qualificationTypeId !== initialQualificationTypeId)) {
                setDoc(defaults);
                setNeverExpires(false);
            }
        }
        setFileError(null);
        setValidationErrors([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, existingDocument, initialQualificationTypeId, qualificationTypes]);

    // Determine active preview URL and type
    const activeUrl = localPreview || doc.documentUrl;

    useEffect(() => {
        if (!activeUrl) {
            setPreviewType('none');
            return;
        }

        // Simple heuristic
        const lowerUrl = activeUrl.toLowerCase();
        if (lowerUrl.includes('.pdf') || activeUrl.startsWith('blob:')) {
            // Blobs from file input might not have extension, but we set it in handleFileChange if possible. 
            // Ideally we assume PDF or Image. For blobs we rely on handleFileChange setting explicit type if possible, 
            // or check here.
            if (lowerUrl.includes('application/pdf') || lowerUrl.endsWith('.pdf')) {
                setPreviewType('pdf');
            } else if (/\.(jpg|jpeg|png|webp|gif)/.test(lowerUrl) || lowerUrl.includes('image/')) {
                setPreviewType('image');
            } else {
                // Fallback for blobs where we might not know from URL string
                setPreviewType('none');
            }
        }
    }, [activeUrl]);


    // Detect if this is a medical document based on the selected Type Name
    const isMedical = useMemo(() => {
        const typeId = doc.qualificationTypeId;
        if (!typeId) return false;
        const qt = qualificationTypes.find(q => q.id === typeId);
        if (!qt) return false;
        const name = qt.name.toLowerCase();
        return name.includes('medical') || name.includes('med class');
    }, [doc.qualificationTypeId, qualificationTypes]);

    if (!isOpen) return null;

    // --- EASA LOGIC ---
    const calculateEasaExpiry = () => {
        if (!staffDob) {
            alert("Staff Date of Birth is missing. Please update their HR profile first.");
            return;
        }
        if (!doc.issueDate) return;

        const issue = new Date(doc.issueDate);
        const dob = new Date(staffDob);

        // Calculate age at time of examination (issue date)
        let age = issue.getFullYear() - dob.getFullYear();
        const m = issue.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && issue.getDate() < dob.getDate())) {
            age--;
        }

        // Determine validity based on class (basic logic)
        // If it's medical, we assume Class 1 standard for professional pilots unless 'Class 2' is in name
        const qt = qualificationTypes.find(q => q.id === doc.qualificationTypeId);
        const typeName = (qt?.name || '').toLowerCase();

        let validityMonths = 12; // Default Class 1

        const isClass2 = typeName.includes('class 2');
        const isLAPL = typeName.includes('lapl');

        if (!isClass2 && !isLAPL) {
            // EASA Class 1 Rules
            if (isSinglePilotCat && age >= 40) {
                validityMonths = 6;
            } else if (age >= 60) {
                validityMonths = 6;
            } else {
                validityMonths = 12;
            }
        } else if (isClass2) {
            // EASA Class 2 Rules
            if (age < 40) validityMonths = 60;
            else if (age < 50) validityMonths = 24;
            else validityMonths = 12;
        } else if (isLAPL) {
            // LAPL Rules
            if (age < 40) validityMonths = 60;
            else validityMonths = 24;
        }

        const expiry = new Date(issue);
        expiry.setMonth(expiry.getMonth() + validityMonths);
        // EASA medicals expire at the end of the period
        expiry.setDate(expiry.getDate() - 1);

        setDoc(prev => ({ ...prev, expiryDate: expiry.toISOString().split('T')[0] }));
        setNeverExpires(false);
    };

    const handleToggleLimitation = (code: string) => {
        setDoc(prev => {
            const currentStr = prev.restrictions || '';
            const currentArr = currentStr.split(',').map(s => s.trim()).filter(Boolean);

            let newArr;
            if (currentArr.includes(code)) {
                newArr = currentArr.filter(c => c !== code);
            } else {
                newArr = [...currentArr, code];
            }

            return { ...prev, restrictions: newArr.join(', ') };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setValidationErrors([]);

        const payload = {
            ...doc,
            name: sanitizeString(doc.name),
            documentUrl: doc.documentUrl || '',
            issueDate: doc.issueDate || today,
            expiryDate: neverExpires ? null : (doc.expiryDate || today),
            restrictions: sanitizeString(doc.restrictions),
        };

        const result = StaffDocumentSchema.safeParse(payload);
        if (!result.success) {
            setValidationErrors(result.error.errors.map(err => err.message));
            return;
        }

        const docToSave: StaffDocument = {
            id: existingDocument?.id || `doc_${Date.now()}`,
            name: result.data.name || 'Document',
            documentUrl: result.data.documentUrl || '',
            issueDate: result.data.issueDate || today,
            ...result.data,
            qualificationTypeId: doc.qualificationTypeId || undefined,
            restrictions: doc.restrictions,
        };

        onSave(docToSave);
        if (!existingDocument) {
            setDoc({});
            setNeverExpires(false);
            setLocalPreview(null);
        }
    };

    const handleTypeChange = (typeId: string) => {
        const qt = qualificationTypes.find(q => q.id === typeId);
        setDoc(prev => {
            const newDoc = { ...prev, qualificationTypeId: typeId };
            if (qt) {
                if (!prev.name || (prev.qualificationTypeId && prev.name === qualificationTypes.find(q => q.id === prev.qualificationTypeId)?.name)) {
                    newDoc.name = qt.name;
                }
                // Only set default expiry if we haven't manually calculated one yet
                if (!prev.expiryDate) {
                    const issue = new Date(prev.issueDate || today);
                    const expiry = new Date(issue);
                    expiry.setMonth(expiry.getMonth() + qt.validityMonths);
                    expiry.setDate(expiry.getDate() - 1);
                    newDoc.expiryDate = expiry.toISOString().split('T')[0];
                }
                setNeverExpires(false);
            }
            return newDoc;
        });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'qualificationTypeId') {
            handleTypeChange(value);
        } else if (name === 'issueDate') {
            // Update issue date
            setDoc(prev => {
                const newDoc = { ...prev, [name]: value };

                // Smart Calc: Auto-update expiry based on new Issue Date + Validity (if not neverExpires)
                if (value && newDoc.qualificationTypeId && !neverExpires) {
                    const qt = qualificationTypes.find(q => q.id === newDoc.qualificationTypeId);
                    if (qt && qt.validityMonths > 0) {
                        try {
                            const issue = new Date(value);
                            const expiry = new Date(issue);
                            expiry.setMonth(expiry.getMonth() + qt.validityMonths);
                            expiry.setDate(expiry.getDate() - 1);
                            newDoc.expiryDate = expiry.toISOString().split('T')[0];
                        } catch (err) {
                            // Invalid date, skip calc
                        }
                    }
                }
                return newDoc;
            });
        } else {
            setDoc(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleNeverExpiresChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setNeverExpires(checked);
        if (checked) {
            setDoc(prev => ({ ...prev, expiryDate: null }));
        } else {
            setDoc(prev => ({ ...prev, expiryDate: today }));
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];

            // Clean up previous preview
            if (localPreview) URL.revokeObjectURL(localPreview);

            // Set local preview immediately
            const objectUrl = URL.createObjectURL(file);
            setLocalPreview(objectUrl);

            if (file.type.includes('pdf')) setPreviewType('pdf');
            else if (file.type.includes('image')) setPreviewType('image');
            else setPreviewType('none');

            setUploading(true);
            setFileError(null);
            try {
                const publicUrl = await uploadFile(file);
                setDoc(prev => ({ ...prev, documentUrl: publicUrl }));
            } catch (error: any) {
                setFileError(getErrorMessage(error));
            } finally {
                setUploading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-fade-in border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        {existingDocument ? 'Edit Document' : 'Add Document'}
                        {existingDocument && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-normal">Editing</span>}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl">&times;</button>
                </div>

                {/* Body - Split Screen */}
                <div className="flex flex-col md:flex-row flex-grow overflow-hidden">

                    {/* Left Pane: Form */}
                    <div className="w-full md:w-1/2 overflow-y-auto p-6 border-r dark:border-gray-700">
                        {validationErrors.length > 0 && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs font-medium">
                                <ul className="list-disc pl-4">
                                    {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                                </ul>
                            </div>
                        )}

                        <form id="doc-form" onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-1">Document Type (Optional)</label>
                                <select name="qualificationTypeId" value={doc.qualificationTypeId || ''} onChange={handleInputChange} className="w-full form-input">
                                    <option value="">-- General Document --</option>
                                    {qualificationTypes.map(qt => <option key={qt.id} value={qt.id}>{qt.code} - {qt.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Document Name</label>
                                <input type="text" name="name" value={doc.name || ''} onChange={handleInputChange} className="w-full form-input font-bold" required />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Upload File</label>
                                <div className="flex items-center gap-4">
                                    <label className="flex-grow cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <input type="file" onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-brand-primary">Click to select file</p>
                                            <p className="text-xs text-gray-400">PDF, PNG, JPG up to 5MB</p>
                                        </div>
                                    </label>
                                </div>
                                {uploading && <div className="mt-2 text-xs text-blue-600 flex items-center gap-2"><div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></div> Uploading...</div>}
                                {fileError && <p className="text-xs text-red-500 mt-2">{fileError}</p>}
                                {activeUrl && !uploading && (
                                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        File selected
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Issue Date</label>
                                    <input type="date" name="issueDate" value={doc.issueDate || ''} onChange={handleInputChange} className="w-full form-input" required />
                                </div>

                                {!neverExpires && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Expiry Date</label>
                                        <input
                                            type="date"
                                            name="expiryDate"
                                            value={doc.expiryDate || ''}
                                            onChange={handleInputChange}
                                            className="w-full form-input"
                                            required
                                        />
                                    </div>
                                )}
                            </div>

                            {/* EASA CALCULATOR */}
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-md border border-blue-100 dark:border-blue-800">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={neverExpires}
                                            onChange={handleNeverExpiresChange}
                                            className="h-4 w-4 text-brand-primary rounded border-gray-300"
                                        />
                                        <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Does not expire</span>
                                    </label>

                                    {isMedical && !neverExpires && staffDob && (
                                        <button
                                            type="button"
                                            onClick={calculateEasaExpiry}
                                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded shadow-sm hover:bg-blue-700 transition-colors"
                                        >
                                            Auto-Calc (EASA)
                                        </button>
                                    )}
                                </div>

                                {isMedical && !neverExpires && staffDob && (
                                    <div className="mt-2 text-xs text-blue-800 dark:text-blue-300 pl-6">
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isSinglePilotCat}
                                                onChange={(e) => setIsSinglePilotCat(e.target.checked)}
                                                className="rounded text-blue-600"
                                            />
                                            <span>Single-Pilot Passenger Ops (Age 40 Rule)</span>
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* MEDICAL LIMITATIONS */}
                            {isMedical && (
                                <div className="p-3 bg-orange-50 dark:bg-orange-900/10 rounded-md border border-orange-200 dark:border-orange-800">
                                    <label className="block text-xs font-bold text-orange-800 dark:text-orange-300 uppercase mb-2">Medical Certificate Limitations</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {MEDICAL_LIMITATIONS.map(lim => {
                                            const isChecked = (doc.restrictions || '').includes(lim.code);
                                            const isTML = lim.code === 'TML';

                                            return (
                                                <div
                                                    key={lim.code}
                                                    className={`flex flex-col p-1.5 rounded border transition-colors ${isChecked ? 'bg-orange-100 border-orange-300 dark:bg-orange-900/40' : 'bg-white dark:bg-gray-800 border-transparent hover:bg-white/50'}`}
                                                >
                                                    <label className="flex items-start cursor-pointer w-full">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => handleToggleLimitation(lim.code)}
                                                            className="mt-0.5 mr-2 h-3.5 w-3.5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                                                        />
                                                        <div>
                                                            <span className={`font-bold block text-xs ${isChecked ? 'text-orange-900 dark:text-orange-100' : 'text-gray-700 dark:text-gray-300'}`}>{lim.code}</span>
                                                            <span className={`text-[10px] leading-tight ${isChecked ? 'text-orange-800 dark:text-orange-200' : 'text-gray-500 dark:text-gray-400'}`}>{lim.label}</span>
                                                        </div>
                                                    </label>

                                                    {/* TML Date Picker */}
                                                    {isTML && isChecked && (
                                                        <div className="mt-2 ml-5 animate-fade-in">
                                                            <label className="block text-[9px] font-bold text-orange-700 dark:text-orange-300 uppercase mb-0.5">Valid Until</label>
                                                            <input
                                                                type="date"
                                                                value={doc.expiryDate || ''}
                                                                onChange={(e) => {
                                                                    setDoc(prev => ({ ...prev, expiryDate: e.target.value }));
                                                                    setNeverExpires(false);
                                                                }}
                                                                className="w-full text-xs p-1 rounded border border-orange-300 bg-white text-orange-900 focus:ring-1 focus:ring-orange-500 outline-none"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-orange-200 dark:border-orange-800">
                                        <label className="block text-[10px] font-bold text-orange-700 dark:text-orange-300 mb-1">Other / Custom Restrictions</label>
                                        <input
                                            type="text"
                                            name="restrictions"
                                            value={doc.restrictions || ''}
                                            onChange={handleInputChange}
                                            className="w-full form-input text-xs"
                                            placeholder="Comma separated codes (e.g. OML, TML)"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* GENERIC RESTRICTIONS */}
                            {!isMedical && (
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md border dark:border-gray-600">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Limitations / Restrictions</label>
                                    <input
                                        type="text"
                                        name="restrictions"
                                        value={doc.restrictions || ''}
                                        onChange={handleInputChange}
                                        className="w-full form-input text-sm"
                                        placeholder="e.g. Day VFR Only"
                                    />
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Right Pane: Preview */}
                    <div className="hidden md:flex w-1/2 bg-gray-200 dark:bg-gray-900 items-center justify-center p-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 p-2 bg-gray-800/80 text-white text-xs font-bold uppercase tracking-wider text-center z-10 backdrop-blur-sm">
                            Document Preview
                        </div>

                        {activeUrl ? (
                            <div className="w-full h-full flex items-center justify-center">
                                {previewType === 'image' && (
                                    <img src={activeUrl} alt="Preview" className="max-w-full max-h-full object-contain shadow-xl border border-gray-300 dark:border-gray-700 rounded-lg bg-white" />
                                )}
                                {previewType === 'pdf' && (
                                    <iframe
                                        src={activeUrl}
                                        className="w-full h-full rounded-lg shadow-xl border border-gray-300 dark:border-gray-700 bg-white"
                                        title="Document Preview"
                                    />
                                )}
                                {previewType === 'none' && (
                                    <div className="text-center text-gray-500 dark:text-gray-400">
                                        <div className="text-4xl mb-2">📄</div>
                                        <p className="font-semibold">Preview Unavailable</p>
                                        <p className="text-xs max-w-xs mx-auto">This file type cannot be previewed directly. Please download to view.</p>
                                        <a href={activeUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-brand-primary underline text-sm">Download File</a>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-gray-400 dark:text-gray-600">
                                <div className="text-6xl mb-4 opacity-30">👁️</div>
                                <p className="font-semibold uppercase tracking-widest text-sm">No Document Selected</p>
                                <p className="text-xs mt-2 opacity-70">Upload a file to see preview here.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
                    <div>
                        {existingDocument && onDelete && (
                            <button type="button" onClick={() => onDelete(existingDocument.id)} className="text-red-600 hover:text-red-800 text-sm font-bold underline decoration-red-200 hover:decoration-red-600 transition-all">
                                Delete Document
                            </button>
                        )}
                    </div>
                    <div className="flex space-x-3">
                        <button type="button" onClick={onClose} className="px-5 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="doc-form"
                            disabled={uploading}
                            className="bg-brand-primary text-white px-8 py-2 rounded-md hover:bg-brand-secondary font-bold shadow-md disabled:opacity-50 disabled:cursor-wait transition-all transform active:scale-95"
                        >
                            {uploading ? 'Uploading...' : 'Save Document'}
                        </button>
                    </div>
                </div>

                <style>{`
                    .form-input { display: block; width: 100%; padding: 0.6rem 0.75rem; font-size: 0.875rem; background-color: white; border: 1px solid #D1D5DB; border-radius: 0.375rem; transition: border-color 0.2s; }
                    .form-input:focus { border-color: #0D47A1; outline: none; box-shadow: 0 0 0 3px rgba(13, 71, 161, 0.1); }
                    .dark .form-input { background-color: #1f2937; border-color: #4B5563; color: white; }
                    .dark .form-input:focus { border-color: #60a5fa; }
                `}</style>
            </div>
        </div>
    );
};

export default StaffDocumentModal;
