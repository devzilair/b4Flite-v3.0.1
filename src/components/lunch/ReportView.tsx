
import React, { useState, useMemo } from 'react';
import { LunchMenu, LunchOrder, Staff } from '@/types';

interface ReportViewProps {
    menus: LunchMenu[];
    orders: LunchOrder[];
    staffList: Staff[];
    onClose: () => void;
}

const ReportView: React.FC<ReportViewProps> = ({ menus, orders, staffList, onClose }) => {
    // Default to the first future date if available, else latest
    const today = new Date().toISOString().split('T')[0];
    const sortedMenus = [...menus].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const upcomingMenu = sortedMenus.find(m => m.date >= today);
    const initialDate = upcomingMenu ? upcomingMenu.date : (sortedMenus[sortedMenus.length - 1]?.date || '');

    const [selectedDate, setSelectedDate] = useState(initialDate);

    const currentMenu = menus.find(m => m.date === selectedDate);
    const currentOrders = orders.filter(o => o.date === selectedDate);

    const stats = useMemo(() => {
        if (!currentMenu) return null;

        // Count for Main Dishes
        const counts: { [key: string]: number } = {};
        const lists: { [key: string]: { name: string, notes?: string, condiments?: string[] }[] } = {};

        // Global Condiment Counts (Aggregated across all dishes)
        const totalCondiments: { [condiment: string]: number } = {};

        currentMenu.options.forEach(opt => {
            counts[opt.id] = 0;
            lists[opt.id] = [];
        });

        // Track unique staff IDs to avoid duplicate counting if data is somehow malformed (robustness)
        const countedStaff = new Set<string>();
        let validOrderCount = 0;

        currentOrders.forEach(order => {
            if (!countedStaff.has(order.staffId) && counts[order.optionId] !== undefined) {
                countedStaff.add(order.staffId);
                validOrderCount++;

                // Increment Dish Count
                counts[order.optionId]++;

                const staffName = staffList.find(s => s.id === order.staffId)?.name || 'Unknown';
                lists[order.optionId].push({
                    name: staffName,
                    notes: order.notes,
                    condiments: order.selectedCondiments
                });

                // Increment Condiment Counts
                if (order.selectedCondiments) {
                    order.selectedCondiments.forEach(c => {
                        totalCondiments[c] = (totalCondiments[c] || 0) + 1;
                    });
                }
            }
        });

        // Sort lists by name
        Object.keys(lists).forEach(key => {
            lists[key].sort((a, b) => a.name.localeCompare(b.name));
        });

        return { counts, lists, totalCondiments, validOrderCount };
    }, [currentMenu, currentOrders, staffList]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
            <div id="lunch-report-container" className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 print:hidden">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Lunch Orders Report</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>

                {/* Header for Print Only */}
                <div className="hidden print:block mb-6 border-b-2 border-black pb-4">
                    <h1 className="text-3xl font-bold uppercase tracking-wider">Catering Report</h1>
                    <div className="flex justify-between items-end mt-2">
                        <p className="text-lg font-bold">{new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="text-sm text-gray-600">Generated: {new Date().toLocaleTimeString()}</p>
                    </div>
                </div>

                <div className="mb-6 print:hidden">
                    <label className="mr-3 font-medium text-gray-700 dark:text-gray-300">Select Date:</label>
                    <select
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                    >
                        {sortedMenus.map(m => (
                            <option key={m.date} value={m.date}>{new Date(m.date).toLocaleDateString()}</option>
                        ))}
                    </select>
                </div>

                {currentMenu && stats ? (
                    <div className="flex-grow overflow-y-auto space-y-8 print:space-y-4 print:overflow-visible p-1">
                        {/* Summary Table */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-100 dark:border-blue-800 print:border-black print:bg-white">
                            <h3 className="font-bold text-xl mb-4 text-blue-800 dark:text-blue-200 print:text-black uppercase border-b-2 border-blue-200 dark:border-blue-800 print:border-black pb-2">Kitchen Summary</h3>
                            <table className="w-full text-left text-lg">
                                <thead>
                                    <tr className="border-b border-blue-200 dark:border-blue-700 print:border-black">
                                        <th className="py-2">Item</th>
                                        <th className="py-2 text-right">Quantity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Main Dishes */}
                                    {currentMenu.options.map(opt => (
                                        <tr key={opt.id} className="border-b border-blue-100 dark:border-blue-800/50 print:border-gray-300">
                                            <td className="py-3 font-medium">{opt.name}</td>
                                            <td className="py-3 text-right font-bold text-2xl">{stats.counts[opt.id]}</td>
                                        </tr>
                                    ))}

                                    {/* Total */}
                                    <tr className="font-bold border-t-2 border-blue-300 dark:border-blue-600 print:border-black bg-blue-100 dark:bg-blue-800/30 print:bg-gray-100 mt-4">
                                        <td className="py-3 pl-2">TOTAL MEALS (Orders)</td>
                                        <td className="py-3 pr-2 text-right text-2xl">{stats.validOrderCount}</td>
                                    </tr>

                                    {/* Condiments Section */}
                                    {Object.keys(stats.totalCondiments).length > 0 && (
                                        <>
                                            <tr className="bg-transparent h-4"><td></td><td></td></tr>
                                            <tr className="bg-blue-100/50 dark:bg-blue-800/20 print:bg-gray-100 font-bold text-sm text-blue-900 dark:text-blue-100 print:text-black uppercase tracking-wider">
                                                <td colSpan={2} className="py-2 pl-2">Sides & Condiments Required</td>
                                            </tr>
                                            {Object.entries(stats.totalCondiments).map(([cond, count]) => (
                                                <tr key={`cond-${cond}`} className="text-sm text-gray-700 dark:text-gray-300 print:text-black border-b border-blue-100 dark:border-blue-800/30 print:border-gray-200">
                                                    <td className="py-1 pl-4 italic">+ {cond}</td>
                                                    <td className="py-1 text-right font-semibold">{count}</td>
                                                </tr>
                                            ))}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Detailed Lists */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid print:grid-cols-2 print:gap-4">
                            {currentMenu.options.map(opt => (
                                <div key={opt.id} className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/30 print:bg-white print:border-black print:mb-0 print:break-inside-avoid">
                                    <div className="flex justify-between items-center mb-3 border-b dark:border-gray-600 print:border-black pb-2">
                                        <span className="font-bold text-lg truncate" title={opt.name}>{opt.name}</span>
                                        <span className="bg-gray-200 print:bg-black print:text-white text-gray-700 px-3 py-1 rounded-full text-sm font-bold">{stats.counts[opt.id]}</span>
                                    </div>
                                    <ul className="text-sm space-y-2 max-h-60 overflow-y-auto text-gray-700 dark:text-gray-300 print:max-h-none print:overflow-visible print:text-black">
                                        {stats.lists[opt.id].length > 0 ? (
                                            stats.lists[opt.id].map((person, i) => (
                                                <li key={i} className="flex flex-col border-b border-gray-100 dark:border-gray-700 last:border-0 pb-1">
                                                    <span className="font-medium">• {person.name}
                                                        {person.condiments && person.condiments.length > 0 && (
                                                            <span className="text-xs font-normal text-gray-500 print:text-black ml-1">
                                                                ({person.condiments.join(', ')})
                                                            </span>
                                                        )}
                                                    </span>
                                                    {person.notes && (
                                                        <span className="text-red-600 text-xs font-bold pl-4">
                                                            ⚠ {person.notes}
                                                        </span>
                                                    )}
                                                </li>
                                            ))
                                        ) : (
                                            <li className="italic opacity-50">No orders</li>
                                        )}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-center py-12 text-gray-500">No menu found for this date.</p>
                )}

                <div className="mt-4 pt-4 border-t dark:border-gray-700 flex justify-end gap-2 print:hidden">
                    <button onClick={() => window.print()} className="px-6 py-2 bg-gray-800 text-white rounded font-bold hover:bg-gray-900 shadow-lg flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" /></svg>
                        Print Report
                    </button>
                </div>

                <style>{`
                    @media print {
                        @page {
                            size: A4 portrait;
                            margin: 5mm;
                        }
                        body {
                            visibility: hidden;
                            background-color: white !important;
                            font-size: 10pt;
                        }
                        .fixed.inset-0 {
                            position: static !important;
                            background: none !important;
                            padding: 0 !important;
                            z-index: auto;
                        }
                        #lunch-report-container {
                            visibility: visible;
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100% !important;
                            max-width: none !important;
                            max-height: none !important;
                            overflow: visible !important;
                            box-shadow: none !important;
                            border: none !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            transform: scale(0.95);
                            transform-origin: top center;
                        }
                        #lunch-report-container * {
                            visibility: visible;
                        }
                        .print\\:hidden {
                            display: none !important;
                        }
                        .print\\:block {
                            display: block !important;
                        }
                        .overflow-y-auto {
                            overflow: visible !important;
                            height: auto !important;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
};

export default ReportView;
