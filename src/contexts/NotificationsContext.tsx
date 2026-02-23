import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Notification, ToastMessage } from '../types';
import { useAuth } from './AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import useLocalStorage from '../hooks/useLocalStorage';
import { useLunch } from '../hooks/useLunch';
import { useRoster } from '../hooks/useRoster';
import { useLeave } from '../hooks/useLeave';
import { useFsi } from '../hooks/useFsi';
import { useStaff } from '../hooks/useStaff';
import { useSettings } from '../hooks/useSettings';
import { useTraining } from '../hooks/useTraining';
import { emailService } from '../services/EmailService';

interface NotificationsContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;

    // Toast Interface
    toasts: ToastMessage[];
    addToast: (message: string, type?: ToastMessage['type'], duration?: number) => void;
    removeToast: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Shared storage for all users on this device
    const [allNotifications, setAllNotifications] = useLocalStorage<Notification[]>('notifications_v1', []);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const { staff, loading: staffLoading } = useStaff();
    const { departmentSettings, loading: settingsLoading } = useSettings();
    const { rosters, rosterMetadata } = useRoster();
    const { leaveRequests } = useLeave();
    const { fsiDocuments, fsiAcks } = useFsi();
    const { lunchMenus, lunchOrders } = useLunch();
    const { exams, examAttempts, loading: trainingLoading } = useTraining();

    const { user } = useAuth();
    const { can, currentUser } = usePermissions();
    const isManager = can('leave_planner:approve');

    const loading = staffLoading || settingsLoading || trainingLoading;

    // Helper to generate a stable key representing the state of inputs
    // This allows us to skip the heavy logic if nothing meaningful changed
    const changesKey = useMemo(() => {
        if (!currentUser) return '';
        return JSON.stringify({
            pendingLeaves: leaveRequests.filter(r => r.status === 'pending').map(r => r.id),
            fsiCount: fsiDocuments.length,
            ackCount: fsiAcks.length,
            menuCount: lunchMenus.length,
            orderCount: lunchOrders.length,
            examAttemptsCount: examAttempts.length
        });
    }, [currentUser, leaveRequests, fsiDocuments, fsiAcks, lunchMenus, lunchOrders, examAttempts]);

    // 1. Generation Logic (Runs on data updates)
    useEffect(() => {
        if (loading || !user || !currentUser) return;

        setAllNotifications(prevNotifications => {
            const newNotifications: Notification[] = [];

            // FILTER: Only check duplicates against THIS user's history
            const userExistingNotifications = prevNotifications.filter(n => n.userId === currentUser.id);
            const existingSourceIds = new Set(userExistingNotifications.map(n => n.sourceId));

            // A. Notifications for pending leave requests (for managers)
            if (isManager) {
                const pendingRequests = leaveRequests.filter(r =>
                    r.status === 'pending' &&
                    staff.find(s => s.id === r.staffId)?.departmentId === currentUser.departmentId
                );

                pendingRequests.forEach(req => {
                    const sourceId = `leave-${req.id}`;
                    if (!existingSourceIds.has(sourceId)) {
                        const staffMember = staff.find(s => s.id === req.staffId);

                        let originTimestamp = new Date().toISOString();
                        if (req.id.startsWith('lr_')) {
                            const parts = req.id.split('_');
                            if (parts[1]) {
                                const ts = parseInt(parts[1]);
                                if (!isNaN(ts) && ts > 0) {
                                    originTimestamp = new Date(ts).toISOString();
                                }
                            }
                        }

                        newNotifications.push({
                            id: `notif-${sourceId}-${Date.now()}`,
                            userId: currentUser.id,
                            sourceId: sourceId,
                            message: `${staffMember?.name || 'A team member'} has requested leave.`,
                            type: 'leave_request',
                            link: '/leave',
                            timestamp: originTimestamp,
                            isRead: false,
                        });

                        // 📧 MOCK EMAIL: Leave Requested
                        const deptId = staffMember?.departmentId;
                        const deptEmailSettings = deptId ? (departmentSettings as any)?.[deptId]?.emailSettings : null;
                        if (deptEmailSettings?.onLeaveRequest) {
                            const recipients = emailService.resolveRecipients('onLeaveRequest', deptEmailSettings, [`${staffMember?.departmentId} Managers`]);
                            const content = emailService.formatContent('Leave Requested', {
                                staffName: staffMember?.name || 'A staff member',
                                dates: `${req.startDate} to ${req.endDate}`
                            });
                            emailService.sendMockEmail({
                                event: 'Leave Requested',
                                to: recipients,
                                subject: content.subject,
                                body: content.body
                            });
                        }
                    }
                });
            }

            // B. Notifications for unacknowledged FSI documents (for all staff)
            const myAcks = new Set(fsiAcks.filter(ack => ack.staffId === currentUser.id).map(ack => ack.documentId));

            const relevantDocs = fsiDocuments.filter(doc => {
                if (doc.status !== 'published') return false;
                if (myAcks.has(doc.id)) return false;

                // Global doc
                if (!doc.departmentId) return true;

                // Department doc
                if (doc.departmentId !== currentUser.departmentId) return false;

                // Specifically assigned
                if (Array.isArray(doc.assignedTo) && !doc.assignedTo.includes(currentUser.id)) return false;

                return true;
            });

            relevantDocs.forEach(doc => {
                const sourceId = `fsi-${doc.id}-r${doc.revision || 1}`;

                if (!existingSourceIds.has(sourceId)) {
                    newNotifications.push({
                        id: `notif-${sourceId}-${Date.now()}`,
                        userId: currentUser.id,
                        sourceId: sourceId,
                        message: `New Notice: "${doc.title}" requires your attention.`,
                        type: 'fsi_document',
                        link: `/fsi/${doc.id}`,
                        timestamp: doc.issueDate,
                        isRead: false,
                    });

                    // 📧 MOCK EMAIL: FSI Published
                    const deptEmailSettings = doc.departmentId ? (departmentSettings as any)?.[doc.departmentId]?.emailSettings : null;
                    if (deptEmailSettings?.onFsiPublish || (!doc.departmentId && (departmentSettings as any)?.all?.emailSettings?.onFsiPublish)) {
                        const settings = doc.departmentId ? deptEmailSettings : (departmentSettings as any)?.all?.emailSettings;
                        const recipients = emailService.resolveRecipients('onFsiPublish', settings, [currentUser.email || 'Assigned Staff']);
                        const content = emailService.formatContent('New FSI/Notice Published', {
                            title: doc.title
                        });
                        emailService.sendMockEmail({
                            event: 'FSI Published',
                            to: recipients,
                            subject: content.subject,
                            body: content.body
                        });
                    }
                }
            });

            // C. Notifications for Lunch Menus (Eligible Staff Only)
            const todayStr = new Date().toISOString().split('T')[0];

            lunchMenus.forEach(menu => {
                // Only future menus
                if (menu.date < todayStr) return;

                // Check if cutoff passed
                if (new Date() > new Date(menu.cutoffTime)) return;

                // Check if already ordered
                const hasOrdered = lunchOrders.some(o => o.date === menu.date && o.staffId === currentUser.id);
                if (hasOrdered) return;

                const sourceId = `lunch-${menu.date}`;
                if (existingSourceIds.has(sourceId)) return;

                // Check Eligibility
                let isEligible = false;

                // 3a. Manual Guest List
                if (menu.manualEligibleStaff?.includes(currentUser.id)) {
                    isEligible = true;
                }
                // 3b. Roster Check
                else {
                    const dateObj = new Date(menu.date);
                    const year = dateObj.getFullYear();
                    const month = dateObj.getMonth() + 1;
                    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

                    // Safe access to rosters
                    const deptRoster = rosters?.[monthKey]?.[currentUser.departmentId];
                    if (deptRoster) {
                        const entry = deptRoster[menu.date]?.[currentUser.id];
                        if (entry && entry.dutyCodeId) {
                            const settings = (departmentSettings as any)?.[currentUser.departmentId];
                            const code = settings?.shiftCodes.find((sc: any) => sc.id === entry.dutyCodeId);
                            // Eligible if code exists and is NOT off-duty
                            if (code && !code.isOffDuty) {
                                isEligible = true;
                            }
                        }
                    }
                }

                if (isEligible) {
                    newNotifications.push({
                        id: `notif-${sourceId}-${Date.now()}`,
                        userId: currentUser.id,
                        sourceId: sourceId,
                        message: `Lunch menu open for ${new Date(menu.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}. Please order.`,
                        type: 'info',
                        link: '/lunch',
                        timestamp: new Date().toISOString(),
                        isRead: false
                    });
                }
            });

            // D. Notifications for Exam Completions (Managers)
            if (can('exams:manage:own_department') || can('exams:manage')) {
                const recentAttempts = examAttempts.filter(att => {
                    // Only care about recent attempts (last 7 days) to avoid historical spam
                    const daysOld = (Date.now() - new Date(att.completedAt).getTime()) / (1000 * 3600 * 24);
                    if (daysOld > 7) return false;

                    const attStaff = staff.find(s => s.id === att.staffId);
                    if (!attStaff) return false;

                    // Global admin sees all. Dept admin sees their own department.
                    if (can('exams:manage') || attStaff.departmentId === currentUser.departmentId) {
                        return true;
                    }
                    return false;
                });

                recentAttempts.forEach(att => {
                    // Safe source ID since attempt ID might be generated client-side early on
                    const sourceId = `exam-attempt-${att.id || (att.completedAt + att.staffId)}`;
                    if (!existingSourceIds.has(sourceId)) {
                        const attStaff = staff.find(s => s.id === att.staffId);
                        const exam = exams.find(e => e.id === att.examId);

                        newNotifications.push({
                            id: `notif-${sourceId}-${Date.now()}`,
                            userId: currentUser.id,
                            sourceId: sourceId,
                            message: `${attStaff?.name || 'A staff member'} has completed the exam: "${exam?.title || 'Unknown Exam'}". Score: ${Math.round(att.score)}%.`,
                            type: 'info',
                            link: '/exams',
                            timestamp: att.completedAt,
                            isRead: false
                        });

                        // --- MOCK EMAIL LOGIC ---
                        const deptId = attStaff?.departmentId;
                        const deptEmailSettings = deptId ? (departmentSettings as any)?.[deptId]?.emailSettings : null;

                        if (deptEmailSettings?.onExamCompletion) {
                            const recipients = emailService.resolveRecipients('onExamCompletion', deptEmailSettings, [`${deptId} Managers`]);
                            const content = emailService.formatContent('Exam Completed', {
                                staffName: attStaff?.name || 'A staff member',
                                examTitle: exam?.title || 'Unknown Exam',
                                score: Math.round(att.score)
                            });
                            emailService.sendMockEmail({
                                event: 'Exam Completed',
                                to: recipients,
                                subject: content.subject,
                                body: content.body
                            });
                        }

                        // 📧 MOCK EMAIL: Exam Failed
                        if (deptEmailSettings?.onExamFail && Math.round(att.score) < (exam?.passMarkPercentage || 80)) {
                            const recipients = emailService.resolveRecipients('onExamFail', deptEmailSettings, [`${deptId} Managers`]);
                            const content = emailService.formatContent('Exam Failed', {
                                staffName: attStaff?.name || 'A staff member',
                                examTitle: exam?.title || 'Unknown Exam',
                                score: Math.round(att.score)
                            });
                            emailService.sendMockEmail({
                                event: 'Exam Failed',
                                to: recipients,
                                subject: content.subject,
                                body: content.body
                            });
                        }
                    }
                });
            }

            // E. Document Expiry Warnings
            const checkExpiry = (s: typeof staff[0], isSelf: boolean) => {
                if (!s.documents) return;
                const now = new Date();

                s.documents.forEach(doc => {
                    if (!doc.expiryDate) return;
                    const expiry = new Date(doc.expiryDate);
                    const diffTime = expiry.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    let status = '';
                    if (diffDays < 0) status = 'EXPIRED';
                    else if (diffDays <= 30) status = 'Expiring in <30 days';
                    else if (diffDays <= 60) status = 'Expiring in <60 days';

                    if (status) {
                        const statusKey = diffDays < 0 ? 'expired' : 'expiring';
                        const sourceId = `doc-expiry-${doc.id}-${statusKey}`;

                        if (!existingSourceIds.has(sourceId)) {
                            let msg = '';
                            if (isSelf) msg = `Your document "${doc.name}" is ${status}.`;
                            else msg = `${s.name}'s document "${doc.name}" is ${status}.`;

                            newNotifications.push({
                                id: `notif-${sourceId}-${Date.now()}`,
                                userId: currentUser.id,
                                sourceId: sourceId,
                                message: msg,
                                type: 'info',
                                link: `/staff/${s.id}`, // Link to profile
                                timestamp: new Date().toISOString(),
                                isRead: false
                            });

                            // 📧 MOCK EMAIL: Document Expiry
                            const deptId = s.departmentId;
                            const deptEmailSettings = deptId ? (departmentSettings as any)?.[deptId]?.emailSettings : null;
                            if (deptEmailSettings?.onDocumentExpiry) {
                                const recipients = emailService.resolveRecipients('onDocumentExpiry', deptEmailSettings, [isSelf ? currentUser.email || 'Staff' : `${deptId} Managers`]);
                                const content = emailService.formatContent('Document Expiry Alert', {
                                    staffName: s.name,
                                    docName: doc.name,
                                    expiryStatus: status,
                                    expiryDate: doc.expiryDate
                                });
                                emailService.sendMockEmail({
                                    event: 'Document Expiry Alert',
                                    to: recipients,
                                    subject: content.subject,
                                    body: content.body
                                });
                            }
                        }
                    }
                });
            };

            checkExpiry(currentUser, true);

            if (can('staff:view:own_department')) {
                const deptStaff = staff.filter(s => s.departmentId === currentUser.departmentId && s.id !== currentUser.id && s.accountStatus === 'active');
                deptStaff.forEach(s => checkExpiry(s, false));
            }

            // --- SECTION F: Roster Publication ---
            Object.entries(rosterMetadata).forEach(([key, meta]) => {
                const [deptId, monthKey] = key.split('_');
                const isMyDept = currentUser.departmentId === deptId;

                if (meta.status === 'published' && (isMyDept || currentUser.role === 'admin')) {
                    const sourceId = `roster-pub-${key}`;
                    if (!existingSourceIds.has(sourceId)) {
                        newNotifications.push({
                            id: `notif-${sourceId}-${Date.now()}`,
                            userId: currentUser.id,
                            sourceId: sourceId,
                            message: `Roster Published: ${monthKey} is now available.`,
                            type: 'roster_publish',
                            link: '/roster',
                            timestamp: meta.lastUpdated || new Date().toISOString(),
                            isRead: false
                        });

                        // 📧 MOCK EMAIL: Roster Published
                        const deptEmailSettings = (departmentSettings as any)?.[deptId]?.emailSettings;
                        if (isMyDept && deptEmailSettings?.onRosterPublish) {
                            const recipients = emailService.resolveRecipients('onRosterPublish', deptEmailSettings, [currentUser.email || 'Staff Members']);
                            const content = emailService.formatContent('Roster Published', {
                                month: monthKey
                            });
                            emailService.sendMockEmail({
                                event: 'Roster Published',
                                to: recipients,
                                subject: content.subject,
                                body: content.body
                            });
                        }
                    }
                }
            });

            // --- SECTION G: Leave Status Updates (for self) ---
            leaveRequests.forEach(req => {
                if (req.staffId === currentUser.id && (req.status === 'approved' || req.status === 'denied')) {
                    const sourceId = `leave-status-${req.id}-${req.status}`;
                    if (!existingSourceIds.has(sourceId)) {
                        newNotifications.push({
                            id: `notif-${sourceId}-${Date.now()}`,
                            userId: currentUser.id,
                            sourceId: sourceId,
                            message: `Leave Status Update: Your request for ${req.startDate} has been ${req.status}.`,
                            type: 'leave_approve',
                            link: '/leave',
                            timestamp: new Date().toISOString(),
                            isRead: false
                        });

                        // 📧 MOCK EMAIL: Leave Status Update
                        const deptId = currentUser.departmentId;
                        const deptEmailSettings = deptId ? (departmentSettings as any)?.[deptId]?.emailSettings : null;
                        if (deptEmailSettings?.onLeaveApproval) {
                            const recipients = emailService.resolveRecipients('onLeaveApproval', deptEmailSettings, [currentUser.email || 'Staff Member']);
                            const content = emailService.formatContent('Leave Status Update', {
                                dates: `${req.startDate} to ${req.endDate}`,
                                status: req.status
                            });
                            emailService.sendMockEmail({
                                event: 'Leave Status Update',
                                to: recipients,
                                subject: content.subject,
                                body: content.body
                            });
                        }
                    }
                }
            });

            if (newNotifications.length === 0) {
                return prevNotifications;
            }

            const combined = [...prevNotifications, ...newNotifications];
            combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            return combined.slice(0, 200);
        });

    }, [changesKey, loading, user, isManager, currentUser, staff, rosters, departmentSettings, setAllNotifications]); // Using changesKey as dependency instead of raw data arrays

    // 2. View Logic (Filter for Current User)
    const userNotifications = useMemo(() => {
        if (!currentUser) return [];
        return allNotifications.filter(n => n.userId === currentUser.id);
    }, [allNotifications, currentUser]);

    const unreadCount = userNotifications.filter(n => !n.isRead).length;

    // 3. Action Logic
    const markAsRead = useCallback((id: string) => {
        setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    }, [setAllNotifications]);

    const markAllAsRead = useCallback(() => {
        if (!currentUser) return;
        setAllNotifications(prev => prev.map(n => {
            if (n.userId === currentUser.id && !n.isRead) {
                return { ...n, isRead: true };
            }
            return n;
        }));
    }, [setAllNotifications, currentUser]);

    // --- TOAST LOGIC ---
    const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info', duration: number = 3000) => {
        const id = `toast_${Date.now()}`;
        setToasts(prev => [...prev, { id, message, type, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const value = {
        notifications: userNotifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        toasts,
        addToast,
        removeToast
    };

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = () => {
    const context = useContext(NotificationsContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationsProvider');
    }
    return context;
};
