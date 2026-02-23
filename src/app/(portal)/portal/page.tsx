'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { useStaff } from '@/hooks/useStaff';
import { formatStaffName } from '@/utils/sanitization';
import {
  Calendar,
  Users,
  ClipboardList,
  Plane,
  CalendarCheck,
  Wallet,
  Utensils,
  FileText,
  GraduationCap,
  FileSearch,
  Clock,
  BarChart3,
  Settings,
  AlertTriangle,
  ChevronRight,
  Sparkles
} from 'lucide-react';

const DashboardPage: React.FC = () => {
  const { can, currentUser, userRole } = usePermissions();
  const { staff } = useStaff();

  const hasHrAccess = userRole?.id === 'role_super_admin' || userRole?.id === 'role_admin' || currentUser?.hasHrRights;

  // Calculate Expiry Warnings
  const expiryWarnings = useMemo(() => {
    if (!currentUser || !staff) return [];

    const relevantStaff = staff.filter(s => {
      if (s.accountStatus === 'disabled') return false;
      if (can('staff:view')) return true;
      if (can('staff:view:own_department')) return s.departmentId === currentUser.departmentId;
      return s.id === currentUser.id;
    });

    const alerts: { staffName: string; docName: string; daysLeft: number; staffId: string }[] = [];
    const now = new Date();

    relevantStaff.forEach(s => {
      if (!s.documents) return;
      s.documents.forEach(doc => {
        if (doc.expiryDate) {
          const expiry = new Date(doc.expiryDate);
          const diffTime = expiry.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays <= 60) {
            alerts.push({
              staffName: s.name,
              docName: doc.name,
              daysLeft: diffDays,
              staffId: s.id
            });
          }
        }
      });
    });

    return alerts.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5);
  }, [staff, currentUser, can]);

  const appCards = [
    { name: 'Roster', path: '/roster', icon: Calendar, description: 'View and manage crew schedules.', show: can('roster:view:own_department') || can('roster:view:all') },
    { name: 'Staff', path: '/staff', icon: Users, description: 'Manage staff profiles and permissions.', show: can('staff:view:own_department') },
    { name: 'HR Portal', path: '/hr', icon: ClipboardList, description: 'Employee lifecycle and compliance.', show: hasHrAccess },
    { name: 'My Leave', path: '/myleave', icon: Plane, description: 'View your leave and submit requests.', show: can('myleave:create') },
    { name: 'Leave Planner', path: '/leave', icon: CalendarCheck, description: 'Plan and approve leave requests.', show: can('leave_planner:view:own_department') },
    { name: 'Leave Ledger', path: '/leave-ledger', icon: Wallet, description: 'Track balances and accruals.', show: can('leave_planner:view_balances') },
    { name: 'Lunch Menu', path: '/lunch', icon: Utensils, description: 'View menus and place lunch orders.', show: can('lunch:view') },
    { name: 'Notices & Memos', path: '/fsi', icon: FileText, description: 'View company bulletins and memos.', show: can('fsi:view') },
    { name: 'Exams', path: '/exams', icon: GraduationCap, description: 'Manage and take crew examinations.', show: can('exams:take') },
    { name: 'Medical & Records', path: '/crew', icon: FileSearch, description: 'Track licenses, medicals, and documents.', show: can('crew_records:view_own') },
    { name: 'Flight & Duty', path: '/duty', icon: Clock, description: 'Track FTL compliance.', show: can('duty_log:view_own') || can('duty_log:view_all') },
    { name: 'Reports', path: '/reports', icon: BarChart3, description: 'Flight hours and system analytics.', show: can('roster:view:all') || can('admin:view_settings') },
    { name: 'Admin', path: '/admin', icon: Settings, description: 'Manage system settings.', show: can('admin:view_settings') },
  ];

  const visibleCards = appCards.filter(card => card.show);

  const firstName = currentUser?.name?.split(' ')[0] || 'Member';

  return (
    <div className="space-y-12 animate-fade-in pb-12">
      {/* Refined Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-gray-100 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2 text-brand-primary dark:text-brand-accent mb-2">
            <Sparkles size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">Crew Portal</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">
            Welcome back, <span className="text-brand-primary dark:text-brand-accent">{firstName}</span>.
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
            Stay updated with your schedule, compliance, and company resources.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/roster"
            className="px-6 py-3 bg-brand-primary hover:bg-brand-secondary text-white font-bold rounded-xl transition-all shadow-lg shadow-brand-primary/20 flex items-center gap-2 group active:scale-95"
          >
            <Calendar size={20} className="group-hover:rotate-12 transition-transform" />
            View My Roster
          </Link>
        </div>
      </header>

      {/* Compliance Warning Widget */}
      {
        expiryWarnings.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-l-4 border-yellow-500 overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-yellow-50/50 dark:bg-yellow-900/10">
              <h3 className="font-bold text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
                Urgent Compliance Warnings
              </h3>
              <Link href="/crew" className="text-xs font-bold text-yellow-700 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 flex items-center gap-1 transition-colors uppercase tracking-wider">
                Manage All <ChevronRight size={14} />
              </Link>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {expiryWarnings.map((w, idx) => (
                <Link href={`/staff/${w.staffId}`} key={idx} className="flex justify-between items-center px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400 group-hover:bg-yellow-100 dark:group-hover:bg-yellow-900/30 group-hover:text-yellow-600 transition-colors">
                      {w.staffName.charAt(0)}
                    </div>
                    <div>
                      <span className="block font-bold text-gray-900 dark:text-white group-hover:text-brand-primary transition-colors">{formatStaffName(w.staffName)}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{w.docName}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${w.daysLeft < 0
                      ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
                      : 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900/30'
                      }`}>
                      {w.daysLeft < 0 ? 'EXPIRED' : `${w.daysLeft} days remaining`}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      }

      {/* App Module Grid */}
      <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 px-1">
        Applications & Modules
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12">
        {visibleCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.name}
              href={card.path}
              className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300 active:scale-[0.98] group"
            >
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-brand-primary/5 dark:bg-white/5 rounded-full scale-0 group-hover:scale-100 transition-transform duration-500 origin-center" />

              <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-700 text-brand-primary dark:text-brand-accent group-hover:bg-brand-primary group-hover:text-white transition-all duration-300">
                <Icon size={24} />
              </div>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-brand-primary dark:group-hover:text-brand-accent transition-colors">
                {card.name}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4 line-clamp-2">
                {card.description}
              </p>

              <div className="mt-auto pt-4 border-t border-gray-50 dark:border-gray-700/50 flex items-center text-xs font-bold text-brand-primary dark:text-brand-accent uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                Open Module <ChevronRight size={14} className="ml-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardPage;
