
import React, { useEffect, useMemo, useState } from 'react';
import { Staff, LeaveRequest, LeaveTransaction, DepartmentSettings, LeaveType } from '../../types';
import { sanitizeString } from '../../utils/sanitization';
import useLocalStorage from '../../hooks/useLocalStorage';
import { LeaveRequestSchema } from '../../schemas';
import { calculateChargeableDays } from '../../utils/dateUtils';
import { useSettings } from '../../hooks/useSettings';

interface LeaveRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (requestData: Omit<LeaveRequest, 'id' | 'status' | 'staffId'>, staffId: string) => void;
    currentUser: Staff;
    allStaff: Staff[];
    allRequests: LeaveRequest[];
    allTransactions: LeaveTransaction[];
    allDeptSettings: { [key: string]: DepartmentSettings };
    allLeaveTypes: LeaveType[];
    managerMode?: boolean;
    existingRequest?: LeaveRequest; // NEW: Optional prop for editing
}

const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({
    isOpen,
    onClose,
    onSave,
    currentUser,
    allStaff,
    allRequests, // Used for overlap validation
    allTransactions,
    allLeaveTypes,
    allDeptSettings,
    managerMode = false,
    existingRequest
}) => {
    const { publicHolidays } = useSettings();

    // Generate local YYYY-MM-DD string to avoid UTC shifting
    const getTodayLocal = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const today = getTodayLocal();

    // Helper to generate fresh default state
    const getFreshState = () => {
        const safeLeaveTypes = allLeaveTypes || [];
        return {
            targetStaffId: currentUser.id,
            leaveTypeId: safeLeaveTypes.find(lt => lt.name.toLowerCase().includes('annual'))?.id || safeLeaveTypes[0]?.id || '',
            startDate: today,
            endDate: today,
            notes: '',
            destination: 'local' as 'local' | 'overseas',
            contactNumber: currentUser.phone || '',
            justification: '',
            phDaysApplied: 0,
            phPosition: 'start' as 'start' | 'end', // NEW: Default to start
            medCertSubmitted: false,
        };
    };

    const [draft, setDraft] = useLocalStorage(`leave_request_draft_${currentUser.id}`, getFreshState());
    const [errors, setErrors] = useState<string[]>([]);

    // --- EFFECT: Populate form if Editing ---
    useEffect(() => {
        if (isOpen && existingRequest) {
            // Check if notes contain the Med Cert tag
            const hasMedCert = existingRequest.notes?.includes('[Med Cert Submitted]') || false;
            const cleanNotes = existingRequest.notes?.replace('[Med Cert Submitted]', '').trim() || '';

            setDraft({
                targetStaffId: existingRequest.staffId,
                leaveTypeId: existingRequest.leaveTypeId,
                startDate: existingRequest.startDate,
                endDate: existingRequest.endDate,
                notes: cleanNotes,
                destination: existingRequest.destination || 'local',
                contactNumber: existingRequest.contactNumber || '',
                justification: existingRequest.justification || '',
                phDaysApplied: existingRequest.phDaysApplied || 0,
                phPosition: (existingRequest.phPosition as 'start' | 'end') || 'start',
                medCertSubmitted: hasMedCert
            });
        } else if (isOpen && !existingRequest) {
            // Only load defaults if we are NOT editing (fresh create)
            // We verify if leaveTypeId is set, if not, set default
            setDraft(prev => {
                if (!prev.leaveTypeId && allLeaveTypes && allLeaveTypes.length > 0) {
                    const annual = allLeaveTypes.find(lt => lt.name.toLowerCase().includes('annual'));
                    return { ...prev, leaveTypeId: annual?.id || allLeaveTypes[0].id };
                }
                // Ensure date reset on fresh open if draft is old/empty, but use functional update
                if (!prev.startDate) {
                    return { ...prev, startDate: today, endDate: today };
                }
                return prev;
            });
        }
    }, [isOpen, existingRequest, allLeaveTypes, setDraft, today]);

    // Check if selected type is Sick Leave
    const isSickLeave = useMemo(() => {
        if (!allLeaveTypes) return false;
        const type = allLeaveTypes.find(lt => lt.id === draft.leaveTypeId);
        if (!type) return false;
        const name = type.name.toLowerCase();
        return name.includes('sick') || name.includes('medical') || name.includes('health');
    }, [draft.leaveTypeId, allLeaveTypes]);

    // Check if selected type is a Public Holiday / Lieu Day itself
    const isPhLeaveType = useMemo(() => {
        if (!allLeaveTypes) return false;
        const type = allLeaveTypes.find(lt => lt.id === draft.leaveTypeId);
        if (!type) return false;
        const name = type.name.toLowerCase();
        return name.includes('public holiday') || name === 'ph' || name.includes('lieu');
    }, [draft.leaveTypeId, allLeaveTypes]);

    // Force reset PH days if Sick Leave or PH Leave is selected
    useEffect(() => {
        if ((isSickLeave || isPhLeaveType) && draft.phDaysApplied > 0) {
            setDraft(prev => ({ ...prev, phDaysApplied: 0 }));
        }
    }, [isSickLeave, isPhLeaveType, draft.phDaysApplied, setDraft]);

    const handleChange = (field: string, value: any) => {
        setDraft(prev => ({ ...prev, [field]: value }));
        setErrors([]);
    };

    const handleStaffChange = (newStaffId: string) => {
        if (!allStaff) return;
        const selectedStaff = allStaff.find(s => s.id === newStaffId);
        setDraft(prev => ({
            ...prev,
            targetStaffId: newStaffId,
            contactNumber: selectedStaff?.phone || '',
            phDaysApplied: 0 // Reset PH when switching staff
        }));
    };

    // Calculate Available PH Balance and Split Dates
    const calculationContext = useMemo(() => {
        const staffId = draft.targetStaffId;
        const safeLeaveTypes = allLeaveTypes || [];

        // Find staff dept to check weekend rules
        const targetStaff = allStaff.find(s => s.id === staffId);
        const includeWeekends = (targetStaff && allDeptSettings) ? (allDeptSettings[targetStaff.departmentId]?.rosterSettings?.includeWeekendsInLeave || false) : false;

        // 1. Get PH Type and Current Balance
        const phType = safeLeaveTypes.find(lt => lt.name.toLowerCase().includes('public holiday'));
        const availablePhBalance = phType ? (allTransactions || [])
            .filter(t => t.staffId === staffId && t.leaveTypeId === phType.id)
            .reduce((sum, t) => sum + t.amount, 0) : 0;

        // 2. Calculate Calendar Duration
        if (!draft.startDate || !draft.endDate) return { balance: availablePhBalance, totalDays: 0, deductibleDays: 0, includeWeekends };

        const start = new Date(draft.startDate + 'T00:00:00Z');
        const end = new Date(draft.endDate + 'T00:00:00Z');
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return { balance: availablePhBalance, totalDays: 0, deductibleDays: 0, includeWeekends };

        // Total Calendar Days (Simple Diff)
        const totalDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // Calculate Deductible Days using strict logic
        const deductibleDays = calculateChargeableDays(draft.startDate, draft.endDate, publicHolidays, includeWeekends);

        // 3. Determine actual dates for PH block
        let phEndDateDisplay = '';
        let leaveStartDateDisplay = '';

        if (draft.phDaysApplied > 0) {
            if (draft.phPosition === 'end') {
                // PH at END logic
                const phEnd = new Date(end);
                const phStart = new Date(end);
                phStart.setUTCDate(phStart.getUTCDate() - (draft.phDaysApplied - 1));

                phEndDateDisplay = `${phStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} to ${phEnd.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

                const leaveEnd = new Date(phStart);
                leaveEnd.setUTCDate(leaveEnd.getUTCDate() - 1);
                leaveStartDateDisplay = `${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} to ${leaveEnd.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
            } else {
                // PH at START logic (Default)
                const phEnd = new Date(start);
                phEnd.setUTCDate(phEnd.getUTCDate() + (draft.phDaysApplied - 1));
                phEndDateDisplay = `${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} to ${phEnd.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

                const leaveStart = new Date(phEnd);
                leaveStart.setUTCDate(leaveStart.getUTCDate() + 1);
                leaveStartDateDisplay = `${leaveStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} to ${end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
            }
        }

        // Net Deduction is Chargeable Days minus any days covered by PH Balance
        const netAnnualDeduction = Math.max(0, deductibleDays - draft.phDaysApplied);

        return {
            balance: availablePhBalance,
            totalDays,
            deductibleDays,
            phEndDateDisplay, // Now contains full range string
            leaveStartDateDisplay, // Now contains full range string
            netAnnualDeduction,
            projectedBalance: availablePhBalance - draft.phDaysApplied,
            includeWeekends
        };
    }, [draft.targetStaffId, draft.startDate, draft.endDate, draft.phDaysApplied, draft.phPosition, allLeaveTypes, allTransactions, publicHolidays, allStaff, allDeptSettings]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrors([]);

        const result = LeaveRequestSchema.safeParse(draft);
        if (!result.success) {
            setErrors(result.error.errors.map(err => err.message));
            return;
        }

        // --- OVERLAP VALIDATION ---
        const newStart = new Date(draft.startDate);
        const newEnd = new Date(draft.endDate);

        const overlappingRequest = allRequests.find(req => {
            // 1. Must be the same staff member
            if (req.staffId !== draft.targetStaffId) return false;

            // 2. Exclude the request currently being edited (if any)
            if (existingRequest && req.id === existingRequest.id) return false;

            // 3. Exclude 'denied' requests (they don't block time)
            if (req.status === 'denied') return false;

            // 4. Check Date Intersection
            // (StartA <= EndB) and (EndA >= StartB)
            const existingStart = new Date(req.startDate);
            const existingEnd = new Date(req.endDate);

            return newStart <= existingEnd && newEnd >= existingStart;
        });

        if (overlappingRequest) {
            const range = `${overlappingRequest.startDate} to ${overlappingRequest.endDate}`;
            setErrors([`Conflict: This request overlaps with an existing '${overlappingRequest.status}' leave request (${range}).`]);
            return;
        }
        // --------------------------

        // Validate PH usage against Chargeable days
        if (draft.phDaysApplied > calculationContext.deductibleDays) {
            setErrors([`Applied PH days (${draft.phDaysApplied}) cannot exceed the chargeable working days (${calculationContext.deductibleDays}).`]);
            return;
        }

        // Prepare final notes (injecting Medical Cert status if applicable)
        let finalNotes = sanitizeString(draft.notes);
        if (isSickLeave && draft.medCertSubmitted) {
            finalNotes = `[Med Cert Submitted] ${finalNotes}`.trim();
        }

        const requestData = {
            startDate: draft.startDate,
            endDate: draft.endDate,
            leaveTypeId: draft.leaveTypeId,
            notes: finalNotes,
            destination: isSickLeave ? 'local' : draft.destination, // Force local for sick leave
            contactNumber: sanitizeString(draft.contactNumber),
            justification: sanitizeString(draft.justification),
            phDaysApplied: isSickLeave ? 0 : draft.phDaysApplied, // Ensure 0 for sick leave
            phPosition: isSickLeave ? 'start' : draft.phPosition, // Default to start for sick leave
        };

        onSave(requestData, draft.targetStaffId);

        // Reset form on success (only if creating)
        if (!existingRequest) {
            setDraft(getFreshState());
        }
    };

    const handleClose = () => {
        // Reset form on close (only if creating) to clear cancelled draft
        if (!existingRequest) {
            setDraft(getFreshState());
        }
        onClose();
    };

    if (!isOpen) return null;

    const selectableStaff = useMemo(() => {
        if (!managerMode || !allStaff) return [];
        return [...allStaff].sort((a, b) => a.name.localeCompare(b.name));
    }, [managerMode, allStaff]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center sm:p-4" onClick={handleClose}>
            <div className="bg-white dark:bg-gray-800 sm:rounded-lg shadow-2xl w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                        {existingRequest ? 'Edit Request' : (managerMode ? 'Manage Staff Leave' : 'Apply for Leave')}
                    </h2>
                    <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>

                <form onSubmit={handleSubmit} className="overflow-y-auto flex-grow p-6 space-y-6">
                    {errors.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                            <ul className="list-disc pl-5 text-xs font-medium space-y-1">
                                {errors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {managerMode && !existingRequest && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium">Staff Member</label>
                                <select value={draft.targetStaffId} onChange={(e) => handleStaffChange(e.target.value)} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                                    {selectableStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium">Start Date</label>
                            <input type="date" value={draft.startDate} onChange={(e) => handleChange('startDate', e.target.value)} required className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">End Date</label>
                            <input type="date" value={draft.endDate} onChange={(e) => handleChange('endDate', e.target.value)} required className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                    </div>

                    {/* DURATION SUMMARY */}
                    <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border dark:border-gray-600 flex justify-between items-center text-sm">
                        <div>
                            <span className="text-gray-500 dark:text-gray-400 block text-xs">Total Duration (Calendar)</span>
                            <span className="font-bold text-lg">{calculationContext.totalDays} Days</span>
                        </div>
                        <div className="text-right">
                            <span className="text-gray-500 dark:text-gray-400 block text-xs">
                                Chargeable ({calculationContext.includeWeekends ? 'Incl' : 'Excl'}. W/E & Excl. PH)
                            </span>
                            <span className="font-bold text-lg text-brand-primary">{calculationContext.deductibleDays} Days</span>
                        </div>
                    </div>

                    {/* DETAILS SECTION */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                        <h3 className="text-sm font-bold mb-3 border-b dark:border-gray-600 pb-1">Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Leave Type</label>
                                <select value={draft.leaveTypeId} onChange={(e) => handleChange('leaveTypeId', e.target.value)} required className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                                    {(allLeaveTypes || []).map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                                </select>
                            </div>

                            <div>
                                {isSickLeave ? (
                                    <div className="flex items-start flex-col h-full justify-end pb-2">
                                        <label className="flex items-center cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={draft.medCertSubmitted}
                                                onChange={(e) => handleChange('medCertSubmitted', e.target.checked)}
                                                className="h-5 w-5 text-brand-primary rounded focus:ring-brand-primary"
                                            />
                                            <span className="ml-2 text-sm font-bold text-gray-700 dark:text-gray-200">Medical Certificate Submitted?</span>
                                        </label>
                                    </div>
                                ) : (
                                    <>
                                        <label className="block text-sm font-medium mb-2">Destination</label>
                                        <div className="flex gap-4 h-10 items-center">
                                            <label className="flex items-center cursor-pointer"><input type="radio" checked={draft.destination === 'local'} onChange={() => handleChange('destination', 'local')} className="h-4 w-4 text-brand-primary" /><span className="ml-2 text-sm">Local</span></label>
                                            <label className="flex items-center cursor-pointer"><input type="radio" checked={draft.destination === 'overseas'} onChange={() => handleChange('destination', 'overseas')} className="h-4 w-4 text-brand-primary" /><span className="ml-2 text-sm">Overseas</span></label>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm font-medium">{isSickLeave ? "Nature of Illness" : "Reason / Justification"}</label>
                            <input type="text" value={draft.justification} onChange={(e) => handleChange('justification', e.target.value)} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder={isSickLeave ? "e.g. Flu, Migraine..." : "Required for management review..."} />
                        </div>
                    </div>

                    {/* PUBLIC HOLIDAY CREDIT SECTION - Only for non-sick and non-PH leave */}
                    {!isSickLeave && !isPhLeaveType && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg space-y-4 shadow-inner">
                            <div className="flex justify-between items-center border-b dark:border-blue-800 pb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">📅</span>
                                    <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Public Holiday Credit</span>
                                </div>
                                <div className="text-right">
                                    <span className="block text-[10px] text-gray-500 uppercase font-bold">Accrued Balance</span>
                                    <span className="text-lg font-bold text-blue-700 dark:text-blue-400">{calculationContext.balance.toFixed(1)} Days</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">PH days to use:</label>
                                    <p className="text-[10px] text-gray-500 italic mt-0.5">Deducted from your accrued PH balance.</p>
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    max={Math.max(0, calculationContext.deductibleDays)}
                                    step="1"
                                    value={draft.phDaysApplied}
                                    onChange={(e) => handleChange('phDaysApplied', parseInt(e.target.value) || 0)}
                                    className="w-20 p-2 border rounded-md text-center font-bold text-blue-700 focus:ring-blue-500"
                                />
                            </div>

                            {draft.phDaysApplied > 0 && (
                                <div className="flex items-center justify-between gap-4 border-t border-blue-100 dark:border-blue-800 pt-3">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Apply PH Days at:</span>
                                    <div className="flex bg-white dark:bg-gray-800 rounded-md border border-blue-200 dark:border-blue-700 p-1">
                                        <button
                                            type="button"
                                            onClick={() => handleChange('phPosition', 'start')}
                                            className={`px-3 py-1 text-xs font-bold rounded ${draft.phPosition === 'start' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Start
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleChange('phPosition', 'end')}
                                            className={`px-3 py-1 text-xs font-bold rounded ${draft.phPosition === 'end' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            End
                                        </button>
                                    </div>
                                </div>
                            )}

                            {draft.phDaysApplied > 0 && (
                                <div className="bg-white dark:bg-gray-800 p-3 rounded border border-blue-100 dark:border-blue-900 text-xs space-y-2 animate-fade-in">
                                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                        <span>PH Period:</span>
                                        <span className="font-bold">{calculationContext.phEndDateDisplay}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                        <span>Leave Period:</span>
                                        <span className="font-bold">{calculationContext.leaveStartDateDisplay}</span>
                                    </div>
                                    <div className="pt-2 border-t dark:border-gray-700 flex justify-between text-sm">
                                        <span className="font-semibold text-blue-800 dark:text-blue-300">Net Annual Leave Deduction:</span>
                                        <span className="font-bold text-blue-900 dark:text-blue-200">{calculationContext.netAnnualDeduction} Days</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium">Emergency Contact Number</label>
                        <input type="text" value={draft.contactNumber} onChange={(e) => handleChange('contactNumber', e.target.value)} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="+248 ..." />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Internal Notes (Optional)</label>
                        <textarea value={draft.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={2} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="Additional info for roster office..."></textarea>
                    </div>
                </form>

                <div className="p-6 border-t dark:border-gray-700 flex justify-end space-x-4 bg-gray-50 dark:bg-gray-800/50 sm:rounded-b-lg">
                    <button type="button" onClick={handleClose} className="bg-gray-200 dark:bg-gray-600 py-2 px-4 rounded hover:bg-gray-300">Cancel</button>
                    <button onClick={handleSubmit} className="bg-brand-primary text-white py-2 px-6 rounded hover:bg-brand-secondary font-bold shadow-md">
                        {existingRequest ? 'Save Changes' : (managerMode ? 'Confirm Request' : 'Submit Application')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LeaveRequestModal;
