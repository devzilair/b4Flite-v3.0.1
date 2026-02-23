
import React, { useState } from 'react';
import { Staff, LifecycleProcess } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { useHR } from '../../hooks/useHR';

interface StaffLifecycleTabProps {
    staff: Partial<Staff>;
    setStaff: React.Dispatch<React.SetStateAction<Partial<Staff>>>;
}

const StaffLifecycleTab: React.FC<StaffLifecycleTabProps> = ({ staff, setStaff }) => {
    const { checklistTemplates } = useHR();
    const { currentUser } = usePermissions();
    const [showTemplateSelector, setShowTemplateSelector] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [processType, setProcessType] = useState<'onboarding' | 'offboarding'>('onboarding');

    const onboardingData = staff.lifecycleData?.onboarding;
    const offboardingData = staff.lifecycleData?.offboarding;

    const startProcess = () => {
        if (!selectedTemplateId) return;
        const template = checklistTemplates.find(t => t.id === selectedTemplateId);
        if (!template) return;

        const newProcess: LifecycleProcess = {
            templateId: template.id,
            templateName: template.name,
            startDate: new Date().toISOString().split('T')[0],
            items: template.items.map(item => ({
                id: item.id,
                label: item.label,
                completed: false,
            })),
        };

        setStaff(prev => ({
            ...prev,
            lifecycleData: {
                ...prev.lifecycleData,
                [processType]: newProcess,
            }
        }));
        setShowTemplateSelector(false);
        setSelectedTemplateId('');
    };

    const handleItemCheck = (processKey: 'onboarding' | 'offboarding', itemId: string, completed: boolean) => {
        setStaff(prev => {
            if (!prev.lifecycleData || !prev.lifecycleData[processKey]) return prev;
            
            const process = prev.lifecycleData[processKey];
            if (!process) return prev;

            const updatedItems = (process.items || []).map(item => {
                if (item.id === itemId) {
                    return {
                        ...item,
                        completed,
                        completedBy: completed ? currentUser?.name : undefined,
                        completedAt: completed ? new Date().toISOString() : undefined,
                    };
                }
                return item;
            });
            
            // Auto-complete process if all items done
            const allDone = updatedItems.length > 0 && updatedItems.every(i => i.completed);
            const completedDate = allDone ? new Date().toISOString().split('T')[0] : undefined;

            return {
                ...prev,
                lifecycleData: {
                    ...prev.lifecycleData,
                    [processKey]: {
                        ...process,
                        items: updatedItems,
                        completedDate: completedDate || process.completedDate
                    }
                }
            };
        });
    };

    const renderProcess = (key: 'onboarding' | 'offboarding', data?: LifecycleProcess) => {
        const title = key === 'onboarding' ? 'Onboarding Checklist' : 'Offboarding Checklist';
        
        if (!data) {
            return (
                <div className="p-6 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center bg-gray-50 dark:bg-gray-800/50">
                    <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">{title}</h3>
                    <p className="text-sm text-gray-500 mb-4">No active checklist.</p>
                    <button 
                        onClick={() => { setProcessType(key); setShowTemplateSelector(true); }}
                        className="bg-brand-primary text-white py-2 px-4 rounded hover:bg-brand-secondary"
                    >
                        Start {key === 'onboarding' ? 'Onboarding' : 'Offboarding'}
                    </button>
                </div>
            );
        }

        const items = data.items || [];
        const completedCount = items.filter(i => i.completed).length;
        const totalCount = items.length;
        const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

        return (
            <div className="bg-white dark:bg-gray-700/30 border dark:border-gray-600 rounded-lg overflow-hidden shadow-sm">
                <div className="p-4 bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-600 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-lg">{title}: {data.templateName}</h3>
                        <p className="text-xs text-gray-500">Started: {data.startDate} {data.completedDate && `| Completed: ${data.completedDate}`}</p>
                    </div>
                    <div className="w-1/3">
                        <div className="flex justify-between text-xs mb-1">
                             <span>Progress</span>
                             <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-300 rounded-full h-2.5 dark:bg-gray-600">
                            <div className="bg-status-success h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#4CAF50' : '#2196F3' }}></div>
                        </div>
                    </div>
                </div>
                <div className="p-4 space-y-2">
                    {items.map(item => (
                        <div key={item.id} className={`flex items-start p-2 rounded border ${item.completed ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900' : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}>
                            <input 
                                type="checkbox" 
                                checked={item.completed} 
                                onChange={(e) => handleItemCheck(key, item.id, e.target.checked)}
                                className="mt-1 h-4 w-4 text-brand-primary rounded focus:ring-brand-primary"
                            />
                            <div className="ml-3 flex-grow">
                                <p className={`text-sm font-medium ${item.completed ? 'text-gray-800 dark:text-gray-200 line-through opacity-70' : 'text-gray-900 dark:text-white'}`}>
                                    {item.label}
                                </p>
                                {item.completed && (
                                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                                        &rarr; Checked by {item.completedBy} on {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : ''}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && <p className="text-sm text-gray-500 italic">No checklist items defined.</p>}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            {renderProcess('onboarding', onboardingData)}
            <div className="border-t dark:border-gray-600"></div>
            {renderProcess('offboarding', offboardingData)}

            {showTemplateSelector && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={() => setShowTemplateSelector(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">Select {processType === 'onboarding' ? 'Onboarding' : 'Offboarding'} Template</h3>
                        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                            {checklistTemplates
                                .filter(t => t.type === processType)
                                .map(t => (
                                    <label key={t.id} className={`flex items-center p-3 rounded border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedTemplateId === t.id ? 'border-brand-primary bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600'}`}>
                                        <input 
                                            type="radio" 
                                            name="template" 
                                            value={t.id} 
                                            checked={selectedTemplateId === t.id} 
                                            onChange={() => setSelectedTemplateId(t.id)}
                                            className="text-brand-primary focus:ring-brand-primary"
                                        />
                                        <span className="ml-3 font-medium">{t.name}</span>
                                        <span className="ml-auto text-xs text-gray-500">{(t.items || []).length} tasks</span>
                                    </label>
                                ))
                            }
                            {checklistTemplates.filter(t => t.type === processType).length === 0 && (
                                <p className="text-center text-gray-500">
                                    No templates found. Please create one in Admin Settings &gt; HR Settings.
                                </p>
                            )}
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowTemplateSelector(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded text-sm">Cancel</button>
                            <button 
                                onClick={startProcess} 
                                disabled={!selectedTemplateId}
                                className="px-4 py-2 bg-brand-primary text-white rounded text-sm disabled:opacity-50"
                            >
                                Start Process
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffLifecycleTab;
