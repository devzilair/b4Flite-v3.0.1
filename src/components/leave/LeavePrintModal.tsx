
import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { LeaveRequest, Staff, LeaveType, Department, DigitalSignature } from '../../types';
import { supabaseUrl } from '../../services/supabaseClient';
import { isDatePublicHoliday } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useLeave } from '../../hooks/useLeave';
import { useSettings } from '../../hooks/useSettings';

interface LeavePrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: LeaveRequest;
    staffMember: Staff | undefined;
    department: Department | undefined;
    leaveType: LeaveType | undefined;
}

// Reusable Signature Block Component
const SignatureBlock: React.FC<{
    label: string;
    signature?: DigitalSignature;
    onSign?: () => void;
    canSign: boolean;
    isDark?: boolean;
}> = ({ label, signature, onSign, canSign, isDark }) => {
    return (
        <div className="flex items-end gap-2 mt-4 relative">
            <span className="font-bold whitespace-nowrap">{label}</span>
            <div className={`border-b ${isDark ? 'border-gray-500' : 'border-black'} flex-1 h-12 relative flex items-end justify-center`}>
                {signature ? (
                    <div className="text-center pb-1">
                        <p className="font-script text-2xl text-blue-900 print:text-black opacity-90 leading-none">
                            {signature.signedBy}
                        </p>
                        <p className="text-[8px] uppercase tracking-widest font-sans opacity-60">
                            Digitally Signed {new Date(signature.signedAt).toLocaleDateString()}
                        </p>
                    </div>
                ) : (
                    <>
                        {canSign && onSign && (
                            <button 
                                onClick={onSign}
                                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-200 hover:bg-blue-200 transition-colors shadow-sm print:hidden z-10"
                            >
                                ✍️ Click to Sign
                            </button>
                        )}
                        {/* Empty line for print if not signed */}
                    </>
                )}
            </div>
        </div>
    );
};

