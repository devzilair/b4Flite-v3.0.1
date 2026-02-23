
import React, { useState, useEffect, useRef } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import ChangePasswordModal from '../auth/ChangePasswordModal';

interface NavbarProps {
  onMenuClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const { currentUser, userRole, loading } = usePermissions();
  const { signOut } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out?')) {
      await signOut();
    }
  };

  // Effect to handle clicks outside the dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  return (
    <header className="h-16 shadow-md z-10 flex-shrink-0 transition-colors bg-white dark:bg-gray-800">
      <div className="w-full h-full flex items-center justify-between px-2 sm:px-6">
        {/* Hamburger Menu for Mobile - Larger touch target */}
        <button
          className="md:hidden p-3 -ml-2 focus:outline-none text-gray-500 dark:text-gray-300 focus:text-gray-700 dark:focus:text-gray-200"
          onClick={onMenuClick}
          aria-label="Open sidebar"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>

        {/* Spacer to push user info to the right */}
        <div className="flex-1"></div>

        <div className="flex items-center space-x-1 sm:space-x-2">
          <NotificationBell />
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 p-2 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
            >
              <span className="hidden sm:inline font-medium">{loading ? 'Loading...' : currentUser?.name || 'User'}</span>
              {/* Mobile: Just show Avatar/Icon if available or simplified */}
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center sm:hidden">
                 <span className="text-xs font-bold">{currentUser?.name?.charAt(0) || 'U'}</span>
              </div>
              <svg className="w-4 h-4 hidden sm:block text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            
            {isDropdownOpen && !loading && currentUser && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg overflow-hidden border dark:border-gray-700 animate-fade-in z-20">
                <div className="p-4 border-b dark:border-gray-700">
                  <p className="font-bold text-gray-900 dark:text-white truncate">{currentUser.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{currentUser.email}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs uppercase text-gray-400">Role</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{userRole?.name || 'N/A'}</p>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700/50 space-y-1">
                  <button
                    onClick={() => {
                        setIsDropdownOpen(false);
                        setIsChangePasswordOpen(true);
                    }}
                    className="w-full text-left flex items-center px-4 py-3 sm:py-2 text-sm text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                    Change Password
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left flex items-center px-4 py-3 sm:py-2 text-sm text-gray-700 dark:text-gray-200 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-700"
                  >
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {isChangePasswordOpen && (
            <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
        )}
      </div>
    </header>
  );
};

export default Navbar;
