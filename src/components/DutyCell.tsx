
import React, { useState, useRef, useEffect } from 'react';
import { RosterEntry, ShiftCodeDefinition, RosterSettings } from '../types.ts';

interface DutyCellProps {
  id: string;
  entry: RosterEntry | undefined;
  dutyCodes: ShiftCodeDefinition[];
  isWeekend: boolean;
  isPublicHoliday?: boolean; 
  settings: RosterSettings;
  onCellUpdate: (newEntryData: Partial<RosterEntry>) => void;
  canEdit: boolean;
  isActive: boolean;
  isSelected: boolean;
  onActivate: (e: React.MouseEvent) => void;
  onSwapRequest?: (date: string) => void;
}

const DetailedEditor: React.FC<{
  onClose: () => void;
  onSave: (codeId: string, note: string) => void;
  dutyCodes: ShiftCodeDefinition[];
  initialCodeId: string;
  initialNote: string;
}> = ({ onClose, onSave, dutyCodes, initialCodeId, initialNote }) => {
    const [editedCodeId, setEditedCodeId] = useState(initialCodeId);
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

    const handleSave = () => {
        onSave(editedCodeId, editedNote);
    };

    return (
        <div 
            ref={popoverRef} 
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[60] bg-white dark:bg-gray-900 rounded-lg shadow-2xl p-4 border border-gray-300 dark:border-gray-600 w-64 text-left cursor-default"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
        >
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Duty Code</label>
                    <select 
                        onChange={(e) => setEditedCodeId(e.target.value)}
                        value={editedCodeId}
                        className="block w-full text-sm p-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-brand-primary focus:border-brand-primary"
                        autoFocus
                    >
                        <option value="" disabled>Select code</option>
                        {dutyCodes.map(dc => (
                        <option key={dc.id} value={dc.id}>{dc.code} - {dc.description}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Note</label>
                    <textarea 
                        rows={3} 
                        value={editedNote}
                        onChange={(e) => setEditedNote(e.target.value)}
                        className="block w-full text-sm p-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-brand-primary focus:border-brand-primary"
                    />
                </div>
                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="bg-gray-200 dark:bg-gray-600 text-xs py-1.5 px-2 rounded-md">Cancel</button>
                    <button onClick={handleSave} className="bg-brand-primary text-white text-xs py-1 px-3 rounded-md">Save</button>
                </div>
            </div>
        </div>
    );
};

const ContextMenu: React.FC<{
    onClose: () => void;
    onToggleUnderline: () => void;
    onSwap: () => void;
    onSetColor: (color?: string) => void;
    canEdit: boolean;
}> = ({ onClose, onToggleUnderline, onSwap, onSetColor, canEdit }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);
    
    const highlightColors = [
        { name: 'Red', hex: '#fecaca' },
        { name: 'Orange', hex: '#fed7aa' },
        { name: 'Green', hex: '#bbf7d0' },
        { name: 'Blue', hex: '#bfdbfe' },
        { name: 'Purple', hex: '#e9d5ff' },
    ];

    return (
        <div ref={menuRef} className="absolute z-[100] bg-white dark:bg-gray-800 border dark:border-gray-600 shadow-lg rounded-md py-1 w-40 left-full top-0">
             {canEdit && (
                 <>
                    <button 
                        onClick={() => { onToggleUnderline(); onClose(); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-white"
                    >
                        Toggle Underline
                    </button>
                    
                    <div className="px-3 py-2 border-t dark:border-gray-600">
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Highlight</p>
                        <div className="flex gap-1 justify-between mb-2">
                             {highlightColors.map(c => (
                                 <button
                                    key={c.name}
                                    onClick={() => { onSetColor(c.hex); onClose(); }}
                                    className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: c.hex }}
                                    title={c.name}
                                 />
                             ))}
                        </div>
                        <button 
                            onClick={() => { onSetColor(undefined); onClose(); }}
                            className="w-full text-center text-[10px] text-red-500 hover:text-red-700 hover:underline"
                        >
                            Clear Highlight
                        </button>
                    </div>
                    <div className="border-t dark:border-gray-600 my-1"></div>
                 </>
             )}
             
             <button 
                onClick={() => { onSwap(); onClose(); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-white flex items-center gap-2"
            >
                <span className="text-purple-500">⇄</span> Request Swap
             </button>
        </div>
    );
};

const DutyCellComponent: React.FC<DutyCellProps> = ({ id, entry, dutyCodes, isWeekend, isPublicHoliday, settings, onCellUpdate, canEdit, isActive, isSelected, onActivate, onSwapRequest }) => {
  const [isDetailedEditing, setIsDetailedEditing] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [editModeTrigger, setEditModeTrigger] = useState<'type' | 'enter' | null>(null);
  
  const [isDragOver, setIsDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const saveLock = useRef(false);
  
  const dutyCode = entry ? dutyCodes.find(dc => dc.id === entry.dutyCodeId) : undefined;
  
  useEffect(() => {
    if (!isInlineEditing) {
        setInputValue(dutyCode?.code || '');
    }
  }, [dutyCode, isInlineEditing]);

  useEffect(() => {
    if (isActive) {
        if (isInlineEditing) {
            if (inputRef.current) {
                inputRef.current.focus();
                if (editModeTrigger === 'enter') {
                    inputRef.current.select();
                }
            }
        } else {
            cellRef.current?.focus();
        }
    } else {
        setIsInlineEditing(false);
        saveLock.current = false;
        setEditModeTrigger(null);
        setShowContextMenu(false);
    }
  }, [isActive, isInlineEditing, editModeTrigger]);
  
  const commitChange = (fromEnterKey: boolean = false) => {
    if (saveLock.current) return;
    if (fromEnterKey) saveLock.current = true;

    const value = inputValue.trim().toUpperCase();
    let codeIdToSave: string | undefined = undefined;

    if (value === '') {
        codeIdToSave = '';
    } else {
        const exactMatch = dutyCodes.find(dc => dc.code.toUpperCase() === value);
        if (exactMatch) {
            codeIdToSave = exactMatch.id;
        } else {
            const partialMatch = dutyCodes.find(dc => dc.code.toUpperCase().startsWith(value));
            if (partialMatch) {
                codeIdToSave = partialMatch.id;
            } else {
                codeIdToSave = ''; 
            }
        }
    }

    if (codeIdToSave !== undefined && codeIdToSave !== entry?.dutyCodeId) {
        onCellUpdate({ dutyCodeId: codeIdToSave });
    }

    setIsInlineEditing(false);
    setEditModeTrigger(null);
    setTimeout(() => {
        saveLock.current = false;
    }, 50);
  };

  const handleBlur = () => {
    if (!saveLock.current && isInlineEditing) {
        commitChange(false);
    }
  };
  
  const handleDoubleClick = () => {
    if (canEdit) {
      setIsDetailedEditing(true);
    }
  };
  
  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      onActivate(e); 
      setShowContextMenu(true);
  };

  const handleDetailedSave = (codeId: string, note: string) => {
    onCellUpdate({ dutyCodeId: codeId, note: note });
    setIsDetailedEditing(false);
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
      if (isInlineEditing || isDetailedEditing) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) return;

      if (canEdit && e.key === 'Enter') {
          e.preventDefault();
          setEditModeTrigger('enter');
          setIsInlineEditing(true);
      } 
      else if (canEdit && (e.key === 'Delete' || e.key === 'Backspace')) {
          e.preventDefault();
          onCellUpdate({ dutyCodeId: '' });
      }
      else if (canEdit && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          setEditModeTrigger('type');
          setInputValue(e.key.toUpperCase());
          setIsInlineEditing(true);
      }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          commitChange(true);
          return;
      }
      if (e.key === 'Enter') {
          e.preventDefault();
          commitChange(true);
      } else if (e.key === 'Tab') {
          commitChange(true); 
      } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setInputValue(dutyCode?.code || '');
          setIsInlineEditing(false);
          setEditModeTrigger(null);
      }
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    if (!canEdit) return;
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!canEdit) return;
    const codeId = e.dataTransfer.getData('application/b4flite-duty-code');
    if (codeId !== undefined) {
        onCellUpdate({ dutyCodeId: codeId });
        if (!isActive && !isSelected) onActivate(e as unknown as React.MouseEvent);
    }
  };

  const rowHeightVal = typeof settings.rowHeight === 'number' ? settings.rowHeight : (settings.rowHeight as any)?.value ?? 3;
  const rowHeightUnit = typeof settings.rowHeight === 'number' ? 'ch' : (settings.rowHeight as any)?.unit ?? 'ch';
  const heightString = `${rowHeightVal}${rowHeightUnit}`;

  let backgroundColor = entry?.customColor || dutyCode?.color;
  
  if (!backgroundColor) {
      if (isPublicHoliday) backgroundColor = '#bae6fd'; 
      else if (isWeekend) backgroundColor = '#fed7aa'; 
  }
  
  const color = dutyCode?.textColor ?? undefined;
  
  // Only apply structural borders here if they are special (Weekend/PH)
  // The base grid borders are handled by the parent TD in RosterTable
  let borderClass = '';
  if (isPublicHoliday) borderClass = 'border-x-2 border-blue-600';
  else if (isWeekend) borderClass = 'border-x-2 border-orange-500';
  
  const activeStyle = isActive ? { outline: '2px solid #0D47A1', outlineOffset: '-2px', zIndex: 50 } : {};
  const selectionStyle = isSelected && !isActive ? { backgroundColor: 'rgba(187, 222, 251, 0.5)' } : {};
  const dragStyle = isDragOver ? { outline: '2px dashed #0D47A1', outlineOffset: '-2px', backgroundColor: '#e0f2fe', zIndex: 60 } : {};

  // Tooltip construction
  const tooltipText = [
      entry?.note ? `Note: ${entry.note}` : null,
      entry?.violation ? `Violation: ${entry.violation}` : null
  ].filter(Boolean).join('\n');

  return (
    <div
      id={id}
      ref={cellRef}
      className={`w-full h-full flex items-center justify-center relative ${canEdit ? 'cursor-pointer' : ''} ${borderClass} outline-none`}
      style={{ 
          backgroundColor: isSelected && !isActive ? undefined : backgroundColor, 
          color, 
          // width/height filled by parent TD
          minHeight: heightString,
          ...selectionStyle,
          ...activeStyle,
          ...dragStyle
      }}
      title={tooltipText}
      onClick={onActivate}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleCellKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      tabIndex={isActive ? 0 : -1} 
    >
      {isActive && canEdit && isInlineEditing ? (
        <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            onBlur={handleBlur}
            onClick={(e) => e.stopPropagation()} 
            onKeyDown={handleInputKeyDown}
            className="w-full h-full text-center border-none outline-none p-0 m-0 font-bold bg-white text-black absolute inset-0 uppercase focus:ring-0"
            autoComplete="off"
        />
      ) : (
        <div className={`w-full h-full flex items-center justify-center font-bold ${entry?.isUnderlined ? 'underline decoration-2 decoration-current' : ''}`}>
            {dutyCode?.code || ''}
        </div>
      )}
      
      {entry?.note && <div className="absolute top-0 left-0 h-0 w-0 border-t-8 border-r-8 border-t-orange-500 border-r-transparent pointer-events-none"></div>}
      {entry?.violation && <div className="absolute top-0 right-0 h-0 w-0 border-b-8 border-l-8 border-b-transparent border-l-status-danger pointer-events-none"></div>}
      
      {isDetailedEditing && (
        <DetailedEditor 
            onClose={() => setIsDetailedEditing(false)}
            onSave={handleDetailedSave}
            dutyCodes={dutyCodes}
            initialCodeId={entry?.dutyCodeId || ''}
            initialNote={entry?.note || ''}
        />
      )}

      {showContextMenu && (
          <ContextMenu 
            onClose={() => setShowContextMenu(false)}
            onToggleUnderline={() => onCellUpdate({ isUnderlined: !entry?.isUnderlined })}
            onSetColor={(c) => onCellUpdate({ customColor: c })}
            onSwap={() => onSwapRequest && onSwapRequest(id.split('-').pop()!)}
            canEdit={canEdit}
          />
      )}
    </div>
  );
};

// Optimization: Memoize the cell to prevent un-necessary re-renders of the large grid.
const DutyCell = React.memo(DutyCellComponent, (prevProps, nextProps) => {
    return (
        prevProps.entry === nextProps.entry &&
        prevProps.isActive === nextProps.isActive &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.canEdit === nextProps.canEdit &&
        prevProps.isWeekend === nextProps.isWeekend &&
        prevProps.isPublicHoliday === nextProps.isPublicHoliday &&
        prevProps.dutyCodes === nextProps.dutyCodes
    );
});

export default DutyCell;
