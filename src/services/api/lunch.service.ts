
import { supabase } from '../supabaseClient';
import { LunchMenu, LunchOrder } from '../../types';
import { toCamelCase, toSnakeCase, safeFetch } from './shared';

export const getLunchMenus = () => safeFetch<LunchMenu>('lunch_menus');
export const getLunchOrders = () => safeFetch<LunchOrder>('lunch_orders');

export const upsertLunchMenu = async (menu: Partial<LunchMenu>): Promise<void> => {
    const { error } = await supabase.from('lunch_menus').upsert(toSnakeCase(menu));
    if (error) throw error;
};

export const deleteLunchMenu = async (id: string): Promise<void> => {
    const { error } = await supabase.from('lunch_menus').delete().eq('id', id);
    if (error) throw error;
};

export const upsertLunchOrder = async (order: Partial<LunchOrder>): Promise<void> => {
    const { error } = await supabase.from('lunch_orders').upsert(toSnakeCase(order));
    if (error) throw error;
};
