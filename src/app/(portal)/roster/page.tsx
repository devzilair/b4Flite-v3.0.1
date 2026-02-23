'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { RosterStatus, RosterEntry, RosterData, DepartmentSettings, ShiftCodeDefinition, RosterSnapshot } from '@/types';
import { generateAllDepartmentRosters } from '@/services/rosterGeneration';
import { dynamicValidateRoster } from '@/services/dynamicValidation';
import { formatMonthYear, isDatePublicHoliday } from '@/utils/dateUtils';
import RosterTable from '@/components/RosterTable';
import PilotRoster from '@/components/PilotRoster';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import useLocalStorage from '@/hooks/useLocalStorage';
import RosterStatsModal from '@/components/RosterStatsModal';
import MultiRosterPrintModal from '@/components/roster/MultiRosterPrintModal';
import { DraggableCodePalette } from '@/components/roster/DraggableCodePalette';
import DutySwapModal from '@/components/roster/DutySwapModal';
import SwapRequestsList from '@/components/roster/SwapRequestsList';
import { useRoster } from '@/hooks/useRoster';
import { useLeave } from '@/hooks/useLeave';
import { useStaff } from '@/hooks/useStaff';

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const RosterStatusBadge: React.FC<{ status: RosterStatus }> = ({ status }) => {
    const statusStyles: { [key in RosterStatus]: string } = {
        draft: 'bg-gray-200 text-gray-800',
        published: 'bg-blue-200 text-blue-800',
        locked: 'bg-red-200 text-red-800',
    };
    return (
        <span className={`px-2 py-0.5 text-xs font-bold rounded-full capitalize ${statusStyles[status]}`}>
            {status}
        </span>
    );
};

const STAFF_NOTES_ID = '__STAFF_NOTES__';

