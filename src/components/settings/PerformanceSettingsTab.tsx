
import React, { useState } from 'react';
import { PerformanceTemplate, ReviewSection } from '../../types';
import { useHR } from '../../hooks/useHR';
import { sanitizeString } from '../../utils/sanitization';
import AiPerformanceGeneratorModal from './AiPerformanceGeneratorModal';
import { GeneratedTemplateData } from '../../services/geminiService';

const PerformanceSettingsTab: React.FC = () => {
    const { performanceTemplates, upsertPerformanceTemplate, deletePerformanceTemplate } = useHR();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<PerformanceTemplate | null>(null);

    const handleSave = async (tpl: PerformanceTemplate) => {
        try {
            await upsertPerformanceTemplate(tpl);
            setIsModalOpen(false);
            setEditingTemplate(null);
        } catch (error) {
            console.error("Failed to save template", error);
            alert("Failed to save template.");
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Delete this template? Existing reviews using it will keep their data, but new ones cannot use it.")) {
            await deletePerformanceTemplate(id);
        }
    };

    const handleAiGenerate = (data: GeneratedTemplateData) => {
        // Convert AI format to internal format
        const newSections: ReviewSection[] = data.sections.map((s, idx) => ({
            id: `sec_ai_${Date.now()}_${idx}`,
            title: s.title,
            items: s.items.map((item, iIdx) => ({
                id: `item_ai_${Date.now()}_${idx}_${iIdx}`,
                label: item.label,
                description: item.description,
                type: item.type
            }))
        }));

        const newTemplate: PerformanceTemplate = {
            id: `pt_${Date.now()}`,
            name: data.name,
            sections: newSections
        };
        
        // Open the editor with the new data
        setEditingTemplate(newTemplate);
        setIsModalOpen(true);
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold">Performance Review Templates</h2>
                <div className="flex gap-2">
                     <button 
                        onClick={() => setIsAiModalOpen(true)}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2 px-4 rounded-md hover:from-purple-700 hover:to-indigo-700 flex items-center gap-2 shadow-sm font-bold text-sm"
                    >
                        <span>✨</span> AI Architect
                    </button>
                    <button 
                        onClick={() => { setEditingTemplate(null); setIsModalOpen(true); }} 
                        className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary text-sm font-bold"
                    >
                        + Create Manually
                    </button>
                </div>
            </div>
            <p className="text-sm text-gray-500 mb-6">Define the structure and criteria for performance appraisals.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {performanceTemplates.map(tpl => (
                    <div key={tpl.id} className="bg-white dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg">{tpl.name}</h3>
                            <div className="space-x-2 text-sm">
                                <button onClick={() => { setEditingTemplate(tpl); setIsModalOpen(true); }} className="text-brand-primary hover:underline">Edit</button>
                                <button onClick={() => handleDelete(tpl.id)} className="text-red-500 hover:underline">Delete</button>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                            {tpl.sections.map((sec, idx) => (
                                <div key={sec.id}>
                                    <span className="font-semibold">{idx + 1}. {sec.title}</span>
                                    <span className="text-gray-400 text-xs ml-2">({(sec.items || []).length} items)</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {performanceTemplates.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                        <p className="text-gray-500 mb-4">No templates defined.</p>
                        <p className="text-sm text-gray-400">Use the <strong>AI Architect</strong> to instantly generate a professional review structure for any role.</p>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <TemplateEditorModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSave} 
                    existingTemplate={editingTemplate} 
                />
            )}

            {isAiModalOpen && (
                <AiPerformanceGeneratorModal
                    isOpen={isAiModalOpen}
                    onClose={() => setIsAiModalOpen(false)}
                    onGenerate={handleAiGenerate}
                />
            )}
        </div>
    );
};

const TemplateEditorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (tpl: PerformanceTemplate) => void;
    existingTemplate: PerformanceTemplate | null;
}> = ({ isOpen, onClose, onSave, existingTemplate }) => {
    const [template, setTemplate] = useState<Partial<PerformanceTemplate>>({ name: '', sections: [] });

    React.useEffect(() => {
        if (existingTemplate) setTemplate(JSON.parse(JSON.stringify(existingTemplate)));
        else setTemplate({ name: '', sections: [] });
    }, [existingTemplate, isOpen]);

    const addSection = () => {
        const newSection: ReviewSection = {
            id: `sec_${Date.now()}`,
            title: 'New Section',
            items: []
        };
        setTemplate(prev => ({ ...prev, sections: [...(prev.sections || []), newSection] }));
    };

    const updateSectionTitle = (idx: number, title: string) => {
        setTemplate(prev => {
            const sections = [...(prev.sections || [])];
            sections[idx] = { ...sections[idx], title };
            return { ...prev, sections };
        });
    };

    const deleteSection = (idx: number) => {
        setTemplate(prev => ({ ...prev, sections: (prev.sections || []).filter((_, i) => i !== idx) }));
    };

    const addItem = (sectionIdx: number) => {
        setTemplate(prev => {
            const sections = [...(prev.sections || [])];
            const currentItems = sections[sectionIdx].items || [];
            sections[sectionIdx].items = [...currentItems, {
                id: `item_${Date.now()}`,
                label: 'New Criterion',
                type: 'rating',
                description: ''
            }];
            return { ...prev, sections };
        });
    };

    const updateItem = (sectionIdx: number, itemIdx: number, field: string, value: any) => {
        setTemplate(prev => {
            const sections = [...(prev.sections || [])];
            const items = [...(sections[sectionIdx].items || [])];
            items[itemIdx] = { ...items[itemIdx], [field]: value };
            sections[sectionIdx] = { ...sections[sectionIdx], items };
            return { ...prev, sections };
        });
    };

    const deleteItem = (sectionIdx: number, itemIdx: number) => {
         setTemplate(prev => {
            const sections = [...(prev.sections || [])];
            const items = (sections[sectionIdx].items || []).filter((_, i) => i !== itemIdx);
            sections[sectionIdx] = { ...sections[sectionIdx], items };
            return { ...prev, sections };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!template.name) return;
        onSave({
            id: existingTemplate?.id || `pt_${Date.now()}`,
            name: sanitizeString(template.name),
            sections: template.sections || []
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-4xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4 flex-shrink-0">{existingTemplate ? 'Edit Template' : 'New Template'}</h2>
                
                <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
                    <div className="mb-4 flex-shrink-0">
                        <label className="block text-sm font-medium mb-1">Template Name</label>
                        <input 
                            type="text" 
                            value={template.name} 
                            onChange={e => setTemplate({...template, name: e.target.value})} 
                            required 
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                            placeholder="e.g. Annual Review 2025"
                        />
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2 space-y-6">
                        {(template.sections || []).map((section, sIdx) => (
                            <div key={section.id} className="border dark:border-gray-600 rounded p-4 bg-gray-50 dark:bg-gray-700/30">
                                <div className="flex gap-2 mb-3 items-center">
                                    <span className="font-bold text-gray-400">#{sIdx + 1}</span>
                                    <input 
                                        type="text" 
                                        value={section.title} 
                                        onChange={e => updateSectionTitle(sIdx, e.target.value)} 
                                        className="flex-grow p-1 font-bold bg-transparent border-b focus:border-brand-primary focus:outline-none"
                                    />
                                    <button type="button" onClick={() => deleteSection(sIdx)} className="text-red-500 hover:text-red-700 text-sm px-2">Remove Section</button>
                                </div>

                                <div className="space-y-2 pl-4">
                                    {(section.items || []).map((item, iIdx) => (
                                        <div key={item.id} className="flex gap-3 items-start p-2 bg-white dark:bg-gray-800 rounded border dark:border-gray-700">
                                            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-2">
                                                <input 
                                                    type="text" 
                                                    value={item.label} 
                                                    onChange={e => updateItem(sIdx, iIdx, 'label', e.target.value)}
                                                    placeholder="Criteria (e.g. Teamwork)"
                                                    className="p-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                                                />
                                                <input 
                                                    type="text" 
                                                    value={item.description || ''} 
                                                    onChange={e => updateItem(sIdx, iIdx, 'description', e.target.value)}
                                                    placeholder="Description (optional)"
                                                    className="p-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                                                />
                                            </div>
                                            <div className="flex-shrink-0 flex flex-col gap-1">
                                                <select 
                                                    value={item.type} 
                                                    onChange={e => updateItem(sIdx, iIdx, 'type', e.target.value)}
                                                    className="p-1 border rounded text-xs dark:bg-gray-700"
                                                >
                                                    <option value="rating">1-5 Rating</option>
                                                    <option value="text">Text Only</option>
                                                </select>
                                                <button type="button" onClick={() => deleteItem(sIdx, iIdx)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => addItem(sIdx)} className="text-sm text-brand-primary hover:underline mt-2">+ Add Item</button>
                                </div>
                            </div>
                        ))}
                        
                        <div className="text-center py-4">
                            <button type="button" onClick={addSection} className="bg-gray-200 dark:bg-gray-600 px-4 py-2 rounded hover:bg-gray-300">+ Add New Section</button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-600 flex-shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded text-sm">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded text-sm">Save Template</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PerformanceSettingsTab;
