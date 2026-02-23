
import { supabase } from '../supabaseClient';
import { LeaveRequest, LeaveTransaction } from '../../types';
import { toCamelCase, toSnakeCase, safeFetch } from './shared';

export const getLeaveRequests = () => safeFetch<LeaveRequest>('leave_requests');
export const getLeaveTransactions = () => safeFetch<LeaveTransaction>('leave_transactions');

export const upsertLeaveRequest = async (r: LeaveRequest) => {
    const { error } = await supabase.from('leave_requests').upsert(toSnakeCase(r));
    if (error) throw error;
};

export const deleteLeaveRequest = async (id: string) => {
    const { error } = await supabase.from('leave_requests').delete().eq('id', id);
    if (error) throw error;
};

export const upsertLeaveTransaction = async (t: LeaveTransaction) => {
    const { error } = await supabase.from('leave_transactions').upsert(toSnakeCase(t));
    if (error) throw error;
};

export const deleteLeaveTransaction = async (id: string) => {
    const { error } = await supabase.from('leave_transactions').delete().eq('id', id);
    if (error) throw error;
};

export const deleteLeaveTransactionsByRequestId = async (requestId: string) => {
    const { error } = await supabase.from('leave_transactions').delete().eq('related_leave_request_id', requestId);
    if (error) throw error;
};

export const deleteManualTransactionsInRange = async (staffId: string, startDate: string, endDate: string) => {
    const { error } = await supabase
        .from('leave_transactions')
        .delete()
        .eq('staff_id', staffId)
        .gte('date', startDate)
        .lte('date', endDate)
        .is('related_leave_request_id', null);
    if (error) throw error;
};

export const fixLedgerDuplicates = async (staffId: string): Promise<number> => {
    const { data: requests, error: reqError } = await supabase
        .from('leave_requests')
        .select('start_date, end_date')
        .eq('staff_id', staffId)
        .eq('status', 'approved');

    if (reqError) throw reqError;
    if (!requests || requests.length === 0) return 0;

    let deletedCount = 0;
    for (const req of requests) {
        const { error, count } = await supabase
            .from('leave_transactions')
            .delete({ count: 'exact' })
            .eq('staff_id', staffId)
            .gte('date', req.start_date)
            .lte('date', req.end_date)
            .is('related_leave_request_id', null);
        if (error) console.error("Error cleaning range:", error);
        if (count) deletedCount += count;
    }
    return deletedCount;
};
