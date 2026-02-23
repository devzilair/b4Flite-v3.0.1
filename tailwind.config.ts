import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: 'class',
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                'brand-primary': '#0D47A1',
                'brand-secondary': '#1565C0',
                'brand-accent': '#2196F3',
                'brand-light': '#BBDEFB',
                'status-success': '#4CAF50',
                'status-warning': '#FFC107',
                'status-danger': '#F44336',
            },
            keyframes: {
                'fade-in': {
                    '0%': { opacity: '0', transform: 'translateY(-10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                'fade-in': 'fade-in 0.3s ease-out forwards',
            },
            screens: {
                'xs': '475px',
                'print': { 'raw': 'print' },
            },
        },
    },
    plugins: [],
};
export default config;
