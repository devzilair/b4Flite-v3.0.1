
import { supabase } from '../supabaseClient';
import { FsiDocument, FsiAcknowledgment } from '../../types';
import { toCamelCase, toSnakeCase, safeFetch } from './shared';

export const getFsiDocuments = () => safeFetch<FsiDocument>('fsi_documents');
export const getFsiAcknowledgments = () => safeFetch<FsiAcknowledgment>('fsi_acknowledgments');

export const upsertFsiDocument = async (doc: Partial<FsiDocument>): Promise<void> => {
    const { error } = await supabase.from('fsi_documents').upsert(toSnakeCase(doc));
    if (error) throw error;
};

export const deleteFsiDocument = async (id: string): Promise<void> => {
    const { error } = await supabase.from('fsi_documents').delete().eq('id', id);
    if (error) throw error;
};

export const deleteFsiAcknowledgments = async (docId: string): Promise<void> => {
    const { error } = await supabase.from('fsi_acknowledgments').delete().eq('document_id', docId);
    if (error) throw error;
};

export const upsertFsiAcknowledgment = async (ack: Partial<FsiAcknowledgment>): Promise<void> => {
    const { error } = await supabase.from('fsi_acknowledgments').upsert(toSnakeCase(ack));
    if (error) throw error;
};
