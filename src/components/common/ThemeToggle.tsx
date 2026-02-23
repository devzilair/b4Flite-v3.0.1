'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="px-2 mt-auto border-t dark:border-gray-700 pt-4 mb-4">
            <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center w-full px-4 py-2 text-gray-600 dark:text-gray-300 rounded-lg transition-all duration-200 hover:bg-brand-light hover:text-brand-primary dark:hover:bg-gray-700 group"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:bg-white dark:group-hover:bg-gray-600 transition-colors shadow-sm">
                    {theme === 'dark' ? (
                        <Sun size={18} className="text-yellow-500" />
                    ) : (
                        <Moon size={18} className="text-brand-primary" />
                    )}
                </span>
                <span className="ml-3 font-bold text-xs uppercase tracking-wider">
                    {theme === 'dark' ? 'Light Mode' : 'Night Mode'}
                </span>
            </button>
        </div>
    );
};

export default ThemeToggle;
