
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import * as api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { LeaveRequest, LeaveTransaction, Staff, DepartmentSettings } from '../types';

export const useLeave = () => {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const enabled = !!session;

    // --- QUERIES ---
    const requestsQuery = useQuery({
        queryKey: ['leave_requests'],
        queryFn: api.getLeaveRequests,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    const transactionsQuery = useQuery({
        queryKey: ['leave_transactions'],
        queryFn: api.getLeaveTransactions,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    // --- MUTATIONS ---
    const addRequestMutation = useMutation({
        mutationFn: api.upsertLeaveRequest,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave_requests'] })
    });

    const updateRequestMutation = useMutation({
        mutationFn: api.upsertLeaveRequest,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave_requests'] })
    });

    const deleteRequestMutation = useMutation({
        mutationFn: api.deleteLeaveRequest,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave_requests'] })
    });

    const addTransactionMutation = useMutation({
        mutationFn: api.upsertLeaveTransaction,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave_transactions'] })
    });

    const deleteTransactionMutation = useMutation({
        mutationFn: api.deleteLeaveTransaction,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave_transactions'] })
    });

    const deleteTransactionsByReqMutation = useMutation({
        mutationFn: api.deleteLeaveTransactionsByRequestId,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave_transactions'] })
    });

    const cleanupManualMutation = useMutation({
        mutationFn: (args: { staffId: string, startDate: string, endDate: string }) => 
            api.deleteManualTransactionsInRange(args.staffId, args.startDate, args.endDate),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave_transactions'] })
    });

    const fixDuplicatesMutation = useMutation({
        mutationFn: api.fixLedgerDuplicates,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave_transactions'] })
    });

    // --- REAL-TIME SUBSCRIPTIONS ---
    useEffect(() => {
        if (!enabled) return;

        const channel = supabase.channel('realtime-leave')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'leave_requests' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['leave_requests'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'leave_transactions' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['leave_transactions'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, enabled]);

    // Helper logic for accruals (Client-side calculation)
    // We pass staff and settings in to avoid circular dependency with AppContext
    const runAccruals = async (deptId: string, deptStaff: Staff[], settings: DepartmentSettings) => {
        if (!settings || !settings.leaveAccrualPolicies || settings.leaveAccrualPolicies.length === 0) return 0;
        
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let count = 0;
        
        const currentTransactions = transactionsQuery.data || [];

        for (const person of deptStaff) {
            for (const policy of settings.leaveAccrualPolicies) {
                const exists = currentTransactions.some(t => 
                    t.staffId === person.id && 
                    t.leaveTypeId === policy.leaveTypeId && 
                    t.transactionType === 'accrual' && 
                    t.date.startsWith(monthKey)
                );
                
                if (!exists) {
                    await api.upsertLeaveTransaction({
                        id: `acc_${person.id}_${policy.leaveTypeId}_${monthKey}`,
                        staffId: person.id,
                        leaveTypeId: policy.leaveTypeId,
                        transactionType: 'accrual',
                        date: new Date().toISOString().split('T')[0],
                        amount: policy.amount,
                        notes: `Automatic accrual (${policy.frequency})`
                    });
                    count++;
                }
            }
        }
        if (count > 0) queryClient.invalidateQueries({ queryKey: ['leave_transactions'] });
        return count;
    };

    return {
        leaveRequests: requestsQuery.data || [],
        leaveTransactions: transactionsQuery.data || [],
        loading: requestsQuery.isLoading || transactionsQuery.isLoading,
        error: requestsQuery.error || transactionsQuery.error,

        addLeaveRequest: addRequestMutation.mutateAsync,
        updateLeaveRequest: updateRequestMutation.mutateAsync,
        deleteLeaveRequest: deleteRequestMutation.mutateAsync,
        
        addLeaveTransaction: addTransactionMutation.mutateAsync,
        deleteLeaveTransaction: deleteTransactionMutation.mutateAsync,
        deleteTransactionsByRequestId: deleteTransactionsByReqMutation.mutateAsync,
        
        cleanupManualTransactions: (staffId: string, startDate: string, endDate: string) => 
            cleanupManualMutation.mutateAsync({ staffId, startDate, endDate }),
            
        fixLedgerDuplicates: fixDuplicatesMutation.mutateAsync,
        
        runLeaveAccruals: runAccruals
    };
};
