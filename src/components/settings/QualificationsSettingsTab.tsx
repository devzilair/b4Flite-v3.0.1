
import React, { useState } from 'react';
import { QualificationType } from '../../types';
import { useSettings } from '../../hooks/useSettings';
import { useStaff } from '../../hooks/useStaff';
import { sanitizeString } from '../../utils/sanitization';

const QualificationsSettingsTab: React.FC = () => {
    const { qualificationTypes, upsertQualificationType, deleteQualificationType } = useSettings();
    const { departments } = useStaff();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<QualificationType | null>(null);

    const handleSave = async (qt: QualificationType) => {
        try {
            await upsertQualificationType(qt);
            setIsModalOpen(false);
            setEditingType(null);
        } catch (error) {
            console.error("Failed to save qualification type", error);
            alert("Failed to save qualification type.");
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure? This will unlink this qualification type from all documents.')) {
            await deleteQualificationType(id);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Training & Qualifications</h2>
                <button onClick={() => { setEditingType(null); setIsModalOpen(true); }} className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary">
                    + Add Qualification Type
                </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">Define standard qualifications (e.g. LPC, Medical) to track across staff.</p>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="p-3">Code</th>
                            <th className="p-3">Name</th>
                            <th className="p-3">Department</th>
                            <th className="p-3">Validity</th>
                            <th className="p-3">Warning</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {qualificationTypes.map(qt => (
                            <tr key={qt.id} className="border-b dark:border-gray-600">
                                <td className="p-3 font-bold text-sm">{qt.code}</td>
                                <td className="p-3">{qt.name}</td>
                                <td className="p-3 text-sm">{departments.find(d => d.id === qt.departmentId)?.name || 'Global'}</td>
                                <td className="p-3 text-sm">{qt.validityMonths} months</td>
                                <td className="p-3 text-sm">{qt.warningDays} days</td>
                                <td className="p-3 space-x-3">
                                    <button onClick={() => { setEditingType(qt); setIsModalOpen(true); }} className="text-brand-primary hover:underline text-sm">Edit</button>
                                    <button onClick={() => handleDelete(qt.id)} className="text-red-500 hover:underline text-sm">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {qualificationTypes.length === 0 && (
                            <tr><td colSpan={6} className="text-center p-8 text-gray-500">No qualification types defined.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <QualificationTypeModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    existingType={editingType}
                    departments={departments}
                />
            )}
        </div>
    );
};

const QualificationTypeModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (qt: QualificationType) => void;
    existingType: QualificationType | null;
    departments: any[];
}> = ({ isOpen, onClose, onSave, existingType, departments }) => {
    const [qt, setQt] = useState<Partial<QualificationType>>({});

    React.useEffect(() => {
        if (existingType) setQt(existingType);
        else setQt({ name: '', code: '', validityMonths: 12, warningDays: 90 });
    }, [existingType, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!qt.name || !qt.code) return;
        onSave({
            id: existingType?.id || `qt_${Date.now()}`,
            name: sanitizeString(qt.name),
            code: sanitizeString(qt.code).toUpperCase(),
            departmentId: qt.departmentId || undefined,
            validityMonths: Number(qt.validityMonths) || 12,
            warningDays: Number(qt.warningDays) || 90,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{existingType ? 'Edit Qualification' : 'New Qualification'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Code (Short)</label>
                            <input type="text" value={qt.code || ''} onChange={e => setQt({...qt, code: e.target.value})} required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 uppercase" placeholder="LPC" />
                        </div>
                        <div>
                             <label className="block text-sm font-medium">Department</label>
                             <select value={qt.departmentId || ''} onChange={e => setQt({...qt, departmentId: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                                <option value="">Global (All)</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                             </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Full Name</label>
                        <input type="text" value={qt.name || ''} onChange={e => setQt({...qt, name: e.target.value})} required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="License Proficiency Check" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Validity (Months)</label>
                            <input type="number" value={qt.validityMonths} onChange={e => setQt({...qt, validityMonths: Number(e.target.value)})} required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Warning (Days)</label>
                            <input type="number" value={qt.warningDays} onChange={e => setQt({...qt, warningDays: Number(e.target.value)})} required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded text-sm">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded text-sm">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default QualificationsSettingsTab;
