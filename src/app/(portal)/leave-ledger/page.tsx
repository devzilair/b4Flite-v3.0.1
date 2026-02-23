'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { LeaveTransaction } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import LeaveTransactionModal from '@/components/leave/LeaveTransactionModal';
import { getErrorMessage, formatStaffName } from '@/utils/sanitization';
import { useLeave } from '@/hooks/useLeave';
import { useStaff } from '@/hooks/useStaff';
import { useSettings } from '@/hooks/useSettings';

const SummaryCard: React.FC<{ title: string; value: string | number; colorClass?: string; subTitle?: string }> = ({ title, value, colorClass = 'text-brand-primary', subTitle }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md text-center">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</h3>
        <p className={`mt-1 text-3xl font-bold ${colorClass}`}>{value}</p>
        {subTitle && <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold tracking-wide">{subTitle}</p>}
    </div>
);

const TransactionTypeBadge: React.FC<{ type: string }> = ({ type }) => {
    const typeClasses: { [key: string]: string } = {
        accrual: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        leave_taken: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
        adjustment: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${typeClasses[type]}`}>{type.replace('_', ' ')}</span>;
};

const LeaveLedgerPage: React.FC = () => {
    const {
        staff,
        loading: staffLoading
    } = useStaff();

    const { leaveTypes, loading: settingsLoading } = useSettings();

    const {
        leaveTransactions,
        addLeaveTransaction,
        deleteLeaveTransaction,
        fixLedgerDuplicates,
        loading: leaveLoading
    } = useLeave();

    const loading = staffLoading || leaveLoading || settingsLoading;

    const { currentUser, can } = usePermissions();
    const canManageLedger = can('leave_planner:approve');

    const [selectedStaffId, setSelectedStaffId] = useState<string>(currentUser?.id || '');
    const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<string>('all');

    // Feature: Year Selection
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFixing, setIsFixing] = useState(false);

    // For editing
    const [editingTransaction, setEditingTransaction] = useState<LeaveTransaction | null>(null);

    const todayStr = new Date().toISOString().split('T')[0];

    const viewableStaff = useMemo(() => {
        if (can('leave_planner:view_balances')) {
            // Filter out admins, super admins AND disabled staff from the ledger view
            return staff.filter(s => s.roleId !== 'role_admin' && s.roleId !== 'role_super_admin' && s.accountStatus !== 'disabled').sort((a, b) => a.name.localeCompare(b.name));
        }
        return staff.filter(s => s.id === currentUser?.id);
    }, [staff, currentUser, can]);

    const availableLeaveTypes = useMemo(() => {
        return leaveTypes;
    }, [leaveTypes]);

    useEffect(() => {
        // If we are in specific mode but the ID is invalid, reset to 'all'.
        if (selectedLeaveTypeId !== 'all' && availableLeaveTypes.length > 0 && !availableLeaveTypes.some(lt => lt.id === selectedLeaveTypeId)) {
            setSelectedLeaveTypeId('all');
        }
    }, [availableLeaveTypes, selectedLeaveTypeId]);

    // Ensure selectedStaffId is valid within viewableStaff. If not, reset to first.
    useEffect(() => {
        if (viewableStaff.length > 0 && !viewableStaff.some(s => s.id === selectedStaffId)) {
            setSelectedStaffId(viewableStaff[0].id);
        }
    }, [viewableStaff, selectedStaffId]);

    // Data for "All Types" view
    const allTypesSummary = useMemo(() => {
        if (!selectedStaffId) return [];
        // Uses selectedYear instead of current year
        return availableLeaveTypes.map(lt => {
            const typeTransactions = leaveTransactions
                .filter(t => t.staffId === selectedStaffId && t.leaveTypeId === lt.id);

            // Fix: Parse year from string to avoid timezone issues
            const opening = typeTransactions
                .filter(t => parseInt(t.date.split('-')[0]) < selectedYear)
                .reduce((acc, t) => acc + t.amount, 0);

            const selectedYearTrans = typeTransactions.filter(t => parseInt(t.date.split('-')[0]) === selectedYear);

            const accrued = selectedYearTrans.filter(t => t.transactionType === 'accrual').reduce((acc, t) => acc + t.amount, 0);

            // Split Taken into Past vs Planned (Future)
            const taken = selectedYearTrans
                .filter(t => t.transactionType === 'leave_taken' && t.date <= todayStr)
                .reduce((acc, t) => acc + t.amount, 0);

            const planned = selectedYearTrans
                .filter(t => t.transactionType === 'leave_taken' && t.date > todayStr)
                .reduce((acc, t) => acc + t.amount, 0);

            const adjusted = selectedYearTrans.filter(t => t.transactionType === 'adjustment').reduce((acc, t) => acc + t.amount, 0);

            // Total balance is sum of all transactions ever (Projected)
            const balance = typeTransactions.reduce((acc, t) => acc + t.amount, 0);

            // Actual Balance (As of Today)
            const actualBalance = typeTransactions
                .filter(t => t.date <= todayStr)
                .reduce((acc, t) => acc + t.amount, 0);

            return {
                id: lt.id,
                name: lt.name,
                color: lt.color,
                opening,
                accrued,
                taken,
                planned,
                adjusted,
                balance,
                actualBalance
            };
        });
    }, [selectedStaffId, availableLeaveTypes, leaveTransactions, todayStr, selectedYear]);

    // Data for "Single Type" view
    const ledgerData = useMemo(() => {
        const summary = { openingBalance: 0, accrued: 0, taken: 0, planned: 0, adjusted: 0, currentBalance: 0, actualBalance: 0 };
        if (!selectedStaffId || selectedLeaveTypeId === 'all') return { transactions: [], summary };

        // 1. Get ALL transactions for this type, sorted by date ASC
        const filtered = leaveTransactions
            .filter(t => t.staffId === selectedStaffId && t.leaveTypeId === selectedLeaveTypeId)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // 2. Calculate Opening Balance (Static sum of past years relative to selectedYear)
        // Fix: String parsing for year
        summary.openingBalance = filtered
            .filter(t => parseInt(t.date.split('-')[0]) < selectedYear)
            .reduce((acc, t) => acc + t.amount, 0);

        // 3. Calculate Running Balance
        let runningBalance = 0;

        const transactionsWithBalance = filtered.map(t => {
            runningBalance += t.amount;
            return { ...t, balance: runningBalance };
        });

        // 4. Calculate Current Year Metrics
        const currentYearTrans = filtered.filter(t => parseInt(t.date.split('-')[0]) === selectedYear);

        summary.accrued = currentYearTrans.filter(t => t.transactionType === 'accrual').reduce((acc, t) => acc + t.amount, 0);

        summary.taken = currentYearTrans
            .filter(t => t.transactionType === 'leave_taken' && t.date <= todayStr)
            .reduce((acc, t) => acc + t.amount, 0);

        summary.planned = currentYearTrans
            .filter(t => t.transactionType === 'leave_taken' && t.date > todayStr)
            .reduce((acc, t) => acc + t.amount, 0);

        summary.adjusted = currentYearTrans.filter(t => t.transactionType === 'adjustment').reduce((acc, t) => acc + t.amount, 0);

        // Current Balance is the final running balance (Projected)
        summary.currentBalance = runningBalance;

        // Actual Balance (Up to Today)
        summary.actualBalance = filtered
            .filter(t => t.date <= todayStr)
            .reduce((acc, t) => acc + t.amount, 0);

        const displayTransactions = transactionsWithBalance.filter(t => parseInt(t.date.split('-')[0]) === selectedYear).reverse();

        return { transactions: displayTransactions, summary };
    }, [selectedStaffId, selectedLeaveTypeId, leaveTransactions, todayStr, selectedYear]);

    const handleSaveTransaction = async (transaction: Omit<LeaveTransaction, 'id' | 'staffId' | 'leaveTypeId'> | LeaveTransaction) => {
        const targetType = selectedLeaveTypeId === 'all' ? availableLeaveTypes[0]?.id : selectedLeaveTypeId;

        if (!targetType) {
            alert("Please select a specific leave type to add a transaction.");
            return;
        }

        const newTransaction: LeaveTransaction = {
            ...transaction,
            id: (transaction as any).id || `ltx_${Date.now()}`,
            staffId: selectedStaffId,
            leaveTypeId: targetType,
        };
        try {
            await addLeaveTransaction(newTransaction);
            setIsModalOpen(false);
            setEditingTransaction(null);
        } catch (error: any) {
            console.error("Save transaction failed:", error);
            alert(`Failed to save transaction: ${error.message || 'Unknown error'}`);
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this transaction? This will impact the user's leave balance.")) return;
        try {
            await deleteLeaveTransaction(id);
        } catch (error: any) {
            alert(`Failed to delete transaction: ${getErrorMessage(error)}`);
        }
    };

    const handleExportCSV = () => {
        if (!ledgerData.transactions.length) return;

        const staffName = viewableStaff.find(s => s.id === selectedStaffId)?.name || 'Staff';
        const typeName = availableLeaveTypes.find(lt => lt.id === selectedLeaveTypeId)?.name || 'General';

        const headers = ['Date', 'Type', 'Description', 'Amount', 'Balance'];
        const rows = ledgerData.transactions.map(t => [
            t.date,
            t.transactionType,
            `"${(t.notes || '').replace(/"/g, '""')}"`,
            t.amount.toFixed(2),
            t.balance.toFixed(2)
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${staffName}_${typeName}_${selectedYear}_ledger.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFixDuplicates = async () => {
        if (!selectedStaffId) return;
        if (!window.confirm("Run diagnostic check?\n\nThis will scan for and delete any 'manual' roster entries that overlap with approved Leave Requests. This fixes 'double counting' issues.")) return;

        setIsFixing(true);
        try {
            const removedCount = await fixLedgerDuplicates(selectedStaffId);
            if (removedCount > 0) {
                alert(`Success: Removed ${removedCount} duplicate transaction(s). The ledger should now be accurate.`);
            } else {
                alert("Diagnostic complete: No duplicate transactions found.");
            }
        } catch (e: any) {
            alert("Error running diagnostic: " + e.message);
        } finally {
            setIsFixing(false);
        }
    };

    const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 3 + i);

    if (loading) {
        return <div>Loading leave ledger...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Leave Ledger</h1>
                {canManageLedger && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleFixDuplicates}
                            disabled={!selectedStaffId || isFixing}
                            className="bg-yellow-100 text-yellow-800 border border-yellow-200 py-2 px-4 rounded-md hover:bg-yellow-200 disabled:opacity-50 text-sm font-bold flex items-center gap-2"
                            title="Scan for and fix double-counted leave"
                        >
                            {isFixing ? 'Scanning...' : '🛠️ Run Diagnostics'}
                        </button>
                        <button
                            onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
                            className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold"
                            disabled={!selectedStaffId || selectedLeaveTypeId === 'all'}
                            title={selectedLeaveTypeId === 'all' ? "Select a specific leave type to add transactions" : "Add Transaction"}
                        >
                            + Add Transaction
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <select
                        value={selectedStaffId}
                        onChange={e => setSelectedStaffId(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                        disabled={viewableStaff.length <= 1}
                    >
                        {viewableStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select
                        value={selectedLeaveTypeId}
                        onChange={e => setSelectedLeaveTypeId(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                        disabled={availableLeaveTypes.length === 0}
                    >
                        <option value="all">All Leave Types (Combined View)</option>
                        {availableLeaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={e => setSelectedYear(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md font-mono"
                    >
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {selectedLeaveTypeId === 'all' ? (
                // ALL TYPES VIEW
                <div className="space-y-4">
                    {allTypesSummary.map(summary => (
                        <div key={summary.id} className="bg-white dark:bg-gray-800 rounded-lg shadow border-l-4 p-6 hover:shadow-lg transition-shadow" style={{ borderLeftColor: summary.color }}>
                            <div className="flex flex-col sm:flex-row justify-between items-center border-b dark:border-gray-700 pb-4 mb-4">
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    {summary.name}
                                    <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{selectedYear}</span>
                                </h3>
                                <button
                                    onClick={() => setSelectedLeaveTypeId(summary.id)}
                                    className="text-sm bg-gray-100 dark:bg-gray-700 text-brand-primary px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    View Transactions &rarr;
                                </button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-7 gap-4 text-center">
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold" title="Uncapped carry over">Opening</p>
                                    <p className="text-sm font-semibold">{summary.opening.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold">Accrued</p>
                                    <p className="text-sm font-semibold text-green-600">+{summary.accrued.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold">Taken (Past)</p>
                                    <p className="text-sm font-semibold text-red-600">{summary.taken.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold">Planned</p>
                                    <p className="text-sm font-semibold text-purple-600">{summary.planned.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold">Adjusted</p>
                                    <p className="text-sm font-semibold text-blue-600">{summary.adjusted > 0 ? '+' : ''}{summary.adjusted.toFixed(2)}</p>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2 flex flex-col justify-center">
                                    <p className="text-xs text-blue-600 dark:text-blue-300 uppercase font-bold">Actual Bal</p>
                                    <p className="text-lg font-bold text-blue-700 dark:text-blue-200">
                                        {summary.actualBalance.toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2 flex flex-col justify-center">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Projected</p>
                                    <p className={`text-lg font-bold ${summary.balance < 0 ? 'text-red-600' : 'text-gray-800 dark:text-white'}`}>
                                        {summary.balance.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {allTypesSummary.length === 0 && <p className="text-center text-gray-500 py-12">No leave types defined.</p>}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                        <SummaryCard title="Opening" value={ledgerData.summary.openingBalance?.toFixed(2) || '0.00'} subTitle={`Carry Over to ${selectedYear}`} />
                        <SummaryCard title="Accrued" value={ledgerData.summary.accrued?.toFixed(2) || '0.00'} colorClass="text-green-600" />
                        <SummaryCard title="Taken" value={Math.abs(ledgerData.summary.taken || 0).toFixed(2)} colorClass="text-red-600" />
                        <SummaryCard title="Planned" value={Math.abs(ledgerData.summary.planned || 0).toFixed(2)} colorClass="text-purple-600" />
                        <SummaryCard title="Adjusted" value={ledgerData.summary.adjusted?.toFixed(2) || '0.00'} colorClass="text-blue-600" />
                        <SummaryCard title="Actual Bal" value={ledgerData.summary.actualBalance?.toFixed(2) || '0.00'} colorClass="text-blue-600" />
                        <SummaryCard title="Projected" value={ledgerData.summary.currentBalance?.toFixed(2) || '0.00'} colorClass="text-status-success" />
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-700 dark:text-gray-200">{selectedYear} Transactions</h3>
                            <button
                                onClick={handleExportCSV}
                                className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded border border-green-200 font-bold flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Export CSV
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Leave Type</th>
                                        <th className="p-3">Transaction</th>
                                        <th className="p-3">Details</th>
                                        <th className="p-3 text-right">Amount</th>
                                        <th className="p-3 text-right">Balance</th>
                                        {canManageLedger && <th className="p-3 text-right">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledgerData.transactions.map(t => (
                                        <tr key={t.id} className="border-b border-gray-200 dark:border-gray-700">
                                            <td className="p-3 whitespace-nowrap">
                                                {new Date(t.date + 'T00:00:00Z').toLocaleDateString()}
                                                {t.date > todayStr && <span className="ml-2 bg-purple-100 text-purple-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">Planned</span>}
                                            </td>
                                            <td className="p-3 font-medium text-sm text-gray-600 dark:text-gray-400">
                                                {availableLeaveTypes.find(lt => lt.id === t.leaveTypeId)?.name || 'Unknown'}
                                            </td>
                                            <td className="p-3"><TransactionTypeBadge type={t.transactionType} /></td>
                                            <td className="p-3 text-sm text-gray-600 dark:text-gray-300">
                                                {t.notes}
                                                {t.relatedLeaveRequestId && (
                                                    <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded border dark:border-gray-600">System</span>
                                                )}
                                            </td>
                                            <td className={`p-3 text-right font-semibold ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {t.amount > 0 ? '+' : ''}{t.amount.toFixed(2)}
                                            </td>
                                            <td className="p-3 text-right font-bold">{t.balance.toFixed(2)}</td>
                                            {canManageLedger && (
                                                <td className="p-3 text-right flex justify-end gap-2">
                                                    {!t.relatedLeaveRequestId && (
                                                        <button
                                                            onClick={() => { setEditingTransaction(t); setIsModalOpen(true); }}
                                                            className="text-gray-400 hover:text-brand-primary"
                                                            title="Edit Transaction"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteTransaction(t.id)}
                                                        className="text-gray-400 hover:text-red-600"
                                                        title={t.relatedLeaveRequestId ? "Warning: Deleting this system entry may cause sync issues" : "Delete Transaction"}
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {ledgerData.transactions.length === 0 && <p className="text-center py-8 text-gray-500">No transactions found for {selectedYear}.</p>}
                        </div>
                    </div>
                </>
            )}

            {isModalOpen && (
                <LeaveTransactionModal
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
                    onSave={handleSaveTransaction}
                    existingTransaction={editingTransaction}
                />
            )}
        </div>
    );
};

export default LeaveLedgerPage;
