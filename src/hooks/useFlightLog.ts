
import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import * as api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { FlightLogRecord, FlightHoursAdjustment } from '../types';

export const useFlightLog = (includeHistory: boolean = false) => {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const enabled = !!session;

    // Calculate Active Window Cutoff (Today - 366 days)
    const cutoffDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 366);
        return d.toISOString().split('T')[0];
    }, []);

    // --- QUERIES ---
    // Mode 1: Windowed (Default) - Fetches recent logs for FTL calculations
    // Mode 2: Full History - Fetches everything for Lifetime Experience Reports
    const flightLogsQuery = useQuery({
        queryKey: ['flight_log_records', includeHistory ? 'all' : 'windowed'],
        queryFn: () => api.getFlightLogRecords(includeHistory ? undefined : cutoffDate),
        staleTime: 1000 * 60 * 5, // 5 mins
        enabled
    });

    const flightAdjQuery = useQuery({
        queryKey: ['flight_hours_adjustments'],
        queryFn: api.getFlightHoursAdjustments,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    // --- MUTATIONS ---
    const flightLogMutation = useMutation({
        mutationFn: (args: { records: FlightLogRecord[], pilotId: string, monthKey: string }) => 
            api.saveFlightLogForMonth(args.records, args.pilotId, args.monthKey),
        onSuccess: (_data, variables) => {
            // Optimistic Update for Windowed Cache
            queryClient.setQueryData<FlightLogRecord[]>(['flight_log_records', 'windowed'], (oldRecords) => {
                if (!oldRecords) return variables.records;
                const newRecordsMap = new Map(variables.records.map(r => [r.date, r]));
                const filtered = oldRecords.filter(r => r.staffId !== variables.pilotId || !newRecordsMap.has(r.date));
                return [...filtered, ...variables.records];
            });

            // Invalidate BOTH keys to ensure consistency
            queryClient.invalidateQueries({ queryKey: ['flight_log_records'] });
        }
    });

    const flightAdjMutation = useMutation({
        mutationFn: api.upsertFlightHoursAdjustment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flight_hours_adjustments'] });
        }
    });

    const deleteFlightAdjMutation = useMutation({
        mutationFn: api.deleteFlightHoursAdjustment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flight_hours_adjustments'] });
        }
    });

    // --- REAL-TIME SUBSCRIPTIONS ---
    useEffect(() => {
        if (!enabled) return;

        const channel = supabase.channel('realtime-flight-logs')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'flight_log_records' },
                () => {
                    // Invalidate root key to refresh both windowed and full queries
                    queryClient.invalidateQueries({ queryKey: ['flight_log_records'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'flight_hours_adjustments' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['flight_hours_adjustments'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, enabled]);

    return {
        flightLogRecords: flightLogsQuery.data || [],
        flightHoursAdjustments: flightAdjQuery.data || [],
        loading: flightLogsQuery.isLoading || flightAdjQuery.isLoading,
        error: flightLogsQuery.error || flightAdjQuery.error,

        saveFlightLogs: (records: FlightLogRecord[], pilotId: string, monthKey: string) => 
            flightLogMutation.mutateAsync({ records, pilotId, monthKey }),
            
        upsertFlightHoursAdjustment: flightAdjMutation.mutateAsync,
        deleteFlightHoursAdjustment: deleteFlightAdjMutation.mutateAsync,
    };
};
