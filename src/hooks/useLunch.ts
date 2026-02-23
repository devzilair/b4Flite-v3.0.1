
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import * as api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { LunchMenu, LunchOrder } from '../types';

export const useLunch = () => {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const enabled = !!session;

    const lunchMenusQuery = useQuery({
        queryKey: ['lunch_menus'],
        queryFn: api.getLunchMenus,
        staleTime: 1000 * 60 * 5, // 5 mins
        enabled
    });

    const lunchOrdersQuery = useQuery({
        queryKey: ['lunch_orders'],
        queryFn: api.getLunchOrders,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    const upsertLunchMenuMutation = useMutation({
        mutationFn: api.upsertLunchMenu,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lunch_menus'] });
        }
    });

    const deleteLunchMenuMutation = useMutation({
        mutationFn: api.deleteLunchMenu,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lunch_menus'] });
        }
    });

    const upsertLunchOrderMutation = useMutation({
        mutationFn: api.upsertLunchOrder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lunch_orders'] });
            queryClient.invalidateQueries({ queryKey: ['lunch_menus'] }); // To refresh counts in admin view
        }
    });

    // Realtime subscription for Lunch Module
    useEffect(() => {
        if (!enabled) return;

        const channel = supabase.channel('realtime-lunch')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'lunch_orders' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['lunch_orders'] });
                    // Refresh menus too as order counts are often displayed there
                    queryClient.invalidateQueries({ queryKey: ['lunch_menus'] }); 
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'lunch_menus' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['lunch_menus'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, enabled]);

    return {
        lunchMenus: lunchMenusQuery.data || [],
        lunchOrders: lunchOrdersQuery.data || [],
        loading: lunchMenusQuery.isLoading || lunchOrdersQuery.isLoading,
        error: lunchMenusQuery.error || lunchOrdersQuery.error,
        upsertLunchMenu: upsertLunchMenuMutation.mutateAsync,
        deleteLunchMenu: deleteLunchMenuMutation.mutateAsync,
        upsertLunchOrder: upsertLunchOrderMutation.mutateAsync,
    };
};
