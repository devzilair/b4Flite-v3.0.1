'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getAuditLogs, cleanupAuditLogs, revertAuditLog } from '@/services/api';
import { AuditLog } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useStaff } from '@/hooks/useStaff';
import { useSettings } from '@/hooks/useSettings';

const FIELD_LABELS: Record<string, string> = {
    name: 'Name',
    email: 'Email',
    role_id: 'Role',
    department_id: 'Department',
    account_status: 'Account Status',
    duty_start: 'Duty Start',
    duty_end: 'Duty End',
    flight_on: 'Flight On',
    flight_off: 'Flight Off',
    start_date: 'Start Date',
    end_date: 'End Date',
    leave_type_id: 'Leave Type',
    status: 'Status',
    title: 'Title',
    description: 'Description',
    pass_mark_percentage: 'Pass Mark (%)',
    time_limit_minutes: 'Time Limit (mins)',
    manager_id: 'Manager',
    amount: 'Amount (Days)',
    transaction_type: 'Transaction Type',
    notes: 'Notes',
    question_ids: 'Questions (IDs)',
    assigned_to: 'Assigned To',
    period_start: 'Period Start',
    period_end: 'Period End',
    overall_rating: 'Overall Rating',
    // Questions
    text: 'Question Text',
    type: 'Question Type',
    options: 'Options',
    correct_answer: 'Correct Answer',
    category: 'Category',
    // Exam Attempts
    score: 'Score (%)',
    exam_id: 'Exam',
};

// Fields that should be masked in the UI for security/privacy
const SENSITIVE_PATTERNS = [
    /password/i, /token/i, /secret/i, /api_key/i, /signature/i, /auth_id/i,
    /passport/i, /visa/i, /bank/i, /account_number/i, /iban/i, /swift/i,
    /sort_code/i, /credit_card/i, /cvv/i, /pin/i,
    /next_of_kin/i, /nok/i, /contact_person/i,
    /phone/i, /mobile/i, /cell/i, /fax/i,
    /address/i, /residence/i, /location/i,
    /salary/i, /wage/i, /compensation/i, /tax/i, /pay/i,
    /medical/i, /health/i, /disability/i,
    /dob/i, /birth/i, /national_id/i, /nin/i, /ssn/i
];

const PAGE_SIZE = 30;

// --- Severity Logic ---
type Severity = 'critical' | 'warning' | 'info';

const getSeverity = (log: AuditLog): Severity => {
    // Critical: Deletions of data or Security/Permission changes
    if (log.operation === 'DELETE') return 'critical';
    if (['roles', 'staff', 'validation_rule_sets'].includes(log.tableName)) return 'critical';

    // Warning: Config changes
    if (['department_settings', 'roster_view_templates', 'leave_types'].includes(log.tableName)) return 'warning';

    // Info: Routine ops
    return 'info';
};