const RosterPage: React.FC = () => {
    const [storedDateStr, setStoredDateStr] = useLocalStorage<string>('roster_current_date', new Date().toISOString());
    const [selectedDepartmentId, setSelectedDepartmentId] = useLocalStorage<string>('roster_selected_dept', '');

    const currentDate = useMemo(() => new Date(storedDateStr), [storedDateStr]);
    const setCurrentDate = (date: Date) => setStoredDateStr(date.toISOString());

    const {
        staff, departments, loading: staffLoading
    } = useStaff();

    const {
        departmentSettings, validationRuleSets, publicHolidays, rosterViewTemplates, leaveTypes, updateDepartmentSettings, loading: settingsLoading
    } = useSettings();

    const {
        rosters: allRosters,
        rosterMetadata: allRosterMetaData,
        dutySwaps,
        loading: rosterLoading,
        upsertRosterData,
        upsertRosterMetadata
    } = useRoster();

    const {
        leaveRequests,
        loading: leaveLoading,
        addLeaveTransaction,
        deleteLeaveTransaction
    } = useLeave();

    const loading = staffLoading || rosterLoading || leaveLoading || settingsLoading;

    const { signIn } = useAuth();

    const [forceEdit, setForceEdit] = useState(false);
    const [localRosterData, setLocalRosterData] = useState<RosterData | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
    const [isMultiPrintOpen, setIsMultiPrintOpen] = useState(false);
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);

    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
    const [swapSourceDate, setSwapSourceDate] = useState('');
    const [isSwapListOpen, setIsSwapListOpen] = useState(false);

    const [isRefreshModalOpen, setIsRefreshModalOpen] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const { currentUser, can } = usePermissions();

    const viewableDepartments = useMemo(() => {
        if (!currentUser) return [];
        if (can('roster:view:all')) return departments;
        const viewableDeptIds = new Set<string>();
        if (can('roster:view:own_department')) viewableDeptIds.add(currentUser.departmentId);
        currentUser.rosterPermissions?.forEach(p => {
            if (p.level === 'view' || p.level === 'edit') viewableDeptIds.add(p.departmentId);
        });
        return departments.filter(d => viewableDeptIds.has(d.id));
    }, [currentUser, departments, can]);

    const hasBaseEditPermission = useMemo(() => {
        if (!currentUser || !selectedDepartmentId) return false;
        const individualPermission = currentUser.rosterPermissions?.find(p => p.departmentId === selectedDepartmentId);
        if (individualPermission?.level === 'edit') return true;
        if (can('roster:edit')) {
            if (can('roster:view:all')) return true;
            return currentUser.departmentId === selectedDepartmentId;
        }
        return false;
    }, [currentUser, selectedDepartmentId, can]);

    const year = currentDate.getUTCFullYear();
    const month = currentDate.getUTCMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const rosterMetaDataKey = `${selectedDepartmentId}_${monthKey}`;
    const draftStorageKey = useMemo(() => `roster_draft_${selectedDepartmentId}_${monthKey}`, [selectedDepartmentId, monthKey]);

    const nextMonthKey = useMemo(() => {
        const d = new Date(currentDate);
        d.setUTCMonth(d.getUTCMonth() + 1);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }, [currentDate]);

    // FIX: Create context for previous month to fix validation boundary issues
    const prevMonthKey = useMemo(() => {
        const d = new Date(Date.UTC(year, month - 1, 1));
        d.setUTCMonth(d.getUTCMonth() - 1);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }, [year, month]);

    const rawPrevMonthData = useMemo(() => allRosters[prevMonthKey]?.[selectedDepartmentId] || {}, [allRosters, prevMonthKey, selectedDepartmentId]);

    const currentSettings = useMemo(() => departmentSettings[selectedDepartmentId], [departmentSettings, selectedDepartmentId]);
    const dutyCodes = useMemo(() => currentSettings?.shiftCodes || [], [currentSettings]);
    const selectedDepartment = useMemo(() => departments.find(d => d.id === selectedDepartmentId), [departments, selectedDepartmentId]);
    const rosterTemplate = useMemo(() => selectedDepartment ? rosterViewTemplates.find(t => t.id === selectedDepartment.rosterViewTemplateId) : null, [selectedDepartment, rosterViewTemplates]);
    const isPilotMode = rosterTemplate?.type === 'pilot';

    const currentMetaData = allRosterMetaData[rosterMetaDataKey] || { status: 'draft', lastUpdated: '' };

    const currentLiveDepartmentStaff = useMemo(() => {
        const monthStart = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0];
        const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

        return staff.filter(s => {
            const isCorrectDept = s.departmentId === selectedDepartmentId;
            const isNotInternalAdmin = s.roleId !== 'role_admin' && s.roleId !== 'role_super_admin';
            const isActiveStatus = s.accountStatus !== 'disabled';

            // Contract date logic
            const contractStart = s.hrData?.contract?.startDate;
            const contractEnd = s.hrData?.contract?.endDate;

            // 1. Must have started on or before the end of this roster month
            const hasStarted = !contractStart || contractStart <= monthEnd;

            // 2. Must NOT have ended before the start of this roster month
            const hasEnded = contractEnd && contractEnd < monthStart;

            return isCorrectDept && isNotInternalAdmin && isActiveStatus && hasStarted && !hasEnded;
        });
    }, [staff, selectedDepartmentId, year, month]);

    const { visibleStaff, activeLayout } = useMemo(() => {
        const snapshot = currentMetaData.snapshot;
        if (snapshot && snapshot.staffIds && snapshot.staffIds.length > 0) {
            const snapshottedStaff = snapshot.staffIds.map(id => staff.find(s => s.id === id)).filter(Boolean) as any[];
            return {
                visibleStaff: snapshottedStaff,
                activeLayout: snapshot.layout || currentSettings?.pilotRosterLayout || []
            };
        }
        return {
            visibleStaff: currentLiveDepartmentStaff,
            activeLayout: currentSettings?.pilotRosterLayout || []
        };
    }, [currentMetaData.snapshot, currentLiveDepartmentStaff, currentSettings?.pilotRosterLayout, staff]);

    const pendingSwapCount = useMemo(() => {
        if (!currentUser) return 0;
        return dutySwaps.filter(s => {
            if (!s.date.startsWith(monthKey)) return false;
            if (hasBaseEditPermission && s.status === 'pending_manager' && s.departmentId === selectedDepartmentId) return true;
            if (s.targetStaffId === currentUser.id && s.status === 'pending_peer') return true;
            return false;
        }).length;
    }, [dutySwaps, monthKey, hasBaseEditPermission, selectedDepartmentId, currentUser]);

    const rawNextMonthData = useMemo(() => allRosters[nextMonthKey]?.[selectedDepartmentId] || {}, [allRosters, nextMonthKey, selectedDepartmentId]);

    const nextMonthData = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(rawNextMonthData));
        const approvedLeave = leaveRequests.filter(r => r.status === 'approved');
        if (approvedLeave.length === 0) return merged;
        const leaveTypeToShiftCodeMap = new Map<string, string>();
        dutyCodes.forEach(dc => {
            if (dc.leaveTypeId) leaveTypeToShiftCodeMap.set(dc.leaveTypeId, dc.id);
        });
        const lCodeId = dutyCodes.find(dc => dc.code === 'L')?.id;
        const offCodeId = dutyCodes.find(dc => dc.code === 'OFF')?.id;
        const genericLeaveCodeId = lCodeId || offCodeId;

        approvedLeave.forEach(req => {
            if (req.endDate < nextMonthKey) return;
            const staffId = req.staffId;
            const shiftCodeId = leaveTypeToShiftCodeMap.get(req.leaveTypeId) || genericLeaveCodeId;
            if (!shiftCodeId) return;
            let loopDate = new Date(req.startDate + 'T00:00:00Z');
            const endDate = new Date(req.endDate + 'T00:00:00Z');
            let safety = 0;
            while (loopDate <= endDate && safety < 366) {
                safety++;
                const dateStr = loopDate.toISOString().split('T')[0];
                if (dateStr.startsWith(nextMonthKey)) {
                    if (!merged[dateStr]) merged[dateStr] = {};
                    if (!merged[dateStr][staffId]) merged[dateStr][staffId] = {};
                    merged[dateStr][staffId].dutyCodeId = shiftCodeId;
                    merged[dateStr][staffId].isLeaveOverlay = true;
                }
                loopDate.setDate(loopDate.getDate() + 1);
            }
        });
        return merged;
    }, [rawNextMonthData, nextMonthKey, leaveRequests, dutyCodes]);

    const currentRosterStatus = currentMetaData.status;
    const lastUpdated = currentMetaData.lastUpdated;

    const canEditRoster = useMemo(() => {
        if (!hasBaseEditPermission) return false;
        if (can('roster:force_edit') && forceEdit) return true;
        return currentRosterStatus !== 'locked';
    }, [hasBaseEditPermission, currentRosterStatus, forceEdit, can]);

    const isRosterVisible = useMemo(() => {
        if (currentRosterStatus !== 'draft') return true;
        return hasBaseEditPermission || can('roster:view:all');
    }, [currentRosterStatus, hasBaseEditPermission, can]);

    useEffect(() => {
        if (viewableDepartments.length > 0) {
            if (!selectedDepartmentId || !viewableDepartments.some(d => d.id === selectedDepartmentId)) {
                const userDept = viewableDepartments.find(d => d.id === currentUser?.departmentId);
                setSelectedDepartmentId(userDept?.id || viewableDepartments[0].id);
            }
        }
    }, [viewableDepartments, currentUser, selectedDepartmentId, setSelectedDepartmentId]);

    useEffect(() => {
        if (hasUnsavedChanges) return;
        const savedDraft = localStorage.getItem(draftStorageKey);
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                if (parsed && typeof parsed === 'object') {
                    setLocalRosterData(parsed);
                    setHasUnsavedChanges(true);
                    return;
                }
            } catch (e) {
                console.warn("Failed to parse roster draft from storage", e);
                localStorage.removeItem(draftStorageKey);
            }
        }
        const dbData = allRosters[monthKey]?.[selectedDepartmentId];
        if (dbData) {
            setLocalRosterData(JSON.parse(JSON.stringify(dbData)));
        } else {
            const dept = departments.find(d => d.id === selectedDepartmentId);
            if (dept) {
                const initialData = generateAllDepartmentRosters(year, month, [dept])[selectedDepartmentId];
                setLocalRosterData(initialData);
            }
        }
    }, [allRosters, monthKey, selectedDepartmentId, departments, year, month, hasUnsavedChanges, draftStorageKey]);

    useEffect(() => {
        if (hasUnsavedChanges && localRosterData) {
            localStorage.setItem(draftStorageKey, JSON.stringify(localRosterData));
        } else if (!hasUnsavedChanges && localRosterData) {
            localStorage.removeItem(draftStorageKey);
        }
    }, [localRosterData, hasUnsavedChanges, draftStorageKey]);

    const baseRosterData = localRosterData || {};

    const displayRosterData = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(baseRosterData));
        const approvedLeave = leaveRequests.filter(r => r.status === 'approved');
        if (approvedLeave.length === 0) return merged;
        const leaveTypeToShiftCodeMap = new Map<string, string>();
        dutyCodes.forEach(dc => {
            if (dc.leaveTypeId) leaveTypeToShiftCodeMap.set(dc.leaveTypeId, dc.id);
        });
        const lCodeId = dutyCodes.find(dc => dc.code === 'L')?.id;
        const offCodeId = dutyCodes.find(dc => dc.code === 'OFF')?.id;
        const genericLeaveCodeId = lCodeId || offCodeId;
        approvedLeave.forEach(req => {
            const staffId = req.staffId;
            const shiftCodeId = leaveTypeToShiftCodeMap.get(req.leaveTypeId) || genericLeaveCodeId;
            if (!shiftCodeId) return;
            let loopDate = new Date(req.startDate + 'T00:00:00Z');
            const endDate = new Date(req.endDate + 'T00:00:00Z');
            let safety = 0;
            while (loopDate <= endDate && safety < 366) {
                safety++;
                const dateStr = loopDate.toISOString().split('T')[0];
                if (!merged[dateStr]) merged[dateStr] = {};
                if (!merged[dateStr][staffId]) merged[dateStr][staffId] = {};
                merged[dateStr][staffId].dutyCodeId = shiftCodeId;
                merged[dateStr][staffId].isLeaveOverlay = true;
                loopDate.setDate(loopDate.getDate() + 1);
            }
        });
        return merged;
    }, [baseRosterData, leaveRequests, dutyCodes]);

    const handleUpdateRosterMetaData = (newStatus?: RosterStatus) => {
        const snapshot: RosterSnapshot = {
            staffIds: visibleStaff.map(s => s.id),
            layout: isPilotMode ? activeLayout : undefined
        };
        const newMeta = {
            status: newStatus || currentMetaData.status,
            lastUpdated: new Date().toISOString(),
            snapshot: snapshot
        };
        upsertRosterMetadata(rosterMetaDataKey, newMeta);
    };

    const handleRefreshSnapshotClick = () => {
        setConfirmPassword('');
        setAuthError(null);
        setIsRefreshModalOpen(true);
    };

    const performSnapshotRefresh = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.email) return;
        setIsVerifying(true);
        setAuthError(null);
        try {
            const { error } = await signIn(currentUser.email, confirmPassword);
            if (error) {
                setAuthError("Incorrect password.");
                setIsVerifying(false);
                return;
            }
            const liveStaffIds = currentLiveDepartmentStaff.map(s => s.id);
            const liveLayout = currentSettings?.pilotRosterLayout;
            const snapshot: RosterSnapshot = {
                staffIds: liveStaffIds,
                layout: isPilotMode ? liveLayout : undefined
            };
            const newMeta = {
                ...currentMetaData,
                lastUpdated: new Date().toISOString(),
                snapshot: snapshot
            };
            await upsertRosterMetadata(rosterMetaDataKey, newMeta);
            setIsRefreshModalOpen(false);
        } catch (e) {
            console.error("Failed to refresh snapshot", e);
            setAuthError("Failed to update snapshot. Please try again.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleStatusChange = (newStatus: RosterStatus) => {
        handleUpdateRosterMetaData(newStatus);
    };

    // Helper to validate with previous month context
    const getValidatedDataForCurrentMonth = (currentMonthData: RosterData, targetId?: string) => {
        // 1. Merge Previous + Current
        // We assume rawPrevMonthData is static and doesn't contain pending edits, which is generally true/safe.
        const combinedData = { ...rawPrevMonthData, ...currentMonthData };

        // 2. Rules Setup
        const department = departments.find(d => d.id === selectedDepartmentId);
        const legacyRuleSetId = department?.validationRuleSetId;
        const settingRuleSetIds = currentSettings?.rosterSettings?.validationRuleSetIds || [];
        const allRuleSetIds = new Set<string>();
        if (legacyRuleSetId) allRuleSetIds.add(legacyRuleSetId);
        settingRuleSetIds.forEach(id => allRuleSetIds.add(id));
        const activeRules = validationRuleSets.filter(rs => allRuleSetIds.has(rs.id)).flatMap(rs => rs.rules);

        // 3. Run Validation on the Combined Data (Prev + Current)
        // This allows rules like "7 consecutive days" to see back into the previous month.
        const validatedCombined = dynamicValidateRoster(combinedData, visibleStaff, dutyCodes, activeRules, targetId);

        // 4. Extract only current month violations and apply to a clean copy of current data
        const resultData = JSON.parse(JSON.stringify(currentMonthData));

        Object.keys(resultData).forEach(date => {
            // We only care about dates in the current roster
            Object.keys(resultData[date]).forEach(sId => {
                // If we targeted specific staff, only update them. If targetId is undefined, update all.
                if (!targetId || targetId === sId) {
                    const violation = validatedCombined[date]?.[sId]?.violation;
                    if (violation) {
                        resultData[date][sId].violation = violation;
                    } else {
                        delete resultData[date][sId].violation;
                    }
                }
            });
        });

        return resultData;
    };

    const handleSaveChanges = async () => {
        if (!localRosterData) return;
        setIsSaving(true);
        try {
            // Perform full validation with context
            const validatedRoster = getValidatedDataForCurrentMonth(displayRosterData);

            const finalSaveData = JSON.parse(JSON.stringify(localRosterData));

            Object.keys(validatedRoster).forEach(date => {
                if (!date.startsWith(monthKey)) return;
                Object.keys(validatedRoster[date]).forEach(staffId => {
                    if (validatedRoster[date][staffId].violation) {
                        if (!finalSaveData[date]) finalSaveData[date] = {};
                        if (!finalSaveData[date][staffId]) finalSaveData[date][staffId] = {};
                        finalSaveData[date][staffId].violation = validatedRoster[date][staffId].violation;
                    } else if (finalSaveData[date]?.[staffId]) {
                        delete finalSaveData[date][staffId].violation;
                    }
                });
            });
            await upsertRosterData(monthKey, selectedDepartmentId, finalSaveData);
            handleUpdateRosterMetaData();
            setHasUnsavedChanges(false);
            localStorage.removeItem(draftStorageKey);
            setLocalRosterData(finalSaveData);
        } catch (error) {
            alert('Failed to save roster. Please try again.');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscardChanges = () => {
        if (window.confirm("Discard all unsaved changes?")) {
            setHasUnsavedChanges(false);
            localStorage.removeItem(draftStorageKey);
            const dbData = allRosters[monthKey]?.[selectedDepartmentId];
            const dept = departments.find(d => d.id === selectedDepartmentId);
            if (dbData) setLocalRosterData(JSON.parse(JSON.stringify(dbData)));
            else if (dept) setLocalRosterData(generateAllDepartmentRosters(year, month, [dept])[selectedDepartmentId]);
        }
    };

    const handleCellUpdate = (staffId: string, date: string, newEntryData: Partial<RosterEntry>) => {
        handleBatchCellUpdates([{ staffId, date, newEntry: newEntryData }]);
    };

    const handleInitiateSwap = (date: string) => {
        setSwapSourceDate(date);
        setIsSwapModalOpen(true);
    };

    const handleBatchCellUpdates = (updates: { staffId: string, date: string, newEntry: Partial<RosterEntry> }[]) => {
        if (!localRosterData) return;
        let newRoster = JSON.parse(JSON.stringify(localRosterData));
        const currentMonthUpdates: typeof updates = [];
        const nextMonthUpdates: typeof updates = [];

        updates.forEach(u => {
            if (u.date.startsWith(monthKey) || u.date === STAFF_NOTES_ID) currentMonthUpdates.push(u);
            else if (u.date.startsWith(nextMonthKey)) nextMonthUpdates.push(u);
        });

        currentMonthUpdates.forEach(({ staffId, date, newEntry }) => {
            const oldEntry = newRoster?.[date]?.[staffId];
            if (date !== STAFF_NOTES_ID) {
                handlePublicHolidayAccrual(staffId, date, oldEntry, newEntry);

                // Only attempt manual leave sync if update count is small to prevent API flooding
                if (updates.length < 10) {
                    handleManualLeaveSync(staffId, date, oldEntry, newEntry);
                }
            }
            if (!newRoster[date]) newRoster[date] = {};
            if (!newRoster[date][staffId]) newRoster[date][staffId] = { dutyCodeId: '' };
            newRoster[date][staffId] = { ...newRoster[date][staffId], ...newEntry };
        });

        if (nextMonthUpdates.length > 0) {
            const nextMonthRoster = JSON.parse(JSON.stringify(rawNextMonthData));
            nextMonthUpdates.forEach(({ staffId, date, newEntry }) => {
                const oldEntry = nextMonthRoster?.[date]?.[staffId];
                handlePublicHolidayAccrual(staffId, date, oldEntry, newEntry);

                // Only attempt manual leave sync if update count is small to prevent API flooding
                if (updates.length < 10) {
                    handleManualLeaveSync(staffId, date, oldEntry, newEntry);
                }

                if (!nextMonthRoster[date]) nextMonthRoster[date] = {};
                if (!nextMonthRoster[date][staffId]) nextMonthRoster[date][staffId] = { dutyCodeId: '' };
                nextMonthRoster[date][staffId] = { ...nextMonthRoster[date][staffId], ...newEntry };
            });
            upsertRosterData(nextMonthKey, selectedDepartmentId, nextMonthRoster);
        }

        if (currentMonthUpdates.length > 0) {
            // Performance Optimization: If updating only one person, use targeted validation
            const targetStaffId = currentMonthUpdates.length === 1 ? currentMonthUpdates[0].staffId : undefined;

            // Use the new context-aware validator
            const validatedRoster = getValidatedDataForCurrentMonth(newRoster, targetStaffId);

            setLocalRosterData(validatedRoster);
            setHasUnsavedChanges(true);
        }
    };

    const handleManualLeaveSync = (staffId: string, date: string, oldEntry: RosterEntry | undefined, newEntry: Partial<RosterEntry>) => {
        const hasRequestOverlay = leaveRequests.some(r => r.staffId === staffId && r.status === 'approved' && date >= r.startDate && date <= r.endDate);
        const manualTxId = `manual_l_deduction_${staffId}_${date}`;
        if (hasRequestOverlay) {
            deleteLeaveTransaction(manualTxId);
            return;
        }
        const isOffDutyCode = (codeId?: string): ShiftCodeDefinition | undefined => {
            if (!codeId) return undefined;
            return dutyCodes.find(c => c.id === codeId);
        };
        const oldCode = isOffDutyCode(oldEntry?.dutyCodeId);
        const newCodeId = newEntry.dutyCodeId !== undefined ? newEntry.dutyCodeId : oldEntry?.dutyCodeId;
        const newCode = isOffDutyCode(newCodeId);
        if (oldCode?.leaveTypeId) {
            deleteLeaveTransaction(manualTxId);
        }
        const dateObj = new Date(date + 'T00:00:00Z');
        const isWeekend = dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6;
        const isPH = isDatePublicHoliday(dateObj, publicHolidays);
        const includeWeekends = currentSettings?.rosterSettings?.includeWeekendsInLeave || false;
        let isChargeable = !isPH;
        if (!includeWeekends && isWeekend) isChargeable = false;
        if (newCode?.leaveTypeId && isChargeable) {
            addLeaveTransaction({
                id: manualTxId,
                staffId,
                leaveTypeId: newCode.leaveTypeId,
                transactionType: 'leave_taken',
                date,
                amount: -1,
                notes: `Manual Roster Entry (${newCode.code})`
            });
        }
    };

    const handlePublicHolidayAccrual = (staffId: string, date: string, oldEntry: RosterEntry | undefined, newEntry: Partial<RosterEntry>) => {
        const dateObj = new Date(date + 'T00:00:00Z');
        const isPH = isDatePublicHoliday(dateObj, publicHolidays);
        if (!isPH) return;
        const staffMember = staff.find(s => s.id === staffId);
        if (!staffMember) return;
        const phLeaveType = leaveTypes.find(lt => lt.name.toLowerCase().includes('public holiday'));
        if (!phLeaveType) return;
        const isOffDuty = (codeId?: string) => !codeId || (dutyCodes.find(c => c.id === codeId)?.isOffDuty ?? true);
        const newCodeId = newEntry.dutyCodeId !== undefined ? newEntry.dutyCodeId : oldEntry?.dutyCodeId;
        const oldIsOff = isOffDuty(oldEntry?.dutyCodeId);
        const newIsOff = isOffDuty(newCodeId);
        const transactionId = `ltx_ph_${staffId}_${date}`;
        if (oldIsOff && !newIsOff) {
            addLeaveTransaction({ id: transactionId, staffId, leaveTypeId: phLeaveType.id, transactionType: 'adjustment', date, amount: 1, notes: `PH Accrual for ${date}` });
        } else if (!oldIsOff && newIsOff) {
            deleteLeaveTransaction(transactionId);
        }
    };

    const handlePilotNotesUpdate = (newNotes: { id: string; text: string }[]) => {
        const newDeptSettings = JSON.parse(JSON.stringify(currentSettings));
        if (newDeptSettings.pilotRosterSettings) newDeptSettings.pilotRosterSettings.notes = newNotes;
        updateDepartmentSettings(newDeptSettings, selectedDepartmentId);
    };

    const handleDeptChange = (newDeptId: string) => {
        if (hasUnsavedChanges) {
            if (!window.confirm("Unsaved changes will be lost. Continue?")) return;
            setHasUnsavedChanges(false);
            localStorage.removeItem(draftStorageKey);
        }
        setSelectedDepartmentId(newDeptId);
    };

    const handleMonthChange = (newDate: Date) => {
        if (hasUnsavedChanges) {
            if (!window.confirm("Unsaved changes will be lost. Continue?")) return;
            setHasUnsavedChanges(false);
            localStorage.removeItem(draftStorageKey);
        }
        setCurrentDate(newDate);
    }

    const handleInitializeSettings = () => {
        const defaultSettings: DepartmentSettings = {
            rosterSettings: {
                columnWidth: { value: 50, unit: 'px' },
                rowHeight: { value: 3, unit: 'ch' },
                showSubDepartment: true,
                weekendHighlightColor: '#fffde7',
                rosterGroups: [],
                groupHeaderWidth: { value: 120, unit: 'px' },
                staffMemberColWidth: { value: 200, unit: 'px' },
            },
            shiftCodes: [],
            leaveAccrualPolicies: [],
            pilotRosterLayout: [],
            pilotRosterSettings: {
                columnWidth: { value: 70, unit: 'px' },
                rowHeight: { value: 3, unit: 'ch' },
                statisticsColumns: [
                    { id: 'heli_pilots', label: 'Heli Pilots', visible: true },
                    { id: 'off', label: 'OFF', visible: true },
                    { id: 'ph', label: 'PH', visible: true },
                ]
            }
        };
        updateDepartmentSettings(defaultSettings, selectedDepartmentId);
    };

    const monthsList = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentYearNum = new Date().getFullYear();
    const yearsList = Array.from({ length: 11 }, (_, i) => currentYearNum - 5 + i);

    const isValidDepartment = useMemo(() => departments.some(d => d.id === selectedDepartmentId), [departments, selectedDepartmentId]);

    if (loading) return <div className="flex justify-center items-center h-64">Loading...</div>;
    if (!isValidDepartment) return <div className="text-center p-12">No viewable departments.</div>;

    if (!currentSettings) {
        return (
            <div className="text-center p-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed m-6">
                <h3 className="text-lg font-medium mb-2">Configuration Missing</h3>
                {can('admin:edit_roster_settings') ? (
                    <button onClick={handleInitializeSettings} className="bg-brand-primary text-white py-2 px-6 rounded-md">Initialize Default Settings</button>
                ) : (
                    <p className="text-sm text-gray-400">Contact admin to initialize.</p>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-0 sm:p-6 rounded-none sm:rounded-lg shadow-none sm:shadow-xl print:shadow-none print:p-0 flex flex-col h-full print:h-auto print:block">
            <div className="flex flex-col gap-4 p-4 sm:p-0 print:hidden flex-shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Roster</h1>
                        {hasUnsavedChanges && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full animate-fade-in">
                                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                                <span className="text-amber-800 text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Unsaved Draft</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        {hasUnsavedChanges && (
                            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 p-1 rounded-md border border-green-200 dark:border-green-800 animate-fade-in shadow-sm w-full sm:w-auto justify-between sm:justify-start">
                                <button onClick={handleSaveChanges} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 px-4 rounded shadow-sm disabled:opacity-50 transition-colors flex items-center gap-2 flex-grow sm:flex-grow-0 justify-center">
                                    {isSaving ? <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : 'Save'}
                                </button>
                                <button onClick={handleDiscardChanges} disabled={isSaving} className="bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 text-xs font-bold py-2 px-3 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">Discard</button>
                            </div>
                        )}
                        <div className="relative flex-grow sm:flex-grow-0 sm:w-48">
                            <select value={selectedDepartmentId} onChange={e => handleDeptChange(e.target.value)} className="appearance-none w-full bg-gray-200 dark:bg-gray-700 border text-gray-700 dark:text-gray-200 py-1.5 sm:py-2 px-3 rounded-md leading-tight text-sm">
                                {viewableDepartments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-md p-1 flex-shrink-0">
                            <select value={currentDate.getUTCMonth()} onChange={(e) => {
                                const newDate = new Date(currentDate);
                                newDate.setUTCDate(1); // Fix 31st bug: force day to 1 before switching month
                                newDate.setUTCMonth(parseInt(e.target.value));
                                handleMonthChange(newDate);
                            }} className="bg-transparent border-none text-sm font-medium text-gray-800 dark:text-white py-0.5 px-1 cursor-pointer">
                                {monthsList.map((m, i) => <option key={m} value={i}>{m.substring(0, 3)}</option>)}
                            </select>
                            <select value={currentDate.getUTCFullYear()} onChange={(e) => {
                                const newDate = new Date(currentDate);
                                newDate.setUTCDate(1); // Fix 31st bug
                                newDate.setUTCFullYear(parseInt(e.target.value));
                                handleMonthChange(newDate);
                            }} className="bg-transparent border-none text-sm font-medium text-gray-800 dark:text-white py-0.5 px-1 cursor-pointer">
                                {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {canEditRoster && (
                        <button onClick={() => setIsPaletteOpen(!isPaletteOpen)} className={`p-2 rounded-md transition-colors flex-shrink-0 ${isPaletteOpen ? 'bg-brand-primary text-white shadow-inner' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`} title="Open Tools Palette">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </button>
                    )}
                    <button onClick={() => setIsSwapListOpen(true)} className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-sm py-1.5 px-3 rounded-md relative hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors flex-shrink-0 flex items-center gap-1" title="Manage Duty Swaps">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        <span className="hidden sm:inline">Swaps</span>
                        {pendingSwapCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">{pendingSwapCount}</span>}
                    </button>
                    <button onClick={() => setIsStatsModalOpen(true)} className="bg-brand-secondary text-white text-xs sm:text-sm py-1.5 px-3 rounded-md flex-shrink-0">Stats</button>
                    <div className="flex bg-gray-600 rounded-md overflow-hidden flex-shrink-0 ml-auto">
                        <button onClick={() => window.print()} className="bg-gray-600 text-white text-xs sm:text-sm py-1.5 px-3 hover:bg-gray-700 transition-colors">Print</button>
                        <div className="w-px bg-gray-500"></div>
                        <button onClick={() => setIsMultiPrintOpen(true)} className="bg-gray-600 text-white text-xs sm:text-sm py-1.5 px-3 hover:bg-gray-700 transition-colors" title="Print Multiple Departments">Multi</button>
                    </div>
                    {can('admin:view_settings') && <Link href="/admin?tab=roster" className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300 flex-shrink-0"><SettingsIcon /></Link>}
                </div>
            </div>

            <div className="flex flex-wrap justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md mb-2 sm:mb-4 gap-2 print:hidden flex-shrink-0 text-sm mx-4 sm:mx-0">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs sm:text-sm">Status:</span>
                    <RosterStatusBadge status={currentRosterStatus} />
                    {currentMetaData.snapshot && (
                        <div className="flex items-center gap-1 ml-2 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded border border-gray-300 dark:border-gray-500">
                            <span className="text-xs text-gray-600 dark:text-gray-300 font-medium" title="Roster view is locked to historical staff list">🔒 Snapshot Active</span>
                            {canEditRoster && <button onClick={handleRefreshSnapshotClick} className="ml-1 text-gray-500 hover:text-brand-primary dark:hover:text-white transition-colors" title="Refresh Snapshot: Sync with current staff list & settings"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>}
                        </div>
                    )}
                </div>
                {hasBaseEditPermission && (
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {currentRosterStatus === 'draft' && can('roster:publish') && <button onClick={() => handleStatusChange('published')} className="bg-blue-500 text-white text-xs sm:text-sm py-1 px-3 rounded-md">Publish</button>}
                        {currentRosterStatus === 'published' && can('roster:lock') && <button onClick={() => handleStatusChange('locked')} className="bg-red-500 text-white text-xs sm:text-sm py-1 px-3 rounded-md">Lock</button>}
                        {can('roster:force_edit') && currentRosterStatus === 'locked' && (
                            <label className="flex items-center text-sm bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                                <input type="checkbox" checked={forceEdit} onChange={(e) => setForceEdit(e.target.checked)} className="h-4 w-4" />
                                <span className="ml-2 text-xs font-medium">Force Edit</span>
                            </label>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative print:overflow-visible print:h-auto print:block">
                {isRosterVisible ? (
                    <>
                        <DraggableCodePalette codes={dutyCodes} isOpen={isPaletteOpen && canEditRoster} onClose={() => setIsPaletteOpen(false)} />
                        {isPilotMode ? (
                            <PilotRoster currentDate={currentDate} staff={visibleStaff} dutyCodes={dutyCodes} rosterData={displayRosterData} settings={currentSettings.pilotRosterSettings} layout={activeLayout} onCellUpdate={handleCellUpdate} onBatchUpdate={handleBatchCellUpdates} onNotesUpdate={handlePilotNotesUpdate} canEditRoster={canEditRoster} lastUpdated={lastUpdated} onSwapRequest={handleInitiateSwap} />
                        ) : (
                            <RosterTable currentDate={currentDate} staff={visibleStaff} dutyCodes={dutyCodes} rosterData={displayRosterData} nextMonthData={nextMonthData} settings={currentSettings.rosterSettings} onCellUpdate={handleCellUpdate} onBatchUpdate={handleBatchCellUpdates} canEditRoster={canEditRoster} publicHolidays={publicHolidays} onSwapRequest={handleInitiateSwap} />
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                        <div className="text-6xl mb-4">🚧</div>
                        <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300">Planning in Progress</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md">The roster for {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })} is currently being drafted by the department manager.</p>
                        <p className="text-sm text-gray-400 mt-4">Please check back later.</p>
                    </div>
                )}
            </div>

            {isStatsModalOpen && (
                <RosterStatsModal isOpen={isStatsModalOpen} onClose={() => setIsStatsModalOpen(false)} currentDate={currentDate} staff={visibleStaff} rosterData={displayRosterData} dutyCodes={dutyCodes} departmentName={selectedDepartment?.name || 'Department'} />
            )}

            {isMultiPrintOpen && (
                <MultiRosterPrintModal isOpen={isMultiPrintOpen} onClose={() => setIsMultiPrintOpen(false)} currentDate={currentDate} initialDeptId={selectedDepartmentId} />
            )}

            {isSwapModalOpen && currentUser && (
                <DutySwapModal isOpen={isSwapModalOpen} onClose={() => setIsSwapModalOpen(false)} date={swapSourceDate} currentUser={currentUser} departmentStaff={visibleStaff} dutyCode={dutyCodes.find(c => c.id === displayRosterData[swapSourceDate]?.[currentUser.id]?.dutyCodeId)} />
            )}

            {isSwapListOpen && (
                <SwapRequestsList isOpen={isSwapListOpen} onClose={() => setIsSwapListOpen(false)} currentMonthKey={monthKey} rosterData={displayRosterData} dutyCodes={dutyCodes} departmentId={selectedDepartmentId} />
            )}

            {isRefreshModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Confirm Snapshot Refresh</h2>
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded border border-red-200 dark:border-red-800 mb-4 text-sm text-red-800 dark:text-red-200">
                            <p className="font-bold mb-2">Warning: Permanent Action</p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>This will update the historical view to match the <strong>CURRENT</strong> staff list and layout.</li>
                                <li>Staff no longer matching criteria will be <strong>hidden</strong> from this roster.</li>
                                <li>New staff matching criteria will <strong>appear</strong>.</li>
                            </ul>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Please enter your password to confirm this action.</p>
                        <form onSubmit={performSnapshotRefresh}>
                            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600 mb-4 focus:ring-2 focus:ring-brand-primary outline-none" placeholder="Enter password" autoFocus />
                            {authError && <p className="text-sm text-red-600 mb-4 font-medium">{authError}</p>}
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsRefreshModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded">Cancel</button>
                                <button type="submit" disabled={isVerifying || !confirmPassword} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold shadow-sm disabled:opacity-50">{isVerifying ? 'Verifying...' : 'Confirm Refresh'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RosterPage;