const LeavePrintModal: React.FC<LeavePrintModalProps> = ({ 
    isOpen, 
    onClose, 
    request, 
    staffMember, 
    department,
    leaveType
}) => {
    const { publicHolidays } = useSettings();
    const { leaveRequests, leaveTransactions, updateLeaveRequest } = useLeave();
    const { currentUser, can } = usePermissions();
    const { signIn } = useAuth(); 

    // --- SMART TYPE DETECTION ---
    const { isPhLeave, isSickLeave } = useMemo(() => {
        if (!leaveType) return { isPhLeave: false, isSickLeave: false };
        const name = leaveType.name.toLowerCase();
        
        const isPh = name.includes('public holiday') || name === 'ph' || name.includes('lieu');
        const isSick = name.includes('sick') || name.includes('medical') || name.includes('health');
        
        return { isPhLeave: isPh, isSickLeave: isSick };
    }, [leaveType]);

    // Check if Med Cert was submitted (via note tag)
    const isMedCertSubmitted = useMemo(() => {
        return request.notes ? request.notes.includes('[Med Cert Submitted]') : false;
    }, [request.notes]);

    // --- DATE LOGIC ---
    const start = useMemo(() => new Date(request.startDate + 'T00:00:00Z'), [request.startDate]);
    const end = useMemo(() => new Date(request.endDate + 'T00:00:00Z'), [request.endDate]);
    
    // Calendar duration (Total days absent)
    const calendarDurationDays = useMemo(() => {
        return Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }, [start, end]);

    // Return Date: Day after end date
    const resumeDate = useMemo(() => {
        const d = new Date(end);
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    }, [end]);

    // Application Date
    const appDate = useMemo(() => {
        if (request.id.startsWith('lr_')) {
            const ts = parseInt(request.id.split('_')[1]);
            if (!isNaN(ts)) return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        }
        return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }, [request.id]);

    // --- BALANCE CALCULATIONS ---
    const balanceDisplay = useMemo(() => {
        if (!staffMember || !leaveType) return { label: 'Leave Available:', amount: '-' };
        
        const trans = leaveTransactions.filter(t => t.staffId === staffMember.id && t.leaveTypeId === leaveType.id);
        const total = trans.reduce((sum, t) => sum + t.amount, 0);

        if (isSickLeave) {
            return { label: 'Sick Leave Balance:', amount: `${total.toFixed(1)} Days` };
        }
        if (isPhLeave) {
            return { label: 'PH Bank Balance:', amount: `${total.toFixed(1)} Days` };
        }
        return { label: 'Annual Leave Available:', amount: `${total.toFixed(1)} Days` };
    }, [staffMember, leaveType, leaveTransactions, isSickLeave, isPhLeave]);


    // --- PH SPLIT LOGIC (Updated v51.6.2) ---
    const { phStartStr, phEndStr, phDayCount } = useMemo(() => {
        // If the leave type ITSELF is PH (e.g. Lieu Day), then the whole period is PH days
        if (isPhLeave) {
             const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
             return { 
                 phStartStr: fmt(start), 
                 phEndStr: fmt(end), 
                 phDayCount: calendarDurationDays 
             };
        }

        // Otherwise (Annual Leave split), use the applied count
        let count = request.phDaysApplied || 0;
        if (count === 0) return { phStartStr: 'N/A', phEndStr: 'N/A', phDayCount: '-' };

        const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
        const startStr = fmt(start);
        
        if (count === 1) {
            // Single day logic based on position
            if (request.phPosition === 'end') {
                const singleEnd = fmt(end);
                return { phStartStr: singleEnd, phEndStr: singleEnd, phDayCount: count };
            }
            return { phStartStr: startStr, phEndStr: startStr, phDayCount: count };
        }

        if (request.phPosition === 'end') {
            // PH at END
            const phStart = new Date(end);
            phStart.setUTCDate(phStart.getUTCDate() - (count - 1));
            return { phStartStr: fmt(phStart), phEndStr: fmt(end), phDayCount: count };
        } else {
            // PH at START (Default)
            const phEnd = new Date(start);
            phEnd.setUTCDate(phEnd.getUTCDate() + (count - 1));
            return { phStartStr: startStr, phEndStr: fmt(phEnd), phDayCount: count };
        }
    }, [request.phDaysApplied, request.phPosition, start, end, isPhLeave, calendarDurationDays]);


    // --- NET DEDUCTION (Updated v51.6.2) ---
    const netLeaveDays = useMemo(() => {
        // If it's pure PH leave, we deduct 0 "Annual Leave" days (though it deducts from PH bank)
        // The form field specifically asks for "Chargeable Days" (usually referring to Annual Leave)
        if (isPhLeave) return 0;

        let chargeableDays = 0;
        const loopDate = new Date(start);
        
        while (loopDate <= end) {
            const dayOfWeek = loopDate.getUTCDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isPH = isDatePublicHoliday(loopDate, publicHolidays);

            if (!isWeekend && !isPH) {
                chargeableDays++;
            }
            loopDate.setUTCDate(loopDate.getUTCDate() + 1);
        }

        return Math.max(0, chargeableDays - (request.phDaysApplied || 0));
    }, [start, end, isPhLeave, request.phDaysApplied, publicHolidays]);


    const lastLeave = useMemo(() => {
        if (!staffMember) return null;
        if (isSickLeave) return null;

        const previousRequests = leaveRequests
            .filter(r => r.staffId === staffMember.id && r.status === 'approved' && r.id !== request.id && r.endDate < request.startDate)
            .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
        
        if (previousRequests.length > 0) {
            const prev = previousRequests[0];
            const pStart = new Date(prev.startDate + 'T00:00:00Z');
            const pEnd = new Date(prev.endDate + 'T00:00:00Z');
            const duration = Math.ceil(Math.abs(pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            return {
                endDate: new Date(prev.endDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }),
                duration
            };
        }
        return null;
    }, [leaveRequests, staffMember, request, isSickLeave]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    };

    const isApproved = request.status === 'approved';
    const isDenied = request.status === 'denied';

    // --- SIGNATURE LOGIC ---
    const [signTarget, setSignTarget] = useState<'applicant' | 'manager' | 'executive' | null>(null);
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState<string | null>(null);
    const [isSigning, setIsSigning] = useState(false);

    const signatures = request.signatures || {};

    const canSignApplicant = useMemo(() => {
        if (!currentUser) return false;
        return currentUser.id === request.staffId && !signatures.applicant;
    }, [currentUser, request.staffId, signatures.applicant]);

    const canSignManager = useMemo(() => {
        if (!currentUser) return false;
        const isManager = can('leave_planner:approve');
        return isManager && !signatures.manager;
    }, [currentUser, can, signatures.manager]);

    const canSignExecutive = useMemo(() => {
        if (!currentUser) return false;
        const isDirector = can('leave_planner:sign_director');
        return isDirector && !signatures.executive;
    }, [currentUser, can, signatures.executive]);

    const handleSignClick = (target: 'applicant' | 'manager' | 'executive') => {
        setSignTarget(target);
        setPassword('');
        setAuthError(null);
    };

    const confirmSignature = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.email || !signTarget) return;

        setIsSigning(true);
        setAuthError(null);

        try {
            const { error } = await signIn(currentUser.email, password);

            if (error) {
                setAuthError("Incorrect password.");
                setIsSigning(false);
                return;
            }

            const signature: DigitalSignature = {
                signedBy: currentUser.name,
                signedAt: new Date().toISOString(),
                signerId: currentUser.id
            };

            const updatedSignatures = { ...signatures };
            if (signTarget === 'applicant') updatedSignatures.applicant = signature;
            else if (signTarget === 'manager') updatedSignatures.manager = signature;
            else if (signTarget === 'executive') updatedSignatures.executive = signature;

            const updatedRequest = { ...request, signatures: updatedSignatures };
            await updateLeaveRequest(updatedRequest);
            setSignTarget(null);
        } catch (err) {
            console.error("Signing failed", err);
            setAuthError("An unexpected error occurred.");
        } finally {
            setIsSigning(false);
        }
    };

    // --- UI COMPONENTS ---
    const CheckBox = ({ checked, label }: { checked: boolean, label?: string }) => (
        <div className="flex items-center gap-2">
            {label && <span>{label}</span>}
            <div className="w-5 h-5 border border-black flex items-center justify-center bg-white print:border-black">
                {checked && <span className="text-black font-bold text-lg leading-none mb-1">✓</span>}
            </div>
        </div>
    );

    const UnderlineField = ({ label, value, width = "flex-1", center = false }: { label?: string, value?: string | number, width?: string, center?: boolean }) => (
        <div className={`flex items-end gap-2 ${width}`}>
            {label && <span className="font-bold whitespace-nowrap text-sm">{label}</span>}
            <div className={`border-b border-black flex-1 px-1 ${center ? 'text-center' : 'text-left'}`}>
                <span className="font-medium text-base">{value}</span>
            </div>
        </div>
    );

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] bg-white overflow-auto flex flex-col items-center print-overlay">
            
            {/* Screen Controls */}
            <div className="fixed top-0 left-0 right-0 bg-gray-800 text-white p-4 flex justify-between items-center print:hidden shadow-md z-50">
                <h2 className="font-bold text-lg">Print Preview: {isSickLeave ? 'Sick Leave' : isPhLeave ? 'PH Request' : 'Leave Application'}</h2>
                <div className="flex gap-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors">Close</button>
                    <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-bold flex items-center gap-2 shadow-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" /></svg>
                        Print Form
                    </button>
                </div>
            </div>

            <div className="h-20 print:hidden"></div>

            <div 
                id="printable-form-container"
                className="bg-white text-black p-[15mm] max-w-[210mm] w-full min-h-[297mm] shadow-2xl print:shadow-none print:w-full print:max-w-none print:h-auto print:p-0 print:m-0 mx-auto box-border"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
            >
                {/* Header Block */}
                <div className="flex justify-between items-start mb-6">
                    <img 
                        src={`${supabaseUrl}/storage/v1/object/public/portal-uploads/logo_white.png`} 
                        alt="Logo" 
                        className="h-20 object-contain w-48 object-left"
                    />
                    <div className="text-center pt-4">
                        <p className="italic font-serif text-sm text-gray-600">More than just a flight</p>
                    </div>
                    <div className="text-right text-[10px] font-sans leading-snug w-48">
                        <p className="font-bold">www.zilair.com</p>
                        <div className="h-px bg-orange-400 w-full my-1"></div>
                        <p>P.O. Box 1110, Victoria</p>
                        <p>Mahe, Seychelles</p>
                        <p>Tel: +248 375 100</p>
                        <p>Fax: +248 375 101</p>
                        <p>E-mail: info@zilair.com</p>
                    </div>
                </div>

                {/* DYNAMIC TITLE */}
                <h1 className="text-2xl font-bold text-center uppercase underline mb-8 tracking-wide font-sans">
                    {isSickLeave ? "SICK LEAVE / ABSENCE REPORT" : 
                     isPhLeave ? "PUBLIC HOLIDAY / LIEU DAY APPLICATION" : 
                     "LEAVE APPLICATION FORM"}
                </h1>

                <div className="flex justify-between items-end mb-6 text-sm font-sans">
                    <div className="flex items-center gap-2">
                        <span className="font-bold">Section:</span>
                        <div className="bg-slate-800 text-white px-3 py-1 font-bold print:bg-black print:text-white uppercase">
                            {department?.name || '________________'}
                        </div>
                    </div>
                    <UnderlineField label="DATE:" value={appDate} width="w-48" center />
                </div>

                <div className="space-y-5 mb-8 text-sm font-sans">
                    <div className="flex gap-8">
                        <UnderlineField label="Name:" value={staffMember?.name} width="w-3/5" />
                        <UnderlineField label="Position:" value={staffMember?.hrData?.contract?.jobTitle} width="w-2/5" />
                    </div>
                    <div className="flex gap-8">
                        <UnderlineField label="Start Date:" value={formatDate(request.startDate)} />
                        <UnderlineField label="End Date:" value={formatDate(request.endDate)} />
                    </div>
                    <UnderlineField label="Contact number:" value={request.contactNumber || staffMember?.phone || ''} />
                    
                    <div className="flex items-center gap-6 pt-2">
                        
                        {!isSickLeave && !isPhLeave && (
                            <>
                                <span className="font-bold">Leave Location:</span>
                                <CheckBox checked={request.destination === 'local'} label="Local" />
                                <CheckBox checked={request.destination === 'overseas'} label="Overseas" />
                            </>
                        )}
                        
                        {isSickLeave && (
                            <>
                                <span className="font-bold">Medical Certificate:</span>
                                <CheckBox checked={isMedCertSubmitted} label="Submitted" />
                                <CheckBox checked={!isMedCertSubmitted} label="Not Submitted" />
                            </>
                        )}

                        <div className="flex items-end gap-2 flex-1 ml-4">
                            <span className="font-bold whitespace-nowrap">Type:</span>
                            <div className="border-b border-black flex-1 px-1 font-bold text-center">
                                {leaveType?.name}
                            </div>
                        </div>
                    </div>

                     <div className="flex items-end gap-2">
                         <span className="font-bold whitespace-nowrap">
                             {isSickLeave ? "Nature of Illness / Reason:" : "Reason, if any:"}
                         </span>
                         <div className="border-b border-black flex-1 px-1">{request.justification}</div>
                     </div>
                     
                     {/* APPLICANT SIGNATURE */}
                     <SignatureBlock 
                        label="Applicant signature:" 
                        signature={signatures.applicant}
                        canSign={canSignApplicant}
                        onSign={() => handleSignClick('applicant')}
                     />
                </div>

                {/* Section 2: Public Holidays (Display for both Split Annual and Pure PH) */}
                {!isSickLeave && (phDayCount !== '-' && phDayCount !== 0) && (
                    <div className="border border-black p-4 mb-6 text-sm font-sans">
                        <p className="font-bold text-xs mb-3 text-gray-600">
                            {isPhLeave ? "Public Holiday / Lieu Day Utilization" : `PH Notes: Applied at the ${request.phPosition || 'start'} of Leave`}
                        </p>
                        <div className="flex gap-6">
                            <div className="flex items-center gap-2 w-1/4">
                                <span className="font-bold whitespace-nowrap">Number of PH Days:</span>
                                <div className="border-b border-black w-12 text-center font-bold">{phDayCount}</div>
                            </div>
                            <div className="flex items-center gap-2 w-3/4">
                                <span className="font-bold whitespace-nowrap">PH Dates: Starting</span>
                                <div className="border-b border-black flex-1 text-center">{phStartStr}</div>
                                <span className="font-bold whitespace-nowrap">Ending:</span>
                                <div className="border-b border-black w-24 text-center">{phEndStr}</div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="h-px bg-black w-full mb-6"></div>

                <div className="mb-6 text-sm font-sans">
                    <h3 className="text-center font-bold underline uppercase mb-4">Head of Section</h3>
                    
                    <div className="flex justify-center gap-16 mb-6">
                        <CheckBox checked={isApproved} label="Recommended" />
                        <CheckBox checked={isDenied} label="Not recommended" />
                    </div>

                    <UnderlineField label="Reason:" value={isDenied ? "Operational Requirements" : ""} />
                    
                    {/* MANAGER SIGNATURE */}
                    <SignatureBlock 
                        label="Head of Section Signature:"
                        signature={signatures.manager}
                        canSign={canSignManager}
                        onSign={() => handleSignClick('manager')}
                    />
                </div>

                <div className="h-px bg-black w-full mb-6"></div>

                <div className="mb-8 text-sm font-sans">
                    <h3 className="text-center font-bold underline uppercase mb-4">Office Use</h3>
                    <div className="grid grid-cols-2 gap-x-16 gap-y-4">
                        <div className="flex justify-between items-end">
                            {/* SMART LABEL: Changes based on type */}
                            <span>{balanceDisplay.label}</span>
                            <div className="border-b border-black w-32 text-center">{balanceDisplay.amount}</div>
                        </div>
                        <div className="flex justify-between items-end">
                            <span>{isPhLeave ? "Chargeable Days (Annual):" : "Days Requesting (Net):"}</span>
                            <div className="border-b border-black w-24 text-center font-bold">{netLeaveDays}</div>
                        </div>
                        
                        <div className="flex justify-between items-end">
                            <span>Total Calendar Days:</span>
                            <div className="border-b border-black w-24 text-center">{calendarDurationDays}</div>
                        </div>
                        {/* Spacer for alignment */}
                        <div></div> 
                        
                        {/* Only show "Date of last leave" for Annual Leave type */}
                        {!isSickLeave && !isPhLeave && (
                            <>
                                <div className="flex justify-between items-end">
                                    <span>Date of last leave:</span>
                                    <div className="border-b border-black w-24 text-center">{lastLeave?.endDate || '-'}</div>
                                </div>
                                <div className="flex justify-between items-end">
                                    <span>Duration of last leave:</span>
                                    <div className="border-b border-black w-24 text-center">{lastLeave ? `${lastLeave.duration} days` : '-'}</div>
                                </div>
                            </>
                        )}
                        {/* If Sick/PH, fill the space to keep grid consistent */}
                        {(isSickLeave || isPhLeave) && (
                            <>
                                <div></div>
                                <div></div>
                            </>
                        )}

                        <div className="flex justify-between items-end">
                            <span>Start date:</span>
                            <div className="border-b border-black w-24 text-center">{formatDate(request.startDate)}</div>
                        </div>
                        <div className="flex justify-between items-end">
                            <span>Return Date:</span>
                            <div className="border-b border-black w-24 text-center font-bold">{resumeDate}</div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-sm font-sans">
                    <h3 className="text-center font-bold underline uppercase mb-8">Approval:</h3>
                    {/* EXECUTIVE DIRECTOR SIGNATURE */}
                    <SignatureBlock 
                        label="Executive Director Signature:"
                        signature={signatures.executive}
                        canSign={canSignExecutive}
                        onSign={() => handleSignClick('executive')}
                    />
                </div>
            </div>

            {/* PASSWORD SIGNING MODAL */}
            {signTarget && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 animate-fade-in" onClick={() => setSignTarget(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-sm border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Confirm Signature</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                            You are electronically signing as <span className="font-bold text-brand-primary">{currentUser?.name}</span>.
                        </p>
                        
                        <form onSubmit={confirmSignature}>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Password</label>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-brand-primary outline-none transition-shadow"
                                    autoFocus
                                    required
                                    placeholder="Verify identity"
                                />
                                {authError && (
                                    <div className="mt-2 text-red-600 text-sm flex items-center animate-fade-in">
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {authError}
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex justify-end gap-3 pt-2 border-t dark:border-gray-700">
                                <button 
                                    type="button" 
                                    onClick={() => setSignTarget(null)}
                                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSigning || !password}
                                    className="px-6 py-2 text-sm bg-brand-primary text-white rounded hover:bg-brand-secondary disabled:opacity-50 font-bold shadow-sm transition-all"
                                >
                                    {isSigning ? 'Signing...' : 'Sign'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');
                .font-script { font-family: 'Dancing Script', cursive; }

                @media print {
                    #root {
                        display: none !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    body {
                        background-color: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                    }
                    .print-overlay {
                        position: static !important;
                        display: block !important;
                        width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                        background: white !important;
                    }
                    #printable-form-container {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        max-width: none !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        overflow: visible !important;
                        border: none !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                }
            `}</style>
        </div>,
        document.body
    );
};

export default LeavePrintModal;
