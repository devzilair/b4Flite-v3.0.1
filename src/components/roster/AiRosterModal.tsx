
import React, { useState } from 'react';
import { Staff, ShiftCodeDefinition, LeaveRequest } from '../../types';
import { generateRosterDraft, RosterAssignment } from '../../services/geminiService';

interface AiRosterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (assignments: RosterAssignment[]) => void;
    currentDate: Date;
    departmentStaff: Staff[];
    dutyCodes: ShiftCodeDefinition[];
    leaveRequests: LeaveRequest[];
    departmentName: string;
}

const AiRosterModal: React.FC<AiRosterModalProps> = ({ 
    isOpen, 
    onClose, 
    onApply, 
    currentDate, 
    departmentStaff, 
    dutyCodes,
    leaveRequests,
    departmentName
}) => {
    const [instructions, setInstructions] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!instructions.trim()) {
            setError("Please enter instructions.");
            return;
        }
        
        setIsLoading(true);
        setError(null);

        try {
            // Prepare context for AI
            const year = currentDate.getUTCFullYear();
            const month = currentDate.getUTCMonth() + 1;
            const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;

            // Simplify Data to save tokens (Role is kept for logic like "Senior Captains only")
            const minifiedStaff = departmentStaff.map(s => ({
                id: s.id,
                name: s.name,
                role: s.roleId 
            }));

            const minifiedCodes = dutyCodes.map(c => ({
                id: c.id,
                code: c.code,
                description: c.description,
                isOff: c.isOffDuty
            }));

            // Calculate leave conflict dates
            const leaveConflicts: { staffId: string; date: string; type: string }[] = [];
            leaveRequests.forEach(req => {
                if (req.status === 'approved') {
                    // Simple expansion of dates
                    let loop = new Date(req.startDate);
                    const end = new Date(req.endDate);
                    while (loop <= end) {
                        leaveConflicts.push({
                            staffId: req.staffId,
                            date: loop.toISOString().split('T')[0],
                            type: 'Leave'
                        });
                        loop.setDate(loop.getDate() + 1);
                    }
                }
            });

            const assignments = await generateRosterDraft(instructions, {
                month: monthStr,
                daysInMonth,
                staff: minifiedStaff,
                codes: minifiedCodes,
                leave: leaveConflicts
            });

            if (!assignments || assignments.length === 0) {
                setError("The AI generated a response, but it resulted in 0 valid assignments. Please try refining your instructions.");
                return;
            }

            onApply(assignments);
            onClose();

        } catch (e: any) {
            setError(e.message || "Failed to generate roster.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-fade-in border border-gray-200 dark:border-gray-700">
                
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 border-b dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300 rounded-lg">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">AI Auto-Scheduler</h2>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 ml-11">
                        Planning for <span className="font-bold">{departmentName}</span> ({departmentStaff.length} staff)
                    </p>
                </div>

                <div className="p-6 flex-grow">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        Instructions
                    </label>
                    <textarea 
                        value={instructions}
                        onChange={e => setInstructions(e.target.value)}
                        className="w-full h-40 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-sm leading-relaxed"
                        placeholder={`e.g. "Assign everyone a 5-day work week (Monday to Friday) with 'ON' shift. Give senior pilots weekends off. Ensure minimum 3 pilots are working every day."`}
                        disabled={isLoading}
                    />
                    
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {error}
                        </div>
                    )}
                    
                    <div className="mt-4 text-xs text-gray-400 space-y-1">
                        <p>ℹ️ The AI will automatically respect approved leave.</p>
                        <p>ℹ️ Output is a draft you can edit before saving.</p>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700 rounded-md text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-bold shadow-lg flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait transition-all active:scale-95 min-w-[140px] justify-center"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Thinking...
                            </>
                        ) : (
                            <>
                                <span>✨</span> Generate Draft
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AiRosterModal;
