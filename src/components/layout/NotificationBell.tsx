
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useNotifications } from '../../contexts/NotificationsContext';
import { Notification } from '../../types';

const BellIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
);

const formatDistanceToNow = (isoDate: string): string => {
    try {
        const date = new Date(isoDate);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return "just now";
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m ago";
        return Math.floor(seconds) + "s ago";
    } catch (e) {
        return '...';
    }
};

const NotificationItem: React.FC<{ notification: Notification; onClick: () => void }> = ({ notification, onClick }) => {
    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'leave_request': return <span className="bg-yellow-100 text-yellow-600 p-1.5 rounded-full text-xs">✈️</span>;
            case 'fsi_document': return <span className="bg-blue-100 text-blue-600 p-1.5 rounded-full text-xs">📄</span>;
            default: return <span className="bg-gray-100 text-gray-600 p-1.5 rounded-full text-xs">ℹ️</span>;
        }
    };

    // SECURITY: Prevent Open Redirects. Ensure link is relative.
    const safeLink = notification.link && notification.link.startsWith('/')
        ? notification.link
        : '/';

    return (
        <Link
            href={safeLink}
            onClick={onClick}
            className={`block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0 ${!notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
        >
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                    {getIcon(notification.type)}
                </div>
                <div className="flex-grow min-w-0">
                    <p className={`text-sm ${!notification.isRead ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                        {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(notification.timestamp)}
                    </p>
                </div>
                {!notification.isRead && (
                    <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                )}
            </div>
        </Link>
    );
};


const NotificationBell: React.FC = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleNotificationClick = (notification: Notification) => {
        markAsRead(notification.id);
        setIsOpen(false);
    };

    const displayNotifications = useMemo(() => {
        if (filter === 'unread') return notifications.filter(n => !n.isRead);
        return notifications;
    }, [notifications, filter]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-full transition-colors ${isOpen ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                aria-label="Notifications"
            >
                <BellIcon />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in z-20">
                    <div className="p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex justify-between items-center">
                        <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            Notifications
                            {unreadCount > 0 && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{unreadCount} new</span>}
                        </h4>
                        <div className="flex gap-2 text-xs">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-2 py-1 rounded ${filter === 'all' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilter('unread')}
                                className={`px-2 py-1 rounded ${filter === 'unread' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Unread
                            </button>
                        </div>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto">
                        {displayNotifications.length > 0 ? (
                            displayNotifications.map(n => (
                                <NotificationItem key={n.id} notification={n} onClick={() => handleNotificationClick(n)} />
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
                                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
                                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                                </div>
                                <p className="text-sm">You're all caught up!</p>
                            </div>
                        )}
                    </div>

                    {unreadCount > 0 && (
                        <div className="p-2 bg-gray-50 dark:bg-gray-700/30 border-t dark:border-gray-700 text-center">
                            <button onClick={markAllAsRead} className="text-xs font-bold text-brand-primary hover:underline w-full py-1">
                                Mark all as read
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
