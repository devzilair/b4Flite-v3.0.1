
export interface FTLMetrics {
    flightTime3d: number;
    dutyTime3d: number;
    flightTime7d: number;
    dutyTime7d: number;
    flightTime28d: number;
    dutyTime28d: number;
    flightTime90d: number;
    dutyTime90d: number;
    flightTime365d: number;
    dutyTime365d: number;
    fdpTime14d: number;
}

export interface FdpDetails {
    maxFdp: number;
    fdpExtension: number;
    breakDuration: number;
    maxFlightTime: number;
}

export interface DisruptiveDutyDetails {
    isDisruptive: boolean;
    disruptiveViolation?: string;
}

export interface RestPeriodDetails {
    restPeriod: number;
    restViolation?: string;
    hasHistory: boolean;
}

export interface DaysOffValidationDetails {
    violation?: string;
}

export interface StandbyDetails {
    standbyDuration: number;
    standbyViolation?: string;
}
