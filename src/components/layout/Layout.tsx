'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Breadcrumbs from './Breadcrumbs';
import ToastContainer from '../common/ToastContainer';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Pages that function as full-screen apps (Tables/Grids)
  // We disable global scrolling and UI chrome (breadcrumbs/footer) for these to maximize data visibility
  const isFullScreenPage = ['/roster', '/duty', '/leave'].includes(pathname);

  return (
    <div className="relative h-dvh w-screen flex overflow-hidden bg-gray-100 dark:bg-gray-900 print:h-auto print:overflow-visible print:block">
      {/* Global Toast Layer */}
      <ToastContainer />

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      <div className="print:hidden h-full flex-shrink-0">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden print:h-auto print:overflow-visible print:block">
        <div className="print:hidden flex-shrink-0">
          <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        </div>

        {/* Main Content Area */}
        <main className={`flex-1 flex flex-col min-h-0 ${isFullScreenPage ? 'overflow-hidden' : 'overflow-x-hidden overflow-y-auto scroll-smooth'} print:h-auto print:overflow-visible print:block`}>
          <div className={`w-full flex-1 flex flex-col ${isFullScreenPage ? 'p-0 sm:p-4 h-full' : 'px-4 sm:px-6 py-4 sm:py-8 h-auto'} max-w-full print:max-w-none print:px-0 print:py-0 pb-safe`}>

            {!isFullScreenPage && (
              <div className="print:hidden px-0 mb-4 sm:mb-6">
                <Breadcrumbs />
              </div>
            )}

            {/* Flex container to ensure children fill available height in full-screen mode */}
            <div className={`flex-1 flex flex-col min-h-0 ${isFullScreenPage ? 'relative' : ''}`}>
              {children}
            </div>

            {!isFullScreenPage && (
              <footer className="mt-auto pt-8 pb-4 text-center print:hidden px-4">
                <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">
                  JBVservices <span className="align-top text-[0.6em]">©</span> 2025
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                  v55.14.0
                </p>
                {/* Extra spacer for mobile safe area */}
                <div className="h-[env(safe-area-inset-bottom)]"></div>
              </footer>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;