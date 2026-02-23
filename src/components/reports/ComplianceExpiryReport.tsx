
import React, { useState, useMemo } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { StaffDocument, Staff, QualificationType } from '../../types';
import { formatStaffName } from '../../utils/sanitization';
import CompliancePrintModal from './CompliancePrintModal';
import { useStaff } from '../../hooks/useStaff';
import { useSettings } from '../../hooks/useSettings';

// Helper - Pure Logic
const getDocStatus = (person: Staff, qt: QualificationType) => {
    if (qt.departmentId && qt.departmentId !== person.departmentId) {
            return { status: 'n/a', label: 'N/A', date: null };
    }

    const doc = person.documents?.find(d => d.qualificationTypeId === qt.id);
    
    if (!doc) return { status: 'missing', label: '-', date: null };
    if (!doc.expiryDate) return { status: 'permanent', label: 'PERM', date: null };

    const now = new Date();
    const expiry = new Date(doc.expiryDate + 'T00:00:00Z');
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status: 'valid' | 'expiring' | 'expired' | 'n/a' = 'valid';
    if (diffDays < 0) status = 'expired';
    else if (diffDays <= 90) status = 'expiring';

    return { 
        status, 
        label: expiry.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' }), 
        date: doc.expiryDate
    };
};

const ComplianceExpiryReport: React.FC = () => {
    const { staff, departments, loading: staffLoading } = useStaff();
    const { qualificationTypes, loading: settingsLoading } = useSettings();
    const loading = staffLoading || settingsLoading;
    const { currentUser, can } = usePermissions();

    // Input State
    const [deptInput, setDeptInput] = useState('all');
    const [searchInput, setSearchInput] = useState('');
    const [issuesInput, setIssuesInput] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list'); // NEW: View Mode

    // Active State
    const [isGenerated, setIsGenerated] = useState(false);
    const [activeFilters, setActiveFilters] = useState({
        dept: 'all',
        search: '',
        issuesOnly: false
    });

    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    const hasGlobalView = can('roster:view:all') || can('admin:view_settings') || can('crew_records:manage_all');

    const handleGenerate = () => {
        setActiveFilters({
            dept: deptInput,
            search: searchInput,
            issuesOnly: issuesInput
        });
        setIsGenerated(true);
    };

    // 1. Filter Staff
    const reportData = useMemo(() => {
        return staff.filter(s => {
            if (s.accountStatus === 'disabled') return false;

            if (!hasGlobalView && currentUser && s.departmentId !== currentUser.departmentId) {
                return false;
            }

            if (activeFilters.dept !== 'all' && s.departmentId !== activeFilters.dept) return false;
            if (activeFilters.search && !s.name.toLowerCase().includes(activeFilters.search.toLowerCase())) return false;

            return true;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [staff, activeFilters, hasGlobalView, currentUser]);

    // 2. Final Rows (Filter by Issues if requested)
    const finalRows = useMemo(() => {
        if (!activeFilters.issuesOnly) return reportData;

        return reportData.filter(s => {
            return qualificationTypes.some(qt => {
                const { status } = getDocStatus(s, qt);
                return status === 'missing' || status === 'expired' || status === 'expiring';
            });
        });
    }, [reportData, activeFilters.issuesOnly, qualificationTypes]);

    // 3. Metrics
    const metrics = useMemo(() => {
        let expired = 0;
        let expiring = 0;
        let missing = 0;
        let totalChecks = 0;

        finalRows.forEach(s => {
            qualificationTypes.forEach(qt => {
                const { status } = getDocStatus(s, qt);
                
                if (status !== 'n/a') {
                    totalChecks++;
                    if (status === 'expired') expired++;
                    if (status === 'expiring') expiring++;
                    if (status === 'missing') missing++;
                }
            });
        });
        
        const complianceRate = totalChecks > 0 ? ((totalChecks - expired - missing) / totalChecks) * 100 : 100;
        return { expired, expiring, missing, complianceRate };
    }, [finalRows, qualificationTypes]);

    if (loading) return <div>Loading records...</div>;

    const getCellClass = (status: string) => {
        switch(status) {
            case 'expired': return 'bg-red-500 text-white font-bold';
            case 'expiring': return 'bg-yellow-100 text-yellow-800 font-semibold border-l-4 border-yellow-400';
            case 'valid': return 'bg-white dark:bg-gray-800 text-green-700 font-mono';
            case 'permanent': return 'bg-blue-50 text-blue-800 font-mono';
            case 'n/a': return 'bg-gray-50 dark:bg-gray-900 text-gray-300 dark:text-gray-600 font-xs italic';
            case 'missing': return 'bg-red-50 text-red-400 font-bold'; // Highlight missing in matrix
            default: return 'bg-gray-100 text-gray-400 dark:bg-gray-700/50'; 
        }
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            
            {/* Criteria Panel */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 print:hidden">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Compliance Horizon
                    </h2>
                    {isGenerated && (
                         <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                            <button onClick={() => setViewMode('list')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500'}`}>List</button>
                            <button onClick={() => setViewMode('matrix')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'matrix' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500'}`}>Matrix</button>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-end gap-6">
                    {hasGlobalView && (
                        <div className="w-full md:w-auto">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Department Scope</label>
                            <select 
                                value={deptInput} 
                                onChange={(e) => setDeptInput(e.target.value)}
                                className="p-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-sm w-full md:min-w-[220px]"
                            >
                                <option value="all">All Departments</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    )}
                    
                    <div className="pb-1">
                        <label className="flex items-center cursor-pointer select-none bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-md border border-gray-200 dark:border-gray-600">
                            <input 
                                type="checkbox" 
                                checked={issuesInput} 
                                onChange={(e) => setIssuesInput(e.target.checked)}
                                className="mr-3 h-4 w-4 text-brand-primary rounded"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Issues Only</span>
                        </label>
                    </div>

                    <div className="w-full md:w-auto ml-auto">
                        <button 
                            onClick={handleGenerate}
                            className="w-full bg-brand-primary text-white px-8 py-2.5 rounded-md hover:bg-brand-secondary flex items-center justify-center gap-2 font-bold shadow-lg text-sm transition-all active:scale-95"
                        >
                            Generate Report
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Area */}
            {isGenerated ? (
                <div className="space-y-6 animate-fade-in">
                    {/* Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-brand-primary">
                            <p className="text-xs font-bold text-gray-500 uppercase">Compliance Rate</p>
                            <p className={`text-2xl font-black ${metrics.complianceRate < 90 ? 'text-red-600' : 'text-green-600'}`}>
                                {metrics.complianceRate.toFixed(1)}%
                            </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-red-500">
                            <p className="text-xs font-bold text-gray-500 uppercase">Expired Items</p>
                            <p className="text-2xl font-black text-red-600">{metrics.expired}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-yellow-400">
                            <p className="text-xs font-bold text-gray-500 uppercase">Expiring (90d)</p>
                            <p className="text-2xl font-black text-yellow-600">{metrics.expiring}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-gray-300">
                            <p className="text-xs font-bold text-gray-500 uppercase">Missing Docs</p>
                            <p className="text-2xl font-black text-gray-400">{metrics.missing}</p>
                        </div>
                    </div>

                    {/* Report Table */}
                    <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-grow flex flex-col min-h-[500px]">
                        <div className="p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center print:hidden">
                             <span className="text-xs font-bold text-gray-500 uppercase">
                                 {finalRows.length} Staff Records
                             </span>
                             <button 
                                onClick={() => setIsPrintModalOpen(true)}
                                className="text-xs bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-500 font-bold flex items-center gap-2 shadow-sm"
                            >
                                🖨️ Print Formal Report
                            </button>
                        </div>

                        <div className="overflow-auto flex-grow relative">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 uppercase font-semibold sticky top-0 z-20 shadow-sm">
                                    <tr>
                                        <th className="p-3 border-b border-r border-gray-300 dark:border-gray-600 sticky left-0 z-30 bg-gray-100 dark:bg-gray-700 min-w-[150px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            Staff Member
                                        </th>
                                        {viewMode === 'list' ? (
                                            // LIST VIEW HEADERS
                                            qualificationTypes.map(qt => (
                                                <th key={qt.id} className="p-2 border-b border-r border-gray-300 dark:border-gray-600 text-center min-w-[90px]" title={qt.name}>
                                                    {qt.code}
                                                </th>
                                            ))
                                        ) : (
                                            // MATRIX VIEW HEADERS (Rotated for compactness)
                                            qualificationTypes.map(qt => (
                                                <th key={qt.id} className="p-2 border-b border-r border-gray-300 dark:border-gray-600 text-center w-10 relative h-32 align-bottom">
                                                     <div className="transform -rotate-90 origin-bottom-left translate-x-4 absolute bottom-2 w-32 text-left">
                                                        {qt.code}
                                                     </div>
                                                </th>
                                            ))
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {finalRows.map(person => (
                                        <tr key={person.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="p-2 border-r border-gray-300 dark:border-gray-600 font-bold text-gray-900 dark:text-white sticky left-0 z-10 bg-white dark:bg-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                <div className="truncate w-36">{formatStaffName(person.name)}</div>
                                            </td>
                                            {qualificationTypes.map(qt => {
                                                const { status, label } = getDocStatus(person, qt);
                                                const cellClass = getCellClass(status);
                                                
                                                if (viewMode === 'matrix') {
                                                    // In Matrix view, we just show a color block or a symbol for compactness
                                                    return (
                                                        <td key={qt.id} className={`border-r border-b border-gray-200 dark:border-gray-700 text-center cursor-help ${cellClass}`} title={`${qt.name}: ${label}`}>
                                                            {status === 'valid' ? '●' : status === 'n/a' ? '' : status === 'missing' ? 'X' : '!'}
                                                        </td>
                                                    );
                                                }

                                                return (
                                                    <td key={qt.id} className={`p-1 border-r border-gray-200 dark:border-gray-700 text-center border-b ${cellClass}`}>
                                                        {label}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 min-h-[400px]">
                     <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">Report Not Generated</h3>
                     <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                        Please configure report criteria to view the compliance matrix.
                     </p>
                </div>
            )}

            <CompliancePrintModal 
                isOpen={isPrintModalOpen}
                onClose={() => setIsPrintModalOpen(false)}
                reportData={finalRows}
                qualificationTypes={qualificationTypes}
                departmentName={activeFilters.dept === 'all' ? 'All Departments' : departments.find(d => d.id === activeFilters.dept)?.name || 'Unknown'}
                showIssuesOnly={activeFilters.issuesOnly}
            />
        </div>
    );
};

export default ComplianceExpiryReport;
