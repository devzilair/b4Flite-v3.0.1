'use client';

import React, { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Staff } from '@/types';
import { supabaseUrl } from '@/services/supabaseClient';
import { useFsi } from '@/hooks/useFsi';
import { useStaff } from '@/hooks/useStaff';

const FsiPrintPreviewPage: React.FC = () => {
    const { documentId } = useParams();
    const router = useRouter();

    const { staff, loading: staffLoading } = useStaff();
    const { fsiDocuments, fsiAcks, loading: fsiLoading } = useFsi();
    const loading = staffLoading || fsiLoading;

    const document = useMemo(() => fsiDocuments.find(d => d.id === documentId), [fsiDocuments, documentId]);

    const assignedStaff = useMemo(() => {
        if (!document) return [];

        let staffList: Staff[] = [];
        if (document.departmentId) {
            if (document.assignedTo === 'all_in_department') {
                staffList = staff.filter(s => s.departmentId === document.departmentId);
            } else if (Array.isArray(document.assignedTo)) {
                const assignedIds = new Set(document.assignedTo);
                staffList = staff.filter(s => assignedIds.has(s.id));
            }
        } else {
            // Global document
            staffList = staff;
        }

        // Filter out Admins and Super Admins
        staffList = staffList.filter(s => s.roleId !== 'role_admin' && s.roleId !== 'role_super_admin');

        return staffList.sort((a, b) => a.name.localeCompare(b.name));
    }, [document, staff]);

    if (loading) {
        return <div>Loading print preview...</div>;
    }

    if (!document) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
                <h1 className="text-2xl font-bold mb-4">Document not found</h1>
                <button onClick={() => router.push('/fsi')} className="bg-brand-primary text-white py-2 px-4 rounded-md">
                    Back to Documents
                </button>
            </div>
        );
    }

    const renderContent = (content: string) => {
        return content.split('\n').map((line, index) => {
            if (line.startsWith('## ')) return <h2 key={index} className="text-xl font-bold mt-4 mb-2">{line.substring(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={index} className="text-lg font-semibold mt-3 mb-1">{line.substring(4)}</h3>;
            if (line.startsWith('- ')) return <li key={index} className="ml-6">{line.substring(2)}</li>;
            if (line.trim() === '') return <br key={index} />;
            return <p key={index} className="mb-2">{line}</p>;
        });
    }

    return (
        <div className="bg-gray-100 dark:bg-gray-900 min-h-screen py-8 print:py-0">
            <div className="bg-white dark:bg-gray-800 p-8 sm:p-12 max-w-4xl mx-auto my-8 print:my-0 print:mx-0 print:shadow-none shadow-lg print:border-none border rounded-lg">
                <header className="flex justify-between items-center mb-8 pb-4 border-b dark:border-gray-600">
                    <div className="h-20 flex items-center justify-start">
                        <img
                            src={`${supabaseUrl}/storage/v1/object/public/portal-uploads/logo_white.png`}
                            alt="Zil Air"
                            className="h-full object-contain block dark:hidden print:block"
                        />
                        <img
                            src={`${supabaseUrl}/storage/v1/object/public/portal-uploads/logo_black.png`}
                            alt="Zil Air"
                            className="h-full object-contain hidden dark:block print:hidden"
                        />
                    </div>
                    <div className="text-right">
                        <h1 className="text-2xl font-bold">Flight Safety Instruction</h1>
                        <p className="text-sm text-gray-500">{document.documentNumber} (Rev. {document.revision})</p>
                    </div>
                </header>

                <main>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">{document.title}</h1>
                    <p className="text-md text-gray-500 dark:text-gray-400 mb-8">
                        Issued: {new Date(document.issueDate + 'T00:00:00Z').toLocaleDateString()}
                    </p>

                    <div className="prose dark:prose-invert max-w-none">
                        {renderContent(document.content)}
                    </div>
                </main>

                <section className="mt-12 pt-8 border-t dark:border-gray-600">
                    <h2 className="text-xl font-bold mb-4">Acknowledgment Record</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-700">
                                <tr>
                                    <th className="p-3">Staff Name</th>
                                    <th className="p-3">Acknowledged</th>
                                    <th className="p-3">Date (UTC)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assignedStaff.map(staffMember => {
                                    const ack = fsiAcks.find(a => a.staffId === staffMember.id && a.documentId === document.id);
                                    return (
                                        <tr key={staffMember.id} className="border-b border-gray-200 dark:border-gray-700">
                                            <td className="p-3 font-medium">{staffMember.name}</td>
                                            <td className="p-3">
                                                <span className={`font-bold ${ack ? 'text-green-600' : 'text-red-600'}`}>
                                                    {ack ? '✔ Yes' : 'No'}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                {ack ? new Date(ack.acknowledgedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '---'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {assignedStaff.length === 0 && <p className="text-center py-4 text-gray-500">No staff assigned to this document.</p>}
                    </div>
                </section>

                <div className="mt-8 text-center print:hidden flex justify-center gap-4">
                    <button onClick={() => window.print()} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-md hover:bg-brand-secondary transition-colors">
                        Print
                    </button>
                    <button onClick={() => router.push('/fsi')} className="bg-gray-200 dark:bg-gray-600 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FsiPrintPreviewPage;
