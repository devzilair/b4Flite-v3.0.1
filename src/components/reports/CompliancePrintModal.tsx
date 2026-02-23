
import React from 'react';
import ReactDOM from 'react-dom';
import { Staff, QualificationType, Department } from '../../types';
import { formatStaffName } from '../../utils/sanitization';
import { supabaseUrl } from '../../services/supabaseClient';

interface CompliancePrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportData: Staff[];
    qualificationTypes: QualificationType[];
    departmentName: string;
    showIssuesOnly: boolean;
}

const CompliancePrintModal: React.FC<CompliancePrintModalProps> = ({ 
    isOpen, 
    onClose, 
    reportData, 
    qualificationTypes, 
    departmentName,
    showIssuesOnly 
}) => {
    if (!isOpen) return null;

    const getDocStatus = (person: Staff, qualType: QualificationType) => {
        // N/A Logic
        if (qualType.departmentId && qualType.departmentId !== person.departmentId) {
             return { status: 'n/a', label: 'N/A', date: null };
        }

        const doc = person.documents?.find((d: any) => d.qualificationTypeId === qualType.id);
        
        if (!doc) return { status: 'missing', label: '---', date: null };
        if (!doc.expiryDate) return { status: 'permanent', label: 'PERM', date: null };

        const now = new Date();
        const expiry = new Date(doc.expiryDate + 'T00:00:00Z');
        const diffTime = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let status = 'valid';
        if (diffDays < 0) status = 'expired';
        else if (diffDays <= 90) status = 'expiring';

        return { 
            status, 
            label: expiry.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }), 
            date: doc.expiryDate
        };
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
            {/* Screen Controls */}
            <div className="bg-gray-800 text-white p-4 flex justify-between items-center print:hidden shadow-md z-50">
                <div>
                    <h2 className="font-bold text-lg">Print Preview</h2>
                    <p className="text-sm text-gray-400">Layout optimized for A4 Landscape</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors">Close</button>
                    <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-bold flex items-center gap-2 shadow-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" /></svg>
                        Print Report
                    </button>
                </div>
            </div>

            {/* Print Area */}
            <div className="flex-grow overflow-auto p-8 bg-gray-100 print:p-0 print:bg-white print:overflow-visible">
                <div className="max-w-[297mm] mx-auto bg-white shadow-lg p-[10mm] print:shadow-none print:p-0 print:max-w-none print:mx-0 print:h-auto">
                    
                    {/* Report Header */}
                    <div className="flex justify-between items-end mb-6 border-b-2 border-black pb-2">
                        <div className="flex items-center gap-4">
                             <img 
                                src={`${supabaseUrl}/storage/v1/object/public/portal-uploads/logo_white.png`} 
                                alt="Logo" 
                                className="h-12 object-contain"
                            />
                            <div>
                                <h1 className="text-xl font-bold uppercase tracking-wider">Compliance Horizon</h1>
                                <p className="text-xs font-mono uppercase text-gray-600">Scope: {departmentName}</p>
                            </div>
                        </div>
                        <div className="text-right text-[10px] font-mono">
                            <p>Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                            <p>Filter: {showIssuesOnly ? 'Non-Compliant Items Only' : 'All Staff'}</p>
                        </div>
                    </div>

                    {/* Data Table */}
                    <table className="w-full border-collapse border border-black text-[9px]">
                        <thead>
                            <tr className="bg-gray-200 print:bg-gray-200">
                                <th className="border border-black p-1 text-left w-32 uppercase">Staff Member</th>
                                {qualificationTypes.map(qt => (
                                    <th key={qt.id} className="border border-black p-1 text-center font-bold w-16 whitespace-nowrap overflow-hidden">
                                        {qt.code}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.map((s, index) => (
                                <tr key={s.id} className={`print:break-inside-avoid ${index % 2 === 1 ? 'bg-gray-50 print:bg-gray-50' : ''}`}>
                                    <td className="border border-black p-1 font-bold truncate">
                                        {formatStaffName(s.name)}
                                    </td>
                                    {qualificationTypes.map(qt => {
                                        const { status, label } = getDocStatus(s, qt);
                                        
                                        let cellStyle = {};
                                        let textClass = "";

                                        if (status === 'expired') {
                                            cellStyle = { backgroundColor: '#fecaca' }; // Red-200
                                            textClass = 'font-bold text-red-900';
                                        } else if (status === 'expiring') {
                                            cellStyle = { backgroundColor: '#fef08a' }; // Yellow-200
                                            textClass = 'font-bold text-yellow-900';
                                        } else if (status === 'missing') {
                                            cellStyle = { backgroundColor: '#f3f4f6' }; // Gray-100
                                            textClass = 'text-gray-400 italic';
                                        } else if (status === 'n/a') {
                                            cellStyle = { backgroundColor: '#f9fafb' }; // Gray-50
                                            textClass = 'text-gray-300';
                                        }

                                        return (
                                            <td 
                                                key={qt.id} 
                                                className={`border border-black p-1 text-center font-mono ${textClass}`}
                                                style={cellStyle} // Inline styles work better for print color accuracy in some browsers
                                            >
                                                {label}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Footer / Signature Block */}
                    <div className="mt-8 pt-4 border-t border-black flex justify-between items-end text-[10px] print:break-inside-avoid">
                         <div className="w-1/3">
                            <p className="mb-8 font-bold uppercase">Audited By:</p>
                            <div className="border-b border-black w-full"></div>
                        </div>
                        <div className="w-1/3 text-center text-gray-500 italic">
                            Report generated via b4Flite Crew Portal
                        </div>
                        <div className="w-1/3 text-right">
                             <p className="mb-8 font-bold uppercase">Signature / Date:</p>
                             <div className="border-b border-black w-full"></div>
                        </div>
                    </div>
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
                    }
                    /* Reset visibility for Portal content */
                    .fixed.inset-0 {
                        position: static !important;
                        background: white !important;
                        height: auto !important;
                        z-index: auto !important;
                        display: block !important;
                    }
                    /* Hide everything else */
                    #root {
                        display: none !important;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>
        </div>,
        document.body
    );
};

export default CompliancePrintModal;
