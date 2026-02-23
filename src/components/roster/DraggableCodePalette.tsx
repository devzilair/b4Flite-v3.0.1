
import React from 'react';
import { ShiftCodeDefinition } from '../../types';

interface DraggableCodePaletteProps {
    codes: ShiftCodeDefinition[];
    isOpen: boolean;
    onClose: () => void;
}

export const DraggableCodePalette: React.FC<DraggableCodePaletteProps> = ({ codes, isOpen, onClose }) => {
    if (!isOpen) return null;

    const onDragStart = (e: React.DragEvent, codeId: string) => {
        // Use a custom MIME type to ensure we don't accidentally drop text
        e.dataTransfer.setData('application/b4flite-duty-code', codeId);
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className="fixed sm:right-4 sm:top-24 sm:bottom-4 sm:w-48 bottom-0 left-0 right-0 h-48 sm:h-auto bg-white dark:bg-gray-800 shadow-2xl rounded-t-xl sm:rounded-lg border-t sm:border border-gray-200 dark:border-gray-700 z-50 flex flex-col animate-fade-in print:hidden">
            <div className="p-3 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 sm:rounded-t-lg">
                <h3 className="font-bold text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    Palette
                </h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            
            {/* Desktop: Vertical List. Mobile: Horizontal Grid */}
            <div className="p-2 overflow-y-auto sm:overflow-y-auto overflow-x-hidden flex-1 sm:space-y-2 grid grid-cols-2 gap-2 sm:block custom-scrollbar">
                
                {/* Eraser Tool */}
                <div
                    draggable
                    onDragStart={(e) => onDragStart(e, "")} // Empty string to clear
                    className="cursor-grab active:cursor-grabbing p-2 rounded border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all select-none group col-span-2 sm:col-span-1"
                >
                    <div className="w-8 h-8 rounded flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-gray-600 dark:text-gray-300">Eraser</span>
                        <span className="text-[10px] text-gray-400">Drag to clear cell</span>
                    </div>
                </div>

                <hr className="border-gray-100 dark:border-gray-700 my-2 col-span-2 sm:block hidden" />

                {codes.map(code => (
                    <div
                        key={code.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, code.id)}
                        className="cursor-grab active:cursor-grabbing p-2 rounded border flex items-center gap-3 hover:shadow-md transition-all select-none transform hover:-translate-y-0.5"
                        style={{ 
                            backgroundColor: 'var(--bg-opacity)', 
                            borderColor: 'rgba(0,0,0,0.1)' 
                        }}
                    >
                        <div 
                            className="w-8 h-8 rounded flex items-center justify-center font-bold text-xs shadow-sm border border-black/10 flex-shrink-0"
                            style={{ backgroundColor: code.color, color: code.textColor }}
                        >
                            {code.code}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="font-bold text-xs truncate text-gray-800 dark:text-gray-200">{code.code}</span>
                            <span className="text-[10px] text-gray-500 truncate">{code.description}</span>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 sm:rounded-b-lg border-t dark:border-gray-700 text-center pb-safe-bottom">
                <p className="text-[9px] text-gray-400">
                    Desktop: Drag & Drop | Mobile: Tap Cell to Edit
                </p>
            </div>
        </div>
    );
};
