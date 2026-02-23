
import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Department } from '../../types';
import RosterTable from '../RosterTable';
import { useRoster } from '../../hooks/useRoster';
import { useStaff } from '../../hooks/useStaff';
import { useSettings } from '../../hooks/useSettings';

interface MultiRosterPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentDate: Date;
    initialDeptId: string;
}

const MultiRosterPrintModal: React.FC<MultiRosterPrintModalProps> = ({ isOpen, onClose, currentDate, initialDeptId }) => {
    const { departments, staff } = useStaff();
    const { departmentSettings, publicHolidays } = useSettings();
    const { rosters: allRosters } = useRoster();

    const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(new Set([initialDeptId]));
    const [isPrinting, setIsPrinting] = useState(false);

    const year = currentDate.getUTCFullYear();
    const month = currentDate.getUTCMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    const toggleDept = (deptId: string) => {
        setSelectedDeptIds(prev => {
            const next = new Set(prev);
            if (next.has(deptId)) next.delete(deptId);
            else next.add(deptId);
            return next;
        });
    };

    const handlePrint = () => {
        setIsPrinting(true);
        setTimeout(() => {
            window.print();
            setIsPrinting(false);
        }, 100);
    };

    // Prepare data for selected departments
    const reportData = useMemo(() => {
        return Array.from(selectedDeptIds).map((deptId: string) => {
            const dept = departments.find(d => d.id === deptId);
            if (!dept) return null;

            const deptStaff = staff.filter(s => s.departmentId === deptId);
            
            // Access directly via typed dictionaries
            // Explicitly cast to Record<string, any> to avoid potential "unknown index type" errors
            const settings = (departmentSettings as Record<string, any>)[deptId];
            const rosterData = (allRosters as Record<string, any>)[monthKey]?.[deptId] || {};
            const dutyCodes = settings?.shiftCodes || [];
            
            // Don't render if critical config missing
            if (!settings?.rosterSettings) return null;

            return {
                dept,
                deptStaff,
                settings: settings.rosterSettings,
                rosterData,
                dutyCodes
            };
        }).filter(item => item !== null);
    }, [selectedDeptIds, departments, staff, departmentSettings, allRosters, monthKey]);

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col print-overlay">
            {/* Screen Controls */}
            <div className="bg-gray-800 text-white p-4 flex justify-between items-center print:hidden shadow-md z-50">
                <div className="flex items-center gap-4">
                    <h2 className="font-bold text-lg">Multi-Department Print</h2>
                    <div className="flex flex-wrap gap-2">
                        {departments.map(dept => (
                            <label key={dept.id} className="flex items-center space-x-2 cursor-pointer bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded select-none">
                                <input 
                                    type="checkbox" 
                                    checked={selectedDeptIds.has(dept.id)}
                                    onChange={() => toggleDept(dept.id)}
                                    className="form-checkbox text-brand-primary rounded"
                                />
                                <span className="text-sm font-medium">{dept.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors">Close</button>
                    <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-bold flex items-center gap-2 shadow-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Print
                    </button>
                </div>
            </div>

            {/* Print Preview Area */}
            <div className="flex-grow overflow-auto p-8 bg-gray-100 print:p-0 print:bg-white print:overflow-visible">
                <div className="max-w-[297mm] mx-auto bg-white shadow-lg p-[10mm] print:shadow-none print:p-0 print:max-w-none print:mx-0 print:h-auto print-container">
                    <div className="mb-4 text-center">
                        <h1 className="text-xl font-bold uppercase">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })} Consolidated Roster</h1>
                    </div>
                    
                    {reportData.map((data, index) => (
                        <div key={data!.dept.id} className="mb-8 print:break-inside-avoid">
                            <h3 className="text-lg font-bold mb-2 uppercase border-b-2 border-black pb-1">
                                {data!.dept.name}
                            </h3>
                            <div className="border border-black">
                                <RosterTable
                                    currentDate={currentDate}
                                    staff={data!.deptStaff}
                                    dutyCodes={data!.dutyCodes}
                                    rosterData={data!.rosterData}
                                    settings={data!.settings}
                                    onCellUpdate={() => {}} // Read-only
                                    canEditRoster={false}
                                    publicHolidays={publicHolidays}
                                    printPreviewMode={true}
                                />
                            </div>
                        </div>
                    ))}

                    {reportData.length === 0 && (
                        <div className="text-center p-12 text-gray-500 print:hidden">
                            No departments selected or data configuration missing.
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 5mm;
                    }
                    body {
                        background-color: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        height: auto !important;
                    }
                    /* Reset visibility for Portal content */
                    .print-overlay {
                        position: static !important;
                        background: white !important;
                        height: auto !important;
                        z-index: auto !important;
                        display: block !important;
                    }
                    .print-container {
                        display: block !important;
                        width: 297mm !important;
                        overflow: visible !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    /* Hide everything else */
                    #root {
                        display: none !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </div>,
        document.body
    );
};

export default MultiRosterPrintModal;
