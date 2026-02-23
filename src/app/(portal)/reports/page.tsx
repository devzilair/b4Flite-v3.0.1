'use client';

import React, { useState, useMemo } from 'react';
import FlightHoursReport from '@/components/reports/FlightHoursReport';
import MonthlyActivityReport from '@/components/reports/MonthlyActivityReport';
import ComplianceExpiryReport from '@/components/reports/ComplianceExpiryReport';
import LeaveAnalysisReport from '@/components/reports/LeaveAnalysisReport';
import FatigueReport from '@/components/reports/FatigueReport';
import TrainingReport from '@/components/reports/TrainingReport';
import BirthdayReport from '@/components/reports/BirthdayReport';
import LeaveLiabilityReport from '@/components/reports/LeaveLiabilityReport';
import CrewUtilizationReport from '@/components/reports/CrewUtilizationReport';
import SafetyCultureReport from '@/components/reports/SafetyCultureReport';
import RosterFairnessReport from '@/components/reports/RosterFairnessReport';
import { usePermissions } from '@/hooks/usePermissions';

// --- Types & Config ---

type ReportId = 'monthly' | 'experience' | 'leave' | 'compliance' | 'fatigue' | 'training' | 'birthday' | 'liability' | 'utilization' | 'safety' | 'fairness';

interface ReportConfig {
    id: ReportId;
    title: string;
    description: string;
    category: 'Operations' | 'HR & Finance' | 'Safety & Training';
    icon: React.ReactNode;
    color: string;
    visibility: 'all' | 'manager'; // New visibility flag
    component: React.ComponentType;
}

const REPORT_CATALOG: ReportConfig[] = [
    {
        id: 'monthly',
        title: 'Monthly Activity',
        description: 'Duty, flight, and FDP hours summary. Useful for verifying payroll data.',
        category: 'Operations',
        color: 'bg-blue-500',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
        visibility: 'all',
        component: MonthlyActivityReport
    },
    {
        id: 'utilization',
        title: 'Crew Utilization',
        description: 'Efficiency analysis comparing Flight vs Duty hours to identify under/over-utilized pilots.',
        category: 'Operations',
        color: 'bg-cyan-500',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
        visibility: 'manager',
        component: CrewUtilizationReport
    },
    {
        id: 'experience',
        title: 'Flight Experience Ledger',
        description: 'Cumulative flight hours (Turbine, Multi-Engine) combining internal logs and adjustments.',
        category: 'Operations',
        color: 'bg-indigo-500',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
        visibility: 'all',
        component: FlightHoursReport
    },
    {
        id: 'fatigue',
        title: 'Fatigue & Violations Audit',
        description: 'Scan Flight Logs for FDP exceedances, minimum rest violations, and roster rule breaches.',
        category: 'Safety & Training',
        color: 'bg-orange-500',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
        visibility: 'manager',
        component: FatigueReport
    },
    {
        id: 'safety',
        title: 'Safety Culture',
        description: 'FSI compliance tracking. Identifies response times and laggards for safety notices.',
        category: 'Safety & Training',
        color: 'bg-yellow-500',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
        visibility: 'manager',
        component: SafetyCultureReport
    },
    {
        id: 'leave',
        title: 'Leave Analysis',
        description: 'Breakdown of leave usage, sick leave trends, and balance projections.',
        category: 'HR & Finance',
        color: 'bg-green-500',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
        visibility: 'all',
        component: LeaveAnalysisReport
    },
    {
        id: 'liability',
        title: 'Leave Liability',
        description: 'Financial exposure report showing total accrued leave days owed to staff.',
        category: 'HR & Finance',
        color: 'bg-red-500',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m.599-1c.51-.598.81-1.364.81-2.201 0-2.003-2.183-3.14-4.516-3.14S5.1 8.997 5.1 11c0 .837.3 1.603.81 2.201M15 11h.01M15 15h.01M15 19h.01M15 7h.01M15 3h.01" /></svg>,
        visibility: 'manager',
        component: LeaveLiabilityReport
    },
    {
        id: 'fairness',
        title: 'Lifestyle & Fairness Audit',
        description: 'Tracks unsocial hours (Weekends, PH, Late Nights) to ensure equitable rostering.',
        category: 'HR & Finance',
        color: 'bg-purple-600',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>,
        visibility: 'manager',
        component: RosterFairnessReport
    },
    {
        id: 'birthday',
        title: 'Staff Birthday List',
        description: 'Upcoming birthdays for all staff members, grouped by month.',
        category: 'HR & Finance',
        color: 'bg-pink-500',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" /></svg>,
        visibility: 'manager',
        component: BirthdayReport
    },
    {
        id: 'compliance',
        title: 'Compliance Horizon',
        description: 'Track expiring visas, passports, medicals, and licenses across the fleet.',
        category: 'Safety & Training',
        color: 'bg-red-500',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        visibility: 'manager',
        component: ComplianceExpiryReport
    },
    {
        id: 'training',
        title: 'Training Outcomes',
        description: 'Analyze exam pass rates and scores. (Self-view available for staff).',
        category: 'Safety & Training',
        color: 'bg-purple-500',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
        visibility: 'all',
        component: TrainingReport
    }
];

