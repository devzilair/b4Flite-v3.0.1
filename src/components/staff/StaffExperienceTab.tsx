
import React, { useState, useMemo } from 'react';
import { Staff, FlightHoursAdjustment, MajorType, AircraftType } from '../../types';
import { useSettings } from '../../hooks/useSettings';
import { calculateDurationHours } from '../../utils/timeUtils';
import { sanitizeString } from '../../utils/sanitization';
import { useFlightLog } from '../../hooks/useFlightLog';

interface StaffExperienceTabProps {
    staff: Partial<Staff>;
    setStaff: React.Dispatch<React.SetStateAction<Partial<Staff>>>;
}

const StaffExperienceTab: React.FC<StaffExperienceTabProps> = ({ staff, setStaff }) => {
    const { aircraftTypes } = useSettings();
    const { flightLogRecords, flightHoursAdjustments, upsertFlightHoursAdjustment, deleteFlightHoursAdjustment } = useFlightLog();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAdjustment, setEditingAdjustment] = useState<FlightHoursAdjustment | null>(null);

    // --- CALCULATIONS ---

    const totals = useMemo(() => {
        let internalTotal = 0;
        let internalTurbine = 0;
        let internalMulti = 0;
        let internalRotor = 0;
        let internalFixed = 0;
        
        const internalByType: Record<string, number> = {}; // typeId -> hours

        if (!staff.id) return {
            total: { internal: 0, adjustment: 0, grand: 0 },
            turbine: { internal: 0, adjustment: 0, grand: 0 },
            multi: { internal: 0, adjustment: 0, grand: 0 },
            rotor: { internal: 0, adjustment: 0, grand: 0 },
            fixed: { internal: 0, adjustment: 0, grand: 0 },
            typeBreakdown: { internal: {}, adjustment: {} }
        };

        // Process Internal Flight Logs
        const myLogs = flightLogRecords.filter(r => r.staffId === staff.id);
        
        myLogs.forEach(log => {
            // Case 1: Detailed breakdown available
            if (log.flightHoursByAircraft && Object.keys(log.flightHoursByAircraft).length > 0) {
                Object.entries(log.flightHoursByAircraft).forEach(([typeId, hours]) => {
                    const h = Number(hours) || 0;
                    const type = aircraftTypes.find(at => at.id === typeId);
                    
                    internalTotal += h;
                    if (type) {
                        internalByType[type.id] = (internalByType[type.id] || 0) + h;
                        if (type.isTurbine) internalTurbine += h;
                        if (type.isMultiEngine) internalMulti += h;
                        if (type.category === 'Helicopter') internalRotor += h;
                        if (type.category === 'Fixed Wing') internalFixed += h;
                    }
                });
            } 
            // Case 2: Legacy/Simple logs (single aircraft type per record)
            else if (log.flightOn && log.flightOff) {
                const h = calculateDurationHours(log.flightOn, log.flightOff);
                const typeId = log.aircraftType;
                const type = aircraftTypes.find(at => at.id === typeId);

                internalTotal += h;
                if (type) {
                    internalByType[type.id] = (internalByType[type.id] || 0) + h;
                    if (type.isTurbine) internalTurbine += h;
                    if (type.isMultiEngine) internalMulti += h;
                    if (type.category === 'Helicopter') internalRotor += h;
                    if (type.category === 'Fixed Wing') internalFixed += h;
                }
            }
        });

        // Process Adjustments
        const myAdjustments = flightHoursAdjustments.filter(a => a.staffId === staff.id);
        
        let adjTotal = 0;
        let adjTurbine = 0;
        let adjMulti = 0;
        let adjRotor = 0;
        let adjFixed = 0;
        const adjByType: Record<string, number> = {};

        myAdjustments.forEach(adj => {
            const h = adj.hours;
            adjTotal += h;
            
            if (adj.isTurbine) adjTurbine += h;
            if (adj.isMultiEngine) adjMulti += h;
            if (adj.category === 'Helicopter') adjRotor += h;
            if (adj.category === 'Fixed Wing') adjFixed += h;

            if (adj.aircraftTypeId) {
                adjByType[adj.aircraftTypeId] = (adjByType[adj.aircraftTypeId] || 0) + h;
            }
        });

        return {
            total: { internal: internalTotal, adjustment: adjTotal, grand: internalTotal + adjTotal },
            turbine: { internal: internalTurbine, adjustment: adjTurbine, grand: internalTurbine + adjTurbine },
            multi: { internal: internalMulti, adjustment: adjMulti, grand: internalMulti + adjMulti },
            rotor: { internal: internalRotor, adjustment: adjRotor, grand: internalRotor + adjRotor },
            fixed: { internal: internalFixed, adjustment: adjFixed, grand: internalFixed + adjFixed },
            typeBreakdown: { internal: internalByType, adjustment: adjByType }
        };

    }, [flightLogRecords, flightHoursAdjustments, aircraftTypes, staff.id]);

    const handleDelete = async (id: string) => {
        if (confirm('Delete this adjustment?')) {
            await deleteFlightHoursAdjustment(id);
        }
    };

    const handleUpdatePilotData = (field: 'fireFightingHours' | 'slungCargoHours', value: number) => {
        setStaff(prev => ({
            ...prev,
            pilotData: {
                ...(prev.pilotData || {}),
                [field]: value
            }
        }));
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Experience Ledger</h2>
                <button 
                    onClick={() => { setEditingAdjustment(null); setIsModalOpen(true); }}
                    className="bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-brand-secondary"
                >
                    + Add Adjustment
                </button>
            </div>

            {/* TOTALS MATRIX */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-700 font-bold text-gray-700 dark:text-gray-200 uppercase text-xs">
                        <tr>
                            <th className="p-3">Metric</th>
                            <th className="p-3 text-right">Internal (Logged)</th>
                            <th className="p-3 text-right">Adjustments (External)</th>
                            <th className="p-3 text-right bg-gray-200 dark:bg-gray-600">Total Hours</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="p-3 font-bold">Total Aeronautical Experience</td>
                            <td className="p-3 text-right">{totals.total.internal.toFixed(1)}</td>
                            <td className="p-3 text-right">{totals.total.adjustment.toFixed(1)}</td>
                            <td className="p-3 text-right font-bold text-lg bg-gray-50 dark:bg-gray-800">{totals.total.grand.toFixed(1)}</td>
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="p-3 font-medium text-gray-600 dark:text-gray-300">Turbine Engine</td>
                            <td className="p-3 text-right">{totals.turbine.internal.toFixed(1)}</td>
                            <td className="p-3 text-right">{totals.turbine.adjustment.toFixed(1)}</td>
                            <td className="p-3 text-right font-semibold bg-gray-50 dark:bg-gray-800">{totals.turbine.grand.toFixed(1)}</td>
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="p-3 font-medium text-gray-600 dark:text-gray-300">Multi-Engine</td>
                            <td className="p-3 text-right">{totals.multi.internal.toFixed(1)}</td>
                            <td className="p-3 text-right">{totals.multi.adjustment.toFixed(1)}</td>
                            <td className="p-3 text-right font-semibold bg-gray-50 dark:bg-gray-800">{totals.multi.grand.toFixed(1)}</td>
                        </tr>
                        <tr className="bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100">
                            <td className="p-3 font-medium text-gray-600 dark:text-gray-300">Rotorcraft (Helicopter)</td>
                            <td className="p-3 text-right">{totals.rotor.internal.toFixed(1)}</td>
                            <td className="p-3 text-right">{totals.rotor.adjustment.toFixed(1)}</td>
                            <td className="p-3 text-right font-semibold">{totals.rotor.grand.toFixed(1)}</td>
                        </tr>
                        <tr className="bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100">
                            <td className="p-3 font-medium text-gray-600 dark:text-gray-300">Fixed Wing (Aeroplane)</td>
                            <td className="p-3 text-right">{totals.fixed.internal.toFixed(1)}</td>
                            <td className="p-3 text-right">{totals.fixed.adjustment.toFixed(1)}</td>
                            <td className="p-3 text-right font-semibold">{totals.fixed.grand.toFixed(1)}</td>
                        </tr>
                        
                        {/* Breakdown by Type (If any exist) */}
                        {aircraftTypes.map(at => {
                            const internal = totals.typeBreakdown.internal[at.id] || 0;
                            const adj = totals.typeBreakdown.adjustment[at.id] || 0;
                            if (internal === 0 && adj === 0) return null;
                            
                            return (
                                <tr key={at.id} className="text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="p-3 pl-6 border-l-4 border-gray-300">Type: {at.name}</td>
                                    <td className="p-3 text-right">{internal.toFixed(1)}</td>
                                    <td className="p-3 text-right">{adj.toFixed(1)}</td>
                                    <td className="p-3 text-right font-medium bg-gray-50 dark:bg-gray-800">{(internal + adj).toFixed(1)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* SPECIALIZED OPERATIONS EXPERIENCE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800 flex justify-between items-center">
                    <div className="flex-1">
                        <p className="text-xs font-bold text-red-800 dark:text-red-300 uppercase mb-1">Fire Fighting Experience</p>
                        <div className="flex items-center">
                             <input 
                                type="number"
                                min="0"
                                step="0.1"
                                value={staff.pilotData?.fireFightingHours || ''}
                                onChange={(e) => handleUpdatePilotData('fireFightingHours', parseFloat(e.target.value) || 0)}
                                className="text-2xl font-bold text-red-900 dark:text-red-100 bg-white/50 dark:bg-black/20 border-b-2 border-red-200 dark:border-red-800 focus:border-red-500 focus:outline-none w-32 px-1 rounded-t"
                                placeholder="0.0"
                             />
                             <span className="ml-2 text-red-700 dark:text-red-300 text-sm font-medium">hrs</span>
                        </div>
                    </div>
                    <svg className="w-8 h-8 text-red-300 dark:text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800 flex justify-between items-center">
                     <div className="flex-1">
                        <p className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase mb-1">Slung Cargo Experience</p>
                        <div className="flex items-center">
                            <input 
                                type="number"
                                min="0"
                                step="0.1"
                                value={staff.pilotData?.slungCargoHours || ''}
                                onChange={(e) => handleUpdatePilotData('slungCargoHours', parseFloat(e.target.value) || 0)}
                                className="text-2xl font-bold text-purple-900 dark:text-purple-100 bg-white/50 dark:bg-black/20 border-b-2 border-purple-200 dark:border-purple-800 focus:border-purple-500 focus:outline-none w-32 px-1 rounded-t"
                                placeholder="0.0"
                            />
                            <span className="ml-2 text-purple-700 dark:text-purple-300 text-sm font-medium">hrs</span>
                        </div>
                    </div>
                    <svg className="w-8 h-8 text-purple-300 dark:text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                </div>
            </div>

            {/* ADJUSTMENTS LIST */}
            <div>
                <h3 className="font-bold text-lg mb-3">Adjustments & External Records</h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">Description</th>
                                <th className="p-3">Aircraft / Category</th>
                                <th className="p-3">Attributes</th>
                                <th className="p-3 text-right">Hours</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {flightHoursAdjustments.filter(a => a.staffId === staff.id).map(adj => {
                                const typeName = adj.aircraftTypeId ? aircraftTypes.find(at => at.id === adj.aircraftTypeId)?.name : null;
                                return (
                                    <tr key={adj.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td className="p-3 whitespace-nowrap">{new Date(adj.date).toLocaleDateString()}</td>
                                        <td className="p-3">{adj.description}</td>
                                        <td className="p-3">
                                            {typeName ? (
                                                <span className="font-semibold">{typeName}</span>
                                            ) : (
                                                <span className="text-gray-500">{adj.category}</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-xs text-gray-500">
                                            {[adj.isTurbine ? 'Turbine' : '', adj.isMultiEngine ? 'Multi-Engine' : ''].filter(Boolean).join(', ')}
                                        </td>
                                        <td className="p-3 text-right font-bold">{adj.hours.toFixed(1)}</td>
                                        <td className="p-3 text-right space-x-2">
                                            <button onClick={() => { setEditingAdjustment(adj); setIsModalOpen(true); }} className="text-brand-primary hover:underline">Edit</button>
                                            <button onClick={() => handleDelete(adj.id)} className="text-red-500 hover:underline">Delete</button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {flightHoursAdjustments.filter(a => a.staffId === staff.id).length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-6 text-center text-gray-500 italic">No external adjustments recorded.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && staff.id && (
                <AdjustmentModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={async (adj) => {
                        await upsertFlightHoursAdjustment(adj);
                        setIsModalOpen(false);
                    }}
                    existingAdjustment={editingAdjustment}
                    staffId={staff.id}
                    aircraftTypes={aircraftTypes}
                />
            )}
        </div>
    );
};

const AdjustmentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (adj: FlightHoursAdjustment) => Promise<void>;
    existingAdjustment: FlightHoursAdjustment | null;
    staffId: string;
    aircraftTypes: AircraftType[];
}> = ({ isOpen, onClose, onSave, existingAdjustment, staffId, aircraftTypes }) => {
    const [adj, setAdj] = useState<Partial<FlightHoursAdjustment>>({});

    React.useEffect(() => {
        if (existingAdjustment) setAdj(existingAdjustment);
        else setAdj({
            date: new Date().toISOString().split('T')[0],
            hours: 0,
            description: '',
            category: 'Helicopter',
            isTurbine: false,
            isMultiEngine: false,
            aircraftTypeId: ''
        });
    }, [existingAdjustment, isOpen]);

    const handleTypeChange = (typeId: string) => {
        const type = aircraftTypes.find(at => at.id === typeId);
        if (type) {
            setAdj(prev => ({
                ...prev,
                aircraftTypeId: typeId,
                category: type.category,
                isTurbine: type.isTurbine || false,
                isMultiEngine: type.isMultiEngine || false
            }));
        } else {
            setAdj(prev => ({ ...prev, aircraftTypeId: '' }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!adj.date || !adj.hours || !adj.description) return;
        
        onSave({
            id: existingAdjustment?.id || `adj_${Date.now()}`,
            staffId: staffId,
            date: adj.date,
            hours: Number(adj.hours),
            description: sanitizeString(adj.description),
            category: adj.category as MajorType,
            aircraftTypeId: adj.aircraftTypeId || undefined,
            isTurbine: adj.isTurbine || false,
            isMultiEngine: adj.isMultiEngine || false,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{existingAdjustment ? 'Edit Adjustment' : 'New Adjustment'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Description</label>
                        <input type="text" value={adj.description || ''} onChange={e => setAdj({...adj, description: e.target.value})} required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="e.g. Previous Experience, External Training" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Date</label>
                            <input type="date" value={adj.date || ''} onChange={e => setAdj({...adj, date: e.target.value})} required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Hours</label>
                            <input type="number" step="0.1" value={adj.hours || ''} onChange={e => setAdj({...adj, hours: parseFloat(e.target.value)})} required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium">Specific Aircraft (Optional)</label>
                        <select 
                            value={adj.aircraftTypeId || ''} 
                            onChange={e => handleTypeChange(e.target.value)} 
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        >
                            <option value="">-- Generic / Unknown Type --</option>
                            {aircraftTypes.map(at => <option key={at.id} value={at.id}>{at.name}</option>)}
                        </select>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded border dark:border-gray-600">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Attributes</p>
                        
                        <div className="flex gap-4 mb-3">
                            <label className="flex items-center">
                                <input type="radio" name="cat" value="Helicopter" checked={adj.category === 'Helicopter'} onChange={() => setAdj({...adj, category: 'Helicopter'})} className="mr-2" disabled={!!adj.aircraftTypeId} />
                                <span className="text-sm">Helicopter</span>
                            </label>
                            <label className="flex items-center">
                                <input type="radio" name="cat" value="Fixed Wing" checked={adj.category === 'Fixed Wing'} onChange={() => setAdj({...adj, category: 'Fixed Wing'})} className="mr-2" disabled={!!adj.aircraftTypeId} />
                                <span className="text-sm">Fixed Wing</span>
                            </label>
                        </div>

                        <div className="flex gap-4">
                            <label className="flex items-center">
                                <input type="checkbox" checked={adj.isTurbine || false} onChange={e => setAdj({...adj, isTurbine: e.target.checked})} className="mr-2" disabled={!!adj.aircraftTypeId} />
                                <span className="text-sm">Turbine</span>
                            </label>
                            <label className="flex items-center">
                                <input type="checkbox" checked={adj.isMultiEngine || false} onChange={e => setAdj({...adj, isMultiEngine: e.target.checked})} className="mr-2" disabled={!!adj.aircraftTypeId} />
                                <span className="text-sm">Multi-Engine</span>
                            </label>
                        </div>
                        {adj.aircraftTypeId && <p className="text-xs text-blue-500 mt-2">Attributes locked by selected aircraft type.</p>}
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded text-sm">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded text-sm">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StaffExperienceTab;
