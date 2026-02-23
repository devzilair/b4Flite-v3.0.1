import React from 'react';
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import GlobalErrorBoundary from "@/components/GlobalErrorBoundary";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "b4Flite",
    description: "ZilAir Staff Portal",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "b4Flite",
    },
};

export const viewport: Viewport = {
    themeColor: "#0D47A1",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="h-full">
            <body className={`${inter.className} h-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overscroll-none`}>
                <GlobalErrorBoundary>
                    <Providers>
                        {children}
                    </Providers>
                </GlobalErrorBoundary>
            </body>
        </html>
    );
}
