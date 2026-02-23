
import React, { useState } from 'react';
import { CustomFieldDefinition } from '../../types';
import CustomFieldModal from './CustomFieldModal';
import { useSettings } from '../../hooks/useSettings';

const CustomFieldsTab: React.FC = () => {
    const { customFieldDefs, upsertCustomFieldDef, deleteCustomFieldDef } = useSettings();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);

    const handleSave = async (field: CustomFieldDefinition) => {
        try {
            await upsertCustomFieldDef(field);
            setIsModalOpen(false);
            setEditingField(null);
        } catch (error) {
            console.error("Failed to save custom field", error);
            alert("Failed to save custom field. Please try again.");
        }
    };

    const handleDelete = async (fieldId: string) => {
        if (window.confirm('Are you sure you want to delete this custom field? This will remove the field and all its data from every staff profile.')) {
            try {
                await deleteCustomFieldDef(fieldId);
            } catch (error) {
                console.error("Failed to delete custom field", error);
                alert("Failed to delete custom field.");
            }
        }
    };

    const openModalForNew = () => {
        setEditingField(null);
        setIsModalOpen(true);
    };

    const openModalForEdit = (field: CustomFieldDefinition) => {
        setEditingField(field);
        setIsModalOpen(true);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Manage Custom Profile Fields</h2>
                <button onClick={openModalForNew} className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary">
                    + Add Field
                </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Define custom fields that will appear on every staff member's profile page.
            </p>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="p-3">Field Name</th>
                            <th className="p-3">Field Type</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customFieldDefs.map(field => (
                            <tr key={field.id} className="border-b border-gray-200 dark:border-gray-600">
                                <td className="p-3 font-medium">{field.name}</td>
                                <td className="p-3 capitalize">{field.type}</td>
                                <td className="p-3 space-x-4">
                                    <button onClick={() => openModalForEdit(field)} className="text-brand-primary hover:underline">Edit</button>
                                    <button onClick={() => handleDelete(field.id)} className="text-status-danger hover:underline">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {customFieldDefs.length === 0 && (
                            <tr>
                                <td colSpan={3} className="text-center p-8 text-gray-500">
                                    No custom fields have been defined.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {isModalOpen && (
                <CustomFieldModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    existingField={editingField}
                />
            )}
        </div>
    );
};

export default CustomFieldsTab;
