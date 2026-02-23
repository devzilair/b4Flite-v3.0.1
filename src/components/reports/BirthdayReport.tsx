
import React, { useMemo, useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { formatStaffName } from '../../utils/sanitization';
import { useStaff } from '../../hooks/useStaff';

const BirthdayReport: React.FC = () => {
    const { staff, departments, loading } = useStaff();
    const { currentUser, can } = usePermissions();

    const [deptFilter, setDeptFilter] = useState('all');

    const hasGlobalView = can('roster:view:all') || can('admin:view_settings') || can('staff:view');

    const reportData = useMemo(() => {
        const today = new Date();
        const currentYear = today.getFullYear();

        // 1. Filter Staff
        const filteredStaff = staff.filter(s => {
            if (s.accountStatus === 'disabled') return false;
            
            // Scope Check
            if (!hasGlobalView && currentUser && s.departmentId !== currentUser.departmentId) return false;
            
            // Dept Filter
            if (deptFilter !== 'all' && s.departmentId !== deptFilter) return false;
            
            // Must have DOB
            if (!s.hrData?.personal?.dob) return false;

            return true;
        });

        // 2. Map and Calculate
        const mapped = filteredStaff.map(person => {
            const dobStr = person.hrData?.personal?.dob as string;
            const dobDate = new Date(dobStr);
            
            // Calculate Age
            let age = currentYear - dobDate.getFullYear();
            
            // Next Birthday Logic
            const nextBirthday = new Date(currentYear, dobDate.getMonth(), dobDate.getDate());
            if (nextBirthday < today) {
                // Birthday already passed this year
                nextBirthday.setFullYear(currentYear + 1);
            } else {
                // Birthday is upcoming this year, adjust age to be current age (not next age)
                age = age - 1;
            }

            const monthName = nextBirthday.toLocaleString('default', { month: 'long' });
            const dayOfMonth = nextBirthday.getDate();

            return {
                id: person.id,
                name: person.name,
                departmentId: person.departmentId,
                dob: dobStr,
                age: age, // Current Age
                nextAge: age + 1,
                nextBirthday: nextBirthday,
                monthName: monthName,
                dayOfMonth: dayOfMonth
            };
        });

        // 3. Sort by Next Birthday
        return mapped.sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime());

    }, [staff, deptFilter, hasGlobalView, currentUser]);

    // Group by Month
    const groupedData = useMemo(() => {
        const groups: Record<string, typeof reportData> = {};
        reportData.forEach(item => {
            if (!groups[item.monthName]) groups[item.monthName] = [];
            groups[item.monthName].push(item);
        });
        return groups;
    }, [reportData]);

    const handleExportCSV = () => {
        const headers = ['Name', 'Department', 'DOB', 'Current Age', 'Next Birthday'];
        const rows = reportData.map(r => [
            `"${r.name}"`, 
            `"${departments.find(d => d.id === r.departmentId)?.name || 'Unknown'}"`,
            r.dob,
            r.age,
            r.nextBirthday.toLocaleDateString()
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `staff_birthdays_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div>Loading...</div>;

    if (!hasGlobalView) {
        return (
            <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-dashed border-red-200 dark:border-red-900">
                <h2 className="text-xl font-bold text-status-danger">Access Denied</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">You do not have permission to view staff birthdays.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Filter Bar */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 print:hidden">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <span>🎂</span> Staff Birthday List
                    </h2>
                </div>

                <div className="flex flex-wrap items-end gap-6">
                    {hasGlobalView && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Department</label>
                            <select 
                                value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                                className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm min-w-[200px]"
                            >
                                <option value="all">All Departments</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="ml-auto">
                        <button 
                            onClick={handleExportCSV}
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-bold shadow-md transition-all active:scale-95 flex items-center gap-2"
                        >
                            Export CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Results */}
            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-grow flex flex-col min-h-[500px]">
                <div className="p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center print:hidden">
                    <div className="flex gap-2 items-center">
                        <span className="text-xs text-gray-500 font-bold uppercase">Staff Included:</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-white">{reportData.length}</span>
                    </div>
                    <button 
                        onClick={() => window.print()} 
                        className="text-xs bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-500 font-bold flex items-center gap-2 transition-colors shadow-sm"
                    >
                        🖨️ Print
                    </button>
                </div>
                
                {/* Print Header */}
                <div className="hidden print:flex justify-between items-end p-8 border-b-2 border-black">
                    <div>
                        <h2 className="text-xl font-bold text-black uppercase tracking-wider">Staff Birthday Report</h2>
                    </div>
                    <div className="text-right text-[10px]">
                        Generated: {new Date().toLocaleDateString()}
                    </div>
                </div>

                <div className="overflow-auto flex-grow relative p-0 print:p-8">
                     <table className="w-full border-collapse border border-gray-200 dark:border-gray-700 print:border-black text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700 print:bg-gray-100">
                            <tr>
                                <th className="border-b border-r border-gray-300 dark:border-gray-600 print:border-black p-3 text-left uppercase text-xs font-bold sticky left-0 bg-gray-100 dark:bg-gray-700 z-10">Name</th>
                                <th className="border-b border-r border-gray-300 dark:border-gray-600 print:border-black p-3 text-left uppercase text-xs font-bold">Department</th>
                                <th className="border-b border-r border-gray-300 dark:border-gray-600 print:border-black p-3 text-center uppercase text-xs font-bold w-32">Date of Birth</th>
                                <th className="border-b border-r border-gray-300 dark:border-gray-600 print:border-black p-3 text-center uppercase text-xs font-bold w-24">Turning</th>
                                <th className="border-b border-gray-300 dark:border-gray-600 print:border-black p-3 text-center uppercase text-xs font-bold w-48">Next Birthday</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {Object.keys(groupedData).map(month => (
                                <React.Fragment key={month}>
                                    <tr className="bg-gray-50 dark:bg-gray-800 print:bg-gray-50">
                                        <td colSpan={5} className="p-2 border-b border-gray-300 dark:border-gray-600 print:border-black font-bold text-brand-primary dark:text-brand-light uppercase text-xs tracking-wider pl-4">
                                            {month}
                                        </td>
                                    </tr>
                                    {groupedData[month].map(row => (
                                        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 print:break-inside-avoid">
                                            <td className="p-3 border-r border-gray-200 dark:border-gray-700 print:border-black font-bold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none">
                                                {formatStaffName(row.name)}
                                            </td>
                                            <td className="p-3 border-r border-gray-200 dark:border-gray-700 print:border-black text-xs text-gray-500">
                                                {departments.find(d => d.id === row.departmentId)?.name}
                                            </td>
                                            <td className="p-3 border-r border-gray-200 dark:border-gray-700 print:border-black text-center font-mono text-gray-600 dark:text-gray-300">
                                                {new Date(row.dob).toLocaleDateString()}
                                            </td>
                                            <td className="p-3 border-r border-gray-200 dark:border-gray-700 print:border-black text-center font-bold">
                                                {row.nextAge}
                                            </td>
                                            <td className="p-3 border-gray-200 dark:border-gray-700 print:border-black text-center text-gray-600 dark:text-gray-300">
                                                {row.nextBirthday.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                            {reportData.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center italic text-gray-500">
                                        No staff with birthdays found in this scope (or DOB is missing).
                                    </td>
                                </tr>
                            )}
                        </tbody>
                     </table>
                </div>
            </div>

            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 10mm; }
                    body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    nav, header, aside, .print\\:hidden { display: none !important; }
                    #root, main, .container { width: 100% !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
                }
            `}</style>
        </div>
    );
};

export default BirthdayReport;