// --- Sub-Components ---

const ReportCard: React.FC<{ report: ReportConfig; onClick: () => void }> = ({ report, onClick }) => (
    <div
        onClick={onClick}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col h-full"
    >
        <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-lg text-white ${report.color} bg-opacity-90 shadow-md group-hover:scale-110 transition-transform`}>
                {report.icon}
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </div>
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{report.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed flex-grow">{report.description}</p>
        <div className="mt-4 pt-4 border-t dark:border-gray-700 flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{report.category}</span>
            <span className="text-xs font-bold text-brand-primary group-hover:underline">Open Report</span>
        </div>
    </div>
);

const ReportsPage: React.FC = () => {
    const { can, currentUser } = usePermissions();
    const [activeReportId, setActiveReportId] = useState<ReportId | null>(null);

    // Permission check for "Manager View"
    const isAdmin = can('admin:view_settings') || can('roster:view:all');
    const isManager = currentUser?.roleId === 'role_manager';
    const hasManagerAccess = isAdmin || isManager;

    // Filter available reports based on role
    const availableReports = useMemo(() => {
        return REPORT_CATALOG.filter(r => {
            if (r.visibility === 'all') return true;
            return hasManagerAccess;
        });
    }, [hasManagerAccess]);

    const activeReport = useMemo(() => availableReports.find(r => r.id === activeReportId), [activeReportId, availableReports]);

    const groupedReports = useMemo(() => {
        const groups: Record<string, ReportConfig[]> = {};
        availableReports.forEach(r => {
            if (!groups[r.category]) groups[r.category] = [];
            groups[r.category].push(r);
        });
        return groups;
    }, [availableReports]);

    // --- VIEW: REPORT DETAIL ---
    if (activeReport) {
        const ReportComponent = activeReport.component;
        return (
            <div className="flex flex-col h-full animate-fade-in">
                {/* Unified Header */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 print:hidden">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setActiveReportId(null)}
                            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-600 dark:text-gray-200 transition-colors"
                            title="Back to Library"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                {activeReport.title}
                            </h1>
                            <p className="text-sm text-gray-500">{activeReport.category}</p>
                        </div>
                    </div>

                    {/* Quick Switcher */}
                    <div className="relative">
                        <select
                            value={activeReportId || ''}
                            onChange={(e) => setActiveReportId(e.target.value as ReportId)}
                            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block w-full p-2.5"
                        >
                            {availableReports.map(r => (
                                <option key={r.id} value={r.id}>{r.title}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Actual Report Content */}
                <div className="flex-grow min-h-0">
                    <ReportComponent />
                </div>
            </div>
        );
    }

    // --- VIEW: REPORT LIBRARY (DASHBOARD) ---
    return (
        <div className="space-y-8 h-full animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Reports Center</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Select a report to generate insights and analytics.</p>
                </div>
            </div>

            <div className="space-y-8">
                {(Object.entries(groupedReports) as [string, ReportConfig[]][]).map(([category, reports]) => (
                    <div key={category}>
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                            {category}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {reports.map(report => (
                                <ReportCard
                                    key={report.id}
                                    report={report}
                                    onClick={() => setActiveReportId(report.id)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ReportsPage;
