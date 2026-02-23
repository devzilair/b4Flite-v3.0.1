
'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { useStaff } from '@/hooks/useStaff';

const Widget: React.FC<{ title: string; count: number; items: any[]; type: 'warning' | 'info'; onItemClick: (id: string) => void }> = ({ title, count, items, type, onItemClick }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border-t-4 border-brand-primary">
        <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-gray-700 dark:text-gray-200">{title}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${type === 'warning' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                {count}
            </span>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-2 mt-4">
            {items.length > 0 ? (
                items.map((item, idx) => (
                    <div
                        key={idx}
                        onClick={() => onItemClick(item.id)}
                        className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-700/50 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <span className="font-medium truncate mr-2">{item.name}</span>
                        <span className={`text-xs ${item.isCritical ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                            {item.detail}
                        </span>
                    </div>
                ))
            ) : (
                <p className="text-sm text-gray-500 italic">No items to display.</p>
            )}
        </div>
    </div>
);

const HRDashboardPage: React.FC = () => {
    const { staff, loading } = useStaff();
    const { currentUser, can } = usePermissions();
    const router = useRouter();

    // Use RBAC permissions instead of hardcoded role checks
    const hasHrAccess = can('admin:edit_hr_settings') || currentUser?.hasHrRights;

    const stats = useMemo(() => {
        const now = new Date();
        const ninetyDaysFromNow = new Date();
        ninetyDaysFromNow.setDate(now.getDate() + 90);

        const expiringVisas: any[] = [];
        const expiringPassports: any[] = [];
        const probationEnding: any[] = [];
        const contractRenewals: any[] = [];

        staff.forEach(s => {
            if (s.accountStatus === 'disabled') return;
            if (!s.hrData) return;

            // Check Visa - Safe Access with Optional Chaining
            if (s.hrData.immigration?.visaExpiry) {
                const expiry = new Date(s.hrData.immigration.visaExpiry);
                if (expiry > now && expiry <= ninetyDaysFromNow) {
                    expiringVisas.push({
                        id: s.id,
                        name: s.name,
                        detail: expiry.toLocaleDateString(),
                        isCritical: (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) < 30
                    });
                }
            }

            // Check Passport - Safe Access with Optional Chaining
            if (s.hrData.immigration?.passportExpiry) {
                const expiry = new Date(s.hrData.immigration.passportExpiry);
                if (expiry > now && expiry <= ninetyDaysFromNow) {
                    expiringPassports.push({
                        id: s.id,
                        name: s.name,
                        detail: expiry.toLocaleDateString(),
                        isCritical: (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) < 30
                    });
                }
            }

            // Check Contract/Probation - Safe Access with Optional Chaining
            // Assuming probation is handled manually by checking start date + 3/6 months, or end date if type is probation
            if (s.hrData.contract?.type === 'probation' || (s.hrData.contract?.endDate)) {
                if (s.hrData.contract.endDate) {
                    const end = new Date(s.hrData.contract.endDate);
                    if (end > now && end <= ninetyDaysFromNow) {
                        if (s.hrData.contract.type === 'probation') {
                            probationEnding.push({ id: s.id, name: s.name, detail: end.toLocaleDateString() });
                        } else {
                            contractRenewals.push({ id: s.id, name: s.name, detail: end.toLocaleDateString() });
                        }
                    }
                }
            }
        });

        return { expiringVisas, expiringPassports, probationEnding, contractRenewals };
    }, [staff]);

    const activeStaffCount = useMemo(() => staff.filter(s => s.accountStatus !== 'disabled').length, [staff]);

    if (loading) return <div>Loading HR Data...</div>;

    if (!hasHrAccess) {
        return (
            <div className="text-center p-8">
                <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
                <p>You do not have permission to view the HR Dashboard.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">HR Dashboard</h1>
                <div className="text-sm text-gray-500">
                    Active Headcount: <span className="font-bold text-gray-800 dark:text-gray-200">{activeStaffCount}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Widget
                    title="Expiring Visas (90 Days)"
                    count={stats.expiringVisas.length}
                    items={stats.expiringVisas}
                    type="warning"
                    onItemClick={(id) => router.push(`/staff/${id}`)}
                />
                <Widget
                    title="Expiring Passports (90 Days)"
                    count={stats.expiringPassports.length}
                    items={stats.expiringPassports}
                    type="warning"
                    onItemClick={(id) => router.push(`/staff/${id}`)}
                />
                <Widget
                    title="Contract Renewals (90 Days)"
                    count={stats.contractRenewals.length}
                    items={stats.contractRenewals}
                    type="info"
                    onItemClick={(id) => router.push(`/staff/${id}`)}
                />
                <Widget
                    title="Probation Ending (90 Days)"
                    count={stats.probationEnding.length}
                    items={stats.probationEnding}
                    type="info"
                    onItemClick={(id) => router.push(`/staff/${id}`)}
                />
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">Quick Actions</h3>
                <div className="flex gap-4">
                    <button onClick={() => router.push('/staff/new')} className="bg-white dark:bg-gray-800 text-blue-600 px-4 py-2 rounded border border-blue-200 dark:border-blue-700 hover:shadow-md transition-all">
                        + Onboard New Staff
                    </button>
                    <button onClick={() => router.push('/staff')} className="bg-white dark:bg-gray-800 text-blue-600 px-4 py-2 rounded border border-blue-200 dark:border-blue-700 hover:shadow-md transition-all">
                        View Employee Directory
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HRDashboardPage;
