
import React, { useState, useMemo } from 'react';
import { LunchMenu, LunchOrder, Staff } from '@/types';

interface LunchOrderManagerProps {
    menu: LunchMenu;
    staffList: Staff[];
    orders: LunchOrder[];
    rosters: any;
    departmentSettings: any;
    currentUser: Staff | null;
    onClose: () => void;
    onUpdateOrder: (staffId: string, optionId: string, condiments: string[]) => void;
}

const LunchOrderManager: React.FC<LunchOrderManagerProps> = ({ menu, staffList, orders, rosters, departmentSettings, currentUser, onClose, onUpdateOrder }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterScope, setFilterScope] = useState<'all' | 'my_dept'>('my_dept');
    const [includeOffDuty, setIncludeOffDuty] = useState(false);

    const eligibleStaff = useMemo(() => {
        const dateObj = new Date(menu.date);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const manualIds = new Set(menu.manualEligibleStaff || []);

        const eligible = staffList.filter(s => {
            // Filter by scope first
            if (filterScope === 'my_dept' && currentUser && s.departmentId !== currentUser.departmentId) {
                return false;
            }

            // Filter by name
            if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }

            // If "Show Off-Duty" is checked, allow ANYONE in scope
            if (includeOffDuty) return true;

            // Manual check (Always include if manually added)
            if (manualIds.has(s.id)) return true;

            // Roster check
            const deptRoster = rosters[monthKey]?.[s.departmentId];
            if (deptRoster) {
                const entry = deptRoster[menu.date]?.[s.id];
                if (entry && entry.dutyCodeId) {
                    const settings = departmentSettings[s.departmentId];
                    const code = settings?.shiftCodes.find((sc: any) => sc.id === entry.dutyCodeId);
                    return code && !code.isOffDuty;
                }
            }
            return false;
        });

        return eligible.sort((a, b) => a.name.localeCompare(b.name));

    }, [menu, staffList, rosters, departmentSettings, searchTerm, filterScope, currentUser, includeOffDuty]);

    const getOrder = (staffId: string) => orders.find(o => o.date === menu.date && o.staffId === staffId);

    const handleOptionSelect = (staffId: string, optionId: string) => {
        // Reset condiments when option changes
        onUpdateOrder(staffId, optionId, []);
    };

    const handleCondimentToggle = (staffId: string, currentOrder: LunchOrder | undefined, condiment: string) => {
        if (!currentOrder || !currentOrder.optionId) return;
        const currentCondiments = currentOrder.selectedCondiments || [];

        let newCondiments = [...currentCondiments];
        if (newCondiments.includes(condiment)) {
            newCondiments = newCondiments.filter(c => c !== condiment);
        } else {
            newCondiments.push(condiment);
        }

        onUpdateOrder(staffId, currentOrder.optionId, newCondiments);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-xl font-bold">Manage Orders</h2>
                        <p className="text-sm text-gray-500">{new Date(menu.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>

                <div className="flex flex-col gap-4 mb-4">
                    <div className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Search staff..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="flex-grow p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        />
                        <div className="flex rounded-md shadow-sm shrink-0" role="group">
                            <button
                                type="button"
                                onClick={() => setFilterScope('my_dept')}
                                className={`px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-600 rounded-l-lg ${filterScope === 'my_dept' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-white' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100'}`}
                            >
                                My Dept
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterScope('all')}
                                className={`px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-600 rounded-r-lg ${filterScope === 'all' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-white' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100'}`}
                            >
                                All Staff
                            </button>
                        </div>
                    </div>

                    <label className="flex items-center text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={includeOffDuty}
                            onChange={(e) => setIncludeOffDuty(e.target.checked)}
                            className="mr-2 h-4 w-4 text-brand-primary rounded focus:ring-brand-primary"
                        />
                        Show Off-Duty Staff (Include everyone in scope)
                    </label>
                </div>

                <div className="flex-grow overflow-y-auto border rounded-md dark:border-gray-700">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0 z-10">
                            <tr>
                                <th className="p-3 font-semibold">Staff Member</th>
                                <th className="p-3 font-semibold">Department</th>
                                <th className="p-3 font-semibold">Main Dish</th>
                                <th className="p-3 font-semibold">Sides & Extras</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {eligibleStaff.map(s => {
                                const order = getOrder(s.id);
                                const selectedOption = menu.options.find(o => o.id === order?.optionId);
                                const hasCondiments = selectedOption && selectedOption.availableCondiments && selectedOption.availableCondiments.length > 0;

                                return (
                                    <tr key={s.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="p-3 font-medium">{s.name}</td>
                                        <td className="p-3 text-gray-500">{s.departmentId.replace('dept_', '')}</td>
                                        <td className="p-3">
                                            <select
                                                value={order?.optionId || ''}
                                                onChange={(e) => handleOptionSelect(s.id, e.target.value)}
                                                className="p-1 border rounded w-full max-w-xs dark:bg-gray-700 dark:border-gray-600"
                                            >
                                                <option value="">-- Not Ordered --</option>
                                                {menu.options.map(opt => (
                                                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-3">
                                            {order?.optionId && hasCondiments ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedOption.availableCondiments!.map(c => (
                                                        <label key={c} className="flex items-center space-x-1 cursor-pointer bg-gray-50 dark:bg-gray-700 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600">
                                                            <input
                                                                type="checkbox"
                                                                checked={order.selectedCondiments?.includes(c) || false}
                                                                onChange={() => handleCondimentToggle(s.id, order, c)}
                                                                className="rounded text-brand-primary h-3 w-3"
                                                            />
                                                            <span className="text-xs">{c}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">
                                                    {order?.optionId ? 'No sides available' : 'Select a meal first'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {eligibleStaff.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-500">No eligible staff found matching filters.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 text-right text-sm text-gray-500">
                    Showing {eligibleStaff.length} eligible staff.
                </div>
            </div>
        </div>
    );
};

export default LunchOrderManager;
