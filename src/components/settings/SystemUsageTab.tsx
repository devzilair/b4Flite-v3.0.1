
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useStaff } from '../../hooks/useStaff';
import useLocalStorage from '../../hooks/useLocalStorage';

interface TableStat {
    id: string;
    name: string;
    count: number;
    description: string;
}

interface CostItem {
    id: string;
    item: string;
    cost: number;
}

const DEFAULT_COSTS: CostItem[] = [
    { id: 'c1', item: 'Supabase Pro (Production)', cost: 25.00 },
    { id: 'c1_2', item: 'Supabase Pro (Training)', cost: 25.00 },
    { id: 'c1_3', item: 'Supabase Usage Buffer', cost: 100.00 },
    { id: 'c2', item: 'Render (Hosting)', cost: 19.00 },
    { id: 'c8', item: 'Vercel Pro', cost: 20.00 },
    { id: 'c3', item: 'Google Gemini API', cost: 15.00 },
    { id: 'c4', item: 'Google AI Studio', cost: 20.00 },
    { id: 'c5', item: 'Google AntiGravity AI Ultra', cost: 125.00 },
    { id: 'c7', item: 'Domain & DNS', cost: 2.00 },
];

const SystemUsageTab: React.FC = () => {
    const { staff } = useStaff();
    const [stats, setStats] = useState<TableStat[]>([]);
    const [healthMetrics, setHealthMetrics] = useState({
        pendingLeave: 0,
        recentLogs: 0,
        orphanedStaff: 0
    });
    const [loading, setLoading] = useState(true);

    // Persist cost settings
    const [costs, setCosts] = useLocalStorage<CostItem[]>('system_economics_costs', DEFAULT_COSTS);
    const [isEditingCosts, setIsEditingCosts] = useState(false);

    // Temporary state for editing session
    const [editBuffer, setEditBuffer] = useState<CostItem[]>([]);

    const TABLES = [
        { id: 'staff', label: 'Staff Profiles', desc: 'Total headcount and system accounts.' },
        { id: 'rosters', label: 'Roster Objects', desc: 'One row per month per department (High Efficiency).' },
        { id: 'flight_log_records', label: 'Flight Logs', desc: 'Individual daily duty and flight records.' },
        { id: 'audit_logs', label: 'Audit History', desc: 'Record of system changes (Insert/Update/Delete).' },
        { id: 'leave_requests', label: 'Leave Requests', desc: 'Pending and historical leave applications.' },
        { id: 'leave_transactions', label: 'Ledger Entries', desc: 'Accruals and deductions transactions.' },
        { id: 'fsi_acknowledgments', label: 'Safety Signatures', desc: 'Record of staff reading critical notices.' }
    ];

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);

            // 1. Table Counts
            const results = await Promise.all(
                TABLES.map(async (t) => {
                    const { count } = await supabase
                        .from(t.id)
                        .select('*', { count: 'exact', head: true });

                    return {
                        id: t.id,
                        name: t.label,
                        count: count || 0,
                        description: t.desc
                    };
                })
            );
            setStats(results);

            // 2. Health Metrics
            const { count: pendingLeave } = await supabase
                .from('leave_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
            const { count: recentLogs } = await supabase
                .from('audit_logs')
                .select('*', { count: 'exact', head: true })
                .gt('changed_at', oneDayAgo);

            const { count: orphanedStaff } = await supabase
                .from('staff')
                .select('*', { count: 'exact', head: true })
                .is('department_id', null);

            setHealthMetrics({
                pendingLeave: pendingLeave || 0,
                recentLogs: recentLogs || 0,
                orphanedStaff: orphanedStaff || 0
            });

            setLoading(false);
        };

        fetchStats();
    }, []);

    const startEditing = () => {
        setEditBuffer(JSON.parse(JSON.stringify(costs)));
        setIsEditingCosts(true);
    };

    const saveCosts = () => {
        setCosts(editBuffer);
        setIsEditingCosts(false);
    };

    const cancelEditing = () => {
        setIsEditingCosts(false);
        setEditBuffer([]);
    };

    const updateBufferItem = (index: number, field: keyof CostItem, value: string | number) => {
        const newBuffer = [...editBuffer];
        newBuffer[index] = { ...newBuffer[index], [field]: value };
        setEditBuffer(newBuffer);
    };

    const addBufferItem = () => {
        setEditBuffer([...editBuffer, { id: `c_${Date.now()}`, item: 'New Item', cost: 0 }]);
    };

    const removeBufferItem = (index: number) => {
        const newBuffer = [...editBuffer];
        newBuffer.splice(index, 1);
        setEditBuffer(newBuffer);
    };

    const totalRows = useMemo(() => stats.reduce((sum, s) => sum + s.count, 0), [stats]);
    const staffCount = staff.length;

    // Dynamic Calculations
    const activeCosts = isEditingCosts ? editBuffer : costs;
    const totalOpEx = activeCosts.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
    const estValue = 550.00; // Base market value benchmark
    const roi = totalOpEx > 0 ? ((estValue - totalOpEx) / totalOpEx) * 100 : 0;

    const rowCapacityLimit = 500000;
    const usagePercent = Math.min(100, (totalRows / rowCapacityLimit) * 100);

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">System Health & Economics</h2>
                    <p className="text-sm text-gray-500">Infrastructure metrics and commercial value analysis.</p>
                </div>
                <div className="text-right hidden sm:block">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">System Version</span>
                    <p className="font-mono text-sm font-bold text-brand-primary">v55.14.0</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 1. Infrastructure Health */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Database Health */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s-8-1.79-8-4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                            </div>
                            <h3 className="font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-xs">Database Status</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            <div>
                                <span className="text-4xl font-black text-gray-900 dark:text-white">
                                    {totalRows.toLocaleString()}
                                </span>
                                <p className="text-xs text-gray-500 mt-1 uppercase font-bold">Total Records</p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
                                        <span>Roster Sparse Matrix Capacity</span>
                                        <span>{usagePercent.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${usagePercent > 80 ? 'bg-status-danger' : usagePercent > 50 ? 'bg-status-warning' : 'bg-brand-primary'}`}
                                            style={{ width: `${usagePercent}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-status-success animate-pulse"></div>
                                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase">
                                        Connection: <span className="text-status-success">ACTIVE</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {stats.map(s => (
                                <div key={s.id} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-transparent hover:border-gray-200 transition-colors">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold truncate">{s.name}</p>
                                    <span className="font-mono text-sm font-bold text-brand-primary">{s.count.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Operational Pulse */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <h3 className="font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-xs">Operational Pulse</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800 rounded-lg">
                                <p className="text-xs text-yellow-800 dark:text-yellow-500 font-bold uppercase mb-1">Pending Leave</p>
                                <p className="text-2xl font-black text-gray-800 dark:text-white">{healthMetrics.pendingLeave}</p>
                                <p className="text-[10px] text-gray-500">Requests awaiting approval</p>
                            </div>
                            <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800 rounded-lg">
                                <p className="text-xs text-purple-800 dark:text-purple-400 font-bold uppercase mb-1">Activity (24h)</p>
                                <p className="text-2xl font-black text-gray-800 dark:text-white">{healthMetrics.recentLogs}</p>
                                <p className="text-[10px] text-gray-500">System write operations</p>
                            </div>
                            <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 rounded-lg">
                                <p className="text-xs text-red-800 dark:text-red-400 font-bold uppercase mb-1">Orphaned Staff</p>
                                <p className="text-2xl font-black text-gray-800 dark:text-white">{healthMetrics.orphanedStaff}</p>
                                <p className="text-[10px] text-gray-500">Profiles without department</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Commercial Economics */}
                <div className="bg-brand-primary text-white p-6 rounded-xl shadow-lg border border-brand-primary flex flex-col transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <svg className="w-5 h-5 text-brand-light" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m.599-1c.51-.598.81-1.364.81-2.201 0-2.003-2.183-3.14-4.516-3.14S5.1 8.997 5.1 11c0 .837.3 1.603.81 2.201M15 11h.01M15 15h.01M15 19h.01M15 7h.01M15 3h.01" /></svg>
                            </div>
                            <h3 className="font-bold uppercase tracking-wider text-xs text-brand-light">Business Value Analysis</h3>
                        </div>
                        {!isEditingCosts ? (
                            <button onClick={startEditing} className="text-xs bg-white/10 hover:bg-white/20 p-1.5 rounded text-brand-light transition-colors" title="Edit Costs">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={cancelEditing} className="text-xs bg-red-500/80 hover:bg-red-500 text-white px-2 py-1 rounded">Cancel</button>
                                <button onClick={saveCosts} className="text-xs bg-green-500/80 hover:bg-green-500 text-white px-2 py-1 rounded font-bold">Save</button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6 flex-grow">
                        <div>
                            <p className="text-[10px] font-bold text-brand-light uppercase mb-1">Total Maintenance OpEx</p>
                            <p className="text-3xl font-black">${totalOpEx.toFixed(2)}<span className="text-sm font-normal text-brand-light/70 ml-1">/ mo</span></p>
                            <p className="text-[9px] text-brand-light/60 mt-1 italic">Incl. Cloud Infrastructure & AI Tooling</p>
                        </div>

                        <div className={`bg-white/10 rounded-lg p-3 ${isEditingCosts ? 'ring-2 ring-yellow-400/50' : ''}`}>
                            <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-1">
                                <p className="text-[10px] font-bold text-brand-light uppercase">Monthly Cost Breakdown</p>
                                {isEditingCosts && <button onClick={addBufferItem} className="text-[10px] bg-green-600 hover:bg-green-500 px-2 py-0.5 rounded text-white">+ Add</button>}
                            </div>

                            <div className="space-y-1 max-h-60 overflow-y-auto">
                                {activeCosts.map((item, idx) => (
                                    <div key={item.id || idx} className="flex justify-between items-center text-[11px] min-h-[20px]">
                                        {isEditingCosts ? (
                                            <>
                                                <input
                                                    type="text"
                                                    value={item.item}
                                                    onChange={e => updateBufferItem(idx, 'item', e.target.value)}
                                                    className="bg-black/20 border-none rounded px-1 py-0.5 text-white w-2/3 mr-1 focus:ring-1 focus:ring-white/50"
                                                />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-brand-light/50">$</span>
                                                    <input
                                                        type="number"
                                                        value={item.cost}
                                                        onChange={e => updateBufferItem(idx, 'cost', e.target.value)}
                                                        className="bg-black/20 border-none rounded px-1 py-0.5 text-white w-12 text-right focus:ring-1 focus:ring-white/50"
                                                    />
                                                    <button onClick={() => removeBufferItem(idx)} className="text-red-300 hover:text-red-100 ml-1">×</button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-brand-light/80 truncate pr-2">{item.item}</span>
                                                <span className="font-mono flex-shrink-0">${Number(item.cost).toFixed(2)}</span>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-white/10 rounded-lg border border-white/10">
                            <p className="text-[10px] font-bold text-brand-light uppercase mb-2">Commercial SaaS Equivalent</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold">${estValue.toFixed(2)}</span>
                                <span className="text-xs text-brand-light">est. value / mo</span>
                            </div>
                            <p className="text-[9px] text-brand-light/60 mt-2 leading-relaxed">
                                Market rate analysis for {staffCount} active personnel.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between text-[11px]">
                                <span className="opacity-70">Internal ROI</span>
                                <span className={`font-bold ${roi > 0 ? 'text-green-300' : 'text-red-300'}`}>{roi.toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemUsageTab;