'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table';
import { FlightLogRecord, Staff } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import { formatMonthYear } from '@/utils/dateUtils';
import { FTL_LIMITS, decimalToTime } from '@/services/ftlCalculations';
import SummaryCards from '@/components/duty/SummaryCards';
import CalculationBreakdownModal from '@/components/duty/CalculationBreakdownModal';
import AircraftHoursModal from '@/components/duty/AircraftHoursModal';
import DutyRecordForm from '@/components/duty/DutyRecordForm';
import { BufferedInput } from '@/components/common/BufferedInput';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useFlightLog } from '@/hooks/useFlightLog';
import { useStaff } from '@/hooks/useStaff';
import { useSettings } from '@/hooks/useSettings';
import { useDutyCalculations, MonthlyDayRecord } from '@/hooks/useDutyCalculations';

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null) {
        if ('message' in error) return String((error as any).message);
        if ('error' in error) return String((error as any).error);
        try {
            return JSON.stringify(error);
        } catch {
            return '[Unknown Error Object]';
        }
    }
    return String(error);
};

const SaveStatusBadge: React.FC<{ status: 'saved' | 'pending' | 'saving' | 'error' }> = ({ status }) => {
    switch (status) {
        case 'saving':
            return (
                <span className="flex items-center text-blue-600 dark:text-blue-400 text-xs sm:text-sm font-medium animate-pulse">
                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">Saving...</span>
                </span>
            );
        case 'pending':
            return <span className="text-amber-600 dark:text-amber-400 text-[10px] sm:text-sm font-bold bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded">Unsaved</span>;
        case 'error':
            return <span className="text-red-600 text-xs sm:text-sm font-bold">⚠️ Error</span>;
        default:
            return (
                <span className="hidden sm:flex items-center text-green-600 dark:text-green-400 text-xs font-medium">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path></svg>
                    Saved
                </span>
            );
    }
};

const getLimitClass = (value: number | undefined, limit: number | undefined): string => {
    if (limit === undefined || value === undefined || value === 0) return '';
    const percentage = (value / limit) * 100;
    if (percentage >= 100) return 'text-status-danger font-bold';
    if (percentage >= 80) return 'text-status-warning font-semibold';
    return '';
};

