
import React, { useState, useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { useStaff } from '../../hooks/useStaff';
import { EmailSettings, DepartmentSettings } from '../../types';
import { emailService } from '../../services/EmailService';

interface EmailSettingsTabProps {
    selectedDepartmentId: string;
}

const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
    onExamCompletion: false,
    onExamFail: false,
    onRosterPublish: false,
    onLeaveRequest: false,
    onLeaveApproval: false,
    onDocumentExpiry: false,
    onFsiPublish: false,
    recipientOverrides: {},
};

interface EventConfig {
    key: keyof Omit<EmailSettings, 'recipientOverrides'>;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
}

const EVENT_CONFIGS: EventConfig[] = [
    {
        key: 'onExamCompletion',
        label: 'Exam Completed',
        description: 'Notify managers when a staff member passes a training exam.',
        color: 'purple',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
        key: 'onExamFail',
        label: 'Exam Failed',
        description: 'Alert managers when a staff member fails a required exam.',
        color: 'red',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
        key: 'onRosterPublish',
        label: 'Roster Published',
        description: 'Send roster links to all staff when a new month is published.',
        color: 'blue',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    },
    {
        key: 'onLeaveRequest',
        label: 'Leave Requested',
        description: 'Notify managers immediately when a new leave request is submitted.',
        color: 'orange',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
        key: 'onLeaveApproval',
        label: 'Leave Approved / Denied',
        description: 'Notify the staff member when their leave request status changes.',
        color: 'green',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 00-2-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    },
    {
        key: 'onDocumentExpiry',
        label: 'Document / Qualification Expiry',
        description: 'Send a reminder when a staff qualification is approaching its expiry date.',
        color: 'yellow',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    },
    {
        key: 'onFsiPublish',
        label: 'FSI / Notice Published',
        description: 'Notify assigned staff when a new Flight Safety Instruction is published.',
        color: 'teal',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
];

const COLOR_MAP: Record<string, string> = {
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600',
    teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600',
};

const Toggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-light/20 dark:peer-focus:ring-brand-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-primary"></div>
    </label>
);