const AuditLogPage: React.FC = () => {
    const { staff, departments, roles } = useStaff();
    const { leaveTypes } = useSettings();

    const { can } = usePermissions();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    // Filter state
    const [tableFilter, setTableFilter] = useState('all');
    const [opFilter, setOpFilter] = useState('all');

    // Pagination state
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Cleanup state
    const [isPruning, setIsPruning] = useState(false);
    const [isReverting, setIsReverting] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const { data, count } = await getAuditLogs(page, PAGE_SIZE, {
                search: searchTerm,
                tableName: tableFilter,
                operation: opFilter
            });
            setLogs(data);
            setTotalCount(count);
        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setLoading(false);
        }
    }, [page, searchTerm, tableFilter, opFilter]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
        setter(value);
        setPage(1); // Reset to first page on filter change
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setPage(1);
    };

    const handlePrune = async () => {
        const daysStr = prompt("Delete logs older than how many days? (e.g. 90)\n\nWARNING: This action cannot be undone.", "90");
        if (!daysStr) return;

        const days = parseInt(daysStr);
        if (isNaN(days) || days < 0) {
            alert("Invalid number of days.");
            return;
        }

        if (!confirm(`Are you SURE you want to delete all audit logs older than ${days} days?`)) return;

        setIsPruning(true);
        try {
            await cleanupAuditLogs(days);
            alert("Cleanup complete.");
            fetchLogs(); // Refresh list
        } catch (e: any) {
            console.error(e);
            // Helpful error message if RLS blocks it
            if (e.code === '42501') {
                alert("Permission denied. Database policy prevents deletion of logs.\n\nPlease ask an administrator to run:\nCREATE POLICY \"Admin Delete Audit\" ON audit_logs FOR DELETE TO authenticated USING (public.is_admin());");
            } else {
                alert("Failed to cleanup logs: " + (e.message || e));
            }
        } finally {
            setIsPruning(false);
        }
    };

    const handleRevert = async () => {
        if (!selectedLog) return;

        // Safety warning for different operation types
        let actionDesc = '';
        if (selectedLog.operation === 'INSERT') actionDesc = "DELETE this record";
        if (selectedLog.operation === 'DELETE') actionDesc = "RESTORE this record";
        if (selectedLog.operation === 'UPDATE') actionDesc = "ROLLBACK changes to previous state";

        const warning =
            `⚠️ TIME TRAVEL WARNING\n\n` +
            `You are about to revert change ${selectedLog.id}.\n` +
            `Action: ${actionDesc}\n\n` +
            `Note: If subsequent changes have been made to this record since this log entry, reverting may overwrite them or fail due to conflicts.\n\n` +
            `Are you sure you want to proceed?`;

        if (!window.confirm(warning)) return;

        setIsReverting(true);
        try {
            await revertAuditLog(selectedLog.id);
            alert("Revert successful. A new audit log entry has been created for this action.");
            setSelectedLog(null);
            fetchLogs(); // Refresh the list to show the new revert action
        } catch (e: any) {
            console.error(e);
            alert("Revert failed: " + (e.message || "Unknown error"));
        } finally {
            setIsReverting(false);
        }
    };

    const handleExport = () => {
        // Prepare data for CSV
        const headers = ['Time (Local)', 'Actor', 'Action', 'Table', 'Record ID', 'Change Summary'];
        const csvRows = logs.map(log => {
            const time = new Date(log.changedAt).toLocaleString();
            const actor = getStaffName(log.changedBy);
            const summary = log.operation === 'UPDATE'
                ? `Updated fields: ${Object.keys(log.newData || {}).filter(k => JSON.stringify(log.newData?.[k]) !== JSON.stringify(log.oldData?.[k])).join(', ')}`
                : `${log.operation} record`;

            return [
                `"${time}"`,
                `"${actor}"`,
                log.operation,
                log.tableName,
                log.recordId,
                `"${summary}"`
            ].join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...csvRows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `audit_logs_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getStaffName = (authIdOrId: string) => {
        if (!authIdOrId) return 'System / Unknown';
        // Check by Auth ID first, then by Staff ID
        let person = staff.find(s => s.authId === authIdOrId);
        if (!person) person = staff.find(s => s.id === authIdOrId);
        return person ? person.name : 'Unknown User';
    };

    // Helper to translate values from IDs to Names
    const resolveValue = (key: string, value: any): string => {
        // PII MASKING
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_PATTERNS.some(p => p.test(lowerKey))) {
            return '******** [REDACTED]';
        }

        if (value === null || value === undefined) return 'None';

        if (key === 'department_id' || key === 'departmentId') {
            const dept = departments.find(d => d.id === value);
            return dept ? dept.name : value;
        }
        if (key === 'role_id' || key === 'roleId') {
            const role = roles.find(r => r.id === value);
            return role ? role.name : value;
        }
        if (key === 'leave_type_id' || key === 'leaveTypeId') {
            const lt = leaveTypes.find(l => l.id === value);
            return lt ? lt.name : value;
        }
        if (key === 'manager_id' || key === 'managerId' || key === 'staff_id' || key === 'staffId') {
            return getStaffName(value);
        }
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        // Check if value is an ISO date string
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                if (value.includes('T')) return d.toLocaleString();
                return d.toLocaleDateString();
            }
        }

        if (typeof value === 'object') {
            const stringified = JSON.stringify(value);
            if (SENSITIVE_PATTERNS.some(p => p.test(stringified))) {
                return '{ ... contains sensitive data ... }';
            }
            return stringified;
        }

        return String(value);
    };

    const DiffViewer = ({ log }: { log: AuditLog }) => {
        const oldData = log.oldData || {};
        const newData = log.newData || {};

        // Collect all keys involved
        const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));
        // Filter out system keys
        const keys = allKeys.filter(k => !['updated_at', 'created_at', 'last_updated', 'id'].includes(k));

        const diffRows = keys.map(key => {
            const oldVal = oldData[key];
            const newVal = newData[key];
            const isDiff = JSON.stringify(oldVal) !== JSON.stringify(newVal);

            // If INSERT or DELETE, we show everything. If UPDATE, show only diffs unless it's a small object
            const showRow = log.operation !== 'UPDATE' || isDiff;

            if (!showRow) return null;

            return (
                <tr key={key} className={`border-b dark:border-gray-700 ${isDiff ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
                    <td className="p-2 font-medium text-xs text-gray-500 uppercase w-1/4 border-r dark:border-gray-700">
                        {FIELD_LABELS[key] || key}
                    </td>
                    <td className={`p-2 text-sm w-1/3 border-r dark:border-gray-700 break-words ${log.operation === 'INSERT' ? 'text-gray-300' : 'text-red-600 dark:text-red-400'}`}>
                        {log.operation === 'INSERT' ? '-' : resolveValue(key, oldVal)}
                    </td>
                    <td className={`p-2 text-sm w-1/3 break-words ${log.operation === 'DELETE' ? 'text-gray-300' : 'text-green-600 dark:text-green-400 font-medium'}`}>
                        {log.operation === 'DELETE' ? '-' : resolveValue(key, newVal)}
                    </td>
                </tr>
            );
        }).filter(Boolean);

        if (diffRows.length === 0) {
            return <div className="p-4 text-center text-gray-500 italic">No meaningful content changes detected (System metadata update).</div>;
        }

        return (
            <div className="border rounded dark:border-gray-700 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 dark:bg-gray-700/50 text-xs uppercase text-gray-500 font-bold">
                        <tr>
                            <th className="p-2 border-r dark:border-gray-700">Field</th>
                            <th className="p-2 border-r dark:border-gray-700">Before</th>
                            <th className="p-2">After</th>
                        </tr>
                    </thead>
                    <tbody>
                        {diffRows}
                    </tbody>
                </table>
            </div>
        );
    };

    if (!can('admin:view_settings')) {
        return (
            <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-dashed border-red-200 dark:border-red-900">
                <h1 className="text-2xl font-bold text-status-danger mb-2">Access Denied</h1>
                <p className="text-gray-500">You must be an administrator to view the security audit logs.</p>
            </div>
        );
    }

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    return (
        <div className="space-y-6 pb-safe-bottom">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Audit Logs</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track system changes, security events, and data history.</p>
                </div>
                <div className="hidden sm:block text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase">Total Records</p>
                    <p className="text-xl font-mono font-bold text-brand-primary">{totalCount.toLocaleString()}</p>
                </div>
            </div>

            {/* Command Center */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-grow w-full md:w-auto relative">
                    <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                        type="text"
                        placeholder="Search Record ID, Actor, or Table..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className="w-full pl-10 p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-600 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all"
                    />
                </div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <select value={tableFilter} onChange={e => handleFilterChange(setTableFilter, e.target.value)} className="p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-600 text-sm">
                        <option value="all">All Tables</option>
                        <option value="staff">Staff</option>
                        <option value="rosters">Rosters</option>
                        <option value="flight_log_records">Flight Logs</option>
                        <option value="leave_requests">Leave Requests</option>
                        <option value="department_settings">Settings</option>
                        <option value="fsi_documents">FSI Documents</option>
                        <option value="exams">Exams</option>
                    </select>

                    <select value={opFilter} onChange={e => handleFilterChange(setOpFilter, e.target.value)} className="p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-600 text-sm">
                        <option value="all">All Actions</option>
                        <option value="INSERT">Create</option>
                        <option value="UPDATE">Update</option>
                        <option value="DELETE">Delete</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 border-l pl-4 border-gray-200 dark:border-gray-700 w-full md:w-auto justify-end">
                    <button onClick={() => fetchLogs()} className="p-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Refresh">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                    <button onClick={handleExport} className="p-2.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors font-bold text-sm flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Export
                    </button>
                    <button onClick={handlePrune} disabled={isPruning} className="p-2.5 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 text-sm font-bold flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Prune
                    </button>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700 font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs">
                            <tr>
                                <th className="p-4 w-48">Time</th>
                                <th className="p-4 w-48">Actor</th>
                                <th className="p-4 w-40">Entity</th>
                                <th className="p-4 w-32">Action</th>
                                <th className="p-4">Record ID</th>
                                <th className="p-4 text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan={6} className="p-12 text-center text-gray-500">Loading audit trail...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={6} className="p-12 text-center text-gray-500">No logs found matching criteria.</td></tr>
                            ) : (
                                logs.map(log => {
                                    const severity = getSeverity(log);
                                    const borderColor = severity === 'critical' ? 'border-l-4 border-l-red-500' : severity === 'warning' ? 'border-l-4 border-l-yellow-500' : 'border-l-4 border-l-transparent';

                                    return (
                                        <tr key={log.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${borderColor}`}>
                                            <td className="p-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                                {new Date(log.changedAt).toLocaleDateString()} <span className="text-xs text-gray-400">{new Date(log.changedAt).toLocaleTimeString()}</span>
                                            </td>
                                            <td className="p-4 font-bold text-gray-700 dark:text-gray-200">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${log.changedBy ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                                                        {getStaffName(log.changedBy).charAt(0)}
                                                    </div>
                                                    {getStaffName(log.changedBy)}
                                                </div>
                                            </td>
                                            <td className="p-4 font-mono text-xs text-gray-600 dark:text-gray-400 capitalize bg-gray-50 dark:bg-gray-900 rounded px-2 py-1 inline-block">
                                                {String(log.tableName).replace(/_/g, ' ')}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${log.operation === 'INSERT' ? 'bg-green-100 text-green-800 border border-green-200' :
                                                        log.operation === 'UPDATE' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                                            'bg-red-100 text-red-800 border border-red-200'
                                                    }`}>
                                                    {log.operation}
                                                </span>
                                            </td>
                                            <td className="p-4 font-mono text-xs text-gray-400 truncate max-w-[150px]" title={log.recordId}>
                                                {log.recordId}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => setSelectedLog(log)}
                                                    className="text-brand-primary hover:text-brand-secondary font-bold text-xs bg-brand-light/10 hover:bg-brand-light/20 px-3 py-1.5 rounded transition-colors"
                                                >
                                                    View Diff
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="bg-gray-50 dark:bg-gray-700/30 p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        Showing page {page} of {totalPages || 1}
                    </span>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 text-sm font-medium transition-colors"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || loading}
                            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 text-sm font-medium transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Details Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedLog(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-t-xl">
                            <div>
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Audit Record</h2>
                                <p className="text-xs text-gray-500 font-mono mt-1">{selectedLog.id}</p>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-6 mb-6">
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded border dark:border-gray-700">
                                    <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Timestamp</span>
                                    <span className="text-sm font-mono text-gray-800 dark:text-gray-200">
                                        {new Date(selectedLog.changedAt).toLocaleString()}
                                    </span>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded border dark:border-gray-700">
                                    <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Actor</span>
                                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                        {getStaffName(selectedLog.changedBy)}
                                    </span>
                                </div>
                            </div>

                            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                                <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                Data Changes
                            </h3>
                            <DiffViewer log={selectedLog} />
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
                            {/* Time Travel Button */}
                            <button
                                onClick={handleRevert}
                                disabled={isReverting}
                                className="px-4 py-2 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200 border border-purple-200 dark:border-purple-800 rounded-lg text-sm font-bold hover:bg-purple-100 dark:hover:bg-purple-900/50 flex items-center gap-2 disabled:opacity-50 transition-colors"
                                title="Undo this change"
                            >
                                {isReverting ? (
                                    <span className="animate-pulse">Reverting...</span>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        Revert Change
                                    </>
                                )}
                            </button>

                            <button onClick={() => setSelectedLog(null)} className="px-5 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm">
                                Close Viewer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLogPage;
