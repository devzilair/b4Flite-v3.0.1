
import React, { useState, useMemo } from 'react';
import { EmployeeGoal, GoalStatus } from '../../types';
import { useHR } from '../../hooks/useHR';
import { sanitizeString } from '../../utils/sanitization';

interface GoalsWidgetProps {
    staffId: string;
    canEdit: boolean;
}

const GoalsWidget: React.FC<GoalsWidgetProps> = ({ staffId, canEdit }) => {
    const { employeeGoals, upsertEmployeeGoal, deleteEmployeeGoal } = useHR();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<EmployeeGoal | null>(null);

    const staffGoals = useMemo(() => 
        employeeGoals.filter(g => g.staffId === staffId).sort((a, b) => {
            // Sort by status (Pending/In Progress first) then by due date
            if (a.status !== b.status) {
                if (a.status === 'completed' || a.status === 'cancelled') return 1;
                if (b.status === 'completed' || b.status === 'cancelled') return -1;
            }
            return (a.dueDate || '').localeCompare(b.dueDate || '');
        }), 
    [employeeGoals, staffId]);

    const handleSave = async (goal: EmployeeGoal) => {
        await upsertEmployeeGoal(goal);
        setIsModalOpen(false);
        setEditingGoal(null);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Delete this goal?')) {
            await deleteEmployeeGoal(id);
        }
    };

    const getStatusColor = (status: GoalStatus) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'in_progress': return 'bg-blue-100 text-blue-800';
            case 'cancelled': return 'bg-gray-200 text-gray-600';
            default: return 'bg-yellow-100 text-yellow-800';
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Goals & OKRs</h3>
                {canEdit && (
                    <button 
                        type="button"
                        onClick={(e) => { e.preventDefault(); setEditingGoal(null); setIsModalOpen(true); }}
                        className="text-sm bg-brand-primary text-white px-3 py-1 rounded hover:bg-brand-secondary"
                    >
                        + New Goal
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {staffGoals.map(goal => (
                    <div key={goal.id} className="p-3 border rounded-md dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100">{goal.title}</h4>
                                {goal.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{goal.description}</p>}
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full uppercase font-bold ${getStatusColor(goal.status)}`}>
                                {goal.status.replace('_', ' ')}
                            </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                            <div className="flex-grow mr-4">
                                <div className="flex justify-between mb-1 text-xs text-gray-500">
                                    <span>Progress</span>
                                    <span>{goal.progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-600">
                                    <div className="bg-brand-primary h-1.5 rounded-full" style={{ width: `${goal.progress}%` }}></div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 min-w-[80px]">
                                {goal.dueDate && <span className="text-xs text-gray-400">Due: {new Date(goal.dueDate).toLocaleDateString()}</span>}
                                {canEdit && (
                                    <div className="space-x-2">
                                        <button type="button" onClick={(e) => { e.preventDefault(); setEditingGoal(goal); setIsModalOpen(true); }} className="text-brand-primary hover:underline text-xs">Edit</button>
                                        <button type="button" onClick={(e) => { e.preventDefault(); handleDelete(goal.id); }} className="text-red-500 hover:underline text-xs">Delete</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {staffGoals.length === 0 && <p className="text-gray-500 text-center py-4 text-sm">No active goals.</p>}
            </div>

            {isModalOpen && (
                <GoalModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    existingGoal={editingGoal}
                    staffId={staffId}
                />
            )}
        </div>
    );
};

const GoalModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (goal: EmployeeGoal) => void;
    existingGoal: EmployeeGoal | null;
    staffId: string;
}> = ({ isOpen, onClose, onSave, existingGoal, staffId }) => {
    const [goal, setGoal] = useState<Partial<EmployeeGoal>>({
        title: '',
        description: '',
        status: 'pending',
        progress: 0,
        dueDate: '',
    });

    React.useEffect(() => {
        if (existingGoal) setGoal(existingGoal);
        else setGoal({ title: '', description: '', status: 'pending', progress: 0, dueDate: '' });
    }, [existingGoal, isOpen]);

    const handleSaveClick = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!goal.title) {
            alert("Title is required");
            return;
        }
        onSave({
            id: existingGoal?.id || `goal_${Date.now()}`,
            staffId,
            title: sanitizeString(goal.title),
            description: sanitizeString(goal.description),
            status: goal.status as GoalStatus,
            progress: goal.progress || 0,
            dueDate: goal.dueDate,
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent Enter from triggering parent forms
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{existingGoal ? 'Edit Goal' : 'New Goal'}</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Title</label>
                        <input 
                            type="text" 
                            value={goal.title} 
                            onChange={e => setGoal({...goal, title: e.target.value})} 
                            required 
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Description</label>
                        <textarea 
                            value={goal.description} 
                            onChange={e => setGoal({...goal, description: e.target.value})} 
                            rows={3} 
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Status</label>
                            <select 
                                value={goal.status} 
                                onChange={e => setGoal({...goal, status: e.target.value as any})} 
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                onKeyDown={handleKeyDown}
                            >
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Due Date</label>
                            <input 
                                type="date" 
                                value={goal.dueDate} 
                                onChange={e => setGoal({...goal, dueDate: e.target.value})} 
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Progress ({goal.progress}%)</label>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={goal.progress} 
                            onChange={e => setGoal({...goal, progress: parseInt(e.target.value)})} 
                            className="w-full" 
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm">Cancel</button>
                        <button type="button" onClick={handleSaveClick} className="px-4 py-2 bg-brand-primary text-white rounded hover:bg-brand-secondary text-sm">Save Goal</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GoalsWidget;
