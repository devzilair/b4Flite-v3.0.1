
import React, { useState } from 'react';
import { LicenseType } from '../../types';
import { useSettings } from '../../hooks/useSettings';
import { sanitizeString } from '../../utils/sanitization';

const LicenseTypesTab: React.FC = () => {
    const { licenseTypes, upsertLicenseType, deleteLicenseType } = useSettings();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<LicenseType | null>(null);

    const handleSave = async (lt: LicenseType) => {
        try {
            await upsertLicenseType(lt);
            setIsModalOpen(false);
            setEditingType(null);
        } catch (error) {
            console.error("Failed to save license type", error);
            alert("Failed to save license type.");
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure? Removing this will not delete the text from staff profiles, but it will remove it from the select list.')) {
            await deleteLicenseType(id);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">License Types</h2>
                <button onClick={() => { setEditingType(null); setIsModalOpen(true); }} className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary">
                    + Add License Type
                </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">Manage the list of pilot licenses (e.g. ATPL, CPL) that can be assigned to pilot profiles.</p>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="p-3">License Name</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {licenseTypes.map(lt => (
                            <tr key={lt.id} className="border-b dark:border-gray-600">
                                <td className="p-3 font-bold text-sm">{lt.name}</td>
                                <td className="p-3 space-x-3">
                                    <button onClick={() => { setEditingType(lt); setIsModalOpen(true); }} className="text-brand-primary hover:underline text-sm">Edit</button>
                                    <button onClick={() => handleDelete(lt.id)} className="text-red-500 hover:underline text-sm">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {licenseTypes.length === 0 && (
                            <tr><td colSpan={2} className="text-center p-8 text-gray-500">No license types defined.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <LicenseTypeModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSave}
                    existingType={editingType}
                />
            )}
        </div>
    );
};

const LicenseTypeModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (lt: LicenseType) => void;
    existingType: LicenseType | null;
}> = ({ isOpen, onClose, onSave, existingType }) => {
    const [name, setName] = useState('');

    React.useEffect(() => {
        if (existingType) setName(existingType.name);
        else setName('');
    }, [existingType, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) {
            alert('License Name is required.');
            return;
        }
        onSave({
            id: existingType?.id || `lt_${Date.now()}`,
            name: sanitizeString(name).toUpperCase(),
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{existingType ? 'Edit License' : 'New License'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">License Type (e.g. ATPL)</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            required 
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 uppercase" 
                            placeholder="ATPL" 
                        />
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

export default LicenseTypesTab;
