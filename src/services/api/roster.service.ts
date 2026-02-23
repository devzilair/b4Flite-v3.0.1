
import { supabase } from '../supabaseClient';
import { DepartmentalRosters, AllRosterMetaData, RosterData, RosterMetaData, DutySwap } from '../../types';
import { toCamelCase, toSnakeCase, safeFetch, logSupabaseError } from './shared';

export const getRosters = async (): Promise<DepartmentalRosters> => {
    const { data, error } = await supabase.from('rosters').select('*');
    if (error) {
        logSupabaseError('rosters', error);
        return {};
    }
    const rosters: DepartmentalRosters = {};
    if (data && Array.isArray(data)) {
        data.forEach((row: any) => {
            if (!rosters[row.month_key]) rosters[row.month_key] = {};
            rosters[row.month_key][row.department_id] = row.roster_data;
        });
    }
    return rosters;
};

export const getRosterMetadata = async (): Promise<AllRosterMetaData> => {
    const { data, error } = await supabase.from('roster_metadata').select('*');
    if (error) {
        logSupabaseError('roster_metadata', error);
        return {};
    }
    const meta: AllRosterMetaData = {};
    if (data && Array.isArray(data)) {
        data.forEach((row: any) => {
            meta[row.id] = toCamelCase(row.metadata);
        });
    }
    return meta;
};

export const upsertRosterData = async (monthKey: string, deptId: string, data: RosterData): Promise<void> => {
    const record = { month_key: monthKey, department_id: deptId, roster_data: data };
    const { error } = await supabase.from('rosters').upsert(record);
    if (error) throw error;
};

export const upsertRosterMetadata = async (key: string, meta: RosterMetaData): Promise<void> => {
    const record = { id: key, metadata: toSnakeCase(meta) };
    const { error } = await supabase.from('roster_metadata').upsert(record);
    if (error) throw error;
};

export const getDutySwaps = () => safeFetch<DutySwap>('duty_swaps');

export const upsertDutySwap = async (swap: DutySwap): Promise<void> => {
    const { error } = await supabase.from('duty_swaps').upsert(toSnakeCase(swap));
    if (error) throw error;
};

export const deleteDutySwap = async (id: string): Promise<void> => {
    const { error } = await supabase.from('duty_swaps').delete().eq('id', id);
    if (error) throw error;
};
