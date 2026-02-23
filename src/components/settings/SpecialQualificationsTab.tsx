
import React, { useState } from 'react';
import { SpecialQualification } from '../../types';
import { useSettings } from '../../hooks/useSettings';
import { sanitizeString } from '../../utils/sanitization';

const SpecialQualificationsTab: React.FC = () => {
    const { specialQualifications, upsertSpecialQualification, deleteSpecialQualification } = useSettings();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<SpecialQualification | null>(null);

    const handleSave = async (sq: SpecialQualification) => {
        try {
            await upsertSpecialQualification(sq);
            setIsModalOpen(false);
            setEditingType(null);
        } catch (error) {
            console.error("Failed to save special qualification", error);
            alert("Failed to save special qualification.");
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure? Removing this will not delete the data from staff profiles, but it will remove it from the available selection list.')) {
            await deleteSpecialQualification(id);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Special Ratings & Authorizations</h2>
                <button onClick={() => { setEditingType(null); setIsModalOpen(true); }} className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary">
                    + Add Rating
                </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">Manage instructional or examiner ratings (e.g. TRI, TRE, LTC) that can be assigned to pilots.</p>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="p-3">Rating Code</th>
                            <th className="p-3">Description</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {specialQualifications.map(sq => (
                            <tr key={sq.id} className="border-b dark:border-gray-600">
                                <td className="p-3 font-bold text-sm">{sq.name}</td>
                                <td className="p-3 text-sm text-gray-600 dark:text-gray-300">{sq.description || '-'}</td>
                                <td className="p-3 space-x-3">
                                    <button onClick={() => { setEditingType(sq); setIsModalOpen(true); }} className="text-brand-primary hover:underline text-sm">Edit</button>
                                    <button onClick={() => handleDelete(sq.id)} className="text-red-500 hover:underline text-sm">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {specialQualifications.length === 0 && (
                            <tr><td colSpan={3} className="text-center p-8 text-gray-500">No special ratings defined.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <SpecialQualificationModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSave}
                    existingType={editingType}
                />
            )}
        </div>
    );
};

const SpecialQualificationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (sq: SpecialQualification) => void;
    existingType: SpecialQualification | null;
}> = ({ isOpen, onClose, onSave, existingType }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    React.useEffect(() => {
        if (existingType) {
            setName(existingType.name);
            setDescription(existingType.description || '');
        } else {
            setName('');
            setDescription('');
        }
    }, [existingType, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) {
            alert('Rating Code is required.');
            return;
        }
        onSave({
            id: existingType?.id || `sq_${Date.now()}`,
            name: sanitizeString(name).toUpperCase(),
            description: sanitizeString(description),
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{existingType ? 'Edit Rating' : 'New Rating'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Rating Code (e.g. TRI)</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            required 
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 uppercase" 
                            placeholder="TRE" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Description</label>
                        <input 
                            type="text" 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                            placeholder="Type Rating Examiner" 
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

export default SpecialQualificationsTab;
