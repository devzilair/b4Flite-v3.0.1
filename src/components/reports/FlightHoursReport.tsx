
import React, { useMemo, useState, useCallback } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { calculateDurationHours } from '../../utils/timeUtils';
import { MajorType } from '../../types';
import useLocalStorage from '../../hooks/useLocalStorage';
import { useFlightLog } from '../../hooks/useFlightLog';
import { useSettings } from '../../hooks/useSettings';
import { useStaff } from '../../hooks/useStaff';

interface PilotHours {
    staffId: string;
    name: string;
    jobTitle: string;
    licenseType?: string;
    totalHours: number;
    turbineHours: number;
    multiEngineHours: number;
    specificTypeHours: number;
}

interface ManualInstructor {
    id: string;
    name: string;
    isStaff: boolean;
    totalHours: number;
    specificHours: number;
    turbineHours: number;
    multiHours: number;
}

const FlightHoursReport: React.FC = () => {
    const { staff, loading: staffLoading } = useStaff();
    const { aircraftTypes, licenseTypes, loading: settingsLoading } = useSettings();
    // CRITICAL: Request full history (true) for lifetime stats report
    const { flightLogRecords, flightHoursAdjustments, loading: flightLoading } = useFlightLog(true);
    
    const loading = staffLoading || flightLoading || settingsLoading;

    const { can, currentUser } = usePermissions();
    
    // Input State (Form)
    const [categoryInput, setCategoryInput] = useState<MajorType>('Helicopter');
    const [typeInput, setTypeInput] = useState<string>('all');
    const [startDateInput, setStartDateInput] = useState<string>('');
    const [showMultiEngine, setShowMultiEngine] = useState(false);

    // Active Report State
    const [isGenerated, setIsGenerated] = useState(false);
    const [activeFilters, setActiveFilters] = useState({
        category: 'Helicopter' as MajorType,
        typeId: 'all',
        startDate: ''
    });

    // Persistence for manual instructors
    const [manualInstructors, setManualInstructors] = useLocalStorage<ManualInstructor[]>('report_instructors_v4', []);
    
    // Named Instructor Form State
    const [instructorMode, setInstructorMode] = useState<'staff' | 'external'>('staff');
    const [newManualName, setNewManualName] = useState('');
    const [selectedStaffId, setSelectedStaffId] = useState('');

    // --- Helper: Calculate Hours for a specific staff member based on criteria ---
    const calculateStaffHours = useCallback((staffId: string, criteria: { category: MajorType, typeId: string, startDate: string }) => {
        let total = 0;
        let turbine = 0;
        let multi = 0;
        let typeSpecific = 0;

        const myLogs = flightLogRecords.filter(r => {
            const matchesPilot = r.staffId === staffId;
            const matchesDate = !criteria.startDate || r.date >= criteria.startDate;
            return matchesPilot && matchesDate;
        });
        
        myLogs.forEach(log => {
            if (log.flightHoursByAircraft && Object.keys(log.flightHoursByAircraft).length > 0) {
                Object.entries(log.flightHoursByAircraft).forEach(([typeId, hours]) => {
                    const h = Number(hours) || 0;
                    const type = aircraftTypes.find(at => at.id === typeId);
                    // Filter by category to match report context
                    if (type && type.category === criteria.category) {
                        total += h;
                        if (type.isTurbine) turbine += h;
                        if (type.isMultiEngine) multi += h;
                        if (criteria.typeId === 'all' || type.id === criteria.typeId) typeSpecific += h;
                    }
                });
            } else if (log.flightOn && log.flightOff) {
                const h = calculateDurationHours(log.flightOn, log.flightOff);
                const typeId = log.aircraftType;
                const type = aircraftTypes.find(at => at.id === typeId);
                if (type && type.category === criteria.category) {
                    total += h;
                    if (type.isTurbine) turbine += h;
                    if (type.isMultiEngine) multi += h;
                    if (criteria.typeId === 'all' || type.id === criteria.typeId) typeSpecific += h;
                }
            }
        });

        const myAdjustments = flightHoursAdjustments.filter(a => {
            const matchesPilot = a.staffId === staffId;
            const matchesDate = !criteria.startDate || a.date >= criteria.startDate;
            return matchesPilot && matchesDate;
        });
        
        myAdjustments.forEach(adj => {
            if (adj.category === criteria.category) {
                total += adj.hours;
                if (adj.isTurbine) turbine += adj.hours;
                if (adj.isMultiEngine) multi += adj.hours;
                if (criteria.typeId === 'all' || adj.aircraftTypeId === criteria.typeId) typeSpecific += adj.hours;
            }
        });

        return { total, turbine, multi, typeSpecific };
    }, [flightLogRecords, flightHoursAdjustments, aircraftTypes]);

    const handleGenerate = () => {
        const newFilters = {
            category: categoryInput,
            typeId: typeInput,
            startDate: startDateInput
        };
        setActiveFilters(newFilters);
        setIsGenerated(true);

        // Auto-update hours for internal staff in the named list based on new criteria
        setManualInstructors(prev => prev.map(inst => {
            if (inst.isStaff) {
                const stats = calculateStaffHours(inst.id, newFilters);
                return {
                    ...inst,
                    totalHours: stats.total,
                    specificHours: stats.typeSpecific,
                    turbineHours: stats.turbine,
                    multiHours: stats.multi
                };
            }
            return inst; // Keep external instructors as-is (manual entry)
        }));
    };

    // availableTypes depends on input selection for UI, not generation
    const availableTypes = useMemo(() => {
        return aircraftTypes.filter(at => at.category === categoryInput);
    }, [aircraftTypes, categoryInput]);

    // Main Report Data Calculation
    const reportData = useMemo(() => {
        if (!isGenerated) return [];

        const hasManagerAccess = can('roster:view:all') || can('admin:view_settings') || can('staff:view:own_department');

        const pilots = staff.filter(s => {
            if (s.accountStatus === 'disabled') return false;
            
            // Scope Check
            if (!hasManagerAccess) {
                 // Staff View: Self Only
                 return s.id === currentUser?.id;
            } else {
                 // Manager View: Dept Only (unless Admin)
                 const canViewAll = can('roster:view:all') || can('admin:view_settings');
                 if (!canViewAll && currentUser && s.departmentId !== currentUser.departmentId) return false;
            }

            const pilotCats = s.pilotData?.aircraftCategory || [];
            return pilotCats.includes(activeFilters.category);
        });

        const pilotStats: PilotHours[] = pilots.map(pilot => {
            const stats = calculateStaffHours(pilot.id, activeFilters);

            // Resolve License Name
            const licenseId = pilot.pilotData?.licenseType;
            const licenseName = licenseId ? (licenseTypes.find(lt => lt.id === licenseId)?.name || licenseId) : '';

            return {
                staffId: pilot.id,
                name: pilot.name,
                jobTitle: pilot.hrData?.contract?.jobTitle || '', 
                licenseType: licenseName,
                totalHours: stats.total,
                turbineHours: stats.turbine,
                multiEngineHours: stats.multi,
                specificTypeHours: stats.typeSpecific
            };
        });

        return pilotStats.sort((a, b) => b.totalHours - a.totalHours);

    }, [staff, activeFilters, isGenerated, can, currentUser, calculateStaffHours, licenseTypes]);

    // Metrics for Cards
    const metrics = useMemo(() => {
        const internal = reportData.reduce((acc, curr) => ({
            total: acc.total + curr.totalHours,
            turbine: acc.turbine + curr.turbineHours,
            multi: acc.multi + curr.multiEngineHours,
            specific: acc.specific + curr.specificTypeHours,
            count: acc.count + 1
        }), { total: 0, turbine: 0, multi: 0, specific: 0, count: 0 });

        const manual = manualInstructors.reduce((acc, curr) => ({
            total: acc.total + (curr.totalHours || 0),
            turbine: acc.turbine + (curr.turbineHours || 0),
            multi: acc.multi + (curr.multiHours || 0),
            specific: acc.specific + (curr.specificHours || 0),
            count: acc.count + 1
        }), { total: 0, turbine: 0, multi: 0, specific: 0, count: 0 });

        return {
            total: internal.total + manual.total,
            turbine: internal.turbine + manual.turbine,
            multi: internal.multi + manual.multi,
            specific: internal.specific + manual.specific,
            count: internal.count + manual.count
        };
    }, [reportData, manualInstructors]);

    // Instructors Table Logic
    const addInstructor = () => {
        if (instructorMode === 'external') {
            if (!newManualName.trim()) return;
            setManualInstructors(prev => [...prev, {
                id: `ext_${Date.now()}`,
                name: newManualName,
                isStaff: false,
                totalHours: 0,
                specificHours: 0,
                turbineHours: 0,
                multiHours: 0
            }]);
            setNewManualName('');
        } else {
            if (!selectedStaffId) return;
            const staffMember = staff.find(s => s.id === selectedStaffId);
            if (!staffMember) return;
            
            // Check duplicates
            if (manualInstructors.find(i => i.id === selectedStaffId)) {
                alert('This staff member is already in the list.');
                return;
            }

            // --- Auto Calculate Hours for Internal Staff ---
            const stats = calculateStaffHours(selectedStaffId, activeFilters);

            setManualInstructors(prev => [...prev, {
                id: selectedStaffId,
                name: staffMember.name,
                isStaff: true,
                totalHours: stats.total,
                specificHours: stats.typeSpecific,
                turbineHours: stats.turbine,
                multiHours: stats.multi
            }]);
            setSelectedStaffId('');
        }
    };

    const updateManualEntry = (id: string, field: keyof ManualInstructor, value: string) => {
        const numValue = parseFloat(value) || 0;
        setManualInstructors(prev => prev.map(i => i.id === id ? { ...i, [field]: numValue } : i));
    };

    const removeInstructor = (id: string) => {
        setManualInstructors(prev => prev.filter(i => i.id !== id));
    };

    const selectedTypeName = activeFilters.typeId === 'all' 
        ? 'Total Types' 
        : (aircraftTypes.find(at => at.id === activeFilters.typeId)?.name || 'Make & Model');

    const specialOpsData = useMemo(() => {
        const hasManagerAccess = can('roster:view:all') || can('admin:view_settings') || can('staff:view:own_department');
        
        return staff
            .filter(s => {
                if (s.accountStatus === 'disabled') return false;
                
                if (!hasManagerAccess) {
                    return s.id === currentUser?.id;
                } else {
                    const canViewAll = can('roster:view:all') || can('admin:view_settings');
                    if (!canViewAll && currentUser && s.departmentId !== currentUser.departmentId) return false;
                }
                
                return ((s.pilotData?.fireFightingHours || 0) > 0 || (s.pilotData?.slungCargoHours || 0) > 0);
            })
            .map(s => ({
                id: s.id,
                name: s.name,
                fireHours: s.pilotData?.fireFightingHours || 0,
                cargoHours: s.pilotData?.slungCargoHours || 0
            }))
            .sort((a, b) => (b.fireHours + b.cargoHours) - (a.fireHours + a.cargoHours));
    }, [staff, can, currentUser]);

    // Anti-CSV Injection Sanitizer
    const sanitizeForCsv = (field: string | number): string => {
        const str = String(field);
        if (/^[=+\-@]/.test(str)) {
            return "'" + str;
        }
        return str.replace(/"/g, '""'); // Escape double quotes
    };

    const handleExportCSV = () => {
        const headers = ['Name', 'License/Position', `Total ${activeFilters.category} Hrs`, `${selectedTypeName} Hrs`, 'Turbine Hrs'];
        if (showMultiEngine) headers.push('Multi-Engine Hrs');

        const internalRows = reportData.map(r => {
            const row = [
                `"${sanitizeForCsv(r.name)}"`, 
                `"${sanitizeForCsv(r.licenseType ? `${r.licenseType} / ` : '')}${sanitizeForCsv(r.jobTitle)}"`,
                r.totalHours.toFixed(1),
                r.specificTypeHours.toFixed(1),
                r.turbineHours.toFixed(1)
            ];
            if (showMultiEngine) row.push(r.multiEngineHours.toFixed(1));
            return row;
        });
        
        const manualRows = manualInstructors.map(r => {
            const row = [
                 `"${sanitizeForCsv(r.name)} ${r.isStaff ? '(Internal Instructor)' : '(External Instructor)'}"`,
                 "Named Instructor",
                 r.totalHours.toFixed(1),
                 r.specificHours.toFixed(1),
                 r.turbineHours.toFixed(1)
            ];
            if (showMultiEngine) row.push(r.multiHours.toFixed(1));
            return row;
        });
        
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...internalRows.map(e => e.join(',')), ...manualRows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `flight_hours_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div>Loading report data...</div>;

    const availableStaffForInstructor = staff
        .filter(s => s.accountStatus !== 'disabled')
        .filter(s => {
             const hasManagerAccess = can('roster:view:all') || can('admin:view_settings') || can('staff:view:own_department');
             if (!hasManagerAccess) return s.id === currentUser?.id;
             const canViewAll = can('roster:view:all') || can('admin:view_settings');
             return canViewAll || (currentUser && s.departmentId === currentUser.departmentId);
        })
        .sort((a,b) => a.name.localeCompare(b.name));

    return (
        <div className="flex flex-col h-full space-y-6">
            
            {/* Criteria Panel */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 print:hidden">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                         <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        Experience Ledger Configuration
                    </h2>
                </div>

                <div className="flex flex-col space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Aircraft Category</label>
                            <select 
                                value={categoryInput} 
                                onChange={(e) => setCategoryInput(e.target.value as MajorType)}
                                className="p-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-sm w-full"
                            >
                                <option value="Helicopter">Helicopter</option>
                                <option value="Fixed Wing">Fixed Wing</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Specific Type (Optional)</label>
                            <select 
                                value={typeInput} 
                                onChange={(e) => setTypeInput(e.target.value)}
                                className="p-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-sm w-full"
                            >
                                <option value="all">-- All Types --</option>
                                {availableTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Date (Optional)</label>
                            <input 
                                type="date"
                                value={startDateInput}
                                onChange={(e) => setStartDateInput(e.target.value)}
                                className="p-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-sm w-full"
                            />
                        </div>
                        
                        <button 
                            onClick={handleGenerate}
                            className="w-full bg-brand-primary text-white px-6 py-2.5 rounded-md hover:bg-brand-secondary flex items-center justify-center gap-2 font-bold shadow-lg text-sm transition-all active:scale-95"
                        >
                             Generate Ledger
                        </button>
                    </div>

                    <div className="flex items-center">
                         <label className="flex items-center text-xs font-bold text-gray-500 uppercase cursor-pointer hover:text-brand-primary transition-colors">
                             <input 
                                type="checkbox" 
                                checked={showMultiEngine} 
                                onChange={e => setShowMultiEngine(e.target.checked)} 
                                className="mr-2 h-4 w-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary" 
                             />
                             Show Multi-Engine Columns
                         </label>
                    </div>
                </div>
            </div>

            {isGenerated ? (
                <div className="space-y-8 animate-fade-in">
                    
                    {/* Metrics */}
                    <div className={`grid grid-cols-2 ${showMultiEngine ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 print:hidden`}>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-indigo-500">
                             <p className="text-xs font-bold text-gray-500 uppercase">Total {activeFilters.category}</p>
                             <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{metrics.total.toFixed(1)}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-blue-500">
                             <p className="text-xs font-bold text-gray-500 uppercase">Turbine</p>
                             <p className="text-2xl font-black text-blue-700 dark:text-blue-400">{metrics.turbine.toFixed(1)}</p>
                        </div>
                        {showMultiEngine && (
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-cyan-500">
                                <p className="text-xs font-bold text-gray-500 uppercase">Multi-Engine</p>
                                <p className="text-2xl font-black text-cyan-700 dark:text-cyan-400">{metrics.multi.toFixed(1)}</p>
                            </div>
                        )}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-purple-500">
                             <p className="text-xs font-bold text-gray-500 uppercase">{selectedTypeName}</p>
                             <p className="text-2xl font-black text-purple-700 dark:text-purple-400">{metrics.specific.toFixed(1)}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-gray-400">
                             <p className="text-xs font-bold text-gray-500 uppercase">Records</p>
                             <p className="text-2xl font-black text-gray-700 dark:text-white">{metrics.count}</p>
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[400px] flex flex-col">
                        <div className="p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center print:hidden">
                            <span className="text-xs font-bold text-gray-500 uppercase">Internal Crew Records</span>
                            <div className="flex gap-2">
                                <button onClick={handleExportCSV} className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded border border-green-200 font-bold">Export CSV</button>
                                <button onClick={() => window.print()} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded border border-gray-300 font-bold">Print View</button>
                            </div>
                        </div>

                         <div className="hidden print:block p-8 pb-0">
                            <h1 className="text-2xl font-bold uppercase mb-2">Flight Experience Ledger</h1>
                            <p className="text-sm text-gray-600 uppercase font-mono mb-4">
                                {activeFilters.category} | {selectedTypeName} | From: {activeFilters.startDate || 'Inception'}
                            </p>
                        </div>

                        <div className="overflow-auto flex-grow relative p-0 print:p-8">
                             <table className="w-full border-collapse border border-gray-200 dark:border-gray-700 print:border-black text-sm">
                                <thead className="bg-gray-100 dark:bg-gray-700 print:bg-gray-100">
                                    <tr>
                                        <th className="border-b border-gray-300 dark:border-gray-600 print:border-black p-3 text-left uppercase text-xs font-bold">Pilot Name</th>
                                        <th className="border-b border-gray-300 dark:border-gray-600 print:border-black p-3 text-left uppercase text-xs font-bold">License / Position</th>
                                        <th className="border-b border-gray-300 dark:border-gray-600 print:border-black p-3 text-center uppercase text-xs font-bold">Total {activeFilters.category}</th>
                                        <th className="border-b border-gray-300 dark:border-gray-600 print:border-black p-3 text-center uppercase text-xs font-bold bg-purple-50 dark:bg-purple-900/20">{selectedTypeName}</th>
                                        <th className="border-b border-gray-300 dark:border-gray-600 print:border-black p-3 text-center uppercase text-xs font-bold">Turbine</th>
                                        {showMultiEngine && <th className="border-b border-gray-300 dark:border-gray-600 print:border-black p-3 text-center uppercase text-xs font-bold">Multi-Engine</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {reportData.map(row => (
                                        <tr key={row.staffId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 print:break-inside-avoid">
                                            <td className="p-3 border-r border-gray-200 dark:border-gray-700 print:border-black font-bold text-gray-900 dark:text-white">{row.name}</td>
                                            <td className="p-3 border-r border-gray-200 dark:border-gray-700 print:border-black text-xs text-gray-500">
                                                {row.licenseType && <span className="font-bold text-gray-700 dark:text-gray-300 mr-2">{row.licenseType}</span>}
                                                {row.jobTitle}
                                            </td>
                                            <td className="p-3 border-r border-gray-200 dark:border-gray-700 print:border-black text-center font-mono">{row.totalHours.toFixed(1)}</td>
                                            <td className="p-3 border-r border-gray-200 dark:border-gray-700 print:border-black text-center font-mono font-bold bg-purple-50 dark:bg-purple-900/10 print:bg-gray-100">{row.specificTypeHours.toFixed(1)}</td>
                                            <td className="p-3 border-r border-gray-200 dark:border-gray-700 print:border-black text-center font-mono">{row.turbineHours.toFixed(1)}</td>
                                            {showMultiEngine && <td className="p-3 text-center font-mono">{row.multiEngineHours.toFixed(1)}</td>}
                                        </tr>
                                    ))}
                                    {reportData.length === 0 && (
                                        <tr><td colSpan={showMultiEngine ? 6 : 5} className="p-8 text-center text-gray-500 italic">No pilots found matching criteria.</td></tr>
                                    )}
                                </tbody>
                             </table>
                        </div>
                    </div>
                    
                    {/* Named Instructors Section */}
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid">
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 flex flex-wrap justify-between items-center gap-2 print:hidden">
                            <span className="text-xs font-bold text-gray-500 uppercase">Named Instructors</span>
                            <div className="flex gap-2 items-center">
                                <div className="flex bg-gray-200 dark:bg-gray-600 rounded p-1">
                                    <button 
                                        onClick={() => setInstructorMode('staff')}
                                        className={`px-3 py-1 text-xs rounded font-bold ${instructorMode === 'staff' ? 'bg-white dark:bg-gray-700 shadow text-brand-primary' : 'text-gray-500 dark:text-gray-300'}`}
                                    >
                                        Select Staff
                                    </button>
                                    <button 
                                        onClick={() => setInstructorMode('external')}
                                        className={`px-3 py-1 text-xs rounded font-bold ${instructorMode === 'external' ? 'bg-white dark:bg-gray-700 shadow text-brand-primary' : 'text-gray-500 dark:text-gray-300'}`}
                                    >
                                        External
                                    </button>
                                </div>
                                {instructorMode === 'staff' ? (
                                    <select 
                                        value={selectedStaffId}
                                        onChange={(e) => setSelectedStaffId(e.target.value)}
                                        className="text-xs p-1.5 border rounded dark:bg-gray-600 dark:border-gray-500 min-w-[150px]"
                                    >
                                        <option value="">-- Choose Staff --</option>
                                        {availableStaffForInstructor.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                ) : (
                                    <input 
                                        type="text" 
                                        placeholder="External Name" 
                                        value={newManualName}
                                        onChange={e => setNewManualName(e.target.value)}
                                        className="text-xs p-1.5 border rounded dark:bg-gray-600 dark:border-gray-500 min-w-[150px]"
                                    />
                                )}
                                <button onClick={addInstructor} className="text-xs bg-brand-primary text-white px-3 py-1.5 rounded hover:bg-brand-secondary">+ Add</button>
                            </div>
                        </div>
                        {manualInstructors.length > 0 && (
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 uppercase">
                                    <tr>
                                        <th className="p-3 border-b dark:border-gray-600">Name</th>
                                        <th className="p-3 border-b dark:border-gray-600 text-center">Total {activeFilters.category}</th>
                                        <th className="p-3 border-b dark:border-gray-600 text-center">{selectedTypeName}</th>
                                        <th className="p-3 border-b dark:border-gray-600 text-center">Turbine</th>
                                        {showMultiEngine && <th className="p-3 border-b dark:border-gray-600 text-center">Multi-Engine</th>}
                                        <th className="p-3 border-b dark:border-gray-600 text-right print:hidden">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {manualInstructors.map(inst => (
                                        <tr key={inst.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                            <td className="p-3 font-medium text-gray-900 dark:text-white">
                                                {inst.name} 
                                                {inst.isStaff ? (
                                                    <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Staff</span>
                                                ) : (
                                                    <span className="ml-2 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">External</span>
                                                )}
                                            </td>
                                            <td className="p-1 text-center"><input type="number" step="0.1" value={inst.totalHours} onChange={e => updateManualEntry(inst.id, 'totalHours', e.target.value)} className="w-20 text-center bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-brand-primary outline-none font-mono" /></td>
                                            <td className="p-1 text-center"><input type="number" step="0.1" value={inst.specificHours} onChange={e => updateManualEntry(inst.id, 'specificHours', e.target.value)} className="w-20 text-center bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-brand-primary outline-none font-mono" /></td>
                                            <td className="p-1 text-center"><input type="number" step="0.1" value={inst.turbineHours} onChange={e => updateManualEntry(inst.id, 'turbineHours', e.target.value)} className="w-20 text-center bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-brand-primary outline-none font-mono" /></td>
                                            {showMultiEngine && <td className="p-1 text-center"><input type="number" step="0.1" value={inst.multiHours} onChange={e => updateManualEntry(inst.id, 'multiHours', e.target.value)} className="w-20 text-center bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-brand-primary outline-none font-mono" /></td>}
                                            <td className="p-3 text-right print:hidden">
                                                <button onClick={() => removeInstructor(inst.id)} className="text-red-500 hover:underline text-xs">Remove</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {manualInstructors.length === 0 && (
                            <div className="p-6 text-center text-gray-500 text-sm italic">
                                No named instructors added. Use the controls above to add specific individuals to the report.
                            </div>
                        )}
                    </div>

                    {/* Specialized Ops Table */}
                    {specialOpsData.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid">
                            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 font-bold text-gray-700 dark:text-gray-200">
                                Specialized Operations Experience
                            </div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-100 dark:bg-gray-700 text-xs uppercase">
                                    <tr>
                                        <th className="p-3">Pilot Name</th>
                                        <th className="p-3 text-center">Fire Fighting (Hrs)</th>
                                        <th className="p-3 text-center">Slung Cargo (Hrs)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {specialOpsData.map(s => (
                                        <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                            <td className="p-3 font-medium">{s.name}</td>
                                            <td className="p-3 text-center font-mono text-red-600 font-bold">{s.fireHours > 0 ? s.fireHours.toFixed(1) : '-'}</td>
                                            <td className="p-3 text-center font-mono text-purple-600 font-bold">{s.cargoHours > 0 ? s.cargoHours.toFixed(1) : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 min-h-[400px]">
                     <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">Report Not Generated</h3>
                     <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                        Please configure report criteria and click <span className="font-bold text-brand-primary">Generate Ledger</span> to view flight hours.
                     </p>
                </div>
            )}
        </div>
    );
};

export default FlightHoursReport;
