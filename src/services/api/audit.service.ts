
import { supabase } from '../supabaseClient';
import { AuditLog } from '../../types';
import { toCamelCase, logSupabaseError } from './shared';

export const getAuditLogs = async (
    page: number = 1,
    pageSize: number = 30,
    filters?: {
        search?: string;
        tableName?: string;
        operation?: string;
    }
): Promise<{ data: AuditLog[], count: number }> => {
    const { data, error } = await supabase.rpc('get_audit_logs', {
        page_num: page,
        page_size: pageSize,
        search_term: filters?.search || '',
        table_filter: filters?.tableName || 'all',
        op_filter: filters?.operation || 'all'
    });

    if (!error && data) {
        const firstRow = data[0] || {};
        const count = firstRow.total_count || firstRow.full_count || 0;
        const camelData = (toCamelCase(data) || []).map((log: any) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { totalCount, fullCount, ...rest } = log;
            return rest;
        });

        return { data: camelData as AuditLog[], count: Number(count) };
    }

    if (error) {
        console.warn('Audit Log RPC failed (falling back to direct query):', error.message);
        let query = supabase.from('audit_logs').select('*', { count: 'exact' });

        if (filters?.tableName && filters.tableName !== 'all') {
            query = query.eq('table_name', filters.tableName);
        }
        if (filters?.operation && filters.operation !== 'all') {
            query = query.eq('operation', filters.operation);
        }
        if (filters?.search) {
            query = query.or(`record_id.ilike.%${filters.search}%,table_name.ilike.%${filters.search}%`);
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data: directData, count: directCount, error: directError } = await query
            .order('changed_at', { ascending: false })
            .range(from, to);

        if (directError) {
            logSupabaseError('get_audit_logs_fallback', directError);
            return { data: [], count: 0 };
        }

        return {
            data: (toCamelCase(directData) || []) as AuditLog[],
            count: directCount || 0
        };
    }

    return { data: [], count: 0 };
};

export const cleanupAuditLogs = async (retentionDays: number) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { error } = await supabase
        .from('audit_logs')
        .delete()
        .lt('changed_at', cutoffDate.toISOString());

    if (error) throw error;
};

export const revertAuditLog = async (id: string): Promise<void> => {
    const { error } = await supabase.rpc('revert_audit_log', { target_log_id: id });
    if (error) throw error;
};
