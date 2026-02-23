
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Staff, ShiftCodeDefinition, RosterData, PilotRosterSettings, PilotRosterMainGroup, RosterEntry } from '../types.ts';
import { PilotDutyCell } from './PilotDutyCell.tsx';
import { formatStaffName } from '../utils/sanitization.ts';
import { BufferedInput } from './common/BufferedInput.tsx';

// --- TYPES & HELPERS ---
interface Selection {
    startCol: number;
    startRow: number;
    endCol: number;
    endRow: number;
}

interface Coordinate {
    col: number;
    row: number;
}

const normalizeSelection = (s: Selection) => ({
    minCol: Math.min(s.startCol, s.endCol),
    maxCol: Math.max(s.startCol, s.endCol),
    minRow: Math.min(s.startRow, s.endRow),
    maxRow: Math.max(s.startRow, s.endRow)
});

interface PilotRosterProps {
  currentDate: Date;
  staff: Staff[];
  dutyCodes: ShiftCodeDefinition[];
  rosterData: RosterData;
  settings?: PilotRosterSettings;
  layout?: PilotRosterMainGroup[];
  onCellUpdate: (staffId: string, date: string, newEntryData: Partial<RosterEntry>) => void;
  onBatchUpdate?: (updates: { staffId: string, date: string, newEntry: Partial<RosterEntry> }[]) => void;
  onNotesUpdate: (newNotes: { id: string; text: string }[]) => void;
  canEditRoster: boolean;
  lastUpdated?: string;
  onSwapRequest?: (date: string) => void;
}

const ContextMenu: React.FC<{
    position: { x: number, y: number } | null;
    onClose: () => void;
    onAction: (action: string, value?: string) => void;
    canEdit: boolean;
}> = ({ position, onClose, onAction, canEdit }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    if (!position) return null;

    return (
        <div 
            ref={menuRef} 
            className="fixed z-[100] bg-white dark:bg-gray-800 border dark:border-gray-600 shadow-xl rounded-md py-1 w-48 text-sm"
            style={{ top: position.y, left: position.x }}
        >
             {canEdit && (
                 <>
                    <button onClick={() => onAction('underline')} className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">Toggle Underline</button>
                    <div className="px-4 py-2 border-t border-b dark:border-gray-600">
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Highlight Color</p>
                        <div className="flex gap-2">
                             {['#fecaca', '#fed7aa', '#bbf7d0', '#bfdbfe', '#e9d5ff'].map(hex => (
                                 <button key={hex} onClick={() => onAction('color', hex)} className="w-6 h-6 rounded-full border border-gray-300" style={{ backgroundColor: hex }} />
                             ))}
                             <button onClick={() => onAction('color', undefined)} className="text-xs text-red-500 underline ml-2">Clear</button>
                        </div>
                    </div>
                 </>
             )}
             <button onClick={() => onAction('swap')} className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-purple-600">Request Swap</button>
        </div>
    );
};

type CommitDirection = 'up' | 'down' | 'left' | 'right' | 'none';

