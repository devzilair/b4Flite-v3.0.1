import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePermissions } from '../../hooks/usePermissions';
import Logo from '../common/Logo';
import ThemeToggle from '../common/ThemeToggle';

const navLinks = [
  { name: 'Portal Home', path: '/portal', icon: '🏠', permission: null },
  { name: 'Roster', path: '/roster', icon: '📅', permission: null },
  { name: 'Staff', path: '/staff', icon: '👥', permission: 'staff:view:own_department' },
  { name: 'HR Portal', path: '/hr', icon: '📋', permission: 'staff:view', hrOnly: true },
  { name: 'My Leave', path: '/myleave', icon: '🌴', permission: 'myleave:create' },
  { name: 'Leave Planner', path: '/leave', icon: '✈️', permission: 'leave_planner:view:own_department' },
  { name: 'Leave Ledger', path: '/leave-ledger', icon: '💰', permission: 'leave_planner:view_balances' },
  { name: 'Lunch Menu', path: '/lunch', icon: '🍽️', permission: 'lunch:view' },
  { name: 'Notices & Memos', path: '/fsi', icon: '📄', permission: 'fsi:view' },
  { name: 'Exams', path: '/exams', icon: '📝', permission: 'exams:take' },
  { name: 'Crew Records', path: '/crew', icon: '🗂️', permission: 'crew_records:view_own' },
  { name: 'Flight & Duty', path: '/duty', icon: '⏱️', permission: 'duty_log:view_own', department: 'dept_pilots' },
  { name: 'Reports', path: '/reports', icon: '📊', permission: null },
  { name: 'Admin', path: '/admin', icon: '⚙️', permission: 'admin:view_settings' },
  { name: 'Audit Logs', path: '/admin/audit', icon: '🛡️', permission: 'admin:view_settings' },
];

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { currentUser, can, loading, userRole } = usePermissions();
  const pathname = usePathname();

  const closeSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsOpen(false);
    }
  }

  const hasHrAccess = userRole?.id === 'role_super_admin' || userRole?.id === 'role_admin' || currentUser?.hasHrRights;

  return (
    <div
      className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 shadow-md flex-shrink-0 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
    >
      <div className="h-16 flex items-center justify-center text-white flex-shrink-0 shadow-sm transition-colors bg-brand-primary">
        <Logo className="h-8 text-white" />
      </div>
      <nav className="flex-1 mt-4 px-2 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : currentUser ? (
          navLinks.map((link) => {
            const isActive = pathname === link.path;

            if (link.hrOnly && !hasHrAccess) {
              return null;
            }

            if (link.permission && !can(link.permission as any) && !link.hrOnly) {
              return null;
            }

            if (link.department && currentUser?.departmentId !== link.department) {
              const isGlobalAdmin = can('roster:view:all');
              const isDutyPage = link.path.startsWith('/duty');
              const hasDutyAccess = can('duty_log:view_all');

              if (!isGlobalAdmin && !(isDutyPage && hasDutyAccess)) {
                return null;
              }
            }

            return (
              <Link
                key={link.name}
                href={link.path}
                onClick={closeSidebar}
                className={`flex items-center px-4 py-2 mt-2 text-gray-600 dark:text-gray-300 rounded-md transition-colors duration-200 transform hover:bg-brand-light hover:text-brand-primary dark:hover:bg-gray-700 ${isActive ? 'bg-brand-light text-brand-primary dark:bg-gray-700' : ''
                  }`}
              >
                <span className="text-xl">{link.icon}</span>
                <span className="mx-4 font-medium">{link.name}</span>
              </Link>
            );
          })
        ) : null}
      </nav>
      <ThemeToggle />
    </div>
  );
};

export default Sidebar;