export default function DutyLogPage() {
    const { currentUser, can } = usePermissions();
    const { staff: staffList, loading: staffLoading } = useStaff();
    const { aircraftTypes, loading: settingsLoading } = useSettings();
    const { flightLogRecords, saveFlightLogs, loading: flightLoading } = useFlightLog();
    const loading = staffLoading || settingsLoading || flightLoading;

    const router = useRouter();
    const [currentDate, setCurrentDate] = useState(() => {
        const now = new Date();
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    });

    const [selectedPilotId, setSelectedPilotId] = useLocalStorage<string>('duty_log_selected_pilot', currentUser?.id || '');

    // MODAL STATE
    const [breakdownModalData, setBreakdownModalData] = useState<MonthlyDayRecord | null>(null);
    const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);
    const [editingHoursIndex, setEditingHoursIndex] = useState<number | null>(null);
    const [editingRecord, setEditingRecord] = useLocalStorage<MonthlyDayRecord | null>('duty_editing_record', null);

    // MOBILE VIEW TOGGLE
    const [showStats, setShowStats] = useState(false);

    // SCROLL REFS
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [tableWidth, setTableWidth] = useState(0);

    const canAccess = can('roster:view:all') || can('duty_log:view_all') || can('duty_log:view_own') || currentUser?.departmentId === 'dept_pilots';
    const canViewReports = can('admin:view_settings') || can('crew_records:manage_all') || can('roster:view:all');

    const viewablePilots = useMemo(() => {
        const hasGlobalView = can('roster:view:all') || can('duty_log:view_all');
        const canViewDept = can('staff:view:own_department');

        return staffList.filter(s => {
            if (s.accountStatus === 'disabled') return false;
            if (!s.pilotData) return false;
            const hasCategories = Array.isArray(s.pilotData.aircraftCategory) && s.pilotData.aircraftCategory.length > 0;
            if (!hasCategories) return false;
            if (hasGlobalView) return true;
            if (canViewDept && s.departmentId === currentUser?.departmentId) return true;
            if (s.id === currentUser?.id) return true;
            return false;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [staffList, can, currentUser]);

    useEffect(() => {
        if (currentUser && viewablePilots.length > 0) {
            if (!selectedPilotId || !viewablePilots.some(p => p.id === selectedPilotId)) {
                const selfInList = viewablePilots.find(p => p.id === currentUser.id);
                setSelectedPilotId(selfInList ? selfInList.id : viewablePilots[0].id);
            }
        }
    }, [viewablePilots, currentUser, selectedPilotId, setSelectedPilotId]);

    const selectedPilot = useMemo(() => staffList.find(s => s.id === selectedPilotId), [staffList, selectedPilotId]);

    const availableAircraftForPilot = useMemo(() => {
        if (!selectedPilot?.pilotData?.aircraftTypes) return aircraftTypes;
        const pilotRatings = new Set(selectedPilot.pilotData.aircraftTypes);
        return aircraftTypes.filter(at => pilotRatings.has(at.id));
    }, [selectedPilot, aircraftTypes]);

    // --- USE CUSTOM HOOK FOR LOGIC ---
    const {
        monthlyData,
        setMonthlyData,
        isLoading,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        saveStatus,
        setSaveStatus,
        handleInputChange,
        handleDayOffToggle,
        loadMonthData,
        recalculateMonth, // Need this for modal saves
        stats
    } = useDutyCalculations(selectedPilotId, flightLogRecords, currentDate, selectedPilot);

    // Initial Load
    useEffect(() => {
        if (selectedPilotId && canAccess && !hasUnsavedChanges) {
            loadMonthData();
        }
    }, [selectedPilotId, canAccess, currentDate, flightLogRecords.length]); // Re-load if records change externally or params change

    // Sync scroll helper
    useEffect(() => {
        if (tableContainerRef.current) setTableWidth(tableContainerRef.current.scrollWidth);
    }, [monthlyData, isLoading]);

    const handleTopScroll = () => { if (topScrollRef.current && tableContainerRef.current) tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft; };
    const handleTableScroll = () => { if (topScrollRef.current && tableContainerRef.current) topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft; };

    // --- MODAL & SPECIAL HANDLERS (That still need access to hook internals) ---

    const handleHoursModalSave = (hours: { [key: string]: number }) => {
        if (editingHoursIndex === null) return;
        setHasUnsavedChanges(true);
        setSaveStatus('pending');

        const rawInputs = monthlyData.map((d, i) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { metrics, isDayOff, flightDuration, actualFdp, maxFdp, fdpExtension, breakDuration, maxFlightTime, disruptive, rest, daysOffValidation, standby, ...raw } = d;
            if (i === editingHoursIndex) {
                return { ...raw, flightHoursByAircraft: hours };
            }
            return raw;
        });

        // Re-calculate
        const year = currentDate.getUTCFullYear();
        const month = currentDate.getUTCMonth();
        const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        const historicRecords = flightLogRecords
            .filter(r => r.staffId === selectedPilotId && !r.date.startsWith(currentMonthPrefix))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const calculatedData = recalculateMonth(rawInputs, historicRecords, selectedPilot);
        setMonthlyData(calculatedData);
        setIsHoursModalOpen(false);
        setEditingHoursIndex(null);
    };

    const handleSaveAll = async () => {
        if (!selectedPilotId) return;
        setSaveStatus('saving');
        const year = currentDate.getUTCFullYear();
        const month = currentDate.getUTCMonth() + 1;
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const recordsToSave = monthlyData.map(d => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { metrics, isDayOff, flightDuration, actualFdp, maxFdp, fdpExtension, breakDuration, maxFlightTime, disruptive, rest, daysOffValidation, standby, ...cleanRecord } = d;
            return {
                ...cleanRecord,
                id: cleanRecord.id || `fd_${Date.now()}_${Math.random()}`,
                staffId: selectedPilotId,
                sectors: ((cleanRecord.sectors as unknown as string) === '' || cleanRecord.sectors === undefined || cleanRecord.sectors === null) ? null : cleanRecord.sectors,
            } as FlightLogRecord;
        });
        try {
            await saveFlightLogs(recordsToSave, selectedPilotId, monthKey);
            setSaveStatus('saved');
            setHasUnsavedChanges(false);
        } catch (error: any) {
            console.error(error);
            setSaveStatus('error');
            const msg = getErrorMessage(error);
            alert('Save failed: ' + msg);
        }
    };

    const handleRecordUpdate = (updatedRecord: Partial<FlightLogRecord>) => {
        if (!updatedRecord.date) return;
        setHasUnsavedChanges(true);
        setSaveStatus('pending');
        const index = monthlyData.findIndex(d => d.date === updatedRecord.date);
        if (index === -1) return;

        const rawInputs = monthlyData.map(d => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { metrics, isDayOff, flightDuration, actualFdp, maxFdp, fdpExtension, breakDuration, maxFlightTime, disruptive, rest, daysOffValidation, standby, ...raw } = d;
            return raw;
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { ...cleanUpdate } = updatedRecord;
        rawInputs[index] = { ...rawInputs[index], ...cleanUpdate };

        const year = currentDate.getUTCFullYear();
        const month = currentDate.getUTCMonth();
        const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        const historicRecords = flightLogRecords
            .filter(r => r.staffId === selectedPilotId && !r.date.startsWith(currentMonthPrefix))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const calculatedData = recalculateMonth(rawInputs, historicRecords, selectedPilot);
        setMonthlyData(calculatedData);
        setEditingRecord(null);
    };

    // ... Check if view is historical
    const isHistoricalView = useMemo(() => {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return currentDate < oneYearAgo;
    }, [currentDate]);

    const changeMonth = (offset: number) => {
        if (hasUnsavedChanges) {
            if (!window.confirm("You have unsaved changes. Going to another month will discard them. Continue?")) return;
            setHasUnsavedChanges(false);
        }
        setCurrentDate(prev => {
            const newDate = new Date(prev.getTime());
            newDate.setUTCMonth(newDate.getUTCMonth() + offset);
            return newDate;
        });
    };

    const handlePrintClick = () => {
        if (hasUnsavedChanges) {
            alert("You have unsaved changes. Please save your records before printing to ensure data integrity.");
            return;
        }
        // In Next.js, we'll store the data for printing in localStorage temporarily 
        // because router.push doesn't support state like react-router-dom's navigate.
        const printData = {
            monthlyData,
            pilot: selectedPilot,
            date: currentDate,
            monthlyTotals: {
                duty: stats.monthlyDutyHours,
                flight: stats.monthlyFlightHours
            }
        };
        localStorage.setItem('duty_print_data', JSON.stringify(printData));
        router.push('/duty/print');
    };

    const canEditLog = useMemo(() => {
        if (!currentUser || !selectedPilot) return false;
        if (can('roster:force_edit')) return true;
        if (can('roster:edit') && can('roster:view:all')) return true;
        if (currentUser.id === selectedPilotId) return true;
        if (can('roster:edit') && can('staff:view:own_department') && currentUser.departmentId === selectedPilot.departmentId) return true;
        return false;
    }, [currentUser, selectedPilot, can, selectedPilotId]);

    // --- TANSTACK TABLE SETUP ---
    const columnHelper = createColumnHelper<MonthlyDayRecord>();

    const columns = useMemo(() => [
        // ... (Column definitions remain mostly the same, ensuring they access BufferedInput correctly)
        columnHelper.accessor('date', {
            header: 'Date',
            cell: info => {
                const day = info.row.original;
                const hasViolation = !!day.daysOffValidation.violation || !!day.rest.restViolation || !!day.disruptive.disruptiveViolation || !!day.standby.standbyViolation || (day.actualFdp > 0 && day.maxFdp > 0 && day.actualFdp > day.maxFdp);

                const violationList = [
                    day.daysOffValidation?.violation,
                    day.rest?.restViolation,
                    day.disruptive?.disruptiveViolation,
                    day.standby?.standbyViolation,
                    (day.actualFdp > 0 && day.maxFdp > 0 && day.actualFdp > day.maxFdp) ? `FDP Exceeded (${decimalToTime(day.actualFdp)} > ${decimalToTime(day.maxFdp)})` : null
                ].filter(Boolean).join('\n');

                const cellClass = hasViolation ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 font-bold border-l-4 border-l-red-500 cursor-pointer' : '';

                const handleMobileClick = () => {
                    if (hasViolation && violationList) {
                        alert(`Violation Details for ${day.date}:\n\n${violationList}`);
                    }
                };

                return (
                    <div
                        className={`flex items-center justify-between px-1 h-full ${cellClass}`}
                        title={violationList}
                        onClick={handleMobileClick}
                    >
                        <span>{day.date.substring(5)}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); setEditingRecord(day); }}
                            className="text-gray-400 hover:text-blue-500"
                            title="Detail Edit"
                        >
                            ✎
                        </button>
                    </div>
                );
            },
            meta: { className: "sticky left-0 z-20 bg-inherit border-r dark:border-gray-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[70px] min-w-[70px]" }
        }),
        columnHelper.accessor('isDayOff', {
            header: 'Duty',
            cell: info => (
                <div className="text-center">
                    {info.getValue() ? <span className="font-bold text-gray-400 dark:text-gray-500">OFF</span> : <span className="font-semibold text-gray-700 dark:text-gray-300">DUTY</span>}
                </div>
            ),
            meta: { className: "sticky left-[70px] z-20 bg-inherit text-center border-r dark:border-gray-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[50px] min-w-[50px]" }
        }),
        columnHelper.accessor(row => row.rest, {
            id: 'rest',
            header: 'Rest',
            cell: info => {
                const rest = info.getValue();
                const violationClass = rest.restViolation ? 'text-status-danger font-bold' : 'text-gray-500 dark:text-gray-400';
                return (
                    <div title={rest.restViolation || (rest.hasHistory ? '' : 'No previous end of shift found.')} className={`text-center ${violationClass}`}>
                        {rest.hasHistory ? decimalToTime(rest.restPeriod, true) : <span className="text-[10px] opacity-50 italic">No Data</span>}
                    </div>
                );
            },
            meta: { className: "min-w-[70px] border-r dark:border-gray-600" }
        }),
        // Inputs using BufferedInput
        columnHelper.accessor('dutyStart', {
            header: 'Duty Start',
            cell: info => <BufferedInput type="time" disabled={!canEditLog} value={info.getValue() || ''} onCommit={val => handleInputChange(info.row.index, 'dutyStart', val)} className="form-input-grid" step="any" />,
            meta: { className: "border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor('dutyEnd', {
            header: 'Duty End',
            cell: info => <BufferedInput type="time" disabled={!canEditLog} value={info.getValue() || ''} onCommit={val => handleInputChange(info.row.index, 'dutyEnd', val)} className="form-input-grid" step="any" />,
            meta: { className: "border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor('fdpStart', {
            header: 'FDP Start',
            cell: info => <BufferedInput type="time" disabled={!canEditLog} value={info.getValue() || ''} onCommit={val => handleInputChange(info.row.index, 'fdpStart', val)} className="form-input-grid" step="any" />,
            meta: { className: "border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor('fdpEnd', {
            header: 'FDP End',
            cell: info => <BufferedInput type="time" disabled={!canEditLog} value={info.getValue() || ''} onCommit={val => handleInputChange(info.row.index, 'fdpEnd', val)} className="form-input-grid" step="any" />,
            meta: { className: "border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor('isSplitDuty', {
            header: 'Split',
            cell: info => <div className="text-center"><input type="checkbox" disabled={!canEditLog} checked={info.getValue() || false} onChange={e => handleInputChange(info.row.index, 'isSplitDuty', e.target.checked)} className="form-checkbox" /></div>,
            meta: { className: "border-r dark:border-gray-600 min-w-[50px] text-center" }
        }),
        columnHelper.accessor('breakStart', {
            header: 'Break Start',
            cell: info => <BufferedInput type="time" disabled={!info.row.original.isSplitDuty || !canEditLog} value={info.getValue() || ''} onCommit={val => handleInputChange(info.row.index, 'breakStart', val)} className="form-input-grid" step="any" />,
            meta: { className: "border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor('breakEnd', {
            header: 'Break End',
            cell: info => <BufferedInput type="time" disabled={!info.row.original.isSplitDuty || !canEditLog} value={info.getValue() || ''} onCommit={val => handleInputChange(info.row.index, 'breakEnd', val)} className="form-input-grid" step="any" />,
            meta: { className: "border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor('flightDuration', {
            header: 'Flight Hours',
            cell: info => (
                <button onClick={() => { setEditingHoursIndex(info.row.index); setIsHoursModalOpen(true); }} disabled={!canEditLog} className="form-input-grid text-left w-full hover:bg-gray-100 dark:hover:bg-gray-600 disabled:hover:bg-transparent truncate">
                    {info.getValue() > 0 ? `${decimalToTime(info.getValue())}` : 'Log'}
                </button>
            ),
            meta: { className: "border-r dark:border-gray-600 min-w-[90px]" }
        }),
        columnHelper.accessor('sectors', {
            header: 'Sectors',
            cell: info => <BufferedInput type="number" disabled={!canEditLog} value={info.getValue() === undefined || info.getValue() === null ? '' : info.getValue()} onCommit={val => handleInputChange(info.row.index, 'sectors', val)} className="form-input-grid" />,
            meta: { className: "border-r dark:border-gray-600 min-w-[60px]" }
        }),
        columnHelper.accessor('isTwoPilotOperation', {
            header: '2 Pilot',
            cell: info => <div className="text-center"><input type="checkbox" disabled={!canEditLog} checked={info.getValue() || false} onChange={e => handleInputChange(info.row.index, 'isTwoPilotOperation', e.target.checked)} className="form-checkbox" /></div>,
            meta: { className: "border-r dark:border-gray-600 min-w-[50px] text-center" }
        }),
        columnHelper.accessor('standbyOn', {
            header: 'Stby On',
            cell: info => <BufferedInput type="time" disabled={!canEditLog} value={info.getValue() || ''} onCommit={val => handleInputChange(info.row.index, 'standbyOn', val)} className="form-input-grid" step="any" />,
            meta: { className: "border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor('standbyOff', {
            header: 'Stby Off',
            cell: info => <BufferedInput type="time" disabled={!canEditLog} value={info.getValue() || ''} onCommit={val => handleInputChange(info.row.index, 'standbyOff', val)} className="form-input-grid" step="any" />,
            meta: { className: "border-r dark:border-gray-600 min-w-[70px]" }
        }),
        // Calculations & Metrics
        columnHelper.accessor('actualFdp', {
            header: 'Act FDP',
            cell: info => {
                const exceeded = info.getValue() > 0 && info.row.original.maxFdp > 0 && info.getValue() > info.row.original.maxFdp;
                return <div className={`text-center font-semibold ${exceeded ? 'text-status-danger font-bold' : ''}`}>{info.getValue() > 0 ? decimalToTime(info.getValue()) : '-'}</div>;
            },
            meta: { className: "bg-blue-50 dark:bg-blue-900/30 border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor('breakDuration', {
            header: 'Break',
            cell: info => <div className="text-center">{info.getValue() > 0 ? decimalToTime(info.getValue()) : '-'}</div>,
            meta: { className: "bg-blue-50 dark:bg-blue-900/30 border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor('fdpExtension', {
            header: 'Ext.',
            cell: info => <div className="text-center">{info.getValue() > 0 ? `+${decimalToTime(info.getValue())}` : '-'}</div>,
            meta: { className: "bg-blue-50 dark:bg-blue-900/30 border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor('maxFdp', {
            header: 'Max FDP',
            cell: info => <div className="text-center font-bold">{info.getValue() > 0 ? decimalToTime(info.getValue()) : '-'}</div>,
            meta: { className: "bg-blue-50 dark:bg-blue-900/30 border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor(row => row.metrics?.dutyTime7d, {
            id: 'duty7d',
            header: '7D Duty',
            cell: info => <div className={`text-center ${getLimitClass(info.getValue(), FTL_LIMITS.dutyTime7d)}`}>{info.getValue()?.toFixed(1) ?? '0.0'}</div>,
            meta: { className: "border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor(row => row.metrics?.dutyTime28d, {
            id: 'duty28d',
            header: '28D Duty',
            cell: info => <div className={`text-center ${getLimitClass(info.getValue(), FTL_LIMITS.dutyTime28d)}`}>{info.getValue()?.toFixed(1) ?? '0.0'}</div>,
            meta: { className: "border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor(row => row.metrics?.flightTime3d, {
            id: 'flt3d',
            header: '3D Flt',
            cell: info => <div className={`text-center ${getLimitClass(info.getValue(), FTL_LIMITS.flightTime3d)}`}>{info.getValue()?.toFixed(1) ?? '0.0'}</div>,
            meta: { className: "border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor(row => row.metrics?.flightTime7d, {
            id: 'flt7d',
            header: '7D Flt',
            cell: info => <div className={`text-center ${getLimitClass(info.getValue(), FTL_LIMITS.flightTime7d)}`}>{info.getValue()?.toFixed(1) ?? '0.0'}</div>,
            meta: { className: "border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor(row => row.metrics?.flightTime28d, {
            id: 'flt28d',
            header: '28D Flt',
            cell: info => <div className={`text-center ${getLimitClass(info.getValue(), FTL_LIMITS.flightTime28d)}`}>{info.getValue()?.toFixed(1) ?? '0.0'}</div>,
            meta: { className: "bg-gray-200 dark:bg-gray-900/50 border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor(row => row.metrics?.flightTime90d, {
            id: 'flt90d',
            header: '90D Flt',
            cell: info => <div className={`text-center ${getLimitClass(info.getValue(), FTL_LIMITS.flightTime90d)}`}>{info.getValue()?.toFixed(1) ?? '0.0'}</div>,
            meta: { className: "bg-gray-200 dark:bg-gray-900/50 border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.accessor(row => row.metrics?.flightTime365d, {
            id: 'flt365d',
            header: '365D Flt',
            cell: info => <div className="text-center">{info.getValue()?.toFixed(1) ?? '0.0'}</div>,
            meta: { className: "bg-gray-200 dark:bg-gray-900/50 border-r dark:border-gray-600 min-w-[70px]" }
        }),
        columnHelper.display({
            id: 'rules',
            header: 'Rules',
            cell: info => {
                const day = info.row.original;
                const violations = [
                    day.daysOffValidation?.violation,
                    day.rest?.restViolation,
                    day.disruptive?.disruptiveViolation,
                    day.standby?.standbyViolation,
                    (day.actualFdp > 0 && day.maxFdp > 0 && day.actualFdp > day.maxFdp) ? `FDP Exceeded (${decimalToTime(day.actualFdp)} > ${decimalToTime(day.maxFdp)})` : null
                ].filter(Boolean);

                const violationTooltip = violations.join('\n');

                const handleMobileClick = () => {
                    if (violations.length > 0) {
                        alert(`Violations:\n\n${violationTooltip}`);
                    }
                };

                return (
                    <div className="flex items-center justify-center space-x-2" title={violationTooltip}>
                        {day.disruptive?.isDisruptive && (
                            <span
                                title={day.disruptive.disruptiveViolation || 'Disruptive Duty (WOCL)'}
                                className="text-xs font-bold text-purple-600 dark:text-purple-400 cursor-help"
                                onClick={() => day.disruptive.disruptiveViolation && alert(day.disruptive.disruptiveViolation)}
                            >
                                WOCL
                            </span>
                        )}
                        {violations.length > 0 ? (
                            <span
                                className="text-status-danger font-bold text-lg cursor-pointer"
                                onClick={handleMobileClick}
                            >
                                ⚠️
                            </span>
                        ) : (
                            day.dutyStart || day.standbyOn ? <span className="text-status-success">✔️</span> : <span className="text-gray-400">-</span>
                        )}
                        {(day.dutyStart || day.flightDuration > 0 || day.standbyOn) && (
                            <button onClick={(e) => { e.stopPropagation(); setBreakdownModalData(day); }} className="text-gray-400 hover:text-brand-primary" title="Show Calculation Breakdown">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 00-1 1v1a1 1 0 001 1h6a1 1 0 001-1V5a1 1 0 00-1-1H7zM6 14a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100-2h6a1 1 0 100 2H7z" clipRule="evenodd" /></svg>
                            </button>
                        )}
                    </div>
                )
            },
            meta: { className: "border-r dark:border-gray-600 min-w-[70px] text-center" }
        }),
        columnHelper.accessor('isDayOff', {
            id: 'toggleOff',
            header: 'Day Off',
            cell: info => <div className="text-center"><input type="checkbox" disabled={!canEditLog} checked={info.getValue()} onChange={() => handleDayOffToggle(info.row.index)} className="form-checkbox" /></div>,
            meta: { className: "border-r dark:border-gray-600 min-w-[70px] text-center" }
        }),
        columnHelper.accessor('remarks', {
            header: 'Remarks',
            cell: info => <BufferedInput type="text" disabled={!canEditLog} value={info.getValue() || ''} onCommit={val => handleInputChange(info.row.index, 'remarks', val)} className="form-input-grid" />,
            meta: { className: "min-w-[150px]" }
        }),
    ], [canEditLog, monthlyData]); // Removed handleInputChange dependency from useMemo deps to prevent re-creation, though typically safe.

    const table = useReactTable({
        data: monthlyData,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    if (!canAccess) {
        return (
            <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow-xl">
                <h1 className="text-2xl font-bold text-status-danger">Access Denied</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-300">You do not have permission to access the Flight & Duty Log.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-0 sm:p-6 rounded-none sm:rounded-lg shadow-none sm:shadow-xl flex flex-col h-full print:h-auto print:block print:p-0 print:shadow-none w-full max-w-full">

            {isHistoricalView && (
                <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-4 py-2 text-sm text-center font-bold border-b border-amber-200 dark:border-amber-800">
                    ⚠ Historical View: Data older than 1 year may be incomplete due to windowed fetching. Use Reports Center for full audits.
                </div>
            )}

            <div className="flex flex-col gap-2 sm:gap-4 p-2 sm:p-0 print:hidden flex-shrink-0">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Duty Log</h1>
                        <SaveStatusBadge status={saveStatus} />
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Toggle Stats for Mobile */}
                        <button
                            onClick={() => setShowStats(!showStats)}
                            className="sm:hidden px-2 py-1 text-xs border rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        >
                            {showStats ? 'Hide Stats' : 'Show Stats'}
                        </button>

                        {canEditLog && (
                            <button
                                onClick={handleSaveAll}
                                disabled={!hasUnsavedChanges}
                                className={`sm:hidden py-1 px-3 rounded-md text-xs font-bold shadow-sm transition-colors ${hasUnsavedChanges
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                                    }`}
                            >
                                Save
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-2 sm:gap-3 w-full">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-grow">
                        {viewablePilots.length > 1 && (
                            <select
                                value={selectedPilotId}
                                onChange={e => {
                                    if (hasUnsavedChanges && !window.confirm("Unsaved changes will be lost. Switch pilot?")) return;
                                    setHasUnsavedChanges(false);
                                    setSelectedPilotId(e.target.value);
                                }}
                                className="form-input-base text-sm py-1.5 sm:py-2 w-full sm:w-auto min-w-[200px]"
                            >
                                {viewablePilots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        )}

                        {viewablePilots.length <= 1 && selectedPilot && (
                            <span className="font-bold text-gray-700 dark:text-gray-300 px-3 py-1.5 sm:py-2 bg-gray-100 dark:bg-gray-700 rounded-md text-center text-sm">
                                {selectedPilot.name}
                            </span>
                        )}

                        <div className="flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-md p-0.5 sm:p-1">
                            <button onClick={() => changeMonth(-1)} className="px-3 sm:px-4 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-base sm:text-lg font-bold">‹</button>
                            <span className="px-2 text-xs sm:text-sm font-medium min-w-[6rem] sm:min-w-[8rem] text-center">{formatMonthYear(currentDate)}</span>
                            <button onClick={() => changeMonth(1)} className="px-3 sm:px-4 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-base sm:text-lg font-bold">›</button>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 sm:pb-0 justify-end scrollbar-hide">
                        {canEditLog && (
                            <button
                                onClick={handleSaveAll}
                                disabled={!hasUnsavedChanges}
                                className={`hidden sm:block py-1.5 px-4 rounded-md text-sm font-bold shadow-sm transition-colors whitespace-nowrap ${hasUnsavedChanges
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                                    }`}
                            >
                                Save
                            </button>
                        )}
                        <button onClick={handlePrintClick} className="bg-gray-600 text-white py-1.5 px-3 rounded-md hover:bg-gray-700 transition-colors text-xs sm:text-sm whitespace-nowrap">Print</button>

                        {canViewReports && (
                            <button onClick={() => router.push('/reports')} className="bg-indigo-600 text-white py-1.5 px-3 rounded-md hover:bg-indigo-700 transition-colors text-xs sm:text-sm whitespace-nowrap flex items-center justify-center gap-1">
                                <span className="hidden sm:inline">📊</span> Reports
                            </button>
                        )}

                        <button onClick={() => router.push('/duty/logic')} className="bg-gray-500 text-white py-1.5 px-3 rounded-md hover:bg-gray-600 transition-colors text-xs sm:text-sm whitespace-nowrap flex items-center justify-center gap-1" title="Operations Manual Part A">
                            <span className="hidden sm:inline">📘</span> Manual
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards - Hidden on Mobile unless toggled */}
            <div className={`print:hidden px-2 sm:px-0 mb-2 sm:mb-4 flex-shrink-0 transition-all duration-300 ${showStats ? 'block' : 'hidden sm:block'}`}>
                <SummaryCards monthlyDutyHours={stats.monthlyDutyHours} monthlyFlightHours={stats.monthlyFlightHours} endOfMonthTotals={stats.endOfMonthTotals} />
            </div>

            {/* Table Container - Removed hardcoded calc height to rely on flex-1 */}
            <div className="flex-1 flex flex-col min-h-0 border-t sm:border border-gray-200 dark:border-gray-700 sm:rounded-md overflow-hidden relative print:overflow-visible print:border-none print:block print:h-auto sm:h-auto">
                <div ref={topScrollRef} className="overflow-x-auto flex-shrink-0 bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-600 print:hidden" onScroll={handleTopScroll}>
                    <div style={{ width: tableWidth, height: '1px' }}></div>
                </div>

                <div ref={tableContainerRef} className="overflow-auto flex-1 bg-white dark:bg-gray-800 print:overflow-visible print:h-auto" onScroll={handleTableScroll}>
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-gray-500 p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mr-3"></div>
                            Loading...
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                            <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0 z-30 shadow-sm print:static">
                                {table.getHeaderGroups().map(headerGroup => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map(header => {
                                            const meta: any = header.column.columnDef.meta;
                                            return (
                                                <th
                                                    key={header.id}
                                                    className={`p-1 sm:p-2 border-b ${meta?.className || 'border-r dark:border-gray-600'}`}
                                                >
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {table.getRowModel().rows.map(row => {
                                    const day = row.original as any;
                                    const hasViolation = !!day.daysOffValidation.violation || !!day.rest.restViolation || !!day.disruptive.disruptiveViolation || !!day.standby.standbyViolation || (day.actualFdp > 0 && day.maxFdp > 0 && day.actualFdp > day.maxFdp);
                                    const dateObj = new Date(day.date);
                                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                    let rowClass = 'hover:bg-gray-50 dark:hover:bg-gray-700/50';
                                    if (hasViolation) rowClass = 'bg-red-50 dark:bg-red-900/20';
                                    else if (day.remarks === 'DAY OFF') rowClass = 'bg-blue-50 dark:bg-blue-900/30';
                                    else if (isWeekend) rowClass = 'bg-stone-100 dark:bg-stone-800/40';

                                    return (
                                        <tr key={row.id} className={`border-b border-gray-200 dark:border-gray-600 transition-colors ${rowClass} print:break-inside-avoid`}>
                                            {row.getVisibleCells().map(cell => {
                                                const meta: any = cell.column.columnDef.meta;
                                                return (
                                                    <td
                                                        key={cell.id}
                                                        className={`p-0 ${meta?.className || 'border-r dark:border-gray-600'}`}
                                                    >
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {editingRecord && (
                <DutyRecordForm
                    record={editingRecord}
                    onClose={() => setEditingRecord(null)}
                    onSave={(updated) => handleRecordUpdate({ ...updated, date: editingRecord.date })}
                    onDelete={() => {
                        handleRecordUpdate({
                            date: editingRecord.date,
                            dutyStart: '', dutyEnd: '', fdpStart: '', fdpEnd: '',
                            flightOn: '', flightOff: '', standbyOn: '', standbyOff: '',
                            remarks: '', sectors: undefined
                        });
                    }}
                    aircraftTypes={availableAircraftForPilot}
                    pilot={selectedPilot}
                />
            )}

            {breakdownModalData && <CalculationBreakdownModal data={breakdownModalData} pilotName={selectedPilot?.name || ''} onClose={() => setBreakdownModalData(null)} aircraftTypes={aircraftTypes} />}
            {isHoursModalOpen && editingHoursIndex !== null && <AircraftHoursModal isOpen={isHoursModalOpen} onClose={() => setIsHoursModalOpen(false)} onSave={handleHoursModalSave} initialHours={monthlyData[editingHoursIndex].flightHoursByAircraft} availableAircraft={availableAircraftForPilot} />}

            <style>{`
                .form-input-grid { display: block; width: 100%; height: 100%; padding: 0.4rem 0.25rem; font-size: 0.80rem; line-height: 1rem; background-color: transparent; border: 1px solid transparent; border-radius: 0px; transition: all 0.1s; -webkit-appearance: none; -moz-appearance: textfield; outline: none; box-shadow: none; }
                .form-input-grid:hover { border-color: #e5e7eb; background-color: rgba(243, 244, 246, 0.5); }
                .form-input-grid:focus { outline: none; background-color: white; border-color: #2196F3; box-shadow: inset 0 0 0 1px #2196F3; z-index: 10; position: relative; }
                .dark .form-input-grid { color: #e5e7eb; }
                .dark .form-input-grid:hover { border-color: #4b5563; background-color: rgba(55, 65, 81, 0.5); }
                .dark .form-input-grid:focus { background-color: #1f2937; border-color: #2196F3; }
                .form-input-grid:disabled { background-color: transparent; cursor: not-allowed; opacity: 0.5; }
                .form-input-base { padding: 0.5rem; border-radius: 0.375rem; border-width: 1px; background-color: #F9FAFB; border-color: #D1D5DB; }
                .dark .form-input-base { background-color: #374151; border-color: #4B5563; color: white; }
                .form-checkbox { height: 1rem; width: 1rem; text-align: center; color: #0D47A1; border-radius: 0.25rem; border-color: #9CA3AF; cursor: pointer; }
                .bg-inherit { background-color: inherit; }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
