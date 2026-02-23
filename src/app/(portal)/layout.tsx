import ClientLayout from '@/components/layout/Layout';
import AuthGuard from '@/components/auth/AuthGuard';

export default function PortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <ClientLayout>{children}</ClientLayout>
        </AuthGuard>
    );
}