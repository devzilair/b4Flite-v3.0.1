
import React, { useState } from 'react';
import { ValidationRuleSet } from '../../types';
import ValidationRuleSetModal from './ValidationRuleSetModal';
import { useSettings } from '../../hooks/useSettings';

const ValidationSettingsTab: React.FC = () => {
    const { validationRuleSets, upsertValidationRuleSet, deleteValidationRuleSet } = useSettings();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRuleSet, setEditingRuleSet] = useState<ValidationRuleSet | null>(null);

    const handleSave = async (setToSave: ValidationRuleSet) => {
        try {
            await upsertValidationRuleSet(setToSave);
            setIsModalOpen(false);
            setEditingRuleSet(null);
        } catch (error) {
            console.error("Failed to save validation rule set", error);
            alert("Failed to save rule set. Please try again.");
        }
    };

    const handleDelete = async (setId: string) => {
        if (window.confirm('Are you sure you want to delete this rule set? Departments using it will no longer have validation.')) {
            try {
                await deleteValidationRuleSet(setId);
            } catch (error) {
                console.error("Failed to delete rule set", error);
                alert("Failed to delete rule set.");
            }
        }
    };

    const openModalForEdit = (ruleSet: ValidationRuleSet) => {
        setEditingRuleSet(ruleSet);
        setIsModalOpen(true);
    };

    const openModalForNew = () => {
        setEditingRuleSet(null);
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 border dark:border-gray-700 rounded-2xl shadow-sm">
                <div className="flex-1 w-full">
                    <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                        <span className="p-1.5 bg-brand-primary/10 text-brand-primary rounded-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        </span>
                        Compliance Rule Sets
                    </h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Global bundles for roster validation and safety compliance</p>
                </div>
                <button
                    onClick={openModalForNew}
                    className="w-full md:w-auto bg-brand-primary text-white py-2 px-6 rounded-xl hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest active:scale-95"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                    New Rule Set
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {validationRuleSets.map(rs => (
                    <div key={rs.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-md transition-all group flex flex-col">
                        <div className="p-5 border-b dark:border-gray-700 flex justify-between items-start">
                            <div>
                                <h3 className="font-black text-gray-800 dark:text-white uppercase tracking-tight text-lg group-hover:text-brand-primary transition-colors">{rs.name}</h3>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System ID: {rs.id}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => openModalForEdit(rs)} className="p-2 text-gray-400 hover:text-brand-primary bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors" title="Edit Rule Set">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button onClick={() => handleDelete(rs.id)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors" title="Delete Rule Set">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="p-5 bg-gray-50/30 dark:bg-gray-900/10 flex-1">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                                Rules List
                                <span className="px-2 py-0.5 bg-brand-primary/5 text-brand-primary rounded-full">{rs.rules.length} Active</span>
                            </h4>
                            <div className="space-y-2">
                                {rs.rules.map(rule => (
                                    <div key={rule.id} className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm transition-all hover:border-brand-primary/20">
                                        <div className="mt-1 w-2 h-2 bg-brand-primary/40 rounded-full flex-shrink-0" />
                                        <div>
                                            <span className="block text-[10px] font-black text-brand-primary uppercase tracking-widest mb-0.5">
                                                {rule.type.replace(/_/g, ' ')}
                                            </span>
                                            <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed italic border-l-2 border-gray-100 dark:border-gray-700 pl-3 py-1">
                                                "{rule.errorMessage}"
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {rs.rules.length === 0 && (
                                    <div className="text-center py-8 px-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                                        <p className="text-xs italic text-gray-400 font-medium">No rules defined in this set.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <ValidationRuleSetModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    existingRuleSet={editingRuleSet}
                />
            )}
        </div>
    );
};

export default ValidationSettingsTab;
