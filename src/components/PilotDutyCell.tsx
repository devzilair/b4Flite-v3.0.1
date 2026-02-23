import React, { useRef, useEffect, useState } from 'react';
import { RosterEntry, ShiftCodeDefinition } from '../types.ts';

type CommitDirection = 'up' | 'down' | 'left' | 'right' | 'none';

interface PilotDutyCellProps {
  // Data
  staffId: string;
  date: string;
  entry: RosterEntry | undefined;
  dutyCodes: ShiftCodeDefinition[];
  isWeekend: boolean;

  // State Flags
  isCursor: boolean;     
  isSelected: boolean;   
  isEditing: boolean;    
  editMode: 'overwrite' | 'modify'; 
  initialChar?: string;
  
  // Styling
  borderRightClass?: string; // NEW: Allows parent to dictate the right border (e.g. for group separators)

  // Actions
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onCommit: (value: string, direction: CommitDirection) => void;
  onCancel: () => void; 
  
  // Context Menu
  onContextMenu: (e: React.MouseEvent) => void;
}

const PilotDutyCellComponent: React.FC<PilotDutyCellProps> = ({ 
    entry, 
    dutyCodes, 
    isWeekend, 
    isCursor,
    isSelected,
    isEditing,
    editMode,
    initialChar,
    borderRightClass,
    onMouseDown,
    onMouseEnter,
    onDoubleClick,
    onCommit,
    onCancel,
    onContextMenu
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const dutyCode = entry ? dutyCodes.find(dc => dc.id === entry.dutyCodeId) : undefined;

  useEffect(() => {
    if (isEditing) {
        if (editMode === 'overwrite') {
            setInputValue(initialChar || ''); 
        } else {
            setInputValue(dutyCode?.code || '');
        }

        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                if (editMode === 'modify') {
                    inputRef.current.select();
                }
            }
        }, 0);
    }
  }, [isEditing, editMode, dutyCode, initialChar]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (isEditing) {
          if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              onCommit(inputValue, e.shiftKey ? 'up' : 'down'); 
          } else if (e.key === 'Tab') {
              e.preventDefault();
              e.stopPropagation();
              onCommit(inputValue, e.shiftKey ? 'left' : 'right');
          } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
          }
          e.stopPropagation(); 
      }
  };

  const handleBlur = () => {
      if (isEditing) {
          onCommit(inputValue, 'none');
      }
  };

  let bgColor = entry?.customColor || dutyCode?.color;
  if (!bgColor && isWeekend) bgColor = '#fff7ed'; 

  const textColor = dutyCode?.textColor;
  
  // Calculate borders. 
  // If borderRightClass is provided (Department Separator), it overrides the default right border.
  // Weekend borders are visual highlights, structural separators take precedence.
  const rightBorder = borderRightClass 
      ? borderRightClass 
      : (isWeekend ? 'border-r-2 border-orange-400' : 'border-r border-gray-300 dark:border-gray-700');
      
  const bottomBorder = isWeekend 
      ? 'border-b border-gray-300 dark:border-gray-600' 
      : 'border-b border-gray-300 dark:border-gray-700';

  const leftBorder = isWeekend ? 'border-l-2 border-orange-400' : '';

  const borderClass = `${rightBorder} ${bottomBorder} ${leftBorder}`;
  
  const style: React.CSSProperties = {
      backgroundColor: bgColor,
      color: textColor,
      width: '8ch',
      minWidth: '8ch',
      height: '100%',
      position: 'relative',
      userSelect: 'none', 
  };

  if (isSelected && !isEditing) {
      style.boxShadow = 'inset 0 0 0 2px rgba(59, 130, 246, 0.4)';
      if (!isCursor) {
          style.backgroundColor = undefined; 
          style.backgroundImage = `linear-gradient(rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.2))`; 
      }
  }
  
  const cursorStyle: React.CSSProperties = isCursor ? {
      outline: '2px solid #0D47A1',
      outlineOffset: '-2px',
      zIndex: 50
  } : {};

  return (
    <td
      className={`p-0 text-center align-middle ${borderClass} cursor-cell`}
      style={{ ...style, ...cursorStyle }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onDragStart={(e) => e.preventDefault()} 
    >
      <div className="w-full h-full flex items-center justify-center font-bold text-xs relative">
          {isEditing ? (
              <input 
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="w-full h-full text-center border-none p-0 bg-white text-xs font-bold absolute inset-0 uppercase focus:outline-none focus:ring-0 text-black z-[60]"
                autoComplete="off"
              />
          ) : (
              <span className={entry?.isUnderlined ? 'underline decoration-2 decoration-current' : ''}>
                {dutyCode?.code || ''}
              </span>
          )}
          
          {!isEditing && entry?.note && (
              <div className="absolute top-0 left-0 w-0 h-0 border-t-[6px] border-r-[6px] border-t-orange-500 border-r-transparent pointer-events-none"></div>
          )}
          
          {!isEditing && entry?.violation && (
              <div className="absolute top-0 right-0 w-0 h-0 border-t-[6px] border-l-[6px] border-t-red-500 border-l-transparent pointer-events-none"></div>
          )}
      </div>
    </td>
  );
};

export const PilotDutyCell = React.memo(PilotDutyCellComponent);
export default PilotDutyCell;