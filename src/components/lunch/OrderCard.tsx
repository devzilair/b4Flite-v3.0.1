
import React, { useState, useEffect } from 'react';
import { LunchMenu, LunchOrder } from '@/types';

interface OrderCardProps {
    menu: LunchMenu;
    order?: LunchOrder;
    onSubmit: (menuDate: string, optionId: string, notes: string, condiments: string[]) => void;
    isCutoffPassed: boolean;
}

const OrderCard: React.FC<OrderCardProps> = ({ menu, order, onSubmit, isCutoffPassed }) => {
    const [selectedOption, setSelectedOption] = useState<string>(order?.optionId || '');
    const [notes, setNotes] = useState<string>(order?.notes || '');
    const [selectedCondiments, setSelectedCondiments] = useState<string[]>(order?.selectedCondiments || []);

    // Update local state if order prop changes
    useEffect(() => {
        if (order) {
            setSelectedOption(order.optionId);
            setNotes(order.notes || '');
            setSelectedCondiments(order.selectedCondiments || []);
        }
    }, [order]);

    const handleSubmit = () => {
        if (!selectedOption) return;
        onSubmit(menu.date, selectedOption, notes, selectedCondiments);
    };

    const toggleCondiment = (condiment: string) => {
        setSelectedCondiments(prev => {
            const exists = prev.includes(condiment);
            let newSet = exists ? prev.filter(c => c !== condiment) : [...prev, condiment];
            return newSet;
        });
    };

    const dateObj = new Date(menu.date);
    const dateDisplay = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const isLocked = isCutoffPassed;

    return (
        <div className={`p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col transition-all ${order ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-white dark:bg-gray-800'}`}>
            <div className="flex justify-between items-center mb-3">
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-base">{dateDisplay}</h3>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Order by {new Date(menu.cutoffTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                {isLocked ? (
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-[10px] font-bold uppercase tracking-wider">Locked</span>
                ) : (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold uppercase tracking-wider">Open</span>
                )}
            </div>

            <div className="space-y-2 flex-grow mb-4">
                {menu.options.map(opt => (
                    <div key={opt.id}>
                        <label
                            className={`flex items-start p-2.5 rounded border cursor-pointer transition-all ${selectedOption === opt.id
                                ? 'border-brand-primary bg-brand-light/20 ring-1 ring-brand-primary dark:bg-blue-900/30'
                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            <input
                                type="radio"
                                name={`menu-${menu.date}`}
                                value={opt.id}
                                checked={selectedOption === opt.id}
                                onChange={() => {
                                    if (!isLocked) {
                                        setSelectedOption(opt.id);
                                        // Reset condiments when switching dish to be safe
                                        setSelectedCondiments([]);
                                    }
                                }}
                                disabled={isLocked}
                                className="text-brand-primary focus:ring-brand-primary h-4 w-4 mt-0.5 flex-shrink-0"
                            />
                            <div className="ml-3 w-full min-w-0">
                                <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{opt.name}</span>
                                {opt.description && <span className="block text-xs text-gray-500 mt-0.5 leading-snug">{opt.description}</span>}
                            </div>
                        </label>

                        {/* Condiments Section - Only show if this option is selected */}
                        {selectedOption === opt.id && opt.availableCondiments && opt.availableCondiments.length > 0 && (
                            <div className="ml-8 mt-2 space-y-1 p-2 bg-gray-50 dark:bg-gray-700/50 rounded border-l-2 border-brand-primary">
                                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Sides / Condiments</p>
                                <div className="grid grid-cols-2 gap-1">
                                    {opt.availableCondiments.map(cond => (
                                        <label key={cond} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedCondiments.includes(cond)}
                                                onChange={() => !isLocked && toggleCondiment(cond)}
                                                disabled={isLocked}
                                                className="rounded text-brand-primary focus:ring-brand-primary h-3.5 w-3.5"
                                            />
                                            <span className="text-xs text-gray-700 dark:text-gray-300">{cond}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="mb-4">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Special Requests / Allergies</label>
                <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isLocked}
                    placeholder="e.g. No onions, Gluten free..."
                    className="w-full text-sm p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 disabled:bg-gray-100 disabled:text-gray-400 focus:ring-1 focus:ring-brand-primary outline-none"
                />
            </div>

            <div className="mt-auto pt-3 border-t dark:border-gray-600">
                {order ? (
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            <span className="text-xs font-bold">Order Confirmed</span>
                        </div>
                        {!isLocked && (
                            <button
                                onClick={handleSubmit}
                                disabled={selectedOption === order.optionId && notes === (order.notes || '') && JSON.stringify(selectedCondiments.sort()) === JSON.stringify(order.selectedCondiments?.sort())}
                                className="text-xs font-bold text-brand-primary hover:underline disabled:opacity-50 disabled:no-underline bg-transparent"
                            >
                                Update
                            </button>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={isLocked || !selectedOption}
                        className="w-full bg-brand-primary text-white py-2 rounded text-sm font-bold hover:bg-brand-secondary disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        {isLocked ? 'Ordering Closed' : 'Place Order'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default OrderCard;
