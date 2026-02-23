
import React, { useMemo, useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { formatStaffName } from '../../utils/sanitization';
import { useFsi } from '../../hooks/useFsi';
import { useStaff } from '../../hooks/useStaff';

const SafetyCultureReport: React.FC = () => {
    const { staff, departments, loading: staffLoading } = useStaff();
    const { fsiDocuments, fsiAcks, loading: fsiLoading } = useFsi();
    const loading = staffLoading || fsiLoading;

    const { currentUser, can } = usePermissions();

    // Input State
    const [deptInput, setDeptInput] = useState('all');

    // Report State
    const [isGenerated, setIsGenerated] = useState(false);
    const [activeFilters, setActiveFilters] = useState({ dept: 'all' });

    const hasGlobalView = can('fsi:manage');

    const handleGenerate = () => {
        setActiveFilters({ dept: deptInput });
        setIsGenerated(true);
    };
    
    // Logic: Calculate Avg Response Time
    const stats = useMemo(() => {
        if (!isGenerated) return { staffStats: [], deptRows: [] };

        // Filter Staff based on view scope
        const eligibleStaff = staff.filter(s => {
            if (s.accountStatus === 'disabled') return false;
            // Exclude admins from stats to avoid skewing data
            if (s.roleId === 'role_admin' || s.roleId === 'role_super_admin') return false; 
            
            if (!hasGlobalView) {
                // If Manager, check Dept
                if (can('fsi:manage:own_department') && currentUser && s.departmentId === currentUser.departmentId) return true;
                return false;
            }
            
            // Apply Dept Filter (if Global Admin)
            if (activeFilters.dept !== 'all' && s.departmentId !== activeFilters.dept) return false;

            return true;
        });

        // Map Staff to Stats
        const staffStats = eligibleStaff.map(person => {
            // Find docs assigned to this person (or their dept)
            const assignedDocs = fsiDocuments.filter(doc => {
                if (doc.status !== 'published') return false;
                
                // Exclude very recent docs (gives them 7 days grace period before counting as "late")
                const issueDate = new Date(doc.issueDate);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                // if (issueDate > weekAgo) return false; // Optional: Strict mode or Grace mode

                if (!doc.departmentId) return true; // Global
                if (doc.departmentId === person.departmentId) {
                    if (Array.isArray(doc.assignedTo) && doc.assignedTo.length > 0) {
                        return doc.assignedTo.includes(person.id);
                    }
                    return true;
                }
                return false;
            });

            if (assignedDocs.length === 0) return null;

            let totalDays = 0;
            let pendingCount = 0;
            let signedCount = 0;

            assignedDocs.forEach(doc => {
                const ack = fsiAcks.find(a => a.documentId === doc.id && a.staffId === person.id);
                if (ack) {
                    const issue = new Date(doc.issueDate).getTime();
                    const sign = new Date(ack.acknowledgedAt).getTime();
                    // Days diff, min 0
                    const days = Math.max(0, (sign - issue) / (1000 * 60 * 60 * 24));
                    totalDays += days;
                    signedCount++;
                } else {
                    pendingCount++;
                    // Penalty for pending? Not adding to time avg, but tracking count.
                }
            });

            const avgResponseDays = signedCount > 0 ? totalDays / signedCount : 0;
            const complianceRate = (signedCount / assignedDocs.length) * 100;

            return {
                id: person.id,
                name: person.name,
                departmentId: person.departmentId,
                avgResponseDays,
                complianceRate,
                pendingCount,
                signedCount
            };
        }).filter(Boolean); // Remove nulls (staff with no docs)

        // Department Aggregation
        const deptStats: Record<string, { total: number, compliant: number, count: number }> = {};
        staffStats.forEach(s => {
            if (!s) return;
            if (!deptStats[s.departmentId]) deptStats[s.departmentId] = { total: 0, compliant: 0, count: 0 };
            
            deptStats[s.departmentId].count++;
            deptStats[s.departmentId].total += s.complianceRate;
            if (s.complianceRate === 100) deptStats[s.departmentId].compliant++;
        });

        const deptRows = Object.entries(deptStats).map(([deptId, d]) => ({
            id: deptId,
            name: departments.find(dep => dep.id === deptId)?.name || 'Unknown',
            avgCompliance: d.total / d.count,
            fullComplianceRate: (d.compliant / d.count) * 100
        })).sort((a, b) => b.avgCompliance - a.avgCompliance);

        // Sort Staff: Worst compliance first, then slowest response
        const sortedStaff = staffStats.sort((a, b) => {
            if (a!.complianceRate !== b!.complianceRate) return a!.complianceRate - b!.complianceRate; // Low compliance first
            return b!.avgResponseDays - a!.avgResponseDays; // High delay first
        });

        return { staffStats: sortedStaff, deptRows };

    }, [staff, fsiDocuments, fsiAcks, hasGlobalView, currentUser, can, departments, isGenerated, activeFilters]);

    if (loading) return <div>Loading...</div>;
    if (!hasGlobalView && !can('fsi:manage:own_department')) return <div className="p-8 text-center text-gray-500">Access Denied</div>;

    return (
        <div className="flex flex-col h-full space-y-6">
            
            {/* Criteria Panel */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 print:hidden">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                         <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        Audit Configuration
                    </h2>
                </div>

                <div className="flex flex-wrap items-end gap-6">
                    {hasGlobalView && (
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
                    )}
                    
                    <div className="ml-auto">
                        <button 
                            onClick={handleGenerate}
                            className="bg-brand-primary text-white px-8 py-2.5 rounded-md hover:bg-brand-secondary flex items-center justify-center gap-2 font-bold shadow-lg text-sm transition-all active:scale-95"
                        >
                            Run Compliance Check
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Area */}
            {isGenerated ? (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Department League Table */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2 dark:border-gray-600">Department Compliance</h3>
                            <div className="space-y-4">
                                {stats.deptRows.map(d => (
                                    <div key={d.id}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-bold text-gray-700 dark:text-gray-200">{d.name}</span>
                                            <span className={d.avgCompliance < 80 ? 'text-red-600' : 'text-green-600'}>{d.avgCompliance.toFixed(0)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                                            <div 
                                                className={`h-2 rounded-full ${d.avgCompliance >= 90 ? 'bg-green-500' : d.avgCompliance >= 70 ? 'bg-yellow-400' : 'bg-red-500'}`} 
                                                style={{ width: `${d.avgCompliance}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Info Card */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-100 dark:border-blue-800 flex flex-col justify-center">
                            <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2">Safety Culture Audit</h3>
                            <p className="text-sm text-blue-700 dark:text-blue-200 leading-relaxed">
                                This report highlights response times to Flight Safety Instructions (FSIs). 
                                Low compliance indicates potential gaps in safety communication flow. 
                                Response time is calculated from "Date Issued" to "Date Signed".
                            </p>
                        </div>
                    </div>

                    {/* Individual Table */}
                    <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-grow flex flex-col min-h-[500px]">
                        <div className="p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500 uppercase">Staff Response Metrics (Bottom Performers First)</span>
                            <button onClick={() => window.print()} className="text-xs bg-white dark:bg-gray-600 px-3 py-1 rounded border shadow-sm">Print</button>
                        </div>
                        <div className="overflow-auto flex-grow">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 uppercase text-xs font-semibold sticky top-0">
                                    <tr>
                                        <th className="p-3 border-b dark:border-gray-600">Staff Name</th>
                                        <th className="p-3 border-b dark:border-gray-600">Department</th>
                                        <th className="p-3 border-b dark:border-gray-600 text-center">Pending Docs</th>
                                        <th className="p-3 border-b dark:border-gray-600 text-center">Avg Response (Days)</th>
                                        <th className="p-3 border-b dark:border-gray-600 text-center w-32">Compliance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {stats.staffStats.map((row) => {
                                        if (!row) return null;
                                        return (
                                            <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                <td className="p-3 font-bold text-gray-900 dark:text-white">
                                                    {formatStaffName(row.name)}
                                                </td>
                                                <td className="p-3 text-xs text-gray-500">
                                                    {departments.find(d => d.id === row.departmentId)?.name}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {row.pendingCount > 0 ? (
                                                        <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold">{row.pendingCount}</span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center font-mono">
                                                    {row.avgResponseDays.toFixed(1)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <span className="font-bold text-xs">{Math.round(row.complianceRate)}%</span>
                                                        <div className="w-16 bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                                                            <div 
                                                                className={`h-1.5 rounded-full ${row.complianceRate >= 100 ? 'bg-green-500' : row.complianceRate >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                                                                style={{ width: `${row.complianceRate}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
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
                        Click <span className="font-bold text-brand-primary">Run Compliance Check</span> to analyze safety instruction data.
                     </p>
                </div>
            )}
        </div>
    );
};

export default SafetyCultureReport;
