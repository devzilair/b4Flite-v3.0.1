
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { Staff, ShiftCodeDefinition, RosterData, RosterSettings, RosterEntry, PublicHoliday } from '../types.ts';
import DutyCell from './DutyCell.tsx';
import { formatStaffName } from '../utils/sanitization.ts';
import { isDatePublicHoliday } from '../utils/dateUtils.ts';

interface RosterTableProps {
  currentDate: Date;
  staff: Staff[];
  dutyCodes: ShiftCodeDefinition[];
  rosterData: RosterData;
  nextMonthData?: RosterData;
  settings: RosterSettings;
  onCellUpdate: (staffId: string, date: string, newEntryData: Partial<RosterEntry>) => void;
  onBatchUpdate?: (updates: { staffId: string, date: string, newEntry: Partial<RosterEntry> }[]) => void;
  canEditRoster: boolean;
  publicHolidays?: PublicHoliday[]; 
  printPreviewMode?: boolean; // New prop to force render the print view
  onSwapRequest?: (date: string) => void;
}

const DAILY_NOTES_ID = '__DAILY_NOTES__';
const STAFF_NOTES_ID = '__STAFF_NOTES__';

interface StaffWithGroup extends Staff {
    _groupId?: string;
    _groupName?: string;
    _subDeptName?: string;
    _groupIndex?: number;
}

const DailyNoteEditor: React.FC<{
  onClose: () => void;
  onSave: (note: string) => void;
  initialNote: string;
  dateStr: string;
}> = ({ onClose, onSave, initialNote, dateStr }) => {
    const [editedNote, setEditedNote] = useState(initialNote);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
          if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
            onClose();
          }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    return (
        <div 
            ref={popoverRef} 
            className="absolute top-full left-0 mt-1 z-[60] bg-white dark:bg-gray-900 rounded-lg shadow-2xl p-4 border border-gray-300 dark:border-gray-600 w-64 text-left cursor-default font-normal normal-case tracking-normal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-brand-primary uppercase mb-1">Daily Note ({dateStr})</label>
                    <textarea 
                        rows={3} 
                        value={editedNote}
                        onChange={(e) => setEditedNote(e.target.value)}
                        className="block w-full text-sm p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-brand-primary focus:border-brand-primary"
                        autoFocus
                        placeholder="Enter general note for this day..."
                    />
                </div>
                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="bg-gray-200 dark:bg-gray-600 text-xs py-1.5 px-3 rounded-md">Cancel</button>
                    <button onClick={() => onSave(editedNote)} className="bg-brand-primary text-white text-xs py-1.5 px-4 rounded-md font-bold">Save Note</button>
                </div>
            </div>
        </div>
    );
};

const StaffNoteEditor: React.FC<{
  onClose: () => void;
  onSave: (note: string) => void;
  initialNote: string;
  staffName: string;
}> = ({ onClose, onSave, initialNote, staffName }) => {
    const [editedNote, setEditedNote] = useState(initialNote);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
          if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
            onClose();
          }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    return (
        <div 
            ref={popoverRef} 
            className="absolute top-0 left-full ml-1 z-[60] bg-white dark:bg-gray-900 rounded-lg shadow-2xl p-4 border border-gray-300 dark:border-gray-600 w-64 text-left cursor-default font-normal normal-case tracking-normal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-brand-primary uppercase mb-1">Note for {staffName}</label>
                    <textarea 
                        rows={3} 
                        value={editedNote}
                        onChange={(e) => setEditedNote(e.target.value)}
                        className="block w-full text-sm p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-brand-primary focus:border-brand-primary"
                        autoFocus
                        placeholder="Enter roster note for staff..."
                    />
                </div>
                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="bg-gray-200 dark:bg-gray-600 text-xs py-1.5 px-3 rounded-md">Cancel</button>
                    <button onClick={() => onSave(editedNote)} className="bg-brand-primary text-white text-xs py-1.5 px-4 rounded-md font-bold">Save</button>
                </div>
            </div>
        </div>
    );
};

