
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import * as api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { FsiDocument, FsiAcknowledgment } from '../types';

export const useFsi = () => {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const enabled = !!session;

    // --- QUERIES ---
    const docsQuery = useQuery({
        queryKey: ['fsi_documents'],
        queryFn: api.getFsiDocuments,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    const acksQuery = useQuery({
        queryKey: ['fsi_acknowledgments'],
        queryFn: api.getFsiAcknowledgments,
        staleTime: 1000 * 60 * 5,
        enabled
    });

    // --- MUTATIONS ---
    const upsertDocMutation = useMutation({
        mutationFn: async (args: { doc: FsiDocument, reset?: boolean }) => {
             await api.upsertFsiDocument(args.doc);
             if (args.reset) {
                 await api.deleteFsiAcknowledgments(args.doc.id);
             }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fsi_documents'] });
            queryClient.invalidateQueries({ queryKey: ['fsi_acknowledgments'] }); // In case of reset
        }
    });

    const deleteDocMutation = useMutation({
        mutationFn: api.deleteFsiDocument,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fsi_documents'] });
            queryClient.invalidateQueries({ queryKey: ['fsi_acknowledgments'] });
        }
    });

    const ackMutation = useMutation({
        mutationFn: api.upsertFsiAcknowledgment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fsi_acknowledgments'] });
        }
    });

    // --- REAL-TIME SUBSCRIPTIONS ---
    useEffect(() => {
        if (!enabled) return;

        const channel = supabase.channel('realtime-fsi')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'fsi_documents' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['fsi_documents'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'fsi_acknowledgments' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['fsi_acknowledgments'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, enabled]);

    return {
        fsiDocuments: docsQuery.data || [],
        fsiAcks: acksQuery.data || [],
        loading: docsQuery.isLoading || acksQuery.isLoading,
        error: docsQuery.error || acksQuery.error,

        addFsiDoc: (doc: FsiDocument) => upsertDocMutation.mutateAsync({ doc }),
        updateFsiDoc: (doc: FsiDocument, resetAcknowledgments?: boolean) => upsertDocMutation.mutateAsync({ doc, reset: resetAcknowledgments }),
        deleteFsiDoc: deleteDocMutation.mutateAsync,
        addFsiAck: (ack: FsiAcknowledgment) => ackMutation.mutateAsync(ack),
    };
};
