
import { supabase } from '../supabaseClient';
import { FlightLogRecord, AircraftType, LicenseType, SpecialQualification, FlightHoursAdjustment, QualificationType } from '../../types';
import { toCamelCase, toSnakeCase, safeFetch, logSupabaseError } from './shared';

export const getFlightLogRecords = async (afterDate?: string): Promise<FlightLogRecord[]> => {
    let query = supabase.from('flight_log_records').select('*');
    if (afterDate) {
        query = query.gte('date', afterDate);
    }
    const { data, error } = await query;
    if (error) {
        logSupabaseError('flight_log_records', error);
        return [];
    }
    return (data || []).map((record: any) => {
        const camel = toCamelCase(record);
        if (record.flight_hours_by_aircraft) {
            camel.flightHoursByAircraft = record.flight_hours_by_aircraft;
        }
        return camel;
    });
};

export const getAircraftTypes = () => safeFetch<AircraftType>('aircraft_types');
export const getLicenseTypes = () => safeFetch<LicenseType>('license_types');
export const getSpecialQualifications = () => safeFetch<SpecialQualification>('special_qualifications');
export const getFlightHoursAdjustments = () => safeFetch<FlightHoursAdjustment>('flight_hours_adjustments');
export const getQualificationTypes = () => safeFetch<QualificationType>('qualification_types');

export const saveFlightLogForMonth = async (records: FlightLogRecord[], pilotId: string, monthKey: string): Promise<void> => {
    const snakeRecords = toSnakeCase(records);
    const { error } = await supabase.from('flight_log_records').upsert(snakeRecords);
    if (error) throw error;
};

export const upsertAircraftType = async (at: AircraftType) => {
    const { error } = await supabase.from('aircraft_types').upsert(toSnakeCase(at));
    if (error) throw error;
};

export const deleteAircraftType = async (id: string) => {
    const { error } = await supabase.from('aircraft_types').delete().eq('id', id);
    if (error) throw error;
};

export const upsertLicenseType = async (lt: LicenseType) => {
    const { error } = await supabase.from('license_types').upsert(toSnakeCase(lt));
    if (error) throw error;
};

export const deleteLicenseType = async (id: string) => {
    const { error } = await supabase.from('license_types').delete().eq('id', id);
    if (error) throw error;
};

export const upsertSpecialQualification = async (sq: SpecialQualification) => {
    const { error } = await supabase.from('special_qualifications').upsert(toSnakeCase(sq));
    if (error) throw error;
};

export const deleteSpecialQualification = async (id: string) => {
    const { error } = await supabase.from('special_qualifications').delete().eq('id', id);
    if (error) throw error;
};

export const upsertFlightHoursAdjustment = async (adj: FlightHoursAdjustment) => {
    const { error } = await supabase.from('flight_hours_adjustments').upsert(toSnakeCase(adj));
    if (error) throw error;
};

export const deleteFlightHoursAdjustment = async (id: string) => {
    const { error } = await supabase.from('flight_hours_adjustments').delete().eq('id', id);
    if (error) throw error;
};

export const upsertQualificationType = async (q: QualificationType) => {
    const { error } = await supabase.from('qualification_types').upsert(toSnakeCase(q));
    if (error) throw error;
};

export const deleteQualificationType = async (id: string) => {
    const { error } = await supabase.from('qualification_types').delete().eq('id', id);
    if (error) throw error;
};
