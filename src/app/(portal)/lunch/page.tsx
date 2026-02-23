'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { LunchMenu, LunchOption, LunchOrder, Staff } from '@/types';
import { sanitizeString, getErrorMessage } from '@/utils/sanitization';
import MenuImportModal from '@/components/lunch/MenuImportModal';
import { useLunch } from '@/hooks/useLunch';
import { useRoster } from '@/hooks/useRoster';
import { useStaff } from '@/hooks/useStaff';
import { useSettings } from '@/hooks/useSettings';
import OrderCard from '@/components/lunch/OrderCard';
import AdminMenuEditor from '@/components/lunch/AdminMenuEditor';
import LunchOrderManager from '@/components/lunch/LunchOrderManager';
import ReportView from '@/components/lunch/ReportView';
// --- MAIN PAGE ---

const LunchPage: React.FC = () => {
    const { staff, loading: staffLoading } = useStaff();

    // DECOUPLED LUNCH LOGIC
    const {
        lunchMenus,
        lunchOrders,
        upsertLunchMenu,
        deleteLunchMenu,
        upsertLunchOrder,
        loading: lunchLoading
    } = useLunch();

    const { rosters } = useRoster();
    const { departmentSettings } = useSettings();

    const loading = staffLoading || lunchLoading;

    const { currentUser, can } = usePermissions();

    const [isAdminMode, setIsAdminMode] = useState(false);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [managingMenu, setManagingMenu] = useState<LunchMenu | null>(null);
    const [historyMode, setHistoryMode] = useState<'upcoming' | 'past'>('upcoming');

    const canManage = can('lunch:manage') || can('admin:view_settings');
    const todayStr = new Date().toISOString().split('T')[0];

    // --- Staff View Logic ---
    const eligibleMenus = useMemo(() => {
        if (!currentUser || isAdminMode) return lunchMenus; // Admin sees all

        // Sort future menus first
        const sorted = [...lunchMenus].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return sorted.filter(menu => {
            // 1. Check manual eligibility first
            if (menu.manualEligibleStaff?.includes(currentUser.id)) return true;

            // 2. Check Roster
            const dateObj = new Date(menu.date);
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1;
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;

            // Safely access roster data
            const deptRoster = rosters[monthKey]?.[currentUser.departmentId];
            if (!deptRoster) return false; // No roster published for this month yet

            const dailyEntry = deptRoster[menu.date]?.[currentUser.id];
            if (!dailyEntry) return false; // No entry for this day

            // Check if entry implies "OFF"
            const settings = (departmentSettings as any)?.[currentUser.departmentId];
            if (!settings?.shiftCodes) return false;

            const dutyCode = settings.shiftCodes.find((sc: any) => sc.id === dailyEntry.dutyCodeId);
            if (!dutyCode) return true; // If code deleted but entry exists, assume working? Or assume OFF? Safe to show menu.

            // If isOffDuty is true, user is OFF. So return FALSE (not eligible).
            return !dutyCode.isOffDuty;
        });
    }, [lunchMenus, currentUser, rosters, departmentSettings, isAdminMode]);

    const adminViewMenus = useMemo(() => {
        if (!isAdminMode) return [];
        return lunchMenus.filter(m => {
            if (historyMode === 'upcoming') return m.date >= todayStr;
            return m.date < todayStr;
        }).sort((a, b) => {
            // Upcoming: ASC (soonest first)
            // Past: DESC (most recent first)
            if (historyMode === 'upcoming') return new Date(a.date).getTime() - new Date(b.date).getTime();
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    }, [lunchMenus, isAdminMode, historyMode, todayStr]);


    const handleOrderSubmit = async (menuDate: string, optionId: string, notes: string, condiments: string[]) => {
        if (!currentUser) return;
        try {
            await upsertLunchOrder({
                date: menuDate,
                staffId: currentUser.id,
                optionId,
                notes: sanitizeString(notes),
                selectedCondiments: condiments
            });
        } catch (error: any) {
            alert("Failed to save order: " + getErrorMessage(error));
        }
    };

    const handleManagerOrderUpdate = async (staffId: string, optionId: string, condiments: string[]) => {
        if (!managingMenu) return;
        try {
            await upsertLunchOrder({
                date: managingMenu.date,
                staffId,
                optionId,
                notes: '',
                selectedCondiments: condiments
            });
        } catch (error: any) {
            alert("Failed to update order: " + getErrorMessage(error));
        }
    };

    const handleDeleteMenu = async (date: string) => {
        if (window.confirm("Delete this menu? All orders associated with it will be lost.")) {
            try {
                await deleteLunchMenu(date);
            } catch (error: any) {
                alert(getErrorMessage(error));
            }
        }
    };

    const handleBatchImport = async (menus: LunchMenu[]) => {
        for (const menu of menus) {
            await upsertLunchMenu(menu);
        }
    };

    if (loading) return <div>Loading lunch menus...</div>;

    return (
        <div className="space-y-6 p-4 sm:p-0">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <span>🍽️</span> Lunch Menu
                </h1>

                {canManage && (
                    <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                        <button
                            onClick={() => setIsAdminMode(false)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${!isAdminMode ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >
                            My Orders
                        </button>
                        <button
                            onClick={() => setIsAdminMode(true)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${isAdminMode ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >
                            Admin
                        </button>
                    </div>
                )}
            </div>

            {isAdminMode ? (
                // ADMIN VIEW
                <div className="animate-fade-in space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div>
                                <h2 className="text-lg font-semibold">Menu Management</h2>
                                <p className="text-sm text-gray-500">Create menus for Sundays and Public Holidays.</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mr-4">
                                <button onClick={() => setHistoryMode('upcoming')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${historyMode === 'upcoming' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500'}`}>Upcoming</button>
                                <button onClick={() => setHistoryMode('past')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${historyMode === 'past' ? 'bg-white dark:bg-gray-600 shadow text-brand-primary' : 'text-gray-500'}`}>History</button>
                            </div>

                            <button onClick={() => setIsReportOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors shadow-sm text-sm font-bold">
                                View Reports
                            </button>
                            <button onClick={() => setIsImportOpen(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm text-sm font-bold flex items-center gap-2">
                                <span>✨</span> AI Import
                            </button>
                            <button onClick={() => setIsEditorOpen(true)} className="bg-brand-primary text-white px-4 py-2 rounded hover:bg-brand-secondary transition-colors shadow-sm text-sm font-bold">
                                + Create Menu
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {adminViewMenus.length === 0 ? (
                            <div className="col-span-full text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                                <p className="text-gray-500">No {historyMode} menus found.</p>
                            </div>
                        ) : (
                            adminViewMenus.map(menu => {
                                // Strictly count ROWS (people), not items
                                const orderCount = lunchOrders.filter(o => o.date === menu.date).length;
                                const isPast = menu.date < todayStr;
                                return (
                                    <div key={menu.date} className={`p-4 rounded-lg shadow border transition-all ${isPast ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 opacity-80' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-lg">{new Date(menu.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' })}</h3>
                                            <button onClick={() => handleDeleteMenu(menu.date)} className="text-gray-400 hover:text-red-600" title="Delete Menu">&times;</button>
                                        </div>

                                        <p className="text-xs text-gray-500 mb-3 font-mono">Cutoff: {new Date(menu.cutoffTime).toLocaleString()}</p>

                                        <div className="space-y-1 mb-4 border-l-2 border-gray-200 dark:border-gray-600 pl-2">
                                            {menu.options.map(opt => (
                                                <div key={opt.id} className="text-sm flex items-center text-gray-700 dark:text-gray-300">
                                                    {opt.name}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex justify-between items-center text-sm font-medium bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                            <div className="flex gap-2 items-center">
                                                <span>Orders:</span>
                                                <span className="text-brand-primary font-bold">{orderCount}</span>
                                            </div>
                                            <button onClick={() => setManagingMenu(menu)} className="text-blue-600 hover:underline text-xs font-bold">
                                                Manage Orders
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            ) : (
                // STAFF VIEW
                <div className="animate-fade-in">
                    {eligibleMenus.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                            <div className="text-6xl mb-4">🥗</div>
                            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200">No Lunches Scheduled</h3>
                            <p className="text-gray-500 mt-2 max-w-md mx-auto">
                                There are no upcoming lunch menus available for you. This usually means you are not rostered for duty on upcoming Sundays or Public Holidays.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {eligibleMenus.map(menu => {
                                const myOrder = lunchOrders.find(o => o.date === menu.date && o.staffId === currentUser?.id);
                                const isCutoff = new Date() > new Date(menu.cutoffTime);
                                return (
                                    <OrderCard
                                        key={menu.date}
                                        menu={menu}
                                        order={myOrder}
                                        onSubmit={handleOrderSubmit}
                                        isCutoffPassed={isCutoff}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {isEditorOpen && (
                <AdminMenuEditor
                    onClose={() => setIsEditorOpen(false)}
                    onSave={async (menu) => {
                        try {
                            await upsertLunchMenu(menu);
                            setIsEditorOpen(false);
                        } catch (e: any) { alert(getErrorMessage(e)); }
                    }}
                    staffList={staff}
                />
            )}

            {isImportOpen && (
                <MenuImportModal
                    isOpen={isImportOpen}
                    onClose={() => setIsImportOpen(false)}
                    onImport={handleBatchImport}
                />
            )}

            {isReportOpen && (
                <ReportView
                    menus={lunchMenus}
                    orders={lunchOrders}
                    staffList={staff}
                    onClose={() => setIsReportOpen(false)}
                />
            )}

            {managingMenu && (
                <LunchOrderManager
                    menu={managingMenu}
                    staffList={staff}
                    orders={lunchOrders}
                    rosters={rosters}
                    departmentSettings={departmentSettings}
                    currentUser={currentUser}
                    onClose={() => setManagingMenu(null)}
                    onUpdateOrder={handleManagerOrderUpdate}
                />
            )}
        </div>
    );
};

export default LunchPage;