const PilotRoster: React.FC<PilotRosterProps> = ({ 
    currentDate, staff, dutyCodes, rosterData, settings, layout, 
    onCellUpdate, onBatchUpdate, onNotesUpdate, canEditRoster, lastUpdated, onSwapRequest 
}) => {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(0);

  // --- GRID STATE ---
  const [cursor, setCursor] = useState<Coordinate | null>(null); 
  const [selection, setSelection] = useState<Selection | null>(null); 
  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<'overwrite' | 'modify'>('overwrite');
  const [pendingChar, setPendingChar] = useState<string | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number, y: number } | null>(null);

  const daysInMonth = useMemo(() => new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0).getDate(), [currentDate]);
  
  const displayDate = useMemo(() => {
    return currentDate.toLocaleString('default', { month: 'short', year: '2-digit' }).toUpperCase();
  }, [currentDate]);
  
  const calendarDays = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), i + 1));
      return {
        dateString: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
        isWeekend: [0, 6].includes(date.getUTCDay()),
        dayNum: i + 1
      };
  }), [currentDate, daysInMonth]);

  const staffMap = useMemo(() => new Map(staff.map(s => [s.id, s])), [staff]);

  const sortedLayout = useMemo(() => {
      if (!layout) return [];
      return layout.map(mg => ({
          ...mg,
          subGroups: (mg.subGroups || []).map(sg => {
              const groupStaff = (sg.staffIds || []).map(id => staffMap.get(id)).filter((s): s is Staff => !!s);
              groupStaff.sort((a, b) => (a.pilotData?.seniorityLevel ?? 999) - (b.pilotData?.seniorityLevel ?? 999) || a.name.localeCompare(b.name));
              return { ...sg, staffIds: groupStaff.map(s => s.id) };
          })
      }));
  }, [layout, staffMap]);

  const flattenedPilots = useMemo(() => sortedLayout.flatMap(mg => mg.subGroups.flatMap(sg => sg.staffIds)), [sortedLayout]);

  // Calculate Border Styles for Columns (Separators)
  const columnBorderClasses = useMemo(() => {
    const classes: string[] = [];
    
    sortedLayout.forEach((mg, mgIndex) => {
        const isLastMainGroup = mgIndex === sortedLayout.length - 1;
        
        mg.subGroups.forEach((sg, sgIndex) => {
            const isLastSubGroup = sgIndex === mg.subGroups.length - 1;
            
            sg.staffIds.forEach((_, pIndex) => {
                const isLastPilotInSub = pIndex === sg.staffIds.length - 1;
                
                if (isLastPilotInSub) {
                    if (isLastSubGroup) {
                         // End of Main Group -> Thickest Border
                         // Unless it is the very last column of the table, then standard
                         if (isLastMainGroup) {
                              classes.push('border-r border-black'); 
                         } else {
                              classes.push('border-r-4 border-black'); // Main Group Separator
                         }
                    } else {
                        // End of Sub Group -> Medium Border
                        classes.push('border-r-2 border-black'); // Sub Group Separator
                    }
                } else {
                    // Standard Pilot Column -> Thin Grey
                    classes.push('border-r border-gray-400 dark:border-gray-700');
                }
            });
        });
    });
    return classes;
  }, [sortedLayout]);

  const handleCellMouseDown = (col: number, row: number, e: React.MouseEvent) => {
      // Prevent browser context menu if it's a right click or context menu event
      if (e.button === 2 || e.type === 'contextmenu') { 
          e.preventDefault();
          if (!isCellSelected(col, row)) {
              setCursor({ col, row });
              setSelection({ startCol: col, startRow: row, endCol: col, endRow: row });
          }
          setContextMenuPos({ x: e.clientX, y: e.clientY });
          return;
      }
      
      if (e.shiftKey && selection) {
          setSelection(prev => prev ? { ...prev, endCol: col, endRow: row } : null);
          setCursor({ col, row });
      } else {
          // Check if clicking inside selection
          const alreadySelected = isCellSelected(col, row);
          const isCurrentCursor = cursor?.col === col && cursor?.row === row;

          if (alreadySelected && isCurrentCursor) {
              // Clicking active cell: Don't kill selection, wait for typing or double-click
          } else {
              setCursor({ col, row });
              setSelection({ startCol: col, startRow: row, endCol: col, endRow: row });
              setIsDragging(true);
          }
          
          setIsEditing(false);
          setPendingChar(null);
      }
      
      if (tableContainerRef.current) tableContainerRef.current.focus({ preventScroll: true });
  };

  const handleCellMouseEnter = (col: number, row: number, e: React.MouseEvent) => {
      if (isDragging && selection && e.buttons === 1) { 
          setSelection(prev => prev ? { ...prev, endCol: col, endRow: row } : null);
          setCursor({ col, row });
      }
  };

  useEffect(() => {
      const stopDrag = () => setIsDragging(false);
      window.addEventListener('mouseup', stopDrag);
      return () => window.removeEventListener('mouseup', stopDrag);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (contextMenuPos) return;
      if (isEditing) return;
      if (!cursor) return;

      const { col, row } = cursor;
      const maxCol = flattenedPilots.length - 1;
      const maxRow = calendarDays.length - 1;

      let newCol = col;
      let newRow = row;
      let handled = false;

      if (e.key === 'ArrowUp') { newRow = Math.max(0, row - 1); handled = true; }
      else if (e.key === 'ArrowDown') { newRow = Math.min(maxRow, row + 1); handled = true; }
      else if (e.key === 'ArrowLeft') { newCol = Math.max(0, col - 1); handled = true; }
      else if (e.key === 'ArrowRight') { newCol = Math.min(maxCol, col + 1); handled = true; }
      else if (e.key === 'Tab') {
          e.preventDefault();
          handled = true;
          if (e.shiftKey) {
              if (col > 0) newCol = col - 1;
              else if (row > 0) { newCol = maxCol; newRow = row - 1; }
          } else {
              if (col < maxCol) newCol = col + 1;
              else if (row < maxRow) { newCol = 0; newRow = row + 1; }
          }
      }
      else if (e.key === 'Enter') {
          e.preventDefault();
          handled = true;
          if (e.shiftKey) newRow = Math.max(0, row - 1);
          else newRow = Math.min(maxRow, row + 1);
      }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (canEditRoster) {
              handleBatchDelete();
              handled = true;
          }
      }
      else if (e.key === 'Escape') {
          if (selection && (selection.startCol !== selection.endCol || selection.startRow !== selection.endRow)) {
              setSelection({ startCol: col, startRow: row, endCol: col, endRow: row });
              handled = true;
          }
      }
      else if (e.key === 'F2') {
          if (canEditRoster) {
              setEditMode('modify');
              setIsEditing(true);
              handled = true;
          }
      }
      else if (canEditRoster && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
           setPendingChar(e.key.toUpperCase());
           setEditMode('overwrite');
           setIsEditing(true);
           handled = true;
      }

      if (handled) {
          if (e.shiftKey && (e.key.startsWith('Arrow'))) {
              if (selection) {
                  setSelection({ ...selection, endCol: newCol, endRow: newRow });
                  setCursor({ col: newCol, row: newRow });
              }
          } else if (e.key.startsWith('Arrow') || e.key === 'Tab' || e.key === 'Enter') {
              setCursor({ col: newCol, row: newRow });
              setSelection({ startCol: newCol, startRow: newRow, endCol: newCol, endRow: newRow });
          }
      }
  };

  const handleCommit = (value: string, direction: CommitDirection) => {
      if (!cursor) return;
      
      const code = value.trim().toUpperCase();
      const matchedCode = dutyCodes.find(dc => dc.code === code);
      const newCodeId = matchedCode ? matchedCode.id : (code === '' ? '' : undefined);

      if (newCodeId !== undefined) {
          // Apply to the active selection range
          handleBatchValueUpdate({ dutyCodeId: newCodeId });
      }
      
      setIsEditing(false);
      setPendingChar(null);
      
      if (direction !== 'none') {
          const { col, row } = cursor;
          const maxCol = flattenedPilots.length - 1;
          const maxRow = calendarDays.length - 1;
          let newCol = col;
          let newRow = row;

          if (direction === 'down') newRow = Math.min(maxRow, row + 1);
          if (direction === 'up') newRow = Math.max(0, row - 1);
          if (direction === 'right') {
              if (col < maxCol) newCol = col + 1;
              else if (row < maxRow) { newCol = 0; newRow = row + 1; }
          }
          if (direction === 'left') {
              if (col > 0) newCol = col - 1;
              else if (row > 0) { newCol = maxCol; newRow = row - 1; }
          }

          setCursor({ col: newCol, row: newRow });
          setSelection({ startCol: newCol, startRow: newRow, endCol: newCol, endRow: newRow });
      }

      if (tableContainerRef.current) tableContainerRef.current.focus({ preventScroll: true });
  };

  const handleBatchValueUpdate = (update: Partial<RosterEntry>) => {
      if (!selection || !onBatchUpdate) return;
      const { minCol, maxCol, minRow, maxRow } = normalizeSelection(selection);
      
      const updates: any[] = [];
      for (let c = minCol; c <= maxCol; c++) {
          for (let r = minRow; r <= maxRow; r++) {
              const staffId = flattenedPilots[c];
              const date = calendarDays[r].dateString;
              updates.push({ staffId, date, newEntry: update });
          }
      }
      onBatchUpdate(updates);
  };
  
  const handleBatchDelete = () => {
      handleBatchValueUpdate({ dutyCodeId: '' });
  };
  
  const handleContextMenuAction = (action: string, value?: string) => {
      if (action === 'underline') {
          if (!selection) return;
          const { minCol, minRow } = normalizeSelection(selection);
          const firstEntry = rosterData[calendarDays[minRow].dateString]?.[flattenedPilots[minCol]];
          handleBatchValueUpdate({ isUnderlined: !firstEntry?.isUnderlined });
      }
      if (action === 'color') handleBatchValueUpdate({ customColor: value });
      if (action === 'swap' && cursor) {
          const date = calendarDays[cursor.row].dateString;
          if (onSwapRequest) onSwapRequest(date);
      }
      setContextMenuPos(null);
  };

  const isCellSelected = (col: number, row: number) => {
      if (!selection) return false;
      const { minCol, maxCol, minRow, maxRow } = normalizeSelection(selection);
      return col >= minCol && col <= maxCol && row >= minRow && row <= maxRow;
  };

  const helicopterPilots = useMemo(() => staff.filter(s => s.subDepartments.includes('Helicopter')).map(s => s.id), [staff]);
  const fixedWingPilots = useMemo(() => staff.filter(s => s.subDepartments.includes('Fixed Wing')).map(s => s.id), [staff]);
  const mainGroupColSpans = sortedLayout.map(mg => mg.subGroups.reduce((acc, sg) => acc + (sg.staffIds || []).length, 0));
  const visibleStats = settings?.statisticsColumns.filter(sc => sc.visible) || [];

  const handleTableScroll = () => {
      if (topScrollRef.current && tableContainerRef.current) topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
  };
  const handleTopScroll = () => {
      if (topScrollRef.current && tableContainerRef.current) tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
  };
  useEffect(() => {
      if (tableContainerRef.current) setTableWidth(tableContainerRef.current.scrollWidth);
  }, [flattenedPilots]);

  if (!layout || !settings) return <div>No Layout Configured</div>;
  
  const printFontSize = settings.printConfig?.fontSize || '7pt';
  const printRowHeight = settings.printConfig?.rowHeight || '8mm';
  const printMargins = settings.printConfig?.margins || '3mm';
  const printDateColWidth = settings.printConfig?.dateColumnWidth || '6mm';
  const printStatsColWidth = settings.printConfig?.statsColumnWidth || '8mm';

  return (
    <>
    <div className="flex flex-col h-full print:hidden" onClick={() => setContextMenuPos(null)}>
        <datalist id="pilot-duty-codes-list">
            {dutyCodes.map(dc => <option key={dc.id} value={dc.code}>{dc.description}</option>)}
        </datalist>

        <div ref={topScrollRef} className="overflow-x-auto mb-1 w-full flex-shrink-0" onScroll={handleTopScroll}>
            <div style={{ width: tableWidth, height: '1px' }}></div>
        </div>

        <div 
            ref={tableContainerRef} 
            className="overflow-auto border border-gray-400 dark:border-gray-700 flex-grow rounded-sm bg-white select-none outline-none" 
            onScroll={handleTableScroll} 
            onKeyDown={handleKeyDown} 
            tabIndex={0} 
            style={{ outline: 'none' }}
        >
            <table className="w-full border-collapse bg-white dark:bg-gray-800 text-xs">
                <thead className="bg-white dark:bg-gray-800 z-30 sticky top-0">
                    <tr className="text-center font-bold h-8 shadow-[0_1px_0_rgba(0,0,0,0.1)]">
                         <th className="p-1 border border-black w-[80px] min-w-[80px] sticky left-0 z-40 bg-white dark:bg-gray-800" colSpan={2}>{displayDate}</th>
                         {sortedLayout.map((mg, idx) => (
                             <th key={mg.id} colSpan={mainGroupColSpans[idx]} className={`p-1 border-y border-black border-r uppercase text-sm bg-orange-200 dark:bg-orange-900 ${idx === sortedLayout.length - 1 ? 'border-r' : 'border-r-4'}`}>{mg.name}</th>
                         ))}
                         <th colSpan={visibleStats.length} className="p-1 border border-black bg-gray-200 dark:bg-gray-700">STATS</th>
                    </tr>
                    <tr className="text-center font-bold h-8">
                         <th className="p-1 border border-black sticky left-0 z-40 bg-white dark:bg-gray-800 w-[35px] min-w-[35px]">DATE</th>
                         <th className="p-1 border border-black sticky left-[35px] z-40 bg-white dark:bg-gray-800 w-[45px] min-w-[45px]">DAY</th>
                         {sortedLayout.flatMap((mg, mgIdx) => mg.subGroups.map((sg, sgIdx) => {
                             const isLastSubGroup = sgIdx === mg.subGroups.length - 1;
                             const isLastMainGroup = mgIdx === sortedLayout.length - 1;
                             let borderClass = 'border-r border-black';
                             if (isLastSubGroup) {
                                  borderClass = isLastMainGroup ? 'border-r border-black' : 'border-r-4 border-black';
                             } else {
                                  borderClass = 'border-r-2 border-black';
                             }
                             
                             return (
                                 <th key={sg.id} colSpan={(sg.staffIds||[]).length} className={`p-1 border-y border-black ${borderClass}`} style={{ backgroundColor: sg.color }}>{sg.name}</th>
                             );
                         }))}
                         {visibleStats.map(s => <th key={s.id} className="p-1 border border-black w-[40px] bg-gray-100 dark:bg-gray-700">{s.label}</th>)}
                    </tr>
                    <tr className="text-center font-bold h-8 border-b-2 border-black">
                         <th className="p-1 border border-black sticky left-0 z-40 bg-white dark:bg-gray-800 w-[35px] min-w-[35px]"></th>
                         <th className="p-1 border border-black sticky left-[35px] z-40 bg-white dark:bg-gray-800 w-[45px] min-w-[45px]"></th>
                         {flattenedPilots.map((pid, idx) => (
                             <th key={pid} className={`p-1 border-b border-black w-[8ch] min-w-[8ch] bg-white dark:bg-gray-800 text-[10px] truncate ${columnBorderClasses[idx]}`}>
                                 {formatStaffName(staffMap.get(pid)?.name || 'Unknown')}
                             </th>
                         ))}
                         {visibleStats.map(s => <th key={`empty_${s.id}`} className="p-1 border border-black bg-white dark:bg-gray-800"></th>)}
                    </tr>
                </thead>

                <tbody>
                    {calendarDays.map((day, rIndex) => {
                        const dailyData = rosterData[day.dateString] || {};
                        const rowClass = day.isWeekend ? 'bg-orange-50/30' : '';

                        const statsValues = {
                            heli_pilots: helicopterPilots.filter(pid => {
                                const c = dutyCodes.find(dc => dc.id === dailyData[pid]?.dutyCodeId);
                                // FIX: Check valid duty code AND not off duty AND Matches 'H' pattern (e.g. H, TRG/H) or generic On
                                return c && !c.isOffDuty && (c.code.includes('H') || c.code.includes('ON') || c.code === 'SEA');
                            }).length,
                            fixed_wing: fixedWingPilots.filter(pid => {
                                const c = dutyCodes.find(dc => dc.id === dailyData[pid]?.dutyCodeId);
                                return c && !c.isOffDuty;
                            }).length,
                            off: flattenedPilots.filter(pid => {
                                const c = dutyCodes.find(dc => dc.id === dailyData[pid]?.dutyCodeId);
                                // FIX: Use isOffDuty flag instead of hardcoded strings
                                return c && c.isOffDuty;
                            }).length,
                            ph: flattenedPilots.filter(pid => {
                                const c = dutyCodes.find(dc => dc.id === dailyData[pid]?.dutyCodeId);
                                // FIX: Check for 'PH' string specifically as it is a unique type
                                return c && (c.code === 'PH' || (c.isOffDuty && c.code.includes('LIEU')));
                            }).length
                        };

                        return (
                            <tr key={day.dateString} className={`h-8 ${rowClass}`}>
                                <td className={`p-1 border-r border-b border-black font-bold text-center sticky left-0 z-10 w-[35px] min-w-[35px] ${day.isWeekend ? 'bg-orange-50' : 'bg-white dark:bg-gray-800'}`}>{String(day.dayNum).padStart(2,'0')}</td>
                                <td className={`p-1 border-r border-b border-black text-center sticky left-[35px] z-10 w-[45px] min-w-[45px] ${day.isWeekend ? 'bg-orange-50' : 'bg-white dark:bg-gray-800'}`}>{day.dayName}</td>
                                
                                {flattenedPilots.map((pid, cIndex) => {
                                    const isCursor = cursor?.col === cIndex && cursor?.row === rIndex;
                                    const selected = isCellSelected(cIndex, rIndex);
                                    
                                    return (
                                        <PilotDutyCell 
                                            key={`${pid}-${day.dateString}`}
                                            staffId={pid}
                                            date={day.dateString}
                                            entry={dailyData[pid]}
                                            dutyCodes={dutyCodes}
                                            isWeekend={day.isWeekend}
                                            isCursor={isCursor}
                                            isSelected={selected}
                                            isEditing={isCursor && isEditing}
                                            editMode={editMode}
                                            initialChar={isCursor && pendingChar ? pendingChar : undefined}
                                            borderRightClass={columnBorderClasses[cIndex]}
                                            onMouseDown={(e) => handleCellMouseDown(cIndex, rIndex, e)}
                                            onMouseEnter={(e) => handleCellMouseEnter(cIndex, rIndex, e)}
                                            onDoubleClick={() => {
                                                if (canEditRoster) {
                                                    setCursor({ col: cIndex, row: rIndex });
                                                    setEditMode('modify');
                                                    setIsEditing(true);
                                                }
                                            }}
                                            onCommit={handleCommit}
                                            onCancel={() => {
                                                setIsEditing(false);
                                                setPendingChar(null);
                                                if (tableContainerRef.current) tableContainerRef.current.focus({ preventScroll: true });
                                            }}
                                            onContextMenu={(e) => handleCellMouseDown(cIndex, rIndex, e)}
                                        />
                                    );
                                })}

                                {visibleStats.map(s => (
                                    <td key={`${s.id}-${day.dateString}`} className="p-1 border-r border-b border-black text-center font-bold bg-gray-50 dark:bg-gray-700">
                                        {statsValues[s.id as keyof typeof statsValues]}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>

        {contextMenuPos && (
            <ContextMenu 
                position={contextMenuPos} 
                onClose={() => setContextMenuPos(null)}
                onAction={handleContextMenuAction}
                canEdit={canEditRoster}
            />
        )}
        
        {(settings.notes || []).length > 0 && (
            <div className="mt-4 p-2 bg-yellow-50 dark:bg-gray-800 border-t-2 border-gray-300 flex-shrink-0">
                <div className="grid grid-cols-4 gap-4">
                    {(settings.notes || []).map((note, idx) => (
                         <div key={note.id} className="flex gap-1"><BufferedInput value={note.text} onCommit={val => { const n = [...(settings.notes||[])]; n[idx].text=val; onNotesUpdate(n); }} className="w-full bg-yellow-100 p-1 border rounded text-xs" /></div>
                    ))}
                </div>
            </div>
        )}
    </div>
    
    <div className="hidden print:block w-full">
            <style>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: ${printMargins};
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        background: white;
                    }
                    #root, main, .container {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        max-width: none !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    nav, header, aside, .print-hidden {
                        display: none !important;
                    }
                    .print-table {
                        width: 287mm !important;
                        border-collapse: collapse !important;
                        table-layout: fixed !important;
                        font-size: ${printFontSize} !important;
                    }
                    .print-table th, .print-table td {
                        border: 0.5pt solid #000 !important;
                        padding: 0 !important;
                        text-align: center;
                        vertical-align: middle;
                        overflow: hidden;
                    }
                    .print-table tr {
                        height: ${printRowHeight} !important;
                    }
                    .col-date { width: ${printDateColWidth} !important; }
                    .col-stat { width: ${printStatsColWidth} !important; }
                    .print-weekend {
                        background-color: #fcf8f2 !important;
                    }
                    /* Specific border widths for separators in print */
                    .border-r-thick { border-right-width: 2pt !important; }
                    .border-r-med { border-right-width: 1pt !important; }
                }
            `}</style>
            
            <div className="text-center mb-2 pb-2 border-b-2 border-black">
                 <h1 className="text-xl font-bold uppercase tracking-widest">
                    Pilot Roster - {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase()}
                 </h1>
            </div>

            <table className="print-table">
                <thead>
                    <tr>
                        <th colSpan={2} className="col-date font-bold bg-white">{displayDate}</th>
                        {sortedLayout.map((mainGroup, mgIndex) => {
                            const isLastMainGroup = mgIndex === sortedLayout.length - 1;
                            const borderClass = isLastMainGroup ? '' : 'border-r-thick';
                            return (
                                <th key={mainGroup.id} colSpan={mainGroupColSpans[mgIndex]} className={`font-bold bg-white uppercase ${borderClass}`}>{mainGroup.name}</th>
                            );
                        })}
                        <th colSpan={visibleStats.length} className="font-bold bg-white uppercase">STATS</th>
                    </tr>
                    <tr>
                        <th className="col-date bg-white">DATE</th>
                        <th className="col-date bg-white">DAY</th>
                        {sortedLayout.flatMap((mg, mgIdx) => mg.subGroups.map((sg, sgIdx) => {
                             const isLastSubGroup = sgIdx === mg.subGroups.length - 1;
                             const isLastMainGroup = mgIdx === sortedLayout.length - 1;
                             let borderClass = '';
                             if (isLastSubGroup) {
                                  borderClass = isLastMainGroup ? '' : 'border-r-thick';
                             } else {
                                  borderClass = 'border-r-med';
                             }
                            return (
                                <th key={sg.id} colSpan={(sg.staffIds || []).length} className={`font-bold ${borderClass}`} style={{ backgroundColor: sg.color || '#fed7aa' }}>{sg.name}</th>
                            );
                        }))}
                        {visibleStats.map(stat => (<th key={stat.id} className="col-stat bg-white">{stat.label}</th>))}
                    </tr>
                    <tr>
                        <th className="col-date bg-white"></th>
                        <th className="col-date bg-white"></th>
                        {flattenedPilots.map((staffId, idx) => {
                             let borderClass = '';
                             // Map tailwind classes to print classes
                             if (columnBorderClasses[idx].includes('border-r-4')) borderClass = 'border-r-thick';
                             else if (columnBorderClasses[idx].includes('border-r-2')) borderClass = 'border-r-med';
                             
                             return (<th key={staffId} className={`col-data bg-white px-1 ${borderClass}`}>{formatStaffName(staffMap.get(staffId)?.name || 'Unknown')}</th>);
                        })}
                        {visibleStats.map(stat => <th key={`p_name_empty_${stat.id}`} className="col-stat bg-white"></th>)}
                    </tr>
                </thead>
                <tbody>
                    {calendarDays.map(({ dayNum, dateString, dayName, isWeekend }) => {
                        const dailyData = rosterData[dateString] || {};
                        const statsValues = {
                            heli_pilots: helicopterPilots.filter(pid => {
                                const entry = dailyData[pid];
                                if (!entry) return false;
                                const code = dutyCodes.find(dc => dc.id === entry.dutyCodeId);
                                return code && !code.isOffDuty && (code.code.includes('H') || code.code.includes('ON') || code.code === 'SEA');
                            }).length,
                            fixed_wing: fixedWingPilots.filter(pid => {
                                const entry = dailyData[pid];
                                if (!entry) return false;
                                const code = dutyCodes.find(dc => dc.id === entry.dutyCodeId);
                                return code && !code.isOffDuty;
                            }).length,
                            off: flattenedPilots.filter(pid => {
                                const entry = dailyData[pid];
                                if (!entry) return false;
                                const code = dutyCodes.find(dc => dc.id === entry.dutyCodeId);
                                return code && code.isOffDuty;
                            }).length,
                            ph: flattenedPilots.filter(pid => {
                                const entry = dailyData[pid];
                                if (!entry) return false;
                                const code = dutyCodes.find(dc => dc.id === entry.dutyCodeId);
                                return code && (code.code === 'PH' || (code.isOffDuty && code.code.includes('LIEU')));
                            }).length
                        };
                        const rowClass = isWeekend ? 'print-weekend' : '';
                        return (
                            <tr key={dateString} className={rowClass}>
                                <td className="col-date font-bold">{String(dayNum).padStart(2, '0')}</td>
                                <td className="col-date">{dayName.substring(0, 3)}</td>
                                {flattenedPilots.map((staffId, idx) => {
                                    const entry = dailyData[staffId];
                                    const code = entry ? dutyCodes.find(dc => dc.id === entry.dutyCodeId) : undefined;
                                    let style: React.CSSProperties = {};
                                    if (code?.color) style = { backgroundColor: code.color, color: code.textColor };
                                    
                                     let borderClass = '';
                                     if (columnBorderClasses[idx].includes('border-r-4')) borderClass = 'border-r-thick';
                                     else if (columnBorderClasses[idx].includes('border-r-2')) borderClass = 'border-r-med';

                                    return (<td key={`${staffId}-${dateString}`} className={`col-data ${borderClass}`} style={style}><span className={entry?.isUnderlined ? 'underline' : ''}>{code?.code || ''}</span></td>);
                                })}
                                {visibleStats.map(stat => (<td key={`${stat.id}-${dateString}`} className="col-stat font-bold">{statsValues[stat.id as keyof typeof statsValues]}</td>))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div className="mt-2 text-[7pt] flex flex-wrap gap-4">
               {(settings.notes || []).map(note => (<div key={note.id} className="border border-black p-1 bg-yellow-100 min-w-[100px]">{note.text}</div>))}
            </div>
    </div>
    </>
  );
};

export default PilotRoster;
