
import React, { useMemo, useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { formatStaffName } from '../../utils/sanitization';
import { useLeave } from '../../hooks/useLeave';
import { useStaff } from '../../hooks/useStaff';
import { useSettings } from '../../hooks/useSettings';

const LeaveAnalysisReport: React.FC = () => {
    const { staff, departments, loading: staffLoading } = useStaff();
    const { leaveTypes, loading: settingsLoading } = useSettings();
    const { leaveTransactions, loading: leaveLoading } = useLeave();
    const loading = staffLoading || settingsLoading || leaveLoading;
    const { currentUser, can } = usePermissions();

    // Defaults: Current Year
    const [startDate, setStartDate] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-01-01`;
    });
    const [endDate, setEndDate] = useState<string>(() => {
        return new Date().toISOString().split('T')[0];
    });
    const [deptFilter, setDeptFilter] = useState('all');

    // Report State
    const [isGenerated, setIsGenerated] = useState(false);
    const [activeFilters, setActiveFilters] = useState({ start: '', end: '', dept: 'all' });

    const handleGenerate = () => {
        setActiveFilters({ start: startDate, end: endDate, dept: deptFilter });
        setIsGenerated(true);
    };

    const hasGlobalView = can('roster:view:all') || can('admin:view_settings') || can('leave_planner:view_all');
    const hasManagerAccess = hasGlobalView || can('staff:view:own_department');

    // --- DATA AGGREGATION ---
    const reportData = useMemo(() => {
        if (!isGenerated) return [];

        // 1. Filter Staff
        const eligibleStaff = staff.filter(s => {
            if (s.accountStatus === 'disabled') return false;
            
            // Scope
            if (!hasManagerAccess) {
                 return s.id === currentUser?.id;
            } else {
                 if (!hasGlobalView && currentUser && s.departmentId !== currentUser.departmentId) return false;
            }

            if (activeFilters.dept !== 'all' && s.departmentId !== activeFilters.dept) return false;
            return true;
        });

        // 2. Aggregate Transactions
        return eligibleStaff.map(person => {
            // Filter transactions for this person within date range
            const myTrans = leaveTransactions.filter(t => 
                t.staffId === person.id && 
                t.transactionType === 'leave_taken' &&
                t.date >= activeFilters.start &&
                t.date <= activeFilters.end
            );

            // Group by Leave Type
            const breakdown: Record<string, number> = {};
            let totalDaysTaken = 0;

            myTrans.forEach(t => {
                const amount = Math.abs(Number(t.amount)); // Transactions are negative for taken leave. Cast to number to ensure type safety.
                breakdown[t.leaveTypeId] = (breakdown[t.leaveTypeId] || 0) + amount;
                totalDaysTaken += amount;
            });

            return {
                id: person.id,
                name: person.name,
                departmentId: person.departmentId,
                totalDaysTaken,
                breakdown
            };
        }).sort((a, b) => b.totalDaysTaken - a.totalDaysTaken);

    }, [staff, leaveTransactions, activeFilters, isGenerated, hasGlobalView, hasManagerAccess, currentUser]);

    // Summary Metrics
    const metrics = useMemo(() => {
        const totalTaken = reportData.reduce((acc, curr) => acc + curr.totalDaysTaken, 0);
        const typeTotals: Record<string, number> = {};
        
        reportData.forEach(row => {
            Object.entries(row.breakdown).forEach(([typeId, amount]) => {
                typeTotals[typeId] = (typeTotals[typeId] || 0) + (amount as number);
            });
        });

        return { totalTaken, typeTotals };
    }, [reportData]);

    const handleExportCSV = () => {
        // Dynamic headers based on available leave types
        const typeHeaders = leaveTypes.map(lt => lt.name);
        const headers = ['Name', 'Department', 'Total Days', ...typeHeaders];
        
        const rows = reportData.map(r => {
            const typeValues = leaveTypes.map(lt => (r.breakdown[lt.id] || 0).toFixed(1));
            return [
                `"${r.name}"`, 
                `"${departments.find(d => d.id === r.departmentId)?.name || 'Unknown'}"`,
                r.totalDaysTaken.toFixed(1),
                ...typeValues
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `leave_analysis_${activeFilters.start}_${activeFilters.end}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="flex flex-col h-full space-y-6">
            
            {/* Criteria Panel */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 print:hidden">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        Leave Usage Analysis
                    </h2>
                </div>

                <div className="flex flex-wrap items-end gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Period</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                className="p-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-sm"
                            />
                            <span className="text-gray-400">to</span>
                            <input 
                                type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                className="p-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-sm"
                            />
                        </div>
                    </div>
                    
                    {hasGlobalView && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Department</label>
                            <select 
                                value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                                className="p-2.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-sm min-w-[200px]"
                            >
                                <option value="all">All Departments</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="ml-auto">
                        <button 
                            onClick={handleGenerate}
                            className="bg-brand-primary text-white px-8 py-2.5 rounded-md hover:bg-brand-secondary flex items-center justify-center gap-2 font-bold shadow-lg text-sm transition-all active:scale-95"
                        >
                            Analyze
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Area */}
            {isGenerated ? (
                <div className="space-y-6 animate-fade-in">
                    {/* Metrics Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-blue-500">
                            <p className="text-xs font-bold text-gray-500 uppercase">Total Leave Taken</p>
                            <p className="text-2xl font-black text-gray-800 dark:text-white">{metrics.totalTaken.toFixed(1)} Days</p>
                        </div>
                        {/* Top 3 Leave Types Summary */}
                        {leaveTypes.slice(0, 3).map(lt => (
                            <div key={lt.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4" style={{ borderLeftColor: lt.color }}>
                                <p className="text-xs font-bold text-gray-500 uppercase">{lt.name}</p>
                                <p className="text-2xl font-black text-gray-800 dark:text-white">{(metrics.typeTotals[lt.id] || 0).toFixed(1)}</p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-grow flex flex-col min-h-[500px]">
                         <div className="p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center print:hidden">
                             <div className="flex gap-2 items-center">
                                <span className="text-xs text-gray-500 font-bold uppercase">Staff Records:</span>
                                <span className="text-sm font-bold text-gray-800 dark:text-white">{reportData.length}</span>
                             </div>
                             <div className="flex gap-2">
                                <button 
                                    onClick={handleExportCSV}
                                    className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded border border-green-200 font-bold flex items-center gap-2 transition-colors"
                                >
                                    Export CSV
                                </button>
                                <button 
                                    onClick={() => window.print()} 
                                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded border border-gray-300 font-bold flex items-center gap-2 transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                    Print
                                </button>
                             </div>
                        </div>

                        <div className="overflow-auto flex-grow relative p-0 print:p-8">
                             <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 uppercase text-xs font-semibold sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 border-b dark:border-gray-600 bg-gray-100 dark:bg-gray-700 sticky left-0 z-20">Name</th>
                                        <th className="p-3 border-b dark:border-gray-600 text-center font-bold bg-blue-50 dark:bg-blue-900/20">Total</th>
                                        {leaveTypes.map(lt => (
                                            <th key={lt.id} className="p-3 border-b dark:border-gray-600 text-center text-[10px] w-20">{lt.name}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {reportData.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="p-3 font-bold text-gray-900 dark:text-white border-r dark:border-gray-700 sticky left-0 bg-white dark:bg-gray-800 z-10">
                                                {formatStaffName(row.name)}
                                            </td>
                                            <td className="p-3 text-center font-bold bg-blue-50 dark:bg-blue-900/10 border-r dark:border-gray-700">
                                                {row.totalDaysTaken.toFixed(1)}
                                            </td>
                                            {leaveTypes.map(lt => (
                                                <td key={lt.id} className="p-3 text-center text-gray-600 dark:text-gray-400 font-mono border-r dark:border-gray-700 last:border-0">
                                                    {(row.breakdown[lt.id] || 0) > 0 ? (row.breakdown[lt.id] || 0).toFixed(1) : '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    {reportData.length === 0 && (
                                        <tr>
                                            <td colSpan={2 + leaveTypes.length} className="p-8 text-center text-gray-500 italic">No leave data found.</td>
                                        </tr>
                                    )}
                                </tbody>
                             </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 min-h-[400px]">
                     <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">Report Not Generated</h3>
                     <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                        Configure dates and click <span className="font-bold text-brand-primary">Analyze</span> to view usage statistics.
                     </p>
                </div>
            )}
        </div>
    );
};

export default LeaveAnalysisReport;
