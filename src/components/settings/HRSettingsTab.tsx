
import React, { useState } from 'react';
import { ChecklistTemplate, ChecklistItemDefinition } from '../../types';
import { sanitizeString } from '../../utils/sanitization';
import { useHR } from '../../hooks/useHR';

const HRSettingsTab: React.FC = () => {
    const { checklistTemplates, upsertChecklistTemplate, deleteChecklistTemplate } = useHR();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);

    const handleSave = async (template: ChecklistTemplate) => {
        try {
            await upsertChecklistTemplate(template);
            setIsModalOpen(false);
            setEditingTemplate(null);
        } catch (error) {
            console.error("Failed to save template", error);
            alert("Failed to save template.");
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this template? This will not affect active checklists.')) {
            try {
                await deleteChecklistTemplate(id);
            } catch (error) {
                console.error("Failed to delete template", error);
                alert("Failed to delete template.");
            }
        }
    };

    const openModalForNew = () => {
        setEditingTemplate(null);
        setIsModalOpen(true);
    };

    const openModalForEdit = (template: ChecklistTemplate) => {
        setEditingTemplate(template);
        setIsModalOpen(true);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Onboarding & Offboarding Templates</h2>
                <button onClick={openModalForNew} className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary transition-colors">
                    + Create Template
                </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Define standard checklists for employee lifecycle events.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {checklistTemplates.map(tpl => {
                    const items = tpl.items || [];
                    return (
                        <div key={tpl.id} className="bg-white dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg">{tpl.name}</h3>
                                    <span className={`text-xs px-2 py-1 rounded-full uppercase font-semibold ${tpl.type === 'onboarding' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {tpl.type}
                                    </span>
                                </div>
                                <div className="space-x-2">
                                    <button onClick={() => openModalForEdit(tpl)} className="text-xs text-brand-primary hover:underline">Edit</button>
                                    <button onClick={() => handleDelete(tpl.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t dark:border-gray-600">
                                <p className="text-xs text-gray-500 mb-2 uppercase font-semibold">Tasks ({items.length})</p>
                                <ul className="text-sm space-y-1 list-disc list-inside text-gray-600 dark:text-gray-300 max-h-32 overflow-y-auto">
                                    {items.slice(0, 5).map(item => (
                                        <li key={item.id} className="truncate">{item.label}</li>
                                    ))}
                                    {items.length > 5 && <li className="list-none italic text-gray-400">...and {items.length - 5} more</li>}
                                </ul>
                            </div>
                        </div>
                    );
                })}
            </div>
            {checklistTemplates.length === 0 && (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <p className="text-gray-500">No templates found. Create your first onboarding or offboarding checklist.</p>
                </div>
            )}

            {isModalOpen && (
                <ChecklistTemplateModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    existingTemplate={editingTemplate}
                />
            )}
        </div>
    );
};

const ChecklistTemplateModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (tpl: ChecklistTemplate) => void;
    existingTemplate: ChecklistTemplate | null;
}> = ({ isOpen, onClose, onSave, existingTemplate }) => {
    const [template, setTemplate] = useState<Partial<ChecklistTemplate>>({
        name: '',
        type: 'onboarding',
        items: [],
    });
    const [newItemText, setNewItemText] = useState('');

    React.useEffect(() => {
        if (existingTemplate) {
            setTemplate(existingTemplate);
        } else {
            setTemplate({ name: '', type: 'onboarding', items: [] });
        }
    }, [existingTemplate, isOpen]);

    const handleAddItem = () => {
        if (!newItemText.trim()) return;
        const newItem: ChecklistItemDefinition = {
            id: `ci_${Date.now()}`,
            label: newItemText,
        };
        setTemplate(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
        setNewItemText('');
    };

    const handleRemoveItem = (id: string) => {
        setTemplate(prev => ({ ...prev, items: (prev.items || []).filter(i => i.id !== id) }));
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!template.name) return;
        const finalTemplate: ChecklistTemplate = {
            id: existingTemplate?.id || `ct_${Date.now()}`,
            name: sanitizeString(template.name),
            type: template.type as 'onboarding' | 'offboarding',
            items: template.items || [],
        };
        onSave(finalTemplate);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4">{existingTemplate ? 'Edit Template' : 'Create Template'}</h2>
                <form onSubmit={handleSave} className="flex-grow flex flex-col overflow-hidden">
                    <div className="space-y-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Template Name</label>
                            <input 
                                type="text" 
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                value={template.name}
                                onChange={e => setTemplate({...template, name: e.target.value})}
                                required
                                placeholder="e.g. Pilot Onboarding"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Type</label>
                            <select 
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                value={template.type}
                                onChange={e => setTemplate({...template, type: e.target.value as any})}
                            >
                                <option value="onboarding">Onboarding (New Hire)</option>
                                <option value="offboarding">Offboarding (Exit)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex-grow flex flex-col overflow-hidden border-t border-gray-200 dark:border-gray-700 pt-4">
                        <label className="block text-sm font-medium mb-2">Checklist Items</label>
                        <div className="flex gap-2 mb-2">
                            <input 
                                type="text" 
                                className="flex-grow p-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                value={newItemText}
                                onChange={e => setNewItemText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddItem())}
                                placeholder="Add task..."
                            />
                            <button type="button" onClick={handleAddItem} className="bg-gray-200 px-3 py-2 rounded hover:bg-gray-300 text-sm">Add</button>
                        </div>
                        <div className="flex-grow overflow-y-auto bg-gray-50 dark:bg-gray-900/30 rounded border dark:border-gray-600 p-2 space-y-2">
                            {(template.items || []).map((item, idx) => (
                                <div key={item.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded shadow-sm text-sm">
                                    <span>{idx + 1}. {item.label}</span>
                                    <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700">&times;</button>
                                </div>
                            ))}
                            {(template.items || []).length === 0 && <p className="text-center text-gray-400 italic text-sm mt-4">No items added.</p>}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 text-sm">Cancel</button>
                        <button type="submit" className="bg-brand-primary text-white px-4 py-2 rounded hover:bg-brand-secondary text-sm">Save Template</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default HRSettingsTab;
