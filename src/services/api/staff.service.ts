
import { supabase } from '../supabaseClient';
import { Staff, Department, Role } from '../../types';
import { toCamelCase, toSnakeCase, safeFetch, logSupabaseError } from './shared';

export const getRoles = () => safeFetch<Role>('roles');
export const getDepartments = () => safeFetch<Department>('departments');

export const getStaff = async (): Promise<Staff[]> => {
    const { data, error } = await supabase.from('staff').select('*');
    if (error) {
        logSupabaseError('staff', error);
        return [];
    }
    return (data || []).map((record: any) => {
        const camel = toCamelCase(record);
        if (record.custom_fields) {
            camel.customFields = record.custom_fields;
        }
        return camel;
    });
};

export const updateStaff = async (staffMember: Staff): Promise<Staff | null> => {
    const snakeStaff = toSnakeCase(staffMember);
    const { data, error } = await supabase.from('staff').update(snakeStaff).eq('id', staffMember.id).select().single();
    if (error) throw error;
    return toCamelCase(data);
};

export const insertStaff = async (staffMember: Partial<Staff>): Promise<Staff | null> => {
    const snakeStaff = toSnakeCase(staffMember);
    const { data, error } = await supabase.from('staff').insert(snakeStaff).select().single();
    if (error) throw error;
    return toCamelCase(data);
};

export const claimProfile = async (): Promise<boolean> => {
    const { data, error } = await supabase.rpc('claim_profile_by_email');
    if (error) {
        console.error("Error claiming profile:", error);
        return false;
    }
    return data === true;
};

export const deleteStaff = async (id: string): Promise<void> => {
    const { error } = await supabase.from('staff').delete().eq('id', id);
    if (error) throw error;
};

export const upsertDepartment = async (dept: Partial<Department>): Promise<Department | null> => {
    const snakeDept = toSnakeCase(dept);
    const { data, error } = await supabase.from('departments').upsert(snakeDept).select().single();
    if (error) throw error;
    return toCamelCase(data);
};

export const deleteDepartment = async (id: string): Promise<void> => {
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) throw error;
};

export const upsertRole = async (role: Role): Promise<void> => {
    const snakeRole = toSnakeCase(role);
    const { error } = await supabase.from('roles').upsert(snakeRole);
    if (error) throw error;
};

export const deleteRole = async (id: string): Promise<void> => {
    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (error) throw error;
};
