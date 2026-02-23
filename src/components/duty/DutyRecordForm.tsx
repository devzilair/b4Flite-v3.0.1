
import React, { useState, useEffect, useMemo } from 'react';
import { FlightLogRecord, AircraftType, Staff } from '@/types';
import { calculateDurationHours, decimalToTime, timeToDecimal } from '@/services/ftlCalculations';
import { DutyRecordSchema } from '@/schemas';

interface DutyRecordFormProps {
    record: Partial<FlightLogRecord> & any; // Accepts MonthlyDayRecord with rest/FTL info
    onSave: (record: Partial<FlightLogRecord>) => void;
    onDelete: (recordId: string) => void;
    onClose: () => void;
    aircraftTypes?: AircraftType[];
    pilot?: Staff;
}

const DutyRecordForm: React.FC<DutyRecordFormProps> = ({ record, onSave, onDelete, onClose, aircraftTypes = [], pilot }) => {
    const [formData, setFormData] = useState<Partial<FlightLogRecord>>(record);
    const [includesFdp, setIncludesFdp] = useState(false);
    const [hasStandby, setHasStandby] = useState(false);
    const [flightTimeInput, setFlightTimeInput] = useState('');
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    // Defensive check for aircraftTypes to prevent map errors
    const safeAircraftTypes = useMemo(() => Array.isArray(aircraftTypes) ? aircraftTypes : [], [aircraftTypes]);

    const isHelicopter = pilot?.pilotData?.aircraftCategory?.includes('Helicopter');

    useEffect(() => {
        // Coerce null booleans to false on load
        setFormData({
            ...record,
            isTwoPilotOperation: record.isTwoPilotOperation ?? false,
            isSplitDuty: record.isSplitDuty ?? false
        });

        const hasFlightData = !!(record.fdpStart || record.fdpEnd || record.aircraftType || (record.flightHoursByAircraft && Object.keys(record.flightHoursByAircraft).length > 0));
        setIncludesFdp(hasFlightData);
        setHasStandby(!!(record.standbyOn || record.standbyOff));

        let totalHours = 0;
        if (record.flightHoursByAircraft && Object.keys(record.flightHoursByAircraft).length > 0) {
            totalHours = (Object.values(record.flightHoursByAircraft) as number[]).reduce((sum: number, h: number) => sum + (Number(h) || 0), 0);
        } else if (record.flightOn && record.flightOff) {
            totalHours = calculateDurationHours(record.flightOn, record.flightOff);
        }
        setFlightTimeInput(totalHours > 0 ? decimalToTime(totalHours) : '');
        setValidationErrors([]);
    }, [record]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            if (name === 'isSplitDuty' && !checked) {
                setFormData(prev => ({ ...prev, [name]: checked, breakStart: '', breakEnd: '' }));
            } else {
                setFormData(prev => ({ ...prev, [name]: checked }));
            }
        } else if (type === 'number') {
            setFormData(prev => ({ ...prev, [name]: value === '' ? null : parseInt(value, 10) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        setValidationErrors([]);
    };

    const handleFdpCheck = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isChecked = e.target.checked;
        setIncludesFdp(isChecked);
        if (isChecked) {
            setFormData(prev => ({
                ...prev,
                fdpStart: prev.fdpStart || prev.dutyStart || '',
                fdpEnd: prev.fdpEnd || prev.dutyEnd || '',
                aircraftType: prev.aircraftType || (safeAircraftTypes.length > 0 ? safeAircraftTypes[0].id : ''),
                sectors: prev.sectors || null
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                fdpStart: '',
                fdpEnd: '',
                aircraftType: '',
                flightHoursByAircraft: {},
                flightOn: '',
                flightOff: '',
                sectors: null as any
            }));
            setFlightTimeInput('');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setValidationErrors([]);

        // Ensure flags are booleans not null
        const cleanPayload = {
            ...formData,
            isTwoPilotOperation: !!formData.isTwoPilotOperation,
            isSplitDuty: !!formData.isSplitDuty,
            // Ensure aircraftType is null if empty string to match optional() schema nicely
            aircraftType: formData.aircraftType || null,
        };

        const result = DutyRecordSchema.safeParse(cleanPayload);
        if (!result.success) {
            console.error("Duty Record Validation Failed:", result.error);
            // Fix: Add defensive check for errors array existence
            const errors = (result.error.errors || []).map(err => `${err.path.join('.')}: ${err.message}`);
            setValidationErrors(errors.length > 0 ? errors : ["Validation failed (Check console for details)"]);
            return;
        }

        const finalRecord = { ...cleanPayload };
        if (includesFdp) {
            if (!finalRecord.fdpStart || !finalRecord.fdpEnd) {
                setValidationErrors(["FDP Start and End are required for flight duty."]);
                return;
            }
            const decimalHours = timeToDecimal(flightTimeInput);
            if (decimalHours > 0) {
                const key = finalRecord.aircraftType || 'LOG';

                // CRITICAL FIX: Preserve existing complex flight hours if present
                const existingHours = formData.flightHoursByAircraft || {};
                const hasComplexData = Object.keys(existingHours).length > 1;

                if (hasComplexData) {
                    // If multiple aircraft types are already logged, do NOT overwrite with the simple form input.
                    // We assume the user is editing FDP/Duty times but keeping the complex breakdown.
                    finalRecord.flightHoursByAircraft = existingHours;
                } else {
                    // Simple case: overwrite/set the single aircraft hours
                    finalRecord.flightHoursByAircraft = { [key]: decimalHours };
                }
            }
        }

        onSave(finalRecord);
    };

    // NOTE: Removed onClick={onClose} from the outer div to prevent accidental closure when clicking backdrop.
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center sm:p-4">
            <div className="bg-white dark:bg-gray-800 sm:rounded-lg shadow-2xl w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/30">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Duty Entry</h2>
                        <p className="text-xs text-gray-500 uppercase font-semibold">{formData.date}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 text-3xl hover:text-gray-600 transition-colors">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

                    {record.rest && (
                        <div className={`p-3 rounded-md border flex justify-between items-center ${!record.rest.hasHistory ? 'bg-gray-50 border-gray-200 dark:bg-gray-700/50' : record.rest.restViolation ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800'}`}>
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Rest Period Before Duty</p>
                                <p className={`text-lg font-bold ${!record.rest.hasHistory ? 'text-gray-400' : record.rest.restViolation ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                                    {record.rest.hasHistory ? `${decimalToTime(record.rest.restPeriod, true)} Hours` : 'No History Found'}
                                </p>
                            </div>
                            {record.rest.hasHistory ? (
                                record.rest.restViolation && (
                                    <div className="text-right">
                                        <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse uppercase">Violation</span>
                                        <p className="text-[9px] text-red-600 dark:text-red-400 mt-1 max-w-[150px]">Min 10 hours required.</p>
                                    </div>
                                )
                            ) : (
                                <div className="text-right">
                                    <p className="text-[9px] text-gray-400 italic max-w-[150px]">Previous duty end time is missing or not recorded yet.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {validationErrors && Array.isArray(validationErrors) && validationErrors.length > 0 && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md shadow-sm">
                            <p className="font-bold text-sm mb-1 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                Validation Errors
                            </p>
                            <ul className="list-disc pl-5 text-xs">
                                {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Entry Date</label>
                            <input type="date" name="date" value={formData.date || ''} onChange={handleChange} required className="w-full form-input" />
                        </div>
                        <div className="col-span-2 sm:col-span-1 flex flex-col justify-end">
                            <div className="flex gap-4 p-2 bg-gray-50 dark:bg-gray-700/50 rounded border dark:border-gray-600">
                                <label className="flex items-center cursor-pointer select-none">
                                    <input type="checkbox" name="isTwoPilotOperation" checked={formData.isTwoPilotOperation || false} onChange={handleChange} className="h-4 w-4 text-brand-primary rounded" />
                                    <span className="ml-2 text-xs font-medium uppercase text-gray-600 dark:text-gray-300">Multi-Pilot</span>
                                </label>
                                <label className="flex items-center cursor-pointer select-none">
                                    <input type="checkbox" name="isSplitDuty" checked={formData.isSplitDuty || false} onChange={handleChange} className="h-4 w-4 text-brand-primary rounded" />
                                    <span className="ml-2 text-xs font-medium uppercase text-gray-600 dark:text-gray-300">Split Duty</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 p-4 bg-stone-50 dark:bg-stone-800/30 rounded-lg border dark:border-stone-700">
                        <div className="col-span-2 border-b dark:border-stone-700 pb-2 mb-2">
                            <h3 className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-widest">Duty Window</h3>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-gray-500">Duty Start</label>
                            <input type="time" name="dutyStart" value={formData.dutyStart || ''} onChange={handleChange} className="w-full form-input font-mono" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-gray-500">Duty End</label>
                            <input type="time" name="dutyEnd" value={formData.dutyEnd || ''} onChange={handleChange} className="w-full form-input font-mono" />
                        </div>
                    </div>

                    {formData.isSplitDuty && (
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200 dark:border-orange-800/50 animate-fade-in shadow-inner">
                            <h3 className="text-xs font-bold text-orange-800 dark:text-orange-300 uppercase mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Break Period
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase mb-1">Break Start</label>
                                    <input type="time" name="breakStart" value={formData.breakStart || ''} onChange={handleChange} className="w-full form-input-orange font-mono" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase mb-1">Break End</label>
                                    <input type="time" name="breakEnd" value={formData.breakEnd || ''} onChange={handleChange} className="w-full form-input-orange font-mono" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t dark:border-gray-600">
                        <label className="flex items-center cursor-pointer mb-4 group">
                            <input type="checkbox" checked={includesFdp} onChange={handleFdpCheck} className="h-5 w-5 text-brand-primary rounded transition-all group-hover:scale-110" />
                            <span className="ml-3 text-sm font-bold text-brand-primary uppercase tracking-tight">Include Flight Details (FDP)</span>
                        </label>

                        {includesFdp && (
                            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800/50 animate-fade-in shadow-inner">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase mb-1">FDP Start</label>
                                        <input type="time" name="fdpStart" value={formData.fdpStart || ''} onChange={handleChange} className="w-full form-input-blue font-mono" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase mb-1">FDP End</label>
                                        <input type="time" name="fdpEnd" value={formData.fdpEnd || ''} onChange={handleChange} className="w-full form-input-blue font-mono" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase mb-1">Type Rating</label>
                                        <select name="aircraftType" value={formData.aircraftType || ''} onChange={handleChange} className="w-full form-input-blue">
                                            <option value="" disabled>Select rating...</option>
                                            {Array.isArray(safeAircraftTypes) && safeAircraftTypes.map(at => (
                                                <option key={at.id} value={at.id}>{at.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase mb-1">
                                            Sectors Flown {isHelicopter ? '(Optional)' : '(Required)'}
                                        </label>
                                        <input
                                            type="number"
                                            name="sectors"
                                            value={formData.sectors === undefined || formData.sectors === null ? '' : formData.sectors}
                                            onChange={handleChange}
                                            className="w-full form-input-blue font-mono"
                                            min="0"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase mb-1">Total Block Time (HH:MM)</label>
                                    <input type="text" value={flightTimeInput} onChange={e => setFlightTimeInput(e.target.value.toUpperCase())} placeholder="00:00" className="w-full form-input-blue font-mono text-lg" />
                                </div>
                                {formData.flightHoursByAircraft && Object.keys(formData.flightHoursByAircraft).length > 1 && (
                                    <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded text-xs text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
                                        <strong>Note:</strong> Multiple aircraft types recorded. The total block time above will update the hours, but the detailed breakdown by aircraft type will be preserved.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t dark:border-gray-600">
                        <label className="flex items-center cursor-pointer mb-4 group">
                            <input type="checkbox" checked={hasStandby} onChange={(e) => setHasStandby(e.target.checked)} className="h-5 w-5 text-green-600 rounded transition-all group-hover:scale-110" />
                            <span className="ml-3 text-sm font-bold text-green-700 dark:text-green-400 uppercase tracking-tight">Standby Duty</span>
                        </label>
                        {hasStandby && (
                            <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800/50 animate-fade-in shadow-inner">
                                <div>
                                    <label className="block text-[10px] font-bold text-green-700 dark:text-green-400 uppercase mb-1">Standby On</label>
                                    <input type="time" name="standbyOn" value={formData.standbyOn || ''} onChange={handleChange} className="w-full form-input-green font-mono" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-green-700 dark:text-green-400 uppercase mb-1">Standby Off</label>
                                    <input type="time" name="standbyOff" value={formData.standbyOff || ''} onChange={handleChange} className="w-full form-input-green font-mono" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Remarks / Notes</label>
                        <textarea name="remarks" value={formData.remarks || ''} onChange={handleChange} rows={2} className="w-full form-input text-sm" placeholder="Details..." />
                    </div>
                </form>

                <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center sm:rounded-b-lg">
                    {record.id ? (
                        <button type="button" onClick={() => { if (confirm('Delete record?')) onDelete(record.id!); }} className="text-red-600 hover:text-red-700 text-xs font-bold uppercase tracking-widest underline decoration-2 underline-offset-4">Delete Entry</button>
                    ) : <div />}
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 text-gray-700 dark:text-white rounded-md hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors text-sm font-semibold">Cancel</button>
                        <button type="submit" onClick={handleSubmit} className="px-8 py-2 bg-brand-primary text-white rounded-md font-bold hover:bg-brand-secondary shadow-lg transition-all transform active:scale-95 text-sm uppercase tracking-wide">Save Record</button>
                    </div>
                </div>
                <style>{`
                    .form-input { display: block; width: 100%; padding: 0.6rem 0.75rem; font-size: 0.875rem; background-color: white; border: 1px solid #D1D5DB; border-radius: 0.375rem; transition: border-color 0.2s; }
                    .form-input:focus { border-color: #0D47A1; outline: none; box-shadow: 0 0 0 1px rgba(13, 71, 161, 0.1); }
                    .dark .form-input { background-color: #374151; border-color: #4B5563; color: white; }
                    .form-input-blue { border-color: #bfdbfe; }
                    .form-input-orange { border-color: #fed7aa; }
                    .form-input-green { border-color: #bbf7d0; }
                    .dark .form-input-blue { border-color: #1e3a8a; }
                    .dark .form-input-orange { border-color: #7c2d12; }
                    .dark .form-input-green { border-color: #064e3b; }
                `}</style>
            </div>
        </div>
    );
};

export default DutyRecordForm;
