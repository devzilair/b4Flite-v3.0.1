
import { supabase } from '../supabaseClient';
import { DepartmentSettings, LeaveType, PublicHoliday, CustomFieldDefinition, ValidationRuleSet, RosterViewTemplate } from '../../types';
import { toCamelCase, toSnakeCase, safeFetch } from './shared';

export const getDepartmentSettings = async (): Promise<{ [key: string]: DepartmentSettings }> => {
    const data = await safeFetch<any>('department_settings');
    const settingsMap: { [key: string]: DepartmentSettings } = {};
    if (data && Array.isArray(data)) {
        data.forEach((item: any) => {
            settingsMap[item.departmentId] = {
                rosterSettings: item.rosterSettings,
                shiftCodes: item.shiftCodes,
                maxConcurrentLeave: item.maxConcurrentLeave,
                leaveAccrualPolicies: item.leaveAccrualPolicies,
                pilotRosterLayout: item.pilotRosterLayout,
                pilotRosterSettings: item.pilotRosterSettings,
                subDepartmentRules: item.subDepartmentRules || [],
                emailSettings: item.emailSettings || {}
            };
        });
    }
    return settingsMap;
};

export const getLeaveTypes = () => safeFetch<LeaveType>('leave_types');
export const getPublicHolidays = () => safeFetch<PublicHoliday>('public_holidays');
export const getCustomFieldDefs = () => safeFetch<CustomFieldDefinition>('custom_field_definitions');
export const getValidationRuleSets = () => safeFetch<ValidationRuleSet>('validation_rule_sets');
export const getRosterViewTemplates = () => safeFetch<RosterViewTemplate>('roster_view_templates');

export const upsertDepartmentSettings = async (settings: DepartmentSettings, deptId: string) => {
    const snakeSettings = toSnakeCase(settings);
    const record = { department_id: deptId, ...snakeSettings };
    const { error } = await supabase.from('department_settings').upsert(record);
    if (error) throw error;
};

export const upsertLeaveType = async (lt: LeaveType) => {
    const { error } = await supabase.from('leave_types').upsert(toSnakeCase(lt));
    if (error) throw error;
};

export const deleteLeaveType = async (id: string) => {
    const { error } = await supabase.from('leave_types').delete().eq('id', id);
    if (error) throw error;
};

export const upsertPublicHoliday = async (h: PublicHoliday) => {
    const { error } = await supabase.from('public_holidays').upsert(toSnakeCase(h));
    if (error) throw error;
};

export const deletePublicHoliday = async (date: string) => {
    const { error } = await supabase.from('public_holidays').delete().eq('date', date);
    if (error) throw error;
};

export const upsertCustomFieldDef = async (f: CustomFieldDefinition) => {
    const { error } = await supabase.from('custom_field_definitions').upsert(toSnakeCase(f));
    if (error) throw error;
};

export const deleteCustomFieldDef = async (id: string) => {
    const { error } = await supabase.from('custom_field_definitions').delete().eq('id', id);
    if (error) throw error;
};

export const upsertValidationRuleSet = async (rs: ValidationRuleSet) => {
    const { error } = await supabase.from('validation_rule_sets').upsert(toSnakeCase(rs));
    if (error) throw error;
};

export const deleteValidationRuleSet = async (id: string) => {
    const { error } = await supabase.from('validation_rule_sets').delete().eq('id', id);
    if (error) throw error;
};
