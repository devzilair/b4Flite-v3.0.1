
import React, { useState, useEffect } from 'react';
import { ValidationRuleSet, ValidationRule, VALIDATION_RULE_DEFINITIONS, ALL_VALIDATION_RULE_TYPES, ValidationRuleType } from '../../types';
import { sanitizeString } from '../../utils/sanitization';

interface ValidationRuleSetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (ruleSet: ValidationRuleSet) => void;
    existingRuleSet: ValidationRuleSet | null;
}

const RuleEditor: React.FC<{
    rule: ValidationRule;
    onUpdate: (updatedRule: ValidationRule) => void;
    onDelete: () => void;
}> = ({ rule, onUpdate, onDelete }) => {
    const ruleDef = VALIDATION_RULE_DEFINITIONS[rule.type];

    const handleParamChange = (paramName: string, value: string) => {
        const numericValue = parseInt(value, 10) || 0;
        onUpdate({
            ...rule,
            params: {
                ...rule.params,
                [paramName]: numericValue,
            },
        });
    };
    
    return (
        <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-md border dark:border-gray-600">
            <div className="flex justify-between items-center mb-3">
                <p className="font-bold text-sm break-all">{rule.type.replace(/_/g, ' ')}</p>
                <button type="button" onClick={onDelete} className="text-red-500 hover:text-red-700 font-bold text-xl ml-2">&times;</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                {ruleDef.params.map(param => (
                    <div key={param.name}>
                        <label className="block text-xs font-medium">{param.label}</label>
                        <input
                            type="number"
                            value={rule.params[param.name] || ''}
                            onChange={e => handleParamChange(param.name, e.target.value)}
                            className="mt-1 w-full text-sm p-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                        />
                    </div>
                ))}
                 <div className="sm:col-span-2">
                    <label className="block text-xs font-medium">Error Message</label>
                    <input
                        type="text"
                        value={rule.errorMessage}
                        onChange={e => onUpdate({ ...rule, errorMessage: e.target.value })}
                        className="mt-1 w-full text-sm p-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                    />
                     <p className="text-xs text-gray-500 mt-1">Use placeholders like <code>{`{days}`}</code> for parameters.</p>
                </div>
            </div>
        </div>
    );
};


const ValidationRuleSetModal: React.FC<ValidationRuleSetModalProps> = ({ isOpen, onClose, onSave, existingRuleSet }) => {
    const [ruleSet, setRuleSet] = useState<Partial<ValidationRuleSet>>({
        name: '',
        rules: [],
    });
    const [newRuleType, setNewRuleType] = useState<ValidationRuleType>(ALL_VALIDATION_RULE_TYPES[0]);

    useEffect(() => {
        if (existingRuleSet) {
            setRuleSet(existingRuleSet);
        } else {
            setRuleSet({ name: '', rules: [] });
        }
    }, [existingRuleSet, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const setToSave: ValidationRuleSet = {
            id: existingRuleSet?.id || `vrs_${Date.now()}`,
            name: sanitizeString(ruleSet.name) || 'Unnamed Rule Set',
            rules: ruleSet.rules || [],
        };
        onSave(setToSave);
    };
    
    const handleAddRule = () => {
        const ruleDef = VALIDATION_RULE_DEFINITIONS[newRuleType];
        const newRule: ValidationRule = {
            id: `vr_${Date.now()}`,
            type: newRuleType,
            params: Object.fromEntries(ruleDef.params.map(p => [p.name, p.defaultValue])),
            errorMessage: 'Violation of ' + newRuleType,
        };
        setRuleSet(prev => ({ ...prev, rules: [...(prev.rules || []), newRule] }));
    };
    
    const handleUpdateRule = (index: number, updatedRule: ValidationRule) => {
        setRuleSet(prev => {
            const newRules = [...(prev.rules || [])];
            newRules[index] = updatedRule;
            return { ...prev, rules: newRules };
        });
    };

    const handleDeleteRule = (index: number) => {
         setRuleSet(prev => {
            const newRules = [...(prev.rules || [])];
            newRules.splice(index, 1);
            return { ...prev, rules: newRules };
        });
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center sm:p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 sm:rounded-lg shadow-2xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold p-6 border-b dark:border-gray-700 flex-shrink-0">{existingRuleSet ? 'Edit Rule Set' : 'Add New Rule Set'}</h2>
                
                <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden p-6 space-y-4">
                    <div className="flex-shrink-0">
                        <label className="block text-sm font-medium">Rule Set Name</label>
                        <input
                            type="text"
                            value={ruleSet.name}
                            onChange={e => setRuleSet(prev => ({...prev, name: e.target.value}))}
                            required
                            className="mt-1 w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                        />
                    </div>
                    
                    <div className="flex-grow overflow-y-auto space-y-3 pr-2">
                        {(ruleSet.rules || []).map((rule, index) => (
                           <RuleEditor 
                                key={rule.id}
                                rule={rule}
                                onUpdate={(updated) => handleUpdateRule(index, updated)}
                                onDelete={() => handleDeleteRule(index)}
                           />
                        ))}
                    </div>

                    <div className="flex-shrink-0 border-t dark:border-gray-600 pt-4 flex flex-wrap items-end gap-2">
                        <div className="flex-grow">
                             <label className="block text-sm font-medium">Rule Type to Add</label>
                             <select value={newRuleType} onChange={e => setNewRuleType(e.target.value as ValidationRuleType)} className="mt-1 w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                                {ALL_VALIDATION_RULE_TYPES.map(type => (
                                    <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </div>
                        <button type="button" onClick={handleAddRule} className="bg-gray-200 dark:bg-gray-600 px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full sm:w-auto">
                            Add Rule
                        </button>
                    </div>
                </form>

                <div className="p-6 border-t dark:border-gray-700 flex justify-end space-x-4 bg-gray-50 dark:bg-gray-800/50 sm:rounded-b-lg">
                    <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} className="bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-secondary transition-colors">
                        Save Rule Set
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ValidationRuleSetModal;
