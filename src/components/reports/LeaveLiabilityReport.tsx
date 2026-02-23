
import React, { useMemo, useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { formatStaffName } from '../../utils/sanitization';
import { useLeave } from '../../hooks/useLeave';
import { useStaff } from '../../hooks/useStaff';
import { useSettings } from '../../hooks/useSettings';

const LeaveLiabilityReport: React.FC = () => {
    const { staff, departments, loading: staffLoading } = useStaff();
    const { leaveTypes, loading: settingsLoading } = useSettings();
    const { leaveTransactions, loading: leaveLoading } = useLeave();
    const loading = staffLoading || settingsLoading || leaveLoading;
    const { currentUser, can } = usePermissions();
    
    // Input State
    const [deptInput, setDeptInput] = useState('all');

    // Report State
    const [isGenerated, setIsGenerated] = useState(false);
    const [activeFilters, setActiveFilters] = useState({ dept: 'all' });

    const hasGlobalView = can('leave_planner:view_balances') || can('admin:view_settings');

    const handleGenerate = () => {
        setActiveFilters({ dept: deptInput });
        setIsGenerated(true);
    };

    const reportData = useMemo(() => {
        if (!isGenerated) return [];

        // 1. Filter Staff
        const eligibleStaff = staff.filter(s => {
            if (s.accountStatus === 'disabled') return false;
            
            // Scope Check
            if (!hasGlobalView && currentUser && s.departmentId !== currentUser.departmentId) {
                return false;
            }
            
            // Dept Filter
            if (activeFilters.dept !== 'all' && s.departmentId !== activeFilters.dept) return false;

            return true;
        }).sort((a, b) => a.name.localeCompare(b.name));

        // 2. Identify Key Leave Types (Annual, Sick, PH)
        const annualType = leaveTypes.find(lt => lt.name.toLowerCase().includes('annual'));
        const sickType = leaveTypes.find(lt => lt.name.toLowerCase().includes('sick') || lt.name.toLowerCase().includes('medical'));
        const phType = leaveTypes.find(lt => lt.name.toLowerCase().includes('public holiday') || lt.name.toLowerCase().includes('lieu'));

        // 3. Aggregate Balances
        return eligibleStaff.map(person => {
            const myTrans = leaveTransactions.filter(t => t.staffId === person.id);
            
            const calcBalance = (typeId?: string) => {
                if (!typeId) return 0;
                return myTrans
                    .filter(t => t.leaveTypeId === typeId)
                    .reduce((sum, t) => sum + t.amount, 0);
            };

            return {
                id: person.id,
                name: person.name,
                departmentId: person.departmentId,
                annualBal: calcBalance(annualType?.id),
                sickBal: calcBalance(sickType?.id),
                phBal: calcBalance(phType?.id),
            };
        });

    }, [staff, leaveTransactions, leaveTypes, activeFilters, hasGlobalView, currentUser, isGenerated]);

    const metrics = useMemo(() => {
        const totalLiabilityDays = reportData.reduce((acc, curr) => acc + Math.max(0, curr.annualBal), 0);
        const totalPhDays = reportData.reduce((acc, curr) => acc + Math.max(0, curr.phBal), 0);
        return { totalLiabilityDays, totalPhDays };
    }, [reportData]);

    const handleExportCSV = () => {
        const headers = ['Name', 'Department', 'Annual Balance', 'Sick Balance', 'PH Balance'];
        const rows = reportData.map(r => [
            `"${r.name}"`, 
            `"${departments.find(d => d.id === r.departmentId)?.name || 'Unknown'}"`,
            r.annualBal.toFixed(2),
            r.sickBal.toFixed(2),
            r.phBal.toFixed(2)
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `leave_liability_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div>Loading...</div>;

    if (!hasGlobalView) {
        return <div className="p-8 text-center text-gray-500">Access Denied.</div>;
    }

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Criteria Panel */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 print:hidden">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                         <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Report Configuration
                    </h2>
                </div>

                <div className="flex flex-wrap items-end gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Department Scope</label>
                        <select 
                            value={deptInput} 
                            onChange={e => setDeptInput(e.target.value)}
                            className="p-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-sm w-full md:min-w-[250px]"
                        >
                            <option value="all">All Departments</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>

                    <div className="ml-auto">
                        <button 
                            onClick={handleGenerate}
                            className="bg-brand-primary text-white px-8 py-2.5 rounded-md hover:bg-brand-secondary flex items-center justify-center gap-2 font-bold shadow-lg text-sm transition-all active:scale-95"
                        >
                            Generate Liability Report
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Area */}
            {isGenerated ? (
                <div className="space-y-6 animate-fade-in">
                    {/* Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg border border-red-100 dark:border-red-800">
                            <p className="text-xs font-bold text-red-800 dark:text-red-300 uppercase">Total Annual Leave Liability</p>
                            <p className="text-3xl font-black text-red-900 dark:text-red-100">{metrics.totalLiabilityDays.toFixed(1)} <span className="text-sm font-medium">Days</span></p>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Outstanding balance across all selected staff.</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-100 dark:border-blue-800">
                            <p className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase">Banked Public Holidays</p>
                            <p className="text-3xl font-black text-blue-900 dark:text-blue-100">{metrics.totalPhDays.toFixed(1)} <span className="text-sm font-medium">Days</span></p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Total lieu days owed.</p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-grow flex flex-col min-h-[500px]">
                        <div className="p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center print:hidden">
                             <div className="flex gap-2 items-center">
                                <span className="text-xs text-gray-500 font-bold uppercase">Staff Included:</span>
                                <span className="text-sm font-bold text-gray-800 dark:text-white">{reportData.length}</span>
                             </div>
                             <div className="flex gap-2">
                                <button 
                                    onClick={handleExportCSV}
                                    className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded border border-green-200 font-bold flex items-center gap-2 transition-colors"
                                >
                                    Export CSV
                                </button>
                             </div>
                        </div>

                        <div className="overflow-auto flex-grow">
                             <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 uppercase text-xs font-semibold sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-4 border-b dark:border-gray-600">Staff Name</th>
                                        <th className="p-4 border-b dark:border-gray-600">Department</th>
                                        <th className="p-4 border-b dark:border-gray-600 text-right">Annual Balance</th>
                                        <th className="p-4 border-b dark:border-gray-600 text-right">PH Bank</th>
                                        <th className="p-4 border-b dark:border-gray-600 text-right">Sick Taken</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {reportData.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="p-4 font-bold text-gray-900 dark:text-white border-r dark:border-gray-700">
                                                {formatStaffName(row.name)}
                                            </td>
                                            <td className="p-4 text-xs text-gray-500 border-r dark:border-gray-700">
                                                {departments.find(d => d.id === row.departmentId)?.name}
                                            </td>
                                            <td className={`p-4 text-right font-mono font-bold border-r dark:border-gray-700 ${row.annualBal < 0 ? 'text-red-600' : 'text-gray-800 dark:text-gray-200'}`}>
                                                {row.annualBal.toFixed(2)}
                                            </td>
                                            <td className={`p-4 text-right font-mono border-r dark:border-gray-700 ${row.phBal > 5 ? 'text-blue-600 font-bold' : 'text-gray-600 dark:text-gray-400'}`}>
                                                {row.phBal.toFixed(2)}
                                            </td>
                                            <td className="p-4 text-right font-mono text-gray-600 dark:text-gray-400">
                                                {Math.abs(row.sickBal).toFixed(1)}
                                            </td>
                                        </tr>
                                    ))}
                                    {reportData.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-gray-500 italic">
                                                No staff found matching criteria.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                             </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 min-h-[400px]">
                     <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                     </div>
                     <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">Report Not Generated</h3>
                     <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                        Select a department scope and click <span className="font-bold text-brand-primary">Generate Liability Report</span> to view balances.
                     </p>
                </div>
            )}
        </div>
    );
};

export default LeaveLiabilityReport;