const EmailSettingsTab: React.FC<EmailSettingsTabProps> = ({ selectedDepartmentId }) => {
    const { departmentSettings, updateDepartmentSettings, loading } = useSettings();
    const { departments, addDepartment } = useStaff();
    const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
    const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
    const [recipientInput, setRecipientInput] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        if (!selectedDepartmentId) return;

        const current = departmentSettings[selectedDepartmentId]?.emailSettings;
        if (current) {
            setEmailSettings({ ...DEFAULT_EMAIL_SETTINGS, ...current });
            // Init recipient input fields from saved overrides
            const inputs: Record<string, string> = {};
            Object.entries(current.recipientOverrides || {}).forEach(([k, v]) => {
                inputs[k] = v.join(', ');
            });
            setRecipientInput(inputs);
        } else {
            setEmailSettings(DEFAULT_EMAIL_SETTINGS);
            setRecipientInput({});
        }
    }, [selectedDepartmentId, departmentSettings]);

    const handleToggle = (key: keyof Omit<EmailSettings, 'recipientOverrides'>) => {
        setEmailSettings(prev => ({ ...prev, [key]: !prev[key] }));
        setSaveSuccess(false);
    };

    const handleRecipientChange = (key: string, value: string) => {
        setRecipientInput(prev => ({ ...prev, [key]: value }));
        setSaveSuccess(false);
    };

    const handleTestMockEmail = (eventLabel: string, eventKey: string) => {
        const recipients = emailService.resolveRecipients(
            eventKey as any,
            emailSettings,
            [selectedDepartmentId === 'all' ? 'System Administrators' : 'Department Managers']
        );

        const content = emailService.formatContent(eventLabel, {
            staffName: 'Test User',
            examTitle: 'Safety Induction 2026',
            score: 95,
            dates: 'Dec 1-5',
            status: 'Approved',
            month: 'January 2026',
            docName: 'Class 1 Medical',
            expiryStatus: 'expiring soon',
            expiryDate: '2026-03-31',
            title: 'Refueling Safety Update'
        });

        emailService.sendMockEmail({
            event: eventLabel,
            to: recipients,
            subject: content.subject,
            body: content.body
        });
    };

    const handleSave = async () => {
        if (!selectedDepartmentId) return;
        setIsSaving(true);
        try {
            if (selectedDepartmentId === 'all') {
                const globalDeptExists = departments.find(d => d.id === 'all');
                if (!globalDeptExists) {
                    await addDepartment({ id: 'all', name: 'System-Wide (All Departments)' } as any);
                }
            }

            const overrides: Record<string, string[]> = {};
            Object.entries(recipientInput).forEach(([k, v]) => {
                const emails = v.split(',').map(e => e.trim()).filter(e => e.includes('@'));
                if (emails.length > 0) overrides[k] = emails;
            });
            const settingsToSave: EmailSettings = { ...emailSettings, recipientOverrides: overrides };

            // Get existing or provide minimal defaults if creating a new entry (like 'all')
            const existing = departmentSettings[selectedDepartmentId] || {
                rosterSettings: {
                    columnWidth: { value: 50, unit: 'px' },
                    rowHeight: { value: 3, unit: 'ch' },
                    showSubDepartment: true,
                    weekendHighlightColor: '#fffde7',
                    rosterGroups: [],
                    groupHeaderWidth: { value: 120, unit: 'px' },
                    staffMemberColWidth: { value: 200, unit: 'px' }
                },
                shiftCodes: [],
                leaveAccrualPolicies: []
            };

            const updatedSettings: DepartmentSettings = {
                ...existing,
                emailSettings: settingsToSave,
            };
            await updateDepartmentSettings(updatedSettings, selectedDepartmentId);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to save email settings", error);
            alert("Failed to save settings. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading && !selectedDepartmentId) {
        return <div className="p-8 text-center text-gray-500 font-medium">Loading settings...</div>;
    }
    if (!selectedDepartmentId) {
        return (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center space-y-4">
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
                <p className="italic font-medium">Please select a department from the sidebar to configure granular email settings.</p>
            </div>
        );
    }

    const enabledCount = EVENT_CONFIGS.filter(e => emailSettings[e.key]).length;

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">Email Alert Configuration</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Select which events trigger automated notifications for this department.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-black rounded-full border border-amber-200 dark:border-amber-800 uppercase tracking-widest shadow-sm">
                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                            Mock Mode Active
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{enabledCount} events active</span>
                    </div>
                </div>
            </div>

            {/* Event List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                {EVENT_CONFIGS.map(event => {
                    const isEnabled = emailSettings[event.key] as boolean;
                    const isExpanded = expandedEvent === event.key;
                    const overrideValue = recipientInput[event.key] || '';

                    return (
                        <div key={event.key} className={`border-b last:border-0 border-gray-100 dark:border-gray-700 transition-colors ${isExpanded ? 'bg-gray-50/50 dark:bg-gray-700/10' : ''}`}>
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex gap-4 flex-1 min-w-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${COLOR_MAP[event.color]}`}>
                                        {event.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                                                {event.label}
                                            </h4>
                                            {overrideValue && (
                                                <span className="text-[9px] bg-brand-primary text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest shadow-sm">
                                                    Custom Recipients
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{event.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedEvent(isExpanded ? null : event.key)}
                                        className={`text-xs font-bold transition-all px-3 py-1.5 rounded-lg border ${isExpanded
                                            ? 'bg-brand-primary text-white border-brand-primary'
                                            : 'text-gray-500 border-gray-200 dark:border-gray-600 hover:border-brand-primary hover:text-brand-primary'
                                            }`}
                                    >
                                        {isExpanded ? 'Close Settings' : 'Recipients'}
                                    </button>
                                    <Toggle checked={isEnabled} onChange={() => handleToggle(event.key)} />
                                </div>
                            </div>

                            {/* Expandable Recipient Section */}
                            {isExpanded && (
                                <div className="px-6 pb-6 pt-2 animate-fade-in">
                                    <div className="bg-white dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 tracking-widest">
                                                    Notification Override List
                                                </label>
                                                <input
                                                    type="text"
                                                    value={overrideValue}
                                                    onChange={e => handleRecipientChange(event.key, e.target.value)}
                                                    placeholder="Separate multiple emails with commas..."
                                                    className="w-full px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white focus:ring-1 focus:ring-brand-primary focus:outline-none transition-all"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleTestMockEmail(event.label, event.key)}
                                                className="ml-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-brand-primary hover:text-white text-gray-600 dark:text-gray-300 rounded-lg text-xs font-bold transition-all flex items-center gap-2 group"
                                            >
                                                <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                Send Test Mock
                                            </button>
                                        </div>
                                        <div className="flex gap-2 items-start opacity-75">
                                            <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" /></svg>
                                            <p className="text-[10px] text-gray-500 leading-relaxed">
                                                If empty, notifications default to {selectedDepartmentId === 'all' ? 'System Administrators' : 'Department Managers'}.
                                                Test mock will output payload details to browser console.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-end pt-2">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold shadow-sm transition-all ${saveSuccess
                        ? 'bg-green-500 text-white'
                        : 'bg-brand-primary text-white hover:bg-brand-secondary active:scale-95 disabled:opacity-50'
                        }`}
                >
                    {isSaving ? (
                        <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Saving...
                        </>
                    ) : saveSuccess ? (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Settings Saved
                        </>
                    ) : 'Save Configuration'}
                </button>
            </div>
        </div>
    );
};

export default EmailSettingsTab;
