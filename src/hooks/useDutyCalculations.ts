
import { useState, useCallback, useMemo } from 'react';
import { 
    FTLMetrics, calculateAllRollingTotals, calculateFdpDetails, DisruptiveDutyDetails, 
    isDutyDisruptive, validateDisruptiveDuties, RestPeriodDetails, calculateRestPeriod, 
    DaysOffValidationDetails, validateDaysOffRules, StandbyDetails, 
    calculateStandbyDetails, calculateDurationHours, decimalToTime 
} from '../services/ftlCalculations';
import { FlightLogRecord, Staff, MajorType } from '../types';

export type MonthlyDayRecord = Partial<FlightLogRecord> & {
    isDayOff: boolean;
    date: string; 
    metrics: FTLMetrics | null;
    flightDuration: number;
    actualFdp: number; 
    maxFdp: number;
    fdpExtension: number;
    breakDuration: number;
    maxFlightTime: number;
    disruptive: DisruptiveDutyDetails;
    rest: RestPeriodDetails;
    daysOffValidation: DaysOffValidationDetails;
    standby: StandbyDetails;
};

export const useDutyCalculations = (
    selectedPilotId: string, 
    flightLogRecords: FlightLogRecord[],
    currentDate: Date,
    selectedPilot: Staff | undefined
) => {
    const [monthlyData, setMonthlyData] = useState<MonthlyDayRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');

    // --- RECALCULATION ENGINE ---
    const recalculateMonth = useCallback((
        rawMonthRecords: Partial<FlightLogRecord>[], 
        historicRecords: FlightLogRecord[],
        pilot: Staff | undefined
    ): MonthlyDayRecord[] => {
        const categories = pilot?.pilotData?.aircraftCategory || [];
        const aircraftCategory = categories.length > 0 ? categories[0] : undefined;
        const newMonthlyData: MonthlyDayRecord[] = [];
        const combinedRecordsForCalc = [...historicRecords];

        for (let i = 0; i < rawMonthRecords.length; i++) {
            const recordData = rawMonthRecords[i];
            const dateStr = recordData.date!; 
            const flightHoursByAircraft = recordData.flightHoursByAircraft;
            
            let totalFlightHours = flightHoursByAircraft
                ? Object.values(flightHoursByAircraft).reduce((sum, h) => sum + (h || 0), 0)
                : 0;
            
            if (totalFlightHours === 0 && (recordData.flightOn || recordData.flightOff)) {
                totalFlightHours = calculateDurationHours(recordData.flightOn, recordData.flightOff);
            }
            
            const actualFdp = calculateDurationHours(recordData.fdpStart, recordData.fdpEnd);
            
            // Temporary object for rolling calculation context
            const tempRecord: FlightLogRecord = {
                ...recordData,
                id: recordData.id || 'temp',
                staffId: selectedPilotId,
                date: dateStr,
            } as FlightLogRecord;
            
            combinedRecordsForCalc.push(tempRecord);

            const metrics = calculateAllRollingTotals(combinedRecordsForCalc, dateStr);
            const fdpDetails = calculateFdpDetails(recordData, aircraftCategory);
            
            const previousRecordWithEnd = combinedRecordsForCalc
                .slice(0, -1)
                .reverse()
                .find(r => (r.dutyEnd && r.dutyEnd !== '') || (r.standbyOff && r.standbyOff !== ''));

            const restDetails = calculateRestPeriod(recordData, previousRecordWithEnd);
            const standbyDetails = calculateStandbyDetails(recordData);
            const daysOffValidationResult = validateDaysOffRules(combinedRecordsForCalc, dateStr, aircraftCategory);
            const disruptiveViolation = validateDisruptiveDuties(combinedRecordsForCalc, dateStr);

            const combinedValidation: DaysOffValidationDetails = { ...daysOffValidationResult };
            if (restDetails.restViolation && !combinedValidation.violation) combinedValidation.violation = restDetails.restViolation;
            if (standbyDetails.standbyViolation && !combinedValidation.violation) combinedValidation.violation = standbyDetails.standbyViolation;
            if (disruptiveViolation && !combinedValidation.violation) combinedValidation.violation = disruptiveViolation;
            if (actualFdp > 0 && fdpDetails.maxFdp > 0 && actualFdp > fdpDetails.maxFdp && !combinedValidation.violation) {
                combinedValidation.violation = `Exceeded Max FDP of ${decimalToTime(fdpDetails.maxFdp)}.`;
            }
            if (totalFlightHours > 0 && fdpDetails.maxFlightTime > 0 && totalFlightHours > fdpDetails.maxFlightTime && !combinedValidation.violation) {
                combinedValidation.violation = `Exceeded Max Flight Time of ${fdpDetails.maxFlightTime}h.`;
            }

            const isDayOff = recordData.remarks === 'DAY OFF' || (!recordData.dutyStart && !recordData.standbyOn);

            newMonthlyData.push({
                ...recordData,
                date: dateStr,
                staffId: selectedPilotId,
                isDayOff: isDayOff,
                metrics,
                flightDuration: totalFlightHours,
                actualFdp,
                ...fdpDetails,
                disruptive: {
                    isDisruptive: isDutyDisruptive(recordData),
                    disruptiveViolation: disruptiveViolation,
                },
                rest: restDetails,
                daysOffValidation: combinedValidation,
                standby: standbyDetails,
            });
        }
        return newMonthlyData;
    }, [selectedPilotId]);

    // --- INPUT HANDLERS ---

    const handleInputChange = (index: number, field: keyof FlightLogRecord, value: string | boolean | number) => {
        setHasUnsavedChanges(true);
        setSaveStatus('pending');
        const newData = [...monthlyData];
        const newRow = { ...newData[index] };
        if (field === 'sectors') {
            const strVal = String(value);
            (newRow as any)[field] = strVal === '' ? null : parseInt(strVal, 10);
        } else {
            (newRow as any)[field] = value;
        }
        
        const year = currentDate.getUTCFullYear();
        const month = currentDate.getUTCMonth();
        const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        // Filter historical records from global state
        const historicRecords = flightLogRecords
            .filter(r => r.staffId === selectedPilotId && !r.date.startsWith(currentMonthPrefix))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Extract raw data from current state to re-feed into calculator
        const rawInputs = newData.map(d => {
            // Destructure to remove calculated fields, keeping only raw inputs
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { metrics, isDayOff, flightDuration, actualFdp, maxFdp, fdpExtension, breakDuration, maxFlightTime, disruptive, rest, daysOffValidation, standby, ...raw } = d;
            return raw;
        });
        
        // Apply update
        rawInputs[index] = { ...rawInputs[index], [field]: (newRow as any)[field] };
        
        const calculatedData = recalculateMonth(rawInputs, historicRecords, selectedPilot);
        setMonthlyData(calculatedData);
    };

    const handleDayOffToggle = (index: number) => {
        setHasUnsavedChanges(true);
        setSaveStatus('pending');
        const newData = [...monthlyData];
        const currentIsDayOff = newData[index].isDayOff;
        
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { metrics, isDayOff, flightDuration, actualFdp, maxFdp, fdpExtension, breakDuration, maxFlightTime, disruptive, rest, daysOffValidation, standby, ...rawItem } = newData[index];
        let updatedRawItem = { ...rawItem };

        if (!currentIsDayOff) {
            // Clearing duty data to make it a Day Off
            updatedRawItem = {
                ...updatedRawItem,
                dutyStart: '', dutyEnd: '', fdpStart: '', fdpEnd: '', breakStart: '', breakEnd: '', flightOn: '', flightOff: '', standbyOn: '', standbyOff: '',
                aircraftType: '', remarks: '', sectors: null as any, flightHoursByAircraft: {}, isTwoPilotOperation: false, isSplitDuty: false
            };
        } else {
            // Reverting Day Off status
            if (updatedRawItem.remarks === 'DAY OFF') updatedRawItem.remarks = '';
        }

        const rawInputs = newData.map((d, i) => {
            if (i === index) return updatedRawItem;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { metrics, isDayOff, flightDuration, actualFdp, maxFdp, fdpExtension, breakDuration, maxFlightTime, disruptive, rest, daysOffValidation, standby, ...r } = d;
            return r;
        });

        const year = currentDate.getUTCFullYear();
        const month = currentDate.getUTCMonth();
        const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        const historicRecords = flightLogRecords
            .filter(r => r.staffId === selectedPilotId && !r.date.startsWith(currentMonthPrefix))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const calculatedData = recalculateMonth(rawInputs, historicRecords, selectedPilot);
        setMonthlyData(calculatedData);
    };
    
    // Manual re-sync (used on month change or initial load)
    const loadMonthData = useCallback(() => {
        if (!selectedPilotId) return;
        setIsLoading(true);
        
        const year = currentDate.getUTCFullYear();
        const month = currentDate.getUTCMonth();
        const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        const historicRecords = flightLogRecords
            .filter(r => r.staffId === selectedPilotId && !r.date.startsWith(currentMonthPrefix))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const currentMonthMap = new Map<string, FlightLogRecord>();
        flightLogRecords
            .filter(r => r.staffId === selectedPilotId && r.date.startsWith(currentMonthPrefix))
            .forEach(r => currentMonthMap.set(r.date, r));

        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const rawInputs: Partial<FlightLogRecord>[] = [];

        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(Date.UTC(year, month, day));
            const dateStr = dateObj.toISOString().split('T')[0];
            const recordData: Partial<FlightLogRecord> = currentMonthMap.get(dateStr) || { date: dateStr };
            rawInputs.push(recordData);
        }

        const calculatedData = recalculateMonth(rawInputs, historicRecords, selectedPilot);
        setMonthlyData(calculatedData);
        setIsLoading(false);
    }, [currentDate, flightLogRecords, selectedPilotId, recalculateMonth, selectedPilot]);

    // Derived stats
    const stats = useMemo(() => {
        const monthlyDutyHours = monthlyData.reduce((acc, day) => acc + calculateDurationHours(day.dutyStart, day.dutyEnd), 0);
        const monthlyFlightHours = monthlyData.reduce((acc, day) => acc + (day.flightDuration || 0), 0);
        const endOfMonthTotals = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].metrics : null;
        return { monthlyDutyHours, monthlyFlightHours, endOfMonthTotals };
    }, [monthlyData]);

    return {
        monthlyData,
        setMonthlyData,
        isLoading,
        setIsLoading,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        saveStatus,
        setSaveStatus,
        handleInputChange,
        handleDayOffToggle,
        loadMonthData,
        recalculateMonth, // Exposed for special cases (e.g. modal updates)
        stats
    };
};
