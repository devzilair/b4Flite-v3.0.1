
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import * as api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { RosterData, RosterMetaData, DepartmentalRosters, AllRosterMetaData, DutySwap } from '../types';

export const useRoster = () => {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const enabled = !!session;

    // --- QUERIES ---
    const rostersQuery = useQuery({
        queryKey: ['rosters'],
        queryFn: api.getRosters,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    const rosterMetadataQuery = useQuery({
        queryKey: ['roster_metadata'],
        queryFn: api.getRosterMetadata,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    const dutySwapsQuery = useQuery({
        queryKey: ['duty_swaps'],
        queryFn: api.getDutySwaps,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    // --- MUTATIONS ---
    const upsertRosterDataMutation = useMutation({
        mutationFn: (args: { monthKey: string, deptId: string, data: RosterData }) => 
            api.upsertRosterData(args.monthKey, args.deptId, args.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rosters'] });
        }
    });

    const upsertRosterMetadataMutation = useMutation({
        mutationFn: (args: { key: string, meta: RosterMetaData }) => 
            api.upsertRosterMetadata(args.key, args.meta),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roster_metadata'] });
        }
    });

    const upsertDutySwapMutation = useMutation({
        mutationFn: api.upsertDutySwap,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['duty_swaps'] });
        }
    });

    const deleteDutySwapMutation = useMutation({
        mutationFn: api.deleteDutySwap,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['duty_swaps'] });
        }
    });

    // --- REAL-TIME SUBSCRIPTIONS ---
    useEffect(() => {
        if (!enabled) return;

        const channel = supabase.channel('realtime-roster')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'rosters' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['rosters'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'roster_metadata' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['rosters'] }); // Metadata often drives UI locks on rosters
                    queryClient.invalidateQueries({ queryKey: ['roster_metadata'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'duty_swaps' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['duty_swaps'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, enabled]);

    return {
        rosters: (rostersQuery.data || {}) as DepartmentalRosters,
        rosterMetadata: (rosterMetadataQuery.data || {}) as AllRosterMetaData,
        dutySwaps: (dutySwapsQuery.data || []) as DutySwap[],
        loading: rostersQuery.isLoading || rosterMetadataQuery.isLoading || dutySwapsQuery.isLoading,
        error: rostersQuery.error || rosterMetadataQuery.error || dutySwapsQuery.error,
        
        upsertRosterData: (monthKey: string, deptId: string, data: RosterData) => 
            upsertRosterDataMutation.mutateAsync({ monthKey, deptId, data }),
            
        upsertRosterMetadata: (key: string, meta: RosterMetaData) => 
            upsertRosterMetadataMutation.mutateAsync({ key, meta }),

        upsertDutySwap: upsertDutySwapMutation.mutateAsync,
        deleteDutySwap: deleteDutySwapMutation.mutateAsync,
    };
};
