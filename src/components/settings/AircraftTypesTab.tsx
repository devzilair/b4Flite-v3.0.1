
import React, { useState } from 'react';
import { AircraftType, MajorType } from '../../types';
import { useSettings } from '../../hooks/useSettings';
import { sanitizeString } from '../../utils/sanitization';

const AircraftTypesTab: React.FC = () => {
    const { aircraftTypes, upsertAircraftType, deleteAircraftType } = useSettings();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<AircraftType | null>(null);

    const handleSave = async (at: AircraftType) => {
        try {
            await upsertAircraftType(at);
            setIsModalOpen(false);
            setEditingType(null);
        } catch (error) {
            console.error("Failed to save aircraft type", error);
            alert("Failed to save aircraft type.");
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure? This will remove this aircraft type from the available selection list.')) {
            await deleteAircraftType(id);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Aircraft Type Ratings</h2>
                <button onClick={() => { setEditingType(null); setIsModalOpen(true); }} className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary">
                    + Add Aircraft Type
                </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">Manage the list of aircraft types (e.g. EC120B, King Air) that can be assigned to pilot profiles.</p>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="p-3">Type Name</th>
                            <th className="p-3">Category</th>
                            <th className="p-3">Attributes</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {aircraftTypes.map(at => (
                            <tr key={at.id} className="border-b dark:border-gray-600">
                                <td className="p-3 font-bold text-sm">{at.name}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${at.category === 'Helicopter' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {at.category}
                                    </span>
                                </td>
                                <td className="p-3 text-xs text-gray-600 dark:text-gray-300">
                                    {at.isTurbine && <span className="mr-2">Turbine</span>}
                                    {at.isMultiEngine && <span>Multi-Engine</span>}
                                    {!at.isTurbine && !at.isMultiEngine && <span className="text-gray-400">-</span>}
                                </td>
                                <td className="p-3 space-x-3">
                                    <button onClick={() => { setEditingType(at); setIsModalOpen(true); }} className="text-brand-primary hover:underline text-sm">Edit</button>
                                    <button onClick={() => handleDelete(at.id)} className="text-red-500 hover:underline text-sm">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {aircraftTypes.length === 0 && (
                            <tr><td colSpan={4} className="text-center p-8 text-gray-500">No aircraft types defined.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <AircraftTypeModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSave}
                    existingType={editingType}
                />
            )}
        </div>
    );
};

const AircraftTypeModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (at: AircraftType) => void;
    existingType: AircraftType | null;
}> = ({ isOpen, onClose, onSave, existingType }) => {
    const [at, setAt] = useState<Partial<AircraftType>>({});

    React.useEffect(() => {
        if (existingType) setAt(existingType);
        else setAt({ name: '', category: 'Helicopter', isTurbine: false, isMultiEngine: false });
    }, [existingType, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!at.name || !at.category) {
            alert('Aircraft Name and Category are required.');
            return;
        }
        onSave({
            id: existingType?.id || `at_${Date.now()}`,
            name: sanitizeString(at.name).toUpperCase(),
            category: at.category as MajorType,
            isTurbine: at.isTurbine || false,
            isMultiEngine: at.isMultiEngine || false,
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{existingType ? 'Edit Aircraft Type' : 'New Aircraft Type'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Type Name</label>
                        <input type="text" value={at.name || ''} onChange={e => setAt({...at, name: e.target.value})} required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 uppercase" placeholder="EC120B" />
                    </div>
                    <div>
                         <label className="block text-sm font-medium">Category</label>
                         <select value={at.category || 'Helicopter'} onChange={e => setAt({...at, category: e.target.value as MajorType})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                            <option value="Helicopter">Helicopter</option>
                            <option value="Fixed Wing">Fixed Wing</option>
                         </select>
                    </div>
                    <div className="flex gap-4 pt-2">
                        <label className="flex items-center cursor-pointer">
                            <input type="checkbox" checked={at.isTurbine || false} onChange={e => setAt({...at, isTurbine: e.target.checked})} className="mr-2" />
                            <span className="text-sm">Turbine Engine</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input type="checkbox" checked={at.isMultiEngine || false} onChange={e => setAt({...at, isMultiEngine: e.target.checked})} className="mr-2" />
                            <span className="text-sm">Multi-Engine</span>
                        </label>
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

export default AircraftTypesTab;