const RosterTable: React.FC<RosterTableProps> = ({ 
    currentDate, 
    staff, 
    dutyCodes, 
    rosterData, 
    nextMonthData = {},
    settings, 
    onCellUpdate, 
    onBatchUpdate, 
    canEditRoster, 
    publicHolidays = [],
    printPreviewMode = false,
    onSwapRequest
}) => {
  const [activeCell, setActiveCell] = useState<{ staffId: string; date: string } | null>(null);
  const [selectionAnchor, setSelectionAnchor] = useState<{ staffId: string; date: string } | null>(null);
  const [selectedCellKeys, setSelectedCellKeys] = useState<Set<string>>(new Set());
  const [editingDateNote, setEditingDateNote] = useState<string | null>(null);
  const [editingStaffNote, setEditingStaffNote] = useState<string | null>(null);
  
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(0);

  const calendarDays = useMemo(() => {
    const year = currentDate.getUTCFullYear();
    const month = currentDate.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const date = new Date(Date.UTC(year, month, day));
      const dateString = date.toISOString().split('T')[0];
      const isPublicHoliday = isDatePublicHoliday(date, publicHolidays);

      return {
        day,
        dateString,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
        isWeekend: [0, 6].includes(date.getUTCDay()),
        isPublicHoliday,
        isNextMonth: false,
      };
    });

    const nextMonthFirstDay = new Date(Date.UTC(year, month + 1, 1));
    const nextMonthDateString = nextMonthFirstDay.toISOString().split('T')[0];
    days.push({
      day: 1,
      dateString: nextMonthDateString,
      dayName: nextMonthFirstDay.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      isWeekend: [0, 6].includes(nextMonthFirstDay.getUTCDay()),
      isPublicHoliday: isDatePublicHoliday(nextMonthFirstDay, publicHolidays),
      isNextMonth: true
    });

    return days;
  }, [currentDate, publicHolidays]);
  
  const staffSorter = (a: Staff, b: Staff) => {
      const seniorityA = a.pilotData?.seniorityLevel ?? 999;
      const seniorityB = b.pilotData?.seniorityLevel ?? 999;
      if (seniorityA < seniorityB) return -1;
      if (seniorityA > seniorityB) return 1;
      return a.name.localeCompare(b.name);
  };

  const flattenedStaff = useMemo(() => {
    const staffInGroups = new Set<string>();
    const groups = settings.rosterGroups || [];
    const flatList: StaffWithGroup[] = [];

    groups.forEach(group => {
        const filterSubDepts = group.subDepartmentFilter || [];
        const members = staff
            .filter(s => {
                const staffSubDepts = s.subDepartments || [];
                return filterSubDepts.some(sd => staffSubDepts.includes(sd));
            })
            .map(s => {
                const matchedSubDept = filterSubDepts.find(fsd => s.subDepartments.includes(fsd)) || 'Other';
                return { 
                    ...s, 
                    _groupId: group.id, 
                    _groupName: group.name,
                    _subDeptName: matchedSubDept 
                };
            })
            .sort((a, b) => {
                const priorityA = filterSubDepts.indexOf(a._subDeptName || '');
                const priorityB = filterSubDepts.indexOf(b._subDeptName || '');
                if (priorityA !== priorityB) return priorityA - priorityB;
                return staffSorter(a, b);
            });
        
        let groupCounter = 1;
        let lastSubDept = '';

        members.forEach(m => {
            if (!staffInGroups.has(m.id)) {
                staffInGroups.add(m.id);
                if (m._subDeptName !== lastSubDept) {
                    groupCounter = 1;
                    lastSubDept = m._subDeptName || '';
                }
                (m as StaffWithGroup)._groupIndex = groupCounter++;
                flatList.push(m);
            }
        });
    });

    const unassignedStaffRaw = staff
        .filter(s => !staffInGroups.has(s.id))
        .sort((a, b) => {
            const sdA = a.subDepartments[0] || '';
            const sdB = b.subDepartments[0] || '';
            const cmp = sdA.localeCompare(sdB);
            if (cmp !== 0) return cmp;
            return staffSorter(a, b);
        });

    let unassignedCounter = 1;
    let lastUnassignedSubDept = '';
    const unassignedStaff = unassignedStaffRaw.map(s => {
        const currentSubDept = s.subDepartments[0] || 'Unassigned';
        if (currentSubDept !== lastUnassignedSubDept) {
             unassignedCounter = 1;
             lastUnassignedSubDept = currentSubDept;
        }
        return { 
            ...s, 
            _groupId: 'unassigned', 
            _groupName: 'General / Unassigned',
            _subDeptName: currentSubDept,
            _groupIndex: unassignedCounter++
        };
    });
    
    return [...flatList, ...unassignedStaff];
  }, [staff, settings.rosterGroups]);

  useEffect(() => {
    const updateWidth = () => {
        if (tableContainerRef.current) {
            setTableWidth(tableContainerRef.current.scrollWidth);
        }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    const timer = setTimeout(updateWidth, 100);
    return () => {
        window.removeEventListener('resize', updateWidth);
        clearTimeout(timer);
    };
  }, [staff, settings, calendarDays]);

  const handleTopScroll = () => {
    if (topScrollRef.current && tableContainerRef.current) {
        tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableContainerRef.current) {
        tableContainerRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  };

  const handleCellClick = (staffId: string, date: string, e: React.MouseEvent) => {
      if (!e.shiftKey && activeCell?.staffId === staffId && activeCell?.date === date) return;

      if (e.shiftKey && selectionAnchor) {
          const staffIds = flattenedStaff.map(s => s.id);
          const dateStrings = calendarDays.map(d => d.dateString);

          const startRowIndex = staffIds.indexOf(selectionAnchor.staffId);
          const endRowIndex = staffIds.indexOf(staffId);
          const startColIndex = dateStrings.indexOf(selectionAnchor.date);
          const endColIndex = dateStrings.indexOf(date);

          if (startRowIndex === -1 || endRowIndex === -1 || startColIndex === -1 || endColIndex === -1) return;

          const rowMin = Math.min(startRowIndex, endRowIndex);
          const rowMax = Math.max(startRowIndex, endRowIndex);
          const colMin = Math.min(startColIndex, endColIndex);
          const colMax = Math.max(startColIndex, endColIndex);

          const newSelection = new Set<string>();
          for (let r = rowMin; r <= rowMax; r++) {
              for (let c = colMin; c <= colMax; c++) {
                  newSelection.add(`${staffIds[r]}_${dateStrings[c]}`);
              }
          }
          setSelectedCellKeys(newSelection);
          setActiveCell({ staffId, date });
      } else {
          setSelectionAnchor({ staffId, date });
          setSelectedCellKeys(new Set());
          setActiveCell({ staffId, date });
      }
  };

  const handleBatchUpdate = (sourceStaffId: string, sourceDate: string, newEntryData: Partial<RosterEntry>) => {
      const sourceKey = `${sourceStaffId}_${sourceDate}`;
      if (selectedCellKeys.has(sourceKey) && selectedCellKeys.size > 1 && onBatchUpdate) {
          const updates: { staffId: string, date: string, newEntry: Partial<RosterEntry> }[] = [];
          selectedCellKeys.forEach(key => {
              const [sId, dStr] = key.split('_');
              if (sId && dStr) {
                  updates.push({ staffId: sId, date: dStr, newEntry: newEntryData });
              }
          });
          onBatchUpdate(updates);
      } else {
          onCellUpdate(sourceStaffId, sourceDate, newEntryData);
      }
  };

  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.target instanceof HTMLInputElement && !['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          return;
      }
      if (!activeCell) return;
      const dateStrings = calendarDays.map(d => d.dateString);
      const activeFlatIndex = flattenedStaff.findIndex(s => s.id === activeCell.staffId);
      let currentCol = dateStrings.indexOf(activeCell.date);

      if (activeFlatIndex === -1 || currentCol === -1) return;
      
      let nextFlatIndex = activeFlatIndex;
      let nextCol = currentCol;
      let keyProcessed = true;

      switch (e.key) {
        case 'ArrowUp': nextFlatIndex = Math.max(0, activeFlatIndex - 1); e.preventDefault(); break;
        case 'ArrowDown':
        case 'Enter': nextFlatIndex = Math.min(flattenedStaff.length - 1, activeFlatIndex + 1); e.preventDefault(); break;
        case 'ArrowLeft': nextCol = Math.max(0, currentCol - 1); e.preventDefault(); break;
        case 'ArrowRight': nextCol = Math.min(dateStrings.length - 1, currentCol + 1); e.preventDefault(); break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
             if (currentCol > 0) nextCol = currentCol - 1;
             else if (activeFlatIndex > 0) { nextCol = dateStrings.length - 1; nextFlatIndex = activeFlatIndex - 1; }
          } else {
             nextCol++;
             if (nextCol >= dateStrings.length) { nextCol = 0; nextFlatIndex = (activeFlatIndex + 1); }
          }
          break;
        default: keyProcessed = false; break;
      }

      if (keyProcessed) {
        const nextStaff = flattenedStaff[nextFlatIndex];
        if (nextStaff) {
          const nextDateString = dateStrings[nextCol];
          setSelectionAnchor({ staffId: nextStaff.id, date: nextDateString });
          setSelectedCellKeys(new Set());
          setActiveCell({ staffId: nextStaff.id, date: nextDateString });
        }
      }
  };

  const columnHelper = createColumnHelper<StaffWithGroup>();
  const staffColWidthValue = typeof settings.staffMemberColWidth === 'number' ? settings.staffMemberColWidth : (settings.staffMemberColWidth as any)?.value ?? 200;
  const staffColWidthUnit = typeof settings.staffMemberColWidth === 'number' ? 'px' : (settings.staffMemberColWidth as any)?.unit ?? 'px';
  const staffColWidthString = `${staffColWidthValue}${staffColWidthUnit}`;

  const colWidthVal = typeof settings.columnWidth === 'number' ? settings.columnWidth : (settings.columnWidth as any)?.value ?? 50;
  const colWidthUnit = typeof settings.columnWidth === 'number' ? 'px' : (settings.columnWidth as any)?.unit ?? 'px';
  const colWidthString = `${colWidthVal}${colWidthUnit}`;

  const columns = useMemo(() => [
      columnHelper.display({
        id: 'rowNumber',
        header: '#',
        cell: info => <div className="text-center text-xs text-gray-500 font-mono">{info.row.original._groupIndex}</div>,
        meta: {
            className: "sticky left-0 bg-white dark:bg-gray-800 p-1 border-r border-b border-gray-200 dark:border-gray-600 z-30",
            style: { width: '30px', minWidth: '30px' },
            headerClassName: "sticky left-0 top-0 z-50 bg-gray-100 dark:bg-gray-700 p-1 border-b-2 border-r border-gray-300 dark:border-gray-600"
        }
      }),
      columnHelper.accessor('name', {
          header: 'Staff Member',
          cell: info => {
              const staffId = info.row.original.id;
              const noteEntry = rosterData[STAFF_NOTES_ID]?.[staffId];
              const note = noteEntry?.note;
              return (
                  <div className="relative w-full h-full flex flex-col justify-center px-1 md:px-2 cursor-default group" onDoubleClick={() => canEditRoster && setEditingStaffNote(staffId)} title={note ? `Note: ${note}` : 'Double-click to add note'}>
                      <div className="font-semibold truncate">{formatStaffName(info.getValue())}</div>
                      {settings.showSubDepartment && <div className="text-xs text-gray-500">{(info.row.original.subDepartments || []).join(', ')}</div>}
                      {note && <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-bl-sm pointer-events-none" />}
                      {editingStaffNote === staffId && (
                        <StaffNoteEditor staffName={info.getValue()} initialNote={note || ''} onClose={() => setEditingStaffNote(null)} onSave={(newNote) => { onCellUpdate(staffId, STAFF_NOTES_ID, { note: newNote }); setEditingStaffNote(null); }} />
                      )}
                  </div>
              );
          },
          meta: { 
              className: "sticky left-[30px] bg-white dark:bg-gray-800 p-1 md:p-2 border-r border-b border-gray-200 dark:border-gray-600 font-medium z-30",
              style: { minWidth: staffColWidthString, width: staffColWidthString },
              headerClassName: "sticky left-[30px] top-0 z-50 bg-gray-100 dark:bg-gray-700 p-1 md:p-2 border-b-2 border-r border-gray-300 dark:border-gray-600 font-medium text-left"
          }
      }),
      ...calendarDays.map(dayInfo => 
          columnHelper.display({
              id: dayInfo.dateString,
              header: () => {
                const dayNote = dayInfo.isNextMonth ? nextMonthData[dayInfo.dateString]?.[DAILY_NOTES_ID]?.note : rosterData[dayInfo.dateString]?.[DAILY_NOTES_ID]?.note;
                return (
                    <div className={`relative w-full h-full flex flex-col items-center justify-center cursor-pointer select-none group ${dayInfo.isNextMonth ? 'opacity-60' : ''}`} onDoubleClick={() => canEditRoster && setEditingDateNote(dayInfo.dateString)} title={dayNote ? `Daily Note: ${dayNote}` : 'Double-click to add daily note'}>
                        <div className="print:hidden text-[10px] opacity-70 leading-none mb-1">{dayInfo.isNextMonth ? dayInfo.dateString.substring(5, 7) + '/' : ''}{dayInfo.dayName.substring(0,3)}</div>
                        <div className="font-bold leading-none">{dayInfo.day}</div>
                        {dayNote && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-orange-500 rounded-bl-sm pointer-events-none" />}
                        {editingDateNote === dayInfo.dateString && (
                            <DailyNoteEditor dateStr={dayInfo.dateString} initialNote={dayNote || ''} onClose={() => setEditingDateNote(null)} onSave={(newNote) => { onCellUpdate(DAILY_NOTES_ID, dayInfo.dateString, { note: newNote }); setEditingDateNote(null); }} />
                        )}
                    </div>
                );
              },
              cell: info => (
                  <DutyCell id={`cell-${info.row.original.id}-${dayInfo.dateString}`} entry={dayInfo.isNextMonth ? nextMonthData[dayInfo.dateString]?.[info.row.original.id] : rosterData[dayInfo.dateString]?.[info.row.original.id]} dutyCodes={dutyCodes} isWeekend={dayInfo.isWeekend} isPublicHoliday={dayInfo.isPublicHoliday} settings={settings} onCellUpdate={(newEntryData) => handleBatchUpdate(info.row.original.id, dayInfo.dateString, newEntryData)} canEdit={canEditRoster} isActive={activeCell?.staffId === info.row.original.id && activeCell?.date === dayInfo.dateString} isSelected={selectedCellKeys.has(`${info.row.original.id}_${dayInfo.dateString}`)} onActivate={(e) => handleCellClick(info.row.original.id, dayInfo.dateString, e)} onSwapRequest={onSwapRequest} />
              ),
              meta: { 
                  className: `p-0 text-center border-b border-r border-gray-300 dark:border-gray-600 relative`,
                  headerClassName: `sticky top-0 z-40 p-1 md:p-2 border-b-2 text-center font-medium relative ${dayInfo.isPublicHoliday ? 'bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-100 border-x-2 border-blue-600' : dayInfo.isWeekend ? 'bg-orange-100 dark:bg-orange-900/50 text-brand-accent border-x-2 border-orange-500' : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`,
                  style: { minWidth: colWidthString, width: colWidthString }
              }
          })
      )
  ], [calendarDays, settings, dutyCodes, rosterData, nextMonthData, activeCell, selectedCellKeys, canEditRoster, editingDateNote, editingStaffNote, onCellUpdate, staffColWidthString, colWidthString]);

  const table = useReactTable({
      data: flattenedStaff,
      columns,
      getCoreRowModel: getCoreRowModel(),
  });

  const printFontSize = settings.printConfig?.fontSize || '7pt';
  const printRowHeight = settings.printConfig?.rowHeight || '10mm';
  const printStaffWidth = settings.printConfig?.staffColumnWidth || '35mm';
  const printMargins = settings.printConfig?.margins || '5mm';
  const footerFontSize = settings.printConfig?.footerFontSize || '20pt'; 
  const groupHeaderFontSize = settings.printConfig?.groupHeaderFontSize || '12pt';

  // Render variables for sub-dept tracking
  let currentGroupId: string | undefined = undefined;
  let currentSubDept: string | undefined = undefined;

  return (
    <div className="flex flex-col h-full">
      {!printPreviewMode && (
          <style>{`
            @media print {
                @page {
                    size: A4 landscape;
                    margin: ${printMargins};
                }
                html, body, #root, main, .container {
                    width: 100% !important;
                    height: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: visible !important;
                    background-color: white !important;
                    display: block !important;
                }
                nav, header, aside, .print\\:hidden, button, select {
                    display: none !important;
                }
                .std-print-table {
                    width: 287mm !important; /* Fixed A4 Landscape safe width */
                    border-collapse: collapse;
                    font-size: ${printFontSize};
                    table-layout: fixed;
                }
                .std-print-table th, .std-print-table td {
                    border: 0.5pt solid #000;
                    padding: 0;
                    text-align: center;
                    vertical-align: middle;
                }
                .std-print-table tr {
                    height: ${printRowHeight} !important;
                    page-break-inside: avoid;
                }
                .std-print-staff-col {
                    width: ${printStaffWidth} !important;
                    text-align: left !important;
                    padding-left: 2mm !important;
                    white-space: nowrap;
                    overflow: hidden;
                }
                .std-print-day-col {
                    width: calc((287mm - ${printStaffWidth} - 10mm) / 32) !important;
                }
                .std-print-group-header {
                    background-color: #f0f0f0 !important;
                    font-weight: bold;
                    text-transform: uppercase;
                    font-size: ${groupHeaderFontSize};
                    text-align: left !important;
                    padding: 1mm 2mm !important;
                }
                 .std-print-footer {
                    margin-top: 5mm;
                    font-size: ${footerFontSize};
                    font-weight: bold;
                    text-align: right;
                    border-top: 1pt solid #000;
                }
            }
          `}</style>
      )}

      <div ref={topScrollRef} className="overflow-x-auto w-full flex-shrink-0 print:hidden" onScroll={handleTopScroll}>
         <div style={{ width: tableWidth, height: '1px' }}></div>
      </div>

      <div ref={tableContainerRef} className="flex-grow overflow-auto border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 relative scroll-smooth print:overflow-visible print:border-none print:h-auto" onScroll={handleTableScroll} onKeyDown={handleContainerKeyDown} tabIndex={0}>
        <table className={`w-full border-collapse border-spacing-0 ${printPreviewMode ? 'std-print-table' : ''} print:std-print-table`}>
           <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0 z-40 print:static print:bg-white">
             {table.getHeaderGroups().map(headerGroup => (
                 <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => {
                        const meta = header.column.columnDef.meta as any;
                        const isStaff = header.id === 'name';
                        const isDay = header.id !== 'rowNumber' && header.id !== 'name';
                        return (
                           <th key={header.id} className={`${meta?.headerClassName || ''} print:border print:border-black ${isStaff ? 'std-print-staff-col' : ''} ${isDay ? 'std-print-day-col' : ''}`} style={meta?.style}>
                               {flexRender(header.column.columnDef.header, header.getContext())}
                           </th>
                        );
                    })}
                 </tr>
             ))}
           </thead>
           <tbody className="bg-white dark:bg-gray-800">
              {table.getRowModel().rows.map(row => {
                  const staffRow = row.original as any;
                  const isNewGroup = staffRow._groupId !== currentGroupId;
                  // Detect change in sub-dept BUT only within the same group
                  // If it's a new group, the group header already separates it visually
                  const isNewSubDept = !isNewGroup && 
                                       staffRow._subDeptName !== currentSubDept && 
                                       currentSubDept !== undefined;

                  currentGroupId = staffRow._groupId;
                  currentSubDept = staffRow._subDeptName;

                  // Apply thick top border for sub-dept separation
                  const separatorClass = isNewSubDept ? 'border-t-4 border-gray-400 dark:border-gray-500' : '';

                  return (
                      <React.Fragment key={row.id}>
                          {isNewGroup && (
                              <tr className="bg-gray-200 dark:bg-gray-600 print:bg-gray-200">
                                  <td colSpan={columns.length} className="p-2 font-bold text-gray-700 dark:text-gray-200 uppercase text-xs border-b border-gray-300 dark:border-gray-600 sticky left-0 print:static print:border-black std-print-group-header">
                                      {staffRow._groupName}
                                  </td>
                              </tr>
                          )}
                          <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 print:break-inside-avoid">
                              {row.getVisibleCells().map(cell => {
                                  const meta = cell.column.columnDef.meta as any;
                                  const isStaff = cell.column.id === 'name';
                                  const isDay = cell.column.id !== 'rowNumber' && cell.column.id !== 'name';
                                  return (
                                      <td key={cell.id} className={`${meta?.className || ''} ${separatorClass} print:border print:border-black ${isStaff ? 'std-print-staff-col' : ''} ${isDay ? 'std-print-day-col' : ''}`} style={meta?.style}>
                                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                      </td>
                                  );
                              })}
                          </tr>
                      </React.Fragment>
                  );
              })}
           </tbody>
        </table>
      </div>
    </div>
  );
};

export default RosterTable;
