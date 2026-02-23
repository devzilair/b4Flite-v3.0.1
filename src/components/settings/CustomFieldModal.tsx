import React, { useState, useEffect } from 'react';
import { CustomFieldDefinition } from '../../types';
import { sanitizeString } from '../../utils/sanitization';

interface CustomFieldModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (field: CustomFieldDefinition) => void;
    existingField: CustomFieldDefinition | null;
}

const CustomFieldModal: React.FC<CustomFieldModalProps> = ({ isOpen, onClose, onSave, existingField }) => {
    const [field, setField] = useState<Partial<CustomFieldDefinition>>({
        name: '',
        type: 'text',
    });

    useEffect(() => {
        if (existingField) {
            setField(existingField);
        } else {
            setField({ name: '', type: 'text' });
        }
    }, [existingField, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const fieldToSave: CustomFieldDefinition = {
            id: existingField?.id || `cf_${Date.now()}`,
            name: sanitizeString(field.name) || 'Unnamed Field',
            type: field.type || 'text',
        };
        onSave(fieldToSave);
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setField(prev => ({ ...prev, [name]: value as any }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6">{existingField ? 'Edit Custom Field' : 'Add New Custom Field'}</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium">Field Name</label>
                        <input
                            type="text"
                            name="name"
                            value={field.name}
                            onChange={handleInputChange}
                            required
                            className="mt-1 w-full form-input"
                            placeholder="e.g., T-Shirt Size"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Field Type</label>
                        <select
                            name="type"
                            value={field.type}
                            onChange={handleInputChange}
                            className="mt-1 w-full form-input"
                        >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                        </select>
                    </div>
                    <style>{`
                        .form-input { display: block; width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; background-color: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 0.375rem; }
                        .dark .form-input { color: #D1D5DB; background-color: #374151; border-color: #4B5563; }
                    `}</style>
                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" className="bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-secondary transition-colors">
                            Save Field
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CustomFieldModal;
